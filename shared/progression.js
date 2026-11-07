// Ashen Crown — статистика героя, этапы, награды. Developer: @yfeeeee
import {
  CLASSES, CLASS_SKILLS, SKILLS, TALENTS, SPIRITS, ROLES, CHAPTERS, STAGES_PER_CHAPTER,
  TOTAL_STAGES, MAX_LEVEL, SLOTS, WORLD_BOSS, TOWER_THEME,
} from './data.js';
import { itemBonuses } from './items.js';

/** Параметры баланса монстров (подбираются tools/balance.js) */
export const TUNE = { hp: 1.0, atk: 1.0, def: 1.0 };

export const xpToNext = (level) => Math.round(45 * level ** 1.6);

export function newSave(name, cls, now = Date.now()) {
  return {
    v: 1, name, cls, level: 1, xp: 0, gold: 300, gems: 60, dust: 20, potions: 3, chestKeys: 0,
    talentPts: 0, talents: {},
    equip: { weapon: null, helm: null, armor: null, ring: null, amulet: null },
    bag: [], nextId: 1,
    stage: 0, tower: 0,
    arena: { rating: 1000, wins: 0, losses: 0, day: '', fights: 0 },
    world: { week: '', dmg: 0, day: '', fights: 0 },
    quests: { day: '', prog: {}, claimed: {}, bonus: false },
    ach: {}, login: { day: '', streak: 0 },
    shop: { day: '', bought: {} },
    idle: { t: now },
    spirits: {}, spirit: null, pity: { gold: 0, spirit: 0 },
    settings: { auto: false, speed: 1, sound: true, vibrate: true, autoSalvage: -1 },
    stats: { kills: 0, wins: 0, losses: 0, bosses: 0, goldEarned: 0, bestEnh: 0, legendaries: 0, worldDmg: 0, battles: 0 },
    created: now, updated: now,
  };
}

export function unlockedSkills(cls, level) {
  return CLASS_SKILLS[cls].filter((id) => SKILLS[id].unlock <= level);
}

// ---------------------------------------------------------------- статы героя
export function heroStats(save) {
  const c = CLASSES[save.cls];
  const l = save.level - 1;
  const flat = {
    hp: c.base.hp + c.grow.hp * l,
    atk: c.base.atk + c.grow.atk * l,
    def: c.base.def + c.grow.def * l,
    spd: c.base.spd + c.grow.spd * l,
  };
  const pct = {};
  const add = (k, v) => { pct[k] = (pct[k] || 0) + v; };
  const perks = new Set();

  for (const slot of SLOTS) {
    const it = save.equip[slot];
    if (!it) continue;
    const b = itemBonuses(it);
    for (const [k, v] of Object.entries(b.flat)) flat[k] = (flat[k] || 0) + v;
    for (const [k, v] of Object.entries(b.pct)) add(k, v);
    if (it.perk) perks.add(it.perk);
  }
  for (const t of TALENTS) {
    const r = save.talents[t.id] || 0;
    if (!r) continue;
    add(t.stat, t.per * r);
    if (t.extra) for (const [k, v] of Object.entries(t.extra)) add(k, v * r);
  }
  if (save.spirit && save.spirits[save.spirit]) {
    const sp = SPIRITS.find((s) => s.id === save.spirit);
    if (sp) add(sp.stat, sp.per * save.spirits[save.spirit].lvl);
  }
  if (perks.has('fortune')) { add('goldPct', 0.15); add('xpPct', 0.15); }

  const p = (k) => pct[k] || 0;
  const stats = {
    hp: flat.hp * (1 + p('hpPct')),
    atk: flat.atk * (1 + p('atkPct')),
    def: flat.def * (1 + p('defPct')),
    spd: flat.spd * (1 + p('spdPct')),
    crit: Math.min(0.75, c.base.crit + p('crit')),
    critDmg: Math.min(4, c.base.critDmg + p('critDmg')),
    dodge: Math.min(0.5, c.base.dodge + p('dodge')),
    lifesteal: Math.min(0.3, p('lifesteal')),
  };
  for (const k of ['hp', 'atk', 'def', 'spd']) stats[k] = Math.round(stats[k]);
  stats.goldPct = p('goldPct');
  stats.xpPct = p('xpPct');
  stats.dropPct = p('dropPct');
  stats.perks = [...perks];
  stats.power = powerOf(stats);
  return stats;
}

export function powerOf(s) {
  return Math.round(s.hp * 0.18 + s.atk * 2.2 + s.def * 1.6 + s.spd + s.crit * 400 + s.critDmg * 60 + s.dodge * 300 + s.lifesteal * 600);
}

export function heroUnit(save, id = 'hero') {
  const st = heroStats(save);
  const c = CLASSES[save.cls];
  return {
    id, name: save.name, emoji: c.icon, color: c.color, level: save.level, hero: true,
    stats: st, skills: unlockedSkills(save.cls, save.level), perks: st.perks,
  };
}

/** Сколько силы даст замена предмета в слоте (для стрелок «лучше/хуже») */
export function powerWith(save, item) {
  const prev = save.equip[item.slot];
  save.equip[item.slot] = item;
  const p = heroStats(save).power;
  save.equip[item.slot] = prev;
  return p;
}

// ---------------------------------------------------------------- монстры и этапы
export function monsterStats(level, role, { boss = false, mult = 1 } = {}) {
  const r = ROLES[role];
  const b = boss ? { hp: 5, atk: 1.4, def: 1.15 } : { hp: 1, atk: 1, def: 1 };
  const late = (level / 60) ** 3;
  return {
    hp: (20 + 14 * level ** 1.5) * r.hp * b.hp * (1 + 0.5 * late) * TUNE.hp * mult,
    atk: (5 + 0.33 * level ** 2.1) * r.atk * b.atk * (1 + 0.8 * late) * TUNE.atk * mult,
    def: (3 + 4.3 * level ** 1.15) * r.def * b.def * TUNE.def * mult,
    spd: (92 + 0.25 * level) * r.spd,
    crit: 0.05, critDmg: 1.5, dodge: role === 'fast' ? 0.06 : 0.02, lifesteal: 0,
  };
}

export function stageInfo(idx) {
  idx = Math.max(1, Math.min(TOTAL_STAGES, idx));
  const chapter = Math.ceil(idx / STAGES_PER_CHAPTER);
  const stage = ((idx - 1) % STAGES_PER_CHAPTER) + 1;
  return {
    idx, chapter, stage, boss: stage === STAGES_PER_CHAPTER,
    level: Math.max(1, Math.round(1 + (idx - 1) * 0.72)),
    data: CHAPTERS[chapter - 1],
  };
}

function mob(rng, tpl, level, uid, opts = {}) {
  return {
    id: uid, name: tpl.n, emoji: tpl.e, level, boss: !!opts.boss,
    stats: monsterStats(level, tpl.role || 'bruiser', opts),
    skills: tpl.sk.slice(),
  };
}

export function buildStageWaves(idx, rng) {
  const info = stageInfo(idx);
  const { data, level, stage } = info;
  const pickMobs = (n, tag) => Array.from({ length: n }, (_, i) => mob(rng, rng.pick(data.monsters), level, `${tag}${i}`));
  if (info.boss) {
    const bt = { ...data.boss, role: 'bruiser' };
    return [pickMobs(2, 'a'), [mob(rng, bt, level, 'boss', { boss: true })].concat(pickMobs(1, 'm'))];
  }
  const sizes = stage <= 3 ? [1, 2, 2] : stage <= 7 ? [2, 2, 3] : [2, 3, 3];
  return sizes.map((n, w) => pickMobs(n, `w${w}_`));
}

export function towerLevel(floor) { return Math.round(10 + floor * 1.15); }

export function buildTowerWaves(floor, rng) {
  const level = towerLevel(floor);
  const data = CHAPTERS[Math.floor((floor - 1) / 5) % CHAPTERS.length];
  const mult = 1 + Math.max(0, floor - 40) * 0.03;
  const boss = floor % 5 === 0;
  const mobs = (n, tag) => Array.from({ length: n }, (_, i) => mob(rng, rng.pick(data.monsters), level, `${tag}${i}`, { mult }));
  if (boss) {
    return [mobs(2, 'a'), [mob(rng, { ...data.boss, role: 'bruiser' }, level, 'boss', { boss: true, mult })]];
  }
  return [mobs(3, 'a'), mobs(3, 'b')];
}

/** Мировой босс подстраивается под уровень героя; его HP «бесконечны» — считается нанесённый урон. */
export function buildWorldBossWave(heroLevel = 30) {
  const level = Math.max(10, Math.min(65, heroLevel + 5));
  const stats = monsterStats(level, 'bruiser', { boss: true, mult: 0.7 });
  stats.hp = 1e12;
  return [[{ id: 'wboss', name: WORLD_BOSS.name, emoji: WORLD_BOSS.emoji, level, boss: true, stats, skills: WORLD_BOSS.sk.slice() }]];
}

// ---------------------------------------------------------------- награды
export function stageRewards(idx, boss) {
  const m = boss ? 2.5 : 1;
  return {
    gold: Math.round((12 + 7 * idx ** 1.25) * m),
    xp: Math.round(25 * idx ** 1.5 * (boss ? 1.8 : 1)),
  };
}

export function towerRewards(floor) {
  const boss = floor % 5 === 0;
  return {
    gold: Math.round((40 + 9 * floor ** 1.3) * (boss ? 2 : 1)),
    xp: Math.round(30 * towerLevel(floor) ** 1.4),
    gems: boss ? 6 + Math.floor(floor / 5) : (floor % 5 === 3 ? 2 : 0),
    dust: boss ? 6 + Math.floor(floor / 3) : 0,
  };
}

export function idleRates(stageCleared) {
  const s = Math.max(1, stageCleared);
  return { goldPerMin: Math.round(6 + 1.6 * s ** 1.2), xpPerMin: Math.round(2 + 0.9 * s ** 1.3), dustPerHour: Math.floor(1 + s / 8) };
}

export const IDLE_CAP_MIN = 720;

// ---------------------------------------------------------------- даты
export function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Номер недели (ISO-подобный, по UTC), ключ вида 2026-W45 */
export function weekKey(ms) {
  const d = new Date(Date.UTC(new Date(ms).getUTCFullYear(), new Date(ms).getUTCMonth(), new Date(ms).getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export { MAX_LEVEL, TOWER_THEME };
