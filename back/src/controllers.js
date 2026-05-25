const jwt = require('jsonwebtoken');
const path = require('path');
const pool = require('./db');
const {
    hashPassword,
    comparePassword,
    generateToken,
    generateSecureToken,
    sendEmail,
    validatePassword,
    getSessionTimeout
} = require('./utils');

// normaliza el motivo almacenado como cadena/objeto/JSON -> devuelve una palabra/cadena simple
function normalizeReason(raw) {
    if (!raw && raw !== 0) return null
    try {
        if (typeof raw === 'string') {
            const s = raw.trim()
            if ((s.startsWith('{') || s.startsWith('['))) {
                try {
                    const parsed = JSON.parse(s)
                    return (parsed && (parsed.value || parsed.label)) ? (parsed.value || parsed.label) : String(parsed)
                } catch (e) {
                }
            }

            try {
                const m = s.match(/"value"\s*:\s*"([^"\n]*)/)
                if (m && m[1]) return m[1]
            } catch (e) { }
            return s
        } else if (typeof raw === 'object') {
            return raw.value || raw.label || JSON.stringify(raw)
        } else {
            return String(raw)
        }
    } catch (e) {
        try { return String(raw) } catch (ee) { return null }
    }
}
// ================================
// Servidores
// ================================
// Crear servidores
exports.createServer = async (req, res) => {
    const { area_id, institucion_id, sede_id, estado_id, cedula, nombres, apellidos, cargo_id, condicion } = req.body;

    // Convertir IDs vacíos a null para evitar errores en Postgres
    // Convertir IDs vacíos a null y asegurar que sean enteros para evitar errores en Postgres
    const areaId = (area_id === '' || area_id === null || area_id === undefined) ? null : parseInt(area_id);
    const institucionId = (institucion_id === '' || institucion_id === null || institucion_id === undefined) ? null : parseInt(institucion_id);
    const sedeId = (sede_id === '' || sede_id === null || sede_id === undefined) ? null : parseInt(sede_id);
    const cargoId = (cargo_id === '' || cargo_id === null || cargo_id === undefined) ? null : parseInt(cargo_id);
    const client = await pool.connect();
    const fs = require('fs');
    let fotoPath = req.file && req.file.path ? req.file.path : null;

    console.log('=== CREATE SERVER DEBUG ===');
    console.log('Body:', req.body);
    console.log('File:', req.file);
    console.log('FotoPath:', fotoPath);

    try {
        await client.query('BEGIN');

        const server = await client.query('SELECT cedula FROM servidores WHERE cedula = $1', [cedula]);
        if (server.rowCount > 0) {
            await client.query('ROLLBACK');
            // Eliminar foto si fue subida
            if (fotoPath) {
                try { fs.unlinkSync(fotoPath); } catch (e) { }
            }
            return res.status(409).json({ error: 'La cédula del servidor ya está registrada.' });
        }

        // Insertar servidor
        const insertResult = await client.query(
            'INSERT INTO servidores (cedula, nombres, apellidos, institucion_id, sede_id, area_id, cargo_id, condicion) VALUES ($4, $5, $6, $2, $3, $1, $7, $8) RETURNING id',
            [areaId, institucionId, sedeId, cedula, nombres, apellidos, cargoId, condicion || 'ACTIVO']
        );

        const servidor_id = insertResult.rows[0]?.id;
        console.log('Servidor insertado con ID:', servidor_id);

        // Si hay archivo de foto
        if (fotoPath && servidor_id) {
            console.log('Procesando foto...');
            const foto_url = fotoPath.replace(/\\/g, '/');
            console.log('Insertando foto - usuario_id:', servidor_id, 'foto_url:', foto_url);

            // Verificar si ya existe entrada en fotos_usuarios para evitar conflicto de unicidad
            const existingFoto = await client.query(
                'SELECT id FROM fotos_usuarios WHERE usuario_id = $1', [servidor_id]
            );
            if (existingFoto.rows.length > 0) {
                await client.query(
                    'UPDATE fotos_usuarios SET foto_url = $1 WHERE usuario_id = $2',
                    [foto_url, servidor_id]
                );
                console.log('Foto ACTUALIZADA para usuario_id:', servidor_id);
            } else {
                await client.query(
                    'INSERT INTO fotos_usuarios (usuario_id, foto_url) VALUES ($1, $2)',
                    [servidor_id, foto_url]
                );
                console.log('Foto INSERTADA para usuario_id:', servidor_id);
            }
        } else {
            console.log('No hay foto para procesar.');
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Servidor creado exitosamente.' });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        console.error('ERROR en createServer:', err);
        // Eliminar foto si fue subida y ocurre cualquier error
        if (fotoPath) {
            try { fs.unlinkSync(fotoPath); } catch (e) { }
        }
        res.status(500).json({ error: 'Error al crear el servidor.', details: err.message });
    } finally {
        client.release();
    }
};

// Carga masiva de fotos: acepta múltiples archivos y los asigna por nombre de archivo (cedula)
exports.massUploadPhotos = async (req, res) => {
    const fs = require('fs');
    const files = req.files || [];

    if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No se han subido archivos.' });
    }

    const client = await pool.connect();
    const resultado = {
        procesadas: 0,
        insertadas: [],
        actualizadas: [],
        rechazadas: []
    };

    try {
        for (const file of files) {
            const fotoPath = file.path;
            const filename = (file.originalname || fotoPath).toString();

            // Derivar cédula desde el nombre del archivo: quitar extensión y caracteres no numéricos
            let cedula = filename.replace(/\.[^/.]+$/, '').replace(/\D/g, '');
            if (!cedula) {
                resultado.rechazadas.push({ file: filename, reason: 'no_cedula_en_nombre' });
                try { fs.unlinkSync(fotoPath); } catch (e) { }
                continue;
            }

            try {
                await client.query('BEGIN');

                const existsRes = await client.query('SELECT id FROM servidores WHERE cedula = $1', [cedula]);
                if (existsRes.rows.length === 0) {
                    resultado.rechazadas.push({ cedula, file: filename, reason: 'servidor_no_encontrado' });
                    await client.query('ROLLBACK');
                    try { fs.unlinkSync(fotoPath); } catch (e) { }
                    continue;
                }

                const usuario_id = existsRes.rows[0].id;
                const foto_url = fotoPath.replace(/\\/g, '/');

                // Buscar foto anterior
                const queryOldFoto = 'SELECT foto_url FROM fotos_usuarios WHERE usuario_id = $1';
                const oldFotoRes = await client.query(queryOldFoto, [usuario_id]);

                if (oldFotoRes.rows.length > 0) {
                    const oldFoto = oldFotoRes.rows[0].foto_url;
                    if (oldFoto) {
                        try {
                            const nombreOldFoto = oldFoto.replace(/\\/g, '/').split('/').pop();
                            const uploadsDir = path.join(__dirname, '../uploads');
                            let realOldPath = null;
                            if (fs.existsSync(uploadsDir)) {
                                const filesInDir = fs.readdirSync(uploadsDir);
                                const fileMatch = filesInDir.find(f => f.toLowerCase() === nombreOldFoto.toLowerCase());
                                if (fileMatch) realOldPath = path.join(uploadsDir, fileMatch);
                            }
                            if (!realOldPath) realOldPath = path.join(uploadsDir, nombreOldFoto);
                            if (fs.existsSync(realOldPath)) {
                                try { fs.unlinkSync(realOldPath); } catch (e) { }
                            }
                        } catch (e) { }
                    }

                    // Actualizar
                    const queryUpdateFoto = 'UPDATE fotos_usuarios SET foto_url = $1 WHERE usuario_id = $2';
                    await client.query(queryUpdateFoto, [foto_url, usuario_id]);
                    resultado.actualizadas.push(cedula);
                } else {
                    // Insertar
                    const queryInsertFoto = 'INSERT INTO fotos_usuarios (usuario_id, foto_url) VALUES ($1, $2)';
                    await client.query(queryInsertFoto, [usuario_id, foto_url]);
                    resultado.insertadas.push(cedula);
                }

                await client.query('COMMIT');
                resultado.procesadas++;
            } catch (err) {
                try { await client.query('ROLLBACK'); } catch (e) { }
                resultado.rechazadas.push({ cedula, file: filename, reason: 'error_interno' });
                try { fs.unlinkSync(fotoPath); } catch (e) { }
            }
        }

        return res.status(200).json({ message: 'Carga masiva procesada.', resultado });
    } catch (err) {
        console.error('Error en massUploadPhotos:', err);
        return res.status(500).json({ error: 'Error interno al procesar la carga masiva.' });
    } finally {
        client.release();
    }
};
// Listar histórico de impresiones
exports.listCredentialHistory = async (req, res) => {
    const client = await pool.connect();
    try {
        // Garantizar existencia de columnas en historico
        try {
            await client.query("ALTER TABLE historico ADD COLUMN IF NOT EXISTS printed_by integer");
            await client.query("ALTER TABLE historico ADD COLUMN IF NOT EXISTS disabled_by integer");
            // Ensure `reimpreso_de` is a UUID referencing historico.id — if it exists with wrong type, replace it
            await client.query(`DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'historico' AND column_name = 'reimpreso_de' AND data_type <> 'uuid') THEN
                    ALTER TABLE historico DROP COLUMN reimpreso_de;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'historico' AND column_name = 'reimpreso_de') THEN
                    ALTER TABLE historico ADD COLUMN reimpreso_de uuid;
                END IF;
            END$$;`);
            await client.query("ALTER TABLE historico ADD COLUMN IF NOT EXISTS motivo_deshabilitado text");
            await client.query("ALTER TABLE historico ADD COLUMN IF NOT EXISTS fecha_deshabilitado timestamptz");
        } catch (e) { console.warn('No se pudo asegurar columnas:', e && e.message) }

        let result = await client.query(`
                SELECT h.id, h.institucion, h.cedula, h.nombres, h.apellidos, h.unidad, h.cargo, h.vigente, h.created_at,
                       encode(h.foto, 'base64') as foto_b64,
                       h.motivo_deshabilitado, h.fecha_deshabilitado,
                       u.id as printed_by_id, u.first_name, u.last_name, u.username as printed_by_username,
                       du.id as disabled_by_id, du.first_name as disabled_by_first, du.last_name as disabled_by_last, du.username as disabled_by_username,
                       s.activo as servidor_activo
                FROM historico h
                LEFT JOIN users u ON h.printed_by = u.id
                LEFT JOIN users du ON h.disabled_by = du.id
                LEFT JOIN servidores s ON h.cedula = s.cedula
                ORDER BY h.created_at DESC
            `);

        const rows = result.rows.map(r => ({
            id: r.id,
            institucion: r.institucion,
            cedula: r.cedula,
            nombres: r.nombres,
            apellidos: r.apellidos,
            unidad: r.unidad,
            cargo: r.cargo,
            vigente: r.vigente,
            activo: (typeof r.servidor_activo !== 'undefined') ? r.servidor_activo : r.vigente,
            created_at: r.created_at,
            foto_url: r.foto_b64 ? `data:image/png;base64,${r.foto_b64}` : null,
            disable_reason: (function () { try { return normalizeReason(r.motivo_deshabilitado) } catch (e) { return r.motivo_deshabilitado || null } })(),
            disabled_at: r.fecha_deshabilitado || null,
            impreso_por_id: r.printed_by_id || null,
            impreso_por_first: r.first_name || null,
            impreso_por_last: r.last_name || null,
            impreso_por_username: r.printed_by_username || null,
            impreso_por: (function () {
                if (!r.printed_by_id) return null
                const parts = []
                if (r.first_name) parts.push(r.first_name)
                if (r.last_name) parts.push(r.last_name)
                const name = parts.join(' ').trim()
                if (name) return name
                if (r.printed_by_username) return r.printed_by_username
                return null
            })(),
            deshabilitado_por: (function () {
                if (!r.disabled_by_id) return null
                const parts = []
                if (r.disabled_by_first) parts.push(r.disabled_by_first)
                if (r.disabled_by_last) parts.push(r.disabled_by_last)
                const name = parts.join(' ').trim()
                if (name) return name
                return r.disabled_by_username || null
            })()
        }));

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('ETag', '');
        res.status(200).json(rows);
    } catch (err) {
        console.error('Error listCredentialHistory:', err);
        res.status(500).json({ error: 'Error al listar el histórico de impresión.', details: err.message });
    } finally {
        client.release();
    }
};
// Listar Servidores
exports.listServers = async (req, res) => {
    const client = await pool.connect();
    try {
        // Consulta con LEFT JOIN para obtener la foto asociada (si existe)
        // const result = await client.query(`
        //     SELECT a.id, a.institucion_id, a.institucion, a.sede_id, a.sede, a.area_id, a.area, a.cedula,
        //            a.nombres, a.apellidos, a.cargo_id, a.cargo,
        //            f.foto_url
        //     FROM vservidores a
        //     LEFT JOIN fotos_usuarios f ON f.usuario_id = a.id
        //     ORDER BY a.institucion_id, a.sede_id, a.area_id, a.cedula
        // `);
        // Garantizar existencia de columna condicion y permitir nulos en area/cargo para jubilados
        try {
            await client.query("ALTER TABLE servidores ADD COLUMN IF NOT EXISTS condicion VARCHAR(50) DEFAULT 'ACTIVO'");
            await client.query("ALTER TABLE servidores ALTER COLUMN area_id DROP NOT NULL");
            await client.query("ALTER TABLE servidores ALTER COLUMN cargo_id DROP NOT NULL");
        } catch (e) { console.warn('No se pudo asegurar columnas o restricciones:', e && e.message) }

        const result = await client.query(`
            SELECT a.id, a.institucion_id, a.institucion, a.sede_id, a.sede, a.area_id, a.area, a.cedula,
                   a.nombres || ' ' || a.apellidos as nombres, a.cargo_id, a.cargo,
                   f.foto_url, s.condicion
            FROM vservidores a
            LEFT JOIN fotos_usuarios f ON f.usuario_id = a.id
            LEFT JOIN servidores s ON s.id = a.id
            ORDER BY a.institucion_id, a.sede_id, a.area_id, a.cedula
        `);
        // Verificar existencia física de la foto y asignar imagen por defecto si no existe
        const fs = require('fs');
        const path = require('path');
        const defaultFoto = '/img/no_person.png';
        const uploadsDir = path.join(__dirname, '../uploads');
        let uploadFiles = [];
        try { if (fs.existsSync(uploadsDir)) uploadFiles = fs.readdirSync(uploadsDir); } catch (e) { }

        const servidores = result.rows.map(row => {
            let foto_url = row.foto_url;
            let final_url = defaultFoto;
            if (foto_url) {
                const nombreFoto = foto_url.replace(/\\/g, '/').split('/').pop();
                // Buscar el archivo en disco (case-insensitive)
                let realPath = null;
                if (fs.existsSync(foto_url)) {
                    realPath = foto_url;
                } else {
                    const fileMatch = uploadFiles.find(f => f.toLowerCase() === nombreFoto.toLowerCase());
                    if (fileMatch) realPath = path.join(uploadsDir, fileMatch);
                    else realPath = path.join(uploadsDir, nombreFoto);
                }
                if (realPath && fs.existsSync(realPath)) {
                    try {
                        const imgBuffer = fs.readFileSync(realPath);
                        const ext = path.extname(realPath).toLowerCase();
                        const mime = (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';
                        final_url = `data:${mime};base64,${imgBuffer.toString('base64')}`;
                    } catch (e) {
                        final_url = defaultFoto;
                    }
                } else {
                    final_url = defaultFoto;
                }
            }
            return { ...row, foto_url: final_url };
        });
        res.status(200).json(servidores);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los servidores.' });
    } finally {
        client.release();
    }
};

// Devolver permisos del usuario autenticado (temporal)
exports.debugPermissions = async (req, res) => {
    const userId = req.userId;
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT p.name AS permission_name
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE u.id = $1
        `, [userId]);
        const perms = result.rows.map(r => r.permission_name);
        res.status(200).json({ userId, permissions: perms });
    } catch (err) {
        console.error('debugPermissions error', err);
        res.status(500).json({ error: 'Error fetching permissions', details: err.message });
    } finally {
        client.release();
    }
};

// Buscar servidor
// Endpoint para credencial
exports.getCredencial = async (req, res) => {
    const { cedula } = req.params;
    const client = await pool.connect();
    const fs = require('fs');
    const path = require('path');
    try {
        // Buscar datos del servidor y foto
        const result = await client.query(`
            SELECT s.cedula, s.nombres, s.apellidos, s.institucion, s.area, s.abreviacion, s.cargo_id, s.cargo, s.nivel, f.foto_url, ss.condicion
            FROM vservidores s
            LEFT JOIN fotos_usuarios f ON f.usuario_id = s.id
            LEFT JOIN servidores ss ON ss.cedula = s.cedula
            WHERE s.cedula = $1
        `, [cedula]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No encontrado.' });
        }
        const row = result.rows[0];
        let foto_url = row.foto_url;
        let final_url = '/img/no_person.png';
        if (foto_url) {
            // Intentar leer el archivo desde disco y devolver como base64
            // Esto evita que el navegador tenga que hacer una segunda petición HTTP
            // a /uploads/, lo que puede fallar si nginx no proxea esa ruta.
            const nombreFoto = foto_url.replace(/\\/g, '/').split('/').pop();
            const uploadsDir = path.join(__dirname, '../uploads');
            let realPath = null;
            // 1) Ruta absoluta guardada en la BD (funciona en Linux si la ruta existe)
            if (fs.existsSync(foto_url)) {
                realPath = foto_url;
            } else {
                // 2) Buscar el archivo en el directorio uploads (búsqueda case-insensitive)
                try {
                    if (fs.existsSync(uploadsDir)) {
                        const files = fs.readdirSync(uploadsDir);
                        const fileMatch = files.find(f => f.toLowerCase() === nombreFoto.toLowerCase());
                        if (fileMatch) realPath = path.join(uploadsDir, fileMatch);
                    }
                } catch (e) { }
                // 3) Fallback: construir ruta directa
                if (!realPath) realPath = path.join(uploadsDir, nombreFoto);
            }
            if (realPath && fs.existsSync(realPath)) {
                try {
                    const imgBuffer = fs.readFileSync(realPath);
                    const ext = path.extname(realPath).toLowerCase();
                    const mime = (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';
                    final_url = `data:${mime};base64,${imgBuffer.toString('base64')}`;
                } catch (e) {
                    console.warn('[getCredencial] No se pudo leer imagen, usando default:', e.message);
                    final_url = '/img/no_person.png';
                }
            } else {
                console.warn('[getCredencial] Archivo no encontrado en disco:', foto_url);
                final_url = '/img/no_person.png';
            }
        }
        // Determinar estado del trabajador (servidores.activo) y motivo si existe
        let servidorActivo = null
        let disableReason = null
        try {
            const sres = await client.query(`SELECT activo, motivo, razon, motivo_deshabilitado, motivo_deshabilitado FROM servidores WHERE cedula = $1 LIMIT 1`, [cedula])
            if (sres.rows.length) {
                servidorActivo = (typeof sres.rows[0].activo !== 'undefined') ? !!sres.rows[0].activo : null
                const raw = sres.rows[0].motivo || sres.rows[0].razon || sres.rows[0].motivo_deshabilitado || sres.rows[0].motivo_deshabilitado || null
                disableReason = normalizeReason(raw)
            }
        } catch (e) {
            console.warn('No se pudo obtener estado/motivo desde servidores:', e && e.message ? e.message : e)
        }

        // Determinar estado del carnet consultando la tabla historico (vigente) y posibles motivos
        let carnetActivo = null
        let histDisableReason = null
        let histDisabledAt = null
        try {
            const histRes = await client.query('SELECT vigente, motivo_deshabilitado, fecha_deshabilitado FROM historico WHERE cedula = $1 ORDER BY created_at DESC LIMIT 1', [cedula])
            if (histRes.rows.length) {
                const row = histRes.rows[0]
                if (typeof row.vigente !== 'undefined') carnetActivo = !!row.vigente
                histDisableReason = row.motivo_deshabilitado || null
                histDisabledAt = row.fecha_deshabilitado || null
            }
        } catch (e) {
            console.warn('No se pudo determinar estado de historico.vigente:', e && e.message ? e.message : e)
        }
        res.status(200).json({
            cedula: row.cedula,
            nombres: row.nombres,
            apellidos: row.apellidos,
            institucion: row.institucion,
            area: row.area,
            abreviacion: row.abreviacion,
            cargo: row.cargo,
            nivel: row.nivel,
            foto_url: final_url,
            // Exponer ambos estados para que el frontend pueda renderizar correctamente.
            activo: (carnetActivo === null) ? true : carnetActivo,
            trabajador_activo: (servidorActivo === null) ? true : servidorActivo,
            disable_reason: histDisableReason || disableReason,
            disabled_at: histDisabledAt || null,
            condicion: row.condicion || 'ACTIVO'
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al buscar la credencial.' });
    } finally {
        client.release();
    }
};

// Página pública que muestra la información de la credencial (para QR)
exports.getCredencialPage = async (req, res) => {
    const cedula = req.params.cedula;
    const client = await pool.connect();
    const fs = require('fs');
    const path = require('path');
    try {
        const result = await client.query(`
                        SELECT s.cedula, s.nombres, s.apellidos, s.institucion, s.area, s.abreviacion, s.cargo, f.foto_url
                        FROM vservidores s
                        LEFT JOIN fotos_usuarios f ON f.usuario_id = s.id
                        WHERE s.cedula = $1
                `, [cedula]);
        if (result.rows.length === 0) {
            return res.status(404).send('<h2>No se encontró la credencial</h2>');
        }
        const row = result.rows[0];
        let foto_url = row.foto_url;
        let final_url = '/img/no_person.png';
        if (foto_url) {
            const nombreFoto = foto_url.replace(/\\/g, '/').split('/').pop();
            const uploadsDir = path.join(__dirname, '../uploads');
            let fileMatch = null;
            try {
                if (fs.existsSync(uploadsDir)) {
                    const files = fs.readdirSync(uploadsDir);
                    fileMatch = files.find(f => f.toLowerCase() === nombreFoto.toLowerCase());
                }
            } catch (e) { }
            if (fileMatch) {
                final_url = `/uploads/${fileMatch}`;
            } else {
                // Solo asignar como foto final si sabemos que no existe ningún listado pero la URL valía... aunque es la vista pública
                // Validamos chequeo por defecto
                const realPathFallback = path.join(__dirname, '../uploads', nombreFoto);
                if (fs.existsSync(realPathFallback)) final_url = `/uploads/${nombreFoto}`;
            }
        }

        // Determinar estado del carnet consultando el histórico (vigente)
        let carnetActivo = false;
        try {
            const histRes = await client.query(`SELECT vigente FROM historico WHERE cedula = $1 ORDER BY created_at DESC LIMIT 1`, [cedula]);
            if (histRes.rows.length && histRes.rows[0].vigente) carnetActivo = true;
        } catch (err) {
            console.error('Error listUsers (main query):', err && err.message ? err.message : err);
            try {
                console.log('Attempting fallback simple users query');
                const fallbackParams = [perPage, offset];
                const fallbackQuery = `SELECT id, first_name, last_name, cedula, email, is_email_verified, status, session_timeout_min, created_at FROM users u ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`;
                const fbRes = await client.query(fallbackQuery, fallbackParams);
                const fbRows = fbRes.rows.map(r => ({ ...r, roles: [] }));
                return res.status(200).json({ total: total || fbRows.length, users: fbRows });
            } catch (fbErr) {
                console.error('Fallback query also failed:', fbErr && fbErr.message ? fbErr.message : fbErr);
                return res.status(500).json({ error: 'Error al listar los usuarios.' });
            }
        }

        // Determinar estado del trabajador desde la tabla 'servidores'. Si la columna no existe, crearla y asumir true.
        let trabajadorActivo = true;
        try {
            const colRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'servidores' AND column_name = 'activo'");
            if (!colRes.rows.length) {
                await client.query("ALTER TABLE servidores ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true");
            }
            const actRes = await client.query('SELECT activo FROM servidores WHERE cedula = $1 LIMIT 1', [cedula]);
            if (actRes.rows.length && typeof actRes.rows[0].activo !== 'undefined') {
                trabajadorActivo = !!actRes.rows[0].activo;
            }
        } catch (e) {
            console.warn('No se pudo determinar/crear columna activo en servidores:', e.message);
        }

        // Construir URL de la página y QR (apunta a esta misma vista)
        const pageUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
        // Generar QR en el servidor si es posible (mejor disponibilidad y sin depender de servicios externos)
        let qrSrc;
        try {
            const QRCode = require('qrcode');
            qrSrc = await QRCode.toDataURL(pageUrl, { width: 220 });
        } catch (e) {
            // Si la dependencia no está instalada o falla, volver al servicio externo
            console.warn('QR local no disponible, usando Google Charts como fallback:', e && e.message);
            qrSrc = `https://chart.googleapis.com/chart?chs=220x220&cht=qr&chl=${encodeURIComponent(pageUrl)}`;
        }

        // Determinar sello según la institución
        const institucionName = (row.institucion || '').toString();
        const isInass = /INSTITUTO NACIONAL DE LOS SERVICIOS SOCIALES/i.test(institucionName);
        const selloImg = isInass ? '/img/inass_sello_firma.png' : '/img/ministerio_sello_firma.png';

        const html = `<!doctype html>
                <html>
                    <head>
                        <meta charset="utf-8">
                        <title>Credencial ${row.cedula}</title>
                        <meta name="viewport" content="width=device-width,initial-scale=1" />
                        <style>
                            html,body{height:100%;margin:0;padding:0;background:#f4f6f8;font-family: Arial, Helvetica, sans-serif;color:#0f172a}
                            .container{max-width:980px;margin:20px auto;padding:18px}
                            .info-card{background:#fff;border-radius:8px;padding:18px;display:flex;gap:18px;align-items:flex-start;box-shadow:0 6px 20px rgba(2,6,23,0.06);border:1px solid #eef2f7}
                            .info-left{flex:1}
                            .info-right{width:150px;text-align:center}
                            .title{font-size:20px;font-weight:700;margin:0 0 8px}
                            .badges{display:flex;gap:8px;margin-bottom:12px}
                            .badge{padding:6px 10px;border-radius:999px;font-weight:700;font-size:12px;color:#fff}
                            .badge--active{background:#10b981}
                            .badge--inactive{background:#64748b}
                            .field{margin:6px 0}
                            .label{font-weight:700;margin-right:8px}
                            .muted{color:#334155}
                            .photo{width:128px;height:128px;object-fit:cover;border-radius:6px;border:1px solid #e6eef6}
                            .banner-full{width:100%;display:block;object-fit:cover;min-height:70px;background:#ffffff;}
                            .btn-home{display:inline-block;color:#64748b;text-decoration:none;font-size:13px;font-weight:600;padding:6px 14px;border:1px solid #eef2f7;border-radius:6px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.05);}
                            .header-actions{text-align:right;margin-bottom:12px;}
                            @media(max-width:980px){.container{padding:12px}.info-card{flex-direction:column}.info-right{width:100%;text-align:center}}
                        </style>
                    </head>
                    <body>
                        <img src="/img/cintillomi.png" alt="Cintillo" class="banner-full" />
                        <div class="container">
                            <div class="header-actions">
                                <a href="https://adultosmayores.minaamp.gob.ve" class="btn-home">INICIO</a>
                            </div>
                            <div class="info-card">
                                <div class="info-left">
                                    <div class="title">Credencial</div>
                                    <div class="badges">
                                        <div class="badge ${carnetActivo ? 'badge--active' : 'badge--inactive'}">Carnet: ${carnetActivo ? 'Activo' : 'Inactivo'}</div>
                                        <div class="badge ${trabajadorActivo ? 'badge--active' : 'badge--inactive'}">Trabajador: ${trabajadorActivo ? 'Activo' : 'Inactivo'}</div>
                                    </div>
                                    <div class="field"><span class="label">Cédula:</span> <span class="muted">${row.cedula}</span></div>
                                    <div class="field"><span class="label">Nombres:</span> <span class="muted">${row.nombres}</span></div>
                                    <div class="field"><span class="label">Apellidos:</span> <span class="muted">${row.apellidos}</span></div>
                                    <div class="field"><span class="label">Institución:</span> <span class="muted">${row.institucion || ''}</span></div>
                                    <div class="field"><span class="label">Unidad Adscripción:</span> <span class="muted">${row.area || ''}</span></div>
                                    <div class="field"><span class="label">Cargo:</span> <span class="muted">${row.cargo || ''}</span></div>
                                </div>
                                <div class="info-right">
                                    <img src="${final_url}" class="photo" alt="Foto de ${row.nombres} ${row.apellidos}" />
                                    <div style="margin-top:10px">
                                        <img src="${selloImg}" alt="Sello" style="width:110px;height:100px;object-fit:contain;display:block;margin:6px auto;filter:brightness(0.8) contrast(1.2)" />
                                    </div>
                                    <div style="margin-top:8px">
                                        <img src="${qrSrc}" alt="QR" style="width:120px;height:120px;object-fit:contain;border:1px solid #e6eef6;border-radius:6px;display:block;margin:6px auto;background:#fff;padding:6px" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </body>
                </html>`;

        res.status(200).send(html);
    } catch (err) {
        console.error('Error getCredencialPage:', err);
        res.status(500).send('<h2>Error interno</h2>');
    } finally {
        client.release();
    }
};

// Guardar histórico de impresión de credencial
exports.saveCredentialPrint = async (req, res) => {
    const { cedula } = req.body;
    console.log(`[SAVE_CREDENTIAL_PRINT] Iniciando para cédula: ${cedula}`);
    const client = await pool.connect();
    const fs = require('fs');
    const path = require('path');

    try {
        await client.query('BEGIN');
        console.log('[SAVE_CREDENTIAL_PRINT] Transacción iniciada.');

        // Buscar datos del servidor
        console.log('[SAVE_CREDENTIAL_PRINT] Buscando datos del servidor...');
        const serverResult = await client.query(`
            SELECT s.cedula, s.nombres, s.apellidos, s.institucion, s.area, s.cargo, f.foto_url
            FROM vservidores s
            LEFT JOIN fotos_usuarios f ON f.usuario_id = s.id
            WHERE s.cedula = $1
        `, [cedula]);

        if (serverResult.rows.length === 0) {
            console.log('[SAVE_CREDENTIAL_PRINT] Servidor no encontrado.');
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Servidor no encontrado.' });
        }
        console.log('[SAVE_CREDENTIAL_PRINT] Servidor encontrado.');

        const servidor = serverResult.rows[0];

        // Leer la foto como bytea
        console.log('[SAVE_CREDENTIAL_PRINT] Leyendo foto...');
        let fotoBuffer = null;
        if (servidor.foto_url) {
            const nombreFoto = servidor.foto_url.replace(/\\/g, '/').split('/').pop();
            const uploadsDir = path.join(__dirname, '../uploads');
            let realPath = null;
            try {
                if (fs.existsSync(uploadsDir)) {
                    const files = fs.readdirSync(uploadsDir);
                    const fileMatch = files.find(f => f.toLowerCase() === nombreFoto.toLowerCase());
                    if (fileMatch) {
                        realPath = path.join(uploadsDir, fileMatch);
                    }
                }
            } catch (e) { }
            if (!realPath) realPath = path.join(uploadsDir, nombreFoto);

            if (fs.existsSync(realPath)) {
                fotoBuffer = fs.readFileSync(realPath);
                console.log('[SAVE_CREDENTIAL_PRINT] Foto leída desde:', realPath);
            }
        }

        if (!fotoBuffer) {
            // Si no hay foto, usar la imagen por defecto
            const defaultFotoPath = path.join(__dirname, '../img/no_person.png');
            if (fs.existsSync(defaultFotoPath)) {
                fotoBuffer = fs.readFileSync(defaultFotoPath);
                console.log('[SAVE_CREDENTIAL_PRINT] Usando foto por defecto.');
            }
        }

        if (!fotoBuffer) {
            console.log('[SAVE_CREDENTIAL_PRINT] No se pudo obtener la foto.');
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No se pudo obtener la foto del servidor.' });
        }
        console.log('[SAVE_CREDENTIAL_PRINT] Foto obtenida.');

        // Manejar reimpresión: si existe una entrada previa vigente y el servidor no está inactivo,
        // marcar la última entrada como anulada por reimpresión (motivo + fecha) y dejarla no vigente.
        console.log(`[SAVE_CREDENTIAL_PRINT] Verificando histórico previo para cédula: ${cedula}`);
        const lastHistRes = await client.query('SELECT id, vigente FROM historico WHERE cedula = $1 ORDER BY created_at DESC LIMIT 1', [cedula]);
        let last = null;
        if (lastHistRes.rows.length) {
            last = lastHistRes.rows[0];
            // Comprobar estado actual del servidor (activo/inactivo)
            let servidorActivoFlag = true;
            try {
                const servState = await client.query('SELECT activo FROM servidores WHERE cedula = $1 LIMIT 1', [cedula]);
                if (servState.rows.length && typeof servState.rows[0].activo !== 'undefined') servidorActivoFlag = servState.rows[0].activo;
            } catch (e) {
                console.warn('[SAVE_CREDENTIAL_PRINT] No se pudo obtener estado activo del servidor:', e && e.message ? e.message : e);
            }

            if (last && last.vigente && servidorActivoFlag) {
                console.log('[SAVE_CREDENTIAL_PRINT] Último historico vigente encontrado y servidor activo: anulando por reimpresión');
                // Anular la entrada anterior indicando que fue anulada por reimpresión
                await client.query(`UPDATE historico SET vigente = false, motivo_deshabilitado = COALESCE(motivo_deshabilitado, '') || $2, fecha_deshabilitado = NOW() WHERE id = $1`, [last.id, ' Anulado por Reimpresion']);
                // Asegurar que el resto de entradas queden no vigentes también
                await client.query('UPDATE historico SET vigente = false WHERE cedula = $1 AND id <> $2', [cedula, last.id]);
            } else {
                // No hay entrada vigente o el servidor está inactivo: marcar todo como no vigente
                console.log('[SAVE_CREDENTIAL_PRINT] No hay último vigente o servidor inactivo: marcando todo como no vigente');
                const updateResult = await client.query('UPDATE historico SET vigente = false WHERE cedula = $1', [cedula]);
                console.log(`[SAVE_CREDENTIAL_PRINT] Filas actualizadas: ${updateResult.rowCount}`);
            }
        } else {
            console.log('[SAVE_CREDENTIAL_PRINT] No hay historico previo para esta cédula');
        }

        // Asegurarse que las columnas opcionales existen (opcional)
        try {
            await client.query(`ALTER TABLE historico ADD COLUMN IF NOT EXISTS printed_by integer`);
            await client.query(`DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'historico' AND column_name = 'reimpreso_de' AND data_type <> 'uuid') THEN
                    ALTER TABLE historico DROP COLUMN reimpreso_de;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'historico' AND column_name = 'reimpreso_de') THEN
                    ALTER TABLE historico ADD COLUMN reimpreso_de uuid;
                END IF;
            END$$;`);
            console.log('[SAVE_CREDENTIAL_PRINT] Columnas printed_by y reimpreso_de verificadas/creadas.');
        } catch (e) {
            console.warn('No se pudo asegurar columnas opcionales en historico:', e.message);
        }

        // Insertar en la tabla historico incluyendo información de quién imprimió (si disponible)
        console.log(`[SAVE_CREDENTIAL_PRINT] Insertando nuevo registro para cédula: ${cedula}`);
        const printedBy = req.userId || req.body.printed_by || null;
        // Si anulamos un registro anterior, se utilizó last.id; captura como reimpreso_de
        const reimpresoDe = (typeof last !== 'undefined' && last && last.id) ? last.id : null;
        await client.query(`
            INSERT INTO historico (institucion, cedula, nombres, apellidos, unidad, cargo, foto, printed_by, reimpreso_de, vigente, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
        `, [
            servidor.institucion,
            servidor.cedula,
            servidor.nombres,
            servidor.apellidos,
            servidor.area,
            servidor.cargo,
            fotoBuffer,
            printedBy,
            reimpresoDe
        ]);
        console.log('[SAVE_CREDENTIAL_PRINT] Nuevo registro insertado con posible referencia reimpreso_de.');

        await client.query('COMMIT');
        console.log('[SAVE_CREDENTIAL_PRINT] Transacción completada (COMMIT).');

        res.status(200).json({
            message: 'Histórico de impresión guardado exitosamente.',
            cedula: servidor.cedula,
            nombres: servidor.nombres,
            apellidos: servidor.apellidos
        });
    } catch (err) {
        console.error('[SAVE_CREDENTIAL_PRINT] Error, revirtiendo transacción.', err && err.stack ? err.stack : err);
        await client.query('ROLLBACK');
        console.error('Error al guardar histórico de impresión:', err && err.stack ? err.stack : err);
        // Responder sin exponer detalles internos en producción
        res.status(500).json({ error: 'Error al guardar el histórico de impresión.' });
    } finally {
        console.log('[SAVE_CREDENTIAL_PRINT] Liberando cliente.');
        client.release();
    }
};
exports.seekServer = async (req, res) => {
    const { cedula } = req.params;
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT a.institucion_id, a.institucion, a.sede_id, a.sede, a.area_id, a.area, a.cedula, a.nombres, a.hora_voto, a.observaciones FROM vservidores a WHERE a.cedula = $1',
            [cedula]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Servidor no encontrado.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al buscar el servidor.' });
    } finally {
        client.release();
    }
};
exports.updateServer = async (req, res) => {
    const { cedula } = req.params;
    const { area_id, institucion_id, sede_id, nombres, apellidos, cargo_id, condicion } = req.body;
    const client = await pool.connect();
    const fs = require('fs');
    let fotoPath = req.file && req.file.path ? req.file.path : null;

    console.log('=== UPDATE SERVER DEBUG ===');
    console.log('Params:', req.params);
    console.log('Body:', req.body);
    console.log('File:', req.file);
    console.log('FotoPath:', fotoPath);

    try {
        console.log('SQL DEBUG: Iniciando transacción BEGIN');
        await client.query('BEGIN');

        // 1. Verificar si el servidor existe
        const queryExists = 'SELECT id FROM servidores WHERE cedula = $1';
        console.log('SQL DEBUG [existsRes]:', queryExists, 'params:', [cedula]);
        const existsRes = await client.query(queryExists, [cedula]);
        if (existsRes.rows.length === 0) {
            console.log('Cédula no encontrada:', cedula);
            console.log('SQL DEBUG: Ejecutando ROLLBACK por cédula no encontrada');
            await client.query('ROLLBACK');
            if (fotoPath) { try { fs.unlinkSync(fotoPath); } catch (e) { } }
            return res.status(404).json({ error: 'La cédula no existe.' });
        }

        const usuario_id = existsRes.rows[0].id;
        console.log('Usuario ID encontrado:', usuario_id);

        const updates = [];
        const values = [];

        // Helper para procesar IDs numéricos o null (FormData envía todo como string)
        const parseId = (val) => (val === '' || val === null || val === undefined || val === 'null' || val === 'undefined') ? null : parseInt(val);

        if (area_id !== undefined) {
            const val = parseId(area_id);
            updates.push(`area_id = $${values.length + 1}`);
            values.push(isNaN(val) ? null : val);
        }
        if (institucion_id !== undefined) {
            const val = parseId(institucion_id);
            updates.push(`institucion_id = $${values.length + 1}`);
            values.push(isNaN(val) ? null : val);
        }
        if (sede_id !== undefined) {
            const val = parseId(sede_id);
            updates.push(`sede_id = $${values.length + 1}`);
            values.push(isNaN(val) ? null : val);
        }
        if (cargo_id !== undefined) {
            const val = parseId(cargo_id);
            updates.push(`cargo_id = $${values.length + 1}`);
            values.push(isNaN(val) ? null : val);
        }
        if (nombres !== undefined) {
            updates.push(`nombres = $${values.length + 1}`);
            values.push(nombres.toUpperCase());
        }
        if (apellidos !== undefined) {
            updates.push(`apellidos = $${values.length + 1}`);
            values.push(apellidos.toUpperCase());
        }
        if (condicion !== undefined) {
            updates.push(`condicion = $${values.length + 1}`);
            values.push(condicion);
        }

        // 2. Actualizar tabla servidores si hay cambios
        if (updates.length > 0) {
            const query = `UPDATE servidores SET ${updates.join(', ')}, updated_at = NOW() WHERE cedula = $${values.length + 1}`;
            const queryValues = [...values, cedula];
            console.log('SQL DEBUG [updateServidores]:', query, 'params:', queryValues);
            await client.query(query, queryValues);
        } else {
            console.log('No hay cambios en campos de texto para servidores.');
        }

        // 3. Procesar foto si se subió una nueva
        if (fotoPath) {
            const foto_url = fotoPath.replace(/\\/g, '/');
            console.log('Actualizando foto para usuario_id:', usuario_id, 'nueva URL:', foto_url);

            // Buscar foto anterior
            const queryOldFoto = 'SELECT foto_url FROM fotos_usuarios WHERE usuario_id = $1';
            console.log('SQL DEBUG [oldFotoRes]:', queryOldFoto, 'params:', [usuario_id]);
            const oldFotoRes = await client.query(queryOldFoto, [usuario_id]);

            if (oldFotoRes.rows.length > 0) {
                const oldFoto = oldFotoRes.rows[0].foto_url;
                console.log('Foto anterior encontrada en DB:', oldFoto);
                if (oldFoto) {
                    const nombreOldFoto = oldFoto.replace(/\\/g, '/').split('/').pop();
                    const uploadsDir = path.join(__dirname, '../uploads');
                    let realOldPath = null;
                    try {
                        if (fs.existsSync(uploadsDir)) {
                            const files = fs.readdirSync(uploadsDir);
                            const fileMatch = files.find(f => f.toLowerCase() === nombreOldFoto.toLowerCase());
                            if (fileMatch) realOldPath = path.join(uploadsDir, fileMatch);
                        }
                    } catch (e) { console.error('Error buscando archivo antiguo:', e); }

                    if (!realOldPath) realOldPath = path.join(uploadsDir, nombreOldFoto);

                    console.log('Intentando eliminar archivo físico:', realOldPath);
                    if (fs.existsSync(realOldPath)) {
                        try {
                            fs.unlinkSync(realOldPath);
                            console.log('Foto anterior eliminada del disco.');
                        } catch (e) {
                            console.error('Error al eliminar foto anterior (posiblemente abierta por otro proceso):', e);
                        }
                    } else {
                        console.log('El archivo de foto anterior no existe en el disco.');
                    }
                }
                const queryUpdateFoto = 'UPDATE fotos_usuarios SET foto_url = $1 WHERE usuario_id = $2';
                console.log('SQL DEBUG [updateFoto]:', queryUpdateFoto, 'params:', [foto_url, usuario_id]);
                await client.query(queryUpdateFoto, [foto_url, usuario_id]);
            } else {
                const queryInsertFoto = 'INSERT INTO fotos_usuarios (usuario_id, foto_url) VALUES ($1, $2)';
                console.log('SQL DEBUG [insertFoto]:', queryInsertFoto, 'params:', [usuario_id, foto_url]);
                await client.query(queryInsertFoto, [usuario_id, foto_url]);
            }
        } else {
            console.log('No se subió nueva foto.');
        }

        await client.query('COMMIT');
        console.log('Transacción completada exitosamente.');
        res.status(200).json({ message: 'Servidor actualizado exitosamente.' });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('ERROR CRÍTICO en updateServer:', err);
        if (fotoPath) {
            try { fs.unlinkSync(fotoPath); console.log('Archivo temporal eliminado tras fallo.'); } catch (e) { console.error('Error eliminando archivo temporal tras fallo:', e); }
        }
        res.status(500).json({
            error: 'Error al actualizar el servidor.',
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    } finally {
        if (client) client.release();
    }
};
// Actualización masiva de la hora del voto de los servidores

exports.massUpdateServer = async (req, res) => {
    const { cedulas } = req.body;

    if (!cedulas || typeof cedulas !== 'string') {
        return res.status(400).json({ error: 'Se requiere el parámetro cedulas con múltiples cédulas separadas por espacios' });
    }

    const client = await pool.connect();
    try {
        // Procesar las cédulas
        const cedulasProcesadas = cedulas.split(/\s+/)
            .map(ced => ced.replace(/\D/g, ''))
            .filter(ced => ced.length > 0);

        const cedulasUnicas = [...new Set(cedulasProcesadas)];

        // Objetos para almacenar los detalles
        const resultado = {
            actualizadas: {
                cantidad: 0,
                cedulas: []
            },
            previamente_cargadas: {
                cantidad: 0,
                cedulas: []
            },
            rechazadas: {
                cantidad: 0,
                cedulas: []
            },
            total_procesadas: cedulasUnicas.length
        };

        for (const cedula of cedulasUnicas) {
            try {
                // Verificar si existe la cédula y su hora_voto
                const checkQuery = 'SELECT hora_voto FROM servidores WHERE cedula = $1';
                const checkResult = await client.query(checkQuery, [cedula]);

                if (checkResult.rows.length > 0) {
                    if (checkResult.rows[0].hora_voto === null) {
                        // Actualizar solo si hora_voto es NULL
                        const updateQuery = 'UPDATE servidores SET hora_voto = NOW(), updated_at = NOW() WHERE cedula = $1';
                        await client.query(updateQuery, [cedula]);
                        resultado.actualizadas.cantidad++;
                        resultado.actualizadas.cedulas.push(cedula);
                    } else {
                        resultado.previamente_cargadas.cantidad++;
                        resultado.previamente_cargadas.cedulas.push(cedula);
                    }
                } else {
                    resultado.rechazadas.cantidad++;
                    resultado.rechazadas.cedulas.push(cedula);
                }
            } catch (err) {
                console.error(`Error procesando cédula ${cedula}:`, err);
                resultado.rechazadas.cantidad++;
                resultado.rechazadas.cedulas.push(cedula);
            }
        }

        res.status(200).json({
            message: 'Proceso de actualización masiva completado.',
            ...resultado
        });
    } catch (err) {
        console.error('Error en massUpdateServer:', err);
        res.status(500).json({ error: 'Error en el proceso de actualización masiva' });
    } finally {
        client.release();
    }
}
// Listado de movilización de  adultos por estado
exports.elderState = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT estado,cantidad_personas as cant_estado,porcentaje_cantidad_personas,por_movilizar,porcentaje_por_movilizar,adultos_meta  FROM vmovilizacion_adultos_estados');
        // const result = await client.query('SELECT estado,cantidad_personas as cant_estado,  FROM vmovilizacion_adultos_estados');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los adultos.' });
    } finally {
        client.release();
    }
};
// Listado de movilización de servidores por estado
exports.serverPosition = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT id,cargo FROM cargos ORDER BY cargo');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los cargos.' });
    } finally {
        client.release();
    }
};
exports.elderHour = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT franja_horaria,cantidad,acumulado FROM vmovilizacion_adultos_horas');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los adultos.' });
    } finally {
        client.release();
    }
};
exports.elderHourState = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT estado_nombre, CASE WHEN "0" IS NULL THEN 0 ELSE "0"::integer END AS "00", CASE WHEN "1" IS NULL THEN 0 ELSE "1"::integer END AS "01", CASE WHEN "2" IS NULL THEN 0 ELSE "2"::integer END AS "02", CASE WHEN "3" IS NULL THEN 0 ELSE "3"::integer END AS "03", CASE WHEN "4" IS NULL THEN 0 ELSE "4"::integer END AS "04", CASE WHEN "5" IS NULL THEN 0 ELSE "5"::integer END AS "05", CASE WHEN "6" IS NULL THEN 0 ELSE "6"::integer END AS "06", CASE WHEN "7" IS NULL THEN 0 ELSE "7"::integer END AS "07", CASE WHEN "8" IS NULL THEN 0 ELSE "8"::integer END AS "08", CASE WHEN "9" IS NULL THEN 0 ELSE "9"::integer END AS "09", CASE WHEN "10" IS NULL THEN 0 ELSE "10"::integer END AS "10", CASE WHEN "11" IS NULL THEN 0 ELSE "11"::integer END AS "11", CASE WHEN "12" IS NULL THEN 0 ELSE "12"::integer END AS "12", CASE WHEN "13" IS NULL THEN 0 ELSE "13"::integer END AS "13", CASE WHEN "14" IS NULL THEN 0 ELSE "14"::integer END AS "14", CASE WHEN "15" IS NULL THEN 0 ELSE "15"::integer END AS "15", CASE WHEN "16" IS NULL THEN 0 ELSE "16"::integer END AS "16", CASE WHEN "17" IS NULL THEN 0 ELSE "17"::integer END AS "17", CASE WHEN "18" IS NULL THEN 0 ELSE "18"::integer END AS "18", CASE WHEN "19" IS NULL THEN 0 ELSE "19"::integer END AS "19", CASE WHEN "20" IS NULL THEN 0 ELSE "20"::integer END AS "20", CASE WHEN "21" IS NULL THEN 0 ELSE "21"::integer END AS "21", CASE WHEN "22" IS NULL THEN 0 ELSE "22"::integer END AS "22", CASE WHEN "23" IS NULL THEN 0 ELSE "23"::integer END AS "23" FROM vmovilizacion_hora_estado_adultos;');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar la movilización de adultos.' });
    } finally {
        client.release();
    }
};
exports.serverHourState = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT estado_nombre, CASE WHEN "0" IS NULL THEN 0 ELSE "0"::integer END AS "00", CASE WHEN "1" IS NULL THEN 0 ELSE "1"::integer END AS "01", CASE WHEN "2" IS NULL THEN 0 ELSE "2"::integer END AS "02", CASE WHEN "3" IS NULL THEN 0 ELSE "3"::integer END AS "03", CASE WHEN "4" IS NULL THEN 0 ELSE "4"::integer END AS "04", CASE WHEN "5" IS NULL THEN 0 ELSE "5"::integer END AS "05", CASE WHEN "6" IS NULL THEN 0 ELSE "6"::integer END AS "06", CASE WHEN "7" IS NULL THEN 0 ELSE "7"::integer END AS "07", CASE WHEN "8" IS NULL THEN 0 ELSE "8"::integer END AS "08", CASE WHEN "9" IS NULL THEN 0 ELSE "9"::integer END AS "09", CASE WHEN "10" IS NULL THEN 0 ELSE "10"::integer END AS "10", CASE WHEN "11" IS NULL THEN 0 ELSE "11"::integer END AS "11", CASE WHEN "12" IS NULL THEN 0 ELSE "12"::integer END AS "12", CASE WHEN "13" IS NULL THEN 0 ELSE "13"::integer END AS "13", CASE WHEN "14" IS NULL THEN 0 ELSE "14"::integer END AS "14", CASE WHEN "15" IS NULL THEN 0 ELSE "15"::integer END AS "15", CASE WHEN "16" IS NULL THEN 0 ELSE "16"::integer END AS "16", CASE WHEN "17" IS NULL THEN 0 ELSE "17"::integer END AS "17", CASE WHEN "18" IS NULL THEN 0 ELSE "18"::integer END AS "18", CASE WHEN "19" IS NULL THEN 0 ELSE "19"::integer END AS "19", CASE WHEN "20" IS NULL THEN 0 ELSE "20"::integer END AS "20", CASE WHEN "21" IS NULL THEN 0 ELSE "21"::integer END AS "21", CASE WHEN "22" IS NULL THEN 0 ELSE "22"::integer END AS "22", CASE WHEN "23" IS NULL THEN 0 ELSE "23"::integer END AS "23" FROM vmovilizacion_servidores_hora_estado;');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar la movilización de servidores.' });
    } finally {
        client.release();
    }
};

exports.elderTotals = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT movilizados,por_movilizar,meta FROM vtotal_adultos');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los adultos.' });
    } finally {
        client.release();
    }
}
exports.serverTotals = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT movilizados,por_movilizar,meta FROM vtotal_servidores');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los servidores.' });
    } finally {
        client.release();
    }
}
exports.serverInstitutionAreaTotals = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT institucion,area,movilizados,por_movilizar,total FROM vmovilizacion_servidorres_insitucion_area');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los servidores.' });
    } finally {
        client.release();
    }
}
exports.elderTotalState = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT estado,cantidad_adultos,meta FROM vcumplimiento_metas_adultos');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los adultos.' });
    } finally {
        client.release();
    }
}
// Consulta de cédulas por lote en renac_anc
exports.readRenac = async (req, res) => {
    // Verificar que se proporcionó el parámetro de cédulas
    if (!req.query.cedulas || typeof req.query.cedulas !== 'string') {
        return res.status(400).json({ error: 'Debe proporcionar un listado de cédulas separadas por espacios' });
    }

    const cedulas = req.query.cedulas.trim().split(/\s+/);
    if (cedulas.length === 0) {
        return res.status(400).json({ error: 'El listado de cédulas está vacío' });
    }

    const client = await pool.connect();
    try {
        // Consultar las cédulas en la base de datos
        const query = `
            SELECT cedula, fecha_nac 
            FROM renac_anc 
            WHERE cedula = ANY($1)
        `;

        const result = await client.query(query, [cedulas]);

        // Procesar los resultados
        const noEncontradas = [];
        const menores60 = [];
        const mayores60 = [];

        const encontradas = new Set(); // Para trackear qué cédulas se encontraron

        // Procesar cada registro encontrado
        for (const row of result.rows) {
            encontradas.add(row.cedula);

            // Parsear la fecha de nacimiento (formato YYMMDD)
            const fechaNacStr = row.fecha_nac;
            let year = parseInt(fechaNacStr.substring(0, 2), 10);
            const month = parseInt(fechaNacStr.substring(2, 4), 10) - 1; // Meses son 0-indexed
            const day = parseInt(fechaNacStr.substring(4, 6), 10);

            // Asumimos que años < 50 son 2000s, >=50 son 1900s
            year = year < 50 ? 2000 + year : 1900 + year;

            const fechaNac = new Date(year, month, day);
            const hoy = new Date();

            // Calcular edad
            let edad = hoy.getFullYear() - fechaNac.getFullYear();
            const mesActual = hoy.getMonth();
            const diaActual = hoy.getDate();

            // Ajustar si aún no ha cumplido años este año
            if (mesActual < month || (mesActual === month && diaActual < day)) {
                edad--;
            }

            // Clasificar la cédula
            if (edad >= 60) {
                mayores60.push({
                    cedula: row.cedula,
                    edad: edad,
                    fecha_nac: fechaNac.toISOString().split('T')[0] // Formato YYYY-MM-DD
                });
            } else {
                menores60.push({
                    cedula: row.cedula,
                    edad: edad,
                    fecha_nac: fechaNac.toISOString().split('T')[0]
                });
            }
        }

        // Encontrar cédulas no encontradas
        for (const cedula of cedulas) {
            if (!encontradas.has(cedula)) {
                noEncontradas.push(cedula);
            }
        }

        // Devolver los resultados
        res.status(200).json({
            no_encontradas: noEncontradas,
            menores_60: menores60,
            mayores_60: mayores60
        });

    } catch (err) {
        console.error('Error al procesar las cédulas:', err);
        res.status(500).json({ error: 'Error al procesar las cédulas' });
    } finally {
        client.release();
    }
};
// Listado de movilización de servidores por estado
exports.serveHour = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT franja_horaria,cantidad,acumulado FROM vmovilizacion_servidores_horas');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los servidores.' });
    } finally {
        client.release();
    }
};
exports.eldersInsert = async (req, res) => {
    const { cedulas } = req.body;

    if (!cedulas || typeof cedulas !== 'string') {
        return res.status(400).json({ error: 'Se requiere el parámetro cedulas con múltiples cédulas separadas por espacios' });
    }

    const client = await pool.connect();
    // try {
    // Procesar las cédulas
    const cedulasProcesadas = cedulas.split(/\s+/)
        .map(ced => ced.replace(/\D/g, ''))
        .filter(ced => ced.length > 0);

    const cedulasUnicas = [...new Set(cedulasProcesadas)];

    // Objetos para almacenar los detalles
    const resultado = {
        insertadas: {
            cantidad: 0,
            cedulas: []
        },
        previamente_existentes: {
            cantidad: 0,
            cedulas: []
        },
        rechazadas: {
            cantidad: 0,
            cedulas: []
        },
        edad_insuficiente: {
            cantidad: 0,
            cedulas: []
        },
        total_procesadas: cedulasUnicas.length
    };

    for (const cedula of cedulasUnicas) {
        try {
            // Verificar si la cédula ya existe en la tabla adultos
            const checkExistQuery = 'SELECT 1 FROM adultos WHERE cedula = $1';
            const checkExistResult = await client.query(checkExistQuery, [cedula]);

            if (checkExistResult.rows.length > 0) {
                resultado.previamente_existentes.cantidad++;
                resultado.previamente_existentes.cedulas.push(cedula);
                continue;
            }

            // Verificar la edad en renac_anc y obtener estado_id
            const checkAgeQuery = 'SELECT fecha_nac, estado_id FROM renac_anc WHERE cedula = $1';
            const checkAgeResult = await client.query(checkAgeQuery, [cedula]);

            if (checkAgeResult.rows.length === 0) {
                // No se encontró la cédula en renac_anc
                resultado.rechazadas.cantidad++;
                resultado.rechazadas.cedulas.push(cedula);
                continue;
            }

            const fechaNacStr = checkAgeResult.rows[0].fecha_nac;
            const estadoId = checkAgeResult.rows[0].estado_id;

            if (!fechaNacStr || fechaNacStr.length !== 8) {
                resultado.rechazadas.cantidad++;
                resultado.rechazadas.cedulas.push(cedula);
                continue;
            }

            // Convertir YYYYMMDD a Date
            const year = parseInt(fechaNacStr.substring(0, 4));
            const month = parseInt(fechaNacStr.substring(4, 6)) - 1; // Meses son 0-indexados
            const day = parseInt(fechaNacStr.substring(6, 8));

            const fechaNac = new Date(year, month, day);
            const hoy = new Date();

            // Calcular edad
            let edad = hoy.getFullYear() - fechaNac.getFullYear();
            const mes = hoy.getMonth() - fechaNac.getMonth();

            if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
                edad--;
            }

            if (edad < 60) {
                resultado.edad_insuficiente.cantidad++;
                resultado.edad_insuficiente.cedulas.push(cedula);
                continue;
            }

            // Obtener region_id desde la tabla estados
            let regionId = null;
            try {
                const getRegionQuery = 'SELECT region_id FROM estados WHERE estado_id = $1';
                const regionResult = await client.query(getRegionQuery, [estadoId]);

                if (regionResult.rows.length > 0) {
                    regionId = regionResult.rows[0].region_id;
                } else {
                    // Si no encontramos la región, rechazamos la cédula
                    throw new Error('No se encontró región para el estado_id');
                }
            } catch (err) {
                console.error(`Error obteniendo región para cédula ${cedula}:`, err);
                resultado.rechazadas.cantidad++;
                resultado.rechazadas.cedulas.push(cedula);
                continue;
            }

            // Insertar la cédula en la tabla adultos con estado_id y region_id
            const insertQuery = `
                    INSERT INTO adultos (cedula, region_id, estado_id, created_at) 
                    VALUES ($1, $2, $3, NOW())
                `;
            await client.query(insertQuery, [cedula, regionId, estadoId]);
            resultado.insertadas.cantidad++;
            resultado.insertadas.cedulas.push(cedula);

        } catch (err) {
            console.error(`Error procesando cédula ${cedula}:`, err);
            resultado.rechazadas.cantidad++;
            resultado.rechazadas.cedulas.push(cedula);
        }
    }

    res.status(200).json({
        message: 'Proceso de inserción de adultos mayores completado.',
        ...resultado
    });
    // } catch (err) {
    //     console.error('Error en eldersInsert:', err);
    //     res.status(500).json({ error: 'Error en el proceso de inserción de adultos mayores' });
    // } finally {
    client.release();
    // }
};
// estadisticas de los adultos mayores
exports.elderStatistics = async (req, res) => {
    const client = await pool.connect();
    try {
        // Consultar todas las vistas en paralelo para mejor rendimiento
        const [movilizacion, estados, horas, regiones] = await Promise.all([
            client.query('SELECT franja_horaria, region, estado, nac, cedula, nombre, fecha_nac, edad, sexo, hora_voto FROM vmovilizacion_adultos'),
            client.query('SELECT estado_id, estado, cantidad_personas FROM vmovilizacion_adultos_estados'),
            client.query('SELECT franja_horaria, cantidad, acumulado FROM vmovilizacion_adultos_horas'),
            client.query('SELECT id, region, cantidad_personas FROM vmovilizacion_adultos_regiones')
        ]);

        // Estructurar la respuesta
        const response = {
            movilizacion: movilizacion.rows,
            estados: estados.rows,
            horas: horas.rows,
            regiones: regiones.rows,
            metadata: {
                timestamp: new Date().toISOString(),
                totalMovilizacion: movilizacion.rows.length,
            }
        };

        res.status(200).json(response);
    } catch (err) {
        console.error('Error en elderStatistics:', err);
        res.status(500).json({
            error: 'Error al obtener las estadísticas de adultos mayores.',
            details: err.message
        });
    } finally {
        client.release();
    }
};
exports.serverStatistics = async (req, res) => {
    const client = await pool.connect();
    try {
        // Consultar todas las vistas en paralelo para mejor rendimiento
        const [movilizacion, servidores, horas, total, instituciones, sedes, areas] = await Promise.all([
            client.query('SELECT id,franja_horaria,institucion_id,institucion,sede_id,sede,area_id,area,cedula,nombres,hora_voto,observaciones from vmovilizacion_servidores '),
            client.query('SELECT id,institucion_id,institucion,sede_id,sede,area_id,area,abreviacion,cedula,nombres,hora_voto,observaciones from vservidores'),
            client.query('SELECT franja_horaria, cantidad, acumulado FROM vmovilizacion_servidores_horas'),
            client.query('SELECT movilizados,por_movilizar,total_registros FROM vtotal_servidores'),
            client.query('SELECT institucion_id,institucion,movilizados,total_registros FROM vmovilizacion_servidores_institucion'),
            client.query('SELECT sede_id,sede,movilizados,total_registros FROM vmovilizacion_servidores_sedes'),
            client.query('SELECT id,area,movilizados,total_registros FROM vmovilizacion_servidores_area')
        ]);

        // Estructurar la respuesta
        const response = {
            movilizacion: movilizacion.rows,
            servidores: servidores.rows,
            horas: horas.rows,
            total: total.rows,
            instituciones: instituciones.rows,
            sedes: sedes.rows,
            areas: areas.rows,
            metadata: {
                timestamp: new Date().toISOString(),
                totalMovilizacion: movilizacion.rows.length,
            }
        };

        res.status(200).json(response);
    } catch (err) {
        console.error('Error en serverStatistics:', err);
        res.status(500).json({
            error: 'Error al obtener las estadísticas de los servidores.',
            details: err.message
        });
    } finally {
        client.release();
    }
};

// Eliminar servidor (PATCH = borrado lógico / disable with reason, DELETE = borrado físico)
exports.deleteServer = async (req, res) => {
    const { cedula } = req.params;
    const client = await pool.connect();
    try {
        // Buscar el id del servidor por la cédula
        const result = await client.query('SELECT id, nombres, apellidos, institucion, area, cargo FROM vservidores WHERE cedula = $1', [cedula]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Servidor no encontrado.' });
        }
        const usuario_id = result.rows[0].id;

        // Si se trata de un PARCHE, realice una desactivación reversible específica para las credenciales:
        // - marcar el historial de credenciales como no vigente (carnet inactivo)
        // - solo marcar servidores.activo = false cuando reason === 'egreso' (worker left)
        if (req.method === 'PATCH') {
            let reasonRaw = req.body && req.body.reason ? req.body.reason : null;
            let reason = null
            try {
                if (reasonRaw && typeof reasonRaw === 'string') {
                    const s = reasonRaw.trim()
                    if ((s.startsWith('{') || s.startsWith('['))) {
                        const parsed = JSON.parse(s)
                        reason = parsed && (parsed.value || parsed.label) ? (parsed.value || parsed.label) : String(parsed)
                    } else {
                        reason = s
                    }
                } else if (reasonRaw && typeof reasonRaw === 'object') {
                    reason = reasonRaw.value || reasonRaw.label || JSON.stringify(reasonRaw)
                }
            } catch (e) {
                try { reason = String(reasonRaw) } catch (ee) { reason = null }
            }
            try {
                // Determinar los permisos de la persona que llama para aplicar la restricción solo a RRHH.
                try {
                    const permRes = await client.query(`
                        SELECT p.name AS permission_name FROM user_permissions up
                        JOIN permissions p ON up.permission_id = p.id
                        WHERE up.user_id = $1
                        UNION
                        SELECT p.name AS permission_name
                        FROM user_roles ur
                        JOIN role_permissions rp ON ur.role_id = rp.role_id
                        JOIN permissions p ON rp.permission_id = p.id
                        WHERE ur.user_id = $1
                    `, [req.userId]);
                    const callerPerms = permRes.rows.map(r => r.permission_name);
                    const isAdmin = callerPerms.includes('view_admin') || callerPerms.includes('view_admin1');
                    const isRRHH = callerPerms.includes('update_historico');
                    const isRRHHOnly = isRRHH && !isAdmin;
                    // Si la persona que llama solo utiliza RRHH, solo se permite el motivo 'egreso'.
                    if (isRRHHOnly) {
                        const normalizedReason = reason ? String(reason).toLowerCase().trim() : '';
                        if (normalizedReason !== 'egreso') {
                            return res.status(403).json({ error: "Permiso denegado: los usuarios de RRHH sólo pueden deshabilitar con motivo 'egreso'." });
                        }
                    }
                } catch (permErr) {
                    console.warn('No se pudieron obtener permisos del llamador para validación RRHH:', permErr && permErr.message ? permErr.message : permErr);
                    const normalizedReason = reason ? String(reason).toLowerCase().trim() : '';
                    if (normalizedReason !== 'egreso') {
                        return res.status(403).json({ error: "Permiso denegado: validación de permisos RRHH fallida; sólo se permite motivo 'egreso'." });
                    }
                }

                await client.query('BEGIN');

                // Asegúrese de que historico tenga columnas para almacenar el motivo y la marca de tiempo.
                try {
                    await client.query("ALTER TABLE historico ADD COLUMN IF NOT EXISTS motivo_deshabilitado text");
                    await client.query("ALTER TABLE historico ADD COLUMN IF NOT EXISTS fecha_deshabilitado timestamptz");
                    await client.query("ALTER TABLE historico ADD COLUMN IF NOT EXISTS disabled_by integer");
                } catch (e) {
                    console.warn('No se pudo asegurar columnas en historico:', e && e.message ? e.message : e);
                }

                // Marque las filas existentes vigentes históricas como no vigentes y registre el motivo + marca de tiempo.
                try {
                    await client.query(
                        'UPDATE historico SET vigente = false, motivo_deshabilitado = $1, fecha_deshabilitado = NOW(), disabled_by = $3 WHERE cedula = $2 AND vigente = true',
                        [reason, cedula, req.userId || null]
                    );
                } catch (e) {
                    console.warn('No se pudo actualizar historico al deshabilitar credencial:', e && e.message ? e.message : e);
                }

                // Si el motivo es 'egreso' (sin distinción de mayúsculas y minúsculas), marque también el servidor (trabajador) como inactivo.
                if (reason && String(reason).toLowerCase() === 'egreso') {
                    try {
                        await client.query('UPDATE servidores SET activo = false, updated_at = NOW() WHERE cedula = $1', [cedula]);
                    } catch (e) {
                        console.warn('No se pudo actualizar servidores.activo para egreso:', e && e.message ? e.message : e);
                    }
                }

                if (reason) {
                    try {
                        const colsRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'servidores'");
                        const cols = colsRes.rows.map(r => r.column_name.toLowerCase());
                        const candidates = ['motivo', 'razon', 'observaciones', 'motivo_deshabilitado', 'motivo_deshabilitado', 'motivo_deshabilitar'];
                        let colToUpdate = null;
                        for (const c of candidates) {
                            if (cols.includes(c)) { colToUpdate = c; break; }
                        }
                        if (colToUpdate) {
                            const q = `UPDATE servidores SET ${colToUpdate} = $1, updated_at = NOW() WHERE cedula = $2`;
                            await client.query(q, [reason, cedula]);
                        }
                    } catch (e) {
                        console.warn('No se pudo guardar motivo en servidores:', e && e.message ? e.message : e);
                    }
                }

                await client.query('COMMIT');
            } catch (err) {
                try { await client.query('ROLLBACK'); } catch (e) { }
                console.error('Error al deshabilitar credencial (PATCH):', err && err.message ? err.message : err);
                return res.status(500).json({ error: 'Error al deshabilitar la credencial.' });
            }

            return res.status(200).json({ message: 'Credencial deshabilitada (reversible).' });
        }

        // Buscar la foto asociada
        const fotoRes2 = await client.query('SELECT foto_url FROM fotos_usuarios WHERE usuario_id = $1', [usuario_id]);
        if (fotoRes2.rows.length > 0) {
            const foto_url = fotoRes2.rows[0].foto_url;
            if (foto_url) {
                const fs = require('fs');
                console.log('Intentando borrar foto:', foto_url);
                if (fs.existsSync(foto_url)) {
                    try { fs.unlinkSync(foto_url); console.log('Foto eliminada:', foto_url); } catch (e) { console.error('Error al borrar foto:', e); }
                } else {
                    console.log('No existe el archivo de foto:', foto_url);
                }
            }
        }
        // Eliminar la foto asociada en fotos_usuarios
        await client.query('DELETE FROM fotos_usuarios WHERE usuario_id = $1', [usuario_id]);
        // Eliminar el servidor
        await client.query('DELETE FROM servidores WHERE cedula = $1', [cedula]);
        res.status(200).json({ message: 'Servidor eliminado.' });
    } catch (err) {
        console.error('Error in deleteServer:', err && err.message ? err.message : err);
        res.status(500).json({ error: 'Error al eliminar el servidor.' });
    } finally {
        client.release();
    }
};

// Habilitar servidor (reversible)
exports.enableServer = async (req, res) => {
    const { cedula } = req.params;
    const { row_id } = req.query;
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT id FROM servidores WHERE cedula = $1', [cedula]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Servidor no encontrado.' });
        }
        await client.query('BEGIN');
        try {
            await client.query('UPDATE servidores SET activo = true, updated_at = NOW() WHERE cedula = $1', [cedula]);

            // Limpiar los campos de motivo en servidores
            try {
                const colsRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'servidores'");
                const cols = colsRes.rows.map(r => r.column_name.toLowerCase());
                const toClear = [];
                for (const c of ['motivo', 'razon', 'motivo_deshabilitado', 'motivo_deshabilitado', 'motivo_deshabilitar']) {
                    if (cols.includes(c)) toClear.push(`${c} = NULL`);
                }
                if (toClear.length > 0) {
                    await client.query(`UPDATE servidores SET ${toClear.join(', ')} WHERE cedula = $1`, [cedula]);
                }
            } catch (e) {
                console.warn('No se pudo limpiar motivos en tabla servidores:', e && e.message ? e.message : e);
            }

            // Asegúrese de que historico tenga columnas para almacenar el motivo y la marca de tiempo.
            try {
                await client.query("ALTER TABLE historico ADD COLUMN IF NOT EXISTS motivo_deshabilitado text");
                await client.query("ALTER TABLE historico ADD COLUMN IF NOT EXISTS fecha_deshabilitado timestamptz");
            } catch (e) {
                console.warn('No se pudo asegurar columnas en historico durante habilitar:', e && e.message ? e.message : e);
            }

            // Habilitar el registro histórico específico si se proporciona row_id, de lo contrario el más reciente
            try {
                if (row_id) {
                    await client.query(`
                        UPDATE historico SET vigente = true, motivo_deshabilitado = NULL, fecha_deshabilitado = NULL
                        WHERE id = $1 AND cedula = $2
                    `, [row_id, cedula]);
                } else {
                    await client.query(`
                        UPDATE historico SET vigente = true, motivo_deshabilitado = NULL, fecha_deshabilitado = NULL
                        WHERE id = (SELECT id FROM historico WHERE cedula = $1 ORDER BY created_at DESC LIMIT 1)
                    `, [cedula]);
                }
            } catch (e) {
                console.warn('No se pudo reactivar historico al habilitar servidor:', e && e.message ? e.message : e);
            }

            await client.query('COMMIT');
            return res.status(200).json({ message: 'Servidor habilitado (reversible).' });
        } catch (e) {
            try { await client.query('ROLLBACK'); } catch (err) { }
            throw e;
        }
    } catch (err) {
        console.error('Error in enableServer:', err && err.message ? err.message : err);
        res.status(500).json({ error: 'Error al habilitar el servidor.' });
    } finally {
        client.release();
    }
};

// Eliminar servidor (Borrado Físico)
exports.deleteServerPermanently = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado permanentemente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario permanentemente.' });
    } finally {
        client.release();
    }
};

// ================================
// Instituciones
// ================================
// Crear instituciones
exports.createInstitution = async (req, res) => {
    const { username, email, password } = req.body;

    // Validar el formato del password
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
        return res.status(400).json({ errors: passwordErrors });
    }

    const hashedPassword = await hashPassword(password);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Crear usuario
        const result = await client.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
            [username, email, hashedPassword]
        );
        const userId = result.rows[0].id;

        // Generar token de verificación
        const token = generateSecureToken();
        // Enviar correo de verificación
        const verificationLink = `https://intranet.minaamp.gob.ve/verify-email?token=${token}`;
        await sendEmail(email, 'Verifica tu correo', `Haz clic en el siguiente enlace para verificar tu correo: ${verificationLink}`);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Usuario creado exitosamente. Se ha enviado un correo de verificación.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al crear el usuario.' });
    } finally {
        client.release();
    }
};
// Listar institucion
exports.listInstitutions = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT a.id,a.institucion FROM instituciones a  ORDER BY a.id');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar las instituciones.' });
    } finally {
        client.release();
    }
};

// Actualizar institucion
exports.updateInstitution = async (req, res) => {
    const { userId } = req.params;
    const { username, email } = req.body;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET username = $1, email = $2, updated_at = NOW() WHERE id = $3', [username, email, userId]);
        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar institucion (Borrado Lógico)
exports.deleteInstitution = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado lógicamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar servidor (Borrado Físico)
exports.deleteInstitutionPermanently = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado permanentemente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario permanentemente.' });
    } finally {
        client.release();
    }
};

// ================================
// Sedes
// ================================
// Crear sede
exports.createHeadquarter = async (req, res) => {
    const { username, email, password } = req.body;

    // Validar el formato del password
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
        return res.status(400).json({ errors: passwordErrors });
    }

    const hashedPassword = await hashPassword(password);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Crear usuario
        const result = await client.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
            [username, email, hashedPassword]
        );
        const userId = result.rows[0].id;

        // Generar token de verificación
        const token = generateSecureToken();
        // Enviar correo de verificación
        const verificationLink = `https://intranet.minaamp.gob.ve/verify-email?token=${token}`;
        await sendEmail(email, 'Verifica tu correo', `Haz clic en el siguiente enlace para verificar tu correo: ${verificationLink}`);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Usuario creado exitosamente. Se ha enviado un correo de verificación.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al crear el usuario.' });
    } finally {
        client.release();
    }
};
// Listar Sedes
exports.listHeadquarters = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT a.id,a.sede FROM sedes a WHERE a.deleted_at IS NULL ORDER BY a.id ASC');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar las sedes.' });
    } finally {
        client.release();
    }
};

// Actualizar sede
exports.updateHeadquarter = async (req, res) => {
    const { userId } = req.params;
    const { username, email } = req.body;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET username = $1, email = $2, updated_at = NOW() WHERE id = $3', [username, email, userId]);
        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar sede (Borrado Lógico)
exports.deleteHeadquarter = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado lógicamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar sede (Borrado Físico)
exports.deleteHeadquarterPermanently = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado permanentemente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario permanentemente.' });
    } finally {
        client.release();
    }
};

// ================================
// Areas
// ================================
// Crear area
exports.createArea = async (req, res) => {
    const { username, email, password } = req.body;

    // Validar el formato del password
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
        return res.status(400).json({ errors: passwordErrors });
    }

    const hashedPassword = await hashPassword(password);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Crear usuario
        const result = await client.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
            [username, email, hashedPassword]
        );
        const userId = result.rows[0].id;

        // Generar token de verificación
        const token = generateSecureToken();
        // Enviar correo de verificación
        const verificationLink = `https://intranet.minaamp.gob.ve/verify-email?token=${token}`;
        await sendEmail(email, 'Verifica tu correo', `Haz clic en el siguiente enlace para verificar tu correo: ${verificationLink}`);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Usuario creado exitosamente. Se ha enviado un correo de verificación.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al crear el usuario.' });
    } finally {
        client.release();
    }
};
// Listar areas
exports.listAreas = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT id AS area_id,a.area FROM areas a  WHERE a.deleted_at IS NULL ORDER BY a.id ASC');
        // const result = await client.query('SELECT a.institucion_id,b.institucion,a.sede_id,c.sede,a.id AS area_id,a.area FROM areas a LEFT JOIN instituciones b ON b.id = a.institucion_id LEFT JOIN sedes c ON c.id = a.sede_id WHERE a.deleted_at IS NULL ORDER BY a.institucion_id,a.sede_id,a.id ASC');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar las áreas.' });
    } finally {
        client.release();
    }
};

// Actualizar area
exports.updateArea = async (req, res) => {
    const { userId } = req.params;
    const { username, email } = req.body;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET username = $1, email = $2, updated_at = NOW() WHERE id = $3', [username, email, userId]);
        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar area (Borrado Lógico)
exports.deleteArea = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado lógicamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar area (Borrado Físico)
exports.deleteAreaPermanently = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado permanentemente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario permanentemente.' });
    } finally {
        client.release();
    }
};


// ================================
// Usuarios
// ================================

// Crear Usuario
exports.createUser = async (req, res) => {
    const { first_name, last_name, cedula, email, password, roles } = req.body;

    console.log('createUser payload roles:', roles);

    // Validar el formato del password
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
        return res.status(400).json({ errors: passwordErrors });
    }

    const hashedPassword = await hashPassword(password);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verifique si hay duplicados antes de intentar insertarlos para obtener mensajes de error más claros.
        try {
            const dupQuery = await client.query(
                'SELECT id, email, cedula FROM users WHERE (email = $1) OR (cedula IS NOT NULL AND cedula = $2) LIMIT 1',
                [email, cedula || null]
            );
            if (dupQuery.rows.length) {
                const row = dupQuery.rows[0];
                if (row.email === email) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({ error: 'El correo ya está registrado.', field: 'email' });
                }
                if (cedula && row.cedula == cedula) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({ error: 'La cédula ya está registrada.', field: 'cedula' });
                }
            }
        } catch (e) {
            console.warn('Error checking duplicates in createUser:', e && e.message);
        }

        // Asegúrese de que exista users.created_by para que podamos registrar quién creó el usuario.
        try {
            await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by integer");
        } catch (e) {
            console.warn('Could not ensure users.created_by column:', e && e.message);
        }

        // Crear usuario con campos completos
        const creatorId = req.userId || null;
        const result = await client.query(
            `INSERT INTO users (first_name, last_name, cedula, email, password_hash, is_email_verified, status, created_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id, created_at`,
            [first_name || null, last_name || null, cedula || null, email, hashedPassword, true, 'active', creatorId]
        );
        const userId = result.rows[0].id;
        const createdAt = result.rows[0].created_at;

        // Asignar roles si se enviaron
        if (Array.isArray(roles) && roles.length > 0) {
            for (const roleItem of roles) {
                let roleId = null;
                if (typeof roleItem === 'number') {
                    roleId = roleItem;
                } else if (typeof roleItem === 'string') {
                    // Si es una cadena numérica, conviértala a número.
                    if (/^\d+$/.test(roleItem)) {
                        roleId = parseInt(roleItem, 10);
                    } else {
                        // Intentar obtener por nombre
                        const r = await client.query('SELECT id FROM roles WHERE name = $1', [roleItem]);
                        if (r.rows.length) roleId = r.rows[0].id;
                    }
                } else if (roleItem && (roleItem.id !== undefined)) {
                    // roleItem puede ser un objeto { id: '2' } o { id: 2 }
                    roleId = Number(roleItem.id);
                }

                if (roleId) {
                    const exists = await client.query('SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);
                    if (!exists.rows.length) {
                        await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
                    }
                }
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Usuario creado exitosamente.', userId, created_at: createdAt });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error createUser:', err && err.message ? err.message : err);
        if (err && err.code === '23505') {
            const detail = err.detail || 'Conflict - duplicate value';
            return res.status(409).json({ error: 'Conflicto al crear usuario.', details: detail });
        }
        res.status(500).json({ error: 'Error al crear el usuario.', details: err && err.message });
    } finally {
        client.release();
    }
};

// Verificar Correo Electrónico
exports.verifyEmail = async (req, res) => {
    const { token } = req.body;
    const client = await pool.connect();

    try {
        const result = await client.query('SELECT user_id, expires_at FROM email_verifications WHERE token = $1', [token]);
        if (!result.rows.length || new Date(result.rows[0].expires_at) < new Date()) {
            return res.status(400).json({ error: 'Token inválido o expirado.' });
        }

        await client.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [result.rows[0].user_id]);
        await client.query('DELETE FROM email_verifications WHERE token = $1', [token]);

        res.status(200).json({ message: 'Correo verificado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al verificar el correo.' });
    } finally {
        client.release();
    }
};

// Cambiar Contraseña
exports.changePassword = async (req, res) => {
    const { userId } = req; // Obtenido del middleware de autenticación
    const { oldPassword, newPassword } = req.body;

    // Validar el formato del nuevo password
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
        return res.status(400).json({ errors: passwordErrors });
    }

    const client = await pool.connect();
    try {
        // Verificar la contraseña actual
        const result = await client.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        const isMatch = await comparePassword(oldPassword, result.rows[0].password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
        }

        // Hashear y actualizar la nueva contraseña
        const hashedPassword = await hashPassword(newPassword);
        await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);

        res.status(200).json({ message: 'Contraseña cambiada exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al cambiar la contraseña.' });
    } finally {
        client.release();
    }
};

// Listar Usuarios
exports.listUsers = async (req, res) => {
    const client = await pool.connect();
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const perPage = parseInt(req.query.per_page, 10) || 10;
        const q = (req.query.q || '').trim();
        const offset = (page - 1) * perPage;

        // Construir cláusula where para búsqueda
        // Algunas implementaciones pueden no tener una columna `deleted_at` en users, verifique y adapte
        let where = '';
        const params = [];
        try {
            const colCheck = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'deleted_at'");
            if (colCheck.rows.length) {
                where = 'WHERE u.deleted_at IS NULL';
            } else {
                where = 'WHERE 1=1';
            }
        } catch (e) {
            console.warn('Could not check users.deleted_at column, defaulting to safe WHERE.', e && e.message);
            where = 'WHERE u.deleted_at IS NULL';
        }
        if (q) {
            params.push(`%${q}%`);
            params.push(`%${q}%`);
            params.push(`%${q}%`);
            params.push(`%${q}%`);
            where += ` AND (u.first_name ILIKE $${params.length - 3} OR u.last_name ILIKE $${params.length - 2} OR u.email ILIKE $${params.length - 1} OR CAST(u.cedula AS TEXT) ILIKE $${params.length})`;
        }

        // Total count
        const countQuery = `SELECT COUNT(*) as total FROM users u ${where}`;
        const countRes = await client.query(countQuery, params);
        const total = parseInt(countRes.rows[0].total, 10) || 0;

        // Consulta principal con paginación
        // Reutilizamos parámetros y añadimos desplazamiento y límite.

        const mainParams = params.slice();
        mainParams.push(perPage);
        mainParams.push(offset);

        // Es posible que algunas implementaciones no tengan una columna `created_by` en `users`.
        // Verifique y adapte la consulta en consecuencia para evitar errores de SQL.
        let createdBySelect = '';
        let createdByJoin = '';
        let createdByGroup = '';
        try {
            const cbRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_by'");
            if (cbRes.rows.length) {
                createdBySelect = 'uc.id as created_by_id, uc.first_name as created_by_first, uc.last_name as created_by_last,';
                createdByJoin = 'LEFT JOIN users uc ON u.created_by = uc.id';
                createdByGroup = ', uc.id, uc.first_name, uc.last_name';
            }
        } catch (e) {
            console.warn('Could not check users.created_by column, continuing without created_by join.', e && e.message);
        }

        const mainQuery = `
            SELECT u.id, u.first_name, u.last_name, u.cedula, u.email, u.is_email_verified, u.status, u.session_timeout_min, u.created_at,
                   ${createdBySelect}
                   COALESCE(json_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL), '[]') AS roles
            FROM users u
            ${createdByJoin}
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON r.id = ur.role_id
            ${where}
            GROUP BY u.id${createdByGroup}
            ORDER BY u.created_at DESC
            LIMIT $${mainParams.length - 1} OFFSET $${mainParams.length}
        `;

        console.log('listUsers mainQuery:', mainQuery);
        console.log('listUsers mainParams:', mainParams);
        const result = await client.query(mainQuery, mainParams);
        const rows = result.rows.map(r => ({ ...r, roles: r.roles || [], created_at: r.created_at }));

        res.status(200).json({ total, users: rows });
    } catch (err) {
        console.error('Error listUsers:', err, err && err.stack);
        res.status(500).json({ error: 'Error al listar los usuarios.' });
    } finally {
        client.release();
    }
};

// Actualizar Usuario
exports.updateUser = async (req, res) => {
    const { userId } = req.params;
    const { first_name, last_name, cedula, email, status, roles } = req.body;
    const client = await pool.connect();
    try {
        console.log('updateUser called for id=', userId, 'payload=', req.body);
        await client.query('BEGIN');

        const curRes = await client.query('SELECT status FROM users WHERE id = $1', [userId]);
        const prevStatus = curRes.rows.length ? curRes.rows[0].status : null;

        const updates = [];
        const values = [];
        if (first_name !== undefined) { updates.push(`first_name = $${values.length + 1}`); values.push(first_name); }
        if (last_name !== undefined) { updates.push(`last_name = $${values.length + 1}`); values.push(last_name); }
        if (cedula !== undefined) { updates.push(`cedula = $${values.length + 1}`); values.push(cedula); }
        if (email !== undefined) { updates.push(`email = $${values.length + 1}`); values.push(email); }
        if (status !== undefined) { updates.push(`status = $${values.length + 1}`); values.push(status); }

        if (updates.length > 0) {
            const query = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length + 1}`;
            const queryValues = [...values, userId];
            console.log('updateUser SQL:', query, 'values=', queryValues);
            await client.query(query, queryValues);
        }

        // Manejar roles: si se envía array, reemplazar asignaciones
        if (Array.isArray(roles)) {
            try {
                await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
                for (const roleItem of roles) {
                    let roleId = null;
                    if (typeof roleItem === 'number') roleId = roleItem;
                    else if (typeof roleItem === 'string') {
                        if (/^\d+$/.test(roleItem)) {
                            roleId = parseInt(roleItem, 10);
                        } else {
                            const r = await client.query('SELECT id FROM roles WHERE name = $1', [roleItem]);
                            if (r.rows.length) roleId = r.rows[0].id;
                        }
                    } else if (roleItem && (roleItem.id !== undefined)) {
                        roleId = Number(roleItem.id);
                    }

                    if (roleId) {
                        try {
                            await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
                        } catch (e) {
                            console.warn('Failed inserting user_role', { userId, roleId, err: e && e.message });
                        }
                    }
                }
            } catch (e) {
                console.error('Error handling roles for updateUser:', e && e.message ? e.message : e);
                throw e;
            }
        }

        await client.query('COMMIT');

        // Si el estado cambió a un valor inactivo, revocar sesiones y forzar cierre de sesión
        if (typeof status !== 'undefined' && status !== prevStatus && status !== 'active') {
            try {
                const sessRes = await client.query('SELECT token, expires_at FROM sessions WHERE user_id = $1 AND is_revoked IS NOT TRUE', [userId]);
                for (const s of sessRes.rows) {
                    const expiresAt = s.expires_at || new Date(Date.now() + 24 * 3600 * 1000);
                    await client.query('INSERT INTO blacklisted_tokens (token, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING', [s.token, expiresAt]);
                }
                await client.query('UPDATE sessions SET is_revoked = TRUE WHERE user_id = $1', [userId]);
                await client.query("UPDATE login_logs SET logout_type = $1, logout_timestamp = NOW() WHERE user_id = $2 AND logout_type IS NULL", ['force_logout', userId]);
            } catch (e) {
                console.warn('Failed to revoke sessions on status change for user', userId, e && e.message);
            }
        }
        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updateUser:', err && err.message ? err.message : err);
        if (err && err.code === '23505') {
            const detail = err.detail || 'Conflict - duplicate value';
            return res.status(409).json({ error: 'Conflicto al actualizar usuario.', details: detail });
        }
        res.status(500).json({ error: 'Error al actualizar el usuario.', details: err && err.message });
    } finally {
        client.release();
    }
};

// Eliminar Usuario (Borrado Lógico)
exports.deleteUser = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado lógicamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario.' });
    } finally {
        client.release();
    }
};

// Eliminar Usuario (Borrado Físico)
exports.deleteUserPermanently = async (req, res) => {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        res.status(200).json({ message: 'Usuario eliminado permanentemente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el usuario permanentemente.' });
    } finally {
        client.release();
    }
};

// ================================
// Roles
// ================================

// Crear Rol
exports.createRole = async (req, res) => {
    const { name, description } = req.body;
    console.log("name: ", name);
    console.log("description: ", description);
    const client = await pool.connect();
    try {
        const result = await client.query(
            'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id',
            [name, description]
        );
        res.status(201).json({ message: 'Rol creado exitosamente.', roleId: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear el rol.' });
    } finally {
        client.release();
    }
};
// Listar Roles
exports.listRoles = async (req, res) => {
    const client = await pool.connect();
    try {
        // Es posible que algunas implementaciones no tengan una columna 'deleted_at' en 'roles'.
        // Seleccione todos los roles de forma segura
        const result = await client.query('SELECT id, name, description FROM roles');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error listRoles:', err);
        res.status(500).json({ error: 'Error al listar los roles.', details: err.message });
    } finally {
        client.release();
    }
};

// Actualizar Rol
exports.updateRole = async (req, res) => {
    const { roleId } = req.params;
    const { name, description } = req.body;

    const client = await pool.connect();
    try {
        await client.query('UPDATE roles SET name = $1, description = $2, updated_at = NOW() WHERE id = $3', [name, description, roleId]);
        res.status(200).json({ message: 'Rol actualizado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el rol.' });
    } finally {
        client.release();
    }
};

// Eliminar Rol (Borrado Lógico)
exports.deleteRole = async (req, res) => {
    const { roleId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('UPDATE roles SET deleted_at = NOW() WHERE id = $1', [roleId]);
        res.status(200).json({ message: 'Rol eliminado lógicamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el rol.' });
    } finally {
        client.release();
    }
};

// Eliminar Rol (Borrado Físico)
exports.deleteRolePermanently = async (req, res) => {
    const { roleId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM roles WHERE id = $1', [roleId]);
        res.status(200).json({ message: 'Rol eliminado permanentemente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el rol permanentemente.' });
    } finally {
        client.release();
    }
};

// ================================
// Permisos
// ================================

// Crear Permiso
exports.createPermission = async (req, res) => {
    const { name, description } = req.body;

    const client = await pool.connect();
    try {
        const result = await client.query(
            'INSERT INTO permissions (name, description) VALUES ($1, $2) RETURNING id',
            [name, description]
        );
        res.status(201).json({ message: 'Permiso creado exitosamente.', permissionId: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear el permiso.' });
    } finally {
        client.release();
    }
};

// Listar Permisos
exports.listPermissions = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT id, name, description FROM permissions WHERE deleted_at IS NULL');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar los permisos.' });
    } finally {
        client.release();
    }
};

// Actualizar Permiso
exports.updatePermission = async (req, res) => {
    const { permissionId } = req.params;
    const { name, description } = req.body;

    const client = await pool.connect();
    try {
        await client.query('UPDATE permissions SET name = $1, description = $2, updated_at = NOW() WHERE id = $3', [name, description, permissionId]);
        res.status(200).json({ message: 'Permiso actualizado exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el permiso.' });
    } finally {
        client.release();
    }
};

// Eliminar Permiso (Borrado Lógico)
exports.deletePermission = async (req, res) => {
    const { permissionId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('UPDATE permissions SET deleted_at = NOW() WHERE id = $1', [permissionId]);
        res.status(200).json({ message: 'Permiso eliminado lógicamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el permiso.' });
    } finally {
        client.release();
    }
};

// Eliminar Permiso (Borrado Físico)
exports.deletePermissionPermanently = async (req, res) => {
    const { permissionId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM permissions WHERE id = $1', [permissionId]);
        res.status(200).json({ message: 'Permiso eliminado permanentemente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el permiso permanentemente.' });
    } finally {
        client.release();
    }
};

// ================================
// Asignaciones
// ================================

// Asignar Rol a Usuario
exports.assignRoleToUser = async (req, res) => {
    const { userId, roleId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
        res.status(200).json({ message: 'Rol asignado al usuario exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al asignar el rol al usuario.' });
    } finally {
        client.release();
    }
};

// Remover Rol de Usuario
exports.removeRoleFromUser = async (req, res) => {
    const { userId, roleId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);
        res.status(200).json({ message: 'Rol removido del usuario exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al remover el rol del usuario.' });
    } finally {
        client.release();
    }
};

// Asignar Permiso a Rol
exports.assignPermissionToRole = async (req, res) => {
    const { roleId, permissionId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [roleId, permissionId]);
        res.status(200).json({ message: 'Permiso asignado al rol exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al asignar el permiso al rol.' });
    } finally {
        client.release();
    }
};

// Remover Permiso de Rol
exports.removePermissionFromRole = async (req, res) => {
    const { roleId, permissionId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [roleId, permissionId]);
        res.status(200).json({ message: 'Permiso removido del rol exitosamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al remover el permiso del rol.' });
    } finally {
        client.release();
    }
};

// ================================
// Login y Logout
// ================================

exports.prueba = async (req, res) => {
    res.status(200).json({ message: 'Prueba exitosa.' });
}
// Login
exports.login = async (req, res) => {
    const { username, password } = req.body;
    const ip = req.ip; // Dirección IP del cliente

    const client = await pool.connect();
    try {
        /*
                console.log('🔍 Verificando sesiones activas para:', username);
                // Verificar si el usuario ya tiene una sesión activa
                const activeSession = await client.query(
                    'SELECT * FROM login_logs WHERE username = $1 AND logout_type IS NULL',
                    [username]
                );
        
                if (activeSession.rows.length > 0) {
                    console.log('🔒 Sesión ya activa para:', username);
                    return res.status(403).json({ error: 'La sesión del usuario ya está abierta, no se puede volver a abrir.' });
                }
        */
        console.log('👤 Buscando usuario:', username);
        // Buscar al usuario por nombre de usuario
        const result = await client.query(
            'SELECT id, password_hash, status, failed_login_attempts, last_failed_login FROM users WHERE email = $1',
            [username]
        );

        if (!result.rows.length) {
            console.log('❌ Usuario no encontrado:', username);
            await client.query(
                'INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)',
                [username, ip, 'failed']
            );
            return res.status(400).json({ error: 'Nombre de usuario o contraseña incorrectos.' });
        }

        const user = result.rows[0];

        // Bloquear login si el estado no es 'active'
        if (user.status !== 'active') {
            console.log('🚫 Intento de login con estado no activo:', username, user.status);
            await client.query(
                'INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)',
                [username, ip, 'failed']
            );
            // Mensajes claros según estado
            if (user.status === 'deleted') {
                return res.status(403).json({ error: 'El usuario ha sido dado de baja.' });
            }
            if (user.status === 'suspended') {
                return res.status(403).json({ error: 'El usuario está suspendido.' });
            }
            if (user.status === 'disabled') {
                return res.status(403).json({ error: 'Su cuenta fue suspendida.' });
            }
            // Para otros estados como 'inactive', 'deactivated' u otros
            return res.status(403).json({ error: 'El usuario no está activo. Contacte al administrador.' });
        }
        /*
                // Verificar si el usuario tiene más de 3 intentos fallidos
                if (user.failed_login_attempts >= 3 && new Date(user.last_failed_login) > new Date(Date.now() - 15 * 60 * 1000)) {
                    console.log('⏰ Usuario bloqueado por múltiples intentos fallidos:', username);
                    await client.query(
                        'UPDATE users SET status = $1 WHERE id = $2',
                        ['suspended', user.id]
                    );
                    await client.query(
                        'INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)',
                        [username, ip, 'blocked']
                    );
                    return res.status(403).json({ error: 'El usuario ha sido bloqueado debido a múltiples intentos fallidos.' });
                }
        */
        console.log('🔐 Comparando contraseña...');
        // Comparar la contraseña
        const isMatch = await comparePassword(password, user.password_hash);

        /*        
                if (!isMatch) {
                    console.log('⚠️ Contraseña incorrecta:', username);
                    await client.query(
                        'UPDATE users SET failed_login_attempts = failed_login_attempts + 1, last_failed_login = NOW() WHERE id = $1',
                        [user.id]
                    );
        
                    await client.query(
                        'INSERT INTO login_logs (username, ip_address, login_status) VALUES ($1, $2, $3)',
                        [username, ip, 'failed']
                    );
                    return res.status(400).json({ error: 'Nombre de usuario o contraseña incorrectos.' });
                }
                console.log('🔄 Reiniciando contador de intentos fallidos...');
                // Reiniciar el contador de intentos fallidos
                await client.query(
                    'UPDATE users SET failed_login_attempts = 0, last_failed_login = NULL WHERE id = $1',
                    [user.id]
                );
        */
        console.log('⏳ Obteniendo duración de sesión...');
        // Generar token JWT con vigencia de 120 minutos
        const token = await generateToken(user.id);

        // Obtener duración en minutos
        const timeoutMin = await getSessionTimeout(user.id);
        console.log('⏰ Duración de sesión:', timeoutMin, 'minutos');

        console.log('🔑 Generando token JWT...');
        await client.query(
            "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, NOW() + $3 * INTERVAL '1 minute')",
            [user.id, token, parseInt(timeoutMin, 10)]
        );
        ///////////////////
        // Obtener permisos del usuario
        console.log('🔍 Obteniendo permisos del usuario...');
        const permissionsQuery = `
            SELECT p.name, p.description,p.action 
            FROM user_permissions up
            JOIN permissions p ON up.permission_id = p.id
            WHERE up.user_id = $1
            UNION
            SELECT p.name, p.description,p.action 
            FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = $1
            AND NOT EXISTS (
                SELECT 1 FROM user_permissions WHERE user_id = $1
            )
        `;

        const permissionsResult = await client.query(permissionsQuery, [user.id]);
        const permissions = permissionsResult.rows;
        ///////////////////
        // Registrar ingreso exitoso en la auditoría
        await client.query(
            'INSERT INTO login_logs (user_id, username, ip_address, login_status, session_token) VALUES ($1, $2, $3, $4, $5)',
            [user.id, username, ip, 'success', token]
        );
        console.log('✅ Registrando login exitoso...');
        res.status(200).json({ success: true, message: 'Inicio de sesión exitoso.', token, permissions });
    } catch (err) {
        console.error('❌ Error en login:', err && err.message ? err.message : err);
        console.error('🔍 Detalles del error:', err && err.stack ? err.stack : 'no stack');
        res.status(500).json({ error: 'Error interno en login.' });
    } finally {
        client.release();
    }
};

// Logout
exports.logout = async (req, res) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
        return res.status(400).json({ error: 'No se proporcionó un token.' });
    }

    const decoded = jwt.decode(token);
    const userId = decoded.userId;

    const client = await pool.connect();
    try {
        // Marcar la sesión como cerrada por logout
        await client.query(
            'UPDATE login_logs SET logout_type = $1, logout_timestamp = NOW() WHERE session_token = $2',
            ['logout', token]
        );

        // Agregar el token a la lista negra
        const expiresAt = new Date(decoded.exp * 1000);
        await client.query('INSERT INTO blacklisted_tokens (token, expires_at) VALUES ($1, $2)', [token, expiresAt]);

        res.status(200).json({ message: 'Cierre de sesión exitoso.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al cerrar sesión.' });
    } finally {
        client.release();
    }
};
///////////////
exports.forceLogout = async (req, res) => {
    const userId = req.body.userId;
    const client = await pool.connect();
    try {
        await client.query(
            'UPDATE login_logs SET logout_type = $1, logout_timestamp = NOW() WHERE user_id = $2',
            ['force logout', userId]
        );
        res.status(200).json({ message: 'Cierre forzoso de sesión exitoso.' });
    } catch (err) {
        res.status(500).json({ error: 'Error al cerrar sesión.' });
    } finally {
        client.release();
    }
};
///////////////
////////////MANTENEDORES/////////////////
// ================================
// Revistas
// ================================

// Insertarr revista
exports.insertRevista = async (req, res) => {
    const insertFields = req.body; // Campos a insertar

    // Lista de columnas que deben estar en minúsculas
    const columnasMinusculas = ['correo_revista', 'correo_editor', 'url'];

    // Convertir cadenas a mayúsculas o minúsculas según corresponda
    for (const key in insertFields) {
        if (typeof insertFields[key] === 'string') {
            if (columnasMinusculas.includes(key)) {
                // Forzar a minúsculas para columnas específicas
                insertFields[key] = insertFields[key].toLowerCase();
            } else {
                // Convertir a mayúsculas para el resto de las columnas
                insertFields[key] = insertFields[key].toUpperCase();
            }
        }
    }

    const client = await pool.connect();
    try {
        // Construir la consulta dinámicamente
        const keys = Object.keys(insertFields);
        if (keys.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para insertar.' });
        }

        const columns = keys.join(', ');
        // Corregir los placeholders para usar $1, $2, etc.
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
        const values = keys.map(key => insertFields[key]);

        const query = `
            INSERT INTO revistas (${columns})
            VALUES (${placeholders})
            RETURNING *;
        `;

        console.log('Consulta SQL:', query); // Para depuración
        console.log('Valores:', values); // Para depuración

        // Ejecutar la consulta
        const result = await client.query(query, values);

        if (result.rows.length === 0) {
            console.log('No se pudo insertar la revista.');
            return res.status(500).json({ error: 'Error al insertar la revista.' });
        }

        console.log('Revista insertada:', result.rows[0]);
        res.status(201).json({ message: 'Revista insertada exitosamente.', revista: result.rows[0] });
    } catch (err) {
        console.error('Error al insertar la revista:', err);
        res.status(500).json({ error: 'Error al insertar la revista.' });
    } finally {
        client.release();
    }
};

// Actualizar Revista (PATCH)
exports.updateRevista = async (req, res) => {
    const { id } = req.params; // ID de la revista a editar
    const updateFields = req.body; // Campos a actualizar

    console.log(updateFields.portada)

    // Lista de columnas que deben estar en minúsculas
    const columnasMinusculas = ['correo_revista', 'correo_editor', 'url'];

    // Convertir cadenas a mayúsculas o minúsculas según corresponda
    for (const key in updateFields) {
        if (typeof updateFields[key] === 'string') {
            if (columnasMinusculas.includes(key)) {
                // Forzar a minúsculas para columnas específicas
                updateFields[key] = updateFields[key].toLowerCase();
            } else {
                // Convertir a mayúsculas para el resto de las columnas
                updateFields[key] = updateFields[key].toUpperCase();
            }
        }
    }

    const client = await pool.connect();
    try {
        // Construir la consulta dinámicamente
        const keys = Object.keys(updateFields);
        if (keys.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
        }

        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const values = keys.map(key => updateFields[key]);
        values.push(id); // Añadir el ID al final de los valores

        const query = `
            UPDATE revistas
            SET ${setClause}
            WHERE id = $${values.length}
            RETURNING *;
        `;

        // Ejecutar la consulta
        const result = await client.query(query, values);

        if (result.rows.length === 0) {
            console.log('No se encontró la revista con ID:', id);
            return res.status(404).json({ error: 'Revista no encontrada.' });
        }

        console.log('Revista actualizada:', result.rows[0]);
        res.status(200).json({ message: 'Revista actualizada exitosamente.', revista: result.rows[0] });
    } catch (err) {
        console.error('Error al actualizar la revista:', err);
        res.status(500).json({ error: 'Error al actualizar la revista.' });
    } finally {
        client.release();
    }
};
////////////SESIONES/////////////////
// Obtener configuración global de sesión
exports.getGlobalSessionTimeout = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT global_timeout FROM session_settings WHERE id = 1'
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Configuración global no encontrada' });
        }

        res.json({ timeout: result.rows[0].global_timeout });
    } catch (err) {
        console.error('❌ Error al obtener configuración global:', err.message);
        res.status(500).json({ error: 'Error al obtener la configuración global de sesión' });
    }
};
// Actualizar configuración global de sesión
exports.updateGlobalSessionTimeout = async (req, res) => {
    const { timeout } = req.body;

    if (!timeout || typeof timeout !== 'number' || timeout <= 0) {
        return res.status(400).json({ error: 'La duración debe ser un número positivo.' });
    }

    try {
        await pool.query(
            'UPDATE session_settings SET global_timeout = $1 WHERE id = 1',
            [timeout]
        );

        res.json({ message: 'Duración global de sesión actualizada exitosamente.' });
    } catch (err) {
        console.error('❌ Error al actualizar configuración global:', err.message);
        res.status(500).json({ error: 'Error al actualizar la duración global de sesión' });
    }
};
// Actualizar duración de sesión específica para usuario
exports.updateUserSessionTimeout = async (req, res) => {
    const { userId } = req.params;
    const { timeout } = req.body;

    if (!timeout || typeof timeout !== 'number' || timeout <= 0) {
        return res.status(400).json({ error: 'La duración debe ser un número positivo.' });
    }

    try {
        const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userExists.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        await pool.query(
            'UPDATE users SET session_timeout_min = $1 WHERE id = $2',
            [timeout, userId]
        );

        res.json({ message: 'Duración de sesión del usuario actualizada exitosamente' });
    } catch (err) {
        console.error('❌ Error al actualizar sesión de usuario:', err.message);
        res.status(500).json({ error: 'Error al actualizar la duración de sesión del usuario' });
    }
};
// Actualizar duración de sesión específica para rol
exports.updateRoleSessionTimeout = async (req, res) => {
    const { roleId } = req.params;
    const { timeout } = req.body;

    if (!timeout || typeof timeout !== 'number' || timeout <= 0) {
        return res.status(400).json({ error: 'La duración debe ser un número positivo.' });
    }

    try {
        const roleExists = await pool.query('SELECT id FROM roles WHERE id = $1', [roleId]);
        if (roleExists.rows.length === 0) {
            return res.status(404).json({ error: 'Rol no encontrado.' });
        }

        await pool.query(
            'UPDATE roles SET session_timeout_min = $1 WHERE id = $2',
            [timeout, roleId]
        );

        res.json({ message: 'Duración de sesión del rol actualizada exitosamente' });
    } catch (err) {
        console.error('❌ Error al actualizar sesión de rol:', err.message);
        res.status(500).json({ error: 'Error al actualizar la duración de sesión del rol' });
    }
};

/// ================================
// Estados de Servidores (Filtros simples)
// ================================
exports.serverState = async (req, res) => {
    const client = await pool.connect();
    try {
        // Consultamos directamente la tabla maestra de estados. 
        // Basado en tu código anterior, la tabla tiene la columna 'estado_id'.
        const result = await client.query('SELECT estado_id, estado FROM estados ORDER BY estado ASC');

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error en serverState:', err);
        // Por si la columna se llama diferente (ej: solo 'id' o 'nombre')
        try {
            const fallbackResult = await client.query('SELECT * FROM estados ORDER BY 1 ASC');
            return res.status(200).json(fallbackResult.rows);
        } catch (fallbackErr) {
            res.status(500).json({ error: 'Error al listar los estados de los servidores.' });
        }
    } finally {
        client.release();
    }
};

exports.massUploadSinglePhoto = async (req, res) => {
    const fs = require('fs');
    const { cedula } = req.params;
    const fotoPath = req.file ? req.file.path : null;

    if (!fotoPath) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Verificar si el servidor existe
        const queryExists = 'SELECT id FROM servidores WHERE cedula = $1';
        const existsRes = await client.query(queryExists, [cedula]);
        if (existsRes.rows.length === 0) {
            console.log('Cédula no encontrada en carga masiva:', cedula);
            await client.query('ROLLBACK');
            try { fs.unlinkSync(fotoPath); } catch (e) { }
            return res.status(404).json({ error: 'La cédula de la foto que intenta cargar no se encuentra registrada en servidores, para cargar la foto se debe registrar primero el servidor.' });
        }

        const usuario_id = existsRes.rows[0].id;
        const foto_url = fotoPath.replace(/\\/g, '/');

        // 2. Buscar foto anterior para eliminarla
        const queryOldFoto = 'SELECT foto_url FROM fotos_usuarios WHERE usuario_id = $1';
        const oldFotoRes = await client.query(queryOldFoto, [usuario_id]);

        if (oldFotoRes.rows.length > 0) {
            const oldFoto = oldFotoRes.rows[0].foto_url;
            if (oldFoto) {
                const nombreOldFoto = oldFoto.replace(/\\/g, '/').split('/').pop();
                const uploadsDir = path.join(__dirname, '../uploads');
                let realOldPath = null;
                try {
                    if (fs.existsSync(uploadsDir)) {
                        const files = fs.readdirSync(uploadsDir);
                        const fileMatch = files.find(f => f.toLowerCase() === nombreOldFoto.toLowerCase());
                        if (fileMatch) realOldPath = path.join(uploadsDir, fileMatch);
                    }
                } catch (e) { }

                if (!realOldPath) realOldPath = path.join(uploadsDir, nombreOldFoto);

                if (fs.existsSync(realOldPath)) {
                    try { fs.unlinkSync(realOldPath); } catch (e) { }
                }
            }
            // Actualizar
            const queryUpdateFoto = 'UPDATE fotos_usuarios SET foto_url = $1 WHERE usuario_id = $2';
            await client.query(queryUpdateFoto, [foto_url, usuario_id]);
        } else {
            // Insertar
            const queryInsertFoto = 'INSERT INTO fotos_usuarios (usuario_id, foto_url) VALUES ($1, $2)';
            await client.query(queryInsertFoto, [usuario_id, foto_url]);
        }

        await client.query('COMMIT');
        return res.json({ success: true, message: 'Foto cargada correctamente.', cedula });
    } catch (error) {
        await client.query('ROLLBACK');
        try { fs.unlinkSync(fotoPath); } catch (e) { }
        console.error('Error en massUploadSinglePhoto:', error);
        return res.status(500).json({ error: 'Error interno al procesar la foto.' });
    } finally {
        client.release();
    }
};