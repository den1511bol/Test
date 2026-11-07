/* PIXEL MINERS — клиент · Developer: @yfeeeee */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- форматирование ---------------- */
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 1000) return n < 10 && Math.floor(n) !== n ? n.toFixed(1) : String(Math.floor(n));
    const e = Math.min(Math.floor(Math.log10(n) / 3), SUF.length - 1);
    const v = n / Math.pow(1000, e);
    return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + SUF[e];
  }

  /* ---------------- пиксель-арт (рисуется кодом) ---------------- */
  function rowsURL(rows, pal) {
    const c = document.createElement('canvas');
    c.width = rows[0].length; c.height = rows.length;
    const x = c.getContext('2d');
    rows.forEach((r, y) => [...r].forEach((ch, px) => {
      if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(px, y, 1, 1); }
    }));
    return c.toDataURL();
  }
  const ICON = {
    tap: rowsURL(['..sssss.', '.s..h..s', 's...h..s', '....h...', '...h....', '..h.....', '.h......', 'h.......'],
      { s: '#c9d1d9', h: '#a0662b' }),
    dwarf: rowsURL(['..rrrr..', '.rrrrrr.', '.ssssss.', '.skssks.', '.wwwwww.', '.wwwwww.', '.bbbbbb.', '.bb..bb.'],
      { r: '#c0392b', s: '#f1c27d', k: '#222', w: '#eeeeee', b: '#3b6fb6' }),
    cart: rowsURL(['........', '.g.gg.g.', 'gggggggg', 'bbbbbbbb', 'bbbbbbbb', '.bbbbbb.', '.kk..kk.', '.kk..kk.'],
      { g: '#ffd23f', b: '#8a5a2b', k: '#9aa0a6' }),
    drill: rowsURL(['...dd...', '..dddd..', '.mmmmmm.', '.mmyymm.', '.mmmmmm.', '..oooo..', '...oo...', '....o...'],
      { d: '#7f8c8d', m: '#e67e22', y: '#f1c40f', o: '#bdc3c7' }),
    golem: rowsURL(['.gggggg.', 'gggggggg', 'gyggggyg', 'gggggggg', '.gggggg.', 'gg.gg.gg', 'gg.gg.gg', '.g....g.'],
      { g: '#7f8c8d', y: '#ffe066' }),
    dragon: rowsURL(['r..rr..r', 'rr.rr.rr', '.rrrrrr.', 'rrwrrwrr', '.rrrrrr.', '..roor..', '...oo...', '...rr...'],
      { r: '#d63031', w: '#ffffff', o: '#fdcb6e' }),
    portal: rowsURL(['..pppp..', '.pbbbbp.', 'pbbccbbp', 'pbcddcbp', 'pbcddcbp', 'pbbccbbp', '.pbbbbp.', '..pppp..'],
      { p: '#9b59b6', b: '#5b2c83', c: '#c39bd3', d: '#ffffff' }),
  };

  function gemURL() {
    const N = 16, c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d');
    const hw = (y) => (y < 2 || y > 14 ? -1 : y <= 6 ? 4 + (y - 2) * 0.75 : 7 - (y - 6) * (7 / 9));
    const inside = (px, py) => { const h = hw(py); return h >= 0 && Math.abs(px - 7.5) <= h; };
    for (let y = 0; y < N; y++) for (let px = 0; px < N; px++) {
      if (!inside(px, y)) continue;
      const edge = !inside(px + 1, y) || !inside(px - 1, y) || !inside(px, y + 1) || !inside(px, y - 1);
      let col;
      if (edge) col = '#5a3a00';
      else if (y <= 5) col = px < 8 ? '#ffe680' : '#ffd23f';
      else if (y === 6) col = '#fff2b0';
      else col = px <= 7 ? '#f0b400' : '#c98a00';
      if (((px === 5 || px === 6) && y === 4) || (px === 5 && y === 5)) col = '#ffffff';
      x.fillStyle = col; x.fillRect(px, y, 1, 1);
    }
    return c.toDataURL();
  }
  const GEM = gemURL();

  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const bossCache = {};
  function bossURL(level) {
    if (bossCache[level]) return bossCache[level];
    const rnd = mulberry32(level * 7919 + 13);
    const hue = (level * 53 + 10) % 360;
    const body = `hsl(${hue} 60% 55%)`, light = `hsl(${hue} 65% 70%)`, dark = `hsl(${hue} 55% 38%)`;
    const G = 12;
    const grid = Array.from({ length: G }, () => Array(G).fill(0));
    for (let y = 1; y < G - 1; y++) for (let x = 0; x < 6; x++) {
      if (rnd() < 0.25 + 0.65 * (x / 5) - Math.abs(y - 5.5) * 0.04) grid[y][x] = 1;
    }
    for (let y = 3; y <= 9; y++) for (let x = 3; x < 6; x++) grid[y][x] = 1;
    for (let y = 4; y <= 5; y++) for (let x = 2; x < 4; x++) grid[y][x] = 1;
    for (let y = 0; y < G; y++) for (let x = 0; x < 6; x++) grid[y][11 - x] = grid[y][x];
    const over = {};
    const put = (x, y, col) => { over[`${x},${y}`] = col; over[`${11 - x},${y}`] = col; };
    put(2, 4, '#fff'); put(3, 4, '#fff'); put(2, 5, '#fff'); put(3, 5, '#1a0a2e');
    for (let x = 3; x <= 8; x++) over[`${x},8`] = '#1a0a2e';
    over['4,8'] = '#fff'; over['7,8'] = '#fff';
    const at = (x, y) => x >= 0 && y >= 0 && x < G && y < G && grid[y][x];
    const S = G + 2, c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    for (let y = -1; y <= G; y++) for (let x = -1; x <= G; x++) {
      let col = null;
      if (at(x, y)) col = over[`${x},${y}`] || (y < 3 ? light : (x + y) % 7 === 0 ? dark : body);
      else if (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1)) col = '#120a1e';
      if (col) { ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, 1, 1); }
    }
    return (bossCache[level] = c.toDataURL());
  }

  /* ---------------- состояние ---------------- */
  let CFG, tok, S, sTs = 0;
  let pending = 0, pendingCoins = 0, inflight = 0;
  let boss = null, online = 0, lb = null, chat = [], es = null;
  let qty = 1, curView = 'mine', unread = 0, buying = false, achReady = false;
  const seenAch = new Set();
  let rewardSeen = Number(localStorage.getItem('pm_reward') || 0);

  const coinsNow = () => S.coins + (S.dps * (performance.now() - sTs)) / 1000 + pendingCoins + inflight;

  async function api(path, body) {
    const opt = { headers: {} };
    if (tok) opt.headers.Authorization = 'Bearer ' + tok;
    if (body !== undefined) {
      opt.method = 'POST';
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    let r;
    try { r = await fetch(path, opt); } catch { const e = new Error('Нет связи с сервером'); e.status = 0; throw e; }
    let d = {};
    try { d = await r.json(); } catch { /* пусто */ }
    if (!r.ok) { const e = new Error(d.error || 'Ошибка сети'); e.status = r.status; throw e; }
    return d;
  }

  function toast(text, ms = 2200) {
    const t = document.createElement('div');
    t.textContent = text;
    $('#toast').append(t);
    setTimeout(() => t.remove(), ms);
  }

  function setState(s) {
    S = s; sTs = performance.now();
    if (s.reward && s.reward.ts > rewardSeen) {
      rewardSeen = s.reward.ts;
      localStorage.setItem('pm_reward', String(rewardSeen));
      toast(`Награда за босса Ур.${s.reward.level}: +${fmt(s.reward.coins)}${s.reward.mvp ? ' (MVP ×2!)' : ''}`, 4500);
    }
    checkAch();
  }

  /* ---------------- вход ---------------- */
  function showLogin(msg) {
    $('#app').classList.add('hidden');
    $('#login').classList.remove('hidden');
    $('#login-gem').src = GEM;
    $('#login-msg').textContent = msg || '';
  }

  // Показываем код восстановления один раз, потом запускаем игру
  function showCode(code) {
    $('#code-val').textContent = code;
    $('#code-modal').classList.remove('hidden');
    $('#code-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(code); toast('Код скопирован'); }
      catch { toast('Выдели код и скопируй вручную'); }
    };
    return new Promise((res) => { $('#code-ok').onclick = () => { $('#code-modal').classList.add('hidden'); res(); }; });
  }

  async function authDone(r) {
    localStorage.setItem('pm_token', r.token);
    if (r.code) await showCode(r.code);
    location.reload();
  }
  async function authCall(path, body) {
    $('#login-msg').textContent = '';
    try { await authDone(await api(path, body)); }
    catch (e) { $('#login-msg').textContent = e.message; }
  }
  const creds = () => ({ nick: $('#auth-nick').value.trim(), password: $('#auth-pass').value });
  $('#guest-btn').addEventListener('click', () => authCall('/api/guest', {}));
  $('#auth-form').addEventListener('submit', (e) => { e.preventDefault(); authCall('/api/login', creds()); });
  $('#reg-btn').addEventListener('click', () => authCall('/api/register', creds()));
  $('#rec-toggle').addEventListener('click', () => $('#rec-form').classList.toggle('hidden'));
  $('#rec-form').addEventListener('submit', (e) => { e.preventDefault(); authCall('/api/recover', { code: $('#rec-code').value }); });

  /* ---------------- аккаунт (профиль) ---------------- */
  function renderAccount() {
    $('#acc-text').textContent = S.hasLogin
      ? `Ты вошёл как «${S.nick}». Здесь можно сменить ник и пароль.`
      : 'Ты играешь как гость. Привяжи ник и пароль, чтобы входить с любого телефона.';
    $('#bind-old').classList.toggle('hidden', !S.hasLogin);
    $('#bind-nick').value = S.hasLogin ? S.nick : '';
    $('#bind-btn').textContent = S.hasLogin ? 'Сменить ник / пароль' : 'Привязать ник и пароль';
  }
  $('#bind-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      setState(await api('/api/bind', { nick: $('#bind-nick').value, password: $('#bind-pass').value, old: $('#bind-old').value }));
      $('#bind-pass').value = ''; $('#bind-old').value = '';
      $('#uname').textContent = S.name;
      renderAccount(); toast('Аккаунт сохранён');
    } catch (err) { toast(err.message, 3500); }
  });
  $('#newcode-btn').addEventListener('click', async () => {
    if (!confirm('Выдать новый код? Старый перестанет работать.')) return;
    try { await showCode((await api('/api/newcode', {})).code); } catch (err) { toast(err.message); }
  });

  async function logout() {
    try { await api('/api/logout', {}); } catch { /* ок */ }
    localStorage.removeItem('pm_token');
    location.reload();
  }

  /* ---------------- запуск ---------------- */
  async function boot() {
    try { CFG = await api('/api/config'); } catch { document.body.textContent = 'Сервер недоступен'; return; }
    checkApkUpdate();
    tok = localStorage.getItem('pm_token');
    if (tok) {
      try { setState(await api('/api/me')); startGame(); return; }
      catch (e) {
        if (e.status !== 401) { showLogin(e.message); return; }
        localStorage.removeItem('pm_token'); tok = null;
      }
    }
    showLogin('');
  }

  function startGame() {
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#coin-ico').src = GEM;
    $('#gem-img').src = GEM;
    $('#uname').textContent = S.name;
    $('#avatar').textContent = (S.name[0] || '?').toUpperCase();
    buildShop();
    connect();
    renderAll();
    requestAnimationFrame(frame);
    setInterval(() => { if (pending) flush(); }, 600);
    setInterval(refreshShop, 300);
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        try { await flush(); setState(await api('/api/me')); } catch { /* ок */ }
        // сервер обновился — перезагружаем игру, чтобы получить новую версию
        try { const c = await api('/api/config'); if (c.build !== CFG.build) location.reload(); } catch { /* ок */ }
      } else flush();
    });
  }

  /* ---------------- тапы ---------------- */
  let flushP = Promise.resolve();
  function flush() { flushP = flushP.then(doFlush).catch(() => {}); return flushP; }
  async function doFlush() {
    if (!pending) return;
    const n = pending, c = pendingCoins;
    pending = 0; pendingCoins = 0; inflight += c;
    try {
      const r = await api('/api/tap', { n });
      inflight -= c;
      setState(r);
    } catch (e) {
      inflight -= c; pending += n; pendingCoins += c;
      if (e.status === 401) logout();
    }
  }

  let floats = 0;
  function spawnFloat(x, y, text) {
    if (floats > 14) return;
    floats++;
    const d = document.createElement('div');
    d.className = 'float';
    d.textContent = text;
    d.style.left = x + (Math.random() * 30 - 15) + 'px';
    d.style.top = y - 20 + 'px';
    document.body.append(d);
    setTimeout(() => { d.remove(); floats--; }, 800);
  }

  function doTap(x, y, el) {
    pending++; pendingCoins += S.tapPower;
    spawnFloat(x, y, '+' + fmt(S.tapPower));
    if (boss) { boss.hp = Math.max(0, boss.hp - S.tapPower); renderBoss(); }
    el.classList.add('hit');
    setTimeout(() => el.classList.remove('hit'), 70);
    if (navigator.vibrate) navigator.vibrate(5);
  }
  for (const id of ['gem', 'boss-hit']) {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); doTap(e.clientX, e.clientY, el); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ---------------- магазин ---------------- */
  const growth = () => CFG.growth;
  const bulkCost = (base, owned, n, g) => Math.floor((base * Math.pow(g, owned) * (Math.pow(g, n) - 1)) / (g - 1));
  function maxAff(base, owned, coins, g) {
    let n = Math.floor(Math.log((coins * (g - 1)) / (base * Math.pow(g, owned)) + 1) / Math.log(g));
    n = Math.max(0, Math.min(n || 0, 1000));
    while (n > 0 && bulkCost(base, owned, n, g) > coins) n--;
    return n;
  }

  function items() {
    return [
      { id: 'tap', name: 'Кирка', icon: ICON.tap, base: CFG.tapBase, g: CFG.tapGrowth, owned: S.tapLvl,
        eff: `+${fmt(S.mult)} за тап` },
      ...CFG.miners.map((m) => ({
        id: m.id, name: m.name, icon: ICON[m.id], base: m.base, g: growth(), owned: S.miners[m.id] || 0,
        eff: `+${fmt(m.dps * S.mult)}/сек каждый`,
      })),
    ];
  }

  function buildShop() {
    const list = $('#shop-list');
    list.innerHTML = '';
    for (const it of items()) {
      const d = document.createElement('div');
      d.className = 'panel card';
      d.dataset.item = it.id;
      d.innerHTML = `<div class="ico"><img class="px" src="${it.icon}" alt=""></div>
        <div><div class="nm"><span>${esc(it.name)}</span><span class="lv"></span></div><div class="dim eff"></div></div>
        <button class="btn buy"></button>`;
      $('.buy', d).addEventListener('click', () => buy(it.id));
      list.append(d);
    }
  }

  function refreshShop() {
    if (!S) return;
    const coins = coinsNow();
    for (const it of items()) {
      const card = $(`.card[data-item="${it.id}"]`);
      if (!card) continue;
      let n = qty === 'max' ? maxAff(it.base, it.owned, coins, it.g) : qty;
      if (n < 1) n = 1;
      const cost = bulkCost(it.base, it.owned, n, it.g);
      $('.lv', card).textContent = 'ур.' + it.owned;
      $('.eff', card).textContent = it.eff;
      const btn = $('.buy', card);
      btn.innerHTML = `${fmt(cost)}<small>×${n}</small>`;
      btn.disabled = cost > coins;
    }
    // перерождение
    const run = S.run + (coins - S.coins);
    const gain = run >= CFG.rebirthMin ? Math.floor(Math.sqrt(run / 1e5)) : 0;
    $('#rebirth-text').textContent =
      `Сбрось монеты, кирку и шахтёров и получи кристаллы: каждый даёт +${Math.round(CFG.crystalBonus * 100)}% к доходу навсегда. ` +
      `Сейчас: ${S.crystals} (+${Math.round(S.crystals * CFG.crystalBonus * 100)}%). ` +
      (gain ? `За этот забег: +${gain}.` : `Нужно заработать за забег ${fmt(CFG.rebirthMin)} монет.`);
    const rb = $('#rebirth-btn');
    rb.disabled = !gain;
    rb.textContent = gain ? `Переродиться (+${gain} ✦)` : 'Переродиться';
  }

  async function buy(item) {
    if (buying) return;
    buying = true;
    try {
      await flush();
      setState(await api('/api/buy', { item, qty }));
      refreshShop(); renderHeader();
    } catch (e) { toast(e.message); } finally { buying = false; }
  }

  $('#qty').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    qty = b.dataset.q === 'max' ? 'max' : Number(b.dataset.q);
    $$('#qty button').forEach((x) => x.classList.toggle('on', x === b));
    refreshShop();
  });

  $('#rebirth-btn').addEventListener('click', async () => {
    if (!confirm('Переродиться? Монеты, кирка и шахтёры сбросятся, кристаллы останутся.')) return;
    try {
      await flush();
      setState(await api('/api/rebirth', {}));
      toast('Ты переродился! Кристаллы усилили доход ✦', 3500);
      refreshShop(); renderStats();
    } catch (e) { toast(e.message); }
  });

  /* ---------------- реальное время ---------------- */
  function connect() {
    es = new EventSource('/api/stream?t=' + tok);
    es.addEventListener('init', (e) => {
      const d = JSON.parse(e.data);
      boss = d.boss; online = d.online; lb = d.lb; chat = d.chat;
      renderAll(); renderChat(true);
    });
    es.addEventListener('boss', (e) => { boss = JSON.parse(e.data); renderBoss(); });
    es.addEventListener('online', (e) => { online = JSON.parse(e.data).count; $('#online').textContent = online; });
    es.addEventListener('lb', (e) => { lb = JSON.parse(e.data); if (curView === 'top') renderLb(); });
    es.addEventListener('chat', (e) => {
      chat.push(JSON.parse(e.data));
      if (chat.length > 50) chat.shift();
      renderChat();
      if (curView !== 'chat') { unread++; renderUnread(); }
    });
    es.addEventListener('bossDefeated', async (e) => {
      const d = JSON.parse(e.data);
      toast(`Босс «${d.name}» повержен!`, 3500);
      try { await flush(); setState(await api('/api/me')); } catch { /* ок */ }
    });
  }

  /* ---------------- отрисовка ---------------- */
  function renderHeader() {
    $('#online').textContent = online;
    $('#dps').textContent = fmt(S.dps);
    $('#tapp').textContent = fmt(S.tapPower);
  }

  let lastBossLevel = 0;
  function renderBoss() {
    if (!boss) return;
    const pct = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));
    $('#mini-boss-name').textContent = boss.name;
    $('#mini-bar').style.width = pct + '%';
    $('#boss-name').textContent = boss.name;
    $('#boss-bar').style.width = pct + '%';
    $('#boss-hp').textContent = `${fmt(boss.hp)} / ${fmt(boss.maxHp)}`;
    if (lastBossLevel !== boss.level) {
      lastBossLevel = boss.level;
      $('#boss-img').src = bossURL(boss.level);
    }
    $('#boss-top').innerHTML = boss.top.length
      ? boss.top.map((t, i) => `<li class="${t.id === S.id ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="nmx">${esc(t.name)}</span><span class="val">${fmt(t.dmg)}</span></li>`).join('')
      : '<li class="dim">Пока никто не бил. Будь первым!</li>';
  }

  function renderLb() {
    if (!lb) return;
    $('#lb-info').textContent = `Игроков: ${lb.players}` + (lb.me ? ` · твоё место: ${lb.me.rank}` : '');
    $('#lb').innerHTML = lb.top.map((p) => `<li class="${p.id === S.id ? 'me' : ''}">
      <span class="rk">${p.rank}</span><i class="dot ${p.online ? 'on' : ''}"></i>
      <span class="nmx">${esc(p.name)}${p.crystals ? ` <span class="cr">✦${p.crystals}</span>` : ''}</span>
      <span class="val">${fmt(p.total)}</span></li>`).join('');
  }

  const hhmm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  function renderChat(force) {
    const log = $('#chat-log');
    const stick = force || log.scrollTop + log.clientHeight >= log.scrollHeight - 40;
    log.innerHTML = chat.map((m) => m.sys
      ? `<div class="msg-line sys">★ ${esc(m.text)}</div>`
      : `<div class="msg-line"><time>${hhmm(m.t)}</time><b>${esc(m.name)}:</b> ${esc(m.text)}</div>`).join('');
    if (stick) log.scrollTop = log.scrollHeight;
  }
  function renderUnread() {
    const b = $('#unread');
    b.textContent = unread > 9 ? '9+' : unread;
    b.classList.toggle('hidden', !unread);
  }

  const ACH = [
    ['Первый тап', (s) => s.taps >= 1],
    ['100 тапов', (s) => s.taps >= 100],
    ['10 000 тапов', (s) => s.taps >= 10000],
    ['Миллионер', (s) => s.total >= 1e6],
    ['Миллиардер', (s) => s.total >= 1e9],
    ['Первый босс', (s) => s.bossKills >= 1],
    ['Охотник: 10 боссов', (s) => s.bossKills >= 10],
    ['Отряд из 50', (s) => Object.values(s.miners).reduce((a, b) => a + b, 0) >= 50],
    ['Перерождение', (s) => s.rebirths >= 1],
  ];
  function checkAch() {
    for (const [name, ok] of ACH) {
      if (ok(S) && !seenAch.has(name)) {
        seenAch.add(name);
        if (achReady) toast('Достижение: ' + name, 3000);
      }
    }
    achReady = true;
  }

  function renderStats() {
    const rows = [
      ['Всего заработано', fmt(S.total)], ['Тапов', fmt(S.taps)], ['Ударов по боссам', fmt(S.bossHits)],
      ['Боссов повержено', S.bossKills], ['Перерождений', S.rebirths], ['Кристаллов', `✦ ${S.crystals}`],
      ['Множитель дохода', '×' + S.mult.toFixed(1)],
    ];
    $('#stats').innerHTML = rows.map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join('');
    $('#ach').innerHTML = ACH.map(([n, ok]) => `<div class="${ok(S) ? 'done' : ''}">${esc(n)}</div>`).join('');
  }

  function renderAll() { renderHeader(); renderBoss(); renderLb(); renderStats(); refreshShop(); }

  let lastCoins = '';
  function frame() {
    const t = fmt(coinsNow());
    if (t !== lastCoins) { lastCoins = t; $('#coins').textContent = t; }
    $('#dps').textContent = fmt(S.dps);
    $('#tapp').textContent = fmt(S.tapPower);
    requestAnimationFrame(frame);
  }

  /* ---------------- навигация и чат ---------------- */
  function go(view) {
    curView = view;
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
    $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
    if (view === 'chat') { unread = 0; renderUnread(); renderChat(true); }
    if (view === 'top') { renderLb(); api('/api/leaderboard').then((d) => { lb = d; renderLb(); }).catch(() => {}); }
    if (view === 'me') { renderStats(); renderAccount(); }
    if (view === 'shop') refreshShop();
    $('main').scrollTop = 0;
  }
  $('.tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go(b.dataset.view); });
  $('.mini-boss').addEventListener('click', () => go('boss'));
  $('#logout-btn').addEventListener('click', logout);

  $('#chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = $('#chat-input');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    try { await api('/api/chat', { text }); } catch (err) { toast(err.message); inp.value = text; }
  });

  /* ---------------- PWA ---------------- */
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    $('#install-btn').classList.remove('hidden');
  });
  $('#install-btn').addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    deferredInstall = null;
    $('#install-btn').classList.add('hidden');
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  // Внутри Android-приложения подсказки про установку не нужны
  if (window.Capacitor) $('#ios-hint').classList.add('hidden');

  /* ---------------- обновление приложения (APK) ---------------- */
  async function appBuild() {
    try { return Number((await window.Capacitor.Plugins.App.getInfo()).build) || 0; } catch { return 0; }
  }
  async function checkApkUpdate() {
    if (!window.Capacitor) return; // в браузере обновляется само
    try {
      const r = await fetch('/apk.json', { cache: 'no-store' });
      if (!r.ok) return;
      const latest = await r.json();
      if (latest.versionCode <= (await appBuild())) return;
      if (sessionStorage.getItem('pm_upd_skip') === String(latest.versionCode)) return;
      $('#update-text').textContent = `Вышла новая версия приложения (${latest.versionName || latest.versionCode}). Скачай и установи её поверх старой, прогресс сохранится.`;
      $('#update-modal').classList.remove('hidden');
      $('#update-ok').onclick = () => {
        try { window.Capacitor.Plugins.Browser.open({ url: latest.url }); } catch { location.href = latest.url; }
      };
      $('#update-later').onclick = () => {
        sessionStorage.setItem('pm_upd_skip', String(latest.versionCode));
        $('#update-modal').classList.add('hidden');
      };
    } catch { /* нет связи — не мешаем игре */ }
  }

  boot();
})();
