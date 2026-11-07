// Ashen Crown — экран героя: снаряжение, сумка, навыки, таланты, духи. Developer: @yfeeeee
import {
  CLASSES, SLOTS, SLOT_INFO, RARITIES, CLASS_SKILLS, SKILLS, TALENTS, SPIRITS, SPIRIT_MAX, spiritShardCost, BAG_LIMIT, MAX_LEVEL,
} from '../shared/data.js';
import { heroStats, xpToNext } from '../shared/progression.js';
import * as eco from '../shared/economy.js';
import { h, fmt, pct, bar, section, tabs, itemCard, toast, confirmDialog } from './ui.js';
import { S, persist } from './state.js';
import { go, refresh } from './router.js';
import { delta, openItem } from './common.js';
import { sfx } from './audio.js';

const row = (label, value, cls = '') => h('div', { class: `stat-row ${cls}` }, h('span', null, label), h('b', null, value));

function statsBlock() {
  const st = heroStats(S.save);
  return section('Характеристики',
    h('div', { class: 'stats-two' },
      row('❤️ Здоровье', fmt(st.hp)), row('⚔️ Атака', fmt(st.atk)),
      row('🛡️ Защита', fmt(st.def)), row('💨 Скорость', fmt(st.spd)),
      row('🎯 Крит', pct(st.crit)), row('💥 Крит. урон', `${Math.round(st.critDmg * 100)}%`),
      row('🌀 Уклонение', pct(st.dodge)), row('🩸 Вампиризм', pct(st.lifesteal)),
      row('🪙 Золото', `+${Math.round(st.goldPct * 100)}%`), row('✨ Опыт', `+${Math.round(st.xpPct * 100)}%`),
      row('🎒 Добыча', `+${Math.round(st.dropPct * 100)}%`), row('🔥 Сила', fmt(st.power), 'power')));
}

function header() {
  const s = S.save; const c = CLASSES[s.cls];
  const need = s.level >= MAX_LEVEL ? 1 : xpToNext(s.level);
  return h('div', { class: 'hero-head', style: { '--cc': c.color } },
    h('div', { class: 'hero-avatar' }, c.icon),
    h('div', { class: 'grow' },
      h('div', { class: 'hero-name' }, s.name),
      h('div', { class: 'muted small' }, `${c.name} · уровень ${s.level}${s.level >= MAX_LEVEL ? ' (макс.)' : ''}`),
      bar(s.level >= MAX_LEVEL ? 1 : s.xp, need, 'xp', s.level >= MAX_LEVEL ? 'MAX' : `${fmt(s.xp)}/${fmt(need)}`)));
}

function gearTab() {
  const slots = SLOTS.map((slot) => {
    const it = S.save.equip[slot];
    return itemCard(it, { slotIcon: SLOT_INFO[slot].icon, slotName: SLOT_INFO[slot].name, onClick: () => (it ? openItem(it.id) : go('hero', { tab: 'bag', filter: slot })) });
  });
  return h('div', null, section('Экипировка', h('div', { class: 'items' }, slots)), statsBlock());
}

function bagTab(params) {
  const filter = params.filter || 'all';
  const sort = params.sort || 'power';
  let list = S.save.bag.slice();
  if (filter !== 'all') list = list.filter((i) => i.slot === filter);
  const key = { power: (i) => -(delta(i) ?? 0), rarity: (i) => -(i.r * 1000 + i.ilvl), ilvl: (i) => -i.ilvl }[sort];
  list.sort((a, b) => key(a) - key(b));
  const filters = [['all', 'Все'], ...SLOTS.map((s) => [s, SLOT_INFO[s].icon])];
  return h('div', null,
    section(`Сумка ${S.save.bag.length}/${BAG_LIMIT}`,
      h('div', { class: 'chips-row' }, filters.map(([id, label]) => h('button', { class: `chip-btn ${id === filter ? 'active' : ''}`, on: { click: () => go('hero', { ...params, filter: id }) } }, label))),
      h('div', { class: 'chips-row' },
        [['power', 'По силе'], ['rarity', 'По редкости'], ['ilvl', 'По уровню']].map(([id, label]) => h('button', { class: `chip-btn ${id === sort ? 'active' : ''}`, on: { click: () => go('hero', { ...params, sort: id }) } }, label))),
      list.length ? h('div', { class: 'items' }, list.map((i) => itemCard(i, { delta: delta(i), onClick: () => openItem(i.id) })))
        : h('p', { class: 'muted center' }, 'Здесь пока пусто. Побеждайте врагов — с них падает снаряжение!')),
    section('Быстрая разборка',
      h('div', { class: 'muted small' }, 'Разобрать все предметы без замка до выбранной редкости (улучшенные +3 и выше пропускаются).'),
      h('div', { class: 'chips-row' }, RARITIES.slice(0, 4).map((r, idx) => h('button', {
        class: 'btn small', style: { borderColor: r.color, color: r.color },
        on: { click: async () => {
          const ids = S.save.bag.filter((i) => i.r <= idx && !i.lock && i.enh < 3).map((i) => i.id);
          if (!ids.length) return toast('Нечего разбирать');
          if (!(await confirmDialog(`Разобрать ${ids.length} предм. (до «${r.name}»)?`))) return;
          const res = eco.salvageItems(S.save, ids);
          persist(); sfx('buy'); toast(`+🔹${res.dust}  +🪙${fmt(res.gold)}`, 'good'); refresh();
        } },
      }, `≤ ${r.name}`)))));
}

function skillsTab() {
  const s = S.save;
  return section('Навыки класса',
    h('div', { class: 'muted small' }, 'Навыки открываются с уровнем и используются в бою. Перезарядка — в ходах героя.'),
    CLASS_SKILLS[s.cls].map((id) => {
      const sk = SKILLS[id]; const open = s.level >= sk.unlock;
      return h('div', { class: `skill-card ${open ? '' : 'locked'}` },
        h('div', { class: 'skill-ico big' }, sk.icon),
        h('div', { class: 'grow' }, h('b', null, sk.name), h('div', { class: 'muted small' }, sk.desc)),
        h('div', { class: 'muted small right' }, open ? `⏳${sk.cd}` : `🔒 ур. ${sk.unlock}`));
    }));
}

function talentsTab() {
  const s = S.save;
  const spent = Object.values(s.talents).reduce((a, b) => a + b, 0);
  return section(`Таланты — очков: ${s.talentPts}`,
    h('div', { class: 'row between' },
      h('div', { class: 'muted small' }, `Потрачено ${spent}. Очко даётся за каждый уровень.`),
      h('button', { class: 'btn small', on: { click: async () => {
        if (!(await confirmDialog(`Сбросить таланты за 🪙${fmt(eco.respecCost(s))}?`))) return;
        const r = eco.respecTalents(s);
        if (!r.ok) return toast(r.error, 'bad');
        persist(); sfx('buy'); refresh();
      } } }, 'Сброс')),
    TALENTS.map((t) => {
      const r = s.talents[t.id] || 0;
      return h('div', { class: 'talent' },
        h('div', { class: 'skill-ico big' }, t.icon),
        h('div', { class: 'grow' }, h('b', null, t.name), h('div', { class: 'muted small' }, t.desc), bar(r, t.max, 'talent', `${r}/${t.max}`)),
        h('button', { class: 'btn small primary', disabled: r >= t.max || s.talentPts < 1, on: { click: () => {
          const res = eco.spendTalent(s, t.id);
          if (!res.ok) return toast(res.error, 'bad');
          sfx('buy'); persist(); refresh();
        } } }, '+'));
    }));
}

function spiritsTab() {
  const s = S.save;
  return section('Духи-спутники',
    h('div', { class: 'muted small' }, 'Один активный дух даёт постоянный бонус. Осколки падают с боссов и из «Сундука духов» в кузнице.'),
    SPIRITS.map((sp) => {
      const own = s.spirits[sp.id];
      const active = s.spirit === sp.id;
      return h('div', { class: `spirit ${own ? '' : 'locked'} ${active ? 'active' : ''}` },
        h('div', { class: 'skill-ico big' }, sp.icon),
        h('div', { class: 'grow' },
          h('b', null, sp.name, own ? ` · ур. ${own.lvl}` : ''),
          h('div', { class: 'muted small' }, sp.desc),
          own ? bar(own.shards, spiritShardCost(own.lvl), 'talent', own.lvl >= SPIRIT_MAX ? 'MAX' : `осколки ${own.shards}/${spiritShardCost(own.lvl)}`) : h('div', { class: 'muted small' }, 'Не призван')),
        own ? h('div', { class: 'col' },
          h('button', { class: `btn small ${active ? 'primary' : ''}`, on: { click: () => { eco.setSpirit(s, sp.id); persist(); refresh(); } } }, active ? 'Активен' : 'Выбрать'),
          h('button', { class: 'btn small gold', disabled: own.lvl >= SPIRIT_MAX || own.shards < spiritShardCost(own.lvl), on: { click: () => {
            const r = eco.upgradeSpirit(s, sp.id);
            if (!r.ok) return toast(r.error, 'bad');
            sfx('level'); persist(); refresh();
          } } }, '⬆')) : null);
    }));
}

export function renderHero(params = {}) {
  const tab = params.tab || 'gear';
  const tabsDef = [['gear', '🎽 Вещи'], ['bag', '🎒 Сумка'], ['skills', '✨ Навыки'], ['talents', '🌟 Таланты'], ['spirits', '🔮 Духи']];
  const content = { gear: gearTab, bag: () => bagTab(params), skills: skillsTab, talents: talentsTab, spirits: spiritsTab }[tab]();
  return h('div', null, header(), tabs(tabsDef, tab, (t) => go('hero', { tab: t })), content);
}

