/** robots.txt. Vor dem Launch pruefen: eine Vorschau bleibt gesperrt. */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const basis = (site ?? new URL('https://example.com')).href.replace(/\/$/, '');
  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${basis}/sitemap.xml\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
