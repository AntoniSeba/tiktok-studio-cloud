// main.js - interactive rotary (Wankel) explorer. The rotor's orbit, its one
// third speed, the apex seal contact and the three chamber volumes all come out
// of the trochoid maths; the coloured volumes are measured, not drawn.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMaterials } from './lib/materials.js';
import { applyMaterialVariation } from './lib/materials.js';
import { buildStudioEnvironment, makeStudioFloor, makeShadowFloor } from './lib/environment.js';
import { buildRotary } from './parts/rotary.js';
import * as T from './lib/trochoid.js';
import { createLabels } from './labels.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? parseFloat(params.get(k)) : d);
const flag = (k) => params.get(k) === '1';
const lq = flag('lq');

const host = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: !lq, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 5, 30000);

const env = buildStudioEnvironment(renderer);
scene.environment = env;
scene.background = env;
// the engine straddles y = 0, so both floors have to sit below its lowest part
// or an opaque floor plane slices the housing in half from any level view
const studioFloor = makeStudioFloor(20000);
studioFloor.position.y = -300;
scene.add(studioFloor);
const shadowFloor = makeShadowFloor(14000);
shadowFloor.position.y = -215;
scene.add(shadowFloor);

const key = new THREE.DirectionalLight(0xfff6ea, 2.4);
key.position.set(-900, 1500, 1400);
key.castShadow = true;
key.shadow.mapSize.set(lq ? 1024 : 4096, lq ? 1024 : 4096);
key.shadow.camera.near = 600;
key.shadow.camera.far = 6000;
key.shadow.camera.left = -900;
key.shadow.camera.right = 900;
key.shadow.camera.top = 900;
key.shadow.camera.bottom = -900;
key.shadow.bias = -0.0006;
scene.add(key);
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.42);
fill.position.set(1500, 700, -900);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.7);
rim.position.set(-400, -600, -1500);
scene.add(rim);
scene.add(new THREE.HemisphereLight(0xdfe8f4, 0x14161a, 0.35));

const M = createMaterials();
const rotary = buildRotary(M);
scene.add(rotary.root);
applyMaterialVariation(rotary.root, M);

// ------------------------------------------------------------------ state
const state = { crank: num('crank', 0), speed: num('speed', 90), playing: !flag('nop'), exploded: 0, gas: true, frontOff: false };
const REAL = num('explode', flag('explode') ? 1 : 0);

const ZEX = {
  SIDE_HOUSING_FRONT: 300,
  TENSION_BOLTS: 190,
  ROTOR_HOUSING: 150,
  ROTOR: 70,
  ECCENTRIC_SHAFT: 0,
  SIDE_HOUSING_REAR: 0,
  CHAMBER_GAS: 150,
};
const restZ = new Map();
rotary.root.children.forEach((c) => restZ.set(c, c.position.z));

function applyExplode(t) {
  for (const child of rotary.root.children) {
    const d = ZEX[child.name] || 0;
    if (child.name === 'ECCENTRIC_SHAFT' || child.name === 'TENSION_BOLTS') {
      if (child.name === 'TENSION_BOLTS') {
        child.children.forEach((b, i) => {
          b.position.z = restZ.get(child) + (t * d * (1 + i / 24));
        });
      }
      continue;
    }
    child.position.z = restZ.get(child) + t * d;
  }
  rotary.groups.gasRoot.visible = state.gas && t < 0.12;
  rotary.groups.gasRoot.position.z = 0;
}

// ------------------------------------------------------------------ camera
const CENTRE = new THREE.Vector3(-6, 6, 60);
const VIEWS = {
  os: { pos: new THREE.Vector3(0, 14, 1080), target: new THREE.Vector3(0, 10, 60) },
  tq: { pos: new THREE.Vector3(620, 520, 760), target: new THREE.Vector3(0, 0, 90) },
  side: { pos: new THREE.Vector3(1250, 120, 60), target: new THREE.Vector3(0, 0, 60) },
  top: { pos: new THREE.Vector3(40, 1150, 40), target: new THREE.Vector3(0, 0, 60) },
  swieca: { pos: new THREE.Vector3(150, 420, 420), target: new THREE.Vector3(-30, 112, 100) },
  uszczelka: { pos: new THREE.Vector3(60, 240, 330), target: new THREE.Vector3(60, 60, 100) },
};
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 120;
controls.maxDistance = 6000;
// the axial view only means anything with the front plate off: otherwise the
// viewer is looking at the outside of a casting
const CUTAWAY_HIDE = ['Front_Pulley', 'Pulley_Groove_1', 'Pulley_Groove_2', 'Pulley_Groove_3', 'Flywheel', 'Flywheel_StarterRing', 'Rear_MainSeal', 'COUNTERWEIGHT_1', 'COUNTERWEIGHT_2'];
function setFrontOff(on) {
  state.frontOff = on;
  rotary.groups.frontHousing.visible = !on;
  rotary.groups.bolts.visible = !on;
  for (const n of CUTAWAY_HIDE) {
    const o = rotary.root.getObjectByName(n);
    if (o) o.visible = !on;
  }
  const pulley = rotary.groups.eshaft.getObjectByName('Front_Pulley');
  if (pulley) pulley.visible = !on;
  const cb = document.getElementById('frontOff');
  if (cb) cb.checked = on;
}
function setView(name) {
  if (name === 'os') setFrontOff(true);
  const v = VIEWS[name] || VIEWS.tq;
  camera.position.copy(v.pos);
  controls.target.copy(v.target);
  controls.update();
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
}
void CENTRE;

// ------------------------------------------------------------------ labels
rotary.update(THREE.MathUtils.degToRad(state.crank));
rotary.root.updateMatrixWorld(true);
const LABELS = [
  ['SIDE_HOUSING_FRONT', 'Płyta przednia (kadłub boczny)'],
  ['ROTOR_HOUSING', 'Kadłub rotora (trochoida)'],
  ['SIDE_HOUSING_REAR', 'Płyta tylna'],
  ['ROTOR', 'Rotor (tłok obrotowy)'],
  ['APEX_SEAL_1', 'Uszczelnienie wierzchołkowe'],
  ['ECCENTRIC_SHAFT', 'Wał mimośrodowy'],
  ['SPARK_PLUG_1', 'Świece zapłonowe (2)'],
  ['Stationary_Gear_34T', 'Koło nieruchome 34 zęby'],
  ['Rotor_RingGear_51T', 'Wieniec rotora 51 zębów'],
  ['EXHAUST_STUB', 'Kolektor wydechowy (port obwodowy)'],
  ['RearHousing_IntakeRunner', 'Dolot (port boczny)'],
  ['COUNTERWEIGHT_1', 'Przeciwwaga'],
];
const labels = [];
for (const [name, text] of LABELS) {
  const o = rotary.root.getObjectByName(name);
  if (!o) {
    console.warn('label target missing', name);
    continue;
  }
  const b = new THREE.Box3().setFromObject(o);
  const local = o.worldToLocal(b.getCenter(new THREE.Vector3()));
  labels.push({ el: null, object: o, local, text });
}
const labelOverlay = createLabels(host, camera, labels);

// ------------------------------------------------------------------ chart
const chart = document.getElementById('chart');
const cx = chart?.getContext('2d');
function drawChart() {
  if (!cx) return;
  const w = chart.width;
  const h = chart.height;
  cx.clearRect(0, 0, w, h);
  cx.fillStyle = 'rgba(255,255,255,0.03)';
  cx.fillRect(0, 0, w, h);
  const vols = [];
  for (let d = 0; d <= 1080; d += 6) vols.push(T.chamberVolumes(THREE.MathUtils.degToRad(d)));
  const vmax = Math.max(...vols.map((v) => Math.max(...v)));
  const y = (v) => h - 8 - (v / vmax) * (h - 22);
  const colors = ['#3f7fd0', '#d8a437', '#e2521f'];
  for (let k = 0; k < 3; k++) {
    cx.strokeStyle = colors[k];
    cx.lineWidth = 1.6;
    cx.beginPath();
    vols.forEach((v, i) => {
      const x = 6 + (i / (vols.length - 1)) * (w - 12);
      i ? cx.lineTo(x, y(v[k])) : cx.moveTo(x, y(v[k]));
    });
    cx.stroke();
  }
  // marker at the current crank angle
  const idx = (state.crank % 1080) / 6;
  const x = 6 + (idx / 180) * (w - 12);
  cx.strokeStyle = 'rgba(255,255,255,0.6)';
  cx.lineWidth = 1;
  cx.beginPath();
  cx.moveTo(x, 4);
  cx.lineTo(x, h - 4);
  cx.stroke();
  const cur = T.chamberVolumes(THREE.MathUtils.degToRad(state.crank));
  [0, 1, 2].forEach((k) => {
    cx.fillStyle = colors[k];
    cx.beginPath();
    cx.arc(x, y(cur[k]), 2.4, 0, Math.PI * 2);
    cx.fill();
  });
}

// ----------------------------------------------------------------- composer
const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  type: THREE.HalfFloatType,
  samples: lq ? 0 : 4,
});
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
if (!lq) {
  const ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
  ssao.kernelRadius = 220;
  ssao.minDistance = 4;
  ssao.maxDistance = 900;
  composer.addPass(ssao);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.16, 0.7, 0.9));
}
const vignette = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amount: { value: lq ? 0.0 : 0.24 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader:
    'uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;\n' +
    'void main(){ vec4 c = texture2D(tDiffuse, vUv); float d = distance(vUv, vec2(0.5)); c.rgb *= 1.0 - amount * smoothstep(0.35, 0.95, d); gl_FragColor = c; }',
});
composer.addPass(vignette);
composer.addPass(new OutputPass());

// ------------------------------------------------------------------ ui
const ui = {
  crank: document.getElementById('crank'),
  speed: document.getElementById('speed'),
  play: document.getElementById('play'),
  explode: document.getElementById('explode'),
  gas: document.getElementById('gas'),
  labels: document.getElementById('labels'),
  hud: document.getElementById('hud'),
  outCrank: document.getElementById('crankOut'),
  outSpeed: document.getElementById('speedOut'),
};
const syncOut = () => {
  if (ui.outCrank) ui.outCrank.textContent = `${Math.round(state.crank)}°`;
  if (ui.outSpeed) ui.outSpeed.textContent = `${Math.round(state.speed)}° / s`;
};
ui.crank?.addEventListener('input', () => {
  state.crank = parseFloat(ui.crank.value);
  state.playing = false;
  syncOut();
});
ui.speed?.addEventListener('input', () => {
  state.speed = parseFloat(ui.speed.value);
  syncOut();
});
ui.play?.addEventListener('click', () => {
  state.playing = !state.playing;
  if (ui.play) ui.play.textContent = state.playing ? 'PAUZA' : 'ODTWÓRZ';
});
ui.explode?.addEventListener('input', () => {
  state.exploded = parseFloat(ui.explode.value);
  applyExplode(state.exploded);
});
ui.gas?.addEventListener('change', () => {
  state.gas = ui.gas.checked;
  applyExplode(state.exploded);
});
ui.labels?.addEventListener('change', () => labelOverlay.setVisible(ui.labels.checked));
document.getElementById('frontOff')?.addEventListener('change', (e) => setFrontOff(e.target.checked));
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
window.addEventListener('keydown', (e) => {
  const keys = { '1': 'os', '2': 'tq', '3': 'side', '4': 'top', '5': 'swieca', '6': 'uszczelka' };
  if (keys[e.key]) setView(keys[e.key]);
});

// ------------------------------------------------------------------ hud
const PHASE_PL = ['SSANIE', 'SPRĘŻANIE', 'PRACA', 'WYDECH'];
function updateHud() {
  if (!ui.hud) return;
  const vols = T.chamberVolumes(THREE.MathUtils.degToRad(state.crank));
  const cells = [0, 1, 2]
    .map((k) => {
      const ph = T.chamberPhase(THREE.MathUtils.degToRad(state.crank), k);
      return `<span class="cell"><b>Komora ${k + 1}</b> ${vols[k].toFixed(0)} cm³ <i>${PHASE_PL[ph.index]}</i></span>`;
    })
    .join('');
  ui.hud.innerHTML =
    `<span class="cell">wał <b>${Math.round(state.crank % 360)}°</b></span>` +
    `<span class="cell">rotor <b>${Math.round((state.crank / 3) % 360)}°</b></span>` +
    cells +
    `<span class="cell">pojemność <b>${T.sweptVolume().toFixed(0)} cm³</b>/rotor</span>`;
}

// ------------------------------------------------------------------ loop
syncOut();
ui.gas && (ui.gas.checked = true);
ui.explode && (ui.explode.value = String(REAL));
state.exploded = REAL;
applyExplode(state.exploded);

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.playing) {
    state.crank = (state.crank + state.speed * dt) % 1080;
    if (ui.crank) ui.crank.value = String(state.crank);
  }
  rotary.update(THREE.MathUtils.degToRad(state.crank), { gas: state.gas });
  labelOverlay.update();
  controls.update();
  composer.render();
  updateHud();
  drawChart();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});

// ------------------------------------------------------------------ harness
window.__set = (crankDeg, speed) => {
  state.crank = crankDeg;
  if (speed !== undefined) state.speed = speed;
  state.playing = false;
  if (ui.crank) ui.crank.value = String(crankDeg);
  rotary.update(THREE.MathUtils.degToRad(state.crank), { gas: state.gas });
  syncOut();
  updateHud();
  drawChart();
};
window.__setView = setView;
window.__setFrontOff = setFrontOff;
window.__camera = camera;
window.__state = state;
window.__rotary = rotary;
window.__math = T;
window.__applyExplode = applyExplode;
window.__stats = () => {
  let meshes = 0;
  let tris = 0;
  scene.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      const g = o.geometry;
      if (g?.index) tris += g.index.count / 3;
      else if (g?.attributes?.position) tris += g.attributes.position.count / 3;
    }
  });
  return {
    meshes,
    triangles: Math.round(tris),
    cam: camera.position.toArray().map(Math.round),
    crank: Math.round(state.crank),
    volumes: T.chamberVolumes(THREE.MathUtils.degToRad(state.crank)).map((v) => +v.toFixed(1)),
    sweep: +T.sweptVolume().toFixed(1),
  };
};
setView(params.get('view') || 'os');
window.__READY = true;
