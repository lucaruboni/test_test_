// Loads the CC0 models and textures in /assets. Every entry is optional: if a file fails to load the game falls back to its built-in shapes.
import * as THREE from '../lib/three.module.min.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';

const MODELS = { pistol: 'service_pistol', rifle: 'bolt_action_rifle_7_62', crate: 'wooden_military_crate', lamp: 'hanging_industrial_lamp', powerbox: 'power_box_01' };
const TEXTURES = { wall: 'dark_brick_wall_diff', wallN: 'dark_brick_wall_nor', floor: 'concrete_floor_worn_001_diff', floorN: 'concrete_floor_worn_001_nor', plank: 'old_planks_02_diff' };
const HIDE = /bullet|magazine|wrap|_b$/i;
let cache = null;

function simplify(scene) {
  scene.traverse(o => {
    if (HIDE.test(o.name)) o.visible = false;
    if (!o.isMesh) return;
    const m = o.material, glass = /glass/i.test(m.name);
    o.material = glass
      ? new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
      : new THREE.MeshLambertMaterial({ map: m.map, normalMap: m.normalMap, color: 0xd8d8d8 });
  });
  return scene;
}

export async function loadAssets(progress) {
  if (cache) return cache;
  const out = { models: {}, tex: {} };
  const gl = new GLTFLoader(), tl = new THREE.TextureLoader();
  const jobs = [];
  for (const k in MODELS) jobs.push(gl.loadAsync(`assets/models/${MODELS[k]}/${MODELS[k]}.gltf`).then(g => { out.models[k] = simplify(g.scene); }).catch(() => {}));
  for (const k in TEXTURES) jobs.push(tl.loadAsync(`assets/textures/${TEXTURES[k]}.jpg`).then(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; if (!k.endsWith('N')) t.colorSpace = THREE.SRGBColorSpace; out.tex[k] = t;
  }).catch(() => {}));
  let done = 0;
  jobs.forEach(j => j.then(() => progress(++done / jobs.length)));
  await Promise.all(jobs);
  cache = out;
  return out;
}
