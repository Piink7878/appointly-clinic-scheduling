// ==============================================================================
// Appointly Client — Patient Profile & Admin Patient Directory Tests (F-002)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.2, AC-F002-01/03, STS-S1-004;
//            SDS Sections 4.2 & 4.3
// The patients API module is mocked; these tests exercise UI behaviour only.
// ==============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, AuthContextType } from '../../src/shared/context/AuthContext';
import { ApiClientError } from '../../src/shared/api';
import { UserProfile } from '../../src/shared/types';
import { getMaxDobDate, toDateInputValue } from '../../src/shared/utils';
import { isValidPhone, normalizePhone, validateProfileForm } from '../../src/modules/patients/validation';
import { PatientProfilePage } from '../../src/modules/patients/PatientProfilePage';
import { AdminPatientsPage } from '../../src/modules/patients/AdminPatientsPage';
import type { PatientDirectoryItem, PatientProfile } from '../../src/modules/patients/types';
import { AppRouter } from '../../src/router';

vi.mock('../../src/modules/patients/api', () => ({
  DEFAULT_PAGE_SIZE: 20,
  getMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
  listPatients: vi.fn(),
}));

import { getMyProfile, updateMyProfile, listPatients } from '../../src/modules/patients/api';

const profile: PatientProfile = {
  patientId: 'p-1',
  userId: 'u-1',
  email: 'patient.arisa@appointly.local',
  fullName: 'Arisa Wongsuwan',
  phoneNumber: '0812345678',
  dateOfBirth: '1995-05-15T00:00:00.000Z',
};

const patient = (overrides: Partial<PatientDirectoryItem> = {}): PatientDirectoryItem => ({
  patientId: 'p-1',
  email: 'patient.arisa@appointly.local',
  fullName: 'Arisa Wongsuwan',
  phoneNumber: '0812345678',
  dateOfBirth: '1995-05-15T00:00:00.000Z',
  accountStatus: 'ACTIVE',
  ...overrides,
});

const listResult = (items: PatientDirectoryItem[], total = items.length, page = 1) => ({
  items,
  total,
  page,
  limit: 20,
});

const patientUser: UserProfile = { userId: 'u-1', email: profile.email, role: 'PATIENT', fullName: 'Arisa' };
const adminUser: UserProfile = { userId: 'u-9', email: 'admin@appointly.local', role: 'ADMIN' };

const renderWithAuth = (
  ui: React.ReactNode,
  user: UserProfile = patientUser,
  overrides: Partial<AuthContextType> = {}
) => {
  const auth: AuthContextType = {
    user,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(user),
    ...overrides,
  };
  const utils = render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );
  return { ...utils, auth };
};

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ------------------------------------------------------------------------------
describe('Patient utilities & validation (F-002)', () => {
  it('getMaxDobDate returns the day before today (strictly in the past)', () => {
    expect(getMaxDobDate(new Date('2026-11-14T10:00:00Z'))).toBe('2026-11-13');
  });

  it('getMaxDobDate is conservative when Bangkok is already on the next day', () => {
    // 18:00Z on the 13th is 01:00 on the 14th in Bangkok, but the backend also
    // compares the UTC date, so the latest accepted DOB is the 12th.
    expect(getMaxDobDate(new Date('2026-11-13T18:00:00Z'))).toBe('2026-11-12');
  });

  it('getMaxDobDate handles month boundaries', () => {
    expect(getMaxDobDate(new Date('2026-12-01T03:00:00Z'))).toBe('2026-11-30');
  });

  it('toDateInputValue extracts YYYY-MM-DD without timezone shifting', () => {
    expect(toDateInputValue('1995-05-15T00:00:00.000Z')).toBe('1995-05-15');
    expect(toDateInputValue('1995-05-15')).toBe('1995-05-15');
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue('garbage')).toBe('');
  });

  it('accepts contract phone formats and rejects others', () => {
    for (const ok of ['0812345678', '0912345678', '0612345678', '081-234-5678', '081 234 5678', '+66812345678']) {
      expect(isValidPhone(ok)).toBe(true);
    }
    for (const bad of ['0712345678', '081234567', '08123456789', 'abc', '', '+0123456', '12345']) {
      expect(isValidPhone(bad)).toBe(false);
    }
    expect(normalizePhone(' 081-234 5678 ')).toBe('0812345678');
  });

  it('validateProfileForm flags empty name, bad phone, future/invalid DOB (AC-F002-03)', () => {
    const now = new Date('2026-11-14T10:00:00Z');
    const base = { fullName: 'A', phoneNumber: '0812345678', dateOfBirth: '' };
    expect(validateProfileForm(base, now)).toEqual({});
    expect(validateProfileForm({ ...base, fullName: '   ' }, now).fullName).toBeDefined();
    expect(validateProfileForm({ ...base, fullName: 'x'.repeat(151) }, now).fullName).toBeDefined();
    expect(validateProfileForm({ ...base, phoneNumber: '123' }, now).phoneNumber).toBeDefined();
    expect(validateProfileForm({ ...base, dateOfBirth: '2026-11-14' }, now).dateOfBirth).toBeDefined(); // today
    expect(validateProfileForm({ ...base, dateOfBirth: '2026-11-15' }, now).dateOfBirth).toBeDefined(); // tomorrow
    expect(validateProfileForm({ ...base, dateOfBirth: '2026-11-13' }, now).dateOfBirth).toBeUndefined();
    expect(validateProfileForm({ ...base, dateOfBirth: '2026-02-31' }, now).dateOfBirth).toBeDefined();
  });
});

// ------------------------------------------------------------------------------
describe('Patient Profile Page (/patient/profile)', () => {
  it('shows a loading skeleton while the profile is being fetched', () => {
    vi.mocked(getMyProfile).mockReturnValue(new Promise(() => {}));
    renderWithAuth(<PatientProfilePage />);

    const skeleton = screen.getByLabelText('Loading profile');
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByLabelText(/Full Name/i)).toBeNull();
  });

  it('populates the form from GET /patients/me and caps the date picker in the past', async () => {
    vi.mocked(getMyProfile).mockResolvedValue(profile);
    renderWithAuth(<PatientProfilePage />);

    const name = (await screen.findByLabelText(/Full Name/i)) as HTMLInputElement;
    expect(name.value).toBe('Arisa Wongsuwan');
    expect((screen.getByLabelText(/Phone Number/i) as HTMLInputElement).value).toBe('0812345678');

    const dob = screen.getByLabelText(/Date of Birth/i) as HTMLInputElement;
    expect(dob.value).toBe('1995-05-15');
    expect(dob.max).toBe(getMaxDobDate());
    expect(dob.max < new Date().toISOString().slice(0, 10)).toBe(true); // never today or later

    const email = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
    expect(email.value).toBe(profile.email);
    expect(email.readOnly).toBe(true);
  });

  it('keeps Save disabled until something changes', async () => {
    vi.mocked(getMyProfile).mockResolvedValue(profile);
    renderWithAuth(<PatientProfilePage />);

    const save = (await screen.findByRole('button', { name: /Save Changes/i })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Arisa W.' } });
    expect(save.disabled).toBe(false);
  });

  it('blocks submission and shows inline errors for empty name and invalid phone (no PUT)', async () => {
    vi.mocked(getMyProfile).mockResolvedValue(profile);
    renderWithAuth(<PatientProfilePage />);

    await screen.findByLabelText(/Full Name/i);
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: '0712345678' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(await screen.findByText('Full name is required.')).toBeDefined();
    expect(screen.getByText(/Enter a valid phone number/i)).toBeDefined();
    expect(updateMyProfile).not.toHaveBeenCalled();
  });

  it('saves a normalised payload, shows a success banner, and refreshes the header identity', async () => {
    vi.mocked(getMyProfile).mockResolvedValue(profile);
    vi.mocked(updateMyProfile).mockResolvedValue({
      ...profile,
      fullName: 'Arisa New',
      phoneNumber: '0891234567',
    });
    const { auth } = renderWithAuth(<PatientProfilePage />);

    await screen.findByLabelText(/Full Name/i);
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: '  Arisa New  ' } });
    fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: '089-123-4567' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateMyProfile).toHaveBeenCalledWith({
        fullName: 'Arisa New',
        phoneNumber: '0891234567',
        dateOfBirth: '1995-05-15',
      });
    });
    expect(await screen.findByText('Profile updated successfully.')).toBeDefined();
    expect(screen.getByRole('status')).toBeDefined();
    expect(auth.refreshUser).toHaveBeenCalled();
    expect((screen.getByLabelText(/Phone Number/i) as HTMLInputElement).value).toBe('0891234567');
  });

  it('sends dateOfBirth: null (never an empty string) when the date is cleared', async () => {
    vi.mocked(getMyProfile).mockResolvedValue(profile);
    vi.mocked(updateMyProfile).mockResolvedValue({ ...profile, dateOfBirth: null });
    renderWithAuth(<PatientProfilePage />);

    await screen.findByLabelText(/Full Name/i);
    fireEvent.change(screen.getByLabelText(/Date of Birth/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => expect(updateMyProfile).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateMyProfile).mock.calls[0][0].dateOfBirth).toBeNull();
  });

  it('shows the backend validation message in an error banner and keeps the user input', async () => {
    vi.mocked(getMyProfile).mockResolvedValue(profile);
    vi.mocked(updateMyProfile).mockRejectedValue(
      new ApiClientError('phoneNumber: phoneNumber must match standard phone number formats', 'VALIDATION_ERROR', 400)
    );
    renderWithAuth(<PatientProfilePage />);

    await screen.findByLabelText(/Full Name/i);
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Edited Name' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('phoneNumber must match standard phone number formats');
    expect((screen.getByLabelText(/Full Name/i) as HTMLInputElement).value).toBe('Edited Name');
    expect(screen.queryByText('Profile updated successfully.')).toBeNull();
  });

  it('shows an error with Retry when the profile cannot be loaded', async () => {
    vi.mocked(getMyProfile)
      .mockRejectedValueOnce(new ApiClientError('Patient profile not found.', 'PATIENT_NOT_FOUND', 404))
      .mockResolvedValueOnce(profile);
    renderWithAuth(<PatientProfilePage />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Patient profile not found.');

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(await screen.findByLabelText(/Full Name/i)).toBeDefined();
    expect(getMyProfile).toHaveBeenCalledTimes(2);
  });
});

// ------------------------------------------------------------------------------
describe('Admin Patient Directory (/admin/patients)', () => {
  const render_ = () => renderWithAuth(<AdminPatientsPage />, adminUser);

  it('shows a skeleton while loading, then renders both table and card layouts', async () => {
    let resolve!: (v: ReturnType<typeof listResult>) => void;
    vi.mocked(listPatients).mockReturnValue(new Promise((r) => (resolve = r)));
    render_();

    expect(screen.getByLabelText('Loading patients').getAttribute('aria-busy')).toBe('true');

    await act(async () => resolve(listResult([patient(), patient({ patientId: 'p-2', fullName: 'Krit', accountStatus: 'INACTIVE' })])));

    // One copy in the desktop table, one in the mobile card list (CSS toggles which is visible)
    expect((await screen.findAllByText('Arisa Wongsuwan')).length).toBe(2);
    expect(screen.getByRole('table')).toBeDefined();
    expect(screen.getByRole('list', { name: /Patient list/i })).toBeDefined();
    expect(screen.getAllByText('Inactive').length).toBe(2);
    expect(screen.queryByLabelText('Loading patients')).toBeNull();
  });

  it('debounces search: one request after the user stops typing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(listPatients).mockResolvedValue(listResult([patient()]));
    render_();

    await waitFor(() => expect(listPatients).toHaveBeenCalledTimes(1));
    const input = screen.getByLabelText(/Search patients/i);

    fireEvent.change(input, { target: { value: 'ari' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    fireEvent.change(input, { target: { value: 'arisa' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(listPatients).toHaveBeenCalledTimes(1); // still only the initial load

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await waitFor(() => expect(listPatients).toHaveBeenCalledTimes(2));
    expect(vi.mocked(listPatients).mock.calls[1][0]).toMatchObject({ search: 'arisa', page: 1 });
  });

  it('shows a search-specific empty state and Clear search restores the list', async () => {
    vi.mocked(listPatients).mockImplementation(async ({ search } = {}) =>
      search ? listResult([]) : listResult([patient()])
    );
    render_();

    await screen.findAllByText('Arisa Wongsuwan');
    fireEvent.change(screen.getByLabelText(/Search patients/i), { target: { value: 'zzz' } });

    expect(await screen.findByText('No patients found')).toBeDefined();
    expect(screen.getByText(/No patients match/i).textContent).toContain('zzz');
    expect(screen.queryByRole('table')).toBeNull();

    // The empty-state button (visible text) and the input's × icon share the name "Clear search"
    expect(screen.getAllByRole('button', { name: /Clear search/i }).length).toBe(2);
    fireEvent.click(screen.getByText('Clear search'));
    expect((screen.getByLabelText(/Search patients/i) as HTMLInputElement).value).toBe('');
    expect((await screen.findAllByText('Arisa Wongsuwan')).length).toBeGreaterThan(0);
  });

  it('shows a plain empty state when there are no patients at all', async () => {
    vi.mocked(listPatients).mockResolvedValue(listResult([]));
    render_();
    expect(await screen.findByText('No patients yet')).toBeDefined();
    expect(screen.queryByText('No patients found')).toBeNull();
  });

  it('shows an error banner and recovers with Retry', async () => {
    vi.mocked(listPatients)
      .mockRejectedValueOnce(new ApiClientError('Server exploded', 'HTTP_500', 500))
      .mockResolvedValueOnce(listResult([patient()]));
    render_();

    expect((await screen.findByRole('alert')).textContent).toContain('Server exploded');
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect((await screen.findAllByText('Arisa Wongsuwan')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('paginates with Next/Previous and returns to page 1 on a new search', async () => {
    vi.mocked(listPatients).mockImplementation(async ({ page = 1 } = {}) =>
      listResult([patient({ patientId: `p-${page}`, fullName: `Patient Page ${page}` })], 45, page)
    );
    render_();

    await screen.findAllByText('Patient Page 1');
    expect(screen.getByText(/Showing 1.20 of 45/)).toBeDefined();
    expect((screen.getByRole('button', { name: /Previous/i }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findAllByText('Patient Page 2');
    expect(screen.getByText(/Showing 21.40 of 45/)).toBeDefined();
    const lastCallArgs = () => {
      const calls = vi.mocked(listPatients).mock.calls;
      return calls[calls.length - 1][0];
    };
    expect(lastCallArgs()).toMatchObject({ page: 2 });

    fireEvent.change(screen.getByLabelText(/Search patients/i), { target: { value: 'pat' } });
    await waitFor(() => expect(lastCallArgs()).toMatchObject({ search: 'pat', page: 1 }));
    // exactly one request for the new search (no extra page-reset refetch)
    const callsForSearch = vi.mocked(listPatients).mock.calls.filter(([a]) => a?.search === 'pat');
    expect(callsForSearch.length).toBe(1);
  });

  it('ignores a stale response that arrives after a newer search', async () => {
    let resolveOld!: (v: ReturnType<typeof listResult>) => void;
    vi.mocked(listPatients).mockImplementation(({ search } = {}) =>
      search
        ? Promise.resolve(listResult([patient({ patientId: 'new', fullName: 'Zed Match' })]))
        : new Promise((r) => (resolveOld = r))
    );
    render_();

    fireEvent.change(screen.getByLabelText(/Search patients/i), { target: { value: 'zed' } });
    await screen.findAllByText('Zed Match');

    await act(async () => resolveOld(listResult([patient({ patientId: 'old', fullName: 'Old Everyone' })])));
    expect(screen.queryByText('Old Everyone')).toBeNull();
    expect(screen.getAllByText('Zed Match').length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------------------
describe('Router wiring & navigation (F-002)', () => {
  const renderRoute = (path: string, user: UserProfile) => {
    window.history.pushState({}, '', path);
    const auth: AuthContextType = {
      user,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn().mockResolvedValue(user),
    };
    return render(
      <AuthContext.Provider value={auth}>
        <AppRouter />
      </AuthContext.Provider>
    );
  };

  it('/patient/profile renders the profile page and the nav links to it (desktop + mobile nav)', async () => {
    vi.mocked(getMyProfile).mockResolvedValue(profile);
    renderRoute('/patient/profile', patientUser);

    expect(await screen.findByRole('heading', { name: 'My Profile' })).toBeDefined();
    const links = screen.getAllByRole('link', { name: /My Profile/i });
    expect(links.length).toBe(2);
    links.forEach((l) => expect(l.getAttribute('href')).toBe('/patient/profile'));
    expect(screen.getByRole('navigation', { name: 'Patient portal (mobile)' })).toBeDefined();
  });

  it('/admin/patients renders the directory and the nav links to it (desktop + mobile nav)', async () => {
    vi.mocked(listPatients).mockResolvedValue(listResult([patient()]));
    renderRoute('/admin/patients', adminUser);

    expect(await screen.findByRole('heading', { name: 'Patient Directory' })).toBeDefined();
    const links = screen.getAllByRole('link', { name: 'Patients' });
    expect(links.length).toBe(2);
    links.forEach((l) => expect(l.getAttribute('href')).toBe('/admin/patients'));
    expect(screen.getByRole('navigation', { name: 'Admin portal (mobile)' })).toBeDefined();
  });
});
