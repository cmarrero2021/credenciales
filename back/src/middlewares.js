const jwt = require('jsonwebtoken');
const pool = require('./db');

// Middleware para autenticación
exports.authenticate = async (req, res, next) => {
    // Buscar token en múltiples ubicaciones para compatibilidad con nginx
    const authHeader = req.header('Authorization')
        || req.header('authorization')
        || req.header('X-Authorization')
        || req.header('x-authorization');

    const token = authHeader?.split(' ')[1] || req.header('x-access-token') || req.query.token;

    // Log de diagnóstico (se puede eliminar después)
    console.log('[AUTH] Headers recibidos:', JSON.stringify(req.headers));
    console.log('[AUTH] Token extraído:', token ? token.substring(0, 20) + '...' : 'NINGUNO');

    if (!token) return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });

    try {
        // Verificar si el token está en la lista negra
        const blacklistResult = await pool.query('SELECT * FROM blacklisted_tokens WHERE token = $1 AND expires_at > NOW()', [token]);
        if (blacklistResult.rows.length) {
            return res.status(401).json({ error: 'Sesión expirada. Por favor, inicia sesión nuevamente.' });
        }

        // Decodificar el token JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;

        // Validar la sesión activa
        const sessionResult = await pool.query(
            'SELECT expires_at FROM sessions WHERE token = $1 AND is_revoked = FALSE', 
            [token]
        );
        
        if (!sessionResult.rows.length) {
            return res.status(401).json({ error: 'Sesión no encontrada o revocada.' });
        }
        
        const expiresAt = sessionResult.rows[0].expires_at;
        if (new Date(expiresAt) < new Date()) {
            return res.status(401).json({ error: 'Sesión expirada. Por favor, inicia sesión nuevamente.' });
        }

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            // Registrar el vencimiento de la sesión en la auditoría
            try {
                await pool.query(
                    'UPDATE login_logs SET logout_type = $1, logout_timestamp = NOW() WHERE session_token = $2',
                    ['expired', token]
                );
            } catch (_) { /* noop */ }
            return res.status(401).json({ error: 'La sesión ha expirado. Por favor, inicia sesión nuevamente.' });
        }
        res.status(400).json({ error: 'Token inválido.' });
    }
};

// Middleware para verificar permisos
exports.authorize = (requiredPermission) => {
    return async (req, res, next) => {
        const { userId } = req;

        const client = await pool.connect();
        try {
            // Obtener los permisos explícitos del usuario (user_permissions)
            // y los permisos derivados de sus roles (role_permissions).
            // Usamos UNION para evitar duplicados.
            const result = await client.query(`
                SELECT p.name AS permission_name FROM user_permissions up
                JOIN permissions p ON up.permission_id = p.id
                WHERE up.user_id = $1
                UNION
                SELECT p.name AS permission_name
                FROM user_roles ur
                JOIN role_permissions rp ON ur.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE ur.user_id = $1
            `, [userId]);

            const userPermissions = result.rows.map(row => row.permission_name);
            // Verificar si el usuario tiene el permiso requerido
            if (!userPermissions.includes(requiredPermission)) {
                return res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
            }

            next();
        } catch (err) {
            console.error('Error in authorize middleware:', err && err.message)
            res.status(500).json({ error: 'Error al verificar los permisos.', details: err.message });
        } finally {
            client.release();
        }
    };
};

// Middleware para verificar si el usuario está verificado
exports.verifyUser = async (req, res, next) => {
    const { userId } = req;

    const client = await pool.connect();
    try {
        const result = await client.query('SELECT is_verified FROM users WHERE id = $1', [userId]);
        if (!result.rows[0]?.is_verified) {
            return res.status(403).json({ error: 'El usuario no está verificado.' });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: 'Error al verificar el usuario.' });
    } finally {
        client.release();
    }
};

// Middleware para verificar si el token está en la lista negra
exports.checkBlacklist = async (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return next();

    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM blacklisted_tokens WHERE token = $1 AND expires_at > NOW()', [token]);
        if (result.rows.length) {
            return res.status(401).json({ error: 'Sesión expirada. Por favor, inicia sesión nuevamente.' });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: 'Error al verificar el token.' });
    } finally {
        client.release();
    }
};