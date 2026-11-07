// Тесты общей игровой логики. Developer: @yfeeeee
import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../shared/rng.js';
import { Battle, simulate } from '../shared/engine.js';
import { CLASSES, MAX_LEVEL, ACHIEVEMENTS, SLOTS } from '../shared/data.js';
import { makeItem } from '../shared/items.js';
import {
  heroUnit, heroStats, buildStageWaves, buildTowerWaves, xpToNext, dayKey, weekKey, unlockedSkills,
} from '../shared/progression.js';
import * as eco from '../shared/economy.js';

const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);

test('RNG детерминирован', () => {
  const a = new RNG(42); const b = new RNG(42);
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
  assert.notEqual(new RNG(1).next(), new RNG(2).next());
});

test('бой детерминирован и завершается', () => {
  const save = eco.createCharacter('Тест', 'warrior', T0);
  const mk = () => simulate({ heroes: [heroUnit(save)], waves: buildStageWaves(3, new RNG(7)), seed: 99 }, { log: true });
  const r1 = mk(); const r2 = mk();
  assert.deepEqual(r1.events, r2.events);
  assert.equal(typeof r1.win, 'boolean');
  assert.ok(r1.events.at(-1).k === 'end');
});

test('все классы проходят первый этап', () => {
  for (const cls of Object.keys(CLASSES)) {
    const save = eco.createCharacter('T', cls, T0);
    let wins = 0;
    for (let i = 0; i < 20; i++) {
      const r = simulate({ heroes: [heroUnit(save)], waves: buildStageWaves(1, new RNG(i)), seed: i + 1, potions: 3 });
      if (r.win) wins++;
    }
    assert.ok(wins >= 15, `${cls}: ${wins}/20`);
  }
});

test('перки: феникс воскрешает один раз', () => {
  const hero = { id: 'h', name: 'H', emoji: '🙂', level: 1, hero: true, stats: { hp: 100, atk: 1, def: 0, spd: 100 }, skills: [], perks: ['phoenix'] };
  const killer = { id: 'k', name: 'K', emoji: '👹', level: 1, stats: { hp: 99999, atk: 1000, def: 0, spd: 100 }, skills: [] };
  const b = new Battle({ heroes: [hero], waves: [[killer]], seed: 3 });
  let revived = 0; let u;
  while ((u = b.next())) {
    b.perform(b.autoAction(u));
    revived += b.drain().filter((e) => e.k === 'revive').length;
  }
  assert.equal(revived, 1);
  assert.equal(b.win, false);
});

test('оглушение пропускает ход, боссы устойчивы', () => {
  const hero = { id: 'h', name: 'H', emoji: '🙂', level: 1, hero: true, stats: { hp: 1e6, atk: 10, def: 0, spd: 100 }, skills: ['w_ult'], perks: [] };
  const boss = { id: 'b', name: 'B', emoji: '👹', level: 1, boss: true, stats: { hp: 1e6, atk: 1, def: 0, spd: 100 }, skills: [] };
  const b = new Battle({ heroes: [hero], waves: [[boss]], seed: 5, maxTurns: 60 });
  let stunned = 0; let u;
  while ((u = b.next())) { b.perform(b.autoAction(u)); stunned += b.drain().filter((e) => e.k === 'stunned').length; }
  assert.ok(stunned <= 12, `stunned=${stunned}`); // иммунитет после оглушения
});

test('опыт и уровни, талант-очки', () => {
  const s = eco.createCharacter('Lv', 'mage', T0);
  const ups = eco.addXp(s, xpToNext(1) + xpToNext(2) + 5);
  assert.equal(ups, 2);
  assert.equal(s.level, 3);
  assert.equal(s.talentPts, 2);
  eco.addXp(s, 1e12);
  assert.equal(s.level, MAX_LEVEL);
});

test('победа в этапе: первая зачистка, награды, прогресс', () => {
  const s = eco.createCharacter('W', 'rogue', T0);
  const g0 = s.gold;
  const res = eco.winStage(s, 1, new RNG(1));
  assert.equal(s.stage, 1);
  assert.ok(res.first && res.gems === 5);
  assert.ok(s.gold > g0);
  const res2 = eco.winStage(s, 1, new RNG(2));
  assert.equal(res2.first, false);
  assert.equal(s.quests.prog.win, 2);
});

test('улучшение предмета списывает ресурсы и усиливает статы', () => {
  const s = eco.createCharacter('E', 'warrior', T0);
  s.gold = 1e6; s.dust = 1e4;
  s.equip.weapon.ilvl = 30;
  s.equip.weapon.main.atk = 100;
  const before = heroStats(s).atk;
  const id = s.equip.weapon.id;
  assert.equal(eco.enhanceItem(s, id).ok, true);
  assert.ok(heroStats(s).atk > before);
  assert.equal(s.equip.weapon.enh, 1);
  s.gold = 0;
  assert.equal(eco.enhanceItem(s, id).ok, false);
  s.gold = 1e9;
  for (let i = 0; i < 20; i++) eco.enhanceItem(s, id);
  assert.equal(s.equip.weapon.enh, 5); // максимум для обычного
});

test('экипировка и сумка', () => {
  const s = eco.createCharacter('Eq', 'warrior', T0);
  const rng = new RNG(5);
  const it = makeItem(rng, { id: eco.newItemId(s), ilvl: 10, r: 3, slot: 'weapon' });
  eco.giveItem(s, it);
  const old = s.equip.weapon.id;
  assert.equal(eco.equipItem(s, it.id).ok, true);
  assert.equal(s.equip.weapon.id, it.id);
  assert.ok(s.bag.some((x) => x.id === old));
  assert.equal(eco.unequipItem(s, 'ring').ok, false);
});

test('автопродажа и разбор', () => {
  const s = eco.createCharacter('S', 'mage', T0);
  s.settings.autoSalvage = 1;
  const rng = new RNG(8);
  const r = eco.giveItem(s, makeItem(rng, { id: 'x1', ilvl: 5, r: 1 }));
  assert.equal(r.salvaged, true);
  assert.equal(s.bag.length, 0);
  s.settings.autoSalvage = -1;
  eco.giveItem(s, makeItem(rng, { id: 'x2', ilvl: 5, r: 2 }));
  const d0 = s.dust;
  eco.salvageItems(s, ['x2']);
  assert.ok(s.dust > d0);
});

test('сундуки: гарантия редкости и списание валюты', () => {
  const s = eco.createCharacter('C', 'warrior', T0);
  s.gems = 100000;
  const rng = new RNG(11);
  let best = 0;
  for (let i = 0; i < 40; i++) {
    const guaranteed = (s.pity.gold + 1) % 10 === 0;
    const r = eco.openChest(s, 'gold', rng);
    assert.ok(r.ok);
    if (guaranteed) assert.ok(r.items[0].item.r >= 3, 'гарант эпика на каждом 10-м');
    best = Math.max(best, r.items[0].item.r);
  }
  assert.ok(best >= 4);
  s.gems = 0;
  assert.equal(eco.openChest(s, 'gold', rng).ok, false);
});

test('духи: призыв, улучшение, влияние на статы', () => {
  const s = eco.createCharacter('Sp', 'mage', T0);
  assert.equal(eco.addShards(s, 'fox', 12), true);
  assert.equal(s.spirits.fox.shards, 11);
  const a0 = heroStats(s).atk;
  assert.equal(eco.upgradeSpirit(s, 'fox').ok, true);
  assert.ok(heroStats(s).atk > a0);
  assert.equal(eco.setSpirit(s, 'owl').ok, false);
});

test('таланты и сброс', () => {
  const s = eco.createCharacter('T', 'warrior', T0);
  assert.equal(eco.spendTalent(s, 'power').ok, false);
  s.talentPts = 3;
  eco.spendTalent(s, 'power'); eco.spendTalent(s, 'power');
  assert.equal(s.talents.power, 2);
  s.gold = 1e6;
  eco.respecTalents(s);
  assert.equal(s.talentPts, 3);
  assert.deepEqual(s.talents, {});
});

test('суточные сбросы, квесты и бонус', () => {
  const s = eco.createCharacter('Q', 'rogue', T0);
  const qs = eco.dailyQuests(s.quests.day);
  assert.equal(qs.length, 5);
  for (const q of qs) s.quests.prog[q.key] = q.goal;
  for (const q of qs) assert.equal(eco.claimQuest(s, q.id).ok, true);
  assert.equal(eco.claimQuest(s, qs[0].id).ok, false);
  assert.equal(eco.claimQuestBonus(s).ok, true);
  assert.equal(eco.claimQuestBonus(s).ok, false);
  assert.equal(eco.rollover(s, T0 + 86400000), true);
  assert.deepEqual(s.quests.claimed, {});
});

test('ежедневный вход: серия сбрасывается при пропуске', () => {
  const s = eco.createCharacter('L', 'rogue', T0);
  assert.equal(eco.claimLogin(s, T0).ok, true);
  assert.equal(eco.claimLogin(s, T0 + 1000).ok, false);
  assert.equal(eco.claimLogin(s, T0 + 86400000).streak, 2);
  assert.equal(eco.claimLogin(s, T0 + 5 * 86400000).streak, 1);
});

test('отдых: награда копится и ограничена 12 часами', () => {
  const s = eco.createCharacter('I', 'warrior', T0);
  s.stage = 20;
  assert.equal(eco.claimIdle(s, T0 + 10000).ok, false);
  const p = eco.idlePreview(s, T0 + 100 * 3600000);
  assert.equal(p.minutes, 720);
  const g0 = s.gold;
  const r = eco.claimIdle(s, T0 + 100 * 3600000);
  assert.ok(r.ok && s.gold - g0 === r.gold);
  assert.equal(eco.claimIdle(s, T0 + 100 * 3600000).ok, false);
});

test('магазин детерминирован в течение дня', () => {
  const s = eco.createCharacter('Sh', 'warrior', T0);
  s.gold = 1e7; s.gems = 1e4;
  const a = eco.shopOffers(s); const b = eco.shopOffers(s);
  assert.deepEqual(a, b);
  const gear = a.find((o) => o.kind === 'gear');
  assert.equal(eco.buyOffer(s, gear.id).ok, true);
  assert.equal(eco.buyOffer(s, gear.id).ok, false);
  const p0 = s.potions;
  eco.buyOffer(s, 'potions');
  assert.equal(s.potions, p0 + 5);
});

test('достижения: ступени', () => {
  const s = eco.createCharacter('A', 'warrior', T0);
  s.level = 12;
  const st = eco.achievementState(s).find((x) => x.def.id === 'a_level');
  assert.ok(st.ready);
  const g = s.gems;
  assert.equal(eco.claimAchievement(s, 'a_level').ok, true);
  assert.ok(s.gems > g);
  assert.equal(s.ach.a_level, 1);
  assert.equal(eco.claimAchievement(s, 'a_level').ok, false);
  assert.equal(ACHIEVEMENTS.length >= 10, true);
});

test('башня: бой, награда и рост этажа', () => {
  const s = eco.createCharacter('Tw', 'mage', T0);
  const waves = buildTowerWaves(5, new RNG(1));
  assert.equal(waves[1].length, 1); // босс
  const r = eco.winTower(s, 1, new RNG(1));
  assert.equal(s.tower, 1);
  assert.ok(r.first);
});

test('навыки открываются по уровню', () => {
  assert.equal(unlockedSkills('warrior', 1).length, 1);
  assert.equal(unlockedSkills('warrior', 60).length, 6);
});

test('ключи дней/недель', () => {
  assert.equal(dayKey(T0), '2026-11-07');
  assert.match(weekKey(T0), /^2026-W\d\d$/);
  assert.equal(SLOTS.length, 5);
});

test('имена предметов согласованы по роду', async () => {
  const { inflect } = await import('../shared/items.js');
  assert.equal(inflect('Священный', 'f'), 'Священная');
  assert.equal(inflect('Крепкий', 'n'), 'Крепкое');
  assert.equal(inflect('Пылающий', 'f'), 'Пылающая');
  assert.equal(inflect('Драконий', 'n'), 'Драконье');
  assert.equal(inflect('Грозовой', 'm'), 'Грозовой');
});
