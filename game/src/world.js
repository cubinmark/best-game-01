// Neon Harvest — world: the whole simulation. Player physics, orb
// spawning and expiry, sentinel patrols, collisions, the combo chain,
// wave flow and scoring. It knows nothing about pixels: render.js draws
// what this file decides, and main.js feeds it input and time.

import {
  VIEW_W, VIEW_H, HUD_H, WALL,
  PLAYER_RADIUS, PLAYER_ACCEL, PLAYER_MAX_SPEED, PLAYER_DAMPING,
  STUN_TIME, INVULN_TIME,
  ORB_RADIUS, ORB_LIFE, ORB_WARN, ORB_TIERS,
  COMBO_WINDOW, MAX_MULTIPLIER,
  SENTINEL_RADIUS, WAVES, START_LIVES, BANNER_TIME, STORAGE_KEY,
} from './config.js';

const ARENA = {
  left: WALL + 6,
  right: VIEW_W - WALL - 6,
  top: HUD_H + WALL + 4,
  bottom: VIEW_H - WALL - 6,
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export class World {
  constructor(sfx) {
    this.sfx = sfx;
    this.state = 'title';        // title | playing | paused | waveclear | gameover | win
    this.time = 0;               // seconds since boot, for ambient motion
    this.best = this.loadBest();
    this.stars = [];
    for (let i = 0; i < 110; i++) {
      this.stars.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * VIEW_H,
        z: rand(0.25, 1),        // parallax depth
        r: rand(0.6, 1.9),
      });
    }
    this.resetRun();
  }

  loadBest() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const n = raw === null ? 0 : Number.parseInt(raw, 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  saveBest() {
    if (this.score <= this.best) return;
    this.best = this.score;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(this.best));
    } catch {
      // Storage is a nicety, never a requirement.
    }
  }

  resetRun() {
    this.score = 0;
    this.lives = START_LIVES;
    this.waveIndex = 0;
    this.waveScore = 0;
    this.timeLeft = 0;
    this.banner = 0;
    this.overReason = '';
    this.player = {
      x: VIEW_W / 2, y: VIEW_H - 110,
      vx: 0, vy: 0, stun: 0, invuln: 0, tilt: 0,
    };
    this.orbs = [];
    this.sentinels = [];
    this.particles = [];
    this.texts = [];
    this.chain = 0;
    this.comboTimer = 0;
    this.decayTick = 0;
    this.mult = 1;
    this.spawnTimer = 0;
    this.shake = 0;
    this.flash = 0;
    this.stats = { collected: 0, hits: 0, bestChain: 0 };
  }

  get wave() {
    return WAVES[this.waveIndex];
  }

  startGame() {
    this.resetRun();
    this.setupWave();
    this.state = 'playing';
    this.sfx.start();
  }

  setupWave() {
    const w = this.wave;
    this.waveScore = 0;
    this.timeLeft = w.time;
    this.banner = BANNER_TIME;
    this.orbs = [];
    this.spawnTimer = 0;
    this.chain = 0;
    this.comboTimer = 0;
    this.mult = 1;
    this.player.x = VIEW_W / 2;
    this.player.y = VIEW_H - 110;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.stun = 0;
    this.player.invuln = 1.0;
    this.sentinels = [];
    const anchors = [
      { fx: 0.30, fy: 0.36 }, { fx: 0.70, fy: 0.62 },
      { fx: 0.68, fy: 0.30 }, { fx: 0.32, fy: 0.68 },
    ];
    for (let i = 0; i < w.sentinels; i++) {
      const a = anchors[i % anchors.length];
      const cx = VIEW_W * a.fx + rand(-30, 30);
      const cy = VIEW_H * a.fy + rand(-24, 24);
      const hw = rand(95, 165);
      const hh = rand(62, 105);
      const pts = [
        { x: cx - hw, y: cy - hh }, { x: cx + hw, y: cy - hh },
        { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh },
      ].map((p) => ({
        x: clamp(p.x, ARENA.left + 20, ARENA.right - 20),
        y: clamp(p.y, ARENA.top + 20, ARENA.bottom - 20),
      }));
      this.sentinels.push({
        x: pts[0].x, y: pts[0].y,
        waypoints: pts, next: 1,
        speed: w.sentinelSpeed * rand(0.88, 1.12),
        phase: rand(0, Math.PI * 2),
      });
    }
    for (let i = 0; i < 5; i++) this.spawnOrb();
  }

  nextWave() {
    this.waveIndex += 1;
    this.setupWave();
    this.state = 'playing';
    this.sfx.start();
  }

  togglePause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  }

  spawnOrb() {
    const roll = Math.random() * 100;
    let acc = 0;
    let tier = ORB_TIERS[0];
    for (const t of ORB_TIERS) {
      acc += t.weight;
      if (roll <= acc) { tier = t; break; }
    }
    let x = ARENA.left + 30;
    let y = ARENA.top + 30;
    for (let tries = 0; tries < 8; tries++) {
      x = rand(ARENA.left + 26, ARENA.right - 26);
      y = rand(ARENA.top + 26, ARENA.bottom - 26);
      const dx = x - this.player.x;
      const dy = y - this.player.y;
      if (dx * dx + dy * dy > 80 * 80) break;
    }
    this.orbs.push({
      x, y, tier,
      age: 0,
      life: ORB_LIFE * tier.life,
      pulse: rand(0, Math.PI * 2),
    });
  }

  burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speed * 0.25, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0, maxLife: rand(0.3, 0.7),
        size: rand(1.4, 3.2), color,
      });
    }
  }

  floatText(x, y, text, color, size = 17) {
    this.texts.push({ x, y, text, color, size, life: 0, maxLife: 0.95 });
  }

  collectOrb(orb) {
    this.chain += 1;
    this.comboTimer = COMBO_WINDOW;
    this.decayTick = 0;
    this.mult = Math.min(MAX_MULTIPLIER, 1 + Math.floor(this.chain / 4));
    this.stats.bestChain = Math.max(this.stats.bestChain, this.chain);
    const gained = orb.tier.points * this.mult;
    this.score += gained;
    this.waveScore += gained;
    this.stats.collected += 1;
    this.burst(orb.x, orb.y, orb.tier.key, 12, 130);
    this.floatText(orb.x, orb.y - 14, `+${gained}`, '#ffffff');
    if (this.mult > 1) {
      this.floatText(orb.x, orb.y + 8, `x${this.mult}`, '#ffd23e', 13);
    }
    this.sfx.pickup(this.mult);
  }

  hitSentinel() {
    this.lives -= 1;
    this.stats.hits += 1;
    this.chain = 0;
    this.comboTimer = 0;
    this.mult = 1;
    this.player.stun = STUN_TIME;
    this.player.invuln = INVULN_TIME;
    this.shake = 13;
    this.flash = 0.4;
    this.burst(this.player.x, this.player.y, 'sentinel', 18, 190);
    this.floatText(this.player.x, this.player.y - 24, 'HIT!', '#ff5470', 19);
    this.sfx.damage();
    if (this.lives <= 0) this.gameOver('caught');
  }

  waveCleared() {
    this.saveBest();
    if (this.waveIndex >= WAVES.length - 1) {
      this.state = 'win';
      this.sfx.win();
    } else {
      this.state = 'waveclear';
      this.sfx.waveClear();
    }
  }

  gameOver(reason) {
    this.overReason = reason;
    this.saveBest();
    this.state = 'gameover';
    this.sfx.waveFail();
  }

  update(dt, input) {
    this.time += dt;
    this.updateFx(dt);
    if (this.state !== 'playing') return;

    if (this.banner > 0) this.banner -= dt;
    const w = this.wave;
    const p = this.player;

    // --- player movement
    if (p.stun > 0) p.stun -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    let tx = 0;
    let ty = 0;
    if (p.stun <= 0) {
      const v = input.thrustVector();
      tx = v.x;
      ty = v.y;
      if (input.mouseDown) {
        const dx = input.mouseX - p.x;
        const dy = input.mouseY - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 14) { tx = dx / d; ty = dy / d; }
      }
    }
    p.vx += tx * PLAYER_ACCEL * dt;
    p.vy += ty * PLAYER_ACCEL * dt;
    const damp = Math.max(0, 1 - PLAYER_DAMPING * dt);
    p.vx *= damp;
    p.vy *= damp;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > PLAYER_MAX_SPEED) {
      p.vx = (p.vx / sp) * PLAYER_MAX_SPEED;
      p.vy = (p.vy / sp) * PLAYER_MAX_SPEED;
    }
    p.x = clamp(p.x + p.vx * dt, ARENA.left + PLAYER_RADIUS, ARENA.right - PLAYER_RADIUS);
    p.y = clamp(p.y + p.vy * dt, ARENA.top + PLAYER_RADIUS, ARENA.bottom - PLAYER_RADIUS);
    p.tilt = clamp(p.vx / PLAYER_MAX_SPEED, -1, 1) * 0.38;
    if (sp > 60 && Math.random() < 0.55) {
      this.particles.push({
        x: p.x - p.vx * 0.04, y: p.y - p.vy * 0.04,
        vx: -p.vx * 0.25 + rand(-14, 14), vy: -p.vy * 0.25 + rand(-14, 14),
        life: 0, maxLife: rand(0.22, 0.42), size: rand(1.2, 2.6), color: 'trail',
      });
    }

    // --- orbs
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = w.orbEvery * rand(0.75, 1.25);
      if (this.orbs.length < 7) this.spawnOrb();
    }
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      orb.age += dt;
      if (orb.age >= orb.life) {
        this.burst(orb.x, orb.y, 'dim', 5, 50);
        this.orbs.splice(i, 1);
        continue;
      }
      const dx = orb.x - p.x;
      const dy = orb.y - p.y;
      const rr = ORB_RADIUS + PLAYER_RADIUS + 2;
      if (dx * dx + dy * dy < rr * rr) {
        this.collectOrb(orb);
        this.orbs.splice(i, 1);
      }
    }

    // --- combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
    } else if (this.chain > 0) {
      this.decayTick += dt;
      if (this.decayTick >= 0.25) {
        this.decayTick = 0;
        this.chain -= 1;
        this.mult = Math.min(MAX_MULTIPLIER, 1 + Math.floor(this.chain / 4));
      }
    }

    // --- sentinels
    for (const s of this.sentinels) {
      const target = s.waypoints[s.next];
      const dx = target.x - s.x;
      const dy = target.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) {
        s.next = (s.next + 1) % s.waypoints.length;
      } else {
        s.x += (dx / d) * s.speed * dt;
        s.y += (dy / d) * s.speed * dt;
      }
      if (p.invuln <= 0) {
        const hx = s.x - p.x;
        const hy = s.y - p.y;
        const hr = SENTINEL_RADIUS + PLAYER_RADIUS - 2;
        if (hx * hx + hy * hy < hr * hr) {
          this.hitSentinel();
          if (this.state !== 'playing') return;
        }
      }
    }

    // --- the clock
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      if (this.waveScore >= w.target) this.waveCleared();
      else this.gameOver('target');
    }
  }

  updateFx(dt) {
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life += dt;
      if (pt.life >= pt.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life += dt;
      t.y -= 34 * dt;
      if (t.life >= t.maxLife) this.texts.splice(i, 1);
    }
  }

  // A small read-only view for tooling (the screenshot harness steers by
  // it); the game itself never reads it.
  debugSnapshot() {
    const p = this.player;
    let nearestOrb = null;
    let bestD = Infinity;
    for (const o of this.orbs) {
      const d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
      if (d < bestD) { bestD = d; nearestOrb = { x: o.x, y: o.y }; }
    }
    let nearestSentinel = null;
    bestD = Infinity;
    for (const s of this.sentinels) {
      const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
      if (d < bestD) { bestD = d; nearestSentinel = { x: s.x, y: s.y }; }
    }
    return {
      state: this.state,
      score: this.score,
      waveScore: this.waveScore,
      target: this.wave ? this.wave.target : 0,
      wave: this.waveIndex + 1,
      lives: this.lives,
      timeLeft: Math.round(this.timeLeft * 10) / 10,
      mult: this.mult,
      player: { x: Math.round(p.x), y: Math.round(p.y) },
      nearestOrb,
      nearestSentinel,
    };
  }
}
