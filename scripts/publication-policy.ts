import type {Catalog} from '../src/schema';
export function assertPublishable(c:Catalog){
 if(/fixture:|TEST-ONLY|SYNTHETIC|FICTICI[OA]/i.test(JSON.stringify(c)))throw new Error('Synthetic fixtures cannot be published');
}
/** El índice de Doctoralia tampoco puede contener datos de prueba. */
export function assertIndexPublishable(ix:unknown){
 if(/fixture:|TEST-ONLY|SYNTHETIC|FICTICI[OA]/i.test(JSON.stringify(ix)))throw new Error('Synthetic fixtures cannot be published');
}
