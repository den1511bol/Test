'use strict';
/*
 * PIXEL MINERS — мультиплеерная кликер / идл-игра (сервер)
 * Developer: @yfeeeee
 *
 * Без внешних зависимостей: только встроенные модули Node.js.
 * Реальное время — через Server-Sent Events (SSE).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEVELOPER = '@yfeeeee';
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR =
  process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ------------------------------------------------------------------ */
/*  Баланс игры                                                        */
/* ------------------------------------------------------------------ */
const MINERS = [
  { id: 'dwarf', name: 'Гном', base: 15, dps: 0.1 },
  { id: 'cart', name: 'Вагонетка', base: 100, dps: 1 },
  { id: 'drill', name: 'Бур', base: 1100, dps: 8 },
  { id: 'golem', name: 'Голем', base: 12000, dps: 47 },
  { id: 'dragon', name: 'Дракон', base: 130000, dps: 260 },
  { id: 'portal', name: 'Портал', base: 1400000, dps: 1400 },
];
const GROWTH = 1.15; // рост цены миньонов
const TAP_BASE = 10; // цена первой кирки
const TAP_GROWTH = 1.25; // рост цены кирки
const OFFLINE_CAP = 8 * 3600; // максимум оффлайн-дохода, сек
const REBIRTH_MIN = 1e6; // минимум монет за забег для перерождения
const CRYSTAL_BONUS = 0.1; // +10% к доходу за кристалл
const BUCKET_CAP = 60; // антиавтокликер: ёмкость «ведра»
const BUCKET_RATE = 20; // антиавтокликер: тапов в секунду
const BOSS_NAMES = ['Слизень', 'Кротоед', 'Каменный жук', 'Тролль', 'Циклоп', 'Гидра', 'Левиафан', 'Титан'];

const bossMaxHp = (level) => Math.floor(3000 * Math.pow(1.4, level - 1));
const bossName = (level) => `${BOSS_NAMES[(level - 1) % BOSS_NAMES.length]} Ур.${level}`;

/* ------------------------------------------------------------------ */
/*  Хранилище (JSON-файл, атомарная запись)                            */
/* ------------------------------------------------------------------ */
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db = { users: {}, sessions: {}, nicks: {}, recovery: {}, boss: null, chat: [] };
try {
  db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
} catch (e) {
  if (e.code !== 'ENOENT') console.error('Не удалось прочитать БД:', e.message);
}
if (!db.boss) db.boss = { level: 1, hp: bossMaxHp(1), dmg: {} };

let dirty = false;
const saveSoon = () => {
  dirty = true;
};
function saveNow() {
  if (!dirty) return;
  dirty = false;
  const tmp = DB_FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    console.error('Ошибка сохранения:', e.message);
    dirty = true;
  }
}
setInterval(saveNow, 5000).unref();

/* ------------------------------------------------------------------ */
/*  Игровая логика                                                     */
/* ------------------------------------------------------------------ */
const mult = (u) => 1 + CRYSTAL_BONUS * u.crystals;
const tapPower = (u) => (1 + u.tapLvl) * mult(u);
const dpsOf = (u) =>
  MINERS.reduce((s, m) => s + (u.miners[m.id] || 0) * m.dps, 0) * mult(u);
const rebirthGain = (u) => (u.run >= REBIRTH_MIN ? Math.floor(Math.sqrt(u.run / 1e5)) : 0);

function newUser(id, name, username, photo) {
  const now = Date.now();
  return {
    id, name, username: username || '', photo: photo || '',
    coins: 0, run: 0, total: 0, taps: 0, tapLvl: 0, miners: {},
    crystals: 0, rebirths: 0, bossHits: 0, bossKills: 0,
    last: now, created: now, bucket: BUCKET_CAP, bucketTs: now, reward: null, lastChat: 0,
  };
}

function settle(u, now = Date.now()) {
  const dt = Math.min((now - u.last) / 1000, OFFLINE_CAP);
  if (dt > 0) {
    const gain = dpsOf(u) * dt;
    u.coins += gain;
    u.run += gain;
    u.total += gain;
  }
  u.last = now;
}

function view(u) {
  return {
    id: u.id, name: u.name, username: u.username, photo: u.photo,
    coins: u.coins, run: u.run, total: u.total, taps: u.taps,
    tapLvl: u.tapLvl, miners: u.miners, crystals: u.crystals, rebirths: u.rebirths,
    bossHits: u.bossHits, bossKills: u.bossKills,
    tapPower: tapPower(u), dps: dpsOf(u), mult: mult(u),
    rebirthGain: rebirthGain(u), reward: u.reward, now: Date.now(),
    hasLogin: !!u.nick, nick: u.nick || '',
  };
}

const bulkCost = (base, owned, n, growth = GROWTH) =>
  Math.floor((base * Math.pow(growth, owned) * (Math.pow(growth, n) - 1)) / (growth - 1));

function maxAffordable(base, owned, coins, growth = GROWTH) {
  let n = Math.floor(
    Math.log((coins * (growth - 1)) / (base * Math.pow(growth, owned)) + 1) / Math.log(growth)
  );
  n = Math.max(0, Math.min(n || 0, 1000));
  while (n > 0 && bulkCost(base, owned, n, growth) > coins) n--;
  return n;
}

/* ---- Мировой босс ------------------------------------------------- */
let bossDirty = true;
function bossView() {
  const b = db.boss;
  const top = Object.entries(b.dmg)
    .sort((a, c) => c[1] - a[1])
    .slice(0, 5)
    .map(([id, dmg]) => ({ id, name: db.users[id]?.name || '???', dmg }));
  return { level: b.level, name: bossName(b.level), hp: Math.max(0, b.hp), maxHp: bossMaxHp(b.level), top };
}

function damageBoss(u, dmg) {
  const b = db.boss;
  b.hp -= dmg;
  b.dmg[u.id] = (b.dmg[u.id] || 0) + dmg;
  u.bossHits++;
  bossDirty = true;
  if (b.hp <= 0) defeatBoss();
}

function defeatBoss() {
  const b = db.boss;
  const maxHp = bossMaxHp(b.level);
  const ranked = Object.entries(b.dmg).sort((a, c) => c[1] - a[1]);
  const mvpId = ranked[0]?.[0];
  const ts = Date.now();
  for (const [id] of ranked) {
    const p = db.users[id];
    if (!p) continue;
    const isMvp = id === mvpId;
    const coins = Math.floor(maxHp * 0.25) + (isMvp ? Math.floor(maxHp * 0.25) : 0);
    p.coins += coins;
    p.run += coins;
    p.total += coins;
    p.bossKills++;
    p.reward = { level: b.level, coins, mvp: isMvp, ts };
  }
  const top = bossView().top;
  pushChat({ sys: true, text: `Босс «${bossName(b.level)}» повержен! MVP: ${db.users[mvpId]?.name || '???'}` });
  broadcast('bossDefeated', { level: b.level, name: bossName(b.level), top });
  db.boss = { level: b.level + 1, hp: bossMaxHp(b.level + 1), dmg: {} };
  bossDirty = true;
  saveSoon();
}

function applyTaps(u, n, now) {
  const elapsed = Math.max(0, (now - u.bucketTs) / 1000);
  u.bucket = Math.min(BUCKET_CAP, u.bucket + elapsed * BUCKET_RATE);
  u.bucketTs = now;
  const k = Math.max(0, Math.min(Math.floor(n) || 0, Math.floor(u.bucket), 200));
  u.bucket -= k;
  if (k > 0) {
    const gain = k * tapPower(u);
    u.coins += gain;
    u.run += gain;
    u.total += gain;
    u.taps += k;
    damageBoss(u, gain);
  }
  return k;
}

/* ---- Чат ----------------------------------------------------------- */
function pushChat(m) {
  const msg = { t: Date.now(), name: m.name || '', text: m.text, sys: !!m.sys };
  db.chat.push(msg);
  if (db.chat.length > 50) db.chat.splice(0, db.chat.length - 50);
  broadcast('chat', msg);
  saveSoon();
}

const clean = (s, max) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/* ---- Рейтинг -------------------------------------------------------- */
let lbCache = { ts: 0, list: [] };
function sortedUsers() {
  if (Date.now() - lbCache.ts > 3000) {
    lbCache = { ts: Date.now(), list: Object.values(db.users).sort((a, b) => b.total - a.total) };
  }
  return lbCache.list;
}
function leaderboard(forId) {
  const all = sortedUsers();
  const online = new Set([...clients].map((c) => c.userId));
  const top = all.slice(0, 20).map((u, i) => ({
    rank: i + 1, id: u.id, name: u.name, photo: u.photo, total: u.total,
    crystals: u.crystals, online: online.has(u.id),
  }));
  const idx = forId ? all.findIndex((u) => u.id === forId) : -1;
  return { top, me: idx >= 0 ? { rank: idx + 1, total: all[idx].total } : null, players: all.length };
}

/* ------------------------------------------------------------------ */
/*  SSE (реальное время)                                               */
/* ------------------------------------------------------------------ */
const clients = new Set();
function send(res, type, data) {
  res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}
function broadcast(type, data) {
  for (const c of clients) send(c.res, type, data);
}
const onlineCount = () => new Set([...clients].map((c) => c.userId)).size;

setInterval(() => {
  if (bossDirty && clients.size) {
    bossDirty = false;
    broadcast('boss', bossView());
  }
}, 500).unref();
setInterval(() => {
  if (clients.size) {
    broadcast('online', { count: onlineCount() });
    for (const c of clients) send(c.res, 'lb', leaderboard(c.userId));
  }
}, 6000).unref();
setInterval(() => {
  for (const c of clients) c.res.write(': hb\n\n');
}, 20000).unref();

/* ------------------------------------------------------------------ */
/*  Авторизация                                                        */
/* ------------------------------------------------------------------ */
const NICK_RE = /^[\p{L}\p{N}_]{3,16}$/u;
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');

function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + crypto.scryptSync(secret, salt, 32).toString('hex');
}
function checkSecret(secret, stored) {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(':');
  const h = crypto.scryptSync(secret, Buffer.from(saltHex, 'hex'), 32);
  const want = Buffer.from(hashHex, 'hex');
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[token] = { userId, ts: Date.now() };
  saveSoon();
  return token;
}

// Код восстановления: 12 символов (≈60 бит), в базе хранится только sha256.
function issueCode(u) {
  if (u.recKey) delete db.recovery[u.recKey];
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let raw = '';
  for (const byte of crypto.randomBytes(12)) raw += alphabet[byte % alphabet.length];
  const code = raw.match(/.{4}/g).join('-');
  u.recKey = sha(raw);
  db.recovery[u.recKey] = u.id;
  saveSoon();
  return code;
}
const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function createGuest() {
  const id = 'g' + crypto.randomBytes(8).toString('hex');
  const u = (db.users[id] = newUser(id, 'Гость' + (1000 + Math.floor(Math.random() * 9000)), '', ''));
  return { token: createSession(id), code: issueCode(u) };
}

// Проверка ника и пароля; возвращает текст ошибки или null.
function validateCreds(nick, password, selfId) {
  if (!NICK_RE.test(nick)) return 'Ник: 3–16 символов, буквы, цифры и _';
  if (typeof password !== 'string' || password.length < 6 || password.length > 64) return 'Пароль: от 6 до 64 символов';
  const owner = db.nicks[nick.toLowerCase()];
  if (owner && owner !== selfId) return 'Этот ник уже занят';
  return null;
}
function setCreds(u, nick, password) {
  if (u.nick) delete db.nicks[u.nick.toLowerCase()];
  u.nick = nick;
  u.name = nick;
  u.pass = hashSecret(password);
  db.nicks[nick.toLowerCase()] = u.id;
  saveSoon();
}

const failLogins = new Map(); // защита от подбора пароля по нику
function loginBlocked(key) {
  const f = failLogins.get(key);
  return f && f.n >= 8 && Date.now() - f.t < 15 * 60000;
}
function loginFailed(key) {
  const f = failLogins.get(key);
  failLogins.set(key, !f || Date.now() - f.t > 15 * 60000 ? { n: 1, t: Date.now() } : { n: f.n + 1, t: Date.now() });
}

function authUser(req, url) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('t');
  const s = token && db.sessions[token];
  return s ? { token, user: db.users[s.userId] } : null;
}

// чистим старые сессии
for (const [t, s] of Object.entries(db.sessions)) {
  if (Date.now() - s.ts > 180 * 86400e3) delete db.sessions[t];
}

/* ------------------------------------------------------------------ */
/*  HTTP                                                               */
/* ------------------------------------------------------------------ */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};
const fail = (res, msg, code = 400) => json(res, code, { error: msg });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 4096) {
        reject(new Error('too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {});
      } catch {
        reject(new Error('bad json'));
      }
    });
    req.on('error', reject);
  });
}

const hits = new Map(); // простой лимит запросов по IP
function limited(req, key, max, windowMs) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const k = `${key}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(k, arr);
  return arr.length > max;
}
setInterval(() => hits.clear(), 3600e3).unref();

function serveStatic(req, res, pathname) {
  let p = decodeURIComponent(pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return fail(res, 'forbidden', 403);
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': p === '/sw.js' || ext === '.html' ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(data);
  });
}

async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/config') {
    return json(res, 200, {
      miners: MINERS, growth: GROWTH, tapBase: TAP_BASE, tapGrowth: TAP_GROWTH,
      rebirthMin: REBIRTH_MIN, crystalBonus: CRYSTAL_BONUS, developer: DEVELOPER,
    });
  }

  if (route === 'POST /api/guest') {
    if (limited(req, 'guest', 5, 3600e3)) return fail(res, 'Слишком много новых гостей с вашего адреса. Попробуйте позже', 429);
    return json(res, 200, createGuest());
  }

  if (route === 'POST /api/register') {
    if (limited(req, 'reg', 5, 3600e3)) return fail(res, 'Слишком много регистраций. Попробуйте позже', 429);
    const body = await readBody(req);
    const nick = String(body.nick || '').trim();
    const err = validateCreds(nick, body.password, null);
    if (err) return fail(res, err);
    const id = 'u' + crypto.randomBytes(8).toString('hex');
    const u = (db.users[id] = newUser(id, nick, '', ''));
    setCreds(u, nick, body.password);
    return json(res, 200, { token: createSession(id), code: issueCode(u) });
  }

  if (route === 'POST /api/login') {
    if (limited(req, 'login', 15, 60000)) return fail(res, 'Слишком часто. Подождите минуту', 429);
    const body = await readBody(req);
    const nick = String(body.nick || '').trim().toLowerCase();
    if (loginBlocked(nick)) return fail(res, 'Слишком много неверных попыток. Подождите 15 минут', 429);
    const u = db.users[db.nicks[nick]];
    const pass = typeof body.password === 'string' ? body.password.slice(0, 64) : '';
    if (!u || !checkSecret(pass, u.pass)) {
      loginFailed(nick);
      return fail(res, 'Неверный ник или пароль', 401);
    }
    failLogins.delete(nick);
    return json(res, 200, { token: createSession(u.id) });
  }

  if (route === 'POST /api/recover') {
    if (limited(req, 'rec', 10, 60000)) return fail(res, 'Слишком часто. Подождите минуту', 429);
    const body = await readBody(req);
    const id = db.recovery[sha(normCode(body.code))];
    if (!id || !db.users[id]) return fail(res, 'Неверный код восстановления', 401);
    return json(res, 200, { token: createSession(id) });
  }

  const auth = authUser(req, url);
  if (!auth || !auth.user) return fail(res, 'Нужна авторизация', 401);
  const u = auth.user;
  const now = Date.now();

  switch (route) {
    case 'GET /api/me':
      settle(u, now);
      saveSoon();
      return json(res, 200, view(u));

    case 'POST /api/tap': {
      const body = await readBody(req);
      settle(u, now);
      const accepted = applyTaps(u, Number(body.n), now);
      saveSoon();
      return json(res, 200, { ...view(u), accepted });
    }

    case 'POST /api/buy': {
      const body = await readBody(req);
      settle(u, now);
      let base, owned, growth;
      if (body.item === 'tap') {
        base = TAP_BASE; owned = u.tapLvl; growth = TAP_GROWTH;
      } else {
        const m = MINERS.find((x) => x.id === body.item);
        if (!m) return fail(res, 'Неизвестный предмет');
        base = m.base; owned = u.miners[m.id] || 0; growth = GROWTH;
      }
      const n =
        body.qty === 'max'
          ? maxAffordable(base, owned, u.coins, growth)
          : Math.max(1, Math.min(Math.floor(Number(body.qty)) || 1, 1000));
      if (n < 1) return fail(res, 'Недостаточно монет');
      const cost = bulkCost(base, owned, n, growth);
      if (cost > u.coins) return fail(res, 'Недостаточно монет');
      u.coins -= cost;
      if (body.item === 'tap') u.tapLvl += n;
      else u.miners[body.item] = owned + n;
      saveSoon();
      return json(res, 200, view(u));
    }

    case 'POST /api/rebirth': {
      settle(u, now);
      const gain = rebirthGain(u);
      if (gain < 1) return fail(res, `Нужно заработать за забег минимум ${REBIRTH_MIN} монет`);
      u.crystals += gain;
      u.rebirths++;
      u.coins = 0; u.run = 0; u.tapLvl = 0; u.miners = {};
      pushChat({ sys: true, text: `${u.name} переродился и получил ${gain} кристаллов!` });
      saveSoon();
      return json(res, 200, view(u));
    }

    case 'POST /api/chat': {
      const body = await readBody(req);
      const text = clean(body.text, 120);
      if (!text) return fail(res, 'Пустое сообщение');
      if (now - u.lastChat < 2000) return fail(res, 'Не так быстро');
      u.lastChat = now;
      pushChat({ name: u.name, text });
      return json(res, 200, { ok: true });
    }

    case 'GET /api/leaderboard':
      return json(res, 200, leaderboard(u.id));

    case 'POST /api/bind': {
      const body = await readBody(req);
      const nick = String(body.nick || '').trim();
      if (u.nick) {
        if (!checkSecret(String(body.old || '').slice(0, 64), u.pass)) return fail(res, 'Старый пароль неверный', 403);
      }
      const err = validateCreds(nick, body.password, u.id);
      if (err) return fail(res, err);
      setCreds(u, nick, body.password);
      return json(res, 200, view(u));
    }

    case 'POST /api/newcode':
      return json(res, 200, { code: issueCode(u) });

    case 'POST /api/logout':
      delete db.sessions[auth.token];
      saveSoon();
      return json(res, 200, { ok: true });

    case 'GET /api/stream': {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      const client = { res, userId: u.id };
      clients.add(client);
      req.on('close', () => {
        clients.delete(client);
        broadcast('online', { count: onlineCount() });
      });
      send(res, 'init', {
        boss: bossView(), online: onlineCount(), lb: leaderboard(u.id), chat: db.chat,
      });
      broadcast('online', { count: onlineCount() });
      return;
    }
  }
  return fail(res, 'Не найдено', 404);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health') return json(res, 200, { ok: true, dev: DEVELOPER });

    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 'Метод не поддерживается', 405);
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    if (!res.headersSent) fail(res, e.message === 'too large' ? 'Слишком большой запрос' : 'Ошибка сервера', 400);
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`⛏  Pixel Miners запущен на порту ${PORT}  |  developer ${DEVELOPER}`);
  console.log(`   Вход: гость + код восстановления, ник + пароль  |  Данные: ${DATA_DIR}`);
});

function shutdown() {
  dirty = true;
  saveNow();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (e) => console.error('uncaught:', e));
