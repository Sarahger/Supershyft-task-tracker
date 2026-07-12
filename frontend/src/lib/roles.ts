import type { User } from '../types';

export const MANAGER_ACCESS_ROLES: User['role'][] = ['administrator', 'manager'];

export function canAccessManagerFeatures(user: User | null | undefined): boolean {
  return !!user && MANAGER_ACCESS_ROLES.includes(user.role);
}

export function canDeleteTasks(user: User | null | undefined): boolean {
  return canAccessManagerFeatures(user);
}

export function canManageUsers(user: User | null | undefined): boolean {
  return canAccessManagerFeatures(user);
}

export function canDeactivateUser(
  currentUser: User | null | undefined,
  targetUser: User,
): boolean {
  if (!canManageUsers(currentUser) || !currentUser) return false;
  if (targetUser.id === currentUser.id || targetUser.status === 'inactive') return false;
  if (currentUser.role === 'manager' && targetUser.role === 'administrator') return false;
  return true;
}
