'use client';
import {useEffect,useState} from 'react';
import {Bell,MessageCircle,Send} from 'lucide-react';
import {api} from '@/services/api';

type Message={id:number;sender:'admin'|'customer';body:string;createdAt:string};
type Props={folio:string;orderId?:number;token?:string;admin?:boolean};
function base64Key(value:string){const padded=value.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(padded+'='.repeat((4-padded.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}

export default function OrderChat({folio,orderId,token,admin=false}:Props){
 const [messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function refresh(){const result=admin?await api(`admin/orders/${orderId}/chat`):await api('order-chat',{folio,token});setMessages(result.messages);}
 useEffect(()=>{if(!open)return;let active=true;const load=()=>refresh().catch(e=>{if(active)setError(e instanceof Error?e.message:'No se pudo cargar el chat.')});load();const timer=window.setInterval(load,10000);return()=>{active=false;window.clearInterval(timer)}},[open,folio,orderId,token,admin]);
 async function send(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!draft.trim())return;setBusy(true);setError('');try{if(admin)await api(`admin/orders/${orderId}/chat`,{message:draft.trim()});else await api('order-chat/send',{folio,token,message:draft.trim()});setDraft('');await refresh()}catch(e){setError(e instanceof Error?e.message:'No se pudo enviar el mensaje.')}finally{setBusy(false)}}
 async function enablePush(){setError('');setNotice('');try{if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw new Error('Este navegador no admite notificaciones de pedidos.');const {publicKey}=await api('push/config');const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Activa las notificaciones en la configuración del navegador para recibir avisos.');const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});const existing=await registration.pushManager.getSubscription();const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64Key(publicKey)});await api('push/subscribe',{folio,token,endpoint:subscription.endpoint});setNotice('Avisos activados para este pedido.')}catch(e){setError(e instanceof Error?e.message:'No se pudieron activar las notificaciones.')}}
 return <div className="order-chat">
  <button type="button" className="order-chat-toggle" onClick={()=>setOpen(!open)} aria-expanded={open}><MessageCircle size={17}/>{open?'Cerrar conversación':'Conversación del pedido'}</button>
  {!admin&&<button type="button" className="btn outline order-chat-push" onClick={enablePush}><Bell size={16}/>Activar avisos aunque cierre la página</button>}
  {open&&<div className="order-chat-content">
   <div className="order-chat-messages" aria-live="polite">{messages.length?messages.map(message=><div key={message.id} className={'order-chat-message '+(message.sender===(admin?'admin':'customer')?'mine':'theirs')}><small>{message.sender==='admin'?'CAPA 3D':'Cliente'} · {new Date(message.createdAt).toLocaleString('es-MX')}</small><p>{message.body}</p></div>):<p className="muted">Aún no hay mensajes. Escribe para consultar cómo va tu pedido.</p>}</div>
   <form onSubmit={send} className="order-chat-form"><label className="sr-only" htmlFor={'chat-'+folio}>Mensaje del pedido</label><textarea id={'chat-'+folio} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={1000} rows={2} placeholder={admin?'Escribe una actualización para el cliente':'Escribe tu pregunta sobre el pedido'}/><button type="submit" className="btn primary" disabled={busy||!draft.trim()}><Send size={16}/>{busy?'Enviando…':'Enviar'}</button></form>
  </div>}
  {notice&&<p role="status" className="customer-notice">{notice}</p>}{error&&<p role="alert" className="form-error">{error}</p>}
 </div>
}
