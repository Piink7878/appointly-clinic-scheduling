// ==============================================================================
// Appointly Client — 403 Unauthorized / Access Denied Page
// ==============================================================================
// Reference: System-Level SDS Section 4.1 & 6.1
// ==============================================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldX, ArrowLeft, LogOut } from 'lucide-react';
import { getRoleLandingPath } from '../../modules/auth/LoginPage';

export const UnauthorizedPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleReturnHome = () => {
    if (user?.role) {
      navigate(getRoleLandingPath(user.role), { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600">
          <ShieldX className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900">403 — Access Denied</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your current account role (
          <span className="font-semibold text-slate-800">{user?.role || 'UNAUTHENTICATED'}</span>
          ) does not have authorization to view this resource.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleReturnHome}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 transition"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go to My Portal
          </button>

          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition"
          >
            <LogOut className="w-4 h-4 mr-2 text-slate-500" />
            Switch Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;

