// Lector propio de robots.txt según RFC 9309.
// - Grupos por user-agent; si varios grupos aplican al mismo agente, sus reglas se combinan.
// - Si ningún grupo nombra a nuestro agente, se usan los grupos "*".
// - Comodines: "*" (cualquier secuencia) y "$" (fin de la ruta).
// - Gana la regla más larga; si empatan, gana Allow.

export type RobotsRule = {allow: boolean; pattern: string};
export type RobotsGroup = {agents: string[]; rules: RobotsRule[]; crawlDelay: number | null};
export type Robots = {groups: RobotsGroup[]; sitemaps: string[]};

export function parseRobots(text: string): Robots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.replace(/^﻿/, '').split(/\r?\n|\r/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) { current = {agents: [], rules: [], crawlDelay: null}; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    if (key === 'sitemap') { if (value) sitemaps.push(value); continue; }
    lastWasAgent = false;
    if (!current) continue; // reglas sin grupo: se ignoran
    if (key === 'allow' || key === 'disallow') {
      if (value === '') continue; // "Disallow:" vacío no prohíbe nada
      current.rules.push({allow: key === 'allow', pattern: value});
    } else if (key === 'crawl-delay') {
      const n = Number(value.replace(',', '.'));
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  return {groups, sitemaps};
}

/** Token de producto: primera palabra del user-agent, sin versión. "SaludCercaSantiago/1.0 (...)" → "saludcercasantiago". */
export function productToken(userAgent: string): string {
  return (userAgent.trim().split(/[\s/]/)[0] ?? '').toLowerCase();
}

function groupsFor(robots: Robots, userAgent: string): RobotsGroup[] {
  const token = productToken(userAgent);
  const specific = robots.groups.filter(g => g.agents.some(a => a !== '*' && a.length > 0 && token === a.split('/')[0]));
  if (specific.length) return specific;
  return robots.groups.filter(g => g.agents.includes('*'));
}

function escapeRegex(s: string) { return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); }

/** Convierte un patrón robots en expresión regular anclada al inicio. */
export function patternToRegex(pattern: string): RegExp {
  let p = pattern;
  if (!p.startsWith('/') && !p.startsWith('*')) p = '/' + p;
  const anchored = p.endsWith('$');
  if (anchored) p = p.slice(0, -1);
  const body = p.split('*').map(escapeRegex).join('.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

function normalizePath(pathOrUrl: string): string {
  try {
    if (/^https?:\/\//i.test(pathOrUrl)) { const u = new URL(pathOrUrl); return (u.pathname || '/') + u.search; }
  } catch { /* ruta inválida: se usa tal cual */ }
  return pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl;
}

/** true si la ruta está permitida para el agente. Sin reglas aplicables, todo está permitido. */
export function robotsAllows(robots: Robots, userAgent: string, pathOrUrl: string): boolean {
  const path = normalizePath(pathOrUrl);
  if (path === '/robots.txt') return true;
  let best: RobotsRule | null = null;
  let bestLen = -1;
  for (const g of groupsFor(robots, userAgent)) {
    for (const rule of g.rules) {
      if (!patternToRegex(rule.pattern).test(path)) continue;
      const len = rule.pattern.length;
      if (len > bestLen || (len === bestLen && rule.allow && best && !best.allow)) { best = rule; bestLen = len; }
    }
  }
  return best ? best.allow : true;
}

/** Retardo pedido por el sitio (segundos) para nuestro agente, o null. */
export function robotsCrawlDelay(robots: Robots, userAgent: string): number | null {
  const delays = groupsFor(robots, userAgent).map(g => g.crawlDelay).filter((d): d is number => d !== null);
  return delays.length ? Math.max(...delays) : null;
}

export const ALLOW_ALL: Robots = {groups: [], sitemaps: []};
export const DISALLOW_ALL: Robots = {groups: [{agents: ['*'], rules: [{allow: false, pattern: '/'}], crawlDelay: null}], sitemaps: []};
