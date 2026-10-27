import React from 'react';
import {createRoot} from 'react-dom/client';
import {ProductDetail} from '../components/store/Product';
import '../app/globals.css';

// Separate admin-only preview. Reuses the unchanged customer product component and CSS.
const data=JSON.parse(document.getElementById('preview-data')!.textContent!);
const color=data.color;
if(/^#[0-9a-f]{6}$/i.test(color))document.documentElement.style.setProperty('--brand',color);
createRoot(document.getElementById('root')!).render(
 <main className="container" style={{paddingTop:24,paddingBottom:40}}>
  <p style={{marginBottom:24}}>Vista previa privada · No publicado · Caduca en 10 minutos</p>
  <ProductDetail p={data.product} category={data.category} preview onReserve={()=>{}}/>
 </main>
);
