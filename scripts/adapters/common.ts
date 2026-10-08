// Funciones puras compartidas por los adaptadores de valoraciones (sin red).
// Un "adaptador" lee el HTML de una plataforma y lo convierte al formato del catálogo.
import {createHash} from 'node:crypto';
import * as cheerio from 'cheerio';
import {canonicalCommune, inRegion, normalize} from '../../src/geo';

export type CheerioRoot = ReturnType<typeof cheerio.load>;
export const load = (html: string): CheerioRoot => cheerio.load(html);

/** Patrón de RUT chileno (con o sin puntos). Nunca se guarda. */
export const RUT_PATTERN = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g;
export const hasRut = (s: string) => new RegExp(RUT_PATTERN.source).test(s);
export const redactRut = (s: string) => s.replace(RUT_PATTERN, '[RUT-OMITIDO]');

/** Limpia espacios y descarta textos con RUT. */
export function cleanText(s: string | null | undefined, max = 180): string | null {
  if (!s) return null;
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t || hasRut(t)) return null;
  return t.slice(0, max);
}

export function shortHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/** Convierte un texto en un identificador seguro para el catálogo: [a-z0-9-]. */
export function idSlug(s: string): string {
  return normalize(s).replace(/ /g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

/** Cantidad con separador de miles chileno: "1.204 opiniones" → 1204. */
export function parseCount(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const m = String(text).match(/\d{1,3}(?:[.   ]\d{3})+(?!\d)|\d+/);
  if (!m) return null;
  const n = Number(m[0].replace(/[.   ]/g, ''));
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** Nota decimal: acepta "4,8" y "4.8". */
export function parseScore(text: string | number | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  if (typeof text === 'number') return Number.isFinite(text) ? text : null;
  const m = String(text).match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export type RatingMethod = 'json-ld' | 'microdata' | 'data-score' | 'text';
export type ExtractedRating = {
  score: number | null; count: number | null; scaleMin: number | null; scaleMax: number | null;
  scoreMethod: RatingMethod | null; countMethod: RatingMethod | null;
};

function* walkJson(v: unknown): Generator<Record<string, unknown>> {
  if (!v || typeof v !== 'object') return;
  if (Array.isArray(v)) { for (const x of v) yield* walkJson(x); return; }
  const o = v as Record<string, unknown>;
  yield o;
  for (const x of Object.values(o)) yield* walkJson(x);
}

export function jsonLdObjects($: CheerioRoot): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { out.push(...walkJson(JSON.parse($(el).text()))); } catch { /* JSON-LD inválido: se ignora */ }
  });
  return out;
}

const insideReview = ($: CheerioRoot, el: Parameters<CheerioRoot>[0]) =>
  $(el).closest('[itemprop="review"],[data-test-id="opinion-block"],.opinion,[data-id="opinion"]').length > 0;

/**
 * Extrae nota y cantidad en orden de prioridad, cada valor por separado:
 * 1) JSON-LD aggregateRating, 2) microdatos itemprop, 3) atributos data-score, 4) texto "N opiniones".
 * Las reseñas individuales se ignoran: solo interesa el agregado.
 */
export function extractRating($: CheerioRoot): ExtractedRating {
  const r: ExtractedRating = {score: null, count: null, scaleMin: null, scaleMax: null, scoreMethod: null, countMethod: null};
  // 1. JSON-LD
  for (const o of jsonLdObjects($)) {
    const agg = o.aggregateRating as Record<string, unknown> | undefined;
    if (!agg || typeof agg !== 'object') continue;
    const score = parseScore(agg.ratingValue as string | number);
    const count = parseCount(String(agg.reviewCount ?? agg.ratingCount ?? '')) ;
    if (r.score === null && score !== null) { r.score = score; r.scoreMethod = 'json-ld'; r.scaleMax = parseScore(agg.bestRating as string) ?? r.scaleMax; r.scaleMin = parseScore(agg.worstRating as string) ?? r.scaleMin; }
    if (r.count === null && count !== null && (agg.reviewCount ?? agg.ratingCount) !== undefined) { r.count = count; r.countMethod = 'json-ld'; }
    if (r.score !== null && r.count !== null) break;
  }
  // 2. Microdatos
  const prop = (name: string) => {
    let value: string | null = null;
    $(`[itemprop="${name}"]`).each((_, el) => {
      if (value !== null || insideReview($, el)) return;
      const v = $(el).attr('content') ?? $(el).text();
      if (v && v.trim()) value = v.trim();
    });
    return value;
  };
  if (r.score === null) { const v = parseScore(prop('ratingValue')); if (v !== null) { r.score = v; r.scoreMethod = 'microdata'; r.scaleMax = parseScore(prop('bestRating')) ?? r.scaleMax; r.scaleMin = parseScore(prop('worstRating')) ?? r.scaleMin; } }
  if (r.count === null) { const v = parseCount(prop('reviewCount') ?? prop('ratingCount')); if (v !== null) { r.count = v; r.countMethod = 'microdata'; } }
  // 3. data-score fuera de reseñas individuales
  if (r.score === null) {
    $('[data-score]').each((_, el) => {
      if (r.score !== null || insideReview($, el)) return;
      const v = parseScore($(el).attr('data-score'));
      if (v !== null) { r.score = v; r.scoreMethod = 'data-score'; }
    });
  }
  // 4. Texto "N opiniones" (solo cantidad)
  if (r.count === null) {
    const text = $('a[href*="#profile-reviews"]').first().text() + ' ' + $('body').text();
    const m = text.match(/(\d{1,3}(?:\.\d{3})+|\d+)\s*opini(?:ón|on|ones)\b/i);
    if (m) { r.count = parseCount(m[1]); r.countMethod = 'text'; }
  }
  return r;
}

/** Coordenadas desde un enlace de Google Maps con query=lat,lon. */
export function mapsLatLon(href: string | undefined): {lat: number; lon: number} | null {
  if (!href) return null;
  try {
    const u = new URL(href, 'https://www.google.com');
    const q = u.searchParams.get('query') ?? u.searchParams.get('q') ?? u.searchParams.get('destination') ?? '';
    const m = q.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
    if (!m) return null;
    const p = {lat: Number(m[1]), lon: Number(m[2])};
    return inRegion(p) ? p : null;
  } catch { return null; }
}

/** "Avenida Manuel Montt 427, Providencia" → {street, commune}. Solo comunas de la RM. */
export function splitAddress(text: string | null): {street: string; commune: string} | null {
  const t = cleanText(text);
  if (!t) return null;
  const idx = t.lastIndexOf(',');
  if (idx < 0) return null;
  const street = t.slice(0, idx).trim();
  const commune = canonicalCommune(t.slice(idx + 1).trim());
  if (!street || !commune) return null;
  return {street, commune};
}

/** Calle + número para comparar direcciones: "Av. Manuel Montt 427, piso 9" → "manuel montt 427". */
export function streetKey(address: string | null | undefined): string | null {
  if (!address) return null;
  const n = normalize(address).replace(/\b(avenida|av|calle|pasaje|psje)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const m = n.match(/^(.*?\D)\s*(\d+)\b/);
  return m ? `${m[1].trim()} ${m[2]}` : null;
}

/** Nombre sin títulos: "Dra. Ana Pérez Soto" → "Ana Pérez Soto". */
export function stripTitle(name: string): string {
  return name.replace(/^\s*(dr|dra|doctor|doctora|prof|ps|klgo|klga)\.?\s+/i, '').replace(/\s+/g, ' ').trim();
}

export function sameHost(url: string, base: string): boolean {
  try { return new URL(url, base).hostname === new URL(base).hostname; } catch { return false; }
}
