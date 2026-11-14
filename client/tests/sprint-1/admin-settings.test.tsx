// ==============================================================================
// Appointly Client — Admin Clinic Settings Tests (F-007)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.7, AC-F007-01/02/03, STS-S1-009;
//            SDS Sections 4.2 & 4.3
// The settings API module is mocked; these tests exercise UI behaviour only.
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, AuthContextType } from '../../src/shared/context/AuthContext';
import { ApiClientError } from '../../src/shared/api';
import { UserProfile } from '../../src/shared/types';
import { AdminSettingsPage } from '../../src/modules/settings/AdminSettingsPage';
import type { ClinicSettings } from '../../src/modules/settings/types';
import {
  CUTOFF_HOURS_MAX,
  DEFAULT_TIMEZONE,
  FIXED_START_INTERVALS,
  getTimezoneOptions,
  isSettingsDirty,
  isValidTimezone,
  settingsToForm,
  toSettingsInput,
  validateSettingsForm,
} from '../../src/modules/settings/validation';
import { AppRouter } from '../../src/router';

vi.mock('../../src/modules/settings/api', () => ({
  getPublicSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

import { getPublicSettings, updateSettings } from '../../src/modules/settings/api';

const adminUser: UserProfile = { userId: 'u-9', email: 'admin@appointly.local', role: 'ADMIN' };

const authFor = (user: UserProfile): AuthContextType => ({
  user,
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(user),
});

const settings: ClinicSettings = {
  clinicName: 'Appointly Clinic',
  timezone: 'Asia/Bangkok',
  fixedStartIntervalMinutes: 15,
  cancellationCutoffHours: 24,
};

const renderPage = () =>
  render(
    <AuthContext.Provider value={authFor(adminUser)}>
      <MemoryRouter>
        <AdminSettingsPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );

const load = async (s: ClinicSettings = settings) => {
  vi.mocked(getPublicSettings).mockResolvedValue(s);
  renderPage();
  await screen.findByRole('form', { name: 'Clinic settings' });
};

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

beforeEach(() => {
  vi.resetAllMocks();
});

// ------------------------------------------------------------------------------
describe('Settings validation (AC-F007-02 / AC-F007-03)', () => {
  const valid = settingsToForm(settings);

  it('accepts the default settings', () => {
    expect(validateSettingsForm(valid)).toEqual({});
    expect(DEFAULT_TIMEZONE).toBe('Asia/Bangkok');
  });

  it.each(['5', '10', '15', '20', '30', '60'])('accepts interval %s', (value) => {
    expect(validateSettingsForm({ ...valid, fixedStartIntervalMinutes: value }).fixedStartIntervalMinutes).toBeUndefined();
  });

  it.each(['0', '7', '45', '61', '-5', 'abc', ''])('rejects interval "%s" (only 5, 10, 15, 20, 30, 60)', (value) => {
    expect(validateSettingsForm({ ...valid, fixedStartIntervalMinutes: value }).fixedStartIntervalMinutes).toBeDefined();
  });

  it('boundary: cutoff 0 is accepted, -1 is rejected', () => {
    expect(validateSettingsForm({ ...valid, cancellationCutoffHours: '0' }).cancellationCutoffHours).toBeUndefined();
    expect(validateSettingsForm({ ...valid, cancellationCutoffHours: '-1' }).cancellationCutoffHours).toBeDefined();
  });

  it.each(['1.5', 'abc', '', '  ', '1e2', '+3'])('rejects non-integer cutoff "%s"', (value) => {
    expect(validateSettingsForm({ ...valid, cancellationCutoffHours: value }).cancellationCutoffHours).toBeDefined();
  });

  it('caps the cutoff so it fits the database integer', () => {
    expect(validateSettingsForm({ ...valid, cancellationCutoffHours: String(CUTOFF_HOURS_MAX) }).cancellationCutoffHours).toBeUndefined();
    expect(validateSettingsForm({ ...valid, cancellationCutoffHours: String(CUTOFF_HOURS_MAX + 1) }).cancellationCutoffHours).toBeDefined();
  });

  it('validates the timezone as an IANA identifier', () => {
    for (const ok of ['Asia/Bangkok', 'UTC', 'America/New_York']) expect(isValidTimezone(ok)).toBe(true);
    for (const bad of ['Mars/Olympus', 'Bangkok', '']) expect(isValidTimezone(bad)).toBe(false);
    expect(validateSettingsForm({ ...valid, timezone: 'Mars/Olympus' }).timezone).toBeDefined();
    expect(validateSettingsForm({ ...valid, timezone: '  ' }).timezone).toBe('Timezone is required.');
  });

  it('boundary: clinic name 150 passes, 151 and blank fail', () => {
    expect(validateSettingsForm({ ...valid, clinicName: 'a'.repeat(150) }).clinicName).toBeUndefined();
    expect(validateSettingsForm({ ...valid, clinicName: 'a'.repeat(151) }).clinicName).toBeDefined();
    expect(validateSettingsForm({ ...valid, clinicName: '   ' }).clinicName).toBeDefined();
  });

  it('builds a numeric, trimmed PATCH body', () => {
    expect(
      toSettingsInput({ clinicName: '  Clinic  ', timezone: ' UTC ', fixedStartIntervalMinutes: '30', cancellationCutoffHours: ' 0 ' })
    ).toEqual({ clinicName: 'Clinic', timezone: 'UTC', fixedStartIntervalMinutes: 30, cancellationCutoffHours: 0 });
  });

  it('dirty check ignores surrounding whitespace', () => {
    expect(isSettingsDirty(valid, settings)).toBe(false);
    expect(isSettingsDirty({ ...valid, clinicName: ` ${settings.clinicName} ` }, settings)).toBe(false);
    expect(isSettingsDirty({ ...valid, cancellationCutoffHours: '48' }, settings)).toBe(true);
  });

  it('timezone suggestions start with Asia/Bangkok and include UTC', () => {
    const options = getTimezoneOptions();
    expect(options[0]).toBe('Asia/Bangkok');
    expect(options).toContain('UTC');
    expect(FIXED_START_INTERVALS).toEqual([5, 10, 15, 20, 30, 60]);
  });
});

// ------------------------------------------------------------------------------
describe('Admin Clinic Settings page (/admin/settings)', () => {
  it('shows a loading skeleton, then the current values from GET /settings/public', async () => {
    let resolve!: (s: ClinicSettings) => void;
    vi.mocked(getPublicSettings).mockReturnValue(new Promise<ClinicSettings>((r) => (resolve = r)));
    renderPage();
    expect(screen.getByLabelText('Loading settings')).toBeDefined();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);

    resolve({ ...settings, clinicName: 'Siam Clinic', fixedStartIntervalMinutes: 30, cancellationCutoffHours: 12 });
    await screen.findByRole('form', { name: 'Clinic settings' });
    expect(screen.queryByLabelText('Loading settings')).toBeNull();

    expect(input('Clinic name').value).toBe('Siam Clinic');
    expect(input('Timezone').value).toBe('Asia/Bangkok');
    expect((screen.getByLabelText('Fixed start interval') as HTMLSelectElement).value).toBe('30');
    expect(input('Cancellation cutoff (hours)').value).toBe('12');
  });

  it('defaults the timezone to Asia/Bangkok when the server returns none', async () => {
    await load({ ...settings, timezone: '' });
    expect(input('Timezone').value).toBe('Asia/Bangkok');
  });

  it('offers exactly 5, 10, 15, 20, 30 and 60 minutes for the start interval', async () => {
    await load();
    const options = within(screen.getByLabelText('Fixed start interval')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      '5 minutes',
      '10 minutes',
      '15 minutes',
      '20 minutes',
      '30 minutes',
      '60 minutes',
    ]);
  });

  it('Save is disabled until something changes', async () => {
    await load();
    expect((screen.getByRole('button', { name: 'Save Settings' }) as HTMLButtonElement).disabled).toBe(true);
    type('Clinic name', 'Renamed Clinic');
    expect((screen.getByRole('button', { name: 'Save Settings' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('PATCHes the four fields as numbers and shows a success toast, then re-bases on the response (AC-F007-01)', async () => {
    await load();
    vi.mocked(updateSettings).mockResolvedValue({
      clinicName: 'Renamed Clinic',
      timezone: 'UTC',
      fixedStartIntervalMinutes: 30,
      cancellationCutoffHours: 48,
    });
    type('Clinic name', '  Renamed Clinic ');
    type('Timezone', 'UTC');
    type('Fixed start interval', '30');
    type('Cancellation cutoff (hours)', '48');
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
    expect(updateSettings).toHaveBeenCalledWith({
      clinicName: 'Renamed Clinic',
      timezone: 'UTC',
      fixedStartIntervalMinutes: 30,
      cancellationCutoffHours: 48,
    });
    expect((await screen.findByRole('status')).textContent).toContain('saved successfully');
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Save Settings' }) as HTMLButtonElement).disabled).toBe(true)
    );
    expect(input('Clinic name').value).toBe('Renamed Clinic');
  });

  it('accepts a cancellation cutoff of 0 (AC-F007-03)', async () => {
    await load();
    vi.mocked(updateSettings).mockResolvedValue({ ...settings, cancellationCutoffHours: 0 });
    type('Cancellation cutoff (hours)', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    await waitFor(() => expect(updateSettings).toHaveBeenCalled());
    expect(vi.mocked(updateSettings).mock.calls[0][0].cancellationCutoffHours).toBe(0);
  });

  it('shows inline errors for an invalid timezone and a negative cutoff, without calling the API (AC-F007-02/03)', async () => {
    await load();
    type('Timezone', 'Mars/Olympus');
    type('Cancellation cutoff (hours)', '-1');
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    expect(await screen.findByText(/Enter a valid IANA timezone/)).toBeDefined();
    expect(screen.getByText('Enter a whole number of hours, 0 or more.')).toBeDefined();
    expect(input('Timezone').getAttribute('aria-invalid')).toBe('true');
    expect(updateSettings).not.toHaveBeenCalled();

    // Editing a field clears its own error only.
    type('Timezone', 'Asia/Bangkok');
    expect(screen.queryByText(/Enter a valid IANA timezone/)).toBeNull();
    expect(screen.getByText('Enter a whole number of hours, 0 or more.')).toBeDefined();
  });

  it('a blank clinic name is rejected inline', async () => {
    await load();
    type('Clinic name', '   ');
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    expect(await screen.findByText('Clinic name is required.')).toBeDefined();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('a backend 400 is shown in an error banner and the form keeps its values', async () => {
    await load();
    vi.mocked(updateSettings).mockRejectedValue(
      new ApiClientError('timezone must be a valid IANA timezone identifier', 'VALIDATION_ERROR', 400)
    );
    type('Clinic name', 'Renamed Clinic');
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    expect((await screen.findByRole('alert')).textContent).toContain('valid IANA timezone identifier');
    expect(input('Clinic name').value).toBe('Renamed Clinic');
    expect((screen.getByRole('button', { name: 'Save Settings' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('Discard changes restores the saved values', async () => {
    await load();
    type('Clinic name', 'Something else');
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(input('Clinic name').value).toBe('Appointly Clinic');
  });

  it('shows a load error with Retry that refetches', async () => {
    vi.mocked(getPublicSettings).mockRejectedValueOnce(new ApiClientError('Server exploded', 'INTERNAL', 500));
    renderPage();
    expect((await screen.findByRole('alert')).textContent).toContain('Server exploded');

    vi.mocked(getPublicSettings).mockResolvedValue(settings);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('form', { name: 'Clinic settings' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// ------------------------------------------------------------------------------
describe('Router wiring & navigation (F-007 settings)', () => {
  it('/admin/settings renders the page and both navs link to it', async () => {
    window.history.pushState({}, '', '/admin/settings');
    vi.mocked(getPublicSettings).mockResolvedValue(settings);
    render(
      <AuthContext.Provider value={authFor(adminUser)}>
        <AppRouter />
      </AuthContext.Provider>
    );
    expect(await screen.findByRole('heading', { name: 'Clinic Settings' })).toBeDefined();
    const links = screen.getAllByRole('link', { name: 'Clinic Settings' });
    expect(links.length).toBe(2); // desktop + mobile nav
    links.forEach((l) => expect(l.getAttribute('href')).toBe('/admin/settings'));
  });
});
