// Hand-built models: an articulated zombie and a parametric gun builder. Everything here is generated in code.
import * as THREE from '../lib/three.module.min.js';

function tex(draw, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const blotch = (g, s, n, colors, rmin, rmax, a) => {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = a * (0.4 + Math.random() * 0.6); g.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, rmin + Math.random() * (rmax - rmin), rmin + Math.random() * (rmax - rmin), Math.random() * 3, 0, 6.3); g.fill();
  }
  g.globalAlpha = 1;
};

// ---------- zombie ----------
export function makeZombieKit() {
  const skinTex = base => tex((g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    blotch(g, s, 60, ['#4b5340', '#8f9a7c', '#5d4a44'], 3, 12, 0.35);
    blotch(g, s, 14, ['#4a0d0a', '#2a0605'], 2, 9, 0.8);
    blotch(g, s, 200, ['#000', '#fff'], 0.5, 1.5, 0.12);
  });
  const clothTex = base => tex((g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    g.globalAlpha = 0.12; g.fillStyle = '#000';
    for (let y = 0; y < s; y += 3) g.fillRect(0, y, s, 1);
    blotch(g, s, 30, ['#1a1512', '#2c2622'], 4, 16, 0.5);
    blotch(g, s, 10, ['#4a0d0a', '#300806'], 3, 12, 0.85);
    // tears showing skin
    blotch(g, s, 5, ['#6f7a5e'], 3, 7, 0.9);
  });
  const L = o => new THREE.MeshLambertMaterial(o);
  const mat = {
    skin: ['#7f8b6c', '#8a8472', '#6d7a6a'].map(c => L({ map: skinTex(c) })),
    cloth: ['#4a4034', '#35404a', '#4a3535', '#3c4636', '#5a5648'].map(c => L({ map: clothTex(c) })),
    pants: ['#25262b', '#2e2a24', '#1f2a33'].map(c => L({ map: clothTex(c) })),
    dark: L({ color: 0x1a1412 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xff4a1a }),
  };
  const cap = (r, len, y) => new THREE.CapsuleGeometry(r, len, 3, 8).translate(0, y, 0);
  const geo = {
    pelvis: new THREE.CylinderGeometry(0.17, 0.15, 0.22, 10).scale(1, 1, 0.68),
    torso: new THREE.CylinderGeometry(0.215, 0.165, 0.5, 10).scale(1, 1, 0.62).translate(0, 0.27, 0),
    neck: new THREE.CylinderGeometry(0.055, 0.065, 0.1, 8),
    head: new THREE.SphereGeometry(0.145, 12, 10).scale(0.9, 1.12, 1),
    jaw: new THREE.BoxGeometry(0.16, 0.07, 0.13),
    eye: new THREE.SphereGeometry(0.02, 6, 5),
    upperArm: cap(0.055, 0.2, -0.15), foreArm: cap(0.045, 0.2, -0.14), hand: new THREE.SphereGeometry(0.052, 8, 6).scale(0.8, 1.2, 0.6).translate(0, -0.31, 0),
    thigh: cap(0.08, 0.26, -0.2), shin: cap(0.06, 0.28, -0.2), foot: new THREE.BoxGeometry(0.1, 0.07, 0.24).translate(0, -0.42, 0.06),
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // Returns { g, parts } with feet at the origin, facing +z.
  function build() {
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    const skin = pick(mat.skin), cloth = pick(mat.cloth), pants = pick(mat.pants);
    const sleeves = Math.random() < 0.5;
    const add = (parent, geom, m, x, y, z) => { const o = new THREE.Mesh(geom, m); o.position.set(x, y, z); parent.add(o); return o; };
    const pivot = (parent, x, y, z) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
    add(g, geo.pelvis, pants, 0, 0.93, 0);
    // upper body leans forward from the hips
    const torso = pivot(g, 0, 1.0, 0); torso.rotation.x = 0.22 + Math.random() * 0.12;
    add(torso, geo.torso, cloth, 0, 0, 0);
    add(torso, geo.neck, skin, 0, 0.56, 0.01);
    const head = pivot(torso, 0, 0.72, 0.03); head.rotation.x = -0.25;
    add(head, geo.head, skin, 0, 0, 0);
    add(head, geo.jaw, mat.dark, 0, -0.11, 0.06).rotation.x = 0.25;
    add(head, geo.eye, mat.eye, -0.055, 0.02, 0.125); add(head, geo.eye, mat.eye, 0.055, 0.02, 0.125);
    const arm = side => {
      const a = pivot(torso, side * 0.26, 0.46, 0);
      add(a, geo.upperArm, sleeves ? cloth : skin, 0, 0, 0);
      const e = pivot(a, 0, -0.3, 0); e.rotation.x = -0.25 - Math.random() * 0.4;
      add(e, geo.foreArm, skin, 0, 0, 0); add(e, geo.hand, skin, 0, 0, 0);
      return a;
    };
    const leg = side => {
      const l = pivot(g, side * 0.1, 0.88, 0);
      add(l, geo.thigh, pants, 0, 0, 0);
      const k = pivot(l, 0, -0.42, 0);
      add(k, geo.shin, pants, 0, 0, 0); add(k, geo.foot, mat.dark, 0, 0, 0);
      return [l, k];
    };
    const [l1, k1] = leg(-1), [l2, k2] = leg(1);
    const parts = { torso, head, a1: arm(-1), a2: arm(1), l1, l2, k1, k2, lean: torso.rotation.x, drop: Math.random() < 0.25 ? 0.7 : 0 };
    const s = 0.95 + Math.random() * 0.1; g.scale.set(s, s, s);
    return { g, parts };
  }
  return { build, sleeve: L({ color: 0x3a4038 }), skin: L({ color: 0xc09674 }) };
}

// ---------- guns ----------
// Dimensions are in view-model units (the group is scaled down in front of the camera). The gun points toward -z.
const G = {
  magnate:  { len: 0.30, rec: 0.10, h: 0.07, w: 0.045, br: 0.014, drum: 0.032, grip: 'wood', sight: 1 },
  warden:   { len: 0.80, rec: 0.26, h: 0.075, w: 0.05, br: 0.012, stock: 'wood', guard: ['wood', 0.3], mag: ['straight', 0.09, 0.05], sight: 1 },
  sawtooth: { len: 0.66, rec: 0.16, h: 0.07, w: 0.06, br: 0.015, double: 1, stock: 'wood', guard: ['wood', 0.2] },
  hornet:   { len: 0.46, rec: 0.24, h: 0.085, w: 0.05, br: 0.012, stock: 'poly', guard: ['poly', 0.16], mag: ['curved', 0.2, 0.035], grip: 'poly', sight: 1 },
  kestrel:  { len: 0.72, rec: 0.26, h: 0.08, w: 0.05, br: 0.012, stock: 'wood', guard: ['wood', 0.2], mag: ['curved', 0.24, 0.06], grip: 'wood', gas: 1, sight: 1 },
  bulldog:  { len: 0.78, rec: 0.22, h: 0.075, w: 0.05, br: 0.016, stock: 'wood', tube: 1, pump: 1, sight: 1 },
  viper:    { len: 0.34, rec: 0.26, h: 0.09, w: 0.055, br: 0.012, stock: 'fold', mag: ['grip', 0.24, 0.04], grip: 'poly', sight: 1 },
  trident:  { len: 0.82, rec: 0.28, h: 0.08, w: 0.05, br: 0.012, stock: 'poly', guard: ['poly', 0.24], mag: ['straight', 0.16, 0.06], grip: 'poly', carry: 1, sight: 1 },
  anvil:    { len: 0.86, rec: 0.34, h: 0.11, w: 0.07, br: 0.016, stock: 'poly', guard: ['steel', 0.26], mag: ['box', 0.12, 0.12], grip: 'poly', bipod: 1, sight: 1 },
  longbow:  { len: 1.05, rec: 0.36, h: 0.1, w: 0.06, br: 0.017, stock: 'poly', guard: ['steel', 0.2], mag: ['straight', 0.12, 0.1], grip: 'poly', scope: 1, bipod: 1, brake: 1 },
  reaper:   { len: 0.62, rec: 0.38, h: 0.12, w: 0.075, br: 0.02, stock: 'poly', mag: ['drum', 0.08, 0.1], grip: 'poly', carry: 1 },
  talon:    { len: 0.5, rec: 0.26, h: 0.09, w: 0.055, br: 0.012, stock: 'fold', guard: ['poly', 0.16], mag: ['curved', 0.2, 0.055], grip: 'poly', carry: 1 },
  arc:      { len: 0.5, rec: 0.3, h: 0.13, w: 0.1, br: 0.03, stock: 'poly', grip: 'poly', glow: 1 },
};
export const hasGun = id => !!G[id];
export const gunInfo = id => { const s = G[id] || { len: 0.25, h: 0.055 }; return { muzzleZ: -s.len - (s.brake ? 0.06 : 0), flashY: s.h * 0.18 }; };

let gm = null;
function gunMats(plank) {
  if (gm) return gm;
  const steelTex = tex((g, s) => { g.fillStyle = '#2b2d31'; g.fillRect(0, 0, s, s); blotch(g, s, 300, ['#000', '#8a8f98'], 0.5, 2, 0.14); g.globalAlpha = 0.25; g.fillStyle = '#9aa0aa'; for (let i = 0; i < 12; i++) g.fillRect(Math.random() * s, Math.random() * s, 10 + Math.random() * 30, 1); }, 64);
  const woodTex = tex((g, s) => { g.fillStyle = '#6a4326'; g.fillRect(0, 0, s, s); g.globalAlpha = 0.35; for (let i = 0; i < 40; i++) { g.fillStyle = Math.random() < 0.5 ? '#3d2412' : '#8a5a34'; g.fillRect(0, Math.random() * s, s, 1 + Math.random() * 2); } }, 64);
  gm = {
    steel: new THREE.MeshLambertMaterial({ map: steelTex }),
    poly: new THREE.MeshLambertMaterial({ color: 0x17181a }),
    wood: new THREE.MeshLambertMaterial({ map: woodTex }),
    brass: new THREE.MeshLambertMaterial({ color: 0x9a7a3a }),
    glow: new THREE.MeshBasicMaterial({ color: 0x57e0ff }),
    forge: new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
    lens: new THREE.MeshBasicMaterial({ color: 0x1a3550 }),
  };
  return gm;
}

export function buildGun(id, opts = {}) {
  const s = G[id], M = gunMats(), g = new THREE.Group();
  const box = (w, h, l, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; };
  const cyl = (r, l, m, x, y, z, r2 = r) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, l, 10), m); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); g.add(o); return o; };
  const { len, rec, h, w, br } = s, bl = len - rec, by = h * 0.18;
  box(w, h, rec, M.steel, 0, 0, -rec / 2);                                   // receiver
  box(w * 0.7, h * 0.18, rec * 0.9, M.poly, 0, h / 2 + h * 0.06, -rec / 2);  // top rail
  if (s.double) { cyl(br, bl, M.steel, -br, by, -rec - bl / 2); cyl(br, bl, M.steel, br, by, -rec - bl / 2); }
  else cyl(br, bl, M.steel, 0, by, -rec - bl / 2);
  if (s.tube) cyl(br * 0.85, bl * 0.8, M.steel, 0, by - br * 2.1, -rec - bl * 0.4);
  if (s.gas) cyl(br * 0.8, bl * 0.55, M.steel, 0, by + br * 2, -rec - bl * 0.3);
  if (s.pump) cyl(br * 1.9, bl * 0.3, M.wood, 0, by - br * 1.6, -rec - bl * 0.4);
  if (s.guard) { const [m, gl] = s.guard; box(w * 0.95, h * 0.8, gl, M[m], 0, by - h * 0.12, -rec - gl / 2); }
  if (s.brake) box(br * 3.4, br * 2.6, 0.07, M.steel, 0, by, -len - 0.02);
  if (s.drum) { cyl(s.drum, 0.07, M.steel, 0, by - 0.005, -rec * 0.5); }
  if (s.sight) { box(0.008, 0.028, 0.008, M.steel, 0, by + br + 0.014, -len + 0.03); box(0.03, 0.016, 0.01, M.steel, 0, h / 2 + h * 0.2, -0.04); }
  if (s.carry) { box(0.014, 0.03, rec * 0.7, M.poly, 0, h / 2 + 0.05, -rec * 0.5); box(0.014, 0.04, 0.02, M.poly, 0, h / 2 + 0.025, -rec * 0.18); box(0.014, 0.04, 0.02, M.poly, 0, h / 2 + 0.025, -rec * 0.82); }
  if (s.scope || opts.sight) {
    const sl = s.scope ? 0.3 : 0.07, sr = s.scope ? 0.024 : 0.02, sy = h / 2 + sr + 0.022, sz = -rec * 0.45;
    cyl(sr, sl, M.poly, 0, sy, sz); cyl(sr * 0.95, 0.004, M.lens, 0, sy, sz - sl / 2 - 0.002);
    box(0.012, 0.024, 0.02, M.steel, 0, sy - sr - 0.008, sz - sl * 0.3); box(0.012, 0.024, 0.02, M.steel, 0, sy - sr - 0.008, sz + sl * 0.3);
  }
  if (s.bipod) { box(0.008, 0.008, 0.2, M.steel, -0.02, by - br - 0.012, -rec - bl * 0.5); box(0.008, 0.008, 0.2, M.steel, 0.02, by - br - 0.012, -rec - bl * 0.5); }
  // grip and stock
  if (s.grip) box(w * 0.75, 0.12, 0.05, M[s.grip], 0, -h / 2 - 0.05, -0.035, 0.3);
  if (s.stock === 'wood') { box(w * 0.85, h * 0.9, 0.16, M.wood, 0, -h * 0.25, 0.07, -0.22); box(w * 0.85, h * 1.25, 0.2, M.wood, 0, -h * 0.5, 0.24, -0.1); }
  else if (s.stock === 'poly') { box(w * 0.8, h * 0.6, 0.14, M.poly, 0, 0, 0.07); box(w * 0.8, h * 1.3, 0.14, M.poly, 0, -h * 0.25, 0.2); }
  else if (s.stock === 'fold') { box(0.01, 0.012, 0.26, M.steel, w * 0.4, h * 0.15, 0.13); box(0.01, 0.012, 0.26, M.steel, -w * 0.4, h * 0.15, 0.13); box(w, h * 0.9, 0.015, M.poly, 0, -h * 0.1, 0.26); }
  // magazine
  if (s.mag) {
    const [type, ml, md] = s.mag, mz = -rec * 0.55, my = -h / 2 - ml / 2;
    if (type === 'straight') box(w * 0.6, ml, md, M.steel, 0, my, mz, 0.08);
    else if (type === 'curved') { box(w * 0.6, ml * 0.55, md, M.steel, 0, -h / 2 - ml * 0.27, mz, 0.12); box(w * 0.6, ml * 0.55, md, M.steel, 0, -h / 2 - ml * 0.72, mz - md * 0.42, 0.42); }
    else if (type === 'grip') box(w * 0.55, ml, md, M.steel, 0, -h / 2 - ml / 2, -0.04, 0.3);
    else if (type === 'box') { box(w * 1.1, ml, md, M.poly, -w * 0.75, -h * 0.3, mz); box(w * 0.5, 0.012, 0.03, M.brass, -w * 0.3, h * 0.2, mz); }
    else if (type === 'drum') { const d = new THREE.Mesh(new THREE.CylinderGeometry(md, md, ml, 14), M.poly); d.rotation.z = Math.PI / 2; d.position.set(0, -h / 2 - md * 0.8, mz); g.add(d); }
  }
  if (s.glow) { box(w * 1.1, h * 0.5, 0.1, M.glow, 0, 0, -rec); cyl(br * 0.6, bl, M.glow, 0, by, -rec - bl / 2); }
  if (opts.up) box(w * 1.04, h * 0.16, rec * 0.8, M.forge, 0, -h * 0.05, -rec / 2);
  return { g, muzzleZ: -len - (s.brake ? 0.06 : 0), flashY: by };
}
