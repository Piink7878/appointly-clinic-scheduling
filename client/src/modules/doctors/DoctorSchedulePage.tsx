// ==============================================================================
// Appointly Client — Doctor Schedule Management Placeholder
// ==============================================================================
// Reference: System-Level SDS Section 4.2 & Sprint 1 Contracts (F-006)
// Default post-login landing destination for DOCTOR role (/doctor/schedule).
// ==============================================================================

import React from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { Clock, Calendar, Split } from 'lucide-react';

export const DoctorSchedulePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Doctor Schedule Manager
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Welcome, Dr. {user?.fullName || user?.email}. Configure weekly working hours and exception dates.
            </p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
            Physician Workspace
          </span>
        </div>
      </div>

      {/* Feature Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Weekly Shift Builder</h3>
          <p className="mt-2 text-sm text-slate-500">
            Sprint 1 Feature F-006: Define working shifts across Monday–Sunday with instant conflict validation.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600 mb-4">
            <Split className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Split Shifts &amp; Breaks</h3>
          <p className="mt-2 text-sm text-slate-500">
            Configure morning and afternoon shifts with scheduled lunch break intervals.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 mb-4">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Exceptions &amp; Holidays</h3>
          <p className="mt-2 text-sm text-slate-500">
            Record full-day holidays, partial-day leaves, or temporary working hour overrides.
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

export default DoctorSchedulePage;
