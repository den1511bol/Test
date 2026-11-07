// Ashen Crown — боты арены (чтобы арена работала, даже если игроков мало).
// Developer: @yfeeeee
import { RNG, hashString } from '../shared/rng.js';
import { TALENTS, SLOTS, CLASSES } from '../shared/data.js';
import { makeItem } from '../shared/items.js';
import { createCharacter } from '../shared/economy.js';
import { heroStats } from '../shared/progression.js';

const NAMES = ['Страж Пепла', 'Гроза Теней', 'Рыцарь Зари', 'Огненный Лис', 'Каменный Кулак', 'Ледяная Дева', 'Охотник Бездны', 'Тихий Клинок'];

export const isBot = (id) => typeof id === 'string' && id.startsWith('bot:');

/** id вида bot:<seed>:<level> */
export function botId(seed, level) { return `bot:${seed}:${level}`; }

export function makeBot(id) {
  const [, seed, lvlStr] = id.split(':');
  const level = Math.max(1, Math.min(60, Number(lvlStr) || 1));
  const rng = new RNG(hashString(id));
  const classes = Object.keys(CLASSES);
  const cls = classes[hashString(`${seed}`) % classes.length];
  const name = NAMES[hashString(`n${seed}`) % NAMES.length];
  const save = createCharacter(name, cls, 0);
  save.level = level;
  const r = Math.max(0, Math.min(4, Math.floor(level / 14) + 1));
  for (const slot of SLOTS) {
    const it = makeItem(rng, { id: `b${slot}`, ilvl: level, r, slot });
    it.enh = Math.min(Math.floor(level / 6), [5, 8, 10, 12, 14, 15][r]);
    save.equip[slot] = it;
  }
  const order = ['power', 'vitality', 'armor', 'ferocity'];
  let pts = level - 1; let i = 0;
  while (pts > 0 && i < 300) {
    const t = TALENTS.find((x) => x.id === order[i % order.length]);
    if ((save.talents[t.id] || 0) < t.max) { save.talents[t.id] = (save.talents[t.id] || 0) + 1; pts--; }
    i++;
  }
  return { id, name: `${name} [бот]`, cls, level, save, power: heroStats(save).power, rating: 1000 + level * 8 };
}
