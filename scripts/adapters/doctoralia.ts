// Adaptador de Doctoralia Chile. Funciones puras: reciben HTML y devuelven datos. No hacen consultas a la red.
// Solo se guardan datos agregados: nombre, especialidad anunciada, consultas (dirección, comuna, coordenadas),
// promedio, cantidad de opiniones, escala, fecha y URL. Nunca se lee el campo "Núm. Colegiado" (a veces contiene un RUT).
import {cleanText, extractRating, load, mapsLatLon, splitAddress, stripTitle, hasRut} from './common';
import type {Consultation, ProfileItem, SpecialtyRef} from './ratings-parts';
export {parseRobots, robotsAllows} from '../robots';
export {toCatalogParts} from './ratings-parts';

export const BASE = 'https://www.doctoralia.cl';
// Primeros segmentos que nunca son perfiles.
const RESERVED = new Set(['clinicas', 'enfermedades', 'preguntas-respuestas', 'pregunta', 'servicios', 'buscar', 'perfil-medico', 'blog', 'registro-medico', 'tomar-el-control', 'doctor-add', 'anade-opinion', 'edit-opinion', 'marketing', 'ajax', 'api', 'enlace', 'public', 'nova', 'patient', 'tratamientos', 'especialidades-medicas', 'ciudades', 'login', 'telemedicina', 'terminos-y-condiciones']);

export type ListingResult = {profiles: string[]; hasNext: boolean};

/** Clasifica una ruta de Doctoralia. Devuelve la URL canónica del perfil o null. */
export function profileUrlFromHref(href: string, specialtySlugs: Set<string>): string | null {
  let u: URL;
  try { u = new URL(href, BASE); } catch { return null; }
  if (u.hostname !== 'www.doctoralia.cl') return null;
  const parts = u.pathname.split('/').filter(Boolean);
  if (!parts.length || RESERVED.has(parts[0])) return null;
  // /perfil/{slug}
  if (parts[0] === 'perfil' && parts.length === 2 && /^[a-z0-9-]+$/.test(parts[1])) return `${BASE}/perfil/${parts[1]}`;
  // /{slug}/{especialidad}/{ciudad}: el segundo segmento es una especialidad y el primero NO lo es
  // (si el primero es especialidad, es un listado filtrado por previsión, p. ej. /cardiologo/nunoa/banmedica).
  if (parts.length === 3 && !specialtySlugs.has(parts[0]) && specialtySlugs.has(parts[1]) && /^[a-z0-9-]+$/.test(parts[0]) && parts[0].includes('-')) {
    return `${BASE}/${parts.join('/')}`;
  }
  return null;
}

/** Lee un listado /{especialidad}/{comuna} y devuelve URLs de perfiles (sin clínicas, previsiones ni enfermedades). */
export function parseListing(html: string, specialtySlugs: Iterable<string>, page = 1): ListingResult {
  const $ = load(html);
  const slugs = new Set(specialtySlugs);
  const robotsMeta = ($('meta[name="robots"]').attr('content') ?? '').toLowerCase();
  if (robotsMeta.includes('noindex')) return {profiles: [], hasNext: false};
  const profiles: string[] = [];
  $('a[href]').each((_, el) => {
    const url = profileUrlFromHref($(el).attr('href') ?? '', slugs);
    if (url && !profiles.includes(url)) profiles.push(url);
  });
  const next = page + 1;
  const hasNext = $('a[rel="next"], a[aria-label="next"], a[aria-label="Siguiente"]').length > 0
    || $(`a[href*="page=${next}"]`).length > 0;
  return {profiles, hasNext};
}

function slugFromUrl(url: string): string {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  return parts[0] === 'perfil' ? parts[1] : parts[0];
}

/** Lee un perfil. Devuelve null si no se reconoce la estructura mínima (nombre). */
export function parseProfile(html: string, url: string, specialties: SpecialtyRef[] = []): ProfileItem | null {
  const $ = load(html);
  // Se elimina el bloque de colegiatura antes de leer cualquier texto.
  $('body *').each((_, el) => {
    const own = $(el).contents().filter((_, n) => n.type === 'text').text();
    if (/N[uú]m\.?\s*Colegiado/i.test(own)) $(el).parent().remove();
  });
  const canonical = $('link[rel="canonical"]').attr('href');
  const finalUrl = canonical && profileUrlFromHref(canonical, new Set(specialties.map(s => s.slug))) ? profileUrlFromHref(canonical, new Set(specialties.map(s => s.slug)))! : url.split('#')[0].split('?')[0];
  const rawName = $('[data-test-id="doctor-header-fullname"]').first().text()
    || $('h1 [itemprop="name"]').first().text()
    || $('h1').first().text();
  const name = cleanText(stripTitle(rawName.replace(/\s+/g, ' ')), 120);
  if (!name || hasRut(name)) return null;
  const consultations: Consultation[] = [];
  $('h4').each((_, h) => {
    const parsed = splitAddress($(h).text());
    if (!parsed) return;
    // Sube hasta el contenedor de la consulta (el que tiene el enlace a Google Maps o a la clínica).
    let box = $(h).parent();
    for (let i = 0; i < 6 && box.length && !box.find('a[href*="google."][href*="maps"], a[href*="/clinicas/"]').length; i++) box = box.parent();
    const maps = mapsLatLon(box.find('a[href*="google."][href*="maps"]').first().attr('href'));
    const clinicLink = box.find('a[href*="/clinicas/"]').filter((_, a) => !/\/clinicas\/enlace/.test($(a).attr('href') ?? '')).first();
    const clinicName = cleanText(clinicLink.text(), 120);
    if (consultations.some(c => c.address === parsed.street && c.commune === parsed.commune)) return;
    consultations.push({address: parsed.street, commune: parsed.commune, clinicName, lat: maps?.lat ?? null, lon: maps?.lon ?? null});
  });
  const rating = extractRating($);
  return {
    slug: slugFromUrl(finalUrl), url: finalUrl, reviewsUrl: finalUrl + '#profile-reviews', name, specialties, consultations,
    score: rating.score, count: rating.count, scaleMin: rating.scaleMin ?? 1, scaleMax: rating.scaleMax ?? 5,
  };
}
