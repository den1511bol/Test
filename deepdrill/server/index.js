// Сервер облачных сохранений и рейтинга «Бурильщик: Глубь». Разработчик: @yfeeeee
// Node без фреймворков; PostgreSQL через DATABASE_URL (Railway), иначе — память (для разработки).
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

const MAX_BODY = 256 * 1024;

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

class MemoryStore {
  constructor() { this.rows = new Map(); }
  async init() {}
  async get(id) { return this.rows.get(id) || null; }
  async create(id, tokenHash, name) {
    if (this.rows.has(id)) return false;
    this.rows.set(id, { device_id: id, token_hash: tokenHash, name, max_depth: 0, cores: 0, data: null, updated_at: new Date() });
    return true;
  }
  async save(id, name, maxDepth, cores, data) {
    const r = this.rows.get(id);
    Object.assign(r, { name, max_depth: maxDepth, cores, data, updated_at: new Date() });
  }
  async top(n) {
    return [...this.rows.values()].filter((r) => r.max_depth > 0)
      .sort((a, b) => b.max_depth - a.max_depth).slice(0, n);
  }
}

class PgStore {
  constructor(url) {
    const { Pool } = require('pg');
    const local = /localhost|127\.0\.0\.1|railway\.internal/.test(url);
    this.pool = new Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 8 });
  }
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS drill_saves (
      device_id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      max_depth DOUBLE PRECISION NOT NULL DEFAULT 0,
      cores INTEGER NOT NULL DEFAULT 0,
      data JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await this.pool.query('CREATE INDEX IF NOT EXISTS drill_saves_depth ON drill_saves (max_depth DESC)');
  }
  async get(id) {
    const r = await this.pool.query('SELECT * FROM drill_saves WHERE device_id=$1', [id]);
    return r.rows[0] || null;
  }
  async create(id, tokenHash, name) {
    const r = await this.pool.query(
      'INSERT INTO drill_saves (device_id, token_hash, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [id, tokenHash, name]);
    return r.rowCount === 1;
  }
  async save(id, name, maxDepth, cores, data) {
    await this.pool.query(
      'UPDATE drill_saves SET name=$2, max_depth=$3, cores=$4, data=$5, updated_at=now() WHERE device_id=$1',
      [id, name, maxDepth, cores, JSON.stringify(data)]);
  }
  async top(n) {
    const r = await this.pool.query(
      'SELECT name, max_depth, cores FROM drill_saves WHERE max_depth > 0 ORDER BY max_depth DESC LIMIT $1', [n]);
    return r.rows;
  }
}

const cleanName = (s) => String(s || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 20);
const validId = (s) => typeof s === 'string' && /^[a-z0-9]{16,40}$/.test(s);

function makeServer(store) {
  const send = (res, code, obj) => {
    const body = JSON.stringify(obj);
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    });
    res.end(body);
  };
  const readBody = (req) => new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('too big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
  const auth = async (req, id) => {
    if (!validId(id)) return null;
    const row = await store.get(id);
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!row || !token) return null;
    const a = Buffer.from(sha(token)); const b = Buffer.from(row.token_hash);
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? row : null;
  };

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const p = url.pathname;
      if (req.method === 'OPTIONS') return send(res, 204, {});
      if (p === '/health') return send(res, 200, { ok: true, game: 'deepdrill', dev: '@yfeeeee' });

      if (p === '/api/drill/register' && req.method === 'POST') {
        const b = await readBody(req);
        if (!validId(b.device_id)) return send(res, 400, { error: 'bad device_id' });
        const token = crypto.randomBytes(24).toString('hex');
        const ok = await store.create(b.device_id, sha(token), cleanName(b.name));
        return ok ? send(res, 200, { token }) : send(res, 409, { error: 'exists' });
      }

      if (p === '/api/drill/save' && req.method === 'PUT') {
        const b = await readBody(req);
        const row = await auth(req, b.device_id);
        if (!row) return send(res, 401, { error: 'unauthorized' });
        const s = b.save;
        if (!s || typeof s !== 'object' || Array.isArray(s)) return send(res, 400, { error: 'bad save' });
        const maxDepth = Number(s.max_depth);
        const cores = Math.floor(Number(s.cores));
        if (!Number.isFinite(maxDepth) || maxDepth < 0 || maxDepth > 1e6 || !Number.isFinite(cores) || cores < 0 || cores > 1e9) {
          return send(res, 400, { error: 'bad numbers' });
        }
        const clean = { ...s, token: '' };           // токен в сохранение не пишем
        await store.save(b.device_id, cleanName(b.name), maxDepth, cores, clean);
        return send(res, 200, { ok: true });
      }

      if (p === '/api/drill/save' && req.method === 'GET') {
        const id = url.searchParams.get('device_id');
        const row = await auth(req, id);
        if (!row) return send(res, 401, { error: 'unauthorized' });
        if (!row.data) return send(res, 404, { error: 'empty' });
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        return send(res, 200, { save: data });
      }

      if (p === '/api/drill/leaderboard' && req.method === 'GET') {
        const rows = await store.top(50);
        return send(res, 200, { rows: rows.map((r) => ({ name: r.name || 'Безымянный', max_depth: Math.floor(r.max_depth), cores: r.cores })) });
      }

      return send(res, 404, { error: 'not found' });
    } catch (e) {
      const msg = String(e.message || e);
      return send(res, /too big|bad json/.test(msg) ? 400 : 500, { error: /too big|bad json/.test(msg) ? msg : 'server error' });
    }
  });
}

async function main() {
  const store = process.env.DATABASE_URL ? new PgStore(process.env.DATABASE_URL) : new MemoryStore();
  await store.init();
  const port = Number(process.env.PORT) || 3000;
  makeServer(store).listen(port, '0.0.0.0', () =>
    console.log(`deepdrill server on :${port} (${process.env.DATABASE_URL ? 'postgres' : 'memory'}) — @yfeeeee`));
}

module.exports = { makeServer, MemoryStore };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
