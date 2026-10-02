import type { APIRoute } from 'astro';
import { getPlaylists, formatDate } from '../../../lib/content';
import { renderOg } from '../../../lib/og';
import { getEntry } from 'astro:content';

export async function getStaticPaths() {
  const playlists = await getPlaylists();
  // Numbered by date order, oldest = 001 — derived, like the article cards.
  const total = playlists.length;
  return playlists.map((entry, i) => ({
    params: { slug: entry.id },
    props: { entry, number: String(total - i).padStart(3, '0') },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { entry, number } = props as {
    entry: Awaited<ReturnType<typeof getPlaylists>>[number];
    number: string;
  };
  const curator = await getEntry('members', entry.data.curator.id);

  const png = await renderOg({
    title: entry.data.title,
    numeral: number,
    kicker: `Playlist ${number}`,
    footer: [curator?.data.name, formatDate(entry.data.date)].filter(Boolean).join(' · '),
  });

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
