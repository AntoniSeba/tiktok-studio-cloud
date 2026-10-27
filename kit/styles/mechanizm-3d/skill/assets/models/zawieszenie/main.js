// main.js - interactive suspension explorer: the corner is driven by the
// constraint solver, so the wishbones, knuckle, tie rod, droplink, coilover and
// driveshaft all stay mechanically consistent while you drag the sliders.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMaterials, applyMaterialVariation } from './lib/materials.js';
import { buildStudioEnvironment, makeStudioFloor } from './lib/environment.js';
import { buildSuspension } from './parts/suspension.js';
import { solveCorner, LIMITS } from './kinematics.js';
import { createLabels } from './labels.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? parseFloat(params.get(k)) : d);
const lq = params.get('lq') === '1';

const host = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: !lq, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const { env, background } = buildStudioEnvironment(renderer);
scene.environment = env;
scene.background = background;

// ------------------------------------------------------------------ lighting
const key = new THREE.DirectionalLight(0xfffaf2, 2.7);
key.position.set(1400, 1900, 1200);
key.castShadow = true;
key.shadow.mapSize.set(lq ? 1024 : 4096, lq ? 1024 : 4096);
key.shadow.camera.near = 200;
key.shadow.camera.far = 6000;
key.shadow.camera.left = -900;
key.shadow.camera.right = 900;
key.shadow.camera.top = 900;
key.shadow.camera.bottom = -900;
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0004;
key.shadow.normalBias = 1.4;
key.shadow.radius = 3.5;
scene.add(key);
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.55);
fill.position.set(-1500, 700, 900);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.9);
rim.position.set(-500, 1200, -1600);
scene.add(rim);
const bounce = new THREE.DirectionalLight(0xd9c7a8, 0.25);
bounce.position.set(300, -900, 400);
scene.add(bounce);
scene.add(new THREE.HemisphereLight(0xdce7f4, 0x1b1f24, 0.55));

const floor = makeStudioFloor(12000);
floor.position.y = 70;
scene.add(floor);

// ------------------------------------------------------------------- model
const M = createMaterials();
for (const k of Object.keys(M)) {
  const m = M[k];
  if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.25;
}
const susp = buildSuspension(M);
applyMaterialVariation(susp.root, M);
scene.add(susp.root);

const BOX = new THREE.Box3().setFromObject(susp.root);
const CENTRE = BOX.getCenter(new THREE.Vector3());
const SIZE = BOX.getSize(new THREE.Vector3());

// ------------------------------------------------------------------ camera
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 20, 20000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 260;
controls.maxDistance = 9000;
const VIEWS = {
  tq: { pos: new THREE.Vector3(CENTRE.x + 1500, CENTRE.y + 950, CENTRE.z + 1650), target: CENTRE.clone() },
  front: { pos: new THREE.Vector3(CENTRE.x + 200, CENTRE.y + 520, CENTRE.z + 2500), target: CENTRE.clone() },
  side: { pos: new THREE.Vector3(CENTRE.x + 2600, CENTRE.y + 260, CENTRE.z + 60), target: CENTRE.clone() },
  top: { pos: new THREE.Vector3(CENTRE.x + 60, CENTRE.y + 2500, CENTRE.z + 130), target: CENTRE.clone() },
  wheel: { pos: new THREE.Vector3(1900, 640, 1500), target: new THREE.Vector3(760, 320, 40) },
  balljoint: { pos: new THREE.Vector3(1180, 300, 620), target: new THREE.Vector3(740, 150, 40) },
  damper: { pos: new THREE.Vector3(1250, 780, 900), target: new THREE.Vector3(535, 400, 8) },
};
function setView(name) {
  const v = VIEWS[name] || VIEWS.tq;
  camera.position.copy(v.pos);
  controls.target.copy(v.target);
  controls.update();
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
}

window.__setView = setView;
window.__camera = camera;
setView(params.get('view') || 'tq');

// ------------------------------------------------------------------ labels
const LABELS = [
  ['Chassis_Rail', 'Podłużnica i mocowanie amortyzatora'],
  ['LOWER_WISHBONE', 'Wahacz dolny (kuty aluminium)'],
  ['UPPER_WISHBONE', 'Wahacz górny'],
  ['Brake_Caliper', 'Zacisk 4-tłoczkowy'],
  ['BrakeDisc_OuterFace', 'Tarcza hamulcowa wentylowana 340 mm'],
  ['Coil_Spring', 'Sprężyna śrubowa'],
  ['TIE_ROD', 'Drążek kierowniczy'],
  ['ANTI_ROLL_BAR', 'Stabilizator z łącznikiem'],
  ['DRIVESHAFT', 'Półoś z przegubami CV'],
];
// the link groups carry their own local frame, so their matrices must be
// updated once before measuring anchors, otherwise the driveshaft and tie rod
// labels point at the world origin.
susp.update(solveCorner(num('travel', 0), num('steer', 0)), 0);
susp.root.updateMatrixWorld(true);
const labels = [];
for (const [name, text] of LABELS) {
  const o = susp.root.getObjectByName(name);
  if (!o) {
    console.warn('label target missing', name);
    continue;
  }
  const b = new THREE.Box3().setFromObject(o);
  const local = o.worldToLocal(b.getCenter(new THREE.Vector3()));
  labels.push({ el: null, object: o, local, text });
}
const labelOverlay = createLabels(host, camera, labels);
window.__anchors = () =>
  labels
    .map((l) => {
      const p = l.object.localToWorld(l.local.clone());
      return l.text.slice(0, 22) + ' @ ' + [p.x, p.y, p.z].map((v) => Math.round(v)).join(',');
    })
    .join('\n');

// ----------------------------------------------------------------- composer
const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  type: THREE.HalfFloatType,
  samples: lq ? 0 : 4,
});
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
if (!lq && params.get('ao') !== '0') {
  const ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
  ssao.kernelRadius = 130;
  ssao.minDistance = 20;
  ssao.maxDistance = 900;
  ssao.output = SSAOPass.OUTPUT.Default;
  composer.addPass(ssao);
}
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.16, 0.65, 0.92));
composer.addPass(new OutputPass());
composer.addPass(
  new ShaderPass({
    uniforms: { tDiffuse: { value: null }, strength: { value: 0.34 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        float r = length(vUv - 0.5) * 1.45;
        c.rgb *= mix(1.0 - strength, 1.0, smoothstep(1.0, 0.2, r));
        gl_FragColor = c;
      }`,
  })
);
composer.setSize(window.innerWidth, window.innerHeight);

// -------------------------------------------------------------------- state
const state = {
  travel: num('travel', 0),
  steer: num('steer', 0),
  speed: 0,
  spin: 0,
  time: num('t', 0),
  auto: params.get('auto') !== '0',
  labels: params.get('labels') !== '0',
  paused: params.has('t'),
  last: performance.now(),
};
setView(params.get('view') || 'tq');
labelOverlay.setVisible(state.labels);

const ui = {
  travel: document.getElementById('travel'),
  steer: document.getElementById('steer'),
  speed: document.getElementById('speed'),
  auto: document.getElementById('auto'),
  labelsToggle: document.getElementById('labels'),
  hud: document.getElementById('hud'),
  play: document.getElementById('play'),
};
if (ui.travel) ui.travel.value = String(state.travel);
if (ui.steer) ui.steer.value = String(state.steer);
if (ui.auto) ui.auto.checked = state.auto;
if (ui.labelsToggle) ui.labelsToggle.checked = state.labels;
ui.play.textContent = state.paused ? 'ODTWÓRZ' : 'PAUZA';

ui.travel?.addEventListener('input', () => {
  state.travel = parseFloat(ui.travel.value);
  state.auto = false;
  if (ui.auto) ui.auto.checked = false;
});
ui.steer?.addEventListener('input', () => {
  state.steer = parseFloat(ui.steer.value) / 60;
  state.auto = false;
  if (ui.auto) ui.auto.checked = false;
});
ui.speed?.addEventListener('input', () => {
  state.speed = parseFloat(ui.speed.value);
});
ui.auto?.addEventListener('change', () => {
  state.auto = ui.auto.checked;
});
ui.labelsToggle?.addEventListener('change', () => {
  state.labels = ui.labelsToggle.checked;
  labelOverlay.setVisible(state.labels);
});
const uiWheel = document.getElementById('wheelOff');
// przy założonym kole tarcza i zacisk są schowane w feldze, więc ich podpisy
// wskazywałyby felgę zamiast części
const INTERIOR_LABELS = ['Tarcza hamulcowa', 'Zacisk 4-tłoczkowy'];
const syncWheelLabels = () => labelOverlay?.setHidden(uiWheel?.checked ? null : INTERIOR_LABELS);
uiWheel?.addEventListener('change', () => {
  susp.groups.rimGroup.visible = !uiWheel.checked;
  syncWheelLabels();
});
syncWheelLabels();
if (params.get('wheeloff') === '1' && uiWheel) {
  uiWheel.checked = true;
  susp.groups.rimGroup.visible = false;
}
window.__wheelOff = (on) => {
  susp.groups.rimGroup.visible = !on;
  if (uiWheel) uiWheel.checked = on;
};
ui.play?.addEventListener('click', () => {
  state.paused = !state.paused;
  ui.play.textContent = state.paused ? 'ODTWÓRZ' : 'PAUZA';
});
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
window.addEventListener('keydown', (e) => {
  const map = { 1: 'tq', 2: 'front', 3: 'side', 4: 'top', 5: 'wheel', 6: 'balljoint', 7: 'damper' };
  if (map[e.key]) setView(map[e.key]);
  if (e.key === ' ') {
    state.paused = !state.paused;
    ui.play.textContent = state.paused ? 'ODTWÓRZ' : 'PAUZA';
    e.preventDefault();
  }
});

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// --------------------------------------------------------------------- loop
let frames = 0;
function tick(now) {
  const dt = Math.min((now - state.last) / 1000, 0.05);
  state.last = now;
  if (!state.paused) {
    state.time += dt;
    if (state.auto) {
      // a slow bump and rebound cycle plus a gentle steering input
      state.travel = Math.sin(state.time * 0.9) * 62;
      state.steer = Math.sin(state.time * 0.37) * 0.85;
      if (ui.travel) ui.travel.value = String(state.travel.toFixed(0));
      if (ui.steer) ui.steer.value = String((state.steer * 60).toFixed(0));
    }
    const s = ui.speed ? parseFloat(ui.speed.value) : 0;
    state.spin += dt * s * (Math.PI / 180) * 60;
  }

  const sol = solveCorner(state.travel, state.steer);
  susp.update(sol, state.spin);

  if (ui.hud) {
    ui.hud.innerHTML = `
      <span>skok koła <b>${state.travel.toFixed(0)} mm</b></span>
      <span>uchylenie <b>${sol.camber.toFixed(2)}°</b></span>
      <span>skręt koła <b>${sol.toe.toFixed(2)}°</b></span>
      <span>amortyzator <b>${sol.damperCompression.toFixed(0)} mm</b></span>
      <span>drążek <b>${(state.steer * 62).toFixed(0)} mm</b></span>`;
  }

  controls.update();
  labelOverlay.update();
  composer.render();
  frames++;
  if (frames === 6) window.__READY = true;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ------------------------------------------------------------ test hooks
window.__susp = susp;
window.__solve = solveCorner;
window.__seek = (t) => {
  state.paused = true;
  state.time = t;
  state.travel = Math.sin(t * 0.9) * 62;
  state.steer = Math.sin(t * 0.37) * 0.85;
  state.spin = t * 9;
  const sol = solveCorner(state.travel, state.steer);
  susp.update(sol, state.spin);
  labelOverlay.update();
  composer.render();
  return { travel: state.travel, camber: sol.camber, toe: sol.toe, damper: sol.damperCompression };
};
window.__set = (travel, steer) => {
  state.travel = travel;
  state.steer = steer;
  state.auto = false;
  const sol = solveCorner(travel, steer);
  susp.update(sol, state.spin);
  return { camber: sol.camber, toe: sol.toe, damper: sol.damperCompression, scrub: sol.scrub };
};
window.__labelsVisible = (on) => labelOverlay.setVisible(on);
window.__stats = () => {
  let n = 0;
  let t = 0;
  susp.root.traverse((o) => {
    if (o.isMesh) {
      n++;
      const g = o.geometry;
      if (g?.index) t += g.index.count / 3;
    }
  });
  return { meshes: n, triangles: Math.round(t), cam: camera.position.toArray().map((v) => Math.round(v)) };
};
window.__limits = LIMITS;
