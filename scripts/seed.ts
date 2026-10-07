// Rebuild only from the minimal real ODbL extract checked on 2026-10-07; never uses test fixtures.
import {readFile,writeFile} from 'node:fs/promises';import {normalizeOSM} from './adapters/osm';import {CatalogSchema} from '../src/schema';
const checked='2026-10-07';const raw=JSON.parse(await readFile('docs/osm-extract.json','utf8'));
const s=(id:string,name:string,owner:string,url:string,policyUrl:string,status:'enabled'|'pending'|'incompatible'|'discarded',license:string|null,notes:string)=>({id,name,owner,url,policyUrl,status,license,mayPublish:id==='osm',mayRetain:id==='osm',mayDerive:false,reviewedAt:checked,attribution:id==='osm'?'© OpenStreetMap contributors':'Enlace externo; sin respaldo institucional',notes});
const contacts=JSON.parse(await readFile('docs/contact-checks.json','utf8'));const checkedContacts=Object.fromEntries(contacts.checks.map((r:{id:string;osmWebsite:string})=>[r.id,r.osmWebsite]));
const sources=[
 s('osm','OpenStreetMap','OpenStreetMap contributors / OSMF','https://www.openstreetmap.org/','https://www.openstreetmap.org/copyright','enabled','ODbL-1.0','18 centros cartografiados. No acredita profesionales ni confirma atención actual.'),
 s('rnpi','Registro oficial de prestadores','Superintendencia de Salud','https://rnpi.superdesalud.gob.cl/','https://apis-documentacion.superdesalud.gob.cl/_sections/02-intro.html','pending',null,'Consulta manual gratuita. API exige solicitud formal; importación desactivada.'),
 s('doctoralia','Doctoralia Chile','Doctoralia Internet SL','https://www.doctoralia.cl/','https://www.doctoralia.cl/terminos-y-condiciones','pending',null,'Sin autorización de agregación. Solo enlace externo.'),
 s('redsalud','Buscador institucional','Empresas Red Salud S.A.','https://www.redsalud.cl/buscador-de-medicos','https://www.redsalud.cl/assets/media/tyc-pagina-web.pdf','pending',null,'Reproducción requiere autorización. Los nombres de centros en este catálogo proceden de OSM.'),
 s('ucchristus','UC CHRISTUS','Red de Salud UC CHRISTUS','https://www.ucchristus.cl/','https://www.ucchristus.cl/docs/default-source/pdf/condiciones-de-uso-web.pdf?sfvrsn=7e016a4a_2','pending',null,'No se obtuvo permiso para publicar su directorio.'),
 s('google','Google Places','Google','https://developers.google.com/maps/documentation/places/web-service/','https://cloud.google.com/maps-platform/terms','incompatible',null,'Requiere facturación. Sus datos no se incorporan a OSM ni a este catálogo.'),
 s('apify','Apify','Apify','https://apify.com/pricing','https://apify.com/pricing','discarded',null,'Créditos gratuitos limitados; no conceden derechos sobre otras fuentes.'),
 s('outscraper','Outscraper','Outscraper','https://outscraper.com/pricing/','https://outscraper.com/pricing/','discarded',null,'Tramos gratuitos limitados; sin permiso de reutilización de la fuente original.')
];
const c=CatalogSchema.parse({schemaVersion:1,publishedAt:checked,geography:'37 comunas: criterio funcional INE 2020; ampliación seleccionable a 52 comunas RM',sources,...normalizeOSM(raw,checked,checkedContacts),professionals:[],ratings:[],removedIds:[]});
await writeFile('public/data/catalog.json',JSON.stringify(c,null,2)+'\n');console.log({sites:c.sites.length,professionals:c.professionals.length});
