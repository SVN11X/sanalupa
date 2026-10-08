// Adaptador de Top Doctors Chile. Funciones puras, sin red.
// Las rutas de perfiles se descubren desde robots.txt y el sitemap (mapa de páginas que publica el sitio), no por fuerza bruta.
// Estado al 08-10-2026: términos y perfiles no legibles por programas (respuesta 404 a lectores automáticos). Fuente pendiente.
import {canonicalCommune} from '../../src/geo';
import {cleanText, extractRating, jsonLdObjects, load, mapsLatLon, stripTitle, hasRut} from './common';
import type {Consultation, ProfileItem, SpecialtyRef} from './ratings-parts';
export {parseRobots, robotsAllows} from '../robots';
export {toCatalogParts} from './ratings-parts';

export const BASE = 'https://www.topdoctors.cl';

export function profileUrlFromHref(href: string): string | null {
  try {
    const u = new URL(href, BASE);
    if (u.hostname !== 'www.topdoctors.cl') return null;
    const m = u.pathname.match(/^\/doctor\/([a-z0-9-]+)\/?$/);
    return m ? `${BASE}/doctor/${m[1]}/` : null;
  } catch { return null; }
}

/** Lee un sitemap XML: devuelve sitemaps hijos y URLs de perfiles. */
export function parseSitemap(xml: string): {sitemaps: string[]; profiles: string[]} {
  const $ = load(xml);
  const sitemaps: string[] = [];
  const profiles: string[] = [];
  $('sitemap > loc').each((_, el) => { const v = $(el).text().trim(); if (v) sitemaps.push(v); });
  $('url > loc').each((_, el) => { const p = profileUrlFromHref($(el).text().trim()); if (p && !profiles.includes(p)) profiles.push(p); });
  return {sitemaps, profiles};
}

export function parseListing(html: string): {profiles: string[]; hasNext: boolean} {
  const $ = load(html);
  const profiles: string[] = [];
  $('a[href]').each((_, el) => { const p = profileUrlFromHref($(el).attr('href') ?? ''); if (p && !profiles.includes(p)) profiles.push(p); });
  return {profiles, hasNext: $('a[rel="next"]').length > 0};
}

export function parseProfile(html: string, url: string, specialties: SpecialtyRef[] = []): ProfileItem | null {
  const $ = load(html);
  const ld = jsonLdObjects($);
  const person = ld.find(o => /Physician|Person|MedicalBusiness/i.test(String(o['@type'] ?? '')) && typeof o.name === 'string');
  const name = cleanText(stripTitle(String(person?.name ?? $('h1').first().text())), 120);
  if (!name || hasRut(name)) return null;
  const consultations: Consultation[] = [];
  for (const o of ld) {
    const a = o.address as Record<string, unknown> | undefined;
    if (!a || typeof a !== 'object') continue;
    const street = cleanText(String(a.streetAddress ?? ''), 140);
    const commune = canonicalCommune(String(a.addressLocality ?? ''));
    if (!street || !commune) continue;
    const geo = o.geo as Record<string, unknown> | undefined;
    const lat = geo ? Number(geo.latitude) : NaN, lon = geo ? Number(geo.longitude) : NaN;
    const loc = Number.isFinite(lat) && Number.isFinite(lon) ? mapsLatLon(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`) : null;
    if (!consultations.some(c => c.address === street && c.commune === commune)) consultations.push({address: street, commune, clinicName: cleanText(String(o.name ?? ''), 120) === name ? null : cleanText(String(o.name ?? ''), 120), lat: loc?.lat ?? null, lon: loc?.lon ?? null});
  }
  const rating = extractRating($);
  const slug = (url.match(/\/doctor\/([a-z0-9-]+)/) ?? [])[1] ?? '';
  return {slug, url: profileUrlFromHref(url) ?? url, name, specialties, consultations, score: rating.score, count: rating.count, scaleMin: rating.scaleMin ?? 1, scaleMax: rating.scaleMax ?? 5};
}
