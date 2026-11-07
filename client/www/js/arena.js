// Ashen Crown — арена, мировой босс, рейтинги (нужен сервер). Developer: @yfeeeee
import { CLASSES, WORLD_BOSS } from '../shared/data.js';
import * as eco from '../shared/economy.js';
import { h, fmt, section, tabs, toast, modal, chips } from './ui.js';
import { S, persist, linkAccount, syncNow } from './state.js';
import { api, NetError, serverConfigured } from './api.js';
import { go, refresh } from './router.js';
import { runReplay } from './battle.js';
import { sfx } from './audio.js';

const ARENA_THEME = { bg: ['#3a1d2e', '#0d0610'] };
const WORLD_THEME = { bg: ['#2b0f3a', '#07030c'] };

function needAccount() {
  if (!serverConfigured()) {
    return section('🌐 Сервер не настроен', h('p', { class: 'muted' }, 'Укажите адрес сервера в разделе «Ещё → Настройки», чтобы играть на арене, бить мирового босса и попасть в рейтинги.'),
      h('button', { class: 'btn primary', on: { click: () => go('more', { tab: 'settings' }) } }, 'Открыть настройки'));
  }
  return section('🌐 Нужен онлайн-аккаунт',
    h('p', { class: 'muted' }, 'Ваш герой пока хранится только на этом устройстве. Привяжите его к серверу, чтобы соревноваться с другими игроками.'),
    h('button', { class: 'btn primary', on: { click: async (e) => {
      e.target.disabled = true;
      try { await linkAccount(); toast('Аккаунт привязан!', 'good'); refresh(); } catch (err) { toast(err.message, 'bad'); e.target.disabled = false; }
    } } }, 'Привязать к серверу'));
}

/** Контейнер с асинхронной загрузкой. */
function loader(fn, render) {
  const box = h('div', null, h('p', { class: 'muted center' }, 'Загрузка…'));
  (async () => {
    try {
      const data = await fn();
      box.replaceChildren(render(data));
    } catch (e) {
      box.replaceChildren(section('⚠ Не удалось загрузить', h('p', { class: 'muted' }, e instanceof NetError ? e.message : (e.message || 'Ошибка')),
        h('button', { class: 'btn', on: { click: () => refresh() } }, 'Повторить')));
    }
  })();
  return box;
}

const ok = (r) => {
  if (r.status === 200) return r.json;
  throw new Error(r.json.error || `Ошибка ${r.status}`);
};

// ---------------------------------------------------------------- арена
async function fightArena(opp) {
  await syncNow(); // сервер симулирует бой по сохранённому снаряжению
  let r;
  try { r = await api.arenaFight(S.auth.token, opp.id); } catch (e) { return toast(e.message, 'bad'); }
  if (r.status !== 200) { sfx('error'); return toast(r.json.error || 'Ошибка', 'bad'); }
  const d = r.json;
  const rep = await runReplay({ title: `Арена: ${S.save.name} vs ${d.opponent.name}`, theme: ARENA_THEME, units: d.units, events: d.events });
  const got = eco.applyArena(S.save, { win: d.win, rating: d.rating });
  S.rating = d.rating; S.arenaLeft = d.left;
  persist(); sfx(d.win ? 'win' : 'lose');
  modal({
    title: d.win ? '🏆 Победа на арене!' : '💀 Поражение',
    body: h('div', { class: 'center' }, h('div', { class: 'big-emoji' }, d.win ? '🏆' : '💀'),
      h('p', null, `Рейтинг: ${d.rating} (${d.delta >= 0 ? '+' : ''}${d.delta})`), chips(got)),
    buttons: [{ text: 'Закрыть', cls: 'primary', onClick: () => { rep.close(); refresh(); } }],
  });
}

function arenaTab() {
  return loader(async () => ok(await api.opponents(S.auth.token)), (d) => {
    S.rating = d.rating; S.arenaLeft = d.left;
    return h('div', null,
      section('🏟️ Арена',
        h('div', { class: 'stat-grid' },
          h('div', null, h('div', { class: 'muted small' }, 'Рейтинг'), h('b', null, d.rating)),
          h('div', null, h('div', { class: 'muted small' }, 'Побед/поражений'), h('b', null, `${S.save.arena.wins}/${S.save.arena.losses}`)),
          h('div', null, h('div', { class: 'muted small' }, 'Боёв осталось'), h('b', null, d.left))),
        h('p', { class: 'muted small' }, 'Бой идёт на сервере между сохранёнными героями (автоматически). Побеждайте — растёт рейтинг и награды.')),
      section('Соперники', d.opponents.map((o) => h('div', { class: 'opp' },
        h('div', { class: 'hero-avatar small' }, CLASSES[o.cls].icon),
        h('div', { class: 'grow' }, h('b', null, o.name), h('div', { class: 'muted small' }, `Ур. ${o.level} · сила ${fmt(o.power)} · ★${o.rating}`)),
        h('button', { class: 'btn primary small', disabled: d.left <= 0, on: { click: () => fightArena(o) } }, 'В бой')))));
  });
}

// ---------------------------------------------------------------- мировой босс
async function fightWorld() {
  await syncNow();
  let r;
  try { r = await api.worldFight(S.auth.token); } catch (e) { return toast(e.message, 'bad'); }
  if (r.status !== 200) { sfx('error'); return toast(r.json.error || 'Ошибка', 'bad'); }
  const d = r.json;
  const rep = await runReplay({ title: `${WORLD_BOSS.name}`, theme: WORLD_THEME, units: d.units, events: d.events });
  const got = eco.applyWorldBoss(S.save, { damage: d.damage, gems: d.gems, gold: d.gold });
  S.worldLeft = d.left;
  persist(); sfx('win');
  modal({
    title: '🐲 Удар по Пожирателю миров',
    body: h('div', { class: 'center' }, h('div', { class: 'big-emoji' }, '💥'), h('h2', null, `${fmt(d.damage)} урона`), chips(got)),
    buttons: [{ text: 'Закрыть', cls: 'primary', onClick: () => { rep.close(); refresh(); } }],
  });
}

function worldTab() {
  return loader(async () => ok(await api.world(S.auth.token)), (d) => {
    S.worldLeft = d.left;
    return h('div', null,
      section(`${WORLD_BOSS.emoji} ${WORLD_BOSS.name}`,
        h('p', { class: 'muted small' }, 'Еженедельный босс общий для всех игроков. У героя 12 ходов — нанесите как можно больше урона. Босс подстраивается под ваш уровень.'),
        h('div', { class: 'stat-grid' },
          h('div', null, h('div', { class: 'muted small' }, 'Всего урона'), h('b', null, fmt(d.total))),
          h('div', null, h('div', { class: 'muted small' }, 'Мой урон'), h('b', null, fmt(d.mine))),
          h('div', null, h('div', { class: 'muted small' }, 'Попыток сегодня'), h('b', null, d.left))),
        h('button', { class: 'btn primary wide', disabled: d.left <= 0, on: { click: () => fightWorld() } }, '⚔️ Атаковать')),
      section('Лучшие бойцы недели', d.top.length ? d.top.map((t, i) => h('div', { class: 'rank-row' },
        h('span', { class: 'rank-n' }, i + 1), h('span', { class: 'grow' }, `${CLASSES[t.cls].icon} ${t.name}`), h('b', null, fmt(t.damage)))) : h('p', { class: 'muted' }, 'Пока никто не атаковал')));
  });
}

// ---------------------------------------------------------------- рейтинги
function ranksTab(params) {
  const type = params.board || 'power';
  const labels = { power: ['⚡ Сила', (r) => fmt(r.power)], tower: ['🗼 Башня', (r) => `эт. ${r.tower}`], arena: ['🏟️ Арена', (r) => `★${r.rating}`], stage: ['🗺️ Кампания', (r) => `эт. ${r.stage}`] };
  return h('div', null,
    h('div', { class: 'chips-row' }, Object.entries(labels).map(([id, [label]]) => h('button', { class: `chip-btn ${id === type ? 'active' : ''}`, on: { click: () => go('arena', { tab: 'ranks', board: id }) } }, label))),
    loader(async () => ok(await api.leaderboard(S.auth.token, type)), (d) => section(`Топ игроков${d.myRank ? ` — вы #${d.myRank}` : ''}`,
      d.rows.map((r) => h('div', { class: `rank-row ${r.me ? 'me' : ''}` },
        h('span', { class: 'rank-n' }, r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank),
        h('span', { class: 'grow' }, `${CLASSES[r.cls].icon} ${r.name} `, h('span', { class: 'muted small' }, `ур.${r.level}`)),
        h('b', null, labels[type][1](r)))))));
}

export function renderArena(params = {}) {
  const tab = params.tab || 'arena';
  const head = tabs([['arena', '🏟️ Арена'], ['world', '🐲 Босс'], ['ranks', '🏆 Рейтинг']], tab, (t) => go('arena', { tab: t }));
  if (!S.auth) return h('div', null, head, needAccount());
  const content = { arena: arenaTab, world: worldTab, ranks: () => ranksTab(params) }[tab]();
  return h('div', null, head, content);
}
