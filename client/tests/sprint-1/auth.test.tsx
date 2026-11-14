// ==============================================================================
// Appointly Client — Frontend Authentication & RBAC Tests (F-001)
// ==============================================================================
// Reference: System-Level SDS Section 4.1, 4.2 & Sprint 1 Contracts (F-001)
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, AuthContextType } from '../../src/shared/context/AuthContext';
import { LoginPage } from '../../src/modules/auth/LoginPage';
import { ProtectedRoute } from '../../src/shared/components/ProtectedRoute';
import { ApiClientError } from '../../src/shared/api';
import { UserProfile } from '../../src/shared/types';

describe('Frontend Authentication & RBAC UI (F-001)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  const renderWithAuth = (
    ui: React.ReactNode,
    authOverrides: Partial<AuthContextType> = {},
    initialEntries = ['/']
  ) => {
    const defaultAuth: AuthContextType = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn().mockResolvedValue(null),
      ...authOverrides,
    };

    return render(
      <AuthContext.Provider value={defaultAuth}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    );
  };

  it('renders login form elements and quick-fill test accounts', () => {
    renderWithAuth(<LoginPage />);

    expect(screen.getByRole('heading', { name: /Sign in to Appointly/i })).toBeDefined();
    expect(screen.getByLabelText(/Email Address/i)).toBeDefined();
    expect(screen.getByLabelText(/^Password$/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeDefined();

    // Verify quick fill helper accounts are displayed
    expect(screen.getByText('doctor@appointly.local')).toBeDefined();
    expect(screen.getByText('admin@appointly.local')).toBeDefined();
    expect(screen.getByText('patient@appointly.local')).toBeDefined();
  });

  it('quick-fill button populates email and password fields', () => {
    renderWithAuth(<LoginPage />);

    const doctorQuickFill = screen.getByText('doctor@appointly.local');
    fireEvent.click(doctorQuickFill);

    const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^Password$/i) as HTMLInputElement;

    expect(emailInput.value).toBe('doctor@appointly.local');
    expect(passwordInput.value).toBe('ChangeMe123!');
  });

  it('displays tailored error alert for INVALID_CREDENTIALS', async () => {
    const mockLogin = vi.fn().mockRejectedValue(
      new ApiClientError('Invalid email or password.', 'INVALID_CREDENTIALS', 401)
    );

    renderWithAuth(<LoginPage />, { login: mockLogin });

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    fireEvent.change(emailInput, { target: { value: 'doctor@appointly.local' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPassword!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/Invalid email or password/i)).toBeDefined();
    });
  });

  it('displays tailored alert for ACCOUNT_INACTIVE suspended accounts', async () => {
    const mockLogin = vi.fn().mockRejectedValue(
      new ApiClientError('Account is inactive.', 'ACCOUNT_INACTIVE', 403)
    );

    renderWithAuth(<LoginPage />, { login: mockLogin });

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    fireEvent.change(emailInput, { target: { value: 'inactive@appointly.local' } });
    fireEvent.change(passwordInput, { target: { value: 'ChangeMe123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/Account Suspended: Your account is currently inactive/i)).toBeDefined();
    });
  });

  it('ProtectedRoute redirects unauthenticated visitors to /login', () => {
    renderWithAuth(
      <Routes>
        <Route path="/login" element={<div>Login Page Target</div>} />
        <Route element={<ProtectedRoute allowedRoles={['DOCTOR']} />}>
          <Route path="/doctor/schedule" element={<div>Protected Doctor Area</div>} />
        </Route>
      </Routes>,
      { isAuthenticated: false, user: null },
      ['/doctor/schedule']
    );

    expect(screen.getByText('Login Page Target')).toBeDefined();
    expect(screen.queryByText('Protected Doctor Area')).toBeNull();
  });

  it('ProtectedRoute redirects unauthorized roles to /unauthorized', () => {
    const patientUser: UserProfile = {
      userId: 'test-patient-id',
      email: 'patient@appointly.local',
      role: 'PATIENT',
    };

    renderWithAuth(
      <Routes>
        <Route path="/unauthorized" element={<div>Unauthorized Target</div>} />
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="/admin/doctors" element={<div>Protected Admin Area</div>} />
        </Route>
      </Routes>,
      { isAuthenticated: true, user: patientUser },
      ['/admin/doctors']
    );

    expect(screen.getByText('Unauthorized Target')).toBeDefined();
    expect(screen.queryByText('Protected Admin Area')).toBeNull();
  });

  it('ProtectedRoute renders child routes when role is authorized', () => {
    const doctorUser: UserProfile = {
      userId: 'test-doctor-id',
      email: 'doctor@appointly.local',
      role: 'DOCTOR',
    };

    renderWithAuth(
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={['DOCTOR']} />}>
          <Route path="/doctor/schedule" element={<div>Authorized Doctor Schedule View</div>} />
        </Route>
      </Routes>,
      { isAuthenticated: true, user: doctorUser },
      ['/doctor/schedule']
    );

    expect(screen.getByText('Authorized Doctor Schedule View')).toBeDefined();
  });

  it('does NOT store user roles or auth tokens in localStorage (enforcing server-verified cookies)', () => {
    // Assert strictly that localStorage has zero auth tokens or role properties
    expect(localStorage.getItem('role')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
