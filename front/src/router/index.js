import { createRouter, createWebHistory } from "vue-router";
import { LocalStorage } from "quasar";
import routes from "./routes";

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const isAuthenticated = LocalStorage.getItem("token");

  // Si alguna ruta coincidente requiere un permiso específico, verifíquelo con los permisos almacenados
  const requiredRecord = to.matched && to.matched.find(r => r.meta && r.meta.requiredPermission)
  function gatherStoredPermissions() {
    const permsA = LocalStorage.getItem('permissions')
    const permsB = LocalStorage.getItem('userPermissions')
    const items = []
    if (permsA) items.push(permsA)
    if (permsB) items.push(permsB)
    return items
  }

  function hasPermissionName(rawPerms, permissionName) {
    if (!rawPerms) return false
    if (Array.isArray(rawPerms)) {
      return rawPerms.some(p => {
        if (!p) return false
        if (typeof p === 'string') return p === permissionName
        if (typeof p === 'object') return (p.name === permissionName) || (p.permission_name === permissionName) || (p.permission === permissionName) || (p.key === permissionName)
        return false
      })
    }
    if (typeof rawPerms === 'object') {
      if (rawPerms[permissionName]) return true
      return Object.values(rawPerms).some(v => hasPermissionName(v, permissionName))
    }
    if (typeof rawPerms === 'string') {
      if (rawPerms.includes(',')) {
        return rawPerms.split(',').map(s => s.trim()).some(s => s === permissionName)
      }
      return rawPerms === permissionName
    }
    return false
  }

  if (requiredRecord) {
    const requiredPerm = requiredRecord.meta.requiredPermission
    const stored = gatherStoredPermissions()
    const hasPerm = stored.some(sp => hasPermissionName(sp, requiredPerm) || hasPermissionName(sp, 'view_admin') || hasPermissionName(sp, 'view_admin1'))
    if (!hasPerm) {
      if (!isAuthenticated) return next({ path: '/login', query: { redirect: to.fullPath } })
      return next('/')
    }
  }

  // Bloquear el acceso al módulo de credenciales públicas/de búsqueda para usuarios exclusivos de RRHH.
  // RRHH se identifica por tener el permiso 'update_historico'. Si un usuario tiene ese permiso pero no es administrador,
  // no debe acceder a la página raíz '/credencial' (módulo de búsqueda/impresión).
  try {
    const permsA = LocalStorage.getItem('permissions') || []
    const permsB = LocalStorage.getItem('userPermissions') || []
    const all = Array.isArray(permsA) ? [...permsA] : []
    if (Array.isArray(permsB)) all.push(...permsB)
    const isAdmin = all.some(p => (typeof p === 'string' && (p === 'view_admin' || p === 'view_admin1')) || (p && typeof p === 'object' && (p.name === 'view_admin' || p.name === 'view_admin1')))
    const isRRHH = all.some(p => (typeof p === 'string' && p === 'update_historico') || (p && typeof p === 'object' && (p.name === 'update_historico' || p.permission_name === 'update_historico')))
    const basePath = (to.path || '').split('?')[0].replace(/\/+$/, '')
    if (isRRHH && !isAdmin && basePath === '/credencial') {
      if (!isAuthenticated) return next({ path: '/login', query: { redirect: to.fullPath } })
      return next('/')
    }
  } catch (e) {
    // ignore
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    return next({
      path: "/login",
      query: { redirect: to.fullPath },
    });
  }

  if (to.meta.requiresGuest && isAuthenticated) {
    return next("/admin");
  }

  next();
});

export default router;
