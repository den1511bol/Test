// Ashen Crown — экран «Поход»: кампания, башня, отдых. Developer: @yfeeeee
import { CHAPTERS, CHAPTER_COUNT, STAGES_PER_CHAPTER, TOTAL_STAGES, TOWER_THEME } from '../shared/data.js';
import { heroUnit, stageInfo, buildStageWaves, buildTowerWaves, stageRewards, towerRewards, towerLevel, heroStats } from '../shared/progression.js';
import * as eco from '../shared/economy.js';
import { h, fmt, modal, chips, toast, section, tabs } from './ui.js';
import { S, persist } from './state.js';
import { go, refresh } from './router.js';
import { runBattle, makeBattle } from './battle.js';
import { rng, notifyLevel, rewardBody } from './common.js';
import { sfx } from './audio.js';

// ---------------------------------------------------------------- бой
async function fight({ title, theme, waves, onWin, rewardsOf, again, next }) {
  const save = S.save;
  const seed = (Math.random() * 2 ** 31) >>> 0;
  const battle = makeBattle([heroUnit(save)], waves, seed, save.potions);
  const lvlBefore = save.level;
  const res = await runBattle({ title, theme, battle });
  save.potions = Math.max(0, save.potions - battle.potionsUsed);
  eco.recordKills(save, res.kills, res.skills, res.crits);

  let body; let titleText; const buttons = [];
  if (res.win) {
    const r = onWin();
    titleText = '🏆 Победа!';
    body = rewardBody(r);
    sfx('coin');
    buttons.push({ text: 'Закрыть', onClick: () => { res.close(); refresh(); notifyLevel(lvlBefore); } });
    if (again) buttons.push({ text: '🔁 Ещё раз', onClick: () => { res.close(); refresh(); again(); } });
    if (next) buttons.push({ text: 'Дальше ▶', cls: 'primary', onClick: () => { res.close(); refresh(); next(); } });
  } else {
    if (!res.fled) eco.recordLoss(save);
    titleText = res.fled ? '🏃 Бегство' : '💀 Поражение';
    body = h('div', null, h('p', null, res.fled ? 'Вы покинули бой.' : 'Герой пал. Улучшите снаряжение, потратьте очки талантов или попробуйте другой навык.'));
    buttons.push({ text: 'Закрыть', onClick: () => { res.close(); refresh(); } });
    if (again) buttons.push({ text: '🔁 Снова', cls: 'primary', onClick: () => { res.close(); refresh(); again(); } });
  }
  persist();
  modal({ title: titleText, body, buttons });
}

export function fightStage(idx) {
  const info = stageInfo(idx);
  const r = rng();
  fight({
    title: `${info.data.name} · ${info.stage}${info.boss ? ' · БОСС' : ''}`,
    theme: { bg: info.data.bg },
    waves: buildStageWaves(idx, r),
    onWin: () => eco.winStage(S.save, idx, r),
    again: () => fightStage(idx),
    next: idx < TOTAL_STAGES && idx + 1 <= S.save.stage + 1 ? () => fightStage(idx + 1) : null,
  });
}

export function fightTower(floor) {
  const r = rng();
  fight({
    title: `Башня · этаж ${floor}${floor % 5 === 0 ? ' · БОСС' : ''}`,
    theme: { bg: TOWER_THEME.bg },
    waves: buildTowerWaves(floor, r),
    onWin: () => eco.winTower(S.save, floor, r),
    again: () => fightTower(S.save.tower + 1 === floor ? floor : S.save.tower + 1),
    next: () => fightTower(S.save.tower + 1),
  });
}

// ---------------------------------------------------------------- отдых
function idlePanel() {
  const p = eco.idlePreview(S.save);
  const hh = Math.floor(p.minutes / 60); const mm = Math.floor(p.minutes % 60);
  return section('💤 Отдых героя',
    h('div', { class: 'row between' },
      h('div', null,
        h('div', null, `Накоплено за ${hh} ч ${mm} мин${p.capped ? ' (максимум)' : ''}`),
        chips({ gold: p.gold, xp: p.xp, dust: p.dust }),
        h('div', { class: 'muted small' }, `В минуту: 🪙${p.rates.goldPerMin} ✨${p.rates.xpPerMin}`)),
      h('button', { class: 'btn gold', disabled: p.minutes < 1, on: { click: () => {
        const before = S.save.level;
        const r = eco.claimIdle(S.save);
        if (!r.ok) return toast(r.error, 'bad');
        sfx('coin'); persist();
        toast(`+${fmt(r.gold)} 🪙  +${fmt(r.xp)} XP`, 'good');
        refresh(); notifyLevel(before);
      } } }, 'Забрать')));
}

// ---------------------------------------------------------------- кампания
function stageRow(idx) {
  const info = stageInfo(idx);
  const cleared = idx <= S.save.stage;
  const open = idx <= S.save.stage + 1;
  const rw = stageRewards(idx, info.boss);
  return h('div', {
    class: `stage ${cleared ? 'cleared' : ''} ${open ? '' : 'locked'} ${info.boss ? 'boss' : ''}`,
    on: { click: () => (open ? stageModal(idx) : toast('Сначала пройдите предыдущий этап', 'bad')) },
  },
  h('div', { class: 'stage-num' }, info.boss ? '👑' : info.stage),
  h('div', { class: 'stage-main' },
    h('div', { class: 'stage-name' }, `${info.data.name} ${info.stage}${info.boss ? ' — босс ' + info.data.boss.e : ''}`),
    h('div', { class: 'muted small' }, `Ур. врагов ${info.level} · 🪙${fmt(rw.gold)} ✨${fmt(rw.xp)}`)),
  h('div', { class: 'stage-state' }, cleared ? '✔' : open ? '▶' : '🔒'));
}

function stageModal(idx) {
  const info = stageInfo(idx);
  const rw = stageRewards(idx, info.boss);
  const first = idx > S.save.stage;
  const mons = info.boss ? [info.data.boss.e, ...info.data.monsters.slice(0, 2).map((m) => m.e)] : info.data.monsters.map((m) => m.e);
  modal({
    title: `${info.data.icon} ${info.data.name} — этап ${info.stage}`,
    body: h('div', null,
      h('div', { class: 'big-emoji' }, mons.join(' ')),
      h('p', { class: 'muted' }, `Уровень врагов: ${info.level}. ${info.boss ? 'Босс гарантированно роняет снаряжение!' : 'Три волны врагов.'}`),
      chips({ gold: rw.gold, xp: rw.xp, gems: first ? (info.boss ? 25 : 5) : 0 }),
      first ? h('div', { class: 'good small' }, '⭐ Награда за первое прохождение') : null),
    buttons: [{ text: 'Назад' }, { text: '⚔️ В бой', cls: 'primary', onClick: () => { fightStage(idx); } }],
  });
}

function campaignView(params) {
  const nextIdx = Math.min(TOTAL_STAGES, S.save.stage + 1);
  const chapter = params.chapter || stageInfo(nextIdx).chapter;
  const data = CHAPTERS[chapter - 1];
  const start = (chapter - 1) * STAGES_PER_CHAPTER + 1;
  const cleared = Math.max(0, Math.min(STAGES_PER_CHAPTER, S.save.stage - start + 1));
  const rows = [];
  for (let i = 0; i < STAGES_PER_CHAPTER; i++) rows.push(stageRow(start + i));
  const nav = (d) => () => go('campaign', { ...params, chapter: Math.max(1, Math.min(CHAPTER_COUNT, chapter + d)) });
  return h('div', null,
    h('button', { class: 'btn primary wide', disabled: S.save.stage >= TOTAL_STAGES, on: { click: () => fightStage(nextIdx) } },
      S.save.stage >= TOTAL_STAGES ? 'Кампания пройдена! 🎉' : `⚔️ Продолжить: этап ${nextIdx} (${stageInfo(nextIdx).data.name})`),
    section(null,
      h('div', { class: 'row between chapter-head', style: { background: `linear-gradient(135deg, ${data.bg[0]}, ${data.bg[1]})` } },
        h('button', { class: 'btn small', disabled: chapter <= 1, on: { click: nav(-1) } }, '◀'),
        h('div', { class: 'center' }, h('div', { class: 'chapter-name' }, `${data.icon} Глава ${chapter}: ${data.name}`), h('div', { class: 'muted small' }, `Пройдено ${cleared}/${STAGES_PER_CHAPTER}`)),
        h('button', { class: 'btn small', disabled: chapter >= CHAPTER_COUNT, on: { click: nav(1) } }, '▶')),
      h('div', { class: 'stages' }, rows)));
}

// ---------------------------------------------------------------- башня
function towerView() {
  const floor = S.save.tower + 1;
  const rw = towerRewards(floor);
  const lvl = towerLevel(floor);
  return h('div', null,
    section(`${TOWER_THEME.icon} ${TOWER_THEME.name}`,
      h('p', { class: 'muted' }, 'Бесконечная башня: каждый этаж сильнее предыдущего. Каждый 5-й этаж — босс с лучшей добычей.'),
      h('div', { class: 'stat-grid' },
        h('div', null, h('div', { class: 'muted small' }, 'Рекорд'), h('b', null, S.save.tower)),
        h('div', null, h('div', { class: 'muted small' }, 'Следующий этаж'), h('b', null, floor)),
        h('div', null, h('div', { class: 'muted small' }, 'Уровень врагов'), h('b', null, lvl))),
      chips({ gold: rw.gold, xp: rw.xp, gems: rw.gems, dust: rw.dust }),
      h('button', { class: 'btn primary wide', on: { click: () => fightTower(floor) } }, `⚔️ Этаж ${floor}${floor % 5 === 0 ? ' (БОСС)' : ''}`)));
}

// ---------------------------------------------------------------- экран
export function renderCampaign(params = {}) {
  const mode = params.mode || 'campaign';
  const st = heroStats(S.save);
  return h('div', null,
    tabs([['campaign', '🗺️ Кампания'], ['tower', '🗼 Башня']], mode, (m) => go('campaign', { mode: m })),
    idlePanel(),
    mode === 'tower' ? towerView() : campaignView(params),
    h('div', { class: 'muted small center' }, `Сила героя: ${fmt(st.power)}`));
}

