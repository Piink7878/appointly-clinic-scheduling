// ==============================================================================
// Appointly Server — Route Protection Matrix (F-001 … F-007)
// ==============================================================================
// Reference: System-Level SDS Sections 6.1 & 6.2; Sprint 1 Contracts AC-F001-03,
//            AC-F002-02
// The route table is DISCOVERED from the live Express app, so a new endpoint
// cannot ship without being classified here. For every route:
//   - unauthenticated  -> 401 (unless the route is deliberately public)
//   - a role that may not use it -> 403
//   - a role that may use it     -> never 401 / 403 / 500
// ==============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app';

import { cookiesOf } from '../../helpers';
type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN';
const ALL: Role[] = ['PATIENT', 'DOCTOR', 'ADMIN'];
const UUID = '00000000-0000-4000-8000-000000000000';

interface RouteInfo {
  method: string;
  path: string; // e.g. /admin/doctors/:doctorId/schedule (without the /api/v1 prefix)
}

/** Walks the Express router tree and returns every route mounted under /api/v1. */
function discoverRoutes(): RouteInfo[] {
  const found: RouteInfo[] = [];

  const mountPath = (layer: any): string => {
    if (layer.regexp?.fast_slash) return '';
    let source: string = layer.regexp.source;
    source = source.split('\\/?(?=\\/|$)').join('');
    if (source.startsWith('^')) source = source.slice(1);
    return source.split('\\/').join('/');
  };

  const walk = (stack: any[], prefix: string) => {
    for (const layer of stack) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) {
          found.push({ method: method.toUpperCase(), path: prefix + layer.route.path });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        walk(layer.handle.stack, prefix + mountPath(layer));
      }
    }
  };

  walk((app as any)._router.stack, '');
  return found
    .filter((r) => r.path.startsWith('/api/v1/'))
    .map((r) => ({ method: r.method, path: r.path.slice('/api/v1'.length).replace(/\/$/, '') || '/' }));
}

const PUBLIC = new Set([
  'GET /health',
  'GET /ready',
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/logout',
  'GET /settings/public',
]);

/** Roles allowed to use a route, or undefined when the route has not been classified. */
function allowedRoles(method: string, path: string): Role[] | undefined {
  if (path === '/auth/me') return ALL;
  if (path.startsWith('/admin/')) return ['ADMIN'];
  if (path === '/patients/me') return ['PATIENT'];
  if (path.startsWith('/doctors/me/')) return ['DOCTOR'];
  if (path.startsWith('/schedules/me')) return ['DOCTOR'];
  if (method === 'GET' && (path === '/doctors' || path === '/doctors/:doctorId')) return ALL;
  if (method === 'GET' && (path === '/services' || path === '/services/:serviceId')) return ALL;
  return undefined;
}

const fill = (path: string) => path.replace(/:\w+/g, UUID);

describe('Route protection matrix (RBAC)', () => {
  const routes = discoverRoutes();
  const cookies: Record<Role, string[]> = { PATIENT: [], DOCTOR: [], ADMIN: [] };

  beforeAll(async () => {
    const accounts: Record<Role, string> = {
      PATIENT: 'patient.arisa@appointly.local',
      DOCTOR: 'doctor@appointly.local',
      ADMIN: 'admin@appointly.local',
    };
    for (const role of ALL) {
      const res = await request(app).post('/api/v1/auth/login').send({ email: accounts[role], password: 'ChangeMe123!' });
      expect(res.status).toBe(200);
      cookies[role] = cookiesOf(res);
    }
  });

  it('discovers a meaningful number of routes', () => {
    expect(routes.length).toBeGreaterThan(30);
  });

  it('every route is classified (public, or a known role set) — no endpoint ships unreviewed', () => {
    const unclassified = routes
      .filter((r) => !PUBLIC.has(`${r.method} ${r.path}`) && allowedRoles(r.method, r.path) === undefined)
      .map((r) => `${r.method} ${r.path}`);
    expect(unclassified).toEqual([]);
  });

  const protectedRoutes = routes.filter(
    (r) => !PUBLIC.has(`${r.method} ${r.path}`) && allowedRoles(r.method, r.path) !== undefined
  );

  it.each(protectedRoutes.map((r) => [`${r.method} ${r.path}`, r] as const))(
    '%s rejects an unauthenticated caller with 401 and the standard error envelope',
    async (_label, route) => {
      const res = await (request(app) as any)[route.method.toLowerCase()](`/api/v1${fill(route.path)}`).send({});
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
      expect(typeof res.body.error.message).toBe('string');
    }
  );

  it.each(protectedRoutes.map((r) => [`${r.method} ${r.path}`, r] as const))(
    '%s returns 403 for every role that may not use it, and never 401/403/500 for allowed roles',
    async (_label, route) => {
      const allowed = allowedRoles(route.method, route.path) as Role[];
      for (const role of ALL) {
        const verb = route.method.toLowerCase();
        // Mutating endpoints are only probed by roles that are rejected before any handler runs.
        if (allowed.includes(role) && verb !== 'get') continue;

        const res = await (request(app) as any)[verb](`/api/v1${fill(route.path)}`)
          .set('Cookie', cookies[role])
          .send({});

        if (allowed.includes(role)) {
          expect([401, 403, 500], `${role} ${route.method} ${route.path}`).not.toContain(res.status);
        } else {
          expect(res.status, `${role} ${route.method} ${route.path}`).toBe(403);
          expect(res.body).toMatchObject({ success: false, error: { code: 'FORBIDDEN' } });
        }
      }
    }
  );

  it('public routes really are reachable without a session', async () => {
    for (const label of ['GET /health', 'GET /settings/public']) {
      const [, path] = label.split(' ');
      const res = await request(app).get(`/api/v1${path}`);
      expect(res.status, label).toBe(200);
    }
  });
});
