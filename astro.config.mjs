// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

export default defineConfig({
  site: 'https://deadlydemos.com',

  // Fonts are served from our own origin — no third-party request,
  // no consent implications.
  fonts: [
    {
      // Self-hosted rather than fetched via the Google provider, because
      // that provider only requests the `wght` axis and silently drops
      // `wdth`. The whole display system depends on the width axis, so we
      // ship the real 3-axis file (opsz/wdth/wght) instead.
      provider: fontProviders.local(),
      name: 'Bricolage Grotesque',
      cssVariable: '--font-display',
      options: {
        variants: [
          {
            weight: '200 800',
            style: 'normal',
            stretch: '75% 100%',
            src: ['./src/assets/fonts/bricolage-grotesque-latin.woff2'],
          },
        ],
      },
    },
    {
      provider: fontProviders.google(),
      name: 'Inter Tight',
      cssVariable: '--font-body',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin'],
    },
    {
      provider: fontProviders.google(),
      name: 'Space Mono',
      cssVariable: '--font-mono',
      weights: [400, 700],
      styles: ['normal'],
      subsets: ['latin'],
    },
    {
      provider: fontProviders.google(),
      name: 'Instrument Serif',
      cssVariable: '--font-serif',
      weights: [400],
      styles: ['normal'],
      subsets: ['latin'],
    },
  ],
});
