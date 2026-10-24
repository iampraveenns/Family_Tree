/**
 * Client API Client with Automatic Authentication & Token Handling
 */

const TOKEN_KEY = 'familyroots_token';
const REFRESH_TOKEN_KEY = 'familyroots_refresh_token';

export function isTokenExpired(token: string): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    // Buffer by 30 seconds to prevent race conditions
    return payload.exp * 1000 <= Date.now() + 30000;
  } catch {
    return true;
  }
}

export function getAuthToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isTokenExpired(token)) {
    clearAuthTokens();
    return null;
  }
  return token;
}

export function setAuthTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearAuthTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

let authSessionPromise: Promise<string | null> | null = null;

export const SELECTED_ROLE_KEY = 'familyroots_selected_role';

/**
 * Switch active role session to Admin or Viewer and update tokens.
 */
export async function setRoleSession(role: 'ADMIN' | 'VIEWER'): Promise<boolean> {
  localStorage.setItem(SELECTED_ROLE_KEY, role);
  clearAuthTokens();
  try {
    const res = await fetch(`/api/auth/demo-session?role=${role.toLowerCase()}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data?.accessToken) {
        setAuthTokens(json.data.accessToken, json.data.refreshToken);
        return true;
      }
    }
  } catch (err) {
    console.error('Failed to set role session:', err);
  }
  return false;
}

/**
 * Ensures a valid session token exists. Attempts silent refresh if a refresh token is stored.
 */
export async function ensureAuthSession(forceRefresh = false): Promise<string | null> {
  const existingToken = getAuthToken();
  if (existingToken && !forceRefresh) {
    return existingToken;
  }

  if (authSessionPromise) {
    return authSessionPromise;
  }

  authSessionPromise = (async () => {
    try {
      // Attempt silent token refresh if a refresh token is present
      const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (storedRefreshToken) {
        try {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: storedRefreshToken }),
          });

          if (refreshRes.ok) {
            const refreshJson = await refreshRes.json();
            if (refreshJson.success && refreshJson.data?.accessToken) {
              setAuthTokens(refreshJson.data.accessToken, refreshJson.data.refreshToken);
              return refreshJson.data.accessToken;
            }
          }
        } catch {
          clearAuthTokens();
        }
      }

      // If no valid tokens exist, initialize session based on selected role
      try {
        const preferredRole = localStorage.getItem(SELECTED_ROLE_KEY) || 'ADMIN';
        const demoRes = await fetch(`/api/auth/demo-session?role=${preferredRole.toLowerCase()}`);
        if (demoRes.ok) {
          const demoJson = await demoRes.json();
          if (demoJson.success && demoJson.data?.accessToken) {
            setAuthTokens(demoJson.data.accessToken, demoJson.data.refreshToken);
            return demoJson.data.accessToken;
          }
        }
      } catch {
        // Fallback gracefully
      }
    } catch (err) {
      console.warn('Session refresh note:', err);
    } finally {
      authSessionPromise = null;
    }

    return null;
  })();

  return authSessionPromise;
}

export async function getAuthTokenOrEnsure(forceRefresh = false): Promise<string | null> {
  let token = forceRefresh ? null : getAuthToken();
  if (!token) {
    token = await ensureAuthSession(forceRefresh);
  }
  return token;
}

/**
 * Robust authenticated fetch wrapper that injects Bearer credentials,
 * handles automatic 401 token invalidation, and performs one-shot retry.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  let token = await getAuthTokenOrEnsure();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    clearAuthTokens();
    const refreshedToken = await ensureAuthSession(true);
    if (refreshedToken) {
      const retryHeaders = new Headers(init.headers || {});
      retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
      response = await fetch(input, { ...init, headers: retryHeaders });
    }
  }

  return response;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit & { _isRetry?: boolean } = {}
): Promise<{ success: boolean; data?: T; message?: string; error?: any }> {
  let token = await getAuthTokenOrEnsure();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !options._isRetry) {
    clearAuthTokens();
    const refreshedToken = await ensureAuthSession(true);
    if (refreshedToken) {
      return apiRequest<T>(endpoint, {
        ...options,
        _isRetry: true,
      });
    }
  }

  const json = await response.json();
  if (!response.ok && !json.success) {
    const error: any = new Error(json.error?.message || json.message || 'API request failed');
    error.response = { status: response.status, data: json };
    throw error;
  }
  return json;
}

export const api = {
  get: async <T = any>(endpoint: string, options: RequestInit = {}): Promise<{ data: T }> => {
    const result = await apiRequest<T>(endpoint, { ...options, method: 'GET' });
    return { data: result as any };
  },
  post: async <T = any>(endpoint: string, body?: any, options: RequestInit = {}): Promise<{ data: T }> => {
    const result = await apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data: result as any };
  },
  patch: async <T = any>(endpoint: string, body?: any, options: RequestInit = {}): Promise<{ data: T }> => {
    const result = await apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data: result as any };
  },
  delete: async <T = any>(endpoint: string, options: RequestInit = {}): Promise<{ data: T }> => {
    const result = await apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
    return { data: result as any };
  },
};
