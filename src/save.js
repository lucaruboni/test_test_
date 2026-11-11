// Profilo persistente: XP giocatore, XP armi, accessori, impostazioni.
import { WEAPONS } from './data.js';

const KEY = 'notte-rossa-profile-v1';
export const MAX_LEVEL = 55;
export const MAX_WLEVEL = 10;

const defaults = () => ({
  xp: 0,
  starter: 'vesper',
  weapons: {},
  best: { round: 0, kills: 0 },
  settings: { sens: 1, invert: false, vol: 0.7, fov: 75, quality: 1, lefty: false },
});

export function loadProfile() {
  const p = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw) {
      Object.assign(p, raw);
      p.settings = Object.assign(defaults().settings, raw.settings || {});
      p.best = Object.assign(defaults().best, raw.best || {});
    }
  } catch (e) { /* storage non disponibile: si gioca senza salvataggio */ }
  for (const id in WEAPONS) if (!p.weapons[id]) p.weapons[id] = { xp: 0, att: [] };
  if (!WEAPONS[p.starter]) p.starter = 'vesper';
  return p;
}

export function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* ignora */ }
}

// XP totale necessario per raggiungere il livello n
const need = (n, k) => k * n * (n - 1) / 2;
function levelOf(xp, k, max) {
  let l = 1;
  while (l < max && xp >= need(l + 1, k)) l++;
  return l;
}
function info(xp, k, max) {
  const level = levelOf(xp, k, max);
  if (level >= max) return { level, frac: 1, cur: 0, next: 0 };
  const a = need(level, k), b = need(level + 1, k);
  return { level, frac: (xp - a) / (b - a), cur: xp - a, next: b - a };
}
export const playerInfo = xp => info(xp, 400, MAX_LEVEL);
export const weaponInfo = xp => info(xp, 150, MAX_WLEVEL);
