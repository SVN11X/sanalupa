import {z} from 'zod';
import {canonicalCommune} from '../../src/geo';
import {safeUrl} from '../../src/schema';
import type {Catalog, EvidenceType, SiteType} from '../../src/schema';
const Element=z.object({type:z.enum(['node','way','relation']),id:z.number().int(),lat:z.number().optional(),lon:z.number().optional(),center:z.object({lat:z.number(),lon:z.number()}).optional(),timestamp:z.string().optional(),tags:z.record(z.string(),z.string()).optional(),nodes:z.array(z.number()).optional()});
export const OsmResponse=z.object({elements:z.array(Element)});
export type OsmElement=z.infer<typeof Element>;
const serviceNames:Record<string,string>={dentistry:'Odontología',paediatrics:'Pediatría',psychiatry:'Psiquiatría',cardiology:'Cardiología',dermatology:'Dermatología',ophthalmology:'Oftalmología',plastic_surgery:'Cirugía plástica'};
export function normalizeOSM(input:unknown,checkedAt:string,checkedContacts:Record<string,string>={}):Pick<Catalog,'sites'|'organizations'>{
 const raw=OsmResponse.parse(input);if(!raw.elements.length)throw new Error('empty_or_changed_structure');const sites:SiteType[]=[];const organizations:Catalog['organizations']=[];
 const points=new Map(raw.elements.filter(e=>e.type==='node'&&e.lat!==undefined&&e.lon!==undefined).map(e=>[e.id,{lat:e.lat!,lon:e.lon!}]));
 for(const e of raw.elements){
  const t=e.tags;const name=t?.name||t?.['name:es'];if(!t||!name||!['clinic','hospital','doctors','dentist'].includes(t.amenity??t.healthcare??''))continue;
  const id=`osm:${e.type}:${e.id}`;const evidence:EvidenceType={sourceId:'osm',url:`https://www.openstreetmap.org/${e.type}/${e.id}`,checkedAt,sourceUpdatedAt:e.timestamp??null,statement:'source_record'};
  const fact=(value:string)=>({value,evidence});let point=e.lat!==undefined&&e.lon!==undefined?{lat:e.lat,lon:e.lon}:e.center??null;
  if(!point&&e.nodes?.length){const ns=[...new Set(e.nodes)].map(id=>points.get(id));if(ns.every(Boolean)){point={lat:ns.reduce((s,n)=>s+n!.lat,0)/ns.length,lon:ns.reduce((s,n)=>s+n!.lon,0)/ns.length};}}
  const address=t['addr:street']?[t['addr:street'],t['addr:housenumber'],t['addr:unit']?'oficina '+t['addr:unit']:null].filter(Boolean).join(' '):null;
  const commune=canonicalCommune(t['addr:city']);
  organizations.push({id:'org:'+id,name:fact(t.operator||name)});
  sites.push({id,organizationId:'org:'+id,name:fact(name),address:address?fact(address):null,commune:commune?fact(commune):null,location:point?{...point,precision:'approximate',evidence}:null,contactUrl:t.website&&checkedContacts[id]===t.website&&safeUrl(t.website)?fact(t.website):null,bookingUrl:null,priceCLP:null,agreements:null,kind:t.amenity==='dentist'||t.healthcare==='dentist'?'dental':t.amenity==='hospital'?'hospital':t.amenity==='doctors'?'practice':'clinic',services:[...new Set((t['healthcare:speciality']??(t.amenity==='dentist'?'dentistry':'')).split(';').map(s=>serviceNames[s]).filter(Boolean))].map(fact),active:true});
 }
 if(!sites.length)throw new Error('no_supported_healthcare_records');return {sites,organizations};
}
