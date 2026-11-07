// Ashen Crown — состояние игры, сохранение и синхронизация. Developer: @yfeeeee
import { createCharacter, rollover } from '../shared/economy.js';
import { api, NetError, serverConfigured } from './api.js';

const KEY_SAVE = 'ac.save';
const KEY_AUTH = 'ac.auth';

export const S = {
  save: null,
  auth: null, // {token, id, rev}
  rating: 1000,
  arenaLeft: 5,
  worldLeft: 3,
  online: false,
  dirty: false,
  syncError: null,
};

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

const progress = (s) => s.level * 1e6 + s.stage * 1e3 + s.tower + Math.min(0.99, s.stats.battles / 1e6);

function readJson(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function writeJson(key, v) {
  try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch { /* квота/приватный режим */ }
}

export function loadLocal() {
  S.save = readJson(KEY_SAVE);
  S.auth = readJson(KEY_AUTH);
  if (S.save) { migrate(S.save); rollover(S.save); }
  return !!S.save;
}

/** Мягкая миграция: добавляем поля, которых не было в старых сохранениях. */
function migrate(save) {
  const base = createCharacter(save.name, save.cls, save.created || Date.now());
  for (const [k, v] of Object.entries(base)) {
    if (!(k in save)) save[k] = structuredClone(v);
  }
  for (const k of Object.keys(base.stats)) if (!(k in save.stats)) save.stats[k] = 0;
  for (const k of Object.keys(base.settings)) if (!(k in save.settings)) save.settings[k] = base.settings[k];
}

export function persist({ sync = true } = {}) {
  if (!S.save) return;
  S.save.updated = Date.now();
  writeJson(KEY_SAVE, S.save);
  S.dirty = true;
  if (sync) scheduleSync();
  emit();
}

function persistAuth() { writeJson(KEY_AUTH, S.auth); }

let syncTimer = null;
export function scheduleSync(ms = 4000) {
  if (!S.auth) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(), ms);
}

let syncing = false;
export async function syncNow() {
  if (!S.auth || !S.save || syncing || !serverConfigured()) return false;
  syncing = true;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await api.putSave(S.auth.token, S.save, S.auth.rev);
      if (r.status === 200) {
        S.auth.rev = r.json.rev; S.rating = r.json.rating ?? S.rating;
        persistAuth(); S.dirty = false; S.online = true; S.syncError = null; emit();
        return true;
      }
      if (r.status === 409) {
        if (progress(r.json.save) > progress(S.save)) {
          S.save = r.json.save; S.auth.rev = r.json.rev; writeJson(KEY_SAVE, S.save); persistAuth(); S.dirty = false; emit();
          return true;
        }
        S.auth.rev = r.json.rev; // локальный прогресс больше — перезаписываем
        continue;
      }
      if (r.status === 401) { S.auth = null; persistAuth(); S.online = false; emit(); return false; }
      S.syncError = r.json.error || `Ошибка ${r.status}`;
      emit();
      return false;
    }
  } catch (e) {
    if (e instanceof NetError) S.online = false;
    return false;
  } finally {
    syncing = false;
  }
  return false;
}

/** Старт: подтянуть облачное сохранение, если оно новее. */
export async function pullOnStart() {
  if (!S.auth || !serverConfigured()) return;
  try {
    const r = await api.me(S.auth.token);
    if (r.status === 401) { S.auth = null; persistAuth(); return; }
    if (r.status !== 200) return;
    S.online = true;
    S.rating = r.json.rating; S.arenaLeft = r.json.arenaLeft; S.worldLeft = r.json.worldLeft;
    const server = r.json.save;
    if (!S.save || (!S.dirty && r.json.rev !== S.auth.rev) || progress(server) > progress(S.save)) {
      if (!S.save || progress(server) >= progress(S.save)) {
        S.save = server; writeJson(KEY_SAVE, S.save); S.dirty = false;
      }
    }
    S.auth.rev = r.json.rev; persistAuth();
    if (S.save) { migrate(S.save); rollover(S.save); }
    emit();
    if (S.dirty || progress(S.save) > progress(server)) await syncNow();
  } catch { S.online = false; }
}

/** Создание героя: онлайн-регистрация, а если сервера нет — локальный герой. */
export async function newGame(name, cls) {
  let save = createCharacter(name, cls);
  S.auth = null;
  if (serverConfigured()) {
    try {
      const r = await api.register(name, cls);
      if (r.status === 200) {
        save = r.json.save;
        S.auth = { token: r.json.token, id: r.json.id, rev: r.json.rev };
        S.online = true; S.rating = r.json.rating;
        persistAuth();
      } else if (r.status === 400 || r.status === 422) {
        throw new Error(r.json.error || 'Сервер отклонил имя');
      }
    } catch (e) {
      if (!(e instanceof NetError)) throw e;
    }
  }
  S.save = save;
  rollover(S.save);
  persist({ sync: false });
  S.dirty = false;
  return !!S.auth;
}

/** Привязка локального героя к серверу (когда сервер стал доступен). */
export async function linkAccount() {
  if (S.auth) return true;
  const r = await api.register(S.save.name, S.save.cls, S.save);
  if (r.status !== 200) throw new Error(r.json.error || `Ошибка ${r.status}`);
  S.auth = { token: r.json.token, id: r.json.id, rev: r.json.rev };
  S.online = true; S.rating = r.json.rating;
  persistAuth(); S.dirty = false; emit();
  return true;
}

export function resetLocal() {
  writeJson(KEY_SAVE, null); writeJson(KEY_AUTH, null);
  S.save = null; S.auth = null;
}

export function tick() {
  if (!S.save) return;
  if (rollover(S.save)) persist();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && S.dirty) syncNow();
  if (document.visibilityState === 'visible') tick();
});
setInterval(() => { if (S.dirty && S.auth) syncNow(); tick(); }, 60000);
