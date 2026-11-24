// SOLMARIS v6 — entrypoint for the make.fun gta6-01 "Make GTA 6" bounty.
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

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Walk a directory tree and count files — the report line at the end of a
// run names the real numbers, so a silent copy failure shows up in the log
// instead of at grading time.
function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return n;
}

// Empty a directory's CONTENTS without removing the directory itself
// (the grader may have it mounted — removing it throws EBUSY).
function emptyDir(dir) {
  for (const name of readdirSync(dir)) {
    rmSync(join(dir, name), { recursive: true, force: true });
  }
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

mkdirSync(out, { recursive: true });
emptyDir(out);

cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  // The kit caps screenshots at 4: refuse to build with a stale or extra
  // file in screenshots/ instead of shipping a dossier the scorer rejects.
  const shots = readdirSync(join(root, 'screenshots')).filter((n) => n.endsWith('.jpg'));
  if (shots.length === 0 || shots.length > 4) {
    throw new Error(`expected 1-4 screenshots, found ${shots.length}`);
  }
  // The scorer rejects any screenshot over the byte cap, so refuse here
  // with the offending filename instead of shipping a doomed dossier.
  for (const shot of shots) {
    const size = statSync(join(root, 'screenshots', shot)).size;
    if (size > limits.screenshots.max_bytes) {
      throw new Error(`screenshot ${shot} is ${size} bytes, over the ${limits.screenshots.max_bytes} cap`);
    }
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
console.log(`SOLMARIS v6 entry written to ${out} (dossier ${first.length} bytes, deterministic, ${gameFiles} game files, ${shotFiles} screenshots)`);
