// ==============================================================================
// Appointly Client — Doctor-Service Assignment UI Tests (F-005)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.5, AC-F005-01/02/03, STS-S1-007;
//            SDS Sections 4.2 & 4.3
// The doctors and services API modules are mocked; these tests exercise UI
// behaviour only.
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, AuthContextType } from '../../src/shared/context/AuthContext';
import { ApiClientError } from '../../src/shared/api';
import { UserProfile } from '../../src/shared/types';
import { AdminDoctorsPage } from '../../src/modules/doctors/AdminDoctorsPage';
import { PatientDoctorsPage } from '../../src/modules/doctors/PatientDoctorsPage';
import { PatientServiceCatalogPage } from '../../src/modules/services/PatientServiceCatalogPage';
import type { Doctor } from '../../src/modules/doctors/types';
import type { MedicalService } from '../../src/modules/services/types';

vi.mock('../../src/modules/doctors/api', () => ({
  listDoctors: vi.fn(),
  createDoctor: vi.fn(),
  updateDoctor: vi.fn(),
  updateDoctorStatus: vi.fn(),
  getDoctor: vi.fn(),
  assignService: vi.fn(),
  unassignService: vi.fn(),
}));

vi.mock('../../src/modules/services/api', () => ({
  listServices: vi.fn(),
  createService: vi.fn(),
  updateService: vi.fn(),
  updateServiceStatus: vi.fn(),
}));

import {
  listDoctors,
  getDoctor,
  assignService,
  unassignService,
} from '../../src/modules/doctors/api';
import { listServices } from '../../src/modules/services/api';

const svc = (overrides: Partial<MedicalService> = {}): MedicalService => ({
  serviceId: 's-1',
  serviceName: 'General Consultation',
  description: 'Routine check-up.',
  durationMinutes: 30,
  serviceStatus: 'ACTIVE',
  ...overrides,
});

const consult = svc();
const ecg = svc({ serviceId: 's-2', serviceName: 'ECG Screening', durationMinutes: 45 });
const retired = svc({ serviceId: 's-3', serviceName: 'Retired Service', serviceStatus: 'INACTIVE' });

const doc = (overrides: Partial<Doctor> = {}): Doctor => ({
  doctorId: 'd-1',
  userId: 'u-d1',
  email: 'doctor.somchai@appointly.local',
  fullName: 'Dr. Somchai Jaidee',
  specialization: 'Cardiology',
  professionalLicenseNumber: 'LIC-12345',
  profileStatus: 'ACTIVE',
  services: [],
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

const renderAt = (ui: React.ReactNode, user: UserProfile, route = '/') =>
  render(
    <AuthContext.Provider value={authFor(user)}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );

const lastCallArgs = <T,>(fn: (...args: never[]) => unknown): T => {
  const calls = vi.mocked(fn).mock.calls;
  return calls[calls.length - 1][0] as T;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listServices).mockResolvedValue([]);
});

// ------------------------------------------------------------------------------
// Admin: Manage Services modal
// ------------------------------------------------------------------------------
describe('Admin Doctor-Service Assignment (/admin/doctors → Manage Services)', () => {
  const somchai = doc();
  const napat = doc({ doctorId: 'd-2', fullName: 'Dr. Napat Srisuk', email: 'doctor.napat@appointly.local' });

  const openModal = async (assignedIds: string[] = ['s-1'], all: MedicalService[] = [consult, ecg, retired]) => {
    vi.mocked(listDoctors).mockResolvedValue([somchai, napat]);
    vi.mocked(listServices).mockResolvedValue(all);
    vi.mocked(getDoctor).mockResolvedValue(
      doc({ services: all.filter((s) => assignedIds.includes(s.serviceId)) })
    );
    renderAt(<AdminDoctorsPage />, adminUser);
    await screen.findByRole('table');
    fireEvent.click(screen.getAllByRole('button', { name: 'Manage services for Dr. Somchai Jaidee' })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Manage Services' });
    await within(dialog).findByRole('list', { name: 'Clinic services' });
    return dialog;
  };

  it('adds a "Manage Services" button to every doctor row and card', async () => {
    vi.mocked(listDoctors).mockResolvedValue([somchai, napat]);
    renderAt(<AdminDoctorsPage />, adminUser);
    const table = await screen.findByRole('table');

    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(within(row).getByRole('button', { name: /^Manage services for / })).toBeDefined();
    }
    const cards = within(screen.getByRole('list', { name: 'Doctor list' })).getAllByRole('listitem');
    for (const card of cards) {
      expect(within(card).getByRole('button', { name: /^Manage services for / })).toBeDefined();
    }
  });

  it('shows a loading skeleton, then every clinic service with its assignment status', async () => {
    let resolveServices!: (s: MedicalService[]) => void;
    vi.mocked(listDoctors).mockResolvedValue([somchai]);
    vi.mocked(listServices).mockReturnValue(new Promise<MedicalService[]>((r) => (resolveServices = r)));
    vi.mocked(getDoctor).mockResolvedValue(doc({ services: [consult] }));
    renderAt(<AdminDoctorsPage />, adminUser);
    await screen.findByRole('table');
    fireEvent.click(screen.getAllByRole('button', { name: /Manage services for/ })[0]);

    const dialog = await screen.findByRole('dialog', { name: 'Manage Services' });
    expect(within(dialog).getByLabelText('Loading services')).toBeDefined();

    await act(async () => resolveServices([consult, ecg, retired]));
    const list = await within(dialog).findByRole('list', { name: 'Clinic services' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.length).toBe(3);

    expect(within(rows[0]).getByText('General Consultation')).toBeDefined();
    expect(within(rows[0]).getByText('Assigned')).toBeDefined();
    expect(within(rows[0]).getByRole('button', { name: 'Unassign General Consultation' })).toBeDefined();
    expect(within(rows[1]).getByText('Not assigned')).toBeDefined();
    expect(within(rows[1]).getByRole('button', { name: 'Assign ECG Screening' })).toBeDefined();
    expect(within(rows[2]).getByText('Inactive')).toBeDefined(); // inactive services are flagged
    expect(within(dialog).getByText('1 of 3 services assigned')).toBeDefined();
  });

  it('reads the doctor\'s current assignments fresh from the API', async () => {
    await openModal();
    expect(vi.mocked(getDoctor).mock.calls[0][0]).toBe('d-1');
  });

  it('assigns a service immediately (POST), flips the row and shows a success alert', async () => {
    const dialog = await openModal();
    vi.mocked(assignService).mockResolvedValue({ doctorServiceId: 'ds-1', doctorId: 'd-1', serviceId: 's-2' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Assign ECG Screening' }));

    await waitFor(() => expect(assignService).toHaveBeenCalledWith('d-1', 's-2'));
    expect(await within(dialog).findByRole('button', { name: 'Unassign ECG Screening' })).toBeDefined();
    expect(within(dialog).getByRole('status').textContent).toContain('“ECG Screening” assigned to Dr. Somchai Jaidee');
    expect(within(dialog).getByText('2 of 3 services assigned')).toBeDefined();
  });

  it('unassigns a service immediately (DELETE), flips the row and shows a success alert', async () => {
    const dialog = await openModal();
    vi.mocked(unassignService).mockResolvedValue(undefined);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Unassign General Consultation' }));

    await waitFor(() => expect(unassignService).toHaveBeenCalledWith('d-1', 's-1'));
    expect(await within(dialog).findByRole('button', { name: 'Assign General Consultation' })).toBeDefined();
    expect(within(dialog).getByRole('status').textContent).toContain(
      '“General Consultation” unassigned from Dr. Somchai Jaidee'
    );
    expect(within(dialog).getByText('0 of 3 services assigned')).toBeDefined();
  });

  it('disables a row while its request is in flight so it cannot be double-submitted', async () => {
    const dialog = await openModal();
    let resolve!: () => void;
    vi.mocked(assignService).mockReturnValue(
      new Promise((r) => (resolve = () => r({ doctorServiceId: 'ds', doctorId: 'd-1', serviceId: 's-2' })))
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Assign ECG Screening' }));
    const busy = (await within(dialog).findByRole('button', { name: 'Assign ECG Screening' })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(busy.textContent).toContain('Saving');
    fireEvent.click(busy);
    expect(assignService).toHaveBeenCalledTimes(1);

    await act(async () => resolve());
    expect(await within(dialog).findByRole('button', { name: 'Unassign ECG Screening' })).toBeDefined();
  });

  it('409 DUPLICATE_ASSIGNMENT shows the error and re-syncs the row to Assigned (AC-F005-02)', async () => {
    const dialog = await openModal();
    vi.mocked(assignService).mockRejectedValue(
      new ApiClientError('Doctor is already assigned to this service.', 'DUPLICATE_ASSIGNMENT', 409)
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Assign ECG Screening' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('already assigned');
    expect(await within(dialog).findByRole('button', { name: 'Unassign ECG Screening' })).toBeDefined();
  });

  it('404 ASSIGNMENT_NOT_FOUND on unassign shows the error and re-syncs the row to Not assigned', async () => {
    const dialog = await openModal();
    vi.mocked(unassignService).mockRejectedValue(
      new ApiClientError('Doctor-service assignment not found.', 'ASSIGNMENT_NOT_FOUND', 404)
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Unassign General Consultation' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('not found');
    expect(await within(dialog).findByRole('button', { name: 'Assign General Consultation' })).toBeDefined();
  });

  it('any other failure shows the backend message and leaves the row unchanged', async () => {
    const dialog = await openModal();
    vi.mocked(assignService).mockRejectedValue(new ApiClientError('Medical service not found.', 'SERVICE_NOT_FOUND', 404));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Assign ECG Screening' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('Medical service not found.');
    expect(within(dialog).getByRole('button', { name: 'Assign ECG Screening' })).toBeDefined();
    expect(within(dialog).getByText('1 of 3 services assigned')).toBeDefined();
  });

  it('shows a load error with Retry', async () => {
    vi.mocked(listDoctors).mockResolvedValue([somchai]);
    vi.mocked(listServices).mockRejectedValueOnce(new ApiClientError('Server exploded', 'INTERNAL', 500));
    vi.mocked(getDoctor).mockResolvedValue(doc({ services: [] }));
    renderAt(<AdminDoctorsPage />, adminUser);
    await screen.findByRole('table');
    fireEvent.click(screen.getAllByRole('button', { name: /Manage services for/ })[0]);

    const dialog = await screen.findByRole('dialog', { name: 'Manage Services' });
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Server exploded');

    vi.mocked(listServices).mockResolvedValue([consult]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry' }));
    expect(await within(dialog).findByRole('list', { name: 'Clinic services' })).toBeDefined();
  });

  it('shows a guided message when the catalog has no services', async () => {
    vi.mocked(listDoctors).mockResolvedValue([somchai]);
    vi.mocked(getDoctor).mockResolvedValue(doc());
    renderAt(<AdminDoctorsPage />, adminUser);
    await screen.findByRole('table');
    fireEvent.click(screen.getAllByRole('button', { name: /Manage services for/ })[0]);

    expect(await screen.findByText('No services in the catalog')).toBeDefined();
  });

  it('Done and Escape close the dialog', async () => {
    const dialog = await openModal();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getAllByRole('button', { name: 'Manage services for Dr. Somchai Jaidee' })[0]);
    const again = await screen.findByRole('dialog', { name: 'Manage Services' });
    fireEvent.keyDown(again, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

// ------------------------------------------------------------------------------
// Patient: View available doctors → doctor directory filtered by service
// ------------------------------------------------------------------------------
describe('Patient service-to-doctor filter flow', () => {
  const somchai = doc({ services: [consult, ecg] });
  const mali = doc({ doctorId: 'd-4', fullName: 'Dr. Mali Rattana', specialization: 'Dermatology', services: [consult] });

  describe('/patient/services', () => {
    it('adds a "View available doctors" link to each service card pointing at /patient/doctors?serviceId=<id>', async () => {
      vi.mocked(listServices).mockResolvedValue([consult, ecg]);
      renderAt(<PatientServiceCatalogPage />, patientUser);
      await screen.findByText('General Consultation');

      const links = screen.getAllByRole('link', { name: /^View available doctors for / });
      expect(links.length).toBe(2);
      expect(links[0].getAttribute('href')).toBe('/patient/doctors?serviceId=s-1');
      expect(links[1].getAttribute('href')).toBe('/patient/doctors?serviceId=s-2');
      expect(links[0].textContent).toContain('View available doctors');
    });

    it('clicking the link lands on the doctor directory filtered to that service', async () => {
      vi.mocked(listServices).mockResolvedValue([consult, ecg]);
      vi.mocked(listDoctors).mockResolvedValue([somchai]);
      render(
        <AuthContext.Provider value={authFor(patientUser)}>
          <MemoryRouter initialEntries={['/patient/services']}>
            <Routes>
              <Route path="/patient/services" element={<PatientServiceCatalogPage />} />
              <Route path="/patient/doctors" element={<PatientDoctorsPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );
      await screen.findByText('ECG Screening');

      fireEvent.click(screen.getByRole('link', { name: 'View available doctors for ECG Screening' }));

      expect(await screen.findByRole('heading', { name: 'Find a Doctor' })).toBeDefined();
      expect(await screen.findByText('Dr. Somchai Jaidee')).toBeDefined();
      expect(lastCallArgs<{ serviceId?: string }>(listDoctors).serviceId).toBe('s-2');
      await waitFor(() =>
        expect((screen.getByLabelText('Filter by service') as HTMLSelectElement).value).toBe('s-2')
      );
    });
  });

  describe('/patient/doctors service filter', () => {
    const renderDoctors = (route = '/patient/doctors') => renderAt(<PatientDoctorsPage />, patientUser, route);

    it('loads the service list (GET /services) into a "Filter by service" dropdown, defaulting to all services', async () => {
      vi.mocked(listServices).mockResolvedValue([consult, ecg]);
      vi.mocked(listDoctors).mockResolvedValue([somchai, mali]);
      renderDoctors();
      await screen.findByText('Dr. Mali Rattana');

      const select = screen.getByLabelText('Filter by service') as HTMLSelectElement;
      await waitFor(() => expect(within(select).getAllByRole('option').length).toBe(3));
      const names = within(select).getAllByRole('option').map((o) => o.textContent);
      expect(names).toEqual(['All services', 'General Consultation (30 mins)', 'ECG Screening (45 mins)']);
      expect(select.value).toBe('');
      expect(lastCallArgs<{ serviceId?: string }>(listDoctors).serviceId).toBeUndefined();
    });

    it('does not offer INACTIVE services in the dropdown', async () => {
      vi.mocked(listServices).mockResolvedValue([consult, retired]);
      vi.mocked(listDoctors).mockResolvedValue([somchai]);
      renderDoctors();
      await screen.findByText('Dr. Somchai Jaidee');
      const select = screen.getByLabelText('Filter by service');
      await waitFor(() => expect(within(select).getAllByRole('option').length).toBe(2));
      expect(within(select).queryByText(/Retired Service/)).toBeNull();
    });

    it('choosing a service calls GET /doctors?serviceId=<id> and shows only those doctors', async () => {
      vi.mocked(listServices).mockResolvedValue([consult, ecg]);
      vi.mocked(listDoctors).mockResolvedValue([somchai, mali]);
      renderDoctors();
      await screen.findByText('Dr. Mali Rattana');
      await waitFor(() => expect(within(screen.getByLabelText('Filter by service')).getAllByRole('option').length).toBe(3));

      vi.mocked(listDoctors).mockResolvedValue([somchai]);
      fireEvent.change(screen.getByLabelText('Filter by service'), { target: { value: 's-2' } });

      await waitFor(() => expect(lastCallArgs<{ serviceId?: string }>(listDoctors).serviceId).toBe('s-2'));
      await waitFor(() => expect(screen.queryByText('Dr. Mali Rattana')).toBeNull());
      expect(screen.getByText('Dr. Somchai Jaidee')).toBeDefined();
      expect((screen.getByLabelText('Filter by service') as HTMLSelectElement).value).toBe('s-2');
    });

    it('choosing "All services" removes the filter again', async () => {
      vi.mocked(listServices).mockResolvedValue([consult, ecg]);
      vi.mocked(listDoctors).mockResolvedValue([somchai]);
      renderDoctors('/patient/doctors?serviceId=s-2');
      await screen.findByText('Dr. Somchai Jaidee');
      await waitFor(() => expect(within(screen.getByLabelText('Filter by service')).getAllByRole('option').length).toBe(3));

      vi.mocked(listDoctors).mockResolvedValue([somchai, mali]);
      fireEvent.change(screen.getByLabelText('Filter by service'), { target: { value: '' } });

      expect(await screen.findByText('Dr. Mali Rattana')).toBeDefined();
      expect(lastCallArgs<{ serviceId?: string }>(listDoctors).serviceId).toBeUndefined();
    });

    it('shows the clear empty state when no doctors offer the selected service (AC-F005-03)', async () => {
      vi.mocked(listServices).mockResolvedValue([consult, ecg]);
      vi.mocked(listDoctors).mockResolvedValue([]);
      renderDoctors('/patient/doctors?serviceId=s-2');

      expect(await screen.findByText('No doctors are currently available for this service')).toBeDefined();
      expect(screen.queryByRole('list', { name: 'Doctor list' })).toBeNull();

      vi.mocked(listDoctors).mockResolvedValue([somchai]);
      fireEvent.click(screen.getByRole('button', { name: 'Show all doctors' }));
      expect(await screen.findByText('Dr. Somchai Jaidee')).toBeDefined();
      expect((screen.getByLabelText('Filter by service') as HTMLSelectElement).value).toBe('');
    });

    it('keeps a deep-linked service selectable even when it is not in the active list', async () => {
      vi.mocked(listServices).mockResolvedValue([consult]);
      vi.mocked(listDoctors).mockResolvedValue([]);
      renderDoctors('/patient/doctors?serviceId=gone');
      await screen.findByText('No doctors are currently available for this service');
      const select = screen.getByLabelText('Filter by service') as HTMLSelectElement;
      expect(select.value).toBe('gone');
      expect(within(select).getByRole('option', { name: 'Selected service' })).toBeDefined();
    });

    it('a failed service list shows a retry hint but the doctors still load', async () => {
      vi.mocked(listServices).mockRejectedValueOnce(new ApiClientError('boom', 'API_ERROR', 500));
      vi.mocked(listDoctors).mockResolvedValue([somchai]);
      renderDoctors();

      expect(await screen.findByText('Dr. Somchai Jaidee')).toBeDefined();
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('load the service list');

      vi.mocked(listServices).mockResolvedValue([consult, ecg]);
      fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
      await waitFor(() =>
        expect(within(screen.getByLabelText('Filter by service')).getAllByRole('option').length).toBe(3)
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
