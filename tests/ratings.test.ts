import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm, readdir, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseRobots, robotsAllows, robotsCrawlDelay} from '../scripts/robots';
import {parseCount, parseScore, extractRating, load, streetKey} from '../scripts/adapters/common';
import * as doctoralia from '../scripts/adapters/doctoralia';
import * as topdoctors from '../scripts/adapters/topdoctors';
import {toCatalogParts, type ProfileItem} from '../scripts/adapters/ratings-parts';
import {mergeSource} from '../scripts/ratings-merge';
import {runRatings, sourceEntry, type SourceConfig} from '../scripts/ratings-run';
import {CatalogSchema, type Catalog} from '../src/schema';
import {sameIdentity, resultsFromCatalog, searchResults, groupProfessionals, type Filters} from '../src/domain';
import {assertPublishable} from '../scripts/publication-policy';
import * as F from './fixtures/ratings-html';

const UA = 'SaludCercaSantiago/1.0 (+https://github.com/SVN11X/sanalupa)';
const CARDIO = {slug: 'cardiologo', name: 'Cardiología', profession: 'Médico'};

// ---------- robots.txt ----------
test('robots: grupos "*" se combinan, gana la regla más larga y Allow en empate', () => {
  const r = parseRobots(F.ROBOTS_DOCTORALIA_LIKE);
  assert.equal(robotsAllows(r, UA, '/cardiologo/providencia'), true);
  assert.equal(robotsAllows(r, UA, '/perfil/ana-ficticia-uno'), true);
  assert.equal(robotsAllows(r, UA, '/stats.php'), false);
  assert.equal(robotsAllows(r, UA, '/top-ranking-de-medicos-2026'), false); // comodín *
  assert.equal(robotsAllows(r, UA, '/buscar?q=x'), false);
  assert.equal(robotsAllows(r, UA, '/cardiologo?white_label=1'), false); // patrón que empieza con *
  assert.equal(robotsAllows(r, UA, '/public/doc/cl/terminos.pdf'), false);
  assert.equal(robotsAllows(r, UA, 'https://www.doctoralia.cl/perfil/bloqueada-ficticia-robots'), false);
  assert.equal(robotsAllows(r, 'MLBot/2.0', '/cardiologo/providencia'), false); // grupo específico
  assert.equal(robotsAllows(r, 'AdsBot-Google', '/stats.php'), true); // "Disallow:" vacío
  assert.deepEqual(r.sitemaps, ['https://www.doctoralia.cl/sitemap.xml']);
  const t = parseRobots('User-agent: *\nDisallow: /a\nAllow: /a/b$\nDisallow: /*.pdf$\nCrawl-delay: 3\n# comentario\nAllow: /a/c');
  assert.equal(robotsAllows(t, UA, '/a/b'), true);
  assert.equal(robotsAllows(t, UA, '/a/b/c'), false); // $ ancla el final
  assert.equal(robotsAllows(t, UA, '/a/c'), true); // más larga gana
  assert.equal(robotsAllows(t, UA, '/x/file.pdf'), false);
  assert.equal(robotsAllows(t, UA, '/x/file.pdf?x=1'), true);
  assert.equal(robotsCrawlDelay(t, UA), 3);
  const tie = parseRobots('User-agent: *\nDisallow: /p\nAllow: /p');
  assert.equal(robotsAllows(tie, UA, '/p'), true);
  const own = parseRobots('User-agent: *\nDisallow:\n\nUser-agent: SaludCercaSantiago\nDisallow: /');
  assert.equal(robotsAllows(own, UA, '/perfil/x'), false); // nuestro agente nombrado explícitamente
});

// ---------- números ----------
test('separadores de miles y decimales chilenos', () => {
  assert.equal(parseCount('1.204 opiniones'), 1204);
  assert.equal(parseCount('12.345.678'), 12345678);
  assert.equal(parseCount('192 opiniones'), 192);
  assert.equal(parseCount('sin datos'), null);
  assert.equal(parseScore('4,8'), 4.8);
  assert.equal(parseScore('4.5'), 4.5);
  assert.equal(streetKey('Av. Manuel Montt 427, piso 9'), 'manuel montt 427');
});

// ---------- listados ----------
test('listado: excluye clínicas, previsiones y enfermedades; deduplica; detecta página siguiente', () => {
  const r = doctoralia.parseListing(F.LISTING, ['cardiologo', 'pediatra'], 1);
  assert.deepEqual(r.profiles, [
    'https://www.doctoralia.cl/perfil/ana-ficticia-uno',
    'https://www.doctoralia.cl/beto-ficticio-dos/cardiologo/santiago',
    'https://www.doctoralia.cl/perfil/carla-ficticia-tres',
    'https://www.doctoralia.cl/perfil/bloqueada-ficticia-robots',
    'https://www.doctoralia.cl/perfil/sin-datos-ficticia',
  ]);
  assert.equal(r.hasNext, true);
  assert.deepEqual(doctoralia.parseListing(F.LISTING_NOINDEX, ['cardiologo']).profiles, []);
  assert.equal(doctoralia.profileUrlFromHref('/cardiologo/nunoa/banmedica', new Set(['cardiologo'])), null);
  assert.equal(doctoralia.profileUrlFromHref('/clinicas/x-y', new Set(['cardiologo'])), null);
  assert.equal(doctoralia.profileUrlFromHref('https://otro.cl/perfil/x-y', new Set()), null);
});

// ---------- perfiles ----------
test('perfil: JSON-LD tiene prioridad, ignora reseñas individuales y nunca guarda el RUT de colegiatura', () => {
  const p = doctoralia.parseProfile(F.PROFILE_JSONLD, 'https://www.doctoralia.cl/perfil/ana-ficticia-uno', [CARDIO])!;
  assert.equal(p.name, 'Ana FICTICIA Uno Pérez');
  assert.equal(p.score, 4.8);
  assert.equal(p.count, 1204);
  assert.equal(p.scaleMax, 5);
  assert.equal(p.consultations.length, 1, 'la consulta fuera de la RM se descarta');
  assert.deepEqual(p.consultations[0], {address: 'Avenida Ficticia 427', commune: 'Providencia', clinicName: 'Centro FICTICIO Norte', lat: -33.4323196, lon: -70.6182404});
  assert.ok(!/12345678|654321/.test(JSON.stringify(p)));
  assert.equal(p.reviewsUrl, 'https://www.doctoralia.cl/perfil/ana-ficticia-uno#profile-reviews');
});
test('perfil: microdatos, data-score y texto como respaldo', () => {
  const m = doctoralia.parseProfile(F.PROFILE_MICRODATA, 'https://www.doctoralia.cl/beto-ficticio-dos/cardiologo/santiago', [CARDIO])!;
  assert.equal(m.score, 4.5); assert.equal(m.count, 37); assert.equal(m.slug, 'beto-ficticio-dos');
  assert.equal(m.consultations[0].address, 'Pasaje Ficticio 55, oficina 3');
  const d = extractRating(load(F.PROFILE_DATASCORE));
  assert.deepEqual([d.score, d.count, d.scoreMethod, d.countMethod], [4.9, 2310, 'data-score', 'text']);
  const t = doctoralia.parseProfile(F.PROFILE_TEXT_ONLY, 'https://www.doctoralia.cl/perfil/dario-ficticio-cuatro', [CARDIO])!;
  assert.equal(t.score, null, 'nota ausente queda null, nunca cero');
  assert.equal(t.count, 12);
  const e = doctoralia.parseProfile(F.PROFILE_EMPTY, 'https://www.doctoralia.cl/perfil/sin-datos-ficticia', [CARDIO])!;
  assert.equal(e.count, null); assert.equal(e.score, null); assert.equal(e.consultations.length, 0);
});
test('Top Doctors: sitemap y JSON-LD', () => {
  const s = topdoctors.parseSitemap('<urlset><url><loc>https://www.topdoctors.cl/doctor/ana-ficticia/</loc></url><url><loc>https://www.topdoctors.cl/clinicas/x/</loc></url></urlset>');
  assert.deepEqual(s.profiles, ['https://www.topdoctors.cl/doctor/ana-ficticia/']);
  const p = topdoctors.parseProfile('<script type="application/ld+json">{"@type":"Physician","name":"Dra. Ana FICTICIA Uno","address":{"streetAddress":"Avenida Ficticia 427","addressLocality":"Providencia"},"geo":{"latitude":-33.43,"longitude":-70.61},"aggregateRating":{"ratingValue":4.6,"reviewCount":21,"bestRating":5}}</script>', 'https://www.topdoctors.cl/doctor/ana-ficticia/', [CARDIO])!;
  assert.equal(p.name, 'Ana FICTICIA Uno'); assert.equal(p.score, 4.6); assert.equal(p.count, 21); assert.equal(p.consultations[0].commune, 'Providencia');
});

// ---------- conversión ----------
function baseCatalog(): Catalog {
  return {schemaVersion: 1, publishedAt: '2026-10-01', geography: 'SYNTHETIC TEST ONLY', sources: [], professionals: [], organizations: [], sites: [], ratings: [], removedIds: []};
}
const cfgFor = (id: string): SourceConfig => ({
  id, name: id === 'doctoralia' ? 'Doctoralia Chile' : 'Top Doctors Chile', owner: 'TEST FICTICIO', baseUrl: id === 'doctoralia' ? 'https://www.doctoralia.cl' : 'https://www.topdoctors.cl',
  domains: [id === 'doctoralia' ? 'www.doctoralia.cl' : 'www.topdoctors.cl'], policyUrl: 'https://example.org/terminos-ficticios', termsReviewedAt: '2026-10-08', termsNote: 'FICTICIO',
  discovery: 'listings', listingPattern: '/{specialty}/{commune}', specialties: [CARDIO], communes: ['Providencia'],
  maxPagesPerListing: 2, maxProfilesPerListing: 20, minIntervalMs: 2500, maxRequests: 50, timeoutMs: 1000, maxBytes: 1_000_000, retentionDays: 45, rotate: false, publishNotes: 'FICTICIO',
});
const item = (over: Partial<ProfileItem> = {}): ProfileItem => ({slug: 'ana-ficticia-uno', url: 'https://www.doctoralia.cl/perfil/ana-ficticia-uno', name: 'Ana FICTICIA Uno', specialties: [CARDIO], consultations: [{address: 'Avenida Ficticia 427', commune: 'Providencia', clinicName: 'Centro FICTICIO', lat: -33.43, lon: -70.61}], score: 4.8, count: 192, scaleMin: 1, scaleMax: 5, ...over});

test('conversión: IDs con prefijo de fuente, consultas tipo practice, escala nativa y nulos honestos', () => {
  const parts = toCatalogParts([item(), item({slug: 'sin-nota-ficticia', url: 'https://www.doctoralia.cl/perfil/sin-nota-ficticia', name: 'Sin Nota FICTICIA', score: null, count: 3}), item({slug: 'sin-opiniones-ficticia', url: 'https://www.doctoralia.cl/perfil/sin-opiniones-ficticia', name: 'Sin Opiniones FICTICIA', score: null, count: null})], '2026-10-08T00:00:00.000Z', {id: 'doctoralia', name: 'Doctoralia Chile'});
  assert.deepEqual(parts.professionals.map(p => p.id), ['doctoralia:ana-ficticia-uno', 'doctoralia:sin-nota-ficticia', 'doctoralia:sin-opiniones-ficticia']);
  assert.equal(parts.sites.length, 1, 'misma dirección = una sola sede');
  assert.match(parts.sites[0].id, /^doctoralia:site:[0-9a-f]{12}$/);
  assert.match(parts.organizations[0].id, /^org:doctoralia:[0-9a-f]{12}$/);
  assert.equal(parts.sites[0].kind, 'practice');
  assert.deepEqual(parts.ratings.map(r => [r.id, r.score, r.totalCount, r.scaleMax, r.comparableGroup]), [['doctoralia:rating:ana-ficticia-uno', 4.8, 192, 5, 'doctoralia:cardiologo'], ['doctoralia:rating:sin-nota-ficticia', null, 3, 5, 'doctoralia:cardiologo']]);
  assert.ok(parts.professionals.every(p => p.credentials.status === 'pending' && p.credentials.registryNumber === null));
  const c = CatalogSchema.parse({...baseCatalog(), sources: [sourceEntry(cfgFor('doctoralia'), '2026-10-08')], ...parts});
  assert.ok(c);
  assert.throws(() => assertPublishable(c), /Synthetic/, 'fixtures nunca se publican');
});

// ---------- fusión ----------
test('fusión: reemplaza lo renovado, retiene no visitados ≤45 días, descarta antiguos y no toca otras fuentes', () => {
  const src = {id: 'doctoralia', name: 'Doctoralia Chile'};
  const entry = sourceEntry(cfgFor('doctoralia'), '2026-10-08');
  const older = toCatalogParts([item({slug: 'reciente-ficticia', url: 'https://www.doctoralia.cl/perfil/reciente-ficticia', name: 'Reciente FICTICIA'})], '2026-09-20T00:00:00.000Z', src);
  const ancient = toCatalogParts([item({slug: 'antigua-ficticia', url: 'https://www.doctoralia.cl/perfil/antigua-ficticia', name: 'Antigua FICTICIA', consultations: [{address: 'Calle Vieja 1', commune: 'Santiago', clinicName: null, lat: null, lon: null}]})], '2026-07-01T00:00:00.000Z', src);
  const before = toCatalogParts([item({score: 4.0})], '2026-09-01T00:00:00.000Z', src);
  const other = toCatalogParts([item({url: 'https://www.topdoctors.cl/doctor/ana-ficticia-uno/'})], '2026-06-01T00:00:00.000Z', {id: 'topdoctors', name: 'Top Doctors Chile'});
  const old = CatalogSchema.parse({...baseCatalog(), sources: [entry, sourceEntry(cfgFor('topdoctors'), '2026-10-08')],
    professionals: [...older.professionals, ...ancient.professionals, ...before.professionals, ...other.professionals],
    sites: [...older.sites, ...ancient.sites, ...other.sites], organizations: [...older.organizations, ...ancient.organizations, ...other.organizations],
    ratings: [...older.ratings, ...ancient.ratings, ...before.ratings, ...other.ratings]});
  const fresh = toCatalogParts([item({score: 4.9, count: 200})], '2026-10-08T00:00:00.000Z', src);
  const next = CatalogSchema.parse(mergeSource(old, fresh, 'doctoralia', {checkedAt: '2026-10-08T00:00:00.000Z', retentionDays: 45, source: entry}));
  const ids = next.professionals.map(p => p.id).sort();
  assert.deepEqual(ids, ['doctoralia:ana-ficticia-uno', 'doctoralia:reciente-ficticia', 'topdoctors:ana-ficticia-uno']);
  assert.equal(next.ratings.find(r => r.id === 'doctoralia:rating:ana-ficticia-uno')!.score, 4.9);
  assert.ok(next.ratings.some(r => r.id === 'topdoctors:rating:ana-ficticia-uno'), 'otra fuente intacta aunque sea antigua');
  assert.ok(!next.sites.some(s => s.address?.value === 'Calle Vieja 1'), 'sede huérfana retirada');
  assert.ok(next.removedIds.includes('doctoralia:antigua-ficticia'));
});

// ---------- identidad entre plataformas ----------
test('homónimos: mismo nombre no basta; se exige ambos apellidos, especialidad y dirección (o registro oficial)', () => {
  const a = toCatalogParts([item({name: 'Ana FICTICIA Uno'})], '2026-10-08', {id: 'doctoralia', name: 'D'});
  const sameAddr = toCatalogParts([item({name: 'Dra. Ana FICTICIA Uno', url: 'https://www.topdoctors.cl/doctor/ana-ficticia-uno/', consultations: [{address: 'Av. Ficticia 427, oficina 2', commune: 'Providencia', clinicName: null, lat: null, lon: null}]})], '2026-10-08', {id: 'topdoctors', name: 'T'});
  const otherAddr = toCatalogParts([item({url: 'https://www.topdoctors.cl/doctor/ana-ficticia-uno-2/', slug: 'ana-ficticia-uno-2', consultations: [{address: 'Calle Distinta 99', commune: 'Maipú', clinicName: null, lat: null, lon: null}]})], '2026-10-08', {id: 'topdoctors', name: 'T'});
  const otherSpec = toCatalogParts([item({specialties: [{slug: 'pediatra', name: 'Pediatría', profession: 'Médico'}], url: 'https://www.topdoctors.cl/doctor/x/', consultations: sameAddr.sites.map(s => ({address: s.address!.value, commune: s.commune!.value, clinicName: null, lat: null, lon: null}))})], '2026-10-08', {id: 'topdoctors', name: 'T'});
  const shortName = toCatalogParts([item({name: 'Ana Uno'}), ], '2026-10-08', {id: 'topdoctors', name: 'T'});
  const shortA = toCatalogParts([item({name: 'Ana Uno'})], '2026-10-08', {id: 'doctoralia', name: 'D'});
  const sites = [...a.sites, ...sameAddr.sites, ...otherAddr.sites, ...otherSpec.sites, ...shortName.sites, ...shortA.sites];
  assert.equal(sameIdentity(a.professionals[0], sameAddr.professionals[0], sites), true);
  assert.equal(sameIdentity(a.professionals[0], otherAddr.professionals[0], sites), false, 'homónimo en otra dirección');
  assert.equal(sameIdentity(a.professionals[0], otherSpec.professionals[0], sites), false, 'otra especialidad');
  assert.equal(sameIdentity(shortA.professionals[0], shortName.professionals[0], sites), false, 'sin ambos apellidos');
  const reg = structuredClone(otherAddr.professionals[0]); const regA = structuredClone(a.professionals[0]);
  const official = {...regA.identityEvidence!, statement: 'official' as const};
  regA.credentials = {...regA.credentials, registryNumber: 'REG-FICTICIO-1', evidence: official};
  reg.credentials = {...reg.credentials, registryNumber: 'REG-FICTICIO-1', evidence: official};
  assert.equal(sameIdentity(regA, reg, sites), true, 'registro oficial compartido');
  reg.credentials.evidence = {...official, statement: 'declared'};
  assert.equal(sameIdentity(regA, reg, sites), false, 'registro sin evidencia oficial no basta');
  // En la interfaz, la fusión agrupa ambas fichas y conserva cada valoración con su fuente.
  const c = CatalogSchema.parse({...baseCatalog(), sources: [sourceEntry(cfgFor('doctoralia'), '2026-10-08'), sourceEntry(cfgFor('topdoctors'), '2026-10-08')], professionals: [...a.professionals, ...sameAddr.professionals, ...otherAddr.professionals], sites: [...a.sites, ...sameAddr.sites, ...otherAddr.sites], organizations: [...a.organizations, ...sameAddr.organizations, ...otherAddr.organizations], ratings: [...a.ratings, ...sameAddr.ratings, ...otherAddr.ratings]});
  const groups = groupProfessionals(c);
  assert.equal(groups.length, 2);
  const rows = resultsFromCatalog(c, 'professional', null);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.find(r => r.id === 'doctoralia:ana-ficticia-uno')!.ratings.map(r => r.sourceId).sort(), ['doctoralia', 'topdoctors']);
});

// ---------- orden ----------
test('“Mejor valorados” usa ajuste por volumen por fuente y especialidad: un 5,0 con 2 opiniones no supera a 4,8 con 200', () => {
  const src = {id: 'doctoralia', name: 'D'};
  const mk = (slug: string, score: number, count: number) => item({slug, url: 'https://www.doctoralia.cl/perfil/' + slug, name: slug.replace(/-/g, ' ') + ' FICTICIO', score, count, consultations: [{address: 'Calle ' + slug + ' 1', commune: 'Providencia', clinicName: null, lat: null, lon: null}]});
  const parts = toCatalogParts([mk('cinco-dos', 5, 2), mk('cuatro-ocho', 4.8, 200), mk('cuatro-cinco', 4.5, 40), mk('cuatro', 4.0, 90)], '2026-10-08', src);
  const c = CatalogSchema.parse({...baseCatalog(), sources: [sourceEntry(cfgFor('doctoralia'), '2026-10-08')], ...parts});
  const f: Filters = {query: '', commune: '', specialty: '', profession: '', verified: false, favoritesOnly: false, expanded: false, sort: 'rating', ratingSource: '', minCount: 5};
  const order = searchResults(resultsFromCatalog(c, 'professional', null), f, [], c.ratings).map(r => r.id);
  assert.deepEqual(order, ['doctoralia:cuatro-ocho', 'doctoralia:cuatro-cinco', 'doctoralia:cuatro', 'doctoralia:cinco-dos']);
});

// ---------- ejecución completa con páginas simuladas ----------
type Pages = Record<string, {status: number; body: string; headers?: Record<string, string>}>;
function fakeFetch(pages: Pages, calls: string[]) {
  return (async (url: string) => {
    calls.push(String(url));
    const p = pages[String(url)];
    if (!p) return new Response('no encontrado', {status: 404});
    return new Response(p.body, {status: p.status, headers: p.headers});
  }) as unknown as typeof fetch;
}
const guard = (async (raw: string) => new URL(raw)) as never;
const noWait = async () => {};
async function tempCatalog() {
  const dir = await mkdtemp(join(tmpdir(), 'salud-ratings-'));
  const path = join(dir, 'catalog.json');
  await copyFile('public/data/catalog.json', path);
  return {dir, path, reports: join(dir, 'reports')};
}
const D = 'https://www.doctoralia.cl';
const fullSite = (): Pages => ({
  [D + '/robots.txt']: {status: 200, body: F.ROBOTS_DOCTORALIA_LIKE},
  [D + '/cardiologo/providencia']: {status: 200, body: F.LISTING},
  [D + '/cardiologo/providencia?page=2']: {status: 200, body: '<html><body>Sin más resultados</body></html>'},
  [D + '/perfil/ana-ficticia-uno']: {status: 200, body: F.PROFILE_JSONLD},
  [D + '/beto-ficticio-dos/cardiologo/santiago']: {status: 200, body: F.PROFILE_MICRODATA},
  [D + '/perfil/carla-ficticia-tres']: {status: 200, body: F.PROFILE_DATASCORE},
  [D + '/perfil/bloqueada-ficticia-robots']: {status: 200, body: F.PROFILE_TEXT_ONLY},
  [D + '/perfil/sin-datos-ficticia']: {status: 200, body: F.PROFILE_EMPTY},
});

test('ejecución completa: respeta robots.txt, omite perfil sin datos, publica y escribe informe', async () => {
  const t = await tempCatalog();
  const calls: string[] = [];
  try {
    const report = await runRatings({configs: [cfgFor('doctoralia')], catalogPath: t.path, reportsDir: t.reports, deps: {fetch: fakeFetch(fullSite(), calls), guard, wait: noWait}, now: new Date('2026-10-08T12:00:00Z'), policy: () => {}});
    const r = report.sources[0];
    assert.equal(r.status, 'published');
    assert.equal(r.robotsBlocked, 1);
    assert.ok(!calls.includes(D + '/perfil/bloqueada-ficticia-robots'), 'la ruta prohibida nunca se consulta');
    assert.equal(r.unparsed, 1, 'perfil sin consultas presenciales');
    assert.equal(r.professionals, 3);
    assert.equal(r.ratings, 3);
    const c = CatalogSchema.parse(JSON.parse(await readFile(t.path, 'utf8')));
    assert.equal(c.sites.filter(s => s.id.startsWith('osm:')).length, 18, 'sedes OSM intactas');
    assert.equal(c.sources.find(s => s.id === 'doctoralia')!.status, 'enabled');
    assert.ok(c.ratings.every(r => c.professionals.some(p => p.id === r.entityId)));
    assert.ok(!/12345678-5/.test(JSON.stringify(c)));
    assert.ok(JSON.parse(await readFile(join(t.reports, 'ratings.json'), 'utf8')).catalogChanged);
    assert.ok(calls.every(u => u.startsWith(D)));
  } finally { await rm(t.dir, {recursive: true, force: true}); }
});

test('ejecución: un 403 suspende la fuente y deja el catálogo intacto byte por byte', async () => {
  const t = await tempCatalog();
  const before = await readFile(t.path);
  const pages = fullSite();
  pages[D + '/perfil/carla-ficticia-tres'] = {status: 403, body: 'Acceso denegado'};
  const calls: string[] = [];
  try {
    const report = await runRatings({configs: [cfgFor('doctoralia')], catalogPath: t.path, reportsDir: t.reports, deps: {fetch: fakeFetch(pages, calls), guard, wait: noWait}, now: new Date('2026-10-08T12:00:00Z'), policy: () => {}});
    assert.equal(report.sources[0].status, 'suspended');
    assert.equal(report.sources[0].reason, 'access_denied');
    assert.equal(report.catalogChanged, false);
    assert.ok((await readFile(t.path)).equals(before));
    const after403 = calls.indexOf(D + '/perfil/carla-ficticia-tres');
    assert.equal(calls.length, after403 + 1, 'ninguna consulta después del 403');
  } finally { await rm(t.dir, {recursive: true, force: true}); }
});

test('ejecución: 429 respeta Retry-After y detiene la fuente sin cambiar el catálogo', async () => {
  const t = await tempCatalog();
  const before = await readFile(t.path);
  const pages = fullSite();
  pages[D + '/cardiologo/providencia'] = {status: 429, body: '', headers: {'Retry-After': '120'}};
  try {
    const report = await runRatings({configs: [cfgFor('doctoralia')], catalogPath: t.path, reportsDir: t.reports, deps: {fetch: fakeFetch(pages, []), guard, wait: noWait}, now: new Date('2026-10-08T12:00:00Z'), policy: () => {}});
    assert.equal(report.sources[0].status, 'suspended');
    assert.match(report.sources[0].reason!, /^rate_limited_until_/);
    assert.ok((await readFile(t.path)).equals(before));
  } finally { await rm(t.dir, {recursive: true, force: true}); }
});

test('ejecución: sin valoraciones no modifica el catálogo y guarda muestras sin RUT', async () => {
  const t = await tempCatalog();
  const before = await readFile(t.path);
  const pages = fullSite();
  for (const k of Object.keys(pages)) if (k.includes('/perfil/') || k.includes('/beto-')) pages[k] = {status: 200, body: '<html><body><h1>Dra. Cambio FICTICIO</h1><div><span>Núm. Colegiado: </span><span>12345678-5</span></div><h4>Avenida Ficticia 1, Providencia</h4></body></html>'};
  try {
    const report = await runRatings({configs: [cfgFor('doctoralia')], catalogPath: t.path, reportsDir: t.reports, deps: {fetch: fakeFetch(pages, []), guard, wait: noWait}, now: new Date('2026-10-08T12:00:00Z'), policy: () => {}});
    const r = report.sources[0];
    assert.equal(r.status, 'no_ratings');
    assert.equal(r.reason, 'no_ratings_parsed_structure_may_have_changed');
    assert.ok((await readFile(t.path)).equals(before));
    const files = await readdir(t.reports);
    assert.ok(files.includes('doctoralia-sample-1.html') && files.includes('ratings.json'));
    assert.ok(!/12345678-5/.test(await readFile(join(t.reports, 'doctoralia-sample-1.html'), 'utf8')));
  } finally { await rm(t.dir, {recursive: true, force: true}); }
});

test('ejecución: sin revisión de términos no se hace ninguna consulta; fixtures bloqueados por política real', async () => {
  const t = await tempCatalog();
  const before = await readFile(t.path);
  const calls: string[] = [];
  try {
    const report = await runRatings({configs: [{...cfgFor('doctoralia'), termsReviewedAt: null}], catalogPath: t.path, reportsDir: t.reports, deps: {fetch: fakeFetch(fullSite(), calls), guard, wait: noWait}, now: new Date('2026-10-08T12:00:00Z')});
    assert.equal(report.sources[0].reason, 'terms_review_required');
    assert.equal(calls.length, 0);
    const blocked = await runRatings({configs: [cfgFor('doctoralia')], catalogPath: t.path, reportsDir: t.reports, deps: {fetch: fakeFetch(fullSite(), []), guard, wait: noWait}, now: new Date('2026-10-08T12:00:00Z')});
    assert.equal(blocked.sources[0].status, 'failed', 'la política real rechaza nombres FICTICIO');
    assert.ok((await readFile(t.path)).equals(before));
  } finally { await rm(t.dir, {recursive: true, force: true}); }
});

test('configuración real: Doctoralia en recorrido completo con términos revisados; Top Doctors sigue pendiente', async () => {
  const d = JSON.parse(await readFile('scripts/doctoralia.json', 'utf8'));
  assert.equal(d.mode, 'full');
  assert.match(d.termsReviewedAt, /^\d{4}-\d{2}-\d{2}$/, 'una persona revisó los términos');
  assert.ok(d.minIntervalMs >= 2500, 'una consulta cada 2,5 s como mínimo');
  assert.ok(d.maxMinutes <= 330, 'cabe en el límite de 6 horas de GitHub Actions con margen para guardar');
  assert.deepEqual(d.domains, ['www.doctoralia.cl']);
  const t = JSON.parse(await readFile('scripts/topdoctors.json', 'utf8')) as SourceConfig;
  assert.equal(t.termsReviewedAt, null, 'Top Doctors no se consulta sin revisión de sus términos');
  assert.ok(t.minIntervalMs >= 2500); assert.equal(t.maxRequests, 700); assert.equal(t.retentionDays, 45);
});
