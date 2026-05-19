const http = require('http');
function postPrint(cedula){
  return new Promise((resolve,reject)=>{
    const data = JSON.stringify({ cedula });
    const options = {
      hostname: 'localhost', port: 3001, path: '/auth/credencial/historico', method: 'POST',
      headers: { 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(data), 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTc3ODcwMTY3MSwiZXhwIjoxNzgzODg1NjcxfQ.eW2HalAc2gf-OBPbL55LgLE60TOWMV-mo18lG3ObxYs' }
    };
    const req = http.request(options, res =>{
      let body=''; res.on('data',c=>body+=c); res.on('end',()=>resolve({status:res.statusCode,body}));
    });
    req.on('error',reject); req.write(data); req.end();
  });
}
function getHistory(){
  return new Promise((resolve,reject)=>{
    const options = { hostname:'localhost', port:3001, path:'/auth/credencial/historico', method:'GET', headers:{ 'Authorization':'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTc3ODcwMTY3MSwiZXhwIjoxNzgzODg1NjcxfQ.eW2HalAc2gf-OBPbL55LgLE60TOWMV-mo18lG3ObxYs' } };
    const req = http.request(options, res =>{ let b=''; res.on('data',c=>b+=c); res.on('end',()=>resolve({status:res.statusCode,body:b})); });
    req.on('error',reject); req.end();
  });
}
(async ()=>{
  const ced = '20424886';
  console.log('Posting first print...');
  console.log(await postPrint(ced));
  console.log('Posting second print (reprint)...');
  console.log(await postPrint(ced));
  console.log('Fetching history...');
  const h = await getHistory();
  console.log('History status',h.status);
  try{ const arr = JSON.parse(h.body); const entries = arr.filter(x=>String(x.cedula)===ced || (x.cedula===Number(ced))); console.log('Entries for',ced, JSON.stringify(entries,null,2)); }catch(e){ console.error('Parse error',e); console.log(h.body); }
  process.exit(0);
})();
