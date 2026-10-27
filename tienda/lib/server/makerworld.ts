import {HttpError} from './security';
import {productSchema} from './validation';

const modelPath=/^\/(?:[a-z]{2}\/)?models\/(\d+)(?:[-/]|$)/i;
const imageHosts=new Set(['makerworld.bblmw.com','public-cdn.bblmw.com']);

function modelId(value:string){
 let url:URL;try{url=new URL(value)}catch{throw new HttpError(400,'Pega el enlace HTTPS de un modelo de MakerWorld.')}
 const match=url.pathname.match(modelPath);
 if(url.protocol!=='https:'||!['makerworld.com','www.makerworld.com'].includes(url.hostname)||url.username||url.password||!match)throw new HttpError(400,'Pega el enlace HTTPS de un modelo de MakerWorld.');
 return Number(match[1]);
}

function safeImage(value:unknown){
 if(typeof value!=='string')return false;
 try{const url=new URL(value);return url.protocol==='https:'&&imageHosts.has(url.hostname)&&!url.username&&!url.password}catch{return false}
}

function plainText(html:string){
 const entities:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
 return html.replace(/<[^>]*>/g,' ').replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi,(_,key:string)=>{
  if(key.startsWith('#')){const point=key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);return Number.isFinite(point)&&point>0&&point<=0x10ffff?String.fromCodePoint(point):' '}
  return entities[key.toLowerCase()]||' ';
 }).replace(/\s+/g,' ').trim();
}

export async function importMakerWorld(url:string,categoryId:string,now:string){
 const id=modelId(url);
 let response:Response;
 try{response=await fetch(`https://api.bambulab.com/v1/design-service/design/${id}`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(18000)})}
 catch{throw new HttpError(502,'MakerWorld no devolvió los datos del modelo. Intenta más tarde.')}
 if(!response.ok||Number(response.headers.get('content-length')||0)>1_500_000)throw new HttpError(502,'MakerWorld no devolvió los datos del modelo. Intenta más tarde.');
 const model:any=await response.json().catch(()=>null);
 if(!model||model.id!==id)throw new HttpError(502,'No se pudo validar la respuesta de MakerWorld.');
 const license=String(model.license||'').trim()||'No indicada';
 const name=String(model.title||'').trim();const description=plainText(String(model.summary||'')).slice(0,5000);
 if(name.length<2||name.length>150||!description)throw new HttpError(502,'MakerWorld no devolvió un título o descripción válidos.');
 const candidates=[model.coverUrl,...(Array.isArray(model.instances)?model.instances.slice(0,6).flatMap((instance:any)=>Array.isArray(instance.pictures)?instance.pictures.slice(0,3).map((picture:any)=>picture.url):[]):[])];
 const images=[...new Set(candidates.filter(safeImage))].slice(0,12) as string[];
 if(!images.length)throw new HttpError(502,'MakerWorld no devolvió imágenes válidas.');
 const creator=String(model.designCreator?.name||'').trim();const source=`https://makerworld.com/es/models/${id}-${model.slug||'modelo'}`;
 const product=productSchema.parse({id:`mw-${id}`,name,description,price:0,oldPrice:0,offer:false,categoryId,subcategory:'',dimensions:'',size:'Mediano',material:'PLA',colors:'',fabrication:'2–3 días',delivery:'3–5 días hábiles',sku:`MW-${id}`,status:'Próximamente',stock:0,unlimited:true,lowStock:3,featured:false,isNew:true,recommended:false,published:false,extra:`Fuente: ${source}\nLicencia: ${license}${creator?`\nDiseñador: ${creator}`:''}`,images,createdAt:now,popularity:0});
 return product;
}
