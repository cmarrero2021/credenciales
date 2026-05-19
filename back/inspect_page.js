const http = require('http');
http.get('https://localhost:3001/credenciales/cedula=7920566', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    require('fs').writeFileSync('last_page.html', data, 'utf8');
    const lines = data.split(/\r?\n/);
    lines.forEach((l, i) => { if (l.includes('data:image') || l.includes('chart.googleapis') || l.includes('qr-box')) console.log(i + 1, l.trim()) });
    console.log('\nSaved to last_page.html');
  });
}).on('error', e => { console.error('ERR', e.message); process.exit(1); });
