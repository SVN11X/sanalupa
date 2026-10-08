// SYNTHETIC FIXTURES. Never used by seed/build/public catalogue. Names are explicitly fictional.
import type {Catalog,ProfessionalType,RatingType} from '../../src/schema';
export function syntheticCatalog():Catalog{
 const ev={sourceId:'fixture',url:'https://example.org/evidence/fictional-registry',checkedAt:'2026-10-07',sourceUpdatedAt:null,statement:'official' as const};
 const fact=(value:string)=>({value,evidence:ev});
 const sites=[{id:'fixture:site:1',organizationId:'fixture:org:1',name:fact('Centro SINTÉTICO A'),address:fact('Dirección FICTICIA 1'),commune:fact('Ñuñoa'),location:{lat:-33.455,lon:-70.6,precision:'approximate' as const,evidence:ev},contactUrl:fact('https://example.org/contact-fictional'),bookingUrl:null,priceCLP:null,agreements:null,kind:'clinic' as const,services:[],active:true}, {id:'fixture:site:2',organizationId:'fixture:org:2',name:fact('Centro SINTÉTICO B'),address:null,commune:fact('Providencia'),location:null,contactUrl:null,bookingUrl:null,priceCLP:null,agreements:null,kind:'clinic' as const,services:[],active:true}];
 const professionals:ProfessionalType[]=['Ana FICTICIA Uno','Ana FICTICIA Dos','Luis FICTICIO Tres'].map((name,i)=>({id:'fixture:professional:'+i,name:fact(name),profession:fact('Médico cirujano'),specialties:[{name:i===1?'Traumatología':'Cardiología',kind:'registered',evidence:ev}],siteIds:[i===1?'fixture:site:2':'fixture:site:1'],credentials:{status:'verified',evidence:ev,checkedAt:'2026-10-07',scope:'Título y especialidad FICTICIOS',registryNumber:null},identityEvidence:{...ev,url:'https://example.org/fictional-registry/'+i},profileLinks:[],active:true}));
 const ratings:RatingType[]=professionals.map((p,i)=>({id:'fixture:rating:'+i,entityType:'professional',entityId:p.id,sourceId:'fixture',score:[4.8,4.2,4.6][i],scaleMin:1,scaleMax:5,totalCount:[2,40,100][i],sampleCount:2,extractedAt:'2026-10-07',latestReviewAt:null,url:'https://example.org/fictional-ratings/'+i,comparableGroup:'test-only',mayDerive:true}));
 return {schemaVersion:1,publishedAt:'2026-10-07',geography:'SYNTHETIC TEST ONLY',sources:[{id:'fixture',name:'SOURCE SYNTHETIC TEST ONLY',owner:'TEST FIXTURE',url:'https://example.org/',policyUrl:'https://example.org/test-only-license',status:'enabled',license:'TEST-ONLY',mayPublish:true,mayRetain:true,mayDerive:true,reviewedAt:'2026-10-07',attribution:'SYNTHETIC, NOT REAL PROFESSIONALS',notes:'Isolated tests only'}],professionals,organizations:[{id:'fixture:org:1',name:fact('Organización FICTICIA A')},{id:'fixture:org:2',name:fact('Organización FICTICIA B')}],sites,ratings,removedIds:[]};
}

/** Catálogo real de centros + profesionales FICTICIOS con valoraciones simuladas (solo para e2e). */
export function syntheticRatingsCatalog(real:Catalog):Catalog{
 const checked='2026-10-08T00:00:00.000Z';
 const source={id:'doctoralia',name:'Doctoralia Chile',owner:'TEST FIXTURE FICTICIO',url:'https://www.doctoralia.cl/',policyUrl:'https://www.doctoralia.cl/terminos-y-condiciones',status:'enabled' as const,license:'Términos de uso de Doctoralia Chile (no es una licencia abierta)',mayPublish:true,mayRetain:true,mayDerive:true,reviewedAt:'2026-10-08',attribution:'FICTICIO',notes:'SYNTHETIC TEST ONLY'};
 const people:[string,string,string,string,number|null,number|null,string,number,number][]=[
  ['ana-ficticia','Ana FICTICIA Cuatro Ocho','Cardiología','cardiologo',4.8,200,'Providencia',-33.432,-70.618],
  ['beto-ficticio','Beto FICTICIO Cuatro Cinco','Cardiología','cardiologo',4.5,40,'Ñuñoa',-33.456,-70.598],
  ['carla-ficticia','Carla FICTICIA Cuatro','Cardiología','cardiologo',4.0,90,'Santiago',-33.44,-70.65],
  ['dario-ficticio','Dario FICTICIO Cinco Dos','Cardiología','cardiologo',5.0,2,'Las Condes',-33.41,-70.57],
  ['elena-ficticia','Elena FICTICIA Sin Opiniones','Pediatría','pediatra',null,null,'Providencia',-33.425,-70.61],
 ];
 const ev={sourceId:'doctoralia',checkedAt:checked,sourceUpdatedAt:null};
 const c:Catalog=structuredClone(real);
 c.sources=c.sources.map(s=>s.id==='doctoralia'?source:s);
 for(const [slug,name,spec,specSlug,score,count,commune,lat,lon] of people){
  const url='https://www.doctoralia.cl/perfil/'+slug;const e={...ev,url,statement:'declared' as const};const sr={...e,statement:'source_record' as const};
  const siteId='doctoralia:site:'+slug,orgId='org:doctoralia:'+slug;
  c.organizations.push({id:orgId,name:{value:'Consulta FICTICIA '+name,evidence:sr}});
  c.sites.push({id:siteId,organizationId:orgId,name:{value:'Consulta FICTICIA '+name,evidence:sr},address:{value:'Calle Ficticia '+(c.sites.length+1),evidence:sr},commune:{value:commune,evidence:sr},location:{lat,lon,precision:'approximate',evidence:sr},contactUrl:null,bookingUrl:null,priceCLP:null,agreements:null,kind:'practice',services:[],active:true});
  c.professionals.push({id:'doctoralia:'+slug,name:{value:name,evidence:e},profession:{value:'Médico',evidence:e},specialties:[{name:spec,kind:'advertised',evidence:e}],siteIds:[siteId],credentials:{status:'pending',evidence:null,checkedAt:null,scope:null,registryNumber:null},identityEvidence:e,profileLinks:[{value:url,evidence:sr}],active:true});
  if(count!==null)c.ratings.push({id:'doctoralia:rating:'+slug,entityType:'professional',entityId:'doctoralia:'+slug,sourceId:'doctoralia',score,scaleMin:1,scaleMax:5,totalCount:count,sampleCount:null,extractedAt:checked,latestReviewAt:null,url:url+'#profile-reviews',comparableGroup:'doctoralia:'+specSlug,mayDerive:true});
 }
 c.publishedAt=checked;
 return c;
}
