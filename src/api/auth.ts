import { AUTH_STORAGE_KEY, AUTH_TOKEN_KEY, AUTH_USER_KEY } from './config';
import { ApiError, apiPostJson } from './client';
import type { UserRole } from '../config/allowedEmails';

type BackendRole =
  | 'admin'
  | 'manager'
  | 'supervisor'
  | 'agent'
  | 'brand_manager';

export interface AuthUser {
  id: number;
  email: string;
  role: BackendRole;
  department: string | null;
  departments: string[];
  representative: string | null;
  brands: string[];
}

interface LoginResponse {
  success: boolean;
  data?: {
    token?: string;
    user?: AuthUser;
  };
  message?: string;
}

export interface AuthSession {
  email: string;
  token: string;
  user: AuthUser;
}

export function normalizeRole(role: BackendRole): UserRole {
  if (role === 'admin' || role === 'manager' || role === 'brand_manager') {
    return 'admin';
  }

  if (role === 'supervisor') return 'supervisor';
  return 'agent';
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;

  const email = window.localStorage.getItem(AUTH_STORAGE_KEY);
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  const userRaw = window.localStorage.getItem(AUTH_USER_KEY);

  if (!email || !token || !userRaw) return null;

  try {
    const user = JSON.parse(userRaw) as AuthUser;
    if (!user?.email) return null;

    return {
      email: email.trim().toLowerCase(),
      token,
      user,
    };
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession): void {
  if (typeof window === 'undefined') return;

  const normalizedEmail = session.email.trim().toLowerCase();

  window.localStorage.setItem(AUTH_STORAGE_KEY, normalizedEmail);
  window.localStorage.setItem(AUTH_TOKEN_KEY, session.token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
}

export async function login(
  email: string,
  password: string
): Promise<AuthSession> {
  let payload: LoginResponse;

  try {
    payload = await apiPostJson<
      LoginResponse,
      { email: string; password: string }
    >('/api/auth/login', {
      email,
      password,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 500) {
        throw new Error(
          'Сервер авторизації повернув 500. Це проблема бекенду (/api/auth/login), а не форми входу.'
        );
      }

      if (error.status === 401) {
        throw new Error('Невірний email або пароль.');
      }
    }

    throw error;
  }

  if (!payload.success || !payload.data?.token || !payload.data?.user) {
    throw new Error(payload.message || 'Невірний логін або пароль');
  }

  const session: AuthSession = {
    email: payload.data.user.email,
    token: payload.data.token,
    user: payload.data.user,
  };

  saveAuthSession(session);
  return session;
}
