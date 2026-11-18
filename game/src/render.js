// Neon Harvest — render: everything the player sees, drawn on canvas
// from the world's state. Background void and grid, the arena, orbs,
// sentinels, the drone, particles, the HUD, and every screen (title,
// pause, wave clear, game over, win). Menu buttons register themselves
// in this.buttons as they are drawn, so main.js can route clicks.

import {
  VIEW_W, VIEW_H, HUD_H, WALL, COLORS,
  PLAYER_RADIUS, ORB_RADIUS, ORB_WARN, SENTINEL_RADIUS,
  COMBO_WINDOW, WAVES,
} from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.buttons = [];
    const vg = this.ctx.createRadialGradient(
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42,
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95,
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(2,3,10,0.55)');
    this.vignette = vg;
  }

  draw(world, input) {
    const ctx = this.ctx;
    this.buttons = [];
    ctx.save();
    if (world.shake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * world.shake,
        (Math.random() - 0.5) * world.shake,
      );
    }
    this.drawBackground(world);
    this.drawArena(world);
    if (world.state !== 'title') {
      this.drawOrbs(world);
      this.drawSentinels(world);
      this.drawPlayer(world);
    } else {
      this.drawTitleDressing(world);
    }
    this.drawParticles(world);
    this.drawTexts(world);
    if (world.state !== 'title') this.drawHud(world);
    ctx.restore();

    if (world.flash > 0) {
      ctx.fillStyle = `rgba(255, 40, 70, ${world.flash * 0.45})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (world.banner > 0 && world.state === 'playing') this.drawBanner(world);
    if (world.state === 'title') this.drawTitle(world, input);
    if (world.state === 'paused') this.drawPause(world, input);
    if (world.state === 'waveclear') this.drawWaveClear(world, input);
    if (world.state === 'gameover') this.drawGameOver(world, input);
    if (world.state === 'win') this.drawWin(world, input);
  }

  drawBackground(world) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#0a0d26');
    g.addColorStop(0.55, COLORS.void);
    g.addColorStop(1, '#0d0618');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Two slow nebula blooms.
    this.bloom(VIEW_W * 0.22, VIEW_H * 0.3, 210, 'rgba(64, 60, 220, 0.13)');
    this.bloom(VIEW_W * 0.82, VIEW_H * 0.72, 240, 'rgba(255, 62, 168, 0.08)');

    // Parallax starfield: deeper stars drift slower.
    ctx.fillStyle = '#cfe8ff';
    for (const s of world.stars) {
      const x = (s.x + world.time * 3 * s.z) % VIEW_W;
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(world.time * 0.7 + s.x));
      ctx.globalAlpha = 0.25 + 0.5 * s.z * tw;
      ctx.fillRect(x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // The grid floor of the arena void.
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = 48;
    const off = (world.time * 6) % step;
    for (let x = -step + off; x < VIEW_W + step; x += step) {
      ctx.moveTo(x, HUD_H);
      ctx.lineTo(x - 26, VIEW_H);
    }
    for (let y = HUD_H + 26; y < VIEW_H; y += 34) {
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW_W, y);
    }
    ctx.stroke();
  }

  bloom(x, y, r, color) {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  drawArena(world) {
    const ctx = this.ctx;
    const x = WALL;
    const y = HUD_H + WALL;
    const w = VIEW_W - WALL * 2;
    const h = VIEW_H - HUD_H - WALL * 2;
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = 5;
    roundRect(ctx, x, y, w, h, 12);
    ctx.stroke();
    ctx.strokeStyle = COLORS.wallEdge;
    ctx.globalAlpha = 0.5 + 0.22 * Math.sin(world.time * 2);
    ctx.lineWidth = 1.6;
    roundRect(ctx, x, y, w, h, 12);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawOrbs(world) {
    const ctx = this.ctx;
    for (const orb of world.orbs) {
      const remain = orb.life - orb.age;
      let alpha = 1;
      if (remain < ORB_WARN) {
        alpha = 0.35 + 0.65 * Math.abs(Math.sin(world.time * 10));
      }
      const pulse = 1 + 0.14 * Math.sin(world.time * 3.2 + orb.pulse);
      const r = ORB_RADIUS * pulse;
      const color = COLORS[orb.tier.key];
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.orbRing;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      // A thin life ring: what is left before the orb fades.
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, r + 4.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (remain / orb.life));
      ctx.stroke();
      ctx.restore();
    }
  }

  drawSentinels(world) {
    const ctx = this.ctx;
    for (const s of world.sentinels) {
      ctx.save();
      ctx.translate(s.x, s.y);
      // Patrol path hint: a faint dotted loop.
      ctx.rotate(world.time * 1.4 + s.phase);
      ctx.shadowColor = COLORS.sentinel;
      ctx.shadowBlur = 13;
      ctx.fillStyle = COLORS.sentinel;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -SENTINEL_RADIUS - 4);
        ctx.lineTo(4.4, -SENTINEL_RADIUS + 3);
        ctx.lineTo(-4.4, -SENTINEL_RADIUS + 3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, SENTINEL_RADIUS - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.sentinelCore;
      ctx.beginPath();
      ctx.arc(0, 0, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawPlayer(world) {
    const ctx = this.ctx;
    const p = world.player;
    if (p.invuln > 0 && world.state === 'playing') {
      // Mercy blink: skip every other slice of time.
      if (Math.floor(world.time * 14) % 2 === 0 && p.stun <= 0) return;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.tilt);
    // Engine glow.
    const glow = ctx.createRadialGradient(0, 6, 1, 0, 6, 24);
    glow.addColorStop(0, 'rgba(64, 224, 255, 0.5)');
    glow.addColorStop(1, 'rgba(64, 224, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-24, -18, 48, 48);
    // Rotor arms.
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-PLAYER_RADIUS - 3, -6);
    ctx.lineTo(PLAYER_RADIUS + 3, -6);
    ctx.moveTo(-PLAYER_RADIUS - 3, 7);
    ctx.lineTo(PLAYER_RADIUS + 3, 7);
    ctx.stroke();
    // Hull: a sleek arrowhead.
    ctx.shadowColor = COLORS.player;
    ctx.shadowBlur = 12;
    ctx.fillStyle = p.stun > 0 ? '#5f748c' : COLORS.player;
    ctx.beginPath();
    ctx.moveTo(0, -PLAYER_RADIUS - 3);
    ctx.lineTo(PLAYER_RADIUS, PLAYER_RADIUS - 2);
    ctx.lineTo(0, PLAYER_RADIUS - 7);
    ctx.lineTo(-PLAYER_RADIUS, PLAYER_RADIUS - 2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.playerCore;
    ctx.beginPath();
    ctx.arc(0, -1, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawParticles(world) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of world.particles) {
      const left = 1 - pt.life / pt.maxLife;
      ctx.globalAlpha = left;
      ctx.fillStyle = COLORS[pt.color] || pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * left + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawTexts(world) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of world.texts) {
      const left = 1 - t.life / t.maxLife;
      ctx.globalAlpha = Math.min(1, left * 1.6);
      ctx.font = `700 ${t.size}px "Segoe UI", Arial, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawHud(world) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 7, 20, 0.66)';
    ctx.fillRect(0, 0, VIEW_W, HUD_H);
    ctx.fillStyle = COLORS.wallEdge;
    ctx.fillRect(0, HUD_H - 1, VIEW_W, 1);

    ctx.textBaseline = 'middle';
    // Score and wave target progress.
    ctx.textAlign = 'left';
    ctx.font = '700 19px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`SCORE ${world.score}`, 16, HUD_H / 2);
    const w = world.wave;
    ctx.font = '600 12px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    const label = `WAVE ${world.waveIndex + 1}/${WAVES.length} · TARGET ${w.target}`;
    ctx.fillText(label, 190, HUD_H / 2 - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(190, HUD_H / 2 + 4, 150, 5);
    ctx.fillStyle = COLORS.good;
    const frac = Math.min(1, world.waveScore / w.target);
    ctx.fillRect(190, HUD_H / 2 + 4, 150 * frac, 5);

    // Combo multiplier, centre.
    ctx.textAlign = 'center';
    ctx.font = '800 21px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = world.mult > 1 ? COLORS.gold : COLORS.textDim;
    ctx.fillText(`x${world.mult}`, VIEW_W / 2 - 26, HUD_H / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(VIEW_W / 2 + 2, HUD_H / 2 - 3, 64, 6);
    if (world.chain > 0) {
      ctx.fillStyle = COLORS.accent;
      const cfrac = Math.max(0, world.comboTimer / COMBO_WINDOW);
      ctx.fillRect(VIEW_W / 2 + 2, HUD_H / 2 - 3, 64 * Math.max(cfrac, world.chain > 0 ? 0.06 : 0), 6);
    }
    ctx.font = '600 10px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('COMBO', VIEW_W / 2 + 34, HUD_H / 2 + 12);

    // Clock: a draining bar and the seconds.
    const tfrac = Math.max(0, world.timeLeft / w.time);
    ctx.textAlign = 'right';
    ctx.font = '700 19px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = world.timeLeft <= 10 ? COLORS.bad : COLORS.text;
    ctx.fillText(`${Math.ceil(world.timeLeft)}s`, VIEW_W - 150, HUD_H / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(VIEW_W - 316, HUD_H / 2 - 3, 150, 6);
    ctx.fillStyle = world.timeLeft <= 10 ? COLORS.bad : COLORS.player;
    ctx.fillRect(VIEW_W - 316, HUD_H / 2 - 3, 150 * tfrac, 6);

    // Lives as little drone chevrons.
    for (let i = 0; i < world.lives; i++) {
      const x = VIEW_W - 118 + i * 30;
      const y = HUD_H / 2;
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 8, y + 7);
      ctx.lineTo(x, y + 3);
      ctx.lineTo(x - 8, y + 7);
      ctx.closePath();
      ctx.fill();
    }
    ctx.font = '600 10px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'right';
    ctx.fillText('LIVES', VIEW_W - 124, HUD_H / 2 + 13);
    ctx.restore();
  }

  drawBanner(world) {
    const ctx = this.ctx;
    const a = Math.min(1, world.banner / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = '900 44px "Segoe UI", Arial, sans-serif';
    ctx.shadowColor = COLORS.player;
    ctx.shadowBlur = 22;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`WAVE ${world.waveIndex + 1}`, VIEW_W / 2, 150);
    ctx.shadowBlur = 0;
    ctx.font = '700 19px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`REACH ${world.wave.target} POINTS`, VIEW_W / 2, 184);
    ctx.restore();
  }

  drawTitleDressing(world) {
    // A few idle orbs drift behind the title panel.
    const ctx = this.ctx;
    const keys = ['cyan', 'lime', 'gold', 'cyan', 'lime'];
    for (let i = 0; i < keys.length; i++) {
      const x = 90 + i * 195 + Math.sin(world.time * 0.7 + i * 1.7) * 16;
      const y = 428 + Math.cos(world.time * 0.9 + i * 2.3) * 10;
      ctx.save();
      ctx.shadowColor = COLORS[keys[i]];
      ctx.shadowBlur = 15;
      ctx.fillStyle = COLORS[keys[i]];
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  panel(world, w, h) {
    const ctx = this.ctx;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.save();
    ctx.fillStyle = COLORS.panel;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = COLORS.panelEdge;
    ctx.lineWidth = 1.6;
    roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();
    ctx.restore();
    return { x, y, w, h };
  }

  button(input, id, x, y, w, h, label, accent = false) {
    const ctx = this.ctx;
    const hover = input.mouseX >= x && input.mouseX <= x + w
      && input.mouseY >= y && input.mouseY <= y + h;
    this.buttons.push({ id, x, y, w, h });
    ctx.save();
    ctx.fillStyle = accent
      ? (hover ? '#ff5cb8' : COLORS.accent)
      : (hover ? 'rgba(64, 224, 255, 0.28)' : 'rgba(64, 224, 255, 0.13)');
    roundRect(ctx, x, y, w, h, 9);
    ctx.fill();
    ctx.strokeStyle = accent ? '#ffb3dd' : COLORS.panelEdge;
    ctx.lineWidth = 1.4;
    roundRect(ctx, x, y, w, h, 9);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 17px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.restore();
    return hover;
  }

  drawTitle(world, input) {
    const ctx = this.ctx;
    const box = this.panel(world, 620, 356);
    const cx = VIEW_W / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = COLORS.player;
    ctx.shadowBlur = 26;
    ctx.fillStyle = COLORS.text;
    ctx.font = '900 58px "Segoe UI", Arial, sans-serif';
    ctx.fillText('NEON HARVEST', cx, box.y + 66);
    ctx.shadowColor = COLORS.accent;
    ctx.shadowBlur = 16;
    ctx.font = '700 16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.accent;
    ctx.fillText('PILOT THE LAST HARVESTER DRONE', cx, box.y + 98);
    ctx.shadowBlur = 0;
    ctx.font = '400 15px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('Collect energy orbs before they fade. Chain pickups to raise your', cx, box.y + 136);
    ctx.fillText('multiplier — but keep clear of the red sentinel patrols.', cx, box.y + 158);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '600 13.5px "Segoe UI", Arial, sans-serif';
    ctx.fillText('MOVE  Arrow keys / WASD / hold mouse      PAUSE  P or Esc', cx, box.y + 196);
    ctx.fillText('CLEAR 3 WAVES TO WIN · 3 LIVES · M toggles sound', cx, box.y + 218);
    if (world.best > 0) {
      ctx.fillStyle = COLORS.gold;
      ctx.font = '700 15px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`BEST SCORE ${world.best}`, cx, box.y + 248);
    }
    ctx.restore();
    this.button(input, 'start', cx - 110, box.y + 272, 220, 46, 'START HARVEST', true);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '600 12px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('or press Enter', cx, box.y + 338);
    ctx.restore();
  }

  drawPause(world, input) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(3, 4, 12, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const box = this.panel(world, 380, 250);
    const cx = VIEW_W / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 36px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('PAUSED', cx, box.y + 58);
    ctx.font = '400 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`Wave ${world.waveIndex + 1} · Score ${world.score}`, cx, box.y + 88);
    ctx.restore();
    this.button(input, 'resume', cx - 100, box.y + 116, 200, 42, 'RESUME', true);
    this.button(input, 'restart', cx - 100, box.y + 172, 200, 42, 'RESTART RUN');
  }

  statsLines(world) {
    return [
      `Orbs harvested   ${world.stats.collected}`,
      `Best combo chain  x${Math.max(1, Math.min(8, 1 + Math.floor(world.stats.bestChain / 4)))}  (${world.stats.bestChain} in a row)`,
      `Sentinel hits      ${world.stats.hits}`,
    ];
  }

  drawWaveClear(world, input) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(3, 4, 12, 0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const box = this.panel(world, 430, 300);
    const cx = VIEW_W / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 34px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.good;
    ctx.fillText(`WAVE ${world.waveIndex + 1} CLEAR!`, cx, box.y + 54);
    ctx.font = '700 17px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`Wave score ${world.waveScore} · Total ${world.score}`, cx, box.y + 88);
    ctx.font = '400 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    const lines = this.statsLines(world);
    lines.forEach((ln, i) => ctx.fillText(ln, cx, box.y + 122 + i * 22));
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`Next target: ${WAVES[world.waveIndex + 1].target} points`, cx, box.y + 200);
    ctx.restore();
    this.button(input, 'next', cx - 105, box.y + 224, 210, 44, 'NEXT WAVE', true);
  }

  drawGameOver(world, input) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10, 2, 8, 0.5)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const box = this.panel(world, 450, 316);
    const cx = VIEW_W / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 38px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.bad;
    ctx.fillText('GAME OVER', cx, box.y + 56);
    ctx.font = '400 15px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(
      world.overReason === 'caught'
        ? 'The sentinels caught your drone.'
        : `Wave ${world.waveIndex + 1}'s target slipped away.`,
      cx, box.y + 88,
    );
    ctx.font = '800 24px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`SCORE ${world.score}`, cx, box.y + 126);
    ctx.font = '600 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`BEST ${world.best}`, cx, box.y + 150);
    ctx.font = '400 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    const lines = this.statsLines(world);
    lines.forEach((ln, i) => ctx.fillText(ln, cx, box.y + 182 + i * 21));
    ctx.restore();
    this.button(input, 'restart', cx - 160, box.y + 256, 150, 42, 'TRY AGAIN', true);
    this.button(input, 'menu', cx + 10, box.y + 256, 150, 42, 'TITLE');
  }

  drawWin(world, input) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(2, 10, 6, 0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const box = this.panel(world, 450, 316);
    const cx = VIEW_W / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = COLORS.good;
    ctx.shadowBlur = 18;
    ctx.font = '900 34px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.good;
    ctx.fillText('HARVEST COMPLETE!', cx, box.y + 56);
    ctx.shadowBlur = 0;
    ctx.font = '400 15px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('All three waves cleared. The grid is yours.', cx, box.y + 88);
    ctx.font = '800 24px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`SCORE ${world.score}`, cx, box.y + 126);
    ctx.font = '600 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`BEST ${world.best}`, cx, box.y + 150);
    ctx.font = '400 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    const lines = this.statsLines(world);
    lines.forEach((ln, i) => ctx.fillText(ln, cx, box.y + 182 + i * 21));
    ctx.restore();
    this.button(input, 'restart', cx - 160, box.y + 256, 150, 42, 'PLAY AGAIN', true);
    this.button(input, 'menu', cx + 10, box.y + 256, 150, 42, 'TITLE');
  }
}
