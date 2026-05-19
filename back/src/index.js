const path = require('path');
// Load dotenv if available, but don't crash if it's missing on the server.
let dotenv;
try {
    dotenv = require('dotenv');
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
} catch (err) {
    console.warn('Warning: dotenv not installed. Run `npm ci` in the back/ folder to install dependencies.');
}
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const controllers = require('./controllers');
const upload = require('./upload');
const pool = require('./db');
const listEndpoints = require('./endpointlister');
const http = require('http');
const WebSocket = require('ws');
const { Client } = require('pg');

dotenv.config();
const app = express();

app.set('etag', false);

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Request-Headers', 'Access-Control-Request-Method'],
    exposedHeaders: ['Content-Range', 'X-Total-Count'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Manejar preflight usando las mismas opciones (importante para Authorization)
app.options('*', cors(corsOptions));

// Asegúrese de que cada solicitud previa OPTIONS reciba una respuesta de éxito explícita y permita el encabezado de autorización.
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Authorization,authorization,Content-Type,X-Requested-With,Accept,Origin,Access-Control-Request-Headers,Access-Control-Request-Method');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Exponer la carpeta uploads como /uploads y forzar headers que eviten 304 Not Modified cuando queramos refrescar
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
    etag: false,
    setHeaders: (res, filePath, stat) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        try { res.removeHeader('ETag') } catch (e) { }
        try { res.removeHeader('Last-Modified') } catch (e) { }
    }
}));

app.use('/img/cintillomi.png', express.static(path.join(__dirname, '../../front/public/img/cintillomi.png'), {
    etag: false,
    setHeaders: (res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        try { res.removeHeader('ETag') } catch (e) { }
        try { res.removeHeader('Last-Modified') } catch (e) { }
    }
}));

// Exponer la imagen no_person.png como /img/no_person.png con mismos headers
app.use('/img/no_person.png', express.static(path.join(__dirname, 'no_person.png'), {
    etag: false,
    setHeaders: (res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        try { res.removeHeader('ETag') } catch (e) { }
        try { res.removeHeader('Last-Modified') } catch (e) { }
    }
}));
// Página pública para credenciales (usar por QR sin el prefijo /auth)
app.get('/credenciales/cedula=:cedula', controllers.getCredencialPage);

// Ruta de prueba para subir una imagen sin autenticación (solo para pruebas locales)
// Habilitar solo en entornos de desarrollo. Devuelve el nombre de archivo guardado.
app.post('/_upload_test', upload.single('foto'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    return res.json({ filename: req.file.filename, path: `/uploads/${req.file.filename}`, size: req.file.size });
});
app.use('/auth', routes);
app.get('/list-endpoints', (req, res) => {
    const endpoints = listEndpoints(app);
    res.json(endpoints);
});

// --- Servidor HTTP y WebSocket ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const wsClients = new Set();

wss.on('connection', (ws) => {
    wsClients.add(ws);
    console.log('Nuevo cliente WebSocket conectado. Total:', wsClients.size);
    ws.on('close', () => {
        wsClients.delete(ws);
        console.log('Cliente WebSocket desconectado. Total:', wsClients.size); // <-- Opcional
    });
});

// --- PostgreSQL LISTEN/NOTIFY ---
const pgListener = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10),
});

// Iniciar pgListener con manejo de errores para no bloquear el servidor si la BD no está disponible
pgListener.connect()
    .then(() => {
        console.log('🟢 Conectado a PostgreSQL para LISTEN table_changes');
        return pgListener.query('LISTEN table_changes');
    })
    .then(() => {
        console.log('LISTEN table_changes ejecutado correctamente');
    })
    .catch((err) => {
        console.error('No se pudo inicializar pgListener (LISTEN table_changes):', err && err.message ? err.message : err);
    });

pgListener.on('error', (err) => {
    console.error('Error en pgListener:', err && err.message ? err.message : err);
});

pgListener.on('notification', (msg) => {
    console.log('Clientes WebSocket conectados:', wsClients.size);
    for (const ws of wsClients) {
        if (ws.readyState === WebSocket.OPEN) {
            console.log('Payload recibido de Postgres:', msg.payload);
            ws.send(msg.payload);
        }
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor HTTP y WebSocket corriendo en http://0.0.0.0:${PORT}`);
});