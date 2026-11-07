// Ashen Crown — игровые данные (классы, навыки, монстры, таланты, духи, квесты).
// Developer: @yfeeeee

export const GAME = {
  name: 'Ashen Crown',
  title: 'Пепельная Корона',
  developer: '@yfeeeee',
  version: '1.0.0',
  saveVersion: 1,
};

export const MAX_LEVEL = 60;
export const CHAPTER_COUNT = 8;
export const STAGES_PER_CHAPTER = 10;
export const TOTAL_STAGES = CHAPTER_COUNT * STAGES_PER_CHAPTER;
export const BAG_LIMIT = 60;

// ---------------------------------------------------------------- слоты и редкость
export const SLOTS = ['weapon', 'helm', 'armor', 'ring', 'amulet'];
export const SLOT_INFO = {
  weapon: { name: 'Оружие', icon: '🗡️', base: { atk: 3.2 } },
  helm: { name: 'Шлем', icon: '⛑️', base: { hp: 14, def: 0.9 } },
  armor: { name: 'Броня', icon: '🛡️', base: { def: 2.2, hp: 10 } },
  ring: { name: 'Кольцо', icon: '💍', base: { atk: 1.5, spd: 0.12 } },
  amulet: { name: 'Амулет', icon: '📿', base: { hp: 18, atk: 0.8 } },
};

export const RARITIES = [
  { id: 'common', name: 'Обычный', color: '#9aa4b2', mult: 1.0, affixes: 0, maxEnh: 5, dust: 1 },
  { id: 'uncommon', name: 'Необычный', color: '#4ade80', mult: 1.2, affixes: 1, maxEnh: 8, dust: 3 },
  { id: 'rare', name: 'Редкий', color: '#60a5fa', mult: 1.5, affixes: 2, maxEnh: 10, dust: 8 },
  { id: 'epic', name: 'Эпический', color: '#c084fc', mult: 1.9, affixes: 3, maxEnh: 12, dust: 20 },
  { id: 'legendary', name: 'Легендарный', color: '#fbbf24', mult: 2.5, affixes: 4, maxEnh: 14, dust: 50 },
  { id: 'mythic', name: 'Мифический', color: '#fb7185', mult: 3.3, affixes: 4, maxEnh: 15, dust: 120 },
];

export const STAT_NAMES = {
  hp: 'Здоровье', atk: 'Атака', def: 'Защита', spd: 'Скорость',
  hpPct: 'Здоровье %', atkPct: 'Атака %', defPct: 'Защита %', spdPct: 'Скорость %',
  crit: 'Шанс крита', critDmg: 'Крит. урон', dodge: 'Уклонение', lifesteal: 'Вампиризм',
  goldPct: 'Золото %', xpPct: 'Опыт %', dropPct: 'Шанс добычи %',
};
export const PCT_STATS = new Set([
  'hpPct', 'atkPct', 'defPct', 'spdPct', 'crit', 'critDmg', 'dodge', 'lifesteal', 'goldPct', 'xpPct', 'dropPct',
]);

/** Пул аффиксов: [stat, min, max] при ilvl = 1..60 масштабируется в items.js */
export const AFFIX_POOL = [
  ['atkPct', 0.03, 0.09],
  ['hpPct', 0.03, 0.09],
  ['defPct', 0.03, 0.09],
  ['spdPct', 0.02, 0.06],
  ['crit', 0.01, 0.04],
  ['critDmg', 0.05, 0.16],
  ['dodge', 0.01, 0.04],
  ['lifesteal', 0.004, 0.015],
];

export const PERKS = {
  phoenix: { name: 'Возрождение', desc: 'Раз за бой воскрешает с 30% здоровья.' },
  thorns: { name: 'Шипы', desc: 'Отражает 15% полученного урона.' },
  bloodlust: { name: 'Жажда крови', desc: '+6% атаки за каждое убийство в бою (до 5).' },
  frostaura: { name: 'Морозная аура', desc: 'Скорость врагов снижена на 10%.' },
  bulwark: { name: 'Оплот', desc: 'Бой начинается с щитом в 20% здоровья.' },
  fortune: { name: 'Фортуна', desc: '+15% золота и опыта.' },
};
export const PERK_IDS = Object.keys(PERKS);

// ---------------------------------------------------------------- статусы
export const STATUS = {
  stun: { name: 'Оглушение', icon: '💫', bad: true },
  burn: { name: 'Горение', icon: '🔥', bad: true },
  poison: { name: 'Яд', icon: '☠️', bad: true },
  bleed: { name: 'Кровотечение', icon: '🩸', bad: true },
  weaken: { name: 'Слабость', icon: '⬇️', bad: true },
  slow: { name: 'Замедление', icon: '🐌', bad: true },
  vuln: { name: 'Уязвимость', icon: '💔', bad: true },
  stunimm: { name: 'Стойкость', icon: '🔰', bad: false, hidden: true },
  enrage: { name: 'Ярость', icon: '😡', bad: false },
  haste: { name: 'Ускорение', icon: '⚡', bad: false },
  evasion: { name: 'Уклонение', icon: '💨', bad: false },
  regen: { name: 'Регенерация', icon: '💚', bad: false },
  armor: { name: 'Броня', icon: '🛡️', bad: false },
};

// ---------------------------------------------------------------- классы
export const CLASSES = {
  warrior: {
    id: 'warrior', name: 'Воин', icon: '⚔️', color: '#ef4444',
    desc: 'Крепкий боец ближнего боя: щиты, кровотечение и сокрушительные удары.',
    base: { hp: 120, atk: 14, def: 10, spd: 95, crit: 0.05, critDmg: 1.5, dodge: 0 },
    grow: { hp: 14, atk: 2.2, def: 1.8, spd: 0.1 },
  },
  mage: {
    id: 'mage', name: 'Маг', icon: '🔮', color: '#8b5cf6',
    desc: 'Хрупкий, но смертоносный: огонь, лёд и урон по площади.',
    base: { hp: 90, atk: 18, def: 6, spd: 100, crit: 0.06, critDmg: 1.5, dodge: 0 },
    grow: { hp: 10, atk: 2.9, def: 1.0, spd: 0.1 },
  },
  rogue: {
    id: 'rogue', name: 'Разбойник', icon: '🗡️', color: '#22c55e',
    desc: 'Быстрый убийца: криты, яды и уклонение.',
    base: { hp: 100, atk: 16, def: 7, spd: 115, crit: 0.12, critDmg: 1.6, dodge: 0.08 },
    grow: { hp: 11, atk: 2.5, def: 1.2, spd: 0.15 },
  },
};

// ---------------------------------------------------------------- навыки
// tgt: one | all | self | random. fx: накладываются на цели; selfFx — на себя.
export const SKILLS = {
  attack: { id: 'attack', name: 'Атака', icon: '👊', cd: 0, tgt: 'one', mult: 1.0, desc: 'Обычный удар.' },

  // Воин
  w_smash: { id: 'w_smash', cls: 'warrior', name: 'Мощный удар', icon: '🔨', unlock: 1, cd: 2, tgt: 'one', mult: 1.8, desc: 'Удар с уроном 180%.' },
  w_shield: { id: 'w_shield', cls: 'warrior', name: 'Стальной щит', icon: '🛡️', unlock: 4, cd: 4, tgt: 'self', shield: { pct: 0.25, dur: 3 }, selfFx: [{ st: 'armor', dur: 3 }], desc: 'Щит 25% здоровья и +40% защиты на 3 хода.' },
  w_whirl: { id: 'w_whirl', cls: 'warrior', name: 'Вихрь клинков', icon: '🌀', unlock: 10, cd: 4, tgt: 'all', mult: 1.2, fx: [{ st: 'bleed', chance: 0.4, dur: 3 }], desc: 'Урон 120% по всем, 40% кровотечение.' },
  w_rally: { id: 'w_rally', cls: 'warrior', name: 'Боевой клич', icon: '📣', unlock: 18, cd: 6, tgt: 'self', heal: 0.15, selfFx: [{ st: 'enrage', dur: 3 }], desc: 'Лечит 15% и даёт +30% атаки на 3 хода.' },
  w_exec: { id: 'w_exec', cls: 'warrior', name: 'Казнь', icon: '🪓', unlock: 28, cd: 5, tgt: 'one', mult: 2.6, bonusLow: { below: 0.4, mult: 1.5 }, desc: 'Урон 260%, +50% по целям ниже 40% здоровья.' },
  w_ult: { id: 'w_ult', cls: 'warrior', name: 'Гнев Титана', icon: '⚡', unlock: 40, cd: 8, tgt: 'all', mult: 2.4, fx: [{ st: 'stun', chance: 0.5, dur: 1 }], desc: 'Урон 240% по всем, 50% оглушить.' },

  // Маг
  m_fire: { id: 'm_fire', cls: 'mage', name: 'Огненный шар', icon: '🔥', unlock: 1, cd: 2, tgt: 'one', mult: 1.9, magic: true, fx: [{ st: 'burn', chance: 0.5, dur: 3 }], desc: 'Магический урон 190%, 50% поджечь.' },
  m_frost: { id: 'm_frost', cls: 'mage', name: 'Ледяная стрела', icon: '❄️', unlock: 4, cd: 3, tgt: 'one', mult: 1.6, magic: true, fx: [{ st: 'slow', chance: 0.7, dur: 2 }, { st: 'weaken', chance: 0.4, dur: 2 }], desc: 'Урон 160%, замедляет и ослабляет.' },
  m_chain: { id: 'm_chain', cls: 'mage', name: 'Цепная молния', icon: '⚡', unlock: 10, cd: 4, tgt: 'random', hits: 3, mult: 1.1, magic: true, desc: '3 удара по случайным врагам по 110%.' },
  m_barrier: { id: 'm_barrier', cls: 'mage', name: 'Мана-барьер', icon: '🔰', unlock: 18, cd: 6, tgt: 'self', shield: { pct: 0.35, dur: 4 }, selfFx: [{ st: 'regen', dur: 3 }], desc: 'Щит 35% здоровья и регенерация.' },
  m_meteor: { id: 'm_meteor', cls: 'mage', name: 'Метеор', icon: '☄️', unlock: 28, cd: 5, tgt: 'all', mult: 1.8, magic: true, fx: [{ st: 'burn', chance: 0.7, dur: 3 }], desc: 'Урон 180% по всем, 70% поджечь.' },
  m_ult: { id: 'm_ult', cls: 'mage', name: 'Конец света', icon: '🌋', unlock: 40, cd: 8, tgt: 'all', mult: 3.2, magic: true, pierce: 0.3, desc: 'Урон 320% по всем, игнорирует часть защиты.' },

  // Разбойник
  r_stab: { id: 'r_stab', cls: 'rogue', name: 'Удар в спину', icon: '🗡️', unlock: 1, cd: 2, tgt: 'one', mult: 1.7, critBonus: 0.3, desc: 'Урон 170%, +30% шанс крита.' },
  r_poison: { id: 'r_poison', cls: 'rogue', name: 'Ядовитый клинок', icon: '🧪', unlock: 4, cd: 3, tgt: 'one', mult: 1.2, fx: [{ st: 'poison', chance: 1, dur: 4 }], desc: 'Урон 120% и яд на 4 хода.' },
  r_flurry: { id: 'r_flurry', cls: 'rogue', name: 'Шквал', icon: '💨', unlock: 10, cd: 4, tgt: 'random', hits: 4, mult: 0.65, desc: '4 быстрых удара по 65%.' },
  r_smoke: { id: 'r_smoke', cls: 'rogue', name: 'Дымовая завеса', icon: '🌫️', unlock: 18, cd: 6, tgt: 'self', selfFx: [{ st: 'evasion', dur: 3 }, { st: 'haste', dur: 3 }], desc: '+40% уклонения и ускорение на 3 хода.' },
  r_kill: { id: 'r_kill', cls: 'rogue', name: 'Убийство', icon: '☠️', unlock: 28, cd: 5, tgt: 'one', mult: 2.4, forceCrit: true, desc: 'Урон 240%, всегда критует.' },
  r_ult: { id: 'r_ult', cls: 'rogue', name: 'Танец теней', icon: '🌑', unlock: 40, cd: 8, tgt: 'random', hits: 6, mult: 0.85, fx: [{ st: 'bleed', chance: 0.5, dur: 3 }], desc: '6 ударов по 85%, шанс кровотечения.' },

  // Монстры
  mob_smash: { id: 'mob_smash', name: 'Сокрушение', icon: '💥', cd: 3, tgt: 'one', mult: 1.7 },
  mob_venom: { id: 'mob_venom', name: 'Ядовитый укус', icon: '🐍', cd: 3, tgt: 'one', mult: 1.1, fx: [{ st: 'poison', chance: 0.8, dur: 3 }] },
  mob_ember: { id: 'mob_ember', name: 'Искры', icon: '🔥', cd: 4, tgt: 'all', mult: 0.9, magic: true, fx: [{ st: 'burn', chance: 0.4, dur: 3 }] },
  mob_slam: { id: 'mob_slam', name: 'Удар оземь', icon: '🪨', cd: 4, tgt: 'one', mult: 1.3, fx: [{ st: 'stun', chance: 0.35, dur: 1 }] },
  mob_regen: { id: 'mob_regen', name: 'Восстановление', icon: '💚', cd: 5, tgt: 'self', heal: 0.2 },
  mob_rage: { id: 'mob_rage', name: 'Ярость', icon: '😡', cd: 5, tgt: 'self', selfFx: [{ st: 'enrage', dur: 3 }] },
  mob_howl: { id: 'mob_howl', name: 'Вой', icon: '📢', cd: 4, tgt: 'all', mult: 0.8, fx: [{ st: 'weaken', chance: 0.5, dur: 2 }] },
  mob_rend: { id: 'mob_rend', name: 'Разрыв', icon: '🩸', cd: 3, tgt: 'one', mult: 1.2, fx: [{ st: 'bleed', chance: 0.7, dur: 3 }] },
  mob_frost: { id: 'mob_frost', name: 'Ледяной укус', icon: '🧊', cd: 3, tgt: 'one', mult: 1.2, magic: true, fx: [{ st: 'slow', chance: 0.7, dur: 2 }] },
  mob_drain: { id: 'mob_drain', name: 'Высасывание', icon: '🦇', cd: 3, tgt: 'one', mult: 1.1, leech: 0.8 },
  mob_curse: { id: 'mob_curse', name: 'Проклятие', icon: '👁️', cd: 4, tgt: 'one', mult: 0.8, magic: true, fx: [{ st: 'vuln', chance: 1, dur: 3 }] },
  boss_nova: { id: 'boss_nova', name: 'Волна разрушения', icon: '💢', cd: 5, tgt: 'all', mult: 1.6, magic: true },
  boss_crush: { id: 'boss_crush', name: 'Крушение', icon: '👊', cd: 4, tgt: 'one', mult: 2.4, fx: [{ st: 'stun', chance: 0.5, dur: 1 }] },
};

export const CLASS_SKILLS = {
  warrior: ['w_smash', 'w_shield', 'w_whirl', 'w_rally', 'w_exec', 'w_ult'],
  mage: ['m_fire', 'm_frost', 'm_chain', 'm_barrier', 'm_meteor', 'm_ult'],
  rogue: ['r_stab', 'r_poison', 'r_flurry', 'r_smoke', 'r_kill', 'r_ult'],
};

// ---------------------------------------------------------------- монстры
export const ROLES = {
  bruiser: { hp: 1.15, atk: 1.0, def: 1.0, spd: 0.95 },
  fast: { hp: 0.8, atk: 1.0, def: 0.8, spd: 1.2 },
  tank: { hp: 1.5, atk: 0.8, def: 1.4, spd: 0.85 },
  caster: { hp: 0.8, atk: 1.25, def: 0.8, spd: 1.0 },
};

export const CHAPTERS = [
  {
    id: 1, name: 'Пепельные луга', icon: '🌾', bg: ['#3a2d2a', '#1b1412'],
    monsters: [
      { n: 'Крыса-падальщик', e: '🐀', role: 'fast', sk: ['mob_rend'] },
      { n: 'Серый волк', e: '🐺', role: 'fast', sk: ['mob_rend'] },
      { n: 'Гоблин', e: '👺', role: 'bruiser', sk: ['mob_smash'] },
      { n: 'Ядовитый слизень', e: '🟢', role: 'tank', sk: ['mob_venom'] },
    ],
    boss: { n: 'Король гоблинов', e: '🤴', sk: ['mob_smash', 'mob_rage'] },
  },
  {
    id: 2, name: 'Проклятый лес', icon: '🌲', bg: ['#1f3326', '#0b1510'],
    monsters: [
      { n: 'Лесной паук', e: '🕷️', role: 'fast', sk: ['mob_venom'] },
      { n: 'Кровавая летучая мышь', e: '🦇', role: 'fast', sk: ['mob_drain'] },
      { n: 'Лесной тролль', e: '🧌', role: 'tank', sk: ['mob_smash'] },
      { n: 'Древень', e: '🌳', role: 'bruiser', sk: ['mob_slam'] },
    ],
    boss: { n: 'Мать-паучиха', e: '🕸️', sk: ['mob_venom', 'mob_howl'] },
  },
  {
    id: 3, name: 'Мёртвые пески', icon: '🏜️', bg: ['#4a3b20', '#1c150a'],
    monsters: [
      { n: 'Скорпион', e: '🦂', role: 'fast', sk: ['mob_venom'] },
      { n: 'Скелет-воин', e: '💀', role: 'bruiser', sk: ['mob_smash'] },
      { n: 'Мумия', e: '🧟', role: 'tank', sk: ['mob_regen'] },
      { n: 'Песчаная змея', e: '🐍', role: 'fast', sk: ['mob_venom'] },
    ],
    boss: { n: 'Фараон-лич', e: '☠️', sk: ['mob_curse', 'boss_nova'] },
  },
  {
    id: 4, name: 'Ледяные пики', icon: '🏔️', bg: ['#1d3550', '#0a1420'],
    monsters: [
      { n: 'Ледяной дух', e: '❄️', role: 'caster', sk: ['mob_frost'] },
      { n: 'Белый медведь', e: '🐻‍❄️', role: 'tank', sk: ['mob_slam'] },
      { n: 'Снежный йети', e: '🦍', role: 'bruiser', sk: ['mob_smash'] },
      { n: 'Ледяной голем', e: '🧊', role: 'tank', sk: ['mob_slam', 'mob_regen'] },
    ],
    boss: { n: 'Морозный дракон', e: '🐉', sk: ['mob_frost', 'boss_nova'] },
  },
  {
    id: 5, name: 'Огненные недра', icon: '🌋', bg: ['#4d1f12', '#1a0a05'],
    monsters: [
      { n: 'Огненный элементаль', e: '🔥', role: 'caster', sk: ['mob_ember'] },
      { n: 'Магмовый голем', e: '🪨', role: 'tank', sk: ['mob_slam'] },
      { n: 'Бес', e: '😈', role: 'fast', sk: ['mob_ember'] },
      { n: 'Саламандра', e: '🦎', role: 'bruiser', sk: ['mob_rend'] },
    ],
    boss: { n: 'Лорд пламени', e: '👹', sk: ['mob_ember', 'boss_crush', 'mob_rage'] },
  },
  {
    id: 6, name: 'Тёмная цитадель', icon: '🏰', bg: ['#2a1d3d', '#0e0816'],
    monsters: [
      { n: 'Тёмный маг', e: '🧙', role: 'caster', sk: ['mob_curse'] },
      { n: 'Рыцарь смерти', e: '⚔️', role: 'bruiser', sk: ['mob_slam'] },
      { n: 'Призрак', e: '👻', role: 'fast', sk: ['mob_drain'] },
      { n: 'Горгулья', e: '🗿', role: 'tank', sk: ['mob_smash', 'mob_regen'] },
    ],
    boss: { n: 'Граф-вампир', e: '🧛', sk: ['mob_drain', 'boss_crush', 'mob_curse'] },
  },
  {
    id: 7, name: 'Небесный шпиль', icon: '⛈️', bg: ['#26364f', '#0b111c'],
    monsters: [
      { n: 'Гарпия', e: '🦅', role: 'fast', sk: ['mob_rend'] },
      { n: 'Грозовой элементаль', e: '⚡', role: 'caster', sk: ['mob_ember', 'mob_howl'] },
      { n: 'Каменный страж', e: '🗽', role: 'tank', sk: ['mob_slam'] },
      { n: 'Небесный змей', e: '🐲', role: 'bruiser', sk: ['mob_frost', 'mob_smash'] },
    ],
    boss: { n: 'Буревестник', e: '🦜', sk: ['boss_nova', 'boss_crush', 'mob_howl'] },
  },
  {
    id: 8, name: 'Бездна Короны', icon: '👑', bg: ['#2c0f1f', '#0a0309'],
    monsters: [
      { n: 'Око бездны', e: '👁️', role: 'caster', sk: ['mob_curse', 'mob_ember'] },
      { n: 'Тень', e: '🌑', role: 'fast', sk: ['mob_drain', 'mob_rend'] },
      { n: 'Кракен', e: '🐙', role: 'tank', sk: ['mob_slam', 'mob_regen'] },
      { n: 'Демон бездны', e: '👿', role: 'bruiser', sk: ['mob_smash', 'mob_rage'] },
    ],
    boss: { n: 'Пепельный король', e: '👑', sk: ['boss_nova', 'boss_crush', 'mob_curse', 'mob_rage'] },
  },
];

export const TOWER_THEME = { name: 'Башня Бесконечности', icon: '🗼', bg: ['#1e2a44', '#080c16'] };
export const WORLD_BOSS = { name: 'Пожиратель миров', emoji: '🐲', sk: ['boss_nova', 'boss_crush', 'mob_howl', 'mob_rage'] };

// ---------------------------------------------------------------- таланты
export const TALENTS = [
  { id: 'vitality', name: 'Живучесть', icon: '❤️', max: 10, stat: 'hpPct', per: 0.03, desc: '+3% здоровья за ранг' },
  { id: 'power', name: 'Мощь', icon: '💪', max: 10, stat: 'atkPct', per: 0.03, desc: '+3% атаки за ранг' },
  { id: 'armor', name: 'Закалка', icon: '🛡️', max: 10, stat: 'defPct', per: 0.03, desc: '+3% защиты за ранг' },
  { id: 'precision', name: 'Меткость', icon: '🎯', max: 8, stat: 'crit', per: 0.01, desc: '+1% шанса крита за ранг' },
  { id: 'ferocity', name: 'Свирепость', icon: '💥', max: 8, stat: 'critDmg', per: 0.05, desc: '+5% крит. урона за ранг' },
  { id: 'swift', name: 'Проворство', icon: '🏃', max: 8, stat: 'spdPct', per: 0.015, desc: '+1.5% скорости за ранг' },
  { id: 'vampire', name: 'Вампиризм', icon: '🧛', max: 6, stat: 'lifesteal', per: 0.005, desc: '+0.5% вампиризма за ранг' },
  { id: 'evasion', name: 'Ловкость', icon: '💨', max: 6, stat: 'dodge', per: 0.01, desc: '+1% уклонения за ранг' },
  { id: 'fortune', name: 'Удача', icon: '🍀', max: 10, stat: 'goldPct', per: 0.04, desc: '+4% золота за ранг' },
  { id: 'wisdom', name: 'Мудрость', icon: '📖', max: 10, stat: 'xpPct', per: 0.04, desc: '+4% опыта за ранг' },
  { id: 'scavenger', name: 'Собиратель', icon: '🎒', max: 8, stat: 'dropPct', per: 0.03, desc: '+3% шанса добычи за ранг' },
  { id: 'grit', name: 'Стойкость', icon: '🧱', max: 5, stat: 'defPct', per: 0.02, desc: '+2% защиты и +2% здоровья', extra: { hpPct: 0.02 } },
];

// ---------------------------------------------------------------- духи
export const SPIRITS = [
  { id: 'fox', name: 'Огненный лис', icon: '🦊', stat: 'atkPct', per: 0.012, desc: '+1.2% атаки за уровень' },
  { id: 'turtle', name: 'Каменная черепаха', icon: '🐢', stat: 'defPct', per: 0.015, desc: '+1.5% защиты за уровень' },
  { id: 'owl', name: 'Мудрая сова', icon: '🦉', stat: 'xpPct', per: 0.02, desc: '+2% опыта за уровень' },
  { id: 'dragonling', name: 'Дракончик', icon: '🐲', stat: 'hpPct', per: 0.015, desc: '+1.5% здоровья за уровень' },
  { id: 'cat', name: 'Теневой кот', icon: '🐈‍⬛', stat: 'crit', per: 0.004, desc: '+0.4% крита за уровень' },
  { id: 'bat', name: 'Кровавый нетопырь', icon: '🦇', stat: 'lifesteal', per: 0.002, desc: '+0.2% вампиризма за уровень' },
  { id: 'raven', name: 'Ворон-вор', icon: '🐦‍⬛', stat: 'goldPct', per: 0.02, desc: '+2% золота за уровень' },
  { id: 'phoenix', name: 'Феникс', icon: '🦅', stat: 'critDmg', per: 0.01, desc: '+1% крит. урона за уровень' },
];
export const SPIRIT_MAX = 10;
export const spiritShardCost = (lvl) => 2 + lvl * 2;

// ---------------------------------------------------------------- квесты и достижения
export const QUEST_POOL = [
  { id: 'q_win', name: 'Победить в 5 боях', key: 'win', goal: 5, reward: { gold: 400, gems: 5 } },
  { id: 'q_kill', name: 'Убить 30 врагов', key: 'kill', goal: 30, reward: { gold: 500, dust: 5 } },
  { id: 'q_enh', name: 'Улучшить снаряжение 2 раза', key: 'enhance', goal: 2, reward: { gold: 300, dust: 8 } },
  { id: 'q_skill', name: 'Применить 15 навыков', key: 'skill', goal: 15, reward: { gold: 350, gems: 4 } },
  { id: 'q_arena', name: 'Сразиться на арене', key: 'arena', goal: 1, reward: { gems: 10 } },
  { id: 'q_idle', name: 'Забрать награду за отдых', key: 'idle', goal: 1, reward: { gold: 300 } },
  { id: 'q_boss', name: 'Победить босса', key: 'boss', goal: 1, reward: { gems: 8, dust: 6 } },
  { id: 'q_tower', name: 'Пройти 3 этажа башни', key: 'tower', goal: 3, reward: { gems: 8, gold: 400 } },
  { id: 'q_chest', name: 'Открыть сундук', key: 'chest', goal: 1, reward: { gold: 300, dust: 4 } },
  { id: 'q_crit', name: 'Нанести 10 критов', key: 'crit', goal: 10, reward: { gold: 400, gems: 3 } },
];
export const DAILY_QUESTS = 5;
export const QUEST_BONUS = { gems: 20, dust: 10 };

const lvl = (s) => s.level;
export const ACHIEVEMENTS = [
  { id: 'a_level', name: 'Восхождение', desc: (g) => `Достигните ${g} уровня`, value: lvl, tiers: [10, 20, 30, 45, 60], reward: (i) => ({ gems: 10 + i * 10 }) },
  { id: 'a_stage', name: 'Покоритель земель', desc: (g) => `Пройдите ${g} этапов кампании`, value: (s) => s.stage, tiers: [10, 25, 40, 60, 80], reward: (i) => ({ gems: 15 + i * 10, dust: 10 * (i + 1) }) },
  { id: 'a_kills', name: 'Истребитель', desc: (g) => `Убейте ${g} врагов`, value: (s) => s.stats.kills, tiers: [100, 500, 2000, 8000, 30000], reward: (i) => ({ gems: 8 + i * 8, gold: 1000 * (i + 1) ** 2 }) },
  { id: 'a_wins', name: 'Победитель', desc: (g) => `Выиграйте ${g} боёв`, value: (s) => s.stats.wins, tiers: [10, 50, 200, 800], reward: (i) => ({ gems: 10 + i * 10 }) },
  { id: 'a_tower', name: 'Башенный покоритель', desc: (g) => `Достигните ${g} этажа башни`, value: (s) => s.tower, tiers: [5, 15, 30, 50, 80], reward: (i) => ({ gems: 15 + i * 12, dust: 15 * (i + 1) }) },
  { id: 'a_arena', name: 'Гладиатор', desc: (g) => `Выиграйте ${g} боёв на арене`, value: (s) => s.arena.wins, tiers: [1, 10, 50, 200], reward: (i) => ({ gems: 10 + i * 15 }) },
  { id: 'a_enh', name: 'Кузнец', desc: (g) => `Улучшите предмет до +${g}`, value: (s) => s.stats.bestEnh, tiers: [3, 6, 9, 12, 15], reward: (i) => ({ gems: 8 + i * 8, dust: 12 * (i + 1) }) },
  { id: 'a_gold', name: 'Богач', desc: (g) => `Заработайте ${g} золота`, value: (s) => s.stats.goldEarned, tiers: [10000, 200000, 3000000, 50000000], reward: (i) => ({ gems: 10 + i * 10 }) },
  { id: 'a_legend', name: 'Охотник за легендами', desc: (g) => `Найдите ${g} легендарных предметов`, value: (s) => s.stats.legendaries, tiers: [1, 5, 15, 40], reward: (i) => ({ gems: 15 + i * 15 }) },
  { id: 'a_spirit', name: 'Дрессировщик', desc: (g) => `Призовите ${g} духов`, value: (s) => Object.keys(s.spirits).length, tiers: [1, 3, 5, 8], reward: (i) => ({ gems: 10 + i * 12 }) },
  { id: 'a_boss', name: 'Убийца боссов', desc: (g) => `Победите ${g} боссов`, value: (s) => s.stats.bosses, tiers: [1, 8, 30, 100], reward: (i) => ({ gems: 12 + i * 12 }) },
  { id: 'a_world', name: 'Охотник на титана', desc: (g) => `Нанесите ${g} урона мировому боссу`, value: (s) => s.stats.worldDmg, tiers: [10000, 200000, 3000000, 40000000], reward: (i) => ({ gems: 15 + i * 15 }) },
];

export const LOGIN_REWARDS = [
  { gold: 500 },
  { gems: 10 },
  { dust: 15 },
  { potions: 3 },
  { gems: 20 },
  { gold: 3000, dust: 10 },
  { gems: 60, chestKeys: 1 },
];

export const SHOP_POTION_PRICE = 150; // золото за зелье
