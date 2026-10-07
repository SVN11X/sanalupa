import {readFile} from 'node:fs/promises';import {CatalogSchema} from '../src/schema';
const c=CatalogSchema.parse(JSON.parse(await readFile('public/data/catalog.json','utf8')));
console.log(JSON.stringify({professionals:c.professionals.length,sites:c.sites.length,unknownCommune:c.sites.filter(s=>!s.commune).length,unknownCoordinates:c.sites.filter(s=>!s.location).length,ratings:c.ratings.length,pendingSources:c.sources.filter(s=>s.status==='pending').map(s=>s.id)},null,2));
