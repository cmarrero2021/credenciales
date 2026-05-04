import { LocalStorage } from "quasar";

export const hasPermission = (permissionName) => {
  // Support both keys used across the app: 'permissions' and 'userPermissions'
  const permsA = LocalStorage.getItem("permissions") || [];
  const permsB = LocalStorage.getItem("userPermissions") || [];
  const all = Array.isArray(permsA) ? [...permsA] : []
  if (Array.isArray(permsB)) all.push(...permsB)
  return all.some((p) => {
    if (!p) return false
    if (typeof p === 'string') return p === permissionName
    if (typeof p === 'object') return p.name === permissionName || p.permission_name === permissionName || p.permission === permissionName
    return false
  });
};

export const getPermissions = () => {
  const permsA = LocalStorage.getItem("permissions") || [];
  const permsB = LocalStorage.getItem("userPermissions") || [];
  const all = Array.isArray(permsA) ? [...permsA] : []
  if (Array.isArray(permsB)) all.push(...permsB)
  return all
};
