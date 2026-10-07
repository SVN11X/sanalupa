// Área operativa: provincia de Santiago y 5 comunas del criterio funcional INE 2020.
export const CORE_COMMUNES = ['Santiago','Cerrillos','Cerro Navia','Conchalí','El Bosque','Estación Central','Huechuraba','Independencia','La Cisterna','La Florida','La Granja','La Pintana','La Reina','Las Condes','Lo Barnechea','Lo Espejo','Lo Prado','Macul','Maipú','Ñuñoa','Pedro Aguirre Cerda','Peñalolén','Providencia','Pudahuel','Quilicura','Quinta Normal','Recoleta','Renca','San Joaquín','San Miguel','San Ramón','Vitacura','Puente Alto','San Bernardo','Padre Hurtado','Peñaflor','Colina'] as const;
export const EXTRA_COMMUNES = ['Alhué','Buin','Calera de Tango','Curacaví','El Monte','Isla de Maipo','Lampa','María Pinto','Melipilla','Paine','Pirque','San José de Maipo','San Pedro','Talagante','Tiltil'] as const;
export const ALL_COMMUNES = [...CORE_COMMUNES,...EXTRA_COMMUNES];
export const normalize = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export const canonicalCommune = (s: string|null) => s ? ALL_COMMUNES.find(c => normalize(c) === normalize(s)) ?? null : null;
export const RM_BOUNDS = {south:-34.3,north:-32.9,west:-71.7,east:-69.7};
export type Point = {lat:number;lon:number};
export function inRegion(p:Point) {return Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.lat>=RM_BOUNDS.south && p.lat<=RM_BOUNDS.north && p.lon>=RM_BOUNDS.west && p.lon<=RM_BOUNDS.east;}
export function distanceKm(a:Point|null,b:Point|null):number|null {
 if(!a||!b||!inRegion(b)||!Number.isFinite(a.lat)||!Number.isFinite(a.lon)||Math.abs(a.lat)>90||Math.abs(a.lon)>180)return null;
 const rad=(v:number)=>v*Math.PI/180;const dl=rad(b.lat-a.lat),dn=rad(b.lon-a.lon);
 const h=Math.sin(dl/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dn/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
