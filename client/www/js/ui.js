// Ashen Crown — UI-помощники. Developer: @yfeeeee
import { RARITIES, SLOT_INFO, STAT_NAMES, PCT_STATS, PERKS } from '../shared/data.js';
import { itemBonuses, enhFactor } from '../shared/items.js';

/** Создание DOM: h('div', {class:'x', on:{click:fn}}, 'text', child) */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') {
        if (typeof v === 'string') el.style.cssText = v;
        else for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
      }
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k in el && k !== 'list') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);

export function fmt(n) {
  n = Math.round(n);
  const a = Math.abs(n);
  if (a >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`;
  return String(n);
}

export const pct = (v, d = 1) => `${(v * 100).toFixed(d).replace(/\.0+$/, '')}%`;
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function statText(stat, v) {
  if (PCT_STATS.has(stat)) {
    const p = stat === 'critDmg' || stat === 'lifesteal' ? v * 100 : v * 100;
    return `+${p.toFixed(p < 10 ? 1 : 0).replace(/\.0$/, '')}%`;
  }
  return `+${Math.round(v)}`;
}

// ---------------------------------------------------------------- тосты и модалки
let toastBox;
export function toast(msg, kind = '') {
  if (!toastBox) { toastBox = h('div', { class: 'toasts' }); document.body.appendChild(toastBox); }
  const t = h('div', { class: `toast ${kind}` }, msg);
  toastBox.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2400);
}

export function modal({ title, body, buttons = [], onClose, wide = false }) {
  const back = h('div', { class: 'modal-back' });
  const close = () => { back.remove(); if (onClose) onClose(); };
  const box = h('div', { class: `modal ${wide ? 'wide' : ''}` },
    title ? h('div', { class: 'modal-title' }, title) : null,
    h('div', { class: 'modal-body' }, body),
    buttons.length ? h('div', { class: 'modal-btns' }, buttons.map((b) => h('button', {
      class: `btn ${b.cls || ''}`,
      on: { click: async () => { if (b.onClick) { const r = await b.onClick(close); if (r === false) return; } if (!b.keep) close(); } },
    }, b.text))) : null);
  back.appendChild(box);
  back.addEventListener('click', (e) => { if (e.target === back && !buttons.some((b) => b.noDismiss)) close(); });
  document.body.appendChild(back);
  return close;
}

export function confirmDialog(text, okText = 'Да', cancelText = 'Отмена') {
  return new Promise((resolve) => {
    modal({
      title: 'Подтверждение', body: h('p', null, text),
      buttons: [{ text: cancelText, onClick: () => resolve(false) }, { text: okText, cls: 'primary', onClick: () => resolve(true) }],
      onClose: () => resolve(false),
    });
  });
}

// ---------------------------------------------------------------- компоненты
export function bar(value, max, cls = '', label = '') {
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return h('div', { class: `bar ${cls}` }, h('div', { class: 'fill', style: { width: `${p * 100}%` } }), label ? h('span', { class: 'bar-label' }, label) : null);
}

export function chips(got) {
  const parts = [];
  if (got.gold) parts.push(`🪙 ${fmt(got.gold)}`);
  if (got.xp) parts.push(`✨ ${fmt(got.xp)} XP`);
  if (got.gems) parts.push(`💎 ${got.gems}`);
  if (got.dust) parts.push(`🔹 ${got.dust}`);
  if (got.potions) parts.push(`🧪 ${got.potions}`);
  if (got.chestKeys) parts.push(`🗝️ ${got.chestKeys}`);
  return h('div', { class: 'chips' }, parts.map((p) => h('span', { class: 'chip' }, p)));
}

export function itemStatsLines(item) {
  const f = enhFactor(item.enh);
  const lines = [];
  for (const [s, v] of Object.entries(item.main)) lines.push({ t: `${STAT_NAMES[s]} ${statText(s, v * f)}`, main: true });
  for (const a of item.aff) lines.push({ t: `${STAT_NAMES[a.s]} ${statText(a.s, a.v)}` });
  return lines;
}

/** Карточка предмета. opts: {onClick, equipped, delta (разница силы), compact} */
export function itemCard(item, opts = {}) {
  if (!item) {
    return h('div', { class: 'item empty', on: opts.onClick ? { click: opts.onClick } : {} }, h('div', { class: 'item-ico' }, opts.slotIcon || '➕'), h('div', { class: 'item-name' }, opts.slotName || 'Пусто'));
  }
  const r = RARITIES[item.r];
  const lines = itemStatsLines(item);
  const delta = opts.delta;
  return h('div', { class: `item r${item.r} ${opts.compact ? 'compact' : ''}`, style: { '--rc': r.color }, on: opts.onClick ? { click: opts.onClick } : {} },
    h('div', { class: 'item-ico' }, SLOT_INFO[item.slot].icon),
    h('div', { class: 'item-main' },
      h('div', { class: 'item-name', style: { color: r.color } }, `${item.name}${item.enh ? ` +${item.enh}` : ''}`),
      h('div', { class: 'item-sub' }, `${r.name} · ур. ${item.ilvl}${item.lock ? ' · 🔒' : ''}`),
      opts.compact ? null : h('div', { class: 'item-stats' }, lines.map((l) => h('div', { class: l.main ? 'main' : '' }, l.t))),
      item.perk && !opts.compact ? h('div', { class: 'item-perk' }, `✦ ${PERKS[item.perk].name}: ${PERKS[item.perk].desc}`) : null),
    delta != null ? h('div', { class: `item-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}` }, delta > 0 ? `▲${fmt(delta)}` : delta < 0 ? `▼${fmt(-delta)}` : '＝') : null);
}

export function section(title, ...content) {
  return h('div', { class: 'section' }, title ? h('div', { class: 'section-title' }, title) : null, ...content);
}

export function tabs(items, active, onSelect) {
  return h('div', { class: 'tabs' }, items.map(([id, label]) => h('button', {
    class: `tab ${id === active ? 'active' : ''}`, on: { click: () => onSelect(id) },
  }, label)));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export { itemBonuses };
