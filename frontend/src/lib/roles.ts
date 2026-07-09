import type { User } from '../types';

export const MANAGER_ACCESS_ROLES: User['role'][] = ['administrator', 'manager'];

export function canAccessManagerFeatures(user: User | null | undefined): boolean {
  return !!user && MANAGER_ACCESS_ROLES.includes(user.role);
}

export function canDeleteTasks(user: User | null | undefined): boolean {
  return canAccessManagerFeatures(user);
}
