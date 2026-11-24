// SOLMARIS v5 — entrypoint for the make.fun gta6-01 "Make GTA 6" bounty.
// The game itself is plain static files under game/ (three.js vendored, zero
// network requests). This program is only the hand-in: it copies game/ and
// screenshots/ into the output directory and writes /output/dossier.json
// through buildDossier from the kit's vendor/makefun-game.ts, which the
// sealed scorer rebuilds and compares byte for byte.
//
// Safety note the grader enforces: /output may be a mounted directory, so
// this program never removes it — it creates it, empties its contents, and
// copies into it. It also rebuilds the dossier a second time and refuses to
// finish if the two builds differ, so a flaky entry fails here, loudly,
// instead of at grading time.
//
// Run locally: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Count every file under a directory, recursively — the report line at the
// end of a run names the real numbers, so a silent copy failure shows up
// in the log instead of at grading time.
function countFiles(dir) {
  let n = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    n += name.isDirectory() ? countFiles(join(dir, name.name)) : 1;
  }
  return n;
}

const root = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const limits = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Create the output dir, then empty only its contents (never the dir itself).
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) {
  rmSync(join(out, name), { recursive: true, force: true });
}

cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  // The kit caps screenshots at 4: refuse to build with a stale or extra
  // file in screenshots/ instead of shipping a dossier the scorer rejects.
  const shots = readdirSync(join(root, 'screenshots')).filter((n) => n.endsWith('.jpg'));
  if (shots.length === 0 || shots.length > 4) {
    throw new Error(`expected 1-4 screenshots, found ${shots.length}`);
  }
  cpSync(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

const first = buildDossier(out, limits);
writeFileSync(join(out, 'dossier.json'), first);

// Determinism self-check: rebuild from the finished output and demand
// byte-identical output before reporting success.
const second = buildDossier(out, limits);
if (!Buffer.from(first).equals(Buffer.from(second))) {
  throw new Error('dossier differs between two builds of the same output');
}
const gameFiles = countFiles(join(out, 'game'));
const shotFiles = existsSync(join(out, 'screenshots')) ? countFiles(join(out, 'screenshots')) : 0;
console.log(`SOLMARIS v5 entry written to ${out} (dossier ${first.length} bytes, deterministic, ${gameFiles} game files, ${shotFiles} screenshots)`);
