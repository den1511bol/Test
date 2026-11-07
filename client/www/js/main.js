// Ashen Crown — запуск, онбординг, оболочка приложения. Developer: @yfeeeee
import { GAME, CLASSES, CLASS_SKILLS, SKILLS } from '../shared/data.js';
import { dayKey, heroStats } from '../shared/progression.js';
import { h, $, fmt, toast } from './ui.js';
import { S, loadLocal, pullOnStart, newGame, tick, onChange } from './state.js';
import { setRenderer, go, current, refresh } from './router.js';
import { renderCampaign } from './campaign.js';
import { renderHero } from './hero.js';
import { renderForge } from './forge.js';
import { renderArena } from './arena.js';
import { renderMore, loginModal } from './more.js';
import { sfx } from './audio.js';

const NAV = [
  ['campaign', '🗺️', 'Поход'],
  ['hero', '🧙', 'Герой'],
  ['forge', '🔨', 'Кузня'],
  ['arena', '🏟️', 'Арена'],
  ['more', '☰', 'Ещё'],
];
const SCREENS = { campaign: renderCampaign, hero: renderHero, forge: renderForge, arena: renderArena, more: renderMore };

const app = $('#app');
let lastKey = '';

function shell() {
  const { name, params } = current();
  const s = S.save;
  const c = CLASSES[s.cls];
  const st = heroStats(s);
  const main = h('main', { class: 'main' });
  try {
    main.appendChild(SCREENS[name](params));
  } catch (e) {
    console.error(e);
    main.appendChild(h('div', { class: 'section' }, h('b', null, 'Ошибка экрана'), h('pre', { class: 'muted small' }, String(e && e.stack || e))));
  }
  const top = h('header', { class: 'topbar' },
    h('div', { class: 'tb-hero', style: { '--cc': c.color } }, h('span', { class: 'tb-ico' }, c.icon), h('div', null, h('div', { class: 'tb-name' }, s.name), h('div', { class: 'muted small' }, `ур. ${s.level} · ⚡${fmt(st.power)}`))),
    h('div', { class: 'tb-wallet' },
      h('span', null, `🪙 ${fmt(s.gold)}`), h('span', null, `💎 ${s.gems}`), h('span', null, `🔹 ${s.dust}`),
      h('span', { class: `dot ${S.auth ? (S.online ? 'on' : 'warn') : 'off'}`, title: S.auth ? (S.online ? 'Онлайн' : 'Нет связи') : 'Локально' })));
  const nav = h('nav', { class: 'nav' }, NAV.map(([id, ico, label]) => h('button', {
    class: `nav-btn ${id === name ? 'active' : ''}`, on: { click: () => { sfx('click'); go(id, {}); } },
  }, h('span', { class: 'nav-ico' }, ico), h('span', null, label))));

  const key = `${name}:${params.tab || ''}:${params.mode || ''}`;
  const prevTop = $('.main') ? $('.main').scrollTop : 0;
  app.replaceChildren(top, main, nav);
  if (key === lastKey) main.scrollTop = prevTop;
  lastKey = key;
}

setRenderer(() => { if (S.save) shell(); });
onChange(() => { /* состояние изменилось — перерисовка по требованию экранов */ });

// ---------------------------------------------------------------- онбординг
function titleScreen() {
  app.replaceChildren(h('div', { class: 'title-screen' },
    h('div', { class: 'title-crown' }, '👑'),
    h('h1', null, GAME.name.toUpperCase()),
    h('div', { class: 'title-sub' }, GAME.title),
    h('p', { class: 'muted center' }, 'Соберите снаряжение, победите восемь боссов и верните Пепельную Корону. Кампания, бесконечная башня, арена и мировой босс.'),
    h('button', { class: 'btn primary big', on: { click: () => { sfx('click'); createScreen(); } } }, 'Начать приключение'),
    h('div', { class: 'muted small' }, `Разработчик: ${GAME.developer} · v${GAME.version}`)));
}

function createScreen() {
  let cls = 'warrior';
  const name = h('input', { class: 'input', maxLength: 16, placeholder: 'Имя героя (2–16 символов)', value: '' });
  const err = h('div', { class: 'bad small' });
  const cards = h('div', { class: 'class-cards' });
  const draw = () => cards.replaceChildren(...Object.values(CLASSES).map((c) => h('div', {
    class: `class-card ${c.id === cls ? 'active' : ''}`, style: { '--cc': c.color }, on: { click: () => { cls = c.id; sfx('click'); draw(); } },
  },
  h('div', { class: 'class-ico' }, c.icon), h('b', null, c.name), h('div', { class: 'muted small' }, c.desc),
  h('div', { class: 'class-skills' }, CLASS_SKILLS[c.id].slice(0, 3).map((id) => h('span', { title: SKILLS[id].name }, SKILLS[id].icon))))));
  draw();
  const go1 = h('button', { class: 'btn primary big', on: { click: async () => {
    const nm = name.value.trim();
    if (nm.length < 2) { err.textContent = 'Имя слишком короткое'; return; }
    go1.disabled = true; err.textContent = '';
    try {
      const online = await newGame(nm, cls);
      sfx('level');
      if (!online) toast('Герой создан локально. Подключить сервер можно в «Ещё → Настройки».', '');
      start();
    } catch (e) {
      err.textContent = e.message || 'Не удалось создать героя';
      go1.disabled = false;
    }
  } } }, 'В путь!');
  app.replaceChildren(h('div', { class: 'create-screen' },
    h('h2', null, 'Создание героя'), name, err, h('div', { class: 'section-title' }, 'Класс'), cards, go1));
}

function start() {
  tick();
  go('campaign', {});
  if (S.save.login.day !== dayKey(Date.now())) setTimeout(loginModal, 400);
}

// периодическое обновление «отдыха»
setInterval(() => {
  if (!S.save || document.querySelector('.modal-back, .battle')) return;
  if (current().name === 'campaign') refresh();
}, 30000);

// ---------------------------------------------------------------- boot
(async function boot() {
  const has = loadLocal();
  if (!has) { titleScreen(); return; }
  start();
  pullOnStart().then(() => { if (S.save) refresh(); });
}());

window.addEventListener('error', (e) => console.error('window error', e.message));
