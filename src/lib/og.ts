import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Resolved from the project root, not import.meta.url: this module gets
// bundled into dist/.prerender/chunks/ at build time, which breaks any
// path relative to the source file.
const font = (name: string) =>
  readFileSync(join(process.cwd(), 'src/assets/fonts', name));

// satori cannot read WOFF2, so these are TTFs kept alongside the WOFF2s
// the site itself serves.
// Static instances: satori's opentype fork crashes on variable fonts (fvar).
// Instanced with fonttools so the numeral keeps the condensed wdth=75 look
// the site's display type uses.
const displayCond = font('bricolage-cond-800.ttf');
const display = font('bricolage-800.ttf');
const monoRegular = font('spacemono-regular.ttf');
const monoBold = font('spacemono-bold.ttf');

const INK = '#0D0D0D';
const PURPLE = '#433075';
const MAGENTA = '#BF40FA';
const PAPER = '#FAFAFA';


/** Long numerals must shrink or they run into the title column at x=476. */
const numeralSize = (n = '') => (n.length >= 3 ? 440 : 620);
const numeralTop = (n = '') => (n.length >= 3 ? 105 : 25);

export const OG_W = 1200;
export const OG_H = 630;

interface CardOpts {
  title: string;
  /** Big numeral bleeding off the left. Falls back to the wordmark mark. */
  numeral?: string;
  kicker?: string;
  footer?: string;
}

/**
 * "Record sleeve" card: full-bleed purple, giant magenta numeral bleeding off
 * the left edge, title set in display type on the right.
 */
function card({ title, numeral, kicker, footer }: CardOpts) {
  return {
    type: 'div',
    props: {
      style: {
        width: OG_W, height: OG_H, display: 'flex', position: 'relative',
        background: PURPLE, overflow: 'hidden',
      },
      children: [
        // numeral, bleeding off the left edge
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', left: -80, top: numeralTop(numeral),
              fontFamily: 'BricolageCond', fontSize: numeralSize(numeral), fontWeight: 800,
              color: MAGENTA, letterSpacing: '-0.05em', lineHeight: 0.8,
              display: 'flex',
            },
            children: numeral ?? '',
          },
        },
        // right-hand text column
        {
          type: 'div',
          props: {
            style: {
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              position: 'absolute', right: 64, top: 56, bottom: 56, width: 660,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'Mono', fontSize: 22, fontWeight: 700, color: PAPER,
                    textTransform: 'uppercase', letterSpacing: '0.14em', display: 'flex',
                  },
                  children: kicker ?? 'Deadly Demos',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'Bricolage', fontWeight: 800, fontSize: title.length > 42 ? 68 : 88,
                    color: PAPER, lineHeight: 0.95, letterSpacing: '-0.035em',
                    display: 'flex', flex: 1, alignItems: 'center',
                  },
                  children: title,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'Mono', fontSize: 22, color: '#C3B7F2',
                    textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex',
                  },
                  children: footer ?? 'deadlydemos.com',
                },
              },
            ],
          },
        },
        // magenta rule along the bottom
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', left: 0, right: 0, bottom: 0, height: 12,
              background: MAGENTA, display: 'flex',
            },
            children: '',
          },
        },
      ],
    },
  };
}

export async function renderOg(opts: CardOpts): Promise<Buffer> {
  const svg = await satori(card(opts) as any, {
    width: OG_W,
    height: OG_H,
    fonts: [
      { name: 'Bricolage', data: display, weight: 800, style: 'normal' },
      { name: 'BricolageCond', data: displayCond, weight: 800, style: 'normal' },
      { name: 'Mono', data: monoRegular, weight: 400, style: 'normal' },
      { name: 'Mono', data: monoBold, weight: 700, style: 'normal' },
    ],
  });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: OG_W } }).render().asPng());
}
