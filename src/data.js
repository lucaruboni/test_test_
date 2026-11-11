// Game data: map, weapons, perks, attachments. The map and perks are original; weapons are real-world firearms.
export const CELL = 2.5;
export const WALL_H = 4;
export const CRATE_COST = 950;

// # wall  . floor  1-5 doors  z zombie spawn  a-g wall weapons
// Q J S D M perk machines  X crate locations  P player start
export const MAP = [
  '##############f##################',
  '#z....#......X.......z#...z....S#',
  '#.....c...............e.........#',
  '#.....#...............#.........#',
  '#.....2...............3.........#',
  '#.....#......###......#.........#',
  '#J....#......###......#........X#',
  '###1###...............####4######',
  '#....z#...............#.........#',
  '#..P..a...............#....z....#',
  '#.....#...............d.........#',
  '#.....5...............#.........#',
  '#Q....#...X.......z...#D.......M#',
  '#z....b...............#........X#',
  '##############g##################',
];

export const DOORS = { 1: 750, 5: 750, 2: 1000, 3: 1250, 4: 1500 };

// cls: pistol | smg | ar | shotgun | lmg | sniper | energy
export const WEAPONS = {
  vesper:   { name: 'M1911',       cls: 'pistol',  dmg: 30,  rpm: 420, auto: false, mag: 8,   reserve: 80,  reload: 1.5, spread: 0.010, pellets: 1, kick: 0.020, starter: 1 },
  magnate:  { name: '.357 Magnum', cls: 'pistol',  dmg: 110, rpm: 190, auto: false, mag: 6,   reserve: 60,  reload: 2.2, spread: 0.008, pellets: 1, kick: 0.050, starter: 5 },
  tercet:   { name: 'Glock 18',    cls: 'pistol',  dmg: 34,  rpm: 700, auto: true,  mag: 18,  reserve: 108, reload: 1.6, spread: 0.022, pellets: 1, kick: 0.016, starter: 10 },
  warden:   { name: 'M14',         cls: 'ar',      dmg: 95,  rpm: 300, auto: false, mag: 10,  reserve: 90,  reload: 2.1, spread: 0.006, pellets: 1, kick: 0.030, cost: 600 },
  sawtooth: { name: 'Coach Gun',   cls: 'shotgun', dmg: 55,  rpm: 200, auto: false, mag: 2,   reserve: 40,  reload: 1.9, spread: 0.090, pellets: 8, kick: 0.070, cost: 500 },
  hornet:   { name: 'MP5',         cls: 'smg',     dmg: 32,  rpm: 780, auto: true,  mag: 30,  reserve: 180, reload: 1.8, spread: 0.024, pellets: 1, kick: 0.012, cost: 1000 },
  kestrel:  { name: 'AK-47',       cls: 'ar',      dmg: 48,  rpm: 620, auto: true,  mag: 30,  reserve: 210, reload: 2.2, spread: 0.014, pellets: 1, kick: 0.016, cost: 1500 },
  bulldog:  { name: 'Model 870',   cls: 'shotgun', dmg: 48,  rpm: 75,  auto: false, mag: 6,   reserve: 48,  reload: 2.8, spread: 0.065, pellets: 8, kick: 0.060, cost: 1200 },
  viper:    { name: 'Uzi',         cls: 'smg',     dmg: 38,  rpm: 900, auto: true,  mag: 40,  reserve: 200, reload: 2.0, spread: 0.028, pellets: 1, kick: 0.011, cost: 1300 },
  trident:  { name: 'FN FAL',      cls: 'ar',      dmg: 70,  rpm: 480, auto: true,  mag: 24,  reserve: 168, reload: 2.3, spread: 0.009, pellets: 1, kick: 0.022, cost: 1400 },
  anvil:    { name: 'M60',         cls: 'lmg',     dmg: 62,  rpm: 560, auto: true,  mag: 100, reserve: 300, reload: 4.6, spread: 0.020, pellets: 1, kick: 0.018 },
  longbow:  { name: 'Barrett M82', cls: 'sniper',  dmg: 900, rpm: 55,  auto: false, mag: 5,   reserve: 40,  reload: 3.0, spread: 0.001, pellets: 1, kick: 0.090 },
  reaper:   { name: 'AA-12',       cls: 'shotgun', dmg: 60,  rpm: 300, auto: true,  mag: 12,  reserve: 72,  reload: 3.0, spread: 0.075, pellets: 8, kick: 0.045 },
  talon:    { name: 'G36C',        cls: 'ar',      dmg: 58,  rpm: 720, auto: true,  mag: 35,  reserve: 245, reload: 2.3, spread: 0.013, pellets: 1, kick: 0.014 },
  arc:      { name: 'Arc Caster',  cls: 'energy',  dmg: 1200, rpm: 150, auto: false, mag: 20, reserve: 140, reload: 3.0, spread: 0.002, pellets: 1, kick: 0.030, splash: 3.2 },
};

export const WALLBUYS = { a: 'warden', b: 'sawtooth', c: 'hornet', d: 'kestrel', e: 'bulldog', f: 'viper', g: 'trident' };
export const CRATE_POOL = ['anvil', 'longbow', 'reaper', 'talon', 'arc', 'magnate', 'tercet', 'kestrel', 'viper', 'trident', 'bulldog'];

export const PERKS = {
  Q: { id: 'wind',  name: 'Second Wind', short: 'SW', cost: 500,  color: '#4aa3ff', desc: 'Get back up on your own when downed (max 3)' },
  J: { id: 'hide',  name: 'Iron Hide',   short: 'IH', cost: 2500, color: '#e0483a', desc: 'Max health 250' },
  S: { id: 'hands', name: 'Quick Hands', short: 'QH', cost: 3000, color: '#3fca6b', desc: 'Reload twice as fast' },
  D: { id: 'twin',  name: 'Twin Tap',    short: 'TT', cost: 2000, color: '#f0a23a', desc: '+30% fire rate and double damage' },
  M: { id: 'pack',  name: 'Pack Rat',    short: 'PR', cost: 4000, color: '#9be04a', desc: 'Carry a third weapon' },
};

export const ATTACHMENTS = [
  { id: 'extmag',  name: 'Extended Mag', lvl: 2, desc: '+35% magazine size' },
  { id: 'grip',    name: 'Foregrip', lvl: 3, desc: 'Less spread and recoil' },
  { id: 'fastmag', name: 'Fast Mag', lvl: 4, desc: '28% faster reload' },
  { id: 'sight',   name: 'Reflex Sight', lvl: 5, desc: 'More zoom when aiming' },
  { id: 'barrel',  name: 'Long Barrel', lvl: 6, desc: '+15% damage' },
  { id: 'stock',   name: 'Light Stock', lvl: 7, desc: 'Full move speed while aiming' },
  { id: 'fmj',     name: 'FMJ', lvl: 8, desc: 'Headshots deal x2.6' },
];
export const MAX_ATTACH = 3;
