// FIXTURES SINTÉTICOS (FICTICIO). Páginas simuladas para probar los adaptadores sin red.
// Nunca deben llegar al catálogo público: publication-policy.ts bloquea las marcas FICTICIO/SYNTHETIC.

export const ROBOTS_DOCTORALIA_LIKE = `User-agent: *
Allow: /
Disallow: /stats.php

User-agent: AdsBot-Google
Disallow:

User-agent: *
Disallow: /*ranking-de-medicos*

User-agent: MLBot
Disallow: /

User-agent: *
Disallow: /buscar?
Disallow: *?white_label
Disallow: /public/doc
Disallow: /perfil/bloqueada-ficticia-robots
Sitemap: https://www.doctoralia.cl/sitemap.xml
`;

export const LISTING = `<!doctype html><html><head><meta name="robots" content="index,follow"></head><body>
<nav><a href="/clinicas/centro-ficticio">Centro FICTICIO</a><a href="/enfermedades/hipertension">Hipertensión</a>
<a href="/cardiologo/nunoa/banmedica">Con Banmédica</a><a href="/cardiologo/providencia">Cardiólogos</a></nav>
<div class="card"><a href="https://www.doctoralia.cl/perfil/ana-ficticia-uno">Dra. Ana FICTICIA Uno</a><a href="#profile-reviews">192 opiniones</a></div>
<div class="card"><a href="/beto-ficticio-dos/cardiologo/santiago">Dr. Beto FICTICIO Dos</a></div>
<div class="card"><a href="/perfil/carla-ficticia-tres?utm=x">Dra. Carla FICTICIA Tres</a></div>
<div class="card"><a href="/perfil/bloqueada-ficticia-robots">Dra. Bloqueada FICTICIA</a></div>
<div class="card"><a href="/perfil/sin-datos-ficticia">Dra. Sin Datos FICTICIA</a></div>
<div class="card"><a href="/perfil/ana-ficticia-uno">Repetido</a></div>
<a rel="next" href="/cardiologo/providencia?page=2">Siguiente</a>
</body></html>`;

export const LISTING_NOINDEX = `<html><head><meta name="robots" content="noindex,follow"></head><body><a href="/perfil/x-ficticio-y">X</a></body></html>`;

const consult = (street: string, commune: string, clinic: string, lat: string, lon: string) => `
<div class="address-box"><div class="inner"><h4>${street}, ${commune}</h4>
<a href="/${commune.toLowerCase()}">${commune}</a>
<a href="/clinicas/${clinic.toLowerCase().replace(/ /g, '-')}">${clinic}</a>
<a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}">Cómo llegar</a></div></div>`;

const colegiado = `<div class="registry"><span>Núm. Colegiado: </span><span>12345678-5</span><span>654321</span></div>`;

/** Estrategia 1: JSON-LD aggregateRating. */
export const PROFILE_JSONLD = `<html><head><link rel="canonical" href="https://www.doctoralia.cl/perfil/ana-ficticia-uno">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Physician","name":"Ana FICTICIA Uno","aggregateRating":{"@type":"AggregateRating","ratingValue":"4,8","reviewCount":"1.204","bestRating":"5","worstRating":"1"}}</script></head>
<body><h1 data-test-id="doctor-header-fullname"><span itemprop="name">Dra. Ana FICTICIA Uno Pérez</span></h1>${colegiado}
<a href="#profile-reviews">1.204 opiniones</a>
${consult('Avenida Ficticia 427', 'Providencia', 'Centro FICTICIO Norte', '-33.4323196', '-70.6182404')}
${consult('Calle Inventada 10', 'Viña del Mar', 'Fuera de RM FICTICIO', '-33.02', '-71.55')}
<div id="profile-reviews"><div data-test-id="opinion-block"><div data-score="1"></div></div></div></body></html>`;

/** Estrategia 2: microdatos itemprop. */
export const PROFILE_MICRODATA = `<html><body><h1>Dr. Beto FICTICIO Dos</h1>
<div itemprop="aggregateRating" itemscope><meta itemprop="ratingValue" content="4.5"><meta itemprop="reviewCount" content="37"></div>
${consult('Pasaje Ficticio 55, oficina 3', 'Santiago', 'Consulta FICTICIA Centro', '-33.44', '-70.65')}
<div itemprop="review"><meta itemprop="ratingValue" content="1"></div></body></html>`;

/** Estrategia 3: data-score fuera de reseñas + texto "N opiniones" para la cantidad. */
export const PROFILE_DATASCORE = `<html><body><h1>Dra. Carla FICTICIA Tres</h1>
<div class="summary"><div class="stars" data-score="4.9"></div><a href="#profile-reviews">2.310 opiniones</a></div>
${consult('Avenida Ficticia 900', 'Ñuñoa', 'Centro FICTICIO Sur', '-33.456', '-70.598')}
<div data-test-id="opinion-block"><div data-score="2"></div></div></body></html>`;

/** Estrategia 4: solo texto "N opiniones" (sin nota). */
export const PROFILE_TEXT_ONLY = `<html><body><h1>Dr. Dario FICTICIO Cuatro</h1><p>Opiniones: <a href="#profile-reviews">12 opiniones</a></p>
${consult('Calle Ficticia 1', 'Las Condes', 'Centro FICTICIO Oriente', '-33.41', '-70.57')}</body></html>`;

/** Perfil sin datos de valoración ni consultas presenciales. */
export const PROFILE_EMPTY = `<html><body><h1>Dra. Sin Datos FICTICIA</h1><p>Solo telemedicina.</p></body></html>`;
