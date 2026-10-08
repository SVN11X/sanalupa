import {ExternalLink} from 'lucide-react';
import {safeUrl, type Catalog, type RatingType} from './schema';

type Source = Catalog['sources'][number];

/** Nota con un decimal en formato chileno: 4.8 → "4,8". */
export const formatScore = (n: number) => new Intl.NumberFormat('es-CL', {minimumFractionDigits: 1, maximumFractionDigits: 1}).format(n);
export const formatCount = (n: number) => new Intl.NumberFormat('es-CL').format(n) + (n === 1 ? ' opinión' : ' opiniones');

/** Fuentes habilitadas que tienen valoraciones de profesionales con permiso para ordenar. */
export function ratingSourcesOf(c: Catalog): Source[] {
  return c.sources.filter(s => s.status === 'enabled' && s.mayDerive && c.ratings.some(r => r.sourceId === s.id && r.entityType === 'professional' && r.mayDerive));
}

/** Estrellas parciales decorativas (aria-hidden). La información real va en texto. */
export function Stars({score, min, max}: {score: number; min: number; max: number}) {
  const stars = 5; // siempre 5 estrellas visuales; la escala real va en el texto
  const pct = Math.max(0, Math.min(100, ((score - min) / (max - min)) * 100));
  return (
    <span className="stars" aria-hidden="true">
      <span className="stars-empty">{'★'.repeat(stars)}</span>
      <span className="stars-fill" style={{width: pct + '%'}}>{'★'.repeat(stars)}</span>
    </span>
  );
}

/** Una línea por fuente. Ejemplo para lectores de pantalla: "4,8 de 5 estrellas, 192 opiniones, Doctoralia". */
export function RatingLines({ratings, sources, detail = false, date}: {ratings: RatingType[]; sources: Source[]; detail?: boolean; date: (s: string | null) => string}) {
  return (
    <ul className="rating-lines">
      {ratings.map(r => {
        const name = sources.find(s => s.id === r.sourceId)?.name ?? r.sourceId;
        const short = name.replace(/\s+Chile$/, '');
        const spoken = r.score !== null
          ? `${formatScore(r.score)} de ${formatScore(r.scaleMax).replace(/,0$/, '')} estrellas, ${formatCount(r.totalCount)}, ${short}`
          : `${formatCount(r.totalCount)}, ${short}, sin promedio publicado`;
        return (
          <li key={r.id}>
            <p className="rating-line">
              <span className="sr-only">{spoken}</span>
              {r.score !== null && <Stars score={r.score} min={r.scaleMin} max={r.scaleMax}/>}
              <span aria-hidden="true">
                {r.score !== null && <strong className="rating-score">{formatScore(r.score)}</strong>}
                <span className="rating-count">{r.score !== null ? ' · ' : ''}{formatCount(r.totalCount)}</span>
                <span className="rating-source"> · {short}</span>
              </span>
            </p>
            {detail && <>
              <p className="meta">Consultado el {date(r.extractedAt)}{r.score !== null ? ` · escala de ${r.scaleMin} a ${r.scaleMax}` : ' · la fuente no publica un promedio'}</p>
              {safeUrl(r.url) && <a className="out-link" href={r.url} target="_blank" rel="noopener noreferrer">Leer las opiniones en {short}<ExternalLink size={14} aria-hidden="true"/><span className="sr-only"> (abre otra pestaña)</span></a>}
            </>}
          </li>
        );
      })}
    </ul>
  );
}
