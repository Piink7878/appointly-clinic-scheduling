// ==============================================================================
// Appointly Client — Authentication Context & Provider
// ==============================================================================
// Reference: System-Level SDS Section 2.3, 6.1, 7.1 & Sprint 1 Contracts (F-001)
// - Manages user authentication state backed strictly by server-verified cookies.
// - Complies with security policy: ROLES AND TOKENS ARE NEVER STORED IN LOCALSTORAGE.
// ==============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, ApiResponse } from '../types';
import { apiClient } from '../api';

export interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<UserProfile | null>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Fetches the authoritative user identity from GET /api/v1/auth/me.
   * If session cookie is valid, populates user profile in memory.
   */
  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const res = await apiClient.get<ApiResponse<UserProfile>>('/auth/me');
      const profile = res.data || (res as unknown as UserProfile);

      if (profile && profile.userId && profile.role) {
        setUser(profile);
        return profile;
      }

      setUser(null);
      return null;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // Initial load: verify live session with the backend without relying on localStorage
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        await refreshUser();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [refreshUser]);

  /**
   * Submits credentials to POST /api/v1/auth/login.
   * On success, HttpOnly cookies are set by server and live profile is refreshed.
   */
  const login = useCallback(
    async (email: string, password: string): Promise<UserProfile> => {
      // 1. Submit login request
      const loginRes = await apiClient.post<ApiResponse<UserProfile>>('/auth/login', {
        email,
        password,
      });

      // 2. Fetch full profile via /auth/me to populate fullName, profileId and verified role
      const liveUser = await refreshUser();
      if (liveUser) {
        return liveUser;
      }

      // Fallback to data returned directly by login endpoint if /auth/me was already active
      const fallbackUser: UserProfile = loginRes.data || {
        userId: loginRes.userId || '',
        email: loginRes.email || email,
        role: loginRes.role || 'PATIENT',
      };

      setUser(fallbackUser);
      return fallbackUser;
    },
    [refreshUser]
  );

  /**
   * Calls POST /api/v1/auth/logout to clear server-side session hash and revoke cookies.
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Proceed with client-side state cleanup even if network fails
    } finally {
      setUser(null);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to consume the AuthContext safely
 */
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

export const useAuth = useAuthContext;

export default AuthContext;

