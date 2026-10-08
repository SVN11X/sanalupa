import Fuse from 'fuse.js';
import {normalize, ALL_COMMUNES,CORE_COMMUNES,distanceKm, type Point} from './geo';
import type {Catalog,ProfessionalType,RatingType,SiteType} from './schema';
export const SPECIALTIES = [
 {name:'Cardiología',aliases:['cardiologo','cardiologa','cardiologia']},{name:'Traumatología',aliases:['traumatologo','traumatologa','traumatologia']},
 {name:'Pediatría',aliases:['pediatra','pediatria']},{name:'Medicina general',aliases:['medico general','medicina general']},
 {name:'Dermatología',aliases:['dermatologo','dermatologa','dermatologia']},{name:'Neurología',aliases:['neurologo','neurologa','neurologia']},
 {name:'Oftalmología',aliases:['oftalmologo','oftalmologa','oftalmologia']},{name:'Ginecología y obstetricia',aliases:['ginecologo','ginecologa','ginecologia','obstetricia']},
 {name:'Psiquiatría',aliases:['psiquiatra','psiquiatria']},{name:'Urología',aliases:['urologo','urologa','urologia']},
 {name:'Odontología',aliases:['dentista','odontologo','odontologa','odontologia']},{name:'Psicología',aliases:['psicologo','psicologa','psicologia']},{name:'Kinesiología',aliases:['kinesiologo','kinesiologa','kinesiologia']},
 {name:'Endocrinología',aliases:['endocrinologo','endocrinologa','endocrinologia','endocrino']},{name:'Gastroenterología',aliases:['gastroenterologo','gastroenterologa','gastroenterologia','gastro']}
];
export function editDistance(a:string,b:string):number{const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[b.length];}
export function parseQuery(query:string){
 let rest=normalize(query);let commune:string|null=null;let specialty:string|null=null;
 const consume=(aliases:{name:string;aliases:string[]}[])=>{for(const entry of aliases.sort((a,b)=>b.name.length-a.name.length)){for(const a of entry.aliases){const words=rest.split(' ');const n=a.split(' ').length;for(let i=0;i<=words.length-n;i++){const candidate=words.slice(i,i+n).join(' ');if(candidate===a||(a.length>=6&&editDistance(candidate,a)<=1)){rest=[...words.slice(0,i),...words.slice(i+n)].join(' ');return entry.name;}}}}return null;};
 commune=consume(ALL_COMMUNES.map(c=>({name:c,aliases:[normalize(c)]})));specialty=consume(SPECIALTIES.map(s=>({name:s.name,aliases:s.aliases})));
 rest=rest.replace(/\b(en|de|el|la|un|una|busco|necesito|profesional|medico|doctora|doctor)\b/g,' ').replace(/\s+/g,' ').trim();
 return {text:rest,commune,specialty};
}
/** Centro cartografiado: todo lo que no sea una consulta (practice) de un profesional publicada por una plataforma. */
export function centerSites(c:Catalog):SiteType[]{const linked=new Set(c.professionals.flatMap(p=>p.siteIds));return c.sites.filter(s=>s.active&&!(s.kind==='practice'&&linked.has(s.id)));}
export type Result={id:string;memberIds:string[];entityType:'professional'|'site';name:string;profession:string|null;specialties:string[];sites:SiteType[];professional:ProfessionalType|null;distance:number|null;ratings:RatingType[]};
export function resultsFromCatalog(c:Catalog,mode:'professional'|'site',origin:Point|null):Result[]{
 if(mode==='professional')return groupProfessionals(c).map(group=>{
  // Una ficha por persona: si dos plataformas cumplen las reglas estrictas de identidad, se muestran juntas,
  // pero cada valoración conserva su fuente y su escala (nunca se promedian entre fuentes).
  const p=group.length===1?group[0]:{...group[0],siteIds:[...new Set(group.flatMap(x=>x.siteIds))],profileLinks:group.flatMap(x=>x.profileLinks),specialties:[...new Map(group.flatMap(x=>x.specialties).map(s=>[normalize(s.name),s])).values()]};
  const ids=new Set(group.map(x=>x.id));
  const sites=c.sites.filter(s=>s.active&&p.siteIds.includes(s.id));const ds=sites.map(s=>distanceKm(origin,s.location)).filter((d):d is number=>d!==null);
  return {id:p.id,memberIds:[...ids],entityType:'professional',name:p.name.value,profession:p.profession.value,specialties:p.specialties.map(s=>s.name),sites,professional:p,distance:ds.length?Math.min(...ds):null,ratings:c.ratings.filter(r=>r.entityType==='professional'&&ids.has(r.entityId))};
 });
 // La pestaña Centros muestra solo centros cartografiados; las consultas de plataformas (tipo practice) se ven dentro de cada profesional.
 return centerSites(c).map(s=>({id:s.id,memberIds:[s.id],entityType:'site',name:s.name.value,profession:null,specialties:s.services.map(x=>x.value),sites:[s],professional:null,distance:distanceKm(origin,s.location),ratings:c.ratings.filter(r=>r.entityType==='site'&&r.entityId===s.id)}));
}
export function bayesianScore(r:RatingType,group:RatingType[],m=20,minCount=5):number|null{
 // Ajuste por volumen: acerca al promedio de su grupo (misma fuente y especialidad) a quien tiene pocas opiniones.
 if(!r.mayDerive||r.score===null||!Number.isFinite(m)||m<=0||r.totalCount<minCount)return null;
 const peers=group.filter(x=>x.mayDerive&&x.score!==null&&x.entityType==='professional'&&x.sourceId===r.sourceId&&x.comparableGroup===r.comparableGroup&&x.scaleMin===r.scaleMin&&x.scaleMax===r.scaleMax&&x.totalCount>0);
 if(r.entityType!=='professional'||peers.length<3)return null;
 const count=peers.reduce((v,x)=>v+x.totalCount,0);const c=peers.reduce((v,x)=>v+x.score!*x.totalCount,0)/count;
 return r.totalCount/(r.totalCount+m)*r.score+m/(r.totalCount+m)*c;
}
export type Filters={query:string;commune:string;specialty:string;profession:string;verified:boolean;favoritesOnly:boolean;expanded:boolean;sort:'name'|'distance'|'rating';ratingSource:string;minCount:number};
/** Fuente usada para ordenar si no se elige: la que tiene más valoraciones de profesionales con permiso de derivación. */
export function defaultRatingSource(ratings:RatingType[]):string{const n=new Map<string,number>();for(const r of ratings)if(r.entityType==='professional'&&r.mayDerive)n.set(r.sourceId,(n.get(r.sourceId)??0)+1);return [...n.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??'';}
export function searchResults(rows:Result[],f:Filters,favorites:string[],ratings:RatingType[]){
 const p=parseQuery(f.query);const commune=f.commune||p.commune,specialty=f.specialty||p.specialty;
 let results=rows.filter(r=>(f.expanded||r.sites.some(s=>s.commune&&CORE_COMMUNES.some(c=>c===s.commune?.value))||!r.sites.length||r.sites.some(s=>!s.commune))&&(!commune||r.sites.some(s=>s.commune?.value===commune))&&(!specialty||r.specialties.some(s=>normalize(s)===normalize(specialty)))&&(!f.profession||r.profession===f.profession)&&(!f.verified||r.professional?.credentials.status==='verified')&&(!f.favoritesOnly||favorites.includes(r.id)));
 if(p.text){const fuse=new Fuse(results,{keys:['name','profession','specialties','sites.name.value','sites.address.value'],threshold:0.34,ignoreLocation:true,getFn:(obj,path)=>{const val=Fuse.config.getFn(obj,path);return Array.isArray(val)?val.map(x=>normalize(String(x))):normalize(String(val??''));}});results=fuse.search(p.text).map(x=>x.item);}
 const source=f.ratingSource||defaultRatingSource(ratings);
 const cache=new Map<string,number|null>();
 const own=(r:Result)=>r.ratings.find(x=>x.sourceId===source);
 const score=(r:Result)=>{if(!cache.has(r.id)){const v=own(r);cache.set(r.id,v?bayesianScore(v,ratings,20,f.minCount):null);}return cache.get(r.id)!;};
 return results.sort((a,b)=>{if(f.sort==='distance'){const d=(a.distance??Infinity)-(b.distance??Infinity);if(d&&!Number.isNaN(d))return d;}if(f.sort==='rating'){const d=(score(b)??-Infinity)-(score(a)??-Infinity);if(d&&!Number.isNaN(d))return d;const n=(own(b)?.totalCount??-1)-(own(a)?.totalCount??-1);if(n)return n;}return a.name.localeCompare(b.name,'es');});
}
/** Nombre de persona normalizado, sin títulos. */
export const personKey=(name:string)=>normalize(name.replace(/^\s*(dr|dra|doctor|doctora)\.?\s+/i,''));
/** Calle + número normalizados, para comparar direcciones de consulta. */
export function streetNumberKey(address:string|null|undefined):string|null{if(!address)return null;const n=normalize(address).replace(/\b(avenida|av|calle|pasaje|psje)\b/g,' ').replace(/\s+/g,' ').trim();const m=n.match(/^(.*?\D)\s*(\d+)\b/);return m?m[1].trim()+' '+m[2]:null;}
/**
 * ¿Son la misma persona? Solo se unen fichas si:
 * a) ambas tienen el mismo número de registro oficial (RNPI) con evidencia oficial, o
 * b) coinciden el nombre completo con ambos apellidos (3 palabras o más), la profesión, al menos una especialidad
 *    y al menos una dirección de consulta (calle y número).
 * Nunca se unen solo por nombre: los homónimos quedan como fichas separadas.
 */
export function sameIdentity(a:ProfessionalType,b:ProfessionalType,sites:SiteType[]=[]):boolean{
 if(a.credentials.registryNumber&&b.credentials.registryNumber){
  const official=a.credentials.evidence?.statement==='official'&&b.credentials.evidence?.statement==='official';
  return official&&a.credentials.registryNumber===b.credentials.registryNumber&&personKey(a.name.value)===personKey(b.name.value);
 }
 const na=personKey(a.name.value),nb=personKey(b.name.value);
 if(na!==nb||na.split(' ').length<3)return false;
 if(normalize(a.profession.value)!==normalize(b.profession.value))return false;
 const sa=new Set(a.specialties.map(s=>normalize(s.name)));if(!b.specialties.some(s=>sa.has(normalize(s.name))))return false;
 const addr=(p:ProfessionalType)=>new Set(sites.filter(s=>p.siteIds.includes(s.id)).map(s=>{const k=streetNumberKey(s.address?.value);return k&&s.commune?k+'|'+normalize(s.commune.value):null;}).filter((x):x is string=>!!x));
 const aa=addr(a);return [...addr(b)].some(k=>aa.has(k));
}

const sourceOf=(id:string)=>id.split(':')[0];
/** Agrupa profesionales de plataformas distintas que cumplen sameIdentity. Los demás quedan como fichas separadas. */
export function groupProfessionals(c:Catalog):ProfessionalType[][]{
 const active=c.professionals.filter(p=>p.active);
 const parent=new Map(active.map(p=>[p.id,p.id]));
 const find=(id:string):string=>{let r=id;while(parent.get(r)!==r)r=parent.get(r)!;return r;};
 const buckets=new Map<string,ProfessionalType[]>();
 for(const p of active){const k=personKey(p.name.value);buckets.set(k,[...(buckets.get(k)??[]),p]);}
 for(const list of buckets.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const a=list[i],b=list[j];if(sourceOf(a.id)===sourceOf(b.id))continue;
  if(sameIdentity(a,b,c.sites)){const ra=find(a.id),rb=find(b.id);if(ra!==rb)parent.set(rb,ra);}
 }
 const groups=new Map<string,ProfessionalType[]>();for(const p of active){const r=find(p.id);groups.set(r,[...(groups.get(r)??[]),p]);}
 return [...groups.values()];
}
