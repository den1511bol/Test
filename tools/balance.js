// Симуляция баланса: node tools/balance.js [class]
// Developer: @yfeeeee
import { RNG } from '../shared/rng.js';
import { simulate } from '../shared/engine.js';
import { TALENTS, CLASSES, SLOTS } from '../shared/data.js';
import { makeItem } from '../shared/items.js';
import {
  newSave, heroUnit, heroStats, stageInfo, buildStageWaves, TUNE,
} from '../shared/progression.js';

/** Типичный герой, проходящий кампанию «в темп» */
export function refSave(cls, level, rarityBias = 0, enhBias = 0) {
  const rng = new RNG(level * 97 + 13);
  const s = newSave('ref', cls);
  s.level = level;
  const chapter = Math.ceil((level / 0.72) / 10 + 0.01);
  const r = Math.max(0, Math.min(4, Math.floor(1 + chapter / 2) + rarityBias));
  for (const slot of SLOTS) {
    const it = makeItem(rng, { id: slot, ilvl: Math.max(1, level - 2), r, slot });
    it.enh = Math.max(0, Math.min(Math.floor(level / 5) + enhBias, [5, 8, 10, 12, 14, 15][r]));
    s.equip[slot] = it;
  }
  // таланты: очки поровну
  let pts = Math.max(0, level - 1) * 1;
  const order = ['power', 'vitality', 'armor', 'ferocity', 'precision', 'swift'];
  let i = 0;
  while (pts > 0 && i < 400) {
    const t = TALENTS.find((x) => x.id === order[i % order.length]);
    if ((s.talents[t.id] || 0) < t.max) { s.talents[t.id] = (s.talents[t.id] || 0) + 1; pts--; }
    i++;
  }
  return s;
}

export function winRate(save, waveBuilder, n = 200, potions = 2) {
  let wins = 0, hpLeft = 0, turns = 0;
  for (let i = 0; i < n; i++) {
    const rng = new RNG(1000 + i);
    const res = simulate({ heroes: [heroUnit(save)], waves: waveBuilder(rng), seed: 5000 + i, potions });
    if (res.win) { wins++; hpLeft += res.heroes[0].hp / res.heroes[0].maxHp; }
    turns += res.heroTurns;
  }
  return { rate: wins / n, hp: wins ? hpLeft / wins : 0, turns: turns / n };
}

if (process.argv[1] && process.argv[1].endsWith('balance.js')) {
  const classes = process.argv[2] ? [process.argv[2]] : Object.keys(CLASSES);
  const bias = Number(process.env.RBIAS || 0);
  const ebias = Number(process.env.EBIAS || 0);
  console.log('TUNE', JSON.stringify(TUNE), 'rarityBias', bias, 'enhBias', ebias);
  for (const cls of classes) {
    console.log(`\n== ${cls}`);
    for (const idx of [1, 3, 5, 9, 10, 15, 20, 25, 30, 35, 40, 50, 55, 60, 70, 79, 80]) {
      const info = stageInfo(idx);
      const lvl = Math.min(60, info.level);
      const save = refSave(cls, lvl, bias, ebias);
      const st = heroStats(save);
      const r = winRate(save, (rng) => buildStageWaves(idx, rng), 120);
      console.log(
        `stage ${String(idx).padStart(2)} ${info.boss ? 'BOSS' : '    '} lvl ${String(lvl).padStart(2)} pow ${String(st.power).padStart(6)} ` +
        `win ${(r.rate * 100).toFixed(0).padStart(3)}% hpLeft ${(r.hp * 100).toFixed(0).padStart(3)}% turns ${r.turns.toFixed(1)}`,
      );
    }
  }
}
