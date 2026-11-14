// ==============================================================================
// Appointly Client — Service Catalog Tests (F-004)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.4, AC-F004-01/02/03, STS-S1-006;
//            SDS Sections 4.2 & 4.3
// The services API module is mocked; these tests exercise UI behaviour only.
// ==============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, AuthContextType } from '../../src/shared/context/AuthContext';
import { ApiClientError } from '../../src/shared/api';
import { UserProfile } from '../../src/shared/types';
import {
  SERVICE_LIMITS,
  emptyServiceForm,
  formatDuration,
  isServiceFormDirty,
  parseDuration,
  serviceToFormValues,
  toServiceInput,
  validateServiceForm,
} from '../../src/modules/services/validation';
import { AdminServicesPage } from '../../src/modules/services/AdminServicesPage';
import { PatientServiceCatalogPage } from '../../src/modules/services/PatientServiceCatalogPage';
import type { MedicalService } from '../../src/modules/services/types';
import { AppRouter } from '../../src/router';

vi.mock('../../src/modules/services/api', () => ({
  listServices: vi.fn(),
  createService: vi.fn(),
  updateService: vi.fn(),
  updateServiceStatus: vi.fn(),
}));

import {
  listServices,
  createService,
  updateService,
  updateServiceStatus,
} from '../../src/modules/services/api';

const service = (overrides: Partial<MedicalService> = {}): MedicalService => ({
  serviceId: 's-1',
  serviceName: 'General Consultation',
  description: 'Routine outpatient check-up.',
  durationMinutes: 30,
  serviceStatus: 'ACTIVE',
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

const renderPage = (ui: React.ReactNode, user: UserProfile) =>
  render(
    <AuthContext.Provider value={authFor(user)}>
      <MemoryRouter>{ui}</MemoryRouter>
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
});

afterEach(() => {
  vi.useRealTimers();
});

// ------------------------------------------------------------------------------
// Validation & formatting helpers
// ------------------------------------------------------------------------------
describe('Service form validation (AC-F004-03)', () => {
  const valid = { serviceName: 'Cardiology Consultation', description: '', durationMinutes: '45' };

  it('accepts a valid form (description optional)', () => {
    expect(validateServiceForm(valid)).toEqual({});
  });

  it('requires a name and a duration', () => {
    const errors = validateServiceForm(emptyServiceForm());
    expect(Object.keys(errors).sort()).toEqual(['durationMinutes', 'serviceName']);
  });

  it.each(['0', '-15', '481', '1000'])('rejects duration %s (outside 1..480)', (value) => {
    expect(validateServiceForm({ ...valid, durationMinutes: value }).durationMinutes).toBeDefined();
  });

  it.each(['1', '15', '480', ' 30 '])('accepts duration %s', (value) => {
    expect(validateServiceForm({ ...valid, durationMinutes: value }).durationMinutes).toBeUndefined();
  });

  it.each(['abc', '4.5', '1e2', '', '  ', '+5'])('rejects non-whole-number duration "%s"', (value) => {
    expect(validateServiceForm({ ...valid, durationMinutes: value }).durationMinutes).toBeDefined();
  });

  it('boundary: name 150 characters passes, 151 fails; whitespace-only fails', () => {
    expect(validateServiceForm({ ...valid, serviceName: 'a'.repeat(150) }).serviceName).toBeUndefined();
    expect(validateServiceForm({ ...valid, serviceName: 'a'.repeat(151) }).serviceName).toBeDefined();
    expect(validateServiceForm({ ...valid, serviceName: '   ' }).serviceName).toBeDefined();
  });

  it('boundary: description 5000 characters passes, 5001 fails', () => {
    const ok = 'd'.repeat(SERVICE_LIMITS.description);
    expect(validateServiceForm({ ...valid, description: ok }).description).toBeUndefined();
    expect(validateServiceForm({ ...valid, description: `${ok}d` }).description).toBeDefined();
  });

  it('payload trims, converts the duration to a number and sends null for an empty description', () => {
    expect(toServiceInput({ serviceName: '  Cardiology  ', description: '   ', durationMinutes: ' 45 ' })).toEqual({
      serviceName: 'Cardiology',
      description: null,
      durationMinutes: 45,
    });
    expect(toServiceInput({ ...valid, description: ' Notes ' }).description).toBe('Notes');
  });

  it('parseDuration only accepts whole numbers', () => {
    expect(parseDuration('45')).toBe(45);
    expect(Number.isNaN(parseDuration('45.5'))).toBe(true);
    expect(Number.isNaN(parseDuration(''))).toBe(true);
  });

  it('dirty check ignores surrounding whitespace and compares the duration numerically', () => {
    const s = service();
    const values = serviceToFormValues(s);
    expect(isServiceFormDirty(values, s)).toBe(false);
    expect(isServiceFormDirty({ ...values, serviceName: `  ${s.serviceName} ` }, s)).toBe(false);
    expect(isServiceFormDirty({ ...values, durationMinutes: '45' }, s)).toBe(true);
    expect(isServiceFormDirty({ ...values, description: '' }, s)).toBe(true);
  });

  it('formats the duration badge as in the contract ("30 mins")', () => {
    expect(formatDuration(45)).toBe('45 mins');
    expect(formatDuration(1)).toBe('1 min');
  });
});

// ------------------------------------------------------------------------------
// Admin Service Catalog page
// ------------------------------------------------------------------------------
describe('AdminServicesPage (/admin/services)', () => {
  const active = service();
  const inactive = service({
    serviceId: 's-2',
    serviceName: 'Flu Vaccination',
    description: null,
    durationMinutes: 15,
    serviceStatus: 'INACTIVE',
  });

  const renderAdmin = () => renderPage(<AdminServicesPage />, adminUser);

  it('shows a loading skeleton, then the table and cards with all required columns', async () => {
    let resolve!: (s: MedicalService[]) => void;
    vi.mocked(listServices).mockReturnValue(new Promise<MedicalService[]>((r) => (resolve = r)));
    renderAdmin();

    expect(screen.getByLabelText('Loading services')).toBeDefined();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);

    await act(async () => resolve([active, inactive]));

    expect(screen.queryByLabelText('Loading services')).toBeNull();
    const table = screen.getByRole('table');
    for (const header of ['Service', 'Description', 'Duration', 'Status', 'Actions']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeDefined();
    }
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(3); // header + 2 services
    expect(within(rows[1]).getByText('General Consultation')).toBeDefined();
    expect(within(rows[1]).getByText('Routine outpatient check-up.')).toBeDefined();
    expect(within(rows[1]).getByText('30 mins')).toBeDefined();
    expect(within(rows[1]).getByText('Active')).toBeDefined();
    expect(within(rows[2]).getByText('Inactive')).toBeDefined();
    expect(within(rows[2]).getByText('15 mins')).toBeDefined();
    expect(within(rows[2]).getByText('—')).toBeDefined(); // missing description

    const cards = within(screen.getByRole('list', { name: 'Service list' })).getAllByRole('listitem');
    expect(cards.length).toBe(2);
  });

  it('status badge uses green for ACTIVE and gray for INACTIVE (SDS 4.3)', async () => {
    vi.mocked(listServices).mockResolvedValue([active, inactive]);
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Active').className).toContain('emerald');
    expect(within(table).getByText('Inactive').className).toContain('slate');
  });

  it('requests all statuses with no search term initially, and shows inactive services to the admin', async () => {
    vi.mocked(listServices).mockResolvedValue([active, inactive]);
    renderAdmin();
    await screen.findByRole('table');
    const args = lastCallArgs<{ status: string; search: string }>(listServices);
    expect(args.status).toBe('ALL');
    expect(args.search).toBe('');
    expect(screen.getAllByText('Flu Vaccination').length).toBeGreaterThan(0);
  });

  it('changing the status filter refetches with that status', async () => {
    vi.mocked(listServices).mockResolvedValue([active]);
    renderAdmin();
    await screen.findByRole('table');

    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'INACTIVE' } });
    await waitFor(() => expect(lastCallArgs<{ status: string }>(listServices).status).toBe('INACTIVE'));
  });

  it('debounces search: one request with the term after 300 ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(listServices).mockResolvedValue([active]);
    renderAdmin();
    await screen.findByRole('table');
    vi.mocked(listServices).mockClear();

    const input = screen.getByLabelText('Search services');
    fireEvent.change(input, { target: { value: 'f' } });
    fireEvent.change(input, { target: { value: 'fl' } });
    fireEvent.change(input, { target: { value: 'flu' } });

    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(listServices).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(listServices).toHaveBeenCalledTimes(1);
    expect(lastCallArgs<{ search: string }>(listServices).search).toBe('flu');
  });

  it('shows a "no services yet" empty state with an Add action when nothing exists', async () => {
    vi.mocked(listServices).mockResolvedValue([]);
    renderAdmin();
    expect(await screen.findByText('No services yet')).toBeDefined();
    expect(screen.getByRole('button', { name: /Add your first service/i })).toBeDefined();
  });

  it('shows a filtered empty state and clears the filters', async () => {
    vi.mocked(listServices).mockResolvedValue([active]);
    renderAdmin();
    await screen.findByRole('table');

    vi.mocked(listServices).mockResolvedValue([]);
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'INACTIVE' } });
    expect(await screen.findByText('No services found')).toBeDefined();

    vi.mocked(listServices).mockResolvedValue([active]);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('table')).toBeDefined();
    expect((screen.getByLabelText('Filter by status') as HTMLSelectElement).value).toBe('ALL');
  });

  it('shows a load error with Retry that refetches', async () => {
    vi.mocked(listServices).mockRejectedValueOnce(new ApiClientError('Server exploded', 'INTERNAL', 500));
    renderAdmin();
    expect((await screen.findByRole('alert')).textContent).toContain('Server exploded');

    vi.mocked(listServices).mockResolvedValue([active]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('table')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // ---- Create ---------------------------------------------------------------
  describe('Add New Service', () => {
    const openCreate = async () => {
      vi.mocked(listServices).mockResolvedValue([active]);
      renderAdmin();
      await screen.findByRole('table');
      fireEvent.click(screen.getByRole('button', { name: /Add New Service/i }));
      return screen.findByRole('dialog', { name: 'Add New Service' });
    };

    const fillValid = () => {
      type('Service name', 'Cardiology Consultation');
      type('Duration (minutes)', '45');
    };

    it('opens an accessible dialog and focuses the first field', async () => {
      const dialog = await openCreate();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(document.activeElement).toBe(screen.getByLabelText('Service name'));
    });

    it('blocks submit with inline errors when required fields are empty (no API call)', async () => {
      await openCreate();
      fireEvent.click(screen.getByRole('button', { name: 'Create Service' }));

      expect(await screen.findByText('Service name is required.')).toBeDefined();
      expect(screen.getByText('Duration is required.')).toBeDefined();
      expect(createService).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Service name').getAttribute('aria-invalid')).toBe('true');
    });

    it.each(['0', '-15', '481'])('rejects duration %s inline without calling the API', async (value) => {
      await openCreate();
      fillValid();
      type('Duration (minutes)', value);
      fireEvent.click(screen.getByRole('button', { name: 'Create Service' }));

      expect(await screen.findByText('Duration must be between 1 and 480 minutes.')).toBeDefined();
      expect(createService).not.toHaveBeenCalled();
    });

    it.each(['1', '15', '480'])('accepts the boundary duration %s', async (value) => {
      await openCreate();
      vi.mocked(createService).mockResolvedValue(service({ durationMinutes: Number(value) }));
      fillValid();
      type('Duration (minutes)', value);
      fireEvent.click(screen.getByRole('button', { name: 'Create Service' }));

      await waitFor(() => expect(createService).toHaveBeenCalledTimes(1));
      expect(vi.mocked(createService).mock.calls[0][0].durationMinutes).toBe(Number(value));
    });

    it('creates the service, closes the dialog, shows a success banner and reloads the list', async () => {
      await openCreate();
      vi.mocked(createService).mockResolvedValue(
        service({ serviceId: 's-3', serviceName: 'Cardiology Consultation', durationMinutes: 45 })
      );
      fillValid();
      type('Description', '  Cardiovascular exam.  ');
      fireEvent.click(screen.getByRole('button', { name: 'Create Service' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(createService).toHaveBeenCalledWith({
        serviceName: 'Cardiology Consultation',
        description: 'Cardiovascular exam.',
        durationMinutes: 45,
      });
      expect((await screen.findByRole('status')).textContent).toContain('Cardiology Consultation');
      expect(screen.getByRole('status').textContent).toContain('created successfully');
      expect(listServices).toHaveBeenCalledTimes(2);
    });

    it('409 SERVICE_NAME_EXISTS shows an inline name error and keeps the dialog + input', async () => {
      await openCreate();
      vi.mocked(createService).mockRejectedValue(
        new ApiClientError("A medical service with name 'General Consultation' already exists.", 'SERVICE_NAME_EXISTS', 409)
      );
      type('Service name', 'General Consultation');
      type('Duration (minutes)', '30');
      fireEvent.click(screen.getByRole('button', { name: 'Create Service' }));

      expect(await screen.findByText(/already exists/)).toBeDefined();
      expect(screen.getByRole('dialog', { name: 'Add New Service' })).toBeDefined();
      expect((screen.getByLabelText('Duration (minutes)') as HTMLInputElement).value).toBe('30');
      expect(listServices).toHaveBeenCalledTimes(1);
      // Editing the name clears its error.
      type('Service name', 'Something else');
      expect(screen.queryByText(/already exists/)).toBeNull();
    });

    it('other backend errors appear in an alert banner inside the dialog', async () => {
      await openCreate();
      vi.mocked(createService).mockRejectedValue(
        new ApiClientError('Duration must be between 1 and 480 minutes', 'VALIDATION_ERROR', 400)
      );
      fillValid();
      fireEvent.click(screen.getByRole('button', { name: 'Create Service' }));

      const alert = await screen.findByRole('alert');
      expect(within(screen.getByRole('dialog')).getByRole('alert')).toBe(alert);
      expect(alert.textContent).toContain('Duration must be between 1 and 480 minutes');
    });

    it('Escape and Cancel close the dialog and restore focus to the trigger', async () => {
      vi.mocked(listServices).mockResolvedValue([active]);
      renderAdmin();
      await screen.findByRole('table');
      const trigger = screen.getByRole('button', { name: /Add New Service/i });
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
      expect(createService).not.toHaveBeenCalled();
    });

    it('cannot be dismissed while saving', async () => {
      await openCreate();
      let resolve!: (s: MedicalService) => void;
      vi.mocked(createService).mockReturnValue(new Promise<MedicalService>((r) => (resolve = r)));
      fillValid();
      fireEvent.click(screen.getByRole('button', { name: 'Create Service' }));

      const saving = await screen.findByRole('button', { name: 'Saving…' });
      expect((saving as HTMLButtonElement).disabled).toBe(true);
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(screen.getByRole('dialog')).toBeDefined();

      await act(async () => resolve(service({ serviceName: 'Cardiology Consultation' })));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });

  // ---- Edit -----------------------------------------------------------------
  describe('Edit service', () => {
    const openEdit = async () => {
      vi.mocked(listServices).mockResolvedValue([active, inactive]);
      renderAdmin();
      await screen.findByRole('table');
      fireEvent.click(screen.getAllByRole('button', { name: 'Edit General Consultation' })[0]);
      return screen.findByRole('dialog', { name: 'Edit Service' });
    };

    it('prefills the form and disables Save until something changes', async () => {
      await openEdit();
      expect((screen.getByLabelText('Service name') as HTMLInputElement).value).toBe('General Consultation');
      expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe(
        'Routine outpatient check-up.'
      );
      expect((screen.getByLabelText('Duration (minutes)') as HTMLInputElement).value).toBe('30');

      const save = screen.getByRole('button', { name: 'Save Changes' }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);
      type('Duration (minutes)', '45');
      expect(save.disabled).toBe(false);
    });

    it('PUTs the full record (description included), shows a success banner and reloads', async () => {
      await openEdit();
      vi.mocked(updateService).mockResolvedValue({ ...active, durationMinutes: 45 });
      type('Duration (minutes)', '45');
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      // The backend clears an omitted description, so the existing text must be sent back.
      expect(updateService).toHaveBeenCalledWith('s-1', {
        serviceName: 'General Consultation',
        description: 'Routine outpatient check-up.',
        durationMinutes: 45,
      });
      expect((await screen.findByRole('status')).textContent).toContain('updated successfully');
      expect(listServices).toHaveBeenCalledTimes(2);
    });

    it('clearing the description sends null', async () => {
      await openEdit();
      vi.mocked(updateService).mockResolvedValue({ ...active, description: null });
      type('Description', '   ');
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      await waitFor(() => expect(updateService).toHaveBeenCalled());
      expect(vi.mocked(updateService).mock.calls[0][1].description).toBeNull();
    });

    it('blocks an invalid duration inline without calling the API', async () => {
      await openEdit();
      type('Duration (minutes)', '481');
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      expect(await screen.findByText('Duration must be between 1 and 480 minutes.')).toBeDefined();
      expect(updateService).not.toHaveBeenCalled();
    });

    it('409 on rename shows an inline name error', async () => {
      await openEdit();
      vi.mocked(updateService).mockRejectedValue(
        new ApiClientError('A medical service with name \'Flu Vaccination\' already exists.', 'SERVICE_NAME_EXISTS', 409)
      );
      type('Service name', 'Flu Vaccination');
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      expect(await screen.findByText(/already exists/)).toBeDefined();
      expect(screen.getByRole('dialog', { name: 'Edit Service' })).toBeDefined();
    });

    it('404 from the backend is shown in the dialog', async () => {
      await openEdit();
      vi.mocked(updateService).mockRejectedValue(
        new ApiClientError('Medical service not found.', 'SERVICE_NOT_FOUND', 404)
      );
      type('Duration (minutes)', '45');
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      expect((await screen.findByRole('alert')).textContent).toContain('Medical service not found.');
      expect(screen.getByRole('dialog', { name: 'Edit Service' })).toBeDefined();
    });
  });

  // ---- Status toggle --------------------------------------------------------
  describe('Activate / Deactivate (AC-F004-02)', () => {
    const open = async (name: string) => {
      vi.mocked(listServices).mockResolvedValue([active, inactive]);
      renderAdmin();
      await screen.findByRole('table');
      fireEvent.click(screen.getAllByRole('button', { name })[0]);
    };

    it('asks for confirmation before deactivating and does nothing on Cancel', async () => {
      await open('Deactivate General Consultation');
      const dialog = await screen.findByRole('dialog', { name: 'Deactivate service?' });
      expect(dialog.textContent).toContain('General Consultation');
      expect(updateServiceStatus).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(updateServiceStatus).not.toHaveBeenCalled();
    });

    it('confirming PATCHes INACTIVE, shows a banner and reloads', async () => {
      await open('Deactivate General Consultation');
      vi.mocked(updateServiceStatus).mockResolvedValue({ ...active, serviceStatus: 'INACTIVE' });
      await screen.findByRole('dialog');
      fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(updateServiceStatus).toHaveBeenCalledWith('s-1', 'INACTIVE');
      expect((await screen.findByRole('status')).textContent).toContain('General Consultation');
      expect(screen.getByRole('status').textContent).toContain('is now inactive');
      expect(listServices).toHaveBeenCalledTimes(2);
    });

    it('an INACTIVE service offers Activate, which PATCHes ACTIVE', async () => {
      await open('Activate Flu Vaccination');
      vi.mocked(updateServiceStatus).mockResolvedValue({ ...inactive, serviceStatus: 'ACTIVE' });
      await screen.findByRole('dialog', { name: 'Activate service?' });
      fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

      await waitFor(() => expect(updateServiceStatus).toHaveBeenCalledWith('s-2', 'ACTIVE'));
      expect((await screen.findByRole('status')).textContent).toContain('is now active');
    });

    it('a failed change keeps the dialog open with the backend message', async () => {
      await open('Deactivate General Consultation');
      vi.mocked(updateServiceStatus).mockRejectedValue(
        new ApiClientError('Medical service not found.', 'SERVICE_NOT_FOUND', 404)
      );
      await screen.findByRole('dialog');
      fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

      expect((await screen.findByRole('alert')).textContent).toContain('Medical service not found.');
      expect(screen.getByRole('dialog', { name: 'Deactivate service?' })).toBeDefined();
      expect(listServices).toHaveBeenCalledTimes(1);
    });
  });
});

// ------------------------------------------------------------------------------
// Patient Service Catalog page
// ------------------------------------------------------------------------------
describe('PatientServiceCatalogPage (/patient/services)', () => {
  const consult = service({ serviceId: 's-1', serviceName: 'General Consultation', durationMinutes: 45 });
  const checkup = service({
    serviceId: 's-4',
    serviceName: 'Health Checkup',
    description: null,
    durationMinutes: 60,
  });

  const renderPatient = () => renderPage(<PatientServiceCatalogPage />, patientUser);

  it('shows skeleton cards while fetching, then service cards', async () => {
    let resolve!: (s: MedicalService[]) => void;
    vi.mocked(listServices).mockReturnValue(new Promise<MedicalService[]>((r) => (resolve = r)));
    renderPatient();

    expect(screen.getByLabelText('Loading services')).toBeDefined();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);

    await act(async () => resolve([consult, checkup]));
    expect(screen.queryByLabelText('Loading services')).toBeNull();
    expect(screen.getByRole('list', { name: 'Service list' })).toBeDefined();
    expect(screen.getByText('General Consultation')).toBeDefined();
    expect(screen.getByText('Health Checkup')).toBeDefined();
  });

  it('shows name, description and a duration badge on each card (AC-F004-01)', async () => {
    vi.mocked(listServices).mockResolvedValue([consult, checkup]);
    renderPatient();
    await screen.findByText('General Consultation');

    expect(screen.getByText('Routine outpatient check-up.')).toBeDefined();
    expect(screen.getByText('45 mins')).toBeDefined();
    expect(screen.getByText('60 mins')).toBeDefined();
    expect(screen.getByText('No description provided.')).toBeDefined();
  });

  it('requests the catalog without admin filters', async () => {
    vi.mocked(listServices).mockResolvedValue([consult]);
    renderPatient();
    await screen.findByText('General Consultation');
    const args = lastCallArgs<{ status?: string; search?: string }>(listServices);
    expect(args.status).toBeUndefined();
    expect(args.search).toBeUndefined();
  });

  it('never renders an INACTIVE service even if the API returned one (FR-018, BR-004)', async () => {
    vi.mocked(listServices).mockResolvedValue([
      consult,
      service({ serviceId: 's-9', serviceName: 'Hidden Service', serviceStatus: 'INACTIVE' }),
    ]);
    renderPatient();
    await screen.findByText('General Consultation');
    expect(screen.queryByText('Hidden Service')).toBeNull();
  });

  it('shows a clear empty state when there are no services', async () => {
    vi.mocked(listServices).mockResolvedValue([]);
    renderPatient();
    expect(await screen.findByText('No services available')).toBeDefined();
    expect(screen.getByRole('link', { name: 'browse our doctors' }).getAttribute('href')).toBe(
      '/patient/doctors'
    );
  });

  it('shows an empty state when only inactive services were returned', async () => {
    vi.mocked(listServices).mockResolvedValue([service({ serviceStatus: 'INACTIVE' })]);
    renderPatient();
    expect(await screen.findByText('No services available')).toBeDefined();
  });

  it('shows an error banner with Retry', async () => {
    vi.mocked(listServices).mockRejectedValueOnce(new ApiClientError('Network down', 'API_ERROR', 500));
    renderPatient();
    expect((await screen.findByRole('alert')).textContent).toContain('Network down');

    vi.mocked(listServices).mockResolvedValue([consult]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('General Consultation')).toBeDefined();
  });
});

// ------------------------------------------------------------------------------
// Router wiring & navigation
// ------------------------------------------------------------------------------
describe('Router wiring & navigation (F-004)', () => {
  const renderRoute = (path: string, user: UserProfile) => {
    window.history.pushState({}, '', path);
    return render(
      <AuthContext.Provider value={authFor(user)}>
        <AppRouter />
      </AuthContext.Provider>
    );
  };

  it('/admin/services renders the catalog management page and both navs link to it', async () => {
    vi.mocked(listServices).mockResolvedValue([service()]);
    renderRoute('/admin/services', adminUser);

    expect(await screen.findByRole('heading', { name: 'Service Catalog' })).toBeDefined();
    expect(await screen.findByRole('table')).toBeDefined();
    const links = screen.getAllByRole('link', { name: 'Services' });
    expect(links.length).toBe(2); // desktop + mobile nav
    links.forEach((l) => expect(l.getAttribute('href')).toBe('/admin/services'));
  });

  it('/patient/services renders the catalog and both navs link to it', async () => {
    vi.mocked(listServices).mockResolvedValue([service()]);
    renderRoute('/patient/services', patientUser);

    expect(await screen.findByRole('heading', { name: 'Our Services' })).toBeDefined();
    expect(await screen.findByText('General Consultation')).toBeDefined();
    const links = screen.getAllByRole('link', { name: 'Services' });
    expect(links.length).toBe(2);
    links.forEach((l) => expect(l.getAttribute('href')).toBe('/patient/services'));
  });

  it('a patient cannot open the admin catalog', async () => {
    vi.mocked(listServices).mockResolvedValue([]);
    renderRoute('/admin/services', patientUser);
    await waitFor(() => expect(window.location.pathname).toBe('/unauthorized'));
    expect(screen.queryByRole('heading', { name: 'Service Catalog' })).toBeNull();
  });
});
