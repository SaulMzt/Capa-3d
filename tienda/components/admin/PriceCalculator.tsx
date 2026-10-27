'use client';
import {useEffect,useRef,useState} from 'react';
import {Calculator,ArrowRight,Plus,Trash2} from 'lucide-react';
import {api} from '@/services/api';

export type FilamentInput={grams:number;spoolCost:number;spoolGrams:number};
export type PriceInputs={filaments:FilamentInput[];wastePercent:number;extraCost:number;profitPercent:number;printHours:number;hourlyCost:number};
type RateMode='light'|'combined'|'custom';
type FilamentRow={id:number;profileId:string;grams:string;spoolCost:string;spoolGrams:string};
type FilamentProfile={id:string;name:string;color:string;spoolCost:number;spoolGrams:number};

export function calculatePrice(input:PriceInputs){
 const {filaments,wastePercent,extraCost,profitPercent,printHours,hourlyCost}=input;
 if(!filaments.length||![wastePercent,extraCost,profitPercent,printHours,hourlyCost].every(Number.isFinite)||wastePercent<0||extraCost<0||profitPercent<0||printHours<0||hourlyCost<0)return null;
 if(filaments.some(({grams,spoolCost,spoolGrams})=>![grams,spoolCost,spoolGrams].every(Number.isFinite)||grams<=0||spoolCost<=0||spoolGrams<=0))return null;
 const filamentCosts=filaments.map(({grams,spoolCost,spoolGrams})=>grams/spoolGrams*spoolCost);
 const filamentCost=filamentCosts.reduce((sum,cost)=>sum+cost,0);
 const wasteCost=filamentCost*wastePercent/100;
 const machineCost=printHours*hourlyCost;
 const subtotal=filamentCost+wasteCost+machineCost+extraCost;
 const profit=subtotal*profitPercent/100;
 const final=Math.ceil(subtotal+profit);
 return Number.isFinite(final)&&final<=1_000_000?{filamentCosts,filamentCost,wasteCost,machineCost,subtotal,profit,final}:null;
}

export default function PriceCalculator({onApply,buttonLabel='Usar este precio',disabled=false}:{onApply:(price:number)=>void|Promise<void>;buttonLabel?:string;disabled?:boolean}){
 const nextFilamentId=useRef(2);
 const [filaments,setFilaments]=useState<FilamentRow[]>([{id:1,profileId:'',grams:'',spoolCost:'',spoolGrams:'1000'}]);
 const [profiles,setProfiles]=useState<FilamentProfile[]>([]);
 const [profilesLoading,setProfilesLoading]=useState(true);
 const [profileForm,setProfileForm]=useState({id:'',name:'',color:'#000000',spoolCost:'',spoolGrams:'1000'});
 const [showProfileForm,setShowProfileForm]=useState(false);
 const [profileBusy,setProfileBusy]=useState(false);
 const [profileError,setProfileError]=useState('');
 const [values,setValues]=useState({wastePercent:'10',extraCost:'0',profitPercent:'30',printHours:'2',hourlyCost:'3.25'});
 const [rateMode,setRateMode]=useState<RateMode>('combined');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 useEffect(()=>{let mounted=true;api('admin/filament-profiles').then(result=>{if(mounted)setProfiles(result.profiles)}).catch((e:Error)=>{if(mounted)setProfileError(e.message)}).finally(()=>{if(mounted)setProfilesLoading(false)});return()=>{mounted=false}},[]);
 const number=(value:string)=>value.trim()===''?NaN:Number(value.replace(',','.'));
 const money=(value:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
 const calculation=calculatePrice({filaments:filaments.map(({grams,spoolCost,spoolGrams})=>({grams:number(grams),spoolCost:number(spoolCost),spoolGrams:number(spoolGrams)})),wastePercent:number(values.wastePercent),extraCost:number(values.extraCost),profitPercent:number(values.profitPercent),printHours:number(values.printHours),hourlyCost:number(values.hourlyCost)});
 const fields:[keyof typeof values,string][]=[['wastePercent','Merma (%)'],['extraCost','Otros costos (MXN)'],['profitPercent','Ganancia (%)']];
 function clearFeedback(){setMessage('');setError('')}
 function changeValue(key:keyof typeof values,value:string){setValues(v=>({...v,[key]:value}));clearFeedback()}
 function changeFilament(id:number,key:'grams'|'spoolCost'|'spoolGrams',value:string){setFilaments(rows=>rows.map(row=>row.id===id?{...row,[key]:value,profileId:key==='grams'?row.profileId:''}:row));clearFeedback()}
 function chooseProfile(id:number,profileId:string){const profile=profiles.find(p=>p.id===profileId);setFilaments(rows=>rows.map(row=>row.id===id?{...row,profileId,spoolCost:profile?String(profile.spoolCost):row.spoolCost,spoolGrams:profile?String(profile.spoolGrams):row.spoolGrams}:row));clearFeedback()}
 function addFilament(){setFilaments(rows=>[...rows,{id:nextFilamentId.current++,profileId:'',grams:'',spoolCost:'',spoolGrams:'1000'}]);clearFeedback()}
 function removeFilament(id:number){setFilaments(rows=>rows.filter(row=>row.id!==id));clearFeedback()}
 function chooseRate(mode:RateMode){setRateMode(mode);if(mode!=='custom')changeValue('hourlyCost',mode==='light'?'0.50':'3.25')}
 function editProfile(profile:FilamentProfile){setProfileForm({...profile,spoolCost:String(profile.spoolCost),spoolGrams:String(profile.spoolGrams)});setShowProfileForm(true);setProfileError('')}
 function resetProfileForm(){setProfileForm({id:'',name:'',color:'#000000',spoolCost:'',spoolGrams:'1000'});setShowProfileForm(false);setProfileError('')}
 async function saveProfile(){setProfileBusy(true);setProfileError('');try{const profile={id:profileForm.id||crypto.randomUUID(),name:profileForm.name.trim(),color:profileForm.color,spoolCost:number(profileForm.spoolCost),spoolGrams:number(profileForm.spoolGrams)};const result=await api('admin/filament-profiles',profile);setProfiles(result.profiles);setFilaments(rows=>rows.map(row=>row.profileId===profile.id?{...row,spoolCost:String(profile.spoolCost),spoolGrams:String(profile.spoolGrams)}:row));resetProfileForm();setMessage('Perfil de filamento guardado.')}catch(e){setProfileError(e instanceof Error?e.message:'No se pudo guardar el perfil.')}finally{setProfileBusy(false)}}
 async function deleteProfile(profile:FilamentProfile){if(!confirm(`¿Eliminar el perfil ${profile.name}?`))return;setProfileBusy(true);setProfileError('');try{const result=await api('admin/filament-profiles/'+profile.id,undefined,'DELETE');setProfiles(result.profiles);setFilaments(rows=>rows.map(row=>row.profileId===profile.id?{...row,profileId:''}:row));if(profileForm.id===profile.id)resetProfileForm()}catch(e){setProfileError(e instanceof Error?e.message:'No se pudo eliminar el perfil.')}finally{setProfileBusy(false)}}
 async function apply(){if(!calculation)return;setBusy(true);setError('');setMessage('');try{await onApply(calculation.final);setMessage('Precio aplicado.')}catch(e){setError(e instanceof Error?e.message:'No se pudo aplicar el precio.')}finally{setBusy(false)}}
 return <div className="price-calculator">
  <div className="price-calculator-title"><Calculator size={21}/><div><h3>Precio automático</h3><p>Calcula todos los filamentos, tiempo de impresión, merma y ganancia.</p></div></div>
  <div className="price-profiles">
   <div className="price-profiles-heading"><div><h4>Perfiles de filamento</h4><p>Guarda color y costo del rollo para reutilizarlos en cualquier impresión.</p></div><button type="button" className="price-add-filament" onClick={()=>{resetProfileForm();setShowProfileForm(true)}}><Plus size={17}/>Nuevo perfil</button></div>
   {profilesLoading?<p className="muted">Cargando perfiles…</p>:profiles.length?<div className="price-profile-list">{profiles.map(profile=><div className="price-profile" key={profile.id}><span className="price-color" style={{backgroundColor:profile.color}} aria-label={`Color ${profile.color}`}/><span><b>{profile.name}</b><small>{money(profile.spoolCost)} · {profile.spoolGrams} g</small></span><button type="button" onClick={()=>editProfile(profile)}>Editar</button><button type="button" aria-label={`Eliminar perfil ${profile.name}`} onClick={()=>deleteProfile(profile)} disabled={profileBusy}><Trash2 size={15}/></button></div>)}</div>:<p className="muted">Aún no hay perfiles guardados.</p>}
   {showProfileForm&&<div className="price-profile-form"><h5>{profileForm.id?'Editar perfil':'Nuevo perfil'}</h5><div className="form-grid"><label className="field">Nombre del filamento<input aria-label="Nombre del filamento" value={profileForm.name} placeholder="Ej. PLA negro" maxLength={80} onChange={e=>setProfileForm(v=>({...v,name:e.target.value}))}/></label><label className="field">Color del filamento<input type="color" aria-label="Color del filamento" value={profileForm.color} onChange={e=>setProfileForm(v=>({...v,color:e.target.value}))}/></label><label className="field">Costo del rollo del perfil (MXN)<input type="text" inputMode="decimal" aria-label="Costo del rollo del perfil (MXN)" value={profileForm.spoolCost} placeholder="Ej. 200" onChange={e=>setProfileForm(v=>({...v,spoolCost:e.target.value}))}/></label><label className="field">Peso del rollo del perfil (g)<input type="text" inputMode="decimal" aria-label="Peso del rollo del perfil (g)" value={profileForm.spoolGrams} onChange={e=>setProfileForm(v=>({...v,spoolGrams:e.target.value}))}/></label></div><div className="price-profile-actions"><button type="button" className="btn primary" onClick={saveProfile} disabled={profileBusy||profileForm.name.trim().length<2||!Number.isFinite(number(profileForm.spoolCost))||number(profileForm.spoolCost)<=0||!Number.isFinite(number(profileForm.spoolGrams))||number(profileForm.spoolGrams)<=0}>{profileBusy?'Guardando…':'Guardar perfil'}</button><button type="button" className="btn outline" onClick={resetProfileForm}>Cancelar</button></div></div>}
   {profileError&&<p className="form-error" role="alert">{profileError}</p>}
  </div>
  <div className="price-filaments">
   <h4>Filamentos de la impresión</h4>
   {filaments.map((filament,index)=><div className="price-filament" key={filament.id}>
    <div className="price-filament-heading"><strong>Filamento {index+1}</strong>{filaments.length>1&&<button type="button" className="price-remove-filament" aria-label={`Quitar filamento ${index+1}`} onClick={()=>removeFilament(filament.id)}><Trash2 size={15}/>Quitar</button>}</div>
    <div className="price-filament-profile"><label className="field">Perfil guardado<select aria-label={index===0?'Perfil del filamento 1':`Perfil del filamento ${index+1}`} value={filament.profileId} onChange={e=>chooseProfile(filament.id,e.target.value)}><option value="">Sin perfil (costo manual)</option>{profiles.map(profile=><option value={profile.id} key={profile.id}>{profile.name} · {money(profile.spoolCost)}</option>)}</select></label>{filament.profileId&&<span className="price-color" style={{backgroundColor:profiles.find(p=>p.id===filament.profileId)?.color||'#ffffff'}}/>}</div>
    <div className="form-grid">
     <label className="field">Filamento usado (g)<input type="text" inputMode="decimal" aria-label={index===0?'Filamento usado (g)':`Filamento ${index+1} usado (g)`} placeholder="Ej. 120" value={filament.grams} onChange={e=>changeFilament(filament.id,'grams',e.target.value)}/></label>
     <label className="field">Costo del rollo (MXN)<input type="text" inputMode="decimal" aria-label={index===0?'Costo del rollo (MXN)':`Costo del rollo ${index+1} (MXN)`} placeholder="Ej. 400" value={filament.spoolCost} onChange={e=>changeFilament(filament.id,'spoolCost',e.target.value)}/></label>
     <label className="field">Peso del rollo (g)<input type="text" inputMode="decimal" aria-label={index===0?'Peso del rollo (g)':`Peso del rollo ${index+1} (g)`} value={filament.spoolGrams} onChange={e=>changeFilament(filament.id,'spoolGrams',e.target.value)}/></label>
    </div>
   </div>)}
   <button type="button" className="price-add-filament" onClick={addFilament}><Plus size={17}/>Añadir otro filamento</button>
  </div>
  <div className="form-grid">{fields.map(([key,label])=><label className="field" key={key}>{label}<input type="text" inputMode="decimal" aria-label={label} value={values[key]} onChange={e=>changeValue(key,e.target.value)}/></label>)}</div>
  <div className="price-machine">
   <h4>Costo por tiempo de impresión</h4>
   <div className="form-grid">
    <label className="field">Tipo de costo por hora<select aria-label="Tipo de costo por hora" value={rateMode} onChange={e=>chooseRate(e.target.value as RateMode)}><option value="combined">Luz + desgaste ($3.25/h)</option><option value="light">Solo luz ($0.50/h)</option><option value="custom">Tarifa personalizada</option></select></label>
    <label className="field">Horas de impresión<input type="text" inputMode="decimal" aria-label="Horas de impresión" value={values.printHours} onChange={e=>changeValue('printHours',e.target.value)}/></label>
    <label className="field">Costo por hora (MXN)<input type="text" inputMode="decimal" aria-label="Costo por hora (MXN)" value={values.hourlyCost} onChange={e=>{setRateMode('custom');changeValue('hourlyCost',e.target.value)}}/></label>
   </div>
   <p className="price-rate-help">Tarifas de referencia: solo luz $0.45–$0.60/h; luz + desgaste $3.00–$3.50/h. Para 2 horas: $1.00 o $6.50, respectivamente. La tarifa de luz + desgaste ya incluye la luz.</p>
  </div>
  <p className="price-formula">Precio = [suma de filamentos + merma + (horas × costo por hora) + otros costos] × (1 + ganancia %). Se redondea al peso superior.</p>
  {calculation?<div className="price-result" aria-live="polite">{calculation.filamentCosts.map((cost,index)=><div key={filaments[index].id}><span>{profiles.find(p=>p.id===filaments[index].profileId)?.name||`Filamento ${index+1}`}</span><b>{money(cost)}</b></div>)}<div><span>Total filamentos</span><b>{money(calculation.filamentCost)}</b></div><div><span>Merma</span><b>{money(calculation.wasteCost)}</b></div><div><span>Impresión ({values.printHours} h × {money(number(values.hourlyCost))}/h)</span><b>{money(calculation.machineCost)}</b></div><div><span>Otros costos</span><b>{money(number(values.extraCost))}</b></div><div><span>Ganancia</span><b>{money(calculation.profit)}</b></div><div className="price-result-final"><span>Precio final sugerido</span><strong>{money(calculation.final)}</strong></div></div>:<p className="muted price-hint">Escribe los gramos usados y el costo del rollo de cada filamento para ver el precio final.</p>}
  <button type="button" className="btn primary" disabled={!calculation||disabled||busy} onClick={apply}>{busy?'Guardando…':buttonLabel}<ArrowRight size={17}/></button>
  {message&&<p className="price-success" role="status">{message}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
 </div>;
}
