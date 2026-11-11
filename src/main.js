import { WEAPONS, ATTACHMENTS, MAX_ATTACH, WALLBUYS } from './data.js';
import { loadProfile, saveProfile, playerInfo, weaponInfo, MAX_WLEVEL } from './save.js';
import { initAudio, setVolume, sfx } from './audio.js';
import { Input } from './input.js';
import { Game } from './game.js';

const $ = id => document.getElementById(id);
const profile = loadProfile();
const input = new Input();
let game = null, current = 'loading', overlayBack = null, selWeapon = profile.starter;

const TIPS = [
  'I colpi alla testa valgono più punti e più XP.',
  'La lama uccide in un colpo nei primi round e rende 120 punti.',
  'La cassa misteriosa prima o poi si sposta: segui il fascio di luce.',
  'Iron Hide ti fa reggere cinque colpi invece di due.',
  'Salire di livello con un\'arma sblocca gli accessori nella lobby.',
  'Tieni in vita l\'ultimo zombie per comprare con calma.',
];

const SCREENS = ['loading', 'menu', 'lobby', 'settings', 'controls', 'pause', 'over', 'quit'];
function show(name) {
  current = name;
  SCREENS.forEach(s => $('s-' + s).classList.toggle('hidden', s !== name));
  $('hud').classList.toggle('hidden', !game);
}
function hideScreens() { current = 'game'; SCREENS.forEach(s => $('s-' + s).classList.add('hidden')); $('hud').classList.remove('hidden'); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
function loading(p, label) { $('load-bar').style.width = Math.round(p * 100) + '%'; if (label) $('load-label').textContent = label; }

// ---------- lobby ----------
function renderLobby() {
  const pi = playerInfo(profile.xp);
  $('lobby-player').innerHTML = `<b>Livello ${pi.level}</b> · ${pi.next ? `${Math.floor(pi.cur)} / ${pi.next} XP` : 'Livello massimo'}<div class="xp"><i style="width:${pi.frac * 100}%"></i></div>`;
  $('lobby-best').textContent = `Round migliore: ${profile.best.round} · Uccisioni migliori: ${profile.best.kills}`;
  const st = $('lobby-starters'); st.innerHTML = '';
  for (const id in WEAPONS) {
    const w = WEAPONS[id]; if (!w.starter) continue;
    const locked = pi.level < w.starter;
    const b = document.createElement('button');
    b.className = 'item' + (profile.starter === id ? ' sel' : '') + (locked ? ' locked' : '');
    b.innerHTML = `<b>${w.name}</b><small>${locked ? 'Si sblocca al livello ' + w.starter : `Danno ${w.dmg} · Caricatore ${w.mag}`}</small>`;
    b.onclick = () => { if (locked) { sfx('deny'); return; } profile.starter = id; saveProfile(profile); sfx('click'); renderLobby(); };
    st.appendChild(b);
  }
  const wallIds = new Set(Object.values(WALLBUYS));
  const wl = $('lobby-weapons'); wl.innerHTML = '';
  for (const id in WEAPONS) {
    const w = WEAPONS[id], wi = weaponInfo(profile.weapons[id].xp);
    const src = w.starter ? 'Iniziale' : wallIds.has(id) ? 'A muro' : 'Cassa';
    const b = document.createElement('button');
    b.className = 'item' + (selWeapon === id ? ' sel' : '');
    b.innerHTML = `<b>${w.name} <small>· Liv. ${wi.level}${wi.level >= MAX_WLEVEL ? ' MAX' : ''}</small></b><small>${src} · ${profile.weapons[id].att.length}/${MAX_ATTACH} accessori</small><div class="xp"><i style="width:${wi.frac * 100}%"></i></div>`;
    b.onclick = () => { selWeapon = id; sfx('click'); renderLobby(); };
    wl.appendChild(b);
  }
  const wp = profile.weapons[selWeapon], wi = weaponInfo(wp.xp);
  $('att-title').textContent = 'Accessori · ' + WEAPONS[selWeapon].name;
  const al = $('lobby-att'); al.innerHTML = '';
  for (const a of ATTACHMENTS) {
    const locked = wi.level < a.lvl, on = wp.att.includes(a.id);
    const b = document.createElement('button');
    b.className = 'item' + (on ? ' sel' : '') + (locked ? ' locked' : '');
    b.innerHTML = `<b>${a.name}</b><small>${locked ? 'Arma al livello ' + a.lvl : a.desc}</small>`;
    b.onclick = () => {
      if (locked) { sfx('deny'); return; }
      if (on) wp.att = wp.att.filter(x => x !== a.id);
      else if (wp.att.length < MAX_ATTACH) wp.att.push(a.id);
      else { sfx('deny'); return; }
      saveProfile(profile); sfx('click'); renderLobby();
    };
    al.appendChild(b);
  }
}

// ---------- impostazioni ----------
function bindSettings() {
  const s = profile.settings;
  const upd = () => {
    $('o-sens').textContent = s.sens.toFixed(2); $('o-fov').textContent = s.fov; $('o-vol').textContent = Math.round(s.vol * 100);
    setVolume(s.vol); input.sens = s.sens; input.lefty = s.lefty;
    document.body.classList.toggle('lefty', s.lefty);
    if (game) game.applySettings();
    saveProfile(profile);
  };
  $('set-sens').value = s.sens; $('set-fov').value = s.fov; $('set-vol').value = s.vol; $('set-quality').value = s.quality;
  $('set-invert').checked = s.invert; $('set-lefty').checked = s.lefty;
  $('set-sens').oninput = e => { s.sens = +e.target.value; upd(); };
  $('set-fov').oninput = e => { s.fov = +e.target.value; upd(); };
  $('set-vol').oninput = e => { s.vol = +e.target.value; upd(); };
  $('set-quality').onchange = e => { s.quality = +e.target.value; upd(); };
  $('set-invert').onchange = e => { s.invert = e.target.checked; upd(); };
  $('set-lefty').onchange = e => { s.lefty = e.target.checked; upd(); };
  upd();
}

// ---------- flusso ----------
async function startMatch() {
  show('loading'); $('hud').classList.add('hidden');
  $('load-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  loading(0.02, 'Caricamento mappa…');
  await sleep(60);
  if (game) game.destroy();
  game = new Game($('view'), profile, input, { onPause: pause, onEnd: endMatch });
  await game.build(loading);
  await sleep(250);
  hideScreens();
  game.start();
}
function pause() { if (!game || game.over || game.paused) return; game.setPaused(true); if (document.exitPointerLock) document.exitPointerLock(); show('pause'); }
function resume() { if (!game) return; hideScreens(); game.setPaused(false); }
function endMatch(stats) {
  const pi = playerInfo(profile.xp), before = playerInfo(profile.xp - stats.xp);
  if (document.exitPointerLock) document.exitPointerLock();
  $('over-stats').innerHTML = `<span>Round raggiunto</span><b>${stats.round}</b><span>Uccisioni</span><b>${stats.kills}</b><span>Colpi alla testa</span><b>${stats.heads}</b><span>Punti totali</span><b>${stats.points}</b><span>XP guadagnati</span><b>+${stats.xp}</b><span class="lvl">${pi.level > before.level ? `Sei salito al livello ${pi.level}!` : `Livello ${pi.level}`}</span>`;
  show('over');
}
function leaveMatch() { if (game) { saveProfile(profile); game.destroy(); game = null; } }

function go(action) {
  initAudio(); sfx('click');
  switch (action) {
    case 'lobby': leaveMatch(); renderLobby(); show('lobby'); break;
    case 'menu': show('menu'); break;
    case 'play': startMatch(); break;
    case 'settings': case 'controls': overlayBack = current; show(action); break;
    case 'back': show(overlayBack || 'menu'); break;
    case 'resume': resume(); break;
    case 'abandon': leaveMatch(); show('menu'); break;
    case 'quit': show('quit'); try { window.close(); } catch (e) { /* ignora */ } break;
  }
}
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
$('btn-pause').addEventListener('click', pause);
$('btn-pause').addEventListener('touchstart', e => { e.stopPropagation(); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && current === 'game') pause(); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && current === 'game' && game && !game.paused && game.hadLock) pause(); if (document.pointerLockElement && game) game.hadLock = true; });
window.addEventListener('keydown', e => { if (e.code === 'Escape' && current === 'pause') resume(); });
// blocca zoom e scorrimento della pagina su iOS (i pannelli della lobby scorrono comunque)
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (!e.target.closest('.panel, .form')) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault());

input.onPad = (on, id) => { $('pad-status').textContent = on ? 'Controller collegato: ' + id.slice(0, 40) : 'Nessun controller collegato'; };

// controller nei menu: A = pulsante principale, B = indietro, Start = riprendi
function menuPad() {
  requestAnimationFrame(menuPad);
  if (input.active) return;
  const g = input.pad(); if (!g) return;
  if (!input.gamepadName) { input.gamepadName = g.id; input.onPad(true, g.id); }
  const vis = () => document.querySelector('.screen:not(.hidden)');
  if (input.padEdge(g, 0)) { const b = vis() && vis().querySelector('.btn.primary'); if (b) b.click(); }
  else if (input.padEdge(g, 9) && current === 'pause') resume();
  else if (input.padEdge(g, 1)) { const s = vis(); const b = s && (s.querySelector('[data-go="back"]') || s.querySelector('[data-go="menu"]') || s.querySelector('[data-go="resume"]')); if (b) b.click(); }
  input.padCommit(g);
}

(async function boot() {
  document.body.classList.toggle('touch', input.isTouch);
  $('load-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  bindSettings();
  for (let i = 1; i <= 5; i++) { loading(i / 5, 'Caricamento…'); await sleep(110); }
  show('menu');
  menuPad();
})();
