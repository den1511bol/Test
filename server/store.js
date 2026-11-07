// Ashen Crown — хранилище: PostgreSQL (прод) и память (тесты/локально). Developer: @yfeeeee
import crypto from 'node:crypto';

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  cls         TEXT NOT NULL,
  save        JSONB NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1,
  level       INTEGER NOT NULL DEFAULT 1,
  power       INTEGER NOT NULL DEFAULT 0,
  stage       INTEGER NOT NULL DEFAULT 0,
  tower       INTEGER NOT NULL DEFAULT 0,
  rating      INTEGER NOT NULL DEFAULT 1000,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  arena_day   TEXT,
  arena_fights INTEGER NOT NULL DEFAULT 0,
  world_day   TEXT,
  world_fights INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE players ADD COLUMN IF NOT EXISTS arena_day TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS arena_fights INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS world_day TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS world_fights INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS players_power_idx  ON players (power DESC);
CREATE INDEX IF NOT EXISTS players_tower_idx  ON players (tower DESC);
CREATE INDEX IF NOT EXISTS players_rating_idx ON players (rating DESC);

CREATE TABLE IF NOT EXISTS arena_log (
  id          BIGSERIAL PRIMARY KEY,
  attacker    TEXT NOT NULL,
  defender    TEXT NOT NULL,
  win         BOOLEAN NOT NULL,
  delta       INTEGER NOT NULL,
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_boss (
  week        TEXT PRIMARY KEY,
  total       BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS world_boss_damage (
  week        TEXT NOT NULL,
  player_id   TEXT NOT NULL,
  damage      BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (week, player_id)
);
CREATE INDEX IF NOT EXISTS wbd_idx ON world_boss_damage (week, damage DESC);
`;

/** Интерфейс хранилища реализуют PgStore и MemoryStore. */
export class PgStore {
  constructor(pool) { this.pool = pool; this.kind = 'postgres'; }

  static async connect(url) {
    const { default: pg } = await import('pg');
    const ssl = process.env.PGSSL === 'disable' || /localhost|127\.0\.0\.1|railway\.internal/.test(url)
      ? false : { rejectUnauthorized: false };
    const pool = new pg.Pool({ connectionString: url, ssl, max: 10 });
    const store = new PgStore(pool);
    await pool.query(SCHEMA);
    return store;
  }

  async close() { await this.pool.end(); }

  async createPlayer(p) {
    await this.pool.query(
      `INSERT INTO players (id, token_hash, name, cls, save, level, power, stage, tower, rating)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [p.id, p.tokenHash, p.name, p.cls, p.save, p.level, p.power, p.stage, p.tower, p.rating],
    );
  }

  async byToken(tokenHash) {
    const { rows } = await this.pool.query('SELECT * FROM players WHERE token_hash = $1', [tokenHash]);
    return rows[0] ? row(rows[0]) : null;
  }

  async byId(id) {
    const { rows } = await this.pool.query('SELECT * FROM players WHERE id = $1', [id]);
    return rows[0] ? row(rows[0]) : null;
  }

  /** Оптимистичная блокировка: обновляет, только если rev совпал. */
  async saveIfRev(id, rev, p) {
    const { rows } = await this.pool.query(
      `UPDATE players SET save=$3, rev=rev+1, name=$4, level=$5, power=$6, stage=$7, tower=$8,
              updated_at=now(), last_seen=now()
       WHERE id=$1 AND rev=$2 RETURNING rev`,
      [id, rev, p.save, p.name, p.level, p.power, p.stage, p.tower],
    );
    return rows[0] ? rows[0].rev : null;
  }

  async touch(id) { await this.pool.query('UPDATE players SET last_seen=now() WHERE id=$1', [id]); }

  async setRating(id, rating) {
    await this.pool.query('UPDATE players SET rating=$2 WHERE id=$1', [id, rating]);
  }

  async leaderboard(type, limit) {
    const col = { power: 'power', tower: 'tower', arena: 'rating', stage: 'stage' }[type];
    if (!col) return [];
    const { rows } = await this.pool.query(
      `SELECT id, name, cls, level, power, stage, tower, rating FROM players ORDER BY ${col} DESC, level DESC, created_at ASC LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async rankOf(type, id) {
    const col = { power: 'power', tower: 'tower', arena: 'rating', stage: 'stage' }[type];
    if (!col) return null;
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int + 1 AS rank FROM players WHERE ${col} > (SELECT ${col} FROM players WHERE id=$1)`, [id],
    );
    return rows[0] ? rows[0].rank : null;
  }

  async arenaCandidates(rating, selfId, limit) {
    const { rows } = await this.pool.query(
      `SELECT * FROM players WHERE id <> $2 AND stage > 0
       ORDER BY ABS(rating - $1) ASC, random() LIMIT $3`,
      [rating, selfId, limit],
    );
    return rows.map(row);
  }

  async logArena(attacker, defender, win, delta) {
    await this.pool.query('INSERT INTO arena_log (attacker, defender, win, delta) VALUES ($1,$2,$3,$4)', [attacker, defender, win, delta]);
  }

  async addWorldDamage(week, playerId, dmg) {
    await this.pool.query(
      `INSERT INTO world_boss (week, total) VALUES ($1,$2)
       ON CONFLICT (week) DO UPDATE SET total = world_boss.total + $2`, [week, dmg]);
    await this.pool.query(
      `INSERT INTO world_boss_damage (week, player_id, damage) VALUES ($1,$2,$3)
       ON CONFLICT (week, player_id) DO UPDATE SET damage = world_boss_damage.damage + $3`, [week, playerId, dmg]);
  }

  async worldTotal(week) {
    const { rows } = await this.pool.query('SELECT total FROM world_boss WHERE week=$1', [week]);
    return rows[0] ? Number(rows[0].total) : 0;
  }

  async worldTop(week, limit) {
    const { rows } = await this.pool.query(
      `SELECT p.name, p.cls, d.damage FROM world_boss_damage d JOIN players p ON p.id = d.player_id
       WHERE d.week=$1 ORDER BY d.damage DESC LIMIT $2`, [week, limit]);
    return rows.map((r) => ({ name: r.name, cls: r.cls, damage: Number(r.damage) }));
  }

  async playerCount() {
    const { rows } = await this.pool.query('SELECT COUNT(*)::int AS n FROM players');
    return rows[0].n;
  }

  async worldMine(week, id) {
    const { rows } = await this.pool.query('SELECT damage FROM world_boss_damage WHERE week=$1 AND player_id=$2', [week, id]);
    return rows[0] ? Number(rows[0].damage) : 0;
  }

  /** Атомарно тратит одну попытку. Возвращает использованное число попыток или null, если лимит исчерпан. */
  async useLimit(id, kind, day, max) {
    if (!['arena', 'world'].includes(kind)) throw new Error('bad kind');
    const d = `${kind}_day`; const c = `${kind}_fights`;
    const { rows } = await this.pool.query(
      `UPDATE players SET ${c} = CASE WHEN ${d} = $2 THEN ${c} + 1 ELSE 1 END, ${d} = $2
       WHERE id = $1 AND (${d} IS DISTINCT FROM $2 OR ${c} < $3) RETURNING ${c} AS n`,
      [id, day, max],
    );
    return rows[0] ? rows[0].n : null;
  }

  async usedToday(id, kind, day) {
    if (!['arena', 'world'].includes(kind)) throw new Error('bad kind');
    const { rows } = await this.pool.query(`SELECT ${kind}_day AS d, ${kind}_fights AS n FROM players WHERE id=$1`, [id]);
    return rows[0] && rows[0].d === day ? rows[0].n : 0;
  }
}

function row(r) {
  return {
    id: r.id, tokenHash: r.token_hash, name: r.name, cls: r.cls, save: r.save, rev: r.rev,
    level: r.level, power: r.power, stage: r.stage, tower: r.tower, rating: r.rating,
  };
}

export class MemoryStore {
  constructor() {
    this.kind = 'memory';
    this.players = new Map();
    this.arena = [];
    this.worldTotals = new Map();
    this.worldDmg = new Map();
  }

  async close() {}
  async createPlayer(p) { this.players.set(p.id, { ...p, rev: 1, created: Date.now() }); }
  async byToken(h) { for (const p of this.players.values()) if (p.tokenHash === h) return structuredClone(p); return null; }
  async byId(id) { const p = this.players.get(id); return p ? structuredClone(p) : null; }

  async saveIfRev(id, rev, p) {
    const cur = this.players.get(id);
    if (!cur || cur.rev !== rev) return null;
    Object.assign(cur, { save: p.save, name: p.name, level: p.level, power: p.power, stage: p.stage, tower: p.tower });
    cur.rev++;
    return cur.rev;
  }

  async touch() {}
  async setRating(id, rating) { const p = this.players.get(id); if (p) p.rating = rating; }

  _sorted(type) {
    const k = { power: 'power', tower: 'tower', arena: 'rating', stage: 'stage' }[type];
    if (!k) return [];
    return [...this.players.values()].sort((a, b) => b[k] - a[k] || b.level - a.level || a.created - b.created);
  }

  async leaderboard(type, limit) {
    return this._sorted(type).slice(0, limit).map((p) => ({ id: p.id, name: p.name, cls: p.cls, level: p.level, power: p.power, stage: p.stage, tower: p.tower, rating: p.rating }));
  }

  async rankOf(type, id) {
    const i = this._sorted(type).findIndex((p) => p.id === id);
    return i < 0 ? null : i + 1;
  }

  async arenaCandidates(rating, selfId, limit) {
    return [...this.players.values()]
      .filter((p) => p.id !== selfId && p.stage > 0)
      .sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating))
      .slice(0, limit).map((p) => structuredClone(p));
  }

  async logArena(attacker, defender, win, delta) { this.arena.push({ attacker, defender, win, delta, at: Date.now() }); }

  async addWorldDamage(week, playerId, dmg) {
    this.worldTotals.set(week, (this.worldTotals.get(week) || 0) + dmg);
    const m = this.worldDmg.get(week) || new Map();
    m.set(playerId, (m.get(playerId) || 0) + dmg);
    this.worldDmg.set(week, m);
  }

  async worldTotal(week) { return this.worldTotals.get(week) || 0; }

  async worldTop(week, limit) {
    const m = this.worldDmg.get(week) || new Map();
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id, damage]) => {
      const p = this.players.get(id);
      return { name: p ? p.name : '?', cls: p ? p.cls : 'warrior', damage };
    });
  }

  async playerCount() { return this.players.size; }

  async worldMine(week, id) { return (this.worldDmg.get(week) || new Map()).get(id) || 0; }

  async useLimit(id, kind, day, max) {
    const p = this.players.get(id);
    if (!p) return null;
    p.lim = p.lim || {};
    const cur = p.lim[kind] && p.lim[kind].day === day ? p.lim[kind].n : 0;
    if (cur >= max) return null;
    p.lim[kind] = { day, n: cur + 1 };
    return cur + 1;
  }

  async usedToday(id, kind, day) {
    const p = this.players.get(id);
    return p && p.lim && p.lim[kind] && p.lim[kind].day === day ? p.lim[kind].n : 0;
  }
}
