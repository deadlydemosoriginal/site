import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

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
          timestamp: z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/).optional(),
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

const playlists = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/playlists' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Full open.spotify.com playlist URL. Track data is fetched at build time. */
    spotifyUrl: z.string().url(),
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

export const collections = { members, shows, articles, playlists };
