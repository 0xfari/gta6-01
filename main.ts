// SOLMARIS — "Make GTA 6" entry for make.fun gta6-01.
// An original open-world crime game: a coastal city to explore on foot and by car,
// traffic and pedestrians, cars to steal, a 5-star wanted system with police pursuit,
// a 3-mission campaign starring Lena Cruz, hitscan combat, a live minimap HUD,
// a start screen and localStorage saves — all in static files under game/.
//
// This program hands the game in: it copies game/ and screenshots/ from this
// repository into the output directory and writes dossier.json with buildDossier
// from the kit's vendor/makefun-game.ts. It never deletes the output directory
// itself (the grader mounts it) — it only empties its contents first.

import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The output directory may be a mount point: never remove it, only empty it.
mkdirSync(outDir, { recursive: true });
for (const entry of readdirSync(outDir)) {
  rmSync(join(outDir, entry), { recursive: true, force: true });
}

cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// The grader runs this program twice and demands identical bytes, so verify
// determinism here: rebuild the dossier from the finished output and require
// byte equality with what was just written. A mismatch fails loudly instead
// of shipping a flaky entry.
const rebuilt = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
if (!Buffer.from(dossier).equals(Buffer.from(rebuilt))) {
  throw new Error('SOLMARIS entrypoint: dossier is not deterministic across builds');
}
console.log(
  `SOLMARIS entry written to ${outDir}: dossier ${dossier.length} bytes, ` +
    `game/ + screenshots/ copied, determinism check passed.`
);
