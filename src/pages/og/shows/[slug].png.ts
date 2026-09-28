import type { APIRoute } from 'astro';
import { getShows, formatDate } from '../../../lib/content';
import { renderOg } from '../../../lib/og';

export async function getStaticPaths() {
  const shows = await getShows();
  return shows.map((show) => ({ params: { slug: show.id }, props: { show } }));
}

export const GET: APIRoute = async ({ props }) => {
  const { show } = props as { show: Awaited<ReturnType<typeof getShows>>[number] };
  const d = show.data;

  const png = await renderOg({
    title: d.title,
    numeral: String(d.episode),
    kicker: `Episode ${d.episode}`,
    footer: [formatDate(d.date), d.duration].filter(Boolean).join(' · '),
  });

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
