// Neon Harvest — tuning constants: arena, palette, waves and scoring.
// Every number the game balances on lives here, so the rest of the code
// only says what things do, never how big or how fast they are.

export const VIEW_W = 960;
export const VIEW_H = 540;
export const HUD_H = 46;            // top strip reserved for the HUD
export const WALL = 14;             // arena wall thickness in px

export const PLAYER_RADIUS = 13;
export const PLAYER_ACCEL = 2500;   // px per second^2 of thrust
export const PLAYER_MAX_SPEED = 345;
export const PLAYER_DAMPING = 3.4;  // velocity bleed per second
export const STUN_TIME = 0.65;      // seconds of lost control after a hit
export const INVULN_TIME = 2.1;     // seconds of mercy after a hit

export const ORB_RADIUS = 10;
export const ORB_LIFE = 8.5;        // seconds before an orb fades away
export const ORB_WARN = 2.6;        // seconds of blinking before it fades
// Combo tuning was revised after the first browser playtest: with a
// 2.3 s window and a chain step of 3, a steady pilot sat at x8 almost
// the whole wave and banked 6,565 points against a 500 target. The
// window is tighter now and the multiplier climbs one step per 4 chain.
export const COMBO_WINDOW = 1.9;    // seconds to chain the next pickup
export const MAX_MULTIPLIER = 8;

// Orb tiers: [points, spawn weight, life multiplier, colour key]
export const ORB_TIERS = [
  { points: 10, weight: 62, life: 1.0, key: 'cyan' },
  { points: 25, weight: 27, life: 0.85, key: 'lime' },
  { points: 50, weight: 11, life: 0.66, key: 'gold' },
];

export const SENTINEL_RADIUS = 14;

// One row per wave: seconds on the clock, score target for that wave,
// how many sentinels patrol, how fast they fly, how often orbs bloom.
// Targets were retuned in the same playtest pass: 500/1000/1600 fell in
// the first twenty seconds of skilled play, so they now sit where a
// good run is challenged but a clean run still clears.
export const WAVES = [
  { time: 60, target: 1500, sentinels: 2, sentinelSpeed: 62, orbEvery: 1.3 },
  { time: 60, target: 2600, sentinels: 3, sentinelSpeed: 78, orbEvery: 1.12 },
  { time: 60, target: 4000, sentinels: 4, sentinelSpeed: 95, orbEvery: 0.95 },
];

export const START_LIVES = 3;
export const BANNER_TIME = 2.2;     // seconds the wave banner stays up

// Synthwave palette, one name per job.
export const COLORS = {
  void: '#070818',
  voidDeep: '#04050d',
  grid: 'rgba(64, 90, 200, 0.20)',
  gridGlow: 'rgba(64, 224, 255, 0.10)',
  wall: '#1b2350',
  wallEdge: '#3d5bff',
  player: '#40e0ff',
  playerCore: '#e8fbff',
  trail: 'rgba(64, 224, 255, 0.5)',
  cyan: '#2ee6ff',
  lime: '#8dff57',
  gold: '#ffd23e',
  orbRing: 'rgba(255, 255, 255, 0.85)',
  sentinel: '#ff3b5c',
  sentinelCore: '#ffe9ec',
  text: '#eaf6ff',
  textDim: '#8fa3c8',
  accent: '#ff3ea8',
  good: '#57ffb0',
  bad: '#ff5470',
  panel: 'rgba(8, 10, 30, 0.82)',
  panelEdge: 'rgba(64, 224, 255, 0.55)',
};

export const STORAGE_KEY = 'neon-harvest-best';
