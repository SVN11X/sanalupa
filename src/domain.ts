import Fuse from 'fuse.js';
import {normalize, ALL_COMMUNES,CORE_COMMUNES,distanceKm, type Point} from './geo';
import type {Catalog,ProfessionalType,RatingType,SiteType} from './schema';
export const SPECIALTIES = [
 {name:'Cardiología',aliases:['cardiologo','cardiologa','cardiologia']},{name:'Traumatología',aliases:['traumatologo','traumatologa','traumatologia']},
 {name:'Pediatría',aliases:['pediatra','pediatria']},{name:'Medicina general',aliases:['medico general','medicina general']},
 {name:'Dermatología',aliases:['dermatologo','dermatologa','dermatologia']},{name:'Neurología',aliases:['neurologo','neurologa','neurologia']},
 {name:'Oftalmología',aliases:['oftalmologo','oftalmologa','oftalmologia']},{name:'Ginecología y obstetricia',aliases:['ginecologo','ginecologa','ginecologia','obstetricia']},
 {name:'Psiquiatría',aliases:['psiquiatra','psiquiatria']},{name:'Urología',aliases:['urologo','urologa','urologia']},
 {name:'Odontología',aliases:['dentista','odontologo','odontologa','odontologia']},{name:'Psicología',aliases:['psicologo','psicologa','psicologia']},{name:'Kinesiología',aliases:['kinesiologo','kinesiologa','kinesiologia']}
];
export function editDistance(a:string,b:string):number{const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[b.length];}
export function parseQuery(query:string){
 let rest=normalize(query);let commune:string|null=null;let specialty:string|null=null;
 const consume=(aliases:{name:string;aliases:string[]}[])=>{for(const entry of aliases.sort((a,b)=>b.name.length-a.name.length)){for(const a of entry.aliases){const words=rest.split(' ');const n=a.split(' ').length;for(let i=0;i<=words.length-n;i++){const candidate=words.slice(i,i+n).join(' ');if(candidate===a||(a.length>=6&&editDistance(candidate,a)<=1)){rest=[...words.slice(0,i),...words.slice(i+n)].join(' ');return entry.name;}}}}return null;};
 commune=consume(ALL_COMMUNES.map(c=>({name:c,aliases:[normalize(c)]})));specialty=consume(SPECIALTIES.map(s=>({name:s.name,aliases:s.aliases})));
 rest=rest.replace(/\b(en|de|el|la|un|una|busco|necesito|profesional|medico|doctora|doctor)\b/g,' ').replace(/\s+/g,' ').trim();
 return {text:rest,commune,specialty};
}
export type Result={id:string;entityType:'professional'|'site';name:string;profession:string|null;specialties:string[];sites:SiteType[];professional:ProfessionalType|null;distance:number|null;ratings:RatingType[]};
export function resultsFromCatalog(c:Catalog,mode:'professional'|'site',origin:Point|null):Result[]{
 if(mode==='professional')return c.professionals.filter(p=>p.active).map(p=>{const sites=c.sites.filter(s=>s.active&&p.siteIds.includes(s.id));const ds=sites.map(s=>distanceKm(origin,s.location)).filter((d):d is number=>d!==null);return {id:p.id,entityType:'professional',name:p.name.value,profession:p.profession.value,specialties:p.specialties.map(s=>s.name),sites,professional:p,distance:ds.length?Math.min(...ds):null,ratings:c.ratings.filter(r=>r.entityType==='professional'&&r.entityId===p.id)};});
 return c.sites.filter(s=>s.active).map(s=>({id:s.id,entityType:'site',name:s.name.value,profession:null,specialties:s.services.map(x=>x.value),sites:[s],professional:null,distance:distanceKm(origin,s.location),ratings:c.ratings.filter(r=>r.entityType==='site'&&r.entityId===s.id)}));
}
export function bayesianScore(r:RatingType,group:RatingType[],m=20,minCount=5):number|null{
 if(!r.mayDerive||!Number.isFinite(m)||m<=0||r.totalCount<minCount)return null;
 const peers=group.filter(x=>x.mayDerive&&x.entityType==='professional'&&x.sourceId===r.sourceId&&x.comparableGroup===r.comparableGroup&&x.scaleMin===r.scaleMin&&x.scaleMax===r.scaleMax&&x.totalCount>0);
 if(r.entityType!=='professional'||peers.length<3)return null;
 const count=peers.reduce((v,x)=>v+x.totalCount,0);const c=peers.reduce((v,x)=>v+x.score*x.totalCount,0)/count;
 return r.totalCount/(r.totalCount+m)*r.score+m/(r.totalCount+m)*c;
}
export type Filters={query:string;commune:string;specialty:string;profession:string;verified:boolean;favoritesOnly:boolean;expanded:boolean;sort:'name'|'distance'|'rating';ratingSource:string;minCount:number};
export function searchResults(rows:Result[],f:Filters,favorites:string[],ratings:RatingType[]){
 const p=parseQuery(f.query);const commune=f.commune||p.commune,specialty=f.specialty||p.specialty;
 let results=rows.filter(r=>(f.expanded||r.sites.some(s=>s.commune&&CORE_COMMUNES.some(c=>c===s.commune?.value))||!r.sites.length||r.sites.some(s=>!s.commune))&&(!commune||r.sites.some(s=>s.commune?.value===commune))&&(!specialty||r.specialties.some(s=>normalize(s)===normalize(specialty)))&&(!f.profession||r.profession===f.profession)&&(!f.verified||r.professional?.credentials.status==='verified')&&(!f.favoritesOnly||favorites.includes(r.id)));
 if(p.text){const fuse=new Fuse(results,{keys:['name','profession','specialties','sites.name.value','sites.address.value'],threshold:0.34,ignoreLocation:true,getFn:(obj,path)=>{const val=Fuse.config.getFn(obj,path);return Array.isArray(val)?val.map(x=>normalize(String(x))):normalize(String(val??''));}});results=fuse.search(p.text).map(x=>x.item);}
 const score=(r:Result)=>{const v=r.ratings.find(x=>x.sourceId===f.ratingSource);return v?bayesianScore(v,ratings,20,f.minCount):null;};
 return results.sort((a,b)=>{if(f.sort==='distance'){const d=(a.distance??Infinity)-(b.distance??Infinity);if(d&&!Number.isNaN(d))return d;}if(f.sort==='rating'){const d=(score(b)??-Infinity)-(score(a)??-Infinity);if(d&&!Number.isNaN(d))return d;}return a.name.localeCompare(b.name,'es');});
}
export function sameIdentity(a:ProfessionalType,b:ProfessionalType):boolean{
 // Solo número de registro oficial compartido + fuente + nombre + profesión. Nunca URL genérica o nombre.
 return !!a.identityEvidence&&!!b.identityEvidence&&a.identityEvidence.statement==='official'&&b.identityEvidence.statement==='official'&&a.identityEvidence.sourceId===b.identityEvidence.sourceId&&!!a.credentials.registryNumber&&a.credentials.registryNumber===b.credentials.registryNumber&&normalize(a.name.value)===normalize(b.name.value)&&normalize(a.profession.value)===normalize(b.profession.value);
}
