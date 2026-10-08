// Conversión común de perfiles extraídos a partes del catálogo (profesionales, sedes, organizaciones y valoraciones).
import type {Catalog, EvidenceType, ProfessionalType, RatingType, SiteType} from '../../src/schema';
import {idSlug, shortHash, streetKey} from './common';
import {normalize} from '../../src/geo';

export type Consultation = {address: string; commune: string; clinicName: string | null; lat: number | null; lon: number | null};
export type SpecialtyRef = {slug: string; name: string; profession: string};
export type ProfileItem = {
  slug: string; url: string; reviewsUrl?: string; name: string;
  specialties: SpecialtyRef[];
  consultations: Consultation[];
  score: number | null; count: number | null; scaleMin: number; scaleMax: number;
};
export type SourceMeta = {id: string; name: string};
export type CatalogParts = Pick<Catalog, 'professionals' | 'sites' | 'organizations' | 'ratings'>;

export function toCatalogParts(items: ProfileItem[], checkedAt: string, source: SourceMeta): CatalogParts {
  const professionals: ProfessionalType[] = [];
  const sites = new Map<string, SiteType>();
  const organizations = new Map<string, Catalog['organizations'][number]>();
  const ratings: RatingType[] = [];
  for (const item of items) {
    const slug = idSlug(item.slug);
    if (!slug || !item.name || !item.consultations.length || !item.specialties.length) continue;
    const ev = (statement: EvidenceType['statement'] = 'declared'): EvidenceType => ({sourceId: source.id, url: item.url, checkedAt, sourceUpdatedAt: null, statement});
    const siteIds: string[] = [];
    for (const c of item.consultations) {
      const key = (streetKey(c.address) ?? normalize(c.address)) + '|' + normalize(c.commune);
      const siteId = `${source.id}:site:${shortHash(key)}`;
      const orgKey = c.clinicName ? normalize(c.clinicName) : key;
      const orgId = `org:${source.id}:${shortHash(orgKey)}`;
      if (!organizations.has(orgId)) organizations.set(orgId, {id: orgId, name: {value: c.clinicName ?? `Consulta en ${c.address}`, evidence: ev('source_record')}});
      if (!sites.has(siteId)) {
        sites.set(siteId, {
          id: siteId, organizationId: orgId,
          name: {value: c.clinicName ?? `Consulta en ${c.address}`, evidence: ev('source_record')},
          address: {value: c.address, evidence: ev('source_record')},
          commune: {value: c.commune, evidence: ev('source_record')},
          location: c.lat !== null && c.lon !== null ? {lat: c.lat, lon: c.lon, precision: 'approximate', evidence: ev('source_record')} : null,
          contactUrl: null, bookingUrl: null, priceCLP: null, agreements: null, kind: 'practice', services: [], active: true,
        });
      }
      if (!siteIds.includes(siteId)) siteIds.push(siteId);
    }
    const id = `${source.id}:${slug}`;
    const unique = [...new Map(item.specialties.map(s => [s.slug, s])).values()];
    professionals.push({
      id, name: {value: item.name, evidence: ev()}, profession: {value: unique[0].profession, evidence: ev()},
      specialties: unique.map(s => ({name: s.name, kind: 'advertised' as const, evidence: ev()})),
      siteIds,
      credentials: {status: 'pending', evidence: null, checkedAt: null, scope: null, registryNumber: null},
      identityEvidence: ev(), profileLinks: [{value: item.url, evidence: ev('source_record')}], active: true,
    });
    if (item.count !== null && item.count > 0) {
      const score = item.score !== null && item.score >= item.scaleMin && item.score <= item.scaleMax ? item.score : null;
      ratings.push({
        id: `${source.id}:rating:${slug}`, entityType: 'professional', entityId: id, sourceId: source.id,
        score, scaleMin: item.scaleMin, scaleMax: item.scaleMax, totalCount: item.count, sampleCount: null,
        extractedAt: checkedAt, latestReviewAt: null, url: item.reviewsUrl ?? item.url,
        comparableGroup: `${source.id}:${unique[0].slug}`, mayDerive: true,
      });
    }
  }
  return {professionals, sites: [...sites.values()], organizations: [...organizations.values()], ratings};
}
