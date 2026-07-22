import type { UserRole } from './allowedEmails';
import { getAuthSession, normalizeRole } from '../api/auth';

export type AppSection =
  | 'display-report'
  | 'bonus-report'
  | 'gallery'
  | 'sales'
  | 'route-history'
  | 'active-customer-base'
  | 'messages'
  | 'implementation'
  | 'plan-targets';

const ROLE_ACCESS: Record<UserRole, AppSection[]> = {
  agent: [
    'display-report',
    'bonus-report',
    'gallery',
    'sales',
    'route-history',
    'active-customer-base',
    'messages',
    'implementation',
  ],
  supervisor: [
    'display-report',
    'bonus-report',
    'gallery',
    'sales',
    'route-history',
    'active-customer-base',
    'messages',
    'implementation',
  ],
  admin: [
    'display-report',
    'bonus-report',
    'gallery',
    'sales',
    'route-history',
    'active-customer-base',
    'messages',
    'implementation',
    'plan-targets',
  ],
};

export function getUserRole(email: string | null): UserRole | null {
  if (!email) return null;

  const session = getAuthSession();
  if (
    session &&
    session.email.trim().toLowerCase() === email.trim().toLowerCase()
  ) {
    return normalizeRole(session.user.role);
  }

  return null;
}

export function getUserDepartment(email: string | null): string | null {
  if (!email) return null;

  const session = getAuthSession();
  if (
    session &&
    session.email.trim().toLowerCase() === email.trim().toLowerCase()
  ) {
    if (session.user.department) return session.user.department;
    if (session.user.departments.length > 0) {
      return session.user.departments.join(', ');
    }
  }

  return null;
}

export function getUserRepresentative(email: string | null): string | null {
  if (!email) return null;

  const session = getAuthSession();
  if (
    session &&
    session.email.trim().toLowerCase() === email.trim().toLowerCase()
  ) {
    return session.user.representative;
  }

  return null;
}

function normalizeValue(value: string): string {
  return value
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('uk-UA');
}

function normalizeBrand(value: string): string {
  return normalizeValue(value);
}

export function getCurrentAuthorizedEmail(): string | null {
  return getAuthSession()?.email ?? null;
}

export function canViewRecordByEmail(
  email: string | null,
  department: string,
  representative: string
): boolean {
  if (!email) return false;

  const session = getAuthSession();
  if (
    session &&
    session.email.trim().toLowerCase() === email.trim().toLowerCase()
  ) {
    const normalizedDepartment = normalizeValue(department);
    const normalizedRepresentative = normalizeValue(representative);
    const role = normalizeRole(session.user.role);

    if (role === 'admin') return true;

    if (role === 'supervisor') {
      const allowedDepartments = (
        session.user.departments.length
          ? session.user.departments
          : session.user.department
            ? [session.user.department]
            : []
      ).map(normalizeValue);

      if (allowedDepartments.length === 0) return true;
      return allowedDepartments.includes(normalizedDepartment);
    }

    const ownRepresentative = normalizeValue(session.user.representative ?? '');
    return (
      Boolean(ownRepresentative) &&
      ownRepresentative === normalizedRepresentative
    );
  }

  return false;
}

export function canAccessSection(
  role: UserRole | null,
  section: AppSection
): boolean {
  if (!role) return false;
  return ROLE_ACCESS[role].includes(section);
}

export function canUserSeeBrand(
  email: string | null,
  brand: string | null | undefined
): boolean {
  if (!brand) return true;
  if (!email) return true;

  const session = getAuthSession();
  if (
    session &&
    session.email.trim().toLowerCase() === email.trim().toLowerCase()
  ) {
    if (!session.user.brands || session.user.brands.length === 0) return true;

    const allowed = new Set(
      session.user.brands.map(item => normalizeBrand(item)).filter(Boolean)
    );
    return allowed.has(normalizeBrand(brand));
  }

  return false;
}

export function getRoleLabel(role: UserRole): string {
  if (role === 'admin') return 'Керівник';
  if (role === 'supervisor') return 'Супервайзер';
  return 'Торговий представник';
}
