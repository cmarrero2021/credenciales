const QR = require('qrcode');
QR.toDataURL('http://localhost:3001/credenciales/cedula=7920566')
  .then(d => { console.log('OK', d.slice(0,60)); process.exit(0); })
  .catch(e => { console.error('ERR', e && e.message); process.exit(1); });
