// Neon Harvest — sound: every effect is a WebAudio oscillator shaped in
// code. No audio files, nothing to load. The context is created lazily on
// the first user gesture, as browsers require, and every call is safe to
// make before that (it simply stays silent).

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  // Call from any click or key press: wakes the audio context up.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.35;
  }

  // One shaped tone: freq slides to freqEnd over dur seconds.
  tone(freq, freqEnd, dur, type = 'square', gain = 0.5, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freq), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + dur);
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  click() {
    this.tone(660, 520, 0.06, 'square', 0.25);
  }

  // Pickup blip: the pitch climbs with the combo multiplier.
  pickup(multiplier) {
    const base = 480 + multiplier * 60;
    this.tone(base, base * 1.5, 0.09, 'square', 0.32);
    this.tone(base * 2, base * 2.4, 0.07, 'sine', 0.18, 0.02);
  }

  damage() {
    this.tone(220, 55, 0.28, 'sawtooth', 0.5);
    this.tone(140, 40, 0.32, 'square', 0.3, 0.03);
  }

  orbLost() {
    this.tone(320, 210, 0.08, 'sine', 0.10);
  }

  waveClear() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this.tone(n, n, 0.16, 'square', 0.3, i * 0.09));
  }

  waveFail() {
    const notes = [392, 330, 262, 196];
    notes.forEach((n, i) => this.tone(n, n * 0.94, 0.2, 'triangle', 0.32, i * 0.11));
  }

  win() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((n, i) => this.tone(n, n, 0.18, 'square', 0.3, i * 0.1));
  }

  start() {
    this.tone(392, 392, 0.09, 'square', 0.25);
    this.tone(587, 587, 0.12, 'square', 0.25, 0.09);
  }
}
