// Neon Harvest — boot and wiring: owns the canvas, the fixed-step game
// loop, and the routing of keys and clicks to world actions. The world
// simulates, the renderer draws; this file only connects them.

import { SoundFX } from './audio.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { World } from './world.js';

const STEP = 1 / 60;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const sfx = new SoundFX();
const input = new Input(canvas);
const world = new World(sfx);
const renderer = new Renderer(canvas);

let muted = false;
let lastState = '';

const STATE_LINES = {
  title: 'Neon Harvest. Press Enter or click Start Harvest to play.',
  playing: 'Harvesting. Collect orbs, avoid the red sentinels.',
  paused: 'Paused.',
  waveclear: 'Wave clear. Press Enter for the next wave.',
  gameover: 'Game over. Press R to try again.',
  win: 'You cleared all three waves. Press R to play again.',
};

function announce() {
  if (world.state !== lastState) {
    lastState = world.state;
    if (status) status.textContent = STATE_LINES[world.state] || '';
  }
}

function onButton(id) {
  sfx.unlock();
  sfx.click();
  if (id === 'start' || id === 'restart') world.startGame();
  else if (id === 'resume') world.togglePause();
  else if (id === 'next') world.nextWave();
  else if (id === 'menu') {
    world.resetRun();
    world.state = 'title';
  }
}

function handleKeys() {
  if (input.justPressed('KeyM')) {
    muted = !muted;
    sfx.setMuted(muted);
  }
  const state = world.state;
  if (state === 'title') {
    if (input.justPressed('Enter') || input.justPressed('Space')) world.startGame();
  } else if (state === 'playing') {
    if (input.justPressed('KeyP') || input.justPressed('Escape')) world.togglePause();
  } else if (state === 'paused') {
    if (input.justPressed('KeyP') || input.justPressed('Escape') || input.justPressed('Enter')) {
      world.togglePause();
    } else if (input.justPressed('KeyR')) {
      world.startGame();
    }
  } else if (state === 'waveclear') {
    if (input.justPressed('Enter') || input.justPressed('Space')) world.nextWave();
  } else if (state === 'gameover' || state === 'win') {
    if (input.justPressed('KeyR') || input.justPressed('Enter')) world.startGame();
    else if (input.justPressed('Escape')) {
      world.resetRun();
      world.state = 'title';
    }
  }
}

function handleClicks() {
  for (const click of input.takeClicks()) {
    sfx.unlock();
    for (const b of renderer.buttons) {
      if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
        onButton(b.id);
        break;
      }
    }
  }
}

let last = performance.now();
let acc = 0;

function frame(now) {
  const delta = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (input.anyGesture) sfx.unlock();
  handleKeys();
  handleClicks();
  acc += delta;
  while (acc >= STEP) {
    world.update(STEP, input);
    acc -= STEP;
  }
  renderer.draw(world, input);
  announce();
  input.endFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// A live handle on the game, for tooling (the screenshot harness steers
// by it and the finalist review can see the state); play never reads it.
window.NEON_HARVEST = world;
