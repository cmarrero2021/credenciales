const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '.env') }); } catch (e) { }
console.log('DB_PASSWORD raw:', process.env.DB_PASSWORD);
console.log('typeof DB_PASSWORD:', typeof process.env.DB_PASSWORD);
console.log('DB_PORT raw:', process.env.DB_PORT);
console.log('typeof DB_PORT:', typeof process.env.DB_PORT);
console.log('DATABASE_URL:', process.env.DATABASE_URL);
