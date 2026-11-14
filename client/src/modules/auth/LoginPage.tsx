// ==============================================================================
// Appointly Client — Login Page Component
// ==============================================================================
// Reference: System-Level SDS Section 4.1, 4.2 & Sprint 1 Contracts (F-001)
// - Submits credentials to AuthContext.login().
// - Displays tailored error banners for invalid credentials or suspended accounts.
// - Performs automatic post-login role redirection:
//   * PATIENT -> /patient/services
//   * DOCTOR  -> /doctor/schedule
//   * ADMIN   -> /admin/doctors
// ==============================================================================

import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../shared/context/AuthContext';
import { ApiClientError } from '../../shared/api';
import { Activity, Lock, Mail, AlertCircle, Eye, EyeOff, ShieldAlert, Sparkles } from 'lucide-react';
import { UserRole } from '../../shared/types';

export const getRoleLandingPath = (role: UserRole): string => {
  switch (role) {
    case 'PATIENT':
      return '/patient/services';
    case 'DOCTOR':
      return '/doctor/schedule';
    case 'ADMIN':
      return '/admin/doctors';
    default:
      return '/';
  }
};

export const LoginPage: React.FC = () => {
  const { login, user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // If already authenticated, redirect immediately to role-specific portal
  if (!isLoading && isAuthenticated && user) {
    const destination = getRoleLandingPath(user.role);
    return <Navigate to={destination} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorCode(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const loggedInUser = await login(trimmedEmail, password);

      // Determine target destination
      const fromPath = (location.state as { from?: { pathname: string } })?.from?.pathname;
      const roleDefault = getRoleLandingPath(loggedInUser.role);

      // Only preserve deep link if it belongs to the authenticated role
      const isAuthorizedDeepLink =
        fromPath &&
        ((loggedInUser.role === 'PATIENT' && fromPath.startsWith('/patient')) ||
          (loggedInUser.role === 'DOCTOR' && fromPath.startsWith('/doctor')) ||
          (loggedInUser.role === 'ADMIN' && fromPath.startsWith('/admin')));

      const targetPath = isAuthorizedDeepLink ? fromPath : roleDefault;
      navigate(targetPath, { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorCode(err.code);
        if (err.code === 'ACCOUNT_INACTIVE') {
          setErrorMessage('Account Suspended: Your account is currently inactive. Please contact the clinic administrator.');
        } else if (err.code === 'INVALID_CREDENTIALS' || err.status === 401) {
          setErrorMessage('Invalid email or password. Please verify your credentials and try again.');
        } else {
          setErrorMessage(err.message || 'Authentication failed. Please try again.');
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred during sign-in.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (testEmail: string, testPassword = 'ChangeMe123!') => {
    setEmail(testEmail);
    setPassword(testPassword);
    setErrorMessage(null);
    setErrorCode(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Icon & Heading */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-sky-600 flex items-center justify-center text-white shadow-lg shadow-sky-600/30">
            <Activity className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Sign in to Appointly
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Clinic Appointment &amp; Scheduling Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200/80 sm:px-10">
          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className={`mb-6 p-4 rounded-xl border flex items-start space-x-3 ${
                errorCode === 'ACCOUNT_INACTIVE'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {errorCode === 'ACCOUNT_INACTIVE' ? (
                <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-sm leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                Email Address
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@appointly.local"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSubmitting ? (
                  <span className="flex items-center space-x-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>

          {/* Quick-fill Seeded Test Accounts Helper */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
              <span>Quick Test Accounts</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill('doctor@appointly.local')}
                className="p-2 text-left rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition"
              >
                <div className="font-semibold text-indigo-900">Doctor</div>
                <div className="text-slate-500 truncate">doctor@appointly.local</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('admin@appointly.local')}
                className="p-2 text-left rounded-lg border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition"
              >
                <div className="font-semibold text-amber-900">Admin</div>
                <div className="text-slate-500 truncate">admin@appointly.local</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('patient@appointly.local')}
                className="p-2 text-left rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition"
              >
                <div className="font-semibold text-emerald-900">Patient</div>
                <div className="text-slate-500 truncate">patient@appointly.local</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('inactive@appointly.local')}
                className="p-2 text-left rounded-lg border border-slate-200 hover:border-rose-400 hover:bg-rose-50/50 transition"
              >
                <div className="font-semibold text-rose-900">Inactive User</div>
                <div className="text-slate-500 truncate">inactive@appointly.local</div>
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-slate-400">
              Default password: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">ChangeMe123!</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
