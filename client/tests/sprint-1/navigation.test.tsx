// ==============================================================================
// Appointly Client — Navigation, Route Guards & Redirect Consistency (F-001 … F-007)
// ==============================================================================
// Reference: System-Level SDS Sections 4.1, 4.2, 6.2; Sprint 1 Contracts AC-F001-03
// For every role: each menu link (desktop and small-screen) opens a real page and
// stays on its URL (no 404, no redirect loop); roles cannot open each other's
// portals; unauthenticated visitors are sent to /login.
// The real application router runs; only the network is stubbed.
// ==============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import { AuthContext, type AuthContextType } from '../../src/shared/context/AuthContext';
import { type UserProfile, type UserRole } from '../../src/shared/types';
import { AppRouter } from '../../src/router';
import { getRoleLandingPath } from '../../src/shared/utils';

const USERS: Record<UserRole, UserProfile> = {
  PATIENT: { userId: 'u-p', email: 'patient@appointly.local', role: 'PATIENT', fullName: 'Pat Patient' },
  DOCTOR: { userId: 'u-d', email: 'doctor@appointly.local', role: 'DOCTOR', fullName: 'Doc Doctor' },
  ADMIN: { userId: 'u-a', email: 'admin@appointly.local', role: 'ADMIN', fullName: 'Ada Admin' },
};

/** The menu every role must see — one entry per Sprint 1 page. */
const MENU: Record<UserRole, string[]> = {
  PATIENT: ['/patient/services', '/patient/doctors', '/patient/appointments', '/patient/profile'],
  DOCTOR: ['/doctor/schedule', '/doctor/appointments'],
  ADMIN: ['/admin/doctors', '/admin/services', '/admin/schedules', '/admin/settings', '/admin/patients'],
};

const ROLES = Object.keys(USERS) as UserRole[];

/** Minimal API stub: every endpoint answers with an empty, well-formed payload. */
function stubNetwork() {
  const respond = (data: unknown) => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, message: 'ok' }),
  });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const path = String(input).replace(/^.*\/api\/v1/, '');
      if (path.startsWith('/patients/me'))
        return respond({ patientId: 'p', userId: 'u-p', email: 'patient@appointly.local', fullName: 'Pat', phoneNumber: '0812345678', dateOfBirth: null });
      if (path.startsWith('/admin/patients')) return respond({ items: [], total: 0, page: 1, limit: 20 });
      if (path.startsWith('/settings/public'))
        return respond({ clinicName: 'Appointly Clinic', timezone: 'Asia/Bangkok', fixedStartIntervalMinutes: 15, cancellationCutoffHours: 24 });
      if (path.startsWith('/doctors/me/schedule') || /^\/admin\/doctors\/[^/]+\/schedule/.test(path))
        return respond({ weeklySchedules: [], exceptions: [] });
      if (path.startsWith('/doctors') || path.startsWith('/services')) return respond([]);
      return respond({});
    })
  );
}

const authFor = (role: UserRole | null): AuthContextType => ({
  user: role ? USERS[role] : null,
  isAuthenticated: role !== null,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(role ? USERS[role] : null),
});

const visit = (path: string, role: UserRole | null) => {
  window.history.pushState({}, '', path);
  return render(
    <AuthContext.Provider value={authFor(role)}>
      <AppRouter />
    </AuthContext.Provider>
  );
};

/** Waits for the router to settle on `expected` and fails if it keeps redirecting. */
const expectSettledAt = async (expected: string) => {
  await waitFor(() => expect(window.location.pathname).toBe(expected));
  // still there after React has had a chance to run any further redirect
  await new Promise((r) => setTimeout(r, 30));
  expect(window.location.pathname).toBe(expected);
};

beforeEach(() => {
  stubNetwork();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe.each(ROLES)('%s navigation', (role) => {
  it('the desktop and small-screen menus link to exactly the Sprint 1 pages for this role', async () => {
    visit(getRoleLandingPath(role), role);
    await screen.findAllByRole('heading', { level: 1 });

    const portalName = { PATIENT: 'Patient portal', DOCTOR: 'Doctor portal', ADMIN: 'Admin portal' }[role];
    const desktop = screen.getByRole('navigation', { name: portalName });
    const mobile = screen.getByRole('navigation', { name: `${portalName} (mobile)` });

    const hrefs = (nav: HTMLElement) =>
      within(nav).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs(desktop)).toEqual(MENU[role]);
    expect(hrefs(mobile)).toEqual(MENU[role]);
  });

  it.each(MENU[role])('%s opens a real page and stays on its URL', async (href) => {
    visit(href, role);

    const headings = await screen.findAllByRole('heading', { level: 1 });
    expect(headings.length).toBeGreaterThan(0);
    await expectSettledAt(href);

    // the page highlights its own menu entry
    const current = document.querySelector(`a[href="${href}"][aria-current="page"]`);
    expect(current, `menu entry for ${href} is marked current`).not.toBeNull();
    // and it never fell through to the access-denied or catch-all pages
    expect(screen.queryByText(/403 — Access Denied/)).toBeNull();
    expect(screen.queryByText(/Welcome to Appointly/)).toBeNull();
  });

  it('the portal root redirects to the role landing page', async () => {
    const root = `/${role.toLowerCase()}`;
    visit(root, role);
    await expectSettledAt(getRoleLandingPath(role));
  });

  it('/login for an already signed-in user goes straight to the landing page (no loop)', async () => {
    visit('/login', role);
    await expectSettledAt(getRoleLandingPath(role));
  });

  it.each(ROLES.filter((other) => other !== role))('cannot open the %s portal: shown access-denied once, no redirect loop', async (other) => {
    const target = MENU[other][0];
    visit(target, role);
    await expectSettledAt('/unauthorized');
    expect(await screen.findByText(/403 — Access Denied/)).toBeDefined();
    // the way out leads somewhere this role may open
    expect(screen.getByRole('button', { name: /Go to My Portal/ })).toBeDefined();
  });
});

describe('unauthenticated visitors', () => {
  it.each(ROLES.flatMap((role) => MENU[role]))('%s redirects to /login', async (href) => {
    visit(href, null);
    await expectSettledAt('/login');
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeDefined();
  });
});

describe('public and fallback routes', () => {
  it('/ is the public landing page for visitors', async () => {
    visit('/', null);
    expect(await screen.findByText(/Welcome to Appointly/)).toBeDefined();
    await expectSettledAt('/');
  });

  it.each(ROLES)('an unknown URL falls back to / for %s (no 404 page, no loop)', async (role) => {
    visit('/definitely/not/a/page', role);
    await expectSettledAt('/');
    expect(await screen.findByText(/Welcome to Appointly/)).toBeDefined();
  });

  it('/unauthorized without a session is protected by nothing but never crashes', async () => {
    visit('/unauthorized', null);
    expect(await screen.findByText(/403 — Access Denied/)).toBeDefined();
  });
});

describe('placeholder entries are honest', () => {
  it.each([
    ['PATIENT', '/patient/appointments'],
    ['DOCTOR', '/doctor/appointments'],
  ] as const)('%s %s says it is coming soon instead of showing unrelated content', async (role, href) => {
    visit(href, role);
    expect(await screen.findByRole('heading', { name: 'My Appointments' })).toBeDefined();
    expect(screen.getByText('Coming soon')).toBeDefined();
    expect(screen.queryByText(/Sprint 1 Feature/)).toBeNull();
  });
});

describe('doctor header name', () => {
  const original = USERS.DOCTOR.fullName;
  afterEach(() => {
    USERS.DOCTOR.fullName = original;
  });

  it.each([
    ['Dr. Somchai Prasert', 'Dr. Somchai Prasert'], // the seeded name already carries the title: not doubled
    ['Somchai Prasert', 'Dr. Somchai Prasert'], // a bare name gets the title
    ['dr Somchai Prasert', 'dr Somchai Prasert'], // title without a full stop, any case: not doubled
  ])('shows "%s" as "%s"', async (stored, shown) => {
    USERS.DOCTOR.fullName = stored;
    visit('/doctor/schedule', 'DOCTOR');
    await screen.findAllByRole('heading', { level: 1 });

    expect(screen.getByText(shown)).toBeDefined();
    expect(screen.queryByText(/dr\.?\s+dr\.?\s/i)).toBeNull();
  });
});
