// Ashen Crown — «Ещё»: задания, достижения, магазин, настройки, о игре. Developer: @yfeeeee
import { GAME, LOGIN_REWARDS, QUEST_BONUS } from '../shared/data.js';
import * as eco from '../shared/economy.js';
import { dayKey } from '../shared/progression.js';
import { h, fmt, section, tabs, bar, chips, toast, modal, confirmDialog, itemCard } from './ui.js';
import { S, persist, syncNow, resetLocal, linkAccount } from './state.js';
import { api, baseUrl, setServer, NetError } from './api.js';
import { go, refresh } from './router.js';
import { delta } from './common.js';
import { sfx } from './audio.js';

const claimed = (r, onOk) => {
  if (!r.ok) { sfx('error'); return toast(r.error, 'bad'); }
  sfx('coin'); persist(); if (onOk) onOk(r); refresh();
};

// ---------------------------------------------------------------- задания
export function loginModal() {
  const s = S.save;
  const nextIdx = (s.login.streak) % LOGIN_REWARDS.length;
  const body = h('div', null,
    h('p', { class: 'muted' }, `Серия входов: ${s.login.streak}. Заходите каждый день — награды становятся лучше!`),
    h('div', { class: 'login-grid' }, LOGIN_REWARDS.map((r, i) => h('div', { class: `login-day ${i === nextIdx ? 'next' : ''}` }, h('div', { class: 'muted small' }, `День ${i + 1}`), chips(r)))));
  modal({
    title: '📅 Награда за вход', body,
    buttons: [{ text: 'Позже' }, { text: 'Забрать', cls: 'primary', onClick: () => {
      const r = eco.claimLogin(S.save);
      if (!r.ok) { toast(r.error, 'bad'); return; }
      sfx('coin'); persist(); toast('Награда получена!', 'good'); refresh();
    } }],
  });
}

function questsTab() {
  const s = S.save;
  const qs = eco.dailyQuests(s.quests.day);
  const allClaimed = qs.every((q) => s.quests.claimed[q.id]);
  const login = s.login.day !== dayKey(Date.now());
  return h('div', null,
    login ? section('📅 Ежедневный вход', h('button', { class: 'btn gold wide', on: { click: loginModal } }, 'Забрать награду за вход')) : null,
    section('Ежедневные задания',
      qs.map((q) => {
        const v = Math.min(q.goal, s.quests.prog[q.key] || 0);
        const done = v >= q.goal; const got = s.quests.claimed[q.id];
        return h('div', { class: `quest ${got ? 'got' : ''}` },
          h('div', { class: 'grow' }, h('b', null, q.name), bar(v, q.goal, 'quest', `${v}/${q.goal}`), chips(q.reward)),
          h('button', { class: `btn small ${done && !got ? 'gold' : ''}`, disabled: !done || got, on: { click: () => claimed(eco.claimQuest(s, q.id)) } }, got ? '✔' : 'Забрать'));
      }),
      h('div', { class: 'quest bonus' },
        h('div', { class: 'grow' }, h('b', null, '🎁 Бонус за все задания'), chips(QUEST_BONUS)),
        h('button', { class: `btn small ${allClaimed && !s.quests.bonus ? 'gold' : ''}`, disabled: !allClaimed || s.quests.bonus, on: { click: () => claimed(eco.claimQuestBonus(s)) } }, s.quests.bonus ? '✔' : 'Забрать'))));
}

function achievementsTab() {
  const list = eco.achievementState(S.save);
  return section('Достижения', list.map((a) => h('div', { class: `quest ${a.done ? 'got' : ''}` },
    h('div', { class: 'grow' },
      h('b', null, `${a.def.name} `, h('span', { class: 'muted small' }, `ступень ${Math.min(a.tier + 1, a.def.tiers.length)}/${a.def.tiers.length}`)),
      h('div', { class: 'muted small' }, a.def.desc(a.goal)),
      bar(Math.min(a.value, a.goal), a.goal, 'quest', `${fmt(Math.min(a.value, a.goal))}/${fmt(a.goal)}`),
      a.done ? null : chips(a.reward)),
    h('button', { class: `btn small ${a.ready ? 'gold' : ''}`, disabled: !a.ready, on: { click: () => claimed(eco.claimAchievement(S.save, a.def.id)) } }, a.done ? '✔' : 'Забрать'))));
}

// ---------------------------------------------------------------- магазин
function shopTab() {
  const s = S.save;
  const offers = eco.shopOffers(s);
  return h('div', null,
    h('div', { class: 'wallet' }, `🪙 ${fmt(s.gold)}   💎 ${s.gems}   🧪 ${s.potions}`),
    section('Предложения дня', h('div', { class: 'muted small' }, 'Обновляются каждый день (UTC).'),
      offers.map((o) => {
        const bought = s.shop.bought[o.id];
        const price = o.price.gold ? `🪙 ${fmt(o.price.gold)}` : `💎 ${o.price.gems}`;
        return h('div', { class: 'shop-row' },
          o.kind === 'gear' ? itemCard(o.item, { delta: delta(o.item) }) : h('div', { class: 'grow' }, h('div', { class: 'shop-name' }, `${o.icon} ${o.name}`)),
          h('button', { class: 'btn small primary', disabled: bought, on: { click: () => claimed(eco.buyOffer(s, o.id), () => toast('Куплено!', 'good')) } }, bought ? 'Продано' : price));
      })),
    section('Зелья', h('div', { class: 'row between' },
      h('div', null, h('b', null, '🧪 Зелье лечения'), h('div', { class: 'muted small' }, 'Восстанавливает 40% здоровья в бою')),
      h('button', { class: 'btn small primary', on: { click: () => claimed(eco.buyPotions(s, 1)) } }, '🪙 150'))));
}

// ---------------------------------------------------------------- настройки
function toggleRow(label, key) {
  const s = S.save.settings;
  return h('div', { class: 'row between setting' }, h('span', null, label),
    h('button', { class: `btn small ${s[key] ? 'primary' : ''}`, on: { click: () => { s[key] = !s[key]; persist({ sync: false }); sfx('click'); refresh(); } } }, s[key] ? 'Вкл' : 'Выкл'));
}

function settingsTab() {
  const s = S.save;
  const input = h('input', { class: 'input', type: 'url', placeholder: 'https://your-app.up.railway.app', value: baseUrl() });
  const status = h('div', { class: 'muted small' }, S.auth ? (S.online ? '🟢 Онлайн, сохранение синхронизируется' : '🟡 Нет связи с сервером') : '⚪ Локальный герой (не привязан)');
  return h('div', null,
    section('Игра', toggleRow('🔊 Звук', 'sound'), toggleRow('📳 Вибрация', 'vibrate'), toggleRow('🤖 Авто-бой по умолчанию', 'auto')),
    section('Сервер',
      status, S.syncError ? h('div', { class: 'bad small' }, `Ошибка синхронизации: ${S.syncError}`) : null,
      h('div', { class: 'muted small' }, 'Адрес сервера Railway. Пусто — используется адрес по умолчанию из сборки.'),
      input,
      h('div', { class: 'row' },
        h('button', { class: 'btn small', on: { click: async () => {
          setServer(input.value.trim().replace(/\/+$/, ''));
          try {
            const r = await api.info();
            toast(r.status === 200 ? `Сервер доступен: ${r.json.name} v${r.json.version} (${r.json.store}), игроков: ${r.json.players}` : `Ответ ${r.status}`, r.status === 200 ? 'good' : 'bad');
          } catch (e) { toast(e instanceof NetError ? e.message : 'Ошибка', 'bad'); }
        } } }, 'Проверить'),
        !S.auth ? h('button', { class: 'btn small primary', on: { click: async () => {
          setServer(input.value.trim().replace(/\/+$/, ''));
          try { await linkAccount(); toast('Аккаунт привязан!', 'good'); refresh(); } catch (e) { toast(e.message, 'bad'); }
        } } }, 'Привязать героя') : h('button', { class: 'btn small', on: { click: async () => { const okk = await syncNow(); toast(okk ? 'Синхронизировано' : 'Не удалось', okk ? 'good' : 'bad'); } } }, 'Синхронизировать'))),
    section('Данные',
      h('button', { class: 'btn danger wide', on: { click: async () => {
        if (!(await confirmDialog('Удалить героя с этого устройства? Если аккаунт привязан, ключ входа будет потерян и вернуть героя не получится.', 'Удалить'))) return;
        resetLocal(); location.reload();
      } } }, 'Удалить героя и начать заново')),
    section('Об игре',
      h('div', { class: 'about' },
        h('div', { class: 'about-logo' }, '👑'),
        h('h3', null, `${GAME.name} — ${GAME.title}`),
        h('div', { class: 'muted' }, `Версия ${GAME.version}`),
        h('div', null, 'Разработчик: ', h('b', null, GAME.developer)),
        h('div', { class: 'muted small' }, 'Мобильная RPG: кампания, башня, арена, мировой босс. Сервер: Node.js + PostgreSQL (Railway).'))));
}

export function renderMore(params = {}) {
  const tab = params.tab || 'quests';
  const content = { quests: questsTab, ach: achievementsTab, shop: shopTab, settings: settingsTab }[tab]();
  return h('div', null,
    tabs([['quests', '📜 Задания'], ['ach', '🏅 Достижения'], ['shop', '🏪 Магазин'], ['settings', '⚙ Ещё']], tab, (t) => go('more', { tab: t })),
    content);
}

