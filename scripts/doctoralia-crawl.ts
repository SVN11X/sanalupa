// Recorrido completo y por partes de Doctoralia Chile.
//
// Cómo funciona, en pocas palabras:
//  1. Lee robots.txt y lo respeta (una consulta cada 2,5 s como mínimo, se detiene ante 403 o 429).
//  2. Descubre los perfiles en los sitemaps públicos de Doctoralia (≈83.000 perfiles de todo Chile).
//  3. Decide qué perfiles consultar en esta ejecución, por prioridad: los que cambiaron, los nuevos,
//     los que reintentan un error, los que hay que refrescar y, al final, los de fuera de la RM.
//  4. Lee cada perfil completo (scripts/adapters/doctoralia-full.ts) y:
//       - si tiene una consulta presencial en la RM, o atiende online declarando una comuna de la RM,
//         guarda su ficha en public/data/doctoralia/perfiles/{slug}.json y su fila en el índice;
//       - si no, lo marca "fuera" y lo vuelve a revisar cada varios meses.
//  5. Guarda el avance cada cierto número de perfiles: si la ejecución se corta, la siguiente sigue donde quedó.
//
// Archivos: public/data/doctoralia/indice.json, public/data/doctoralia/perfiles/*.json, estado/doctoralia.json,
// reports/doctoralia.json y, en catalog.json, la ficha de la fuente (permiso de publicación).
import {readFile, writeFile, mkdir, rename, rm, readdir} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {createFetcher, guardDestination, ProviderError} from './network';
import {parseRobots, robotsAllows, robotsCrawlDelay, ALLOW_ALL, type Robots} from './robots';
import {normalize} from '../src/geo';
import {CatalogSchema, type Catalog} from '../src/schema';
import {
  DoctoraliaIndexSchema, DoctoraliaProfileSchema, IndexRowSchema, IndexSiteSchema, emptyIndex, rmConsultations, serializeIndex,
  type DoctoraliaIndex, type DoctoraliaProfile, type IndexRow, type IndexSite,
} from '../src/doctoralia';
import {specialtyFromSlug} from '../src/specialties';
import {parseFullProfile, parseSitemap, profileSlug, scrubRut} from './adapters/doctoralia-full';
import {redactRut, shortHash, streetKey} from './adapters/common';
import {atomicPublish} from './publish';

export const USER_AGENT = 'SaludCercaSantiago/1.0 (+https://github.com/SVN11X/sanalupa; directorio de salud de la RM; una consulta cada 2,5 s)';

export type DoctoraliaConfig = {
  id: 'doctoralia'; name: string; owner: string; baseUrl: string; domains: string[]; policyUrl: string;
  termsReviewedAt: string | null; termsNote: string; publishNotes: string;
  sitemapIndex: string;            // "/sitemap.xml"
  sitemapPattern: string;          // expresión regular para elegir los sitemaps de perfiles
  lastOpinionPattern: string;      // sitemap de perfiles con opiniones recientes
  refreshDays: number;             // cada cuántos días se vuelve a leer un perfil de la RM
  outsideRecheckDays: number;      // cada cuántos días se revisa un perfil de fuera de la RM
  errorRetryDays: number; maxErrors: number;
  retentionDays: number;           // filas no actualizadas en este plazo se retiran del índice
  minIntervalMs: number; maxRequests: number; maxMinutes: number; checkpointEvery: number;
  timeoutMs: number; maxBytes: number;
};

export type Paths = {catalog: string; index: string; profilesDir: string; state: string; reportsDir: string; exclusions: string};
export const DEFAULT_PATHS: Paths = {
  catalog: 'public/data/catalog.json', index: 'public/data/doctoralia/indice.json', profilesDir: 'public/data/doctoralia/perfiles',
  state: 'estado/doctoralia.json', reportsDir: 'reports', exclusions: 'estado/doctoralia-excluidos.json',
};

/** Perfiles que nunca se publican (por ejemplo, porque la persona pidió salir del sitio). */
export async function readExclusions(path: string): Promise<Set<string>> {
  const raw = await readJson<{slugs?: unknown}>(path, {slugs: []});
  return new Set(Array.isArray(raw.slugs) ? raw.slugs.filter((x): x is string => typeof x === 'string') : []);
}

/** Estado de cada perfil: m = lastmod del sitemap, f = última consulta, s = situación, e = errores seguidos, h = huella de la ficha, x = fuera del sitemap desde. */
export type ProfileState = {m: string | null; f: string | null; s: 'nuevo' | 'rm' | 'online' | 'fuera' | 'error' | 'baja'; e: number; h: string | null; x: string | null};
export type CrawlState = {version: 1; updatedAt: string | null; profiles: Record<string, ProfileState>};

export type CrawlReport = {
  source: 'doctoralia'; startedAt: string; finishedAt: string;
  status: 'published' | 'unchanged' | 'skipped' | 'suspended' | 'failed';
  reason: string | null; requests: number; stoppedBy: 'done' | 'time' | 'quota' | 'limit' | 'blocked' | 'error' | null;
  sitemaps: {read: number; failed: number; profiles: number};
  queue: Record<string, number>;
  fetched: number; rm: number; online: number; outside: number; gone: number; errors: number; robotsBlocked: number;
  written: number; unchanged: number; removed: number; indexRows: number; withRatings: number; samples: string[];
};

export type Deps = {fetch?: typeof fetch; guard?: typeof guardDestination; wait?: (ms: number) => Promise<void>; log?: (m: string) => void; clock?: () => number};

const day = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000;

// ---------- lectura y escritura ----------
async function readJson<T>(path: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(path, 'utf8')) as T; }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback; throw e; }
}
async function writeAtomic(path: string, text: string) {
  await mkdir(dirname(path), {recursive: true});
  const tmp = `${path}.${process.pid}.tmp`;
  try { await writeFile(tmp, text); await rename(tmp, path); } finally { await rm(tmp, {force: true}); }
}
export function serializeState(st: CrawlState): string {
  const keys = Object.keys(st.profiles).sort();
  const body = keys.map(k => JSON.stringify(k) + ':' + JSON.stringify(st.profiles[k])).join(',\n');
  return `{"version":1,"updatedAt":${JSON.stringify(st.updatedAt)},"profiles":{${keys.length ? '\n' + body + '\n' : ''}}}\n`;
}

// ---------- índice en memoria ----------
type Book = {rows: Map<string, IndexRow>; sites: Map<string, IndexSite>; specialties: Map<string, [string, string]>};
function bookFrom(ix: DoctoraliaIndex): Book {
  return {rows: new Map(ix.professionals.map(r => [r.id, r])), sites: new Map(ix.sites.map(s => [s[0], s])), specialties: new Map(Object.entries(ix.specialties))};
}
function indexFrom(book: Book, generatedAt: string): DoctoraliaIndex {
  const rows = [...book.rows.values()].sort((a, b) => a.id.localeCompare(b.id));
  const used = new Set(rows.flatMap(r => r.k));
  const usedSpecs = new Set(rows.flatMap(r => r.s));
  return {
    version: 1, source: 'doctoralia', generatedAt,
    specialties: Object.fromEntries([...book.specialties].filter(([k]) => usedSpecs.has(k)).sort(([a], [b]) => a.localeCompare(b))),
    sites: [...book.sites.values()].filter(s => used.has(s[0])).sort((a, b) => a[0].localeCompare(b[0])),
    professionals: rows,
  };
}

/** Clave estable de una sede: calle y número normalizados + comuna (igual criterio que ratings-parts). */
export function siteKey(street: string, commune: string) { return shortHash((streetKey(street) ?? normalize(street)) + '|' + normalize(commune)); }

/** Fila del índice y sedes de un perfil, o null si no corresponde a la RM. */
export function rowFor(p: DoctoraliaProfile, today: string): {row: IndexRow; sites: IndexSite[]; kind: 'rm' | 'online'} | null {
  const physical = rmConsultations(p);
  const online = p.consultations.some(c => c.online);
  const onlineInRm = online && p.consultations.some(c => c.online && !!c.commune);
  if (!physical.length && !onlineInRm) return null;
  const sites: IndexSite[] = [];
  for (const c of physical.slice(0, 40)) {
    const key = siteKey(c.street!, c.commune!);
    if (sites.some(s => s[0] === key)) continue;
    const name = (c.name ?? `Consulta en ${c.street}`).slice(0, 180);
    sites.push([key, shortHash(c.name ? normalize(c.name) : key), name, c.street!.slice(0, 180), c.commune!, c.lat, c.lon]);
  }
  const score = p.rating.score !== null && p.rating.score >= 1 && p.rating.score <= 5 ? p.rating.score : null;
  const dates = p.reviews.map(r => r.date).filter((d): d is string => !!d).sort();
  const row: IndexRow = {
    id: p.slug, n: p.name.slice(0, 180), t: p.title, s: p.specialties.map(s => s.slug).slice(0, 20), k: sites.map(s => s[0]),
    r: [score, p.rating.count], v: Math.min(p.reviews.length, 50), l: dates.at(-1) ?? null, o: online, f: today,
  };
  return {row, sites, kind: physical.length ? 'rm' : 'online'};
}

// ---------- prioridades ----------
export function buildQueue(st: CrawlState, cfg: DoctoraliaConfig, today: string, lastOpinion: Map<string, string>) {
  const groups: Record<string, Array<[string, number]>> = {changed: [], new: [], missing: [], retry: [], refresh: [], outside: []};
  for (const [slug, p] of Object.entries(st.profiles)) {
    if (p.s === 'baja') continue;
    const age = p.f ? daysBetween(p.f, today) : Infinity;
    const lo = lastOpinion.get(slug);
    const changed = p.f && ((p.m && p.m.slice(0, 10) > p.f) || (lo && lo.slice(0, 10) > p.f));
    if (p.s === 'nuevo' || !p.f) groups.new.push([slug, -(Date.parse(p.m ?? '1970-01-01') || 0)]);
    // Desapareció del sitemap después de la última lectura: se confirma una vez (un 404 lo da de baja).
    else if (p.x && (p.s === 'rm' || p.s === 'online') && p.f < p.x) groups.missing.push([slug, -age]);
    else if (p.s === 'error') { if (p.e < cfg.maxErrors && age >= cfg.errorRetryDays) groups.retry.push([slug, -age]); }
    else if ((p.s === 'rm' || p.s === 'online') && changed) groups.changed.push([slug, -age]);
    else if ((p.s === 'rm' || p.s === 'online') && age >= cfg.refreshDays) groups.refresh.push([slug, -age]);
    else if (p.s === 'fuera' && (changed || age >= cfg.outsideRecheckDays)) groups.outside.push([slug, -age]);
  }
  const order = ['changed', 'new', 'missing', 'retry', 'refresh', 'outside'] as const;
  const sizes = Object.fromEntries(order.map(k => [k, groups[k].length]));
  const queue = order.flatMap(k => groups[k].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([slug]) => slug));
  return {queue, sizes};
}

export function sourceEntry(cfg: DoctoraliaConfig, reviewedAt: string): Catalog['sources'][number] {
  return {
    id: 'doctoralia', name: cfg.name, owner: cfg.owner, url: cfg.baseUrl + '/', policyUrl: cfg.policyUrl, status: 'enabled',
    license: `Términos de uso de ${cfg.name} (no es una licencia abierta)`, mayPublish: true, mayRetain: true, mayDerive: true, reviewedAt,
    attribution: `Datos de perfiles y opiniones tomados de ${cfg.name}`, notes: cfg.publishNotes,
  };
}

const PROFILE_FILE = (dir: string, slug: string) => join(dir, slug + '.json');

/** Ejecuta una pasada. Nunca lanza por errores de red: los informa en el reporte y guarda el avance. */
export async function runDoctoralia(cfg: DoctoraliaConfig, opts: {
  paths?: Partial<Paths>; deps?: Deps; now?: Date; maxRequests?: number; maxMinutes?: number; limitProfiles?: number;
  policy?: (ix: DoctoraliaIndex) => void; userAgent?: string;
}): Promise<CrawlReport> {
  const paths = {...DEFAULT_PATHS, ...opts.paths};
  const deps = opts.deps ?? {};
  const log = deps.log ?? (() => {});
  const clock = deps.clock ?? Date.now;
  const now = opts.now ?? new Date();
  const today = day(now);
  const started = clock();
  const report: CrawlReport = {
    source: 'doctoralia', startedAt: now.toISOString(), finishedAt: '', status: 'unchanged', reason: null, requests: 0, stoppedBy: null,
    sitemaps: {read: 0, failed: 0, profiles: 0}, queue: {}, fetched: 0, rm: 0, online: 0, outside: 0, gone: 0, errors: 0, robotsBlocked: 0,
    written: 0, unchanged: 0, removed: 0, indexRows: 0, withRatings: 0, samples: [],
  };
  const finish = async () => {
    report.finishedAt = new Date().toISOString();
    await mkdir(paths.reportsDir, {recursive: true});
    await writeFile(join(paths.reportsDir, 'doctoralia.json'), JSON.stringify(report, null, 2) + '\n');
    return report;
  };
  if (!cfg.termsReviewedAt || now.getTime() - Date.parse(cfg.termsReviewedAt) > 365 * 86400000) {
    report.status = 'skipped'; report.reason = 'terms_review_required';
    return finish();
  }
  const ua = opts.userAgent ?? USER_AGENT;
  const policy = {domains: cfg.domains, maxRequests: opts.maxRequests ?? cfg.maxRequests, minIntervalMs: Math.max(2500, cfg.minIntervalMs), timeoutMs: cfg.timeoutMs, retries: 1, maxBytes: cfg.maxBytes, userAgent: ua, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8', maxRedirects: 3};
  const get = createFetcher(policy, {fetch: deps.fetch, guard: deps.guard, wait: deps.wait});
  const budgetMs = (opts.maxMinutes ?? cfg.maxMinutes) * 60000;
  const outOfTime = () => clock() - started >= budgetMs;

  // Estado e índice anteriores
  const state = await readJson<CrawlState>(paths.state, {version: 1, updatedAt: null, profiles: {}});
  const previousIndex = DoctoraliaIndexSchema.parse(await readJson<unknown>(paths.index, emptyIndex()));
  const book = bookFrom(previousIndex);
  let dirty = false;
  // Exclusiones: se retiran del índice y de las fichas, y no se vuelven a consultar.
  const excluded = await readExclusions(paths.exclusions);
  for (const slug of excluded) {
    if (book.rows.delete(slug)) { dirty = true; report.removed++; }
    await rm(PROFILE_FILE(paths.profilesDir, slug), {force: true});
    if (state.profiles[slug]) state.profiles[slug].s = 'baja';
  }

  const persist = async (final: boolean) => {
    // Retención: filas sin actualizar en el plazo se retiran (la ficha ya no se puede considerar vigente).
    // El perfil sigue en el estado y vuelve a la cola de refresco: si responde, su fila regresa.
    if (final) for (const [slug, row] of book.rows) if (daysBetween(row.f, today) > cfg.retentionDays) {
      book.rows.delete(slug); await rm(PROFILE_FILE(paths.profilesDir, slug), {force: true}); report.removed++; dirty = true;
    }
    const ix = indexFrom(book, now.toISOString());
    DoctoraliaIndexSchema.parse(ix);
    if (/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/.test(serializeIndex(ix))) throw new Error('rut_in_index');
    (opts.policy ?? (() => {}))(ix);
    state.updatedAt = now.toISOString();
    await writeAtomic(paths.state, serializeState(state));
    // El índice solo se reescribe si cambió (o si aún no existe): generatedAt indica el último cambio real.
    if (dirty || (final && !(await readFile(paths.index).then(() => true, () => false)))) await writeAtomic(paths.index, serializeIndex(ix));
    dirty = false;
    report.indexRows = ix.professionals.length;
    report.withRatings = ix.professionals.filter(r => (r.r[1] ?? 0) > 0).length;
  };

  try {
    // 1. robots.txt: 404 = sin restricciones (RFC 9309). Otros errores: no se consulta nada.
    let robots: Robots;
    try { robots = parseRobots(await get(cfg.baseUrl + '/robots.txt')); }
    catch (e) {
      if (e instanceof ProviderError && /^http_4(04|10)$/.test(e.reason)) robots = ALLOW_ALL;
      else throw e;
    }
    const delay = robotsCrawlDelay(robots, ua);
    if (delay !== null) policy.minIntervalMs = Math.max(policy.minIntervalMs, delay * 1000);
    const allowed = (url: string) => { const ok = robotsAllows(robots, ua, url); if (!ok) report.robotsBlocked++; return ok; };

    // 2. Sitemaps
    const seen = new Map<string, string | null>();
    const lastOpinion = new Map<string, string>();
    let sitemapsComplete = false;
    const indexUrl = cfg.baseUrl + cfg.sitemapIndex;
    if (allowed(indexUrl)) {
      try {
        const children = parseSitemap(await get(indexUrl)).sitemaps.map(s => s.loc)
          .filter(u => { try { return cfg.domains.includes(new URL(u).hostname); } catch { return false; } });
        const wanted = children.filter(u => new RegExp(cfg.sitemapPattern).test(u));
        const opinions = children.filter(u => new RegExp(cfg.lastOpinionPattern).test(u));
        let ok = 0;
        for (const u of [...new Set([...wanted, ...opinions])]) {
          if (!allowed(u)) { report.sitemaps.failed++; continue; }
          try {
            const {urls} = parseSitemap(await get(u));
            report.sitemaps.read++; ok += wanted.includes(u) ? 1 : 0;
            for (const e of urls) {
              const slug = profileSlug(e.loc);
              if (!slug) continue;
              if (opinions.includes(u)) { if (e.lastmod) lastOpinion.set(slug, e.lastmod); }
              if (wanted.includes(u)) { const prev = seen.get(slug); if (!prev || (e.lastmod && e.lastmod > prev)) seen.set(slug, e.lastmod); }
            }
          } catch (e) {
            if (e instanceof ProviderError && /^(access_denied|rate_limited|network_or_timeout|quota)/.test(e.reason)) throw e;
            report.sitemaps.failed++; log(`sitemap ${u}: ${String(e)}`);
          }
        }
        sitemapsComplete = wanted.length > 0 && ok === wanted.length;
      } catch (e) {
        if (e instanceof ProviderError && /^(access_denied|rate_limited|network_or_timeout|quota)/.test(e.reason)) throw e;
        report.sitemaps.failed++; log(`índice de sitemaps: ${String(e)}`);
      }
    }
    report.sitemaps.profiles = seen.size;
    for (const [slug, lastmod] of seen) {
      const p = state.profiles[slug];
      if (!p) state.profiles[slug] = {m: lastmod, f: null, s: 'nuevo', e: 0, h: null, x: null};
      else { p.m = lastmod ?? p.m; p.x = null; if (p.s === 'baja') { p.s = 'nuevo'; p.f = null; } }
    }
    if (sitemapsComplete) for (const [slug, p] of Object.entries(state.profiles)) if (!seen.has(slug) && !p.x && p.s !== 'baja') p.x = today;

    // 3. Cola de esta ejecución
    for (const slug of excluded) if (state.profiles[slug]) state.profiles[slug].s = 'baja';
    const {queue, sizes} = buildQueue(state, cfg, today, lastOpinion);
    report.queue = sizes;
    const limit = opts.limitProfiles ?? Infinity;
    let sinceCheckpoint = 0;

    // 4. Lectura de perfiles
    for (const slug of queue) {
      if (report.fetched >= limit) { report.stoppedBy = 'limit'; break; }
      if (outOfTime()) { report.stoppedBy = 'time'; break; }
      const url = `${cfg.baseUrl}/perfil/${slug}`;
      const st = state.profiles[slug];
      if (!allowed(url)) {
        st.s = 'fuera'; st.f = today;
        if (book.rows.delete(slug)) { dirty = true; report.removed++; await rm(PROFILE_FILE(paths.profilesDir, slug), {force: true}); }
        continue;
      }
      let html: string;
      try { html = await get(url); }
      catch (e) {
        if (e instanceof ProviderError && /^http_4(04|10)$/.test(e.reason)) {
          st.s = 'baja'; st.f = today; report.gone++;
          if (book.rows.delete(slug)) { dirty = true; report.removed++; }
          await rm(PROFILE_FILE(paths.profilesDir, slug), {force: true});
          continue;
        }
        if (e instanceof ProviderError && /^http_\d+$/.test(e.reason)) { st.s = 'error'; st.e++; st.f = today; report.errors++; continue; }
        throw e;
      }
      report.fetched++;
      const profile = parseFullProfile(html, url);
      const valid = profile ? DoctoraliaProfileSchema.safeParse(profile) : null;
      if (!profile || !valid?.success) {
        st.s = 'error'; st.e++; st.f = today; report.errors++;
        if (report.samples.length < 3) {
          const file = `doctoralia-sample-${report.samples.length + 1}.html`;
          await mkdir(paths.reportsDir, {recursive: true});
          await writeFile(join(paths.reportsDir, file), redactRut(scrubRut(html)));
          report.samples.push(file);
        }
        if (valid && !valid.success) log(`${slug}: ficha inválida ${valid.error.message.slice(0, 300)}`);
        continue;
      }
      st.e = 0; st.f = today;
      const entry = rowFor(profile, today);
      if (!entry) {
        st.s = 'fuera'; report.outside++;
        if (book.rows.delete(slug)) { dirty = true; report.removed++; }
        await rm(PROFILE_FILE(paths.profilesDir, slug), {force: true});
        continue;
      }
      const rowOk = IndexRowSchema.safeParse(entry.row);
      const sitesOk = entry.sites.every(s => IndexSiteSchema.safeParse(s).success);
      if (!rowOk.success || !sitesOk) { st.s = 'error'; st.e++; report.errors++; log(`${slug}: fila inválida`); continue; }
      st.s = entry.kind; report[entry.kind]++;
      for (const s of entry.sites) if (!book.sites.has(s[0])) book.sites.set(s[0], s);
      for (const sp of profile.specialties) if (!book.specialties.has(sp.slug)) { const info = specialtyFromSlug(sp.slug, sp.label); book.specialties.set(sp.slug, [info.name, info.profession]); }
      book.rows.set(slug, entry.row); dirty = true;
      const text = JSON.stringify(profile) + '\n';
      const hash = shortHash(text);
      if (hash !== st.h) { await writeAtomic(PROFILE_FILE(paths.profilesDir, slug), text); st.h = hash; report.written++; }
      else report.unchanged++;
      if (++sinceCheckpoint >= cfg.checkpointEvery) { sinceCheckpoint = 0; await persist(false); }
    }
    if (!report.stoppedBy) report.stoppedBy = 'done';
  } catch (e) {
    const reason = e instanceof ProviderError ? e.reason : /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT/.test(String(e)) ? 'network_error' : 'unexpected_error';
    if (reason === 'quota_exhausted') report.stoppedBy = 'quota';
    else {
      report.stoppedBy = /^(access_denied|rate_limited)/.test(reason) ? 'blocked' : 'error';
      report.status = report.stoppedBy === 'blocked' ? 'suspended' : 'failed';
      report.reason = reason;
      log(`doctoralia: ${reason}${e instanceof ProviderError ? '' : ' ' + String(e)}`);
    }
  }
  report.requests = get.stats().requests;
  try {
    await persist(true);
    // 5. La fuente queda registrada en catalog.json cuando el índice tiene filas (ahí vive el permiso de publicación).
    if (report.indexRows > 0) {
      const raw = await readFile(paths.catalog, 'utf8');
      const old = CatalogSchema.parse(JSON.parse(raw));
      const entry = sourceEntry(cfg, cfg.termsReviewedAt!);
      const prev = old.sources.find(s => s.id === 'doctoralia');
      if (!prev || JSON.stringify(prev) !== JSON.stringify(entry)) {
        const next = {...old, sources: prev ? old.sources.map(s => s.id === 'doctoralia' ? entry : s) : [...old.sources, entry], publishedAt: now.toISOString()};
        await atomicPublish(paths.catalog, next, old);
      }
    }
    if (report.status === 'unchanged' && (report.written || report.removed)) report.status = 'published';
  } catch (e) {
    report.status = 'failed'; report.reason = report.reason ?? 'persist_failed'; log(`doctoralia: no se pudo guardar ${String(e)}`);
  }
  return finish();
}

/** Fichas huérfanas (sin fila en el índice). Las usa la validación. */
export async function orphanProfiles(paths: Paths, ix: DoctoraliaIndex): Promise<string[]> {
  const ids = new Set(ix.professionals.map(r => r.id));
  let files: string[] = [];
  try { files = await readdir(paths.profilesDir); } catch { return []; }
  return files.filter(f => f.endsWith('.json') && !ids.has(f.slice(0, -5)));
}
