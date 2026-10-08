// Fusión de los datos renovados de UNA fuente con el catálogo anterior.
// - Reemplaza los registros renovados de esa fuente.
// - Conserva los no visitados si fueron consultados hace `retentionDays` días o menos.
// - Nunca toca registros de otras fuentes.
import type {Catalog} from '../src/schema';
import type {CatalogParts} from './adapters/ratings-parts';

export type SourceEntry = Catalog['sources'][number];

export function ownedBy(sourceId: string, id: string): boolean {
  return id.startsWith(sourceId + ':') || id.startsWith('org:' + sourceId + ':');
}

export function mergeSource(old: Catalog, parts: CatalogParts, sourceId: string, opts: {checkedAt: string; retentionDays: number; source: SourceEntry}): Catalog {
  const own = (id: string) => ownedBy(sourceId, id);
  const cutoff = Date.parse(opts.checkedAt) - opts.retentionDays * 86400000;
  const renewed = new Set(parts.professionals.map(p => p.id));
  const recent = (d: string) => Date.parse(d) >= cutoff;
  const retainedPros = old.professionals.filter(p => own(p.id) && !renewed.has(p.id) && recent(p.name.evidence.checkedAt));
  const professionals = [...old.professionals.filter(p => !own(p.id)), ...parts.professionals, ...retainedPros];
  const proIds = new Set(professionals.map(p => p.id));
  const newRatingIds = new Set(parts.ratings.map(r => r.id));
  const retainedRatings = old.ratings.filter(r => r.sourceId === sourceId && own(r.id) && !newRatingIds.has(r.id) && !renewed.has(r.entityId) && proIds.has(r.entityId) && recent(r.extractedAt));
  const ratings = [...old.ratings.filter(r => !own(r.id)), ...parts.ratings, ...retainedRatings];
  const neededSites = new Set(retainedPros.flatMap(p => p.siteIds));
  const partSiteIds = new Set(parts.sites.map(s => s.id));
  const sites = [...old.sites.filter(s => !own(s.id)), ...parts.sites, ...old.sites.filter(s => own(s.id) && neededSites.has(s.id) && !partSiteIds.has(s.id))];
  const neededOrgs = new Set(sites.map(s => s.organizationId));
  const partOrgIds = new Set(parts.organizations.map(o => o.id));
  const organizations = [...old.organizations.filter(o => !own(o.id)), ...parts.organizations, ...old.organizations.filter(o => own(o.id) && neededOrgs.has(o.id) && !partOrgIds.has(o.id))]
    .filter(o => !own(o.id) || neededOrgs.has(o.id));
  const removed = [...old.professionals, ...old.ratings].map(x => x.id).filter(id => own(id) && !proIds.has(id) && !ratings.some(r => r.id === id));
  const sources = old.sources.some(s => s.id === sourceId) ? old.sources.map(s => s.id === sourceId ? opts.source : s) : [...old.sources, opts.source];
  return {
    ...old, sources, professionals, ratings, sites, organizations,
    removedIds: [...new Set([...old.removedIds, ...removed])],
    publishedAt: opts.checkedAt,
  };
}
