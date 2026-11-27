export const MANAGER_ACCESS_ROLES = ['administrator', 'manager'];
export function canAccessManagerFeatures(user) {
    return !!user && MANAGER_ACCESS_ROLES.includes(user.role);
}
export function canAccessAdminFeatures(user) {
    return user?.role === 'administrator';
}
export function canDeleteTasks(user) {
    return canAccessManagerFeatures(user);
}
export function canAccessAttendanceHr(user) {
    return canAccessManagerFeatures(user);
}
export function canManageUsers(user) {
    return canAccessManagerFeatures(user);
}
export function canDeactivateUser(currentUser, targetUser) {
    if (!canManageUsers(currentUser) || !currentUser)
        return false;
    if (targetUser.id === currentUser.id || targetUser.status === 'inactive')
        return false;
    if (currentUser.role === 'manager' && targetUser.role === 'administrator')
        return false;
    return true;
}
export function canEditUser(currentUser, targetUser) {
    if (!canManageUsers(currentUser) || !currentUser)
        return false;
    if (currentUser.role === 'manager' && targetUser.role === 'administrator')
        return false;
    return true;
}
export function canDeleteUser(currentUser, targetUser) {
    if (!canManageUsers(currentUser) || !currentUser)
        return false;
    if (targetUser.id === currentUser.id)
        return false;
    if (currentUser.role === 'manager' && targetUser.role === 'administrator')
        return false;
    return true;
}
