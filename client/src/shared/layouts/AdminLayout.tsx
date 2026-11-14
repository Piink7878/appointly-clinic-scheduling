// ==============================================================================
// Appointly Client — Clinic Administrator Portal Layout
// ==============================================================================
// Reference: System-Level SDS Section 4.1 & 4.2
// Features Admin portal navigation, clinic management tools, and logout button.
// ==============================================================================

import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LogOut, Users, Briefcase, Calendar, Settings, UserCheck } from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-amber-50 text-amber-800 font-semibold border-b-2 border-amber-600'
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
              <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/admin/doctors')}>
                <div className="w-9 h-9 rounded-lg bg-amber-600 flex items-center justify-center text-white shadow-sm">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-lg font-bold text-slate-900 tracking-tight">Appointly</span>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                    Clinic Admin
                  </span>
                </div>
              </div>

              {/* Admin Portal Navigation */}
              <nav className="hidden lg:flex space-x-1">
                <NavLink to="/admin/doctors" className={navLinkClass}>
                  <UserCheck className="w-4 h-4 mr-1.5" />
                  Doctors
                </NavLink>
                <NavLink to="/admin/services" className={navLinkClass}>
                  <Briefcase className="w-4 h-4 mr-1.5" />
                  Services
                </NavLink>
                <NavLink to="/admin/schedules" className={navLinkClass}>
                  <Calendar className="w-4 h-4 mr-1.5" />
                  Schedules
                </NavLink>
                <NavLink to="/admin/settings" className={navLinkClass}>
                  <Settings className="w-4 h-4 mr-1.5" />
                  Clinic Settings
                </NavLink>
                <NavLink to="/admin/patients" className={navLinkClass}>
                  <Users className="w-4 h-4 mr-1.5" />
                  Patients
                </NavLink>
              </nav>
            </div>

            {/* Right: User Profile & Logout */}
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-medium text-slate-800">
                  {user?.fullName || 'Administrator'}
                </span>
                <span className="text-xs text-slate-500">{user?.email}</span>
              </div>

              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
                title="Log out of session"
              >
                <LogOut className="w-4 h-4 mr-1.5 text-slate-500" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Appointly &bull; System Administration Portal
      </footer>
    </div>
  );
};

export default AdminLayout;

