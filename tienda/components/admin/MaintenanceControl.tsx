'use client';
import {useState} from 'react';
import {Power,TriangleAlert} from 'lucide-react';
import {toast} from 'sonner';
import {api} from '@/services/api';

export default function MaintenanceControl({enabled,refresh}:{enabled:boolean;refresh:()=>Promise<void>}){
 const [busy,setBusy]=useState(false);
 async function toggle(){setBusy(true);try{await api('admin/maintenance',{enabled:!enabled});await refresh();toast.success(enabled?'Tienda abierta de nuevo':'Mantenimiento activado')}catch(error){toast.error(error instanceof Error?error.message:'No se pudo cambiar el mantenimiento.')}finally{setBusy(false)}}
 return <section className={'admin-card maintenance-card'+(enabled?' is-on':'')}>
  <div className="maintenance-card-icon">{enabled?<TriangleAlert size={22}/>:<Power size={22}/>}</div>
  <div className="maintenance-card-copy"><h3>Mantenimiento de la página</h3><strong role="status">{enabled?'Activado: los visitantes no pueden entrar':'Desactivado: la tienda está abierta'}</strong><p>{enabled?'Los visitantes ven un aviso de mantenimiento. El panel de administración sigue disponible para quitarlo.':'Al activarlo, la tienda y las solicitudes públicas se pausarán hasta que lo quites desde aquí.'}</p></div>
  <button type="button" className={'btn '+(enabled?'primary':'outline')} onClick={toggle} disabled={busy}>{busy?'Aplicando…':enabled?'Quitar mantenimiento':'Activar mantenimiento'}</button>
 </section>;
}
