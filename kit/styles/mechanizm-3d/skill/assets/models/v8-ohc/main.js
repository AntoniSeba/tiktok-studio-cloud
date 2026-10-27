// main.js - renderer, studio lighting, post processing, the explainer
// timeline and the on-screen captions.
//
// Deterministic screenshots:  ?t=18.5  renders the timeline at 18.5 s and
// pauses, so a headless browser can capture exact moments.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMaterials, applyMaterialVariation } from './lib/materials.js';
import { buildStudioEnvironment, makeShadowFloor } from './lib/environment.js';
import { buildEngine } from './scene.js';
import { createDirector, DURATION } from './animation.js';
import { createLabels } from './labels.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? parseFloat(params.get(k)) : d);

const host = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const { env, background } = buildStudioEnvironment(renderer);
scene.environment = env;
scene.background = background;

// ------------------------------------------------------------------ lighting
const key = new THREE.DirectionalLight(0xfffaf2, 2.5);
key.position.set(1400, 2100, 1600);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.camera.near = 300;
key.shadow.camera.far = 6500;
key.shadow.camera.left = -700;
key.shadow.camera.right = 700;
key.shadow.camera.top = 700;
key.shadow.camera.bottom = -700;
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0004;
key.shadow.normalBias = 1.6;
key.shadow.radius = 4;
scene.add(key);

const fill = new THREE.DirectionalLight(0xbcd2ea, 0.32);
fill.position.set(-1700, 800, 1200);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.6);
rim.position.set(-600, 1300, -1900);
scene.add(rim);
// warm floor bounce: real metal in a room is lit from below by the floor
const bounce = new THREE.DirectionalLight(0xd9c7a8, 0.22);
bounce.position.set(400, -900, 300);
scene.add(bounce);
scene.add(new THREE.HemisphereLight(0xdce7f4, 0x1b1f24, 0.45));

const floor = makeShadowFloor(9000);
floor.position.y = -196;
floor.name = 'StudioFloor';
scene.add(floor);

// -------------------------------------------------------------------- camera
const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 60, 12000);
camera.position.set(-1200, 700, 1200);
camera.lookAt(0, 230, 0);

// -------------------------------------------------------------------- engine
const M = createMaterials();
// reflections carry most of the "real metal" read, so lean on the environment
for (const k of Object.keys(M)) {
  const m = M[k];
  if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.3;
}
const engine = buildEngine(M);
applyMaterialVariation(engine.root, M);
scene.add(engine.root);
const labelOverlay = createLabels(host, camera, engine.labels);

// ----------------------------------------------------------------- composer
// Render -> screen-space ambient occlusion (the contact shading that makes
// cast metal read as real) -> a little bloom -> output transform -> vignette.
const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  type: THREE.HalfFloatType,
  samples: 4, // MSAA; without it the whole image reads as CG
});
const composer = new EffectComposer(renderer, renderTarget);
composer.addPass(new RenderPass(scene, camera));

const useAO = params.get('ao') !== '0';
if (useAO) {
  // NOTE: this scene is authored in millimetres, so the AO distances have to
  // be in millimetres too (kernel radius ~200 mm reaches into crevices
  // between a bolt and a casting).
  const ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
  ssao.kernelRadius = 190;
  ssao.minDistance = 40;
  ssao.maxDistance = 1400;
  ssao.output = SSAOPass.OUTPUT.Default;
  composer.addPass(ssao);
}

const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.16, 0.7, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.32 },
  },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float strength;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 p = (vUv - 0.5) * vec2(1.02, 1.0);
      float r = length(p) * 1.42;
      float v = smoothstep(1.0, 0.25, r);
      c.rgb *= mix(1.0 - strength, 1.0, v);
      gl_FragColor = c;
    }`,
};
const vignette = new ShaderPass(VignetteShader);
composer.addPass(vignette);
composer.setSize(window.innerWidth, window.innerHeight);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// ------------------------------------------------------------------ director
const ui = {
  caption: document.getElementById('caption'),
  captionTitle: document.getElementById('capTitle'),
  captionSub: document.getElementById('capSub'),
  strokes: document.getElementById('strokes'),
  steps: document.getElementById('steps'),
  readout: document.getElementById('readout'),
  progress: document.getElementById('progressFill'),
  playBtn: document.getElementById('playBtn'),
  replayBtn: document.getElementById('replayBtn'),
  labels: labelOverlay,
};
const director = createDirector({ engine, M, camera, ui });

// --------------------------------------------------------------- playback
let time = num('t', 0);
let playing = !params.has('t');
let last = performance.now();

const setPlaying = (on) => {
  playing = on;
  if (ui.playBtn) ui.playBtn.textContent = on ? 'PAUZA' : 'ODTWÓRZ';
  document.body.classList.toggle('paused', !on);
};

ui.playBtn?.addEventListener('click', () => setPlaying(!playing));
ui.replayBtn?.addEventListener('click', () => {
  time = 0;
  setPlaying(true);
});
document.querySelectorAll('[data-jump]').forEach((b) =>
  b.addEventListener('click', () => {
    time = parseFloat(b.dataset.jump);
    setPlaying(true);
  })
);
document.getElementById('scrub')?.addEventListener('input', (e) => {
  time = (parseFloat(e.target.value) / 1000) * DURATION;
  setPlaying(false);
});
document.querySelectorAll('[data-stroke-jump]').forEach((b) =>
  b.addEventListener('click', () => {
    // jump to the middle of that stroke on cylinder 1
    const offsets = { intake: 90, compression: 270, power: 420, exhaust: 630 };
    time = director.T_ASSEMBLY_END + (offsets[b.dataset.strokeJump] / 720) * director.CYCLE_SECONDS;
    setPlaying(false);
  })
);
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    setPlaying(!playing);
    e.preventDefault();
  }
  if (e.key === 'r') {
    time = 0;
    setPlaying(true);
  }
  if (e.key === '1') {
    time = 2;
    setPlaying(true);
  }
  if (e.key === '2') {
    time = 9;
    setPlaying(true);
  }
  if (e.key === '3') {
    time = 20;
    setPlaying(true);
  }
});

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}
window.addEventListener('resize', onResize);
onResize();

// ------------------------------------------------------------------- loop
let frames = 0;
let lastState = null;

function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (playing) time += dt;

  lastState = director.update(time);
  if (ui.progress) ui.progress.style.width = `${((time % DURATION) / DURATION) * 100}%`;
  const scrub = document.getElementById('scrub');
  if (scrub && playing) scrub.value = String(Math.round(((time % DURATION) / DURATION) * 1000));

  labelOverlay.update();
  composer.render();

  frames++;
  if (frames === 8) window.__READY = true;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ------------------------------------------------------------- test hooks
window.__engine = engine;
window.__director = director;
window.__seek = (t) => {
  time = t;
  setPlaying(false);
  director.update(t);
  labelOverlay.update();
  composer.render();
};
window.__setPlaying = setPlaying;
window.__labelsVisible = (on) => labelOverlay.setVisible(on);

// Na waskim ekranie podpisy czesci musza zmiescic sie miedzy panelem gory
// a podpisem tekstowym, inaczej nachodza na siebie i na pasek odtwarzania.
function ustawGranicePodpisow() {
  if (window.innerWidth > 780) {
    labelOverlay.setGranice();
    return;
  }
  const brand = document.querySelector('.brand');
  const caption = document.getElementById('caption');
  const bar = document.querySelector('.bar');
  const strokes = document.getElementById('strokes');
  const gora = (brand ? brand.getBoundingClientRect().bottom : 120) + 10;
  let dol = window.innerHeight - 10;
  if (caption) dol = Math.min(dol, caption.getBoundingClientRect().top - 10);
  if (bar) dol = Math.min(dol, bar.getBoundingClientRect().top - 10);
  if (strokes && strokes.classList.contains('visible')) {
    dol = Math.min(dol, strokes.getBoundingClientRect().top - 10);
  }
  labelOverlay.setGranice(gora, dol);
}
window.__granicePodpisow = ustawGranicePodpisow;
ustawGranicePodpisow();
window.addEventListener('resize', ustawGranicePodpisow);
setInterval(ustawGranicePodpisow, 700);
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
  state: lastState,
});
window.__probe = () => {
  const out = {};
  for (const vt of engine.valvetrain) {
    const cyl = engine.focus;
    void cyl;
    out[`c${vt.cylId}_${vt.which}`] = +vt.bucket.position.y.toFixed(2);
  }
  out.crank = +(engine.rotating.crank.rotation.z * (180 / Math.PI)).toFixed(1);
  out.cam = +(engine.heads.heads.R.cam.rotation.z * (180 / Math.PI)).toFixed(1);
  out.piston1 = +engine.rotating.cylinders[0].piston.position.clone().toArray().map((v) => +v.toFixed(1)).join(',');
  return out;
};
