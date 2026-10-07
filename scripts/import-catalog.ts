import {assertPublishable} from './publication-policy';
// Admin-only local import. Sources and field evidence must already be authorized and documented.
import {readFile} from 'node:fs/promises';import {CatalogSchema} from '../src/schema';import {atomicPublish} from './publish';
const input=process.argv[2];if(!input||/(^|[\\/])tests([\\/]|$)|fixtures/.test(input))throw new Error('Supply an authorized catalogue file outside tests; see docs/AMPLIAR.md');
const raw=JSON.parse(await readFile(input,'utf8'));const candidate=CatalogSchema.parse(raw);const old=CatalogSchema.parse(JSON.parse(await readFile('public/data/catalog.json','utf8')));
assertPublishable(candidate);await atomicPublish('public/data/catalog.json',candidate,old);console.log(JSON.stringify({status:'published',professionals:candidate.professionals.length,sites:candidate.sites.length,ratings:candidate.ratings.length}));
