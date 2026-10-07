import {assertPublishable} from './publication-policy';
import {readFile} from 'node:fs/promises';
import {CatalogSchema} from '../src/schema';
const c=CatalogSchema.parse(JSON.parse(await readFile('public/data/catalog.json','utf8')));
assertPublishable(c);
console.log(JSON.stringify({valid:true,professionals:c.professionals.length,sites:c.sites.length,ratings:c.ratings.length,publishedAt:c.publishedAt}));
