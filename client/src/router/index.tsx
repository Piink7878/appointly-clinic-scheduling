// ==============================================================================
// Appointly Client — Root Application Router
// ==============================================================================
// Reference: System-Level SDS Section 2.3, 4.1, 4.2 & Sprint 1 Contracts
// Mounts public, authentication, and role-protected portal routes.
// ==============================================================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout, PatientLayout, DoctorLayout, AdminLayout } from '../shared/layouts';
import { ProtectedRoute } from '../shared/components/ProtectedRoute';
import { LoginPage } from '../modules/auth/LoginPage';
import { UnauthorizedPage } from '../shared/components/UnauthorizedPage';
import { PatientServicesPage } from '../modules/patients/PatientServicesPage';
import { PatientProfilePage } from '../modules/patients/PatientProfilePage';
import { AdminPatientsPage } from '../modules/patients/AdminPatientsPage';
import { DoctorSchedulePage } from '../modules/doctors/DoctorSchedulePage';
import { AdminDoctorsPage } from '../modules/doctors/AdminDoctorsPage';
import { PatientDoctorsPage } from '../modules/doctors/PatientDoctorsPage';
// Placeholder landing page still used by admin sections that are not built yet.
import { AdminDoctorsPage as AdminPlaceholderPage } from '../modules/admin/AdminDoctorsPage';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* ------------------------------------------------------------------ */}
        {/* Public Routes                                                      */}
        {/* ------------------------------------------------------------------ */}
        <Route path="/" element={<MainLayout />}>
          <Route
            index
            element={
              <div className="text-center py-16 px-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 mb-4">
                  Clinic Management System
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  Welcome to Appointly
                </h2>
                <p className="mt-3 text-base text-slate-600 max-w-xl mx-auto">
                  Clinic Appointment &amp; Scheduling Management System. Streamlining physician working hours, medical service assignments, and patient bookings.
                </p>
                <div className="mt-8 flex justify-center gap-4">
                  <a
                    href="/login"
                    className="inline-flex items-center px-5 py-2.5 rounded-lg shadow text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 transition"
                  >
                    Sign in to Portal
                  </a>
                </div>
              </div>
            }
          />
        </Route>

        {/* Authentication Route */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* ------------------------------------------------------------------ */}
        {/* Role-Protected: PATIENT Portal (/patient/*)                        */}
        {/* ------------------------------------------------------------------ */}
        <Route element={<ProtectedRoute allowedRoles={['PATIENT']} />}>
          <Route path="/patient" element={<PatientLayout />}>
            <Route index element={<Navigate to="/patient/services" replace />} />
            <Route path="services" element={<PatientServicesPage />} />
            <Route path="doctors" element={<PatientDoctorsPage />} />
            <Route path="appointments" element={<PatientServicesPage />} />
            <Route path="profile" element={<PatientProfilePage />} />
          </Route>
        </Route>

        {/* ------------------------------------------------------------------ */}
        {/* Role-Protected: DOCTOR Portal (/doctor/*)                          */}
        {/* ------------------------------------------------------------------ */}
        <Route element={<ProtectedRoute allowedRoles={['DOCTOR']} />}>
          <Route path="/doctor" element={<DoctorLayout />}>
            <Route index element={<Navigate to="/doctor/schedule" replace />} />
            <Route path="schedule" element={<DoctorSchedulePage />} />
            <Route path="appointments" element={<DoctorSchedulePage />} />
          </Route>
        </Route>

        {/* ------------------------------------------------------------------ */}
        {/* Role-Protected: ADMIN Portal (/admin/*)                            */}
        {/* ------------------------------------------------------------------ */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/doctors" replace />} />
            <Route path="doctors" element={<AdminDoctorsPage />} />
            <Route path="services" element={<AdminPlaceholderPage />} />
            <Route path="schedules" element={<AdminPlaceholderPage />} />
            <Route path="settings" element={<AdminPlaceholderPage />} />
            <Route path="patients" element={<AdminPatientsPage />} />
          </Route>
        </Route>

        {/* Catch-all Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
