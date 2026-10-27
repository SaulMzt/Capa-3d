'use client';

export default function CatalogPagination({page,total,perPage,onPage,onPerPage}:{page:number;total:number;perPage:number;onPage:(page:number)=>void;onPerPage:(count:number)=>void}){
 if(total===0)return null;
 const pages=Math.ceil(total/perPage);
 const start=(page-1)*perPage+1;
 const end=Math.min(page*perPage,total);
 const numbers=[...new Set([1,2,page-1,page,page+1,pages-1,pages].filter(n=>n>=1&&n<=pages))].sort((a,b)=>a-b);
 return <nav className="catalog-pagination" aria-label="Páginas del catálogo">
  <span className="catalog-page-summary">Mostrando {start}–{end} de {total} productos · Página {page} de {pages}</span>
  {pages>1&&<div className="catalog-page-buttons"><button type="button" disabled={page===1} onClick={()=>onPage(page-1)}>Anterior</button>{numbers.map((number,index)=><span key={number} className="catalog-page-item">{index>0&&number-numbers[index-1]>1&&<span className="catalog-page-gap" aria-hidden="true">…</span>}<button type="button" className={number===page?'active':''} aria-label={'Página '+number} aria-current={number===page?'page':undefined} onClick={()=>onPage(number)}>{number}</button></span>)}<button type="button" disabled={page===pages} onClick={()=>onPage(page+1)}>Siguiente</button></div>}
  <label className="catalog-page-size">Productos por página <select value={perPage} onChange={e=>onPerPage(Number(e.target.value))}><option value={12}>12</option><option value={24}>24</option><option value={48}>48</option></select></label>
 </nav>;
}
