// src/utils.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const pool = require('./db'); // Importar pool al inicio

// Generar hash de contraseña
exports.hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Validar contraseña
exports.comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// Validar formato del password
exports.validatePassword = (password) => {
  const errors = [];

  // Longitud mínima de 8 caracteres
  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres.');
  }

  // Al menos una letra mayúscula
  if (!/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra mayúscula.');
  }

  // Al menos una letra minúscula
  if (!/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra minúscula.');
  }

  // Al menos un número
  if (!/[0-9]/.test(password)) {
    errors.push('La contraseña debe contener al menos un número.');
  }

  // Al menos un carácter especial
  if (!/[!"#$%&/=.\-*;]/.test(password)) {
    errors.push('La contraseña debe contener al menos uno de los siguientes caracteres especiales: !"#$%&/=.-*;');
  }

  return errors;
};

// Generar token seguro
exports.generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Enviar correo electrónico
exports.sendEmail = async (to, subject, text) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  });
};

// Obtener duración de sesión (en minutos)
exports.getSessionTimeout = async (userId) => {
  const client = await pool.connect();
  try {
    // Verificar si el usuario tiene configuración específica
    const userRes = await client.query(
      'SELECT session_timeout_min FROM users WHERE id = $1', 
      [userId]
    );
    
    if (userRes.rows.length > 0 && userRes.rows[0].session_timeout_min !== null) {
      return userRes.rows[0].session_timeout_min;
    }

    // Verificar si el rol del usuario tiene configuración específica
    const roleRes = await client.query(`
      SELECT r.session_timeout_min 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1
    `, [userId]);
    
    if (roleRes.rows.length > 0 && roleRes.rows[0].session_timeout_min !== null) {
      return roleRes.rows[0].session_timeout_min;
    }

    // Usar configuración global
    const globalRes = await client.query(
      'SELECT global_timeout FROM session_settings WHERE id = 1'
    );
    
    return globalRes.rows[0]?.global_timeout || 120;
  } finally {
    client.release();
  }
};

// Generar token JWT con duración dinámica
exports.generateToken = async (userId) => {
  const timeoutMin = await exports.getSessionTimeout(userId);
  return jwt.sign({ userId }, process.env.JWT_SECRET, { 
    expiresIn: `${timeoutMin}m` 
  });
};