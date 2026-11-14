// ==============================================================================
// Appointly Client — HTTP API Client with Auto-Refresh Interceptor
// ==============================================================================
// Reference: System-Level SDS Section 2.3, 5.3, 7.1 & Sprint 1 Contracts (F-001)
// - Always includes credentials: 'include' to transmit HttpOnly JWT cookies.
// - Intercepts 401 Unauthorized responses to perform automatic token refresh.
// ==============================================================================

import { ApiResponse } from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string = 'API_ERROR', status: number = 500, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Concurrency control for token rotation
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempts to rotate the refresh token by calling POST /api/v1/auth/refresh.
 * Returns true if refresh succeeded and fresh cookies were set, false otherwise.
 */
async function performTokenRefresh(): Promise<boolean> {
  try {
    const refreshUrl = `${API_BASE_URL}/auth/refresh`;
    const res = await fetch(refreshUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return res.ok;
  } catch {
    return false;
  }
}

export interface RequestOptions extends RequestInit {
  skipAuthRefresh?: boolean;
}

/**
 * Executes an HTTP fetch request with credentials: 'include' and automatic 401 refresh retry.
 */
export async function fetchApi<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const isAuthEndpoint =
    endpoint.includes('/auth/login') ||
    endpoint.includes('/auth/refresh') ||
    endpoint.includes('/auth/logout');

  const executeRequest = async (): Promise<Response> => {
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  };

  let response = await executeRequest();

  // If 401 encountered and not an auth bypass / auth endpoint, attempt automatic token refresh
  if (response.status === 401 && !options.skipAuthRefresh && !isAuthEndpoint) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = performTokenRefresh().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const refreshSucceeded = await refreshPromise;

    if (refreshSucceeded) {
      // Retry original request once with fresh credentials
      response = await executeRequest();
    }
  }

  // Handle error envelope
  if (!response.ok) {
    let errorData: ApiResponse | null = null;
    try {
      errorData = (await response.json()) as ApiResponse;
    } catch {
      // Body was not JSON
    }

    const errorCode = errorData?.error?.code || `HTTP_${response.status}`;
    const errorMessage =
      errorData?.error?.message ||
      errorData?.message ||
      `Request failed with HTTP status ${response.status}`;

    throw new ApiClientError(errorMessage, errorCode, response.status, errorData?.error);
  }

  // Handle empty responses (e.g. 204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * Convenient REST helper client methods
 */
export const apiClient = {
  get: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    fetchApi<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    fetchApi<T>(endpoint, { ...options, method: 'DELETE' }),
};
