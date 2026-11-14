// ==============================================================================
// Appointly Client — Patient Portal Layout
// ==============================================================================
// Reference: System-Level SDS Section 4.1 & 4.2
// Features role badge, navigation links, emergency disclaimer, and logout button.
// ==============================================================================

import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, LogOut, User, AlertTriangle, Calendar } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/patient/services', label: 'Services & Doctors', Icon: Activity },
  { to: '/patient/appointments', label: 'My Appointments', Icon: Calendar },
  { to: '/patient/profile', label: 'My Profile', Icon: User },
];

export const PatientLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-sky-50 text-sky-700 font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left: Brand & Navigation */}
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/patient/services')}>
                <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-sm">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-lg font-bold text-slate-900 tracking-tight">Appointly</span>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                    Patient Portal
                  </span>
                </div>
              </div>

              {/* Portal Links */}
              <nav aria-label="Patient portal" className="hidden md:flex space-x-1">
                {NAV_ITEMS.map(({ to, label, Icon }) => (
                  <NavLink key={to} to={to} className={navLinkClass}>
                    <Icon className="w-4 h-4 mr-1.5" />
                    {label}
                  </NavLink>
                ))}
              </nav>
            </div>

            {/* Right: User Profile & Logout */}
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-medium text-slate-800">
                  {user?.fullName || 'Patient'}
                </span>
                <span className="text-xs text-slate-500">{user?.email}</span>
              </div>

              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
                title="Log out of session"
              >
                <LogOut className="w-4 h-4 mr-1.5 text-slate-500" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Small-screen navigation (desktop nav above is hidden below md) */}
        <nav
          aria-label="Patient portal (mobile)"
          className="md:hidden border-t border-slate-100 px-4 sm:px-6 py-2 flex gap-1 overflow-x-auto"
        >
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={(state) => `${navLinkClass(state)} whitespace-nowrap flex-shrink-0`}
            >
              <Icon className="w-4 h-4 mr-1.5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Emergency Disclaimer Banner (SDS Section 4.1) */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center text-xs sm:text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 mr-2 flex-shrink-0" />
          <span>
            <strong>Medical Notice:</strong> If you are experiencing a medical emergency, please call <strong>1669</strong> or go to your nearest hospital immediately. This portal is for scheduled outpatient appointments only.
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Appointly Clinic System. Timezone: Asia/Bangkok (UTC+7).
      </footer>
    </div>
  );
};

export default PatientLayout;
