// Ashen Crown — клиент API. Developer: @yfeeeee
const cfg = () => window.GAME_CONFIG || {};

export function baseUrl() {
  let custom = '';
  try { custom = localStorage.getItem('ac.server') || ''; } catch { /* нет доступа */ }
  return (custom || cfg().apiUrl || '').replace(/\/+$/, '');
}

/** В APK без заданного сервера работаем офлайн (origin = https://localhost). */
export function serverConfigured() {
  if (baseUrl()) return true;
  return !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

export function setServer(url) {
  try { if (url) localStorage.setItem('ac.server', url.trim()); else localStorage.removeItem('ac.server'); } catch { /* ignore */ }
}

export class NetError extends Error {}

async function req(method, path, { token, body, timeout = 12000 } = {}) {
  if (!serverConfigured()) throw new NetError('Сервер не настроен');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(baseUrl() + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    let json = {};
    try { json = await res.json(); } catch { /* пустой ответ */ }
    return { status: res.status, json };
  } catch (e) {
    throw new NetError(e.name === 'AbortError' ? 'Сервер не отвечает' : 'Нет соединения');
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  info: () => req('GET', '/api/info', { timeout: 6000 }),
  register: (name, cls, save) => req('POST', '/api/register', { body: { name, cls, save } }),
  me: (token) => req('GET', '/api/me', { token }),
  putSave: (token, save, rev) => req('PUT', '/api/save', { token, body: { save, rev } }),
  leaderboard: (token, type) => req('GET', `/api/leaderboard?type=${type}`, { token }),
  opponents: (token) => req('GET', '/api/arena/opponents', { token }),
  arenaFight: (token, opponentId) => req('POST', '/api/arena/fight', { token, body: { opponentId }, timeout: 20000 }),
  world: (token) => req('GET', '/api/world', { token }),
  worldFight: (token) => req('POST', '/api/world/fight', { token, timeout: 20000 }),
};
