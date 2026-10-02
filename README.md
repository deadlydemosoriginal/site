# deadlydemos.com

The website for **Deadly Demos**: archived radio shows, Spotify playlists, articles, and an about/contact page for the crew.

It's a static [Astro](https://astro.build) site. It's built by GitHub Actions, hosted on GitHub Pages, and edited by non-developers through [Sveltia CMS](https://github.com/sveltia/sveltia-cms) at `/admin`.

- **Live:** https://deadlydemos.com
- **CMS:** https://deadlydemos.com/admin
- **Repo:** `deadlydemosoriginal/site`

---

## Contents

1. [Quick start](#quick-start)
2. [How it fits together](#how-it-fits-together)
3. [Project layout](#project-layout)
4. [Content collections](#content-collections)
5. [Features](#features)
6. [Editing through the CMS](#editing-through-the-cms)
7. [Build & deploy](#build--deploy)
8. [Environment variables & secrets](#environment-variables--secrets)
9. [Troubleshooting](#troubleshooting)
10. [Known quirks & loose ends](#known-quirks--loose-ends)

---

## Quick start

Requires Node 22 (CI uses 22; newer versions work locally too).

```bash
npm install
npm run dev        # http://localhost:4321 — drafts ARE visible here
npm run build      # production build into dist/ — drafts hidden
npm run preview    # serve dist/ locally
```

You can create an optional `.env` in the repo root (it's git-ignored):

```
INSTAGRAM_ACCESS_TOKEN=...
```

Without it, the homepage reels row is hidden (or you can add hand-written entries to `src/content/reels/`). Everything else works with no env vars.

---

## How it fits together

```
 Editors ──► /admin (Sveltia CMS) ──► commits Markdown to main
                     │  login via Cloudflare Worker (GitHub OAuth)
                     ▼
 push to main / hourly cron ──► GitHub Actions: npm ci && astro build
                                     │   ├─ fetches Instagram posts (reels row)
                                     │   └─ renders OG share images (satori)
                                     ▼
                              GitHub Pages ──► deadlydemos.com (CNAME)

 Show audio (MP3s) ──► Cloudflare R2 (audio.deadlydemos.com) — never in this repo
```

Some key decisions:

- **Audio never goes in git.** GitHub Pages caps files at 100 MB, and a 2-hour show is about 110 MB. MP3s live on Cloudflare R2, and show files only store the URL.
- **Astro was chosen for the persistent player.** `<ClientRouter />` (view transitions) plus `transition:persist` keep the `<audio>` element alive while you browse, so a show keeps playing across page changes.
- **Content is Markdown with frontmatter**, validated by Zod schemas at build time. If a field has the wrong format, the build fails and the live site keeps the last good version.

---

## Project layout

```
astro.config.mjs        Site URL, sitemap, remote image domains (Instagram CDN), fonts
.github/workflows/
  deploy.yml            Build + deploy to Pages; hourly rebuild; opens an issue on failure
public/
  CNAME                 deadlydemos.com
  robots.txt            Disallows /admin, points to sitemap
  admin/                Sveltia CMS: index.html, config.yml, preview.css
  brand/                Logos (dd-mark, dd-lockup, dd-badge)
  uploads/              Images uploaded through the CMS
src/
  content.config.ts     Zod schemas for every collection + Instagram loader
  content/              The actual content (Markdown)
    shows/ articles/ playlists/ members/ reels/
  lib/
    content.ts          getShows/getArticles/… (sorting, draft filtering), date + time helpers
    og.ts               Open Graph card renderer (satori → resvg → PNG)
    socials.ts          Single source of truth for social links + contact email
  layouts/Base.astro    <head>, meta/OG tags, ClientRouter, Nav, Footer, Player
  components/           Player, Reels, Cover, Nav, Footer
  pages/                Routes (see below)
  styles/               tokens.css (palette, type scale) + global.css
  assets/fonts/         Self-hosted fonts (WOFF2 for the site, TTF for OG images)
```

### Routes

| URL | File |
|---|---|
| `/` | `pages/index.astro` (a date-sorted mix of the latest shows, articles and playlists (max 6), plus the reels row) |
| `/shows/`, `/shows/<slug>/` | `pages/shows/` (tag filter on index; tracklist + player on detail) |
| `/articles/`, `/articles/<slug>/` | `pages/articles/` |
| `/playlists/`, `/playlists/<slug>/` | `pages/playlists/` (Spotify embed) |
| `/about/` | `pages/about.astro` (members, sorted by `order`) |
| `/contact/` | `pages/contact.astro` |
| `/og/default.png`, `/og/shows/<slug>.png`, `/og/articles/<slug>.png` | Generated social share images |
| `/sitemap-index.xml` | `@astrojs/sitemap` (excludes `/admin`) |

A page's slug is its filename without `.md`. For example, `src/content/shows/042-basement-tapes.md` becomes `/shows/042-basement-tapes/`.

---

## Content collections

Schemas are defined in `src/content.config.ts`. **The CMS field definitions in `public/admin/config.yml` mirror them by hand, so if you change one, change the other.**

Each collection supports a palette tone: `purple`, `ultrasonic`, `periwinkle`, `paper`, or `ink`.

### shows

| Field | Required | Notes |
|---|---|---|
| `title` | ✔ | |
| `episode` | ✔ | Positive integer. Shown as the big numeral on covers/OG images. |
| `date` | ✔ | `YYYY-MM-DD`. **Lists are sorted by date, not episode.** |
| `hosts` | ✔ | List of member slugs (`isaac`, `liam`, `tom`). Must match a file in `members/`. Can't be empty. |
| `description` | ✔ | Card text + meta description. |
| `audioUrl` | | Must be a **direct, playable audio URL** (an R2 MP3). If it's missing, no play button is shown. |
| `duration` | | `HH:MM:SS` exactly (e.g. `01:55:50`). If left blank, it's worked out from the MP3 at build time. |
| `artwork` | | Image path. If absent, a colour-blocked cover is generated. |
| `tone` | | Default `purple`. |
| `tags` | | Used by the tag filter on `/shows/`. |
| `tracklist[]` | | `{ artist, title, timestamp? }`. `timestamp` is `M:SS` or `H:MM:SS` and becomes a seek link. |
| `peaks` | | Array of 0–1 numbers for a real waveform. Hidden in the CMS; worked out from the MP3 at build time (see below). |
| `featured` | | Currently unused, see [loose ends](#known-quirks--loose-ends). |
| `draft` | | `true` hides it in production. |

### articles

`title`, `standfirst`, `date`, and `author` (a member slug) are required. `heroImage`, `tone` (default `paper`), `tags`, and `draft` are optional. The body is Markdown.

### playlists

`title`, `description`, `spotifyUrl` (must be an `open.spotify.com/playlist/...` link), `curator` (a member slug), and `date` are required. `tone` (default `ultrasonic`) and `draft` are optional. The page embeds Spotify's player using the ID parsed from `spotifyUrl`, so there is no tracklist to type.

### members

`name`, `role`, and `order` (position on About, where 1 is first) are required. `photo` and `links[]` (`{ label, url }`, where `url` must be `https://…` or `mailto:…`) are optional. The body is the bio.
**The filename is the slug that shows, articles, and playlists reference.** Renaming a member file breaks every reference to it.

### reels

These come from the Instagram API when `INSTAGRAM_ACCESS_TOKEN` is set. If there's no token, or the API fails, the build uses any `src/content/reels/*.md` files (currently none, so the row is hidden; fields are `url`, `caption`, `date`, optional `thumbnail`/`tone`/`draft`). Instagram thumbnails are downloaded and re-hosted at build time (allowed domains are set in `astro.config.mjs`).

### Drafts

`draft: true` entries are **visible in `npm run dev` and hidden in production builds** (`src/lib/content.ts`). If something "is on my machine but not on the site", check the draft flag first.

---

## Features

### Persistent audio player (`src/components/Player.astro`)
- Any element with `data-audio="<url>"` starts playback. The listener is delegated on `document`, so it survives page swaps.
- Tracklist timestamps render as `data-seek="<seconds>"` buttons that seek the current show.
- If a show has `peaks`, the player draws a canvas waveform. Otherwise it shows a plain progress bar.
- It's guarded by `window.__ddPlayer` so client-side navigation never re-initialises or resets playback.
- It fires `show_progress_25/50/75` events to `window.umami` **if** Umami is present. No analytics script is currently loaded, so these are no-ops.
- It sets `--player-h` on `<html>` so the page can pad itself above the fixed player bar.

### Open Graph images (`src/lib/og.ts`, `src/pages/og/`)
A "record sleeve" card (purple, giant magenta episode numeral, title) is rendered to PNG at build time for each show and article, plus a default card.
- satori **can't read WOFF2 or variable fonts**, which is why static TTF instances sit next to the WOFF2 in `src/assets/fonts/`.
- Font paths resolve from `process.cwd()` (the project root), so builds must run from the repo root.

### Reels row (`src/components/Reels.astro`)
This is a horizontal carousel of the latest 24 Instagram posts. The build also **refreshes the long-lived Instagram token** every time it runs (see [secrets](#environment-variables--secrets)).

### Fonts
Bricolage Grotesque (display) is self-hosted because the Google provider drops the `wdth` axis that the condensed headlines depend on. Inter Tight, Space Mono, and Instrument Serif come through Astro's font provider and are served from our own origin, so there are no third-party requests and no cookie banner.

### SEO
The site has a canonical URL, OG/Twitter meta per page (`layouts/Base.astro`), a sitemap, and a `robots.txt`. `/admin` is excluded and marked `noindex`.

---

## Editing through the CMS

1. Go to **https://deadlydemos.com/admin** and sign in with GitHub. The account needs write access to `deadlydemosoriginal/site`.
2. Login goes through a Cloudflare Worker (`sveltia-cms-auth.deadlydemos.workers.dev`), which is a fork of `sveltia/sveltia-cms-auth` backed by a GitHub OAuth app owned by the `deadlydemosoriginal` org.
3. Saving commits Markdown to `main` (you'll see commits like *Update Show "01-first-broadcast"*). That push triggers a deploy, and the site updates in about 1–2 minutes.
4. Images uploaded in the CMS go to `public/uploads/`.

**Adding a show:**
1. In the CMS, create a new Show.
2. In the **Audio** field, upload the MP3. It goes straight from your browser to Cloudflare R2 (`audio.deadlydemos.com/shows/…`), never into git, and the field fills in the URL. You can also paste a direct `.mp3` link.
3. Fill in the episode number, date, and hosts, then save. Duration and the waveform are filled in automatically on the next deploy.

**Duration and waveform (`scripts/audio-meta.mjs`):** before each build, CI analyses any show that has an MP3 but no `duration` or `peaks`, using `ffmpeg`. Results go in `.cache/audio-meta.json`, which is kept between runs by the Actions cache and never committed, and `getShows()` in `src/lib/content.ts` merges them in. Each MP3 is analysed once. A value typed into the show file always wins. If it can't analyse a show (e.g. the link is a web page, not an MP3), it logs a warning and the build carries on. Locally it only runs if you call `npm run audio-meta` (needs `ffmpeg`).

**First-time R2 setup for each editor:** uploading needs the R2 *Secret Access Key* for the `cms-audio-upload` token (Object Read & Write on `deadlydemos-audio` only). Get it privately from an admin and paste it into the CMS **Settings** dialog once. It's stored in your browser and never committed. The account ID, bucket and access key ID live in `public/admin/config.yml` and are safe to publish.

New **members** can't be created from the CMS (`create: false`). Add the Markdown file in the repo by hand, and give the person GitHub access.

---

## Build & deploy

`.github/workflows/deploy.yml` runs on:
- every push to `main` (including CMS saves),
- manual dispatch (Actions → *Deploy to GitHub Pages* → Run workflow),
- **every hour** (cron), so the reels row stays fresh and the Instagram token keeps getting refreshed.

Steps: `npm ci` → `npm run audio-meta` → `npm run build` (output saved to `build.log`) → upload `dist/` → deploy to Pages.

**When a build fails**, the live site isn't touched, and the workflow opens a GitHub issue titled **"Site build failed"** with the relevant part of the log. If that issue is already open, later failures add comments to it instead of opening new issues. Close the issue once things are fixed.

Concurrency: one deploy runs at a time and at most one more waits in the queue. Nothing gets cancelled mid-run.

---

## Environment variables & secrets

Set these in **GitHub → Settings → Secrets and variables → Actions**, and optionally in a local `.env`.

| Name | Used for | If missing |
|---|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | Reels row (Instagram API with Instagram Login; needs a Business/Creator account) | Reels row is hidden unless `src/content/reels/` has entries |

Outside GitHub:
- **Cloudflare R2:** audio hosting (bucket `deadlydemos-audio` → `audio.deadlydemos.com`). The CMS uploads to it using the `cms-audio-upload` API token. The bucket CORS must allow `GET`/`PUT`/`HEAD` with all headers from `https://deadlydemos.com` and `http://localhost:4321`, and expose `ETag`.
- **Cloudflare Workers:** the CMS OAuth worker.
- **GitHub OAuth app** (org `deadlydemosoriginal`): its client ID/secret live in the Worker's settings, not in this repo.
- **DNS:** `deadlydemos.com` points to GitHub Pages, and `public/CNAME` must stay in place.

---

## Troubleshooting

### "I saved in the CMS but the site didn't change"
1. Check the **Actions** tab. Is a run still in progress, queued, or failed?
2. Look for an open **"Site build failed"** issue. It quotes the error, which names the file and field.
3. Is the entry marked `draft: true`?
4. Hard-refresh. GitHub Pages and the browser can cache for a few minutes.

### Build fails with a schema / "invalid" error
The error names the file and field. Common causes:

| Symptom | Cause / fix |
|---|---|
| `tracklist.N.timestamp` invalid | The value isn't `M:SS` / `H:MM:SS` (e.g. `1.30` or `90s`). Empty `timestamp: ''` values, which the CMS writes for blank fields, are now ignored by the schema. |
| `duration` invalid | It must be `HH:MM:SS` (`01:58:20`, not `1:58` or `118 mins`). |
| `hosts` / `author` / `curator` reference error | The member slug doesn't exist. Use the member's filename (`isaac`, `liam`, `tom`). |
| `audioUrl` / `spotifyUrl` / link `url` invalid | It must be a full URL starting with `https://`. Links can also use `mailto:`. |
| `hosts` must contain at least 1 element | Every show needs at least one host. |
| `date` invalid | Use `YYYY-MM-DD`. |

Reproduce locally with `npm run build`. It's the same check CI runs.

### The play button does nothing / the audio won't load
- `audioUrl` must point to an **actual audio file** (`.mp3`), not a web page. For example, an `archive.org/details/...` link is a page and won't play. On archive.org, use the `archive.org/download/<id>/<file>.mp3` link instead.
- R2 objects must be public, and the bucket's CORS must allow `deadlydemos.com` (needed for seeking and duration on some browsers).
- Check the browser console for 403/404 errors on the MP3.

### The reels row is missing or shows old posts
- If there's no token or the API errored, the row falls back to `src/content/reels/` (empty by default, so it disappears). The build log contains `Instagram fetch failed, using local reels: ...`.
- Long-lived Instagram tokens **expire after 60 days without a refresh**. The hourly build refreshes them, but if builds stop for 60+ days the token dies. Generate a new one in the Meta developer dashboard and update the secret.
- **GitHub disables scheduled workflows after 60 days with no repo activity.** If the cron has stopped, re-enable it in the Actions tab. Any push also keeps it alive.

### OG images are broken or the build crashes in `og.ts`
- Fonts are loaded from `src/assets/fonts/*.ttf` relative to the working directory, so run the build from the repo root.
- Don't swap in WOFF2 or variable TTFs, because satori can't parse them.

### Can't log in to /admin
- Check the Cloudflare Worker is deployed and its env vars (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, allowed domains) are set.
- The GitHub OAuth app's callback URL must point to the Worker (`https://sveltia-cms-auth.deadlydemos.workers.dev/callback`).
- The GitHub user needs write access to the repo.

### A new CMS field doesn't save, or breaks the build
`public/admin/config.yml` and `src/content.config.ts` have drifted apart. Update both.

### Music keeps playing after navigating / player state is weird
This is intended, because the player persists across pages. If you add new pages or scripts, re-bind listeners on `astro:page-load` (as `Reels.astro` and `shows/index.astro` do). Don't rely on `DOMContentLoaded`, because `ClientRouter` swaps the body without a full page load.

---

## Known quirks & loose ends

- **`featured` on shows is not used.** The homepage mixes the newest 3 shows, 2 articles and 2 playlists by date, whatever the checkbox says.
- **CMS saves go live immediately.** There is no editorial workflow, so every CMS save commits straight to `main`.
- **Umami analytics** hooks exist in the player, but no Umami script is loaded.
- Show filenames start with a number (`01-…`) that doesn't have to match `episode`. The URL comes from the filename, and the numeral shown comes from `episode`.
- The loose `Red and Black Square Community Logo (*).png` files in the repo root are source logos and aren't used by the site (the site uses `public/brand/`).
