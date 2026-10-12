// Lector completo de perfiles de Doctoralia Chile. Funciones puras: reciben HTML y devuelven datos, sin red.
//
// Estructura relevada el 12-10-2026 en perfiles reales (plantilla Docplanner):
//   cabecera   [data-id="doctor-header-section"]: título y nombre, especialidades, foto, "N opiniones"
//   sobre mí   #about-section y el modal [data-id="about-details-modal"]: listas bajo encabezados h3
//   precios    [data-id="service-item"]: servicio y precio ("$40.000", "Desde $45.000")
//   consultas  [data-id="doctor-address-item"]: nombre, calle, comuna, mapa, previsiones, pagos, teléfonos, sitio web
//   opiniones  JSON-LD Physician (fecha, nota, texto) + [data-test-id="opinion-block"] (verificación, lugar, servicio, respuesta)
//   preguntas  #profile-questions: tema, pregunta y respuesta del profesional
//
// Se guarda todo lo que el perfil muestra, con dos excepciones deliberadas:
//   - el nombre de quien escribe cada opinión (dato de un paciente, ligado a su salud), que además se reemplaza
//     por "[paciente]" si aparece dentro del texto de la opinión o de la respuesta;
//   - el RUT, que suele aparecer en "Núm. Colegiado"; se eliminan también los RUT escritos en cualquier texto.
// El lector usa solo métodos comunes a cheerio y jQuery, para poder probarlo también sobre páginas reales en un navegador.
import {canonicalCommune} from '../../src/geo';
import type {DoctoraliaConsultation, DoctoraliaProfile, DoctoraliaReview, DoctoraliaService} from '../../src/doctoralia';
import {extractRating, hasRut, jsonLdObjects, load, mapsLatLon, parseCount, parseScore, type CheerioRoot} from './common';

export const BASE = 'https://www.doctoralia.cl';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type Sel = ReturnType<CheerioRoot>;
type El = Parameters<CheerioRoot>[0];

// ---------- textos ----------
/** RUT con o sin puntos, con guion o espacio antes del dígito verificador. */
const RUT_ANY = /\b\d{1,2}\.?\d{3}\.?\d{3}\s?-\s?[\dkK]\b/g;
/** Secuencias de 8 o 9 dígitos seguidas: pueden ser un RUT escrito sin guion. */
const LONG_DIGITS = /(?<!\d)\d{8,9}(?!\d)/g;
export const scrubRut = (s: string) => s.replace(RUT_ANY, '[RUT omitido]');

/** Espacios normalizados; conserva saltos de línea simples. Elimina RUT. */
export function tidy(s: string | null | undefined, max = 400): string | null {
  if (s === null || s === undefined) return null;
  const t = scrubRut(String(s)).replace(/[ \t \r\f\v]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return t ? t.slice(0, max) : null;
}
const one = (s: string | null | undefined, max = 400) => tidy(s?.replace(/\s+/g, ' '), max);

/** Texto propio del elemento, sin el de sus hijos (p. ej. "En persona" sin "Ver ubicaciones (1)"). */
function ownText(el: Sel): string {
  return el.clone().children().remove().end().text();
}
/** Texto con <br>, párrafos y elementos de lista convertidos en saltos de línea. */
function multiline($: CheerioRoot, el: Sel): string {
  const c = el.clone();
  c.find('br').replaceWith('\n');
  c.find('p, li').each((_, x) => { $(x).append('\n'); });
  return c.text();
}
const uniq = <T>(xs: T[]) => [...new Set(xs)];
const nonEmpty = (xs: Array<string | null>) => uniq(xs.filter((x): x is string => !!x));

/** "//s3.amazonaws.com/x.jpg" → "https://s3.amazonaws.com/x.jpg"; rutas relativas se resuelven contra Doctoralia. */
export function absUrl(href: string | undefined | null): string | null {
  if (!href || href === '#' || /^(javascript|mailto|tel):/i.test(href)) return null;
  try {
    const u = new URL(href.startsWith('//') ? 'https:' + href : href, BASE);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    u.protocol = 'https:';
    return u.toString();
  } catch { return null; }
}

const MONTHS: Record<string, string> = {enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'};
/** "27 de agosto de 2026" o "2026-08-27T11:09:13-04:00" → "2026-08-27". */
export function parseDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const iso = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = String(s).toLowerCase().match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de|del)\s+(\d{4})/);
  if (!m || !MONTHS[m[2]]) return null;
  return `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, '0')}`;
}

/** Números declarados junto a "Núm. Colegiado", sin RUT: solo cifras sueltas de 3 a 7 dígitos. */
export function declaredRegistryNumbers(text: string): string[] {
  const clean = text.replace(RUT_ANY, ' ').replace(LONG_DIGITS, ' ').replace(/\b\d{1,2}\.\d{3}\.\d{3}\b/g, ' ');
  return uniq([...clean.matchAll(/(?<!\d|\d\.)\d{3,7}(?!\d|\.\d)/g)].map(m => m[0]));
}

/** Reemplaza el nombre visible de quien opina (y su primer nombre) dentro de un texto. */
export function redactAuthor(text: string | null, author: string | null): string | null {
  if (!text || !author) return text;
  const full = author.trim();
  const first = full.split(/\s+/)[0] ?? '';
  let out = text;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Primero el nombre completo y luego el primer nombre; una marca temporal evita reemplazar dos veces.
  for (const name of uniq([full, first]).filter(n => n.length >= 3 && /\p{L}/u.test(n))) {
    out = out.replace(new RegExp(`(?<![\\p{L}\\d])${esc(name)}(?![\\p{L}\\d])`, 'giu'), '\u0000');
  }
  return out.replace(/\u0000/g, '[paciente]');
}

// ---------- secciones ----------
const HEADINGS: Array<[RegExp, keyof DoctoraliaProfile]> = [
  [/^especialista en/i, 'subspecialties'],
  [/enfermedades tratadas/i, 'diseases'],
  [/^pacientes que atiendo/i, 'patients'],
  [/^formatos de consulta/i, 'formats'],
  [/^experiencia/i, 'experience'],
  [/^formaci[oó]n/i, 'education'],
  [/^idiomas/i, 'languages'],
  [/^publicaciones/i, 'publications'],
  [/^premios/i, 'awards'],
];
const NOISE = /^(\+\s*\d+|mostrar m[aá]s( detalles)?|ver m[aá]s|ver menos|mostrar menos)$/i;

/** Contenedor de una sección: sube desde el h3 hasta un elemento con más de un hijo. */
function sectionBox($: CheerioRoot, h: El): Sel {
  let box = $(h).parent();
  for (let i = 0; i < 4 && box.length && box.children().length < 2; i++) box = box.parent();
  return box;
}

function sectionItems($: CheerioRoot, box: Sel): string[] {
  let items: Array<string | null> = box.find('li').toArray().map(li => one(ownText($(li)) || $(li).text(), 600));
  if (!items.some(Boolean)) items = box.find('.badge').toArray().map(b => one($(b).text()));
  if (!items.some(Boolean)) items = box.children('div').find('span').toArray().filter(s => !$(s).closest('a,button').length && !$(s).is('.sr-only')).map(s => one(ownText($(s))));
  return nonEmpty(items).filter(x => !NOISE.test(x));
}

function headerName($: CheerioRoot): {title: string | null; name: string | null} {
  const box = $('[data-test-id="doctor-header-fullname"]').first();
  const spans = box.find('span').toArray().map(s => one($(s).text())).filter((x): x is string => !!x);
  const isTitle = (s: string) => /^[A-Za-zÁÉÍÓÚáéíóúÑñ]{1,8}\.$/.test(s);
  if (spans.length >= 2 && isTitle(spans[0])) return {title: spans[0], name: one(spans.slice(1).join(' '), 160)};
  const raw = one(box.text(), 160) ?? one($('h1').first().text(), 160);
  if (!raw) return {title: null, name: null};
  const m = raw.match(/^([A-Za-zÁÉÍÓÚáéíóúÑñ]{1,8}\.)\s+(.+)$/);
  return m ? {title: m[1], name: m[2]} : {title: null, name: raw};
}

function consultations($: CheerioRoot): DoctoraliaConsultation[] {
  const out: DoctoraliaConsultation[] = [];
  $('[data-id="doctor-address-item"]').each((_, sec) => {
    const s = $(sec);
    const id = (s.attr('id') ?? '').match(/address-(\d+)-tab/)?.[1] ?? null;
    const byId = (suffix: string) => id ? $(`[data-id="address-${id}-${suffix}"]`) : $([]);
    const nameEl = s.find('[data-test-id="address-info-name"]').first();
    const name = one(nameEl.text(), 180);
    const clinicHref = nameEl.find('a[href*="/clinicas/"]').first().attr('href') ?? s.find('a[href*="/clinicas/"]').not('[href*="/clinicas/enlace"]').first().attr('href');
    const streetRaw = one(s.find('[data-test-id="address-info-street"]').first().text(), 180);
    const street = streetRaw ? streetRaw.replace(/[\s,]+$/, '') || null : null;
    const h4 = s.find('h4').first();
    const cityRaw = one(h4.find('.city').attr('content') ?? h4.find('[itemprop="addressLocality"]').first().text());
    const region = one(h4.find('.province, .region').first().attr('content'));
    const commune = canonicalCommune(cityRaw);
    const maps = mapsLatLon(s.find('a[href*="google."][href*="maps"]').first().attr('href'));
    const looksOnline = /consulta online|online|telemedicina|telepsicolog|videoconsulta|teleconsulta|remot[oa]|virtual/i;
    const online = (!street && looksOnline.test(name ?? '')) || (!!street && looksOnline.test(street)) || (!street && !cityRaw);
    // Ventanas emergentes (modales) de la consulta: se buscan por su identificador, estén dentro o fuera de la tarjeta.
    let insurances = nonEmpty(byId('insurances').find('a').toArray().map(a => one($(a).text())));
    if (!insurances.length) insurances = nonEmpty(s.find('[data-test-id="address-insurances-modal"] a').toArray().map(a => one($(a).text())));
    let payments = nonEmpty(byId('payments').find('span').toArray().filter(x => !$(x).closest('.modal-header').length).map(x => one($(x).text())));
    if (!payments.length) payments = nonEmpty(s.find('[data-test-id="address-payment-method"]').toArray().map(x => one(ownText($(x)) || $(x).text()))).filter(x => !/ver m[aá]s/i.test(x));
    const phoneBoxes = s.find('[data-id$="-phone"]').add(id ? $(`[data-id^="address-${id}-"][data-id$="-phone"]`) : $([]));
    const phones = nonEmpty(phoneBoxes.find('b').toArray().map(b => one($(b).text(), 40))).filter(p => /\d{4}/.test(p) && !hasRut(p));
    const details = byId('details-modal');
    let website: string | null = null;
    details.find('a[href]').each((_, a) => {
      const u = absUrl($(a).attr('href'));
      if (!website && u && !/doctoralia\.|docplanner\.|google\./.test(new URL(u).hostname)) website = u;
    });
    const patients = details.find('h5').toArray().filter(h => /pacientes que atiendo/i.test($(h).text())).flatMap(h => $(h).parent().find('li').toArray().map(li => one($(li).text())));
    const services = nonEmpty(byId('services-list').find('[data-test-id="address-service-item"]').toArray().map(li => one($(li).find('span').first().text() || $(li).text(), 200)));
    const onlineBooking = s.find('[data-id="show-calendar-modal-button"]').length ? true : s.find('[data-id="no-active-calendar-vue"]').length ? false : null;
    if (!name && !street) return;
    out.push({
      id, name, clinicUrl: absUrl(clinicHref), online, street,
      commune, city: cityRaw, region, lat: maps?.lat ?? null, lon: maps?.lon ?? null,
      phones, website, insurances, payments, services, patients: nonEmpty(patients), onlineBooking,
    });
  });
  return out;
}

function services($: CheerioRoot): DoctoraliaService[] {
  const out: DoctoraliaService[] = [];
  $('[data-id="service-item"]').each((_, li) => {
    const item = $(li);
    const name = one(item.find('h3, h4').first().text() || item.find('span').first().text(), 200);
    if (!name || out.some(x => x.name === name)) return;
    let priceText: string | null = null;
    item.find('div, span, p').each((_, x) => {
      const t = one(ownText($(x)));
      if (!priceText && t && /\$\s?\d/.test(t)) priceText = t;
    });
    const priceStr = priceText as string | null;
    const amount = priceStr ? parseCount((priceStr.match(/\$\s?([\d.]+)/) ?? [])[1] ?? null) : null;
    out.push({name, price: amount, priceText: priceStr, from: !!priceStr && /desde/i.test(priceStr)});
  });
  return out;
}

type LdReview = {author?: {name?: string} | string; datePublished?: string; reviewBody?: string; reviewRating?: {ratingValue?: string | number}};

function reviews($: CheerioRoot): DoctoraliaReview[] {
  const ld = jsonLdObjects($).find(o => Array.isArray((o as {review?: unknown}).review)) as {review?: LdReview[]} | undefined;
  const ldReviews = ld?.review ?? [];
  const blocks = $('[data-test-id="opinion-block"]').toArray();
  const n = Math.max(blocks.length, ldReviews.length);
  const out: DoctoraliaReview[] = [];
  for (let i = 0; i < n; i++) {
    const b = blocks[i] ? $(blocks[i]) : null;
    const r = ldReviews[i];
    const outside = (x: El) => !$(x).closest('[data-id="doctor-answer-box"], [data-id="doctor-answer-content"]').length;
    const author = one(typeof r?.author === 'string' ? r.author : r?.author?.name)
      ?? (b ? one(b.find('.avatar-text').first().next('span').text()) : null);
    const id = b ? (b.attr('data-id') ?? (b.attr('id') ?? '').replace(/^o-/, '')) || null : null;
    const timeEl = b ? $(b.find('time').toArray().filter(outside)[0] ?? []) : null;
    const date = parseDate(r?.datePublished) ?? parseDate(timeEl?.attr('datetime')) ?? parseDate(timeEl?.text());
    const scoreEl = b ? b.find('[data-score]').toArray().filter(outside)[0] : undefined;
    const score = parseScore(r?.reviewRating?.ratingValue ?? null) ?? (scoreEl ? parseScore($(scoreEl).attr('data-score')) : null);
    const verification = b ? one(b.find('button span, .badge').toArray().map(x => $(x).text()).find(t => /verificad/i.test(t))) : null;
    let place: string | null = null, service: string | null = null;
    if (timeEl?.length) {
      const parts = (timeEl.next('span').text() || '').split('•').map(x => one(x, 200)).filter((x): x is string => !!x);
      if (parts.length >= 2) { place = parts[0]; service = parts.slice(1).join(' · '); } else if (parts.length === 1) service = parts[0];
    }
    const comment = b ? b.find('[data-test-id="opinion-comment"]').first() : null;
    const text = redactAuthor(tidy(comment?.length ? multiline($, comment) : r?.reviewBody, 6000), author);
    let reply: DoctoraliaReview['reply'] = null;
    const ans = b?.find('[data-id="doctor-answer-content"]').first();
    if (ans?.length) {
      const body = ans.find('p').toArray().filter(p => !$(p).is('.h5')).map(p => multiline($, $(p))).join('\n');
      const replyText = redactAuthor(tidy(body, 6000), author);
      if (replyText) reply = {text: replyText, date: parseDate(ans.find('time').first().attr('datetime')) ?? parseDate(ans.find('time').first().text())};
    }
    if (!text && score === null && !date) continue;
    out.push({id, date, score, verification, place, service, text, reply});
  }
  return out;
}

function qna($: CheerioRoot): DoctoraliaProfile['qna'] {
  const sec = $('#profile-questions');
  const count = parseCount((sec.text().replace(/\s+/g, ' ').match(/(\d[\d.]*)\s+dudas? solucionadas?/i) ?? [])[1] ?? null);
  const url = absUrl(sec.find('a[href*="/preguntas-y-respuestas/"]').first().attr('href'));
  const items: DoctoraliaProfile['qna']['items'] = [];
  $('[data-test-id="qna-question-body"]').each((_, q) => {
    let box = $(q).parent();
    for (let i = 0; i < 5 && box.length && !box.find('[data-test-id="qna-answer-body"]').length; i++) box = box.parent();
    const question = tidy(multiline($, $(q)), 4000);
    if (!question) return;
    const topic = one($(q).prev('p').text(), 200);
    const answer = tidy(box.find('[data-test-id="qna-answer-body"]').first().length ? multiline($, box.find('[data-test-id="qna-answer-body"]').first()) : null, 6000);
    items.push({topic, question, answer});
  });
  return {count, url, items};
}

/** Lee un perfil completo. Devuelve null si no se reconoce la estructura mínima (nombre y URL de perfil). */
export function extractFullProfile($: CheerioRoot, url: string): DoctoraliaProfile | null {
  // 1. "Núm. Colegiado": se leen solo los números que no son RUT y se elimina la línea antes de cualquier otra lectura.
  const declared: string[] = [];
  const LABEL = /N[uú]m\.?\s*Colegiado/i;
  const has = (el: El) => LABEL.test($(el).text());
  for (const scope of ['[data-id="doctor-header-section"] *', 'body *']) {
    // El elemento más interno que contiene la etiqueta y, desde ahí, la línea que la contiene (p, li o div).
    const deepest = $(scope).toArray().filter(el => has(el) && !$(el).find('*').toArray().some(has));
    for (const el of deepest) {
      const line = $(el).closest('p, li, div');
      const target = line.length ? line : $(el);
      declared.push(...declaredRegistryNumbers(target.text().replace(LABEL, ' ')));
      target.remove();
    }
    if (deepest.length) break;
  }
  // 2. Identidad
  const canonical = $('link[rel="canonical"]').attr('href');
  const pick = (u: string | undefined) => { const a = absUrl(u); if (!a) return null; const p = new URL(a).pathname.split('/').filter(Boolean); return p[0] === 'perfil' && p.length === 2 && SLUG.test(p[1]) ? p[1] : null; };
  const slug = pick(canonical) ?? pick(url.split('#')[0].split('?')[0]);
  const {title, name} = headerName($);
  if (!slug || !name || hasRut(name)) return null;
  const header = $('[data-id="doctor-header-section"]');
  const trackId = header.find('[data-one-tracking-entity_id]').first().attr('data-one-tracking-entity_id') ?? $('[data-one-tracking-entity_id]').first().attr('data-one-tracking-entity_id');
  const photo = absUrl(header.find('a.avatar').first().attr('href') ?? header.find('img').first().attr('src'));
  const specialties = uniq($('[data-test-id="doctor-specializations"] a[href]').toArray().map(a => {
    const href = $(a).attr('href') ?? '';
    const seg = (absUrl(href) ? new URL(absUrl(href)!).pathname : '').split('/').filter(Boolean)[0] ?? '';
    return SLUG.test(seg) ? JSON.stringify({slug: seg, label: one($(a).text(), 120) ?? seg}) : null;
  }).filter((x): x is string => !!x)).map(x => JSON.parse(x) as {slug: string; label: string});
  // 3. Sobre mí y modal de detalles
  const profile: DoctoraliaProfile = {
    slug, url: `${BASE}/perfil/${slug}`, doctoraliaId: trackId && /^\d+$/.test(trackId) ? trackId : null,
    title, name, photoUrl: photo,
    specialties, subspecialties: [], declaredRegistry: uniq(declared),
    about: null, patients: [], formats: [], diseases: [], languages: [], education: [], experience: [], publications: [], awards: [],
    certificates: [], social: [], badges: [], other: [], services: [], consultations: [],
    rating: {score: null, count: null, scaleMin: 1, scaleMax: 5, tags: []}, reviews: [], qna: {count: null, url: null, items: []},
  };
  const aboutModal = $('[data-id="content-modal-about"] .modal-body').first();
  const aboutInline = $('[data-test-id="about-description"]').first();
  profile.about = tidy(aboutModal.length ? multiline($, aboutModal) : aboutInline.length ? multiline($, aboutInline) : null, 20000);
  const heads = $('#about-section h3, [data-id="about-details-modal"] h3').toArray();
  for (const h of heads) {
    const heading = one($(h).text(), 120);
    if (!heading || /^fotos y videos/i.test(heading)) continue;
    const box = sectionBox($, h);
    if (/^certificados/i.test(heading)) { profile.certificates = uniq([...profile.certificates, ...box.find('a[href]').toArray().map(a => absUrl($(a).attr('href'))).filter((x): x is string => !!x)]); continue; }
    if (/^redes sociales/i.test(heading)) {
      for (const a of box.find('a[href]').toArray()) {
        const u = absUrl($(a).attr('href'));
        if (u && !profile.social.some(x => x.url === u)) profile.social.push({name: one($(a).text().split('\n').map(x => x.trim()).find(Boolean), 60) ?? new URL(u).hostname.replace(/^www\./, ''), url: u});
      }
      continue;
    }
    const items = sectionItems($, box);
    const key = HEADINGS.find(([re]) => re.test(heading))?.[1];
    if (key) { const bag = profile as unknown as Record<string, string[]>; bag[key] = uniq([...bag[key], ...items]); }
    else if (items.length && !/^experiencia$|^sobre m[ií]$/i.test(heading) && !profile.other.some(o => o.heading === heading)) profile.other.push({heading: heading.replace(/:$/, ''), items});
  }
  profile.badges = uniq($('img[alt^="Certificado de excelencia"], img[src*="/badge/best-quality-"]').toArray().map(i => Number(($(i).attr('src') ?? '').match(/best-quality-(\d{4})/)?.[1] ?? NaN)).filter(Number.isFinite)).sort();
  // 4. Precios, consultas, valoración, opiniones y preguntas
  profile.services = services($);
  profile.consultations = consultations($);
  const rating = extractRating($);
  profile.rating = {
    score: rating.score, count: rating.count, scaleMin: rating.scaleMin ?? 1, scaleMax: rating.scaleMax ?? 5,
    tags: nonEmpty($('[data-id="doctor-opinion-most-mentioned-tags"] .badge').toArray().map(x => one($(x).text()))),
  };
  profile.reviews = reviews($);
  profile.qna = qna($);
  return profile;
}

export function parseFullProfile(html: string, url: string): DoctoraliaProfile | null {
  return extractFullProfile(load(html), url);
}

// ---------- sitemaps ----------
export type SitemapEntry = {loc: string; lastmod: string | null};
/** Lee un sitemap (índice o lista de URLs). No usa un analizador XML: los sitemaps de Doctoralia son simples. */
export function parseSitemap(xml: string): {sitemaps: SitemapEntry[]; urls: SitemapEntry[]} {
  const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  const read = (tag: 'sitemap' | 'url') => [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => ({
    loc: decode(m[1].match(/<loc>([\s\S]*?)<\/loc>/)?.[1] ?? ''),
    lastmod: m[1].match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1]?.trim() ?? null,
  })).filter(e => e.loc);
  return {sitemaps: read('sitemap'), urls: read('url')};
}

/** Slug de una URL de perfil "https://www.doctoralia.cl/perfil/{slug}", o null. */
export function profileSlug(loc: string): string | null {
  try {
    const u = new URL(loc);
    if (u.hostname !== 'www.doctoralia.cl') return null;
    const p = u.pathname.split('/').filter(Boolean);
    return p[0] === 'perfil' && p.length === 2 && SLUG.test(p[1]) ? p[1] : null;
  } catch { return null; }
}
