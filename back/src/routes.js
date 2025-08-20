const express = require('express');
const {
    createServer,
    listServers,
    seekServer,
    updateServer,
    massUpdateServer,
    serverStatistics,
    deleteServer,
    eldersInsert,
    elderStatistics,
    elderState,
    serverState,
    elderHour,
    elderHourState,
    elderTotals,
    elderTotalState,    
    serveHour,    
    serverTotals,
    serverHourState,
    serverInstitutionAreaTotals,
    readRenac,
    listInstitutions,
    listHeadquarters,
    listAreas,
    createUser,
    verifyEmail,
    changePassword,
    listUsers,
    updateUser,
    deleteUser,
    deleteUserPermanently,
    createRole,
    listRoles,
    login,
    logout,
    forceLogout,
    prueba,
    updateRevista,
    insertRevista,
    getGlobalSessionTimeout,
    updateGlobalSessionTimeout,
    updateUserSessionTimeout,
    updateRoleSessionTimeout,    
} = require('./controllers');
const {
    authenticate,
    authorize,
    checkBlacklist
} = require('./middlewares');

const router = express.Router();

// Rutas Públicas
router.get('/prueba', prueba);
router.post('/login', login); // Inicio de sesión
router.post('/verify-email', verifyEmail); // Verificación de correo electrónico
router.post('/force-logout', forceLogout); // Cierre forzoso de sesión
// Rutas Protegidas
router.use(checkBlacklist); // Middleware para verificar tokens en la lista negra
router.post('/servidor', createServer); // Listar servidores
router.get('/servidores', listServers); // Listar servidores
router.get('/buscar_servidor/:cedula', seekServer);
router.delete('/eliminar_servidor/:cedula', deleteServer);
router.patch('/actualizar_servidor/:cedula', updateServer);
router.post('/actualizar_masiva_servidor', massUpdateServer);
router.get('/servidores_estadisticas', serverStatistics);
router.get('/adultos_horas', elderHour);
router.get('/adultos_horas_estados', elderHourState);
router.get('/servidores_horas_estados', serverHourState);
router.get('/adultos_totales', elderTotals);
router.get('/servidores_totales', serverTotals);
router.get('/servidores_instareas_totales', serverInstitutionAreaTotals);

router.get('/adultos_totales_estados', elderTotalState);
router.get('/servidores_horas', serveHour);
router.post('/insertar_adultos', eldersInsert);
router.get('/consulta_renac', readRenac);
router.get('/adultos_estadisticas', elderStatistics);
router.get('/adultos_estados', elderState);
router.get('/servidores_estados', serverState);
router.get('/instituciones', listInstitutions); // Listar servidores
router.get('/sedes', listHeadquarters); // Listar sedes
router.get('/areas', listAreas); // Listar areas
router.get('/session-settings/global', authenticate, authorize('get_global_session_settings'), getGlobalSessionTimeout);
router.patch('/session-settings/global', authenticate, authorize('update_global_session_settings'), updateGlobalSessionTimeout);
router.patch('/users/:userId/session-timeout', authenticate, authorize('update_user_session_timeout'), updateUserSessionTimeout);
router.patch('/roles/:roleId/session-timeout', authenticate, authorize('update_role_session_timeout'), updateRoleSessionTimeout);

// Usuarios
router.post('/users', authenticate, authorize('create_user'), createUser); // Crear usuario (solo administradores)
router.get('/users', authenticate, authorize('list_users'), listUsers); // Listar usuarios
router.put('/users/:userId', authenticate, authorize('update_user'), updateUser); // Actualizar usuario
router.delete('/users/:userId', authenticate, authorize('delete_user'), deleteUser); // Borrado lógico
router.delete('/users/:userId/permanent', authenticate, authorize('delete_user_permanently'), deleteUserPermanently); // Borrado físico

// Cambio de Contraseña
router.post('/change-password', authenticate, changePassword); // Cambiar contraseña

// Logout
router.post('/logout', authenticate, logout); // Cerrar sesión
router.post('/force-logout', forceLogout); // Cerrar sesión

// Roles
router.get('/roles', authenticate, authorize('list_roles'), listRoles); // Listar roles
router.post('/roles', authenticate, authorize('create_role'), createRole); // Crear rol
// router.put('/roles/:roleId', authenticate, authorize('update_role'), updateRole); // Actualizar rol
// router.delete('/roles/:roleId', authenticate, authorize('delete_role'), deleteRole); // Borrado lógico
// router.delete('/roles/:roleId/permanent', authenticate, authorize('delete_role_permanently'), deleteRolePermanently); // Borrado físico

// Permisos
// router.post('/permissions', authenticate, authorize('create_permission'), createPermission); // Crear permiso
// router.get('/permissions', authenticate, authorize('list_permissions'), listPermissions); // Listar permisos
// router.put('/permissions/:permissionId', authenticate, authorize('update_permission'), updatePermission); // Actualizar permiso
// router.delete('/permissions/:permissionId', authenticate, authorize('delete_permission'), deletePermission); // Borrado lógico
// router.delete('/permissions/:permissionId/permanent', authenticate, authorize('delete_permission_permanently'), deletePermissionPermanently); // Borrado físico

// // Asignaciones
// router.post('/assign-role', authenticate, authorize('assign_role'), assignRoleToUser); // Asignar rol a usuario
// router.post('/remove-role', authenticate, authorize('remove_role'), removeRoleFromUser); // Remover rol de usuario
// router.post('/assign-permission', authenticate, authorize('assign_permission'), assignPermissionToRole); // Asignar permiso a rol
// router.post('/remove-permission', authenticate, authorize('remove_permission'), removePermissionFromRole); // Remover permiso de rol
/////////MANTENEDORES
router.patch('/revistas/:id', updateRevista);
router.post('/revista', insertRevista);
module.exports = router;
