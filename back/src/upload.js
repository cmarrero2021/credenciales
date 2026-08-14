const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('UPLOAD DESTINATION: entering destination function');
    const dest = path.join(__dirname, '../uploads');
    console.log('UPLOAD DESTINATION: destination path:', dest);
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    console.log('UPLOAD FILENAME: entering filename function');
    // Obtener la cédula del body o de los parámetros de la ruta
    const cedula = req.body.cedula || req.params.cedula || 'nocedula';
    console.log('UPLOAD FILENAME: cedula:', cedula);
    // Obtener timestamp actual en formato YYYYMMDD_HHMMSS
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const YYYY = now.getFullYear();
    const MM = pad(now.getMonth() + 1);
    const DD = pad(now.getDate());
    const HH = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    const timestamp = `${YYYY}${MM}${DD}_${HH}${mm}${ss}`;
    // Determinar extensión a partir del mimetype o del nombre original
    const mimeToExt = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg'
    }
    let ext = mimeToExt[file.mimetype]
    if (!ext) {
      const origExt = path.extname(file.originalname || '').toLowerCase()
      if (origExt === '.png' || origExt === '.jpg' || origExt === '.jpeg') ext = (origExt === '.jpeg') ? '.jpg' : origExt
      else ext = '.png' // fallback
    }
    const finalFilename = `${timestamp}_${cedula}${ext}`;
    console.log('UPLOAD FILENAME: final filename:', finalFilename);
    cb(null, finalFilename);
  }
});

const fileFilter = (req, file, cb) => {
  console.log('UPLOAD FILTER: entering fileFilter function');
  console.log('UPLOAD FILTER: mimetype:', file.mimetype);
  const allowed = ['image/png', 'image/jpeg', 'image/jpg']
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PNG o JPG/JPEG'), false);
  }
};

// Aceptar archivos temporales más grandes para luego comprimirlos a un tamaño de carnet
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_BYTES } });

module.exports = upload;
