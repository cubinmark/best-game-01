// Neon Harvest — the hand-in program for make.fun's best-game-01.
//
// The game itself is the static site under game/ (open game/index.html in
// a desktop browser and play; it needs no network and no build step).
// This program delivers it: it copies game/ and screenshots/ into the
// output directory and writes dossier.json there with buildDossier from
// the vendored make.fun library, under the scorer's own caps, so the
// dossier the judge reads is byte for byte the one the gate rebuilds.
//
// Run it the way the grader does, with the output directory named by the
// environment:  MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The caps are the gate's own (reference/gate.json): at most 4 screenshots
// of 256 KiB, at most 993 entries and 48 MiB under game/, no game path
// over 1,000 bytes, and the dossier's source text held to 160 KiB.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
