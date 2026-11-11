// Loads the CC0 models and textures in /assets. Every entry is optional: if a file fails to load the game falls back to its built-in shapes.
import * as THREE from '../lib/three.module.min.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';

const MODELS = { zombie: 'zombie', pistol: 'service_pistol', crate: 'wooden_military_crate', lamp: 'hanging_industrial_lamp', powerbox: 'power_box_01' };
const TEXTURES = { wall: 'dark_brick_wall_diff', wallN: 'dark_brick_wall_nor', floor: 'concrete_floor_worn_001_diff', floorN: 'concrete_floor_worn_001_nor', plank: 'old_planks_02_diff' };
const HIDE = /bullet|magazine|wrap|_b$/i;
let cache = null;

function simplify(scene) {
  scene.traverse(o => {
    if (HIDE.test(o.name)) o.visible = false;
    if (!o.isMesh) return;
    const m = o.material, glass = /glass/i.test(m.name);
    if (o.isSkinnedMesh) { o.frustumCulled = false; o.material = new THREE.MeshLambertMaterial({ vertexColors: true }); return; }
    o.material = glass
      ? new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
      : new THREE.MeshLambertMaterial({ map: m.map, normalMap: m.normalMap, color: 0xd8d8d8 });
  });
  return scene;
}

// Models are glTF JSON with the geometry buffer embedded as base64, so every file is plain JSON or JPEG.
// The buffer is unpacked here and handed to the loader as an in-memory GLB.
async function loadModel(gl, name) {
  const base = `assets/models/${name}/`;
  const res = await fetch(base + name + '.json');
  if (!res.ok) throw new Error('missing model ' + name);
  const j = await res.json();
  const raw = atob(j.buffers[0].uri.split(',')[1]);
  delete j.buffers[0].uri;
  const pad4 = n => (n + 3) & ~3;
  const jb = new TextEncoder().encode(JSON.stringify(j));
  const jl = pad4(jb.length), bl = pad4(raw.length);
  const buf = new ArrayBuffer(12 + 8 + jl + 8 + bl), dv = new DataView(buf), u8 = new Uint8Array(buf);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, buf.byteLength, true);
  dv.setUint32(12, jl, true); dv.setUint32(16, 0x4e4f534a, true);
  u8.fill(0x20, 20, 20 + jl); u8.set(jb, 20);
  const o = 20 + jl; dv.setUint32(o, bl, true); dv.setUint32(o + 4, 0x004e4942, true);
  for (let i = 0; i < raw.length; i++) u8[o + 8 + i] = raw.charCodeAt(i);
  return new Promise((ok, fail) => gl.parse(buf, base, ok, fail));
}

export async function loadAssets(progress) {
  if (cache) return cache;
  const out = { models: {}, tex: {} };
  const gl = new GLTFLoader(), tl = new THREE.TextureLoader();
  const jobs = [];
  for (const k in MODELS) jobs.push(loadModel(gl, MODELS[k]).then(g => { out.models[k] = simplify(g.scene); out.models[k].userData.clips = g.animations; }).catch(() => {}));
  for (const k in TEXTURES) jobs.push(tl.loadAsync(`assets/textures/${TEXTURES[k]}.jpg`).then(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; if (!k.endsWith('N')) t.colorSpace = THREE.SRGBColorSpace; out.tex[k] = t;
  }).catch(() => {}));
  let done = 0;
  jobs.forEach(j => j.then(() => progress(++done / jobs.length)));
  await Promise.all(jobs);
  cache = out;
  return out;
}
