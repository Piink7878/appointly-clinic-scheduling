// ==============================================================================
// Appointly Client — Role-Based Protected Route Component
// ==============================================================================
// Reference: System-Level SDS Section 4.1, 6.1 & Sprint 1 Contracts (F-001)
// - Verifies authentication state from AuthContext.
// - Enforces role authorization before rendering child routes.
// ==============================================================================

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // 1. Display loading state while session verification is in-flight
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200 max-w-sm w-full mx-4">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-base font-semibold text-slate-800">Verifying Session</h3>
          <p className="text-xs text-slate-500 mt-1">Checking authentication credentials...</p>
        </div>
      </div>
    );
  }

  // 2. Redirect unauthenticated visitors to /login preserving the requested destination
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Enforce Role-Based Access Control (RBAC)
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  // 4. Authorized: render nested routes or children
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;

