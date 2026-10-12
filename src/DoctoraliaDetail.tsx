// Ficha completa publicada en Doctoralia: se descarga solo al abrir la ficha de un profesional.
// Todo lo que muestra es lo que el profesional declara en la plataforma y lo que escriben sus pacientes;
// no es una verificación. Los enlaces externos pasan por safeUrl y no se carga ninguna imagen de terceros.
import {useEffect, useState, type ReactNode} from 'react';
import {ExternalLink, MapPin, Phone, Video} from 'lucide-react';
import {safeUrl} from './schema';
import {DoctoraliaProfileSchema, profileUrl, type DoctoraliaProfile} from './doctoralia';
import {Stars, formatCount, formatScore} from './ratings';

const clp = new Intl.NumberFormat('es-CL', {style: 'currency', currency: 'CLP', maximumFractionDigits: 0});
const longDate = (s: string | null) => s ? new Intl.DateTimeFormat('es-CL', {dateStyle: 'long', timeZone: 'UTC'}).format(new Date(s + 'T12:00:00Z')) : null;

function Ext({url, children}: {url: string; children: ReactNode}) {
  if (!safeUrl(url)) return null;
  return <a className="out-link" href={url} target="_blank" rel="noopener noreferrer nofollow">{children}<ExternalLink size={14} aria-hidden="true"/><span className="sr-only"> (abre otra pestaña)</span></a>;
}

/** Lista con las primeras `show` entradas visibles y el resto dentro de "Ver todo". */
function Items({items, show = 8}: {items: string[]; show?: number}) {
  if (!items.length) return null;
  const first = items.slice(0, show), rest = items.slice(show);
  return <>
    <ul className="dd-list">{first.map((x, i) => <li key={i}>{x}</li>)}</ul>
    {rest.length > 0 && <details className="dd-more"><summary>Ver {rest.length} más</summary><ul className="dd-list">{rest.map((x, i) => <li key={i}>{x}</li>)}</ul></details>}
  </>;
}

function Block({title, children}: {title: string; children: ReactNode}) {
  return <div className="dd-block"><h3>{title}</h3>{children}</div>;
}

/** Texto largo: un extracto a la vista y el texto completo dentro de "Leer el texto completo". */
function LongText({text, limit = 700}: {text: string; limit?: number}) {
  if (text.length <= limit) return <p className="dd-text">{text}</p>;
  const cut = text.lastIndexOf(' ', limit);
  return <>
    <p className="dd-text">{text.slice(0, cut > 0 ? cut : limit)}…</p>
    <details className="dd-more"><summary>Leer el texto completo</summary><p className="dd-text">{text}</p></details>
  </>;
}

export default function DoctoraliaDetail({slug, checkedAt}: {slug: string; checkedAt: string | null}) {
  const [data, setData] = useState<DoctoraliaProfile | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    setState('loading'); setData(null);
    fetch(new URL(`data/doctoralia/perfiles/${encodeURIComponent(slug)}.json`, document.baseURI), {signal: controller.signal})
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then(raw => { const p = DoctoraliaProfileSchema.safeParse(raw); if (!p.success) throw Error(); setData(p.data); setState('ready'); })
      .catch(e => { if (e.name !== 'AbortError') setState('error'); });
    return () => controller.abort();
  }, [slug]);
  const url = profileUrl(slug);
  return (
    <section className="doctoralia-detail" aria-labelledby="dd-title" aria-busy={state === 'loading'}>
      <h2 id="dd-title">Información publicada en Doctoralia</h2>
      <p className="meta">Lo que el profesional declara en su perfil y las opiniones que muestra la plataforma{checkedAt ? `, consultado el ${longDate(checkedAt.slice(0, 10))}` : ''}. No es una verificación oficial: confirma título y especialidad en el registro de la Superintendencia de Salud.</p>
      {state === 'loading' && <p role="status" className="meta">Cargando la ficha completa…</p>}
      {state === 'error' && <p role="status">No se pudo cargar la ficha completa. Puedes revisarla directamente en Doctoralia. <Ext url={url}>Abrir el perfil</Ext></p>}
      {data && <DetailBody p={data}/>}
      <Ext url={url}>Ver el perfil en Doctoralia</Ext>
    </section>
  );
}

function DetailBody({p}: {p: DoctoraliaProfile}) {
  const facts: Array<[string, string]> = [];
  if (p.title) facts.push(['Título que usa', p.title]);
  if (p.specialties.length) facts.push(['Especialidades anunciadas', p.specialties.map(s => s.label).join(', ')]);
  if (p.subspecialties.length) facts.push(['Se especializa en', p.subspecialties.join(', ')]);
  if (p.patients.length) facts.push(['Pacientes que atiende', p.patients.join(', ')]);
  if (p.formats.length) facts.push(['Formas de consulta', p.formats.join(', ')]);
  if (p.languages.length) facts.push(['Idiomas', p.languages.join(', ')]);
  if (p.declaredRegistry.length) facts.push(['Número declarado como colegiatura', p.declaredRegistry.join(', ') + ' (sin verificar)']);
  if (p.badges.length) facts.push(['Certificado de excelencia de Doctoralia', p.badges.join(', ')]);
  return <>
    {p.about && <Block title="Sobre el profesional"><LongText text={p.about}/></Block>}
    {facts.length > 0 && <dl className="dd-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}

    {p.services.length > 0 && <Block title="Servicios y precios">
      <p className="meta">Precios informados por el profesional o el centro. Pueden cambiar y no incluyen convenios.</p>
      <ul className="dd-prices">{p.services.map((s, i) => <li key={i}><span>{s.name}</span><strong>{s.price !== null ? (s.from ? 'Desde ' : '') + clp.format(s.price) : 'Precio no publicado'}</strong></li>)}</ul>
    </Block>}

    {p.consultations.length > 0 && <Block title={p.consultations.length === 1 ? 'Lugar de consulta' : `Lugares de consulta (${p.consultations.length})`}>
      <div className="dd-consults">{p.consultations.map((c, i) => <article key={c.id ?? i} className="dd-consult">
        <h4>{c.online ? <Video size={16} aria-hidden="true"/> : <MapPin size={16} aria-hidden="true"/>} {c.name ?? (c.online ? 'Consulta online' : 'Consulta')}</h4>
        {c.online ? <p className="meta">Atención online{c.commune ? ` (declarada en ${c.commune})` : ''}.</p>
          : <p>{[c.street, c.commune ?? c.city].filter(Boolean).join(', ')}{!c.commune && c.city ? <span className="meta"> · fuera de la Región Metropolitana</span> : null}</p>}
        {c.phones.length > 0 && <p className="dd-phones">{c.phones.map(ph => <a key={ph} href={'tel:' + ph.replace(/[^\d+]/g, '')}><Phone size={14} aria-hidden="true"/> {ph}</a>)}</p>}
        <dl className="dd-facts compact">
          {c.insurances.length > 0 && <div><dt>Previsiones</dt><dd>{c.insurances.join(', ')}</dd></div>}
          {c.payments.length > 0 && <div><dt>Formas de pago</dt><dd>{c.payments.join(', ')}</dd></div>}
          {c.services.length > 0 && <div><dt>Servicios en este lugar</dt><dd>{c.services.join(', ')}</dd></div>}
          {c.patients.length > 0 && <div><dt>Pacientes</dt><dd>{c.patients.join(', ')}</dd></div>}
          {c.onlineBooking !== null && <div><dt>Reserva en Doctoralia</dt><dd>{c.onlineBooking ? 'Disponible' : 'No disponible en este lugar'}</dd></div>}
        </dl>
        {c.website && <Ext url={c.website}>Sitio web</Ext>}
        {c.clinicUrl && <Ext url={c.clinicUrl}>Centro en Doctoralia</Ext>}
      </article>)}</div>
    </Block>}

    <ReviewsBlock p={p}/>

    {p.diseases.length > 0 && <Block title="Enfermedades y motivos que atiende"><Items items={p.diseases}/></Block>}
    {p.education.length > 0 && <Block title="Formación"><Items items={p.education} show={5}/></Block>}
    {p.experience.length > 0 && <Block title="Experiencia"><Items items={p.experience} show={5}/></Block>}
    {p.other.map(o => <Block key={o.heading} title={o.heading}><Items items={o.items}/></Block>)}
    {p.publications.length > 0 && <Block title="Publicaciones"><Items items={p.publications} show={3}/></Block>}
    {p.awards.length > 0 && <Block title="Premios y distinciones"><Items items={p.awards} show={3}/></Block>}
    {(p.certificates.length > 0 || p.social.length > 0) && <Block title="Enlaces">
      {p.social.map(s => <Ext key={s.url} url={s.url}>{s.name}</Ext>)}
      {p.certificates.map((c, i) => <Ext key={c} url={c}>Certificado {i + 1}</Ext>)}
    </Block>}

    {(p.qna.count || p.qna.items.length > 0) && <Block title="Preguntas respondidas">
      {p.qna.count !== null && <p className="meta">{p.qna.count} preguntas respondidas en Doctoralia. Se muestran las que aparecen en el perfil.</p>}
      {p.qna.items.map((q, i) => <div key={i} className="dd-qna">
        {q.topic && <p className="eyebrow">{q.topic}</p>}
        <p className="dd-text"><strong>Pregunta:</strong> {q.question}</p>
        {q.answer && <p className="dd-text"><strong>Respuesta:</strong> {q.answer}</p>}
      </div>)}
      {p.qna.url && <Ext url={p.qna.url}>Todas las respuestas en Doctoralia</Ext>}
    </Block>}
  </>;
}

function ReviewsBlock({p}: {p: DoctoraliaProfile}) {
  const {score, count, scaleMin, scaleMax, tags} = p.rating;
  if (!count && !p.reviews.length) return <Block title="Opiniones"><p>Este perfil todavía no tiene opiniones publicadas.</p></Block>;
  return <Block title="Opiniones">
    <p className="meta">Doctoralia muestra las {p.reviews.length} más recientes{count ? ` de ${formatCount(count)}` : ''}. Para cuidar la privacidad, aquí no se muestra el nombre de quien opina.{score !== null ? ` Promedio publicado: ${formatScore(score)} de ${scaleMax}.` : ''}</p>
    {tags.length > 0 && <p className="dd-tags"><span className="meta">Lo que más mencionan:</span> {tags.map(t => <span key={t} className="dd-chip">{t}</span>)}</p>}
    <ol className="dd-reviews">{p.reviews.map((r, i) => <li key={r.id ?? i}>
      <p className="dd-review-head">
        {r.score !== null && <><Stars score={r.score} min={scaleMin} max={scaleMax}/><span className="sr-only">{formatScore(r.score)} de {scaleMax} estrellas.</span></>}
        {r.date && <time dateTime={r.date}>{longDate(r.date)}</time>}
        {r.verification && <span className="dd-chip">{r.verification}</span>}
      </p>
      {(r.place || r.service) && <p className="meta">{[r.place, r.service].filter(Boolean).join(' · ')}</p>}
      {r.text && <p className="dd-text">{r.text}</p>}
      {r.reply && <div className="dd-reply"><p className="meta">Respuesta del profesional{r.reply.date ? `, ${longDate(r.reply.date)}` : ''}</p><p className="dd-text">{r.reply.text}</p></div>}
    </li>)}</ol>
  </Block>;
}
