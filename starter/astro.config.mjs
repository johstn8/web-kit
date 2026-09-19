// @ts-check
import { defineConfig } from 'astro/config';

/**
 * Statischer Build. Keine Laufzeit auf dem Server.
 * Stack kanonisch in web-brain 30-frontend/stack.md.
 *
 * `site` wird je Projekt auf die echte Domain gesetzt; sitemap.xml und
 * kanonische Adressen haengen daran.
 */
export default defineConfig({
  site: 'https://example.com',
  output: 'static',
  build: { inlineStylesheets: 'auto' },
  image: { responsiveStyles: true },
});
