// ==============================================================================
// Appointly Client — Admin Doctor Schedules Tests (F-007)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.7, AC-F007-01, STS-S1-009;
//            SDS Sections 4.2, 4.3 & 6.1 (admin overrides carry an audit reason)
// The schedules and doctors API modules are mocked; these tests exercise UI
// behaviour only.
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextType } from '../../src/shared/context/AuthContext';
import { ApiClientError } from '../../src/shared/api';
import { type UserProfile } from '../../src/shared/types';
import { AdminSchedulesPage } from '../../src/modules/schedules/AdminSchedulesPage';
import type { ScheduleException, WeeklyShift } from '../../src/modules/schedules/types';
import type { Doctor } from '../../src/modules/doctors/types';
import { AppRouter } from '../../src/router';

vi.mock('../../src/modules/schedules/api', () => ({
  getMySchedule: vi.fn(),
  saveMySchedule: vi.fn(),
  createException: vi.fn(),
  deleteException: vi.fn(),
  getDoctorSchedule: vi.fn(),
  saveDoctorSchedule: vi.fn(),
  createDoctorException: vi.fn(),
  deleteDoctorException: vi.fn(),
}));

vi.mock('../../src/modules/doctors/api', () => ({
  listDoctors: vi.fn(),
}));

import {
  getDoctorSchedule,
  saveDoctorSchedule,
  createDoctorException,
  deleteDoctorException,
} from '../../src/modules/schedules/api';
import { listDoctors } from '../../src/modules/doctors/api';

const adminUser: UserProfile = { userId: 'u-9', email: 'admin@appointly.local', role: 'ADMIN' };

const authFor = (user: UserProfile): AuthContextType => ({
  user,
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(user),
});

const doctor = (overrides: Partial<Doctor> = {}): Doctor => ({
  doctorId: 'd-1',
  fullName: 'Dr. Somchai Jaidee',
  specialization: 'Cardiology',
  profileStatus: 'ACTIVE',
  ...overrides,
});
const somchai = doctor();
const napat = doctor({ doctorId: 'd-2', fullName: 'Dr. Napat Srisuk', specialization: 'Pediatrics', profileStatus: 'INACTIVE' });

const shift = (overrides: Partial<WeeklyShift> = {}): WeeklyShift => ({
  scheduleId: 'sch-1',
  dayOfWeek: 1,
  startTime: '09:00:00',
  endTime: '12:00:00',
  isActive: true,
  ...overrides,
});
const holiday: ScheduleException = {
  exceptionId: 'ex-1',
  exceptionDate: '2099-01-01T00:00:00.000Z',
  startTime: null,
  endTime: null,
  exceptionType: 'HOLIDAY',
  reason: 'New Year',
};
const FUTURE = '2099-12-31';

const renderPage = (route = '/admin/schedules') =>
  render(
    <AuthContext.Provider value={authFor(adminUser)}>
      <MemoryRouter initialEntries={[route]}>
        <AdminSchedulesPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );

const doctorSelect = () => screen.getByLabelText('Doctor') as HTMLSelectElement;

/** Renders the page and selects a doctor, waiting for the editor. */
const openDoctor = async (id = 'd-1') => {
  vi.mocked(getDoctorSchedule).mockResolvedValue({ weeklySchedules: [shift()], exceptions: [holiday] });
  renderPage();
  await waitFor(() => expect(within(doctorSelect()).getAllByRole('option').length).toBeGreaterThan(1));
  fireEvent.change(doctorSelect(), { target: { value: id } });
  await screen.findByRole('list', { name: 'Weekly schedule' });
};

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listDoctors).mockResolvedValue([somchai, napat]);
});

describe('Admin Doctor Schedules (/admin/schedules)', () => {
  describe('doctor dropdown', () => {
    it('loads every doctor (GET /doctors, all statuses) and flags inactive ones', async () => {
      renderPage();
      await waitFor(() => expect(within(doctorSelect()).getAllByRole('option').length).toBe(3));
      expect(vi.mocked(listDoctors).mock.calls[0][0]).toMatchObject({ status: 'ALL' });

      const labels = within(doctorSelect()).getAllByRole('option').map((o) => o.textContent);
      expect(labels).toEqual([
        'Select a doctor…',
        'Dr. Somchai Jaidee — Cardiology',
        'Dr. Napat Srisuk — Pediatrics (inactive)',
      ]);
    });

    it('shows a loading skeleton while the doctors load', () => {
      vi.mocked(listDoctors).mockReturnValue(new Promise(() => undefined));
      renderPage();
      expect(screen.getByLabelText('Loading doctors')).toBeDefined();
    });

    it('asks to select a doctor before anything is loaded', async () => {
      renderPage();
      expect(await screen.findByText('Select a doctor')).toBeDefined();
      expect(getDoctorSchedule).not.toHaveBeenCalled();
    });

    it('shows an empty state with a link when there are no doctors', async () => {
      vi.mocked(listDoctors).mockResolvedValue([]);
      renderPage();
      expect(await screen.findByText('No doctors yet')).toBeDefined();
      expect(screen.getByRole('link', { name: 'Go to Doctor Management' }).getAttribute('href')).toBe('/admin/doctors');
    });

    it('shows an error with Retry when the doctors cannot be loaded', async () => {
      vi.mocked(listDoctors).mockRejectedValueOnce(new ApiClientError('Server exploded', 'INTERNAL', 500));
      renderPage();
      expect((await screen.findByRole('alert')).textContent).toContain('Server exploded');

      vi.mocked(listDoctors).mockResolvedValue([somchai]);
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await waitFor(() => expect(within(doctorSelect()).getAllByRole('option').length).toBe(2));
    });
  });

  describe('loading a doctor\'s schedule', () => {
    it('selecting a doctor loads GET /admin/doctors/:id/schedule and shows hours and holidays', async () => {
      await openDoctor('d-1');

      expect(getDoctorSchedule).toHaveBeenCalledTimes(1);
      expect(vi.mocked(getDoctorSchedule).mock.calls[0][0]).toBe('d-1');
      expect(screen.getByRole('heading', { name: 'Schedule for Dr. Somchai Jaidee' })).toBeDefined();
      expect((screen.getByLabelText('Monday slot 1 start time') as HTMLInputElement).value).toBe('09:00');
      expect((screen.getByLabelText('Monday slot 1 end time') as HTMLInputElement).value).toBe('12:00');
      const list = screen.getByRole('list', { name: 'Schedule exceptions' });
      expect(within(list).getByText('New Year')).toBeDefined();
    });

    it('shows a skeleton while the schedule loads', async () => {
      vi.mocked(getDoctorSchedule).mockReturnValue(new Promise(() => undefined));
      renderPage('/admin/schedules?doctorId=d-1');
      expect(await screen.findByLabelText('Loading schedule')).toBeDefined();
    });

    it('a ?doctorId= deep link pre-selects that doctor; an unknown id is ignored', async () => {
      vi.mocked(getDoctorSchedule).mockResolvedValue({ weeklySchedules: [], exceptions: [] });
      renderPage('/admin/schedules?doctorId=d-2');
      await screen.findByRole('list', { name: 'Weekly schedule' });
      expect(doctorSelect().value).toBe('d-2');
      expect(screen.getByText('Inactive')).toBeDefined();
    });

    it('ignores a ?doctorId= that is not in the list', async () => {
      renderPage('/admin/schedules?doctorId=forged');
      expect(await screen.findByText('Select a doctor')).toBeDefined();
      expect(getDoctorSchedule).not.toHaveBeenCalled();
    });

    it('shows a load error with Retry', async () => {
      vi.mocked(getDoctorSchedule).mockRejectedValueOnce(new ApiClientError('Doctor profile not found.', 'DOCTOR_NOT_FOUND', 404));
      renderPage('/admin/schedules?doctorId=d-1');
      expect((await screen.findByRole('alert')).textContent).toContain('Doctor profile not found.');

      vi.mocked(getDoctorSchedule).mockResolvedValue({ weeklySchedules: [], exceptions: [] });
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByRole('list', { name: 'Weekly schedule' })).toBeDefined();
    });
  });

  describe('overriding the weekly shifts (AC-F007-01)', () => {
    it('Save asks for an audit reason, PUTs with it, and shows a success toast', async () => {
      await openDoctor();
      vi.mocked(saveDoctorSchedule).mockImplementation(async (_id, shifts) =>
        shifts.map((s, i) => ({ ...s, scheduleId: `n-${i}`, startTime: `${s.startTime}:00`, endTime: `${s.endTime}:00` }))
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Monday' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));

      const dialog = await screen.findByRole('dialog', { name: 'Override this schedule?' });
      expect(dialog.textContent).toContain("Dr. Somchai Jaidee's weekly working hours");
      expect(saveDoctorSchedule).not.toHaveBeenCalled();

      fireEvent.change(within(dialog).getByLabelText('Reason for the change'), {
        target: { value: '  Covering a colleague  ' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm & Save' }));

      await waitFor(() => expect(saveDoctorSchedule).toHaveBeenCalledTimes(1));
      expect(saveDoctorSchedule).toHaveBeenCalledWith(
        'd-1',
        [
          { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true },
          { dayOfWeek: 1, startTime: '13:00', endTime: '17:00', isActive: true },
        ],
        'Covering a colleague'
      );
      expect((await screen.findByRole('status')).textContent).toContain('saved successfully');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('requires a reason: an empty reason shows an error and nothing is sent', async () => {
      await openDoctor();
      fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Tuesday' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));

      const dialog = await screen.findByRole('dialog', { name: 'Override this schedule?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm & Save' }));

      expect(await within(dialog).findByText('A reason is required for this change.')).toBeDefined();
      expect(saveDoctorSchedule).not.toHaveBeenCalled();
    });

    it('Cancel closes the confirmation without saving', async () => {
      await openDoctor();
      fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Tuesday' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));
      const dialog = await screen.findByRole('dialog', { name: 'Override this schedule?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(saveDoctorSchedule).not.toHaveBeenCalled();
    });

    it('overlapping shifts are flagged inline and the reason dialog never opens', async () => {
      await openDoctor();
      fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Monday' }));
      type('Monday slot 2 start time', '11:00');
      type('Monday slot 2 end time', '14:00');
      fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));

      expect(await screen.findByText(/Overlaps with 09:00–12:00/)).toBeDefined();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(saveDoctorSchedule).not.toHaveBeenCalled();
    });

    it('a server 422 INVALID_SCHEDULE_WINDOW shows an error banner and keeps the edits', async () => {
      await openDoctor();
      vi.mocked(saveDoctorSchedule).mockRejectedValue(
        new ApiClientError('Schedule windows on the same day (1) must not overlap.', 'INVALID_SCHEDULE_WINDOW', 422)
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Monday' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));
      const dialog = await screen.findByRole('dialog', { name: 'Override this schedule?' });
      fireEvent.change(within(dialog).getByLabelText('Reason for the change'), { target: { value: 'fix' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm & Save' }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('Schedule not saved');
      expect(alert.textContent).toContain('must not overlap');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect((screen.getByLabelText('Monday slot 2 start time') as HTMLInputElement).value).toBe('13:00');
    });
  });

  describe('holidays (POST / DELETE /admin/doctors/:id/exceptions)', () => {
    it('adding a holiday requires a reason, then POSTs for the selected doctor and updates the list', async () => {
      await openDoctor();
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: FUTURE } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Exception' }));
      expect(await screen.findByText('A reason is required for this change.')).toBeDefined();
      expect(createDoctorException).not.toHaveBeenCalled();

      vi.mocked(createDoctorException).mockResolvedValue({
        ...holiday,
        exceptionId: 'new-1',
        exceptionDate: `${FUTURE}T00:00:00.000Z`,
        reason: 'Conference',
      });
      type('Reason', 'Conference');
      fireEvent.click(screen.getByRole('button', { name: 'Add Exception' }));

      await waitFor(() => expect(createDoctorException).toHaveBeenCalledTimes(1));
      expect(createDoctorException).toHaveBeenCalledWith('d-1', {
        exceptionDate: FUTURE,
        exceptionType: 'HOLIDAY',
        startTime: null,
        endTime: null,
        reason: 'Conference',
      });
      expect((await screen.findByRole('status')).textContent).toContain('Holiday added for');
      expect(within(screen.getByRole('list', { name: 'Schedule exceptions' })).getByText('Conference')).toBeDefined();
    });

    it('deleting a holiday asks for confirmation, then DELETEs for the selected doctor', async () => {
      await openDoctor();
      vi.mocked(deleteDoctorException).mockResolvedValue(undefined);
      fireEvent.click(screen.getByRole('button', { name: 'Delete Holiday on Thu, 1 Jan 2099' }));
      const dialog = await screen.findByRole('dialog', { name: 'Remove this exception?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

      await waitFor(() => expect(deleteDoctorException).toHaveBeenCalledWith('d-1', 'ex-1'));
      expect(await screen.findByText('No holidays or time off yet')).toBeDefined();
    });
  });

  describe('switching doctors', () => {
    it('switches straight away when there are no unsaved changes', async () => {
      await openDoctor('d-1');
      vi.mocked(getDoctorSchedule).mockResolvedValue({ weeklySchedules: [shift({ dayOfWeek: 3 })], exceptions: [] });
      fireEvent.change(doctorSelect(), { target: { value: 'd-2' } });

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(await screen.findByRole('heading', { name: 'Schedule for Dr. Napat Srisuk' })).toBeDefined();
      await waitFor(() => expect(screen.getByLabelText('Wednesday slot 1 start time')).toBeDefined());
      const calls = vi.mocked(getDoctorSchedule).mock.calls;
      expect(calls[calls.length - 1][0]).toBe('d-2');
    });

    it('warns before discarding unsaved edits; Keep editing stays, Discard & switch moves on', async () => {
      await openDoctor('d-1');
      fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Friday' }));

      fireEvent.change(doctorSelect(), { target: { value: 'd-2' } });
      const dialog = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(doctorSelect().value).toBe('d-1');
      expect(screen.getByLabelText('Friday slot 1 start time')).toBeDefined(); // edit still there

      vi.mocked(getDoctorSchedule).mockResolvedValue({ weeklySchedules: [], exceptions: [] });
      fireEvent.change(doctorSelect(), { target: { value: 'd-2' } });
      fireEvent.click(await screen.findByRole('button', { name: 'Discard & switch' }));

      expect(await screen.findByRole('heading', { name: 'Schedule for Dr. Napat Srisuk' })).toBeDefined();
      expect(doctorSelect().value).toBe('d-2');
      await waitFor(() => expect(screen.queryByLabelText('Friday slot 1 start time')).toBeNull());
    });
  });
});

describe('Router wiring & navigation (F-007 schedules)', () => {
  it('/admin/schedules renders the page and both navs link to it', async () => {
    window.history.pushState({}, '', '/admin/schedules');
    render(
      <AuthContext.Provider value={authFor(adminUser)}>
        <AppRouter />
      </AuthContext.Provider>
    );
    expect(await screen.findByRole('heading', { name: 'Doctor Schedules' })).toBeDefined();
    const links = screen.getAllByRole('link', { name: 'Schedules' });
    expect(links.length).toBe(2); // desktop + mobile nav
    links.forEach((l) => expect(l.getAttribute('href')).toBe('/admin/schedules'));
  });
});
