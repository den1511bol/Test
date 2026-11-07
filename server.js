'use strict';
/*
 * ОХОТНИКИ ЗА ЯДРОМ — мультиплеерная игра с общими боссами (сервер)
 * Developer: @yfeeeee
 *
 * Единственная зависимость: pg (PostgreSQL). Реальное время — Server-Sent Events.
 * Вход: Telegram Login (кнопка-виджет) или ссылка на бота (@autifh_bot).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEVELOPER = '@yfeeeee';
const BUILD = Date.now().toString(36); // меняется при каждом запуске сервера (новая версия игры)
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR =
  process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BOT_NAME = (process.env.TELEGRAM_BOT_USERNAME || 'autifh_bot').replace(/^@/, '');
const DEV_LOGIN = process.env.DEV_LOGIN === '1'; // только для локальной проверки

/* ------------------------------------------------------------------ */
/*  Баланс игры                                                        */
/* ------------------------------------------------------------------ */
const MAT = {
  sk: 'Чертёж', bone: 'Костяная пыль', ember: 'Угольный шлак', gear: 'Шестерня',
  aether: 'Эфир', scale: 'Чешуя', core: 'Ядро',
};
const MK = Object.keys(MAT);
const COST = [
  null,
  { sk: 10, bone: 4, credits: 200 },
  { sk: 20, bone: 10, ember: 4, credits: 600 },
  { sk: 40, bone: 20, ember: 10, gear: 4, credits: 1500 },
  { sk: 70, ember: 20, gear: 10, aether: 4, credits: 4000 },
  { sk: 100, gear: 20, aether: 10, scale: 4, credits: 9000 },
  { sk: 150, aether: 20, scale: 10, core: 4, credits: 20000 },
];
const DMG = [1, 1.6, 2.5, 4, 6.5, 10, 16];
const HP = [25, 50, 85, 130, 200, 300, 430];
const DEF = [1.5, 3, 4.5, 6, 8, 10, 12];
const REG = [0.3, 0.6, 1, 1.5, 2.2, 3, 4];
const DOD = [0.5, 1, 1.5, 2, 3, 4, 5];
const VAMP = [0, 0, 2, 4, 7, 11, 16];
const TRU = [0, 0, 3, 6, 10, 16, 25];
const STUN = [0, 0, 8, 12, 16, 22, 30];
const WB = { vamp: [14, 18], tru: [12, 16], stun: [16, 22] };
const ITEMS = {
  w1: { name: 'Кровавый тесак', slot: 'Оружие', type: 'vamp', desc: 'Вампиризм: лечит при ударе (с 3 ур.)' },
  w2: { name: 'Клинок рассвета', slot: 'Оружие', type: 'tru', desc: 'Истинный урон: игнорирует защиту (с 3 ур.)' },
  w3: { name: 'Боевая секира', slot: 'Оружие', type: 'stun', desc: 'Оглушение: босс пропускает ответный удар (с 3 ур.)' },
  h: { name: 'Шлем стража', slot: 'Голова', k: 0.8 },
  c: { name: 'Нагрудник стража', slot: 'Грудь', k: 1.4 },
  l: { name: 'Поножи стража', slot: 'Ноги', k: 1.1 },
  b: { name: 'Сапоги стража', slot: 'Обувь', k: 0.7 },
};
const ARMOR = ['h', 'c', 'l', 'b'];
const MEDS = {
  patch: { name: 'Пластырь', heal: 0.25, cd: 3000, price: 150 },
  pill: { name: 'Целебная пилюля', heal: 0.7, cd: 5000, price: 600 },
  serum: { name: 'Железная сыворотка', heal: 0.8, cd: 5000, price: 1500 },
};
const BOSS_NAMES = [
  'Лесной слизень', 'Каменный тролль', 'Болотная жаба-король', 'Корнеплёт', 'Грибной шаман',
  'Пещерный нетопырь', 'Рудный голем', 'Могильный жнец', 'Призрачный скакун', 'Огненный бес',
  'Угольный пёс', 'Костяной дракончик', 'Вулканический краб', 'Пепельная вдова', 'Паук-автомат',
  'Заводной рыцарь', 'Паровой бык', 'Ледяной страж', 'Снежный йети', 'Морозная сова',
  'Сигнальный дрон', 'Золотой змей', 'Звёздный странник', 'Песчаный сфинкс', 'Эфирный дракон',
  'Морской левиафан', 'Хранитель ядра', 'Повелитель бездны',
];
const BOSSES = BOSS_NAMES.map((name, i) => ({
  i, name, drop: MK[Math.floor(i / 4)],
  max: Math.max(50, Math.round((900 * Math.pow(1.27, i)) / 50) * 50),
  dmg: Math.round(5 * Math.pow(1.19, i)),
  regen: Math.round(i * 0.4),
  def: Math.min(45, Math.round(i * 1.7)),
  lvl: 1 + i * 14,
}));
const RESPAWN_MS = 30000;
const REST_MS = 15000; // отдых после поражения
const TICK_MS = 3000; // тик регенерации
const ATTACK_CAP = 8; // антиавтокликер: ёмкость «ведра»
const ATTACK_RATE = 4; // атак в секунду
const ACTIVE_MS = 20000; // игрок считается «в бою» 20 с после атаки
const MAX_REPAIR = 100;
const repairCost = (it) => Math.ceil((MAX_REPAIR - it.dur) * it.lvl * 2);

/* ------------------------------------------------------------------ */
/*  Хранилище: PostgreSQL (DATABASE_URL) или JSON-файл для локалки      */
/* ------------------------------------------------------------------ */
const DATABASE_URL = process.env.DATABASE_URL || '';
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db = { users: {}, sessions: {}, nicks: {}, recovery: {}, boss: null, chat: [] };

function readLegacyFile() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('Не удалось прочитать db.json:', e.message);
    return null;
  }
}

function fileStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return {
    name: `JSON-файл ${DB_FILE}`,
    async load() {
      const d = readLegacyFile();
      if (d) db = Object.assign(db, d);
    },
    async save() {
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, DB_FILE);
    },
    async close() {},
  };
}

// В PostgreSQL пишутся только изменившиеся строки (сравнение по JSON).
function pgStore() {
  const { Pool } = require('pg');
  const needSsl = process.env.PGSSL === '1' || /rlwy\.net|proxy\.rlwy/.test(DATABASE_URL);
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    ssl: needSsl ? { rejectUnauthorized: false } : undefined,
  });
  pool.on('error', (e) => console.error('PG pool error:', e.message));
  const seen = { users: new Map(), sessions: new Map(), meta: new Map() };

  return {
    name: 'PostgreSQL',
    async load() {
      await pool.query(`CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
      await pool.query(`CREATE TABLE IF NOT EXISTS sessions (
        token text PRIMARY KEY, user_id text NOT NULL, ts bigint NOT NULL)`);
      await pool.query(`CREATE TABLE IF NOT EXISTS meta (key text PRIMARY KEY, value jsonb NOT NULL)`);

      const users = await pool.query('SELECT id, data FROM users');
      const sessions = await pool.query('SELECT token, user_id, ts FROM sessions');
      const meta = await pool.query('SELECT key, value FROM meta');

      if (!users.rows.length && !meta.rows.length) {
        // Первый запуск: переносим старый db.json, если он есть
        const legacy = readLegacyFile();
        if (legacy) {
          db = Object.assign(db, legacy);
          console.log('Данные из db.json будут перенесены в PostgreSQL');
          return true; // нужно сохранить
        }
      }
      for (const r of users.rows) db.users[r.id] = r.data;
      for (const r of sessions.rows) db.sessions[r.token] = { userId: r.user_id, ts: Number(r.ts) };
      for (const r of meta.rows) {
        if (r.key === 'boss') db.boss = r.value;
        if (r.key === 'chat') db.chat = r.value;
        if (r.key === 'tgchat') db.tgChat = r.value;
      }
      for (const [id, u] of Object.entries(db.users)) seen.users.set(id, JSON.stringify(u));
      for (const [t, x] of Object.entries(db.sessions)) seen.sessions.set(t, `${x.userId}|${x.ts}`);
      seen.meta.set('boss', JSON.stringify(db.boss));
      seen.meta.set('chat', JSON.stringify(db.chat));
      seen.meta.set('tgchat', JSON.stringify(db.tgChat ?? null));
      return false;
    },
    async save() {
      // всё, что нужно записать, собираем синхронно, пока игра не изменила данные
      const uIds = [], uData = [];
      const nowUsers = new Map();
      for (const [id, u] of Object.entries(db.users)) {
        const str = JSON.stringify(u);
        nowUsers.set(id, str);
        if (seen.users.get(id) !== str) { uIds.push(id); uData.push(str); }
      }
      const sTok = [], sUid = [], sTs = [];
      const nowSessions = new Map();
      for (const [t, x] of Object.entries(db.sessions)) {
        nowSessions.set(t, `${x.userId}|${x.ts}`);
        if (!seen.sessions.has(t)) { sTok.push(t); sUid.push(x.userId); sTs.push(x.ts); }
      }
      const sDel = [...seen.sessions.keys()].filter((t) => !db.sessions[t]);
      const metaNow = { boss: JSON.stringify(db.boss), chat: JSON.stringify(db.chat), tgchat: JSON.stringify(db.tgChat ?? null) };
      const metaChanged = Object.keys(metaNow).filter((k) => seen.meta.get(k) !== metaNow[k]);
      if (!uIds.length && !sTok.length && !sDel.length && !metaChanged.length) return;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (uIds.length) {
          await client.query(
            `INSERT INTO users (id, data)
             SELECT t.id, t.data::jsonb FROM unnest($1::text[], $2::text[]) AS t(id, data)
             ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
            [uIds, uData]
          );
        }
        if (sTok.length) {
          await client.query(
            `INSERT INTO sessions (token, user_id, ts)
             SELECT * FROM unnest($1::text[], $2::text[], $3::bigint[])
             ON CONFLICT (token) DO NOTHING`,
            [sTok, sUid, sTs]
          );
        }
        if (sDel.length) await client.query('DELETE FROM sessions WHERE token = ANY($1::text[])', [sDel]);
        for (const k of metaChanged) {
          await client.query(
            `INSERT INTO meta (key, value) VALUES ($1, $2::jsonb)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [k, metaNow[k]]
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
      // запись удалась — запоминаем состояние
      seen.users = nowUsers;
      seen.sessions = nowSessions;
      for (const k of metaChanged) seen.meta.set(k, metaNow[k]);
    },
    close: () => pool.end(),
  };
}

const store = DATABASE_URL ? pgStore() : fileStore();

let dirty = false;
let saving = false;
const saveSoon = () => {
  dirty = true;
};
async function saveNow() {
  if (!dirty || saving) return;
  saving = true;
  dirty = false;
  try {
    await store.save();
  } catch (e) {
    console.error('Ошибка сохранения:', e.message);
    dirty = true;
  } finally {
    saving = false;
  }
}
setInterval(saveNow, 5000).unref();


/* ------------------------------------------------------------------ */
/*  Игровая логика                                                     */
/* ------------------------------------------------------------------ */
const rnd = (a, b) => a + Math.random() * (b - a);
const clean = (s, max) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const bossActive = BOSSES.map(() => new Map()); // userId -> время последней атаки (только в памяти)
let bossDirty = true;

function freshBosses() {
  return { v: 2, list: BOSSES.map((b) => ({ hp: b.max, state: 'alive', respawnAt: 0, dmg: {}, hits: {} })) };
}

function newUser(id, name, tgId, username) {
  const now = Date.now();
  const items = {};
  for (const k of Object.keys(ITEMS)) items[k] = { lvl: 1, dur: MAX_REPAIR };
  return {
    v: 2, id, name, tgId: tgId || '', username: username || '',
    credits: 500, mats: { sk: 10, bone: 4, ember: 0, gear: 0, aether: 0, scale: 0, core: 0 },
    meds: { patch: 3, pill: 1, serum: 0 }, items, eq: { weapon: 'w1' },
    hp: 9999, hpTs: now, dead: 0, medLock: 0, regenUntil: 0, defUntil: 0,
    total: 0, hitsDone: 0, kills: 0, pending: {}, lastChat: 0,
    bucket: ATTACK_CAP, bucketTs: now, created: now,
  };
}

const alive = (u, id) => u.items[id].dur > 0;

function statsOf(u, now = Date.now()) {
  const s = { hp: 100, regen: 1, def: 0, dodge: 2, crit: 5, min: 4, max: 7, vamp: 0, tru: 0, stun: 0 };
  const wid = u.eq.weapon;
  if (alive(u, wid)) {
    const L = u.items[wid].lvl - 1;
    const w = ITEMS[wid];
    const b = WB[w.type];
    s.min = b[0] * DMG[L];
    s.max = b[1] * DMG[L];
    s.crit += L * 1.5;
    if (w.type === 'vamp') s.vamp = VAMP[L];
    if (w.type === 'tru') s.tru = TRU[L];
    if (w.type === 'stun') s.stun = STUN[L];
  }
  for (const id of ARMOR) {
    if (!alive(u, id)) continue;
    const L = u.items[id].lvl - 1;
    const k = ITEMS[id].k;
    s.hp += HP[L] * k;
    s.def += DEF[L] * k;
    s.regen += REG[L] * k;
    s.dodge += DOD[L] * k;
  }
  s.def = Math.min(95, s.def);
  if (now < u.regenUntil) s.regen += 3.5;
  if (now < u.defUntil) s.def = Math.min(95, s.def + 10);
  return s;
}

// Регенерация здоровья по тикам; после отдыха возвращаемся с 30% здоровья.
function syncHp(u, now) {
  const st = statsOf(u, now);
  if (u.dead) {
    if (now < u.dead) return st;
    u.dead = 0;
    u.hp = st.hp * 0.3;
    u.hpTs = now;
  }
  if (u.hp >= st.hp) {
    u.hp = st.hp;
    u.hpTs = now;
    return st;
  }
  const ticks = Math.floor((now - u.hpTs) / TICK_MS);
  if (ticks > 0) {
    u.hp = Math.min(st.hp, u.hp + st.regen * ticks);
    u.hpTs += ticks * TICK_MS;
  }
  return st;
}

function view(u, now = Date.now()) {
  const st = syncHp(u, now);
  return {
    id: u.id, name: u.name, username: u.username,
    credits: u.credits, mats: u.mats, meds: u.meds, items: u.items, eq: u.eq,
    hp: u.hp, stats: st, dead: u.dead, medLock: u.medLock, regenUntil: u.regenUntil, defUntil: u.defUntil,
    total: u.total, kills: u.kills, pending: u.pending, now,
    repair: Object.fromEntries(Object.entries(u.items).map(([k, it]) => [k, repairCost(it)])),
  };
}

function bossesView(now = Date.now()) {
  return db.boss.list.map((b, i) => {
    let n = 0;
    for (const [uid, ts] of bossActive[i]) {
      if (now - ts < ACTIVE_MS) n++;
      else bossActive[i].delete(uid);
    }
    return { hp: Math.max(0, Math.round(b.hp)), state: b.state, respawnAt: b.respawnAt, n };
  });
}

function wear(u, id, n) {
  const it = u.items[id];
  it.dur = Math.max(0, it.dur - n);
}

function killBoss(i, now) {
  const def = BOSSES[i];
  const b = db.boss.list[i];
  const total = Object.values(b.dmg).reduce((a, c) => a + c, 0) || 1;
  let top = null;
  const players = Object.keys(b.hits).length;
  for (const [uid, hits] of Object.entries(b.hits)) {
    const p = db.users[uid];
    if (!p || hits < 1) continue;
    const dmg = b.dmg[uid] || 0;
    const share = dmg / total;
    if (!top || dmg > top.dmg) top = { name: p.name, dmg };
    const chance = Math.min(0.95, 0.06 * hits + 0.1);
    const qty = Math.random() < chance ? 1 + (Math.random() < 0.35 ? 1 : 0) + Math.floor(hits / 15) : 0;
    const prev = p.pending[i] || { credits: 0, qty: 0, dmg: 0, hits: 0 };
    p.pending[i] = {
      credits: prev.credits + Math.floor(def.max * 0.12 * (0.3 + 0.7 * share)),
      drop: def.drop, qty: prev.qty + qty, dmg: prev.dmg + Math.round(dmg), hits: prev.hits + hits,
      players, share: Math.round(share * 100),
    };
    p.kills++;
  }
  b.state = 'respawn';
  b.respawnAt = now + RESPAWN_MS;
  b.hp = 0;
  bossDirty = true;
  pushChat({ sys: true, text: `Босс «${def.name}» повержен! Больше всех урона: ${top ? top.name : '???'}` });
  broadcast('bossDefeated', { i, name: def.name });
  saveSoon();
}

// Один обмен ударами. Возвращает события боя для клиента.
function doAttack(u, i, now) {
  const def = BOSSES[i];
  const b = db.boss.list[i];
  if (!def) return { error: 'Нет такого босса' };
  if (b.state !== 'alive') return { error: 'Босс ещё не возродился' };
  const st = syncHp(u, now);
  if (u.dead) return { error: 'Ты отдыхаешь после поражения' };
  const el = Math.max(0, (now - u.bucketTs) / 1000);
  u.bucket = Math.min(ATTACK_CAP, u.bucket + el * ATTACK_RATE);
  u.bucketTs = now;
  if (u.bucket < 1) return { error: 'Слишком быстро' };
  u.bucket -= 1;
  bossActive[i].set(u.id, now);
  wear(u, u.eq.weapon, 1);
  const ev = [];

  const playerStrike = () => {
    if (Math.random() < 0.12) return ev.push({ k: 'pmiss' }), null;
    if (Math.random() < 0.04) return ev.push({ k: 'bdodge' }), null;
    let d = rnd(st.min, st.max);
    const crit = Math.random() * 100 < st.crit;
    if (crit) d *= 2;
    const stun = Math.random() * 100 < st.stun;
    if (stun) d *= 1.2;
    d = Math.max(1, d * (1 - def.def / 100) + st.tru);
    if (st.vamp) u.hp = Math.min(st.hp, u.hp + st.vamp);
    b.hp -= d;
    b.dmg[u.id] = (b.dmg[u.id] || 0) + d;
    b.hits[u.id] = (b.hits[u.id] || 0) + 1;
    u.total += d;
    u.hitsDone++;
    ev.push({ k: 'hit', d: Math.round(d), crit, stun });
    bossDirty = true;
    return { stun };
  };
  const bossStrike = () => {
    if (Math.random() < 0.1) return void ev.push({ k: 'bmiss' });
    if (Math.random() * 100 < st.dodge) return void ev.push({ k: 'pdodge' });
    const d = Math.max(1, rnd(def.dmg * 0.6, def.dmg) * (1 - st.def / 100));
    u.hp -= d;
    const av = ARMOR.filter((id) => alive(u, id));
    if (av.length) wear(u, av[Math.floor(Math.random() * av.length)], 1);
    ev.push({ k: 'bhit', d: Math.round(d) });
  };

  let killed = false;
  if (Math.random() < 0.5) {
    const r = playerStrike();
    if (b.hp <= 0) killed = true;
    else if (!(r && r.stun)) bossStrike();
  } else {
    bossStrike();
    if (u.hp > 0) {
      playerStrike();
      if (b.hp <= 0) killed = true;
    }
  }
  if (u.hp <= 0) {
    u.hp = 0;
    u.dead = now + REST_MS;
    if (u.credits > 1000) u.credits -= Math.floor(u.credits * 0.07);
    ev.push({ k: 'lost' });
  }
  if (killed) killBoss(i, now);
  return { ev };
}

setInterval(() => {
  const now = Date.now();
  for (let i = 0; i < BOSSES.length; i++) {
    const b = db.boss.list[i];
    if (b.state === 'respawn' && now >= b.respawnAt) {
      b.state = 'alive';
      b.hp = BOSSES[i].max;
      b.dmg = {};
      b.hits = {};
      bossDirty = true;
      saveSoon();
    }
  }
}, 1000).unref();
setInterval(() => {
  for (let i = 0; i < BOSSES.length; i++) {
    const b = db.boss.list[i];
    if (b.state === 'alive' && b.hp < BOSSES[i].max && BOSSES[i].regen) {
      b.hp = Math.min(BOSSES[i].max, b.hp + BOSSES[i].regen);
      bossDirty = true;
    }
  }
}, TICK_MS).unref();

/* ---- Чат ----------------------------------------------------------- */
function pushChat(m, fromTg) {
  const msg = { t: Date.now(), name: m.name || '', text: m.text, sys: !!m.sys };
  db.chat.push(msg);
  if (db.chat.length > 50) db.chat.splice(0, db.chat.length - 50);
  broadcast('chat', msg);
  saveSoon();
  if (!fromTg) tgSend(msg.sys ? '⚔ ' + msg.text : `${msg.name}: ${msg.text}`);
}

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
    rank: i + 1, id: u.id, name: u.name, total: Math.round(u.total), kills: u.kills, online: online.has(u.id),
  }));
  const idx = forId ? all.findIndex((u) => u.id === forId) : -1;
  return { top, me: idx >= 0 ? { rank: idx + 1, total: Math.round(all[idx].total) } : null, players: all.length };
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
  if (clients.size) {
    bossDirty = false;
    broadcast('bosses', bossesView());
  }
}, 1000).unref();
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
/*  HTTP                                                               */
/* ------------------------------------------------------------------ */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
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
      'Cache-Control': p === '/sw.js' || p === '/apk.json' || ext === '.html' ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(data);
  });
}


/* ------------------------------------------------------------------ */
/*  Авторизация через Telegram                                         */
/* ------------------------------------------------------------------ */
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[token] = { userId, ts: Date.now() };
  saveSoon();
  return token;
}

function authUser(req, url) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('t');
  const s = token && db.sessions[token];
  return s && db.users[s.userId] ? { token, user: db.users[s.userId] } : null;
}

// Подпись данных Telegram Login Widget: HMAC-SHA256, ключ — sha256(токен бота).
function verifyWidget(q) {
  if (!TG_TOKEN || !q.hash || !q.id || !q.auth_date) return false;
  const check = Object.keys(q)
    .filter((k) => k !== 'hash')
    .sort()
    .map((k) => `${k}=${q[k]}`)
    .join('\n');
  const key = crypto.createHash('sha256').update(TG_TOKEN).digest();
  const want = crypto.createHmac('sha256', key).update(check).digest('hex');
  const a = Buffer.from(want);
  const b = Buffer.from(String(q.hash));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Date.now() / 1000 - Number(q.auth_date) < 86400;
}

function upsertTg(tg) {
  const id = 'tg' + String(tg.id).replace(/\D/g, '');
  const name = clean([tg.first_name, tg.last_name].filter(Boolean).join(' ') || tg.username || 'Игрок', 24) || 'Игрок';
  let u = db.users[id];
  if (!u) u = db.users[id] = newUser(id, name, String(tg.id), tg.username);
  else {
    u.name = name;
    u.username = tg.username || '';
  }
  saveSoon();
  return u;
}

// Вход по ссылке на бота: игра выдаёт код, бот видит «/start код» и подтверждает вход.
const pendingLogins = new Map(); // code -> { ts, token }
setInterval(() => {
  for (const [c, p] of pendingLogins) if (Date.now() - p.ts > 10 * 60000) pendingLogins.delete(c);
}, 60000).unref();

async function tgApi(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(40000),
  });
  return r.json();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Единственный чат Telegram, связанный с игровым чатом (пересылка в обе стороны).
// Номер из ссылки tg://chat?id=3503048370 — внутренний; для Bot API у супергруппы он с префиксом -100.
const TG_CHAT = Number(process.env.TELEGRAM_CHAT_ID || '-1003503048370');
async function tgSend(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try { await tgApi('sendMessage', { chat_id: TG_CHAT, text: String(text).slice(0, 1000) }); } catch { /* нет связи */ }
}
function fromTelegramChat(m) {
  if (m.from.is_bot || m.text.startsWith('/')) return;
  const name = clean([m.from.first_name, m.from.last_name].filter(Boolean).join(' ') || m.from.username || 'TG', 20);
  const text = clean(m.text, 120);
  if (text) pushChat({ name: name + ' (TG)', text }, true);
}

async function botLoop() {
  if (!TG_TOKEN) {
    console.log('TELEGRAM_BOT_TOKEN не задан: вход через Telegram отключён');
    return;
  }
  try { await tgApi('deleteWebhook'); } catch { /* ок */ }
  let offset = 0;
  for (;;) {
    try {
      const r = await tgApi('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
      if (!r.ok) { await sleep(5000); continue; }
      for (const up of r.result) {
        offset = up.update_id + 1;
        const m = up.message;
        if (!m || !m.from || typeof m.text !== 'string') continue;
        if (m.chat.id === TG_CHAT && !m.text.startsWith('/')) { fromTelegramChat(m); continue; }
        if (m.chat.type !== 'private') continue;
        const mm = m.text.match(/^\/start\s+([a-f0-9]{16,64})/i);
        if (mm) {
          const p = pendingLogins.get(mm[1]);
          if (p && !p.token) {
            p.token = createSession(upsertTg(m.from).id);
            await tgApi('sendMessage', { chat_id: m.chat.id, text: 'Вход выполнен. Возвращайся в игру «Охотники за Ядром».' });
          } else {
            await tgApi('sendMessage', { chat_id: m.chat.id, text: 'Ссылка устарела. Нажми «Войти» в игре ещё раз.' });
          }
        } else if (/^\/start/.test(m.text)) {
          await tgApi('sendMessage', { chat_id: m.chat.id, text: 'Это бот входа в игру «Охотники за Ядром». Открой игру и нажми «Войти через бота».' });
        }
      }
    } catch (e) {
      await sleep(5000);
    }
  }
}

// После загрузки данных: старую игру (Pixel Miners, v1) убираем, чинить нечего.
function afterLoad() {
  if (!db.boss || db.boss.v !== 2 || db.boss.list?.length !== BOSSES.length) db.boss = freshBosses();
  for (const [id, u] of Object.entries(db.users)) if (u.v !== 2) delete db.users[id];
  for (const [t, x] of Object.entries(db.sessions)) {
    if (Date.now() - x.ts > 180 * 86400e3 || !db.users[x.userId]) delete db.sessions[t];
  }
  db.chat = (db.chat || []).filter((m) => m && m.text);
  db.nicks = {};
  db.recovery = {};
}

/* ------------------------------------------------------------------ */
/*  API                                                                */
/* ------------------------------------------------------------------ */
async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/config') {
    return json(res, 200, {
      build: BUILD, developer: DEVELOPER, bot: BOT_NAME, tg: !!TG_TOKEN, dev: DEV_LOGIN,
      bosses: BOSSES, items: ITEMS, armor: ARMOR, cost: COST, mats: MAT, meds: MEDS,
      respawnMs: RESPAWN_MS, restMs: REST_MS, tickMs: TICK_MS,
    });
  }

  if (route === 'POST /api/tg/start') {
    if (!TG_TOKEN) return fail(res, 'Вход через Telegram ещё не настроен на сервере', 503);
    if (limited(req, 'tgstart', 30, 3600e3)) return fail(res, 'Слишком много попыток. Попробуйте позже', 429);
    const code = crypto.randomBytes(12).toString('hex');
    pendingLogins.set(code, { ts: Date.now(), token: null });
    return json(res, 200, { code, link: `https://t.me/${BOT_NAME}?start=${code}` });
  }

  if (route === 'GET /api/tg/poll') {
    const p = pendingLogins.get(String(url.searchParams.get('c') || ''));
    if (!p) return json(res, 200, { expired: true });
    if (!p.token) return json(res, 200, { wait: true });
    pendingLogins.delete(url.searchParams.get('c'));
    return json(res, 200, { token: p.token });
  }

  if (route === 'POST /api/devlogin' && DEV_LOGIN) {
    const body = await readBody(req);
    const name = clean(body.name, 16) || 'Тест';
    const id = 'tg' + (900000 + [...name].reduce((a, c) => a + c.charCodeAt(0), 0));
    const u = db.users[id] || (db.users[id] = newUser(id, name, id, name));
    return json(res, 200, { token: createSession(u.id) });
  }

  const auth = authUser(req, url);
  if (!auth) return fail(res, 'Нужна авторизация', 401);
  const u = auth.user;
  const now = Date.now();
  const body = req.method === 'POST' ? await readBody(req) : {};

  switch (route) {
    case 'GET /api/me':
      saveSoon();
      return json(res, 200, view(u, now));

    case 'GET /api/bosses':
      return json(res, 200, bossesView(now));

    case 'POST /api/attack': {
      const r = doAttack(u, Number(body.boss), now);
      if (r.error) return fail(res, r.error, 409);
      saveSoon();
      return json(res, 200, { ev: r.ev, me: view(u, now), boss: bossesView(now)[Number(body.boss)] });
    }

    case 'POST /api/claim': {
      const i = String(Number(body.boss));
      const p = u.pending[i];
      if (!p) return fail(res, 'Награды нет');
      u.credits += p.credits;
      if (p.qty) u.mats[p.drop] += p.qty;
      delete u.pending[i];
      saveSoon();
      return json(res, 200, { got: p, me: view(u, now) });
    }

    case 'POST /api/med': {
      const m = MEDS[body.k];
      if (!m) return fail(res, 'Неизвестный предмет');
      const st = syncHp(u, now);
      if (u.dead) return fail(res, 'Сначала дождись конца отдыха');
      if (now < u.medLock) return fail(res, 'Медикаменты на перезарядке');
      if (!u.meds[body.k]) return fail(res, 'Нет в запасе');
      u.meds[body.k]--;
      u.hp = Math.min(st.hp, u.hp + st.hp * m.heal);
      u.medLock = now + m.cd;
      if (body.k === 'pill') u.regenUntil = now + 30000;
      if (body.k === 'serum') u.defUntil = now + 60000;
      saveSoon();
      return json(res, 200, view(u, now));
    }

    case 'POST /api/buymed': {
      const m = MEDS[body.k];
      if (!m) return fail(res, 'Неизвестный предмет');
      if (u.credits < m.price) return fail(res, 'Не хватает кредитов');
      u.credits -= m.price;
      u.meds[body.k]++;
      saveSoon();
      return json(res, 200, view(u, now));
    }

    case 'POST /api/upgrade': {
      const it = u.items[body.item];
      if (!it) return fail(res, 'Нет такого предмета');
      const c = COST[it.lvl];
      if (!c) return fail(res, 'Максимальный уровень');
      for (const [k, v] of Object.entries(c)) {
        if ((k === 'credits' ? u.credits : u.mats[k]) < v) return fail(res, 'Не хватает ресурсов');
      }
      for (const [k, v] of Object.entries(c)) {
        if (k === 'credits') u.credits -= v;
        else u.mats[k] -= v;
      }
      it.lvl++;
      saveSoon();
      return json(res, 200, view(u, now));
    }

    case 'POST /api/repair': {
      const it = u.items[body.item];
      if (!it) return fail(res, 'Нет такого предмета');
      const c = repairCost(it);
      if (c < 1) return fail(res, 'Чинить нечего');
      if (u.credits < c) return fail(res, 'Не хватает кредитов');
      u.credits -= c;
      it.dur = MAX_REPAIR;
      saveSoon();
      return json(res, 200, view(u, now));
    }

    case 'POST /api/wear': {
      if (!ITEMS[body.item] || ITEMS[body.item].slot !== 'Оружие') return fail(res, 'Это нельзя надеть');
      u.eq.weapon = body.item;
      saveSoon();
      return json(res, 200, view(u, now));
    }

    case 'POST /api/chat': {
      const text = clean(body.text, 120);
      if (!text) return fail(res, 'Пустое сообщение');
      if (now - u.lastChat < 2000) return fail(res, 'Не так быстро');
      u.lastChat = now;
      pushChat({ name: u.name, text });
      return json(res, 200, { ok: true });
    }

    case 'GET /api/leaderboard':
      return json(res, 200, leaderboard(u.id));

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
      send(res, 'init', { bosses: bossesView(), online: onlineCount(), lb: leaderboard(u.id), chat: db.chat });
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

    // Возврат из окна Telegram Login Widget: проверяем подпись и отдаём токен странице игры
    if (url.pathname === '/auth/tg' && req.method === 'GET') {
      const q = Object.fromEntries(url.searchParams);
      if (!verifyWidget(q)) {
        res.writeHead(302, { Location: '/#tgfail' });
        return res.end();
      }
      const token = createSession(upsertTg(q).id);
      res.writeHead(302, { Location: '/#tg=' + token, 'Cache-Control': 'no-store' });
      return res.end();
    }

    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 'Метод не поддерживается', 405);
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    if (!res.headersSent) fail(res, e.message === 'too large' ? 'Слишком большой запрос' : 'Ошибка сервера', 400);
    else res.end();
  }
});

async function start() {
  try {
    const needSave = await store.load();
    afterLoad();
    if (needSave) dirty = true;
    dirty = true;
    await saveNow();
  } catch (e) {
    console.error('Не удалось подключиться к хранилищу:', e.message);
    process.exit(1);
  }
  server.listen(PORT, () => {
    console.log(`Охотники за Ядром запущены на порту ${PORT}  |  developer ${DEVELOPER}`);
    console.log(`Вход: Telegram (@${BOT_NAME})  |  Хранилище: ${store.name}`);
  });
  botLoop();
}

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  setTimeout(() => process.exit(1), 8000).unref();
  while (saving) await new Promise((r) => setTimeout(r, 50));
  dirty = true;
  await saveNow();
  await store.close().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (e) => console.error('uncaught:', e));
start();
