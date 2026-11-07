/* Lootify · клиент · Developer: @yfeeeee */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n));
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ок */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch { /* ок */ } },
  };
  const RAR = [['Обычная', '#8d8aa3'], ['Необычная', '#4fd18b'], ['Редкая', '#4aa8ff'], ['Эпическая', '#a97bff'], ['Легендарная', '#f2b64a'], ['Мифическая', '#ff7a3d'], ['Реликтовая', '#ef4b5b']];
  const GROUPS = [['all', 'Все'], ['0', 'Лес'], ['1', 'Пепел'], ['2', 'Механизмы'], ['3', 'Миф']];

  let CFG = null, ME = null, B = [], TOK = null, skew = 0, es = null;
  const T = { tab: 'boss', fight: null, filter: 'all', chatTab: 'rate', sel: 'w1', lb: null, chat: [], online: 0, busy: false };
  const now = () => Date.now() + skew;

  async function api(path, body) {
    const r = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(TOK ? { Authorization: 'Bearer ' + TOK } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let j = {};
    try { j = await r.json(); } catch { /* ок */ }
    if (!r.ok) { const e = new Error(j.error || 'Ошибка ' + r.status); e.status = r.status; throw e; }
    return j;
  }
  const setMe = (m) => { ME = m; skew = m.now - Date.now(); head(); };

  let tT = 0;
  function toast(t) { $('#tt').innerHTML = '<div class="toast">' + esc(t) + '</div>'; clearTimeout(tT); tT = setTimeout(() => { $('#tt').innerHTML = ''; }, 2400); }
  const mi = (k) => '<img src="img/res/' + k + '.webp" alt="">';
  function head() { if (ME) $('#cr').textContent = fmt(ME.credits); }

  /* ---------------- вход ---------------- */
  function showLogin(err) {
    $('#login').classList.remove('hidden');
    $('#loginerr').textContent = err || '';
    if (!CFG) return;
    const w = $('#tgwidget');
    if (CFG.tg && !w.firstChild) {
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://telegram.org/js/telegram-widget.js?22';
      s.setAttribute('data-telegram-login', CFG.bot);
      s.setAttribute('data-size', 'large');
      s.setAttribute('data-radius', '12');
      s.setAttribute('data-userpic', 'false');
      s.setAttribute('data-auth-url', location.origin + '/auth/tg');
      s.setAttribute('data-request-access', 'write');
      w.appendChild(s);
    }
    if (!CFG.tg) $('#loginerr').textContent = 'Вход через Telegram ещё не настроен на сервере';
    $('#devlogin').classList.toggle('hidden', !CFG.dev);
  }
  async function botLogin() {
    const btn = $('#botlogin');
    btn.disabled = true;
    try {
      const { code, link } = await api('/api/tg/start', {});
      try { window.Capacitor?.Plugins?.Browser ? window.Capacitor.Plugins.Browser.open({ url: link }) : window.open(link, '_blank'); } catch { location.href = link; }
      $('#loginerr').style.color = 'var(--mut)';
      $('#loginerr').textContent = 'Открой бота, нажми «Запустить», потом вернись сюда…';
      for (let i = 0; i < 150; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const p = await api('/api/tg/poll?c=' + code);
        if (p.token) { TOK = p.token; store.set('cz_token', TOK); return enter(); }
        if (p.expired) break;
      }
      $('#loginerr').textContent = 'Время ожидания вышло. Попробуй ещё раз.';
    } catch (e) {
      $('#loginerr').style.color = 'var(--red)';
      $('#loginerr').textContent = e.message;
    }
    btn.disabled = false;
  }

  /* ---------------- старт ---------------- */
  async function boot() {
    try { navigator.serviceWorker?.register('/sw.js'); } catch { /* ок */ }
    try { CFG = await api('/api/config'); } catch (e) { showLogin('Нет связи с сервером'); return; }
    checkApkUpdate();
    const h = location.hash;
    if (h.startsWith('#tg=')) { TOK = h.slice(4); store.set('cz_token', TOK); history.replaceState(null, '', location.pathname); }
    else if (h === '#tgfail') { history.replaceState(null, '', location.pathname); showLogin('Telegram не подтвердил вход. Попробуй ещё раз'); }
    TOK = TOK || store.get('cz_token');
    if (TOK) {
      try { return await enter(); } catch (e) {
        if (e.status !== 401) { showLogin(e.message); return; }
        store.del('cz_token'); TOK = null;
      }
    }
    showLogin('');
  }
  async function enter() {
    setMe(await api('/api/me'));
    B = await api('/api/bosses');
    $('#login').classList.add('hidden');
    connect();
    go('boss');
    setInterval(tick, 1000);
    setInterval(async () => { try { setMe(await api('/api/me')); if (T.tab === 'boss' && T.fight !== null) softFight(); } catch { /* ок */ } }, 3000);
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible') return;
      try { setMe(await api('/api/me')); const c = await api('/api/config'); if (c.build !== CFG.build) location.reload(); } catch { /* ок */ }
    });
  }
  function connect() {
    if (es) es.close();
    es = new EventSource('/api/stream?t=' + TOK);
    es.addEventListener('init', (e) => { const d = JSON.parse(e.data); B = d.bosses; T.lb = d.lb; T.chat = d.chat; T.online = d.online; refresh(); });
    es.addEventListener('bosses', (e) => { B = JSON.parse(e.data); tick(); });
    es.addEventListener('chat', (e) => { T.chat.push(JSON.parse(e.data)); if (T.tab === 'top' && T.chatTab === 'chat') renderTop(); });
    es.addEventListener('lb', (e) => { T.lb = JSON.parse(e.data); if (T.tab === 'top' && T.chatTab === 'rate') renderTop(); });
    es.addEventListener('online', (e) => { T.online = JSON.parse(e.data).count; $('#foot').textContent = 'Онлайн: ' + T.online + ' · Developer: @yfeeeee'; });
    es.addEventListener('bossDefeated', (e) => { const d = JSON.parse(e.data); toast('Босс «' + d.name + '» повержен'); if (ME && ME.pending) api('/api/me').then(setMe).then(refresh).catch(() => {}); });
  }
  function refresh() { ({ boss: () => T.fight === null ? renderBosses() : renderFight(), eq: renderEq, inv: renderInv, top: renderTop })[T.tab](); }

  /* ---------------- бои ---------------- */
  function renderBosses() {
    T.fight = null;
    const list = CFG.bosses.filter((b) => T.filter === 'all' || Math.floor(b.i / 7) === +T.filter);
    $('#sc').innerHTML = '<h2>Общие боссы</h2><div class="chip">' + GROUPS.map((g) => '<button data-f="' + g[0] + '" class="' + (T.filter === g[0] ? 'on' : '') + '">' + g[1] + '</button>').join('') + '</div><div class="grid">' + list.map((b) =>
      '<div class="boss" data-b="' + b.i + '"><div class="pic"><img src="img/bosses/b' + String(b.i + 1).padStart(2, '0') + '.webp" alt=""></div><div class="row sp"><b>' + esc(b.name) + '</b></div><div class="row sp"><span class="lvl">Ур. ' + b.lvl + '</span><span class="tag">' + mi(b.drop) + CFG.mats[b.drop] + '</span></div><div class="bar"><i class="hpb" id="bh' + b.i + '"></i></div><div class="mut" id="bs' + b.i + '"></div></div>').join('') + '</div>';
    tickBosses();
  }
  function tickBosses() {
    for (const d of CFG.bosses) {
      const h = $('#bh' + d.i), s = $('#bs' + d.i), b = B[d.i];
      if (!h || !b) continue;
      h.style.width = Math.max(0, b.hp / d.max * 100) + '%';
      s.textContent = ME && ME.pending[d.i] ? 'Забери награду' : b.state === 'alive' ? 'Бьются: ' + b.n + ' игр.' : 'Возрождение ' + Math.max(0, Math.ceil((b.respawnAt - now()) / 1000)) + ' с';
      h.closest('.boss').classList.toggle('dead', b.state !== 'alive');
    }
  }
  function renderFight() {
    const i = T.fight, d = CFG.bosses[i], b = B[i], st = ME.stats, p = ME.pending[i];
    let act;
    if (p) act = '<div class="card"><h2 style="margin-top:0">Награда за бой</h2><div class="mut">Урон: ' + fmt(p.dmg) + ' · Ударов: ' + p.hits + ' · Игроков: ' + p.players + ' · Твой вклад: ' + p.share + '%</div><div class="row" style="margin:10px 0;gap:14px"><span class="tag" style="font-size:15px;color:var(--text)">' + mi('credits') + fmt(p.credits) + '</span><span class="tag" style="font-size:15px;color:var(--text)">' + mi(p.drop) + (p.qty ? CFG.mats[p.drop] + ' ×' + p.qty : 'не выпало') + '</span></div><button class="btn gold" data-claim="' + i + '">Забрать</button></div>';
    else if (b.state !== 'alive') act = '<div class="card mut" style="text-align:center" id="fr"></div>';
    else act = '<button class="btn" id="atk">Атаковать</button>';
    $('#sc').innerHTML = '<div class="row" style="margin:4px 0 8px"><button class="btn gray" id="back" style="width:auto;padding:8px 14px">Назад</button><h2 style="margin:0;flex:1">' + esc(d.name) + '</h2><span class="lvl">Ур. ' + d.lvl + '</span></div>' +
      '<div id="arena"><img src="img/bosses/b' + String(i + 1).padStart(2, '0') + '.webp" alt=""></div>' +
      '<div class="card"><div class="row sp mut"><span id="fbt"></span><span id="fpl"></span></div><div class="bar" style="margin:6px 0;height:14px"><i class="hpb" id="fbh"></i></div><div class="mut">Защита ' + d.def + '% · Регенерация +' + d.regen + ' за тик · Дроп: ' + CFG.mats[d.drop] + '</div></div>' +
      '<div class="card"><div class="row sp mut"><span>Ты</span><span id="fmt"></span></div><div class="bar" style="margin-top:6px;height:13px"><i class="myb" id="fmh"></i></div></div>' + act +
      '<div class="row" style="margin:10px 0">' + Object.entries(CFG.meds).map(([k, m]) => '<button class="btn gray" style="flex:1;font-size:12px;padding:9px 2px;display:flex;flex-direction:column;align-items:center;gap:3px" data-med="' + k + '"><img src="img/res/' + k + '.webp" alt="" width="28" height="28">' + m.name.split(' ')[0] + ' ×' + ME.meds[k] + '</button>').join('') + '</div><div class="log" id="fl"></div>';
    $('#sc').scrollTop = 0;
    tickFight();
  }
  // обновление без перерисовки экрана (чтобы не прыгал журнал боя)
  function softFight() { const p = ME.pending[T.fight], hasClaim = !!$('[data-claim]'); if (!!p !== hasClaim) return renderFight(); tickFight(); }
  function tickFight() {
    const i = T.fight, d = i !== null && CFG.bosses[i], b = B[i];
    if (!d || !b || !$('#fbh')) return;
    const st = ME.stats;
    $('#fbh').style.width = Math.max(0, b.hp / d.max * 100) + '%';
    $('#fbt').textContent = fmt(Math.max(0, b.hp)) + ' / ' + fmt(d.max) + ' ОЗ';
    $('#fpl').textContent = 'Сражается: ' + b.n + ' игр.';
    $('#fmt').textContent = Math.round(ME.hp) + ' / ' + Math.round(st.hp) + ' ОЗ · +' + st.regen.toFixed(1) + '/тик';
    $('#fmh').style.width = Math.max(0, ME.hp / st.hp * 100) + '%';
    const fr = $('#fr');
    if (fr) { fr.textContent = 'Босс возродится через ' + Math.max(0, Math.ceil((b.respawnAt - now()) / 1000)) + ' с'; if (b.state === 'alive') renderFight(); }
    const a = $('#atk');
    if (a) {
      const r = ME.dead - now();
      a.textContent = r > 0 ? 'Отдых ' + Math.ceil(r / 1000) + ' с' : 'Атаковать';
      a.disabled = r > 0 || b.state !== 'alive';
      if (b.state !== 'alive') renderFight();
    }
  }
  function pop(t, c) {
    const a = $('#arena'); if (!a) return;
    const e = document.createElement('div'); e.className = 'float'; e.textContent = t; e.style.color = c || '#fff';
    e.style.marginLeft = (Math.random() * 100 - 50) + 'px'; a.appendChild(e); setTimeout(() => e.remove(), 900);
  }
  function log(t) { const l = $('#fl'); if (!l) return; const p = document.createElement('div'); p.textContent = t; l.prepend(p); while (l.children.length > 4) l.lastChild.remove(); }
  async function attack() {
    if (T.busy) return;
    T.busy = true;
    try {
      const r = await api('/api/attack', { boss: T.fight });
      const a = $('#arena'); if (a) { a.classList.remove('hit'); void a.offsetWidth; a.classList.add('hit'); }
      for (const e of r.ev) {
        if (e.k === 'hit') { pop((e.crit ? 'Крит ' : '') + e.d, e.crit ? '#ffd77a' : '#fff'); log('Ты бьёшь на ' + e.d + (e.crit ? ' (крит)' : '') + (e.stun ? ' · оглушение' : '')); }
        else if (e.k === 'pmiss') { pop('Промах', '#aaa'); log('Ты промахнулся'); }
        else if (e.k === 'bdodge') { pop('Уворот', '#aaa'); log('Босс увернулся'); }
        else if (e.k === 'bmiss') log('Босс промахнулся');
        else if (e.k === 'pdodge') log('Ты увернулся');
        else if (e.k === 'bhit') log('Босс бьёт на ' + e.d);
        else if (e.k === 'lost') { log('Ты проиграл. Отдых 15 с'); toast('Поражение: потеряно 7% кредитов'); }
      }
      const was = ME.items;
      setMe(r.me); B[T.fight] = r.boss;
      for (const id of Object.keys(was)) if (was[id].dur > 0 && r.me.items[id].dur === 0) toast(CFG.items[id].name + ' сломан. Почини в «Снаряжение»');
      if (r.me.pending[T.fight] && !$('[data-claim]')) { toast('Босс повержен. Забери награду'); renderFight(); } else tickFight();
    } catch (e) {
      if (e.status === 409 && /возродился/.test(e.message)) { try { B = await api('/api/bosses'); } catch { /* ок */ } renderFight(); }
      else if (e.status !== 409 || !/быстро/.test(e.message)) toast(e.message);
    }
    T.busy = false;
  }

  /* ---------------- снаряжение ---------------- */
  function statsHtml() {
    const s = ME.stats, r = (a, b) => '<span>' + a + '</span><b>' + b + '</b>';
    return '<div class="stats">' + r('Урон', Math.round(s.min) + '–' + Math.round(s.max)) + r('Крит', s.crit.toFixed(1) + '%') + r('Здоровье', Math.round(s.hp)) + r('Защита', s.def.toFixed(1) + '%') + r('Регенерация', s.regen.toFixed(1)) + r('Уклонение', s.dodge.toFixed(1) + '%') + (s.vamp ? r('Вампиризм', '+' + s.vamp) : '') + (s.tru ? r('Ист. урон', '+' + s.tru) : '') + (s.stun ? r('Оглушение', s.stun + '%') : '') + '</div>';
  }
  function slotHtml(id) {
    const it = ME.items[id];
    return '<div class="slot' + (T.sel === id ? ' sel' : '') + (it.dur ? '' : ' broken') + '" data-it="' + id + '" style="--rc:' + RAR[it.lvl - 1][1] + '"><img src="img/items/' + id + '.webp" alt="' + esc(CFG.items[id].name) + '"><s>' + it.lvl + '</s></div>';
  }
  function renderEq() {
    const id = T.sel, def = CFG.items[id], it = ME.items[id], L = it.lvl;
    let det = '<div class="card"><div class="row"><div class="slot" style="--rc:' + RAR[L - 1][1] + ';width:72px;height:72px"><img style="width:56px;height:56px" src="img/items/' + id + '.webp" alt=""></div><div style="flex:1"><div style="font:700 17px var(--disp)">' + esc(def.name) + '</div><div class="mut">' + def.slot + ' · <span style="color:' + RAR[L - 1][1] + '">' + RAR[L - 1][0] + '</span> · ур. ' + L + '/7</div></div></div>' +
      '<div class="mut" style="margin:8px 0">' + esc(def.desc || 'Броня: здоровье, защита, регенерация, уклонение') + '</div>' +
      '<div class="row sp mut"><span>Прочность</span><span>' + it.dur + ' / 100</span></div><div class="bar" style="margin:4px 0 8px"><i class="dur" style="width:' + it.dur + '%"></i></div>' +
      (it.dur < 100 ? '<button class="btn gray" style="margin-bottom:10px" data-repair="' + id + '">Починить за ' + fmt(ME.repair[id]) + '</button>' : '');
    if (L >= 7) det += '<div class="mut">Максимальный уровень</div>';
    else {
      const c = CFG.cost[L];
      det += '<div class="mut" style="margin-bottom:4px">До уровня ' + (L + 1) + ' (' + RAR[L][0] + ')</div>' + Object.entries(c).map(([k, v]) => { const have = k === 'credits' ? ME.credits : ME.mats[k]; return '<div class="cost"><span class="l">' + mi(k) + (k === 'credits' ? 'Кредиты' : CFG.mats[k]) + '</span><span class="' + (have >= v ? 'ok' : 'bad') + '">' + fmt(have) + ' / ' + fmt(v) + '</span></div>'; }).join('') + '<button class="btn gold" style="margin-top:8px" data-up="' + id + '">Улучшить</button>';
    }
    if (def.slot === 'Оружие' && ME.eq.weapon !== id) det += '<button class="btn" style="margin-top:8px" data-wear="' + id + '">Надеть</button>';
    det += '</div>';
    $('#sc').innerHTML = '<h2>Снаряжение</h2><div class="card">' + statsHtml() + '</div><div class="mut" style="margin:0 2px 6px">Оружие</div><div class="slotrow" style="margin-bottom:10px">' + ['w1', 'w2', 'w3'].map(slotHtml).join('') + '</div><div class="mut" style="margin:0 2px 6px">Броня</div><div class="slotrow" style="margin-bottom:12px">' + CFG.armor.map(slotHtml).join('') + '</div>' + det;
  }

  /* ---------------- склад, топ, чат ---------------- */
  function renderInv() {
    $('#sc').innerHTML = '<h2>Склад</h2><div class="card"><div class="mut" style="margin-bottom:4px">Материалы с боссов</div>' + Object.keys(CFG.mats).map((k) => '<div class="cost"><span class="l">' + mi(k) + '<span>' + CFG.mats[k] + '<div class="mut" style="font-size:11px">' + CFG.bosses.filter((b) => b.drop === k).map((b) => b.name).slice(0, 2).join(', ') + '…</div></span></span><b>' + ME.mats[k] + '</b></div>').join('') + '</div>' +
      '<div class="card"><div class="mut" style="margin-bottom:4px">Медикаменты</div>' + Object.entries(CFG.meds).map(([k, m]) => '<div class="cost"><span class="l"><img src="img/res/' + k + '.webp" alt="">' + m.name + ' (+' + Math.round(m.heal * 100) + '%) · ×' + ME.meds[k] + '</span><button class="btn gray" style="width:auto;padding:6px 10px;font-size:12px" data-buymed="' + k + '">' + fmt(m.price) + '</button></div>').join('') + '</div>';
  }
  function renderTop() {
    const tabs = '<div class="chip"><button data-ct="rate" class="' + (T.chatTab === 'rate' ? 'on' : '') + '">Рейтинг</button><button data-ct="chat" class="' + (T.chatTab === 'chat' ? 'on' : '') + '">Чат</button></div>';
    let body;
    if (T.chatTab === 'rate') {
      const lb = T.lb || { top: [], me: null, players: 0 };
      body = '<div class="card"><div class="mut" style="margin-bottom:6px">Рейтинг по урону боссам · игроков: ' + lb.players + '</div>' + lb.top.map((r) => '<div class="row sp' + (r.id === ME.id ? ' me' : '') + '" style="padding:7px 8px"><span><b style="color:' + (r.rank <= 3 ? 'var(--gold)' : 'var(--mut)') + '">' + r.rank + '</b> &nbsp;' + esc(r.name) + (r.online ? ' <span style="color:var(--grn)">●</span>' : '') + '</span><span class="mut">' + fmt(r.total) + '</span></div>').join('') + (lb.me && lb.me.rank > 20 ? '<div class="row sp me" style="padding:7px 8px"><span>' + lb.me.rank + ' &nbsp;Ты</span><span class="mut">' + fmt(lb.me.total) + '</span></div>' : '') + '</div>' +
        '<div class="card row sp"><span>' + esc(ME.name) + (ME.username ? ' <span class="mut">@' + esc(ME.username) + '</span>' : '') + '</span><button class="btn gray" id="logout" style="width:auto;padding:8px 14px">Выйти</button></div>';
    } else {
      body = '<div class="card"><div id="cl" style="max-height:46vh;overflow-y:auto">' + T.chat.map((m) => '<div style="padding:3px 0">' + (m.sys ? '<span class="mut">' + esc(m.text) + '</span>' : '<b style="color:var(--cry)">' + esc(m.name) + '</b> ' + esc(m.text)) + '</div>').join('') + '</div><form id="cf" class="row" style="margin-top:10px"><input id="ci" maxlength="120" placeholder="Сообщение" autocomplete="off"><button class="btn" style="width:auto;padding:10px 16px" type="submit">Отпр.</button></form></div>';
    }
    const keep = $('#ci') ? $('#ci').value : '';
    $('#sc').innerHTML = '<h2>Топ и чат</h2>' + tabs + body;
    const cl = $('#cl'); if (cl) cl.scrollTop = cl.scrollHeight;
    if (keep && $('#ci')) { $('#ci').value = keep; $('#ci').focus(); }
  }

  function go(t) {
    T.tab = t; T.fight = null;
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    ({ boss: renderBosses, eq: renderEq, inv: renderInv, top: renderTop })[t]();
    $('#sc').scrollTop = 0;
  }
  function tick() { if (!ME) return; if (T.tab === 'boss') { T.fight === null ? tickBosses() : tickFight(); } }

  async function act(fn, ok) {
    try { const r = await fn(); if (r && r.credits !== undefined) setMe(r); else if (r && r.me) setMe(r.me); if (ok) toast(ok); } catch (e) { toast(e.message); }
    refresh();
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button,[data-b],[data-it]');
    if (!t) return;
    const d = t.dataset;
    if (t.id === 'botlogin') return botLogin();
    if (t.id === 'devlogin') return (async () => { const r = await api('/api/devlogin', { name: 'Тест' + Math.floor(Math.random() * 99) }); TOK = r.token; store.set('cz_token', TOK); enter(); })();
    if (!ME) return;
    if (d.t) return go(d.t);
    if (d.f !== undefined) { T.filter = d.f; return renderBosses(); }
    if (d.b !== undefined && T.tab === 'boss' && T.fight === null) { T.fight = +d.b; return renderFight(); }
    if (t.id === 'back') return go('boss');
    if (t.id === 'atk') return attack();
    if (d.med) return act(() => api('/api/med', { k: d.med }));
    if (d.claim !== undefined) return act(async () => { const r = await api('/api/claim', { boss: +d.claim }); toast('Получено: ' + fmt(r.got.credits) + ' кредитов' + (r.got.qty ? ' и ' + CFG.mats[r.got.drop] + ' ×' + r.got.qty : '')); return r.me; });
    if (d.ct) { T.chatTab = d.ct; return renderTop(); }
    if (d.it) { T.sel = d.it; return renderEq(); }
    if (d.wear) return act(() => api('/api/wear', { item: d.wear }), 'Оружие надето');
    if (d.repair) return act(() => api('/api/repair', { item: d.repair }), 'Починено');
    if (d.up) return act(async () => { const r = await api('/api/upgrade', { item: d.up }); toast(CFG.items[d.up].name + ' улучшен до уровня ' + r.items[d.up].lvl); return r; });
    if (d.buymed) return act(() => api('/api/buymed', { k: d.buymed }), 'Куплено');
    if (t.id === 'logout') { api('/api/logout', {}).catch(() => {}); store.del('cz_token'); location.reload(); }
  });
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'cf') return;
    e.preventDefault();
    const v = $('#ci').value.trim();
    if (!v) return;
    try { await api('/api/chat', { text: v }); $('#ci').value = ''; } catch (er) { toast(er.message); }
  });

  /* ---------------- обновление APK ---------------- */
  async function appBuild() { try { return Number((await window.Capacitor.Plugins.App.getInfo()).build) || 0; } catch { return 0; } }
  async function checkApkUpdate() {
    if (!window.Capacitor) return;
    try {
      const r = await fetch('/apk.json', { cache: 'no-store' });
      if (!r.ok) return;
      const latest = await r.json();
      if (latest.versionCode <= (await appBuild())) return;
      if (sessionStorage.getItem('cz_upd_skip') === String(latest.versionCode)) return;
      $('#update-text').textContent = 'Вышла новая версия приложения (' + (latest.versionName || latest.versionCode) + '). Скачай и установи её поверх старой, прогресс сохранится.';
      $('#update-modal').classList.remove('hidden');
      $('#update-ok').onclick = () => { try { window.Capacitor.Plugins.Browser.open({ url: latest.url }); } catch { location.href = latest.url; } };
      $('#update-later').onclick = () => { sessionStorage.setItem('cz_upd_skip', String(latest.versionCode)); $('#update-modal').classList.add('hidden'); };
    } catch { /* нет связи */ }
  }

  try { const tg = window.Telegram && window.Telegram.WebApp; if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor && tg.setHeaderColor('#07050f'); } } catch { /* не в Telegram */ }
  boot();
})();
