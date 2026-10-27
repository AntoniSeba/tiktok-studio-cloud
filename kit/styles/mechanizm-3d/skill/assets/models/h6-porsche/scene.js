// scene.js - Porsche 4.0 H6 (9A2 evo) w wersji filmowej: buildEngine(M) i update(deg) jako czysta funkcja kąta wału.
// Źródło: modele-zrodla/porsche-h6-engine (przeglądarka interaktywna). Osie: wał wzdłuż Z (+Z przód),
// bank A (cyl. 1-3) przy +X, bank B (cyl. 4-6) przy -X, Y w górę (dolot u góry, wydech i miska na dole).
import * as THREE from 'three';
import * as L from './lib/layout.js';
import { buildBlockAssembly } from './parts/block.js';
import { buildHeads, updateValvetrain } from './parts/heads.js';
import { buildRotatingAssembly } from './parts/rotating.js';
import { buildIntake } from './parts/intake.js';
import { buildExhaust } from './parts/exhaust.js';
import { buildCovers } from './parts/covers.js';

// rozkład: [nazwa grupy, kierunek, dystans w mm] (jak w przeglądarce, większe dystanse pod kadr filmowy)
const EX = [
  ['HEAD_A', [1, 0, 0], 330],
  ['HEAD_B', [-1, 0, 0], 330],
  ['CAM_COVER_A', [1, 0, 0], 540],
  ['CAM_COVER_B', [-1, 0, 0], 540],
  ['HALF_CASE_A', [1, 0.15, 0], 200],
  ['HALF_CASE_B', [-1, -0.15, 0], 200],
  ['INTAKE_SYSTEM', [0, 1, 0], 380],
  ['EXHAUST_SYSTEM', [0, -1, 0], 380],
  ['OIL_SYSTEM', [0, -1, 0], 230],
  ['THERMAL_MANAGEMENT', [0.4, 1, 0.4], 300],
  ['TIMING_COVER', [0, 0, -1], 280],
  ['TIMING_DRIVE', [0, 0, 1], 150],
  ['ACCESSORY_DRIVE', [0, 0, 1], 220],
  ['FLYWHEEL_ASSEMBLY', [0, 0, 1], 320],
  ['STARTER_MOTOR', [0.6, 0, 1], 240],
  ['ENGINE_MOUNTS', [0, 1, 0], 200],
];

export function buildEngine(M) {
  const root = new THREE.Group();
  root.name = 'ENGINE';
  const block = buildBlockAssembly(M);
  const heads = buildHeads(M);
  const rot = buildRotatingAssembly(M);
  const intake = buildIntake(M);
  const exhaust = buildExhaust(M);
  const covers = buildCovers(M);
  root.add(block.root, heads.root, rot.root, intake.root, exhaust.root, covers.root);

  const explode = [];
  for (const [name, dir, dist] of EX) {
    const obj = root.getObjectByName(name);
    if (!obj) { console.warn('h6: brak grupy', name); continue; }
    explode.push({ obj, name, rest: obj.position.clone(), delta: new THREE.Vector3(...dir).normalize().multiplyScalar(dist) });
  }
  const transmission = root.getObjectByName('TRANSMISSION');
  // w filmie sam silnik: bez skrzyni biegów, tłumika i rur za katalizatorami
  transmission.visible = false;
  root.getObjectByName('MUFFLER').visible = false;
  root.updateMatrixWorld(true);
  for (const b of ['EXHAUST_BANK_A', 'EXHAUST_BANK_B']) {
    for (const o of root.getObjectByName(b).children) {
      const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      if (c.z < -380) o.visible = false;
    }
  }

  function update(deg) {
    rot.update(deg);
    updateValvetrain(heads.valvetrain, heads.cams, deg);
  }
  update(0);
  return { root, block, heads, rotating: rot, intake, exhaust, covers, transmission, explode, update };
}
