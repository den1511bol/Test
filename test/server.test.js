// Тесты API сервера (в памяти). Developer: @yfeeeee
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { MemoryStore } from '../server/store.js';
import { cleanName, validateSave } from '../server/validate.js';
import { createCharacter } from '../shared/economy.js';
import { makeBot, botId } from '../server/bots.js';
import { heroStats } from '../shared/progression.js';

let server; let base; let store; let clock = Date.UTC(2026, 10, 7, 12);

before(async () => {
  store = new MemoryStore();
  server = createApp(store, { now: () => clock });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

let a; // игрок A
test('регистрация создаёт героя', async () => {
  const r = await api('POST', '/api/register', { body: { name: 'Алиса', cls: 'mage' } });
  assert.equal(r.status, 200);
  assert.ok(r.json.token.length >= 30);
  assert.equal(r.json.save.cls, 'mage');
  a = r.json;
  const bad = await api('POST', '/api/register', { body: { name: '<script>', cls: 'mage' } });
  assert.equal(bad.status, 400);
  const bad2 = await api('POST', '/api/register', { body: { name: 'Боб', cls: 'dragon' } });
  assert.equal(bad2.status, 400);
});

test('авторизация обязательна', async () => {
  assert.equal((await api('GET', '/api/me')).status, 401);
  assert.equal((await api('GET', '/api/me', { token: 'x'.repeat(30) })).status, 401);
  const me = await api('GET', '/api/me', { token: a.token });
  assert.equal(me.status, 200);
  assert.equal(me.json.arenaLeft, 5);
  assert.equal(me.json.worldLeft, 3);
});

test('сохранение: успех, конфликт и защита от подделок', async () => {
  const save = structuredClone(a.save);
  save.gold += 500; save.stage = 2;
  let r = await api('PUT', '/api/save', { token: a.token, body: { save, rev: a.rev } });
  assert.equal(r.status, 200);
  assert.equal(r.json.rev, 2);

  r = await api('PUT', '/api/save', { token: a.token, body: { save, rev: 1 } });
  assert.equal(r.status, 409);
  assert.equal(r.json.rev, 2);

  const cheat = structuredClone(save); cheat.stage = 70;
  r = await api('PUT', '/api/save', { token: a.token, body: { save: cheat, rev: 2 } });
  assert.equal(r.status, 422);

  const cheat2 = structuredClone(save); cheat2.level = 99;
  r = await api('PUT', '/api/save', { token: a.token, body: { save: cheat2, rev: 2 } });
  assert.equal(r.status, 422);

  const cheat3 = structuredClone(save);
  cheat3.equip.weapon.main.atk = 999999;
  r = await api('PUT', '/api/save', { token: a.token, body: { save: cheat3, rev: 2 } });
  assert.equal(r.status, 422);
  a.rev = 2;
});

test('таблица лидеров', async () => {
  const b = await api('POST', '/api/register', { body: { name: 'Боб', cls: 'warrior' } });
  const lb = await api('GET', '/api/leaderboard?type=stage', { token: b.json.token });
  assert.equal(lb.status, 200);
  assert.equal(lb.json.rows[0].name, 'Алиса');
  assert.equal(lb.json.myRank, 2);
  assert.equal((await api('GET', '/api/leaderboard?type=hax', { token: b.json.token })).status, 400);
});

test('арена: соперники-боты, бой, лимит', async () => {
  const opp = await api('GET', '/api/arena/opponents', { token: a.token });
  assert.equal(opp.status, 200);
  assert.equal(opp.json.opponents.length, 5);
  let last;
  for (let i = 0; i < 5; i++) {
    const target = opp.json.opponents.find((o) => o.id.startsWith('bot:'));
    last = await api('POST', '/api/arena/fight', { token: a.token, body: { opponentId: target.id } });
    assert.equal(last.status, 200, JSON.stringify(last.json));
    assert.ok(last.json.events.length > 3);
    assert.equal(typeof last.json.win, 'boolean');
  }
  assert.equal(last.json.left, 0);
  const sixth = await api('POST', '/api/arena/fight', { token: a.token, body: { opponentId: opp.json.opponents[0].id } });
  assert.equal(sixth.status, 429);
  const me = await api('GET', '/api/me', { token: a.token });
  assert.equal(me.json.arenaLeft, 0);
  clock += 86400000; // новый день
  assert.equal((await api('GET', '/api/me', { token: a.token })).json.arenaLeft, 5);
});

test('арена против реального игрока меняет рейтинги', async () => {
  const c = await api('POST', '/api/register', { body: { name: 'Клара', cls: 'rogue' } });
  const s = structuredClone(c.json.save); s.stage = 1;
  await api('PUT', '/api/save', { token: c.json.token, body: { save: s, rev: 1 } });
  const lb = await api('GET', '/api/leaderboard?type=arena', { token: a.token });
  const clara = lb.json.rows.find((r) => r.name === 'Клара');
  const r = await api('POST', '/api/arena/fight', { token: a.token, body: { opponentId: clara.id } });
  assert.equal(r.status, 200);
  const lb2 = await api('GET', '/api/leaderboard?type=arena', { token: a.token });
  const clara2 = lb2.json.rows.find((x) => x.name === 'Клара');
  assert.notEqual(clara2.rating === 1000 && r.json.delta !== 0, true);
  const self = await api('POST', '/api/arena/fight', { token: a.token, body: { opponentId: a.id } });
  assert.equal(self.status, 400);
});

test('мировой босс: урон копится, лимит 3', async () => {
  let total = 0;
  for (let i = 0; i < 3; i++) {
    const r = await api('POST', '/api/world/fight', { token: a.token });
    assert.equal(r.status, 200);
    assert.ok(r.json.damage >= 0);
    total += r.json.damage;
  }
  assert.equal((await api('POST', '/api/world/fight', { token: a.token })).status, 429);
  const w = await api('GET', '/api/world', { token: a.token });
  assert.equal(w.json.mine, total);
  assert.equal(w.json.top[0].name, 'Алиса');
  assert.equal(w.json.left, 0);
});

test('статика: shared отдаётся, обход пути запрещён', async () => {
  const ok = await fetch(`${base}/shared/data.js`);
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('content-type'), /javascript/);
  const raw = await new Promise((resolve) => {
    import('node:http').then(({ default: http }) => {
      http.get({ host: '127.0.0.1', port: server.address().port, path: '/shared/..%2f..%2fpackage.json' }, (res) => resolve(res.statusCode));
    });
  });
  assert.ok([403, 404].includes(raw));
  assert.equal((await fetch(`${base}/health`)).status, 200);
});

test('валидатор и имена', () => {
  assert.equal(cleanName('  Ли  Лу '), 'Ли Лу');
  assert.equal(cleanName('a'), null);
  assert.equal(cleanName('x'.repeat(20)), null);
  const s = createCharacter('Тест', 'warrior', clock);
  assert.equal(validateSave(s, null), null);
  const bad = structuredClone(s); bad.gold = -5;
  assert.ok(validateSave(bad, null));
});

test('боты детерминированы и сильны по уровню', () => {
  const b1 = makeBot(botId(7, 20)); const b2 = makeBot(botId(7, 20));
  assert.deepEqual(b1.save.equip, b2.save.equip);
  assert.ok(heroStats(makeBot(botId(7, 40)).save).power > heroStats(b1.save).power);
});
