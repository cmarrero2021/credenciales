const express = require('express');
const {
    getCredencial,
    saveCredentialPrint,
    createServer,
    listServers,
    seekServer,
    updateServer,
    massUpdateServer,
    serverStatistics,
    deleteServer,
    enableServer,
    eldersInsert,
    elderStatistics,
    elderState,
    serverPosition,
    elderHour,
    elderHourState,
    elderTotals,
    elderTotalState,    
    serveHour,    
    serverTotals,
    serverHourState,
    serverInstitutionAreaTotals,
    serverState,
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
    massUploadSinglePhoto,
    massUploadPhotos,
} = require('./controllers');
const {
    authenticate,
    authorize,
    checkBlacklist
} = require('./middlewares');

const router = express.Router();

const multer = require('multer');
const upload = require('./upload');

// Rutas Públicas
router.get('/prueba', prueba);
router.post('/login', login); // Inicio de sesión
router.post('/verify-email', verifyEmail); // Verificación de correo electrónico
router.post('/force-logout', forceLogout); // Cierre forzoso de sesión

// Endpoint para credencial (público)
// Nota: registrar las rutas específicas (/historico) ANTES que la ruta dinámica
// '/credencial/:cedula' para evitar que ':cedula' capture la palabra "historico".
// Guardar histórico: requiere autenticación para saber quién imprimió
router.post('/credencial/historico', authenticate, saveCredentialPrint);
// Listar histórico de impresiones (protegido)
router.get('/credencial/historico', authenticate, require('./controllers').listCredentialHistory);
// Buscar credencial por cédula (debe ir después de las rutas específicas)
router.get('/credencial/:cedula', getCredencial);
// Página pública utilizada por los códigos QR para mostrar información de credenciales
router.get('/credenciales/cedula=:cedula', require('./controllers').getCredencialPage);

// Rutas Protegidas
router.use(checkBlacklist); // Middleware para verificar tokens en la lista negra
// Upload foto usuario al crear servidor - requires appropriate permissions
router.post('/servidor', authenticate, authorize('create_servidor'), upload.single('foto'), createServer); // Crear servidor con foto PNG
router.get('/servidores', authenticate, authorize('read_servidor'), listServers); // Listar servidores
router.get('/buscar_servidor/:cedula', authenticate, authorize('read_servidor'), seekServer);
// Requieren autenticación y permisos específicos: only users with 'update_historico' may enable/disable carnets (RRHH)
router.patch('/eliminar_servidor/:cedula', authenticate, authorize('update_historico'), deleteServer);
router.patch('/habilitar_servidor/:cedula', authenticate, authorize('update_historico'), enableServer);
// Physical delete still requires delete permission
router.delete('/eliminar_servidor/:cedula', authenticate, authorize('delete_servidor'), deleteServer);
// Middleware para manejar errores de multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'El peso de la foto no coincide, por favor debe cargar la foto que pese igual o menos a 1 mb.' });
        }
        return res.status(400).json({ error: 'Error al subir archivo: ' + err.message });
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
};

router.patch('/actualizar_servidor/:cedula', authenticate, authorize('update_servidor'), upload.single('foto'), handleMulterError, updateServer);
router.post('/cargar_foto_masiva/:cedula', authenticate, authorize('update_servidor'), upload.single('foto'), handleMulterError, massUploadSinglePhoto);
// Ruta para carga masiva de fotos: requiere autenticación y permiso de actualización de servidores
router.post('/cargar_fotos_masivas', authenticate, authorize('update_servidor'), upload.array('fotos', 200), handleMulterError, massUploadPhotos);
router.post('/actualizar_masiva_servidor', authenticate, authorize('update_servidor'), massUpdateServer);
router.get('/servidores_estadisticas', authenticate, authorize('read_servidor'), serverStatistics);
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
router.get('/servidores_estados', serverState)
router.get('/servidores_cargos', serverPosition);
router.get('/instituciones', listInstitutions); // Listar servidores por institución
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
// Debug route: retornar permisos del usuario autenticado (temporal)
router.get('/debug/permissions', authenticate, require('./controllers').debugPermissions);
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
