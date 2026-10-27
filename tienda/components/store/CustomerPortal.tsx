'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,CheckCircle2,PackageCheck,ShieldCheck,UserRound} from 'lucide-react';
import {Modal} from '@/components/shared/Controls';
import {api} from '@/services/api';
import {money} from '@/lib/demo';
import OrderChat from './OrderChat';

export type GuestKey={folio:string;token:string};
type Account={id:string;contact:string;contact_type:string};
type TrackedOrder={folio:string;status:string;productName:string;total:number;quantity:number;createdAt?:string;history:{date:string;status:string}[]};
type Mode='guest'|'register'|'login';
const steps=['Nuevo','Pendiente','Contactado','Confirmado','En impresión','Terminado','Entregado'];

function OrderCard({order,claim,token}:{order:TrackedOrder;claim?:()=>void;token?:string}){
 const step=steps.indexOf(order.status);
 return <article className="customer-order"><div className="customer-order-head"><div><small>{order.folio}</small><h3>{order.productName}</h3></div><span className="customer-status">{order.status}</span></div><p>{order.quantity} {order.quantity===1?'pieza':'piezas'} · {money(order.total)}</p><div className="customer-progress" aria-label={`Estado: ${order.status}`}>{steps.map((label,index)=><span key={label} className={step>=index?'done':''} title={label}/>)}</div><div className="customer-history">{order.history.map((item,index)=><div key={index}><CheckCircle2 size={15}/><span>{item.status}<small>{new Date(item.date).toLocaleString('es-MX')}</small></span></div>)}</div><OrderChat folio={order.folio} token={token}/>{claim&&<button type="button" className="customer-text-button" onClick={claim}>Guardar este pedido en mi cuenta <ArrowRight size={15}/></button>}</article>
}

export default function CustomerPortal({open,onClose,guestKeys,onGuestKey,pendingClaim,initialMode='guest'}:{open:boolean;onClose:()=>void;guestKeys:GuestKey[];onGuestKey:(key:GuestKey)=>void;pendingClaim:GuestKey|null;initialMode?:Mode}){
 const [mode,setMode]=useState<Mode>('guest');
 const [account,setAccount]=useState<Account|null>(null);
 const [accountOrders,setAccountOrders]=useState<TrackedOrder[]>([]);
 const [guestOrders,setGuestOrders]=useState<TrackedOrder[]>([]);
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{if(!open)return;let active=true;Promise.resolve().then(()=>{if(!active)return;setMode(initialMode);setError('');setNotice('');setLoading(true);let keys:GuestKey[]=[];try{const saved=JSON.parse(localStorage.getItem('capa_guest_orders')||'[]');if(Array.isArray(saved))keys=saved.filter(key=>typeof key?.folio==='string'&&typeof key?.token==='string').slice(0,20)}catch{}return Promise.all([api('customer/status'),keys.length?api('guest/orders',{keys}):Promise.resolve({orders:[]})])}).then(async result=>{if(!active||!result)return;const [status,guest]=result;setAccount(status.user);setGuestOrders(guest.orders);if(status.user){const orders=await api('customer/orders');if(active)setAccountOrders(orders.orders)}}).catch((e:Error)=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[open,initialMode]);
 async function refreshOrders(){const [accountResult,guestResult]=await Promise.all([api('customer/orders'),guestKeys.length?api('guest/orders',{keys:guestKeys}):Promise.resolve({orders:[]})]);setAccountOrders(accountResult.orders);setGuestOrders(guestResult.orders)}
 async function authenticate(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');setNotice('');const values=Object.fromEntries(new FormData(event.currentTarget));try{const result=await api(mode==='register'?'customer/register':'customer/login',{contact:String(values.contact),password:String(values.password)});setAccount(result.user);if(pendingClaim){try{await api('customer/claim',pendingClaim);setNotice('Tu pedido quedó guardado en la cuenta.')}catch{setNotice('Cuenta creada. Puedes vincular tu pedido con el folio y código privado.')}}await refreshOrders();setMode('guest')}catch(e){setError(e instanceof Error?e.message:'No se pudo entrar.')}finally{setBusy(false)}}
 async function claim(key:GuestKey){setBusy(true);setError('');try{await api('customer/claim',key);await refreshOrders();setNotice('Pedido guardado en tu cuenta.')}catch(e){setError(e instanceof Error?e.message:'No se pudo vincular el pedido.')}finally{setBusy(false)}}
 async function lookup(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');const values=Object.fromEntries(new FormData(event.currentTarget));const key={folio:String(values.folio).trim().toUpperCase(),token:String(values.token).trim()};try{const order=await api('track',key);onGuestKey(key);setGuestOrders(orders=>[order,...orders.filter(p=>p.folio!==order.folio)]);if(account){await api('customer/claim',key);await refreshOrders();setNotice('Pedido agregado a tu cuenta.')}else setNotice('Pedido encontrado y guardado en este dispositivo.')}catch(e){setError(e instanceof Error?e.message:'No encontramos el pedido.')}finally{setBusy(false)}}
 async function logout(){setBusy(true);try{await api('customer/logout',{});setAccount(null);setAccountOrders([]);setMode('guest');setNotice('Sesión cerrada.')}catch(e){setError(e instanceof Error?e.message:'No se pudo cerrar sesión.')}finally{setBusy(false)}}
 const linked=new Set(accountOrders.map(order=>order.folio));
 return <Modal open={open} onClose={onClose} wide title="Mis pedidos" description="Consulta cada avance de tu impresión en un solo lugar."><div className="customer-portal">
  {loading?<p className="muted">Cargando tus pedidos…</p>:<>
   {account?<div className="customer-account"><div className="customer-account-icon"><UserRound size={22}/></div><div><b>Tu cuenta</b><span>{account.contact}</span></div><button type="button" onClick={logout} disabled={busy}>Cerrar sesión</button></div>:<div className="customer-invite"><div className="customer-invite-icon"><PackageCheck size={25}/></div><div><h3>Tus impresiones, siempre a la vista</h3><p>Crea una cuenta con tu correo o teléfono y una contraseña. Podrás ver tus pedidos al entrar desde cualquier dispositivo.</p><div><button type="button" className="btn primary" onClick={()=>{setMode('register');setError('')}}>Crear cuenta <ArrowRight size={16}/></button><button type="button" className="btn outline" onClick={()=>{setMode('login');setError('')}}>Ya tengo cuenta</button></div></div></div>}
   {!account&&mode!=='guest'&&<form className="customer-auth form-stack" onSubmit={authenticate}><h3>{mode==='register'?'Crea tu cuenta':'Entra a tu cuenta'}</h3><label>Correo o teléfono<input name="contact" required maxLength={200} autoComplete="username" placeholder="correo@ejemplo.com o tu teléfono"/></label><label>Contraseña<input name="password" type="password" required minLength={mode==='register'?10:1} maxLength={128} autoComplete={mode==='register'?'new-password':'current-password'} placeholder={mode==='register'?'Mínimo 10 caracteres':'Tu contraseña'}/></label><button className="btn primary" disabled={busy}>{busy?'Un momento…':mode==='register'?'Crear cuenta':'Entrar'}</button><button type="button" className="customer-text-button" onClick={()=>setMode('guest')}>Seguir como invitado</button><p className="customer-privacy"><ShieldCheck size={16}/>Los pedidos anteriores se vinculan solo con su folio y código privado.</p></form>}
   {notice&&<p className="customer-notice" role="status">{notice}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
   {account&&<section className="customer-section"><h3>Pedidos de tu cuenta</h3>{accountOrders.length?<div className="customer-orders">{accountOrders.map(order=><OrderCard key={order.folio} order={order}/>)}</div>:<p className="muted">Aún no hay pedidos vinculados. Si apartaste como invitado, puedes añadirlo abajo con su folio y código.</p>}</section>}
   <section className="customer-section"><h3>{account?'Pedidos de este dispositivo':'Tus pedidos como invitado'}</h3>{guestOrders.filter(order=>!account||!linked.has(order.folio)).length?<div className="customer-orders">{guestOrders.filter(order=>!account||!linked.has(order.folio)).map(order=><OrderCard key={order.folio} order={order} token={guestKeys.find(key=>key.folio===order.folio)?.token} claim={account?()=>claim(guestKeys.find(key=>key.folio===order.folio)!):undefined}/>)}</div>:<p className="muted">{account?'No hay otros pedidos guardados en este dispositivo.':'Cuando hagas un apartado, podrás ver su estado aquí sin registrarte.'}</p>}</section>
   <details className="customer-lookup"><summary>Consultar un pedido con folio y código privado</summary><form className="form-stack" onSubmit={lookup}><label>Folio<input name="folio" required placeholder="3D-000001"/></label><label>Código privado<input name="token" required placeholder="Código recibido al apartar"/></label><button className="btn outline" disabled={busy}>Buscar pedido</button></form></details>
  </>}
 </div></Modal>
}
