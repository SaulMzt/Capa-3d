'use client';
import {useState,type FormEvent} from 'react';
import {Link2,Download} from 'lucide-react';
import {api} from '@/services/api';
import type {Product} from '@/types/shop';

export default function MakerWorldImporter({onImported,onEdit}:{onImported:()=>void;onEdit:(p:Product)=>void}){
 const [url,setUrl]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [result,setResult]=useState<{product:Product;alreadyExists:boolean}|null>(null);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');setResult(null);
  try{const imported=await api('admin/import-makerworld',{url});setResult(imported);onImported();setUrl('')}
  catch(e){setError(e instanceof Error?e.message:'No se pudo importar el modelo.')}
  finally{setBusy(false)}
 }
 return <section className="admin-card form-stack" style={{marginBottom:24}} aria-labelledby="makerworld-title">
  <div><span className="eyebrow muted">AGREGA UNA PIEZA</span><h2 id="makerworld-title" style={{fontSize:20,marginTop:7}}>Importar desde MakerWorld</h2><p className="muted" style={{fontSize:13,marginTop:7}}>Pega el enlace del modelo. Se añadirá como borrador con descripción, imágenes y licencia, cualquiera que sea el tipo de licencia. Después podrás poner el precio y decidir si lo publicas.</p></div>
  <form onSubmit={submit} className="url-row"><Link2 size={18}/><input aria-label="Enlace del modelo de MakerWorld" type="url" placeholder="https://makerworld.com/es/models/..." value={url} onChange={e=>setUrl(e.target.value)} required/><button className="btn primary" disabled={busy}><Download size={17}/>{busy?'Importando…':'Importar'}</button></form>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {result&&<div role="status" style={{fontSize:13}}><b>{result.alreadyExists?'Este modelo ya estaba en tus productos.':'Modelo añadido como borrador.'}</b><p className="muted">{result.product.name} · {result.product.extra.match(/^Licencia: (.+)$/m)?.[1]||'Licencia no indicada'} · Define el precio y revisa los detalles antes de publicarlo.</p><button type="button" className="btn outline" style={{marginTop:10}} onClick={()=>onEdit(result.product)}>Editar producto</button></div>}
 </section>
}
