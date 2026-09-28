import type { APIRoute } from 'astro';
import { getArticles, formatDate } from '../../../lib/content';
import { renderOg } from '../../../lib/og';
import { getEntry } from 'astro:content';

export async function getStaticPaths() {
  const articles = await getArticles();
  // Numbered by date order, oldest = 001, so the series reads like the show
  // archive. Derived rather than stored — backdating a piece renumbers it.
  const total = articles.length;
  return articles.map((entry, i) => ({
    params: { slug: entry.id },
    props: { entry, number: String(total - i).padStart(3, '0') },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { entry, number } = props as {
    entry: Awaited<ReturnType<typeof getArticles>>[number];
    number: string;
  };
  const author = await getEntry('members', entry.data.author.id);

  const png = await renderOg({
    title: entry.data.title,
    numeral: number,
    kicker: `Article ${number}`,
    footer: [author?.data.name, formatDate(entry.data.date)].filter(Boolean).join(' · '),
  });

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
