// Ashen Crown — экран боя: canvas-рендер, управление, реплеи. Developer: @yfeeeee
import { Battle } from '../shared/engine.js';
import { SKILLS, STATUS } from '../shared/data.js';
import { h, sleep, fmt, confirmDialog } from './ui.js';
import { sfx, buzz } from './audio.js';
import { S, persist } from './state.js';

const DOT_COLORS = { burn: '#fb923c', poison: '#a3e635', bleed: '#ef4444', thorns: '#94a3b8' };

export function unitInfo(u) {
  return { id: u.id, name: u.name, emoji: u.emoji, color: u.color, maxHp: u.maxHp, team: u.team, boss: u.boss, hero: u.hero, level: u.level };
}

// ================================================================= вид (canvas)
export class BattleView {
  constructor(canvas, theme) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = theme || { bg: ['#1b2238', '#080b14'] };
    this.units = new Map();
    this.catalog = new Map();
    this.floats = [];
    this.parts = [];
    this.speed = 1;
    this.vt = 0; // виртуальное время (мс), ускоряется вместе с боем
    this.last = performance.now();
    this.selected = null;
    this.active = null;
    this.shake = 0;
    this.wave = { n: 1, of: 1 };
    this.alive = true;
    this.onWaveLabel = null;
    this._resize = () => this.resize();
    window.addEventListener('resize', this._resize);
    this.resize();
    canvas.addEventListener('pointerdown', (e) => this.tap(e));
    const loop = (now) => {
      if (!this.alive) return;
      const dt = Math.min(64, now - this.last);
      this.last = now;
      this.vt += dt * this.speed;
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._resize);
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || 360;
    const hgt = this.canvas.clientHeight || 300;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(hgt * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = w; this.H = hgt;
  }

  // ---------------------------------------------------------- юниты
  addUnit(info) {
    if (this.units.has(info.id)) this.units.delete(info.id);
    this.units.set(info.id, {
      info, hp: info.maxHp, maxHp: info.maxHp, shield: 0, alive: true, alpha: 1, ox: 0, oy: 0,
      flash: 0, flashT: -1e9, lungeT: -1e9, fx: new Map(), appearT: this.vt, x: 0, y: 0,
    });
  }

  clearTeam(team) {
    for (const [id, u] of this.units) if (u.info.team === team) this.units.delete(id);
  }

  team(team) { return [...this.units.values()].filter((u) => u.info.team === team); }

  layout(u) {
    const list = this.team(u.info.team);
    const i = list.indexOf(u);
    const n = list.length;
    if (u.info.team === 'A') {
      const ys = n === 1 ? [0.62] : [0.4, 0.78, 0.2];
      return { x: this.W * 0.2 + (i % 2) * this.W * 0.04, y: this.H * (ys[i] ?? 0.6) };
    }
    const sets = { 1: [0.58], 2: [0.4, 0.76], 3: [0.28, 0.56, 0.84], 4: [0.2, 0.42, 0.64, 0.86] };
    const ys = sets[Math.min(4, n)] || [0.5];
    return { x: this.W * (n === 1 ? 0.74 : 0.72 + (i % 2) * 0.07), y: this.H * ys[i % ys.length] };
  }

  size(u) {
    const base = Math.min(this.W * 0.2, this.H * 0.24);
    return base * (u.info.boss ? 1.45 : 1);
  }

  tap(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left; const y = e.clientY - r.top;
    for (const u of this.team('B')) {
      if (!u.alive) continue;
      const s = this.size(u);
      if (Math.hypot(x - u.x, y - u.y) < s * 0.7) { this.selected = u.info.id; sfx('click'); return; }
    }
  }

  // ---------------------------------------------------------- события
  async play(events) {
    for (const e of events) {
      if (!this.alive) return;
      const wait = this.handle(e);
      if (wait > 0) await sleep(wait / this.speed);
    }
  }

  float(u, text, color = '#fff', size = 20, life = 900) {
    this.floats.push({ x: u.x + (Math.random() - 0.5) * 24, y: u.y - this.size(u) * 0.55, text, color, size, t0: this.vt, life });
  }

  burst(u, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const sp = 40 + Math.random() * 120;
      this.parts.push({ x: u.x, y: u.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, color, t0: this.vt, life: 450 + Math.random() * 250 });
    }
  }

  handle(e) {
    const U = (id) => this.units.get(id);
    switch (e.k) {
      case 'wave': {
        this.wave = { n: e.n, of: e.of };
        if (this.onWaveLabel) this.onWaveLabel(e.n, e.of);
        this.clearTeam('B');
        for (const id of e.units) {
          const info = this.catalog.get(id);
          if (info) this.addUnit(info);
        }
        this.selected = null;
        return e.n > 1 ? 450 : 0;
      }
      case 'turn': this.active = e.u; return 40;
      case 'cast': {
        const u = U(e.u);
        if (!u) return 0;
        u.lungeT = this.vt;
        const sk = SKILLS[e.sk];
        if (sk && sk.id !== 'attack') this.float(u, `${sk.icon} ${sk.name}`, u.info.team === 'A' ? '#fde68a' : '#fca5a5', 15, 1100);
        sfx(sk && sk.tgt === 'self' ? 'cast' : 'hit');
        return 230;
      }
      case 'dmg': {
        const t = U(e.t);
        if (!t) return 0;
        t.hp = e.hp; t.shield = e.sh || 0;
        t.flashT = this.vt;
        if (e.dot) {
          this.float(t, `-${fmt(e.v)}`, DOT_COLORS[e.dot] || '#fca5a5', 15);
          return 130;
        }
        this.float(t, `${e.crit ? '💥' : ''}-${fmt(e.v)}`, e.crit ? '#fde047' : t.info.team === 'A' ? '#fb7185' : '#fff', e.crit ? 28 : 21);
        this.burst(t, e.crit ? '#fde047' : '#ffffff', e.crit ? 14 : 7);
        this.shake = e.crit ? 7 : 3;
        sfx(e.crit ? 'crit' : 'hit');
        buzz(e.crit ? 35 : 12);
        return 170;
      }
      case 'miss': {
        const t = U(e.t);
        if (t) this.float(t, 'Мимо', '#93c5fd', 17);
        sfx('miss');
        return 130;
      }
      case 'heal': {
        const t = U(e.t);
        if (t) { t.hp = e.hp; this.float(t, `+${fmt(e.v)}`, '#4ade80', 20); this.burst(t, '#4ade80', 6); }
        sfx('heal');
        return 150;
      }
      case 'shield': {
        const t = U(e.t);
        if (t) { t.shield = e.sh; this.float(t, `🔰 ${fmt(e.sh)}`, '#93c5fd', 18); }
        return 120;
      }
      case 'potion': { const u = U(e.u); if (u) this.float(u, '🧪', '#fff', 24); return 120; }
      case 'die': {
        const t = U(e.t);
        if (t) { t.alive = false; t.hp = 0; t.dieT = this.vt; this.burst(t, '#94a3b8', 12); }
        sfx('die');
        return 300;
      }
      case 'revive': {
        const t = U(e.t);
        if (t) { t.hp = e.hp; t.alive = true; t.alpha = 1; t.flashT = this.vt; this.float(t, '🔥 Возрождение', '#fbbf24', 20, 1200); }
        return 400;
      }
      case 'fx': {
        const t = U(e.t);
        if (t) { if (e.add) t.fx.set(e.st, true); else t.fx.delete(e.st); }
        return 0;
      }
      case 'stunned': { const u = U(e.u); if (u) this.float(u, '💫 Оглушён', '#fde68a', 16); return 260; }
      case 'end': return 350;
      default: return 0;
    }
  }

  // ---------------------------------------------------------- рисование
  draw() {
    const { ctx, W, H } = this;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, this.theme.bg[0]);
    g.addColorStop(1, this.theme.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // пол
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(0, H * 0.78, W, H * 0.22);
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    ctx.beginPath(); ctx.moveTo(0, H * 0.78); ctx.lineTo(W, H * 0.78); ctx.stroke();

    ctx.save();
    if (this.shake > 0.2) { ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake); this.shake *= 0.86; }

    const all = [...this.units.values()];
    for (const u of all) {
      const p = this.layout(u);
      u.x = p.x; u.y = p.y;
      // затухание мёртвых
      if (!u.alive) u.alpha = Math.max(0, 1 - (this.vt - (u.dieT || 0)) / 500);
    }
    all.sort((a, b) => a.y - b.y);
    for (const u of all) if (u.alpha > 0.01) this.drawUnit(u);
    this.drawParts();
    this.drawFloats();
    ctx.restore();
  }

  drawUnit(u) {
    const { ctx } = this;
    const s = this.size(u);
    const t = this.vt;
    const dir = u.info.team === 'A' ? 1 : -1;
    const lt = (t - u.lungeT) / 230;
    const lunge = lt >= 0 && lt <= 1 ? Math.sin(lt * Math.PI) * 38 * dir : 0;
    const bob = Math.sin(t / 380 + u.x) * 3;
    const appear = Math.min(1, (t - u.appearT) / 300);
    const x = u.x + lunge;
    const y = u.y + bob + (1 - appear) * -30;

    ctx.globalAlpha = u.alpha * appear;
    // тень
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(u.x, u.y + s * 0.45, s * 0.42, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();

    // активный юнит — кольцо
    if (this.active === u.info.id && u.alive) {
      ctx.strokeStyle = u.info.team === 'A' ? 'rgba(250,204,21,.8)' : 'rgba(248,113,113,.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(u.x, u.y + s * 0.45, s * 0.52, s * 0.17, 0, 0, Math.PI * 2); ctx.stroke();
    }

    const flash = Math.max(0, 1 - (t - u.flashT) / 220);
    ctx.font = `${Math.round(s)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (u.info.team === 'B') { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.translate(-x, -y); }
    if (flash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 24 * flash; }
    ctx.fillText(u.info.emoji, x, y);
    ctx.shadowBlur = 0;
    if (u.info.team === 'B') ctx.restore();

    // полоса HP
    const bw = Math.max(54, s * 0.95);
    const bx = x - bw / 2; const by = y + s * 0.62;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 9);
    const hp = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = u.info.team === 'A' ? (hp < 0.3 ? '#f87171' : '#4ade80') : '#ef4444';
    ctx.fillRect(bx, by, bw * Math.min(1, hp), 7);
    if (u.shield > 0) { ctx.fillStyle = 'rgba(147,197,253,.9)'; ctx.fillRect(bx, by - 3, bw * Math.min(1, u.shield / u.maxHp), 3); }
    ctx.font = '600 11px system-ui,sans-serif';
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText(u.info.name.length > 16 ? `${u.info.name.slice(0, 15)}…` : u.info.name, x, by + 19);
    if (u.maxHp < 1e9) {
      ctx.font = '10px system-ui,sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillText(`${fmt(Math.max(0, u.hp))}/${fmt(u.maxHp)}`, x, by + 3.5);
    }

    // статусы
    if (u.fx.size) {
      ctx.font = '13px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
      let i = 0;
      for (const st of u.fx.keys()) {
        const d = STATUS[st];
        if (d) ctx.fillText(d.icon, x - (u.fx.size - 1) * 7 + i * 14, by + 33);
        i++;
      }
    }

    // цель
    if (this.selected === u.info.id && u.alive) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      const ty = y - s * 0.62 + Math.sin(t / 150) * 3;
      ctx.moveTo(x, ty + 10); ctx.lineTo(x - 8, ty - 4); ctx.lineTo(x + 8, ty - 4); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFloats() {
    const { ctx } = this;
    ctx.textAlign = 'center';
    this.floats = this.floats.filter((f) => this.vt - f.t0 < f.life);
    for (const f of this.floats) {
      const k = (this.vt - f.t0) / f.life;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.font = `800 ${f.size}px system-ui,sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      const y = f.y - k * 46;
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;
  }

  drawParts() {
    const { ctx } = this;
    this.parts = this.parts.filter((p) => this.vt - p.t0 < p.life);
    for (const p of this.parts) {
      const k = (this.vt - p.t0) / 1000;
      ctx.globalAlpha = Math.max(0, 1 - (this.vt - p.t0) / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x + p.vx * k, p.y + p.vy * k + 120 * k * k, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ================================================================= оверлей боя
function overlay(title) {
  const canvas = h('canvas', { class: 'battle-canvas' });
  const waveLabel = h('div', { class: 'battle-wave' }, 'Волна 1');
  const controls = h('div', { class: 'battle-controls' });
  const root = h('div', { class: 'battle' },
    h('div', { class: 'battle-top' }, h('div', { class: 'battle-title' }, title), waveLabel),
    canvas, controls);
  document.body.appendChild(root);
  return { root, canvas, waveLabel, controls };
}

/**
 * Живой бой с управлением.
 * opts: {title, theme, battle: Battle, potions, onFinish?}
 * Возвращает Promise<{win, fled, kills, skills, crits, close}>
 */
export function runBattle({ title, theme, battle, canFlee = true }) {
  return new Promise((resolve) => {
    const ui = overlay(title);
    const view = new BattleView(ui.canvas, theme);
    view.speed = S.save.settings.speed || 1;
    view.onWaveLabel = (n, of) => { ui.waveLabel.textContent = `Волна ${n}/${of}`; };
    let aborted = false;
    let waiter = null;
    let auto = !!S.save.settings.auto;
    const stats = { kills: 0, skills: 0, crits: 0 };

    const registerCatalog = () => { for (const u of battle.all()) view.catalog.set(u.id, unitInfo(u)); };
    const close = () => { aborted = true; view.destroy(); ui.root.remove(); };

    // ---- кнопки
    const hero = battle.heroes[0];
    const btns = new Map();
    const skillBtn = (id) => {
      const sk = id === 'attack' ? SKILLS.attack : SKILLS[id];
      const cd = h('div', { class: 'cd' });
      const b = h('button', { class: 'skill', title: sk.desc || '', on: { click: () => choose({ type: 'skill', skill: id, target: view.selected }) } },
        h('div', { class: 'skill-ico' }, sk.icon), h('div', { class: 'skill-name' }, sk.name), cd);
      btns.set(id, { b, cd });
      return b;
    };
    const skillRow = h('div', { class: 'skill-row' }, skillBtn('attack'), hero.skills.map((id) => skillBtn(id)));
    const potionBtn = h('button', { class: 'btn small', on: { click: () => choose({ type: 'potion' }) } });
    const autoBtn = h('button', { class: `btn small ${auto ? 'primary' : ''}`, on: { click: () => {
      auto = !auto; S.save.settings.auto = auto; persist({ sync: false });
      autoBtn.classList.toggle('primary', auto); autoBtn.textContent = auto ? 'Авто: ВКЛ' : 'Авто: выкл';
      if (auto && waiter) choose(battle.autoAction(hero));
    } } }, auto ? 'Авто: ВКЛ' : 'Авто: выкл');
    const speedBtn = h('button', { class: 'btn small', on: { click: () => {
      const next = { 1: 2, 2: 3, 3: 1 }[view.speed] || 1;
      view.speed = next; S.save.settings.speed = next; persist({ sync: false }); speedBtn.textContent = `Скорость ×${next}`;
    } } }, `Скорость ×${view.speed}`);
    const fleeBtn = canFlee ? h('button', { class: 'btn small danger', on: { click: async () => {
      if (await confirmDialog('Сбежать из боя? Победа не засчитается.')) { aborted = true; finish(false, true); }
    } } }, 'Бежать') : null;
    ui.controls.append(
      h('div', { class: 'hint' }, 'Нажмите на врага, чтобы выбрать цель'),
      skillRow,
      h('div', { class: 'ctl-row' }, potionBtn, autoBtn, speedBtn, fleeBtn));

    function refreshButtons(enabled) {
      for (const [id, { b, cd }] of btns) {
        const left = id === 'attack' ? 0 : (hero.cds[id] || 0);
        cd.textContent = left > 0 ? left : '';
        b.disabled = !enabled || left > 0;
        b.classList.toggle('ready', enabled && left === 0 && id !== 'attack');
      }
      potionBtn.textContent = `🧪 Зелье ×${Math.max(0, battle.potions - battle.potionsUsed)}`;
      potionBtn.disabled = !enabled || battle.potions - battle.potionsUsed <= 0 || hero.hp >= hero.maxHp;
    }

    function choose(action) {
      if (!waiter) return;
      if (action.type === 'skill' && action.target) {
        const t = battle.unit(action.target);
        if (!t || !t.alive || t.team !== 'B') action.target = undefined;
      }
      const w = waiter; waiter = null;
      w(action);
    }

    function tally(events) {
      for (const e of events) {
        if (e.k === 'die') { const ci = view.catalog.get(e.t); if (ci && ci.team === 'B') stats.kills++; }
        if (e.k === 'cast' && e.u === hero.id && e.sk !== 'attack') stats.skills++;
        if (e.k === 'dmg' && e.crit && e.s === hero.id) stats.crits++;
      }
    }

    async function pump() {
      const ev = battle.drain();
      tally(ev);
      registerCatalog();
      await view.play(ev);
    }

    function finish(win, fled = false) {
      sfx(win ? 'win' : 'lose');
      resolve({ win, fled, ...stats, close, view });
    }

    (async () => {
      registerCatalog();
      for (const hu of battle.heroes) view.addUnit(unitInfo(hu));
      await pump();
      while (!aborted) {
        refreshButtons(false);
        const u = battle.next();
        await pump();
        if (aborted) return;
        if (!u) break;
        let action;
        if (u.team === 'A') {
          if (auto) { await sleep(120 / view.speed); action = battle.autoAction(u); }
          else {
            refreshButtons(true);
            if (!view.selected || !battle.unit(view.selected) || !battle.unit(view.selected).alive) {
              const foes = battle.foesOf(u);
              view.selected = foes.length ? foes.reduce((a, b) => (a.hp <= b.hp ? a : b)).id : null;
            }
            action = await new Promise((r) => { waiter = r; });
            if (aborted) return;
          }
        } else {
          action = battle.autoAction(u);
        }
        battle.perform(action);
        await pump();
        view.active = null;
      }
      if (aborted) return;
      finish(!!battle.win);
    })();
  });
}

/** Реплей записанного боя (арена, мировой босс). Возвращает {close} после окончания. */
export function runReplay({ title, theme, units, events }) {
  return new Promise((resolve) => {
    const ui = overlay(title);
    const view = new BattleView(ui.canvas, theme);
    view.onWaveLabel = () => {};
    ui.waveLabel.textContent = 'Повтор боя';
    for (const u of units) { view.catalog.set(u.id, u); if (u.team === 'A') view.addUnit(u); }
    let cancelled = false;
    const close = () => { cancelled = true; view.destroy(); ui.root.remove(); };
    const speedBtn = h('button', { class: 'btn small', on: { click: () => {
      view.speed = { 1: 2, 2: 4, 4: 8, 8: 1 }[view.speed] || 1; speedBtn.textContent = `Скорость ×${view.speed}`;
    } } }, 'Скорость ×1');
    const skipBtn = h('button', { class: 'btn small danger', on: { click: () => { view.speed = 16; } } }, 'Пропустить');
    ui.controls.append(h('div', { class: 'ctl-row' }, speedBtn, skipBtn));
    (async () => {
      await view.play(events);
      if (!cancelled) { await sleep(300); resolve({ close }); }
    })();
  });
}

export function makeBattle(heroUnits, waves, seed, potions) {
  return new Battle({ heroes: heroUnits, waves, seed, potions });
}
