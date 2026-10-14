import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm, readdir, copyFile, mkdir, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseFullProfile, parseSitemap, profileSlug, parseDate, declaredRegistryNumbers, redactAuthor, tidy} from '../scripts/adapters/doctoralia-full';
import {runDoctoralia, rowFor, buildQueue, type DoctoraliaConfig, type CrawlState, type Paths} from '../scripts/doctoralia-crawl';
import {DoctoraliaIndexSchema, DoctoraliaProfileSchema, dedupeSites, expandIndex, mergeIndexIntoCatalog, serializeIndex, emptyIndex, type DoctoraliaIndex} from '../src/doctoralia';
import {CatalogSchema, type Catalog} from '../src/schema';
import {resultsFromCatalog, searchResults, parseQuery, type Filters} from '../src/domain';
import {assertIndexPublishable} from '../scripts/publication-policy';
import {specialtyFromSlug, DOCTORALIA_SPECIALTIES} from '../src/specialties';
import * as F from './fixtures/doctoralia-full-html';

const D = 'https://www.doctoralia.cl';
const ANA = D + '/perfil/ana-ficticia-uno';

// ---------- lector de perfiles ----------
test('perfil completo: identidad, secciones, precios y consultas tal como los muestra Doctoralia', () => {
  const p = parseFullProfile(F.FULL_PROFILE, ANA)!;
  assert.ok(DoctoraliaProfileSchema.safeParse(p).success);
  assert.equal(p.slug, 'ana-ficticia-uno');
  assert.equal(p.title, 'Dra.');
  assert.equal(p.name, 'Ana FICTICIA Uno');
  assert.equal(p.doctoraliaId, '987654');
  assert.match(p.photoUrl!, /^https:\/\/s3\.sa-east-1\.amazonaws\.com\/.+_large\.jpg$/);
  assert.deepEqual(p.specialties, [{slug: 'psicologo', label: 'Psicóloga'}, {slug: 'terapeuta-complementario', label: 'Terapeuta complementaria'}]);
  assert.deepEqual(p.subspecialties, ['Psicología clínica', 'Terapia de pareja']);
  assert.deepEqual(p.patients, ['Adultos', 'Niños (Sólo en algunas direcciones)']);
  assert.deepEqual(p.formats, ['En persona', 'Videoconsulta'], 'sin "Ver ubicaciones" ni botones');
  assert.deepEqual(p.diseases, ['Ansiedad', 'Depresión', 'Duelo']);
  assert.deepEqual(p.languages, ['Español', 'Inglés']);
  assert.equal(p.education.length, 2);
  assert.deepEqual(p.experience, ['CENTRO FICTICIO DE SALUD MENTAL', 'HOSPITAL FICTICIO DEL SUR'], 'incluye elementos ocultos tras "Mostrar más"');
  assert.equal(p.publications.length, 1); assert.equal(p.awards.length, 1); assert.equal(p.certificates.length, 1);
  assert.deepEqual(p.social.map(s => s.name), ['Instagram', 'Facebook']);
  assert.deepEqual(p.badges, [2024, 2025]);
  assert.match(p.about!, /^Psicóloga FICTICIA clínica\.\nAtiendo adultos y adolescentes\.\n\nMi RUT es \[RUT omitido\]/);
  assert.deepEqual(p.services, [
    {name: 'Primera consulta psicológica', price: 35000, priceText: 'Desde $35.000', from: true},
    {name: 'Consulta online', price: 30000, priceText: '$30.000', from: false},
    {name: 'Terapia de pareja', price: null, priceText: null, from: false},
  ]);
  const [norte, online, tele, costa, sur] = p.consultations;
  assert.deepEqual({...norte}, {
    id: '1001', name: 'Centro FICTICIO Norte', clinicUrl: D + '/clinicas/centro-ficticio-norte', online: false,
    street: 'Avenida Ficticia 427', commune: 'Providencia', city: 'Providencia', region: 'Metropolitana de Santiago',
    lat: -33.4323196, lon: -70.6182404, phones: ['(2) 2999 0001'], website: 'https://ficticio.example.org/',
    insurances: ['Fonasa', 'Isapre Banmédica', 'Isapre Consalud'], payments: ['Efectivo', 'Tarjeta de Debito', 'Transferencia Bancaria'],
    services: ['Primera consulta psicológica', 'Terapia de pareja'], patients: ['Adultos', 'Niños'], onlineBooking: true,
  });
  assert.equal(online.online, true); assert.equal(online.street, null);
  assert.equal(tele.online, true, '"Telepsicología – ONLINE" no es una dirección física'); assert.equal(tele.commune, 'Providencia');
  assert.equal(costa.commune, null, 'Viña del Mar no es de la RM'); assert.equal(costa.city, 'Viña del Mar'); assert.equal(costa.region, 'Valparaíso');
  assert.equal(sur.commune, 'San Miguel'); assert.equal(sur.onlineBooking, true);
  assert.deepEqual({...p.rating}, {score: 4.8, count: 1204, scaleMin: 1, scaleMax: 5, tags: ['Dedicación durante la visita', 'Explicaciones detalladas']});
  assert.deepEqual(p.qna, {count: 26, url: D + '/preguntas-y-respuestas/ana-ficticia-uno', items: [{topic: 'Ansiedad FICTICIA', question: '¿La terapia FICTICIA sirve para la ansiedad?', answer: 'Sí, en muchos casos FICTICIOS.'}]});
});

test('opiniones: fecha, nota, verificación, lugar, servicio, texto y respuesta; nunca el nombre de quien opina', () => {
  const p = parseFullProfile(F.FULL_PROFILE, ANA)!;
  assert.equal(p.reviews.length, 3);
  assert.deepEqual(p.reviews[0], {
    id: '5001', date: '2026-09-27', score: 5, verification: 'Cita verificada', place: 'Centro FICTICIO Norte', service: 'Primera consulta psicológica',
    text: 'Muy buena atención FICTICIA.\n[paciente] me recomendó venir.', reply: {text: 'Gracias [paciente] por tu comentario.', date: '2026-09-28'},
  });
  assert.equal(p.reviews[1].text, 'Esperé mucho. Mi rut [RUT omitido] quedó en el formulario.');
  assert.equal(p.reviews[1].reply!.text, 'Hola [paciente], lamentamos la espera.', 'el primer nombre también se reemplaza');
  assert.equal(p.reviews[1].verification, 'Opinión verificada');
  assert.equal(p.reviews[2].reply, null);
  const json = JSON.stringify(p);
  for (const author of ['Paciente Ficticia', 'Juan P.', '"PMS"']) assert.ok(!json.includes(author), 'sin nombre de paciente: ' + author);
  assert.ok(!/12\.345\.678-5|11\.111\.111-1|9\.876\.543-2|98765432/.test(json), 'sin RUT ni números largos de colegiatura');
  assert.deepEqual(p.declaredRegistry, ['654321']);
});

test('perfiles mínimos: fuera de la RM, solo online, especialidad desconocida y número de 9 dígitos', () => {
  const beto = parseFullProfile(F.PROFILE_OUTSIDE_RM, D + '/perfil/beto-ficticio-dos')!;
  assert.equal(beto.title, null); assert.equal(beto.name, 'Beto FICTICIO Dos');
  assert.deepEqual(beto.declaredRegistry, [], '9 dígitos seguidos pueden ser un RUT sin guion');
  assert.equal(beto.consultations[0].commune, null);
  assert.equal(rowFor(beto, '2026-10-12'), null);
  const carla = parseFullProfile(F.PROFILE_ONLINE_ONLY, D + '/perfil/carla-ficticia-tres')!;
  assert.equal(carla.title, 'Ps.');
  assert.deepEqual([carla.rating.score, carla.rating.count], [5, 3]);
  assert.equal(rowFor(carla, '2026-10-12'), null, 'online sin comuna declarada en la RM');
  assert.equal(parseFullProfile('<html><body><p>Sin perfil</p></body></html>', D + '/perfil/x-y'), null);
  assert.equal(parseFullProfile(F.FULL_PROFILE, D + '/clinicas/x')!.slug, 'ana-ficticia-uno', 'el enlace canónico manda');
});

test('auxiliares: fechas, números declarados, nombres, textos y especialidades', () => {
  assert.equal(parseDate('27 de agosto de 2026'), '2026-08-27');
  assert.equal(parseDate('2026-08-27T11:09:13-04:00'), '2026-08-27');
  assert.equal(parseDate('ayer'), null);
  assert.deepEqual(declaredRegistryNumbers('23836075-7 123456'), ['123456']);
  assert.deepEqual(declaredRegistryNumbers('Registro Superintendencia de Salud n123456 Coach n 1234'), ['123456', '1234']);
  assert.deepEqual(declaredRegistryNumbers('12.345.678 y 238360757'), []);
  assert.equal(redactAuthor('Hola Carmen, gracias Carmen López', 'Carmen López'), 'Hola [paciente], gracias [paciente]');
  assert.equal(redactAuthor('Carmencita', 'Carmen'), 'Carmencita', 'solo palabras completas');
  assert.equal(tidy('  a \n\n\n b  '), 'a\n\nb');
  assert.deepEqual(specialtyFromSlug('cardiologo'), {slug: 'cardiologo', name: 'Cardiología', profession: 'Médico', aliases: ['cardiologo', 'cardiologa', 'cardiologia']});
  assert.deepEqual(specialtyFromSlug('nueva-cosa', 'Especialista nuevo'), {slug: 'nueva-cosa', name: 'Especialista nuevo', profession: 'Profesional de la salud', aliases: []});
  assert.equal(new Set(DOCTORALIA_SPECIALTIES.map(s => s.slug)).size, DOCTORALIA_SPECIALTIES.length);
  assert.equal(parseQuery('nutricionista en ñuñoa').specialty, 'Nutrición');
  assert.equal(parseQuery('psicologa providencia').specialty, 'Psicología');
});

test('sitemaps: índice, listas de perfiles y rutas que no son perfiles', () => {
  const ix = parseSitemap(F.SITEMAP_INDEX);
  assert.equal(ix.sitemaps.length, 5);
  assert.equal(ix.sitemaps[1].lastmod, '2026-10-10T08:03:28.000Z');
  const list = parseSitemap(F.SITEMAP_DOCTORS_0).urls;
  assert.deepEqual(list.map(u => profileSlug(u.loc)), ['ana-ficticia-uno', 'beto-ficticio-dos', null]);
  assert.equal(profileSlug('https://otro.example.org/perfil/x'), null);
});

// ---------- índice y catálogo ----------
const cfg = (over: Partial<DoctoraliaConfig> = {}): DoctoraliaConfig => ({
  id: 'doctoralia', name: 'Doctoralia Chile', owner: 'TEST FICTICIO', baseUrl: D, domains: ['www.doctoralia.cl'],
  policyUrl: 'https://example.org/terminos-ficticios', termsReviewedAt: '2026-10-12', termsNote: 'FICTICIO', publishNotes: 'FICTICIO',
  sitemapIndex: '/sitemap.xml', sitemapPattern: '/sitemap\\.(doctor(_\\d+)?|new_doctor)\\.xml$', lastOpinionPattern: '/sitemap\\.last_opinion\\.xml$',
  refreshDays: 14, outsideRecheckDays: 120, errorRetryDays: 2, maxErrors: 5, retentionDays: 60,
  minIntervalMs: 2500, maxRequests: 100, maxMinutes: 300, checkpointEvery: 2, timeoutMs: 1000, maxBytes: 25_000_000, ...over,
});

type Pages = Record<string, {status: number; body: string; headers?: Record<string, string>}>;
const site = (): Pages => ({
  [D + '/robots.txt']: {status: 200, body: F.ROBOTS},
  [D + '/sitemap.xml']: {status: 200, body: F.SITEMAP_INDEX},
  [D + '/sitemaps/monolith/sitemap.doctor_0.xml']: {status: 200, body: F.SITEMAP_DOCTORS_0},
  [D + '/sitemaps/monolith/sitemap.doctor.xml']: {status: 200, body: F.SITEMAP_DOCTORS},
  [D + '/sitemaps/monolith/sitemap.last_opinion.xml']: {status: 200, body: F.SITEMAP_LAST_OPINION},
  [ANA]: {status: 200, body: F.FULL_PROFILE},
  [D + '/perfil/beto-ficticio-dos']: {status: 200, body: F.PROFILE_OUTSIDE_RM},
  [D + '/perfil/carla-ficticia-tres']: {status: 200, body: F.PROFILE_ONLINE_ONLY},
  [D + '/perfil/dario-ficticio-cuatro']: {status: 200, body: F.PROFILE_DARIO},
  [D + '/perfil/bloqueada-ficticia-robots']: {status: 200, body: F.PROFILE_DARIO},
});
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
async function workspace(): Promise<Paths & {dir: string}> {
  const dir = await mkdtemp(join(tmpdir(), 'salud-doctoralia-'));
  await mkdir(join(dir, 'data'), {recursive: true});
  await copyFile('public/data/catalog.json', join(dir, 'data', 'catalog.json'));
  return {dir, catalog: join(dir, 'data', 'catalog.json'), index: join(dir, 'data', 'doctoralia', 'indice.json'), profilesDir: join(dir, 'data', 'doctoralia', 'perfiles'), state: join(dir, 'estado', 'doctoralia.json'), reportsDir: join(dir, 'reports'), exclusions: join(dir, 'estado', 'doctoralia-excluidos.json')};
}
const run = (w: Paths, pages: Pages, calls: string[], now: string, over: Parameters<typeof runDoctoralia>[1] = {}, c = cfg()) =>
  runDoctoralia(c, {paths: w, deps: {fetch: fakeFetch(pages, calls), guard, wait: noWait}, now: new Date(now), ...over});

test('recorrido: descubre por sitemaps, respeta robots.txt, publica solo la RM y comparte sedes', async () => {
  const w = await workspace();
  const calls: string[] = [];
  try {
    const r = await run(w, site(), calls, '2026-10-12T06:00:00Z');
    assert.equal(r.status, 'published');
    assert.equal(r.stoppedBy, 'done');
    assert.deepEqual(r.sitemaps, {read: 3, failed: 0, profiles: 5});
    assert.deepEqual(r.queue, {changed: 0, new: 5, missing: 0, retry: 0, refresh: 0, outside: 0});
    assert.deepEqual([r.fetched, r.rm, r.online, r.outside, r.robotsBlocked, r.written], [4, 2, 0, 2, 1, 2]);
    assert.ok(!calls.includes(D + '/perfil/bloqueada-ficticia-robots'), 'la ruta prohibida nunca se consulta');
    assert.ok(!calls.some(u => u.includes('otro.example.org')), 'solo el dominio autorizado');
    const ix = DoctoraliaIndexSchema.parse(JSON.parse(await readFile(w.index, 'utf8')));
    assert.deepEqual(ix.professionals.map(p => p.id), ['ana-ficticia-uno', 'dario-ficticio-cuatro']);
    assert.equal(ix.sites.length, 3, 'Avenida Ficticia 427 es una sola sede para Ana y Dario');
    const ana = ix.professionals[0];
    assert.deepEqual([ana.n, ana.t, ana.s, ana.r, ana.v, ana.l, ana.o, ana.f], ['Ana FICTICIA Uno', 'Dra.', ['psicologo', 'terapeuta-complementario'], [4.8, 1204], 3, '2026-09-27', true, '2026-10-12']);
    assert.deepEqual(ix.specialties.psicologo, ['Psicología', 'Psicólogo']);
    assert.deepEqual(ix.specialties['terapeuta-complementario'], ['Terapias complementarias', 'Terapeuta complementario']);
    assert.deepEqual((await readdir(w.profilesDir)).sort(), ['ana-ficticia-uno.json', 'dario-ficticio-cuatro.json']);
    const detail = DoctoraliaProfileSchema.parse(JSON.parse(await readFile(join(w.profilesDir, 'ana-ficticia-uno.json'), 'utf8')));
    assert.equal(detail.reviews.length, 3);
    const st = JSON.parse(await readFile(w.state, 'utf8')) as CrawlState;
    assert.deepEqual(Object.fromEntries(Object.entries(st.profiles).map(([k, v]) => [k, v.s])), {'ana-ficticia-uno': 'rm', 'beto-ficticio-dos': 'fuera', 'carla-ficticia-tres': 'fuera', 'dario-ficticio-cuatro': 'rm', 'bloqueada-ficticia-robots': 'fuera'});
    // La fuente queda habilitada en el catálogo y el sitio puede unir el índice.
    const catalog = CatalogSchema.parse(JSON.parse(await readFile(w.catalog, 'utf8')));
    assert.equal(catalog.sources.find(s => s.id === 'doctoralia')!.status, 'enabled');
    const merged = CatalogSchema.parse(mergeIndexIntoCatalog(catalog, ix));
    assert.equal(merged.professionals.length, 2);
    assert.equal(merged.sites.filter(s => s.id.startsWith('osm:')).length, 18, 'sedes OSM intactas');
    assert.ok(/12\.345\.678-5|Paciente Ficticia/.test(serializeIndex(ix)) === false);
    assert.throws(() => assertIndexPublishable(ix), /Synthetic/, 'la política real rechaza fixtures');
  } finally { await rm(w.dir, {recursive: true, force: true}); }
});

test('recorrido: al día siguiente no repite perfiles; a los 15 días refresca, borra los 404 y no reescribe fichas iguales', async () => {
  const w = await workspace();
  try {
    await run(w, site(), [], '2026-10-12T06:00:00Z');
    const before = await stat(join(w.profilesDir, 'dario-ficticio-cuatro.json'));
    const calls: string[] = [];
    const next = await run(w, site(), calls, '2026-10-13T06:00:00Z');
    assert.equal(next.fetched, 0);
    assert.deepEqual(calls.filter(u => u.includes('/perfil/')), []);
    assert.equal(next.status, 'unchanged');
    const pages = site();
    delete pages[ANA];
    const later = await run(w, pages, [], '2026-10-28T06:00:00Z');
    assert.equal(later.queue.refresh + later.queue.changed, 2);
    assert.equal(later.gone, 1);
    assert.equal(later.unchanged, 1, 'Dario no cambió: su ficha no se reescribe');
    assert.equal((await stat(join(w.profilesDir, 'dario-ficticio-cuatro.json'))).mtimeMs, before.mtimeMs);
    const ix = DoctoraliaIndexSchema.parse(JSON.parse(await readFile(w.index, 'utf8')));
    assert.deepEqual(ix.professionals.map(p => p.id), ['dario-ficticio-cuatro']);
    assert.equal(ix.sites.length, 2, 'sedes huérfanas retiradas');
    assert.deepEqual(await readdir(w.profilesDir), ['dario-ficticio-cuatro.json']);
  } finally { await rm(w.dir, {recursive: true, force: true}); }
});

test('recorrido: un 403 detiene todo, conserva el avance y la siguiente ejecución sigue donde quedó', async () => {
  const w = await workspace();
  try {
    const pages = site();
    pages[D + '/perfil/dario-ficticio-cuatro'] = {status: 403, body: 'Acceso denegado'};
    const calls: string[] = [];
    const r = await run(w, pages, calls, '2026-10-12T06:00:00Z');
    assert.equal(r.status, 'suspended'); assert.equal(r.reason, 'access_denied'); assert.equal(r.stoppedBy, 'blocked');
    assert.equal(calls.at(-1), D + '/perfil/dario-ficticio-cuatro', 'ninguna consulta después del 403');
    const st = JSON.parse(await readFile(w.state, 'utf8')) as CrawlState;
    const done = Object.entries(st.profiles).filter(([, v]) => v.f).map(([k]) => k).sort();
    assert.ok(done.length >= 1 && !done.includes('dario-ficticio-cuatro'));
    const again = await run(w, site(), [], '2026-10-12T09:00:00Z');
    assert.equal(again.status, 'published');
    const ix = DoctoraliaIndexSchema.parse(JSON.parse(await readFile(w.index, 'utf8')));
    assert.deepEqual(ix.professionals.map(p => p.id), ['ana-ficticia-uno', 'dario-ficticio-cuatro']);
  } finally { await rm(w.dir, {recursive: true, force: true}); }
});

test('recorrido: 429 respeta Retry-After y no publica nada', async () => {
  const w = await workspace();
  try {
    const pages = site();
    pages[D + '/sitemap.xml'] = {status: 429, body: '', headers: {'Retry-After': '120'}};
    // El catálogo copiado es el real del repositorio: tras la primera extracción exitosa Doctoralia ya figura habilitada.
    // Por eso no se revisa el estado de la fuente, sino que el catálogo quede igual byte por byte.
    const before = await readFile(w.catalog, 'utf8');
    const calls: string[] = [];
    const r = await run(w, pages, calls, '2026-10-12T06:00:00Z');
    assert.equal(r.status, 'suspended'); assert.match(r.reason!, /^rate_limited_until_/);
    assert.equal(calls.length, 2, 'robots.txt y el índice de sitemaps, nada más');
    assert.equal(r.indexRows, 0);
    const after = await readFile(w.catalog, 'utf8');
    assert.equal(after, before, 'sin filas no se toca el catálogo ni el estado de la fuente');
    CatalogSchema.parse(JSON.parse(after));
  } finally { await rm(w.dir, {recursive: true, force: true}); }
});

test('recorrido: presupuesto de tiempo y de perfiles, y reanudación en la siguiente ejecución', async () => {
  const w = await workspace();
  try {
    let t = 0;
    const clock = () => (t += 60_000); // cada lectura de reloj avanza un minuto
    const r = await runDoctoralia(cfg({maxMinutes: 2}), {paths: w, deps: {fetch: fakeFetch(site(), []), guard, wait: noWait, clock}, now: new Date('2026-10-12T06:00:00Z')});
    assert.equal(r.stoppedBy, 'time');
    assert.ok(r.fetched >= 1 && r.fetched < 4);
    const limited = await run(w, site(), [], '2026-10-12T07:00:00Z', {limitProfiles: 1});
    assert.equal(limited.fetched, 1); assert.equal(limited.stoppedBy, 'limit');
    const rest = await run(w, site(), [], '2026-10-12T08:00:00Z');
    assert.equal(rest.stoppedBy, 'done');
    const st = JSON.parse(await readFile(w.state, 'utf8')) as CrawlState;
    assert.ok(Object.values(st.profiles).every(p => p.f), 'todos consultados tras varias ejecuciones');
  } finally { await rm(w.dir, {recursive: true, force: true}); }
});

test('recorrido: la misma consulta declarada en dos comunas queda como una sola sede y el catálogo sigue válido', async () => {
  // Caso real del 12-10-2026: «Sede posiblemente duplicada» (mismo centro, calle y coordenadas con distinta comuna).
  const w = await workspace();
  try {
    const eva = F.PROFILE_DARIO.replace(/dario-ficticio-cuatro/g, 'eva-ficticia-cinco').replace('Dario FICTICIO Cuatro', 'Eva FICTICIA Cinco').replace(/Providencia/g, 'Santiago');
    const pages = site();
    pages[D + '/perfil/eva-ficticia-cinco'] = {status: 200, body: eva};
    pages[D + '/sitemaps/monolith/sitemap.doctor.xml'] = {status: 200, body: F.SITEMAP_DOCTORS.replace('</urlset>', '<url><loc>https://www.doctoralia.cl/perfil/eva-ficticia-cinco</loc><lastmod>2026-09-20T05:00:00-03:00</lastmod></url></urlset>')};
    const r = await run(w, pages, [], '2026-10-12T06:00:00Z');
    assert.equal(r.rm, 3);
    const ix = DoctoraliaIndexSchema.parse(JSON.parse(await readFile(w.index, 'utf8')));
    assert.equal(ix.sites.filter(s => s[3] === 'Avenida Ficticia 427').length, 1);
    const catalog = CatalogSchema.parse(JSON.parse(await readFile(w.catalog, 'utf8')));
    const merged = CatalogSchema.parse(mergeIndexIntoCatalog(catalog, ix));
    const evaRow = merged.professionals.find(p => p.id === 'doctoralia:eva-ficticia-cinco')!;
    const anaRow = merged.professionals.find(p => p.id === 'doctoralia:ana-ficticia-uno')!;
    assert.ok(evaRow.siteIds.some(id => anaRow.siteIds.includes(id)), 'Eva y Ana comparten la sede unificada');
  } finally { await rm(w.dir, {recursive: true, force: true}); }
});

test('recorrido: una ruta del sitemap que redirige a otro perfil no duplica ni desordena fichas', async () => {
  const w = await workspace();
  try {
    const pages = site();
    // carla-ficticia-tres responde con la página de Ana (perfil renombrado) y beto-ficticio-dos con un perfil sin sitemap propio.
    pages[D + '/perfil/carla-ficticia-tres'] = {status: 200, body: F.FULL_PROFILE};
    pages[D + '/perfil/beto-ficticio-dos'] = {status: 200, body: F.PROFILE_DARIO.replace(/dario-ficticio-cuatro/g, 'nuevo-nombre-ficticio')};
    await run(w, pages, [], '2026-10-12T06:00:00Z');
    const ix = DoctoraliaIndexSchema.parse(JSON.parse(await readFile(w.index, 'utf8')));
    assert.deepEqual(ix.professionals.map(p => p.id), ['ana-ficticia-uno', 'beto-ficticio-dos', 'dario-ficticio-cuatro']);
    assert.deepEqual((await readdir(w.profilesDir)).sort(), ['ana-ficticia-uno.json', 'beto-ficticio-dos.json', 'dario-ficticio-cuatro.json']);
    const beto = DoctoraliaProfileSchema.parse(JSON.parse(await readFile(join(w.profilesDir, 'beto-ficticio-dos.json'), 'utf8')));
    assert.equal(beto.slug, 'beto-ficticio-dos');
    const st = JSON.parse(await readFile(w.state, 'utf8')) as CrawlState;
    assert.equal(st.profiles['carla-ficticia-tres'].s, 'baja');
    CatalogSchema.parse(mergeIndexIntoCatalog(CatalogSchema.parse(JSON.parse(await readFile(w.catalog, 'utf8'))), ix));
  } finally { await rm(w.dir, {recursive: true, force: true}); }
});

test('recorrido: un posible RUT en un enlace se borra de la ficha sin detener la ejecución', async () => {
  const w = await workspace();
  try {
    const pages = site();
    pages[ANA] = {status: 200, body: F.FULL_PROFILE.replace('https://ficticio.example.org/', 'https://ficticio.example.org/12345678-5/')};
    const r = await run(w, pages, [], '2026-10-12T06:00:00Z');
    assert.equal(r.status, 'published');
    const text = await readFile(join(w.profilesDir, 'ana-ficticia-uno.json'), 'utf8');
    assert.ok(!/12345678-5/.test(text) && text.includes('[RUT omitido]'));
    DoctoraliaProfileSchema.parse(JSON.parse(text));
  } finally { await rm(w.dir, {recursive: true, force: true}); }
});

test('sedes repetidas en un índice ya publicado se unen al cargarlo', () => {
  const ix: DoctoraliaIndex = {...emptyIndex(), generatedAt: '2026-10-12T06:00:00.000Z', specialties: {psicologo: ['Psicología', 'Psicólogo']},
    sites: [['aaaaaaaaaaaa', 'cccccccccccc', 'Centro FICTICIO', 'Avenida Ficticia 1', 'Providencia', -33.43, -70.61], ['bbbbbbbbbbbb', 'cccccccccccc', 'Centro FICTICIO', 'Avenida Ficticia 1', 'Santiago', -33.43, -70.61], ['dddddddddddd', 'cccccccccccc', 'Centro FICTICIO', 'Avenida Ficticia 1', 'Ñuñoa', null, null]],
    professionals: [
      {id: 'uno-ficticio', n: 'Uno FICTICIO', t: null, s: ['psicologo'], k: ['aaaaaaaaaaaa'], r: [5, 10], v: 0, l: null, o: false, f: '2026-10-12'},
      {id: 'dos-ficticia', n: 'Dos FICTICIA', t: null, s: ['psicologo'], k: ['bbbbbbbbbbbb', 'aaaaaaaaaaaa'], r: [5, 10], v: 0, l: null, o: false, f: '2026-10-12'},
      {id: 'tres-ficticia', n: 'Tres FICTICIA', t: null, s: ['psicologo'], k: ['dddddddddddd'], r: [5, 10], v: 0, l: null, o: false, f: '2026-10-12'},
    ]};
  const d = dedupeSites(ix);
  assert.deepEqual(d.sites.map(s => s[0]), ['aaaaaaaaaaaa', 'dddddddddddd'], 'sin coordenadas es otra sede');
  assert.deepEqual(d.professionals[1].k, ['aaaaaaaaaaaa']);
  const base = CatalogSchema.parse(JSON.parse(JSON.stringify({schemaVersion: 1, publishedAt: '2026-10-12', geography: 'SYNTHETIC TEST ONLY', sources: [{id: 'doctoralia', name: 'Doctoralia Chile', owner: 'FICTICIO', url: D + '/', policyUrl: 'https://example.org/t', status: 'enabled', license: 'Términos', mayPublish: true, mayRetain: true, mayDerive: true, reviewedAt: '2026-10-12', attribution: 'x', notes: 'FICTICIO'}], professionals: [], organizations: [], sites: [], ratings: [], removedIds: []})));
  assert.equal(CatalogSchema.parse(mergeIndexIntoCatalog(base, ix)).sites.length, 2, 'el sitio une las sedes aunque el índice las traiga repetidas');
});

test('recorrido: un perfil excluido se retira del índice y no se vuelve a consultar', async () => {
  const w = await workspace();
  try {
    await run(w, site(), [], '2026-10-12T06:00:00Z');
    await writeFile(w.exclusions, JSON.stringify({slugs: ['dario-ficticio-cuatro']}));
    const calls: string[] = [];
    const r = await run(w, site(), calls, '2026-10-30T06:00:00Z');
    assert.equal(r.removed, 1);
    assert.ok(!calls.includes(D + '/perfil/dario-ficticio-cuatro'));
    const ix = DoctoraliaIndexSchema.parse(JSON.parse(await readFile(w.index, 'utf8')));
    assert.deepEqual(ix.professionals.map(p => p.id), ['ana-ficticia-uno']);
    assert.deepEqual(await readdir(w.profilesDir), ['ana-ficticia-uno.json']);
  } finally { await rm(w.dir, {recursive: true, force: true}); }
});

test('recorrido: sin revisión de términos no hace ninguna consulta', async () => {
  const w = await workspace();
  try {
    const calls: string[] = [];
    const r = await run(w, site(), calls, '2026-10-12T06:00:00Z', {}, cfg({termsReviewedAt: null}));
    assert.equal(r.reason, 'terms_review_required'); assert.equal(calls.length, 0);
    const old = await run(w, site(), calls, '2027-11-01T06:00:00Z');
    assert.equal(old.reason, 'terms_review_required', 'la revisión vence al año'); assert.equal(calls.length, 0);
  } finally { await rm(w.dir, {recursive: true, force: true}); }
});

test('prioridades: cambiados, nuevos, ausentes del sitemap, reintentos, refresco y fuera de la RM', () => {
  const st: CrawlState = {version: 1, updatedAt: null, profiles: {
    a: {m: '2026-10-11', f: '2026-10-01', s: 'rm', e: 0, h: null, x: null},       // cambió tras la consulta
    b: {m: '2026-10-01', f: null, s: 'nuevo', e: 0, h: null, x: null},
    c: {m: '2026-10-05', f: null, s: 'nuevo', e: 0, h: null, x: null},
    d: {m: null, f: '2026-10-10', s: 'rm', e: 0, h: null, x: '2026-10-11'},      // ya no aparece en el sitemap
    dd: {m: null, f: '2026-10-11', s: 'rm', e: 0, h: null, x: '2026-10-11'},     // ya se confirmó tras desaparecer
    e: {m: null, f: '2026-10-01', s: 'error', e: 1, h: null, x: null},
    g: {m: null, f: '2026-10-01', s: 'error', e: 9, h: null, x: null},           // demasiados errores
    h: {m: '2026-01-01', f: '2026-09-01', s: 'online', e: 0, h: null, x: null},  // toca refrescar
    i: {m: '2026-01-01', f: '2026-10-10', s: 'rm', e: 0, h: null, x: null},      // al día
    j: {m: '2026-01-01', f: '2026-01-01', s: 'fuera', e: 0, h: null, x: null},   // revisión trimestral
    k: {m: '2026-01-01', f: '2026-10-01', s: 'fuera', e: 0, h: null, x: null},
    l: {m: null, f: '2026-10-01', s: 'baja', e: 0, h: null, x: null},
  }};
  const {queue, sizes} = buildQueue(st, cfg(), '2026-10-12', new Map());
  assert.deepEqual(queue, ['a', 'c', 'b', 'd', 'e', 'h', 'j']);
  assert.deepEqual(sizes, {changed: 1, new: 2, missing: 1, retry: 1, refresh: 1, outside: 1});
  const withOpinion = buildQueue(st, cfg(), '2026-10-12', new Map([['i', '2026-10-11T05:00:00-03:00']]));
  assert.deepEqual(withOpinion.queue.slice(0, 2), ['a', 'i'], 'una opinión reciente cuenta como cambio');
});

test('sitio: el índice se convierte al catálogo, filtra por comuna y especialidad y ordena por opiniones', () => {
  const ix: DoctoraliaIndex = {...emptyIndex(), generatedAt: '2026-10-12T06:00:00.000Z',
    specialties: {cardiologo: ['Cardiología', 'Médico'], psicologo: ['Psicología', 'Psicólogo']},
    sites: [['aaaaaaaaaaaa', 'bbbbbbbbbbbb', 'Centro FICTICIO', 'Avenida Ficticia 1', 'Providencia', -33.43, -70.61], ['cccccccccccc', 'dddddddddddd', 'Consulta FICTICIA', 'Calle Ficticia 2', 'Maipú', null, null]],
    professionals: [
      {id: 'uno-ficticio', n: 'Uno FICTICIO', t: 'Dr.', s: ['cardiologo'], k: ['aaaaaaaaaaaa'], r: [4.8, 200], v: 10, l: '2026-10-01', o: false, f: '2026-10-12'},
      {id: 'dos-ficticia', n: 'Dos FICTICIA', t: 'Ps.', s: ['psicologo'], k: ['cccccccccccc'], r: [5, 2], v: 2, l: null, o: true, f: '2026-10-12'},
      {id: 'tres-ficticia', n: 'Tres FICTICIA', t: null, s: ['psicologo'], k: [], r: [null, null], v: 0, l: null, o: true, f: '2026-10-12'},
    ]};
  DoctoraliaIndexSchema.parse(ix);
  const parts = expandIndex(ix);
  assert.equal(parts.professionals.length, 3, 'online sin sede también se publica');
  assert.equal(parts.ratings.length, 2, 'sin opiniones no hay valoración');
  assert.equal(parts.ratings[0].sampleCount, 10);
  assert.equal(parts.professionals[2].online, true);
  const base = CatalogSchema.parse(JSON.parse(JSON.stringify({schemaVersion: 1, publishedAt: '2026-10-12', geography: 'SYNTHETIC TEST ONLY', sources: [], professionals: [], organizations: [], sites: [], ratings: [], removedIds: []})));
  assert.equal(mergeIndexIntoCatalog(base, ix), base, 'sin la fuente habilitada no se publica nada');
  const withSource: Catalog = {...base, sources: [{id: 'doctoralia', name: 'Doctoralia Chile', owner: 'FICTICIO', url: D + '/', policyUrl: 'https://example.org/t', status: 'enabled', license: 'Términos', mayPublish: true, mayRetain: true, mayDerive: true, reviewedAt: '2026-10-12', attribution: 'x', notes: 'FICTICIO'}]};
  const c = CatalogSchema.parse(mergeIndexIntoCatalog(withSource, ix));
  const rows = resultsFromCatalog(c, 'professional', null);
  const f: Filters = {query: '', commune: '', specialty: '', profession: '', verified: false, favoritesOnly: false, expanded: false, sort: 'rating', ratingSource: '', minCount: 5};
  assert.deepEqual(searchResults(rows, {...f, commune: 'Maipú'}, [], c.ratings).map(r => r.id), ['doctoralia:dos-ficticia']);
  assert.deepEqual(searchResults(rows, {...f, specialty: 'Psicología', sort: 'name'}, [], c.ratings).map(r => r.name), ['Dos FICTICIA', 'Tres FICTICIA']);
  assert.deepEqual(searchResults(rows, {...f, query: 'cardiologo'}, [], c.ratings).map(r => r.id), ['doctoralia:uno-ficticio']);
  assert.equal(rows.find(r => r.id === 'doctoralia:uno-ficticio')!.profession, 'Médico');
});

test('rendimiento: 40.000 profesionales se convierten, validan, filtran y ordenan en segundos', () => {
  const n = 40_000;
  const hex = (i: number, salt: string) => (salt + i.toString(16)).padStart(12, '0').slice(-12);
  const communes = ['Providencia', 'Santiago', 'Ñuñoa', 'Las Condes', 'Maipú'];
  const ix: DoctoraliaIndex = {...emptyIndex(), generatedAt: '2026-10-12T06:00:00.000Z', specialties: {psicologo: ['Psicología', 'Psicólogo'], cardiologo: ['Cardiología', 'Médico']},
    sites: Array.from({length: n / 2}, (_, i) => [hex(i, 'a'), hex(i, 'b'), 'Centro ' + i, 'Calle ' + i, communes[i % 5], -33.4, -70.6] as DoctoraliaIndex['sites'][number]),
    professionals: Array.from({length: n}, (_, i) => ({id: 'persona-' + i, n: 'Persona ' + i, t: null, s: [i % 2 ? 'psicologo' : 'cardiologo'], k: [hex(i % (n / 2), 'a')], r: [i % 5 + 1, i % 300] as [number, number], v: 3, l: null, o: false, f: '2026-10-12'}))};
  const t0 = Date.now();
  DoctoraliaIndexSchema.parse(JSON.parse(serializeIndex(ix)));
  const base: Catalog = JSON.parse(JSON.stringify({schemaVersion: 1, publishedAt: '2026-10-12', geography: 'x', sources: [{id: 'doctoralia', name: 'Doctoralia Chile', owner: 'x', url: D + '/', policyUrl: 'https://example.org/t', status: 'enabled', license: 'Términos', mayPublish: true, mayRetain: true, mayDerive: true, reviewedAt: '2026-10-12', attribution: 'x', notes: 'x'}], professionals: [], organizations: [], sites: [], ratings: [], removedIds: []}));
  const c = mergeIndexIntoCatalog(base, ix);
  CatalogSchema.parse(c);
  const rows = resultsFromCatalog(c, 'professional', null);
  const f: Filters = {query: '', commune: '', specialty: '', profession: '', verified: false, favoritesOnly: false, expanded: false, sort: 'rating', ratingSource: '', minCount: 5};
  const sorted = searchResults(rows, f, [], c.ratings);
  const found = searchResults(rows, {...f, query: 'persona 3999', sort: 'name'}, [], c.ratings);
  const ms = Date.now() - t0;
  assert.equal(sorted.length, n);
  assert.ok(found.some(r => r.name === 'Persona 3999'));
  assert.ok(ms < 20_000, `tardó ${ms} ms`);
});
