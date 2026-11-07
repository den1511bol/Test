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
_chat_dirty = [False]


def chat_restore(saved) -> None:
    """Загружает историю, сохранённую в базе (вызывается при старте)."""
    try:
        msgs = [m for m in (saved or {}).get("msgs", []) if isinstance(m, dict) and "id" in m][-CHAT_MAX:]
        if msgs and not _chat:
            _chat.extend(msgs)
            _chat_seq[0] = max(int(m["id"]) for m in msgs)
    except Exception:
        pass


def chat_add(uid: int, name: str, text: str, src: str) -> dict:
    _chat_seq[0] += 1
    m = {"id": _chat_seq[0], "ts": int(time.time()), "uid": int(uid), "name": (name or "Игрок")[:32],
         "text": text[:CHAT_TEXT_MAX], "src": src}
    _chat.append(m)
    if len(_chat) > CHAT_MAX:
        del _chat[:len(_chat) - CHAT_MAX]
    _chat_dirty[0] = True
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

ME_HTML = r"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#07050f"><title>Профиль Lootify</title>
<style>
:root{--bg:#07050f;--panel:#120d22;--p2:#1c1536;--line:#2b2150;--tx:#ece8ff;--mut:#8f86b8;--acc:#ff5d73;--gold:#ffc857}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#w{max-width:520px;margin:0 auto;min-height:100dvh;padding:calc(env(safe-area-inset-top,0px) + 12px) 14px 24px}
.hd{display:flex;align-items:center;gap:10px;margin-bottom:12px}.hd a{color:var(--tx);background:var(--p2);border:1px solid var(--line);border-radius:10px;padding:6px 11px;font:700 13px system-ui;text-decoration:none}.hd b{font-size:18px}
.tabs{display:flex;gap:8px;margin-bottom:12px}.tabs button{flex:1;border:1px solid var(--line);background:var(--p2);color:var(--mut);border-radius:12px;padding:10px;font:800 14px system-ui}
.tabs button.on{color:#fff;background:linear-gradient(#c66bff,#7a4bff);border-color:#7a4bff}
.card{background:linear-gradient(#150f2b,#0d0820);border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:12px}
.nm{font-size:22px;font-weight:900}.mut{color:var(--mut);font-size:13px}
.bar{height:10px;border-radius:6px;background:#0d0820;border:1px solid var(--line);overflow:hidden;margin:8px 0 4px}.bar i{display:block;height:100%;background:linear-gradient(90deg,#7a4bff,#ff5d73)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.st{background:var(--p2);border:1px solid var(--line);border-radius:12px;padding:10px}.st .v{font-size:17px;font-weight:900}.st .k{color:var(--mut);font-size:12px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.chips button{border:1px solid var(--line);background:var(--p2);color:var(--mut);border-radius:10px;padding:6px 10px;font:700 12.5px system-ui}.chips button.on{color:#fff;border-color:#7a4bff;background:#3a2380}
.row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid #1d1638}.row:last-child{border:0}.row.me{background:#3a238055;border-radius:10px}
.pl{width:28px;text-align:center;font-weight:900;color:var(--gold)}.rn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}.rv{font-weight:900}
.err{color:var(--acc);text-align:center;padding:20px}
.it{display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid #1d1638}.it:last-child{border:0}.it.eq{background:#3a238033;border-radius:10px;padding:7px 8px}.ie{font-size:26px;width:34px;text-align:center}.eqb{border:0;border-radius:10px;padding:8px 11px;font:800 12.5px system-ui;color:#fff;background:linear-gradient(#c66bff,#7a4bff);flex:none}.eqb[disabled]{opacity:.5}.ib{min-width:0;flex:1}.ib b{font-size:14px}.hidden{display:none}
</style></head><body><div id="w">
<div class="hd"><a href="/app">← Меню</a><b id="ttl">Профиль</b></div>
<div class="tabs"><button id="t1" class="on">👤 Профиль</button><button id="t3">🎒 Вещи</button><button id="t2">🏆 Рейтинг</button></div>
<div id="v1"></div><div id="v3" class="hidden"></div><div id="v2" class="hidden"></div>
<div class="mut" style="text-align:center;margin-top:14px;font-size:11.5px">Developer: @yfeeeee</div>
</div>
<script>
(function(){
var $=function(s){return document.querySelector(s)};
var tok=null;try{tok=localStorage.getItem('lootify_token')}catch(e){}
function T(x){var d=document.createElement('div');d.textContent=x==null?'':x;return d.innerHTML}
function fail(el,m){el.innerHTML='<div class="err">'+T(m)+'</div>'}
async function api(u){var r=await fetch(u,{headers:{'X-Token':tok},cache:'no-store'});if(r.status===401)throw new Error('Сессия устарела. Войди заново через меню');var j=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(j.error||('Ошибка '+r.status));return j}
function tab(n){[1,2,3].forEach(function(i){$('#t'+i).className=n===i?'on':'';$('#v'+i).className=n===i?'':'hidden'});$('#ttl').textContent=n===1?'Профиль':n===2?'Рейтинг':'Вещи';
  if(n===2&&!$('#v2').dataset.l){$('#v2').dataset.l=1;top('level','all')}if(n===3&&!$('#v3').dataset.l){$('#v3').dataset.l=1;inv()}}
$('#t1').onclick=function(){tab(1)};$('#t2').onclick=function(){tab(2)};$('#t3').onclick=function(){tab(3)};
function ic(it){return '<div class="it'+(it.eq?' eq':'')+'"><div class="ie">'+T(it.emoji)+'</div><div class="ib"><b>'+T(it.name)+(it.eq?' ✨':'')+'</b><div class="mut">'+T(it.rarity_emoji)+' '+T(it.rarity)+(it.slot?' · '+T(it.slot):'')+' · ур. '+T(it.level)+(it.eng?' · грав. '+T(it.eng):'')+(it.fusion?' · скр. '+T(it.fusion):'')+'</div><div class="mut">'+T(it.stat)+'</div></div><button class="eqb" data-iid="'+T(it.iid)+'">'+(it.eq?'Снять':'Надеть')+'</button></div>'}
async function inv(){
  var el=$('#v3');
  try{var d=await api('/app/api/inventory');
    var h='<div class="card"><b>Надето</b><div style="margin-top:8px">'+(d.weapon?ic(d.weapon):'<div class="mut">Оружие не надето</div>')+d.armor.map(function(a){return a.item?ic(a.item):'<div class="mut" style="padding:4px 0">'+T(a.slot)+': пусто</div>'}).join('')+'</div></div>';
    h+='<div class="card"><b>Инвентарь</b> <span class="mut">'+d.count+'/'+d.max+(d.trash?' · в корзине '+d.trash:'')+'</span><div style="margin-top:8px">'+(d.items.length?d.items.map(ic).join(''):'<div class="mut">Пусто. Открывай сундуки командой ролл в боте.</div>')+'</div></div>';
    el.innerHTML=h;
    el.querySelectorAll('.eqb').forEach(function(b){b.onclick=async function(){
      b.disabled=true;
      try{var r=await fetch('/app/api/inventory/toggle',{method:'POST',headers:{'X-Token':tok,'Content-Type':'application/json'},body:JSON.stringify({iid:+b.dataset.iid})});
        var j=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(j.error||('Ошибка '+r.status));
        var y=window.scrollY;await inv();window.scrollTo(0,y);profile();
      }catch(e){b.disabled=false;alert(e.message)}}});
  }catch(e){fail(el,e.message)}
}
async function profile(){
  var el=$('#v1');
  try{var p=await api('/app/api/profile');
    el.innerHTML='<div class="card"><div class="nm">'+T(p.name)+'</div><div class="mut">Престиж: '+T(p.prestige)+' · с '+T(p.joined)+'</div>'
     +'<div style="margin-top:10px"><b>Уровень '+T(p.level)+'</b></div><div class="bar"><i style="width:'+(+p.xp_pct||0)+'%"></i></div><div class="mut">'+T(p.xp)+' / '+T(p.xp_need)+' опыта</div></div>'
     +'<div class="grid">'+[['🔥','Сила',p.power],['❤️','Броня, HP',p.armor_hp],['⚪','Монеты',p.coins],['🎲','Роллы',p.rolls],['👑','Боссов убито',p.boss_kills]]
        .map(function(a){return '<div class="st"><div class="v">'+a[0]+' '+T(a[2])+'</div><div class="k">'+a[1]+'</div></div>'}).join('')+'</div>';
  }catch(e){fail(el,e.message)}
}
async function top(c,p){
  var el=$('#v2');
  try{var d=await api('/app/api/top?c='+c+'&p='+p);
    var h='<div class="chips">'+d.cats.map(function(k){return '<button data-c="'+T(k[0])+'" class="'+(k[0]===d.category?'on':'')+'">'+T(k[1])+'</button>'}).join('')+'</div>';
    if(d.can_day)h+='<div class="chips"><button data-p="all" class="'+(d.period==='all'?'on':'')+'">За всё время</button><button data-p="day" class="'+(d.period==='day'?'on':'')+'">За день</button></div>';
    h+='<div class="card" style="padding:4px">'+(d.rows.length?d.rows.map(function(r){return '<div class="row'+(r.me?' me':'')+'"><div class="pl">'+r.place+'</div><div class="rn">'+T(r.name)+'</div><div class="rv">'+T(r.value)+'</div></div>'}).join(''):'<div class="err">Пока пусто</div>')+'</div>';
    if(d.me&&!d.rows.some(function(r){return r.me}))h+='<div class="card">Твоё место: <b>'+d.me.place+'</b> — '+T(d.me.value)+' '+T(d.unit)+'</div>';
    el.innerHTML=h;
    el.querySelectorAll('[data-c]').forEach(function(b){b.onclick=function(){top(b.dataset.c,'all')}});
    el.querySelectorAll('[data-p]').forEach(function(b){b.onclick=function(){top(d.category,b.dataset.p)}});
  }catch(e){fail(el,e.message)}
}
if(!tok){fail($('#v1'),'Сначала войди в приложение через меню')}else{profile();if(location.hash==='#top')tab(2);if(location.hash==='#inv')tab(3)}
})();
</script></body></html>
"""

BOT_HTML = r"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#07050f"><title>Lootify бот</title>
<style>
:root{--bg:#07050f;--panel:#120d22;--p2:#1c1536;--line:#2b2150;--tx:#ece8ff;--mut:#8f86b8;--acc:#ff5d73}
*{box-sizing:border-box}html,body{height:100%;margin:0;background:var(--bg);color:var(--tx);font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#w{height:100dvh;max-width:560px;margin:0 auto;display:flex;flex-direction:column}
#hd{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 10px;border-bottom:1px solid var(--line);background:var(--panel)}
#hd b{flex:1;font-size:16px}#hd a{color:var(--tx);background:var(--p2);border:1px solid var(--line);border-radius:10px;padding:6px 11px;font:700 13px system-ui;text-decoration:none}
#aa{border:1px solid #5a3bb8;background:#241a4d;color:var(--tx);border-radius:10px;padding:6px 10px;font:800 12px system-ui;cursor:pointer}#aa.on{background:linear-gradient(#c66bff,#7a4bff);color:#fff}
#ls{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px;-webkit-overflow-scrolling:touch}
.m{max-width:92%;align-self:flex-start;display:flex;flex-direction:column;gap:6px}
.m .tx{background:var(--p2);border:1px solid var(--line);border-radius:14px;padding:8px 11px;word-break:break-word;white-space:pre-wrap}
.m.me{align-self:flex-end}.m.me .tx{background:#3a2380;border-color:#5a3bb8}
.tx blockquote{margin:4px 0;padding:4px 9px;border-left:3px solid #7a4bff;background:#0d0820;border-radius:6px}
.tx code,.tx pre{background:#0d0820;border-radius:6px;padding:1px 5px;font-family:ui-monospace,Menlo,monospace;font-size:13px}.tx pre{padding:6px 8px;overflow-x:auto;white-space:pre-wrap}
.tx a{color:#b89bff}.sp{background:#463a73;color:transparent;border-radius:4px;cursor:pointer}.sp.on{color:inherit;background:#2b2150}
.kb{display:flex;flex-direction:column;gap:5px}.kb .r{display:flex;gap:5px}
.kb button{flex:1;min-width:0;border:1px solid #5a3bb8;background:#241a4d;color:var(--tx);border-radius:10px;padding:9px 6px;font:700 13px system-ui;cursor:pointer;overflow:hidden;text-overflow:ellipsis}
.kb button:active{background:#3a2380}.kb button[disabled]{opacity:.5}
#rk{display:flex;flex-direction:column;gap:5px;padding:6px 10px 0;background:var(--panel);border-top:1px solid var(--line)}#rk:empty{display:none;border:0;padding:0}
#rk .r{display:flex;gap:5px}#rk button{flex:1;min-width:0;border:1px solid var(--line);background:var(--p2);color:var(--tx);border-radius:10px;padding:9px 4px;font:700 13px system-ui;overflow:hidden;text-overflow:ellipsis}
#f{display:flex;gap:8px;padding:8px 12px calc(env(safe-area-inset-bottom,0px) + 8px);background:var(--panel)}
#t{flex:1;min-width:0;border:1px solid var(--line);background:#0d0820;color:var(--tx);border-radius:12px;padding:11px 12px;font:15px system-ui;outline:0}
#s{border:0;border-radius:12px;padding:0 16px;font:800 15px system-ui;color:#fff;background:linear-gradient(#c66bff,#7a4bff)}
#toast{position:fixed;left:50%;top:64px;transform:translateX(-50%);background:#1c1536;border:1px solid #7a4bff;border-radius:12px;padding:9px 14px;max-width:88%;text-align:center;z-index:5;display:none;white-space:pre-wrap}
.mut{color:var(--mut);text-align:center;margin:auto;padding:20px}
</style></head><body><div id="w">
<div id="hd"><a href="/app">← Меню</a><b>🤖 Бот Lootify</b><button id="aa" type="button">⚔ Авто: выкл</button></div>
<div id="ls"><div class="mut" id="ld">Загрузка…</div></div>
<div id="rk"></div>
<form id="f"><input id="t" placeholder="Команда или текст…" autocomplete="off"><button id="s" type="submit">➤</button></form>
<div id="toast"></div>
</div>
<script>
(function(){
var $=function(s){return document.querySelector(s)};
var tok=null;try{tok=localStorage.getItem('lootify_token')}catch(e){}
var ls=$('#ls'),msgs={};
if(!tok){ls.innerHTML='<div class="mut">Сначала войди в приложение через меню</div>';$('#f').style.display='none';return}
var OK={B:'strong',STRONG:'strong',I:'em',EM:'em',U:'u',S:'s',STRIKE:'s',DEL:'s',CODE:'code',PRE:'pre',BLOCKQUOTE:'blockquote'};
function render(host,text,isHtml){
  host.textContent='';
  if(!isHtml){host.textContent=text;return}
  var doc=new DOMParser().parseFromString('<body>'+text+'</body>','text/html');
  (function walk(src,dst){
    src.childNodes.forEach(function(n){
      if(n.nodeType===3){dst.appendChild(document.createTextNode(n.nodeValue));return}
      if(n.nodeType!==1)return;
      var tag=n.tagName,el;
      if(OK[tag]){el=document.createElement(OK[tag])}
      else if(tag==='A'){var h=n.getAttribute('href')||'';el=document.createElement('a');if(/^(https?:\/\/|tg:\/\/)/i.test(h)){el.href=h;el.target='_blank';el.rel='noopener'}}
      else if(tag==='TG-SPOILER'||(tag==='SPAN'&&n.className==='tg-spoiler')){el=document.createElement('span');el.className='sp';el.onclick=function(){el.classList.toggle('on')}}
      else if(tag==='BR'){dst.appendChild(document.createElement('br'));return}
      else el=dst;
      if(el!==dst)dst.appendChild(el);
      walk(n,el);
    });
  })(doc.body,host);
}
function toast(t){var e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(function(){e.style.display='none'},3200)}
async function api(u,body){
  var r=await fetch(u,{method:body?'POST':'GET',headers:{'X-Token':tok,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  if(r.status===401)throw new Error('Сессия устарела. Войди заново через меню');
  var j=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(j.error||('Ошибка '+r.status));return j}
function press(b,id,d){
  b.disabled=true;
  api('/app/api/bot/cb',{id:id,d:d}).then(function(j){apply(j.ops||[])}).catch(function(e){toast(e.message)}).then(function(){b.disabled=false});
}
function buildKb(host,id,rows){
  host.textContent='';
  (rows||[]).forEach(function(row){
    var r=document.createElement('div');r.className='r';
    row.forEach(function(b){
      var x=document.createElement('button');x.textContent=b.t;
      x.onclick=function(){
        if(b.d!=null)press(x,id,b.d);
        else if(b.u)window.open(b.u,'_blank');
        else if(b.w){try{var u=new URL(b.w,location.href);if(u.host===location.host)location.href=u.pathname+u.search+'#tgWebAppData='+encodeURIComponent(tok)+'&tgWebAppVersion=7.0';else window.open(b.w,'_blank')}catch(e){}}
      };
      r.appendChild(x);
    });
    host.appendChild(r);
  });
}
function near(){return ls.scrollHeight-ls.scrollTop-ls.clientHeight<120}
function apply(ops){
  var stick=near();
  ops.forEach(function(o){
    if(o.t==='send'){
      var ld=$('#ld');if(ld)ld.remove();
      var m=document.createElement('div');m.className='m';
      var tx=document.createElement('div');tx.className='tx';render(tx,o.text,o.html);
      var kb=document.createElement('div');kb.className='kb';buildKb(kb,o.id,o.kb);
      m.appendChild(tx);m.appendChild(kb);ls.appendChild(m);msgs[o.id]={tx:tx,kb:kb,rows:o.kb||[]};
      if(o.rk==='remove')setRk(null);else if(o.rk)setRk(o.rk);
    }else if(o.t==='edit'){
      var g=msgs[o.id];if(!g)return;
      if(o.text!=null)render(g.tx,o.text,o.html);
      buildKb(g.kb,o.id,o.kb);g.rows=o.kb||[];
    }else if(o.t==='del'){
      var d=msgs[o.id];if(d){d.tx.parentNode.remove();delete msgs[o.id]}
    }else if(o.t==='toast'){toast(o.text)}
  });
  while(ls.children.length>150)ls.removeChild(ls.firstChild);
  if(stick)ls.scrollTop=ls.scrollHeight;
}
function setRk(rows){
  var h=$('#rk');h.textContent='';
  (rows||[]).forEach(function(row){var r=document.createElement('div');r.className='r';
    row.forEach(function(t){var b=document.createElement('button');b.textContent=t;b.onclick=function(){send(t)};r.appendChild(b)});h.appendChild(r)});
}
async function send(text){
  var ld=$('#ld');if(ld)ld.remove();
  var m=document.createElement('div');m.className='m me';var tx=document.createElement('div');tx.className='tx';tx.textContent=text;m.appendChild(tx);ls.appendChild(m);ls.scrollTop=ls.scrollHeight;
  try{var j=await api('/app/api/bot/text',{text:text});apply(j.ops||[])}catch(e){toast(e.message)}
}
$('#f').onsubmit=function(ev){ev.preventDefault();var t=$('#t'),v=t.value.trim();if(!v)return;t.value='';send(v)};
(async function poll(){
  try{if(!document.hidden){var j=await api('/app/api/bot/poll');apply(j.ops||[])}}catch(e){}
  setTimeout(poll,3000);
})();
var auto=false,busy=false;
function findAttack(){
  var ids=Object.keys(msgs).map(Number).sort(function(a,b){return b-a});
  for(var i=0;i<ids.length;i++){
    var rows=msgs[ids[i]].rows||[];
    for(var r=0;r<rows.length;r++)for(var c=0;c<rows[r].length;c++){
      var d=rows[r][c].d;if(d&&/^battle_attack(\|\d+)?$/.test(d))return {id:ids[i],d:d};
    }
  }
  return null;
}
$('#aa').onclick=function(){auto=!auto;$('#aa').className=auto?'on':'';$('#aa').textContent=auto?'⚔ Авто: вкл':'⚔ Авто: выкл';if(auto)toast('Авто-атака включена: продолжает уже начатый бой')};
(async function loop(){
  if(auto&&!busy&&!document.hidden){
    var a=findAttack();
    if(a){busy=true;
      try{var j=await api('/app/api/bot/cb',{id:a.id,d:a.d});apply(j.ops||[])}catch(e){toast(e.message);auto=false;$('#aa').className='';$('#aa').textContent='⚔ Авто: выкл'}
      busy=false}
  }
  setTimeout(loop,1300);
})();
send('/menu');
})();
</script></body></html>
"""

BATTLE_HTML = r"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#07050f"><title>Бой Lootify</title>
<style>
:root{--bg:#07050f;--panel:#120d22;--p2:#1c1536;--line:#2b2150;--tx:#ece8ff;--mut:#8f86b8;--acc:#ff5d73;--gold:#ffc857}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#w{max-width:560px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 10px)}
.hd{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 10px;background:var(--panel);border-bottom:1px solid var(--line)}
.hd b{flex:1;font-size:16px}.hd a,.hd button{color:var(--tx);background:var(--p2);border:1px solid var(--line);border-radius:10px;padding:6px 11px;font:700 13px system-ui;text-decoration:none;cursor:pointer}
.hd button.on{background:linear-gradient(#c66bff,#7a4bff);color:#fff}
.hidden{display:none!important}.mut{color:var(--mut);font-size:13px}.err{color:var(--acc);text-align:center;padding:16px}
/* выбор босса */
#pick{padding:12px}.loc{background:linear-gradient(#150f2b,#0d0820);border:1px solid var(--line);border-radius:16px;margin-bottom:10px;overflow:hidden}
.loc>.lh{display:flex;align-items:center;gap:10px;padding:12px 14px;font-weight:800;cursor:pointer}.loc>.lh span{flex:1}.loc.lock{opacity:.55}
.bl{display:none;padding:0 10px 10px}.loc.open .bl{display:block}
.bc{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid var(--line);background:var(--p2);border-radius:12px;margin-top:8px}
.bc .e{font-size:30px;width:40px;text-align:center}.bc .i{flex:1;min-width:0}.bc .i b{font-size:14px}
.go{border:0;border-radius:10px;padding:9px 13px;font:800 13px system-ui;color:#fff;background:linear-gradient(#ff7a6b,#ff3d6e);cursor:pointer}.go[disabled]{opacity:.45;background:#3a3358}
/* арена */
#arena{flex:1;display:flex;flex-direction:column;gap:12px;padding:12px;background:radial-gradient(ellipse at 50% 0%,#2a1560 0%,transparent 60%)}
.wave{display:flex;justify-content:center;gap:8px;align-items:center}.wave i{width:30px;height:6px;border-radius:4px;background:#2b2150}.wave i.on{background:var(--gold)}.wave i.cur{background:#ff5d73;box-shadow:0 0 8px #ff5d73}
#foes{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;min-height:170px;align-items:flex-end}
.foe{position:relative;flex:1 1 90px;max-width:200px;text-align:center;padding:10px 6px;background:#150f2bcc;border:1px solid var(--line);border-radius:16px;cursor:pointer;transition:transform .15s}
.foe.big{flex:1 1 100%;max-width:100%;padding:18px 10px}.foe .em{font-size:56px;line-height:1;filter:drop-shadow(0 6px 10px #000a)}.foe.big .em{font-size:96px}
.foe .nm{font-weight:800;font-size:13px;margin-top:4px}.foe.dead{opacity:.35;filter:grayscale(1);cursor:default}.foe.tgt{border-color:#ff5d73;box-shadow:0 0 14px #ff5d7388}
.bar{height:12px;border-radius:7px;background:#0d0820;border:1px solid var(--line);overflow:hidden;margin-top:6px;position:relative}
.bar i{display:block;height:100%;transition:width .5s ease;background:linear-gradient(90deg,#ff3d6e,#ff9d5c)}
.bar.pl i{background:linear-gradient(90deg,#3ddc84,#9be15d)}.bar.mp i{background:linear-gradient(90deg,#4b7bff,#7ad0ff)}.bar.st i{background:linear-gradient(90deg,#ffb03d,#ffe27a)}
.bt{font-size:11px;color:var(--mut);margin-top:2px}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px) rotate(-3deg)}40%{transform:translateX(8px) rotate(3deg)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
.hit{animation:shake .38s}.flash{animation:flash .5s}
@keyframes flash{0%{box-shadow:0 0 0 0 #ff5d73}30%{box-shadow:inset 0 0 60px #ff5d73aa}100%{box-shadow:none}}
.fl{position:absolute;left:50%;top:20%;transform:translateX(-50%);font-weight:900;font-size:22px;pointer-events:none;animation:up 1s ease-out forwards;text-shadow:0 2px 6px #000}
.fl.d{color:#ff8a8a}.fl.h{color:#7dffa0}.fl.p{color:#ffd166}
@keyframes up{from{opacity:1;transform:translate(-50%,0) scale(.8)}20%{transform:translate(-50%,-14px) scale(1.25)}to{opacity:0;transform:translate(-50%,-70px) scale(1)}}
#me{background:#150f2bcc;border:1px solid var(--line);border-radius:16px;padding:10px 12px;position:relative}
#acts{padding:0 12px;display:flex;flex-direction:column;gap:7px}.acts .r{display:flex;gap:7px}
#acts .r{display:flex;gap:7px}#acts button{flex:1;min-width:0;border:1px solid #5a3bb8;background:#241a4d;color:var(--tx);border-radius:12px;padding:13px 6px;font:800 14px system-ui;cursor:pointer;overflow:hidden;text-overflow:ellipsis}
#acts button.main{background:linear-gradient(#ff7a6b,#ff3d6e);border:0;color:#fff;font-size:16px}#acts button:active{transform:scale(.97)}#acts button[disabled]{opacity:.5}
#logb{margin:10px 12px 0;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:8px 11px;font-size:13px;white-space:pre-wrap;max-height:150px;overflow:auto}
#logb blockquote{margin:3px 0;padding:2px 8px;border-left:3px solid #7a4bff}#logb s{opacity:.6}
#end{position:fixed;inset:0;background:#07050ff0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}
#end .t{max-width:480px;max-height:55vh;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px;white-space:pre-wrap;text-align:left;font-size:14px}
#end blockquote{margin:3px 0;padding:2px 8px;border-left:3px solid #7a4bff}
#end button{border:0;border-radius:12px;padding:13px 26px;font:800 15px system-ui;color:#fff;background:linear-gradient(#c66bff,#7a4bff)}
#toast{position:fixed;left:50%;top:70px;transform:translateX(-50%);background:#1c1536;border:1px solid #7a4bff;border-radius:12px;padding:9px 14px;max-width:88%;text-align:center;z-index:30;display:none;white-space:pre-wrap}
</style></head><body><div id="w">
<div class="hd"><a href="/app">← Меню</a><b id="ttl">⚔ Бой с боссом</b><button id="aa" type="button">Авто: выкл</button></div>
<div id="pick"><div class="mut" style="text-align:center;padding:20px">Загрузка…</div></div>
<div id="arena" class="hidden">
  <div class="wave" id="wave"></div>
  <div id="foes"></div>
  <div id="me"><div style="display:flex;justify-content:space-between;font-weight:800"><span>🧍 Ты</span><span id="php"></span></div>
    <div class="bar pl"><i id="pbar" style="width:100%"></i></div>
    <div id="res"></div></div>
</div>
<div id="acts" class="hidden"></div>
<div id="logb" class="hidden"></div>
<div id="end" class="hidden"><div style="font-size:54px" id="etitle">🏁</div><div class="t" id="etext"></div><button id="eok">К боссам</button></div>
<div id="toast"></div>
</div>
<script>
(function(){
var $=function(s){return document.querySelector(s)};
var tok=null;try{tok=localStorage.getItem('lootify_token')}catch(e){}
var MID=2000000000,prev=null,rows=null,lastText='',auto=false,busy=false,inBattle=false,ended=false;
if(!tok){$('#pick').innerHTML='<div class="err">Сначала войди в приложение через меню</div>';return}
var OK={B:'strong',STRONG:'strong',I:'em',EM:'em',U:'u',S:'s',STRIKE:'s',DEL:'s',CODE:'code',BLOCKQUOTE:'blockquote'};
function render(host,text,isHtml){
  host.textContent='';if(!isHtml){host.textContent=text;return}
  var doc=new DOMParser().parseFromString('<body>'+text+'</body>','text/html');
  (function walk(src,dst){src.childNodes.forEach(function(n){
    if(n.nodeType===3){dst.appendChild(document.createTextNode(n.nodeValue));return}
    if(n.nodeType!==1)return;var tag=n.tagName,el;
    if(OK[tag])el=document.createElement(OK[tag]);else if(tag==='BR'){dst.appendChild(document.createElement('br'));return}else el=dst;
    if(el!==dst)dst.appendChild(el);walk(n,el)})})(doc.body,host);
}
function T(x){var d=document.createElement('div');d.textContent=x==null?'':x;return d.innerHTML}
function toast(t){var e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(function(){e.style.display='none'},3000)}
async function api(u,body){
  var r=await fetch(u,{method:body?'POST':'GET',headers:{'X-Token':tok,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  if(r.status===401)throw new Error('Сессия устарела. Войди заново через меню');
  var j=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(j.error||('Ошибка '+r.status));return j}
function cd(s){s=Math.max(0,s|0);var h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?h+' ч '+m+' мин':m+':'+('0'+x).slice(-2)}
/* список боссов */
var openSet={0:true};
async function loadBosses(){
  var el=$('#pick');
  try{var d=await api('/app/api/battle/bosses');
    el.innerHTML=d.locs.map(function(l,i){
      return '<div class="loc'+(l.locked?' lock':'')+(openSet[i]?' open':'')+'"><div class="lh"><span>'+T(l.emoji)+' '+T(l.name)+'</span><span class="mut" style="flex:none">'+(l.locked?'🔒 '+T(l.need):'')+'</span></div><div class="bl">'
       +l.bosses.map(function(b){return '<div class="bc" data-end="'+(Date.now()+b.cd*1000)+'" data-lock="'+(l.locked?1:0)+'"><div class="e">'+T(b.emoji)+'</div><div class="i"><b>'+T(b.name)+'</b><div class="mut">ур. '+b.level+' · 🔥 '+T(b.power)+' · ❤️ '+T(b.hp)+'<span class="cdt"></span></div></div><button class="go" data-b="'+T(b.id)+'"'+(l.locked||b.cd>0?' disabled':'')+'>В бой</button></div>'}).join('')+'</div></div>'}).join('');
    el.querySelectorAll('.lh').forEach(function(h,i){h.onclick=function(){h.parentNode.classList.toggle('open');openSet[i]=h.parentNode.classList.contains('open')}});
    el.querySelectorAll('.go').forEach(function(b){b.onclick=function(){start(b)}});
    tickCd();
    if(d.active)enter();
  }catch(e){if(!el.querySelector('.loc'))el.innerHTML='<div class="err">'+T(e.message)+'</div>'}
}
function tickCd(){
  document.querySelectorAll('.bc').forEach(function(c){
    var left=Math.ceil((+c.dataset.end-Date.now())/1000),t=c.querySelector('.cdt'),b=c.querySelector('.go');
    t.textContent=left>0?' · ⏳ '+cd(left):'';
    b.disabled=left>0||c.dataset.lock==='1';
  });
}
setInterval(tickCd,1000);
setInterval(function(){if(!inBattle&&!document.hidden&&!$('#pick').classList.contains('hidden'))loadBosses()},15000);
async function start(b){
  b.disabled=true;
  try{var j=await api('/app/api/battle/start',{boss:b.dataset.b});takeOps(j.ops||[]);await refresh(true)}catch(e){toast(e.message);b.disabled=false}
}
/* бой */
function takeOps(ops){
  ops.forEach(function(o){
    if(o.id!==MID)return;
    if(o.t==='send'||o.t==='edit'){
      if(o.text!=null){lastText=o.text;var lb=$('#logb');render(lb,o.text,o.html);lb.classList.toggle('hidden',!inBattle);lb.scrollTop=lb.scrollHeight}
      if(o.kb)rows=o.kb;if(o.t==='edit'&&o.kb&&!o.kb.length&&!o.text)rows=[];
    }
    if(o.t==='toast')toast(o.text);
  });
  if(ops.some(function(o){return o.t==='toast'}))return;
  drawActs();
}
function drawActs(){
  var a=$('#acts');a.textContent='';
  var rr=rows&&rows.length?rows:null;
  if(!rr&&prev&&prev.active)rr=[[{t:'⚔ Атаковать',d:'battle_attack'}],[{t:'Навыки',d:'battle_skills'},{t:'Рюкзак',d:'battle_backpack'}],[{t:'Сбежать',d:'battle_flee'}]];
  (rr||[]).forEach(function(row){var r=document.createElement('div');r.className='r';
    row.forEach(function(b){if(b.d==null)return;var x=document.createElement('button');x.textContent=b.t;if(/^battle_attack$/.test(b.d))x.className='main';
      x.onclick=function(){act(b.d,x)};r.appendChild(x)});if(r.children.length)a.appendChild(r)});
}
async function act(d,btn){
  if(busy)return;busy=true;if(btn)btn.disabled=true;
  try{var j=await api('/app/api/battle/act',{d:d});takeOps(j.ops||[]);await refresh(false);setTimeout(function(){refresh(false)},900);setTimeout(function(){refresh(false)},2200)}
  catch(e){toast(e.message)}
  busy=false;drawActs();
}
function floatTxt(host,txt,cls){var f=document.createElement('div');f.className='fl '+cls;f.textContent=txt;host.appendChild(f);setTimeout(function(){f.remove()},1000)}
function paint(st){
  inBattle=true;$('#pick').classList.add('hidden');$('#arena').classList.remove('hidden');$('#acts').classList.remove('hidden');$('#logb').classList.remove('hidden');
  $('#ttl').textContent=(st.boss_emoji||'')+' '+st.boss+(st.hard?' · хард':'');
  var w='';for(var i=1;i<=4;i++)w+='<i class="'+(i<st.wave?'on':i===st.wave?'cur':'')+'"></i>';$('#wave').innerHTML=w+'<span class="mut" style="margin-left:6px">волна '+st.wave+'/4</span>';
  var multi=st.enemies.filter(function(e){return e.hp>0}).length>1;
  var foes=$('#foes');
  if(foes.children.length!==st.enemies.length||(prev&&prev.wave!==st.wave)){
    foes.innerHTML='';st.enemies.forEach(function(e,i){
      var d=document.createElement('div');d.className='foe'+(st.enemies.length===1?' big':'');
      d.innerHTML='<div class="em">'+T(e.emoji)+'</div><div class="nm">'+T(e.name)+'</div><div class="bar"><i style="width:100%"></i></div><div class="bt"></div>';
      d.onclick=function(){if(multi&&st.enemies[i].hp>0)act('battle_attack|'+i)};foes.appendChild(d)});
  }
  st.enemies.forEach(function(e,i){
    var d=foes.children[i];if(!d)return;
    var was=prev&&prev.enemies&&prev.enemies[i]&&prev.wave===st.wave?prev.enemies[i].hp:null;
    d.classList.toggle('dead',e.hp<=0);d.style.cursor=multi&&e.hp>0?'pointer':'default';
    d.querySelector('.bar i').style.width=(100*e.hp/e.max)+'%';d.querySelector('.bt').textContent=e.hp+' / '+e.max;
    if(was!=null&&e.hp<was){d.classList.remove('hit');void d.offsetWidth;d.classList.add('hit');floatTxt(d,'-'+(was-e.hp),'p')}
  });
  $('#php').textContent=st.hp+' / '+st.max_hp;$('#pbar').style.width=(100*st.hp/st.max_hp)+'%';
  var r='';if(st.max_mana)r+='<div class="bt">🔮 мана '+st.mana+' / '+st.max_mana+'</div><div class="bar mp"><i style="width:'+(100*st.mana/st.max_mana)+'%"></i></div>';
  if(st.max_stamina)r+='<div class="bt">⚡ выносливость '+st.stamina+' / '+st.max_stamina+'</div><div class="bar st"><i style="width:'+(100*st.stamina/st.max_stamina)+'%"></i></div>';
  $('#res').innerHTML=r;
  if(prev&&prev.active&&prev.hp!=null&&st.hp!==prev.hp){var me=$('#me');if(st.hp<prev.hp){me.classList.remove('flash');void me.offsetWidth;me.classList.add('flash');floatTxt(me,'-'+(prev.hp-st.hp),'d')}else floatTxt(me,'+'+(st.hp-prev.hp),'h')}
}
function showEnd(){
  if(ended)return;ended=true;
  var t=$('#etext');render(t,lastText||'Бой завершён','html');$('#end').classList.remove('hidden');
  $('#etitle').textContent=/побед|убит|награ/i.test(lastText)?'🏆':'🏁';
}
async function refresh(first){
  try{var j=await api('/app/api/battle/state');takeOps(j.ops||[]);var st=j.state;
    if(st.active){ended=false;paint(st);prev=st;if(first&&!rows)drawActs()}
    else if(inBattle){inBattle=false;prev=null;$('#arena').classList.add('hidden');$('#acts').classList.add('hidden');$('#logb').classList.add('hidden');showEnd()}
  }catch(e){toast(e.message)}
}
function enter(){ended=false;refresh(true)}
$('#eok').onclick=function(){$('#end').classList.add('hidden');ended=false;rows=null;lastText='';$('#pick').classList.remove('hidden');$('#ttl').textContent='⚔ Бой с боссом';loadBosses()};
$('#aa').onclick=function(){auto=!auto;$('#aa').className=auto?'on':'';$('#aa').textContent=auto?'Авто: вкл':'Авто: выкл'};
(async function loop(){
  if(!document.hidden){
    if(auto&&inBattle&&!busy&&prev&&prev.active){
      var alive=prev.enemies.map(function(e,i){return e.hp>0?i:-1}).filter(function(i){return i>=0});
      var plain=(rows||[]).some(function(r){return r.some(function(b){return b.d==='battle_attack'})});
      var tgt=(rows||[]).some(function(r){return r.some(function(b){return /^battle_attack\|/.test(b.d||'')})});
      if(plain||!rows||!rows.length)await act('battle_attack');
      else if(tgt&&alive.length)await act('battle_attack|'+alive[0]);
    }else if(inBattle&&!busy){await refresh(false)}
  }
  setTimeout(loop,1300);
})();
loadBosses();
})();
</script></body></html>
"""

SHARED_HTML = r"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#07050f"><title>Общие боссы Lootify</title>
<style>
:root{--bg:#07050f;--panel:#120d22;--p2:#1c1536;--line:#2b2150;--tx:#ece8ff;--mut:#8f86b8;--acc:#ff5d73;--gold:#ffc857}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#w{max-width:560px;margin:0 auto;min-height:100dvh;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 14px)}
.hd{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 10px;background:var(--panel);border-bottom:1px solid var(--line)}
.hd b{flex:1;font-size:16px}.hd a,.hd button{color:var(--tx);background:var(--p2);border:1px solid var(--line);border-radius:10px;padding:6px 11px;font:700 13px system-ui;text-decoration:none;cursor:pointer}.hd button.on{background:linear-gradient(#c66bff,#7a4bff);color:#fff}
.tabs{display:flex;gap:6px;padding:10px 12px 0}.tabs button{flex:1;border:1px solid var(--line);background:var(--p2);color:var(--mut);border-radius:12px;padding:9px 4px;font:800 12.5px system-ui}.tabs button.on{color:#fff;background:linear-gradient(#c66bff,#7a4bff);border-color:#7a4bff}
.mut{color:var(--mut);font-size:13px}.err{color:var(--acc);text-align:center;padding:16px}.hidden{display:none!important}
#arena{margin:12px;padding:16px 12px;border:1px solid var(--line);border-radius:18px;background:radial-gradient(ellipse at 50% 0%,#3a1a7a 0%,#150f2b 60%);text-align:center;position:relative;overflow:hidden}
#bem{font-size:104px;line-height:1.05;filter:drop-shadow(0 8px 14px #000a);cursor:pointer;user-select:none;display:inline-block}
#bnm{font-weight:900;font-size:19px;margin-top:4px}
.bar{height:16px;border-radius:9px;background:#0d0820;border:1px solid var(--line);overflow:hidden;margin-top:10px;position:relative}
.bar i{display:block;height:100%;transition:width .6s ease;background:linear-gradient(90deg,#ff3d6e,#ff9d5c)}.bar.pl i{background:linear-gradient(90deg,#3ddc84,#9be15d)}
.bar span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 11px system-ui;text-shadow:0 1px 3px #000}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-9px) rotate(-4deg)}40%{transform:translateX(9px) rotate(4deg)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
.hit{animation:shake .4s}
.fl{position:absolute;left:50%;top:34%;font-weight:900;font-size:24px;pointer-events:none;animation:up 1.1s ease-out forwards;text-shadow:0 2px 6px #000;color:#ffd166}
@keyframes up{from{opacity:1;transform:translate(-50%,0) scale(.8)}20%{transform:translate(-50%,-16px) scale(1.3)}to{opacity:0;transform:translate(-50%,-80px) scale(1)}}
#atk{display:block;width:calc(100% - 24px);margin:0 12px;border:0;border-radius:16px;padding:18px;font:900 19px system-ui;color:#fff;background:linear-gradient(#ff7a6b,#ff3d6e);box-shadow:0 4px 0 #8f1f3f;cursor:pointer}
#atk:active{transform:translateY(3px);box-shadow:0 1px 0 #8f1f3f}#atk[disabled]{opacity:.5;background:#3a3358;box-shadow:none}
.row2{display:flex;gap:8px;margin:10px 12px 0}.row2 button{flex:1;border:1px solid #5a3bb8;background:#241a4d;color:var(--tx);border-radius:12px;padding:11px 6px;font:800 13px system-ui;cursor:pointer;min-width:0;overflow:hidden;text-overflow:ellipsis}.row2 button[disabled]{opacity:.5}
.card{background:linear-gradient(#150f2b,#0d0820);border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin:12px}
.st{display:flex;justify-content:space-between;gap:8px;font-size:14px;margin-top:4px}.st b{font-weight:900}
.rk{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #1d1638;font-size:14px}.rk:last-child{border:0}.rk.me{background:#3a238044;border-radius:8px;padding:6px 6px}.rk .p{width:24px;text-align:center;color:var(--gold);font-weight:900}.rk .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
#modal{position:fixed;inset:0;background:#07050ff2;z-index:20;display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top,0px) + 14px) 14px 14px}
#modal .t{flex:1;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px;white-space:pre-wrap;font-size:14px}
#modal blockquote{margin:4px 0;padding:3px 9px;border-left:3px solid #7a4bff}#modal .k{display:flex;flex-direction:column;gap:6px;margin-top:10px}#modal .k .r{display:flex;gap:6px}
#modal .k button{flex:1;border:1px solid #5a3bb8;background:#241a4d;color:var(--tx);border-radius:12px;padding:12px 6px;font:800 14px system-ui}
#toast{position:fixed;left:50%;top:70px;transform:translateX(-50%);background:#1c1536;border:1px solid #7a4bff;border-radius:12px;padding:9px 14px;max-width:88%;text-align:center;z-index:30;display:none;white-space:pre-wrap}
</style></head><body><div id="w">
<div class="hd"><a href="/app">← Меню</a><b id="ttl">Общие боссы</b><button id="aa" type="button">Авто: выкл</button></div>
<div class="tabs"><button data-k="wb" class="on">🌑 Мировой</button><button data-k="cb">🐉 Лутиафан</button><button data-k="kr">⚔️ Кратос</button></div>
<div id="off" class="card hidden"></div>
<div id="arena" class="hidden"><div id="bem"></div><div id="bnm"></div>
  <div class="bar"><i id="hpb" style="width:100%"></i><span id="hpt"></span></div><div class="mut" id="tmr" style="margin-top:6px"></div></div>
<button id="atk" class="hidden">⚔ АТАКОВАТЬ</button>
<div class="row2 hidden" id="sks"></div>
<div class="row2 hidden" id="sub"><button data-d="top">🏆 Рейтинг</button><button data-d="ref">🔄 Обновить</button><button data-d="shop" id="shopb" class="hidden">🛠 Кузница</button></div>
<div class="card hidden" id="meb"></div>
<div class="card hidden" id="topb"></div>
<div id="modal" class="hidden"><div class="t" id="mt"></div><div class="k" id="mk"></div></div>
<div id="toast"></div>
</div>
<script>
(function(){
var $=function(s){return document.querySelector(s)};
var tok=null;try{tok=localStorage.getItem('lootify_token')}catch(e){}
var K=(location.hash||'').slice(1);if(['wb','cb','kr'].indexOf(K)<0)K='wb';
var P={wb:'wb|',cb:'cboss|',kr:'kr|'},prev=null,busy=false,auto=false,tleft=0,tkind='';
if(!tok){$('#off').classList.remove('hidden');$('#off').innerHTML='<div class="err">Сначала войди в приложение через меню</div>';return}
var OK={B:'strong',STRONG:'strong',I:'em',EM:'em',U:'u',S:'s',STRIKE:'s',DEL:'s',CODE:'code',BLOCKQUOTE:'blockquote'};
function render(host,text){host.textContent='';var doc=new DOMParser().parseFromString('<body>'+text+'</body>','text/html');
  (function walk(src,dst){src.childNodes.forEach(function(n){if(n.nodeType===3){dst.appendChild(document.createTextNode(n.nodeValue));return}
    if(n.nodeType!==1)return;var tag=n.tagName,el;if(OK[tag])el=document.createElement(OK[tag]);else if(tag==='BR'){dst.appendChild(document.createElement('br'));return}else el=dst;
    if(el!==dst)dst.appendChild(el);walk(n,el)})})(doc.body,host)}
function T(x){var d=document.createElement('div');d.textContent=x==null?'':x;return d.innerHTML}
function N(n){n=+n||0;var a=Math.abs(n);if(a>=1e9)return (n/1e9).toFixed(2)+'B';if(a>=1e6)return (n/1e6).toFixed(2)+'M';if(a>=1e4)return (n/1e3).toFixed(1)+'K';return String(n)}
function tm(s){s=Math.max(0,s|0);var h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?h+' ч '+m+' мин':m?m+' мин '+x+' с':x+' с'}
function toast(t){var e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(function(){e.style.display='none'},3000)}
async function api(u,body){var r=await fetch(u,{method:body?'POST':'GET',headers:{'X-Token':tok,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  if(r.status===401)throw new Error('Сессия устарела. Войди заново через меню');var j=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(j.error||('Ошибка '+r.status));return j}
function sub(d){return d==='atk'||d==='ref'||/^sk\|/.test(d)}
function modal(text,kb){render($('#mt'),text||'');var k=$('#mk');k.textContent='';
  (kb||[]).forEach(function(row){var r=document.createElement('div');r.className='r';row.forEach(function(b){if(b.d==null)return;var x=document.createElement('button');x.textContent=b.t;
    x.onclick=function(){var d=b.d.indexOf('|')>=0?b.d.slice(b.d.indexOf('|')+1):b.d;if(d==='ref'||d==='clan'&&false){$('#modal').classList.add('hidden');act('ref')}else{full(b.d)}};r.appendChild(x)});if(r.children.length)k.appendChild(r)});
  var c=document.createElement('button');c.textContent='Закрыть';c.onclick=function(){$('#modal').classList.add('hidden')};var r2=document.createElement('div');r2.className='r';r2.appendChild(c);k.appendChild(r2);
  $('#modal').classList.remove('hidden')}
async function full(d){try{var j=await api('/app/api/shared/act',{k:K,d:d});takeOps(j.ops||[],true);refresh()}catch(e){toast(e.message)}}
function takeOps(ops,show){var last=null;ops.forEach(function(o){if(o.t==='toast')toast(o.text);if((o.t==='send'||o.t==='edit')&&o.text!=null)last=o});if(last&&show)modal(last.text,last.kb)}
async function act(d){
  if(busy)return;busy=true;
  try{var j=await api('/app/api/shared/act',{k:K,d:P[K]+d});var sh=!sub(d);takeOps(j.ops||[],sh);await refresh()}catch(e){toast(e.message)}
  busy=false;
}
function fl(host,t){var f=document.createElement('div');f.className='fl';f.textContent=t;host.appendChild(f);setTimeout(function(){f.remove()},1100)}
function paint(s){
  var off=$('#off');['arena','atk','sks','sub','meb','topb'].forEach(function(i){$('#'+i).classList.toggle('hidden',!s.active)});
  $('#shopb').classList.toggle('hidden',K!=='kr');
  $('#ttl').textContent=s.emoji+' '+s.name;
  if(!s.active){$('#sub').classList.remove('hidden');
    off.classList.remove('hidden');
    off.innerHTML=s.noclan?'<b>Ты не в клане</b><div class="mut" style="margin-top:6px">Вступи в клан в боте, и здесь появится Лутиафан.</div>'
      :'<div style="font-size:60px;text-align:center">'+T(s.emoji)+'</div><b>'+T(s.name)+'</b><div class="mut" style="margin-top:6px">'+(s.defeated?'Босс повержен. ':'Сейчас босса нет. ')+'Следующий через <b>'+tm(s.next_in)+'</b>'+(s.min_level?' · доступен с '+s.min_level+' ур.':'')+'</div>';
    prev=null;tkind='';return}
  off.classList.add('hidden');
  $('#bem').textContent=s.emoji;$('#bnm').textContent=s.name+(s.tier?' · тир '+s.tier:'');
  $('#hpb').style.width=(100*s.hp/s.max_hp)+'%';$('#hpt').textContent=N(s.hp)+' / '+N(s.max_hp)+' ('+(100*s.hp/s.max_hp).toFixed(1)+'%)';
  tleft=s.left;tkind=K;$('#tmr').textContent=(s.left!=null?'Уйдёт через '+tm(s.left)+' · ':'')+'участников: '+s.n;
  if(prev&&prev.k===K&&s.hp<prev.hp){var e=$('#bem');e.classList.remove('hit');void e.offsetWidth;e.classList.add('hit');fl($('#arena'),'-'+N(prev.hp-s.hp))}
  prev={k:K,hp:s.hp};
  var me=s.me||{},ko=me.ko>0;
  $('#atk').disabled=ko;$('#atk').textContent=ko?'💀 Нокаут · '+tm(me.ko):'⚔ АТАКОВАТЬ';
  var sk=$('#sks');sk.textContent='';sk.classList.toggle('hidden',!(s.skills&&s.skills.length));
  (s.skills||[]).forEach(function(x){var b=document.createElement('button');b.textContent=x.name+(x.cd?' · '+x.cd:'');b.disabled=x.cd>0||ko;b.title=x.desc;b.onclick=function(){act('sk|'+x.id)};sk.appendChild(b)});
  $('#meb').innerHTML='<b>Ты</b><div class="bar pl"><i style="width:'+(me.max_hp?100*me.hp/me.max_hp:100)+'%"></i><span>'+N(me.hp)+' / '+N(me.max_hp)+'</span></div>'
    +'<div class="st"><span>Твой урон</span><b>'+N(me.damage)+' ('+(me.share||0)+'%)</b></div><div class="st"><span>Ударов</span><b>'+(me.hits||0)+'</b></div>'+(me.place?'<div class="st"><span>Место</span><b>'+me.place+'</b></div>':'');
  $('#topb').innerHTML='<b>🏆 Топ урона</b><div style="margin-top:6px">'+((s.top||[]).length?s.top.map(function(r,i){return '<div class="rk'+(r.me?' me':'')+'"><div class="p">'+(i+1)+'</div><div class="n">'+T(r.name)+'</div><b>'+N(r.dmg)+'</b></div>'}).join(''):'<div class="mut">Пока никто не атаковал</div>')+'</div>';
}
async function refresh(){
  try{var j=await api('/app/api/shared/state?k='+K);takeOps(j.ops||[],false);paint(j.state)}catch(e){toast(e.message)}
}
document.querySelectorAll('.tabs button').forEach(function(b){b.onclick=function(){K=b.dataset.k;location.hash=K;document.querySelectorAll('.tabs button').forEach(function(x){x.className=x===b?'on':''});prev=null;refresh()}});
document.querySelectorAll('.tabs button').forEach(function(b){b.className=b.dataset.k===K?'on':''});
$('#atk').onclick=function(){act('atk')};
document.querySelectorAll('#sub button').forEach(function(b){b.onclick=function(){act(b.dataset.d)}});
$('#aa').onclick=function(){auto=!auto;$('#aa').className=auto?'on':'';$('#aa').textContent=auto?'Авто: вкл':'Авто: выкл'};
setInterval(function(){if(tkind&&tleft!=null&&tleft>0){tleft--;var t=$('#tmr');if(t&&t.textContent.indexOf('Уйдёт')===0)t.textContent=t.textContent.replace(/Уйдёт через [^·]*/,'Уйдёт через '+tm(tleft)+' ')}},1000);
(async function loop(){
  if(!document.hidden){
    if(auto&&prev&&!busy&&!$('#atk').disabled&&!$('#atk').classList.contains('hidden'))await act('atk');
    else if(!busy)await refresh();
  }
  setTimeout(loop,auto?1200:3000);
})();
refresh();
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

BATTLE_MID = 2000000000   # постоянный «номер сообщения» окна боя в приложении
VERSION_URL = "https://raw.githubusercontent.com/den1511bol/Lootify-App/main/version.json"

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
   <div class="err" id="err"></div>
   <div class="mut" style="font-size:11.5px">Developer: @yfeeeee</div>
  </div>
 </div>
 <div id="menu" class="hidden">
  <div class="top"><div class="who"><img src="data:image/webp;base64,__ICON__" alt=""><div><b id="nm"></b><div class="mut">Общий прогресс с ботом</div></div></div><button class="btn gray" id="out" style="width:auto;padding:8px 14px">Выйти</button></div>
  <button class="btn" id="btl" style="margin-top:14px;background:linear-gradient(#ff7a6b,#ff3d6e);box-shadow:0 3px 0 #8f1f3f">⚔ Бой с боссом</button>
  <button class="btn gray" id="shr" style="margin-top:10px">🌑 Мировой босс, Лутиафан, Кратос</button>
  <button class="btn" id="botb" style="margin-top:10px">🤖 Весь бот</button>
  <button class="btn" id="chat" style="margin-top:10px">💬 Общий чат <span id="bd" style="display:none;background:#ff5d73;border-radius:9px;padding:1px 7px;margin-left:6px;font-size:12px"></span></button>
  <div style="display:flex;gap:10px;margin-top:10px"><button class="btn gray" id="me1">👤 Профиль</button><button class="btn gray" id="me3">🎒 Вещи</button><button class="btn gray" id="me2">🏆 Рейтинг</button></div>
  <div id="upd" class="hidden" style="margin-top:12px;background:#1c1536;border:1px solid #5a3bb8;border-radius:14px;padding:12px">
   <b>Вышла новая версия приложения</b><div class="mut" id="updt" style="margin:4px 0 10px"></div>
   <button class="btn" id="updb">Скачать обновление</button></div>
  <div class="grid" id="grid" style="margin-top:12px"></div>
  <div class="mut" style="text-align:center;margin-top:16px;font-size:11.5px">Developer: @yfeeeee</div>
 </div>
</div>
<script>
(function(){
var BOT=__BOT__, GAMES=__GAMES__, VERSION_URL='__VERSION_URL__';
var $=function(s){return document.querySelector(s)};
var store={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}},del:function(k){try{localStorage.removeItem(k)}catch(e){}}};
function nameOf(t){try{var p=t.slice(4).split('.')[0].replace(/-/g,'+').replace(/_/g,'/');while(p.length%4)p+='=';return JSON.parse(decodeURIComponent(escape(atob(p)))).n}catch(e){return 'Игрок'}}
function menu(tok){
  $('#login').classList.add('hidden');$('#menu').classList.remove('hidden');$('#nm').textContent=nameOf(tok);
  $('#grid').innerHTML=GAMES.map(function(g){return '<button class="tile" data-p="'+g[1]+'"><span class="ic">'+g[4]+'</span><b>'+g[2]+'</b><span class="mut">'+g[3]+'</span></button>'}).join('');
}
function login(msg){
  $('#menu').classList.add('hidden');$('#login').classList.remove('hidden');$('#err').textContent=msg||'';
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
$('#chat').onclick=function(){location.href='/app/chat'};$('#botb').onclick=function(){location.href='/app/bot'};$('#btl').onclick=function(){location.href='/app/battle'};$('#shr').onclick=function(){location.href='/app/shared'};
$('#me1').onclick=function(){location.href='/app/me'};$('#me2').onclick=function(){location.href='/app/me#top'};$('#me3').onclick=function(){location.href='/app/me#inv'};
async function badge(){
  var tk=store.get('lootify_token');if(!tk||$('#menu').classList.contains('hidden'))return;
  try{var seen=+store.get('lootify_chat_seen')||0;
    var r=await fetch('/app/api/chat?after='+seen,{headers:{'X-Token':tk},cache:'no-store'});if(!r.ok)return;
    var j=await r.json(),n=(j.msgs||[]).length,b=$('#bd');if(seen===0&&n>=100)n=0;
    if(n>0){b.textContent=n>99?'99+':n;b.style.display=''}else b.style.display='none'}catch(e){}
}
setInterval(badge,5000);setTimeout(badge,600);
async function checkUpdate(){
  try{
    var C=window.Capacitor;if(!C||!C.Plugins||!C.Plugins.App)return;
    var cur=Number((await C.Plugins.App.getInfo()).build)||0;
    var r=await fetch(VERSION_URL+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;
    var v=await r.json();if(!(v.versionCode>cur))return;
    $('#updt').textContent='Версия '+(v.versionName||v.versionCode)+'. Скачай и установи поверх старой, прогресс сохранится.';
    $('#upd').classList.remove('hidden');
    $('#updb').onclick=function(){try{C.Plugins.Browser?C.Plugins.Browser.open({url:v.url}):window.open(v.url,'_blank')}catch(e){location.href=v.url}};
  }catch(e){}
}
setTimeout(checkUpdate,800);
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


def install(app, bot_token: str, bot_username_cb, has_user_cb, icon_b64: str = "", send_cb=None, load_cb=None, save_cb=None, profile_cb=None, top_cb=None, inv_cb=None, toggle_cb=None, bridge=None, boss_list_cb=None, battle_state_cb=None, shared_cb=None):
    icon_b64 = icon_b64 or ICON_B64
    """Регистрирует /app (оболочка), /app/api/start, /app/api/poll, /app/tg (виджет Telegram).
    bot_username_cb: async () -> имя бота; has_user_cb: async (uid) -> зарегистрирован ли игрок."""
    from aiohttp import web
    import asyncio

    async def _persist():
        if load_cb is not None:
            try:
                chat_restore(await load_cb())
            except Exception as e:
                print(f"[app] чат: не удалось загрузить историю: {e!r}")
        while save_cb is not None:
            await asyncio.sleep(5)
            if _chat_dirty[0]:
                _chat_dirty[0] = False
                try:
                    await save_cb({"msgs": list(_chat)})
                except Exception as e:
                    _chat_dirty[0] = True
                    print(f"[app] чат: не удалось сохранить историю: {e!r}")

    if load_cb is not None or save_cb is not None:
        asyncio.get_event_loop().create_task(_persist())

    def ip_of(request):
        return (request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or request.remote or "?")

    async def page(request):
        uname = ""
        try:
            uname = await bot_username_cb()
        except Exception:
            pass
        html = (APP_HTML.replace("__ICON__", icon_b64).replace("__BOT__", json.dumps(uname))
                .replace("__GAMES__", json.dumps(GAMES, ensure_ascii=False)).replace("__VERSION_URL__", VERSION_URL))
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

    async def me_page(request):
        return web.Response(text=ME_HTML, content_type="text/html", charset="utf-8", headers={"Cache-Control": "no-store"})

    async def me_profile(request):
        u = who(request)
        if not u:
            return web.json_response({"error": "auth"}, status=401)
        if profile_cb is None:
            return web.json_response({"error": "off"}, status=404)
        d = await profile_cb(u["id"])
        if not d:
            return web.json_response({"error": "Ты не зарегистрирован в боте"}, status=404)
        return web.json_response(d)

    async def me_top(request):
        u = who(request)
        if not u:
            return web.json_response({"error": "auth"}, status=401)
        if top_cb is None:
            return web.json_response({"error": "off"}, status=404)
        if _limited(str(u["id"]), "top", 60, 60):
            return web.json_response({"error": "Не так быстро"}, status=429)
        return web.json_response(await top_cb(u["id"], request.query.get("c", "level"), request.query.get("p", "all")))

    async def me_inv(request):
        u = who(request)
        if not u:
            return web.json_response({"error": "auth"}, status=401)
        if inv_cb is None:
            return web.json_response({"error": "off"}, status=404)
        d = await inv_cb(u["id"])
        if not d:
            return web.json_response({"error": "Ты не зарегистрирован в боте"}, status=404)
        return web.json_response(d)

    async def me_toggle(request):
        u = who(request)
        if not u:
            return web.json_response({"error": "Войди заново через меню"}, status=401)
        if toggle_cb is None:
            return web.json_response({"error": "off"}, status=404)
        if _limited(str(u["id"]), "tg", 40, 30):
            return web.json_response({"error": "Не так быстро"}, status=429)
        try:
            iid = int((await request.json()).get("iid"))
        except Exception:
            return web.json_response({"error": "Неверный предмет"}, status=400)
        r = await toggle_cb(u["id"], iid)
        return web.json_response(r, status=400 if r.get("error") else 200)

    async def bot_page(request):
        return web.Response(text=BOT_HTML, content_type="text/html", charset="utf-8", headers={"Cache-Control": "no-store"})

    async def bot_guard(request, key, n, window):
        u = who(request)
        if not u:
            return None, web.json_response({"error": "Войди заново через меню"}, status=401)
        if bridge is None:
            return None, web.json_response({"error": "off"}, status=404)
        if _limited(str(u["id"]), key, n, window):
            return None, web.json_response({"error": "Не так быстро"}, status=429)
        if not await has_user_cb(u["id"]):
            return None, web.json_response({"error": "Ты не зарегистрирован в боте"}, status=403)
        return u, None

    async def bot_text(request):
        u, err = await bot_guard(request, "bt", 25, 10)
        if err:
            return err
        try:
            text = str((await request.json()).get("text", ""))[:1000].strip()
        except Exception:
            text = ""
        if not text:
            return web.json_response({"error": "Пусто"}, status=400)
        return web.json_response({"ops": await bridge.send_text(u["id"], u["first_name"], text)})

    async def bot_cb(request):
        u, err = await bot_guard(request, "bc", 40, 10)
        if err:
            return err
        try:
            j = await request.json()
            mid, data = int(j.get("id")), str(j.get("d", ""))[:64]
        except Exception:
            return web.json_response({"error": "Неверные данные"}, status=400)
        return web.json_response({"ops": await bridge.press(u["id"], u["first_name"], mid, data)})

    async def bot_poll(request):
        u, err = await bot_guard(request, "bp", 60, 60)
        if err:
            return err
        return web.json_response({"ops": bridge.drain(u["id"])})

    async def battle_page(request):
        return web.Response(text=BATTLE_HTML, content_type="text/html", charset="utf-8", headers={"Cache-Control": "no-store"})

    async def battle_bosses(request):
        u, err = await bot_guard(request, "bb", 30, 30)
        if err:
            return err
        if boss_list_cb is None:
            return web.json_response({"error": "off"}, status=404)
        return web.json_response(await boss_list_cb(u["id"]) or {"locs": []})

    async def battle_state(request):
        u, err = await bot_guard(request, "bs", 90, 60)
        if err:
            return err
        st = battle_state_cb(u["id"]) if battle_state_cb is not None else {"active": False}
        return web.json_response({"state": st, "ops": bridge.drain(u["id"])})

    async def battle_start(request):
        u, err = await bot_guard(request, "bst", 10, 30)
        if err:
            return err
        try:
            boss = str((await request.json()).get("boss", ""))[:48]
        except Exception:
            boss = ""
        if not boss:
            return web.json_response({"error": "Босс не выбран"}, status=400)
        return web.json_response({"ops": await bridge.press(u["id"], u["first_name"], BATTLE_MID, "boss_start|" + boss)})

    async def battle_act(request):
        u, err = await bot_guard(request, "ba", 40, 10)
        if err:
            return err
        try:
            d = str((await request.json()).get("d", ""))[:64]
        except Exception:
            d = ""
        if not d.startswith("battle_"):
            return web.json_response({"error": "Недопустимое действие"}, status=400)
        return web.json_response({"ops": await bridge.press(u["id"], u["first_name"], BATTLE_MID, d)})

    SHARED_MID = {"wb": 2000000011, "cb": 2000000012, "kr": 2000000013}
    SHARED_PREFIX = {"wb": "wb|", "cb": "cboss|", "kr": "kr|"}

    async def shared_page(request):
        return web.Response(text=SHARED_HTML, content_type="text/html", charset="utf-8", headers={"Cache-Control": "no-store"})

    async def shared_state(request):
        u, err = await bot_guard(request, "ss", 90, 60)
        if err:
            return err
        k = request.query.get("k", "wb")
        if k not in SHARED_MID or shared_cb is None:
            return web.json_response({"error": "Неверный босс"}, status=400)
        return web.json_response({"state": shared_cb(u["id"], k), "ops": bridge.drain(u["id"])})

    async def shared_act(request):
        u, err = await bot_guard(request, "sa", 40, 10)
        if err:
            return err
        try:
            j = await request.json()
            k, d = str(j.get("k", "")), str(j.get("d", ""))[:64]
        except Exception:
            k, d = "", ""
        if k not in SHARED_MID or not (d.startswith(SHARED_PREFIX[k]) or d.startswith("aatk|")):
            return web.json_response({"error": "Недопустимое действие"}, status=400)
        return web.json_response({"ops": await bridge.press(u["id"], u["first_name"], SHARED_MID[k], d)})

    app.router.add_get("/app/shared", shared_page)
    app.router.add_get("/app/api/shared/state", shared_state)
    app.router.add_post("/app/api/shared/act", shared_act)
    app.router.add_get("/app/battle", battle_page)
    app.router.add_get("/app/api/battle/bosses", battle_bosses)
    app.router.add_get("/app/api/battle/state", battle_state)
    app.router.add_post("/app/api/battle/start", battle_start)
    app.router.add_post("/app/api/battle/act", battle_act)
    app.router.add_get("/app/bot", bot_page)
    app.router.add_post("/app/api/bot/text", bot_text)
    app.router.add_post("/app/api/bot/cb", bot_cb)
    app.router.add_get("/app/api/bot/poll", bot_poll)
    app.router.add_post("/app/api/inventory/toggle", me_toggle)
    app.router.add_get("/app/api/inventory", me_inv)
    app.router.add_get("/app/me", me_page)
    app.router.add_get("/app/api/profile", me_profile)
    app.router.add_get("/app/api/top", me_top)
    app.router.add_get("/app/chat", chat_page)
    app.router.add_get("/app/api/chat", chat_get)
    app.router.add_post("/app/api/chat", chat_post)
    app.router.add_get("/app", page)
    app.router.add_post("/app/api/start", start)
    app.router.add_get("/app/api/poll", poll_h)
