import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
export type FetchPolicy={domains:string[];maxRequests:number;minIntervalMs:number;timeoutMs:number;retries:number;maxBytes:number;userAgent:string};
export class ProviderError extends Error{constructor(public reason:string){super(reason);}}
export function privateIP(ip:string){
 if(isIP(ip)===6)return !/^[23][0-9a-f]{3}:/i.test(ip); // IPv6 global unicast only; reject mapped, loopback, ULA, link local.
 const n=ip.split('.').map(Number);return n.length!==4||n[0]===0||n[0]===10||n[0]===127||n[0]>=224||n[0]===169&&n[1]===254||n[0]===172&&n[1]>=16&&n[1]<=31||n[0]===192&&n[1]===168||n[0]===100&&n[1]>=64&&n[1]<=127;
}
export async function guardDestination(raw:string,domains:string[],resolver=lookup){
 const u=new URL(raw);if(u.protocol!=='https:'||u.port||u.username||u.password||!domains.includes(u.hostname))throw new ProviderError('destination_not_allowed');
 const addresses=await resolver(u.hostname,{all:true});if(!addresses.length||addresses.some(a=>privateIP(a.address)))throw new ProviderError('private_destination');return u;
}
export function createFetcher(p:FetchPolicy,deps:{fetch?:typeof fetch;wait?:(ms:number)=>Promise<void>;guard?:typeof guardDestination}={}){
 let requests=0,last=0,suspended:string|null=null;const call=deps.fetch??fetch,wait=deps.wait??(ms=>new Promise(r=>setTimeout(r,ms))),guard=deps.guard??guardDestination;
 return async(raw:string,init:RequestInit={})=>{
  if(suspended)throw new ProviderError(suspended);await guard(raw,p.domains);
  for(let attempt=0;attempt<=p.retries;attempt++){
   if(requests>=p.maxRequests)throw new ProviderError('quota_exhausted');const delay=p.minIntervalMs-(Date.now()-last);if(delay>0)await wait(delay);
   requests++;last=Date.now();let response:Response;
   try {response=await call(raw,{...init,redirect:'error',signal:AbortSignal.timeout(p.timeoutMs),headers:{...init.headers,'User-Agent':p.userAgent,Accept:'application/json'}});}catch{if(attempt<p.retries){await wait(1500);continue;}suspended='network_or_timeout';throw new ProviderError(suspended);}
   if([401,403,406].includes(response.status)){suspended='access_denied';throw new ProviderError(suspended);}
   if(response.status===429){
    // Suspend this run. Honor Retry-After by making no further request; no endpoint rotation.
    const h=response.headers.get('Retry-After');const until=h&&/^\d+$/.test(h)?Date.now()+Number(h)*1000:h?Date.parse(h):Date.now()+30000;
    suspended='rate_limited_until_'+new Date(Number.isFinite(until)?until:Date.now()+30000).toISOString();throw new ProviderError(suspended);
   }
   if(!response.ok){if(response.status>=500&&attempt<p.retries){await wait(1500);continue;}throw new ProviderError('http_'+response.status);}
   if(Number(response.headers.get('content-length'))>p.maxBytes)throw new ProviderError('response_too_large');
   const reader=response.body?.getReader();if(!reader)throw new ProviderError('empty_response');let size=0;const chunks:Uint8Array[]=[];
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>p.maxBytes){await reader.cancel();throw new ProviderError('response_too_large');}chunks.push(value);}
   const bytes=new Uint8Array(size);let pos=0;for(const b of chunks){bytes.set(b,pos);pos+=b.length;}return new TextDecoder().decode(bytes);
  }throw new ProviderError('retry_exhausted');
 };
}
