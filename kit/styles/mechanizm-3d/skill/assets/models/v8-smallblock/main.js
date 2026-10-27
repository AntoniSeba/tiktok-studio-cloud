// main.js - renderer, studio lighting, camera presets, exploded view, labels,
// exports. URL params drive the deterministic screenshot harness:
//   ?view=front|side|top|tq|rear|iso|quad & explode=0..1 & labels=0|1 & spin=0|1
//   & w= & h=

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createMaterials } from './lib/materials.js';
import { buildEngine } from './scene.js';
import { createLabels } from './labels.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? parseFloat(params.get(k)) : d);

// ------------------------------------------------------------------ renderer
const host = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// studio backdrop: vertical gradient + vignette, no image assets
(function background() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, '#2a2f36');
  g.addColorStop(0.45, '#191d22');
  g.addColorStop(1.0, '#0b0d10');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
})();

// ---------------------------------------------------------------- environment
(function environment() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#e8eef6');
  g.addColorStop(0.48, '#9aa4b0');
  g.addColorStop(0.52, '#3c4147');
  g.addColorStop(1, '#15171a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  // three softboxes so metals have something believable to reflect
  const boxes = [
    [40, 10, 130, 90, 1.0],
    [210, 6, 90, 70, 0.9],
    [370, 20, 120, 80, 0.7],
  ];
  for (const [x, y, w, h, a] of boxes) {
    const rg = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
    rg.addColorStop(0, `rgba(255,255,255,${a})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - 40, y - 30, w + 80, h + 60);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
})();

// ------------------------------------------------------------------- lighting
const key = new THREE.DirectionalLight(0xfff4e8, 2.6);
key.position.set(1500, 2400, 1900);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 400;
key.shadow.camera.far = 7000;
const S = 1500;
Object.assign(key.shadow.camera, { left: -S, right: S, top: S, bottom: -S });
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0006;
key.shadow.normalBias = 1.2;
scene.add(key);

const fill = new THREE.DirectionalLight(0x9fbcd8, 0.9);
fill.position.set(-2000, 900, 1200);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 1.5);
rim.position.set(-900, 1400, -2200);
scene.add(rim);

const bounce = new THREE.DirectionalLight(0xffe9cf, 0.35);
bounce.position.set(600, -1200, 400);
scene.add(bounce);

scene.add(new THREE.HemisphereLight(0xdfe8f5, 0x14161a, 0.45));

// -------------------------------------------------------------------- ground
const floorMat = new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.62, metalness: 0.35 });
const floor = new THREE.Mesh(new THREE.CircleGeometry(5200, 64), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -285;
floor.receiveShadow = true;
floor.name = 'StudioFloor';
scene.add(floor);

const grid = new THREE.GridHelper(6000, 30, 0x3a4048, 0x252a30);
grid.position.y = -284;
grid.material.transparent = true;
grid.material.opacity = 0.35;
grid.name = 'StudioGrid';
scene.add(grid);

// -------------------------------------------------------------------- engine
const M = createMaterials();
const engine = buildEngine(M);
scene.add(engine.root);

// -------------------------------------------------------------------- camera
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 20, 30000);
const TARGET = new THREE.Vector3(0, 130, 0);

const VIEWS = {
  front: new THREE.Vector3(0, 220, 2750),
  rear: new THREE.Vector3(0, 340, -2900),
  side: new THREE.Vector3(2900, 260, 20),
  top: new THREE.Vector3(0, 3050, 6),
  tq: new THREE.Vector3(1850, 1350, 1900),
  iso: new THREE.Vector3(-1750, 1450, 1950),
  tql: new THREE.Vector3(-1950, 1250, 1750),
};

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.copy(TARGET);
controls.minDistance = 600;
controls.maxDistance = 12000;
controls.maxPolarAngle = Math.PI * 0.495;

function setView(name, instant = true) {
  const p = VIEWS[name] || VIEWS.tq;
  camera.position.copy(p);
  controls.target.copy(TARGET);
  camera.lookAt(TARGET);
  controls.update();
  if (instant) {
    const p0 = engine.root.position;
    void p0;
  }
  document.querySelectorAll('[data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === name);
  });
}

// -------------------------------------------------------------------- labels
const labelOverlay = createLabels(host, camera, engine.labels);

// ------------------------------------------------------------------ explode
let explodeTarget = num('explode', 0);
let explodeValue = explodeTarget;
const base = new Map();
for (const g of engine.explodeGroups) base.set(g, g.position.clone());

function applyExplode(t) {
  for (const g of engine.explodeGroups) {
    const b = base.get(g);
    const d = g.userData.explode;
    if (!d) {
      g.position.copy(b);
      continue;
    }
    g.position.copy(b).addScaledVector(d, t);
  }
}

// ------------------------------------------------------------------- motion
let crankAngle = num('crank', 0);
const state = {
  spin: params.get('spin') === '1',
  spinSpeed: 60, // deg / s at 1x
  labels: params.get('labels') !== '0',
  explode: explodeTarget,
  grid: params.get('grid') !== '0',
};
grid.visible = state.grid;
labelOverlay.setVisible(state.labels);

// ----------------------------------------------------------------------- UI
const ui = {
  explode: document.getElementById('explode'),
  spin: document.getElementById('spin'),
  labels: document.getElementById('labels'),
  grid: document.getElementById('grid'),
  view: document.getElementById('viewLabel'),
};
if (ui.explode) ui.explode.value = String(explodeTarget);
if (ui.spin) ui.spin.checked = state.spin;
if (ui.labels) ui.labels.checked = state.labels;
if (ui.grid) ui.grid.checked = state.grid;

document.querySelectorAll('[data-view]').forEach((b) => {
  b.addEventListener('click', () => setView(b.dataset.view));
});
document.querySelectorAll('[data-explode]').forEach((b) => {
  b.addEventListener('click', () => {
    explodeTarget = parseFloat(b.dataset.explode);
    if (ui.explode) ui.explode.value = String(explodeTarget);
  });
});
if (ui.explode) {
  ui.explode.addEventListener('input', () => {
    explodeTarget = parseFloat(ui.explode.value);
  });
}
if (ui.spin) {
  ui.spin.addEventListener('change', () => {
    state.spin = ui.spin.checked;
  });
}
if (ui.labels) {
  ui.labels.addEventListener('change', () => {
    state.labels = ui.labels.checked;
    labelOverlay.setVisible(state.labels);
  });
}
if (ui.grid) {
  ui.grid.addEventListener('change', () => {
    grid.visible = ui.grid.checked;
  });
}

window.addEventListener('keydown', (e) => {
  const map = { 1: 'front', 2: 'side', 3: 'top', 4: 'tq', 5: 'iso', 6: 'rear' };
  if (map[e.key]) setView(map[e.key]);
  if (e.key === 'e') {
    explodeTarget = explodeTarget > 0.5 ? 0 : 1;
    if (ui.explode) ui.explode.value = String(explodeTarget);
  }
  if (e.key === ' ') {
    state.spin = !state.spin;
    if (ui.spin) ui.spin.checked = state.spin;
    e.preventDefault();
  }
});

// ------------------------------------------------------------------ exports
async function exportGLB() {
  const exporter = new GLTFExporter();
  const glb = await new Promise((res, rej) =>
    exporter.parse(
      engine.root,
      (r) => res(r),
      (e) => rej(e),
      { binary: true }
    )
  );
  const blob = new Blob([glb], { type: 'model/gltf-binary' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'v8-engine-assembly.glb';
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportPNG(label = 'view') {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = `v8-engine-${label}.png`;
  a.click();
}

document.getElementById('exportGlb')?.addEventListener('click', exportGLB);
document.getElementById('exportPng')?.addEventListener('click', () => exportPNG('view'));

// ------------------------------------------------------------------- resize
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
onResize();

// quad view (2x2 contact sheet) for review renders
const QUAD = ['front', 'tq', 'side', 'top'];
const quadMode = params.get('view') === 'quad';

// --------------------------------------------------------------------- loop
setView(params.get('view') || 'tq', true);
applyExplode(explodeValue);
engine.setCrankAngle(crankAngle);

let frames = 0;
let last = performance.now();

function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (state.spin) {
    crankAngle = (crankAngle + state.spinSpeed * dt * 3) % 720;
    engine.setCrankAngle(crankAngle);
  }

  if (Math.abs(explodeValue - explodeTarget) > 1e-4) {
    explodeValue += (explodeTarget - explodeValue) * Math.min(1, dt * 7);
    applyExplode(explodeValue);
    if (ui.view) {
      ui.view.textContent = `exploded ${(explodeValue * 100).toFixed(0)}%`;
    }
  }

  controls.update();
  labelOverlay.update();

  if (quadMode) {
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    renderer.setScissorTest(true);
    QUAD.forEach((name, i) => {
      const x = (i % 2) * (w / 2);
      const y = (1 - Math.floor(i / 2)) * (h / 2);
      renderer.setViewport(x, y, w / 2, h / 2);
      renderer.setScissor(x, y, w / 2, h / 2);
      camera.aspect = w / 2 / (h / 2);
      camera.updateProjectionMatrix();
      const p = VIEWS[name];
      camera.position.copy(p);
      camera.lookAt(TARGET);
      renderer.render(scene, camera);
    });
    renderer.setScissorTest(false);
  } else {
    renderer.render(scene, camera);
  }

  frames++;
  if (frames === 6) window.__READY = true;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// screenshot harness helpers
window.__engine = engine;
window.__setView = (n) => setView(n);
window.__setExplode = (t) => {
  explodeTarget = t;
  explodeValue = t;
  applyExplode(t);
};
window.__setCrank = (a) => engine.setCrankAngle(a);
window.__labels = (on) => labelOverlay.setVisible(on);
window.__stats = () => ({
  meshes: (() => {
    let n = 0;
    engine.root.traverse((o) => {
      if (o.isMesh) n++;
    });
    return n;
  })(),
  triangles: renderer.info.render.triangles,
  calls: renderer.info.render.calls,
});
