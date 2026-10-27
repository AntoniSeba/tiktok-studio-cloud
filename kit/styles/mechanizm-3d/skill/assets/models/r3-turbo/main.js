// main.js - interactive viewer for the 2JZ-GTE model: orbit camera, rpm and
// exploded-view sliders, toggles for the timing cover, the cutaway skins and
// the induction side. Everything moving comes from scene.js update().

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMaterials, applyMaterialVariation } from './lib/materials.js';
import { buildStudioEnvironment, makeShadowFloor } from './lib/environment.js';
import { buildEngine } from './scene.js';
import * as E from './lib/engine.js';

const host = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const envs = buildStudioEnvironment(renderer);
scene.environment = envs.env;
scene.background = envs.background;

const key = new THREE.DirectionalLight(0xfff4e6, 2.6);
key.position.set(-900, 1400, 900);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 100, far: 4000 });
scene.add(key);
const rim = new THREE.DirectionalLight(0x9fc4ff, 1.2);
rim.position.set(900, 500, -1200);
scene.add(rim);
scene.add(new THREE.HemisphereLight(0xcfd8e3, 0x1a1d21, 0.35));

const M = createMaterials();
const eng = buildEngine(M);
applyMaterialVariation(eng.root, M);
eng.root.traverse((o) => {
  if (o.isMesh) {
    o.castShadow = true;
    o.receiveShadow = true;
  }
});
scene.add(eng.root);
const floor = makeShadowFloor();
floor.position.y = -330;
scene.add(floor);

const camera = new THREE.PerspectiveCamera(32, 1, 10, 20000);
camera.position.set(-1500, 700, 1300);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 150, 0);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

function resize() {
  const w = host.clientWidth;
  const h = host.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- controls
const $ = (id) => document.getElementById(id);
const state = { rpm: 900, explode: 0, expTarget: 0 };
$('rpm').addEventListener('input', (e) => {
  state.rpm = +e.target.value;
  $('rpmV').textContent = state.rpm;
});
$('exp').addEventListener('input', (e) => {
  state.expTarget = +e.target.value;
  $('expV').textContent = Math.round(state.expTarget * 100) + '%';
});
const toggle = (id, fn) => {
  const b = $(id);
  b.addEventListener('click', () => {
    b.classList.toggle('on');
    fn(b.classList.contains('on'));
  });
};
const P = eng.parts;
toggle('bCover', (on) => (P.timing.groups.covers.visible = on));
toggle('bSkin', (on) => {
  for (const g of [P.block.groups.skinIn, P.block.groups.skinEx, P.head.groups.skinIn, P.head.groups.skinEx]) g.visible = on;
});
toggle('bInd', (on) => (P.induction.root.visible = on));
toggle('bSpin', (on) => (controls.autoRotate = on));

// ------------------------------------------------------------------- loop
const clock = new THREE.Clock();
let theta = 0;
let turbo = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  // show the crank at a watchable speed: real rpm would be a blur
  theta = (theta + (state.rpm / 60) * 360 * dt * 0.04) % 720;
  turbo = (turbo + (E.turboRpm(state.rpm) / 60) * 360 * dt * 0.0004) % 360;
  state.explode += (state.expTarget - state.explode) * Math.min(1, dt * 6);
  eng.update(theta, { explode: state.explode, turboDeg: turbo });
  $('read').textContent = `wał ${theta.toFixed(0)}°, wałki ${E.camAngleDeg(theta).toFixed(0)}°, doładowanie ${E.boostBar(state.rpm).toFixed(2)} bar`;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
window.__eng = eng;
window.__view = { camera, controls, state };
