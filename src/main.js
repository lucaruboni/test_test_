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
  'Headshots pay more points and more XP.',
  'The knife kills in one hit in early rounds and pays 120 points.',
  'The Mystery Crate eventually moves. Follow the beam of light.',
  'Iron Hide lets you take five hits instead of two.',
  'Levelling a weapon unlocks its attachments in the lobby.',
  'Keep the last zombie alive to shop in peace.',
];

const SCREENS = ['loading', 'menu', 'lobby', 'settings', 'controls', 'pause', 'over', 'quit'];
function show(name) {
  current = name;
  SCREENS.forEach(s => $('s-' + s).classList.toggle('hidden', s !== name));
  $('hud').classList.toggle('hidden', !game);
}
function hideScreens() { current = 'game'; SCREENS.forEach(s => $('s-' + s).classList.add('hidden')); $('hud').classList.remove('hidden'); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
function loading(p, label) { const v = Math.round(p * 100) + '%'; $('load-bar').style.width = v; $('load-pct').textContent = v; if (label) $('load-label').textContent = label; }

// ---------- menu card + lobby ----------
const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
function renderCard() {
  const pi = playerInfo(profile.xp);
  $('menu-card').innerHTML = `<div class="rank"><div class="lvl">${pi.level}</div><div class="who"><b>SURVIVOR</b><small>${pi.next ? `${Math.floor(pi.cur)} / ${pi.next} XP` : 'Max level'}</small></div></div><div class="xp"><i style="width:${pi.frac * 100}%"></i></div>${kv('Best round', profile.best.round)}${kv('Most kills', profile.best.kills)}${kv('Starting weapon', WEAPONS[profile.starter].name)}`;
}
function renderLobby() {
  const pi = playerInfo(profile.xp);
  $('lobby-player').innerHTML = `<div class="row"><b>LEVEL ${pi.level}</b><span>${pi.next ? `${Math.floor(pi.cur)} / ${pi.next} XP` : 'Max level'}</span></div><div class="xp"><i style="width:${pi.frac * 100}%"></i></div>`;
  $('lobby-best').innerHTML = kv('Best round', profile.best.round) + kv('Most kills', profile.best.kills);
  const st = $('lobby-starters'); st.innerHTML = '';
  for (const id in WEAPONS) {
    const w = WEAPONS[id]; if (!w.starter) continue;
    const locked = pi.level < w.starter;
    const b = document.createElement('button');
    b.className = 'item' + (profile.starter === id ? ' sel' : '') + (locked ? ' locked' : '');
    b.innerHTML = `<b>${w.name}${profile.starter === id ? '<em>EQUIPPED</em>' : ''}</b><small>${locked ? 'Unlocks at level ' + w.starter : `Damage ${w.dmg} · Magazine ${w.mag}`}</small>`;
    b.onclick = () => { if (locked) { sfx('deny'); return; } profile.starter = id; saveProfile(profile); sfx('click'); renderLobby(); };
    st.appendChild(b);
  }
  const wallIds = new Set(Object.values(WALLBUYS));
  const wl = $('lobby-weapons'); wl.innerHTML = '';
  for (const id in WEAPONS) {
    const w = WEAPONS[id], wi = weaponInfo(profile.weapons[id].xp);
    const src = w.starter ? 'Starter' : wallIds.has(id) ? 'Wall weapon' : 'Mystery Crate';
    const b = document.createElement('button');
    b.className = 'item' + (selWeapon === id ? ' sel' : '');
    b.innerHTML = `<b>${w.name}<em>LV ${wi.level}${wi.level >= MAX_WLEVEL ? ' MAX' : ''}</em></b><small>${src} · ${profile.weapons[id].att.length}/${MAX_ATTACH} attachments</small><div class="xp"><i style="width:${wi.frac * 100}%"></i></div>`;
    b.onclick = () => { selWeapon = id; sfx('click'); renderLobby(); };
    wl.appendChild(b);
  }
  const wp = profile.weapons[selWeapon], wi = weaponInfo(wp.xp), sw = WEAPONS[selWeapon];
  $('att-title').textContent = sw.name;
  const bar = (k, v) => `<span>${k}</span><div class="xp"><i style="width:${Math.max(6, Math.min(100, v * 100))}%"></i></div>`;
  $('lobby-stats').innerHTML = bar('Damage', Math.sqrt(sw.dmg * sw.pellets / 500)) + bar('Fire rate', sw.rpm / 900) + bar('Magazine', Math.sqrt(sw.mag / 100)) + bar('Handling', 1 - sw.reload / 5.2) + bar('Accuracy', 1 - sw.spread / 0.095);
  const al = $('lobby-att'); al.innerHTML = '';
  for (const a of ATTACHMENTS) {
    const locked = wi.level < a.lvl, on = wp.att.includes(a.id);
    const b = document.createElement('button');
    b.className = 'item' + (on ? ' sel' : '') + (locked ? ' locked' : '');
    b.innerHTML = `<b>${a.name}${on ? '<em>EQUIPPED</em>' : ''}</b><small>${locked ? 'Unlocks at weapon level ' + a.lvl : a.desc}</small>`;
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

// ---------- settings ----------
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

// ---------- flow ----------
async function startMatch() {
  show('loading'); $('hud').classList.add('hidden');
  $('load-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  loading(0.02, 'Loading map…');
  await sleep(60);
  if (game) game.destroy();
  game = new Game($('view'), profile, input, { onPause: pause, onEnd: endMatch });
  await game.build(loading);
  await sleep(250);
  hideScreens();
  game.start();
}
function pause() { if (!game || game.over || game.paused) return; game.setPaused(true); if (document.exitPointerLock) document.exitPointerLock(); $('pause-info').textContent = `ROUND ${game.round || 1} · ${game.p.points} POINTS`; show('pause'); }
function resume() { if (!game) return; hideScreens(); game.setPaused(false); }
function endMatch(stats) {
  const pi = playerInfo(profile.xp), before = playerInfo(profile.xp - stats.xp);
  if (document.exitPointerLock) document.exitPointerLock();
  const cell = (k, v) => `<div><b>${v}</b><span>${k}</span></div>`;
  $('over-stats').innerHTML = cell('Round', stats.round) + cell('Kills', stats.kills) + cell('Headshots', stats.heads) + cell('Points', stats.points);
  $('over-xp').innerHTML = `<div>+${stats.xp} XP · ${pi.level > before.level ? `LEVEL UP — NOW LEVEL ${pi.level}` : `LEVEL ${pi.level}`}</div><div class="xp"><i style="width:${(pi.level > before.level ? 0 : before.frac) * 100}%"></i></div>`;
  setTimeout(() => { const i = document.querySelector('#over-xp i'); if (i) i.style.width = pi.frac * 100 + '%'; }, 80);
  show('over');
}
function leaveMatch() { if (game) { saveProfile(profile); game.destroy(); game = null; } }

function go(action) {
  initAudio(); sfx('click');
  switch (action) {
    case 'lobby': leaveMatch(); renderLobby(); show('lobby'); break;
    case 'menu': renderCard(); show('menu'); break;
    case 'play': startMatch(); break;
    case 'settings': case 'controls': overlayBack = current; show(action); break;
    case 'back': show(overlayBack || 'menu'); break;
    case 'resume': resume(); break;
    case 'abandon': leaveMatch(); renderCard(); show('menu'); break;
    case 'quit': show('quit'); try { window.close(); } catch (e) { /* ignore */ } break;
  }
}
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
$('btn-pause').addEventListener('click', pause);
$('btn-pause').addEventListener('touchstart', e => { e.stopPropagation(); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && current === 'game') pause(); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && current === 'game' && game && !game.paused && game.hadLock) pause(); if (document.pointerLockElement && game) game.hadLock = true; });
window.addEventListener('keydown', e => { if (e.code === 'Escape' && current === 'pause') resume(); });
// block page zoom and scroll on iOS (lobby panels still scroll)
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (!e.target.closest('.panel, .form')) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault());

input.onPad = (on, id) => { $('pad-status').textContent = on ? 'Controller: ' + id.slice(0, 36) + ' · A select · B back' : 'No controller connected'; };

// controller in menus: A = primary action, B = back, Start = resume
function menuPad() {
  requestAnimationFrame(menuPad);
  if (input.active) return;
  const g = input.pad(); if (!g) return;
  if (!input.gamepadName) { input.gamepadName = g.id; input.onPad(true, g.id); }
  const vis = () => document.querySelector('.screen:not(.hidden)');
  if (input.padEdge(g, 0)) { const b = vis() && vis().querySelector('.primary'); if (b) b.click(); }
  else if (input.padEdge(g, 9) && current === 'pause') resume();
  else if (input.padEdge(g, 1)) { const s = vis(); const b = s && (s.querySelector('[data-go="back"]') || s.querySelector('[data-go="menu"]') || s.querySelector('[data-go="resume"]')); if (b) b.click(); }
  input.padCommit(g);
}

(async function boot() {
  document.body.classList.toggle('touch', input.isTouch);
  $('load-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  bindSettings();
  for (let i = 1; i <= 5; i++) { loading(i / 5, 'Loading…'); await sleep(110); }
  renderCard(); show('menu');
  menuPad();
})();
