// Ashen Crown — пошаговый боевой движок (общий для клиента и сервера).
// Детерминирован: один seed => один и тот же бой. Developer: @yfeeeee
import { RNG } from './rng.js';
import { SKILLS } from './data.js';

export const GAUGE = 1000;
const DOTS = new Set(['burn', 'poison', 'bleed']);

/**
 * def юнита: { id, name, emoji, level, stats:{hp,atk,def,spd,crit,critDmg,dodge,lifesteal},
 *              skills:[id], perks:[id], hero?, boss?, color? }
 */
export class Battle {
  constructor({ heroes, waves, seed = 1, maxTurns = 400, maxHeroTurns = Infinity, potions = 0 }) {
    this.rng = new RNG(seed);
    this.events = [];
    this.turn = 0;
    this.heroTurns = 0;
    this.maxTurns = maxTurns;
    this.maxHeroTurns = maxHeroTurns;
    this.potions = potions;
    this.potionsUsed = 0;
    this.over = false;
    this.win = null;
    this.current = null;
    this.waves = waves;
    this.waveIdx = -1;
    this.heroes = heroes.map((d) => this._spawn(d, 'A'));
    this.enemies = [];
    for (const h of this.heroes) {
      if (h.perks.includes('bulwark')) {
        h.shield = Math.round(h.maxHp * 0.2);
        h.shieldT = 99;
      }
    }
    this._nextWave();
  }

  // ------------------------------------------------------------ юниты
  _spawn(def, team) {
    const s = def.stats;
    return {
      id: def.id, name: def.name, emoji: def.emoji, color: def.color || null,
      team, level: def.level || 1, hero: !!def.hero, boss: !!def.boss,
      maxHp: Math.max(1, Math.round(s.hp)), hp: Math.max(1, Math.round(s.hp)),
      base: { atk: s.atk, def: s.def, spd: Math.max(10, s.spd) },
      crit: s.crit || 0, critDmg: s.critDmg || 1.5, dodge: s.dodge || 0, lifesteal: s.lifesteal || 0,
      skills: (def.skills || []).slice(), cds: {}, fx: [],
      shield: 0, shieldT: 0, gauge: Math.floor(this.rng.range(0, 250)),
      alive: true, perks: (def.perks || []).slice(), stacks: 0, kills: 0,
      dealt: 0, taken: 0, revived: false, enraged: false,
    };
  }

  all() { return this.heroes.concat(this.enemies); }
  foesOf(u) { return (u.team === 'A' ? this.enemies : this.heroes).filter((x) => x.alive); }
  unit(id) { return this.all().find((u) => u.id === id); }
  has(u, st) { return u.fx.some((f) => f.st === st); }

  atk(u) {
    let v = u.base.atk;
    if (this.has(u, 'weaken')) v *= 0.75;
    if (this.has(u, 'enrage') || u.enraged) v *= 1.3;
    if (u.stacks) v *= 1 + 0.06 * u.stacks;
    return v;
  }
  def(u) { return u.base.def * (this.has(u, 'armor') ? 1.4 : 1); }
  spd(u) {
    let v = u.base.spd;
    if (this.has(u, 'slow')) v *= 0.7;
    if (this.has(u, 'haste')) v *= 1.3;
    if (u.team === 'B' && this.heroes.some((h) => h.alive && h.perks.includes('frostaura'))) v *= 0.9;
    return v;
  }
  dodge(u) { return Math.min(0.6, u.dodge + (this.has(u, 'evasion') ? 0.4 : 0)); }

  emit(e) { this.events.push(e); }
  drain() { const e = this.events; this.events = []; return e; }

  // ------------------------------------------------------------ волны
  _nextWave() {
    this.waveIdx++;
    const defs = this.waves[this.waveIdx];
    this.enemies = defs.map((d) => this._spawn(d, 'B'));
    this.emit({ k: 'wave', n: this.waveIdx + 1, of: this.waves.length, units: this.enemies.map((u) => u.id) });
  }

  _checkEnd() {
    if (this.over) return true;
    if (!this.heroes.some((h) => h.alive)) return this._finish(false);
    if (!this.enemies.some((e) => e.alive)) {
      if (this.waveIdx + 1 < this.waves.length) { this._nextWave(); return false; }
      return this._finish(true);
    }
    if (this.turn >= this.maxTurns || this.heroTurns >= this.maxHeroTurns) return this._finish(false, true);
    return false;
  }

  _finish(win, timeout = false) {
    this.over = true;
    this.win = win;
    this.emit({ k: 'end', win, timeout });
    return true;
  }

  // ------------------------------------------------------------ ход
  /** Продвигает время до следующего хода. Возвращает юнит, который ходит, либо null (бой окончен). */
  next() {
    for (let guard = 0; guard < 100000; guard++) {
      if (this.over) return null;
      const alive = this.all().filter((u) => u.alive);
      let ready = null;
      for (const u of alive) {
        if (u.gauge >= GAUGE && (!ready || u.gauge > ready.gauge)) ready = u;
      }
      if (!ready) {
        let dt = Infinity;
        for (const u of alive) dt = Math.min(dt, (GAUGE - u.gauge) / this.spd(u));
        for (const u of alive) u.gauge += this.spd(u) * dt;
        continue;
      }
      ready.gauge -= GAUGE;
      this.turn++;
      if (!this._beginTurn(ready)) {
        if (this._checkEnd()) return null;
        continue;
      }
      if (this._checkEnd()) return null;
      this.current = ready;
      this.emit({ k: 'turn', u: ready.id });
      return ready;
    }
    throw new Error('battle loop guard');
  }

  _beginTurn(u) {
    for (const f of u.fx.slice()) {
      if (DOTS.has(f.st)) {
        const src = f.src ? this.unit(f.src) : null;
        this._hurt(u, Math.max(1, Math.round(f.pow)), src, { dot: f.st });
        if (!u.alive) return false;
      }
    }
    if (this.has(u, 'regen')) this._heal(u, Math.round(u.maxHp * 0.05), null);
    if (u.boss && !u.enraged && u.hp / u.maxHp < 0.3) {
      u.enraged = true;
      this.emit({ k: 'fx', t: u.id, st: 'enrage', add: true });
    }
    if (this.has(u, 'stun')) {
      this.emit({ k: 'stunned', u: u.id });
      this._endTurn(u);
      return false;
    }
    return true;
  }

  _endTurn(u) {
    for (const f of u.fx.slice()) {
      f.dur--;
      if (f.dur <= 0) {
        u.fx.splice(u.fx.indexOf(f), 1);
        if (f.st === 'stun') this._addFx(u, 'stunimm', 3, 0, null, true);
        if (!STATUS_HIDDEN(f.st)) this.emit({ k: 'fx', t: u.id, st: f.st, add: false });
      }
    }
    if (u.shield > 0) {
      u.shieldT--;
      if (u.shieldT <= 0) u.shield = 0;
    }
    for (const id of Object.keys(u.cds)) {
      if (u.cds[id] > 0) u.cds[id]--;
    }
  }

  _addFx(u, st, dur, pow = 0, src = null, silent = false) {
    const ex = u.fx.find((f) => f.st === st);
    if (ex) {
      ex.dur = Math.max(ex.dur, dur);
      ex.pow = Math.max(ex.pow, pow);
      return;
    }
    u.fx.push({ st, dur, pow, src });
    if (!silent && !STATUS_HIDDEN(st)) this.emit({ k: 'fx', t: u.id, st, add: true });
  }

  _applyFx(src, tgt, fx) {
    if (!tgt.alive || !this.rng.chance(fx.chance ?? 1)) return;
    let dur = fx.dur;
    if (fx.st === 'stun') {
      if (this.has(tgt, 'stunimm')) return;
      if (tgt.boss) { if (!this.rng.chance(0.4)) return; dur = 1; }
    }
    let pow = 0;
    const a = this.atk(src);
    if (fx.st === 'burn') pow = a * 0.35;
    else if (fx.st === 'bleed') pow = a * 0.4;
    else if (fx.st === 'poison') pow = Math.min(tgt.maxHp * 0.025, a * 0.5) + a * 0.15;
    this._addFx(tgt, fx.st, dur + (tgt === src ? 0 : 0), pow, src.id);
  }

  // ------------------------------------------------------------ урон и лечение
  _hurt(t, dmg, src, meta = {}) {
    if (!t.alive) return 0;
    let left = dmg;
    if (t.shield > 0) {
      const ab = Math.min(t.shield, left);
      t.shield -= ab;
      left -= ab;
    }
    t.hp -= left;
    t.taken += dmg;
    if (src && src !== t) src.dealt += dmg;
    this.emit({ k: 'dmg', s: src ? src.id : null, t: t.id, v: dmg, crit: !!meta.crit, dot: meta.dot || null, sk: meta.sk || null, hp: Math.max(0, t.hp), sh: t.shield });
    if (t.hp <= 0) {
      if (t.perks.includes('phoenix') && !t.revived) {
        t.revived = true;
        t.hp = Math.round(t.maxHp * 0.3);
        t.fx = t.fx.filter((f) => !['burn', 'poison', 'bleed', 'stun'].includes(f.st));
        this.emit({ k: 'revive', t: t.id, hp: t.hp });
        return dmg;
      }
      t.hp = 0;
      t.alive = false;
      this.emit({ k: 'die', t: t.id });
      if (src && src.alive && src !== t) {
        src.kills++;
        if (src.perks.includes('bloodlust') && src.stacks < 5) src.stacks++;
      }
    }
    return dmg;
  }

  _heal(u, amt, src) {
    if (!u.alive || amt <= 0) return 0;
    const real = Math.min(amt, u.maxHp - u.hp);
    if (real <= 0) return 0;
    u.hp += real;
    this.emit({ k: 'heal', t: u.id, v: real, hp: u.hp });
    return real;
  }

  _strike(u, t, sk, mult) {
    if (!t.alive) return;
    if (this.rng.chance(this.dodge(t))) {
      this.emit({ k: 'miss', s: u.id, t: t.id });
      return;
    }
    const critChance = u.crit + (sk.critBonus || 0);
    const crit = sk.forceCrit || this.rng.chance(critChance);
    let dmg = this.atk(u) * mult * this.rng.range(0.92, 1.08);
    const ignore = (sk.magic ? 0.4 : 0) + (sk.pierce || 0);
    const effDef = this.def(t) * Math.max(0, 1 - ignore);
    dmg *= 1 - effDef / (effDef + 50 + u.level * 14);
    if (crit) dmg *= u.critDmg;
    if (this.has(t, 'vuln')) dmg *= 1.25;
    if (sk.bonusLow && t.hp / t.maxHp < sk.bonusLow.below) dmg *= sk.bonusLow.mult;
    dmg = Math.max(1, Math.round(dmg));
    this._hurt(t, dmg, u, { crit, sk: sk.id });
    if (u.alive) {
      const ls = u.lifesteal + (sk.leech || 0);
      if (ls > 0) this._heal(u, Math.round(dmg * ls), u);
      if (t.perks.includes('thorns')) this._hurt(u, Math.max(1, Math.round(dmg * 0.15)), t, { dot: 'thorns' });
    }
    if (sk.fx) for (const fx of sk.fx) this._applyFx(u, t, fx);
  }

  // ------------------------------------------------------------ действия
  /** action: {type:'skill', skill, target} | {type:'potion'} */
  perform(action) {
    const u = this.current;
    if (!u || this.over) return;
    if (u.team === 'A') this.heroTurns++;

    if (action.type === 'potion' && u.team === 'A' && this.potionsUsed < this.potions) {
      this.potionsUsed++;
      this.emit({ k: 'potion', u: u.id });
      this._heal(u, Math.round(u.maxHp * 0.4), u);
    } else {
      let sk = SKILLS[action.skill] || SKILLS.attack;
      if (sk.id !== 'attack' && (!u.skills.includes(sk.id) || (u.cds[sk.id] || 0) > 0)) sk = SKILLS.attack;
      this._cast(u, sk, action.target);
    }
    this._endTurn(u);
    this.current = null;
    this._checkEnd();
  }

  _cast(u, sk, targetId) {
    const foes = this.foesOf(u);
    this.emit({ k: 'cast', u: u.id, sk: sk.id });
    if (sk.cd) u.cds[sk.id] = sk.cd;
    if (!foes.length && sk.tgt !== 'self') return;

    if (sk.tgt === 'self') {
      if (sk.heal) this._heal(u, Math.round(u.maxHp * sk.heal), u);
      if (sk.shield) {
        u.shield += Math.round(u.maxHp * sk.shield.pct);
        u.shieldT = sk.shield.dur;
        this.emit({ k: 'shield', t: u.id, sh: u.shield });
      }
    } else if (sk.tgt === 'all') {
      for (const t of foes) this._strike(u, t, sk, sk.mult);
    } else if (sk.tgt === 'random') {
      for (let i = 0; i < (sk.hits || 1); i++) {
        const alive = this.foesOf(u);
        if (!alive.length) break;
        this._strike(u, this.rng.pick(alive), sk, sk.mult);
      }
    } else {
      let t = targetId ? foes.find((x) => x.id === targetId) : null;
      if (!t) t = foes.reduce((a, b) => (a.hp <= b.hp ? a : b));
      this._strike(u, t, sk, sk.mult || 1);
    }
    if (sk.selfFx) for (const fx of sk.selfFx) this._addFx(u, fx.st, fx.dur, 0, u.id);
  }

  // ------------------------------------------------------------ ИИ
  autoAction(u) {
    const foes = this.foesOf(u);
    if (!foes.length) return { type: 'skill', skill: 'attack' };
    const lowest = foes.reduce((a, b) => (a.hp <= b.hp ? a : b));
    const ready = u.skills.filter((id) => !(u.cds[id] > 0)).map((id) => SKILLS[id]);

    if (!u.hero) {
      const pool = ready.filter((s) => !(s.tgt === 'self' && s.heal && u.hp / u.maxHp > 0.7));
      if (pool.length && this.rng.chance(0.6)) {
        return { type: 'skill', skill: this.rng.pick(pool).id, target: this.rng.pick(foes).id };
      }
      return { type: 'skill', skill: 'attack', target: this.rng.pick(foes).id };
    }

    const hpFrac = u.hp / u.maxHp;
    if (hpFrac < 0.35 && this.potionsUsed < this.potions) return { type: 'potion' };
    let best = null;
    let bestScore = 0;
    for (const s of ready) {
      let score = 0;
      if (s.tgt === 'self') {
        if (s.heal) score += hpFrac < 0.6 ? 6 : 0;
        if (s.shield) score += u.shield <= 0 && hpFrac < 0.85 ? 4 : 0;
        if (s.selfFx) {
          const fresh = s.selfFx.some((f) => !this.has(u, f.st));
          score += fresh ? 2.5 : 0;
        }
      } else {
        const hits = s.tgt === 'all' ? Math.max(1, foes.length) * 0.85 : (s.hits || 1);
        score = (s.mult || 1) * hits;
        if (s.bonusLow && lowest.hp / lowest.maxHp < s.bonusLow.below) score *= s.bonusLow.mult;
        if (s.fx) score *= 1.1;
      }
      if (score > bestScore) { bestScore = score; best = s; }
    }
    if (best) return { type: 'skill', skill: best.id, target: lowest.id };
    return { type: 'skill', skill: 'attack', target: lowest.id };
  }
}

function STATUS_HIDDEN(st) { return st === 'stunimm'; }

/** Полная авто-симуляция. Возвращает итог и (по желанию) лог событий. */
export function simulate(setup, { log = false } = {}) {
  const b = new Battle(setup);
  const events = [];
  let u;
  while ((u = b.next())) {
    b.perform(b.autoAction(u));
    if (log) events.push(...b.drain()); else b.drain();
  }
  if (log) events.push(...b.drain());
  return {
    win: !!b.win, turns: b.turn, heroTurns: b.heroTurns, events,
    heroes: b.heroes.map((h) => ({ id: h.id, hp: h.hp, maxHp: h.maxHp, dealt: h.dealt, taken: h.taken, alive: h.alive })),
    enemies: b.enemies.map((e) => ({ id: e.id, hp: e.hp, maxHp: e.maxHp, alive: e.alive })),
    waveIdx: b.waveIdx,
  };
}
