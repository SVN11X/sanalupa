import {z} from 'zod';
import { ALL_COMMUNES, inRegion } from './geo';
export function safeUrl(v:string):boolean {
 try {const u=new URL(v);if([...u.searchParams.keys()].some(k=>/^(rut|run|patient|email|apikey|api_key|access_token|token|authorization|key)$/i.test(k))||/\/(rut|run)\//i.test(u.pathname))return false;return u.protocol==='https:' && !u.username && !u.password && u.port==='' && !/^localhost$|\.local$|\.internal$|\.test$|\.invalid$/i.test(u.hostname) && !/^[\d.]+$|:|^0x/i.test(u.hostname) && u.hostname.includes('.');} catch{return false;}
}
export const Url=z.string().refine(safeUrl,'URL pública HTTPS requerida');
const DateText=z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*Z)?$/).refine(x=>Number.isFinite(Date.parse(x)),'Fecha inválida');
export const Evidence=z.object({sourceId:z.string().min(1),url:Url,checkedAt:DateText,sourceUpdatedAt:DateText.nullable(),statement:z.enum(['source_record','declared','official','pending'])}).strict();
export const TextFact=z.object({value:z.string().min(1).max(180),evidence:Evidence}).strict();
const Location=z.object({lat:z.number(),lon:z.number(),precision:z.enum(['exact','approximate']),evidence:Evidence}).strict().refine(inRegion,'Fuera del área RM');
export const Site=z.object({id:z.string().regex(/^[a-z0-9:-]+$/),organizationId:z.string(),name:TextFact,address:TextFact.nullable(),commune:TextFact.nullable(),location:Location.nullable(),contactUrl:TextFact.nullable(),bookingUrl:TextFact.nullable(),priceCLP:z.object({value:z.number().nonnegative(),evidence:Evidence}).nullable(),agreements:z.array(TextFact).nullable(),kind:z.enum(['clinic','hospital','dental','practice']),services:z.array(TextFact),active:z.boolean()}).strict();
const Credential=z.object({status:z.enum(['verified','pending','insufficient','unverifiable']),evidence:Evidence.nullable(),checkedAt:DateText.nullable(),scope:z.string().nullable(),registryNumber:z.string().nullable()}).strict();
export const Professional=z.object({id:z.string().regex(/^[a-z0-9:-]+$/),name:TextFact,profession:TextFact,specialties:z.array(z.object({name:z.string(),kind:z.enum(['advertised','registered']),evidence:Evidence}).strict()),siteIds:z.array(z.string()),credentials:Credential,identityEvidence:Evidence.nullable(),profileLinks:z.array(TextFact),active:z.boolean(),
 /** Ofrece consulta online (dato declarado en la plataforma). Opcional: los catálogos anteriores no lo traen. */
 online:z.boolean().optional()}).strict();
const Rating=z.object({id:z.string(),entityType:z.enum(['professional','organization','site']),entityId:z.string(),sourceId:z.string(),score:z.number().nullable(),scaleMin:z.number(),scaleMax:z.number(),totalCount:z.number().int().nonnegative(),sampleCount:z.number().int().nonnegative().nullable(),extractedAt:DateText,latestReviewAt:DateText.nullable(),url:Url,comparableGroup:z.string(),mayDerive:z.boolean()}).strict();
const Source=z.object({id:z.string(),name:z.string(),owner:z.string(),url:Url,policyUrl:Url,status:z.enum(['enabled','pending','incompatible','discarded']),license:z.string().nullable(),mayPublish:z.boolean(),mayRetain:z.boolean(),mayDerive:z.boolean(),reviewedAt:DateText,attribution:z.string(),notes:z.string()}).strict();
export const CatalogSchema=z.object({schemaVersion:z.literal(1),publishedAt:DateText,geography:z.string(),sources:z.array(Source),professionals:z.array(Professional),organizations:z.array(z.object({id:z.string(),name:TextFact}).strict()),sites:z.array(Site),ratings:z.array(Rating),removedIds:z.array(z.string())}).strict().superRefine((c,ctx)=>{
 const issue=(message:string)=>ctx.addIssue({code:'custom',message});
 const sources=new Map(c.sources.map(s=>[s.id,s]));
 for(const collection of [c.sources,c.professionals,c.organizations,c.sites,c.ratings]){
  const ids=collection.map(x=>x.id);if(new Set(ids).size!==ids.length)issue('IDs duplicados');
 }
 const checkEvidence=(e:z.infer<typeof Evidence>)=>{const s=sources.get(e.sourceId);if(!s||s.status!=='enabled'||!s.mayPublish||!s.license)issue('Procedencia sin permiso de publicación: '+e.sourceId);};
 const walk=(v:unknown)=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(walk);return;} const o=v as Record<string,unknown>;if('sourceId'in o&&'statement'in o)checkEvidence(o as z.infer<typeof Evidence>);Object.values(o).forEach(walk);};
 [...c.professionals,...c.organizations,...c.sites].forEach(walk);
 // Índices para que las comprobaciones sean lineales: el catálogo puede tener decenas de miles de registros.
 const orgIds=new Set(c.organizations.map(o=>o.id)),siteIds=new Set(c.sites.map(x=>x.id)),proIds=new Set(c.professionals.map(p=>p.id));
 for(const s of c.sites){
  if(!orgIds.has(s.organizationId))issue('Organización inexistente');
  if(s.commune && !ALL_COMMUNES.some(x=>x===s.commune?.value))issue('Comuna desconocida');
  if(s.contactUrl&&!safeUrl(s.contactUrl.value)||s.bookingUrl&&!safeUrl(s.bookingUrl.value))issue('Contacto inseguro');
 }
 for(const p of c.professionals){
  if(p.siteIds.some(id=>!siteIds.has(id)))issue('Sede inexistente');
  if(p.credentials.status==='verified'&&(!p.credentials.evidence||p.credentials.evidence.statement!=='official'||!p.credentials.scope||!p.credentials.checkedAt))issue('Verificación sin evidencia oficial');
  if(p.specialties.some(s=>s.kind==='registered'&&s.evidence.statement!=='official'))issue('Especialidad registrada sin evidencia oficial');
  if(!p.identityEvidence)issue('Identidad profesional sin evidencia');
  if(p.credentials.registryNumber!==null&&p.credentials.evidence?.statement!=='official')issue('Número de registro sin evidencia oficial');
 }
 const seats=new Set<string>();for(const s of c.sites){const key=[s.organizationId,s.address?.value,s.location?.lat,s.location?.lon].join('|');if(seats.has(key))issue('Sede posiblemente duplicada');seats.add(key);}
 for(const r of c.ratings){
  const s=sources.get(r.sourceId);if(!s||s.status!=='enabled'||!s.mayPublish)issue('Valoración sin autorización');
  if(r.mayDerive&&!s?.mayDerive)issue('Fuente no permite puntuación derivada');
  if(r.scaleMax<=r.scaleMin||r.score!==null&&(r.score<r.scaleMin||r.score>r.scaleMax)||r.sampleCount!==null&&r.sampleCount>r.totalCount)issue('Escala o conteo inválidos');
  const ids=r.entityType==='professional'?proIds:r.entityType==='site'?siteIds:orgIds;
  if(!ids.has(r.entityId))issue('Entidad valorada inexistente');
 }
 const text=JSON.stringify(c);if(/\b\d{7,8}-[\dkK]\b|HF_TOKEN|AIza[\w-]{20}|ghp_[\w]{20}|BEGIN PRIVATE KEY/.test(text))issue('Identificador sensible o secreto');
});
export type Catalog=z.infer<typeof CatalogSchema>;
export type ProfessionalType=z.infer<typeof Professional>;
export type SiteType=z.infer<typeof Site>;
export type EvidenceType=z.infer<typeof Evidence>;
export type RatingType=z.infer<typeof Rating>;
