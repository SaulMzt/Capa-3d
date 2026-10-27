import fs from 'node:fs';
const access=JSON.parse(fs.readFileSync('.private/access.json','utf8'));
const base=process.env.SHOP_URL||'http://localhost:5173';
async function req(path,body,cookie){const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw new Error(`${path}: ${r.status} ${d.error}`);return {data:d,cookie:r.headers.get('set-cookie')?.split(';')[0]}}
if((await req('auth/status')).data.needsSetup)await req('auth/setup',access);
const login=await req('auth/login',access);const admin=await req('admin',null,login.cookie);if(!admin.data.seeded)await req('admin/seed',{},login.cookie);
console.log('Administrador activado y colección de demostración guardada en la base de datos.');
