import { defineCollection, reference, z } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';

/** Palette tones a colour-blocked tile can use. */
const tone = z.enum(['purple', 'ultrasonic', 'periwinkle', 'paper', 'ink']);

const members = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/members' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    /** Sort order on the About page. */
    order: z.number().default(0),
    photo: z.string().optional(),
    links: z
      .array(z.object({ label: z.string(), url: z.string().url() }))
      .default([]),
  }),
});

const shows = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/shows' }),
  schema: z.object({
    title: z.string(),
    episode: z.number().int().positive(),
    date: z.coerce.date(),
    hosts: z.array(reference('members')).nonempty(),
    description: z.string(),

    /**
     * Public URL of the MP3 — lives on Cloudflare R2, never in this repo
     * (GitHub Pages caps files at 100MB; a 2h show is ~110MB).
     * Optional so shows can be catalogued before the audio is uploaded.
     */
    audioUrl: z.string().url().optional(),
    /** Runtime as HH:MM:SS. */
    duration: z.string().regex(/^\d{1,2}:\d{2}:\d{2}$/).optional(),

    /** Falls back to a procedural colour-blocked cover. */
    artwork: z.string().optional(),
    tone: tone.default('purple'),

    tags: z.array(z.string()).default([]),
    tracklist: z
      .array(
        z.object({
          artist: z.string(),
          title: z.string(),
          /** M:SS or H:MM:SS — makes the entry a seek link in the player. */
          // The CMS may serialize an empty optional field as "" rather than omit it.
          timestamp: z.preprocess(
            (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
            z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/).optional(),
          ),
        }),
      )
      .default([]),

    /** Optional pre-computed waveform peaks (0–1). Renders a real waveform
     *  instead of a plain progress bar. Generated offline, never required. */
    peaks: z.array(z.number().min(0).max(1)).optional(),

    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    standfirst: z.string(),
    date: z.coerce.date(),
    author: reference('members'),
    heroImage: z.string().optional(),
    tone: tone.default('paper'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

/**
 * Playlists are markdown files; when SPOTIFY_CLIENT_ID/SECRET are set, each
 * build replaces the file's hand-written `tracks` with the live Spotify
 * tracklist. If credentials are missing, or a playlist can't be fetched
 * (private, editorial and some other Spotify-owned playlists are refused to
 * API apps), that playlist keeps the tracks typed into the CMS.
 */
const playlistFiles = glob({ pattern: '**/*.md', base: './src/content/playlists' });

const spotifyPlaylists: Loader = {
  name: 'spotify-playlists',
  async load(context) {
    await playlistFiles.load(context);

    const id = process.env.SPOTIFY_CLIENT_ID ?? import.meta.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET ?? import.meta.env.SPOTIFY_CLIENT_SECRET;
    if (!id || !secret) return;

    let token: string;
    try {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      token = ((await res.json()) as { access_token: string }).access_token;
    } catch (err) {
      context.logger.warn(`Spotify auth failed, using tracks from the CMS: ${err}`);
      return;
    }

    type Page = {
      items: { track: { name: string; artists: { name: string }[] } | null }[];
      next: string | null;
    };

    for (const entry of [...context.store.values()]) {
      const playlistId = String(entry.data.spotifyUrl).split('/playlist/')[1]?.split(/[?/]/)[0];
      if (!playlistId) continue;

      try {
        const tracks: { artist: string; title: string }[] = [];
        let url: string | null =
          `https://api.spotify.com/v1/playlists/${playlistId}/tracks` +
          `?limit=100&fields=next,items(track(name,artists(name)))`;
        while (url) {
          const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const page = (await res.json()) as Page;
          for (const { track } of page.items) {
            if (track) tracks.push({ artist: track.artists.map((a) => a.name).join(', '), title: track.name });
          }
          url = page.next;
        }
        // Drop the digest so the store accepts the changed data.
        const { digest: _digest, ...rest } = entry;
        context.store.set({ ...rest, data: { ...entry.data, tracks } });
        context.logger.info(`Loaded ${tracks.length} tracks for ${entry.id} from Spotify`);
      } catch (err) {
        context.logger.warn(`Spotify fetch failed for ${entry.id}, using tracks from the CMS: ${err}`);
      }
    }
  },
};

const playlists = defineCollection({
  loader: spotifyPlaylists,
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Full open.spotify.com playlist URL. Track data is fetched at build time. */
    spotifyUrl: z
      .string()
      .url()
      // Drop the ?si= share-tracking query so it never reaches the page.
      .transform((u) => u.split('?')[0]),
    curator: reference('members'),
    date: z.coerce.date(),
    tone: tone.default('ultrasonic'),
    /** Hand-written fallback used when Spotify credentials aren't configured. */
    tracks: z
      .array(z.object({ artist: z.string(), title: z.string() }))
      .default([]),
    draft: z.boolean().default(false),
  }),
});


/**
 * Reels come from the Instagram API (Instagram Login flavour — needs a
 * Business or Creator account) when INSTAGRAM_ACCESS_TOKEN is set, so every
 * build picks up the latest posts. Without a token, or if the API call fails,
 * the hand-written entries in src/content/reels are used instead.
 */
const reelsFallback = glob({ pattern: '**/*.md', base: './src/content/reels' });
const tones = tone.options;

const instagramReels: Loader = {
  name: 'instagram-reels',
  async load(context) {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN ?? import.meta.env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) return reelsFallback.load(context);

    try {
      // Long-lived tokens expire after 60 days unless refreshed. Refreshing on
      // every build keeps them alive as long as the scheduled build keeps running.
      await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`,
      ).catch(() => {});

      const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
      const res = await fetch(
        `https://graph.instagram.com/me/media?fields=${fields}&limit=24&access_token=${token}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const { data: media } = (await res.json()) as {
        data: {
          id: string;
          caption?: string;
          media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
          media_url?: string;
          thumbnail_url?: string;
          permalink: string;
          timestamp: string;
        }[];
      };

      context.store.clear();
      for (const [i, m] of media.entries()) {
        const firstLine = (m.caption ?? '').split('\n')[0].trim();
        const data = await context.parseData({
          id: m.id,
          data: {
            url: m.permalink,
            caption: firstLine.length > 140 ? `${firstLine.slice(0, 139)}…` : firstLine,
            date: m.timestamp,
            thumbnail: m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url,
            tone: tones[i % tones.length],
          },
        });
        context.store.set({ id: m.id, data });
      }
      context.logger.info(`Loaded ${media.length} posts from Instagram`);
    } catch (err) {
      context.logger.warn(`Instagram fetch failed, using local reels: ${err}`);
      return reelsFallback.load(context);
    }
  },
};

const reels = defineCollection({
  loader: instagramReels,
  schema: z.object({
    /** Permalink to the reel or post. */
    url: z.string().url(),
    caption: z.string(),
    date: z.coerce.date(),
    /**
     * Thumbnail — an Instagram CDN URL when fetched from the API, otherwise
     * a path in public/uploads. Optional — without it the tile falls back
     * to a colour block, so the row still looks deliberate with no images.
     */
    thumbnail: z.string().optional(),
    tone: tone.default('purple'),
    draft: z.boolean().default(false),
  }),
});

export const collections = { members, shows, articles, playlists, reels };
