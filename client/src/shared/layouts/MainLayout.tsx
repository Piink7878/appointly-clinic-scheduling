// ==============================================================================
// Appointly Client — Public / Landing Layout
// ==============================================================================
// Reference: System-Level SDS Section 4.1 & 4.2
// ==============================================================================

import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, LogIn, LayoutDashboard } from 'lucide-react';

export const MainLayout: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'ADMIN':
        return '/admin/doctors';
      case 'DOCTOR':
        return '/doctor/schedule';
      case 'PATIENT':
      default:
        return '/patient/services';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <Link to="/" className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-sm">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">Appointly</h1>
            <span className="text-xs text-slate-500">Clinic Scheduling System</span>
          </div>
        </Link>

        <div>
          {isAuthenticated ? (
            <Link
              to={getDashboardPath()}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 transition-colors"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Appointly. All rights reserved. Timezone: Asia/Bangkok (UTC+7).
      </footer>
    </div>
  );
};

export default MainLayout;

