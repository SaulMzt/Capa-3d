import {all,first} from './db';
import {digest,HttpError} from './security';

export function customerContact(input:string):{type:'email'|'phone';contact:string}{
 const trimmed=input.trim();
 if(trimmed.includes('@')){const contact=trimmed.toLowerCase();if(contact.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))throw new HttpError(400,'Escribe un correo válido.');return {type:'email',contact}}
 if(!/^[+\d\s().-]+$/.test(trimmed))throw new HttpError(400,'Escribe un teléfono válido.');
 const contact=trimmed.replace(/\D/g,'');if(contact.length<10||contact.length>15)throw new HttpError(400,'Escribe un teléfono de 10 a 15 dígitos.');return {type:'phone',contact};
}
export function customerCookie(req:Request,token:string,maxAge=2592000){return `capa_customer=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(req.url).protocol==='https:'?'; Secure':''}`}
export async function customerOrNull(req:Request){const token=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('capa_customer='))?.slice(14);if(!token||token.length<20)return null;return first('SELECT a.id,a.contact_type,a.contact FROM customer_sessions s JOIN customer_accounts a ON a.id=s.customer_id WHERE s.token_hash=? AND s.expires_at>?',await digest(token),Date.now())}
export async function customer(req:Request){const account=await customerOrNull(req);if(!account)throw new HttpError(401,'Inicia sesión para ver tus pedidos.');return account}
export async function customerOrder(order:{id:number;data:string;status:string;quantity:number;created_at:string}){const data=JSON.parse(order.data);const history=await all('SELECT status,created_at date FROM order_history WHERE order_id=? ORDER BY id',order.id);return {folio:'3D-'+String(order.id).padStart(6,'0'),status:order.status,productName:data.productName,total:data.total,quantity:order.quantity,createdAt:order.created_at,image:data.image||'',history}}
