'use client';
import {useState} from 'react';
import {toast} from 'sonner';
import {api} from '@/services/api';
import type {Product} from '@/types/shop';
import PriceCalculator from './PriceCalculator';

export default function PriceCalculatorPage({products,onSaved,onEdit}:{products:Product[];onSaved:()=>void;onEdit:(product:Product)=>void}){
 const [productId,setProductId]=useState('');
 const [savedPrice,setSavedPrice]=useState<number|null>(null);
 const selected=products.find(p=>p.id===productId);
 async function apply(price:number){
  if(!selected)throw new Error('Selecciona el producto al que quieres guardar el precio.');
  if(selected.offer&&selected.oldPrice<=price)throw new Error('El precio calculado supera el precio anterior de la oferta. Edita la oferta antes de guardarlo.');
  await api('admin/products',{...selected,price});
  setSavedPrice(price);onSaved();toast.success('Precio guardado en el producto');
 }
 return <section className="admin-card price-page">
  <label className="field">Producto al que se aplicará el precio<select aria-label="Producto para precio automático" value={productId} onChange={e=>{setProductId(e.target.value);setSavedPrice(null)}}><option value="">Selecciona un producto</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  {selected&&<p className="muted">Precio actual: {selected.price.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}. El producto conserva su estado de publicación y disponibilidad.</p>}
  <PriceCalculator onApply={apply} buttonLabel="Guardar precio en producto" disabled={!selected}/>
  {selected&&savedPrice!==null&&<div className="price-saved" role="status">Precio guardado: {savedPrice.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}. <button type="button" onClick={()=>onEdit({...selected,price:savedPrice})}>Abrir producto para revisarlo</button></div>}
 </section>;
}
