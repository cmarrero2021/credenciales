const http = require('http');
http.get('http://localhost:3001/credenciales/cedula=7920566', res => {
  let data='';
  res.on('data', c=>data+=c);
  res.on('end', ()=>{
    console.log('STATUS', res.statusCode);
    const m = data.match(/(chart.googleapis[^"'<>\s]+|data:image\/[^"]+)/g);
    if (m) console.log('FOUND', m.join('\n'));
    else console.log('NO_QR_FOUND');
  });
}).on('error', e=>{ console.error('ERR', e.message); process.exit(1); });
