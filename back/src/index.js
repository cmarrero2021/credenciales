const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const routes = require('./routes');
const pool = require('./db');
const listEndpoints = require('./endpointlister');
const http = require('http');
const WebSocket = require('ws');
const { Client } = require('pg');

dotenv.config();
const app = express();

// Configuración de CORS
app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());
// Exponer la carpeta uploads como /uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Exponer la imagen no_person.png como /img/no_person.png
app.use('/img/no_person.png', express.static(path.join(__dirname, 'no_person.png')));
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

pgListener.connect().then(() => {
    console.log('🟢 Escuchando canal table_changes de PostgreSQL...');
    pgListener.query('LISTEN table_changes');
});
pgListener.query('LISTEN table_changes').then(() => {
    console.log('LISTEN ejecutado correctamente');
});
pgListener.on('error', (err) => {
    console.error('Error en pgListener:', err);
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