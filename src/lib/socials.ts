/**
 * Single source of truth for the crew's accounts.
 *
 * Imported by the footer and the contact page so the two can never drift
 * apart — which they already had once. Share-tracking params (`si`, `_t`,
 * `igsi`, `utm_*`) are stripped: the canonical profile URL is just the path.
 */
export const socials = [
  { label: 'Instagram', url: 'https://www.instagram.com/deadlydemos' },
  { label: 'Spotify',   url: 'https://open.spotify.com/user/317n76vmpjbvxyzngbzlluw56jqq' },
  { label: 'TikTok',    url: 'https://www.tiktok.com/@deadlydemos' },
] as const;

/** Placeholder — swap for the real inbox. */
export const email = 'hello@deadlydemos.com';
