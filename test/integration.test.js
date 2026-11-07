// Интеграция: клиент (фейковый DOM) + реальный сервер (MemoryStore). Developer: @yfeeeee
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { install } from './helpers/fakedom.js';
import { createApp } from '../server/app.js';
import { MemoryStore } from '../server/store.js';

let server; let env; let store; let S; let router; let state;
const sleepFor = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 8000) {
  const t0 = Date.now();
  for (;;) { const v = fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('waitFor timeout'); await sleepFor(30); }
}

before(async () => {
  execFileSync(process.execPath, ['client/scripts/prepare.js'], { stdio: 'ignore' });
  store = new MemoryStore();
  server = createApp(store);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  env = install();
  globalThis.GAME_CONFIG = { apiUrl: `http://127.0.0.1:${server.address().port}` };
  await import('../client/www/js/main.js');
  state = await import('../client/www/js/state.js');
  S = state.S;
  router = await import('../client/www/js/router.js');
});
after(() => server.close());

test('онлайн-создание героя регистрирует аккаунт на сервере', async () => {
  env.app.findByText('Начать приключение').click();
  env.app.querySelector('input').value = 'Онлайн';
  env.app.findByText('В путь!').click();
  await waitFor(() => S.save);
  assert.ok(S.auth && S.auth.token, 'есть токен');
  assert.equal(await store.playerCount(), 1);
});

test('синхронизация сохранения', async () => {
  S.save.gold += 777; S.save.stage = 3;
  state.persist({ sync: false });
  assert.equal(await state.syncNow(), true);
  const p = await store.byId(S.auth.id);
  assert.equal(p.save.gold, S.save.gold);
  assert.equal(p.rev, S.auth.rev);
  assert.equal(p.stage, 3);
});

test('арена: загрузка соперников и бой с реплеем', async () => {
  router.go('arena', { tab: 'arena' });
  const btn = await waitFor(() => env.app.findByText('В бой'));
  assert.match(env.app.textContent, /Соперники/);
  btn.click();
  const skip = await waitFor(() => env.body.findByText('Пропустить'), 10000);
  skip.click();
  const title = await waitFor(() => env.body.querySelectorAll('.modal-title').find((e) => /Победа на арене|Поражение/.test(e.textContent)), 20000);
  assert.ok(title);
  assert.equal(S.arenaLeft, 4);
  assert.equal(S.save.arena.wins + S.save.arena.losses, 1);
});

test('мировой босс и рейтинги', async () => {
  env.body.querySelectorAll('.modal-back').forEach((m) => m.remove());
  env.body.querySelectorAll('.battle').forEach((m) => m.remove());
  router.go('arena', { tab: 'world' });
  const atk = await waitFor(() => env.app.findByText('Атаковать'));
  atk.click();
  const skip = await waitFor(() => env.body.findByText('Пропустить'), 10000);
  skip.click();
  await waitFor(() => env.body.querySelectorAll('.modal-title').find((e) => /Удар по Пожирателю/.test(e.textContent)), 20000);
  assert.ok(S.save.world.dmg > 0);
  env.body.querySelectorAll('.modal-back').forEach((m) => m.remove());
  env.body.querySelectorAll('.battle').forEach((m) => m.remove());
  router.go('arena', { tab: 'ranks', board: 'power' });
  await waitFor(() => /Топ игроков/.test(env.app.textContent));
  assert.match(env.app.textContent, /Онлайн/);
});

test('сервер принимает синхронизацию после арены (рейтинг не ломает валидацию)', async () => {
  S.save.gold += 1;
  state.persist({ sync: false });
  assert.equal(await state.syncNow(), true);
});
