// ==============================================================================
// Appointly Client — Patient Services & Doctors Directory Placeholder
// ==============================================================================
// Reference: System-Level SDS Section 4.2 & Sprint 1 Contracts (F-004, F-005)
// Default post-login landing destination for PATIENT role (/patient/services).
// ==============================================================================

import React from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { Activity, Stethoscope, Calendar } from 'lucide-react';

export const PatientServicesPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Welcome back, {user?.fullName || 'Patient'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Explore available clinic services and find qualified healthcare specialists.
            </p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            Active Patient Account
          </span>
        </div>
      </div>

      {/* Feature Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600 mb-4">
            <Activity className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Medical Services Catalog</h3>
          <p className="mt-2 text-sm text-slate-500">
            Sprint 1 Feature F-004: Browse active clinic services and standard consultation durations.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
            <Stethoscope className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Doctor-Service Assignment</h3>
          <p className="mt-2 text-sm text-slate-500">
            Sprint 1 Feature F-005: Filter and view active physicians assigned to specific medical specialties.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Hybrid Slot Booking</h3>
          <p className="mt-2 text-sm text-slate-500">
            Sprint 2 Feature F-008: Dynamic time slot computation and appointment self-booking.
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

export default PatientServicesPage;
