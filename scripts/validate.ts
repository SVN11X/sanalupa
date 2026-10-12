import {assertPublishable, assertIndexPublishable} from './publication-policy';
import {readFile, readdir} from 'node:fs/promises';
import {CatalogSchema} from '../src/schema';
import {DoctoraliaIndexSchema, DoctoraliaProfileSchema, emptyIndex, mergeIndexIntoCatalog} from '../src/doctoralia';

const RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/;
const c = CatalogSchema.parse(JSON.parse(await readFile('public/data/catalog.json', 'utf8')));
assertPublishable(c);

// Índice de Doctoralia (opcional) y su unión con el catálogo, tal como la hace el navegador.
let rawIndex: unknown = emptyIndex();
try { rawIndex = JSON.parse(await readFile('public/data/doctoralia/indice.json', 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
const ix = DoctoraliaIndexSchema.parse(rawIndex);
assertIndexPublishable(ix);
const merged = CatalogSchema.parse(mergeIndexIntoCatalog(c, ix));

// Fichas: una por fila del índice, válidas y sin RUT. Se revisan todas (es rápido) para no publicar nada roto.
let files: string[] = [];
try { files = (await readdir('public/data/doctoralia/perfiles')).filter(f => f.endsWith('.json')); } catch { /* aún no hay fichas */ }
const have = new Set(files.map(f => f.slice(0, -5)));
const missing = ix.professionals.filter(r => !have.has(r.id)).map(r => r.id);
const rows = new Set(ix.professionals.map(r => r.id));
const orphans = [...have].filter(id => !rows.has(id));
let excluded: string[] = [];
try { excluded = (JSON.parse(await readFile('estado/doctoralia-excluidos.json', 'utf8')).slugs ?? []) as string[]; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
const published = excluded.filter(x => rows.has(x) || have.has(x));
if (published.length) throw new Error(`Perfiles excluidos siguen publicados: ${published.join(', ')}`);
if (missing.length) throw new Error(`Faltan ${missing.length} fichas de Doctoralia, por ejemplo ${missing.slice(0, 3).join(', ')}`);
let invalid = 0;
for (const f of files) {
  const text = await readFile('public/data/doctoralia/perfiles/' + f, 'utf8');
  const p = DoctoraliaProfileSchema.safeParse(JSON.parse(text));
  if (!p.success || p.data.slug + '.json' !== f || RUT.test(text)) { invalid++; if (invalid <= 3) console.error('Ficha no válida: ' + f); }
}
if (invalid) throw new Error(`${invalid} fichas de Doctoralia no son válidas`);

console.log(JSON.stringify({
  valid: true, professionals: merged.professionals.length, sites: merged.sites.length, ratings: merged.ratings.length, publishedAt: c.publishedAt,
  doctoralia: {rows: ix.professionals.length, profiles: files.length, orphanProfiles: orphans.length, generatedAt: ix.generatedAt},
}));
