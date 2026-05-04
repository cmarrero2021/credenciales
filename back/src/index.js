const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const routes = require('./routes');
const controllers = require('./controllers');
const pool = require('./db');
const listEndpoints = require('./endpointlister');
const http = require('http');
const WebSocket = require('ws');
const { Client } = require('pg');

dotenv.config();
const app = express();

app.set('etag', false);

// --- Configuración de CORS Total ---
// He configurado esto para permitir cualquier origen ('*') y asegurar que
// las cabeceras de autorización pasen sin problemas.
const corsOptions = {
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: true,
    optionsSuccessStatus: 200
};

// Aplicar CORS a todas las rutas antes de definir los endpoints
app.use(cors(corsOptions));
// Responder con éxito inmediato a las peticiones OPTIONS (Preflight)
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Servir Archivos Estáticos ---
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
    etag: false,
    setHeaders: (res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
}));

app.use('/img/cintillomi.png', express.static(path.join(__dirname, '../../front/public/img/cintillomi.png')));
app.use('/img/no_person.png', express.static(path.join(__dirname, 'no_person.png')));

// --- Rutas ---
app.get('/credenciales/cedula=:cedula', controllers.getCredencialPage);
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

pgListener.connect()
    .then(() => {
        console.log('?? Conectado a PostgreSQL para LISTEN');
        return pgListener.query('LISTEN table_changes');
    })
    .catch((err) => {
        console.error('Error inicializando pgListener:', err.message);
    });

pgListener.on('notification', (msg) => {
    for (const ws of wsClients) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(msg.payload);
        }
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`?? Servidor corriendo en http://0.0.0.0:${PORT}`);
});