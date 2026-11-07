// Ashen Crown — HTTP API + раздача веб-клиента. Developer: @yfeeeee
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GAME, CLASSES } from '../shared/data.js';
import { RNG } from '../shared/rng.js';
import { simulate } from '../shared/engine.js';
import { heroUnit, heroStats, buildWorldBossWave, dayKey, weekKey } from '../shared/progression.js';
import { createCharacter, ARENA_DAILY_FIGHTS, WORLD_DAILY_FIGHTS } from '../shared/economy.js';
import { sha256 } from './store.js';
import { cleanName, validateSave, MAX_SAVE_BYTES } from './validate.js';
import { isBot, botId, makeBot } from './bots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WEB_ROOT = path.join(ROOT, 'client', 'www');
const SHARED_ROOT = path.join(ROOT, 'shared');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};

class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

// ---------------------------------------------------------------- лимитер запросов
function makeLimiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const rec = hits.get(key);
    if (!rec || now - rec.t > windowMs) { hits.set(key, { t: now, n: 1 }); return true; }
    rec.n++;
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.t > windowMs) hits.delete(k);
    return rec.n <= max;
  };
}

const elo = (ra, rd, score, k = 32) => Math.round(k * (score - 1 / (1 + 10 ** ((rd - ra) / 400))));

export function createApp(store, { now = () => Date.now() } = {}) {
  const apiLimit = makeLimiter(240, 60_000);
  const regLimit = makeLimiter(8, 60_000);

  const send = (res, status, body, headers = {}) => {
    const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': typeof body === 'string' || Buffer.isBuffer(body) ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      ...headers,
    });
    res.end(data);
  };

  const readJson = (req) => new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_SAVE_BYTES + 4096) { reject(new HttpError(413, 'Слишком большой запрос')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'Некорректный JSON')); }
    });
    req.on('error', reject);
  });

  const auth = async (req) => {
    const h = req.headers.authorization || '';
    const m = /^Bearer ([A-Za-z0-9_-]{20,80})$/.exec(h);
    if (!m) throw new HttpError(401, 'Нужна авторизация');
    const p = await store.byToken(sha256(m[1]));
    if (!p) throw new HttpError(401, 'Неизвестный токен');
    return p;
  };

  // ------------------------------------------------------------ маршруты
  const routes = {
    'GET /api/info': async () => ({
      name: GAME.name, version: GAME.version, developer: GAME.developer, store: store.kind,
      players: await store.playerCount(), time: now(),
    }),

    'POST /api/register': async (req) => {
      const body = await readJson(req);
      const name = cleanName(body.name);
      if (!name) throw new HttpError(400, 'Имя: 2–16 символов (буквы, цифры, пробел, _ - .)');
      if (!CLASSES[body.cls]) throw new HttpError(400, 'Неизвестный класс');
      const t = now();
      let save;
      if (body.save && typeof body.save === 'object') {
        // привязка офлайн-героя: принимаем структурно корректное сохранение
        save = body.save;
        save.name = name;
        save.cls = body.cls;
        const err = validateSave(save, null, t);
        if (err) throw new HttpError(422, `Сохранение отклонено: ${err}`);
      } else {
        save = createCharacter(name, body.cls, t);
      }
      const token = crypto.randomBytes(24).toString('base64url');
      const id = crypto.randomUUID();
      await store.createPlayer({
        id, tokenHash: sha256(token), name, cls: body.cls, save,
        level: save.level, power: heroStats(save).power, stage: save.stage, tower: save.tower, rating: 1000,
      });
      return { id, token, rev: 1, save, rating: 1000 };
    },

    'GET /api/me': async (req) => {
      const p = await auth(req);
      await store.touch(p.id);
      const day = dayKey(now());
      return {
        id: p.id, rev: p.rev, save: p.save, rating: p.rating, time: now(),
        arenaLeft: ARENA_DAILY_FIGHTS - (await store.usedToday(p.id, 'arena', day)),
        worldLeft: WORLD_DAILY_FIGHTS - (await store.usedToday(p.id, 'world', day)),
      };
    },

    'PUT /api/save': async (req) => {
      const p = await auth(req);
      const body = await readJson(req);
      if (!Number.isInteger(body.rev)) throw new HttpError(400, 'Нужен rev');
      if (body.rev !== p.rev) throw new HttpError(409, 'Конфликт версий', { rev: p.rev, save: p.save });
      const err = validateSave(body.save, p.save, now());
      if (err) throw new HttpError(422, `Сохранение отклонено: ${err}`);
      const st = heroStats(body.save);
      const rev = await store.saveIfRev(p.id, p.rev, {
        save: body.save, name: body.save.name, level: body.save.level, power: st.power,
        stage: body.save.stage, tower: body.save.tower,
      });
      if (rev == null) {
        const cur = await store.byId(p.id);
        throw new HttpError(409, 'Конфликт версий', { rev: cur.rev, save: cur.save });
      }
      return { rev, rating: p.rating };
    },

    'GET /api/leaderboard': async (req, url) => {
      const type = url.searchParams.get('type') || 'power';
      if (!['power', 'tower', 'arena', 'stage'].includes(type)) throw new HttpError(400, 'Неизвестный тип');
      const p = await auth(req);
      const rows = await store.leaderboard(type, 50);
      return {
        type,
        rows: rows.map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, cls: r.cls, level: r.level, power: r.power, stage: r.stage, tower: r.tower, rating: r.rating, me: r.id === p.id })),
        myRank: await store.rankOf(type, p.id),
      };
    },

    'GET /api/arena/opponents': async (req) => {
      const p = await auth(req);
      const day = dayKey(now());
      const real = await store.arenaCandidates(p.rating, p.id, 5);
      const list = real.map((r) => ({ id: r.id, name: r.name, cls: r.cls, level: r.level, power: r.power, rating: r.rating }));
      const rng = new RNG(`${p.id}:${day}`);
      let i = 0;
      while (list.length < 5) {
        const lv = Math.max(1, Math.min(60, p.level + rng.int(-2, 3) + i));
        const b = makeBot(botId(rng.int(1, 9999), lv));
        list.push({ id: b.id, name: b.name, cls: b.cls, level: b.level, power: b.power, rating: b.rating });
        i++;
      }
      return {
        opponents: list, rating: p.rating,
        left: ARENA_DAILY_FIGHTS - (await store.usedToday(p.id, 'arena', day)),
      };
    },

    'POST /api/arena/fight': async (req) => {
      const p = await auth(req);
      const body = await readJson(req);
      const id = String(body.opponentId || '');
      if (id === p.id) throw new HttpError(400, 'Нельзя сражаться с собой');
      let opp;
      if (isBot(id)) opp = makeBot(id);
      else {
        opp = await store.byId(id);
        if (!opp) throw new HttpError(404, 'Соперник не найден');
      }
      const day = dayKey(now());
      const used = await store.useLimit(p.id, 'arena', day, ARENA_DAILY_FIGHTS);
      if (used == null) throw new HttpError(429, 'Лимит боёв на арене на сегодня исчерпан');

      const a = heroUnit(p.save, 'a');
      const d = heroUnit(opp.save, 'd');
      const seed = crypto.randomInt(1, 2 ** 31);
      const out = simulate({ heroes: [a], waves: [[d]], seed, maxTurns: 300 }, { log: true });
      const win = out.win;
      const rd = isBot(id) ? opp.rating : opp.rating;
      const delta = elo(p.rating, rd, win ? 1 : 0);
      const rating = Math.max(0, p.rating + delta);
      await store.setRating(p.id, rating);
      if (!isBot(id)) await store.setRating(opp.id, Math.max(0, opp.rating - Math.round(delta / 2)));
      await store.logArena(p.id, id, win, delta);
      return {
        win, delta, rating, left: ARENA_DAILY_FIGHTS - used, seed,
        events: out.events,
        units: [
          { id: 'a', name: a.name, emoji: a.emoji, color: a.color, maxHp: a.stats.hp, team: 'A', hero: true },
          { id: 'd', name: opp.name, emoji: d.emoji, color: d.color, maxHp: d.stats.hp, team: 'B', hero: true },
        ],
        opponent: { name: opp.name, cls: opp.cls, level: opp.level, power: opp.power ?? heroStats(opp.save).power },
      };
    },

    'GET /api/world': async (req) => {
      const p = await auth(req);
      const t = now();
      const week = weekKey(t);
      return {
        week, total: await store.worldTotal(week), top: await store.worldTop(week, 10),
        mine: await store.worldMine(week, p.id),
        left: WORLD_DAILY_FIGHTS - (await store.usedToday(p.id, 'world', dayKey(t))),
      };
    },

    'POST /api/world/fight': async (req) => {
      const p = await auth(req);
      const t = now();
      const used = await store.useLimit(p.id, 'world', dayKey(t), WORLD_DAILY_FIGHTS);
      if (used == null) throw new HttpError(429, 'Попытки на сегодня закончились');
      const hero = heroUnit(p.save, 'hero');
      const seed = crypto.randomInt(1, 2 ** 31);
      const out = simulate({ heroes: [hero], waves: buildWorldBossWave(p.save.level), seed, maxHeroTurns: 12 }, { log: true });
      const damage = out.heroes[0].dealt;
      const week = weekKey(t);
      await store.addWorldDamage(week, p.id, damage);
      return {
        damage, gems: 3 + Math.min(12, Math.floor(damage / 20000)), gold: Math.min(50000, Math.floor(damage / 10)),
        left: WORLD_DAILY_FIGHTS - used, seed, events: out.events,
        units: [
          { id: 'hero', name: hero.name, emoji: hero.emoji, color: hero.color, maxHp: hero.stats.hp, team: 'A', hero: true },
          { id: 'wboss', name: 'Пожиратель миров', emoji: '🐲', maxHp: 1e12, team: 'B', boss: true },
        ],
        total: await store.worldTotal(week),
      };
    },
  };

  // ------------------------------------------------------------ статика
  const serveFile = (res, root, rel) => {
    const file = path.resolve(root, `.${path.sep}${rel}`);
    if (!file.startsWith(root + path.sep) && file !== root) return send(res, 403, 'Forbidden');
    let target = file;
    try {
      if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      const data = fs.readFileSync(target);
      const ext = path.extname(target).toLowerCase();
      return send(res, 200, data, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
      });
    } catch {
      return send(res, 404, 'Not found');
    }
  };

  const handler = async (req, res) => {
    const started = now();
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
    try {
      if (req.method === 'OPTIONS') return send(res, 204, '');
      const url = new URL(req.url, 'http://x');
      const key = `${req.method} ${url.pathname}`;

      if (url.pathname === '/health') return send(res, 200, { ok: true, store: store.kind });

      if (url.pathname.startsWith('/api/')) {
        if (!apiLimit(ip)) throw new HttpError(429, 'Слишком много запросов');
        if (key === 'POST /api/register' && !regLimit(ip)) throw new HttpError(429, 'Слишком много регистраций');
        const fn = routes[key];
        if (!fn) throw new HttpError(404, 'Нет такого метода');
        const out = await fn(req, url);
        return send(res, 200, out);
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
      let rel = decodeURIComponent(url.pathname);
      if (rel.startsWith('/shared/')) return serveFile(res, SHARED_ROOT, rel.slice('/shared/'.length));
      if (rel === '/') rel = '/index.html';
      return serveFile(res, WEB_ROOT, rel.slice(1));
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...e.extra });
      console.error(JSON.stringify({ level: 'error', msg: e.message, stack: e.stack }));
      return send(res, 500, { error: 'Внутренняя ошибка сервера' });
    } finally {
      if (process.env.LOG_REQUESTS === '1') {
        console.log(JSON.stringify({ m: req.method, u: req.url, ms: now() - started }));
      }
    }
  };

  return http.createServer(handler);
}
