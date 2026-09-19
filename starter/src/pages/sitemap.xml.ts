/** sitemap.xml aus den Seiten des Inhalts. Nicht indexierte Seiten fehlen hier bewusst. */
import type { APIRoute } from 'astro';
import { inhalt } from '../content/index.ts';

export const GET: APIRoute = ({ site }) => {
  const basis = (site ?? new URL('https://example.com')).href.replace(/\/$/, '');
  const eintraege = inhalt.seiten
    .filter((s) => s.indexieren !== false)
    .map((s) => `  <url><loc>${basis}/${s.slug}</loc></url>`)
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${eintraege}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
