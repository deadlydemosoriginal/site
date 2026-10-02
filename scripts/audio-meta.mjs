// Works out `duration` and waveform `peaks` for shows that have audio but
// don't set them by hand. Runs in CI before `astro build`; results go to
// .cache/audio-meta.json (kept between runs by actions/cache, never committed)
// and src/lib/content.ts merges them in. Each MP3 is only analysed once.
//
// Never fails the build: a show it can't analyse just keeps the plain
// progress bar and no duration.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const SHOWS_DIR = 'src/content/shows';
const CACHE_FILE = '.cache/audio-meta.json';
const PEAK_COUNT = 200;
const SAMPLE_RATE = 1000; // plenty for a 200-bar overview, keeps decoding cheap
const TIMEOUT_MS = 15 * 60 * 1000;

/** Reads one top-level frontmatter value, stripping YAML quotes. */
function field(frontmatter, name) {
  const m = frontmatter.match(new RegExp(`^${name}:[ \\t]*(.*)$`, 'm'));
  if (!m) return undefined;
  const v = m[1].trim().replace(/^(['"])(.*)\1$/, '$2');
  return v === '' ? undefined : v;
}

const hhmmss = (s) =>
  [s / 3600, (s % 3600) / 60, s % 60].map((n) => String(Math.floor(n)).padStart(2, '0')).join(':');

function hasFfmpeg() {
  return new Promise((resolve) => {
    const p = spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
    p.on('error', () => resolve(false));
    p.on('close', (code) => resolve(code === 0));
  });
}

/** Decodes the whole file to low-rate mono PCM and reduces it to peaks. */
function analyse(url) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-i', url, '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', '-'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks = [];
    let err = '';
    const timer = setTimeout(() => p.kill('SIGKILL'), TIMEOUT_MS);
    p.stdout.on('data', (c) => chunks.push(c));
    p.stderr.on('data', (c) => (err += c));
    p.on('error', reject);
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim() || `ffmpeg exited with ${code}`));
      const pcm = Buffer.concat(chunks);
      const samples = Math.floor(pcm.length / 2);
      if (!samples) return reject(new Error('no audio decoded'));

      const per = samples / PEAK_COUNT;
      const raw = Array.from({ length: PEAK_COUNT }, (_, i) => {
        let max = 0;
        for (let j = Math.floor(i * per); j < Math.floor((i + 1) * per); j++) {
          max = Math.max(max, Math.abs(pcm.readInt16LE(j * 2)));
        }
        return max;
      });
      const top = Math.max(...raw) || 1;
      resolve({
        duration: hhmmss(Math.round(samples / SAMPLE_RATE)),
        peaks: raw.map((v) => Math.round((v / top) * 100) / 100),
      });
    });
  });
}

async function isAudio(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.ok && (res.headers.get('content-type') || '').startsWith('audio/');
  } catch {
    return false;
  }
}

async function main() {
  if (!(await hasFfmpeg())) {
    console.log('audio-meta: ffmpeg not found, skipping.');
    return;
  }

  let cache = {};
  try {
    cache = JSON.parse(await readFile(CACHE_FILE, 'utf8'));
  } catch {}

  let changed = false;
  for (const file of (await readdir(SHOWS_DIR)).filter((f) => f.endsWith('.md'))) {
    const text = await readFile(`${SHOWS_DIR}/${file}`, 'utf8');
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
    const url = field(fm, 'audioUrl');
    if (!url || cache[url]) continue;
    if (field(fm, 'duration') && field(fm, 'peaks')) continue;

    if (!(await isAudio(url))) {
      console.warn(`audio-meta: ${file}: ${url} isn't a direct audio file, skipping.`);
      continue;
    }
    try {
      const started = Date.now();
      cache[url] = await analyse(url);
      changed = true;
      console.log(`audio-meta: ${file}: ${cache[url].duration} (${Math.round((Date.now() - started) / 1000)}s)`);
    } catch (e) {
      console.warn(`audio-meta: ${file}: couldn't analyse ${url}: ${e.message}`);
    }
  }

  if (changed) {
    await mkdir('.cache', { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(cache));
  }
  console.log(`audio-meta: ${Object.keys(cache).length} show(s) in cache.`);
}

main().catch((e) => console.warn(`audio-meta: ${e.message}`));
