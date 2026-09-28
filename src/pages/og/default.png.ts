import type { APIRoute } from 'astro';
import { renderOg } from '../../lib/og';

/** Fallback card for the homepage and any page without its own image. */
export const GET: APIRoute = async () => {
  const png = await renderOg({
    title: 'Radio, records and writing',
    numeral: 'DD',
    kicker: 'Deadly Demos',
    footer: 'deadlydemos.com',
  });
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
