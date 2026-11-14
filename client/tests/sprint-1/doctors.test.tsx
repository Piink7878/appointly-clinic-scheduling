// ==============================================================================
// Appointly Client — Doctor Management & Patient Doctor Directory Tests (F-003)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.3, AC-F003-01/02/03, STS-S1-005;
//            SDS Sections 4.2 & 4.3
// The doctors API module is mocked; these tests exercise UI behaviour only.
// ==============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, AuthContextType } from '../../src/shared/context/AuthContext';
import { ApiClientError } from '../../src/shared/api';
import { UserProfile } from '../../src/shared/types';
import {
  DOCTOR_LIMITS,
  doctorToFormValues,
  emptyDoctorForm,
  isDoctorFormDirty,
  toCreatePayload,
  toUpdatePayload,
  validateDoctorForm,
} from '../../src/modules/doctors/validation';
import { AdminDoctorsPage } from '../../src/modules/doctors/AdminDoctorsPage';
import { PatientDoctorsPage } from '../../src/modules/doctors/PatientDoctorsPage';
import type { Doctor, DoctorServiceSummary } from '../../src/modules/doctors/types';
import { AppRouter } from '../../src/router';

vi.mock('../../src/modules/doctors/api', () => ({
  listDoctors: vi.fn(),
  createDoctor: vi.fn(),
  updateDoctor: vi.fn(),
  updateDoctorStatus: vi.fn(),
  getDoctor: vi.fn(),
  assignService: vi.fn(),
  unassignService: vi.fn(),
}));

// The patient directory loads the service list for its filter dropdown.
vi.mock('../../src/modules/services/api', () => ({
  listServices: vi.fn(),
}));

import {
  listDoctors,
  createDoctor,
  updateDoctor,
  updateDoctorStatus,
} from '../../src/modules/doctors/api';
import { listServices } from '../../src/modules/services/api';

const service = (overrides: Partial<DoctorServiceSummary> = {}): DoctorServiceSummary => ({
  serviceId: 's-1',
  serviceName: 'General Consultation',
  description: null,
  durationMinutes: 30,
  serviceStatus: 'ACTIVE',
  ...overrides,
});

const doctor = (overrides: Partial<Doctor> = {}): Doctor => ({
  doctorId: 'd-1',
  userId: 'u-d1',
  email: 'doctor.somchai@appointly.local',
  fullName: 'Dr. Somchai Jaidee',
  specialization: 'Cardiology',
  professionalLicenseNumber: 'LIC-12345',
  profileStatus: 'ACTIVE',
  accountStatus: 'ACTIVE',
  services: [service()],
  ...overrides,
});

const adminUser: UserProfile = { userId: 'u-9', email: 'admin@appointly.local', role: 'ADMIN' };
const patientUser: UserProfile = { userId: 'u-1', email: 'patient.arisa@appointly.local', role: 'PATIENT' };

const authFor = (user: UserProfile): AuthContextType => ({
  user,
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(user),
});

const renderPage = (ui: React.ReactNode, user: UserProfile, route = '/') =>
  render(
    <AuthContext.Provider value={authFor(user)}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );

const lastCallArgs = <T,>(fn: (...args: never[]) => unknown): T => {
  const calls = vi.mocked(fn).mock.calls;
  return calls[calls.length - 1][0] as T;
};

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listServices).mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

// ------------------------------------------------------------------------------
// Validation & payload helpers
// ------------------------------------------------------------------------------
describe('Doctor form validation (AC-F003-03)', () => {
  const valid = {
    email: 'new.doctor@appointly.local',
    password: 'Passw0rd!',
    fullName: 'Dr. New Doctor',
    specialization: 'Dermatology',
    professionalLicenseNumber: '',
  };

  it('accepts a valid create form (licence optional)', () => {
    expect(validateDoctorForm(valid, 'create')).toEqual({});
  });

  it('requires email, password, name and specialization on create', () => {
    const errors = validateDoctorForm(emptyDoctorForm(), 'create');
    expect(Object.keys(errors).sort()).toEqual(['email', 'fullName', 'password', 'specialization']);
  });

  it('rejects malformed email and short / overlong passwords', () => {
    expect(validateDoctorForm({ ...valid, email: 'not-an-email' }, 'create').email).toBeDefined();
    expect(validateDoctorForm({ ...valid, password: '1234567' }, 'create').password).toBeDefined();
    expect(validateDoctorForm({ ...valid, password: '12345678' }, 'create').password).toBeUndefined();
    expect(
      validateDoctorForm({ ...valid, password: 'x'.repeat(DOCTOR_LIMITS.passwordMax + 1) }, 'create').password
    ).toBeDefined();
  });

  it('boundary: specialization of 150 characters passes, 151 fails', () => {
    expect(
      validateDoctorForm({ ...valid, specialization: 'a'.repeat(150) }, 'create').specialization
    ).toBeUndefined();
    expect(
      validateDoctorForm({ ...valid, specialization: 'a'.repeat(151) }, 'create').specialization
    ).toBeDefined();
  });

  it('boundary: fullName 150 passes / 151 fails; licence 100 passes / 101 fails', () => {
    expect(validateDoctorForm({ ...valid, fullName: 'a'.repeat(150) }, 'create').fullName).toBeUndefined();
    expect(validateDoctorForm({ ...valid, fullName: 'a'.repeat(151) }, 'create').fullName).toBeDefined();
    expect(
      validateDoctorForm({ ...valid, professionalLicenseNumber: 'L'.repeat(100) }, 'create')
        .professionalLicenseNumber
    ).toBeUndefined();
    expect(
      validateDoctorForm({ ...valid, professionalLicenseNumber: 'L'.repeat(101) }, 'create')
        .professionalLicenseNumber
    ).toBeDefined();
  });

  it('whitespace-only names are treated as empty', () => {
    const errors = validateDoctorForm({ ...valid, fullName: '   ', specialization: '  ' }, 'create');
    expect(errors.fullName).toBeDefined();
    expect(errors.specialization).toBeDefined();
  });

  it('edit mode does not validate email / password', () => {
    expect(
      validateDoctorForm({ ...valid, email: '', password: '' }, 'edit')
    ).toEqual({});
  });

  it('create payload trims, lowercases the email and omits an empty licence number', () => {
    expect(
      toCreatePayload({ ...valid, email: '  New.Doctor@Appointly.Local ', fullName: '  Dr. X ' })
    ).toEqual({
      email: 'new.doctor@appointly.local',
      password: 'Passw0rd!',
      fullName: 'Dr. X',
      specialization: 'Dermatology',
    });
    expect(toCreatePayload({ ...valid, professionalLicenseNumber: ' L-1 ' }).professionalLicenseNumber).toBe(
      'L-1'
    );
  });

  it('update payload sends null for an emptied licence number so it is cleared', () => {
    const values = { ...doctorToFormValues(doctor()), professionalLicenseNumber: '  ' };
    expect(toUpdatePayload(values)).toEqual({
      fullName: 'Dr. Somchai Jaidee',
      specialization: 'Cardiology',
      professionalLicenseNumber: null,
    });
  });

  it('dirty check ignores surrounding whitespace', () => {
    const d = doctor();
    const values = doctorToFormValues(d);
    expect(isDoctorFormDirty(values, d)).toBe(false);
    expect(isDoctorFormDirty({ ...values, fullName: `  ${d.fullName} ` }, d)).toBe(false);
    expect(isDoctorFormDirty({ ...values, specialization: 'Neurology' }, d)).toBe(true);
  });
});

// ------------------------------------------------------------------------------
// Admin Doctor Management page
// ------------------------------------------------------------------------------
describe('AdminDoctorsPage (/admin/doctors)', () => {
  const active = doctor();
  const inactive = doctor({
    doctorId: 'd-2',
    userId: 'u-d2',
    email: 'doctor.napat@appointly.local',
    fullName: 'Dr. Napat Srisuk',
    specialization: 'Pediatrics',
    professionalLicenseNumber: null,
    profileStatus: 'INACTIVE',
    accountStatus: 'INACTIVE',
    services: [],
  });

  const renderAdmin = () => renderPage(<AdminDoctorsPage />, adminUser);

  it('shows a loading skeleton, then the table and cards with all required columns', async () => {
    let resolve!: (d: Doctor[]) => void;
    vi.mocked(listDoctors).mockReturnValue(new Promise<Doctor[]>((r) => (resolve = r)));
    renderAdmin();

    expect(screen.getByLabelText('Loading doctors')).toBeDefined();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);

    await act(async () => resolve([active, inactive]));

    expect(screen.queryByLabelText('Loading doctors')).toBeNull();
    const table = screen.getByRole('table');
    for (const header of ['Name', 'Specialization', 'License No.', 'Email', 'Status', 'Actions']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeDefined();
    }
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(3); // header + 2 doctors
    expect(within(rows[1]).getByText('Dr. Somchai Jaidee')).toBeDefined();
    expect(within(rows[1]).getByText('Cardiology')).toBeDefined();
    expect(within(rows[1]).getByText('LIC-12345')).toBeDefined();
    expect(within(rows[1]).getByText('doctor.somchai@appointly.local')).toBeDefined();
    expect(within(rows[1]).getByText('Active')).toBeDefined();
    expect(within(rows[2]).getByText('Inactive')).toBeDefined();
    expect(within(rows[2]).getByText('—')).toBeDefined(); // missing licence

    const cards = within(screen.getByRole('list', { name: 'Doctor list' })).getAllByRole('listitem');
    expect(cards.length).toBe(2);
  });

  it('requests all statuses with no search term initially', async () => {
    vi.mocked(listDoctors).mockResolvedValue([active]);
    renderAdmin();
    await screen.findByRole('table');
    const args = lastCallArgs<{ status: string; search: string }>(listDoctors);
    expect(args.status).toBe('ALL');
    expect(args.search).toBe('');
  });

  it('status badge uses green for ACTIVE and gray for INACTIVE (SDS 4.3)', async () => {
    vi.mocked(listDoctors).mockResolvedValue([active, inactive]);
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Active').className).toContain('emerald');
    expect(within(table).getByText('Inactive').className).toContain('slate');
  });

  it('changing the status filter refetches with that status', async () => {
    vi.mocked(listDoctors).mockResolvedValue([active]);
    renderAdmin();
    await screen.findByRole('table');

    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'INACTIVE' } });
    await waitFor(() => expect(lastCallArgs<{ status: string }>(listDoctors).status).toBe('INACTIVE'));
  });

  it('debounces search: one request with the term after 300 ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(listDoctors).mockResolvedValue([active]);
    renderAdmin();
    await screen.findByRole('table');
    vi.mocked(listDoctors).mockClear();

    const input = screen.getByLabelText('Search doctors');
    fireEvent.change(input, { target: { value: 'c' } });
    fireEvent.change(input, { target: { value: 'ca' } });
    fireEvent.change(input, { target: { value: 'card' } });

    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(listDoctors).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(listDoctors).toHaveBeenCalledTimes(1);
    expect(lastCallArgs<{ search: string }>(listDoctors).search).toBe('card');
  });

  it('shows a "no doctors yet" empty state with an Add action when nothing exists', async () => {
    vi.mocked(listDoctors).mockResolvedValue([]);
    renderAdmin();
    expect(await screen.findByText('No doctors yet')).toBeDefined();
    expect(screen.getByRole('button', { name: /Add your first doctor/i })).toBeDefined();
  });

  it('shows a filtered empty state and clears the filters', async () => {
    vi.mocked(listDoctors).mockResolvedValue([active]);
    renderAdmin();
    await screen.findByRole('table');

    vi.mocked(listDoctors).mockResolvedValue([]);
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'INACTIVE' } });
    expect(await screen.findByText('No doctors found')).toBeDefined();

    vi.mocked(listDoctors).mockResolvedValue([active]);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('table')).toBeDefined();
    expect((screen.getByLabelText('Filter by status') as HTMLSelectElement).value).toBe('ALL');
  });

  it('shows a load error with Retry that refetches', async () => {
    vi.mocked(listDoctors).mockRejectedValueOnce(new ApiClientError('Server exploded', 'INTERNAL', 500));
    renderAdmin();
    expect((await screen.findByRole('alert')).textContent).toContain('Server exploded');

    vi.mocked(listDoctors).mockResolvedValue([active]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('table')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // ---- Create ---------------------------------------------------------------
  describe('Add New Doctor', () => {
    const openCreate = async () => {
      vi.mocked(listDoctors).mockResolvedValue([active]);
      renderAdmin();
      await screen.findByRole('table');
      fireEvent.click(screen.getByRole('button', { name: /Add New Doctor/i }));
      return screen.findByRole('dialog', { name: 'Add New Doctor' });
    };

    const fillValid = () => {
      type('Email', 'New.Doctor@Appointly.Local');
      type('Temporary password', 'Passw0rd!');
      type('Full name', 'Dr. New Doctor');
      type('Specialization', 'Dermatology');
    };

    it('opens an accessible dialog and focuses the first field', async () => {
      const dialog = await openCreate();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(document.activeElement).toBe(screen.getByLabelText('Email'));
    });

    it('blocks submit with inline errors when required fields are empty (no API call)', async () => {
      await openCreate();
      fireEvent.click(screen.getByRole('button', { name: 'Create Doctor' }));

      expect(await screen.findByText('Email is required.')).toBeDefined();
      expect(screen.getByText('Password is required.')).toBeDefined();
      expect(screen.getByText('Full name is required.')).toBeDefined();
      expect(screen.getByText('Specialization is required.')).toBeDefined();
      expect(createDoctor).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
    });

    it('rejects a 151-character specialization inline (AC-F003-03)', async () => {
      await openCreate();
      fillValid();
      type('Specialization', 'a'.repeat(151));
      fireEvent.click(screen.getByRole('button', { name: 'Create Doctor' }));
      expect(await screen.findByText(/Specialization must not exceed 150/)).toBeDefined();
      expect(createDoctor).not.toHaveBeenCalled();
    });

    it('creates the doctor, closes the dialog, shows a success banner and reloads the list', async () => {
      await openCreate();
      vi.mocked(createDoctor).mockResolvedValue(
        doctor({ doctorId: 'd-3', fullName: 'Dr. New Doctor', specialization: 'Dermatology' })
      );
      fillValid();
      fireEvent.click(screen.getByRole('button', { name: 'Create Doctor' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(createDoctor).toHaveBeenCalledWith({
        email: 'new.doctor@appointly.local',
        password: 'Passw0rd!',
        fullName: 'Dr. New Doctor',
        specialization: 'Dermatology',
      });
      expect((await screen.findByRole('status')).textContent).toContain('Dr. New Doctor created successfully');
      expect(listDoctors).toHaveBeenCalledTimes(2);
    });

    it('409 EMAIL_ALREADY_EXISTS shows an inline email error and keeps the dialog + input', async () => {
      await openCreate();
      vi.mocked(createDoctor).mockRejectedValue(
        new ApiClientError('An account with this email address already exists.', 'EMAIL_ALREADY_EXISTS', 409)
      );
      fillValid();
      fireEvent.click(screen.getByRole('button', { name: 'Create Doctor' }));

      expect(await screen.findByText('An account with this email address already exists.')).toBeDefined();
      expect(screen.getByRole('dialog', { name: 'Add New Doctor' })).toBeDefined();
      expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Dr. New Doctor');
      expect(listDoctors).toHaveBeenCalledTimes(1);
      // Editing the email clears its error.
      type('Email', 'other@appointly.local');
      expect(screen.queryByText('An account with this email address already exists.')).toBeNull();
    });

    it('other backend errors appear in an alert banner inside the dialog', async () => {
      await openCreate();
      vi.mocked(createDoctor).mockRejectedValue(
        new ApiClientError('Specialization must not exceed 150 characters', 'VALIDATION_ERROR', 400)
      );
      fillValid();
      fireEvent.click(screen.getByRole('button', { name: 'Create Doctor' }));

      const alert = await screen.findByRole('alert');
      expect(within(screen.getByRole('dialog')).getByRole('alert')).toBe(alert);
      expect(alert.textContent).toContain('Specialization must not exceed 150 characters');
    });

    it('password visibility can be toggled', async () => {
      await openCreate();
      const password = screen.getByLabelText('Temporary password') as HTMLInputElement;
      expect(password.type).toBe('password');
      fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
      expect(password.type).toBe('text');
    });

    it('Escape and Cancel close the dialog and restore focus to the trigger', async () => {
      vi.mocked(listDoctors).mockResolvedValue([active]);
      renderAdmin();
      await screen.findByRole('table');
      const trigger = screen.getByRole('button', { name: /Add New Doctor/i });
      trigger.focus(); // a real click focuses the button; fireEvent.click does not
      fireEvent.click(trigger);
      await screen.findByRole('dialog');

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(document.activeElement).toBe(trigger);

      fireEvent.click(trigger);
      await screen.findByRole('dialog');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(createDoctor).not.toHaveBeenCalled();
    });

    it('cannot be dismissed while saving', async () => {
      await openCreate();
      let resolve!: (d: Doctor) => void;
      vi.mocked(createDoctor).mockReturnValue(new Promise<Doctor>((r) => (resolve = r)));
      fillValid();
      fireEvent.click(screen.getByRole('button', { name: 'Create Doctor' }));

      const saving = await screen.findByRole('button', { name: 'Saving…' });
      expect((saving as HTMLButtonElement).disabled).toBe(true);
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(screen.getByRole('dialog')).toBeDefined();

      await act(async () => resolve(doctor({ fullName: 'Dr. New Doctor' })));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });

  // ---- Edit -----------------------------------------------------------------
  describe('Edit doctor', () => {
    const openEdit = async () => {
      vi.mocked(listDoctors).mockResolvedValue([active, inactive]);
      renderAdmin();
      await screen.findByRole('table');
      fireEvent.click(screen.getAllByRole('button', { name: 'Edit Dr. Somchai Jaidee' })[0]);
      return screen.findByRole('dialog', { name: 'Edit Doctor' });
    };

    it('prefills the form, keeps email read-only, and disables Save until something changes', async () => {
      await openEdit();
      expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Dr. Somchai Jaidee');
      expect((screen.getByLabelText('Specialization') as HTMLInputElement).value).toBe('Cardiology');
      expect((screen.getByLabelText('Professional license number') as HTMLInputElement).value).toBe(
        'LIC-12345'
      );
      const email = screen.getByLabelText('Email') as HTMLInputElement;
      expect(email.readOnly).toBe(true);
      expect(email.value).toBe('doctor.somchai@appointly.local');
      expect(screen.queryByLabelText('Temporary password')).toBeNull();

      const save = screen.getByRole('button', { name: 'Save Changes' }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);
      type('Specialization', 'Neurology');
      expect(save.disabled).toBe(false);
    });

    it('PUTs the changed fields, shows a success banner and reloads', async () => {
      await openEdit();
      vi.mocked(updateDoctor).mockResolvedValue({ ...active, specialization: 'Neurology' });
      type('Specialization', '  Neurology ');
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(updateDoctor).toHaveBeenCalledWith('d-1', {
        fullName: 'Dr. Somchai Jaidee',
        specialization: 'Neurology',
        professionalLicenseNumber: 'LIC-12345',
      });
      expect((await screen.findByRole('status')).textContent).toContain('updated successfully');
      expect(listDoctors).toHaveBeenCalledTimes(2);
    });

    it('clearing the licence number sends null', async () => {
      await openEdit();
      vi.mocked(updateDoctor).mockResolvedValue({ ...active, professionalLicenseNumber: null });
      type('Professional license number', '');
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      await waitFor(() => expect(updateDoctor).toHaveBeenCalled());
      expect(vi.mocked(updateDoctor).mock.calls[0][1].professionalLicenseNumber).toBeNull();
    });

    it('blocks an emptied name inline without calling the API', async () => {
      await openEdit();
      type('Full name', '   ');
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      expect(await screen.findByText('Full name is required.')).toBeDefined();
      expect(updateDoctor).not.toHaveBeenCalled();
    });

    it('404 from the backend is shown in the dialog', async () => {
      await openEdit();
      vi.mocked(updateDoctor).mockRejectedValue(
        new ApiClientError('Doctor profile not found.', 'DOCTOR_NOT_FOUND', 404)
      );
      type('Specialization', 'Neurology');
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      expect((await screen.findByRole('alert')).textContent).toContain('Doctor profile not found.');
      expect(screen.getByRole('dialog', { name: 'Edit Doctor' })).toBeDefined();
    });
  });

  // ---- Status toggle --------------------------------------------------------
  describe('Activate / Deactivate', () => {
    const open = async (name: string) => {
      vi.mocked(listDoctors).mockResolvedValue([active, inactive]);
      renderAdmin();
      await screen.findByRole('table');
      fireEvent.click(screen.getAllByRole('button', { name })[0]);
    };

    it('asks for confirmation before deactivating and does nothing on Cancel', async () => {
      await open('Deactivate Dr. Somchai Jaidee');
      const dialog = await screen.findByRole('dialog', { name: 'Deactivate doctor?' });
      expect(dialog.textContent).toContain('Dr. Somchai Jaidee');
      expect(updateDoctorStatus).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(updateDoctorStatus).not.toHaveBeenCalled();
    });

    it('confirming PATCHes INACTIVE, shows a banner and reloads', async () => {
      await open('Deactivate Dr. Somchai Jaidee');
      vi.mocked(updateDoctorStatus).mockResolvedValue({ ...active, profileStatus: 'INACTIVE' });
      await screen.findByRole('dialog');
      fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(updateDoctorStatus).toHaveBeenCalledWith('d-1', 'INACTIVE');
      expect((await screen.findByRole('status')).textContent).toContain('Dr. Somchai Jaidee is now inactive');
      expect(listDoctors).toHaveBeenCalledTimes(2);
    });

    it('an INACTIVE doctor offers Activate, which PATCHes ACTIVE', async () => {
      await open('Activate Dr. Napat Srisuk');
      vi.mocked(updateDoctorStatus).mockResolvedValue({ ...inactive, profileStatus: 'ACTIVE' });
      await screen.findByRole('dialog', { name: 'Activate doctor?' });
      fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

      await waitFor(() => expect(updateDoctorStatus).toHaveBeenCalledWith('d-2', 'ACTIVE'));
      expect((await screen.findByRole('status')).textContent).toContain('is now active');
    });

    it('a failed change keeps the dialog open with the backend message', async () => {
      await open('Deactivate Dr. Somchai Jaidee');
      vi.mocked(updateDoctorStatus).mockRejectedValue(
        new ApiClientError('Doctor profile not found.', 'DOCTOR_NOT_FOUND', 404)
      );
      await screen.findByRole('dialog');
      fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

      expect((await screen.findByRole('alert')).textContent).toContain('Doctor profile not found.');
      expect(screen.getByRole('dialog', { name: 'Deactivate doctor?' })).toBeDefined();
      expect(listDoctors).toHaveBeenCalledTimes(1);
    });
  });
});

// ------------------------------------------------------------------------------
// Patient Doctor Directory page
// ------------------------------------------------------------------------------
describe('PatientDoctorsPage (/patient/doctors)', () => {
  const cardio = doctor({
    services: [
      service(),
      service({ serviceId: 's-2', serviceName: 'ECG Screening', durationMinutes: 45 }),
      service({ serviceId: 's-3', serviceName: 'Retired Service', serviceStatus: 'INACTIVE' }),
    ],
  });
  const derm = doctor({
    doctorId: 'd-4',
    userId: 'u-d4',
    email: 'doctor.mali@appointly.local',
    fullName: 'Dr. Mali Rattana',
    specialization: 'Dermatology',
    professionalLicenseNumber: 'LIC-99999',
    services: [],
  });

  const renderPatient = (route = '/patient/doctors') =>
    renderPage(<PatientDoctorsPage />, patientUser, route);

  it('shows skeleton cards while fetching, then doctor cards', async () => {
    let resolve!: (d: Doctor[]) => void;
    vi.mocked(listDoctors).mockReturnValue(new Promise<Doctor[]>((r) => (resolve = r)));
    renderPatient();

    expect(screen.getByLabelText('Loading doctors')).toBeDefined();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);

    await act(async () => resolve([cardio, derm]));
    expect(screen.queryByLabelText('Loading doctors')).toBeNull();
    expect(screen.getByRole('list', { name: 'Doctor list' })).toBeDefined();
    expect(screen.getByText('Dr. Somchai Jaidee')).toBeDefined();
    expect(screen.getByText('Dr. Mali Rattana')).toBeDefined();
  });

  it('shows specialization and only ACTIVE service badges with durations', async () => {
    vi.mocked(listDoctors).mockResolvedValue([cardio]);
    renderPatient();
    await screen.findByText('Dr. Somchai Jaidee');

    expect(screen.getByText('Cardiology')).toBeDefined();
    const services = screen.getByRole('list', { name: 'Services offered by Dr. Somchai Jaidee' });
    expect(within(services).getByText('General Consultation')).toBeDefined();
    expect(within(services).getByText('ECG Screening')).toBeDefined();
    expect(within(services).getByText(/30 mins/)).toBeDefined();
    expect(within(services).getByText(/45 mins/)).toBeDefined();
    expect(screen.queryByText('Retired Service')).toBeNull();
  });

  it('shows a placeholder for a doctor without services', async () => {
    vi.mocked(listDoctors).mockResolvedValue([derm]);
    renderPatient();
    await screen.findByText('Dr. Mali Rattana');
    expect(screen.getByText('No services assigned yet.')).toBeDefined();
  });

  it('does not expose contact email or licence number to patients', async () => {
    vi.mocked(listDoctors).mockResolvedValue([cardio]);
    renderPatient();
    await screen.findByText('Dr. Somchai Jaidee');
    expect(screen.queryByText(/appointly\.local/)).toBeNull();
    expect(screen.queryByText(/LIC-12345/)).toBeNull();
  });

  it('never renders an INACTIVE doctor even if the API returned one (BR-003)', async () => {
    vi.mocked(listDoctors).mockResolvedValue([cardio, doctor({ doctorId: 'd-9', fullName: 'Dr. Hidden', profileStatus: 'INACTIVE' })]);
    renderPatient();
    await screen.findByText('Dr. Somchai Jaidee');
    expect(screen.queryByText('Dr. Hidden')).toBeNull();
  });

  it('shows a clear empty state when there are no doctors', async () => {
    vi.mocked(listDoctors).mockResolvedValue([]);
    renderPatient();
    expect(await screen.findByText('No doctors available')).toBeDefined();
    expect(screen.getByRole('link', { name: 'browse our services' }).getAttribute('href')).toBe(
      '/patient/services'
    );
  });

  it('passes ?serviceId= to the API and offers to clear the filter (AC-F005-03)', async () => {
    vi.mocked(listDoctors).mockResolvedValue([]);
    renderPatient('/patient/doctors?serviceId=svc-empty');

    expect(await screen.findByText('No doctors are currently available for this service')).toBeDefined();
    expect(lastCallArgs<{ serviceId: string }>(listDoctors).serviceId).toBe('svc-empty');

    vi.mocked(listDoctors).mockResolvedValue([cardio]);
    fireEvent.click(screen.getByRole('button', { name: 'Show all doctors' }));
    expect(await screen.findByText('Dr. Somchai Jaidee')).toBeDefined();
    expect(lastCallArgs<{ serviceId?: string }>(listDoctors).serviceId).toBeUndefined();
  });

  it('pre-selects a deep-linked service in the filter dropdown', async () => {
    vi.mocked(listServices).mockResolvedValue([
      { serviceId: 's-1', serviceName: 'General Consultation', description: null, durationMinutes: 30, serviceStatus: 'ACTIVE' },
      { serviceId: 's-2', serviceName: 'ECG Screening', description: null, durationMinutes: 45, serviceStatus: 'ACTIVE' },
    ]);
    vi.mocked(listDoctors).mockResolvedValue([cardio]);
    renderPatient('/patient/doctors?serviceId=s-2');
    await screen.findByText('Dr. Somchai Jaidee');

    const select = screen.getByLabelText('Filter by service') as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('s-2'));
    expect(within(select).getByRole('option', { name: 'ECG Screening (45 mins)' })).toBeDefined();
  });

  it('shows an error banner with Retry', async () => {
    vi.mocked(listDoctors).mockRejectedValueOnce(new ApiClientError('Network down', 'API_ERROR', 500));
    renderPatient();
    expect((await screen.findByRole('alert')).textContent).toContain('Network down');

    vi.mocked(listDoctors).mockResolvedValue([cardio]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Dr. Somchai Jaidee')).toBeDefined();
  });
});

// ------------------------------------------------------------------------------
// Router wiring & navigation
// ------------------------------------------------------------------------------
describe('Router wiring & navigation (F-003)', () => {
  const renderRoute = (path: string, user: UserProfile) => {
    window.history.pushState({}, '', path);
    return render(
      <AuthContext.Provider value={authFor(user)}>
        <AppRouter />
      </AuthContext.Provider>
    );
  };

  it('/admin/doctors renders the doctor management page (not the placeholder)', async () => {
    vi.mocked(listDoctors).mockResolvedValue([doctor()]);
    renderRoute('/admin/doctors', adminUser);

    expect(await screen.findByRole('heading', { name: 'Doctor Management' })).toBeDefined();
    expect(await screen.findByRole('table')).toBeDefined();
    const links = screen.getAllByRole('link', { name: 'Doctors' });
    expect(links.length).toBe(2); // desktop + mobile nav
    links.forEach((l) => expect(l.getAttribute('href')).toBe('/admin/doctors'));
  });

  it('/patient/doctors renders the directory and both navs link to it', async () => {
    vi.mocked(listDoctors).mockResolvedValue([doctor()]);
    renderRoute('/patient/doctors', patientUser);

    expect(await screen.findByRole('heading', { name: 'Find a Doctor' })).toBeDefined();
    const links = screen.getAllByRole('link', { name: 'Find a Doctor' });
    expect(links.length).toBe(2);
    links.forEach((l) => expect(l.getAttribute('href')).toBe('/patient/doctors'));
  });

  it('unauthorised roles cannot reach the pages', async () => {
    vi.mocked(listDoctors).mockResolvedValue([]);
    renderRoute('/admin/doctors', patientUser);
    await waitFor(() => expect(window.location.pathname).toBe('/unauthorized'));
    expect(screen.queryByRole('heading', { name: 'Doctor Management' })).toBeNull();
  });
});
