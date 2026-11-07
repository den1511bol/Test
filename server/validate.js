// Ashen Crown — проверка сохранений от клиента (лёгкая защита от подделки).
// Developer: @yfeeeee
import { CLASSES, MAX_LEVEL, TOTAL_STAGES, SLOTS, BAG_LIMIT, RARITIES } from '../shared/data.js';

export const MAX_SAVE_BYTES = 300 * 1024;
const NAME_RE = /^[\p{L}\p{N} _\-.]{2,16}$/u;

export function cleanName(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  return NAME_RE.test(name) ? name : null;
}

const isInt = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isInteger(v) && v >= min && v <= max;
const isNum = (v, min = 0, max = 1e18) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

function checkItem(it, where) {
  if (!it || typeof it !== 'object') return `${where}: не предмет`;
  if (typeof it.id !== 'string' || it.id.length > 24) return `${where}: id`;
  if (!SLOTS.includes(it.slot)) return `${where}: слот`;
  if (!isInt(it.r, 0, RARITIES.length - 1)) return `${where}: редкость`;
  if (!isInt(it.ilvl, 1, 100)) return `${where}: ilvl`;
  if (!isInt(it.enh, 0, RARITIES[it.r].maxEnh)) return `${where}: enh`;
  if (!it.main || typeof it.main !== 'object') return `${where}: main`;
  for (const [k, v] of Object.entries(it.main)) {
    if (!['hp', 'atk', 'def', 'spd'].includes(k) || !isNum(v, 0, it.ilvl * 80 * 4)) return `${where}: main.${k}`;
  }
  if (!Array.isArray(it.aff) || it.aff.length > RARITIES[it.r].affixes) return `${where}: аффиксы`;
  for (const a of it.aff) if (typeof a.s !== 'string' || !isNum(a.v, 0, 1)) return `${where}: аффикс`;
  return null;
}

/**
 * Возвращает строку-ошибку или null. prev — прошлое сохранение (может быть null).
 * Проверяет формат, лимиты и «скорость» роста ключевых показателей.
 */
export function validateSave(save, prev, nowMs = Date.now()) {
  if (!save || typeof save !== 'object') return 'save: не объект';
  if (save.v !== 1) return 'save: версия';
  if (!cleanName(save.name)) return 'имя';
  if (!CLASSES[save.cls]) return 'класс';
  if (!isInt(save.level, 1, MAX_LEVEL)) return 'уровень';
  if (!isInt(save.stage, 0, TOTAL_STAGES)) return 'этап';
  if (!isInt(save.tower, 0, 1000)) return 'башня';
  for (const k of ['xp', 'gold', 'gems', 'dust', 'potions', 'chestKeys', 'talentPts']) {
    if (!isInt(save[k], 0, 1e12)) return `поле ${k}`;
  }
  if (!Array.isArray(save.bag) || save.bag.length > BAG_LIMIT) return 'сумка';
  for (const it of save.bag) { const e = checkItem(it, 'bag'); if (e) return e; }
  if (!save.equip || typeof save.equip !== 'object') return 'экипировка';
  for (const slot of SLOTS) {
    const it = save.equip[slot];
    if (it) {
      const e = checkItem(it, `equip.${slot}`);
      if (e) return e;
      if (it.slot !== slot) return `equip.${slot}: чужой слот`;
    }
  }
  const talentSum = Object.values(save.talents || {}).reduce((a, b) => a + (isInt(b, 0, 20) ? b : 1e9), 0);
  if (talentSum + save.talentPts > save.level) return 'таланты';
  if (!save.arena || !isInt(save.arena.rating, 0, 5000)) return 'арена';

  if (prev) {
    const dt = Math.max(0, nowMs - (prev.updated || nowMs)) / 1000;
    if (save.level < prev.level - 0 && save.created === prev.created) return 'уровень уменьшился';
    if (save.stage > prev.stage + 12 + dt / 20) return 'слишком быстрый прогресс по этапам';
    if (save.tower > prev.tower + 6 + dt / 30) return 'слишком быстрый прогресс по башне';
    if (save.level > prev.level + 5 + dt / 60) return 'слишком быстрый рост уровня';
    if (save.gems > prev.gems + 400 + dt / 2) return 'слишком быстрый рост самоцветов';
  }
  return null;
}
