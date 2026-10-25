/**
 * Repairs italics that the CMS editor has turned into literal underscores.
 *
 * The rich-text editor in /admin doesn't recognise `_word_` as italics when
 * it sits right against a curly quote (‘_Japan_’), so on the next save it
 * escapes the markers to ‘\_Japan\_’ and the page shows the underscores.
 * By the time this runs the escapes are gone and the text node just holds
 * ‘_Japan_’, so any `_…_` pair that isn't part of a word (snake_case, a
 * handle like @dead_ly_demos) is turned back into emphasis.
 */
const LOOSE = /(?<![\p{L}\p{N}_])_(?=\S)([^_\n]*?\S)_(?![\p{L}\p{N}_])/gu;

export const looseEmphasis = {
  name: 'loose-emphasis',
  text(node, ctx) {
    const parts = [];
    let last = 0;
    for (const m of node.value.matchAll(LOOSE)) {
      if (m.index > last) parts.push({ type: 'text', value: node.value.slice(last, m.index) });
      parts.push({ type: 'emphasis', children: [{ type: 'text', value: m[1] }] });
      last = m.index + m[0].length;
    }
    if (!parts.length) return;
    if (last < node.value.length) parts.push({ type: 'text', value: node.value.slice(last) });
    ctx.replaceNode(node, parts);
  },
};
