"""
Lootify App: вход вне Telegram и оболочка приложения (меню игр).
Developer: @yfeeeee

Страницы бота (/market, /games, /crystal, /saga, /realms, /raid) узнают игрока по строке
Telegram.WebApp.initData и проверяют её одной функцией market_check_init_data.
Этот модуль добавляет второй вид «initData»: подписанный токен вида "app:<данные>.<подпись>".
Токен выдаётся после входа через бота (ссылка t.me/<бот>?start=login_<код>) или через Telegram Login Widget.
Токен не хранится в базе: он подписан ключом из токена бота и действует TOKEN_TTL секунд.

Подключение (см. lootify_app.patch):
    lootify_app.check_token(TOKEN, init_data)   — в market_check_init_data
    lootify_app.install(app, ...)               — рядом с terraria_game.install(...)
    lootify_app.confirm(code, uid, name)        — в обработчике /start при payload login_<код>
"""
import base64
import hashlib
import hmac
import json
import secrets
import time

TOKEN_TTL = 90 * 86400
CODE_TTL = 10 * 60
_pending = {}  # код входа -> {"ts", "uid", "name"}
_hits = {}  # простой лимит запросов по IP


def _key(bot_token: str) -> bytes:
    return hashlib.sha256(b"lootify-app:" + bot_token.encode()).digest()


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def make_token(bot_token: str, uid: int, name: str) -> str:
    payload = _b64(json.dumps({"i": int(uid), "n": str(name)[:24], "e": int(time.time()) + TOKEN_TTL},
                              ensure_ascii=False, separators=(",", ":")).encode())
    sig = _b64(hmac.new(_key(bot_token), payload.encode(), hashlib.sha256).digest())
    return f"app:{payload}.{sig}"


def check_token(bot_token: str, init_data: str):
    """Возвращает {"id", "first_name"} или None. Совместимо с результатом market_check_init_data."""
    try:
        if not init_data.startswith("app:"):
            return None
        payload, sig = init_data[4:].split(".", 1)
        want = _b64(hmac.new(_key(bot_token), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(want, sig):
            return None
        d = json.loads(_unb64(payload))
        if int(d["e"]) < time.time():
            return None
        return {"id": int(d["i"]), "first_name": str(d.get("n") or "Игрок")}
    except Exception:
        return None


def verify_widget(bot_token: str, q: dict) -> bool:
    """Подпись Telegram Login Widget: HMAC-SHA256, ключ sha256(токен бота)."""
    try:
        got = str(q.get("hash", ""))
        check = "\n".join(f"{k}={q[k]}" for k in sorted(q) if k != "hash")
        want = hmac.new(hashlib.sha256(bot_token.encode()).digest(), check.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(want, got) and time.time() - int(q.get("auth_date", "0")) < 86400
    except Exception:
        return False


def new_code() -> str:
    now = time.time()
    for c in [c for c, p in _pending.items() if now - p["ts"] > CODE_TTL]:
        _pending.pop(c, None)
    code = secrets.token_hex(12)
    _pending[code] = {"ts": now, "uid": None, "name": ""}
    return code


def confirm(code: str, uid: int, name: str) -> bool:
    """Вызывается ботом, когда игрок нажал «Запустить» по ссылке входа."""
    p = _pending.get(code)
    if not p or time.time() - p["ts"] > CODE_TTL or p["uid"] is not None:
        return False
    p["uid"], p["name"] = int(uid), name or "Игрок"
    return True


def poll(bot_token: str, code: str) -> dict:
    p = _pending.get(code)
    if not p or time.time() - p["ts"] > CODE_TTL:
        return {"expired": True}
    if p["uid"] is None:
        return {"wait": True}
    _pending.pop(code, None)
    return {"token": make_token(bot_token, p["uid"], p["name"])}


# ---------- общий чат приложения и Telegram-группы ----------
CHAT_MAX = 300          # сколько последних сообщений помнит сервер
CHAT_TEXT_MAX = 300     # длина одного сообщения
_chat = []              # [{"id","ts","uid","name","text","src"}]
_chat_seq = [0]


def chat_add(uid: int, name: str, text: str, src: str) -> dict:
    _chat_seq[0] += 1
    m = {"id": _chat_seq[0], "ts": int(time.time()), "uid": int(uid), "name": (name or "Игрок")[:32],
         "text": text[:CHAT_TEXT_MAX], "src": src}
    _chat.append(m)
    if len(_chat) > CHAT_MAX:
        del _chat[:len(_chat) - CHAT_MAX]
    return m


def chat_since(after: int) -> list:
    if after <= 0:
        return list(_chat[-100:])
    return [m for m in _chat if m["id"] > after][-200:]


_KINDS = {"photo": "📷 Фото", "sticker": "Стикер", "voice": "🎤 Голосовое", "video": "🎬 Видео", "animation": "GIF",
          "document": "📎 Файл", "video_note": "⭕ Кружок", "audio": "🎵 Аудио", "poll": "📊 Опрос"}


def mirror_from_tg(message, chat_id: int) -> None:
    """Вызывается из middleware бота для КАЖДОГО входящего сообщения; кладёт в чат только сообщения нужной группы."""
    try:
        if not chat_id or message.chat.id != chat_id:
            return
        u = message.from_user
        if u is None or u.is_bot:
            return
        text = (message.text or message.caption or "").strip()
        if text.startswith("/"):
            return
        if not text:
            kind = _KINDS.get(getattr(message, "content_type", ""), "")
            if not kind:
                return
            text = kind + ((" " + message.sticker.emoji) if kind == "Стикер" and getattr(message.sticker, "emoji", None) else "")
        chat_add(u.id, u.full_name or u.username or "Игрок", text, "tg")
    except Exception:
        pass


def _limited(ip: str, key: str, max_n: int, window: float) -> bool:
    now = time.time()
    k = f"{key}:{ip}"
    arr = [t for t in _hits.get(k, []) if now - t < window] + [now]
    _hits[k] = arr
    if len(_hits) > 5000:
        _hits.clear()
    return len(arr) > max_n


CHAT_HTML = r"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#07050f"><title>Чат Lootify</title>
<style>
:root{--bg:#07050f;--panel:#120d22;--line:#2b2150;--tx:#ece8ff;--mut:#8f86b8;--acc:#ff5d73}
*{box-sizing:border-box}html,body{height:100%;margin:0;background:var(--bg);color:var(--tx);font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#w{height:100dvh;max-width:560px;margin:0 auto;display:flex;flex-direction:column}
#hd{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 10px;border-bottom:1px solid var(--line);background:var(--panel)}
#hd b{flex:1;font-size:16px}#hd a,#hd button{color:var(--tx);background:#1c1536;border:1px solid var(--line);border-radius:10px;padding:6px 11px;font:700 13px system-ui;text-decoration:none;cursor:pointer}
#ls{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:7px;-webkit-overflow-scrolling:touch}
.m{max-width:84%;background:#1c1536;border:1px solid var(--line);border-radius:14px;padding:6px 10px;word-break:break-word;white-space:pre-wrap}
.m.me{align-self:flex-end;background:#3a2380;border-color:#5a3bb8}
.m .n{font-size:11.5px;font-weight:800;color:#c9a8ff}.m.me .n{color:#e3d4ff}.m .n i{font-style:normal;color:var(--mut);font-weight:600;margin-left:6px}
#f{display:flex;gap:8px;padding:8px 12px calc(env(safe-area-inset-bottom,0px) + 8px);border-top:1px solid var(--line);background:var(--panel)}
#t{flex:1;min-width:0;border:1px solid var(--line);background:#0d0820;color:var(--tx);border-radius:12px;padding:11px 12px;font:15px system-ui;outline:0}
#s{border:0;border-radius:12px;padding:0 16px;font:800 15px system-ui;color:#fff;background:linear-gradient(#c66bff,#7a4bff)}
#e{color:var(--acc);font-size:12px;text-align:center;min-height:0}
.mut{color:var(--mut);text-align:center;margin:auto;padding:20px}
</style></head><body><div id="w">
<div id="hd"><a id="back" href="/app">← Меню</a><b>💬 Общий чат</b><button id="x" style="display:none">✕</button></div>
<div id="ls"></div><div id="e"></div>
<form id="f"><input id="t" maxlength="300" placeholder="Сообщение…" autocomplete="off"><button id="s" type="submit">➤</button></form>
</div>
<script>
(function(){
var $=function(s){return document.querySelector(s)};
var tok=null;try{tok=localStorage.getItem('lootify_token')}catch(e){}
var inFrame=window.parent!==window;
if(inFrame){$('#back').style.display='none';$('#x').style.display='';$('#x').onclick=function(){parent.postMessage('lootify-chat-close','*')}}
var ls=$('#ls'),last=0,me=0;
function esc(t){return String(t==null?'':t)}
try{var p=tok.slice(4).split('.')[0].replace(/-/g,'+').replace(/_/g,'/');while(p.length%4)p+='=';me=JSON.parse(atob(p)).i}catch(e){}
if(!tok){ls.innerHTML='<div class="mut">Сначала войди в приложение через меню</div>';$('#f').style.display='none';return}
function hhmm(ts){var d=new Date(ts*1000);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
function add(list){
  if(!list.length)return;
  var near=ls.scrollHeight-ls.scrollTop-ls.clientHeight<90;
  list.forEach(function(m){
    if(m.id<=last)return;last=m.id;
    var d=document.createElement('div');d.className='m'+(m.uid===me?' me':'');
    var n=document.createElement('div');n.className='n';n.textContent=m.name;
    var i=document.createElement('i');i.textContent=(m.src==='tg'?'Telegram · ':'')+hhmm(m.ts);n.appendChild(i);
    var t=document.createElement('div');t.textContent=esc(m.text);
    d.appendChild(n);d.appendChild(t);ls.appendChild(d);
  });
  while(ls.children.length>250)ls.removeChild(ls.firstChild);
  if(near||last===list[list.length-1].id&&ls.children.length===list.length)ls.scrollTop=ls.scrollHeight;
  try{localStorage.setItem('lootify_chat_seen',String(last))}catch(e){}
}
async function load(){
  try{
    var r=await fetch('/app/api/chat?after='+last,{headers:{'X-Token':tok},cache:'no-store'});
    if(r.status===401){ls.innerHTML='<div class="mut">Сессия устарела. Войди заново через меню</div>';return false}
    var j=await r.json();add(j.msgs||[]);
  }catch(e){}
  return true;
}
$('#f').onsubmit=async function(ev){
  ev.preventDefault();var t=$('#t'),v=t.value.trim();if(!v)return;t.value='';$('#e').textContent='';
  try{
    var r=await fetch('/app/api/chat',{method:'POST',headers:{'X-Token':tok,'Content-Type':'application/json'},body:JSON.stringify({text:v})});
    var j=await r.json().catch(function(){return{}});
    if(!r.ok){$('#e').textContent=j.error||('Ошибка '+r.status);t.value=v}else{await load();ls.scrollTop=ls.scrollHeight}
  }catch(e){$('#e').textContent='Нет связи';t.value=v}
};
(async function loop(){var ok=await load();if(ok===false)return;setTimeout(loop,document.hidden?6000:2500)})();
})();
</script></body></html>
"""

# Маленькая кнопка «в меню» поверх страниц игр, только когда игра открыта из приложения.
BACK_SCRIPT = (
    '<script>/*__lootifyBack*/(function(){try{var w=window.Telegram&&Telegram.WebApp;'
    'if(!w||String(w.initData||"").indexOf("app:")!==0)return;'
    'var st="position:fixed;top:6px;z-index:2147483000;font:700 11px system-ui,sans-serif;color:#ece8ff;'
    'background:#120d22cc;border:1px solid #2b2150;border-radius:10px;padding:5px 9px;text-decoration:none;opacity:.75;cursor:pointer";'
    'var b=document.createElement("a");b.href="/app";b.textContent="\\u2630 Меню";b.style.cssText=st+";left:6px";document.body.appendChild(b);'
    'var c=document.createElement("a");c.textContent="\\uD83D\\uDCAC Чат";c.style.cssText=st+";left:78px";document.body.appendChild(c);'
    'var f=null;c.onclick=function(e){e.preventDefault();if(f)return;'
    'try{localStorage.setItem("lootify_token",w.initData)}catch(x){}'
    'f=document.createElement("iframe");f.src="/app/chat";'
    'f.style.cssText="position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483600;background:#07050f";'
    'document.body.appendChild(f)};'
    'window.addEventListener("message",function(e){if(e.data==="lootify-chat-close"&&f){f.remove();f=null}})'
    '}catch(e){}})();</script>'
)

ICON_B64 = "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"

GAMES = [
    ("market", "/market", "Маркет", "Покупай и продавай снаряжение и ресурсы", "🛒"),
    ("arcade", "/games", "Игровой зал", "Пакмен, 2048, судоку и казино", "🎮"),
    ("saga", "/saga", "Lootify Worlds", "2D-песочница: копай, крафти, строй", "🌍"),
    ("realms", "/realms", "Lootify Realms", "3D-приключение с головоломками", "🧊"),
    ("sboss", "/raid", "Пожиратель Душ", "Общий босс для всех игроков", "👹"),
    ("crystal", "/crystal", "Кристалл", "Обелиски, руны и мастерская", "💎"),
]

APP_HTML = r"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#07050f">
<title>Lootify</title>
<style>
:root{--bg:#07050f;--panel:#120d22;--panel2:#1c1536;--line:#2b2150;--tx:#ece8ff;--mut:#8f86b8;--acc:#ff5d73;--gold:#ffc857;--pur:#b44bff}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--tx);font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
body{display:flex;justify-content:center}
#app{width:100%;max-width:520px;min-height:100dvh;padding:calc(env(safe-area-inset-top,0px) + 14px) 14px 20px;display:flex;flex-direction:column;gap:14px}
h1{margin:0;font-size:26px;font-weight:900}
.mut{color:var(--mut);font-size:13px}
.hero{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:36px 8px 8px}
.hero img{width:140px;height:140px;border-radius:50%;box-shadow:0 0 40px #b44bff88}
.btn{border:0;border-radius:12px;padding:14px;font:800 15px system-ui,sans-serif;color:#fff;background:linear-gradient(#c66bff,#7a4bff);box-shadow:0 3px 0 #3d2394;width:100%;cursor:pointer}
.btn:active{transform:translateY(2px);box-shadow:0 1px 0 #3d2394}
.btn.gray{background:var(--panel2);box-shadow:0 3px 0 #07050f;border:1px solid var(--line)}
.btn[disabled]{opacity:.5;pointer-events:none}
.box{display:flex;flex-direction:column;gap:10px;align-items:center;width:100%;max-width:340px;margin:0 auto}
.err{color:var(--acc);min-height:18px;font-size:13px;text-align:center}
.top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.top .who{display:flex;align-items:center;gap:10px}
.top img{width:34px;height:34px;border-radius:50%}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tile{background:linear-gradient(#150f2b,#0d0820);border:1px solid var(--line);border-radius:16px;padding:14px 12px;text-align:left;color:var(--tx);cursor:pointer;display:flex;flex-direction:column;gap:6px;min-height:128px}
.tile:active{transform:scale(.98)}
.tile .ic{font-size:30px}
.tile b{font-size:15px}
.hidden{display:none!important}
</style>
</head>
<body>
<div id="app">
 <div id="login" class="hero hidden">
  <img src="data:image/webp;base64,__ICON__" alt="">
  <h1>Lootify</h1>
  <p class="mut">Все игры Lootify в одном приложении. Прогресс общий с ботом.</p>
  <div class="box">
   <button class="btn" id="bot">Войти через бота</button>
   <div id="widget" style="min-height:44px"></div>
   <div class="err" id="err"></div>
   <div class="mut" style="font-size:11.5px">Developer: @yfeeeee</div>
  </div>
 </div>
 <div id="menu" class="hidden">
  <div class="top"><div class="who"><img src="data:image/webp;base64,__ICON__" alt=""><div><b id="nm"></b><div class="mut">Общий прогресс с ботом</div></div></div><button class="btn gray" id="out" style="width:auto;padding:8px 14px">Выйти</button></div>
  <button class="btn" id="chat" style="margin-top:14px">💬 Общий чат <span id="bd" style="display:none;background:#ff5d73;border-radius:9px;padding:1px 7px;margin-left:6px;font-size:12px"></span></button>
  <div class="grid" id="grid" style="margin-top:12px"></div>
  <div class="mut" style="text-align:center;margin-top:16px;font-size:11.5px">Developer: @yfeeeee</div>
 </div>
</div>
<script>
(function(){
var BOT=__BOT__, GAMES=__GAMES__;
var $=function(s){return document.querySelector(s)};
var store={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}},del:function(k){try{localStorage.removeItem(k)}catch(e){}}};
function nameOf(t){try{var p=t.slice(4).split('.')[0].replace(/-/g,'+').replace(/_/g,'/');while(p.length%4)p+='=';return JSON.parse(decodeURIComponent(escape(atob(p)))).n}catch(e){return 'Игрок'}}
function menu(tok){
  $('#login').classList.add('hidden');$('#menu').classList.remove('hidden');$('#nm').textContent=nameOf(tok);
  $('#grid').innerHTML=GAMES.map(function(g){return '<button class="tile" data-p="'+g[1]+'"><span class="ic">'+g[4]+'</span><b>'+g[2]+'</b><span class="mut">'+g[3]+'</span></button>'}).join('');
}
function login(msg){
  $('#menu').classList.add('hidden');$('#login').classList.remove('hidden');$('#err').textContent=msg||'';
  var w=$('#widget');
  if(BOT&&!w.firstChild){var s=document.createElement('script');s.async=true;s.src='https://telegram.org/js/telegram-widget.js?22';
    s.setAttribute('data-telegram-login',BOT);s.setAttribute('data-size','large');s.setAttribute('data-radius','12');s.setAttribute('data-userpic','false');
    s.setAttribute('data-auth-url',location.origin+'/app/tg');s.setAttribute('data-request-access','write');w.appendChild(s)}
}
async function post(u){var r=await fetch(u,{method:'POST'});var j=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(j.error||('Ошибка '+r.status));return j}
$('#bot').onclick=async function(){
  var b=$('#bot');b.disabled=true;$('#err').style.color='';
  try{
    var s=await post('/app/api/start');
    try{window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Browser?window.Capacitor.Plugins.Browser.open({url:s.link}):window.open(s.link,'_blank')}catch(e){location.href=s.link}
    $('#err').style.color='#8f86b8';$('#err').textContent='Открой бота, нажми «Запустить» и вернись сюда…';
    for(var i=0;i<150;i++){
      await new Promise(function(r){setTimeout(r,2000)});
      var p=await (await fetch('/app/api/poll?c='+s.code)).json();
      if(p.token){store.set('lootify_token',p.token);return menu(p.token)}
      if(p.expired)break;
    }
    $('#err').textContent='Время ожидания вышло. Попробуй ещё раз.';
  }catch(e){$('#err').style.color='';$('#err').textContent=e.message}
  b.disabled=false;
};
$('#chat').onclick=function(){location.href='/app/chat'};
async function badge(){
  var tk=store.get('lootify_token');if(!tk||$('#menu').classList.contains('hidden'))return;
  try{var seen=+store.get('lootify_chat_seen')||0;
    var r=await fetch('/app/api/chat?after='+seen,{headers:{'X-Token':tk},cache:'no-store'});if(!r.ok)return;
    var j=await r.json(),n=(j.msgs||[]).length,b=$('#bd');if(seen===0&&n>=100)n=0;
    if(n>0){b.textContent=n>99?'99+':n;b.style.display=''}else b.style.display='none'}catch(e){}
}
setInterval(badge,5000);setTimeout(badge,600);
$('#out').onclick=function(){store.del('lootify_token');login('')};
document.addEventListener('click',function(e){var t=e.target.closest('.tile');if(!t)return;
  var tok=store.get('lootify_token');if(!tok)return login('');
  location.href=t.dataset.p+'#tgWebAppData='+encodeURIComponent(tok)+'&tgWebAppVersion=7.0';
});
var h=location.hash;
if(h.indexOf('#tg=')===0){store.set('lootify_token',decodeURIComponent(h.slice(4)));history.replaceState(null,'',location.pathname)}
else if(h==='#tgfail'){history.replaceState(null,'',location.pathname);login('Telegram не подтвердил вход или ты не зарегистрирован в боте')}
var tok=store.get('lootify_token');
if(tok)menu(tok);else if(h!=='#tgfail')login('');
})();
</script>
</body>
</html>
"""


def install(app, bot_token: str, bot_username_cb, has_user_cb, icon_b64: str = "", send_cb=None):
    icon_b64 = icon_b64 or ICON_B64
    """Регистрирует /app (оболочка), /app/api/start, /app/api/poll, /app/tg (виджет Telegram).
    bot_username_cb: async () -> имя бота; has_user_cb: async (uid) -> зарегистрирован ли игрок."""
    from aiohttp import web

    def ip_of(request):
        return (request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or request.remote or "?")

    async def page(request):
        uname = ""
        try:
            uname = await bot_username_cb()
        except Exception:
            pass
        html = (APP_HTML.replace("__ICON__", icon_b64).replace("__BOT__", json.dumps(uname))
                .replace("__GAMES__", json.dumps(GAMES, ensure_ascii=False)))
        return web.Response(text=html, content_type="text/html", charset="utf-8", headers={"Cache-Control": "no-store"})

    async def start(request):
        if _limited(ip_of(request), "start", 30, 3600):
            return web.json_response({"error": "Слишком много попыток, попробуй позже"}, status=429)
        uname = await bot_username_cb()
        if not uname:
            return web.json_response({"error": "Бот ещё не готов"}, status=503)
        code = new_code()
        return web.json_response({"code": code, "link": f"https://t.me/{uname}?start=login_{code}"})

    async def poll_h(request):
        return web.json_response(poll(bot_token, request.query.get("c", "")))

    async def widget_cb(request):
        q = dict(request.query)
        if not verify_widget(bot_token, q):
            raise web.HTTPFound("/app#tgfail")
        uid = int(q["id"])
        if not await has_user_cb(uid):
            raise web.HTTPFound("/app#tgfail")
        name = " ".join(x for x in (q.get("first_name"), q.get("last_name")) if x) or q.get("username") or "Игрок"
        tok = make_token(bot_token, uid, name)
        raise web.HTTPFound("/app#tg=" + tok)

    async def chat_page(request):
        return web.Response(text=CHAT_HTML, content_type="text/html", charset="utf-8", headers={"Cache-Control": "no-store"})

    def who(request):
        return check_token(bot_token, request.headers.get("X-Token", ""))

    async def chat_get(request):
        u = who(request)
        if not u:
            return web.json_response({"error": "auth"}, status=401)
        try:
            after = int(request.query.get("after", "0"))
        except ValueError:
            after = 0
        return web.json_response({"msgs": chat_since(after)})

    async def chat_post(request):
        u = who(request)
        if not u:
            return web.json_response({"error": "Войди заново через меню"}, status=401)
        if _limited(str(u["id"]), "chat", 8, 20):
            return web.json_response({"error": "Не так быстро"}, status=429)
        try:
            text = str((await request.json()).get("text", "")).strip()
        except Exception:
            text = ""
        if not text:
            return web.json_response({"error": "Пустое сообщение"}, status=400)
        text = text[:CHAT_TEXT_MAX]
        if not await has_user_cb(u["id"]):
            return web.json_response({"error": "Ты не зарегистрирован в боте"}, status=403)
        chat_add(u["id"], u["first_name"], text, "app")
        if send_cb is not None:
            try:
                await send_cb(f"📱 {u['first_name']}: {text}")
            except Exception as e:
                print(f"[app] чат: не отправилось в Telegram: {e!r}")
        return web.json_response({"ok": True})

    app.router.add_get("/app/chat", chat_page)
    app.router.add_get("/app/api/chat", chat_get)
    app.router.add_post("/app/api/chat", chat_post)
    app.router.add_get("/app", page)
    app.router.add_post("/app/api/start", start)
    app.router.add_get("/app/api/poll", poll_h)
    app.router.add_get("/app/tg", widget_cb)
