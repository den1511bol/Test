// Ashen Crown — экономика: награды, предметы, сундуки, квесты, магазин.
// Все функции изменяют объект сохранения и возвращают сводку. Developer: @yfeeeee
import { RNG, hashString } from './rng.js';
import {
  MAX_LEVEL, RARITIES, SLOTS, SPIRITS, SPIRIT_MAX, spiritShardCost, TALENTS, QUEST_POOL, DAILY_QUESTS,
  QUEST_BONUS, ACHIEVEMENTS, LOGIN_REWARDS, BAG_LIMIT, SHOP_POTION_PRICE, TOTAL_STAGES,
} from './data.js';
import {
  makeItem, rollRarity, DROP_WEIGHTS, enhanceCost, maxEnh, reforgeCost, rollAffixes, salvageValue,
} from './items.js';
import {
  xpToNext, heroStats, stageInfo, stageRewards, towerRewards, towerLevel, idleRates, IDLE_CAP_MIN, dayKey,
  weekKey, newSave,
} from './progression.js';

const fail = (msg) => ({ ok: false, error: msg });
const ok = (extra = {}) => ({ ok: true, ...extra });

// ---------------------------------------------------------------- базовые операции
export function touch(save, now = Date.now()) { save.updated = now; }

export function addGold(save, amount) {
  amount = Math.max(0, Math.round(amount));
  save.gold += amount;
  save.stats.goldEarned += amount;
  return amount;
}

export function addXp(save, amount) {
  let levelUps = 0;
  amount = Math.max(0, Math.round(amount));
  if (save.level >= MAX_LEVEL) return 0;
  save.xp += amount;
  while (save.level < MAX_LEVEL && save.xp >= xpToNext(save.level)) {
    save.xp -= xpToNext(save.level);
    save.level++;
    save.talentPts++;
    levelUps++;
  }
  if (save.level >= MAX_LEVEL) save.xp = 0;
  return levelUps;
}

export function addReward(save, r) {
  const got = {};
  if (r.gold) got.gold = addGold(save, r.gold);
  if (r.gems) { save.gems += r.gems; got.gems = r.gems; }
  if (r.dust) { save.dust += r.dust; got.dust = r.dust; }
  if (r.potions) { save.potions += r.potions; got.potions = r.potions; }
  if (r.chestKeys) { save.chestKeys += r.chestKeys; got.chestKeys = r.chestKeys; }
  return got;
}

export function bump(save, key, n = 1) {
  save.quests.prog[key] = (save.quests.prog[key] || 0) + n;
}

// ---------------------------------------------------------------- суточные сбросы
export function rollover(save, now = Date.now()) {
  const day = dayKey(now);
  const week = weekKey(now);
  let changed = false;
  if (save.quests.day !== day) {
    save.quests = { day, prog: {}, claimed: {}, bonus: false };
    changed = true;
  }
  if (save.arena.day !== day) { save.arena.day = day; save.arena.fights = 0; changed = true; }
  if (save.world.day !== day) { save.world.day = day; save.world.fights = 0; changed = true; }
  if (save.world.week !== week) { save.world.week = week; save.world.dmg = 0; changed = true; }
  if (save.shop.day !== day) { save.shop = { day, bought: {}, lvl: save.level }; changed = true; }
  return changed;
}

// ---------------------------------------------------------------- предметы
export function newItemId(save) { return `i${save.nextId++}`; }

export function findItem(save, id) {
  for (const slot of SLOTS) if (save.equip[slot] && save.equip[slot].id === id) return { item: save.equip[slot], where: 'equip', slot };
  const i = save.bag.findIndex((x) => x.id === id);
  return i >= 0 ? { item: save.bag[i], where: 'bag', index: i } : null;
}

/** Кладёт предмет в сумку (автопродажа/переполнение -> пыль). */
export function giveItem(save, item) {
  if (item.r >= 4) save.stats.legendaries++;
  const auto = save.settings.autoSalvage;
  if (auto >= 0 && item.r <= auto) {
    const v = salvageValue(item);
    save.dust += v.dust;
    addGold(save, v.gold);
    return { item, salvaged: true, ...v };
  }
  if (save.bag.length >= BAG_LIMIT) {
    const v = salvageValue(item);
    save.dust += v.dust;
    addGold(save, v.gold);
    return { item, salvaged: true, full: true, ...v };
  }
  save.bag.push(item);
  return { item, salvaged: false };
}

export function equipItem(save, id) {
  const f = findItem(save, id);
  if (!f || f.where !== 'bag') return fail('Предмет не найден в сумке');
  const prev = save.equip[f.item.slot];
  save.bag.splice(f.index, 1);
  save.equip[f.item.slot] = f.item;
  if (prev) save.bag.push(prev);
  return ok();
}

export function unequipItem(save, slot) {
  const it = save.equip[slot];
  if (!it) return fail('Слот пуст');
  if (save.bag.length >= BAG_LIMIT) return fail('Сумка заполнена');
  save.equip[slot] = null;
  save.bag.push(it);
  return ok();
}

export function enhanceItem(save, id) {
  const f = findItem(save, id);
  if (!f) return fail('Предмет не найден');
  const it = f.item;
  if (it.enh >= maxEnh(it)) return fail('Достигнут максимум улучшения');
  const cost = enhanceCost(it);
  if (save.gold < cost.gold) return fail('Не хватает золота');
  if (save.dust < cost.dust) return fail('Не хватает пыли');
  save.gold -= cost.gold;
  save.dust -= cost.dust;
  it.enh++;
  save.stats.bestEnh = Math.max(save.stats.bestEnh, it.enh);
  bump(save, 'enhance');
  return ok({ cost, enh: it.enh });
}

export function reforgeItem(save, id, rng) {
  const f = findItem(save, id);
  if (!f) return fail('Предмет не найден');
  const it = f.item;
  if (!it.aff.length) return fail('У предмета нет аффиксов');
  const cost = reforgeCost(it);
  if (save.gold < cost.gold) return fail('Не хватает золота');
  if (save.dust < cost.dust) return fail('Не хватает пыли');
  save.gold -= cost.gold;
  save.dust -= cost.dust;
  it.aff = rollAffixes(rng, it, it.aff.length);
  return ok({ cost });
}

export function salvageItems(save, ids) {
  let dust = 0; let gold = 0; let n = 0;
  for (const id of ids) {
    const i = save.bag.findIndex((x) => x.id === id);
    if (i < 0 || save.bag[i].lock) continue;
    const v = salvageValue(save.bag[i]);
    dust += v.dust; gold += v.gold; n++;
    save.bag.splice(i, 1);
  }
  save.dust += dust;
  addGold(save, gold);
  return ok({ dust, gold, count: n });
}

export function toggleLock(save, id) {
  const f = findItem(save, id);
  if (!f) return fail('Предмет не найден');
  f.item.lock = !f.item.lock;
  return ok({ lock: f.item.lock });
}

// ---------------------------------------------------------------- награды боёв
function dropItems(save, rng, { ilvl, boss, weights, chance }) {
  const st = heroStats(save);
  const out = [];
  const p = Math.min(1, chance * (1 + st.dropPct));
  const rolls = boss ? 1 + (rng.chance(0.4 + st.dropPct) ? 1 : 0) : (rng.chance(p) ? 1 : 0);
  for (let i = 0; i < rolls; i++) {
    const r = rollRarity(rng, weights);
    const item = makeItem(rng, { id: newItemId(save), ilvl: ilvl + rng.int(0, 2), r });
    out.push(giveItem(save, item));
  }
  return out;
}

/** Победа в этапе кампании. firstClear определяется по save.stage. */
export function winStage(save, idx, rng) {
  const info = stageInfo(idx);
  const st = heroStats(save);
  const base = stageRewards(idx, info.boss);
  const gold = addGold(save, base.gold * (1 + st.goldPct));
  const xpBefore = save.level;
  const levelUps = addXp(save, base.xp * (1 + st.xpPct));
  const res = { gold, xp: Math.round(base.xp * (1 + st.xpPct)), levelUps, newLevel: save.level, items: [], first: false, gems: 0, dust: 0, shards: null };
  if (idx > save.stage) {
    res.first = true;
    save.stage = idx;
    res.gems = info.boss ? 25 : 5;
    save.gems += res.gems;
    if (info.boss) { res.dust = 10; save.dust += 10; }
  }
  res.items = dropItems(save, rng, {
    ilvl: info.level, boss: info.boss, weights: info.boss ? DROP_WEIGHTS.boss : DROP_WEIGHTS.normal, chance: 0.28,
  });
  if (info.boss && rng.chance(0.5)) {
    const sp = rng.pick(SPIRITS);
    res.shards = { id: sp.id, n: rng.int(1, 3) };
    addShards(save, sp.id, res.shards.n);
  }
  save.stats.wins++;
  save.stats.battles++;
  if (info.boss) { save.stats.bosses++; bump(save, 'boss'); }
  bump(save, 'win');
  void xpBefore;
  return res;
}

export function winTower(save, floor, rng) {
  const base = towerRewards(floor);
  const st = heroStats(save);
  const res = { gold: addGold(save, base.gold * (1 + st.goldPct)), xp: Math.round(base.xp * (1 + st.xpPct)), gems: base.gems, dust: base.dust, items: [], first: floor > save.tower };
  res.levelUps = addXp(save, res.xp);
  res.newLevel = save.level;
  save.gems += base.gems;
  save.dust += base.dust;
  if (floor > save.tower) save.tower = floor;
  res.items = dropItems(save, rng, {
    ilvl: towerLevel(floor), boss: floor % 5 === 0, weights: DROP_WEIGHTS.tower, chance: 0.25,
  });
  save.stats.wins++;
  save.stats.battles++;
  if (floor % 5 === 0) { save.stats.bosses++; bump(save, 'boss'); }
  bump(save, 'win');
  bump(save, 'tower');
  return res;
}

export function recordLoss(save) {
  save.stats.losses++;
  save.stats.battles++;
}

export function recordKills(save, kills, skillsUsed, crits) {
  save.stats.kills += kills;
  bump(save, 'kill', kills);
  bump(save, 'skill', skillsUsed);
  bump(save, 'crit', crits);
}

// ---------------------------------------------------------------- отдых (idle)
export function idlePreview(save, now = Date.now()) {
  const minutes = Math.min(IDLE_CAP_MIN, Math.max(0, (now - save.idle.t) / 60000));
  const rates = idleRates(save.stage);
  const st = heroStats(save);
  return {
    minutes,
    capped: minutes >= IDLE_CAP_MIN,
    gold: Math.floor(minutes * rates.goldPerMin * (1 + st.goldPct)),
    xp: Math.floor(minutes * rates.xpPerMin * (1 + st.xpPct)),
    dust: Math.floor((minutes / 60) * rates.dustPerHour),
    rates,
  };
}

export function claimIdle(save, now = Date.now()) {
  const p = idlePreview(save, now);
  if (p.minutes < 1) return fail('Пока нечего забирать');
  addGold(save, p.gold);
  const levelUps = addXp(save, p.xp);
  save.dust += p.dust;
  save.idle.t = now;
  bump(save, 'idle');
  return ok({ ...p, levelUps });
}

// ---------------------------------------------------------------- духи
export function addShards(save, id, n) {
  const cur = save.spirits[id];
  if (!cur) {
    save.spirits[id] = { lvl: 1, shards: Math.max(0, n - 1) };
    if (!save.spirit) save.spirit = id;
    return true; // новый дух
  }
  cur.shards += n;
  return false;
}

export function upgradeSpirit(save, id) {
  const sp = save.spirits[id];
  if (!sp) return fail('Дух не призван');
  if (sp.lvl >= SPIRIT_MAX) return fail('Максимальный уровень');
  const cost = spiritShardCost(sp.lvl);
  if (sp.shards < cost) return fail(`Нужно осколков: ${cost}`);
  sp.shards -= cost;
  sp.lvl++;
  return ok({ lvl: sp.lvl });
}

export function setSpirit(save, id) {
  if (!save.spirits[id]) return fail('Дух не призван');
  save.spirit = id;
  return ok();
}

// ---------------------------------------------------------------- сундуки
export const CHESTS = {
  iron: { name: 'Железный сундук', icon: '📦', costOf: (s) => ({ gold: 400 + 60 * s.level }) },
  gold: { name: 'Золотой сундук', icon: '🎁', costOf: () => ({ gems: 60 }) },
  spirit: { name: 'Сундук духов', icon: '🔮', costOf: () => ({ gems: 40 }) },
};

export function openChest(save, type, rng, { useKey = false } = {}) {
  const def = CHESTS[type];
  if (!def) return fail('Неизвестный сундук');
  const cost = def.costOf(save);
  if (useKey) {
    if (type !== 'gold') return fail('Ключ подходит только к золотому сундуку');
    if (save.chestKeys < 1) return fail('Нет ключей');
    save.chestKeys--;
  } else {
    if ((cost.gold || 0) > save.gold) return fail('Не хватает золота');
    if ((cost.gems || 0) > save.gems) return fail('Не хватает самоцветов');
    save.gold -= cost.gold || 0;
    save.gems -= cost.gems || 0;
  }
  bump(save, 'chest');
  const res = { type, items: [], shards: null, pity: null };

  if (type === 'spirit') {
    const sp = rng.pick(SPIRITS);
    const n = rng.int(3, 6);
    const isNew = addShards(save, sp.id, n);
    res.shards = { id: sp.id, n, isNew };
    return ok(res);
  }

  let weights = DROP_WEIGHTS[type].slice();
  let minR = 0;
  if (type === 'gold') {
    save.pity.gold++;
    if (save.pity.gold % 40 === 0) minR = 4;
    else if (save.pity.gold % 10 === 0) minR = 3;
    for (let i = 0; i < minR; i++) weights[i] = 0;
    if (rng.chance(0.3)) {
      const sp = rng.pick(SPIRITS);
      const n = rng.int(1, 3);
      res.shards = { id: sp.id, n, isNew: addShards(save, sp.id, n) };
    }
  }
  const r = rollRarity(rng, weights);
  const item = makeItem(rng, { id: newItemId(save), ilvl: save.level + rng.int(0, 3), r });
  res.items.push(giveItem(save, item));
  if (type === 'gold' && r >= 4) save.pity.gold = 0;
  res.pity = save.pity.gold;
  return ok(res);
}

// ---------------------------------------------------------------- таланты
export function spendTalent(save, id) {
  const t = TALENTS.find((x) => x.id === id);
  if (!t) return fail('Нет такого таланта');
  const r = save.talents[id] || 0;
  if (r >= t.max) return fail('Максимальный ранг');
  if (save.talentPts < 1) return fail('Нет очков талантов');
  save.talentPts--;
  save.talents[id] = r + 1;
  return ok();
}

export const respecCost = (save) => 200 * save.level;

export function respecTalents(save) {
  const cost = respecCost(save);
  if (save.gold < cost) return fail('Не хватает золота');
  const spent = Object.values(save.talents).reduce((a, b) => a + b, 0);
  if (!spent) return fail('Нечего сбрасывать');
  save.gold -= cost;
  save.talentPts += spent;
  save.talents = {};
  return ok({ refunded: spent });
}

// ---------------------------------------------------------------- квесты, достижения, вход
export function dailyQuests(day) {
  const rng = new RNG(hashString(`quests:${day}`));
  return rng.shuffle(QUEST_POOL).slice(0, DAILY_QUESTS);
}

export function claimQuest(save, id) {
  const q = dailyQuests(save.quests.day).find((x) => x.id === id);
  if (!q) return fail('Квест не найден');
  if (save.quests.claimed[id]) return fail('Уже получено');
  if ((save.quests.prog[q.key] || 0) < q.goal) return fail('Задание не выполнено');
  save.quests.claimed[id] = true;
  return ok({ got: addReward(save, q.reward) });
}

export function claimQuestBonus(save) {
  const qs = dailyQuests(save.quests.day);
  if (save.quests.bonus) return fail('Уже получено');
  if (!qs.every((q) => save.quests.claimed[q.id])) return fail('Заберите все награды заданий');
  save.quests.bonus = true;
  return ok({ got: addReward(save, QUEST_BONUS) });
}

export function achievementState(save) {
  return ACHIEVEMENTS.map((a) => {
    const tier = save.ach[a.id] || 0;
    const done = tier >= a.tiers.length;
    const goal = a.tiers[Math.min(tier, a.tiers.length - 1)];
    const value = a.value(save);
    return { def: a, tier, done, goal, value, ready: !done && value >= goal, reward: a.reward(Math.min(tier, a.tiers.length - 1)) };
  });
}

export function claimAchievement(save, id) {
  const st = achievementState(save).find((x) => x.def.id === id);
  if (!st) return fail('Не найдено');
  if (st.done) return fail('Все ступени получены');
  if (!st.ready) return fail('Цель не достигнута');
  save.ach[id] = st.tier + 1;
  return ok({ got: addReward(save, st.reward) });
}

export function claimLogin(save, now = Date.now()) {
  const day = dayKey(now);
  if (save.login.day === day) return fail('Награда за сегодня уже получена');
  const yesterday = dayKey(now - 86400000);
  save.login.streak = save.login.day === yesterday ? save.login.streak + 1 : 1;
  save.login.day = day;
  const idx = (save.login.streak - 1) % LOGIN_REWARDS.length;
  return ok({ streak: save.login.streak, idx, got: addReward(save, LOGIN_REWARDS[idx]) });
}

// ---------------------------------------------------------------- магазин
export function shopOffers(save) {
  const lvl = save.shop.lvl || save.level;
  const rng = new RNG(hashString(`shop:${save.shop.day}:${Math.floor(lvl / 5)}`));
  const offers = [
    { id: 'potions', kind: 'potions', name: 'Зелья лечения ×5', icon: '🧪', qty: 5, price: { gold: SHOP_POTION_PRICE * 5 } },
    { id: 'dust', kind: 'dust', name: 'Пыль ×30', icon: '✨', qty: 30, price: { gems: 25 } },
    { id: 'goldpack', kind: 'gold', name: `Золото ×${3000 + lvl * 150}`, icon: '🪙', qty: 3000 + lvl * 150, price: { gems: 20 } },
    { id: 'key', kind: 'key', name: 'Золотой ключ', icon: '🗝️', qty: 1, price: { gems: 50 } },
  ];
  for (let i = 0; i < 3; i++) {
    const r = rollRarity(rng, DROP_WEIGHTS.shop);
    const item = makeItem(rng, { id: `shop${i}`, ilvl: lvl + rng.int(0, 2), r });
    offers.push({ id: `gear${i}`, kind: 'gear', name: item.name, icon: '⚔️', item, price: { gold: Math.round(item.ilvl * 45 * (r + 1) ** 2) } });
  }
  return offers;
}

export function buyOffer(save, offerId) {
  const offer = shopOffers(save).find((o) => o.id === offerId);
  if (!offer) return fail('Товар не найден');
  if (save.shop.bought[offerId] && offer.kind === 'gear') return fail('Уже куплено');
  if ((offer.price.gold || 0) > save.gold) return fail('Не хватает золота');
  if ((offer.price.gems || 0) > save.gems) return fail('Не хватает самоцветов');
  save.gold -= offer.price.gold || 0;
  save.gems -= offer.price.gems || 0;
  let result = null;
  if (offer.kind === 'potions') save.potions += offer.qty;
  else if (offer.kind === 'dust') save.dust += offer.qty;
  else if (offer.kind === 'gold') addGold(save, offer.qty);
  else if (offer.kind === 'key') save.chestKeys += 1;
  else if (offer.kind === 'gear') {
    const item = { ...offer.item, id: newItemId(save), aff: offer.item.aff.map((a) => ({ ...a })), main: { ...offer.item.main } };
    result = giveItem(save, item);
    save.shop.bought[offerId] = true;
  }
  return ok({ offer, result });
}

export function buyPotions(save, n = 1) {
  const cost = SHOP_POTION_PRICE * n;
  if (save.gold < cost) return fail('Не хватает золота');
  save.gold -= cost;
  save.potions += n;
  return ok();
}

// ---------------------------------------------------------------- арена и мировой босс
export function applyArena(save, r) {
  save.arena.rating = r.rating;
  save.arena.fights++;
  if (r.win) save.arena.wins++; else save.arena.losses++;
  bump(save, 'arena');
  const got = r.win ? addReward(save, { gold: 200 + save.level * 20, gems: 3 }) : addReward(save, { gems: 1 });
  return got;
}

export function applyWorldBoss(save, r) {
  save.world.fights++;
  save.world.dmg += r.damage;
  save.stats.worldDmg += r.damage;
  return addReward(save, { gems: r.gems, gold: r.gold });
}

export const ARENA_DAILY_FIGHTS = 5;
export const WORLD_DAILY_FIGHTS = 3;

export function createCharacter(name, cls, now = Date.now()) {
  const save = newSave(name, cls, now);
  const rng = new RNG(hashString(`${name}:${now}`));
  const weapon = makeItem(rng, { id: newItemId(save), ilvl: 1, r: 0, slot: 'weapon' });
  weapon.name = 'Простой клинок';
  save.equip.weapon = weapon;
  rollover(save, now);
  return save;
}

export { TOTAL_STAGES, RARITIES };
