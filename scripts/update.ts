import {assertPublishable} from './publication-policy';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {CatalogSchema} from '../src/schema';
import {createFetcher,ProviderError} from './network';
import {normalizeOSM} from './adapters/osm';
import {atomicPublish,changes,mayKeepPrevious} from './publish';
const path='public/data/catalog.json';const old=CatalogSchema.parse(JSON.parse(await readFile(path,'utf8')));
const remote=process.env.ENABLE_OVERPASS==='true';const local=process.env.OSM_INPUT;
let report:Record<string,unknown>={startedAt:new Date().toISOString(),mode:local?'local_snapshot':remote?'overpass':'validate_only'};
try{
 if(!local&&!remote){report={...report,status:'not_requested',processed:old.sites.length,added:[],changed:[],removed:[],note:'Validated without requests or advancing the catalogue date.'};}
 else{
  const conf=JSON.parse(await readFile('scripts/providers.json','utf8'));
  let input:unknown;let checkedAt:string;
  if(local){
   if(/(^|[\\/])tests([\\/]|$)|fixtures/.test(local))throw new ProviderError('test_fixture_not_publishable');
   const snapshot=JSON.parse(await readFile(local,'utf8'));
   if(snapshot.license!=='ODbL-1.0'||!snapshot.checkedAt||!Number.isFinite(Date.parse(snapshot.checkedAt)))throw new ProviderError('snapshot_metadata_required');
   input=snapshot;checkedAt=snapshot.checkedAt;
  }else{
   const policy=conf.overpass;if(!policy.enabled||!policy.mayPublish)throw new ProviderError('provider_disabled_pending_policy_review');
   if(Date.now()-Date.parse(policy.reviewedAt)>90*86400000)throw new ProviderError('terms_review_required');
   const request=createFetcher({...policy,userAgent:'SaludCercaSantiago/1.0 ('+(process.env.APP_URL||'local-maintenance')+'; curated ODbL POIs)'});
   const ids=JSON.parse(await readFile('public/data/osm-selection.json','utf8')) as {nodes:number[];ways:number[]};
   const query='[out:json][timeout:20];('+ (ids.nodes.length?'node(id:'+ids.nodes.join(',')+');':'')+(ids.ways.length?'way(id:'+ids.ways.join(',')+');':'')+');out center meta;';
   input=JSON.parse(await request(policy.endpoint+'?data='+encodeURIComponent(query)));checkedAt=new Date().toISOString();
  }
  const parts=normalizeOSM(input,checkedAt);
  const missing=old.sites.filter(s=>s.id.startsWith('osm:')&&!parts.sites.some(n=>n.id===s.id));
  if(missing.length)throw new ProviderError('missing_records_require_retirement_review');
  // Preserve separately checked contact links only if the original POI identity and address agree.
  parts.sites=parts.sites.map(s=>{const before=old.sites.find(x=>x.id===s.id&&x.name.value===s.name.value&&x.address?.value===s.address?.value);return before?{...s,contactUrl:before.contactUrl,bookingUrl:before.bookingUrl}:s;});
  const retainedOrg=old.organizations.filter(o=>!o.id.startsWith('org:osm:'));const retainedSites=old.sites.filter(s=>!s.id.startsWith('osm:'));
  const candidate={...old,sites:[...retainedSites,...parts.sites],organizations:[...retainedOrg,...parts.organizations],publishedAt:checkedAt};assertPublishable(candidate);const next=await atomicPublish(path,candidate,old);
  report={...report,status:'published',processed:next.sites.length,...changes(old,next)};
 }
}catch(e){const allowed=mayKeepPrevious(old);if(!allowed){await atomicPublish(path,{...old,professionals:[],organizations:[],sites:[],ratings:[],publishedAt:new Date().toISOString()},null);}
 report={...report,status:'failed',previousRetained:allowed,publishedAt:old.publishedAt,reason:e instanceof ProviderError?e.reason:'validation_or_publication_failed'};process.exitCode=1;
}
await mkdir('reports',{recursive:true});await writeFile('reports/update.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
