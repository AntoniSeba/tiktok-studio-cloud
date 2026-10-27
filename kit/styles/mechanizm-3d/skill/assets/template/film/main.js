// Rzędowa piątka jest lepsza od rzędowej szóstki. Bohater: Audi 2.2 T R5 Antoniego
// (projekty/audi-22t-engine), do porównań BMW S54 z filmu o szóstce. Bez napisów na środku.
// Cały obraz jest czystą funkcją czasu (hf-seek). Ruch płynny: bez fleszy, bez trzęsienia.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createMaterials, applyMaterialVariation, setCasingGhost } from "../model/r5-audi/lib/materials.js";
import { buildStudioEnvironment } from "../model/r5-audi/lib/environment.js";
import { buildEngine as build5 } from "../model/r5-audi/scene.js";
import * as K5 from "../model/r5-audi/lib/kinematics.js";
import { createMaterials as createMaterials6, applyMaterialVariation as applyVar6 } from "../model/r6-s54/lib/materials.js";
import { buildEngine as build6 } from "../model/r6-s54/parts/engine.js";
import * as K6 from "../model/r6-s54/kinematics.js";

const W = 1080, H = 1920, D = 166.18, SEAM = 840;
const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

/* ================= matematyka ================= */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
const win = (t, a, b) => clamp01((t - a) / (b - a));
const inR = (t, a, b) => t >= a && t < b;
const D2R = Math.PI / 180;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const wrap = (a, m) => ((a % m) + m) % m;
const f1 = (v) => v.toFixed(1);
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
function mono(keys) {
  const n = keys.length, xs = keys.map((k) => k[0]), ys = keys.map((k) => k[1]);
  if (n === 1) return () => ys[0];
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) { const h = xs[i + 1] - xs[i]; d.push(h > 0 ? (ys[i + 1] - ys[i]) / h : 0); }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; }
  }
  return (t) => {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && t >= xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    if (h <= 0) return ys[i + 1];
    const s = (t - xs[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}
function crankTrack(segs) {
  const K = [[0, 0]];
  let ca = 0, ct = 0;
  for (const [t1, w] of segs) { ca += w * (t1 - ct); ct = t1; K.push([ct, ca]); }
  const last = segs[segs.length - 1][1];
  K.push([D, Math.ceil((ca + last * (D - ct)) / 720) * 720]);
  return mono(K);
}

/* ================= ujęcia ================= */
const SHOTS = [
  [0, 3.11, "3d", "hook"], [3.11, 7.27, "3d", "mem"], [7.27, 9.08, "3d", "promise"],
  [9.08, 12.99, "3d", "promise2"], [12.99, 17.32, "3d", "kontra"], [17.32, 20.27, "board", "gBetween"],
  [20.27, 23.99, "3d", "hero"], [23.99, 26.32, "3d", "anatomy"], [26.32, 29.76, "3d", "crank"], [29.76, 32.02, "3d", "fire"],
  [32.02, 35.55, "board", "gOrder"], [35.55, 37.2, "3d", "len0"], [37.2, 40.99, "3d", "lenR6"], [40.99, 44.59, "3d", "lenSplit"],
  [44.59, 49.66, "board", "gLitres"], [49.66, 53.35, "board", "gTrans"], [53.35, 59.03, "board", "gRows"], [59.03, 60.6, "3d", "moment0"],
  [60.6, 69.79, "board", "gOverlap"], [69.79, 72.86, "3d", "pow5"], [72.86, 79.95, "board", "gOverlap"], [79.95, 81.23, "3d", "sound3d"],
  [81.23, 86.97, "board", "gWaves"], [86.97, 90.75, "board", "gV10"], [90.75, 92.46, "3d", "turbo"], [92.46, 96.31, "board", "gRally"],
  [96.31, 99.33, "3d", "rally3d"], [99.33, 105.23, "board", "gPikes"], [105.23, 106.99, "3d", "trwal"], [106.99, 111.99, "board", "gOdo"],
  [111.99, 114.32, "3d", "simple"], [114.32, 119.99, "board", "gVolvo"], [119.99, 123.86, "3d", "balance"], [123.86, 129.35, "3d", "rock"],
  [129.35, 134.51, "board", "gTrans"], [134.51, 136.04, "3d", "promised"], [136.04, 138.35, "3d", "tfsi"],
  [138.35, 144.99, "board", "gTrophy"], [144.99, 149.1, "board", "gRS3"], [149.1, 152.11, "3d", "final"], [152.11, 153.02, "3d", "pickA"],
  [153.02, 155.92, "3d", "pickB"], [155.92, 164.67, "3d", "yt"], [164.67, D + 1, "3d", "outro"],
];
const shotIdx = (t) => { for (let i = 0; i < SHOTS.length; i++) if (t >= SHOTS[i][0] && t < SHOTS[i][1]) return i; return SHOTS.length - 1; };
const shotAt = (t) => SHOTS[shotIdx(t)];
const SPLIT = new Set(["hook", "outro", "lenSplit", "balance", "final"]);

// wał kręci się cały czas tym samym, spokojnym tempem; D mieści całkowitą liczbę cykli 720°, więc pętla się domyka
const CRANK_RATE = (720 * Math.round((D * 130) / 720)) / D;
const crankAt = (t) => t * CRANK_RATE;
const TB_RATE = (360 * Math.round(2 * D)) / D;

/* ================= renderer i scena ================= */
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.environment = buildStudioEnvironment(renderer).env;
{
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const lin = g.createLinearGradient(0, 0, 0, H);
  lin.addColorStop(0, "#1c232c"); lin.addColorStop(0.45, "#151b22"); lin.addColorStop(1, "#0a0d11");
  g.fillStyle = lin; g.fillRect(0, 0, W, H);
  const rad = g.createRadialGradient(W / 2, H * 0.46, 40, W / 2, H * 0.46, 900);
  rad.addColorStop(0, "rgba(120,150,190,0.16)"); rad.addColorStop(1, "rgba(120,150,190,0)");
  g.fillStyle = rad; g.fillRect(0, 0, W, H);
  for (let x = 0; x <= W; x += 90) for (let y = 0; y <= H; y += 90) {
    const dx = (x - W / 2) / (W * 0.72), dy = (y - H * 0.46) / (H * 0.46);
    const a = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 0.8) * 0.07;
    g.fillStyle = "rgba(150,165,182," + a.toFixed(3) + ")";
    g.fillRect(x, y - 45, 1, 90); g.fillRect(x - 45, y, 90, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}
const key = new THREE.DirectionalLight(0xfffaf2, 2.6);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { near: 300, far: 7500, left: -1500, right: 1500, top: 1500, bottom: -1500 });
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0004; key.shadow.normalBias = 1.6;
scene.add(key); scene.add(key.target);
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.35); scene.add(fill); scene.add(fill.target);
const rim = new THREE.DirectionalLight(0xffffff, 0.7); scene.add(rim); scene.add(rim.target);
scene.add(new THREE.HemisphereLight(0xdce7f4, 0x1b1f24, 0.5));
// światło kluczowe zawsze po stronie kamery, żeby przód silnika nie był pod światło
function lightAt(b, cam) {
  const sx = cam.position.x >= b.x ? 1 : -1, sz = cam.position.z >= b.z ? 1 : -1;
  key.position.set(b.x + sx * 1400, b.y + 2100, b.z + sz * 1600); key.target.position.copy(b);
  fill.position.set(b.x - sx * 1700, b.y + 800, b.z + sz * 1200); fill.target.position.copy(b);
  rim.position.set(b.x - sx * 600, b.y + 1300, b.z - sz * 1900); rim.target.position.copy(b);
  key.target.updateMatrixWorld(); fill.target.updateMatrixWorld(); rim.target.updateMatrixWorld();
}
const camera = new THREE.PerspectiveCamera(32, W / H, 20, 16000);
const cameraB = new THREE.PerspectiveCamera(32, W / H, 20, 16000);

const AMBER = new THREE.Color(0xff8a1c), RED = new THREE.Color(0xff2a10), GREEN = new THREE.Color(0x3cff7a);
function glowMats(obj, col = AMBER) {
  const out = [];
  if (!obj) return out;
  obj.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    o.material = o.material.clone();
    o.material.emissive = col.clone();
    o.material.emissiveIntensity = 0;
    out.push(o.material);
  });
  return out;
}
const setGlow = (mats, k, col) => mats.forEach((m) => { if (col) m.emissive.copy(col); m.emissiveIntensity = k; });
// zdegenerowane normalne dają NaN w shaderze i czarne plamy po SSAO
function fixNormals(root) {
  root.traverse((o) => {
    const n = o.isMesh && o.geometry.attributes.normal;
    if (!n) return;
    let f = false;
    for (let i = 0; i < n.count; i++) if (Math.abs(n.getX(i)) + Math.abs(n.getY(i)) + Math.abs(n.getZ(i)) < 1e-6) { n.setXYZ(i, 0, 1, 0); f = true; }
    if (f) n.needsUpdate = true;
  });
}
const shadows = (root) => root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

/* ================= Audi R5 ================= */
// silnik obrócony tak, żeby wał leżał wzdłuż X jak w S54: przód (+Z modelu) na -X, wydech (+X modelu) na +Z
const M5 = createMaterials();
for (const k of Object.keys(M5)) { const m = M5[k]; if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.3; }
const E5 = build5(M5);
applyMaterialVariation(E5.root, M5);
fixNormals(E5.root);
shadows(E5.root);
const R5H = new THREE.Group(); R5H.rotation.y = -Math.PI / 2; R5H.add(E5.root);
const R5W = new THREE.Group(); R5W.add(R5H); scene.add(R5W);
const crank5 = E5.rotating.crank;
const cyl5 = (id) => E5.rotating.cylinders.find((c) => c.def.id === id);
const CYLS = K5.CYLINDERS;
const pist5 = CYLS.map((c) => glowMats(cyl5(c.id).piston));
const rod5 = CYLS.map((c) => glowMats(cyl5(c.id).rod));
const jour5 = CYLS.map((c) => glowMats(crank5.getObjectByName(`Crank_RodJournal_Cyl${c.id}`)));
const web5 = [];
crank5.children.forEach((o) => { if (/^Crank_(Web|Web2|Counterweight)_/.test(o.name)) web5.push(...glowMats(o)); });
const exh5 = glowMats(E5.accessories.groups.exhaust, RED);
const turb5 = glowMats(E5.turbo.groups.turb, RED);
const snout5 = crank5.children.filter((o) => o.position.z > 225);
const pistonsRoot5 = E5.rotating.root.getObjectByName("PISTONS_AND_RODS");
const fireAt5 = (c) => wrap(c.cycleOffset + 360, 720);
const flash5 = CYLS.map((c) => {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(new THREE.SphereGeometry(44, 24, 16), mat);
  m.position.set(0, K5.LAYOUT.deckHeight - 16, c.z);
  m.scale.set(1, 0.6, 1);
  m.visible = false;
  E5.root.add(m);
  return { c, m, mat };
});
const pow5 = CYLS.map((c) => {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(K5.SPEC.bore / 2 - 2, K5.SPEC.bore / 2 - 2, 1, 32), mat);
  m.visible = false;
  E5.root.add(m);
  return { c, m, mat };
});
// rozkład kaskadą: góra silnika rusza pierwsza
const EX5 = E5.explode.map((x, i) => ({ ...x, k: clamp01(0.5 - x.delta.y / 900 + hash(i) * 0.2) }));
// żar zapłonu: łagodnie narasta przez 30° i gaśnie przez 150°, bez błysku
const softFire = (x) => (x < 30 ? easeIO(x / 30) : x < 180 ? 1 - easeIO((x - 30) / 150) : 0);
const stag = (x, k, spread = 0.6) => easeIO(clamp01(x * (1 + spread) - k * spread));
const CORE5 = [E5.head.groups.covers, E5.accessories.root, E5.turbo.root, E5.block.groups.timingCover, E5.block.groups.filter].filter(Boolean);
const box5 = (() => { E5.update(0); R5W.updateMatrixWorld(true); return new THREE.Box3().setFromObject(E5.root); })();
const worldCenter = (o) => { R5W.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); };
const EXH_C = worldCenter(E5.accessories.groups.exhaust);
const TURBO_C = worldCenter(E5.turbo.root);

/* ================= BMW S54 R6, stanowisko 80 m niżej ================= */
const SP = new THREE.Vector3(0, -80000, 0);
const M6 = createMaterials6();
for (const k of Object.keys(M6)) { const m = M6[k]; if (m && m.isMeshStandardMaterial && m.envMapIntensity !== undefined) m.envMapIntensity *= 1.3; }
const E6 = build6(M6);
applyVar6(E6.root, M6);
fixNormals(E6.root);
shadows(E6.root);
E6.root.position.copy(SP);
scene.add(E6.root);
const P6 = E6.parts;
const crank6Glow = glowMats(P6.crank, GREEN);
const flash6 = [], pow6 = [];
for (let i = 0; i < 6; i++) {
  const fm = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const f = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), fm);
  f.position.set(K6.CYL_X[i], K6.DECK + 14, 0);
  f.scale.set(1, 0.6, 1);
  f.visible = false;
  E6.root.add(f);
  flash6.push({ m: f, mat: fm });
  const pm = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const p = new THREE.Mesh(new THREE.CylinderGeometry(K6.BORE_R - 3, K6.BORE_R - 3, 1, 32), pm);
  p.visible = false;
  E6.root.add(p);
  pow6.push({ m: p, mat: pm });
}
const box6 = (() => { E6.update(K6.state(0), { cut: 0, explode: 0 }); E6.root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(E6.root); })();

/* ================= postprocess ================= */
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
let ssaoPass;
{
  let seed = 20260926;
  const seeded = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const orig = Math.random;
  Math.random = seeded;
  ssaoPass = new SSAOPass(scene, camera, W, H);
  Math.random = orig;
  Object.assign(ssaoPass, { kernelRadius: 190, minDistance: 40, maxDistance: 1400 });
  composer.addPass(ssaoPass);
}
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.22, 0.7, 0.9));
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, strength: { value: 0.3 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 p = (vUv - 0.5) * vec2(1.0, 0.8); float v = smoothstep(0.95, 0.25, length(p) * 1.35); c.rgb *= mix(1.0 - strength, 1.0, v); gl_FragColor = c; }",
}));
composer.setSize(W, H);
function usePassCam(cam) {
  renderPass.camera = cam;
  ssaoPass.camera = cam;
  ssaoPass.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(cam.projectionMatrix);
  ssaoPass.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(cam.projectionMatrixInverse);
}

/* ================= kamera ================= */
// az = 0: od tyłu (+X), SIDE: od strony wydechu R5 (+Z), FRONT: od przodu (-X)
const P = (az, el, r, x, y, z, fov, oy) => ({ az, el, r, x, y, z, fov, oy });
const Ps = (az, el, r, x, y, z, fov, oy) => ({ az, el, r, x: SP.x + x, y: SP.y + y, z: SP.z + z, fov, oy });
const Pv = (az, el, r, v, fov, oy) => ({ az, el, r, x: v.x, y: v.y, z: v.z, fov, oy });
const SIDE = Math.PI / 2, FRONT = Math.PI;
const P0A = P(2.35, 0.22, 5000, 0, 110, 0, 32, 390);
const P0B = Ps(2.35, 0.2, 4700, 0, 130, 0, 32, -200);
const CAM = {
  hookA: [[0, P0A], [3.11, P(2.1, 0.17, 4700, 0, 110, 0, 32, 390)]],
  hookB: [[0, P0B], [3.11, Ps(2.1, 0.16, 4400, 0, 130, 0, 32, -200)]],
  mem: [[3.11, Ps(2.6, 0.18, 3700, 0, 140, 0, 32, 60)], [7.27, Ps(SIDE + 0.12, 0.08, 3400, 0, 140, 0, 32, 60)]],
  promise: [[7.27, P(1.1, 0.3, 5400, 0, 220, 0, 32, 60)], [9.08, P(0.85, 0.26, 5100, 0, 220, 0, 32, 60)]],
  promise2: [[9.08, P(-0.9, 0.3, 5400, 0, 220, 0, 32, 80)], [12.99, P(-1.35, 0.22, 4900, 0, 220, 0, 32, 80)]],
  kontra: [[12.99, P(2.5, 0.16, 3400, 0, 110, 0, 32, 60)], [17.32, P(1.3, 0.34, 3000, 0, 110, 0, 32, 60)]],
  hero: [[20.27, P(-2.5, 0.12, 3400, 0, 110, 0, 32, 60)], [23.99, P(-2.05, 0.16, 3050, 0, 110, 0, 32, 60)]],
  anatomy: [[23.99, P(SIDE + 0.35, 0.35, 3100, 0, 120, 0, 32, -20)], [26.32, P(SIDE + 0.2, 0.3, 2950, 0, 120, 0, 32, -20)]],
  crank: [[26.32, P(FRONT - 0.5, 0.25, 2000, 0, 0, 0, 30, -60)], [27.4, P(FRONT - 0.04, 0.02, 2000, 0, 0, 0, 30, -60)], [29.76, P(FRONT, 0, 2000, 0, 0, 0, 30, -60)]],
  fire: [[29.76, P(0.35, 0.62, 2900, 0, 110, 0, 32, 170)], [32.02, P(0.6, 0.56, 2750, 0, 110, 0, 32, 170)]],
  len0: [[35.55, P(SIDE + 0.6, 0.2, 3400, 0, 110, 0, 32, 60)], [37.2, P(SIDE + 0.4, 0.16, 3200, 0, 110, 0, 32, 60)]],
  lenR6: [[37.2, Ps(SIDE, 0.06, 4000, 0, 150, 0, 32, 60)], [40.99, Ps(SIDE + 0.04, 0.06, 3800, 0, 150, 0, 32, 60)]],
  lenSplitA: [[40.99, Ps(SIDE, 0.04, 5100, 0, 150, 0, 32, 490)], [44.59, Ps(SIDE, 0.04, 5000, 0, 150, 0, 32, 490)]],
  lenSplitB: [[40.99, P(SIDE, 0.04, 5100, 0, 150, 0, 32, -120)], [44.59, P(SIDE, 0.04, 5000, 0, 150, 0, 32, -120)]],
  moment0: [[59.03, P(0.9, 0.35, 3100, 0, 110, 0, 32, 60)], [60.6, P(0.7, 0.3, 2950, 0, 110, 0, 32, 60)]],
  pow5: [[69.79, P(SIDE - 0.3, 0.4, 2800, 0, 120, 0, 32, 120)], [72.86, P(SIDE - 0.1, 0.34, 2650, 0, 120, 0, 32, 120)]],
  sound3d: [[79.95, Pv(SIDE + 0.35, 0.16, 2700, EXH_C, 32, 60)], [81.23, Pv(SIDE + 0.15, 0.14, 2700, EXH_C, 32, 60)]],
  turbo: [[90.75, Pv(SIDE - 0.55, 0.3, 2500, TURBO_C, 32, 60)], [92.46, Pv(SIDE - 0.3, 0.24, 2500, TURBO_C, 32, 60)]],
  rally3d: [[96.31, P(-0.6, 0.28, 4800, 0, 200, 0, 32, 60)], [99.33, P(-0.95, 0.22, 4500, 0, 200, 0, 32, 60)]],
  trwal: [[105.23, P(0.45, 0.32, 2700, 0, 60, 0, 32, 60)], [106.99, P(0.65, 0.26, 2700, 0, 60, 0, 32, 60)]],
  simple: [[111.99, P(2.3, 0.2, 3300, 0, 110, 0, 32, 130)], [114.32, P(2.05, 0.16, 3100, 0, 110, 0, 32, 130)]],
  balanceA: [[119.99, Ps(0.8, 0.22, 4300, 0, 140, 0, 32, 430)], [123.86, Ps(1.05, 0.2, 4150, 0, 140, 0, 32, 430)]],
  balanceB: [[119.99, P(0.8, 0.22, 4300, 0, 110, 0, 32, -190)], [123.86, P(1.05, 0.2, 4150, 0, 110, 0, 32, -190)]],
  rock: [[123.86, P(SIDE, 0.06, 3500, 0, 130, 0, 32, 60)], [129.35, P(SIDE - 0.5, 0.22, 3050, 0, 130, 0, 32, 60)]],
  promised: [[134.51, P(0.95, 0.3, 3700, 0, 110, 0, 32, 60)], [136.04, P(0.75, 0.25, 3500, 0, 110, 0, 32, 60)]],
  tfsi: [[136.04, P(-0.6, 0.12, 3100, 0, 110, 0, 32, 80)], [138.35, P(-0.25, 0.1, 2800, 0, 110, 0, 32, 80)]],
  finalA: [[149.1, Ps(2.3, 0.2, 4300, 0, 140, 0, 32, 430)], [152.11, Ps(2.05, 0.18, 4150, 0, 140, 0, 32, 430)]],
  finalB: [[149.1, P(2.3, 0.2, 4300, 0, 110, 0, 32, -190)], [152.11, P(2.05, 0.18, 4150, 0, 110, 0, 32, -190)]],
  pickA: [[152.11, P(0.9, 0.22, 3400, 0, 110, 0, 32, 280)], [153.02, P(0.8, 0.2, 3300, 0, 110, 0, 32, 280)]],
  pickB: [[153.02, Ps(-0.9, 0.22, 4400, 0, 140, 0, 32, 280)], [155.92, Ps(-1.15, 0.18, 4400, 0, 140, 0, 32, 280)]],
  yt: [[155.92, P(1.3, 0.26, 6900, 0, 250, 0, 32, 330)], [164.67, P(-0.4, 0.3, 6900, 0, 250, 0, 32, 330)]],
  outroA: [[164.67, P(2.65, 0.28, 5500, 0, 110, 0, 32, 390)], [D, P0A], [D + 1, P(2.27, 0.204, 4900, 0, 110, 0, 32, 390)]],
  outroB: [[164.67, Ps(2.65, 0.26, 5200, 0, 130, 0, 32, -200)], [D, P0B], [D + 1, Ps(2.27, 0.187, 4600, 0, 130, 0, 32, -200)]],
};
// bez pompowania: w obrębie ujęcia kamera krąży w stałej odległości, nigdy nie przybliża i nie oddala
for (const name in CAM) {
  const loop = /^(hook|outro)/.test(name);
  const r = loop ? (name.endsWith("A") ? P0A.r : P0B.r) : CAM[name][CAM[name].length - 1][1].r;
  CAM[name] = CAM[name].map(([tk, k]) => [tk, { ...k, r }]);
}
const PKEYS = ["az", "el", "r", "x", "y", "z", "fov", "oy"];
const CAMF = {};
for (const name in CAM) { CAMF[name] = {}; PKEYS.forEach((p) => { CAMF[name][p] = mono(CAM[name].map((k) => [k[0], k[1][p]])); }); }
const camTgt = new THREE.Vector3();
function applyCam(t, name, cam = camera, si = shotIdx(t)) {
  const f = CAMF[name], v = {};
  PKEYS.forEach((p) => { v[p] = f[p](t); });
  if (si > 0 && si < SHOTS.length - 1) {
    // każde cięcie wchodzi płynnym dojazdem
    const cut = 1 - easeIO(win(t, SHOTS[si][0], SHOTS[si][0] + 1.1));
    v.az += (hash(si * 3.1) > 0.5 ? 1 : -1) * 0.07 * cut;
  }
  const jit = clamp01(t / 1.0) * clamp01((D - t) / 1.0);
  v.az += jit * 0.006 * Math.sin(t * 0.37 + 1.3);
  v.el += jit * 0.004 * Math.sin(t * 0.53);
  camTgt.set(v.x, v.y, v.z);
  const r = v.r;
  cam.position.set(v.x + Math.cos(v.az) * Math.cos(v.el) * r, v.y + Math.sin(v.el) * r, v.z + Math.sin(v.az) * Math.cos(v.el) * r);
  cam.fov = v.fov;
  cam.setViewOffset(W, H, 0, v.oy, W, H);
  cam.updateProjectionMatrix();
  cam.lookAt(camTgt);
  cam.updateMatrixWorld();
}

/* ================= stan silników ================= */
const blank = () => ({ e: 0, g: 0, core: 0, crankOnly: 0, fire: 0, pow: 0, pist: 0, pin: 0, web: 0, exh: 0, turb: 0, rock: 0, fire6: 0, pow6: 0, ex6: 0, crank6: 0 });
const hookE = (t) => 0.3 * (1 - easeOut(win(t, 0, 1.6)));
function states(t, name, panel) {
  const s = blank();
  let base = new THREE.Vector3();
  switch (name) {
    case "hook": if (panel === "A") { s.e = hookE(t); s.fire = 1; } else { base = SP; s.fire6 = 1; } break;
    case "outro": if (panel === "A") { s.e = 0.3 * easeIO(win(t, 164.67, D)); s.fire = 1; } else { base = SP; s.fire6 = 1; } break;
    case "mem": base = SP; s.fire6 = 1; break;
    case "promise": s.e = 0.75; break;
    case "promise2": s.e = 0.75 * (1 - easeIO(win(t, 9.08, 11.4))); break;
    case "kontra": break;
    case "hero": s.fire = 1; break;
    case "anatomy": s.g = 1; s.core = 1; s.pist = 0.9 * easeOut(win(t, 24.24, 24.8)); break;
    case "crank": s.crankOnly = 1; s.pin = 0.5 * easeOut(win(t, 27.12, 27.5)); break;
    case "fire": s.g = 1; s.core = 1; s.fire = 1; break;
    case "len0": break;
    case "lenR6": base = SP; break;
    case "lenSplit": if (panel === "A") base = SP; break;
    case "moment0": s.g = 1; s.core = 1; s.pow = 1; s.fire = 1; break;
    case "pow5": s.g = 1; s.core = 1; s.pow = 1; s.fire = 1; break;
    case "sound3d": s.exh = 0.7 * easeOut(win(t, 80.0, 80.5)); s.fire = 1; break;
    case "turbo": s.turb = 0.35 * easeOut(win(t, 90.9, 91.6)); s.exh = 0.15; break;
    case "rally3d": s.e = 0.45 * easeIO(win(t, 96.31, 97.6)); s.turb = 0.3; break;
    case "trwal": s.g = 1; s.core = 1; s.web = 0.6 * easeOut(win(t, 105.4, 105.9)); s.pin = 0.6 * easeOut(win(t, 105.4, 105.9)); break;
    case "simple": break;
    case "balance":
      if (panel === "A") { base = SP; s.crank6 = 0.9 * easeOut(win(t, 121.42, 121.8)); }
      else { s.rock = easeOut(win(t, 122.8, 123.3)); }
      break;
    case "rock": s.rock = 1; break;
    case "promised": break;
    case "tfsi": s.fire = 1; s.turb = 0.35; break;
    case "final": if (panel === "A") base = SP; break;
    case "pickA": s.fire = 1; break;
    case "pickB": base = SP; s.fire6 = 1; break;
    case "yt": s.e = easeIO(win(t, 156.3, 162.6)); break;
  }
  return { s, base };
}

function pose5(st, deg, t) {
  E5.update(deg, { turboDeg: t * TB_RATE, boost: 0.6 });
  for (const x of EX5) x.obj.position.copy(x.rest).addScaledVector(x.delta, st.e > 0 ? stag(st.e, x.k) : 0);
  const co = !!st.crankOnly;
  E5.block.root.visible = !co;
  E5.head.root.visible = !co;
  E5.rotating.flywheel.visible = !co;
  E5.rotating.timing.visible = !co;
  pistonsRoot5.visible = !co;
  snout5.forEach((o) => { o.visible = !co; });
  CORE5.forEach((o) => { o.visible = !co && !st.core; });
  setCasingGhost(M5, st.g);
  CYLS.forEach((c, i) => {
    setGlow(pist5[i], st.pist);
    setGlow(rod5[i], st.pist * 0.6);
    setGlow(jour5[i], st.pin * 1.6);
  });
  setGlow(web5, st.web);
  setGlow(exh5, st.exh);
  setGlow(turb5, st.turb);
  const cm = wrap(deg, 720);
  let n = 0;
  flash5.forEach((f) => {
    let k = 0;
    if (st.fire && !co) k = softFire(wrap(cm - fireAt5(f.c), 720));
    f.m.visible = k > 0.01;
    f.mat.opacity = 0.45 * k;
    f.mat.color.setRGB(1.3, 0.55, 0.16);
  });
  pow5.forEach((g) => {
    const ph = K5.cycleAngle(g.c, deg);
    const on = !!st.pow && ph >= 360 && ph < 540 && !co;
    g.m.visible = on;
    if (!on) return;
    n++;
    const { s } = K5.pistonPinDistance(g.c, deg);
    const crown = s + K5.LAYOUT.pistonCompressionHeight;
    const len = Math.max(2, K5.LAYOUT.deckHeight - crown);
    g.m.scale.set(1, len, 1);
    g.m.position.set(0, crown + len / 2, g.c.z);
    const f = (ph - 360) / 180;
    g.mat.opacity = 0.55 * Math.sin(Math.PI * f);
    g.mat.color.setRGB(1.3 - 0.3 * f, 0.5 - 0.2 * f, 0.12);
  });
  E5.powCount = n;
  // kołysanie wzdłuż silnika: niewyrównany moment od sił bezwładności, pokazany bardzo delikatnie
  R5W.rotation.z = -st.rock * 0.008 * Math.sin(deg * D2R);
  R5W.updateMatrixWorld(true);
}
function pose6(st, deg) {
  E6.update(K6.state(deg), { cut: 0, explode: st.ex6 });
  setGlow(crank6Glow, st.crank6, GREEN);
  for (let i = 0; i < 6; i++) {
    const ph = K6.cyclePhase(i + 1, deg);
    const k = st.fire6 ? softFire(ph) : 0;
    flash6[i].m.visible = k > 0.01;
    flash6[i].mat.opacity = 0.45 * k;
    flash6[i].mat.color.setRGB(1.3, 0.55, 0.16);
    const on = !!st.pow6 && ph < 180;
    pow6[i].m.visible = on;
    if (on) {
      const crown = K6.pistonCrownY(i + 1, deg), len = Math.max(2, K6.DECK + 10 - crown);
      pow6[i].m.scale.set(1, len, 1);
      pow6[i].m.position.set(K6.CYL_X[i], crown + len / 2, 0);
      pow6[i].mat.opacity = 0.55 * Math.sin(Math.PI * (ph / 180));
    }
  }
  E6.root.updateMatrixWorld(true);
}

/* ================= nakładki 2D ================= */
const svg = $("svg"), ui = $("ui"), shadeBot = document.querySelector(".shade-bot");
let projCam = camera;
const _pv = new THREE.Vector3(), _w = new THREE.Vector3();
function project(v) { _pv.copy(v).project(projCam); return { x: (_pv.x * 0.5 + 0.5) * W, y: (-_pv.y * 0.5 + 0.5) * H }; }
function place(el, x, y) { el.style.left = x.toFixed(1) + "px"; el.style.top = y.toFixed(1) + "px"; }
function localPoint(frame, x, y, z) { _w.set(x, y, z); frame.localToWorld(_w); return project(_w); }
const pop = (el, t, at, dur = 0.22, dy = 26) => {
  const k = easeOut(win(t, at, at + dur * 1.6));
  el.style.opacity = k;
  el.style.transform = "translateY(" + ((1 - k) * dy).toFixed(1) + "px)";
  return k;
};
const popS = (el, t, at, dy = 30) => { const k = easeOut(win(t, at, at + 0.4)); el.setAttribute("opacity", f1(k)); el.setAttribute("transform", `translate(0 ${f1((1 - k) * dy)})`); return k; };
const show = (el, on) => { el.style.display = on ? "" : "none"; };
const mkEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const mkT = (txt, attrs, parent) => { const e = mkEl("text", attrs, parent); e.textContent = txt; return e; };
const dash = (el, k, L = 1600) => { el.style.strokeDasharray = L; el.style.strokeDashoffset = L * (1 - k); };
const setH = (el, h, t, at) => { if (el.innerHTML !== h) el.innerHTML = h; pop(el, t, at, 0.22, 20); };
const stepH = (el, t, list) => { let cur = list[0]; for (const x of list) if (t >= x[0]) cur = x; setH(el, cur[1], t, cur[0]); };

// etykiety z linią
const TAGS = [
  { t0: 80.1, t1: 81.23, text: "Wydech", a: () => EXH_C, off: [-150, -300], c: "hot" },
  { t0: 90.95, t1: 92.46, text: "Turbo", a: () => TURBO_C, off: [-190, -280], c: "oil" },
];
TAGS.forEach((tg) => {
  tg.el = document.createElement("div");
  tg.el.className = "tag " + tg.c;
  tg.el.textContent = tg.text;
  $("tags").appendChild(tg.el);
  const col = { hot: "#e2492b", ok: "#86dba1" }[tg.c] || "#f5aa3c";
  tg.line = mkEl("path", { fill: "none", stroke: col, "stroke-width": 2.5 }, $("tagLines"));
  tg.dot = mkEl("circle", { r: 7, fill: col }, $("tagLines"));
});
function drawTags(t) {
  const sh = shotAt(t);
  for (const tg of TAGS) {
    const on = inR(t, tg.t0, tg.t1 + 0.18) && sh === shotAt(tg.t0);
    if (!on) { tg.el.style.opacity = 0; tg.line.setAttribute("opacity", 0); tg.dot.setAttribute("opacity", 0); continue; }
    const ap = easeOut(win(t, tg.t0, tg.t0 + 0.35)) * (1 - win(t, tg.t1, tg.t1 + 0.18));
    const p = project(tg.a());
    let x = p.x + tg.off[0], y = p.y + tg.off[1];
    x = Math.max(190, Math.min(y > 1000 ? 700 : 880, x));
    y = Math.max(560, Math.min(1400, y));
    place(tg.el, x, y);
    tg.el.style.opacity = ap;
    tg.line.setAttribute("d", `M ${f1(x)} ${f1(y)} L ${f1(p.x)} ${f1(p.y)}`);
    const len = Math.hypot(p.x - x, p.y - y);
    tg.line.style.strokeDasharray = len;
    tg.line.style.strokeDashoffset = len * (1 - ap);
    tg.line.setAttribute("opacity", 0.9);
    tg.dot.setAttribute("cx", p.x); tg.dot.setAttribute("cy", p.y);
    tg.dot.setAttribute("opacity", clamp01((ap - 0.6) / 0.4));
  }
}
// numery cylindrów nad głowicą
const badges = CYLS.map((c) => { const el = document.createElement("div"); el.className = "badge"; el.textContent = String(c.id); $("badges").appendChild(el); return { el, c }; });
// gwiazda wykorbień z przodu wału: 5 ramion co 72°
const STAR_Z = K5.LAYOUT.frontZ + 10;
const starArms = CYLS.map((c) => {
  const ln = mkEl("path", { fill: "none", stroke: "#f5aa3c", "stroke-width": 12, "stroke-linecap": "round" }, $("star"));
  const cc = mkEl("circle", { r: 26, fill: "rgba(10,14,19,0.92)", stroke: "#f5aa3c", "stroke-width": 4 }, $("star"));
  const tx = mkT(String(c.id), { "text-anchor": "middle", "dominant-baseline": "central", style: "font-size:28px;font-weight:600;fill:#eef2f7" }, $("star"));
  return { c, ln, cc, tx };
});
const starHub = mkEl("circle", { r: 16, fill: "#f5aa3c" }, $("star"));
const starArc = mkEl("path", { fill: "rgba(245,170,60,0.16)", stroke: "#eef2f7", "stroke-width": 3 }, $("star"));
const starArcT = mkT("72°", { "text-anchor": "middle", "dominant-baseline": "central", style: "font-size:54px;font-weight:600;fill:#f5aa3c;paint-order:stroke;stroke:rgba(6,8,11,0.92);stroke-width:10px" }, $("star"));
function drawStar(t, on) {
  $("star").setAttribute("opacity", on ? 1 : 0);
  if (!on) return;
  const hub = localPoint(crank5, 0, 0, STAR_Z);
  starHub.setAttribute("cx", f1(hub.x)); starHub.setAttribute("cy", f1(hub.y));
  const R = 118;
  starArms.forEach((arm, i) => {
    const k = easeOut(win(t, 27.12 + i * 0.14, 27.12 + i * 0.14 + 0.45));
    const a = arm.c.journalAngle * D2R;
    const e = localPoint(crank5, Math.cos(a) * R * k, Math.sin(a) * R * k, STAR_Z);
    arm.ln.setAttribute("d", `M ${f1(hub.x)} ${f1(hub.y)} L ${f1(e.x)} ${f1(e.y)}`);
    arm.ln.setAttribute("opacity", k > 0.01 ? 1 : 0);
    const lab = localPoint(crank5, Math.cos(a) * 152, Math.sin(a) * 152, STAR_Z);
    const lk = clamp01((k - 0.7) / 0.3);
    arm.cc.setAttribute("cx", f1(lab.x)); arm.cc.setAttribute("cy", f1(lab.y));
    arm.tx.setAttribute("x", f1(lab.x)); arm.tx.setAttribute("y", f1(lab.y));
    arm.cc.setAttribute("opacity", lk); arm.tx.setAttribute("opacity", lk);
  });
  // łuk 72° między ramieniem cylindra 1 i 5
  const ak = easeOut(win(t, 28.4, 28.8));
  const a0 = CYLS.find((c) => c.id === 1).journalAngle, a1 = CYLS.find((c) => c.id === 5).journalAngle;
  let d = `M ${f1(hub.x)} ${f1(hub.y)}`;
  for (let i = 0; i <= 16; i++) { const a = lerp(a0, lerp(a0, a1, ak), i / 16) * D2R; const p = localPoint(crank5, Math.cos(a) * 96, Math.sin(a) * 96, STAR_Z); d += ` L ${f1(p.x)} ${f1(p.y)}`; }
  starArc.setAttribute("d", d + " Z");
  starArc.setAttribute("opacity", ak > 0.01 ? 1 : 0);
  const am = ((a0 + a1) / 2) * D2R, pt = localPoint(crank5, Math.cos(am) * 190, Math.sin(am) * 190, STAR_Z);
  starArcT.setAttribute("x", f1(pt.x)); starArcT.setAttribute("y", f1(pt.y));
  starArcT.setAttribute("opacity", ak);
}
// tarcza zapłonu: 5 znaczników co 144° w cyklu 720°
const dialTicks = CYLS.map(() => mkEl("circle", { r: 11 }, $("dialTicks")));
function drawDial(on, deg, k0) {
  $("dial").setAttribute("opacity", on ? k0 : 0);
  if (!on) return;
  const cm = wrap(deg, 720);
  const rad = (cm / 2 - 90) * D2R;
  $("dialP").setAttribute("x2", f1(200 + Math.cos(rad) * 92));
  $("dialP").setAttribute("y2", f1(1290 + Math.sin(rad) * 92));
  dialTicks.forEach((e, i) => {
    const fa = fireAt5(CYLS[i]);
    const r2 = (fa / 2 - 90) * D2R;
    e.setAttribute("cx", f1(200 + Math.cos(r2) * 80));
    e.setAttribute("cy", f1(1290 + Math.sin(r2) * 80));
    const x = wrap(cm - fa, 720), k = x < 80 ? 1 - x / 80 : 0;
    e.setAttribute("r", f1(10 + 7 * k));
    e.setAttribute("fill", k > 0 ? "#ffd08a" : "#f5aa3c");
  });
}
// wymiary długości bloku
const dimG = $("dim");
const mkDim = (col, dashed) => {
  const g = mkEl("g", {}, dimG);
  const ln = mkEl("path", { fill: "none", stroke: col, "stroke-width": 5, "stroke-dasharray": dashed ? "14 10" : "none" }, g);
  const tx = mkT("", { "text-anchor": "middle", style: `font-size:34px;fill:${col};paint-order:stroke;stroke:rgba(6,8,11,0.92);stroke-width:10px` }, g);
  return { g, ln, tx };
};
const DIMS = [mkDim("#ff6a4d"), mkDim("#86dba1"), mkDim("#ff6a4d", true), mkDim("#ff6a4d", true)];
function dimLine(dm, cam, a, b, label, k, below) {
  projCam = cam;
  const pa = project(a), pb = project(b);
  projCam = camera;
  const x1 = lerp(pa.x, pb.x, k);
  const tk = below ? 18 : -18;
  dm.ln.setAttribute("d", `M ${f1(pa.x)} ${f1(pa.y - tk)} L ${f1(pa.x)} ${f1(pa.y)} L ${f1(x1)} ${f1(pb.y)}` + (k > 0.98 ? ` L ${f1(pb.x)} ${f1(pb.y - tk)}` : ""));
  dm.tx.textContent = label;
  dm.tx.setAttribute("x", f1((pa.x + pb.x) / 2));
  dm.tx.setAttribute("y", f1(pa.y + (below ? 46 : -22)));
  dm.tx.setAttribute("opacity", clamp01((k - 0.6) / 0.4));
  dm.g.setAttribute("opacity", k > 0.01 ? 1 : 0);
}
const HL6 = K6.HALF_LENGTH, HL5 = K5.LAYOUT.blockLength / 2;
function drawDims(t, name) {
  const on = name === "lenR6" || name === "lenSplit";
  dimG.setAttribute("opacity", on ? 1 : 0);
  DIMS.forEach((d) => d.g.setAttribute("opacity", 0));
  if (!on) return;
  if (name === "lenR6") {
    const y = box6.max.y + 50;
    dimLine(DIMS[0], camera, new THREE.Vector3(SP.x - HL6, y, SP.z), new THREE.Vector3(SP.x + HL6, y, SP.z), "6 cylindrów", easeIO(win(t, 40.1, 40.9)), false);
    return;
  }
  const y6 = box6.min.y - 40, y5 = box5.min.y - 40;
  dimLine(DIMS[0], camera, new THREE.Vector3(SP.x - HL6, y6, SP.z), new THREE.Vector3(SP.x + HL6, y6, SP.z), "R6 · 6 cylindrów", easeIO(win(t, 41.0, 41.6)), true);
  dimLine(DIMS[1], cameraB, new THREE.Vector3(-HL5, y5, 0), new THREE.Vector3(HL5, y5, 0), "R5 · 5 cylindrów", easeIO(win(t, 41.62, 42.2)), true);
  // brakujący cylinder: szóstka narysowana w skali piątki
  const gk = easeIO(win(t, 42.52, 43.1));
  dimLine(DIMS[2], cameraB, new THREE.Vector3(-HL5, y5, 0), new THREE.Vector3(-HL6, y5, 0), "", gk, true);
  dimLine(DIMS[3], cameraB, new THREE.Vector3(HL5, y5, 0), new THREE.Vector3(HL6, y5, 0), "", gk, true);
}
// strzałki kołysania na końcach silnika
const rockA = mkEl("path", { fill: "none", stroke: "#ff6a4d", "stroke-width": 9, "stroke-linecap": "round", "stroke-linejoin": "round" }, $("rockG"));
const rockB = mkEl("path", { fill: "none", stroke: "#ff6a4d", "stroke-width": 9, "stroke-linecap": "round", "stroke-linejoin": "round" }, $("rockG"));
function arrowD(x, y0, dy) {
  const y1 = y0 - dy, s = Math.sign(dy) || 1, h = Math.min(26, Math.abs(dy) * 0.6);
  return `M ${f1(x)} ${f1(y0)} L ${f1(x)} ${f1(y1)} M ${f1(x - h)} ${f1(y1 + s * h)} L ${f1(x)} ${f1(y1)} L ${f1(x + h)} ${f1(y1 + s * h)}`;
}
function drawRock(t, name, deg, cam) {
  const on = name === "rock" || (name === "balance" && t >= 122.8);
  $("rockG").setAttribute("opacity", on ? easeOut(win(t, name === "balance" ? 122.8 : SHOTS[shotIdx(t)][0] + 0.2, (name === "balance" ? 122.8 : SHOTS[shotIdx(t)][0] + 0.2) + 0.4)) : 0);
  if (!on) return;
  projCam = cam;
  const y = box5.max.y + 80;
  const pf = project(new THREE.Vector3(-HL5 - 40, y, 0)), pr = project(new THREE.Vector3(HL5 + 40, y, 0));
  projCam = camera;
  const s = Math.sin(deg * D2R) * 110;
  rockA.setAttribute("d", arrowD(pf.x, pf.y, s));
  rockB.setAttribute("d", arrowD(pr.x, pr.y, -s));
}

/* ================= górny blok ================= */
const TOPS = [
  [3.15, "Tak, wiem", "Sam <em>mówiłem</em>"],
  [5.11, "Poprzedni odcinek", "R6 to <em>najlepszy silnik</em> na świecie"],
  [9.1, "Pięciocylindrowiec", "<em>9 razy</em> z rzędu"],
  [11.68, "Tytuł", "<em>Silnik roku</em>"],
  [13.02, "Tylko że", "Prawie nikt <span class=\"hot\">nie robi piątek</span>"],
  [15.73, "Mówi się", "Że to..."],
  [16.52, "Mówi się", "To <span class=\"hot\">dziwoląg</span>"],
  [20.3, "Więc czemu", "Kto ją zna,"],
  [21.69, "Kto ją zna,", "<em>Nie chce innej</em>"],
  [24.02, "Budowa", "<em>5</em> cylindrów w rzędzie"],
  [26.35, "Budowa", "<em>1</em> wał"],
  [27.12, "Budowa", "<em>5</em> wykorbień"],
  [29.78, "Zapłon", "Co <em>144°</em>"],
  [35.58, "Powód 1", "<em>Długość</em>"],
  [37.22, "Szóstka ma", "Jedną <em>wadę</em>"],
  [39.96, "Szóstka", "Jest <span class=\"hot\">długa</span>"],
  [59.05, "Powód 2", "<em>Moment</em>"],
  [69.81, "W piątce", "Zapłon co <em>144°</em>"],
  [79.97, "Powód 3", "<em>Dźwięk</em>"],
  [90.77, "Powód 4", "<em>Wyścigi</em>"],
  [96.33, "Audi Quattro", "Rozniosło <em>rajdy</em>"],
  [97.11, "Grupa B", "<em>Sport Quattro</em>"],
  [105.25, "Powód 5", "<em>Trwałość</em>"],
  [112.0, "Diesel Mercedesa", "<em>Pięć</em> cylindrów"],
  [123.88, "Zostaje jej", "Lekkie <em>kołysanie</em>"],
  [125.44, "Kołysanie", "<em>Wzdłuż</em> silnika"],
  [126.53, "Dlatego piątki", "Są odrobinę <span class=\"hot\">szorstkie</span>"],
];
// górny blok zależy od renderowanego ujęcia, więc przy przenikaniu w planszę zostaje i gaśnie razem z 3D
const topEl = $("top"), topK = $("topK"), topH = $("topH");
let curTop = -2;
function drawTop(t, si) {
  let ti = -1;
  TOPS.forEach((x, i) => { if (t >= x[0]) ti = i; });
  // przy obietnicy i odpowiedzi mówi bęben, więc górny blok milczy
  const nm = SHOTS[si][3];
  const off = SPLIT.has(nm) || nm === "promise" || nm === "promised" || nm === "tfsi" || SHOTS[si][0] >= 149;
  show(topEl, !off && ti >= 0);
  if (off || ti < 0) return;
  if (ti !== curTop) { curTop = ti; topK.textContent = TOPS[ti][1]; topH.innerHTML = TOPS[ti][2]; }
  const k = easeOut(win(t, TOPS[ti][0], TOPS[ti][0] + 0.4));
  topH.style.opacity = k;
  topH.style.transform = "translateY(" + ((1 - k) * 18).toFixed(1) + "px)";
}

/* ================= plansze ================= */
const bd = $("bd");
const groups = [...bd.querySelectorAll(".grp")];
const rowsOf = (id) => [...$(id).querySelectorAll(".rw")].map((el) => ({ el, t: +el.dataset.t, st: +(el.dataset.st || 0), stEl: el.querySelector(".st") }));
const R_ROWS = rowsOf("gRows");
function drawRows(rows, t) {
  rows.forEach((r) => {
    pop(r.el, t, r.t, 0.3, 40);
    if (r.stEl) { const k = easeOut(win(t, r.st, r.st + 0.3)); r.stEl.style.opacity = k; r.stEl.style.transform = "translateX(" + ((1 - k) * 20).toFixed(1) + "px)"; }
  });
}
// ani czwórka, ani szóstka
const BT_ROWS = [
  { lab: "R4", n: 4, y: 650, at: 17.54, col: "#b6c1cf" },
  { lab: "R5", n: 5, y: 870, at: 19.2, col: "#f5aa3c" },
  { lab: "R6", n: 6, y: 1090, at: 18.43, col: "#b6c1cf" },
];
BT_ROWS.forEach((r) => {
  r.g = mkEl("g", {}, $("btG"));
  mkT(r.lab, { class: "sans", x: 90, y: r.y + 22, style: `font-size:64px;font-weight:600;fill:${r.col}` }, r.g);
  r.c = [];
  for (let i = 0; i < r.n; i++) r.c.push(mkEl("circle", { cx: 262 + i * 112, cy: r.y, r: 44, fill: r.lab === "R5" ? "rgba(245,170,60,0.25)" : "rgba(150,165,182,0.12)", stroke: r.col, "stroke-width": 5 }, r.g));
});
// litry i długość bloku
{
  const g = $("ltG");
  for (let i = 0; i < 5; i++) {
    const x = 90 + i * 150;
    mkEl("rect", { x, y: 490, width: 120, height: 220, rx: 14, fill: "rgba(150,165,182,0.08)", stroke: "#f5aa3c", "stroke-width": 4 }, g);
    mkEl("rect", { "data-fill": i, x: x + 8, width: 104, rx: 8, fill: "rgba(245,170,60,0.55)" }, g);
    mkT("0,5 l", { "data-lab": i, x: x + 60, y: 760, "text-anchor": "middle", style: "font-size:32px;font-weight:600;fill:#eef2f7", opacity: 0 }, g);
  }
  mkT("2,5", { id: "ltBig", x: 84, y: 990, style: "font-size:210px;font-weight:600;fill:#f5aa3c;letter-spacing:-0.04em", opacity: 0 }, g);
  mkT("LITRA", { id: "ltBigU", class: "sans", x: 470, y: 975, style: "font-size:70px;font-weight:600;fill:#eef2f7", opacity: 0 }, g);
  [["R4", 4, 1090], ["R5", 5, 1180], ["R6", 6, 1270]].forEach(([lab, n, y]) => {
    const bg = mkEl("g", { "data-bar": lab }, g);
    mkT(lab, { class: "sans", x: 90, y: y + 42, style: "font-size:50px;font-weight:600;fill:#eef2f7" }, bg);
    mkEl("rect", { "data-r": lab, x: 180, y, width: n * 110, height: 60, rx: 8, fill: "rgba(150,165,182,0.2)", stroke: "#b6c1cf", "stroke-width": 3 }, bg);
  });
  mkEl("line", { id: "ltR4", x1: 180 + 440, x2: 180 + 440, y1: 1070, y2: 1350, stroke: "#86dba1", "stroke-width": 4, "stroke-dasharray": "12 8", opacity: 0 }, g);
}
// komora silnika z góry: silnik z skrzynią w poprzek między kołami
const TR = { bayL: 150, bayR: 790, cyl: 90 };
{
  const g = $("trG");
  mkEl("path", { d: "M 150 1420 L 150 560 Q 150 470 250 462 L 690 462 Q 790 470 790 560 L 790 1420", fill: "rgba(150,165,182,0.07)", stroke: "#b6c1cf", "stroke-width": 5 }, g);
  mkEl("path", { d: "M 190 840 Q 470 790 750 840 L 720 930 Q 470 895 220 930 Z", fill: "rgba(124,196,255,0.14)", stroke: "#b6c1cf", "stroke-width": 3 }, g);
  for (const x of [100, 790]) {
    mkEl("rect", { "data-wheel": 1, x, y: 540, width: 50, height: 180, rx: 12, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 5 }, g);
    mkEl("rect", { x, y: 1200, width: 50, height: 180, rx: 12, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 5 }, g);
  }
  mkEl("path", { id: "trShafts", d: "M 150 630 L 250 640 M 790 630 L 690 640", stroke: "#f5aa3c", "stroke-width": 8, "stroke-linecap": "round", fill: "none", opacity: 0 }, g);
  mkEl("path", { id: "trArr", d: "M 125 520 L 125 470 M 105 492 L 125 470 L 145 492 M 815 520 L 815 470 M 795 492 L 815 470 L 835 492", stroke: "#f5aa3c", "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none", opacity: 0 }, g);
  const eng = (id, n, col) => {
    const e = mkEl("g", { id }, g);
    const w = n * TR.cyl + 36, gb = 120;
    e.dataset.w = w + gb;
    mkEl("rect", { "data-blk": 1, x: 0, y: 560, width: w, height: 170, rx: 14, fill: "rgba(150,165,182,0.16)", stroke: col, "stroke-width": 5 }, e);
    for (let i = 0; i < n; i++) mkEl("circle", { cx: 18 + TR.cyl / 2 + i * TR.cyl, cy: 645, r: 34, fill: "rgba(245,170,60,0.18)", stroke: col, "stroke-width": 4 }, e);
    mkEl("rect", { x: w, y: 585, width: gb, height: 120, rx: 10, fill: "rgba(150,165,182,0.1)", stroke: "#b6c1cf", "stroke-width": 4 }, e);
    mkT("SKRZYNIA", { x: w + gb / 2, y: 655, "text-anchor": "middle", style: "font-size:18px" }, e);
    mkT(n === 5 ? "R5" : "R6", { class: "sans", x: w / 2, y: 790, "text-anchor": "middle", style: "font-size:50px;font-weight:600;fill:#eef2f7" }, e);
    return e;
  };
  eng("trR5", 5, "#f5aa3c");
  eng("trR6", 6, "#b6c1cf");
  mkEl("rect", { id: "trHitL", x: 100, y: 550, width: 60, height: 190, rx: 12, fill: "rgba(226,73,43,0.55)", opacity: 0 }, g);
  mkEl("rect", { id: "trHitR", x: 780, y: 550, width: 60, height: 190, rx: 12, fill: "rgba(226,73,43,0.55)", opacity: 0 }, g);
}
function placeTr(id, k, from) {
  const e = $(id), w = +e.dataset.w, x0 = 470 - w / 2;
  e.setAttribute("transform", `translate(${f1(x0 + (1 - k) * from)} 0)`);
  e.setAttribute("opacity", k > 0.001 ? 1 : 0);
}
function colTr(id, col) { $(id).querySelector("[data-blk]").setAttribute("stroke", col); }
// kto pcha wał: suwy pracy i moment na osi 720°
const OVX = (d) => 90 + (d / 720) * 760;
const OV_ROWS = [
  { lab: "R4", n: 4, step: 180, y: 560, col: "#b6c1cf", lanes: 2, at: 60.65, curveAt: 66.15 },
  { lab: "R5", n: 5, step: 144, y: 820, col: "#f5aa3c", lanes: 3, at: 72.9, curveAt: 76.19 },
  { lab: "R6", n: 6, step: 120, y: 1080, col: "#b6c1cf", lanes: 2, at: 77.28, curveAt: 77.6 },
];
const torqueAt = (row, d) => { let v = 0; for (let i = 0; i < row.n; i++) { const x = wrap(d - i * row.step, 720); if (x < 180) v += Math.sin((x / 180) * Math.PI); } return v; };
{
  const g = $("ovG");
  OV_ROWS.forEach((row) => {
    const grp = mkEl("g", {}, g);
    mkT(row.lab, { class: "sans", x: 90, y: row.y - 16, style: `font-size:44px;font-weight:600;fill:${row.col}` }, grp);
    row.cnt = mkT("", { x: 850, y: row.y - 20, "text-anchor": "end", style: "font-size:30px;fill:#eef2f7" }, grp);
    const lh = row.lanes === 3 ? 36 : 50;
    for (let i = 0; i < row.n; i++) {
      const lane = i % row.lanes;
      for (const off of [0, 720]) {
        const s = i * row.step - off;
        const x0 = Math.max(90, OVX(s)), x1 = Math.min(850, OVX(s + 180));
        if (x1 <= x0) continue;
        mkEl("rect", { x: f1(x0), y: row.y + 4 + lane * (lh + 6), width: f1(x1 - x0), height: lh, rx: 8, fill: row.col, opacity: 0.8 }, grp);
      }
    }
    // zakładki: dwa tłoki pchają naraz
    row.ovl = mkEl("g", { opacity: 0 }, grp);
    if (row.step < 180) for (let i = 0; i < row.n; i++) {
      const a = (i + 1) * row.step, b = i * row.step + 180;
      for (const off of [0, 720]) {
        const x0 = Math.max(90, OVX(a - off)), x1 = Math.min(850, OVX(b - off));
        if (x1 > x0) mkEl("rect", { x: f1(x0), y: row.y, width: f1(x1 - x0), height: 132, fill: "rgba(134,219,161,0.4)" }, row.ovl);
      }
    }
    // moment: suma sinusów, w R4 spada do zera
    const base = row.y + 225;
    mkEl("line", { x1: 90, x2: 850, y1: base, y2: base, stroke: "rgba(150,165,182,0.35)", "stroke-width": 2 }, grp);
    let d = "";
    for (let x = 90; x <= 850; x += 4) { const deg = ((x - 90) / 760) * 720; d += (x === 90 ? "M " : " L ") + x + " " + f1(base - Math.min(1.8, torqueAt(row, deg)) * 48); }
    row.curve = mkEl("path", { d, fill: "none", stroke: row.lab === "R5" ? "#f5aa3c" : "#eef2f7", "stroke-width": 5, "stroke-linejoin": "round" }, grp);
    mkT("MOMENT", { x: 850, y: base + 34, "text-anchor": "end", style: "font-size:20px" }, grp);
    row.gaps = mkEl("g", { opacity: 0 }, grp);
    if (row.lab === "R4") for (const dd of [0, 180, 360, 540, 720]) mkEl("circle", { cx: f1(OVX(dd)), cy: base, r: 14, fill: "#ff3b2a" }, row.gaps);
    row.grp = grp;
  });
  const br = mkEl("g", { id: "ov180", opacity: 0 }, g);
  mkEl("path", { d: `M ${OVX(180)} 530 L ${OVX(180)} 512 L ${OVX(360)} 512 L ${OVX(360)} 530`, fill: "none", stroke: "#f5aa3c", "stroke-width": 4 }, br);
  mkT("180°", { x: f1(OVX(270)), y: 500, "text-anchor": "middle", style: "font-size:34px;font-weight:600;fill:#f5aa3c" }, br);
  mkEl("line", { id: "ovCur", y1: 540, y2: 1340, stroke: "#eef2f7", "stroke-width": 4, opacity: 0.8 }, g);
}
// rytm wydechu: R4 zawsze 2 zapłony na obrót, R5 na zmianę 3 i 2
const WV_ROWS = [{ lab: "R4", step: 180, y: 660, col: "#b6c1cf", at: 81.4 }, { lab: "R5", step: 144, y: 1040, col: "#f5aa3c", at: 81.9 }];
const WVX = (d) => 90 + (d / 1440) * 760;
{
  const g = $("wvG");
  WV_ROWS.forEach((row) => {
    row.g = mkEl("g", {}, g);
    mkT(row.lab, { class: "sans", x: 90, y: row.y - 110, style: `font-size:44px;font-weight:600;fill:${row.col}` }, row.g);
    let d = "";
    for (let x = 90; x <= 850; x += 2) {
      const deg = ((x - 90) / 760) * 1440;
      let v = 0;
      for (let p = 0; p <= deg; p += row.step) { const dt = deg - p; v += Math.exp(-dt / 40) * Math.sin((2 * Math.PI * dt) / 30); }
      d += (x === 90 ? "M " : " L ") + x + " " + f1(row.y - Math.max(-1.2, Math.min(1.2, v)) * 80);
    }
    row.wave = mkEl("path", { d, fill: "none", stroke: row.col, "stroke-width": 5 }, row.g);
    row.counts = [];
    for (let r = 0; r < 4; r++) {
      const x0 = WVX(r * 360), x1 = WVX((r + 1) * 360);
      mkEl("line", { x1: f1(x0), x2: f1(x0), y1: row.y - 90, y2: row.y + 90, stroke: "rgba(150,165,182,0.35)", "stroke-width": 2, "stroke-dasharray": "8 8" }, row.g);
      let n = 0;
      for (let p = 0; p < 1440; p += row.step) if (p >= r * 360 && p < (r + 1) * 360) n++;
      const odd = row.lab === "R5" && n === 3;
      row.counts.push(mkT(String(n), { x: f1((x0 + x1) / 2), y: row.y + 150, "text-anchor": "middle", style: `font-size:56px;font-weight:600;fill:${odd ? "#ff6a4d" : row.col}`, opacity: 0 }, row.g));
    }
  });
  mkT("ZAPŁONY NA JEDEN OBRÓT WAŁU", { x: 90, y: 1250, style: "font-size:24px" }, g);
  mkEl("line", { id: "wvCur", y1: 540, y2: 1200, stroke: "#eef2f7", "stroke-width": 3, opacity: 0.6 }, g);
}
// pół V10: dwa rzędy po 5
{
  const g = $("vtG");
  const cx = 470, cy = 1290;
  ["L", "R"].forEach((side, b) => {
    const a = (b ? 36 : -36) * D2R;
    const bank = mkEl("g", { id: "vt" + side }, g);
    for (let i = 0; i < 5; i++) {
      const r = 150 + i * 96;
      mkEl("circle", { cx: f1(cx + Math.sin(a) * r), cy: f1(cy - Math.cos(a) * r), r: 40, fill: b ? "rgba(245,170,60,0.3)" : "rgba(150,165,182,0.14)", stroke: b ? "#f5aa3c" : "#b6c1cf", "stroke-width": 5 }, bank);
    }
  });
  mkEl("circle", { cx, cy, r: 30, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 5 }, g);
  mkT("= R5", { id: "vtEq", class: "sans", x: 700, y: 760, style: "font-size:80px;font-weight:600;fill:#f5aa3c", opacity: 0 }, g);
  mkT("V10", { id: "vtLab", class: "sans", x: 150, y: 760, style: "font-size:80px;font-weight:600;fill:#eef2f7", opacity: 0 }, g);
}
// rajdowy odcinek
{
  const g = $("raG");
  mkEl("path", { id: "raRoad", d: "M 90 1330 C 260 1330 250 1180 420 1170 S 560 1300 700 1230 S 820 1060 700 1020 S 430 1060 300 1000", fill: "none", stroke: "#f5aa3c", "stroke-width": 10, "stroke-linecap": "round" }, g);
  mkEl("circle", { id: "raCar", r: 18, fill: "#eef2f7", opacity: 0 }, g);
}
// Pikes Peak: serpentyny pod szczyt
{
  const g = $("pkG");
  mkEl("path", { d: "M 90 1400 L 330 1080 L 420 1150 L 640 850 L 850 1400 Z", fill: "rgba(150,165,182,0.1)", stroke: "#b6c1cf", "stroke-width": 4 }, g);
  mkEl("path", { id: "pkRoad", d: "M 180 1380 L 520 1330 L 300 1250 L 600 1180 L 420 1100 L 640 1030 L 560 960 L 640 862", fill: "none", stroke: "#f5aa3c", "stroke-width": 8, "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
  mkEl("circle", { id: "pkCar", r: 16, fill: "#eef2f7", opacity: 0 }, g);
  mkT("", { id: "pkAlt", x: 0, y: 0, style: "font-size:34px;font-weight:600;fill:#eef2f7;paint-order:stroke;stroke:rgba(6,8,11,0.92);stroke-width:10px", opacity: 0 }, g);
  mkT("10:47", { id: "pkTime", x: 200, y: 960, "text-anchor": "middle", style: "font-size:60px;font-weight:600;fill:#f5aa3c", opacity: 0 }, g);
}
// taksówka
const carSide = (g, x, y, col, lab, id, wagon) => {
  const c = mkEl("g", { id }, g);
  const roof = wagon ? `L ${x + 110} ${y} L ${x + 360} ${y} L ${x + 372} ${y + 40}` : `L ${x + 120} ${y} L ${x + 290} ${y} L ${x + 350} ${y + 30}`;
  mkEl("path", { d: `M ${x} ${y + 120} L ${x} ${y + 60} Q ${x + 6} ${y + 36} ${x + 50} ${y + 30} ${roof} Q ${x + 380} ${y + 40} ${x + 380} ${y + 70} L ${x + 380} ${y + 120} Z`, fill: col, stroke: "#b6c1cf", "stroke-width": 4 }, c);
  mkEl("circle", { cx: x + 80, cy: y + 125, r: 32, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 4 }, c);
  mkEl("circle", { cx: x + 300, cy: y + 125, r: 32, fill: "#161b22", stroke: "#b6c1cf", "stroke-width": 4 }, c);
  mkT(lab, { x: x + 190, y: y + 200, "text-anchor": "middle", style: "font-size:34px;fill:#eef2f7" }, c);
  return c;
};
carSide($("odG"), 90, 930, "rgba(245,200,40,0.3)", "TAKSÓWKA", "odCar");
mkEl("rect", { x: 240, y: 910, width: 70, height: 22, rx: 5, fill: "#ffd23a" }, $("odCar"));
carSide($("voG"), 90, 940, "rgba(60,110,180,0.3)", "RODZINNE KOMBI", "voCar", true);
// puchary 2010 - 2018
{
  const g = $("tpG");
  for (let i = 0; i < 9; i++) {
    const cx = 210 + (i % 3) * 240, y = 540 + Math.floor(i / 3) * 215;
    const c = mkEl("g", { "data-cup": i, opacity: 0 }, g);
    mkEl("path", { d: `M ${cx - 50} ${y} L ${cx + 50} ${y} L ${cx + 44} ${y + 50} Q ${cx + 36} ${y + 90} ${cx} ${y + 96} Q ${cx - 36} ${y + 90} ${cx - 44} ${y + 50} Z`, fill: "rgba(245,170,60,0.35)", stroke: "#f5aa3c", "stroke-width": 5, "stroke-linejoin": "round" }, c);
    mkEl("path", { d: `M ${cx - 48} ${y + 14} Q ${cx - 82} ${y + 20} ${cx - 64} ${y + 52} M ${cx + 48} ${y + 14} Q ${cx + 82} ${y + 20} ${cx + 64} ${y + 52}`, fill: "none", stroke: "#f5aa3c", "stroke-width": 5 }, c);
    mkEl("rect", { x: cx - 8, y: y + 96, width: 16, height: 24, fill: "#f5aa3c" }, c);
    mkEl("rect", { x: cx - 38, y: y + 120, width: 76, height: 16, rx: 4, fill: "#f5aa3c" }, c);
    mkT(String(2010 + i), { x: cx, y: y + 176, "text-anchor": "middle", style: "font-size:32px;font-weight:600;fill:#eef2f7" }, c);
  }
}

const ORDER_T = [32.91, 33.56, 33.93, 34.6, 35.11];
const ORDER_ID = [1, 2, 4, 5, 3];
// cyfra świeci od słowa lektora do następnej cyfry, z miękkim wejściem i wyjściem
const orderGlow = (t, i) => { const a = ORDER_T[i], b = i < 4 ? ORDER_T[i + 1] : 35.5; return easeOut(win(t, a - 0.05, a + 0.15)) * (1 - easeIO(win(t, b - 0.05, b + 0.15))); };
// kolejność zapłonu: cylinder świeci na słowo lektora, łuk pokazuje skok od poprzedniego
const OX = (id) => 150 + (id - 1) * 160;
{
  const g = $("orG");
  mkT("PRZÓD", { x: 150, y: 1010, "text-anchor": "middle", style: "font-size:22px" }, g);
  mkT("TYŁ", { x: 790, y: 1010, "text-anchor": "middle", style: "font-size:22px" }, g);
  ORDER_ID.forEach((id, i) => {
    if (i === 0) return;
    const a = OX(ORDER_ID[i - 1]), b = OX(id), h = 70 + Math.abs(b - a) * 0.35;
    mkEl("path", { "data-arc": i, d: `M ${a} 790 C ${a} ${790 - h}, ${b} ${790 - h}, ${b} 790`, fill: "none", stroke: "#f5aa3c", "stroke-width": 6, "stroke-linecap": "round" }, g);
  });
  for (let id = 1; id <= 5; id++) {
    const c = mkEl("g", { "data-cyl": id }, g);
    mkEl("circle", { cx: OX(id), cy: 880, r: 64, fill: "rgba(150,165,182,0.1)", stroke: "#b6c1cf", "stroke-width": 5 }, c);
    mkT(String(id), { class: "sans", x: OX(id), y: 902, "text-anchor": "middle", style: "font-size:64px;font-weight:600;fill:#eef2f7" }, c);
  }
}
function drawBoard(t, id) {
  groups.forEach((g) => { g.style.display = g.id === id ? "block" : "none"; });
  if (id === "gOrder") {
    stepH($("orH"), t, [[32.02, "Kolejność <em>zapłonu</em>"]]);
    [...$("orG").querySelectorAll("[data-cyl]")].forEach((c) => {
      const cid = +c.dataset.cyl, i = ORDER_ID.indexOf(cid), a = ORDER_T[i];
      const on = easeOut(win(t, a - 0.05, a + 0.2)), now = orderGlow(t, i);
      popS(c, t, 32.1 + (cid - 1) * 0.08, 20);
      const circ = c.querySelector("circle"), tx = c.querySelector("text");
      circ.setAttribute("fill", `rgba(245,170,60,${(0.1 + 0.25 * on + 0.6 * now).toFixed(3)})`);
      circ.setAttribute("stroke", on > 0.05 ? "#f5aa3c" : "#b6c1cf");
      tx.setAttribute("style", `font-size:64px;font-weight:600;fill:${now > 0.5 ? "#1a1206" : "#eef2f7"}`);
    });
    [...$("orG").querySelectorAll("[data-arc]")].forEach((p) => { const i = +p.dataset.arc; dash(p, easeIO(win(t, ORDER_T[i] - 0.3, ORDER_T[i] + 0.05)), 900); });
  } else if (id === "gBetween") {
    stepH($("btH"), t, [[17.32, "Ani <em>czwórka</em>"], [18.21, "Ani <em>szóstka</em>"], [19.2, "Coś <em>pomiędzy</em>"]]);
    BT_ROWS.forEach((r) => {
      const k = popS(r.g, t, r.at, 30);
      r.c.forEach((c, i) => { const kk = easeOut(win(t, r.at + i * 0.06, r.at + i * 0.06 + 0.3)); c.setAttribute("r", f1(44 * kk)); });
      if (r.lab !== "R5") r.g.setAttribute("opacity", f1(k * (t >= 19.2 ? 1 - 0.55 * easeOut(win(t, 19.2, 19.6)) : 1)));
    });
  } else if (id === "gLitres") {
    stepH($("ltH"), t, [[44.59, "Pięć × <em>pół litra</em>"], [46.28, "Razem <em>2,5 litra</em>"], [47.23, "Blok <em>niewiele dłuższy</em>"]]);
    for (let i = 0; i < 5; i++) {
      const k = easeIO(win(t, 44.8 + i * 0.2, 45.3 + i * 0.2));
      const fr = $("ltG").querySelector(`[data-fill="${i}"]`);
      fr.setAttribute("y", f1(702 - 204 * k)); fr.setAttribute("height", f1(204 * k));
      $("ltG").querySelector(`[data-lab="${i}"]`).setAttribute("opacity", f1(clamp01((k - 0.5) * 2)));
    }
    const bk = easeOut(win(t, 46.28, 46.6));
    $("ltBig").setAttribute("opacity", f1(bk)); $("ltBigU").setAttribute("opacity", f1(bk));
    [...$("ltG").querySelectorAll("[data-bar]")].forEach((b, i) => {
      popS(b, t, 47.23 + i * 0.15, 30);
      const r = b.querySelector("[data-r]"), hl = b.dataset.bar === "R5" && t >= 48.1;
      r.setAttribute("fill", hl ? "rgba(245,170,60,0.55)" : "rgba(150,165,182,0.2)");
      r.setAttribute("stroke", hl ? "#f5aa3c" : "#b6c1cf");
    });
    $("ltR4").setAttribute("opacity", f1(easeOut(win(t, 48.1, 48.5))));
  } else if (id === "gTrans") {
    const m2 = t >= 129;
    $("trK").textContent = m2 ? "Pod maską kompaktu" : "Pod maską, widok z góry";
    if (!m2) {
      stepH($("trH"), t, [[49.66, "Wchodzi <em>w poprzek</em>"], [50.71, "Pod maskę <em>zwykłego auta</em>"], [52.07, "Z napędem <em>na przód</em>"]]);
      placeTr("trR5", easeOut(win(t, 49.75, 50.5)), -760);
      placeTr("trR6", 0, 760);
      colTr("trR5", t >= 50.4 ? "#86dba1" : "#f5aa3c");
      const dk = easeOut(win(t, 51.75, 52.3));
      $("trShafts").setAttribute("opacity", f1(dk)); $("trArr").setAttribute("opacity", f1(easeOut(win(t, 52.07, 52.5))));
      $("trHitL").setAttribute("opacity", 0); $("trHitR").setAttribute("opacity", 0);
    } else {
      stepH($("trH"), t, [[129.35, "Ale <em>w poprzek</em>"], [130.08, "Pod maską <em>kompaktu</em>"], [132.42, "Szóstka <span class=\"hot\">się nie zmieści</span>"], [133.35, "A piątka <span class=\"ok\">tak</span>"]]);
      placeTr("trR6", easeOut(win(t, 130.1, 130.9)) * (1 - easeIO(win(t, 133.35, 133.9))), -760);
      const hit = easeOut(win(t, 131.7, 132.1)) * (1 - easeIO(win(t, 133.35, 133.7)));
      $("trHitL").setAttribute("opacity", f1(hit)); $("trHitR").setAttribute("opacity", f1(hit));
      colTr("trR6", t >= 131.7 ? "#ff6a4d" : "#b6c1cf");
      placeTr("trR5", easeOut(win(t, 133.6, 134.2)), -760);
      colTr("trR5", t >= 134.0 ? "#86dba1" : "#f5aa3c");
      $("trShafts").setAttribute("opacity", 0); $("trArr").setAttribute("opacity", 0);
    }
  } else if (id === "gRows") drawRows(R_ROWS, t);
  else if (id === "gOverlap") {
    const seg2 = t >= 72;
    stepH($("ovH"), t, seg2
      ? [[72.86, "W R5 kolejny tłok <em>rusza wcześniej</em>"], [74.45, "Zanim poprzedni <em>skończy</em>"], [76.19, "Moment <em>płynie</em>"], [77.28, "Prawie jak <em>w szóstce</em>"], [78.11, "Z <em>mniejszego silnika</em>"]]
      : [[60.6, "W R4 zapłon co <em>180°</em>"], [63.44, "Tyle, ile trwa <em>suw pracy</em>"], [66.15, "Jeden kończy, <em>drugi zaczyna</em>"], [68.87, "Po drodze <span class=\"hot\">dziury</span>"]]);
    const cyc = wrap((t - 60.6) * 90, 720);
    $("ovCur").setAttribute("x1", f1(OVX(cyc))); $("ovCur").setAttribute("x2", f1(OVX(cyc)));
    OV_ROWS.forEach((row) => {
      const k = t >= row.at ? easeOut(win(t, row.at, row.at + 0.4)) : 0;
      row.grp.setAttribute("opacity", f1(k));
      row.grp.setAttribute("transform", `translate(0 ${f1((1 - k) * 30)})`);
      let n = 0;
      for (let i = 0; i < row.n; i++) if (wrap(cyc - i * row.step, 720) < 180) n++;
      row.cnt.textContent = "PCHA: " + n;
      row.cnt.setAttribute("style", `font-size:30px;font-weight:600;fill:${n >= 2 ? "#86dba1" : "#eef2f7"}`);
      dash(row.curve, easeIO(win(t, row.curveAt, row.curveAt + 1.0)), 2200);
      if (row.lab === "R4") row.gaps.setAttribute("opacity", f1(easeOut(win(t, 68.87, 69.2))));
      if (row.lab === "R5") row.ovl.setAttribute("opacity", f1(easeOut(win(t, 74.45, 74.9))));
    });
    $("ov180").setAttribute("opacity", f1(seg2 ? 0 : easeOut(win(t, 62.1, 62.5))));
  } else if (id === "gWaves") {
    stepH($("wvH"), t, [[81.23, "Nieparzysta <em>liczba cylindrów</em>"], [83.1, "<em>Nierówny</em> rytm wydechu"], [84.71, "Stąd ten <em>warkot</em>"]]);
    WV_ROWS.forEach((row, ri) => {
      popS(row.g, t, row.at, 20);
      dash(row.wave, easeIO(win(t, row.at, row.at + 1.2)), 4000);
      row.counts.forEach((c, i) => c.setAttribute("opacity", f1(easeOut(win(t, 83.2 + i * 0.22 + ri * 0.1, 83.5 + i * 0.22 + ri * 0.1)))));
      row.wave.setAttribute("stroke-width", row.lab === "R5" && t >= 84.71 ? 7 : 5);
    });
    const cx = WVX(wrap((t - 81.2) * 520, 1440));
    $("wvCur").setAttribute("x1", f1(cx)); $("wvCur").setAttribute("x2", f1(cx));
  } else if (id === "gV10") {
    stepH($("vtH"), t, [[86.97, "Wielu mówi, że piątka"], [89.42, "Brzmi jak <em>pół V10</em>"]]);
    const k = easeOut(win(t, 87.1, 87.6));
    $("vtL").setAttribute("opacity", f1(k * (1 - 0.7 * easeOut(win(t, 89.64, 90.0)))));
    $("vtR").setAttribute("opacity", f1(k));
    $("vtLab").setAttribute("opacity", f1(k * (1 - easeOut(win(t, 89.64, 90.0)))));
    $("vtEq").setAttribute("opacity", f1(easeOut(win(t, 89.8, 90.2))));
  } else if (id === "gRally") {
    pop($("raY"), t, 92.5, 0.3, 40);
    pop($("raH"), t, 93.47, 0.3, 30);
    [...$("raC").children].forEach((c) => pop(c, t, +c.dataset.t, 0.25, 24));
    const rk = easeIO(win(t, 94.0, 96.3));
    const road = $("raRoad"), L = road.getTotalLength();
    dash(road, rk, L);
    const p = road.getPointAtLength(L * rk);
    $("raCar").setAttribute("cx", f1(p.x)); $("raCar").setAttribute("cy", f1(p.y)); $("raCar").setAttribute("opacity", rk > 0.01 ? 1 : 0);
  } else if (id === "gPikes") {
    pop($("pkY"), t, 99.55, 0.3, 40);
    pop($("pkH"), t, 100.94, 0.3, 30);
    const road = $("pkRoad"), L = road.getTotalLength();
    dash(road, easeIO(win(t, 101.6, 102.2)), L);
    const ck = easeIO(win(t, 102.16, 103.8));
    const p = road.getPointAtLength(L * ck);
    $("pkCar").setAttribute("cx", f1(p.x)); $("pkCar").setAttribute("cy", f1(p.y)); $("pkCar").setAttribute("opacity", t >= 102.16 ? 1 : 0);
    const alt = $("pkAlt");
    alt.textContent = fmt(Math.round(lerp(2862, 4302, ck))) + " m";
    alt.setAttribute("x", f1(p.x + 30)); alt.setAttribute("y", f1(p.y - 20)); alt.setAttribute("opacity", t >= 102.16 ? 1 : 0);
    $("pkTime").setAttribute("opacity", f1(easeOut(win(t, 104.0, 104.4))));
    const sk = easeOut(win(t, 103.82, 104.2));
    $("stRek").style.opacity = sk;
    $("stRek").style.transform = "translate(-50%,-50%) rotate(-7deg) scale(" + (1.12 - 0.12 * sk).toFixed(3) + ")";
  } else if (id === "gOdo") {
    stepH($("odH"), t, [[106.99, "Mercedes: <em>diesel R5</em>"], [109.51, "W <em>taksówkach</em>"], [110.83, "Ponad <em>milion km</em>"]]);
    const km = Math.round(1000000 * easeIO(win(t, 107.6, 110.9)));
    const s = String(km).padStart(7, "0"), lead = 7 - String(km).length;
    [...$("odo").children].forEach((sp, i) => { if (sp.textContent !== s[i]) sp.textContent = s[i]; sp.classList.toggle("u", i >= lead && km > 0); });
    $("odCar").setAttribute("transform", `translate(${f1((1 - easeOut(win(t, 109.4, 110.1))) * 800)} 0)`);
  } else if (id === "gVolvo") {
    stepH($("voH"), t, [[114.32, "Volvo <em>przez ponad</em>"], [117.22, "Rodzinne <em>kombi</em>"], [118.87, "Jeżdżą <em>do dziś</em>"]]);
    const n = Math.round(20 * easeIO(win(t, 115.0, 115.9)));
    const v = t >= 115.92 ? "20+" : String(n);
    if ($("voN").textContent !== v) $("voN").textContent = v;
    pop($("voN"), t, 114.9, 0.3, 30);
    pop($("voU"), t, 115.92, 0.3, 20);
    $("voU").style.left = "630px";
    $("voCar").setAttribute("transform", `translate(${f1((1 - easeOut(win(t, 117.9, 118.6))) * -800)} 0)`);
  } else if (id === "gTrophy") {
    stepH($("tpH"), t, [[138.35, "<em>9 razy</em> z rzędu"], [140.11, "Od <em>2010</em> do <em>2018</em>"], [142.97, "Silnik roku <em>w swojej klasie</em>"]]);
    [...$("tpG").querySelectorAll("[data-cup]")].forEach((c) => { const i = +c.dataset.cup; popS(c, t, 140.3 + i * 0.16, 36); });
  } else if (id === "gRS3") {
    const hp = Math.round(400 * easeIO(win(t, 145.72, 146.7)));
    if ($("rsN").textContent !== String(hp)) $("rsN").textContent = String(hp);
    pop($("rsN"), t, 145.1, 0.3, 30);
    pop($("rsH"), t, 147.63, 0.3, 24);
  }
}

/* ================= engagement ================= */
const RW = ["? ? ?", "Audi", "Volvo", "Turbo", "Quattro", "RS3"];
const RN = RW.length, RROW = 50, ANS = "Audi 2.5 TFSI", T_ANS = 137.78;
const BURSTS = [[7.9, 8.9, 2 * RN], [35.6, 36.3, 2 * RN], [59.1, 59.8, 2 * RN], [80.0, 80.7, 2 * RN], [90.8, 91.5, 2 * RN], [105.3, 106.0, 2 * RN], [120.0, 120.7, 2 * RN], [134.6, 135.5, 2 * RN], [136.3, T_ANS, 2 * RN + 3]];
const FIN = BURSTS.reduce((q, x) => q + x[2], 0);
const reelRows = [...document.querySelectorAll("#reelStrip div")];
const reelPos = (t) => { let p = 0; for (const [a, b, n] of BURSTS) { if (t >= b) p += n; else if (t > a) p += n * easeOut(win(t, a, b)); } return p; };
function drawEng(t) {
  const rb = $("reelBar");
  const rOn = inR(t, 7.8, 139.4);
  rb.style.opacity = rOn ? (easeOut(win(t, 7.8, 8.1)) * (1 - easeIO(win(t, 139.0, 139.4)))).toFixed(3) : 0;
  if (rOn) {
    const p = reelPos(t), i0 = Math.floor(p), fr = p - i0;
    const w0 = i0 === FIN ? ANS : RW[i0 % RN], w1 = i0 + 1 === FIN ? ANS : RW[(i0 + 1) % RN];
    if (reelRows[0].textContent !== w0) reelRows[0].textContent = w0;
    if (reelRows[1].textContent !== w1) reelRows[1].textContent = w1;
    $("reelStrip").style.transform = "translateY(" + (-fr * RROW).toFixed(1) + "px)";
    let spin = 0;
    for (const [a, b] of BURSTS) if (t > a && t < b) spin = 1 - easeOut(win(t, a, b));
    $("reelStrip").style.filter = spin > 0.05 ? "blur(" + (spin * 3).toFixed(2) + "px)" : "none";
    const done = t >= T_ANS;
    reelRows.forEach((r) => { r.style.color = done ? "#f5aa3c" : ""; });
    const lab = done ? "Odpowiedź:" : "Na końcu:";
    if ($("reelLab").textContent !== lab) $("reelLab").textContent = lab;
    const bigK = Math.max(
      easeOut(win(t, 7.8, 8.2)) * (1 - easeIO(win(t, 9.3, 9.8))),
      easeIO(win(t, 134.51, 134.9)) * (1 - easeIO(win(t, 135.6, 136.0))),
      easeIO(win(t, 136.2, 136.6)) * (1 - easeIO(win(t, 138.4, 138.9))),
    );
    rb.style.transform = "translate(" + (-40 * bigK).toFixed(1) + "px," + (560 * bigK).toFixed(1) + "px) scale(" + (1 + 0.7 * bigK).toFixed(3) + ")";
  }
  const sc = $("serCard");
  const sOn = inR(t, 145.3, 149.0);
  sc.style.opacity = sOn ? (easeOut(win(t, 145.3, 145.7)) * (1 - easeIO(win(t, 148.6, 149.0)))).toFixed(3) : 0;
  if (sOn) sc.style.transform = "translateX(" + ((1 - easeOut(win(t, 145.3, 145.8))) * -60).toFixed(1) + "px)";
  const pc = $("pickCard");
  const pOn = inR(t, 152.11, 155.92);
  pc.style.opacity = pOn ? (easeOut(win(t, 152.11, 152.5)) * (1 - easeIO(win(t, 155.6, 155.92)))).toFixed(3) : 0;
  if (pOn) {
    pc.style.transform = "translateY(" + ((1 - easeOut(win(t, 152.11, 152.5))) * 30).toFixed(1) + "px)";
    const on = (id, g) => { $(id).style.borderColor = "rgba(245,170,60," + (0.3 + 0.7 * g).toFixed(2) + ")"; $(id).style.boxShadow = "0 0 " + (34 * g).toFixed(0) + "px rgba(245,170,60," + (0.3 * g).toFixed(2) + ")"; };
    const gA = t > 152.6 ? (t < 153.25 ? easeOut(win(t, 152.6, 152.8)) : 0.5) : 0;
    const gB = t > 153.25 ? easeOut(win(t, 153.25, 153.45)) : 0;
    on("pkA", Math.max(gA, t > 154.15 ? 0.5 + 0.5 * Math.sin((t - 154.15) * 3) : 0)); on("pkB", t > 154.15 ? 0.5 - 0.5 * Math.sin((t - 154.15) * 3) : gB);
    $("pickC").style.opacity = easeOut(win(t, 154.15, 154.5));
  }
  const yc = $("ytCard");
  const yOn = inR(t, 156.0, 164.6);
  yc.style.opacity = yOn ? (easeOut(win(t, 156.0, 156.4)) * (1 - easeIO(win(t, 164.3, 164.6)))).toFixed(3) : 0;
  if (yOn) yc.style.transform = "translateX(" + ((1 - easeOut(win(t, 156.0, 156.5))) * -60).toFixed(1) + "px)";
}

/* ================= render klatki ================= */
const chipSets = ["chSimple"].map((id) => ({ el: $(id), chips: [...$(id).children].map((c) => ({ el: c, t: +c.dataset.t })) }));
const CHIP_SHOT = { chSimple: "simple" };
const SPLIT_UI = {
  hook: { pill: "Lepsza od", a: ["Piątka", "R5", "ok", -1], b: ["Szóstki", "R6", "hot", -1] },
  outro: { pill: "Lepsza od", a: ["Piątka", "R5", "ok", 164.75], b: ["Szóstki", "R6", "hot", 164.9] },
  lenSplit: { pill: "Krótsza o cylinder", pillAt: 42.24, a: ["", "", "hot", 1e9], b: ["", "", "ok", 1e9] },
  balance: { pill: "Uczciwie", a: ["R6", "wyważona", "ok", 121.42], b: ["R5", "nie do końca", "hot", 122.8] },
  final: { pill: "W kompakcie", a: ["R6", "nie zrobi", "hot", 151.29], b: ["R5", "400 KM", "ok", 149.3] },
};

// plansza i 3D przenikają się przez 0,4 s zamiast twardego cięcia
const XF = 0.4;
function renderAt(t) {
  t = Math.max(0, Math.min(D, t));
  drawEng(t);
  const si = shotIdx(t), [s0, , kind, name] = SHOTS[si], prev = SHOTS[si - 1];
  const fresh = prev && prev[2] !== kind && t - s0 < XF;
  let boardK = 0, boardName = null, si3 = -1;
  if (kind === "board") { boardName = name; boardK = fresh ? easeIO((t - s0) / XF) : 1; if (fresh) si3 = si - 1; }
  else { si3 = si; if (fresh) { boardName = prev[3]; boardK = 1 - easeIO((t - s0) / XF); } }
  bd.style.opacity = boardK.toFixed(3);
  if (boardName) drawBoard(t, boardName);
  const on3d = si3 >= 0;
  ui.style.opacity = on3d ? 1 : 0;
  svg.style.opacity = on3d ? 1 : 0;
  canvas.style.opacity = on3d ? 1 : 0;
  if (on3d) render3D(t, si3);
}
function render3D(t, si) {
  const [s0, , , name] = SHOTS[si];

  const deg = crankAt(t);
  const split = SPLIT.has(name);
  const A = states(t, name, "A");
  pose5(A.s, deg, t);
  pose6(A.s, deg);
  applyCam(t, split ? name + "A" : name, camera, si);
  // kamera panelu B ustawiona od razu, bo nakładki SVG (wymiary, strzałki) rzutują przez nią jeszcze przed renderem panelu
  if (split) applyCam(t, name + "B", cameraB, si);
  lightAt(A.base, camera);
  projCam = camera;

  show($("hk"), name === "hook" || name === "outro");
  shadeBot.style.opacity = name === "lenSplit" ? 0.15 : 1;
  drawTop(t, si);
  // tarcza zapłonu
  const dialOn = name === "fire";
  drawDial(dialOn, deg, easeOut(win(t, s0, s0 + 0.4)));
  drawStar(t, name === "crank");
  // numery cylindrów; w kolejności zapłonu świeci ten, który właśnie odpala
  const bOn = name === "anatomy";
  badges.forEach(({ el, c }, i) => {
    if (!bOn) { el.style.opacity = 0; return; }
    const p = localPoint(E5.root, 0, K5.LAYOUT.deckHeight + 260, c.z);
    place(el, p.x, p.y);
    const k = name === "anatomy" ? easeOut(win(t, 24.24 + i * 0.1, 24.52 + i * 0.1)) : 1;
    el.style.opacity = k;
    el.style.transform = "translateY(" + f1((1 - k) * 16) + "px)";
  });
  // licznik
  const cntOn = false;
  $("cnt").style.opacity = cntOn ? easeOut(win(t, 10.08, 10.48)) : 0;
  if (cntOn) {
    const n = "9×", lab = "<b>z rzędu</b>silnik roku";
    if ($("cntN").textContent !== n) $("cntN").textContent = n;
    if ($("cntL").innerHTML !== lab) $("cntL").innerHTML = lab;
  }
  chipSets.forEach((cs) => {
    const on = CHIP_SHOT[cs.el.id] === name;
    show(cs.el, on);
    if (on) cs.chips.forEach((c) => pop(c.el, t, c.t, 0.25, 24));
  });

  // podzielony ekran
  $("split").style.opacity = split ? 1 : 0;
  const su = SPLIT_UI[name];
  const pill = $("splitPill");
  const setPl = (el, [b, st, cls, at]) => {
    const bb = el.querySelector("b"), s2 = el.querySelector(".st");
    if (bb.textContent !== b) bb.textContent = b;
    if (s2.textContent !== st) s2.textContent = st;
    s2.className = "st " + cls;
    pop(el, t, at, 0.25, 20);
  };
  if (split) {
    if (pill.textContent !== su.pill) pill.textContent = su.pill;
    pill.style.opacity = name === "hook" ? 1 : easeOut(win(t, su.pillAt || s0, (su.pillAt || s0) + 0.4));
    setPl($("pA"), su.a); setPl($("pB"), su.b);
  } else { pill.style.opacity = 0; $("pA").style.opacity = 0; $("pB").style.opacity = 0; }

  drawTags(t);
  drawDims(t, name);

  if (!split) { drawRock(t, name, deg, camera); usePassCam(camera); composer.render(); return; }
  renderer.setScissorTest(true);
  usePassCam(camera);
  renderer.setScissor(0, H - SEAM, W, SEAM);
  composer.render();
  const Bs = states(t, name, "B");
  pose5(Bs.s, deg, t);
  pose6(Bs.s, deg);
  applyCam(t, name + "B", cameraB, si);
  lightAt(Bs.base, cameraB);
  drawRock(t, name, deg, cameraB);
  usePassCam(cameraB);
  renderer.setScissor(0, 0, W, H - SEAM);
  composer.render();
  renderer.setScissorTest(false);
  usePassCam(camera);
}

window.addEventListener("hf-seek", (ev) => renderAt(ev.detail.time));
window.__renderAt = renderAt;
window.__dbg = { E5, E6, camera, cameraB, composer, scene, SHOTS, K5, box5, box6 };
