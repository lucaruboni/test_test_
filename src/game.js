import * as THREE from '../lib/three.module.min.js';
import { CELL, WALL_H, MAP, DOORS, WEAPONS, WALLBUYS, CRATE_POOL, PERKS, CRATE_COST, FORGE_COST, MAP_OX, MAP_OY, POWERUPS } from './data.js';
import { sfx } from './audio.js';
import { saveProfile } from './save.js';
import { loadAssets } from './assets.js';
import { makeZombieKit, buildGun, hasGun } from './models.js';

const W = MAP[0].length, H = MAP.length;
const EYE = 1.7, PR = 0.4, ZR = 0.36, MAX_ALIVE = 24;
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function grain(g, w, h, base, n, a) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${Math.random() * a})` : `rgba(255,255,255,${Math.random() * a * 0.6})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
}
function labelTex(title, sub, color) {
  return canvasTex(256, 128, (g) => {
    g.fillStyle = 'rgba(8,8,10,0.9)'; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(5, 5, 246, 118);
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 34px Arial'; g.fillText(title, 128, 48, 230);
    g.font = 'bold 30px Arial'; g.fillStyle = '#fff'; g.fillText(sub, 128, 94, 230);
  });
}

export class Game {
  constructor(canvas, profile, input, hooks) {
    this.canvas = canvas; this.profile = profile; this.input = input; this.hooks = hooks;
    this.running = false; this.paused = false; this.over = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07080b);
    this.scene.fog = new THREE.FogExp2(0x07080b, 0.022);
    this.camera = new THREE.PerspectiveCamera(profile.settings.fov, 1, 0.02, 120);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
    this.hudCache = {};
    this.loop = this.loop.bind(this);
  }

  resize() {
    const q = [1, 1.5, 2][this.profile.settings.quality] || 1.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
  applySettings() { this.resize(); this.input.sens = this.profile.settings.sens; this.input.lefty = this.profile.settings.lefty; }

  // ---------- world build ----------
  async build(progress) {
    const step = async (p, label) => { progress(p, label); await new Promise(r => setTimeout(r, 30)); };
    progress(0.02, 'Downloading models and textures…');
    const A = this.assets = await loadAssets(f => progress(0.02 + f * 0.1, 'Downloading models and textures…'));
    const model = (k, scale) => { if (!A.models[k]) return null; const o = A.models[k].clone(true); o.scale.setScalar(scale); return o; };
    await step(0.14, 'Securing the station…');
    this.solid = new Uint8Array(W * H);
    this.pblock = new Uint8Array(W * H); this.nook = new Uint8Array(W * H);
    this.windows = []; this.winAt = {}; this.pads = {}; this.perkLights = []; this.perkBodies = []; this.drops = [];
    this.power = false; this.tpCd = 0; this.buff = { insta: 0, double: 0 }; this.dropsLeft = 4;
    this.dist = new Int16Array(W * H).fill(-1);
    this.queue = new Int32Array(W * H);
    this.spawns = []; this.inter = []; this.doors = {}; this.cratePts = [];
    const cx = c => (c + 0.5) * CELL, cz = r => (r + 0.5) * CELL;
    const isFloor = (c, r) => c >= 0 && r >= 0 && c < W && r < H && '.PTt'.includes(MAP[r][c]);

    const wallTex = canvasTex(128, 128, (g, w, h) => {
      grain(g, w, h, '#4a4640', 1400, 0.25);
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2;
      for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 32 % 2) * 32; x < w; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } }
      g.fillStyle = 'rgba(20,10,5,0.35)'; g.fillRect(0, h - 22, w, 22);
    });
    const floorTex = canvasTex(128, 128, (g, w, h) => {
      grain(g, w, h, '#35322e', 1800, 0.3);
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
    }, [W, H]);
    const doorTex = canvasTex(128, 128, (g, w, h) => {
      grain(g, w, h, '#5a3d22', 1200, 0.3);
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3;
      for (let x = 0; x < w; x += 26) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      g.strokeStyle = '#8a1c14'; g.lineWidth = 10; g.beginPath(); g.moveTo(10, 10); g.lineTo(118, 118); g.moveTo(118, 10); g.lineTo(10, 118); g.stroke();
    });
    this.mats = {
      wall: new THREE.MeshLambertMaterial(A.tex.wall ? { map: A.tex.wall, normalMap: A.tex.wallN || null, color: 0xb9b2aa } : { map: wallTex }),
      floor: new THREE.MeshLambertMaterial(A.tex.floor ? { map: A.tex.floor, normalMap: A.tex.floorN || null } : { map: floorTex }),
      ceil: new THREE.MeshLambertMaterial({ color: 0x1c1b1a }),
      door: new THREE.MeshLambertMaterial({ map: doorTex }),
      dark: new THREE.MeshLambertMaterial({ color: 0x1d1f24 }),
      metal: new THREE.MeshLambertMaterial({ color: 0x3a3d44 }),
      crate: new THREE.MeshLambertMaterial({ color: 0x4d3a22 }),
      crateOn: new THREE.MeshLambertMaterial({ color: 0x8a6a2a, emissive: 0x3a2a00 }),
      plank: new THREE.MeshLambertMaterial(A.tex.plank ? { map: A.tex.plank } : { map: doorTex, color: 0xc9b08a }),
    };
    if (A.tex.wall) { A.tex.wall.repeat.set(1, 1.6); if (A.tex.wallN) A.tex.wallN.repeat.set(1, 1.6); }
    if (A.tex.floor) { A.tex.floor.repeat.set(W * 0.6, H * 0.6); if (A.tex.floorN) A.tex.floorN.repeat.set(W * 0.6, H * 0.6); }
    await step(0.3, 'Raising the walls…');

    const walls = [];
    const plankGeo = new THREE.BoxGeometry(CELL * 0.98, 0.3, 0.07);
    const box = new THREE.BoxGeometry(CELL, WALL_H, CELL);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const ch = MAP[r][c], i = r * W + c, x = cx(c), z = cz(r);
      if (ch === '#') { this.solid[i] = 1; walls.push([x, z]); }
      else if (ch === 'z') { this.spawns.push({ x, z, i }); this.nook[i] = 1; }
      else if (ch === 'w') {
        // barricaded window: zombies pass once the boards are gone, the player never does
        this.pblock[i] = 1;
        const horiz = MAP[r][c - 1] !== '.' && MAP[r][c + 1] !== '.' && (MAP[r][c - 1] === '#' || MAP[r][c + 1] === '#') && !(MAP[r][c - 1] === 'z' || MAP[r][c + 1] === 'z');
        const lint = new THREE.Mesh(new THREE.BoxGeometry(CELL, 1.1, CELL), this.mats.wall); lint.position.set(x, WALL_H - 0.55, z); this.scene.add(lint);
        const meshes = [];
        for (let b = 0; b < 6; b++) {
          const m = new THREE.Mesh(plankGeo, this.mats.plank);
          m.position.set(x + (horiz ? 0 : (b % 2 ? 0.1 : -0.1)), 0.32 + b * 0.47, z + (horiz ? (b % 2 ? 0.1 : -0.1) : 0));
          m.rotation.set(0, horiz ? 0 : Math.PI / 2, (Math.random() - 0.5) * 0.2); this.scene.add(m); meshes.push(m);
        }
        const win = { type: 'window', x, z, i, r: CELL / 2 + 1.45, boards: 6, meshes };
        this.windows.push(win); this.winAt[i] = win; this.inter.push(win);
      } else if (ch === 'L') {
        this.solid[i] = 1; walls.push([x, z]);
        const dir = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dz]) => isFloor(c + dx, r + dz)) || [0, 1];
        const g = new THREE.Group(); g.position.set(x + dir[0] * (CELL / 2 + 0.07), 1.5, z + dir[1] * (CELL / 2 + 0.07)); g.rotation.y = Math.atan2(dir[0], dir[1]);
        const pb = model('powerbox', 1.9);
        if (pb) { pb.position.z = 0.02; g.add(pb); } else g.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.12), this.mats.metal));
        this.leverArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08).translate(0, 0.25, 0), new THREE.MeshLambertMaterial({ color: 0xb02a20 }));
        this.leverArm.position.set(pb ? 0.5 : 0, pb ? -0.2 : 0, 0.08); this.leverArm.rotation.x = 0.7; g.add(this.leverArm);
        this.leverLamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); this.leverLamp.position.set(pb ? 0.5 : 0, pb ? 0.4 : 0.55, 0.05); g.add(this.leverLamp);
        this.scene.add(g);
        this.inter.push({ type: 'power', x: g.position.x, z: g.position.z, r: 2 });
      } else if (ch === 'T' || ch === 't') {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 24), new THREE.MeshBasicMaterial({ color: 0x1c2a30 })); m.position.set(x, 0.04, z); this.scene.add(m);
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, WALL_H, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x57e0ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
        ring.position.set(x, WALL_H / 2, z); ring.visible = false; this.scene.add(ring);
        this.pads[ch] = { x, z, m, ring };
        this.inter.push({ type: 'tp', x, z, r: 1.5, to: ch === 'T' ? 't' : 'T' });
      } else if (ch === 'U') {
        this.solid[i] = 1;
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.2, 1.9), this.mats.metal); body.position.y = 1.1; g.add(body);
        const core = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.5, 1.95), new THREE.MeshBasicMaterial({ color: 0xff8a2a })); core.position.y = 1.2; g.add(core);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 2), new THREE.MeshBasicMaterial({ map: labelTex('REFORGE', '$' + FORGE_COST, '#ff8a2a') })); sign.position.y = 2.6; g.add(sign);
        g.position.set(x, 0, z); this.scene.add(g);
        const l = new THREE.PointLight(0xff8a2a, 14, 14, 1.5); l.position.set(x + 1.6, 2.6, z); this.scene.add(l);
        this.inter.push({ type: 'forge', x, z, r: CELL / 2 + 1.5 });
      }
      else if (ch === 'P') this.spawnPt = { x, z };
      else if (DOORS[ch]) {
        this.solid[i] = 1;
        const m = new THREE.Mesh(box, this.mats.door); m.position.set(x, WALL_H / 2, z); this.scene.add(m);
        const it = { type: 'door', id: ch, x, z, r: CELL / 2 + 1.5, cost: DOORS[ch], cells: [i], meshes: [m] };
        this.doors[ch] = it; this.inter.push(it);
      } else if (WALLBUYS[ch]) {
        this.solid[i] = 1; walls.push([x, z]);
        const wid = WALLBUYS[ch], def = WEAPONS[wid];
        const mat = new THREE.MeshBasicMaterial({ map: labelTex(def.name, '$' + def.cost, '#e8e2c8'), transparent: true });
        const geo = new THREE.PlaneGeometry(1.9, 0.95);
        [[1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2], [0, 1, 0], [0, -1, Math.PI]].forEach(([dx, dz, ry]) => {
          if (!isFloor(c + dx, r + dz)) return;
          const p = new THREE.Mesh(geo, mat); p.position.set(x + dx * (CELL / 2 + 0.02), 1.6, z + dz * (CELL / 2 + 0.02)); p.rotation.y = ry; this.scene.add(p);
        });
        this.inter.push({ type: 'wall', wid, x, z, r: CELL / 2 + 1.5 });
      } else if (PERKS[ch]) {
        this.solid[i] = 1;
        const pk = PERKS[ch];
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.5, 1.7), new THREE.MeshLambertMaterial({ color: pk.color, emissive: pk.color, emissiveIntensity: pk.id === 'wind' ? 0.3 : 0.03 }));
        if (pk.id !== 'wind') this.perkBodies.push(body);
        body.position.y = 1.25; g.add(body);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 1.9), new THREE.MeshBasicMaterial({ map: labelTex(pk.name, '$' + pk.cost, pk.color) }));
        sign.position.y = 2.9; g.add(sign);
        g.position.set(x, 0, z); this.scene.add(g);
        const l = new THREE.PointLight(pk.color, pk.id === 'wind' ? 6 : 0, 9, 1.6); l.position.set(x, 3.2, z); this.scene.add(l);
        if (pk.id !== 'wind') this.perkLights.push(l);
        this.inter.push({ type: 'perk', perk: pk, x, z, r: CELL / 2 + 1.5 });
      } else if (ch === 'X') {
        this.solid[i] = 1;
        const cm = model('crate', 1.65);
        const m = cm || new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 1.3), this.mats.crate); m.position.set(x, cm ? 0 : 0.45, z);
        if (!isFloor(c - 1, r) && !isFloor(c + 1, r)) m.rotation.y = Math.PI / 2;
        this.scene.add(m);
        const it = { type: 'crate', x, z, r: CELL / 2 + 1.5, mesh: m };
        this.cratePts.push(it); this.inter.push(it);
      }
    }
    const inst = new THREE.InstancedMesh(box, this.mats.wall, walls.length);
    const mtx = new THREE.Matrix4();
    walls.forEach(([x, z], n) => { mtx.makeTranslation(x, WALL_H / 2, z); inst.setMatrixAt(n, mtx); });
    this.scene.add(inst);
        await step(0.5, 'Lighting the lamps…');

    const plane = new THREE.PlaneGeometry(W * CELL, H * CELL);
    const floor = new THREE.Mesh(plane, this.mats.floor); floor.rotation.x = -Math.PI / 2; floor.position.set(W * CELL / 2, 0, H * CELL / 2); this.scene.add(floor);
    const ceil = new THREE.Mesh(plane, this.mats.ceil); ceil.rotation.x = Math.PI / 2; ceil.position.set(W * CELL / 2, WALL_H, H * CELL / 2); this.scene.add(ceil);
    this.scene.add(new THREE.AmbientLight(0x8a90a8, 1.5));
    this.scene.add(new THREE.HemisphereLight(0x9aa4c0, 0x3a2a20, 0.7));
    [[3, 3, 0xffc890], [3, 10.5, 0xffd9a0], [10, 3.5, 0xa8c0ff], [18, 10, 0xa8c0ff], [14, 8, 0xffb070], [27, 3.5, 0xffc890], [27, 10.5, 0xff9a80], [14, 16.5, 0xffb070]].forEach(([c0, r0, col]) => {
      const c = c0 + MAP_OX, r = r0 + MAP_OY;
      const l = new THREE.PointLight(col, 22, 22, 1.5); l.position.set(cx(c), WALL_H - 0.5, cz(r)); this.scene.add(l);
      const bulb = model('lamp', 1) || new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: col })); bulb.position.copy(l.position); bulb.position.y = bulb.isMesh ? WALL_H - 0.15 : WALL_H; this.scene.add(bulb);
      if (!bulb.isMesh) l.position.y = WALL_H - 1.5;
    });

    // mystery crate: light beam + floating weapon
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, WALL_H, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x6fc7ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    this.scene.add(this.beam);
    this.floatGun = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.12), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
    this.floatGun.visible = false; this.scene.add(this.floatGun);
    this.crate = { state: 'idle', t: 0, uses: 0, offer: null, at: null };
    this.setCrate(this.cratePts[1 + Math.floor(Math.random() * (this.cratePts.length - 1))]);
    await step(0.7, 'Waking the dead…');

    // zombies: shared geometry and materials
    this.zkit = makeZombieKit();
    this.zombies = [];
    // blood particles
    this.parts = [];
    const pg = new THREE.BoxGeometry(0.07, 0.07, 0.07), pm = new THREE.MeshBasicMaterial({ color: 0x8a0f0a });
    for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(pg, pm); m.visible = false; this.scene.add(m); this.parts.push({ m, life: 0, vx: 0, vy: 0, vz: 0 }); }
    this.partI = 0;
    this.tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.7 }));
    this.tracer.frustumCulled = false; this.tracer.visible = false; this.scene.add(this.tracer);
    await step(0.85, 'Loading weapons…');

    // player
    this.p = {
      x: this.spawnPt.x, z: this.spawnPt.z, y: 0, vy: 0, vx: 0, vz: 0, yaw: 0, pitch: 0,
      hp: 100, maxHp: 100, lastHit: 99, points: 500, perks: new Set(), windUses: 0,
      inv: [], cur: 0, fireCd: 0, reloadT: 0, swapT: 0, knifeCd: 0, stamina: 1, downT: 0, invuln: 0,
      recoil: 0, kickZ: 0, bob: 0, adsK: 0, prevFire: false, repairCd: 0,
    };
    this.vm = new THREE.Group(); this.vm.scale.setScalar(0.3); this.camera.add(this.vm);
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.95, depthWrite: false }));
    this.flash.visible = false;
    this.giveWeapon(this.profile.starter);
    this.round = 0; this.toSpawn = 0; this.spawnT = 0; this.phase = 'inter'; this.phaseT = 4;
    this.stats = { kills: 0, heads: 0, xp: 0, points: 500, round: 0 };
    this.aimHit = null; this.autoT = 0; this.closeZ = null; this.killT = 0; this.dmgT = 0; this.fieldT = 0; this.groanT = 3; this.msgT = 0; this.flashT = 0; this.tracerT = 0; this.hitT = 0;
    this.applySettings();
    this.computeField();
    this.renderer.compile(this.scene, this.camera);
    await step(1, 'Ready');
  }

  // ---------- grid helpers ----------
  cell(x, z) { const c = Math.floor(x / CELL), r = Math.floor(z / CELL); return (c < 0 || r < 0 || c >= W || r >= H) ? -1 : r * W + c; }
  solidAt(x, z) { const i = this.cell(x, z); return i < 0 || this.solid[i] === 1; }
  collide(o, rad, player) {
    const c0 = Math.floor((o.x - rad) / CELL), c1 = Math.floor((o.x + rad) / CELL), r0 = Math.floor((o.z - rad) / CELL), r1 = Math.floor((o.z + rad) / CELL);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (c >= 0 && r >= 0 && c < W && r < H && !this.solid[r * W + c] && !(player && this.pblock[r * W + c])) continue;
      const nx = clamp(o.x, c * CELL, (c + 1) * CELL), nz = clamp(o.z, r * CELL, (r + 1) * CELL);
      const dx = o.x - nx, dz = o.z - nz, d2 = dx * dx + dz * dz;
      if (d2 < rad * rad) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (rad - d) / d; o.x += dx * k; o.z += dz * k; }
        else { o.x = this.lastSafe ? this.lastSafe.x : o.x; o.z = this.lastSafe ? this.lastSafe.z : o.z; }
      }
    }
  }
  computeField() {
    const d = this.dist, q = this.queue; d.fill(-1);
    const s = this.cell(this.p.x, this.p.z); if (s < 0) return;
    let h = 0, t = 0; q[t++] = s; d[s] = 0;
    while (h < t) {
      const i = q[h++], c = i % W, nd = d[i] + 1;
      if (c > 0 && !this.solid[i - 1] && d[i - 1] < 0) { d[i - 1] = nd; q[t++] = i - 1; }
      if (c < W - 1 && !this.solid[i + 1] && d[i + 1] < 0) { d[i + 1] = nd; q[t++] = i + 1; }
      if (i >= W && !this.solid[i - W] && d[i - W] < 0) { d[i - W] = nd; q[t++] = i - W; }
      if (i < W * (H - 1) && !this.solid[i + W] && d[i + W] < 0) { d[i + W] = nd; q[t++] = i + W; }
    }
  }
  los(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz), n = Math.ceil(d / 0.5);
    for (let i = 1; i < n; i++) { const ci = this.cell(x0 + dx * i / n, z0 + dz * i / n); if (ci < 0 || this.solid[ci] || this.pblock[ci]) return false; }
    return true;
  }

  // ---------- weapons ----------
  weaponDef(id, up) {
    const d = { ...WEAPONS[id], id, head: 2, adsZoom: 0.75, adsMove: 0.55 };
    const att = (this.profile.weapons[id] && this.profile.weapons[id].att) || [];
    if (att.includes('extmag')) d.mag = Math.ceil(d.mag * 1.35);
    if (att.includes('grip')) { d.spread *= 0.6; d.kick *= 0.7; }
    if (att.includes('fastmag')) d.reload *= 0.72;
    if (att.includes('sight')) d.adsZoom = 0.55;
    if (att.includes('barrel')) d.dmg *= 1.15;
    if (att.includes('stock')) d.adsMove = 1;
    if (att.includes('fmj')) d.head = 2.6;
    if (d.cls === 'sniper') d.adsZoom = 0.3;
    if (up) { d.up = true; d.name += ' Mk II'; d.dmg *= 2.2; d.mag = Math.min(Math.ceil(d.mag * 1.5), d.mag + 40); d.reserve = Math.round(d.reserve * 1.5); d.reload *= 0.9; }
    return d;
  }
  get weapon() { return this.p.inv[this.p.cur]; }
  has(id) { return this.p.inv.find(w => w.id === id); }
  giveWeapon(id) {
    const p = this.p, def = this.weaponDef(id), w = { id, def, mag: def.mag, reserve: def.reserve };
    const max = p.perks.has('pack') ? 3 : 2;
    if (p.inv.length < max) { p.inv.push(w); p.cur = p.inv.length - 1; } else p.inv[p.cur] = w;
    p.reloadT = 0; p.swapT = 0.35; this.buildViewModel();
  }
  buildViewModel() {
    const vm = this.vm; while (vm.children.length) vm.remove(vm.children[0]);
    const w = this.weapon; if (!w) return;
    const dims = { pistol: [0.05, 0.08, 0.24], smg: [0.06, 0.1, 0.4], ar: [0.06, 0.1, 0.62], shotgun: [0.07, 0.09, 0.72], lmg: [0.09, 0.13, 0.74], sniper: [0.06, 0.09, 0.9], energy: [0.1, 0.13, 0.5] }[w.def.cls];
    const [bw, bh, bl] = dims, M = this.mats;
    const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); vm.add(o); return o; };
    // real model when one is loaded for this weapon class
    const cls = w.def.cls, src = hasGun(w.id) ? null : this.assets.models.pistol;
    const sleeve = () => {
      const a = add(new THREE.CapsuleGeometry(0.05, 0.42, 3, 8), this.zkit.sleeve, 0.035, -0.15, 0.3); a.rotation.set(Math.PI / 2 - 0.2, 0, 0.1);
      add(new THREE.SphereGeometry(0.04, 8, 6), this.zkit.skin, 0.012, -0.105, 0.02).scale.set(0.9, 1.15, 1.1);
    };
    if (hasGun(w.id)) {
      const b = buildGun(w.id, { up: w.def.up, sight: (this.profile.weapons[w.id].att || []).includes('sight') });
      vm.add(b.g); sleeve();
      this.flash.position.set(0, b.flashY, b.muzzleZ - 0.06); vm.add(this.flash);
      this.muzzleZ = b.muzzleZ;
      return;
    }
    if (src) {
      const g = src.clone(true), pistol = cls === 'pistol', sc = pistol ? 1.5 : cls === 'smg' ? 0.5 : cls === 'sniper' ? 0.72 : 0.62;
      g.scale.setScalar(sc); g.rotation.y = Math.PI / 2;
      g.position.set(0, pistol ? -0.1 : -0.05, pistol ? -0.02 : -0.38 * sc / 0.62 + 0.05);
      if (w.def.up) g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); if (o.material.emissive) o.material.emissive.set(0x4a2200); } });
      vm.add(g);
      const mz = pistol ? -0.3 : -0.76 * sc / 0.62;
      sleeve();
      this.flash.position.set(0, 0.01, mz - 0.06); vm.add(this.flash);
      this.muzzleZ = mz;
      return;
    }
    add(new THREE.BoxGeometry(bw, bh, bl), M.dark, 0, 0, -bl / 2);
    add(new THREE.BoxGeometry(bw * 0.5, bh * 0.45, bl * 0.35), M.metal, 0, bh * 0.1, -bl - bl * 0.15);
    add(new THREE.BoxGeometry(bw * 0.8, 0.13, 0.06), M.dark, 0, -bh / 2 - 0.05, -0.03).rotation.x = 0.25;
    if (w.def.cls !== 'pistol') add(new THREE.BoxGeometry(bw * 0.7, w.def.cls === 'lmg' ? 0.14 : 0.16, w.def.cls === 'lmg' ? 0.16 : 0.06), M.metal, 0, -bh / 2 - 0.07, -bl * 0.45);
    if (w.def.cls !== 'pistol') add(new THREE.BoxGeometry(bw * 0.8, bh * 0.8, 0.2), M.dark, 0, -0.01, 0.1);
    add(new THREE.BoxGeometry(0.012, 0.03, 0.012), M.metal, 0, bh / 2 + 0.012, -bl + 0.02);
    if ((this.profile.weapons[w.id].att || []).includes('sight')) add(new THREE.BoxGeometry(0.04, 0.045, 0.06), M.metal, 0, bh / 2 + 0.03, -bl * 0.35);
    if (w.def.up) add(new THREE.BoxGeometry(bw * 1.06, bh * 0.22, bl * 0.7), new THREE.MeshBasicMaterial({ color: 0xff8a2a }), 0, 0, -bl * 0.5);
    if (w.def.cls === 'energy') add(new THREE.BoxGeometry(bw * 1.1, bh * 0.5, 0.1), new THREE.MeshBasicMaterial({ color: 0x57e0ff }), 0, 0, -bl);
    // arm
    add(new THREE.BoxGeometry(0.09, 0.09, 0.5), this.zkit.sleeve, 0.03, -0.12, 0.25).rotation.y = -0.12;
    this.flash.position.set(0, bh * 0.1, -bl - bl * 0.35 - 0.05); vm.add(this.flash);
    this.muzzleZ = -bl * 1.35;
  }
  startReload() {
    const p = this.p, w = this.weapon;
    if (p.reloadT > 0 || p.swapT > 0 || w.mag >= w.def.mag || w.reserve <= 0) return;
    p.reloadT = w.def.reload * (p.perks.has('hands') ? 0.5 : 1); sfx('reload');
  }
  swap() {
    const p = this.p; if (p.inv.length < 2 || p.swapT > 0) return;
    p.cur = (p.cur + 1) % p.inv.length; p.reloadT = 0; p.swapT = 0.4; this.buildViewModel();
  }
  shoot() {
    const p = this.p, w = this.weapon, d = w.def, twin = p.perks.has('twin');
    if (w.mag <= 0) { if (w.reserve > 0) this.startReload(); else if (!p.prevFire) sfx('empty'); return; }
    w.mag--; p.fireCd = 60 / (d.rpm * (twin ? 1.3 : 1));
    sfx(d.cls);
    p.recoil += d.kick; p.kickZ = Math.min(0.12, p.kickZ + 0.05 + d.kick);
    this.flash.visible = true; this.flash.rotation.z = Math.random() * 6.28; this.flashT = 0.05;
    const cam = this.camera, o = cam.position;
    const moving = Math.hypot(p.vx, p.vz) > 1 ? 1.5 : 1;
    const spread = d.spread * (p.adsK > 0.6 && d.pellets === 1 ? 0.3 : 1) * moving;
    const fwd = new THREE.Vector3(), dir = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
    cam.getWorldDirection(fwd); right.crossVectors(fwd, cam.up).normalize(); up.crossVectors(right, fwd);
    const hitZ = new Set(); let anyHit = false, endPt = null;
    const assist = this.input.isTouch ? 1.25 : 1;
    for (let n = 0; n < d.pellets; n++) {
      const a = Math.random() * 6.283, s = Math.sqrt(Math.random()) * spread;
      dir.copy(fwd).addScaledVector(right, Math.cos(a) * s).addScaledVector(up, Math.sin(a) * s).normalize();
      let tWall = 80;
      for (let t = 0.2; t < 80; t += 0.2) { const y = o.y + dir.y * t; if (y < 0 || y > WALL_H || this.solidAt(o.x + dir.x * t, o.z + dir.z * t)) { tWall = t; break; } }
      // hits resolve nearest first; heavy rifles pierce
      let pierce = d.cls === 'sniper' ? 4 : d.cls === 'lmg' ? 2 : 1, dmgK = 1;
      const hits = [];
      for (const z of this.zombies) { if (z.state === 'dead') continue; const h = this.rayZombie(o, dir, z, assist); if (h && h.t < tWall) hits.push([h, z]); }
      hits.sort((A, B) => A[0].t - B[0].t);
      let tEnd = tWall;
      for (const [h, z] of hits) {
        if (pierce-- <= 0) break;
        let dmg = d.dmg * dmgK * (h.head ? d.head : 1) * (twin ? 2 : 1);
        if (d.pellets > 1) dmg *= clamp(1.25 - h.t / 14, 0.25, 1);
        if (!d.splash) this.hurt(z, dmg, h.head, w.id, false, hitZ);
        this.blood(o.x + dir.x * h.t, o.y + dir.y * h.t, o.z + dir.z * h.t);
        anyHit = true; dmgK *= 0.7; if (pierce <= 0) tEnd = h.t;
      }
      if (d.splash) {
        const ex = o.x + dir.x * tEnd, ez = o.z + dir.z * tEnd;
        for (const z of this.zombies) if (z.state !== 'dead' && Math.hypot(z.x - ex, z.z - ez) < d.splash) { this.hurt(z, d.dmg * (twin ? 2 : 1), false, w.id, false, hitZ); anyHit = true; }
        for (let i = 0; i < 8; i++) this.blood(ex, o.y + dir.y * tEnd, ez, 0x57e0ff);
      }
      if (n === 0) endPt = [o.x + dir.x * tEnd, o.y + dir.y * tEnd, o.z + dir.z * tEnd];
    }
    if (endPt) {
      const mz = new THREE.Vector3(0, 0, this.muzzleZ); this.vm.localToWorld(mz);
      const pos = this.tracer.geometry.attributes.position;
      pos.setXYZ(0, mz.x, mz.y, mz.z); pos.setXYZ(1, endPt[0], endPt[1], endPt[2]); pos.needsUpdate = true;
      this.tracer.material.color.set(d.cls === 'energy' ? 0x57e0ff : 0xffe9a8);
      this.tracer.visible = true; this.tracerT = d.cls === 'energy' ? 0.12 : 0.04;
    }
    if (anyHit) { this.hitT = 0.12; sfx('hit'); }
    if (w.mag === 0 && w.reserve > 0) this.startReload();
  }
  rayZombie(o, d, z, k) {
    let best = null;
    const ox = o.x - z.x, oz = o.z - z.z, oy = o.y - (z.y + 1.63), hr = 0.3 * k;
    if (!z.headless) {
      const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - hr * hr, disc = b * b - c;
      if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0) best = { t, head: true }; }
    }
    const a = d.x * d.x + d.z * d.z;
    if (a > 1e-6) {
      const br = 0.36 * k, bb = ox * d.x + oz * d.z, cc = ox * ox + oz * oz - br * br, dd = bb * bb - a * cc;
      if (dd >= 0) { const t = (-bb - Math.sqrt(dd)) / a; if (t > 0) { const y = o.y + d.y * t; if (y >= z.y && y <= z.y + 1.48 && (!best || t < best.t)) best = { t, head: false }; } }
    }
    return best;
  }
  knife() {
    const p = this.p; if (p.knifeCd > 0 || p.reloadT > 0) return;
    p.knifeCd = 0.7; p.kickZ = -0.12; sfx('knife');
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let best = null, bd = 2.1;
    for (const z of this.zombies) {
      if (z.state === 'dead') continue;
      const dx = z.x - p.x, dz = z.z - p.z, d = Math.hypot(dx, dz);
      if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.45) { best = z; bd = d; }
    }
    if (best) { this.hurt(best, 150, false, null, true, new Set()); this.blood(best.x, 1.3, best.z); this.hitT = 0.12; sfx('hit'); }
  }
  blood(x, y, z, color) {
    for (let i = 0; i < 3; i++) {
      const pt = this.parts[this.partI++ % this.parts.length];
      pt.m.position.set(x, y, z); pt.m.visible = true; pt.life = 0.45;
      pt.vx = rand(-2, 2); pt.vy = rand(0.5, 3); pt.vz = rand(-2, 2);
    }
  }
  addPoints(n) {
    if (this.buff.double > 0) n *= 2;
    this.p.points += n; this.stats.points += n;
    const box = $('hud-pop'); if (box.childElementCount > 6) box.firstChild.remove();
    const el = document.createElement('span'); el.textContent = '+' + n; el.style.setProperty('--dx', (Math.random() * 40 - 10).toFixed(0) + 'px');
    box.appendChild(el); setTimeout(() => el.remove(), 900);
  }
  addXp(n, wid) {
    this.profile.xp += n; this.stats.xp += n;
    if (wid && this.profile.weapons[wid]) this.profile.weapons[wid].xp += n;
  }
  hurt(z, dmg, head, wid, knife, hitSet) {
    if (z.state === 'dead') return;
    if (!hitSet.has(z)) { hitSet.add(z); this.addPoints(10); }
    if (this.buff.insta > 0) dmg = z.hp;
    z.hp -= dmg; z.stun = 0.12;
    if (z.hp > 0) return;
    z.state = 'dead'; z.t = 0;
    if (head) { z.headless = true; z.parts.head.visible = false; this.stats.heads++; }
    this.stats.kills++;
    this.addPoints(knife ? 120 : head ? 90 : 50);
    this.addXp(head ? 15 : 10, wid);
    this.killT = 0.25; sfx('kill');
    const zi = this.cell(z.x, z.z);
    if (this.dropsLeft > 0 && zi >= 0 && !this.nook[zi] && !this.pblock[zi] && Math.random() < 0.035) { this.dropsLeft--; this.dropPower(z.x, z.z); }
  }

  // ---------- zombies ----------
  spawnZombie() {
    const p = this.p;
    let c = this.spawns.filter(s => this.dist[s.i] >= 0 && Math.hypot(s.x - p.x, s.z - p.z) > 6);
    if (!c.length) c = this.spawns.filter(s => this.dist[s.i] >= 0);
    if (!c.length) return false;
    c.sort((a, b) => this.dist[a.i] - this.dist[b.i]);
    const s = c[Math.floor(Math.random() * Math.min(c.length, 4))];
    const r = this.round;
    const { g, parts } = this.zkit.build();
    this.scene.add(g);
    const hp = r < 10 ? 130 + 95 * (r - 1) : (130 + 95 * 8) * Math.pow(1.1, r - 9);
    const speed = Math.min(6.4, 1.5 + r * 0.22 + Math.random() * Math.min(2.4, 0.4 + r * 0.25));
    const z = { x: s.x + rand(-0.6, 0.6), z: s.z + rand(-0.6, 0.6), y: -1.8, hp, speed, state: 'rise', t: 0, atk: 0.5, stun: 0, g, parts, ph: Math.random() * 6, ox: rand(-0.7, 0.7), oz: rand(-0.7, 0.7), face: 0, headless: false };
    g.position.set(z.x, z.y, z.z);
    this.zombies.push(z);
    return true;
  }
  updateZombies(dt) {
    const p = this.p, zs = this.zombies, down = p.downT > 0;
    for (let n = zs.length - 1; n >= 0; n--) {
      const z = zs[n];
      if (z.state === 'dead') {
        z.t += dt;
        z.g.rotation.x = -Math.min(1.5, z.t * 5);
        if (z.t > 1.2) z.g.position.y = -(z.t - 1.2) * 0.8;
        if (z.t > 2.2) { this.scene.remove(z.g); zs.splice(n, 1); }
        continue;
      }
      if (z.state === 'rise') {
        z.t += dt; z.y = -1.8 * (1 - Math.min(1, z.t / 1.4));
        if (z.t >= 1.4) { z.state = 'chase'; z.y = 0; }
      } else {
        let tx = p.x, tz = p.z;
        const dp = Math.hypot(p.x - z.x, p.z - z.z);
        const ci = this.cell(z.x, z.z), d = ci >= 0 ? this.dist[ci] : -1;
        // player unreachable (teleported away): go back into the spawn queue
        if (d < 0) { z.lost = (z.lost || 0) + dt; if (z.lost > 2) { this.scene.remove(z.g); zs.splice(n, 1); if (this.phase === 'active') this.toSpawn++; continue; } } else z.lost = 0;
        const wn = this.winAt[ci]; let hold = false;
        if (wn && wn.boards > 0) {
          hold = true;
          if (!z.held) { z.held = true; z.hx = z.x; z.hz = z.z; z.tear = 1.3; } else { z.x = z.hx; z.z = z.hz; }
          z.tear -= dt;
          if (z.tear <= 0) { z.tear = 1.3; wn.boards--; wn.meshes[wn.boards].visible = false; sfx('deny'); }
        } else z.held = false;
        if (d > 1 && !(dp < 7 && this.los(z.x, z.z, p.x, p.z))) {
          let bi = -1, bd = d; const c = ci % W, r = (ci / W) | 0;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= W || rr >= H) continue;
            const ni = rr * W + cc, nd = this.dist[ni]; if (nd < 0 || nd >= bd) continue;
            if (dr && dc && (this.solid[r * W + cc] || this.solid[rr * W + c])) continue;
            bd = nd; bi = ni;
          }
          if (bi >= 0) { tx = (bi % W + 0.5) * CELL + z.ox; tz = (((bi / W) | 0) + 0.5) * CELL + z.oz; }
        }
        let dx = tx - z.x, dz = tz - z.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
        z.stun = Math.max(0, z.stun - dt);
        const sp = down || hold ? 0 : z.speed * (z.stun > 0 ? 0.35 : 1);
        if (dp > 0.95) { z.x += dx * sp * dt; z.z += dz * sp * dt; z.ph += sp * dt * 2.6; }
        z.face = Math.atan2(dx, dz);
        if (dp < 1.3 && !down) {
          z.atk -= dt;
          if (z.atk <= 0) { z.atk = 1.05; this.damagePlayer(50, z); }
        } else z.atk = Math.max(z.atk, 0.4);
        // separation from other zombies
        for (let m = 0; m < n; m++) {
          const o = zs[m]; if (o.state !== 'chase') continue;
          const ex = z.x - o.x, ez = z.z - o.z, e2 = ex * ex + ez * ez;
          if (e2 < 0.49 && e2 > 1e-6) { const e = Math.sqrt(e2), k = (0.7 - e) / e * 0.5; z.x += ex * k; z.z += ez * k; o.x -= ex * k; o.z -= ez * k; }
        }
        if (dp < 0.8 && dp > 1e-4) { const k = (0.8 - dp) / dp; z.x -= (p.x - z.x) * k; z.z -= (p.z - z.z) * k; }
        this.collide(z, ZR);
      }
      const g = z.g, P = z.parts;
      g.position.set(z.x, z.y, z.z);
      let df = z.face - g.rotation.y; while (df > Math.PI) df -= 6.283; while (df < -Math.PI) df += 6.283;
      g.rotation.y += df * Math.min(1, dt * 8);
      const s = Math.sin(z.ph);
      // shambling walk: hips swing, the trailing knee bends, arms reach and lunge on attack
      P.l1.rotation.x = -s * 0.55; P.l2.rotation.x = s * 0.55;
      P.k1.rotation.x = Math.max(0, -s) * 0.9 + 0.08; P.k2.rotation.x = Math.max(0, s) * 0.9 + 0.08;
      const reach = (z.atk < 0.4 ? -2.0 + z.atk * 2 : -1.25) - P.lean;
      P.a1.rotation.x = reach + s * 0.14 + P.drop; P.a2.rotation.x = reach - s * 0.14;
      P.a1.rotation.z = 0.12; P.a2.rotation.z = -0.12;
      P.torso.rotation.z = s * 0.07; P.torso.rotation.x = P.lean + Math.abs(s) * 0.05; P.head.rotation.z = -s * 0.12;
    }
  }
  damagePlayer(n, from) {
    const p = this.p; if (p.invuln > 0 || p.downT > 0 || this.over) return;
    p.hp -= n; p.lastHit = 0; sfx('hurt');
    if (from) { this.dmgFrom = { x: from.x, z: from.z }; this.dmgT = 1.1; }
    if (p.hp > 0) return;
    if (p.perks.has('wind')) {
      p.downT = 5; p.hp = 1; p.perks.clear(); p.inv.length = Math.min(p.inv.length, 2); p.cur = Math.min(p.cur, p.inv.length - 1);
      p.maxHp = 100; this.buildViewModel(); sfx('down'); this.message('DOWNED — Second Wind is getting you up…', 4.5);
    } else this.gameOver();
  }
  gameOver() {
    this.over = true; this.running = false; sfx('down');
    const b = this.profile.best; b.round = Math.max(b.round, this.round); b.kills = Math.max(b.kills, this.stats.kills);
    saveProfile(this.profile);
    this.stats.round = this.round;
    this.hooks.onEnd(this.stats);
  }

  // ---------- interactions ----------
  setCrate(it) {
    if (this.crate.at && this.crate.at.mesh.isMesh) this.crate.at.mesh.material = this.mats.crate;
    this.crate.at = it; this.crate.state = 'idle'; this.crate.uses = 0;
    if (it.mesh.isMesh) it.mesh.material = this.mats.crateOn;
    this.beam.position.set(it.x, WALL_H / 2, it.z); this.beam.visible = true;
  }
  powerOn() {
    this.power = true; sfx('round');
    this.perkLights.forEach(l => l.intensity = 6); this.perkBodies.forEach(b => b.material.emissiveIntensity = 0.3);
    this.leverArm.rotation.x = 2.3; this.leverLamp.material.color.set(0x3fe06a);
    for (const k in this.pads) { this.pads[k].m.material.color.set(0x2aa8c8); this.pads[k].ring.visible = true; }
    this.message('POWER ON', 3, true);
  }
  dropPower(x, z) {
    const keys = Object.keys(POWERUPS), type = keys[Math.floor(Math.random() * keys.length)];
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), new THREE.MeshBasicMaterial({ color: POWERUPS[type].color }));
    m.position.set(x, 1, z); this.scene.add(m);
    this.drops.push({ type, x, z, t: 26, m });
  }
  applyPower(type) {
    const p = this.p, P = POWERUPS[type];
    sfx('buy'); this.message(P.name, 2.2);
    if (P.time) this.buff[type] = P.time;
    else if (type === 'ammo') p.inv.forEach(w => { w.reserve = w.def.reserve; });
    else if (type === 'repair') { this.windows.forEach(w => { w.boards = 6; w.meshes.forEach(m => m.visible = true); }); this.addPoints(200); }
    else if (type === 'blast') { for (const z of this.zombies) if (z.state !== 'dead') { z.state = 'dead'; z.t = 0; this.stats.kills++; } this.addPoints(400); }
  }
  updateDrops(dt) {
    const p = this.p;
    this.buff.insta = Math.max(0, this.buff.insta - dt); this.buff.double = Math.max(0, this.buff.double - dt);
    this.tpCd = Math.max(0, this.tpCd - dt); p.repairCd = Math.max(0, p.repairCd - dt);
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.t -= dt;
      d.m.rotation.y += dt * 2.5; d.m.position.y = 1 + Math.sin(d.t * 3) * 0.12; d.m.visible = d.t > 6 || Math.floor(d.t * 6) % 2 === 0;
      const got = Math.hypot(d.x - p.x, d.z - p.z) < 1.3;
      if (got) this.applyPower(d.type);
      if (got || d.t <= 0) { this.scene.remove(d.m); d.m.geometry.dispose(); this.drops.splice(i, 1); }
    }
  }
  promptFor(it) {
    const p = this.p;
    if (it.type === 'door') return it.open ? null : { text: 'Clear the passage', cost: it.cost };
    if (it.type === 'wall') { const d = WEAPONS[it.wid]; return this.has(it.wid) ? { text: `Buy ammo · ${d.name}`, cost: d.cost / 2 } : { text: `Buy ${d.name}`, cost: d.cost }; }
    if (it.type === 'window') return it.boards < 6 && p.repairCd <= 0 ? { text: 'Repair barrier', cost: 0 } : null;
    if (it.type === 'power') return this.power ? null : { text: 'Turn on the power', cost: 0 };
    if (it.type === 'tp') {
      if (!this.power) return { text: 'Teleporter offline — power required', cost: -1 };
      if (this.tpCd > 0) return { text: 'Teleporter recharging', cost: -1 };
      return { text: it.to === 't' ? 'Teleport to the workshop' : 'Teleport back to the station', cost: 0 };
    }
    if (it.type === 'forge') { const w = this.weapon; return w.def.up ? { text: `${w.def.name} is already reforged`, cost: -1 } : { text: `Reforge ${w.def.name}`, cost: FORGE_COST }; }
    if (it.type === 'perk') {
      if (p.perks.has(it.perk.id)) return null;
      if (!this.power && it.perk.id !== 'wind') return { text: `${it.perk.name} — power required`, cost: -1 };
      if (it.perk.id === 'wind' && p.windUses >= 3) return { text: 'Second Wind sold out', cost: -1 };
      return { text: `${it.perk.name} — ${it.perk.desc}`, cost: it.perk.cost };
    }
    if (it.type === 'crate') {
      if (it !== this.crate.at) return null;
      if (this.crate.state === 'idle') return { text: 'Mystery Crate', cost: CRATE_COST };
      if (this.crate.state === 'ready') return { text: `Take ${WEAPONS[this.crate.offer].name}`, cost: 0 };
    }
    return null;
  }
  interact(it, pr) {
    const p = this.p;
    if (pr.cost < 0) { sfx('deny'); return; }
    if (p.points < pr.cost) { sfx('deny'); this.message('Not enough points', 1.2); return; }
    p.points -= pr.cost;
    if (pr.cost > 0) sfx('buy');
    if (it.type === 'door') {
      it.open = true; it.cells.forEach(i => this.solid[i] = 0); it.meshes.forEach(m => this.scene.remove(m));
      this.computeField();
    } else if (it.type === 'wall') {
      const w = this.has(it.wid);
      if (w) { w.reserve = w.def.reserve; w.mag = w.def.mag; } else this.giveWeapon(it.wid);
    } else if (it.type === 'window') {
      it.meshes[it.boards].visible = true; it.boards++; p.repairCd = 0.45; this.addPoints(10); sfx('reload');
    } else if (it.type === 'power') {
      this.powerOn();
    } else if (it.type === 'tp') {
      const d = this.pads[it.to]; p.x = d.x; p.z = d.z; p.vx = p.vz = 0; this.tpCd = 5; p.invuln = Math.max(p.invuln, 1.5);
      this.computeField(); sfx('energy');
      const f = $('tp-flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    } else if (it.type === 'forge') {
      const w = this.weapon; w.def = this.weaponDef(w.id, true); w.mag = w.def.mag; w.reserve = w.def.reserve; p.reloadT = 0; p.swapT = 0.6;
      this.buildViewModel(); this.message(w.def.name + ' ready', 2);
    } else if (it.type === 'perk') {
      p.perks.add(it.perk.id);
      if (it.perk.id === 'hide') { p.maxHp = 250; p.hp = 250; }
      if (it.perk.id === 'wind') p.windUses++;
      this.message(it.perk.name + ' active', 1.5);
    } else if (it.type === 'crate') {
      const c = this.crate;
      if (c.state === 'idle') {
        c.state = 'roll'; c.t = 3.2; c.uses++; sfx('crate');
        c.moving = c.uses >= 4 && Math.random() < 0.4;
        const pool = CRATE_POOL.filter(id => !this.has(id));
        c.offer = pool[Math.floor(Math.random() * pool.length)];
        this.floatGun.visible = true;
      } else if (c.state === 'ready') {
        this.giveWeapon(c.offer); c.state = 'idle'; this.floatGun.visible = false; sfx('buy');
      }
    }
  }
  updateCrate(dt) {
    const c = this.crate, at = c.at, fg = this.floatGun;
    this.beam.material.opacity = 0.18 + Math.sin(performance.now() / 400) * 0.06;
    if (c.state === 'idle') return;
    c.t -= dt;
    fg.position.set(at.x, 1.5 + Math.sin(performance.now() / 300) * 0.08, at.z); fg.rotation.y += dt * 3;
    if (c.state === 'roll') {
      fg.material.color.setHSL((performance.now() / 300) % 1, 0.8, 0.6);
      fg.scale.x = 0.6 + Math.random() * 0.8;
      if (c.t <= 0) {
        if (c.moving) {
          c.state = 'leave'; c.t = 1.8; this.p.points += CRATE_COST; fg.material.color.set(0xff3a1a);
          this.message('The crate is moving! Points refunded', 2.5); sfx('deny');
        } else { c.state = 'ready'; c.t = 9; fg.material.color.set(0xffe08a); fg.scale.x = 1; }
      }
    } else if (c.state === 'ready') {
      if (c.t <= 0) { c.state = 'idle'; fg.visible = false; }
    } else if (c.state === 'leave') {
      fg.position.y += (1.8 - c.t) * 1.5;
      if (c.t <= 0) { fg.visible = false; const o = this.cratePts.filter(x => x !== at); this.setCrate(o[Math.floor(Math.random() * o.length)]); }
    }
  }

  // ---------- round ----------
  updateRounds(dt) {
    if (this.phase === 'inter') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.round++; this.phase = 'active'; this.dropsLeft = 4;
        const r = this.round;
        this.toSpawn = Math.round(5 + r * 2.6 + r * r * 0.16);
        this.spawnT = 1;
        this.message('ROUND ' + r, 3, true); sfx('round');
      }
    } else {
      const alive = this.zombies.reduce((n, z) => n + (z.state !== 'dead' ? 1 : 0), 0);
      if (this.toSpawn > 0) {
        this.spawnT -= dt;
        if (this.spawnT <= 0 && alive < MAX_ALIVE) {
          if (this.spawnZombie()) this.toSpawn--;
          this.spawnT = Math.max(0.22, 1.9 * Math.pow(0.93, this.round - 1));
        }
      } else if (alive === 0) {
        this.phase = 'inter'; this.phaseT = 8; sfx('roundEnd');
        this.addXp(40 * this.round);
        this.profile.best.round = Math.max(this.profile.best.round, this.round);
        saveProfile(this.profile);
        this.message('Round survived', 2.5);
      }
      this.left = alive + this.toSpawn;
    }
  }
  message(text, dur, big) { const el = $('hud-msg'); el.textContent = text; el.className = big ? 'big show' : 'show'; this.msgT = dur; }

  // Aim assist for simple touch controls: finds what the crosshair is on (generous hit boxes),
  // pulls the view gently toward the closest visible zombie near the centre, and flags point-blank ones for the knife.
  assist(dt) {
    const p = this.p, o = { x: p.x, y: EYE + p.y, z: p.z }, cp = Math.cos(p.pitch);
    const d = { x: -Math.sin(p.yaw) * cp, y: Math.sin(p.pitch), z: -Math.cos(p.yaw) * cp };
    let hit = null, pull = null, pa = 0.2; this.closeZ = null;
    for (const z of this.zombies) {
      if (z.state === 'dead' || z.y < -0.6) continue;
      const dx = z.x - p.x, dz = z.z - p.z, dist = Math.hypot(dx, dz);
      if (dist > 40) continue;
      const fwd = (dx * d.x + dz * d.z) / (dist * cp || 1);
      if (dist < 1.7 && fwd > 0.3) this.closeZ = z;
      const h = this.rayZombie(o, d, z, 1.9);
      if (h && (!hit || h.t < hit.t)) hit = h;
      let dy = Math.atan2(-dx, -dz) - p.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283;
      if (Math.abs(dy) < pa && this.los(p.x, p.z, z.x, z.z)) { pa = Math.abs(dy); pull = { dy, dp: Math.atan2(z.y + 1.25 - o.y, dist) - p.pitch }; }
    }
    if (hit) for (let t = 0.3; t < hit.t; t += 0.3) if (this.solidAt(o.x + d.x * t, o.z + d.z * t)) { hit = null; break; }
    if (pull) { const k = Math.min(1, dt * 3.5); p.yaw += pull.dy * k; p.pitch += clamp(pull.dp, -0.3, 0.3) * k; }
    this.aimHit = hit; this.autoT = hit ? this.autoT + dt : 0;
  }

  // ---------- player ----------
  updatePlayer(dt) {
    const p = this.p, inp = this.input, w = this.weapon, s = this.profile.settings;
    // simple touch mode: slow the camera on a target, nudge it toward the nearest zombie, fire automatically
    const easy = s.simple && inp.isTouch && !inp.gamepadName;
    const lk = (p.adsK > 0.5 ? w.def.adsZoom + 0.15 : 1) * (easy && this.aimHit ? 0.55 : 1);
    p.yaw -= inp.look.x * lk;
    p.pitch = clamp(p.pitch - inp.look.y * (s.invert ? -1 : 1) * lk, -1.45, 1.45);
    if (easy) this.assist(dt); else { this.aimHit = null; this.autoT = 0; }
    const down = p.downT > 0;
    const ads = inp.ads && p.reloadT <= 0 && p.swapT <= 0 && !down;
    p.adsK += ((ads ? 1 : 0) - p.adsK) * Math.min(1, dt * 14);
    const mv = inp.move, moving = Math.hypot(mv.x, mv.y) > 0.1;
    const sprinting = inp.sprint && mv.y > 0.5 && p.stamina > 0.05 && !ads && !down;
    p.stamina = clamp(p.stamina + (sprinting ? -dt / 5 : dt / 3.5), 0, 1);
    p.sprinting = sprinting;
    let speed = down ? 0.8 : sprinting ? 7.4 : 4.9; if (ads) speed *= w.def.adsMove;
    if (w.def.cls === 'lmg' || w.def.cls === 'sniper') speed *= 0.9;
    const sn = Math.sin(p.yaw), cs = Math.cos(p.yaw);
    const tvx = (cs * mv.x - sn * mv.y) * speed, tvz = (-sn * mv.x - cs * mv.y) * speed;
    const k = Math.min(1, dt * (p.y > 0 ? 3 : 13));
    p.vx += (tvx - p.vx) * k; p.vz += (tvz - p.vz) * k;
    this.lastSafe = { x: p.x, z: p.z };
    p.x += p.vx * dt; p.z += p.vz * dt; this.collide(p, PR, true);
    if (inp.consume('jump') && p.y === 0 && !down) p.vy = 5.2;
    if (p.y > 0 || p.vy > 0) { p.vy -= 15 * dt; p.y += p.vy * dt; if (p.y <= 0) { p.y = 0; p.vy = 0; } }
    if (moving && p.y === 0) p.bob += dt * (sprinting ? 13 : 9);

    // health
    p.lastHit += dt; p.invuln = Math.max(0, p.invuln - dt);
    if (p.lastHit > 4.5 && p.hp < p.maxHp && !down) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * dt * 0.6);
    if (down) {
      p.downT -= dt;
      if (p.downT <= 0) { p.hp = p.maxHp; p.invuln = 3; p.lastHit = 0; this.message('Back on your feet!', 1.5); }
    }

    // weapons
    p.fireCd -= dt; p.knifeCd -= dt;
    if (p.swapT > 0) p.swapT -= dt;
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) { const n = Math.min(w.def.mag - w.mag, w.reserve); w.mag += n; w.reserve -= n; }
    }
    if (inp.consume('swap')) this.swap();
    if (inp.consume('knife')) this.knife();
    if (easy && this.closeZ && p.knifeCd <= 0 && (p.reloadT > 0 || this.weapon.mag === 0 || !this.aimHit)) this.knife();
    // interaction
    let near = null, nd = 1e9, pr = null;
    for (const it of this.inter) { const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < it.r && d < nd) { const q = this.promptFor(it); if (q) { near = it; nd = d; pr = q; } } }
    const useKey = inp.consume('use'), ur = inp.consume('usereload');
    if (near && (useKey || ur || (easy && near.type === 'window')) && !down) this.interact(near, pr);
    else if (ur) this.startReload();
    if (inp.consume('reload')) this.startReload();
    this.near = near; this.nearPr = near ? this.promptFor(near) : null;
    const cw = this.weapon;
    const auto = easy && this.autoT > 0.1 && !down;
    if ((inp.fire || auto) && p.fireCd <= 0 && p.reloadT <= 0 && p.swapT <= 0 && p.knifeCd <= 0.35 && (!sprinting || auto) && (cw.def.auto || !p.prevFire || auto)) this.shoot();
    p.prevFire = inp.fire;

    // camera + view model
    p.recoil = Math.max(0, p.recoil - dt * 0.35 - p.recoil * dt * 6);
    p.kickZ += (0 - p.kickZ) * Math.min(1, dt * 12);
    const cam = this.camera;
    const bobY = Math.sin(p.bob * 2) * 0.035 * (1 - p.adsK), bobX = Math.cos(p.bob) * 0.03 * (1 - p.adsK);
    cam.position.set(p.x, (down ? 0.7 : EYE) + p.y + (moving ? bobY * 0.6 : 0), p.z);
    cam.rotation.set(p.pitch + p.recoil, p.yaw, down ? 0.35 : 0);
    const fov = s.fov * (1 - (1 - cw.def.adsZoom) * p.adsK) * (sprinting ? 1.06 : 1);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 12); cam.updateProjectionMatrix(); }
    const lower = (p.reloadT > 0 ? 0.5 : 0) + (p.swapT > 0 ? 0.8 : 0) + (sprinting ? 0.18 : 0);
    const hx = 0.26 * (1 - p.adsK), hy = -0.2 + 0.085 * p.adsK - lower * 0.4;
    const vm = this.vm;
    vm.position.set((hx + bobX) * 0.3, (hy + bobY) * 0.3, (-0.5 + p.kickZ + 0.1 * p.adsK) * 0.3);
    vm.rotation.set(-lower * 0.9 + p.kickZ * 0.8, sprinting ? 0.5 : 0, p.knifeCd > 0.35 ? -0.8 : 0);
  }

  hud() {
    const p = this.p, w = this.weapon, c = this.hudCache;
    const set = (id, v, prop = 'textContent') => { if (c[id] !== v) { c[id] = v; $(id)[prop] = v; } };
    set('hud-points', String(p.points));
    set('hud-round', String(this.round || ''));
    set('hud-mag', String(w.mag)); set('hud-res', String(w.reserve));
    const low = w.mag <= Math.max(1, Math.floor(w.def.mag * 0.25));
    if (c.magCls !== low) { c.magCls = low; $('hud-mag').className = low ? 'low' : ''; }
    set('hud-warn', p.reloadT > 0 ? 'RELOADING' : w.mag === 0 && w.reserve === 0 ? 'NO AMMO' : low && w.reserve > 0 ? 'RELOAD' : low ? 'LOW AMMO' : '');
    set('hud-weapon', w.def.name);
    set('hud-left', this.phase === 'active' ? `${this.left || 0} REMAINING` : this.round ? 'ROUND CLEAR' : 'GET READY');
    const bf = Object.keys(this.buff).filter(k => this.buff[k] > 0).map(k => `<span>${POWERUPS[k].name}<b>${Math.ceil(this.buff[k])}</b></span>`).join('');
    set('hud-power', bf, 'innerHTML');
    const perks = [...p.perks].join(',');
    if (c.perks !== perks) {
      c.perks = perks;
      $('hud-perks').innerHTML = Object.values(PERKS).filter(k => p.perks.has(k.id)).map(k => `<span style="--c:${k.color}">${k.short}</span>`).join('');
    }
    const pr = this.nearPr;
    const key = this.input.isTouch ? '' : `<kbd>${this.input.gamepadName ? 'X' : 'F'}</kbd>`;
    const afford = pr && p.points >= pr.cost;
    set('hud-prompt', pr ? `${key}<span>${pr.text}</span>` + (pr.cost > 0 ? `<b class="${afford ? '' : 'no'}">${pr.cost}</b>` : '') : '', 'innerHTML');
    if (c.useVis !== !!pr) { c.useVis = !!pr; $('btn-use').style.display = pr ? 'flex' : 'none'; }
    const vg = clamp(1 - p.hp / p.maxHp, 0, 1) * 0.85 + (p.downT > 0 ? 0.3 : 0);
    $('vignette').style.opacity = vg.toFixed(2);
    const hm = $('hitmarker'); hm.style.opacity = this.hitT > 0 || this.killT > 0 ? 1 : 0;
    if (c.kill !== (this.killT > 0)) { c.kill = this.killT > 0; hm.className = c.kill ? 'kill' : ''; }
    if (this.killT > 0) this.killT -= this.dt;
    const ch = $('crosshair');
    ch.style.opacity = (p.adsK > 0.6 && w.def.cls !== 'shotgun') || p.sprinting ? 0 : 1;
    ch.style.setProperty('--gap', (5 + w.def.spread * 260 + Math.min(14, Math.hypot(p.vx, p.vz) * 1.3) + p.kickZ * 90).toFixed(1) + 'px');
    const dd = $('dmg-dir');
    if (this.dmgT > 0) {
      this.dmgT -= this.dt;
      const dx = this.dmgFrom.x - p.x, dz = this.dmgFrom.z - p.z, sn = Math.sin(p.yaw), cs = Math.cos(p.yaw);
      dd.style.transform = `rotate(${Math.atan2(cs * dx - sn * dz, -sn * dx - cs * dz).toFixed(2)}rad)`;
      dd.style.opacity = Math.min(1, this.dmgT * 1.5).toFixed(2);
    } else if (c.dd !== 0) { dd.style.opacity = 0; }
    c.dd = this.dmgT > 0 ? 1 : 0;
    $('stamina').style.width = (p.stamina * 100).toFixed(0) + '%';
    if (this.msgT > 0) { this.msgT -= this.dt; if (this.msgT <= 0) $('hud-msg').className = ''; }
  }

  // ---------- loop ----------
  start() { this.running = true; this.paused = false; this.last = performance.now(); this.input.active = true; this.input.reset(); requestAnimationFrame(this.loop); }
  setPaused(v) {
    if (this.over) return;
    this.paused = v; this.input.active = !v; this.input.reset();
    if (!v) this.last = performance.now();
  }
  loop(now) {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.dt = dt;
    this.input.poll(dt);
    if (this.input.consume('pause')) { this.hooks.onPause(); }
    if (this.paused) return;
    this.updatePlayer(dt);
    if (this.over) return;
    this.fieldT -= dt; if (this.fieldT <= 0) { this.fieldT = 0.25; this.computeField(); }
    this.updateRounds(dt);
    this.updateZombies(dt);
    this.updateCrate(dt);
    this.updateDrops(dt);
    for (const pt of this.parts) if (pt.life > 0) {
      pt.life -= dt; pt.vy -= 12 * dt; pt.m.position.x += pt.vx * dt; pt.m.position.y += pt.vy * dt; pt.m.position.z += pt.vz * dt;
      if (pt.life <= 0) pt.m.visible = false;
    }
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
    if (this.tracerT > 0) { this.tracerT -= dt; if (this.tracerT <= 0) this.tracer.visible = false; }
    if (this.hitT > 0) this.hitT -= dt;
    this.groanT -= dt; if (this.groanT <= 0) { this.groanT = rand(1.5, 4); if (this.zombies.length) sfx('groan'); }
    this.hud();
    this.renderer.render(this.scene, this.camera);
  }
  destroy() {
    this.running = false; this.input.active = false; this.input.reset();
    window.removeEventListener('resize', this.onResize);
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.renderer.dispose();
  }
}
