// main.js - interactive explorer for the Audi 2.2 T R5 (3B / ABY / AAN / ADU).
//
// Everything that moves is computed: the crank turns by crankRotation(), the
// rods are pointed along the line from the big end to the wrist pin, the
// pistons ride the slider-crank solution, the valves and the cams come from the
// lift curves in kinematics.js, and the turbo shaft is integrated at its own
// speed because it has no mechanical link to the crank at all.
//
// Internals are shown by taking the shells apart (the explode slider plus the
// switches that take off the cam covers, the belt cover and the outer
// ancillaries). There is no cutting plane and no transparency anywhere in the
// default path.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createMaterials, applyMaterialVariation } from './lib/materials.js';
import { buildStudioEnvironment, makeStudioFloor, makeShadowFloor } from './lib/environment.js';
import { buildBlockAssembly, BLOCK } from './parts/block.js';
import { buildHead, HEAD } from './parts/head.js';
import { buildRotatingAssembly } from './parts/rotating.js';
import { buildTurbo, TURBO_POS } from './parts/turbo.js';
import { buildAccessories } from './parts/accessories.js';
import { createLabels } from './labels.js';
import * as K from './lib/kinematics.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? parseFloat(params.get(k)) : d);
const flag = (k) => params.get(k) === '1';
const lq = flag('lq');

// ------------------------------------------------------------------ renderer
const host = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: !lq, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.94;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 4, 40000);

const env = buildStudioEnvironment(renderer);
scene.environment = env;
scene.background = env.background;
const studioFloor = makeStudioFloor(26000);
studioFloor.position.y = -420;
scene.add(studioFloor);
const shadowFloor = makeShadowFloor(18000);
shadowFloor.position.y = -300;
scene.add(shadowFloor);

const key = new THREE.DirectionalLight(0xfff6ea, 2.5);
key.position.set(-1100, 1700, 1500);
key.castShadow = true;
key.shadow.mapSize.set(lq ? 1024 : 4096, lq ? 1024 : 4096);
key.shadow.camera.near = 700;
key.shadow.camera.far = 7000;
key.shadow.camera.left = -1100;
key.shadow.camera.right = 1100;
key.shadow.camera.top = 1100;
key.shadow.camera.bottom = -1100;
key.shadow.bias = -0.0006;
scene.add(key);
const fill = new THREE.DirectionalLight(0xbcd2ea, 0.44);
fill.position.set(1700, 800, -1000);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.72);
rim.position.set(-500, -700, -1700);
scene.add(rim);
scene.add(new THREE.HemisphereLight(0xdfe8f4, 0x14161a, 0.34));

const M = createMaterials();

// ------------------------------------------------------------------- state
const state = {
  crank: num('crank', 0),
  rpm: num('rpm', 3000),
  slow: num('slow', 60),
  playing: !flag('nop'),
  exploded: num('explode', flag('explode') ? 1 : 0),
  headMode: params.get('head') === '10v' ? '10v' : '20v',
  specCode: ['3B', 'ABY', 'AAN', 'ADU'].includes(params.get('spec')) ? params.get('spec') : '3B',
  gas: true,
  covers: true,
  beltCover: true,
  outer: true,
  labels: true,
};
const spec = () => K.SPEC.variants.find((v) => v.code === state.specCode) || K.SPEC.variants[0];

// the turbo shaft has its own clock: it is integrated, never derived from the
// crank angle, because nothing connects it to the crank
let turboDeg = 0;
let camDeg = 0;

// ------------------------------------------------------------------- assembly
let engine = null;

function buildEngine() {
  if (engine) {
    scene.remove(engine.root);
    engine.root.traverse((o) => {
      if (o.isMesh) o.geometry?.dispose?.();
    });
  }
  const root = new THREE.Group();
  root.name = 'ENGINE';

  const block = buildBlockAssembly(M);
  const head = buildHead(M, { mode: state.headMode });
  const rotating = buildRotatingAssembly(M, head);
  const turbo = buildTurbo(M);
  const accessories = buildAccessories(M, head, spec());

  root.add(block.root, head.root, rotating.root, turbo.root, accessories.root);

  // charge volumes: a disc of gas between the piston crown and the deck face,
  // sized from the same chamber volume the verification prints
  const gasRoot = new THREE.Group();
  gasRoot.name = 'CHARGE_VOLUMES';
  const gases = [];
  for (const c of K.CYLINDERS) {
    const mat = M.charge.clone();
    mat.name = `Charge_Cyl${c.id}`;
    const meshGas = new THREE.Mesh(new THREE.CylinderGeometry(K.SPEC.bore / 2 - 0.6, K.SPEC.bore / 2 - 0.6, 1, 30, 1, true), mat);
    meshGas.name = `Charge_Cyl${c.id}`;
    meshGas.userData.cyl = c;
    gasRoot.add(meshGas);
    gases.push({ def: c, mesh: meshGas, mat });
  }
  root.add(gasRoot);

  applyMaterialVariation(root, M);

  scene.add(root);
  engine = {
    root,
    block,
    head,
    rotating,
    turbo,
    accessories,
    gasRoot,
    gases,
    update(t, crankDeg) {
      head.update(crankDeg);
      rotating.update(crankDeg);
      turbo.update(turboDeg, K.boostBar(state.rpm, state.specCode));
      // gas colour and size from the four stroke phase
      const cy = [0, 1, 2, 3, 4].map((i) => state.gas);
      for (const g of engine.gases) {
        const phase = K.cycleAngle(g.def, crankDeg);
        const { s } = K.pistonPinDistance(g.def, crankDeg);
        const crownY = s + K.LAYOUT.pistonCompressionHeight;
        const h = Math.max(0.6, K.LAYOUT.deckHeight - crownY);
        g.mesh.scale.y = h;
        g.mesh.position.set(0, crownY + h / 2, g.def.z);
        g.mesh.visible = state.gas && h > 0.8;
        const stroke = K.strokeOf(g.def, crankDeg).key;
        if (stroke === 'intake') {
          g.mat.color.setHex(0x4f9bff);
          g.mat.opacity = 0.16 + 0.1 * (h / K.SPEC.stroke);
        } else if (stroke === 'compression') {
          g.mat.color.setHex(0x8ec6ff);
          g.mat.opacity = 0.2 + 0.26 * (1 - h / K.SPEC.stroke);
        } else if (stroke === 'power') {
          const k = Math.min(1, Math.max(0, (phase - 360) / 60));
          g.mat.color.setHex(k < 0.5 ? 0xffb066 : 0xff5a12);
          g.mat.opacity = 0.5 - 0.2 * k;
        } else {
          g.mat.color.setHex(0x9aa0a6);
          g.mat.opacity = 0.14 + 0.14 * (1 - h / K.SPEC.stroke);
        }
      }
      void cy;
    },
  };
  applyExplode(state.exploded);
  applyVisibility();
  return engine;
}

// ------------------------------------------------------------------- explode
const EXPLODE = new Map();
function registerExplode() {
  EXPLODE.clear();
  const add = (obj, v) => {
    if (!obj) return;
    EXPLODE.set(obj, { rest: obj.position.clone(), delta: new THREE.Vector3(...v) });
  };
  add(engine.head.groups.covers, [0, 430, 0]);
  add(engine.head.groups.bolts, [0, 400, 0]);
  add(engine.head.root, [0, 300, 0]);
  add(engine.block.groups.timingCover, [0, 0, 300]);
  add(engine.block.groups.cylinderSection, [0, 62, 0]);
  add(engine.block.groups.crankcase, [0, -46, 0]);
  add(engine.block.groups.bulkheads, [0, -150, 0]);
  add(engine.block.groups.mainCaps, [0, -210, 0]);
  add(engine.block.groups.sump, [0, -320, 0]);
  add(engine.block.groups.filter, [-190, 0, 0]);
  add(engine.rotating.flywheel, [0, 0, -300]);
  add(engine.accessories.groups.exhaust, [230, 90, 0]);
  add(engine.accessories.groups.intake, [-230, 90, 0]);
  add(engine.accessories.groups.intercooler, [0, 40, 340]);
  add(engine.accessories.groups.ignition, [0, 470, 0]);
  add(engine.accessories.groups.drive, [0, 0, 260]);
  add(engine.turbo.groups.comp, [90, 30, -140]);
  add(engine.turbo.root, [150, 40, 0]);
}

function applyExplode(t) {
  if (!engine) return;
  for (const [obj, e] of EXPLODE) {
    obj.position.copy(e.rest).addScaledVector(e.delta, t);
  }
  if (engine.gasRoot) engine.gasRoot.visible = state.gas && t < 0.25;
}

function applyVisibility() {
  if (!engine) return;
  engine.head.groups.covers.visible = state.covers;
  engine.accessories.groups.intercooler.visible = state.outer;
  engine.accessories.groups.exhaust.visible = state.outer;
  engine.accessories.root.visible = true;
  engine.turbo.root.visible = state.outer;
  engine.block.groups.timingCover.visible = state.beltCover;
  engine.rotating.timing.visible = true;
  const beltCovers = engine.rotating.timing.getObjectByName('BeltCover_Lower');
  if (beltCovers) beltCovers.visible = state.beltCover;
  if (engine.gases) for (const g of engine.gases) g.mesh.visible = g.mesh.visible && state.gas;
}

// -------------------------------------------------------------------- camera
const CENTRE = new THREE.Vector3();
let fitAll = 1200;

function recomputeBounds() {
  const box = new THREE.Box3().setFromObject(engine.root);
  box.getCenter(CENTRE);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fovR = (camera.fov * Math.PI) / 360;
  const distV = maxDim / (2 * Math.tan(fovR));
  const fovH = 2 * Math.atan(Math.tan(fovR) * camera.aspect);
  const distH = maxDim / (2 * Math.tan(fovH / 2));
  fitAll = Math.max(distV, distH) * 1.12;
}

const VIEWS = {
  os: { dir: [0.02, 0.1, 1], zoom: 1 },
  tq: { dir: [0.88, 0.52, 0.86], zoom: 1 },
  side: { dir: [1, 0.12, 0.04], zoom: 1 },
  top: { dir: [0.04, 1, 0.05], zoom: 1 },
  wal: { dir: [0.1, 0.16, 1], zoom: 0.46, target: new THREE.Vector3(0, 20, 0) },
  korbowody: { dir: [0.9, 0.3, 0.5], zoom: 0.42, target: new THREE.Vector3(0, 90, 0) },
  glowica: { dir: [0.5, 0.62, 0.6], zoom: 0.44, target: new THREE.Vector3(0, 330, 0) },
  turbo: { dir: [0.86, 0.44, 0.46], zoom: 0.36, target: TURBO_POS.clone().add(new THREE.Vector3(0, 10, 0)) },
};

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 60;
controls.maxDistance = 9000;

function setView(name) {
  const v = VIEWS[name] || VIEWS.tq;
  const target = v.target ? v.target.clone() : CENTRE.clone();
  const dir = new THREE.Vector3(...v.dir).normalize();
  const dist = fitAll * v.zoom;
  camera.position.copy(target).addScaledVector(dir, dist);
  controls.target.copy(target);
  controls.update();
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  return { name, dist: Math.round(dist) };
}

// -------------------------------------------------------------------- labels
let labelOverlay = null;
const LABELS = [
  ['Block_CylinderSection', 'Kadłub: 5 gniazd 81 mm'],
  ['Block_SideWall_R', 'Żeliwny blok, ściana korbowodu'],
  ['Block_PanRail_R', 'Płaszczyzna miski olejowej'],
  ['MainBulkhead_3', 'Przegroda łożyska głównego'],
  ['MainCap_3', 'Panewka główna (6 sztuk)'],
  ['Sump_Body', 'Miska olejowa'],
  ['TimingCover_Plate', 'Osłona paska rozrządu'],
  ['CRANKSHAFT', 'Wał korbowy, 5 czopów co 72°'],
  ['Crank_RodJournal_Cyl1', 'Czop korbowy cylindra 1'],
  ['Crank_Counterweight_Cyl1_A', 'Przeciwwaga'],
  ['ConnectingRod_Cyl3', 'Korbowód 144 mm'],
  ['Piston_Cyl5', 'Tłok 81 mm'],
  ['FLYWHEEL', 'Koło zamachowe z wieńcem'],
  ['CrankSprocket', 'Koło zębate wału, 22 zęby'],
  ['Timing_Belt', 'Pasek zębaty rozrządu'],
  ['CamSprocket_exhaust', 'Koło wałka wydechowego, 44 zęby'],
  ['CamDrive_Chain', 'Łańcuszek między wałkami'],
  ['Head_CastingBody', 'Głowica: aluminium, 20 zaworów'],
  ['Valve_Cyl1_intake_-16', 'Zawór dolotowy'],
  ['Valve_Cyl1_exhaust_-16', 'Zawór wydechowy'],
  ['Camshaft_intake', 'Wałek rozrządu dolotowy'],
  ['Camshaft_exhaust', 'Wałek rozrządu wydechowy'],
  ['CamLobe_Cyl3_exhaust_-16', 'Krzywka'],
  ['CamCover_exhaust', 'Kopułka wałka'],
  ['Valve_Spring', 'Sprężyna zaworu'],
  ['SparkPlug_Cyl3', 'Świeca zapłonowa'],
  ['CoilPack_Cyl3', 'Cewka zapłonowa'],
  ['TURBOCHARGER', 'Turbo KKK K24'],
  ['Compressor_Volute', 'Sprężarka: spirala'],
  ['Turbine_Volute', 'Turbina: spirala'],
  ['Compressor_Wheel', 'Wirnik sprężarki, 6 + 6 łopat'],
  ['Turbine_Wheel', 'Wirnik turbiny, 11 łopat'],
  ['Turbo_CentreHousing', 'Korpus łożyskowy (olej, ciecz)'],
  ['WASTEGATE_ACTUATOR', 'Siłownik zaworu wastegate'],
  ['Wastegate_Valve', 'Zawór wastegate'],
  ['Exhaust_Collector', 'Kolektor wydechowy 5 w 1'],
  ['Intake_Plenum', 'Kolektor dolotowy'],
  ['ThrottleBody_Body', 'Przepustnica'],
  ['INTERCOOLER', 'Chłodnica powietrza'],
  ['FuelRail', 'Listwa wtryskowa'],
  ['Injector_Cyl1', 'Wtryskiwacz'],
];

function rebuildLabels() {
  if (labelOverlay) {
    const wrap = host.querySelector('.labels');
    if (wrap) wrap.remove();
  }
  const list = [];
  for (const [name, text] of LABELS) {
    const o = engine.root.getObjectByName(name);
    if (!o) continue;
    const b = new THREE.Box3().setFromObject(o);
    const local = o.worldToLocal(b.getCenter(new THREE.Vector3()));
    list.push({ el: null, object: o, local, text });
  }
  labelOverlay = createLabels(host, camera, list);
  labelOverlay.setVisible(state.labels);
}

// --------------------------------------------------------------------- chart
const chart = document.getElementById('chart');
const cctx = chart?.getContext('2d');
const COLORS = ['#d0a13c', '#4d8ef7', '#4ad0a0', '#e2521f', '#b56fe0'];

function drawChart() {
  if (!cctx) return;
  const w = chart.width;
  const h = chart.height;
  cctx.clearRect(0, 0, w, h);
  cctx.fillStyle = 'rgba(255,255,255,0.03)';
  cctx.fillRect(0, 0, w, h);
  const cr = spec().cr === 9 ? 9 : 9.3;
  const vmax = 520;
  const y = (v) => h - 12 - (v / vmax) * (h - 26);
  for (let ci = 0; ci < 5; ci++) {
    const c = K.CYLINDERS[ci];
    cctx.strokeStyle = COLORS[ci];
    cctx.lineWidth = 1.7;
    cctx.beginPath();
    for (let d = 0; d <= 720; d += 6) {
      const v = K.chamberVolumeCc(c, d, cr);
      const x = 30 + (d / 720) * (w - 40);
      if (d === 0) cctx.moveTo(x, y(v));
      else cctx.lineTo(x, y(v));
    }
    cctx.stroke();
  }
  // grid at TDC and BDC
  cctx.strokeStyle = 'rgba(255,255,255,0.10)';
  cctx.lineWidth = 1;
  for (const k of [0, 90, 180, 270, 360, 450, 540, 630, 720]) {
    const x = 30 + (k / 720) * (w - 40);
    cctx.beginPath();
    cctx.moveTo(x, 12);
    cctx.lineTo(x, h - 12);
    cctx.stroke();
  }
  // marker at the current crank angle, and the same for the cam
  const x = 30 + (state.crank / 720) * (w - 40);
  cctx.strokeStyle = 'rgba(255,255,255,0.6)';
  cctx.beginPath();
  cctx.moveTo(x, 6);
  cctx.lineTo(x, h - 6);
  cctx.stroke();
  cctx.strokeStyle = 'rgba(208,161,60,0.45)';
  cctx.beginPath();
  cctx.moveTo(30 + ((((camDeg % 720) + 720) % 720) / 720) * (w - 40), 6);
  cctx.lineTo(30 + ((((camDeg % 720) + 720) % 720) / 720) * (w - 40), h - 6);
  cctx.stroke();
  for (let ci = 0; ci < 5; ci++) {
    const c = K.CYLINDERS[ci];
    cctx.fillStyle = COLORS[ci];
    cctx.beginPath();
    cctx.arc(x, y(K.chamberVolumeCc(c, state.crank, cr)), 2.6, 0, Math.PI * 2);
    cctx.fill();
  }
  cctx.fillStyle = 'rgba(255,255,255,0.5)';
  cctx.font = '13px -apple-system, system-ui, sans-serif';
  cctx.fillText('cm3', 3, 16);
  cctx.fillText('0°', 26, h - 1);
  cctx.fillText('720°', w - 44, h - 1);
}

// ----------------------------------------------------------------------- HUD
const ui = {
  crank: document.getElementById('crank'),
  rpm: document.getElementById('rpm'),
  slow: document.getElementById('slow'),
  play: document.getElementById('play'),
  explode: document.getElementById('explode'),
  labels: document.getElementById('labels'),
  gas: document.getElementById('gas'),
  covers: document.getElementById('covers'),
  beltCover: document.getElementById('beltCover'),
  outer: document.getElementById('outer'),
  hud: document.getElementById('hud'),
  outCrank: document.getElementById('crankOut'),
  outRpm: document.getElementById('rpmOut'),
  outSlow: document.getElementById('slowOut'),
  outExplode: document.getElementById('explodeOut'),
  specTable: document.getElementById('specTable'),
  cardTitle: document.getElementById('cardTitle'),
};

function syncOut() {
  if (ui.outCrank) ui.outCrank.textContent = `${Math.round(state.crank)}°`;
  if (ui.outRpm) ui.outRpm.textContent = `${Math.round(state.rpm)} obr/min`;
  if (ui.outSlow) ui.outSlow.textContent = `1 : ${Math.round(state.slow)}`;
  if (ui.outExplode) ui.outExplode.textContent = state.exploded.toFixed(2);
}

function updateSpecTable() {
  if (!ui.specTable) return;
  const v = spec();
  const cr = v.crAlt ? `${v.cr}:1 (inne źródła ${v.crAlt}:1)` : `${v.cr}:1`;
  const swept = K.sweptVolumeCc();
  ui.specTable.innerHTML = `
    <tr><td>Wersja</td><td>${v.code}, ${v.years}</td></tr>
    <tr><td>Pojemność (5 x pi/4 x 81^2 x 86,4)</td><td>${swept.toFixed(1)} cm3</td></tr>
    <tr><td>Otwór x skok</td><td>${K.SPEC.bore} x ${K.SPEC.stroke} mm</td></tr>
    <tr><td>Stopień sprężania</td><td>${cr}</td></tr>
    <tr><td>Moc / moment</td><td>${v.powerPs} KM / ${v.torqueNm[0]} Nm</td></tr>
    <tr><td>Turbo</td><td>${v.turbo}</td></tr>
    <tr><td>Doładowanie (model)</td><td>${K.boostBar(state.rpm, state.specCode).toFixed(2)} bar (max ${v.boostBar})</td></tr>
    <tr><td>Kolejność zapłonu</td><td>${K.SPEC.firingOrder.join('-')}</td></tr>
    <tr><td>Czopy korbowe</td><td>co 72°, ${K.LAYOUT.mainCount} łożyska główne</td></tr>
    <tr><td>Korbowód / sworzeń</td><td>${K.LAYOUT.rodLength} mm / ${K.LAYOUT.pinR * 2} mm</td></tr>
    <tr><td>Kąt korbowodu (max)</td><td>${K.maxRodAngleDeg().toFixed(2)}°</td></tr>
    <tr><td>Prędkość średnia tłoka</td><td>${K.meanPistonSpeed(state.rpm).toFixed(2)} m/s</td></tr>
    <tr><td>Głowica</td><td>${state.headMode === '20v' ? '20V DOHC, 20 zaworów' : '10V SOHC, 10 zaworów'}</td></tr>
    <tr><td>Prędkość wałka (1/2 wału)</td><td>${(((camDeg % 360) + 360) % 360).toFixed(0)}°</td></tr>
    <tr><td>Wałek turbiny (niezależny)</td><td>${Math.round(K.turboShaftRpm(state.rpm, state.specCode) / 1000)} tys. obr/min</td></tr>
  `;
}

const PHASE_PL = ['SSANIE', 'SPRĘŻANIE', 'PRACA', 'WYDECH'];
function updateHud() {
  if (!ui.hud) return;
  const cr = spec().cr === 9 ? 9 : 9.3;
  const tdc = K.pistonPinDistanceRange();
  const volts = K.CYLINDERS.map((c) => {
    const ph = K.strokeOf(c, state.crank);
    return `<span class="cell">C${c.id} <b>${K.chamberVolumeCc(c, state.crank, cr).toFixed(0)} cm³</b> <i>${ph.name}</i></span>`;
  }).join('');
  ui.hud.innerHTML =
    `<span class="cell">wał <b>${Math.round(state.crank % 360)}°</b></span>` +
    `<span class="cell">wałek <b>${Math.round(((camDeg % 360) + 360) % 360)}°</b></span>` +
    `<span class="cell">obroty <b>${Math.round(state.rpm)}</b></span>` +
    volts +
    `<span class="cell">skok tłoka z kinematyki <b>${tdc.stroke.toFixed(2)} mm</b></span>`;
}

// ------------------------------------------------------------------ composer
let composer = null;
try {
  const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: lq ? 0 : 4 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  if (!lq) {
    const ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    ssao.kernelRadius = 110;
    ssao.minDistance = 2;
    ssao.maxDistance = 620;
    composer.addPass(ssao);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.14, 0.7, 0.92));
  }
  composer.addPass(
    new ShaderPass({
      uniforms: { tDiffuse: { value: null }, amount: { value: lq ? 0 : 0.24 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;\n' +
        'void main(){ vec4 c = texture2D(tDiffuse, vUv); float d = distance(vUv, vec2(0.5)); c.rgb *= 1.0 - amount * smoothstep(0.35, 0.95, d); gl_FragColor = c; }',
    })
  );
  composer.addPass(new OutputPass());
} catch (e) {
  console.warn('composer unavailable, rendering direct', e);
  composer = null;
}

// ----------------------------------------------------------------------- UI
ui.crank?.addEventListener('input', () => {
  state.crank = parseFloat(ui.crank.value);
  state.playing = false;
  ui.play.textContent = 'ODTWÓRZ';
  refresh();
});
ui.rpm?.addEventListener('input', () => {
  state.rpm = parseFloat(ui.rpm.value);
  syncOut();
  updateSpecTable();
});
ui.slow?.addEventListener('input', () => {
  state.slow = parseFloat(ui.slow.value);
  syncOut();
});
ui.play?.addEventListener('click', () => {
  state.playing = !state.playing;
  ui.play.textContent = state.playing ? 'PAUZA' : 'ODTWÓRZ';
});
ui.explode?.addEventListener('input', () => {
  state.exploded = parseFloat(ui.explode.value);
  applyExplode(state.exploded);
  syncOut();
});
ui.gas?.addEventListener('change', () => {
  state.gas = ui.gas.checked;
  applyExplode(state.exploded);
});
ui.labels?.addEventListener('change', () => {
  state.labels = ui.labels.checked;
  labelOverlay?.setVisible(state.labels);
});
ui.covers?.addEventListener('change', () => {
  state.covers = ui.covers.checked;
  applyVisibility();
});
ui.beltCover?.addEventListener('change', () => {
  state.beltCover = ui.beltCover.checked;
  applyVisibility();
});
ui.outer?.addEventListener('change', () => {
  state.outer = ui.outer.checked;
  applyVisibility();
});
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
document.querySelectorAll('[data-head]').forEach((b) =>
  b.addEventListener('click', () => {
    state.headMode = b.dataset.head;
    document.querySelectorAll('[data-head]').forEach((x) => x.classList.toggle('active', x.dataset.head === state.headMode));
    rebuild();
  })
);
document.querySelectorAll('[data-spec]').forEach((b) =>
  b.addEventListener('click', () => {
    state.specCode = b.dataset.spec;
    document.querySelectorAll('[data-spec]').forEach((x) => x.classList.toggle('active', x.dataset.spec === state.specCode));
    updateSpecTable();
  })
);
window.addEventListener('keydown', (e) => {
  const keys = { '1': 'os', '2': 'tq', '3': 'side', '4': 'top', '5': 'wal', '6': 'korbowody', '7': 'glowica', '8': 'turbo' };
  if (keys[e.key]) setView(keys[e.key]);
});

function refresh() {
  if (!engine) return;
  engine.update(0, state.crank);
  syncOut();
  updateHud();
  updateSpecTable();
  drawChart();
}

function rebuild() {
  buildEngine();
  recomputeBounds();
  registerExplode();
  rebuildLabels();
  refresh();
  setView(currentView);
}

let currentView = params.get('view') || 'tq';
const origSetView = setView;
function setViewAndRemember(name) {
  currentView = name;
  return origSetView(name);
}
setView = setViewAndRemember;

// --------------------------------------------------------------------- loop
buildEngine();
recomputeBounds();
registerExplode();
rebuildLabels();
document.querySelectorAll('[data-head]').forEach((x) => x.classList.toggle('active', x.dataset.head === state.headMode));
document.querySelectorAll('[data-spec]').forEach((x) => x.classList.toggle('active', x.dataset.spec === state.specCode));
if (ui.crank) ui.crank.value = String(state.crank);
if (ui.rpm) ui.rpm.value = String(state.rpm);
if (ui.slow) ui.slow.value = String(state.slow);
if (ui.explode) ui.explode.value = String(state.exploded);
if (ui.play) ui.play.textContent = state.playing ? 'PAUZA' : 'ODTWÓRZ';
syncOut();
updateSpecTable();
refresh();
setView(currentView);

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.playing) {
    const crankRate = (state.rpm * 6) / state.slow; // deg of crank per second
    state.crank = (state.crank + crankRate * dt) % 720;
    if (ui.crank) ui.crank.value = String(state.crank);
    // the turbo shaft and the cams get their own clock: neither is the crank
    const shaftRate = (K.turboShaftRpm(state.rpm, state.specCode) / 60) * 360 / state.slow;
    turboDeg = (turboDeg + shaftRate * dt) % 360;
    camDeg = (camDeg - (crankRate / 2) * dt) % 720;
  }
  engine.update(0, state.crank);
  labelOverlay?.update();
  controls.update();
  if (composer) composer.render();
  else renderer.render(scene, camera);
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
  if (composer) composer.setSize(w, h);
  recomputeBounds();
});

// ------------------------------------------------------------------ harness
window.__set = (crankDeg, rpm) => {
  state.crank = crankDeg;
  if (rpm !== undefined) state.rpm = rpm;
  state.playing = false;
  if (ui.crank) ui.crank.value = String(crankDeg);
  if (ui.rpm) ui.rpm.value = String(state.rpm);
  if (ui.play) ui.play.textContent = 'ODTWÓRZ';
  camDeg = -crankDeg / 2;
  refresh();
};
window.__setView = (n) => setViewAndRemember(n);
window.__setHead = (m) => {
  state.headMode = m;
  rebuild();
};
window.__setSpec = (c) => {
  state.specCode = c;
  updateSpecTable();
};
window.__applyExplode = (t) => {
  state.exploded = t;
  if (ui.explode) ui.explode.value = String(t);
  applyExplode(t);
};
window.__setVisibility = (o) => {
  Object.assign(state, o);
  if (ui.covers) ui.covers.checked = state.covers;
  if (ui.beltCover) ui.beltCover.checked = state.beltCover;
  if (ui.outer) ui.outer.checked = state.outer;
  if (ui.gas) ui.gas.checked = state.gas;
  applyVisibility();
  applyExplode(state.exploded);
};
window.__camera = camera;
window.__state = state;
window.__engine = engine;
window.__math = K;
window.__stats = () => {
  let meshes = 0;
  let tris = 0;
  const names = [];
  scene.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      const g = o.geometry;
      if (g?.index) tris += g.index.count / 3;
      else if (g?.attributes?.position) tris += g.attributes.position.count / 3;
    }
    if (o.isGroup && o.name && o.parent === engine.root) names.push(o.name);
  });
  return {
    meshes,
    triangles: Math.round(tris),
    cam: camera.position.toArray().map(Math.round),
    crank: +state.crank.toFixed(2),
    camAngle: Math.round(((camDeg % 360) + 360) % 360),
    rpm: state.rpm,
    head: state.headMode,
    spec: state.specCode,
    turboShaftRpm: Math.round(K.turboShaftRpm(state.rpm, state.specCode)),
    boostBar: +K.boostBar(state.rpm, state.specCode).toFixed(3),
    sweptCc: +K.sweptVolumeCc().toFixed(2),
    sparkSequence: K.sparkAngles(),
    volumes: K.CYLINDERS.map((c) => +K.chamberVolumeCc(c, state.crank, spec().cr === 9 ? 9 : 9.3).toFixed(1)),
    pinDistance: K.CYLINDERS.map((c) => +K.pistonPinDistance(c, state.crank).s.toFixed(3)),
    rodAngleDeg: K.CYLINDERS.map((c) => +((K.rodAngle(c, state.crank) * 180) / Math.PI).toFixed(3)),
    valveLift: K.CYLINDERS.slice(0, 2).map((c) => ({
      cyl: c.id,
      intake: +K.lift('intake', K.cycleAngle(c, state.crank)).toFixed(3),
      exhaust: +K.lift('exhaust', K.cycleAngle(c, state.crank)).toFixed(3),
    })),
    explode: state.exploded,
    groups: names,
  };
};
window.__READY = true;
