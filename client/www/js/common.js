// Ashen Crown — общие окна и действия (предметы, уровни, награды). Developer: @yfeeeee
import { RARITIES, SLOT_INFO } from '../shared/data.js';
import { RNG } from '../shared/rng.js';
import { enhanceCost, maxEnh, reforgeCost, salvageValue } from '../shared/items.js';
import { powerWith, heroStats, unlockedSkills } from '../shared/progression.js';
import * as eco from '../shared/economy.js';
import { SKILLS } from '../shared/data.js';
import { h, modal, itemCard, fmt, toast, chips, confirmDialog } from './ui.js';
import { S, persist } from './state.js';
import { refresh } from './router.js';
import { sfx } from './audio.js';

export const rng = () => new RNG((Date.now() ^ (Math.random() * 1e9)) >>> 0);

export function delta(item) {
  const cur = heroStats(S.save).power;
  const equipped = S.save.equip[item.slot];
  if (equipped && equipped.id === item.id) return null;
  return powerWith(S.save, item) - cur;
}

export function notifyLevel(beforeLevel) {
  const lvl = S.save.level;
  if (lvl <= beforeLevel) return;
  sfx('level');
  const newSkills = unlockedSkills(S.save.cls, lvl).filter((id) => !unlockedSkills(S.save.cls, beforeLevel).includes(id));
  modal({
    title: `🎉 Уровень ${lvl}!`,
    body: h('div', null,
      h('p', null, `Получено очков талантов: ${lvl - beforeLevel}`),
      newSkills.length ? h('div', null, h('b', null, 'Новые навыки:'), newSkills.map((id) => h('div', null, `${SKILLS[id].icon} ${SKILLS[id].name} — ${SKILLS[id].desc}`))) : null),
    buttons: [{ text: 'Отлично!', cls: 'primary' }],
  });
}

/** Модальное окно предмета с действиями. */
export function openItem(itemId) {
  const f = eco.findItem(S.save, itemId);
  if (!f) return;
  const it = f.item;
  const equipped = f.where === 'equip';
  const d = equipped ? null : delta(it);
  const cost = enhanceCost(it);
  const canEnh = it.enh < maxEnh(it);
  const sv = salvageValue(it);
  const rf = reforgeCost(it);

  const act = (fn, msg) => {
    const r = fn();
    if (!r.ok) { sfx('error'); toast(r.error, 'bad'); return false; }
    sfx('buy'); persist(); if (msg) toast(msg, 'good');
    refresh();
    return true;
  };

  const body = h('div', null,
    itemCard(it, { delta: d }),
    it.perk ? null : null,
    h('div', { class: 'muted small' }, `${SLOT_INFO[it.slot].name} · макс. улучшение +${maxEnh(it)}`));

  const buttons = [];
  if (equipped) buttons.push({ text: 'Снять', onClick: () => act(() => eco.unequipItem(S.save, it.slot)) });
  else buttons.push({ text: `Надеть ${d > 0 ? '▲' : d < 0 ? '▼' : ''}`, cls: 'primary', onClick: () => act(() => eco.equipItem(S.save, it.id)) });
  buttons.push({
    text: canEnh ? `Улучшить 🪙${fmt(cost.gold)} 🔹${cost.dust}` : 'Макс. улучшение',
    cls: canEnh ? 'gold' : '', keep: true,
    onClick: (close) => {
      if (!canEnh) return false;
      if (act(() => eco.enhanceItem(S.save, it.id), `${it.name} → +${it.enh + 1}`)) { close(); openItem(it.id); }
      return false;
    },
  });
  if (it.aff.length) {
    buttons.push({
      text: `Перековать 🪙${fmt(rf.gold)} 🔹${rf.dust}`, keep: true,
      onClick: async (close) => {
        if (!(await confirmDialog('Перековать аффиксы? Старые бонусы будут заменены случайными.'))) return false;
        if (act(() => eco.reforgeItem(S.save, it.id, rng()), 'Аффиксы перекованы')) { close(); openItem(it.id); }
        return false;
      },
    });
  }
  buttons.push({ text: it.lock ? '🔓 Снять замок' : '🔒 Замок', keep: true, onClick: (close) => { eco.toggleLock(S.save, it.id); persist(); refresh(); close(); openItem(it.id); return false; } });
  if (!equipped) {
    buttons.push({
      text: `Разобрать +🔹${sv.dust} 🪙${sv.gold}`, cls: 'danger',
      onClick: async () => {
        if (it.lock) { toast('Предмет заблокирован', 'bad'); return false; }
        if (it.r >= 3 && !(await confirmDialog(`Разобрать «${it.name}»?`))) return false;
        return act(() => eco.salvageItems(S.save, [it.id]), 'Предмет разобран');
      },
    });
  }
  buttons.push({ text: 'Закрыть' });
  modal({ title: RARITIES[it.r].name, body, buttons });
}

export function rewardBody(res, extra = []) {
  const items = (res.items || []).map((x) => (x.salvaged
    ? h('div', { class: 'muted small' }, `♻ ${x.item.name} разобран автоматически${x.full ? ' (сумка полна)' : ''} (+🔹${x.dust})`)
    : itemCard(x.item, { compact: true, delta: delta(x.item), onClick: () => openItem(x.item.id) })));
  return h('div', null,
    chips({ gold: res.gold, xp: res.xp, gems: res.gems, dust: res.dust }),
    res.first ? h('div', { class: 'good small' }, '⭐ Первое прохождение!') : null,
    res.shards ? h('div', { class: 'small' }, `🔮 Осколки духа: +${res.shards.n}`) : null,
    items.length ? h('div', { class: 'section-title' }, 'Добыча') : null,
    items, ...extra);
}
