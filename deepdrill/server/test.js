// Тесты API облачных сохранений. Разработчик: @yfeeeee
const test = require('node:test');
const assert = require('node:assert');
const { makeServer, MemoryStore } = require('./index.js');

let srv, base;
test.before(async () => {
  srv = makeServer(new MemoryStore());
  await new Promise((r) => srv.listen(0, r));
  base = `http://127.0.0.1:${srv.address().port}`;
});
test.after(() => srv.close());

const call = async (method, path, body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { code: r.status, body: await r.json().catch(() => ({})) };
};
const ID = 'abcdefghij0123456789abcd';

test('health', async () => { assert.strictEqual((await call('GET', '/health')).code, 200); });
test('register, save, load, leaderboard', async () => {
  const reg = await call('POST', '/api/drill/register', { device_id: ID, name: 'Тест' });
  assert.strictEqual(reg.code, 200);
  assert.ok(reg.body.token);
  assert.strictEqual((await call('POST', '/api/drill/register', { device_id: ID })).code, 409);
  assert.strictEqual((await call('GET', `/api/drill/save?device_id=${ID}`, null, reg.body.token)).code, 404);
  const save = { max_depth: 321.5, cores: 7, res: { copper: 5 }, token: 'secret' };
  assert.strictEqual((await call('PUT', '/api/drill/save', { device_id: ID, name: 'Тест', save }, reg.body.token)).code, 200);
  const got = await call('GET', `/api/drill/save?device_id=${ID}`, null, reg.body.token);
  assert.strictEqual(got.body.save.res.copper, 5);
  assert.strictEqual(got.body.save.token, '');
  const lb = await call('GET', '/api/drill/leaderboard');
  assert.strictEqual(lb.body.rows[0].max_depth, 321);
  assert.strictEqual(lb.body.rows[0].name, 'Тест');
});
test('auth and validation', async () => {
  assert.strictEqual((await call('PUT', '/api/drill/save', { device_id: ID, save: { max_depth: 1 } }, 'wrong')).code, 401);
  const reg = await call('POST', '/api/drill/register', { device_id: 'zzzzzzzzzzzzzzzzzzzzzzzz' });
  assert.strictEqual((await call('PUT', '/api/drill/save', { device_id: 'zzzzzzzzzzzzzzzzzzzzzzzz', save: { max_depth: -5, cores: 0 } }, reg.body.token)).code, 400);
  assert.strictEqual((await call('POST', '/api/drill/register', { device_id: 'x' })).code, 400);
});
