// main.js - interactive BMW M50 / S54 explorer. Every moving part is placed by
// ./kinematics.js at the crank angle you dial in, so the pistons, the rods, the
// 24 valves, the two camshafts, the VANOS and the chains cannot drift out of
// agreement with each other or with the published engine data.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMaterials, applyMaterialVariation } from './lib/materials.js';
import { buildStudioEnvironment, makeStudioFloor, makeShadowFloor } from './lib/environment.js';
import { buildEngine, CUT_TRAVEL } from './parts/engine.js';
import * as K from './kinematics.js';
import { createLabels } from './labels.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? parseFloat(params.get(k)) : d);
const flag = (k) => params.get(k) === '1';
const lq = flag('lq');

const host = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: !lq, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const { env, background } = buildStudioEnvironment(renderer);
scene.environment = env;
scene.background = background;

const key = new THREE.DirectionalLight(0xfff6ea, 2.6);
key.position.set(-1300, 2100, 1700);
key.castShadow = true;
key.shadow.mapSize.set(lq ? 1024 : 4096, lq ? 1024 : 4096);
key.shadow.camera.near = 200;
key.shadow.camera.far = 8000;
key.shadow.camera.left = -1400;
key.shadow.camera.right = 1400;
key.shadow.camera.top = 1400;
key.shadow.camera.bottom = -1400;
key.shadow.bias = -0.0005;
key.shadow.normalBias = 1.6;
scene.add(key);
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.5);
fill.position.set(1700, 800, -1100);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.8);
rim.position.set(-500, 900, -1800);
scene.add(rim);
const bounce = new THREE.DirectionalLight(0xd9c7a8, 0.22);
bounce.position.set(200, -1000, 500);
scene.add(bounce);
scene.add(new THREE.HemisphereLight(0xdce7f4, 0x1b1f24, 0.45));

const floor = makeStudioFloor(20000);
floor.position.y = -230;
scene.add(floor);
const shadowFloor = makeShadowFloor(14000);
shadowFloor.position.y = -228;
scene.add(shadowFloor);

// ------------------------------------------------------------------- model
const M = createMaterials();
for (const k of Object.keys(M)) {
  const mat = M[k];
  if (mat && mat.isMeshStandardMaterial && mat.envMapIntensity !== undefined) mat.envMapIntensity *= 1.3;
}
const engine = buildEngine(M);
applyMaterialVariation(engine.root, M);
scene.add(engine.root);

// the camera fits a box that is large enough for the section fully open and the
// whole thing exploded, so no view can ever crop the engine
engine.update(K.state(0), { cut: 1, explode: 1 });
engine.root.updateMatrixWorld(true);
const FIT_BOX = new THREE.Box3().setFromObject(engine.root);
engine.update(K.state(0), { cut: 0, explode: 0 });
const CENTRE = FIT_BOX.getCenter(new THREE.Vector3());
const FIT_R = FIT_BOX.getSize(new THREE.Vector3()).length() / 2;

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 40, 40000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 200;
controls.maxDistance = 12000;

const VIEWS = {
  os: { dir: [-1, 0.14, 0.06], zoom: 0.92 },
  tq: { dir: [0.9, 0.52, 0.72], zoom: 0.86 },
  side: { dir: [0.02, 0.07, 1], zoom: 0.72 },
  top: { dir: [0.02, 1, 0.05], zoom: 0.86 },
  head: { dir: [0.32, 0.72, 0.62], zoom: 0.5, target: [0, 330, 20] },
  itb: { dir: [0.24, 0.42, 1], zoom: 0.46, target: [0, 300, 120] },
  timing: { dir: [-0.86, 0.32, -0.42], zoom: 0.42, target: [-260, 150, 0] },
  crank: { dir: [-0.7, 0.18, 0.5], zoom: 0.42, target: [0, 0, 0] },
  exhaust: { dir: [0.5, 0.25, -1], zoom: 0.5, target: [0, 150, -150] },
};
let currentView = 'tq';
function setView(name) {
  const v = VIEWS[name] || VIEWS.tq;
  currentView = name;
  const dir = new THREE.Vector3(...v.dir).normalize();
  const target = v.target ? new THREE.Vector3(...v.target) : CENTRE.clone();
  const dist = (FIT_R / Math.sin((camera.fov * Math.PI) / 360)) * 1.02 * v.zoom;
  camera.position.copy(target).addScaledVector(dir, dist);
  controls.target.copy(target);
  controls.update();
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
}

// ------------------------------------------------------------------- labels
engine.update(K.state(0), { cut: 0, explode: 0 });
engine.root.updateMatrixWorld(true);
const LABELS = [
  ['ValveCover_R', 'Pokrywa zaworów (stop magnezu)'],
  ['HEAD_R', 'Głowica, 24 zawory, dwa wałki'],
  ['Bore_3_R', 'Tuleja cylindra 3, otwór 87 mm'],
  ['PistonBody_3', 'Tłok kuty, wysokość kompresyjna 32,3 mm'],
  ['ROD_3', 'Korbowód kuty, 139 mm'],
  ['CRANKSHAFT', 'Wał korbowy kuty, 12 przeciwwag'],
  ['Crankpin_3', 'Czop korbowy, czopy co 120 stopni'],
  ['Flywheel', 'Koło zamachowe'],
  ['CAMSHAFT_INLET', 'Wałek rozrządu dolotowy (VANOS)'],
  ['CAMSHAFT_EXHAUST', 'Wałek rozrządu wydechowy'],
  ['ITB_3', 'Przepustnica indywidualna, cylinder 3'],
  ['Airbox', 'Airbox'],
  ['FuelRail', 'Listwa wtryskowa, 6 wtryskiwaczy'],
  ['CHAIN_MAIN', 'Łańcuch rozrządu główny, 19/38 zębów'],
  ['CHAIN_SECONDARY', 'Łańcuch wtórny wałek do wałka'],
  ['VanosHousing', 'Podwójny VANOS, bezstopniowy'],
  ['ExhaustRunner_3', 'Kolektor wydechowy 6-2'],
  ['OilPan', 'Miska olejowa'],
  ['BlockShell_R', 'Blok, żeliwo, cylindry siamskie'],
  ['MainCap_4', 'Stopa łożyska głównego'],
];
const labels = [];
engine.update(K.state(0), { cut: 0, explode: 0 });
engine.root.updateMatrixWorld(true);
for (const [name, text] of LABELS) {
  const o = engine.root.getObjectByName(name);
  if (!o) {
    console.warn('label target missing', name);
    continue;
  }
  const b = new THREE.Box3().setFromObject(o);
  const local = o.worldToLocal(b.getCenter(new THREE.Vector3()));
  labels.push({ el: null, object: o, local, text });
}
const labelOverlay = createLabels(host, camera, labels);
labelOverlay.setGranice(70, window.innerHeight - 90);

// ----------------------------------------------------------------- composer
const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  type: THREE.HalfFloatType,
  samples: lq ? 0 : 4,
});
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
if (!lq && params.get('ao') !== '0') {
  const ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
  ssao.kernelRadius = 140;
  ssao.minDistance = 8;
  ssao.maxDistance = 1400;
  composer.addPass(ssao);
}
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.14, 0.7, 0.9));
composer.addPass(new OutputPass());
composer.addPass(
  new ShaderPass({
    uniforms: { tDiffuse: { value: null }, strength: { value: lq ? 0 : 0.26 } },
    vertexShader:
      'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv;\n' +
      'void main(){ vec4 c = texture2D(tDiffuse, vUv); float r = length(vUv - 0.5) * 1.45;' +
      ' c.rgb *= mix(1.0 - strength, 1.0, smoothstep(1.0, 0.2, r)); gl_FragColor = c; }',
  })
);
composer.setSize(window.innerWidth, window.innerHeight);

// -------------------------------------------------------------------- state
const state = {
  crank: num('crank', 0),
  rpm: num('rpm', 700),
  slow: 60, // the animation runs at 1/60 of the dialled rpm so it can be seen
  vanos: num('vanos', 0),
  throttle: num('throttle', 0.25),
  cut: flag('cut') ? 1 : num('cutv', 0),
  explode: num('explode', 0),
  labels: params.get('labels') !== '0',
  airbox: params.get('airbox') !== '0',
  timingCase: params.get('case') !== '0',
  playing: !flag('nop'),
};

const ui = {
  crank: document.getElementById('crank'),
  rpm: document.getElementById('rpm'),
  vanos: document.getElementById('vanos'),
  throttle: document.getElementById('throttle'),
  cut: document.getElementById('cut'),
  explode: document.getElementById('explode'),
  labels: document.getElementById('labels'),
  airbox: document.getElementById('airbox'),
  case: document.getElementById('case'),
  play: document.getElementById('play'),
  hud: document.getElementById('hud'),
  chart: document.getElementById('chart'),
  crankOut: document.getElementById('crankOut'),
  rpmOut: document.getElementById('rpmOut'),
  vanosOut: document.getElementById('vanosOut'),
  throttleOut: document.getElementById('throttleOut'),
};

function findWrap(name) {
  return engine.root.getObjectByName(name);
}
const wrapAirbox = findWrap('AIRBOX_WRAP');
const wrapCase = findWrap('CASE_WRAP');

function applyToggles() {
  if (wrapAirbox) wrapAirbox.visible = state.airbox;
  if (wrapCase) wrapCase.visible = state.timingCase;
}

function syncUi() {
  if (ui.crank) ui.crank.value = String(state.crank);
  if (ui.crankOut) ui.crankOut.textContent = `${Math.round(state.crank)}°`;
  if (ui.rpmOut) ui.rpmOut.textContent = `${Math.round(state.rpm)} obr/min`;
  if (ui.vanosOut) ui.vanosOut.textContent = `${Math.round(state.vanos * 100)}%`;
  if (ui.throttleOut) ui.throttleOut.textContent = `${Math.round(state.throttle * 100)}%`;
}

// ------------------------------------------------------------------- chart
const chart = ui.chart;
const cx = chart?.getContext('2d');
function drawChart() {
  if (!cx) return;
  const w = chart.width;
  const h = chart.height;
  cx.clearRect(0, 0, w, h);
  cx.fillStyle = 'rgba(255,255,255,0.03)';
  cx.fillRect(0, 0, w, h);
  const X = (a) => 6 + (a / 720) * (w - 12);
  const lift = (bank, a) => K.valveLift(bank, a, state.vanos);
  const maxL = 12.5;
  const Y = (l) => h - 20 - (l / maxL) * (h - 34);
  // piston stroke of cylinder 1, scaled onto the same panel
  cx.strokeStyle = 'rgba(120,150,200,0.5)';
  cx.lineWidth = 1.2;
  cx.beginPath();
  for (let a = 0; a <= 720; a += 4) {
    const y = K.pistonPinY(1, a);
    const yy = h - 20 - ((y - 90) / 98) * (h - 34);
    a ? cx.lineTo(X(a), yy) : cx.moveTo(X(a), yy);
  }
  cx.stroke();
  const curve = (bank, color) => {
    cx.strokeStyle = color;
    cx.lineWidth = 1.8;
    cx.beginPath();
    let started = false;
    for (let a = 0; a <= 720; a += 2) {
      const l = lift(bank, a);
      if (l <= 0) {
        started = false;
        continue;
      }
      const x = X(a);
      const y = Y(l);
      started ? cx.lineTo(x, y) : cx.moveTo(x, y);
      started = true;
    }
    cx.stroke();
  };
  curve('inlet', '#4d8ef7');
  curve('exhaust', '#e2521f');
  // firing marks
  for (const f of K.FIRE_ANGLE) {
    const x = X(f.angle);
    cx.strokeStyle = 'rgba(255,255,255,0.14)';
    cx.beginPath();
    cx.moveTo(x, 6);
    cx.lineTo(x, h - 6);
    cx.stroke();
    cx.fillStyle = 'rgba(255,255,255,0.55)';
    cx.font = '10px system-ui';
    cx.fillText(String(f.cyl), x + 2, 14);
  }
  const x = X(state.crank % 720);
  cx.strokeStyle = 'rgba(255,255,255,0.75)';
  cx.lineWidth = 1;
  cx.beginPath();
  cx.moveTo(x, 4);
  cx.lineTo(x, h - 4);
  cx.stroke();
}

// ------------------------------------------------------------------- hud
function updateHud() {
  if (!ui.hud) return;
  const st = K.state(state.crank, { vanos: state.vanos, throttle: state.throttle });
  const cells = st.cylinders
    .map(
      (c) =>
        `<span class="cell"><b>${c.cyl}</b> ${c.strokePl} <i>${c.crownY.toFixed(0)}</i></span>`
    )
    .join('');
  ui.hud.innerHTML =
    `<span class="cell">wał <b>${Math.round(st.crank % 720)}°</b></span>` +
    `<span class="cell">wałek <b>${Math.round(st.cam % 360)}°</b></span>` +
    `<span class="cell">dolot <b>${st.cylinders[0].inletLift.toFixed(1)}</b> wydech <b>${st.cylinders[0].exhaustLift.toFixed(1)}</b> mm</span>` +
    cells;
}

// ------------------------------------------------------------------- loop
let last = performance.now();
let frames = 0;
function tick(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  if (state.playing) {
    const degPerSec = (state.rpm / 60) * 360 / state.slow;
    state.crank = (state.crank + degPerSec * dt) % 720;
    if (ui.crank) ui.crank.value = String(state.crank);
    if (ui.crankOut) ui.crankOut.textContent = `${Math.round(state.crank)}°`;
  }
  const st = K.state(state.crank, { vanos: state.vanos, throttle: state.throttle });
  engine.update(st, { cut: state.cut, explode: state.explode });
  labelOverlay.update();
  controls.update();
  composer.render();
  updateHud();
  drawChart();
  frames++;
  if (frames === 8) window.__READY = true;
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
  labelOverlay.setGranice(70, h - 90);
});

// ------------------------------------------------------------------- ui wiring
ui.crank?.addEventListener('input', () => {
  state.crank = parseFloat(ui.crank.value);
  state.playing = false;
  if (ui.play) ui.play.textContent = 'ODTWÓRZ';
  syncUi();
});
ui.rpm?.addEventListener('input', () => {
  state.rpm = parseFloat(ui.rpm.value);
  syncUi();
});
ui.vanos?.addEventListener('input', () => {
  state.vanos = parseFloat(ui.vanos.value);
  syncUi();
});
ui.throttle?.addEventListener('input', () => {
  state.throttle = parseFloat(ui.throttle.value);
  syncUi();
});
ui.cut?.addEventListener('input', () => {
  state.cut = parseFloat(ui.cut.value);
});
ui.explode?.addEventListener('input', () => {
  state.explode = parseFloat(ui.explode.value);
});
ui.labels?.addEventListener('change', () => labelOverlay.setVisible(ui.labels.checked));
ui.airbox?.addEventListener('change', () => {
  state.airbox = ui.airbox.checked;
  applyToggles();
});
ui.case?.addEventListener('change', () => {
  state.timingCase = ui.case.checked;
  applyToggles();
});
ui.play?.addEventListener('click', () => {
  state.playing = !state.playing;
  ui.play.textContent = state.playing ? 'PAUZA' : 'ODTWÓRZ';
});
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
window.addEventListener('keydown', (e) => {
  const map = { 1: 'os', 2: 'tq', 3: 'side', 4: 'top', 5: 'head', 6: 'itb', 7: 'timing', 8: 'crank', 9: 'exhaust' };
  if (map[e.key]) setView(map[e.key]);
  if (e.key === ' ') {
    state.playing = !state.playing;
    ui.play.textContent = state.playing ? 'PAUZA' : 'ODTWÓRZ';
    e.preventDefault();
  }
});

// ------------------------------------------------------------------- harness
if (ui.labels) ui.labels.checked = state.labels;
if (ui.airbox) ui.airbox.checked = state.airbox;
if (ui.case) ui.case.checked = state.timingCase;
if (ui.rpm) ui.rpm.value = String(state.rpm);
if (ui.vanos) ui.vanos.value = String(state.vanos);
if (ui.throttle) ui.throttle.value = String(state.throttle);
if (ui.cut) ui.cut.value = String(state.cut);
if (ui.explode) ui.explode.value = String(state.explode);
if (ui.play) ui.play.textContent = state.playing ? 'PAUZA' : 'ODTWÓRZ';
labelOverlay.setVisible(state.labels);
applyToggles();
syncUi();
setView(params.get('view') || 'tq');

window.__engine = engine;
window.__materials = M;
window.__kinematics = K;
window.__state = state;
window.__camera = camera;
window.__setView = setView;
window.__setCut = (v) => {
  state.cut = v;
  if (ui.cut) ui.cut.value = String(v);
};
window.__setExplode = (v) => {
  state.explode = v;
  if (ui.explode) ui.explode.value = String(v);
};
window.__setVanos = (v) => {
  state.vanos = v;
  if (ui.vanos) ui.vanos.value = String(v);
  syncUi();
};
window.__setThrottle = (v) => {
  state.throttle = v;
  if (ui.throttle) ui.throttle.value = String(v);
  syncUi();
};
window.__setRpm = (v) => {
  state.rpm = v;
  if (ui.rpm) ui.rpm.value = String(v);
  syncUi();
};
window.__labelsVisible = (on) => labelOverlay.setVisible(on);
window.__set = (crankDeg) => {
  state.playing = false;
  state.crank = crankDeg;
  if (ui.crank) ui.crank.value = String(crankDeg);
  if (ui.play) ui.play.textContent = 'ODTWÓRZ';
  const st = K.state(state.crank, { vanos: state.vanos, throttle: state.throttle });
  engine.update(st, { cut: state.cut, explode: state.explode });
  labelOverlay.update();
  updateHud();
  drawChart();
  composer.render();
  return window.__stats();
};
window.__stats = () => {
  let meshes = 0;
  let tris = 0;
  engine.root.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    if (g?.index) tris += g.index.count / 3;
    else if (g?.attributes?.position) tris += g.attributes.position.count / 3;
  });
  const st = K.state(state.crank, { vanos: state.vanos, throttle: state.throttle });
  return {
    meshes,
    triangles: Math.round(tris),
    crank: Math.round(state.crank),
    camIn: +K.camAngle(state.crank).toFixed(2),
    camEx: +K.camAngle(state.crank).toFixed(2),
    lift: st.cylinders.map((c) => +c.inletLift.toFixed(2)),
    liftEx: st.cylinders.map((c) => +c.exhaustLift.toFixed(2)),
    crownY: st.cylinders.map((c) => +c.crownY.toFixed(2)),
    pinPhase: K.PIN_PHASE,
    sweep: +K.sweptVolumeTotal().toFixed(2),
    cr: K.compressionRatioFromGeometry(),
    cam: camera.position.toArray().map(Math.round),
    cut: state.cut,
    explode: state.explode,
    vanos: state.vanos,
    throttle: state.throttle,
    chainLinks: engine.parts.chains.map((c) => c.links),
    chainPitch: K.CHAIN.pitch,
    cutTravel: CUT_TRAVEL,
  };
};
window.__liftCurve = (bank, vanos) => {
  const out = [];
  for (let a = 0; a <= 720; a += 15) out.push([a, +K.valveLift(bank, a, vanos).toFixed(3)]);
  return out;
};
