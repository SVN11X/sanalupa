// Datos de Doctoralia publicados por el sitio: tipos, validación y conversión al catálogo.
// Funciones puras, sin red ni Node: se usan en el navegador y en los scripts de mantenimiento.
//
// Archivos (todos generados por scripts/doctoralia-crawl.ts, dentro de public/):
//   data/doctoralia/indice.json            índice compacto: una fila por profesional con al menos una consulta en la RM.
//   data/doctoralia/perfiles/{slug}.json   ficha completa de cada profesional (se carga solo al abrir su ficha).
// El estado del recorrido (qué perfil se consultó y cuándo) vive fuera del sitio, en estado/doctoralia.json.
import {z} from 'zod';
import {canonicalCommune, inRegion} from './geo';
import {specialtyFromSlug} from './specialties';
import type {Catalog, EvidenceType, ProfessionalType, RatingType, SiteType} from './schema';

export const DOCTORALIA_ID = 'doctoralia';
export const DOCTORALIA_BASE = 'https://www.doctoralia.cl';
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------- Ficha completa (lo que devuelve el lector de perfiles) ----------
export type DoctoraliaService = {name: string; price: number | null; priceText: string | null; from: boolean};
export type DoctoraliaConsultation = {
  id: string | null; name: string | null; clinicUrl: string | null; online: boolean;
  street: string | null; commune: string | null; city: string | null; region: string | null;
  lat: number | null; lon: number | null; phones: string[]; website: string | null;
  insurances: string[]; payments: string[]; services: string[]; patients: string[]; onlineBooking: boolean | null;
};
export type DoctoraliaReview = {
  id: string | null; date: string | null; score: number | null; verification: string | null;
  place: string | null; service: string | null; text: string | null;
  reply: {text: string; date: string | null} | null;
};
export type DoctoraliaProfile = {
  slug: string; url: string; doctoraliaId: string | null;
  title: string | null; name: string; photoUrl: string | null;
  specialties: Array<{slug: string; label: string}>; subspecialties: string[];
  /** Números que el profesional declara junto a "Núm. Colegiado", sin RUT. No es una verificación. */
  declaredRegistry: string[];
  about: string | null; patients: string[]; formats: string[]; diseases: string[]; languages: string[];
  education: string[]; experience: string[]; publications: string[]; awards: string[];
  certificates: string[]; social: Array<{name: string; url: string}>; badges: number[];
  other: Array<{heading: string; items: string[]}>;
  services: DoctoraliaService[];
  consultations: DoctoraliaConsultation[];
  rating: {score: number | null; count: number | null; scaleMin: number; scaleMax: number; tags: string[]};
  reviews: DoctoraliaReview[];
  qna: {count: number | null; url: string | null; items: Array<{topic: string | null; question: string; answer: string | null}>};
};

const Text = z.string().max(20000);
const Short = z.string().max(400);
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Item = z.string().max(1000); // elemento de lista (formación, experiencia, enfermedades…)
export const DoctoraliaProfileSchema = z.object({
  slug: z.string().regex(SLUG), url: z.string().url(), doctoraliaId: z.string().nullable(),
  title: Short.nullable(), name: Short.min(1), photoUrl: z.string().nullable(),
  specialties: z.array(z.object({slug: z.string(), label: Short})), subspecialties: z.array(Item),
  declaredRegistry: z.array(z.string().regex(/^\d{3,7}$/)),
  about: Text.nullable(), patients: z.array(Item), formats: z.array(Item), diseases: z.array(Item), languages: z.array(Item),
  education: z.array(Item), experience: z.array(Item), publications: z.array(Text), awards: z.array(Text),
  certificates: z.array(z.string()), social: z.array(z.object({name: Short, url: z.string()})), badges: z.array(z.number().int()),
  other: z.array(z.object({heading: Short, items: z.array(Text)})),
  services: z.array(z.object({name: Short, price: z.number().nonnegative().nullable(), priceText: Short.nullable(), from: z.boolean()})),
  consultations: z.array(z.object({
    id: z.string().nullable(), name: Short.nullable(), clinicUrl: z.string().nullable(), online: z.boolean(),
    street: Short.nullable(), commune: Short.nullable(), city: Short.nullable(), region: Short.nullable(),
    lat: z.number().nullable(), lon: z.number().nullable(), phones: z.array(Short), website: z.string().nullable(),
    insurances: z.array(Short), payments: z.array(Short), services: z.array(Short), patients: z.array(Short), onlineBooking: z.boolean().nullable(),
  })),
  rating: z.object({score: z.number().nullable(), count: z.number().int().nonnegative().nullable(), scaleMin: z.number(), scaleMax: z.number(), tags: z.array(Short)}),
  reviews: z.array(z.object({
    id: z.string().nullable(), date: DateOnly.nullable(), score: z.number().nullable(), verification: Short.nullable(),
    place: Short.nullable(), service: Short.nullable(), text: Text.nullable(),
    reply: z.object({text: Text, date: DateOnly.nullable()}).nullable(),
  })),
  qna: z.object({count: z.number().int().nonnegative().nullable(), url: z.string().nullable(), items: z.array(z.object({topic: Short.nullable(), question: Text, answer: Text.nullable()}))}),
});

/** Consultas presenciales dentro de la Región Metropolitana (las que se publican como sedes). */
export function rmConsultations(p: Pick<DoctoraliaProfile, 'consultations'>): DoctoraliaConsultation[] {
  return p.consultations.filter(c => !c.online && !!c.street && !!canonicalCommune(c.commune));
}

// ---------- Índice compacto ----------
// Sede: [clave, claveOrganización, nombre, calle, comuna, lat, lon]
export type IndexSite = [key: string, org: string, name: string, street: string, commune: string, lat: number | null, lon: number | null];
export type IndexRow = {
  id: string;                         // slug del perfil
  n: string;                          // nombre sin título
  t: string | null;                   // título (Dr., Dra., Ps., …)
  s: string[];                        // rutas de especialidad de Doctoralia, la primera es la principal
  k: string[];                        // claves de sedes en la RM (vacío si solo atiende online)
  r: [score: number | null, count: number | null];
  v: number;                          // opiniones visibles guardadas en la ficha (máximo 10)
  l: string | null;                   // fecha de la opinión más reciente
  o: boolean;                         // ofrece consulta online
  f: string;                          // fecha de consulta (AAAA-MM-DD)
};
export type DoctoraliaIndex = {
  version: 1; source: 'doctoralia'; generatedAt: string | null;
  specialties: Record<string, [name: string, profession: string]>;
  sites: IndexSite[]; professionals: IndexRow[];
};

const Key = z.string().regex(/^[0-9a-f]{12}$/);
export const IndexSiteSchema = z.tuple([Key, Key, z.string().min(1).max(180), z.string().min(1).max(180), z.string().refine(c => canonicalCommune(c) === c, 'Comuna desconocida'), z.number().nullable(), z.number().nullable()]);
export const IndexRowSchema = z.object({
  id: z.string().regex(SLUG).max(200), n: z.string().min(1).max(180), t: z.string().max(20).nullable(),
  s: z.array(z.string().regex(SLUG)).max(20), k: z.array(Key).max(40),
  r: z.tuple([z.number().min(1).max(5).nullable(), z.number().int().nonnegative().nullable()]),
  v: z.number().int().min(0).max(50), l: DateOnly.nullable(), o: z.boolean(), f: DateOnly,
}).strict();
export const DoctoraliaIndexSchema = z.object({
  version: z.literal(1), source: z.literal('doctoralia'), generatedAt: z.string().nullable(),
  specialties: z.record(z.string(), z.tuple([z.string().min(1).max(120), z.string().min(1).max(120)])),
  sites: z.array(IndexSiteSchema), professionals: z.array(IndexRowSchema),
}).strict();

export const emptyIndex = (): DoctoraliaIndex => ({version: 1, source: 'doctoralia', generatedAt: null, specialties: {}, sites: [], professionals: []});

/** JSON con una fila por línea: las diferencias diarias en Git quedan pequeñas y legibles. */
export function serializeIndex(ix: DoctoraliaIndex): string {
  const rows = (xs: unknown[]) => xs.length ? '[\n' + xs.map(x => JSON.stringify(x)).join(',\n') + '\n]' : '[]';
  return `{"version":1,"source":"doctoralia","generatedAt":${JSON.stringify(ix.generatedAt)},\n"specialties":${JSON.stringify(ix.specialties)},\n"sites":${rows(ix.sites)},\n"professionals":${rows(ix.professionals)}}\n`;
}

export const profileUrl = (slug: string) => `${DOCTORALIA_BASE}/perfil/${slug}`;
export const professionalId = (slug: string) => `${DOCTORALIA_ID}:${slug}`;
export const slugFromProfessionalId = (id: string) => id.startsWith(DOCTORALIA_ID + ':') ? id.slice(DOCTORALIA_ID.length + 1) : null;

export type CatalogParts = Pick<Catalog, 'professionals' | 'sites' | 'organizations' | 'ratings'>;

/**
 * Convierte el índice al formato del catálogo. Solo se usa si la fuente figura habilitada en catalog.json
 * (ahí está el permiso de publicación). Las evidencias se comparten entre campos para ahorrar memoria.
 */
export function expandIndex(ix: DoctoraliaIndex): CatalogParts {
  const checked = ix.generatedAt ?? '1970-01-01';
  const siteEv: EvidenceType = {sourceId: DOCTORALIA_ID, url: DOCTORALIA_BASE + '/', checkedAt: checked.slice(0, 10), sourceUpdatedAt: null, statement: 'source_record'};
  const sites = new Map<string, SiteType>();
  const organizations = new Map<string, Catalog['organizations'][number]>();
  for (const [key, org, name, street, commune, lat, lon] of ix.sites) {
    const orgId = `org:${DOCTORALIA_ID}:${org}`;
    if (!organizations.has(orgId)) organizations.set(orgId, {id: orgId, name: {value: name, evidence: siteEv}});
    const point = lat !== null && lon !== null && inRegion({lat, lon}) ? {lat, lon} : null;
    sites.set(key, {
      id: `${DOCTORALIA_ID}:site:${key}`, organizationId: orgId,
      name: {value: name, evidence: siteEv}, address: {value: street, evidence: siteEv}, commune: {value: commune, evidence: siteEv},
      location: point ? {...point, precision: 'approximate', evidence: siteEv} : null,
      contactUrl: null, bookingUrl: null, priceCLP: null, agreements: null, kind: 'practice', services: [], active: true,
    });
  }
  const professionals: ProfessionalType[] = [];
  const ratings: RatingType[] = [];
  for (const row of ix.professionals) {
    const siteIds = row.k.filter(k => sites.has(k)).map(k => `${DOCTORALIA_ID}:site:${k}`);
    if (!siteIds.length && !row.o) continue; // sin consulta presencial en la RM ni atención online
    const url = profileUrl(row.id);
    const ev: EvidenceType = {sourceId: DOCTORALIA_ID, url, checkedAt: row.f, sourceUpdatedAt: null, statement: 'declared'};
    const specs = row.s.map(slug => {
      const known = ix.specialties[slug];
      return known ? {slug, name: known[0], profession: known[1]} : specialtyFromSlug(slug);
    });
    const id = professionalId(row.id);
    professionals.push({
      id, name: {value: row.n, evidence: ev},
      profession: {value: specs[0]?.profession ?? 'Profesional de la salud', evidence: ev},
      specialties: specs.map(s => ({name: s.name, kind: 'advertised' as const, evidence: ev})),
      siteIds, credentials: {status: 'pending', evidence: null, checkedAt: null, scope: null, registryNumber: null},
      identityEvidence: ev, profileLinks: [{value: url, evidence: {...ev, statement: 'source_record'}}], active: true, online: row.o,
    });
    const [score, count] = row.r;
    if (count !== null && count > 0) {
      ratings.push({
        id: `${DOCTORALIA_ID}:rating:${row.id}`, entityType: 'professional', entityId: id, sourceId: DOCTORALIA_ID,
        score: score !== null && score >= 1 && score <= 5 ? score : null, scaleMin: 1, scaleMax: 5,
        totalCount: count, sampleCount: Math.min(row.v, count), extractedAt: row.f, latestReviewAt: row.l,
        url: url + '#profile-reviews', comparableGroup: `${DOCTORALIA_ID}:${row.s[0] ?? 'general'}`, mayDerive: true,
      });
    }
  }
  const used = new Set(professionals.flatMap(p => p.siteIds));
  const keptSites = [...sites.values()].filter(s => used.has(s.id));
  const keptOrgs = new Set(keptSites.map(s => s.organizationId));
  return {professionals, sites: keptSites, organizations: [...organizations.values()].filter(o => keptOrgs.has(o.id)), ratings};
}

/** Une el índice al catálogo si la fuente está habilitada y con permiso de publicación. Si no, devuelve el catálogo igual. */
export function mergeIndexIntoCatalog(c: Catalog, ix: DoctoraliaIndex | null): Catalog {
  const source = c.sources.find(s => s.id === DOCTORALIA_ID);
  if (!ix || !source || source.status !== 'enabled' || !source.mayPublish || !source.license) return c;
  const parts = expandIndex(ix);
  if (!parts.professionals.length) return c;
  const own = (id: string) => id.startsWith(DOCTORALIA_ID + ':') || id.startsWith(`org:${DOCTORALIA_ID}:`);
  return {
    ...c,
    professionals: [...c.professionals.filter(p => !own(p.id)), ...parts.professionals],
    sites: [...c.sites.filter(s => !own(s.id)), ...parts.sites],
    organizations: [...c.organizations.filter(o => !own(o.id)), ...parts.organizations],
    ratings: [...c.ratings.filter(r => !own(r.id)), ...parts.ratings],
  };
}
