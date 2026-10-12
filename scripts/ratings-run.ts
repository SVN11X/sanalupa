// Ejecutor común de valoraciones. Recibe la configuración y dependencias inyectables (fetch, guard, wait)
// para poder probarlo sin red. Uso: npm run scrape:ratings
//   SCRAPE_SOURCES=doctoralia,topdoctors   fuentes a ejecutar (por defecto todas las configuradas)
//   SCRAPE_LIMIT_LISTINGS=n                limita los listados por fuente (para pruebas cortas)
//   SCRAPE_MAX_REQUESTS=n                  tope de consultas por fuente en esta ejecución (por defecto 700)
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {CatalogSchema, type Catalog} from '../src/schema';
import {createFetcher, guardDestination, ProviderError} from './network';
import {parseRobots, robotsAllows, robotsCrawlDelay, ALLOW_ALL, DISALLOW_ALL, type Robots} from './robots';
import {idSlug, redactRut} from './adapters/common';
import {toCatalogParts, type ProfileItem, type SpecialtyRef} from './adapters/ratings-parts';
import * as doctoralia from './adapters/doctoralia';
import * as topdoctors from './adapters/topdoctors';
import {mergeSource, type SourceEntry} from './ratings-merge';
import {atomicPublish} from './publish';
import {assertPublishable, assertIndexPublishable} from './publication-policy';
import {runDoctoralia, type CrawlReport, type DoctoraliaConfig} from './doctoralia-crawl';

export const USER_AGENT = 'SaludCercaSantiago/1.0 (+https://github.com/SVN11X/sanalupa; agregados de valoraciones; una consulta cada 2,5 s)';

export type SourceConfig = {
  id: string; name: string; owner: string; baseUrl: string; domains: string[]; policyUrl: string;
  /** Fecha (AAAA-MM-DD) en que una persona leyó los términos de uso y concluyó que permiten este uso. null = no revisados. */
  termsReviewedAt: string | null; termsNote: string;
  discovery: 'listings' | 'sitemap';
  listingPattern: string; // p. ej. "/{specialty}/{commune}"
  specialties: SpecialtyRef[];
  communes: string[];
  maxPagesPerListing: number; maxProfilesPerListing: number;
  minIntervalMs: number; maxRequests: number; timeoutMs: number; maxBytes: number;
  retentionDays: number; rotate: boolean;
  publishNotes: string;
};

export type SourceReport = {
  source: string; status: 'published' | 'unchanged' | 'skipped' | 'suspended' | 'no_ratings' | 'failed';
  reason: string | null; requests: number; listings: number; profilesFound: number; profilesFetched: number;
  robotsBlocked: number; unparsed: number; withRatings: number; professionals: number; ratings: number; samples: string[];
};
export type RatingsReport = {startedAt: string; finishedAt: string; catalogChanged: boolean; sources: SourceReport[]};

export type Deps = {
  fetch?: typeof fetch;
  guard?: typeof guardDestination;
  wait?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
};

type Adapter = {
  listingUrls(cfg: SourceConfig, robots: Robots): Array<{url: string; specialty: SpecialtyRef | null}>;
  parseListing(html: string, cfg: SourceConfig, page: number): {profiles: string[]; hasNext: boolean};
  parseProfile(html: string, url: string, specialties: SpecialtyRef[]): ProfileItem | null;
  sitemapProfiles?(xml: string): {sitemaps: string[]; profiles: string[]};
};

function listingsFromPattern(cfg: SourceConfig) {
  const out: Array<{url: string; specialty: SpecialtyRef}> = [];
  for (const specialty of cfg.specialties) for (const commune of cfg.communes) {
    out.push({url: cfg.baseUrl + cfg.listingPattern.replace('{specialty}', specialty.slug).replace('{commune}', idSlug(commune)), specialty});
  }
  return out;
}

export const ADAPTERS: Record<string, Adapter> = {
  doctoralia: {
    listingUrls: cfg => listingsFromPattern(cfg),
    parseListing: (html, cfg, page) => doctoralia.parseListing(html, cfg.specialties.map(s => s.slug), page),
    parseProfile: (html, url, specs) => doctoralia.parseProfile(html, url, specs),
  },
  topdoctors: {
    listingUrls: cfg => cfg.discovery === 'listings' ? listingsFromPattern(cfg) : [],
    parseListing: html => topdoctors.parseListing(html),
    parseProfile: (html, url, specs) => topdoctors.parseProfile(html, url, specs),
    sitemapProfiles: xml => topdoctors.parseSitemap(xml),
  },
};

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

export function sourceEntry(cfg: SourceConfig, reviewedAt: string): SourceEntry {
  return {
    id: cfg.id, name: cfg.name, owner: cfg.owner, url: cfg.baseUrl + '/', policyUrl: cfg.policyUrl, status: 'enabled',
    license: `Términos de uso de ${cfg.name} (no es una licencia abierta)`,
    mayPublish: true, mayRetain: true, mayDerive: true, reviewedAt,
    attribution: `Promedios y cantidades de opiniones tomados de ${cfg.name}`,
    notes: cfg.publishNotes,
  };
}

/** Ejecuta una fuente. No escribe el catálogo: devuelve los perfiles leídos y el informe. */
export async function runSource(cfg: SourceConfig, adapter: Adapter, deps: Deps, opts: {now: Date; limitListings?: number; maxRequests?: number; userAgent?: string}) {
  const log = deps.log ?? (() => {});
  const report: SourceReport = {source: cfg.id, status: 'failed', reason: null, requests: 0, listings: 0, profilesFound: 0, profilesFetched: 0, robotsBlocked: 0, unparsed: 0, withRatings: 0, professionals: 0, ratings: 0, samples: []};
  const items: ProfileItem[] = [];
  const samples: string[] = [];
  if (!cfg.termsReviewedAt || opts.now.getTime() - Date.parse(cfg.termsReviewedAt) > 365 * 86400000) {
    report.status = 'skipped'; report.reason = 'terms_review_required';
    return {report, items, samples};
  }
  const ua = opts.userAgent ?? USER_AGENT;
  const policy = {domains: cfg.domains, maxRequests: opts.maxRequests ?? cfg.maxRequests, minIntervalMs: Math.max(2500, cfg.minIntervalMs), timeoutMs: cfg.timeoutMs, retries: 1, maxBytes: cfg.maxBytes, userAgent: ua, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8', maxRedirects: 3};
  const get = createFetcher(policy, {fetch: deps.fetch, guard: deps.guard, wait: deps.wait});
  try {
    // 1. robots.txt: 404 = sin restricciones (RFC 9309); otros errores = no se consulta nada.
    let robots: Robots;
    try { robots = parseRobots(await get(cfg.baseUrl + '/robots.txt')); }
    catch (e) {
      if (e instanceof ProviderError && /^http_4(04|10)$/.test(e.reason)) robots = ALLOW_ALL;
      else if (e instanceof ProviderError && e.reason === 'access_denied') throw e;
      else robots = DISALLOW_ALL;
    }
    const delay = robotsCrawlDelay(robots, ua);
    if (delay !== null) policy.minIntervalMs = Math.max(policy.minIntervalMs, delay * 1000);
    const allowed = (url: string) => { const ok = robotsAllows(robots, ua, url); if (!ok) report.robotsBlocked++; return ok; };
    // 2. Descubrimiento de perfiles
    const queue = new Map<string, SpecialtyRef[]>();
    const done = new Set<string>();
    const byUrl = new Map<string, ProfileItem>();
    const add = (url: string, specialty: SpecialtyRef | null) => {
      const list = queue.get(url) ?? [];
      if (specialty && !list.some(s => s.slug === specialty.slug)) list.push(specialty);
      queue.set(url, list);
      // Perfil ya leído desde otro listado: se suma la especialidad sin volver a consultarlo.
      const item = byUrl.get(url);
      if (item && specialty && !item.specialties.some(s => s.slug === specialty.slug)) item.specialties.push(specialty);
    };
    let listings = adapter.listingUrls(cfg, robots);
    if (cfg.rotate && listings.length) { const start = isoWeek(opts.now) % listings.length; listings = [...listings.slice(start), ...listings.slice(0, start)]; }
    if (opts.limitListings !== undefined) listings = listings.slice(0, opts.limitListings);
    if (cfg.discovery === 'sitemap' && adapter.sitemapProfiles) {
      const pending = [...robots.sitemaps].filter(u => cfg.domains.includes(new URL(u).hostname)).slice(0, 5);
      for (let i = 0; i < pending.length && i < 10; i++) {
        if (!allowed(pending[i])) continue;
        const parsed = adapter.sitemapProfiles(await get(pending[i]));
        pending.push(...parsed.sitemaps.filter(u => !pending.includes(u)).slice(0, 10 - pending.length));
        for (const p of parsed.profiles.slice(0, cfg.maxProfilesPerListing * Math.max(1, opts.limitListings ?? 10))) add(p, null);
      }
    }
    // Se procesan listado por listado: así una cuota agotada deja perfiles completos de los primeros listados.
    const fetchProfiles = async () => {
      for (const [url, specs] of queue) {
        if (specs.length === 0 && cfg.discovery !== 'sitemap') continue;
        if (done.has(url)) continue;
        done.add(url);
        if (!allowed(url)) continue;
        let html: string;
        try { html = await get(url); }
        catch (e) { if (e instanceof ProviderError && /^http_4\d\d$/.test(e.reason)) { report.unparsed++; continue; } throw e; }
        report.profilesFetched++;
        if (samples.length < 3) samples.push(html);
        const item = adapter.parseProfile(html, url, specs);
        if (!item || !item.consultations.length) { report.unparsed++; continue; }
        if (item.count !== null && item.count > 0) report.withRatings++;
        const prev = items.find(x => x.url === item.url);
        if (prev) { prev.specialties.push(...item.specialties.filter(s => !prev.specialties.some(p => p.slug === s.slug))); byUrl.set(url, prev); }
        else { item.specialties = [...item.specialties]; items.push(item); byUrl.set(url, item); }
      }
    };
    for (const listing of listings) {
      for (let page = 1; page <= cfg.maxPagesPerListing; page++) {
        const url = page === 1 ? listing.url : `${listing.url}?page=${page}`;
        if (!allowed(url)) break;
        let html: string;
        try { html = await get(url); }
        catch (e) { if (e instanceof ProviderError && /^http_4\d\d$/.test(e.reason)) break; throw e; }
        report.listings++;
        const parsed = adapter.parseListing(html, cfg, page);
        let added = 0;
        for (const p of parsed.profiles) {
          if (added >= cfg.maxProfilesPerListing) break;
          if (!queue.has(p)) report.profilesFound++;
          add(p, listing.specialty); added++;
        }
        if (!parsed.hasNext || !parsed.profiles.length) break;
      }
      await fetchProfiles();
    }
    await fetchProfiles();
    report.status = 'unchanged';
  } catch (e) {
    const reason = e instanceof ProviderError ? e.reason : 'unexpected_error';
    if (reason === 'quota_exhausted') { report.status = 'unchanged'; report.reason = 'quota_exhausted'; }
    else { report.status = /^access_denied|^rate_limited/.test(reason) ? 'suspended' : 'failed'; report.reason = reason; log(`${cfg.id}: ${reason}${e instanceof ProviderError ? '' : ' ' + String(e)}`); }
  }
  report.requests = get.stats().requests;
  return {report, items, samples};
}

/** Ejecuta varias fuentes y publica el catálogo solo si alguna aportó valoraciones válidas. */
export async function runRatings(opts: {configs: SourceConfig[]; catalogPath: string; reportsDir: string; deps?: Deps; now?: Date; limitListings?: number; maxRequests?: number; policy?: (c: Catalog) => void}): Promise<RatingsReport> {
  const deps = opts.deps ?? {};
  const now = opts.now ?? new Date();
  const startedAt = now.toISOString();
  const raw = await readFile(opts.catalogPath, 'utf8');
  const old = CatalogSchema.parse(JSON.parse(raw));
  let catalog: Catalog = old;
  let changed = false;
  const reports: SourceReport[] = [];
  await mkdir(opts.reportsDir, {recursive: true});
  for (const cfg of opts.configs) {
    const adapter = ADAPTERS[cfg.id];
    if (!adapter) { reports.push({source: cfg.id, status: 'skipped', reason: 'no_adapter', requests: 0, listings: 0, profilesFound: 0, profilesFetched: 0, robotsBlocked: 0, unparsed: 0, withRatings: 0, professionals: 0, ratings: 0, samples: []}); continue; }
    const {report, items, samples} = await runSource(cfg, adapter, deps, {now, limitListings: opts.limitListings, maxRequests: opts.maxRequests});
    reports.push(report);
    if (report.status === 'skipped' || report.status === 'suspended' || report.status === 'failed') continue;
    if (report.withRatings === 0) {
      report.status = 'no_ratings';
      report.reason = report.profilesFetched ? 'no_ratings_parsed_structure_may_have_changed' : (report.reason ?? 'no_profiles_found');
      for (const [i, html] of samples.entries()) {
        const file = `${cfg.id}-sample-${i + 1}.html`;
        await writeFile(join(opts.reportsDir, file), redactRut(html));
        report.samples.push(file);
      }
      continue;
    }
    const checkedAt = now.toISOString();
    const parts = toCatalogParts(items, checkedAt, {id: cfg.id, name: cfg.name});
    report.professionals = parts.professionals.length;
    report.ratings = parts.ratings.length;
    try {
      const candidate = CatalogSchema.parse(mergeSource(catalog, parts, cfg.id, {checkedAt, retentionDays: cfg.retentionDays, source: sourceEntry(cfg, checkedAt.slice(0, 10))}));
      (opts.policy ?? assertPublishable)(candidate); // bloquea fixtures FICTICIO/SYNTHETIC
      catalog = candidate; changed = true; report.status = 'published';
    } catch (e) {
      report.status = 'failed'; report.reason = 'validation_failed';
      deps.log?.(`${cfg.id}: validación fallida ${String(e).slice(0, 500)}`);
    }
  }
  if (changed) await atomicPublish(opts.catalogPath, catalog, old);
  const result: RatingsReport = {startedAt, finishedAt: new Date().toISOString(), catalogChanged: changed, sources: reports};
  await writeFile(join(opts.reportsDir, 'ratings.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

export async function loadConfigs(ids: string[]): Promise<SourceConfig[]> {
  return Promise.all(ids.map(async id => JSON.parse(await readFile(`scripts/${id}.json`, 'utf8')) as SourceConfig));
}

/** Resume el informe del recorrido completo de Doctoralia en el formato común de ratings.json. */
export function summarizeCrawl(r: CrawlReport): SourceReport {
  return {
    source: 'doctoralia', status: r.status, reason: r.reason ?? (r.stoppedBy && r.stoppedBy !== 'done' ? 'stopped_by_' + r.stoppedBy : null),
    requests: r.requests, listings: r.sitemaps.read, profilesFound: r.sitemaps.profiles, profilesFetched: r.fetched, robotsBlocked: r.robotsBlocked,
    unparsed: r.errors, withRatings: r.withRatings, professionals: r.indexRows, ratings: r.withRatings, samples: r.samples,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ids = (process.env.SCRAPE_SOURCES || 'doctoralia,topdoctors').split(',').map(s => s.trim()).filter(s => /^[a-z0-9-]+$/.test(s));
  const limit = process.env.SCRAPE_LIMIT_LISTINGS ? Math.max(0, Number(process.env.SCRAPE_LIMIT_LISTINGS) | 0) : undefined;
  const maxRequests = process.env.SCRAPE_MAX_REQUESTS ? Math.max(1, Number(process.env.SCRAPE_MAX_REQUESTS) | 0) : undefined;
  const maxMinutes = process.env.SCRAPE_MAX_MINUTES ? Math.max(1, Number(process.env.SCRAPE_MAX_MINUTES)) : undefined;
  const limitProfiles = process.env.SCRAPE_LIMIT_PROFILES ? Math.max(1, Number(process.env.SCRAPE_LIMIT_PROFILES) | 0) : undefined;
  const raw = await Promise.all(ids.map(async id => JSON.parse(await readFile(`scripts/${id}.json`, 'utf8')) as {mode?: string}));
  const full = raw.filter(c => c.mode === 'full') as unknown as DoctoraliaConfig[];
  const listing = raw.filter(c => c.mode !== 'full') as unknown as SourceConfig[];
  const crawls: SourceReport[] = [];
  for (const cfg of full) {
    const r = await runDoctoralia(cfg, {maxRequests, maxMinutes, limitProfiles, policy: assertIndexPublishable, deps: {log: m => console.error(m)}});
    crawls.push(summarizeCrawl(r));
  }
  const report = await runRatings({configs: listing, catalogPath: 'public/data/catalog.json', reportsDir: 'reports', limitListings: limit, maxRequests, deps: {log: m => console.error(m)}});
  report.sources = [...crawls, ...report.sources];
  report.catalogChanged = report.catalogChanged || crawls.some(c => c.status === 'published');
  await writeFile(join('reports', 'ratings.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
