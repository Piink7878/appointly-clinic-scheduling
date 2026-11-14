// ==============================================================================
// Appointly Client — Doctor Schedule Manager Tests (F-006)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.6, AC-F006-01/02/03, STS-S1-008;
//            SDS Sections 4.2 & 4.3
// The schedules API module is mocked; these tests exercise UI behaviour only.
// ==============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, AuthContextType } from '../../src/shared/context/AuthContext';
import { ApiClientError } from '../../src/shared/api';
import { UserProfile } from '../../src/shared/types';
import { getBangkokToday } from '../../src/shared/utils';
import { DoctorScheduleManagerPage } from '../../src/modules/schedules/DoctorScheduleManagerPage';
import type { ScheduleException, WeeklyShift } from '../../src/modules/schedules/types';
import {
  DAY_NAMES,
  draftToPayload,
  emptyExceptionForm,
  emptyWeek,
  newSlotKey,
  shiftsToDraft,
  sortExceptions,
  suggestSlot,
  toExceptionPayload,
  toMinutes,
  toTimeInput,
  validateExceptionForm,
  validateWeek,
  type SlotDraft,
  type WeekDraft,
} from '../../src/modules/schedules/validation';
import { AppRouter } from '../../src/router';

vi.mock('../../src/modules/schedules/api', () => ({
  getMySchedule: vi.fn(),
  saveMySchedule: vi.fn(),
  createException: vi.fn(),
  deleteException: vi.fn(),
}));

import {
  getMySchedule,
  saveMySchedule,
  createException,
  deleteException,
} from '../../src/modules/schedules/api';

const doctorUser: UserProfile = { userId: 'u-d', email: 'doctor@appointly.local', role: 'DOCTOR' };

const authFor = (user: UserProfile): AuthContextType => ({
  user,
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(user),
});

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
const lunchBreak: ScheduleException = {
  exceptionId: 'ex-2',
  exceptionDate: '2099-02-03T00:00:00.000Z',
  startTime: '12:00:00',
  endTime: '13:00:00',
  exceptionType: 'BREAK',
  reason: null,
};

const FUTURE = '2099-12-31';
const PAST = '2000-01-01';

const slot = (startTime: string, endTime: string, isActive = true): SlotDraft => ({
  key: newSlotKey(),
  startTime,
  endTime,
  isActive,
});
const weekWith = (day: number, slots: SlotDraft[]): WeekDraft => {
  const w = emptyWeek();
  w[day] = slots;
  return w;
};

const renderPage = () =>
  render(
    <AuthContext.Provider value={authFor(doctorUser)}>
      <MemoryRouter>
        <DoctorScheduleManagerPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );

const load = async (
  shifts: WeeklyShift[] = [shift(), shift({ scheduleId: 'sch-2', startTime: '13:00:00', endTime: '17:00:00' })],
  exceptions: ScheduleException[] = []
) => {
  vi.mocked(getMySchedule).mockResolvedValue({ weeklySchedules: shifts, exceptions });
  renderPage();
  await screen.findByRole('list', { name: 'Weekly schedule' });
};

const setTime = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const lastSaved = () => {
  const calls = vi.mocked(saveMySchedule).mock.calls;
  return calls[calls.length - 1][0];
};

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ------------------------------------------------------------------------------
// Pure helpers
// ------------------------------------------------------------------------------
describe('Schedule helpers (AC-F006-01/02/03)', () => {
  it('normalizes server times for <input type="time">', () => {
    expect(toTimeInput('09:00:00')).toBe('09:00');
    expect(toTimeInput('09:00')).toBe('09:00');
    expect(toTimeInput('24:00')).toBe('');
    expect(toTimeInput(null)).toBe('');
    expect(toMinutes('13:30')).toBe(810);
    expect(Number.isNaN(toMinutes('nope'))).toBe(true);
  });

  it('groups shifts by day (Sunday = 0), sorts them, and keeps inactive ones', () => {
    const week = shiftsToDraft([
      shift({ dayOfWeek: 1, startTime: '13:00:00', endTime: '17:00:00' }),
      shift({ dayOfWeek: 1, startTime: '09:00:00', endTime: '12:00:00' }),
      shift({ dayOfWeek: 0, startTime: '10:00', endTime: '11:00', isActive: false }),
    ]);
    expect(week).toHaveLength(7);
    expect(week[1].map((s) => s.startTime)).toEqual(['09:00', '13:00']);
    expect(week[0][0].isActive).toBe(false);
    expect(week[2]).toEqual([]);
  });

  it('builds the PUT body with every slot of every day', () => {
    const week = emptyWeek();
    week[1] = [slot('09:00', '12:00'), slot('13:00', '17:00')];
    week[6] = [slot('08:00', '10:00', false)];
    expect(draftToPayload(week)).toEqual([
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true },
      { dayOfWeek: 1, startTime: '13:00', endTime: '17:00', isActive: true },
      { dayOfWeek: 6, startTime: '08:00', endTime: '10:00', isActive: false },
    ]);
  });

  it('suggests 09:00–12:00 first, then a split-shift afternoon 13:00–17:00', () => {
    expect(suggestSlot([])).toEqual({ startTime: '09:00', endTime: '12:00' });
    expect(suggestSlot([slot('09:00', '12:00')])).toEqual({ startTime: '13:00', endTime: '17:00' });
    expect(suggestSlot([slot('21:30', '23:00')])).toEqual({ startTime: '', endTime: '' });
  });

  describe('validateWeek', () => {
    it('accepts a split shift (09:00–12:00 + 13:00–17:00)', () => {
      expect(validateWeek(weekWith(1, [slot('09:00', '12:00'), slot('13:00', '17:00')])).count).toBe(0);
    });

    it('accepts back-to-back shifts that only touch at an endpoint (AC-F006-03)', () => {
      expect(validateWeek(weekWith(1, [slot('09:00', '12:00'), slot('12:00', '15:00')])).count).toBe(0);
    });

    it('rejects overlapping shifts and names the conflicting window (AC-F006-02)', () => {
      const later = slot('12:00', '16:00');
      const errors = validateWeek(weekWith(1, [slot('09:00', '13:00'), later]));
      expect(errors.count).toBe(1);
      expect(errors.slots[later.key]).toContain('Overlaps with 09:00–13:00');
    });

    it('rejects an inverted (14:00–10:00) or empty (10:00–10:00) window', () => {
      const inverted = slot('14:00', '10:00');
      const empty = slot('10:00', '10:00');
      const errors = validateWeek(weekWith(2, [inverted, empty]));
      expect(errors.slots[inverted.key]).toBe('End time must be after start time.');
      expect(errors.slots[empty.key]).toBe('End time must be after start time.');
    });

    it('requires both times', () => {
      const half = slot('09:00', '');
      expect(validateWeek(weekWith(3, [half])).slots[half.key]).toBe('Start and end time are required.');
    });

    it('ignores overlaps involving an inactive slot and overlaps across different days', () => {
      expect(validateWeek(weekWith(1, [slot('09:00', '13:00'), slot('12:00', '16:00', false)])).count).toBe(0);
      const w = emptyWeek();
      w[1] = [slot('09:00', '13:00')];
      w[2] = [slot('09:00', '13:00')];
      expect(validateWeek(w).count).toBe(0);
    });
  });

  describe('exception form', () => {
    const today = '2026-11-14';
    const holidayForm = { ...emptyExceptionForm(), exceptionDate: FUTURE };

    it('accepts a full-day holiday and sends null times (AC-F006-03)', () => {
      expect(validateExceptionForm(holidayForm, today)).toEqual({});
      expect(toExceptionPayload(holidayForm)).toEqual({
        exceptionDate: FUTURE,
        exceptionType: 'HOLIDAY',
        startTime: null,
        endTime: null,
        reason: null,
      });
    });

    it('a HOLIDAY with "Full day" off needs a valid window', () => {
      const form = { ...holidayForm, fullDay: false };
      expect(validateExceptionForm(form, today).startTime).toBeDefined();
      expect(validateExceptionForm({ ...form, startTime: '14:00', endTime: '10:00' }, today).endTime).toBeDefined();
      expect(validateExceptionForm({ ...form, startTime: '10:00', endTime: '14:00' }, today)).toEqual({});
    });

    it.each(['BREAK', 'UNAVAILABLE', 'CUSTOM_HOURS'] as const)('%s is never full-day, so it needs times', (type) => {
      const form = { ...holidayForm, exceptionType: type, fullDay: true };
      const errors = validateExceptionForm(form, today);
      expect(errors.startTime).toBeDefined();
      expect(errors.endTime).toBeDefined();
      expect(
        toExceptionPayload({ ...form, startTime: '12:00', endTime: '13:00', reason: '  lunch ' })
      ).toMatchObject({ startTime: '12:00', endTime: '13:00', reason: 'lunch' });
    });

    it('requires a real date that is not in the past', () => {
      expect(validateExceptionForm({ ...holidayForm, exceptionDate: '' }, today).exceptionDate).toBe('Date is required.');
      expect(validateExceptionForm({ ...holidayForm, exceptionDate: '2026-02-30' }, today).exceptionDate).toBe(
        'Enter a valid date.'
      );
      expect(validateExceptionForm({ ...holidayForm, exceptionDate: '2026-11-13' }, today).exceptionDate).toBe(
        'Choose today or a future date.'
      );
      expect(validateExceptionForm({ ...holidayForm, exceptionDate: today }, today)).toEqual({});
    });

    it('boundary: reason 255 characters passes, 256 fails', () => {
      expect(validateExceptionForm({ ...holidayForm, reason: 'r'.repeat(255) }, today).reason).toBeUndefined();
      expect(validateExceptionForm({ ...holidayForm, reason: 'r'.repeat(256) }, today).reason).toBeDefined();
    });

    it('sorts exceptions by date, then by start time', () => {
      const a = { ...holiday, exceptionId: 'a', exceptionDate: '2099-03-01T00:00:00.000Z' };
      const b = { ...lunchBreak, exceptionId: 'b', exceptionDate: '2099-01-05T00:00:00.000Z' };
      const c = { ...holiday, exceptionId: 'c', exceptionDate: '2099-01-05T00:00:00.000Z' };
      expect(sortExceptions([a, b, c]).map((e) => e.exceptionId)).toEqual(['c', 'b', 'a']);
    });
  });
});

// ------------------------------------------------------------------------------
// Weekly schedule editor
// ------------------------------------------------------------------------------
describe('Weekly Recurring Schedule Editor (/doctor/schedule)', () => {
  it('shows a loading skeleton, then all 7 days from Sunday to Saturday', async () => {
    let resolve!: (v: Awaited<ReturnType<typeof getMySchedule>>) => void;
    vi.mocked(getMySchedule).mockReturnValue(new Promise((r) => (resolve = r)));
    renderPage();
    expect(screen.getByLabelText('Loading schedule')).toBeDefined();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);

    resolve({ weeklySchedules: [shift()], exceptions: [] });
    const list = await screen.findByRole('list', { name: 'Weekly schedule' });
    expect(screen.queryByLabelText('Loading schedule')).toBeNull();

    const headings = within(list).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual([...DAY_NAMES]);
  });

  it('populates saved slots (HH:mm) and shows "Day off" for empty days', async () => {
    await load();
    expect((screen.getByLabelText('Monday slot 1 start time') as HTMLInputElement).value).toBe('09:00');
    expect((screen.getByLabelText('Monday slot 1 end time') as HTMLInputElement).value).toBe('12:00');
    expect((screen.getByLabelText('Monday slot 2 start time') as HTMLInputElement).value).toBe('13:00');
    expect((screen.getByLabelText('Monday slot 2 end time') as HTMLInputElement).value).toBe('17:00');
    expect(screen.getAllByText('Day off — no working hours.').length).toBe(6);
  });

  it('every day has a "+ Add Time Slot" button; Save is disabled until something changes', async () => {
    await load([]);
    for (const day of DAY_NAMES) {
      expect(screen.getByRole('button', { name: `Add time slot for ${day}` })).toBeDefined();
    }
    expect((screen.getByRole('button', { name: 'Save Schedule' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('adding slots builds a split shift: 09:00–12:00 then 13:00–17:00', async () => {
    await load([]);
    fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Wednesday' }));
    expect((screen.getByLabelText('Wednesday slot 1 start time') as HTMLInputElement).value).toBe('09:00');
    expect((screen.getByLabelText('Wednesday slot 1 end time') as HTMLInputElement).value).toBe('12:00');

    fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Wednesday' }));
    expect((screen.getByLabelText('Wednesday slot 2 start time') as HTMLInputElement).value).toBe('13:00');
    expect((screen.getByLabelText('Wednesday slot 2 end time') as HTMLInputElement).value).toBe('17:00');
    expect((screen.getByRole('button', { name: 'Save Schedule' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('deleting a slot removes it and restores "Day off" when it was the last one', async () => {
    await load([shift({ dayOfWeek: 5 })]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Friday slot 1' }));
    expect(screen.queryByLabelText('Friday slot 1 start time')).toBeNull();
    expect(screen.getAllByText('Day off — no working hours.').length).toBe(7);
  });

  it('Save Schedule PUTs every slot and shows a success toast; Save is disabled again afterwards (AC-F006-01)', async () => {
    await load();
    vi.mocked(saveMySchedule).mockImplementation(async (shifts) =>
      shifts.map((s, i) => ({ ...s, scheduleId: `n-${i}`, startTime: `${s.startTime}:00`, endTime: `${s.endTime}:00` }))
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Saturday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));

    await waitFor(() => expect(saveMySchedule).toHaveBeenCalledTimes(1));
    expect(lastSaved()).toEqual([
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true },
      { dayOfWeek: 1, startTime: '13:00', endTime: '17:00', isActive: true },
      { dayOfWeek: 6, startTime: '09:00', endTime: '12:00', isActive: true },
    ]);
    expect((await screen.findByRole('status')).textContent).toContain('saved successfully');
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Save Schedule' }) as HTMLButtonElement).disabled).toBe(true)
    );
  });

  it('adjacent shifts (09:00–12:00 + 12:00–15:00) are accepted and sent (AC-F006-03)', async () => {
    await load([]);
    saveSucceeds();
    fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Monday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Monday' }));
    setTime('Monday slot 2 start time', '12:00');
    setTime('Monday slot 2 end time', '15:00');
    fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));

    await waitFor(() => expect(saveMySchedule).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('overlapping shifts are flagged inline and NOT sent (AC-F006-02)', async () => {
    await load([]);
    fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Monday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Monday' }));
    setTime('Monday slot 1 start time', '09:00');
    setTime('Monday slot 1 end time', '13:00');
    setTime('Monday slot 2 start time', '12:00');
    setTime('Monday slot 2 end time', '16:00');
    fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));

    expect(await screen.findByText(/Overlaps with 09:00–13:00/)).toBeDefined();
    expect(screen.getByRole('alert').textContent).toContain('Fix 1 time slot');
    expect(screen.getByLabelText('Monday slot 2 start time').getAttribute('aria-invalid')).toBe('true');
    expect(saveMySchedule).not.toHaveBeenCalled();
  });

  it('an inverted window (14:00–10:00) is flagged inline and NOT sent (AC-F006-02)', async () => {
    await load([]);
    fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Tuesday' }));
    setTime('Tuesday slot 1 start time', '14:00');
    setTime('Tuesday slot 1 end time', '10:00');
    fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));

    expect(await screen.findByText('End time must be after start time.')).toBeDefined();
    expect(saveMySchedule).not.toHaveBeenCalled();
  });

  it('a server 422 INVALID_SCHEDULE_WINDOW shows a clear error banner and keeps the edits', async () => {
    await load([]);
    vi.mocked(saveMySchedule).mockRejectedValue(
      new ApiClientError(
        'Schedule windows on the same day (1) must not overlap.',
        'INVALID_SCHEDULE_WINDOW',
        422
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Monday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Schedule not saved');
    expect(alert.textContent).toContain('must not overlap');
    expect((screen.getByLabelText('Monday slot 1 start time') as HTMLInputElement).value).toBe('09:00');
    expect((screen.getByRole('button', { name: 'Save Schedule' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('other server errors are shown with their message', async () => {
    await load([]);
    vi.mocked(saveMySchedule).mockRejectedValue(new ApiClientError('Doctor profile not found.', 'DOCTOR_NOT_FOUND', 404));
    fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Monday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Doctor profile not found.');
  });

  it('inactive shifts are preserved and sent back unchanged', async () => {
    await load([shift({ dayOfWeek: 2, startTime: '08:00:00', endTime: '09:00:00', isActive: false })]);
    expect((screen.getByLabelText('Tuesday slot 1 active') as HTMLInputElement).checked).toBe(false);
    saveSucceeds();
    fireEvent.click(screen.getByRole('button', { name: 'Add time slot for Monday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));
    await waitFor(() => expect(saveMySchedule).toHaveBeenCalled());
    expect(lastSaved()).toContainEqual({ dayOfWeek: 2, startTime: '08:00', endTime: '09:00', isActive: false });
  });

  it('emptying the whole week is allowed (PUT with no shifts)', async () => {
    await load([shift()]);
    vi.mocked(saveMySchedule).mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Monday slot 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Schedule' }));
    await waitFor(() => expect(saveMySchedule).toHaveBeenCalledWith([]));
    expect((await screen.findByRole('status')).textContent).toContain('saved successfully');
  });

  it('Discard changes restores the last saved schedule', async () => {
    await load([shift()]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Monday slot 1' }));
    expect(screen.queryByLabelText('Monday slot 1 start time')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect((screen.getByLabelText('Monday slot 1 start time') as HTMLInputElement).value).toBe('09:00');
  });

  it('shows a load error with Retry that refetches', async () => {
    vi.mocked(getMySchedule).mockRejectedValueOnce(new ApiClientError('Server exploded', 'INTERNAL', 500));
    renderPage();
    expect((await screen.findByRole('alert')).textContent).toContain('Server exploded');

    vi.mocked(getMySchedule).mockResolvedValue({ weeklySchedules: [], exceptions: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('list', { name: 'Weekly schedule' })).toBeDefined();
  });
});

function saveSucceeds() {
  vi.mocked(saveMySchedule).mockImplementation(async (shifts) =>
    shifts.map((s, i) => ({ ...s, scheduleId: `n-${i}`, startTime: `${s.startTime}:00`, endTime: `${s.endTime}:00` }))
  );
}

// ------------------------------------------------------------------------------
// Exceptions manager
// ------------------------------------------------------------------------------
describe('Schedule Exceptions Manager (holidays / breaks)', () => {
  it('shows an empty state when there are no exceptions', async () => {
    await load([], []);
    expect(screen.getByText('No holidays or time off yet')).toBeDefined();
    expect(screen.queryByRole('list', { name: 'Schedule exceptions' })).toBeNull();
  });

  it('lists configured exceptions with date, type, time window and reason', async () => {
    await load([], [lunchBreak, holiday]);
    const list = screen.getByRole('list', { name: 'Schedule exceptions' });
    const items = within(list).getAllByRole('listitem');
    expect(items.length).toBe(2);

    // sorted soonest first
    expect(items[0].textContent).toContain('Thu, 1 Jan 2099');
    expect(items[0].textContent).toContain('Holiday');
    expect(items[0].textContent).toContain('Full day');
    expect(items[0].textContent).toContain('New Year');
    expect(items[1].textContent).toContain('Tue, 3 Feb 2099');
    expect(items[1].textContent).toContain('Break');
    expect(items[1].textContent).toContain('12:00–13:00');
  });

  it('the date picker blocks past days (min = today in Bangkok)', async () => {
    await load([], []);
    expect((screen.getByLabelText('Date') as HTMLInputElement).min).toBe(getBangkokToday());
  });

  it('adds a full-day holiday (POST with null times), updates the list, shows a toast and resets the form (AC-F006-03)', async () => {
    await load([], []);
    vi.mocked(createException).mockResolvedValue({ ...holiday, exceptionId: 'new-1', exceptionDate: `${FUTURE}T00:00:00.000Z`, reason: 'Year end' });

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: FUTURE } });
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: ' Year end ' } });
    expect(screen.queryByLabelText('Start time')).toBeNull(); // Full day is the default for a holiday
    fireEvent.click(screen.getByRole('button', { name: 'Add Exception' }));

    await waitFor(() => expect(createException).toHaveBeenCalledTimes(1));
    expect(createException).toHaveBeenCalledWith({
      exceptionDate: FUTURE,
      exceptionType: 'HOLIDAY',
      startTime: null,
      endTime: null,
      reason: 'Year end',
    });
    expect((await screen.findByRole('status')).textContent).toContain('Holiday added for');
    const list = await screen.findByRole('list', { name: 'Schedule exceptions' });
    expect(within(list).getByText('Year end')).toBeDefined();
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('');
  });

  it('unchecking "Full day" reveals start/end and sends the window', async () => {
    await load([], []);
    vi.mocked(createException).mockResolvedValue({ ...lunchBreak, exceptionId: 'new-2', exceptionType: 'HOLIDAY' });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: FUTURE } });
    fireEvent.click(screen.getByLabelText('Full day'));
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '12:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Exception' }));

    await waitFor(() => expect(createException).toHaveBeenCalled());
    expect(vi.mocked(createException).mock.calls[0][0]).toMatchObject({
      exceptionType: 'HOLIDAY',
      startTime: '10:00',
      endTime: '12:00',
    });
  });

  it('a Break always needs a time window (no Full day option)', async () => {
    await load([], []);
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'BREAK' } });
    expect(screen.queryByLabelText('Full day')).toBeNull();
    expect(screen.getByLabelText('Start time')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: FUTURE } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Exception' }));
    expect(await screen.findByText('Start time is required.')).toBeDefined();
    expect(screen.getByText('End time is required.')).toBeDefined();
    expect(createException).not.toHaveBeenCalled();
  });

  it('shows inline errors for a missing/past date and an inverted window, without calling the API', async () => {
    await load([], []);
    fireEvent.click(screen.getByRole('button', { name: 'Add Exception' }));
    expect(await screen.findByText('Date is required.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: PAST } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'CUSTOM_HOURS' } });
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Exception' }));

    expect(await screen.findByText('Choose today or a future date.')).toBeDefined();
    expect(screen.getByText('End time must be after start time.')).toBeDefined();
    expect(createException).not.toHaveBeenCalled();
  });

  it('a backend error is shown in a banner and the form keeps its values', async () => {
    await load([], []);
    vi.mocked(createException).mockRejectedValue(
      new ApiClientError('Invalid exceptionDate format.', 'INVALID_EXCEPTION_DATE', 400)
    );
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: FUTURE } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Exception' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Invalid exceptionDate format.');
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe(FUTURE);
  });

  describe('delete', () => {
    const openDelete = async () => {
      await load([], [holiday, lunchBreak]);
      fireEvent.click(screen.getByRole('button', { name: 'Delete Holiday on Thu, 1 Jan 2099' }));
      return screen.findByRole('dialog', { name: 'Remove this exception?' });
    };

    it('asks for confirmation and does nothing on Cancel', async () => {
      const dialog = await openDelete();
      expect(dialog.textContent).toContain('Thu, 1 Jan 2099');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(deleteException).not.toHaveBeenCalled();
      expect(within(screen.getByRole('list', { name: 'Schedule exceptions' })).getAllByRole('listitem').length).toBe(2);
    });

    it('confirming DELETEs, removes it from the list and shows a toast', async () => {
      const dialog = await openDelete();
      vi.mocked(deleteException).mockResolvedValue(undefined);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

      await waitFor(() => expect(deleteException).toHaveBeenCalledWith('ex-1'));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect((await screen.findByRole('status')).textContent).toContain('Holiday on Thu, 1 Jan 2099 removed');
      const items = within(screen.getByRole('list', { name: 'Schedule exceptions' })).getAllByRole('listitem');
      expect(items.length).toBe(1);
      expect(items[0].textContent).toContain('Break');
    });

    it('removing the last exception brings back the empty state', async () => {
      await load([], [holiday]);
      vi.mocked(deleteException).mockResolvedValue(undefined);
      fireEvent.click(screen.getByRole('button', { name: 'Delete Holiday on Thu, 1 Jan 2099' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
      expect(await screen.findByText('No holidays or time off yet')).toBeDefined();
    });

    it('a failed delete keeps the dialog open with the backend message', async () => {
      const dialog = await openDelete();
      vi.mocked(deleteException).mockRejectedValue(new ApiClientError('Network down', 'API_ERROR', 500));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
      expect((await within(dialog).findByRole('alert')).textContent).toContain('Network down');
      expect(screen.getByRole('dialog', { name: 'Remove this exception?' })).toBeDefined();
    });

    it('404 EXCEPTION_NOT_FOUND (already removed elsewhere) drops it from the list with a notice', async () => {
      const dialog = await openDelete();
      vi.mocked(deleteException).mockRejectedValue(
        new ApiClientError('Schedule exception not found.', 'EXCEPTION_NOT_FOUND', 404)
      );
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect((await screen.findByRole('alert')).textContent).toContain('no longer exists');
      const items = within(screen.getByRole('list', { name: 'Schedule exceptions' })).getAllByRole('listitem');
      expect(items.length).toBe(1);
    });
  });
});

// ------------------------------------------------------------------------------
// Router wiring & navigation
// ------------------------------------------------------------------------------
describe('Router wiring & navigation (F-006)', () => {
  it('/doctor/schedule renders the schedule manager and both navs link to it', async () => {
    window.history.pushState({}, '', '/doctor/schedule');
    vi.mocked(getMySchedule).mockResolvedValue({ weeklySchedules: [shift()], exceptions: [] });
    render(
      <AuthContext.Provider value={authFor(doctorUser)}>
        <AppRouter />
      </AuthContext.Provider>
    );

    expect(await screen.findByRole('heading', { name: 'My Schedule' })).toBeDefined();
    expect(await screen.findByRole('list', { name: 'Weekly schedule' })).toBeDefined();
    const links = screen.getAllByRole('link', { name: 'Schedule Manager' });
    expect(links.length).toBe(2); // desktop + mobile nav
    links.forEach((l) => expect(l.getAttribute('href')).toBe('/doctor/schedule'));
    expect(screen.getByRole('navigation', { name: 'Doctor portal (mobile)' })).toBeDefined();
  });
});
