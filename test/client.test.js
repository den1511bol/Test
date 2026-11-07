// Смоук-тест клиента на фейковом DOM: все экраны рендерятся, бой проходит. Developer: @yfeeeee
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { install } from './helpers/fakedom.js';

let env; let S; let router; let eco; let progression;
const sleepFor = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  execFileSync(process.execPath, ['client/scripts/prepare.js'], { stdio: 'ignore' });
  env = install();
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  // Boot запускается при импорте main.js
  await import('../client/www/js/main.js');
  S = (await import('../client/www/js/state.js')).S;
  router = await import('../client/www/js/router.js');
  eco = await import('../client/www/shared/economy.js');
  progression = await import('../client/www/shared/progression.js');
});

test('титульный экран и создание героя (офлайн)', async () => {
  assert.match(env.app.textContent, /ASHEN CROWN/);
  const start = env.app.findByText('Начать приключение');
  assert.ok(start);
  start.click();
  assert.match(env.app.textContent, /Создание героя/);
  const input = env.app.querySelector('input');
  input.value = 'Тестер';
  env.app.findByText('В путь!').click();
  await sleepFor(300);
  assert.ok(S.save, 'герой создан');
  assert.equal(S.save.name, 'Тестер');
  assert.equal(S.auth, null); // сервер недоступен
  assert.match(env.app.textContent, /Кампания/);
});

test('все экраны и вкладки рендерятся без ошибок', () => {
  const screens = {
    campaign: [{}, { mode: 'tower' }],
    hero: ['gear', 'bag', 'skills', 'talents', 'spirits'].map((tab) => ({ tab })),
    forge: ['enhance', 'chests', 'salvage'].map((tab) => ({ tab })),
    arena: ['arena', 'world', 'ranks'].map((tab) => ({ tab })),
    more: ['quests', 'ach', 'shop', 'settings'].map((tab) => ({ tab })),
  };
  // наполняем героя, чтобы отрисовать больше состояний
  S.save.gold = 1e6; S.save.gems = 1000; S.save.dust = 500; S.save.level = 30; S.save.talentPts = 5;
  eco.addShards(S.save, 'fox', 20);
  for (let i = 0; i < 8; i++) eco.openChest(S.save, 'gold', { next: Math.random, range: (a, b) => a + (b - a) * Math.random(), int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), chance: (p) => Math.random() < p, pick: (arr) => arr[Math.floor(Math.random() * arr.length)], weighted: (w) => { let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; }, shuffle: (a) => a.slice().sort(() => Math.random() - 0.5) });
  for (const [name, list] of Object.entries(screens)) {
    for (const p of list) {
      router.go(name, p);
      const txt = env.app.textContent;
      assert.ok(!/Ошибка экрана/.test(txt), `экран ${name} ${JSON.stringify(p)}: ${txt.slice(0, 300)}`);
      assert.ok(txt.length > 50, `экран ${name} пуст`);
    }
  }
});

test('кнопки на экранах работают (клики)', () => {
  router.go('hero', { tab: 'talents' });
  const plus = env.app.findByText('+');
  plus.click();
  assert.ok(S.save.talentPts <= 4);
  router.go('forge', { tab: 'chests' });
  const gems0 = S.save.gems;
  env.app.findByText('💎 60').click();
  assert.ok(S.save.gems < gems0);
  router.go('more', { tab: 'settings' });
  assert.match(env.app.textContent, /@yfeeeee/);
  router.go('hero', { tab: 'gear' });
  const slotCards = env.app.querySelectorAll('div').filter((e) => e.className.startsWith('item '));
  assert.ok(slotCards.length >= 1);
  slotCards[0].click(); // откроет модалку предмета
  assert.ok(env.body.querySelector('.modal-back'));
});

test('живой бой проходит до конца (авто, высокая скорость)', async () => {
  S.save.level = 30; S.save.settings.auto = true; S.save.settings.speed = 300;
  const { fightStage } = await import('../client/www/js/campaign.js');
  S.save.stage = 0;
  fightStage(1);
  // ждём модалку результата
  let result;
  for (let i = 0; i < 400 && !result; i++) {
    await sleepFor(25);
    result = env.body.querySelectorAll('.modal-title').find((e) => /Победа|Поражение|Бегство/.test(e.textContent));
  }
  assert.ok(result, 'бой завершился');
  assert.match(result.textContent, /Победа/);
  assert.ok(S.save.stage >= 1);
  assert.ok(S.save.stats.kills > 0);
});

test('сохранение в localStorage и повторная загрузка', () => {
  const raw = env.store.get('ac.save');
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.name, 'Тестер');
  assert.ok(parsed.stage >= 1);
});

test('повторный вход: прогресс загружается', async () => {
  const { loadLocal } = await import('../client/www/js/state.js');
  S.save = null;
  assert.equal(loadLocal(), true);
  assert.equal(S.save.name, 'Тестер');
  void progression;
});
