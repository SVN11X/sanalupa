import {readFile,writeFile,rename,mkdir,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {CatalogSchema,type Catalog} from '../src/schema';
export async function atomicPublish(path:string,candidate:unknown,previous:Catalog|null,commit=rename){
 const valid=CatalogSchema.parse(candidate);
 if(previous?.sites.length&&valid.sites.length<previous.sites.length*0.75)throw new Error('large_drop_requires_manual_review');
 await mkdir(dirname(path),{recursive:true});const tmp=path+'.'+process.pid+'.tmp';
 try{await writeFile(tmp,JSON.stringify(valid,null,2)+'\n',{flag:'wx'});CatalogSchema.parse(JSON.parse(await readFile(tmp,'utf8')));await commit(tmp,path);}finally{await rm(tmp,{force:true});}
 return valid;
}
export function mayKeepPrevious(c:Catalog){const used=new Set<string>();const walk=(v:unknown)=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(walk);return;}const o=v as Record<string,unknown>;if(typeof o.sourceId==='string')used.add(o.sourceId);Object.values(o).forEach(walk);};[c.sites,c.professionals,c.organizations,c.ratings].forEach(walk);return [...used].every(id=>c.sources.some(s=>s.id===id&&s.mayRetain));}
export function changes(a:Catalog,b:Catalog){const flatten=(c:Catalog)=>[...c.sites,...c.professionals,...c.organizations,...c.ratings];const old=new Map(flatten(a).map(x=>[x.id,JSON.stringify(x)])),next=new Map(flatten(b).map(x=>[x.id,JSON.stringify(x)]));return {added:[...next.keys()].filter(id=>!old.has(id)),changed:[...next.keys()].filter(id=>old.has(id)&&old.get(id)!==next.get(id)),removed:[...old.keys()].filter(id=>!next.has(id))};}
