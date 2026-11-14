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
import { ComingSoonPage } from '../shared/components/ComingSoonPage';
import { PatientProfilePage } from '../modules/patients/PatientProfilePage';
import { AdminPatientsPage } from '../modules/patients/AdminPatientsPage';
import { DoctorScheduleManagerPage } from '../modules/schedules/DoctorScheduleManagerPage';
import { AdminDoctorsPage } from '../modules/doctors/AdminDoctorsPage';
import { PatientDoctorsPage } from '../modules/doctors/PatientDoctorsPage';
import { AdminServicesPage } from '../modules/services/AdminServicesPage';
import { PatientServiceCatalogPage } from '../modules/services/PatientServiceCatalogPage';
import { AdminSchedulesPage } from '../modules/schedules/AdminSchedulesPage';
import { AdminSettingsPage } from '../modules/settings/AdminSettingsPage';

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
            <Route path="services" element={<PatientServiceCatalogPage />} />
            <Route path="doctors" element={<PatientDoctorsPage />} />
            <Route
              path="appointments"
              element={
                <ComingSoonPage
                  title="My Appointments"
                  description="Booking, rescheduling and cancelling appointments arrives in the next release."
                  backTo="/patient/doctors"
                  backLabel="Browse doctors"
                />
              }
            />
            <Route path="profile" element={<PatientProfilePage />} />
          </Route>
        </Route>

        {/* ------------------------------------------------------------------ */}
        {/* Role-Protected: DOCTOR Portal (/doctor/*)                          */}
        {/* ------------------------------------------------------------------ */}
        <Route element={<ProtectedRoute allowedRoles={['DOCTOR']} />}>
          <Route path="/doctor" element={<DoctorLayout />}>
            <Route index element={<Navigate to="/doctor/schedule" replace />} />
            <Route path="schedule" element={<DoctorScheduleManagerPage />} />
            <Route
              path="appointments"
              element={
                <ComingSoonPage
                  title="My Appointments"
                  description="Your daily and weekly appointment dashboard arrives in the next release."
                  backTo="/doctor/schedule"
                  backLabel="Open my schedule"
                />
              }
            />
          </Route>
        </Route>

        {/* ------------------------------------------------------------------ */}
        {/* Role-Protected: ADMIN Portal (/admin/*)                            */}
        {/* ------------------------------------------------------------------ */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/doctors" replace />} />
            <Route path="doctors" element={<AdminDoctorsPage />} />
            <Route path="services" element={<AdminServicesPage />} />
            <Route path="schedules" element={<AdminSchedulesPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
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
