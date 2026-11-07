// Минимальный DOM для проверки клиентского кода без браузера. Developer: @yfeeeee
class ClassList {
  constructor(el) { this.el = el; }
  _set() { return new Set(this.el.className.split(/\s+/).filter(Boolean)); }
  add(...c) { const s = this._set(); c.forEach((x) => s.add(x)); this.el.className = [...s].join(' '); }
  remove(...c) { const s = this._set(); c.forEach((x) => s.delete(x)); this.el.className = [...s].join(' '); }
  toggle(c, force) { const s = this._set(); const on = force ?? !s.has(c); if (on) s.add(c); else s.delete(c); this.el.className = [...s].join(' '); return on; }
  contains(c) { return this._set().has(c); }
}

export class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this.className = '';
    this.style = { cssText: '', setProperty() {} }; this.listeners = {}; this.attrs = {}; this._text = '';
    this.classList = new ClassList(this); this.disabled = false; this.value = ''; this.scrollTop = 0;
    this.clientWidth = 360; this.clientHeight = 300; this.width = 0; this.height = 0;
  }
  appendChild(c) { if (c.parent) c.parent.children = c.parent.children.filter((x) => x !== c); c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(typeof c === 'string' ? new TextNode(c) : c)); }
  replaceChildren(...cs) { this.children.forEach((c) => { c.parent = null; }); this.children = []; this.append(...cs); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; }
  addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  removeEventListener() {}
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  set textContent(v) { this.children = []; this._text = String(v); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set innerHTML(v) { this._text = String(v); }
  getContext() {
    const noop = () => {};
    const grad = { addColorStop: noop };
    return new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' ? () => grad : k === 'measureText' ? () => ({ width: 10 }) : t[k] ?? noop), set: (t, k, v) => { t[k] = v; return true; } });
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 360, height: 300 }; }
  matches(sel) {
    return sel.split(',').some((s) => {
      s = s.trim();
      if (s === '*') return true;
      if (s.startsWith('#')) return this.attrs.id === s.slice(1) || this.id === s.slice(1);
      if (s.startsWith('.')) return this.className.split(/\s+/).includes(s.slice(1));
      return this.tagName === s.toUpperCase();
    });
  }
  querySelector(sel) {
    for (const c of this.children) {
      if (c instanceof TextNode) continue;
      if (c.matches(sel)) return c;
      const r = c.querySelector(sel); if (r) return r;
    }
    return null;
  }
  querySelectorAll(sel) {
    const out = [];
    for (const c of this.children) { if (c instanceof TextNode) continue; if (c.matches(sel)) out.push(c); out.push(...c.querySelectorAll(sel)); }
    return out;
  }
  click() { (this.listeners.click || []).forEach((fn) => fn({ target: this, clientX: 0, clientY: 0 })); }
  findByText(txt) { return this.querySelectorAll('*').find((e) => e.matches('button') && e.textContent.includes(txt)); }
}
class TextNode { constructor(t) { this.t = t; this.parent = null; } get textContent() { return this.t; } }

export function install() {
  const body = new El('body'); const app = new El('div'); app.attrs.id = 'app'; app.id = 'app'; body.appendChild(app);
  const store = new Map();
  const doc = {
    body, createElement: (t) => new El(t), createTextNode: (t) => new TextNode(t),
    querySelector: (s) => (s === '#app' ? app : body.querySelector(s)),
    querySelectorAll: (s) => body.querySelectorAll(s),
    getElementById: (id) => (id === 'app' ? app : null),
    addEventListener() {}, visibilityState: 'visible',
  };
  const g = globalThis;
  g.document = doc;
  g.window = g;
  g.addEventListener = () => {}; g.removeEventListener = () => {};
  g.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  Object.defineProperty(g, 'navigator', { value: { vibrate() {} }, configurable: true });
  g.requestAnimationFrame = () => 1; g.cancelAnimationFrame = () => {};
  g.devicePixelRatio = 1;
  g.GAME_CONFIG = { apiUrl: 'http://127.0.0.1:1' };
  return { app, body, store, doc };
}
