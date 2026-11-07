// Ashen Crown — синтезированные звуки (без файлов) и вибрация. Developer: @yfeeeee
import { S } from './state.js';

let ctx;
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'square', vol = 0.06, slide = 0, delay = 0 } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const SOUNDS = {
  click: () => tone(520, 0.05, { type: 'triangle', vol: 0.04 }),
  hit: () => tone(180, 0.1, { type: 'sawtooth', slide: -90 }),
  crit: () => { tone(320, 0.12, { type: 'sawtooth', slide: -150, vol: 0.08 }); tone(900, 0.08, { vol: 0.04, delay: 0.02 }); },
  miss: () => tone(700, 0.08, { type: 'sine', slide: 200, vol: 0.03 }),
  heal: () => { tone(500, 0.1, { type: 'sine' }); tone(750, 0.14, { type: 'sine', delay: 0.08 }); },
  cast: () => tone(300, 0.15, { type: 'triangle', slide: 300 }),
  die: () => tone(220, 0.3, { type: 'sawtooth', slide: -170 }),
  coin: () => { tone(988, 0.06, { vol: 0.05 }); tone(1319, 0.12, { vol: 0.05, delay: 0.06 }); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', delay: i * 0.11, vol: 0.07 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, { type: 'sawtooth', delay: i * 0.15, vol: 0.05 })),
  level: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'square', delay: i * 0.08, vol: 0.06 })),
  buy: () => tone(660, 0.08, { type: 'triangle' }),
  error: () => tone(160, 0.18, { type: 'square', vol: 0.05 }),
};

export function sfx(name) {
  if (!S.save || !S.save.settings.sound) return;
  try { (SOUNDS[name] || SOUNDS.click)(); } catch { /* аудио недоступно */ }
}

export function buzz(ms = 20) {
  if (!S.save || !S.save.settings.vibrate) return;
  try { navigator.vibrate && navigator.vibrate(ms); } catch { /* нет вибрации */ }
}
