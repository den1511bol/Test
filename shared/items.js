// Ashen Crown — генерация и улучшение предметов. Developer: @yfeeeee
import { SLOTS, SLOT_INFO, RARITIES, AFFIX_POOL, PERK_IDS } from './data.js';

export const DROP_WEIGHTS = {
  normal: [56, 28, 12, 3.5, 0.5, 0],
  boss: [0, 30, 45, 20, 4.5, 0.5],
  tower: [20, 35, 30, 13, 2, 0],
  iron: [50, 35, 13, 2, 0, 0],
  gold: [0, 0, 50, 35, 14, 1],
  shop: [0, 40, 40, 17, 3, 0],
};

// [существительное, род: m|f|n] — прилагательные согласуются по роду
const NAMES = {
  weapon: [['Клинок', 'm'], ['Посох', 'm'], ['Кинжал', 'm'], ['Топор', 'm'], ['Жезл', 'm'], ['Меч', 'm']],
  helm: [['Шлем', 'm'], ['Капюшон', 'm'], ['Шишак', 'm'], ['Венец', 'm']],
  armor: [['Доспех', 'm'], ['Кираса', 'f'], ['Мантия', 'f'], ['Кольчуга', 'f']],
  ring: [['Перстень', 'm'], ['Кольцо', 'n'], ['Печатка', 'f']],
  amulet: [['Амулет', 'm'], ['Талисман', 'm'], ['Медальон', 'm']],
};

/** Согласование прилагательного (м. р. → ж./ср.) */
export function inflect(adj, gender) {
  if (gender === 'm') return adj;
  const f = gender === 'f';
  if (/(кий|хий)$/.test(adj)) return adj.slice(0, -2) + (f ? 'ая' : 'ое');
  if (/(щий|жий|чий|ший)$/.test(adj)) return adj.slice(0, -2) + (f ? 'ая' : 'ее');
  if (/ий$/.test(adj)) return adj.slice(0, -2) + (f ? 'ья' : 'ье');
  if (/(ый|ой)$/.test(adj)) return adj.slice(0, -2) + (f ? 'ая' : 'ое');
  return adj;
}
const PREFIX = [
  ['Потёртый', 'Простой', 'Ржавый', 'Старый'],
  ['Крепкий', 'Надёжный', 'Острый', 'Прочный'],
  ['Закалённый', 'Рунный', 'Благородный', 'Серебряный'],
  ['Грозовой', 'Теневой', 'Пылающий', 'Ледяной'],
  ['Королевский', 'Драконий', 'Священный', 'Погибельный'],
  ['Пепельный', 'Вечный', 'Божественный', 'Бездонный'],
];

export const enhFactor = (enh) => 1 + 0.09 * enh;
export const maxEnh = (item) => RARITIES[item.r].maxEnh;
export const rarityOf = (item) => RARITIES[item.r];

export function rollRarity(rng, weights) {
  return rng.weighted(weights);
}

/** @param {{id:string, ilvl:number, r:number, slot?:string}} o */
export function makeItem(rng, { id, ilvl, r, slot }) {
  slot = slot || rng.pick(SLOTS);
  ilvl = Math.max(1, Math.round(ilvl));
  const rar = RARITIES[r];
  const main = {};
  for (const [stat, k] of Object.entries(SLOT_INFO[slot].base)) {
    const v = ilvl * k * rar.mult * rng.range(0.9, 1.1);
    main[stat] = stat === 'spd' ? Math.max(1, Math.round(v)) : Math.max(1, Math.round(v));
  }
  const item = {
    id, slot, r, ilvl, enh: 0,
    name: '',
    main, aff: [], perk: null, lock: false,
  };
  const [noun, gender] = rng.pick(NAMES[slot]);
  item.name = `${inflect(rng.pick(PREFIX[r]), gender)} ${noun}`;
  item.aff = rollAffixes(rng, item, rar.affixes);
  if (r === 5 || (r === 4 && rng.chance(0.35))) item.perk = rng.pick(PERK_IDS);
  return item;
}

export function rollAffixes(rng, item, count) {
  const pool = rng.shuffle(AFFIX_POOL).slice(0, count);
  const scale = (0.55 + 0.45 * Math.min(1, item.ilvl / 60)) * (0.85 + 0.06 * item.r);
  return pool.map(([stat, lo, hi]) => ({
    s: stat,
    v: Math.round((lo + (hi - lo) * rng.range(0.4, 1)) * scale * 1000) / 1000,
  }));
}

/** Итоговые бонусы предмета с учётом улучшения */
export function itemBonuses(item) {
  const f = enhFactor(item.enh);
  const flat = {};
  for (const [s, v] of Object.entries(item.main)) flat[s] = v * f;
  const pct = {};
  for (const a of item.aff) pct[a.s] = (pct[a.s] || 0) + a.v;
  return { flat, pct };
}

// ---------------------------------------------------------------- улучшение
export function enhanceCost(item) {
  const n = item.enh;
  return {
    gold: Math.round(40 * (n + 1) ** 1.7 * (1 + item.ilvl / 12)),
    dust: Math.round((n + 1) * 1.5 * (1 + item.r * 0.5)),
  };
}

export function reforgeCost(item) {
  return {
    gold: Math.round(150 * (item.r + 1) * (1 + item.ilvl / 10)),
    dust: 6 * (item.r + 1),
  };
}

export function salvageValue(item) {
  const rar = RARITIES[item.r];
  return {
    dust: Math.max(1, Math.round(rar.dust * (1 + item.ilvl / 30) + item.enh * (item.r + 1))),
    gold: Math.round(item.ilvl * 3 * (item.r + 1)),
  };
}

export function itemTitle(item) {
  return `${item.name}${item.enh ? ` +${item.enh}` : ''}`;
}
