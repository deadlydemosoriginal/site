import { readFileSync } from 'node:fs';
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

/** Drafts are hidden in production but visible while running `astro dev`. */
const visible = (entry: { data: { draft?: boolean } }) =>
  import.meta.env.DEV || !entry.data.draft;

/**
 * Duration + waveform worked out from the MP3 by scripts/audio-meta.mjs in CI.
 * Keyed by audioUrl. Anything set by hand in the show file wins.
 */
type AudioMeta = Record<string, { duration: string; peaks: number[] }>;
let audioMeta: AudioMeta | undefined;
function loadAudioMeta(): AudioMeta {
  if (!audioMeta) {
    try {
      audioMeta = JSON.parse(readFileSync('.cache/audio-meta.json', 'utf8'));
    } catch {
      audioMeta = {};
    }
  }
  return audioMeta!;
}

const TONES = ['purple', 'ultrasonic', 'periwinkle', 'paper', 'ink'] as const;

/**
 * Colour for an entry's cover/tile. Editors don't pick one: it's a hash of the
 * slug, so it looks random across the site but never changes between builds
 * or between an entry's list card and its page.
 */
export function toneFor(id: string): (typeof TONES)[number] {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length]!;
}

const withTone = <T extends { id: string; data: object }>(e: T) => ({
  ...e,
  data: { ...e.data, tone: toneFor(e.id) },
});

export async function getShows() {
  const meta = loadAudioMeta();
  const shows = (await getCollection('shows', visible)).map((show) => {
    const m = show.data.audioUrl ? meta[show.data.audioUrl] : undefined;
    if (!m) return withTone(show);
    return withTone({
      ...show,
      data: { ...show.data, duration: show.data.duration || m.duration, peaks: show.data.peaks?.length ? show.data.peaks : m.peaks },
    });
  });
  return shows.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getArticles() {
  const articles = (await getCollection('articles', visible)).map(withTone);
  return articles.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getPlaylists() {
  const playlists = (await getCollection('playlists', visible)).map(withTone);
  return playlists.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getMembers() {
  const members = await getCollection('members');
  return members.sort((a, b) => a.data.order - b.data.order);
}

/** Resolve an array of member references to their entries. */
export async function resolveMembers(refs: Array<{ id: string }>) {
  const entries = await Promise.all(refs.map((r) => getEntry('members', r.id)));
  return entries.filter(Boolean) as CollectionEntry<'members'>[];
}

export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);

export const formatDateLong = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);

/** "1:02:03" or "7:42" -> seconds. Used for tracklist seek links. */
export function toSeconds(stamp: string): number {
  const parts = stamp.split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.length === 3
    ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
    : parts[0]! * 60 + parts[1]!;
}

/** Rough reading time for article standfirsts. */
export const readingTime = (body: string) =>
  `${Math.max(1, Math.round(body.trim().split(/\s+/).length / 200))} min read`;

/** Unique, frequency-ordered tag list across a set of entries. */
export function collectTags(entries: Array<{ data: { tags?: string[] } }>) {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const t of e.data.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }));
}
