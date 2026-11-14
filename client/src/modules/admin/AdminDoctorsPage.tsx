// ==============================================================================
// Appointly Client — Admin Doctor Management Placeholder
// ==============================================================================
// Reference: System-Level SDS Section 4.2 & Sprint 1 Contracts (F-003, F-005, F-007)
// Default post-login landing destination for ADMIN role (/admin/doctors).
// ==============================================================================

import React from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { UserCheck, Briefcase, Calendar, Settings } from 'lucide-react';

export const AdminDoctorsPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Clinic Administration &bull; Doctor Directory
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Logged in as {user?.email}. Manage clinic physicians, active statuses, and service qualifications.
            </p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            System Administrator
          </span>
        </div>
      </div>

      {/* Feature Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 mb-4">
            <UserCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Doctor Profiles</h3>
          <p className="mt-2 text-sm text-slate-500">
            Sprint 1 Feature F-003: Provision doctor accounts with Argon2id passwords and manage active statuses.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600 mb-4">
            <Briefcase className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Service Assignment</h3>
          <p className="mt-2 text-sm text-slate-500">
            Sprint 1 Feature F-005: Assign medical services to qualified doctors with duplicate rejection.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Schedule Governance</h3>
          <p className="mt-2 text-sm text-slate-500">
            Sprint 1 Feature F-007: Inspect and override doctor schedules with mandatory AuditLog records.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
            <Settings className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Clinic Configuration</h3>
          <p className="mt-2 text-sm text-slate-500">
            Configure timezone (`Asia/Bangkok`), 15-minute start intervals, and 24-hour cancellation cutoff.
          </p>
        </div>
      </div>

      {/* Live Authentication Diagnostics */}
      <div className="bg-slate-100 rounded-xl p-5 border border-slate-200">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Session Authentication Context
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono text-slate-700">
          <div><span className="text-slate-400">User ID:</span> {user?.userId}</div>
          <div><span className="text-slate-400">Email:</span> {user?.email}</div>
          <div><span className="text-slate-400">Role:</span> {user?.role}</div>
        </div>
      </div>
    </div>
  );
};

export default AdminDoctorsPage;
