// Ashen Crown — кузница: улучшение, сундуки, разборка. Developer: @yfeeeee
import { SLOTS, SPIRITS, RARITIES } from '../shared/data.js';
import { enhanceCost, maxEnh, salvageValue } from '../shared/items.js';
import * as eco from '../shared/economy.js';
import { h, fmt, section, tabs, itemCard, toast, modal, confirmDialog } from './ui.js';
import { S, persist } from './state.js';
import { go, refresh } from './router.js';
import { delta, openItem, rng } from './common.js';
import { sfx } from './audio.js';

function currencyBar() {
  const s = S.save;
  return h('div', { class: 'wallet' }, `🪙 ${fmt(s.gold)}   💎 ${s.gems}   🔹 ${s.dust}   🗝️ ${s.chestKeys}`);
}

function enhanceTab() {
  const gear = SLOTS.map((slot) => S.save.equip[slot]).filter(Boolean);
  const bag = S.save.bag.slice().sort((a, b) => b.r - a.r || b.ilvl - a.ilvl).slice(0, 30);
  const card = (it) => {
    const maxed = it.enh >= maxEnh(it);
    const c = enhanceCost(it);
    const can = !maxed && S.save.gold >= c.gold && S.save.dust >= c.dust;
    return h('div', { class: 'forge-row' },
      itemCard(it, { compact: true, onClick: () => openItem(it.id) }),
      h('button', { class: `btn small ${can ? 'gold' : ''}`, disabled: maxed, on: { click: () => {
        const r = eco.enhanceItem(S.save, it.id);
        if (!r.ok) { sfx('error'); return toast(r.error, 'bad'); }
        sfx('buy'); persist(); toast(`${it.name} → +${it.enh}`, 'good'); refresh();
      } } }, maxed ? 'MAX' : `+1  🪙${fmt(c.gold)} 🔹${c.dust}`));
  };
  return h('div', null,
    section('Надетое снаряжение', gear.length ? gear.map(card) : h('p', { class: 'muted' }, 'Ничего не надето')),
    section('Из сумки (лучшие)', bag.length ? bag.map(card) : h('p', { class: 'muted' }, 'Сумка пуста')));
}

function chestCard(type, sub) {
  const def = eco.CHESTS[type];
  const cost = def.costOf(S.save);
  const label = cost.gold ? `🪙 ${fmt(cost.gold)}` : `💎 ${cost.gems}`;
  return h('div', { class: 'chest' },
    h('div', { class: 'chest-ico' }, def.icon),
    h('div', { class: 'grow' }, h('b', null, def.name), h('div', { class: 'muted small' }, sub)),
    h('div', { class: 'col' },
      h('button', { class: 'btn primary small', on: { click: () => open(type, false) } }, label),
      type === 'gold' ? h('button', { class: 'btn small', disabled: S.save.chestKeys < 1, on: { click: () => open(type, true) } }, `🗝️ ключ (${S.save.chestKeys})`) : null));
}

function open(type, useKey) {
  const r = eco.openChest(S.save, type, rng(), { useKey });
  if (!r.ok) { sfx('error'); return toast(r.error, 'bad'); }
  persist(); sfx('level');
  const body = h('div', { class: 'center' },
    h('div', { class: 'big-emoji' }, eco.CHESTS[type].icon),
    r.items.map((x) => (x.salvaged ? h('p', { class: 'muted' }, `♻ ${x.item.name} (разобран, +🔹${x.dust})`) : itemCard(x.item, { delta: delta(x.item), onClick: () => openItem(x.item.id) }))),
    r.shards ? h('p', null, `${SPIRITS.find((s) => s.id === r.shards.id).icon} ${SPIRITS.find((s) => s.id === r.shards.id).name}: +${r.shards.n} осколков${r.shards.isNew ? ' — НОВЫЙ ДУХ!' : ''}`) : null,
    r.pity != null && type === 'gold' ? h('p', { class: 'muted small' }, `Гарантия: эпик каждые 10, легендарка каждые 40 (сейчас ${S.save.pity.gold})`) : null);
  modal({ title: 'Награда', body, buttons: [{ text: 'Закрыть' }, { text: 'Ещё раз', cls: 'primary', onClick: () => { setTimeout(() => open(type, useKey), 0); } }] });
  refresh();
}

function chestsTab() {
  return h('div', null,
    section('Сундуки',
      chestCard('iron', 'Обычное и необычное снаряжение, шанс редкого'),
      chestCard('gold', 'Редкое и выше. Гарант: эпик/10, легенда/40'),
      chestCard('spirit', 'Осколки духов-спутников')));
}

function salvageTab() {
  const s = S.save;
  const rows = RARITIES.map((r, idx) => {
    const items = s.bag.filter((i) => i.r === idx && !i.lock);
    const total = items.reduce((a, i) => { const v = salvageValue(i); return { d: a.d + v.dust, g: a.g + v.gold }; }, { d: 0, g: 0 });
    return h('div', { class: 'row between salv', style: { borderLeft: `4px solid ${r.color}` } },
      h('div', null, h('b', { style: { color: r.color } }, r.name), h('div', { class: 'muted small' }, `${items.length} шт. → 🔹${total.d} 🪙${fmt(total.g)}`)),
      h('button', { class: 'btn small danger', disabled: !items.length, on: { click: async () => {
        if (idx >= 3 && !(await confirmDialog(`Разобрать все «${r.name}» (${items.length})?`))) return;
        const res = eco.salvageItems(s, items.map((i) => i.id));
        persist(); sfx('buy'); toast(`+🔹${res.dust}  +🪙${fmt(res.gold)}`, 'good'); refresh();
      } } }, 'Разобрать'));
  });
  const auto = s.settings.autoSalvage;
  return h('div', null,
    section('Массовая разборка', h('div', { class: 'muted small' }, 'Предметы с замком не затрагиваются.'), rows),
    section('Автоматическая разборка',
      h('div', { class: 'muted small' }, 'Новая добыча выбранной редкости и ниже сразу превращается в пыль и золото.'),
      h('div', { class: 'chips-row' }, [[-1, 'Выкл'], ...RARITIES.slice(0, 4).map((r, i) => [i, `≤ ${r.name}`])].map(([v, label]) => h('button', {
        class: `chip-btn ${auto === v ? 'active' : ''}`, on: { click: () => { s.settings.autoSalvage = v; persist({ sync: false }); refresh(); } },
      }, label)))));
}

export function renderForge(params = {}) {
  const tab = params.tab || 'enhance';
  const content = { enhance: enhanceTab, chests: chestsTab, salvage: salvageTab }[tab]();
  return h('div', null, currencyBar(), tabs([['enhance', '🔨 Улучшение'], ['chests', '🎁 Сундуки'], ['salvage', '♻ Разборка']], tab, (t) => go('forge', { tab: t })), content);
}

