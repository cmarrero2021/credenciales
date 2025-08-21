const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    // Obtener la cédula del body (puede venir como string o number)
    const cedula = req.body.cedula || 'nocedula';
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
    cb(null, `${timestamp}_${cedula}.png`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PNG'), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;
