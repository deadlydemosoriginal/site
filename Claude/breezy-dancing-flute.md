# deadlydemos.com — build plan

## Context

`deadlydemosoriginal/site` is currently a README and a CNAME pointing at `deadlydemos.com`. We're building the whole thing from scratch: a multimedia site for a three-person crew covering an **archived radio show** back-catalogue, **curated Spotify playlists**, **articles**, an **about** page for the three members, and **contact**.

The governing brief: *"we want people to think I'm cool but not that I work for some massive company."* Concretely that means the site must read as a designed independent publication — asymmetric grids, real typographic opinion, a player we built ourselves — and must never read as a template. No rounded-card SaaS grid, no gradient hero, no stock photography, no cookie banner.

Two hard constraints shape everything:

1. **GitHub Pages caps**: 1 GB published site, 100 GB/month bandwidth, 100 MB per file. A single two-hour show at 128 kbps is ~110 MB. **Audio cannot live in this repo** — it goes to Cloudflare R2 and the site references it by URL.
2. **No content exists yet.** Everything ships with realistic placeholder content behind a schema, so real content drops in later without touching templates.

---

## Design system

Derived from the 23 pins in `inspo/` — not from the four generic directions I offered earlier. The board is unambiguous: **independent music-magazine editorial**. Dense modular grids, colour-blocked tiles at mixed sizes, huge display type split across lines, small-caps/mono metadata tags, numbered indexes. Reference points on the board: the Lexington *Streamer* theme ("Latest transmissions from the indie airwaves" — essentially our brief already designed), *The Blimp*'s record index, the Teatro Municipal do Porto poster grid, PRINT / The Daily Heller, the Hessle Audio retrospective spread.

### Palette

Three separate palette pins on the board are all purple-forward. Merged into one scale:

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#0D0D0D` | Primary ground (dark mode default) |
| `--paper` | `#FAFAFA` | Primary ground (light) / reversed type |
| `--purple-deep` | `#433075` | Structural blocks, footers |
| `--purple-royal` | `#7E49B3` | Mid-tone fills, active states |
| `--lavender` | `#A58CF4` | Links, player progress, tag fills |
| `--periwinkle` | `#E3D9FC` | Tint blocks, article backgrounds |
| `--magenta` | `#BF40FA` | **Single hot accent** — play button, live indicator, hover |
| `--ultrasonic` | `#4928C2` | Secondary block colour |
| `--mist` | `#CFCFCF` | Rules, muted metadata |

Discipline: `--magenta` is the only hot colour and appears at most twice per viewport. Colour blocks are flat fills — no gradients anywhere.

### Type

The board's pinned fonts (Bitec, Miox, Apex, Soya, Chez, Bool, Ark, Acme) are commercial licences. Open equivalents that hit the same register:

- **Display** — Bricolage Grotesque (variable `opsz`/`wdth`/`wght`). Built for exactly this editorial-quirk register; the width axis gives us poster-condensed headlines and wide pull-quotes from one file.
- **Body** — Inter Tight. Neutral, dense, tight leading for magazine columns.
- **Metadata** — Space Mono. Dates, timecodes, tracklist numbers, tag pills, run times.
- **Accent serif** — Instrument Serif, for article titles and pull quotes only (the Daily Heller / Blimp note).

All four are Google Fonts — free, and they load inside a strict CSP if we ever want an Artifact preview.

### Layout language

- A 12-column grid where tiles deliberately span unequal widths (5/7, 4/8, 3/3/6) — never a uniform 3-up card row.
- Section headers set as split display lines (`Latest` … `transmissions`) with the two halves pushed to opposite margins.
- Every item carries mono metadata: date, duration, host, numbered index (`01`–`NN`).
- Hard 1px rules between rows. No shadows, no border-radius above 2px.
- Light/dark both defined via tokens on `:root`; dark is the default character.

---

## Stack — Astro (revising my earlier Eleventy recommendation)

I recommended Eleventy before seeing the brief fully. **The persistent player changes the answer.**

On a normal multi-page static site, clicking a link destroys the `<audio>` element and the show stops. For a radio archive that is the difference between a site people browse and a site people leave. Astro's `<ClientRouter />` plus `transition:persist` on the player component keeps the audio node alive across navigations — a one-attribute solution to the single hardest requirement here. Eleventy would need a hand-rolled swap-navigation layer to match it.

Astro also gives us **content collections with Zod schemas**, which is what makes "foolproof content updates" actually true: a malformed show entry fails the build with a named error instead of silently rendering broken.

You keep total design control — Astro ships zero JS by default and imposes no component aesthetic. The only JS on the site will be the player and the show filter, both ours.

**Content editing**: Sveltia CMS at `/admin` — log in with GitHub, fill in forms, save, the site rebuilds. Works on a phone. It's a <500 KB client-side bundle committing Markdown to the repo; auth runs on Sveltia's free Cloudflare Workers authenticator. Nobody but you ever sees a YAML frontmatter block.

---

## Content model

`src/content/config.ts` defines four collections with Zod schemas.

**`shows/`** — `title`, `episodeNumber`, `date`, `hosts[]` (refs members), `description`, `artwork`, `audioUrl` (R2), `duration`, `tags[]`, `tracklist[]` (`{ position, artist, title, timestamp? }`), `peaks?` (optional waveform data), `featured?`

**`articles/`** — `title`, `standfirst`, `date`, `author` (ref member), `heroImage`, `tags[]`, body Markdown

**`playlists/`** — `title`, `description`, `spotifyUrl`, `curator` (ref member), `date`, `accentColor` (picked from the palette tokens)

**`members/`** — `name`, `role`, `bio`, `photo`, `links[]`

Note `audioUrl` is a plain field. MP3s never pass through the CMS or git — you upload them to R2 separately and paste the URL. That also means the audio host is swappable later without touching a template.

---

## The player — the signature piece

This is what makes the site feel built rather than assembled.

- Custom HTML5 `<audio>`, our own transport, sitting in a persistent bar pinned to the bottom of the viewport.
- `transition:persist` keeps it playing while you read an article or browse the archive.
- Scrubber renders a **real waveform** when a show has `peaks` data, and degrades to a clean lavender progress bar when it doesn't. (Peaks are generated offline with `audiowaveform` and committed as a small JSON array — a nice-to-have, never a blocker.)
- Tracklist entries with timestamps are clickable and seek the player.
- Magenta play button; mono timecode; show title and episode number in the bar.
- Plain playback needs **no CORS at all** — CORS only matters if we decode audio in the browser, which pre-generated peaks let us avoid entirely.

### Stats

A custom player means we collect the numbers ourselves — and get better ones than Mixcloud would ever have handed over. [Umami](https://umami.is) (100k events/month free, cookieless, no consent banner required) receives custom events from the player:

`show_play` · `show_progress_25` · `show_progress_50` · `show_progress_75` · `show_complete`, each tagged with the show slug.

That yields per-show **listen-through rate**, not just plays. Cloudflare's R2 dashboard gives server-side request counts as a cross-check.

---

## Playlists

Spotify **deprecated `preview_url` for apps registered after 27 Nov 2024**, so a custom Spotify player is off the table. The design works around it:

1. **Build time** — `scripts/fetch-spotify.mjs` uses the Client Credentials flow to pull each playlist's cover art, track list, durations and count, caching to `src/data/spotify-cache.json`. We render that as our own editorial tracklist in our own type, in a coloured block from the palette. Not an iframe farm.
2. **Previews** — the [iTunes Search API](https://performance-partners.apple.com/search-api) is free, unauthenticated, and returns 30-second preview MP3s for most commercial tracks. We match tracks at build time and attach preview URLs, so playlist tracks play **in our own player**, consistent with the shows.
3. **Full playback** — click-through to Spotify, with an embed on the playlist detail page as the fallback for anything iTunes can't match.

If the Spotify credentials aren't configured, the build falls back to hand-entered tracklists in the Markdown file. Nothing hard-fails.

---

## Repo structure

```
.github/workflows/deploy.yml   # build Astro → deploy Pages
public/
  CNAME                        # MUST live here — Astro wipes dist/
  admin/{index.html,config.yml}
src/
  content/{config.ts,shows/,articles/,playlists/,members/}
  components/{Player,ShowCard,Tile,TagPill,Nav,Footer}.astro
  layouts/{Base,Article}.astro
  pages/
    index.astro
    shows/{index,[slug]}.astro
    playlists/{index,[slug]}.astro
    articles/{index,[slug]}.astro
    about.astro
    contact.astro
  scripts/player.ts
  styles/{tokens.css,global.css}
scripts/fetch-spotify.mjs
inspo/                         # keep, gitignored from the build
```

**Critical gotcha**: the existing `CNAME` must move to `public/CNAME` or every deploy will drop the custom domain.

---

## Build phases

1. **Foundation** — Astro scaffold, `tokens.css` with the full palette, fonts, `Base` layout, nav + footer, deploy workflow. Ends with the purple shell live on deadlydemos.com.
2. **Content model** — collection schemas plus realistic placeholder content: 3 members, 6 shows, 3 playlists, 3 articles. Site becomes fully browsable.
3. **Shows + player** — archive index with tag/host/year filtering, show detail pages, the persistent player, waveform scrubber, clickable tracklists.
4. **Playlists** — Spotify build-time fetch, iTunes preview matching, editorial tracklist rendering.
5. **Articles, about, contact** — article layout with the serif accent, the three-member page, contact via mailto + socials initially.
6. **Sveltia CMS** — `/admin`, collection config mirroring the Zod schemas, GitHub auth worker.
7. **Polish** — Umami events, a11y pass (keyboard player control, focus states, reduced-motion), Lighthouse, OG images.

---

## Setup only you can do

I can't create accounts or touch DNS. In rough order of need:

- **Cloudflare account**, move `deadlydemos.com` DNS to Cloudflare, re-point the apex at GitHub Pages, create R2 bucket `deadlydemos-audio` bound to `audio.deadlydemos.com`. *(Blocks phase 3 playback; everything else proceeds.)*
- **Umami** cloud account → site ID. *(Phase 7.)*
- **Spotify developer app** → client ID + secret as GitHub Actions secrets. *(Phase 4; falls back gracefully.)*
- **Sveltia auth worker** — one free Cloudflare Worker + a GitHub OAuth app. *(Phase 6.)*
- **Enable GitHub Pages → Source: GitHub Actions** in repo settings.

I'll flag each at the moment it's actually needed rather than front-loading them.

---

## Verification

- `npm run dev` at each phase; I'll drive the local site in the browser pane and screenshot the real rendering rather than asking you to check.
- `npm run build` must pass — Zod schema errors surface here, which is the point.
- Player verified end to end: start a show, navigate to another page, confirm audio continues and the bar persists; confirm seek, tracklist-seek and progress events fire.
- Responsive check at mobile/tablet/desktop, and both colour schemes, via viewport emulation.
- Lighthouse on the built output; target 95+ across the board, and confirm no horizontal body scroll at any width.
- First deploy verified live on deadlydemos.com with the custom domain intact.

---

## Flagged

- **Placeholder names**: the Pinterest board lists collaborators Isaac Spackman, Liam and Tom Steward Smith. I'll use those as the three placeholder members unless you tell me otherwise — say the word and I'll use neutral placeholders instead.
- **Section naming**: I'll use `/articles`; if the crew has its own word for them (dispatches, transmissions, notes), that's a one-line change now and a redirect later.
- **R2 free tier** is 10 GB (~90 two-hour shows). Egress is free forever, so traffic never costs anything — only the archive size eventually would.
