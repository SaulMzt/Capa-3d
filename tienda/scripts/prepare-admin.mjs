import fs from 'node:fs';
import crypto from 'node:crypto';
fs.mkdirSync('.private',{recursive:true});
if(!fs.existsSync('.private/access.json')){const access={email:'admin@capa.local',password:crypto.randomBytes(18).toString('base64url'),code:crypto.randomBytes(32).toString('hex')};fs.writeFileSync('.private/access.json',JSON.stringify(access,null,2));fs.writeFileSync('.private/ACCESO-ADMIN.txt',`CAPA 3D — Acceso privado\n\nPanel local: http://localhost:5173/admin\nCorreo: ${access.email}\nContraseña inicial: ${access.password}\n\nCambia la contraseña desde Configuración al iniciar sesión.\nNo compartas este archivo.\nCódigo de activación inicial: ${access.code}\n`);fs.writeFileSync('.dev.vars',`ADMIN_SETUP_TOKEN=${access.code}\n`);fs.writeFileSync('.env',`ADMIN_SETUP_TOKEN=${access.code}\n`)}
console.log('Acceso privado y configuración local preparados. No se imprimieron credenciales.');
