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
    createHeadquarter,
    updateHeadquarter,
    deleteHeadquarter,
    listAreas,
    createArea,
    updateArea,
    deleteArea,
    createPosition,
    updatePosition,
    deletePosition,
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
    getMassUploadErrors,
    getMassUploadHistory,
    getMassUploadLatestDB,
    getMassUploadErrorsByFile,
    logFailedAttempt,
    logServerFailedRow,
    getServerMassUploadHistory,
    getServerMassUploadLatestDB,
    getServerMassUploadErrorsByFile,
    listCredentialHistory,
    updateCredentialDelivered,
    getCredencialPage,
} = require('./controllers');
const {
    authenticate,
    authorize,
    checkBlacklist
} = require('./middlewares');

const router = express.Router();

const multer = require('multer');
const upload = require('./upload');
const fs = require('fs');
const path = require('path');
const pool = require('./db');

// Rutas Públicas
router.get('/prueba', prueba);
router.post('/login', login); // Inicio de sesión
router.post('/verify-email', verifyEmail); // Verificación de correo electrónico
router.post('/force-logout', forceLogout); // Cierre forzoso de sesión

// FALLBACK TEMPORAL: aceptar intentos de logueo de errores de carga masiva
// colocado aquí SIN autenticación para evitar 404 en despliegues donde
// el middleware de autenticación/proxy esté fallando. Quitar cuando se
// confirme y arregle la causa raíz.
router.post('/cargar_fotos_masivas/log_failed_attempt', (req, res, next) => {
    try {
        // Llamar al controlador existente (este controlador tolera req.userId === undefined)
        return require('./controllers').logFailedAttempt(req, res, next);
    } catch (e) {
        console.warn('Fallback log_failed_attempt error:', e && e.message ? e.message : e);
        return res.status(500).json({ error: 'Fallback: error interno.' });
    }
});

// Endpoint para credencial (público)
// Nota: registrar las rutas específicas (/historico) ANTES que la ruta dinámica
// '/credencial/:cedula' para evitar que ':cedula' capture la palabra "historico".
// Guardar histórico: requiere autenticación para saber quién imprimió
router.post('/credencial/historico', authenticate, saveCredentialPrint);
// Listar histórico de impresiones (protegido)
router.get('/credencial/historico', authenticate, listCredentialHistory);
// Actualizar estado de entrega (entregado)
router.patch('/credencial/historico/:id/entregado', authenticate, updateCredentialDelivered);
// Buscar credencial por cédula (debe ir después de las rutas específicas)
router.get('/credencial/:cedula', getCredencial);
// Página pública utilizada por los códigos QR para mostrar información de credenciales
router.get('/credenciales/cedula=:cedula', getCredencialPage);

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
    // Registrar errores de multer para que aparezcan en el historial de errores
    try {
        if (err) {
            const uploadsDir = path.join(__dirname, '../uploads');
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
            const latestPath = path.join(uploadsDir, 'mass_upload_errors_latest.json');
            const historyPath = path.join(uploadsDir, 'mass_upload_errors_history.log');
            const now = new Date().toISOString();
            const reason = err instanceof multer.MulterError ? (err.code || 'multer_error') : 'upload_error';
            
            // Usar la cabecera X-Original-Filename si existe
            const originalFilename = req.headers['x-original-filename'] ? decodeURIComponent(req.headers['x-original-filename']) : null;
            const fileInfo = originalFilename || (req.file && (req.file.originalname || req.file.path)) || (req.files && req.files.length ? (req.files.map(f=>f.originalname||f.path).join(',')) : null);
            
            // Derivar cédula si es posible a partir del nombre original
            let cleanCedula = null;
            if (fileInfo) {
                const baseName = fileInfo.replace(/\.[^/.]+$/, "");
                if (baseName.includes('_')) {
                    const parts = baseName.split('_');
                    const lastPart = parts[parts.length - 1];
                    const clean = lastPart.replace(/\D/g, '');
                    if (clean) cleanCedula = clean;
                } else {
                    const clean = baseName.replace(/\D/g, '');
                    if (clean) cleanCedula = clean;
                }
            }

            const entry = { timestamp: now, user_id: req.userId || null, file: fileInfo, reason: reason, message: err && err.message ? String(err.message) : null };
            // Sobrescribir latest con este único error (para visibilidad inmediata)
            const latestObj = { generated_at: now, user_id: req.userId || null, total_files: (req.files ? req.files.length : (req.file ? 1 : 0)), resultado: { procesadas: 0, insertadas: [], actualizadas: [], rechazadas: [entry] } };
            try { fs.writeFileSync(latestPath, JSON.stringify(latestObj, null, 2), 'utf8'); } catch (e) { console.warn('No se pudo escribir latest multer error:', e); }
            try { fs.appendFileSync(historyPath, JSON.stringify(entry) + '\n', 'utf8'); } catch (e) { }
            // Intentar insertar en BD (no bloquear la respuesta)
            try {
                pool.query('INSERT INTO mass_uploads (user_id, total_files, summary) VALUES ($1, $2, $3) RETURNING id', [req.userId || null, (req.files ? req.files.length : (req.file ? 1 : 0)), JSON.stringify(latestObj.resultado)])
                .then(resIns => {
                    const uploadId = resIns.rows && resIns.rows[0] && resIns.rows[0].id ? resIns.rows[0].id : null;
                    if (uploadId) {
                        return pool.query('INSERT INTO mass_upload_errors (upload_id, file_name, cedula, reason, details) VALUES ($1, $2, $3, $4, $5)', [uploadId, entry.file || null, cleanCedula || null, entry.reason || null, entry.message || null]);
                    }
                    return null;
                })
                .catch(e=>{ console.warn('No se pudo insertar multer error en BD:', e && e.message ? e.message : e); });
            } catch (e) { console.warn('Error al insertar multer error en BD (sync):', e); }
        }
    } catch (e) { console.warn('Error registrando multer error:', e); }

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
// Obtener último archivo JSON de errores (sobrescrito por la última ejecución)
router.get('/cargar_fotos_masivas/errors', authenticate, authorize('update_servidor'), getMassUploadErrors);
// Historial completo desde la BD (JSON)
router.get('/cargar_fotos_masivas/errors/history', authenticate, authorize('update_servidor'), getMassUploadHistory);
// Historial por nombre de archivo (original)
router.get('/cargar_fotos_masivas/errors/file', authenticate, authorize('update_servidor'), getMassUploadErrorsByFile);
// Último resumen desde la BD (incluye errores asociados)
router.get('/cargar_fotos_masivas/errors/latest_db', authenticate, authorize('update_servidor'), getMassUploadLatestDB);
router.post('/cargar_fotos_masivas/log_failed_attempt', authenticate, authorize('update_servidor'), logFailedAttempt);
// Rutas para errores de carga masiva de SERVIDORES (CSV/XLSX)
router.post('/cargar_servidores_masivos/log_failed_row', authenticate, authorize('create_servidor'), logServerFailedRow);
// Permitir acceso anónimo de solo lectura a los resúmenes/historiales de errores
router.get('/cargar_servidores_masivos/errors/history', require('./middlewares').optionalAuthenticate, getServerMassUploadHistory);
router.get('/cargar_servidores_masivos/errors/latest_db', require('./middlewares').optionalAuthenticate, getServerMassUploadLatestDB);
router.get('/cargar_servidores_masivos/errors/file', require('./middlewares').optionalAuthenticate, getServerMassUploadErrorsByFile);
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
router.post('/sedes', authenticate, authorize('view_admin'), createHeadquarter);
router.put('/sedes/:id', authenticate, authorize('view_admin'), updateHeadquarter);
router.delete('/sedes/:id', authenticate, authorize('view_admin'), deleteHeadquarter);
router.get('/areas', listAreas); // Listar areas
router.post('/areas', authenticate, authorize('view_admin'), createArea);
router.put('/areas/:id', authenticate, authorize('view_admin'), updateArea);
router.delete('/areas/:id', authenticate, authorize('view_admin'), deleteArea);
router.get('/cargos', serverPosition); // Listar cargos (público para usar en dropdowns)
router.post('/cargos', authenticate, authorize('view_admin'), createPosition);
router.put('/cargos/:id', authenticate, authorize('view_admin'), updatePosition);
router.delete('/cargos/:id', authenticate, authorize('view_admin'), deletePosition);
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
