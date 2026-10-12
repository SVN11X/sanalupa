// FIXTURES SINTÉTICOS (FICTICIO). Reproducen la estructura de los perfiles reales de Doctoralia Chile
// relevada el 12-10-2026 (atributos data-test-id / data-id, JSON-LD y ventanas emergentes), con datos inventados.
// Nunca deben llegar al sitio publicado: publication-policy.ts bloquea las marcas FICTICIO/SYNTHETIC.

const svg = '<svg><path d="M0 0"/></svg>';

const reviewLd = (author: string, date: string, score: number, body: string) =>
  `{"@type":"Review","author":{"@type":"Person","name":${JSON.stringify(author)}},"datePublished":"${date}","reviewRating":{"@type":"Rating","ratingValue":${score},"bestRating":5,"worstRating":1},"reviewBody":${JSON.stringify(body)}}`;

const opinion = (o: {id: string; author: string; verified: string; score: number; text: string; date: string; place: string; service: string; reply?: {text: string; date: string}}) => `
<div id="o-${o.id}" data-test-id="opinion-block" data-id="${o.id}"><div class="text-break">
 <div class="d-flex"><div class="d-flex align-items-center"><span class="avatar-text">${o.author[0]}</span><span>${o.author}</span>
  <div class="d-inline-flex"><button class="bg-transparent"><span>${o.verified}</span></button>
   <div class="modal-content"><div class="modal-header"><h3 class="modal-title">Tipos de verificación</h3></div>
   <div class="modal-body"><p>Verificamos la autenticidad de todas las opiniones.</p><span>Opinión verificada</span><p>Pacientes que verificaron su número de teléfono.</p><span>Cita verificada</span><p>Pacientes que reservaron su cita.</p></div></div></div>
 </div><div data-score="${o.score}" class="rating rating-md"></div></div>
 <p data-test-id="opinion-comment" class="text-break">${o.text}</p>
 <div class="d-flex align-items-center"><time class="small text-muted">${o.date}</time>
  <span class="small text-muted"><span class="opinion__bullet">•</span> ${o.place} <span class="opinion__bullet">•</span> ${o.service}</span>
  <span class="opinion__bullet">•</span><div data-id="report-abuse"><report-abuse></report-abuse></div></div>
 ${o.reply ? `<div data-id="doctor-answer-box"><div data-id="doctor-answer-content" class="mb-1 ml-lg-5 bg-gray-75 rounded p-2"><div>
   <div class="d-flex align-items-center"><img class="avatar avatar-xs mr-1" src="//s3.example.org/ficticio.jpg"><p class="h5 mb-0">Dra. Ana FICTICIA Uno</p></div>
   <p class="mb-1">${o.reply.text}<br></p><time class="small text-muted">${o.reply.date}</time></div>
   <div data-id="error-message" class="alert alert-danger hide"></div></div></div>` : ''}
 <div data-id="thumbs-up-down" class="my-2"></div><hr></div></div>`;

const address = (o: {id: string; name: string; clinic?: string; street?: string; commune?: string; region?: string; lat?: string; lon?: string; online?: boolean; insurances: string[]; payments: string[]; phone?: string; website?: string; services: string[]; patients: string[]; calendar: boolean}) => `
<section id="address-${o.id}-tab" data-id="doctor-address-item" class="tab-pane">
 <div class="profile-address-card"><div class="profile-address-card__header"><div class="min-width-0">
  ${o.online ? `<img class="profile-address-card__icon" src="//s3.example.org/online.svg"><h3 data-test-id="address-info-name">${o.name}</h3>`
    : `<span data-test-id="address-info-name">${o.clinic ? `<a href="/clinicas/${o.clinic}" class="text-body">${o.name}</a>` : o.name}</span>
  <h4 class="profile-address-card__street"><span content=""></span><span content="${o.commune}" class="city"></span><span content="${o.region ?? 'Metropolitana de Santiago'}" class="province region"></span><span content="CL"></span>
   <span class="text-body"><span data-test-id="address-info-street">${o.street},</span> <a href="/psicologo/${(o.commune ?? '').toLowerCase()}" class="text-body">${o.commune}</a></span></h4>`}
 </div>${o.lat ? `<a href="https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lon}" class="align-items-center"><span>Ampliar</span><span class="sr-only">se abre en una nueva pestaña</span></a>` : ''}
 <section class="mb-0"><h3 class="sr-only">Disponibilidad</h3>${o.calendar ? '<button data-id="show-calendar-modal-button" class="btn btn-primary"><span>Mostrar el calendario</span></button>' : '<p>Este especialista no ofrece reserva online en esta dirección.</p><div data-id="no-active-calendar-vue"><no-active-calendar></no-active-calendar></div>'}</section>
 </div></div>
 <section data-test-id="address-payment-summary"><h3>Formas de pago (visitas privadas)</h3><ul>
  <li class="text-body"><span>Previsiones aceptadas en esta dirección</span><button data-test-id="address-insurances-modal-trigger">Detalles</button></li>
  ${o.payments.slice(0, 2).map(p => `<li data-test-id="address-payment-method" class="text-body">${p}</li>`).join('')}
  ${o.payments.length > 2 ? `<li data-test-id="address-payment-method"><button>+ ${o.payments.length - 2} ver más</button></li>` : ''}</ul>
  <div data-test-id="address-insurances-modal" data-id="address-${o.id}-insurances" class="modal"><div class="modal-content">
   <div class="modal-header"><div><h4 data-test-id="address-modal-title" class="modal-title">Previsiones aceptadas</h4><p data-test-id="address-modal-address-title">${o.name}</p></div></div>
   <div class="p-2"><h5><span class="text-body">Pacientes privados</span><hr class="my-1">
   ${o.insurances.map(i => `<a href="/psicologo/santiago/${i.toLowerCase().replace(/ /g, '-')}" class="text-body">${i}</a><hr class="my-1">`).join('')}
   <p class="text-body">Planes aceptados:</p><span class="text-muted">${o.insurances[0] ?? ''}</span></h5></div></div></div>
  <div data-id="address-${o.id}-payments" class="modal"><div class="modal-content"><div class="modal-header"><div><h4 data-test-id="address-modal-title">Métodos de pago</h4><p data-test-id="address-modal-address-title">${o.name}</p></div></div>
   <div class="p-2">${o.payments.map(p => `<span>${p}</span><hr>`).join('')}</div></div></div>
 </section>
 ${o.phone ? `<section class="profile-address-phone"><h3>Número de teléfono</h3><div><div class="d-flex"><div data-id="gdpr-show-number-block"><span data-id="shrinked-number">${o.phone.slice(0, 8)}...</span><button data-id="show-phone-number-modal"><u>Mostrar número de teléfono</u></button></div>
  <div data-id="address-${o.id}-${o.phone.replace(/\D/g, '')}-2-phone" class="modal"><div class="modal-content"><div class="modal-header"><div><h4 data-test-id="address-modal-title">Número de teléfono</h4><p data-test-id="address-modal-address-title">${o.name}</p></div></div>
  <div class="p-2"><div class="d-flex"><b>${o.phone}</b></div><hr><h4>¡Ahorra tiempo! Agenda por Internet:</h4></div></div></div></div></div></section>` : ''}
 <div data-id="address-${o.id}-services-list" class="hidden"><ul>${o.services.map(s => `<li data-test-id="address-service-item"><span class="text-body">${s}</span>${s.includes('Primera') ? ' <span>(descripción)</span>' : ''}</li>`).join('')}</ul></div>
 <div data-id="address-${o.id}-details-modal" class="modal"><div class="modal-content"><div class="modal-header"><h4 class="modal-title">Dirección</h4></div><div class="modal-body">
  <section class="mb-2"><h5>Pacientes que atiendo</h5>${o.patients.map(p => `<li class="d-flex">${p}</li>`).join('')}</section>
  ${o.website ? `<section class="mb-2"><h5>Contacto</h5><div class="d-flex"><a href="${o.website}" class="text-body">Sitio web<span class="sr-only">se abre en una nueva pestaña</span></a></div></section>` : ''}
 </div></div></div>
</section>`;

export const FULL_PROFILE = `<!doctype html><html><head>
<title>Dra. Ana FICTICIA Uno Psicóloga, Providencia - Reserva Hora | Doctoralia.cl</title>
<link rel="canonical" href="https://www.doctoralia.cl/perfil/ana-ficticia-uno">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}</script>
</head><body><div data-id="main-content">
<div data-id="doctor-header-section" class="unified-doctor-header"><div class="unified-doctor-header-info"><div class="d-flex">
 <div class="unified-doctor-header-avatar"><a href="//s3.sa-east-1.amazonaws.com/doctoralia.cl/doctor/ficticio/ana-ficticia_large.jpg" class="avatar"><img src="//s3.sa-east-1.amazonaws.com/doctoralia.cl/doctor/ficticio/ana-ficticia_small.jpg"></a><span><i class="svg-icon">${svg}</i></span></div>
 <div class="unified-doctor-header-info__inner"><div class="unified-doctor-header-info__name">
  <h1 class="h3 m-0"><div data-test-id="doctor-header-fullname" data-id="profile-fullname-wrapper"><span>Dra.</span>
  <span>Ana FICTICIA Uno</span></div><span content="https://www.doctoralia.cl/perfil/ana-ficticia-uno"></span></h1>
  <span data-test-id="doctor-specializations"><a href="/psicologo/providencia">Psicóloga</a><span>·</span><a href="/terapeuta-complementario/providencia">Terapeuta complementaria</a><span>·</span>
   <span data-id="doctor-specializations-info-vue"><specializations-info></specializations-info><a href="#"><u>Ver más</u><span class="sr-only">sobre las especializaciones</span></a></span></span>
  <p data-test-id="doctor-locations" class="m-0">Providencia <u>3 direcciones</u></p>
  <p class="text-body mb-0-25 d-flex">Núm. Colegiado:
       12.345.678-5   654321   98765432
  </p>
  <a href="#profile-reviews" data-one-tracking-entity_id="987654"><u class="rating rating-md" aria-label="Rating: 5" data-score="5"><span>1.204 opiniones</span></u></a>
 </div></div></div></div></div>

<section id="about-section" class="card"><h2 class="h3 section-header">Experiencia</h2>
 <div class="mb-2"><ul class="list-unstyled badges"><div class="d-flex flex-column"><div class="font-weight-bold">2</div><div class="text-body">Formación</div></div>
  <li title="Certificado de excelencia basado en opiniones reales de pacientes."><img class="mr-1" alt="Certificado de excelencia basado en opiniones reales de pacientes." src="//platform.docplanner.com/img/es/badge/best-quality-2024.svg"></li>
  <li title="Certificado de excelencia basado en opiniones reales de pacientes."><img class="mr-1" alt="Certificado de excelencia basado en opiniones reales de pacientes." src="//platform.docplanner.com/img/es/badge/best-quality-2025.svg"></li></ul></div>
 <div class="about-item"><div data-test-id="about-description" class="about-description">Psicóloga FICTICIA clínica.<br>Atiendo adultos y adolescentes.<br><br>Mi RUT es 11.111.111-1 y no debe guardarse.</div>
  <a href="#" class="text-body">ver más<span class="sr-only">Sobre mí</span></a>
  <div data-id="content-modal-about" class="modal"><div class="modal-content"><div class="modal-header"><h4 class="modal-title">Sobre mí</h4></div>
  <div class="modal-body about-content">Psicóloga FICTICIA clínica.<br>Atiendo adultos y adolescentes.<br><br>Mi RUT es 11.111.111-1 y no debe guardarse.<br>Texto completo FICTICIO.</div></div></div></div>
 <div><h3 class="h5 mb-0 mr-1">Especialista en:</h3><li>Psicología clínica</li><li>Terapia de pareja</li></div>
 <div class="d-flex flex-column"><h3 class="h5 mb-1">Principales enfermedades tratadas</h3><ul class="list-unstyled d-flex"><span class="badge bg-primary-light">Ansiedad</span><span class="badge bg-primary-light">Depresión</span><a href="#" class="text-underline">+7<span class="sr-only">a11y_sr_more_diseases</span></a></ul></div>
 <div><h3 class="h5 mb-0 mr-1">Pacientes que atiendo</h3><div class="d-flex align-items-center"><i class="svg-icon">${svg}</i><span>Adultos</span></div><div class="d-flex align-items-center"><span>Niños (Sólo en algunas direcciones)</span></div></div>
 <div><h3 class="h5 mb-0 mr-1">Formatos de consulta</h3><div class="d-flex align-items-center"><span>En persona <a href="#profile-info" class="text-body">Ver ubicaciones (2)</a></span></div>
  <div class="d-flex align-items-center"><span>Videoconsulta <button data-id="view-online-calendar-link">Ver calendario en línea</button></span></div></div>
 <div><h3 class="h5 mb-1">Fotos y videos</h3><div data-id="profile-gallery-carousel"><img src="//s3.example.org/foto.jpg"></div></div>
 <div data-id="about-details-modal" class="modal"><div class="modal-content"><div class="modal-header"><h4 class="modal-title">Experiencia</h4></div>
  <div class="modal-body about-details"><div class="p-3 mb-3"><img><div><h5>Ana FICTICIA Uno</h5><p>Psicóloga</p><span>1.204 opiniones</span></div></div>
   <div class="mb-2"><h3 class="h5 mb-0 mr-1">Experiencia</h3><ul id="practice" class="toggleable-list"><li> CENTRO FICTICIO DE SALUD MENTAL </li><li class="hide"> HOSPITAL FICTICIO DEL SUR </li></ul><a href="#show-more" class="text-body">Mostrar más detalles</a></div>
   <div class="mb-2"><h3 class="h5 mb-0 mr-1">Formación</h3><ul id="school" class="toggleable-list"><li> PSICÓLOGA, UNIVERSIDAD FICTICIA, 2010 </li><li> MAGÍSTER EN PSICOLOGÍA CLÍNICA, UNIVERSIDAD FICTICIA, 2014 </li></ul></div>
   <div class="mb-2"><h3 class="h5 mb-0 mr-1">Certificados</h3><ul><li><a href="//s3.sa-east-1.amazonaws.com/doctoralia.cl/facility/ficticio/certificado_large.jpg"><img src="//s3.example.org/c.jpg"></a></li></ul></div>
   <div class="mb-2"><h3 class="h5 mb-0 mr-1">Enfermedades tratadas</h3><ul id="disease" class="toggleable-list"><li> Ansiedad </li><li> Depresión </li><li> Duelo </li></ul></div>
   <div class="mb-2"><h3 class="h5 mb-0 mr-1">Idiomas</h3><ul id="language" class="toggleable-list"><li> Español </li><li> Inglés </li></ul></div>
   <div class="mb-2"><h3 class="h5 mb-0 mr-1">Publicaciones</h3><ul id="publication" class="toggleable-list"><li> ESTUDIO FICTICIO SOBRE ANSIEDAD, revista Ficticia, 2019 </li></ul></div>
   <div class="mb-2"><h3 class="h5 mb-0 mr-1">Premios y distinciones</h3><ul id="prize" class="toggleable-list"><li> PREMIO FICTICIO, 2020 </li></ul></div>
   <div class="mb-2"><h3 class="h5 mb-0 mr-1">Redes sociales</h3><ul><li class="d-flex align-items-center"><i class="svg-icon svg-icon-instagram-circle">${svg}</i><a href="//www.instagram.com/ana.ficticia/" class="text-body">Instagram
       Ana FICTICIA Uno</a></li><li class="d-flex"><a href="//www.facebook.com/ana.ficticia/">Facebook
       Ana FICTICIA Uno</a></li></ul></div>
  </div></div></div>
</section>

<section id="profile-pricing" class="card"><div data-id="services-list-container"><ul>
 <li data-id="service-item" class="d-flex"><div class="mr-2"><h3 class="h5 font-weight-bold">Primera consulta psicológica</h3><div class="d-flex"><div class="mr-1">Desde $35.000</div><button data-id="service-details-modal-trigger">Detalles</button></div></div><button data-id="service-details-book-visit-trigger">Reservar cita</button></li>
 <li data-id="service-item" class="d-flex"><div class="mr-2"><h3 class="h5 font-weight-bold">Consulta online</h3><div class="d-flex"><div class="mr-1">$30.000</div><button data-id="service-details-modal-trigger">Detalles</button></div></div></li>
 <li data-id="service-item" class="d-flex"><div class="mr-2"><h3 class="h5 font-weight-bold">Terapia de pareja</h3><div class="d-flex"><button data-id="service-details-modal-trigger">Detalles</button></div></div></li>
</ul></div></section>

<section id="profile-info"><div data-id="address-tabs-content">
${address({id: '1001', name: 'Centro FICTICIO Norte', clinic: 'centro-ficticio-norte', street: 'Avenida Ficticia 427', commune: 'Providencia', lat: '-33.4323196', lon: '-70.6182404', insurances: ['Fonasa', 'Isapre Banmédica', 'Isapre Consalud'], payments: ['Efectivo', 'Tarjeta de Debito', 'Transferencia Bancaria'], phone: '(2) 2999 0001', website: 'https://ficticio.example.org/', services: ['Primera consulta psicológica', 'Terapia de pareja'], patients: ['Adultos', 'Niños'], calendar: true})}
${address({id: '1002', name: 'Consulta online', online: true, insurances: ['Fonasa'], payments: ['Transferencia Bancaria'], services: ['Consulta online'], patients: ['Adultos'], calendar: false})}
${address({id: '1003', name: 'Telepsicología FICTICIA', street: 'Telepsicología – ONLINE, Solo atiende ONLINE', commune: 'Providencia', lat: '-33.43', lon: '-70.61', insurances: [], payments: ['Transferencia Bancaria'], services: [], patients: [], calendar: false})}
${address({id: '1004', name: 'Consulta FICTICIA Costa', street: 'Calle Inventada 10', commune: 'Viña del Mar', region: 'Valparaíso', lat: '-33.02', lon: '-71.55', insurances: [], payments: ['Efectivo'], services: [], patients: [], calendar: false})}
${address({id: '1005', name: 'Centro FICTICIO Sur', street: 'Gran Avenida Ficticia 5000', commune: 'San Miguel', lat: '-33.49', lon: '-70.65', insurances: ['Fonasa'], payments: ['Efectivo'], services: ['Primera consulta psicológica'], patients: ['Adultos'], calendar: true})}
</div></section>

<section id="profile-reviews" data-test-id="profile-reviews-tab" class="mb-1"><div class="card">
 <div id="doctor-opinion-stats" data-id="doctor-opinion-stats" class="card-header"><h2>Opiniones</h2><a data-test-id="add-opinion-btn" href="https://www.doctoralia.cl/anade-opinion/ana-ficticia-uno">Añadir tu opinión</a></div>
 <div class="w-100"><div><div data-score="5" class="rating rating-lg"></div><p class="mb-0">1.204 opiniones</p></div>
  <div data-id="doctor-opinion-most-mentioned-tags" class="mt-3"><p>Lo más mencionado por los pacientes</p><ul><span class="badge bg-success-light">Dedicación durante la visita</span><span class="badge bg-success-light">Explicaciones detalladas</span></ul></div></div>
 <div class="card-body opinions-list"><div data-test-id="doctor-opinions-list" data-id="doctor-opinions-list">
 <script type="application/ld+json">{"@context":"https://schema.org","@type":"Physician","name":"Dra. Ana FICTICIA Uno","url":"https://www.doctoralia.cl/perfil/ana-ficticia-uno","aggregateRating":{"@type":"AggregateRating","ratingValue":4.8,"reviewCount":1204,"bestRating":5,"worstRating":1},"review":[
  ${reviewLd('Paciente Ficticia', '2026-09-27T11:09:13-03:00', 5, 'Muy buena atención FICTICIA. Paciente me recomendó venir.')},
  ${reviewLd('Juan P.', '2026-08-02T08:00:00-04:00', 2, 'Esperé mucho. Mi rut 9.876.543-2 quedó en el formulario.')},
  ${reviewLd('PMS', '2026-07-15T08:00:00-04:00', 4, 'Correcta.')}
 ]}</script>
 <ul class="standard-opinions-container">
 ${opinion({id: '5001', author: 'Paciente Ficticia', verified: 'Cita verificada', score: 5, text: 'Muy buena atención FICTICIA.<br>Paciente me recomendó venir.', date: '27 de septiembre de 2026', place: 'Centro FICTICIO Norte', service: 'Primera consulta psicológica', reply: {text: 'Gracias Paciente Ficticia por tu comentario.', date: '28 de septiembre de 2026'}})}
 ${opinion({id: '5002', author: 'Juan P.', verified: 'Opinión verificada', score: 2, text: 'Esperé mucho. Mi rut 9.876.543-2 quedó en el formulario.', date: '2 de agosto de 2026', place: 'Consulta online', service: 'Otro', reply: {text: 'Hola Juan, lamentamos la espera.', date: '3 de agosto de 2026'}})}
 ${opinion({id: '5003', author: 'PMS', verified: 'Cita verificada', score: 4, text: 'Correcta.', date: '15 de julio de 2026', place: 'Centro FICTICIO Sur', service: 'Terapia de pareja'})}
 <li></li><div data-id="opinions-survey"><opinion-survey></opinion-survey></div>
 </ul></div><div data-id="opinion-load-error" class="alert alert-warning hide">Se ha producido un error, inténtalo de nuevo.</div></div>
 <button data-id="load-more-opinions" class="btn">Ver más<span class="sr-only">opiniones anteriores</span></button>
</div></section>

<section id="profile-questions" class="card"><h2>Dudas solucionadas</h2><p>26 dudas solucionadas a pacientes en Doctoralia</p>
 <div><div class="card-body"><p class="small text-muted mb-1">Ansiedad FICTICIA</p><p data-test-id="qna-question-body" itemprop="text" class="h4">¿La terapia FICTICIA sirve para la ansiedad?</p></div>
  <p class="small text-placeholder">RESPUESTA DEL PROFESIONAL:</p><div itemprop="suggestedAnswer" class="d-flex mb-2"><div data-test-id="qna-answer-avatar" class="avatar"><img></div><p data-test-id="qna-answer-body" itemprop="text" class="mb-0">Sí, en muchos casos FICTICIOS.</p></div></div>
 <a href="https://www.doctoralia.cl/preguntas-y-respuestas/ana-ficticia-uno">Muestra todas las respuestas</a>
</section>
</div></body></html>`;

/** Perfil sin opiniones, sin consultas en la RM (solo fuera de la región). */
export const PROFILE_OUTSIDE_RM = `<html><head><link rel="canonical" href="https://www.doctoralia.cl/perfil/beto-ficticio-dos"></head><body>
<div data-id="doctor-header-section"><h1><div data-test-id="doctor-header-fullname"><span>Beto FICTICIO Dos</span></div></h1>
<span data-test-id="doctor-specializations"><a href="/nueva-especialidad-ficticia/antofagasta">Especialista nuevo</a></span>
<p class="text-body">Núm. Colegiado: 123456789</p></div>
<section id="profile-info">${address({id: '2001', name: 'Consulta FICTICIA Norte Grande', street: 'Calle Ficticia 1', commune: 'Antofagasta', region: 'Antofagasta', insurances: [], payments: [], services: [], patients: [], calendar: false})}</section>
</body></html>`;

/** Perfil que solo atiende en línea. */
export const PROFILE_ONLINE_ONLY = `<html><head><link rel="canonical" href="https://www.doctoralia.cl/perfil/carla-ficticia-tres"></head><body>
<div data-id="doctor-header-section"><h1><div data-test-id="doctor-header-fullname"><span>Ps.</span><span>Carla FICTICIA Tres</span></div></h1>
<span data-test-id="doctor-specializations"><a href="/psicologo/santiago">Psicóloga</a></span></div>
<section id="profile-info">${address({id: '3001', name: 'Consulta online', online: true, insurances: [], payments: ['Transferencia Bancaria'], services: [], patients: [], calendar: true})}</section>
<section id="profile-reviews"><div data-score="5" class="rating"></div><p>3 opiniones</p></section>
</body></html>`;

export const SITEMAP_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.doctoralia.cl/sitemaps/monolith/sitemap.city.xml</loc><lastmod>2026-10-10T08:03:28.000Z</lastmod></sitemap>
  <sitemap><loc>https://www.doctoralia.cl/sitemaps/monolith/sitemap.doctor_0.xml</loc><lastmod>2026-10-10T08:03:28.000Z</lastmod></sitemap>
  <sitemap><loc>https://www.doctoralia.cl/sitemaps/monolith/sitemap.doctor.xml</loc><lastmod>2026-10-10T08:03:28.000Z</lastmod></sitemap>
  <sitemap><loc>https://www.doctoralia.cl/sitemaps/monolith/sitemap.last_opinion.xml</loc><lastmod>2026-10-10T08:03:28.000Z</lastmod></sitemap>
  <sitemap><loc>https://otro.example.org/sitemap.doctor.xml</loc></sitemap>
</sitemapindex>`;

const urlset = (entries: Array<[string, string]>) => `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(([loc, lastmod]) => `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`).join('\n')}
</urlset>`;
export const SITEMAP_DOCTORS_0 = urlset([
  ['https://www.doctoralia.cl/perfil/ana-ficticia-uno', '2026-10-01T05:00:00-03:00'],
  ['https://www.doctoralia.cl/perfil/beto-ficticio-dos', '2026-06-01T05:00:00-04:00'],
  ['https://www.doctoralia.cl/clinicas/no-es-perfil', '2026-06-01T05:00:00-04:00'],
]);
export const SITEMAP_DOCTORS = urlset([
  ['https://www.doctoralia.cl/perfil/carla-ficticia-tres', '2026-09-01T05:00:00-03:00'],
  ['https://www.doctoralia.cl/perfil/dario-ficticio-cuatro', '2026-09-15T05:00:00-03:00'],
  ['https://www.doctoralia.cl/perfil/bloqueada-ficticia-robots', '2026-09-15T05:00:00-03:00'],
]);
export const SITEMAP_LAST_OPINION = urlset([
  ['https://www.doctoralia.cl/perfil/dario-ficticio-cuatro', '2026-10-10T05:00:35-03:00'],
]);

/** Otro perfil completo en la RM (variante mínima de la estructura real). */
export const PROFILE_DARIO = `<html><head><link rel="canonical" href="https://www.doctoralia.cl/perfil/dario-ficticio-cuatro"></head><body>
<div data-id="doctor-header-section"><h1><div data-test-id="doctor-header-fullname"><span>Dr.</span><span>Dario FICTICIO Cuatro</span></div></h1>
<span data-test-id="doctor-specializations"><a href="/cardiologo/nunoa">Cardiólogo</a></span>
<a href="#profile-reviews"><u class="rating" data-score="4"><span>12 opiniones</span></u></a></div>
<section id="profile-info">${address({id: '4001', name: 'Centro FICTICIO Oriente', street: 'Avenida Ficticia 900', commune: 'Ñuñoa', lat: '-33.456', lon: '-70.598', insurances: ['Fonasa'], payments: ['Efectivo'], services: [], patients: [], calendar: true})}
${address({id: '4002', name: 'Centro FICTICIO Norte', clinic: 'centro-ficticio-norte', street: 'Avenida Ficticia 427', commune: 'Providencia', lat: '-33.4323196', lon: '-70.6182404', insurances: [], payments: [], services: [], patients: [], calendar: false})}</section>
</body></html>`;

export const ROBOTS = `User-agent: *
Allow: /
Disallow: /stats.php
Disallow: /ajax/
Disallow: /api/
Disallow: /perfil/bloqueada-ficticia-robots
`;
