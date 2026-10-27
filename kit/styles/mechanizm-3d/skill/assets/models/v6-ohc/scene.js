// scene.js - assembles the complete V6 and declares the exploded-view
// offsets, the animated cylinder volume and the label anchors.

import * as THREE from 'three';
import { buildBlockAssembly } from './parts/block.js';
import { buildRotatingAssembly } from './parts/rotating.js';
import { buildHeads } from './parts/heads.js';
import { buildIntakeManifold } from './parts/intake.js';
import { buildHeaders } from './parts/exhaust.js';
import { buildAccessoryDrive } from './parts/accessories.js';
import { BANK_DIR, LAYOUT, CYLINDERS, pistonPinDistance } from './lib/layout.js';
import { cylinder } from './lib/geom.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

export function buildEngine(M) {
  const root = new THREE.Group();
  root.name = 'V6_ENGINE_ASSEMBLY';

  const block = buildBlockAssembly(M);
  root.add(block.root);
  const heads = buildHeads(M);
  root.add(heads.root);
  const intake = buildIntakeManifold(M, heads.ports);
  root.add(intake.root);
  const headers = buildHeaders(M, heads.ports);
  root.add(headers.root);
  const accessories = buildAccessoryDrive(M);
  root.add(accessories.root);
  const rotating = buildRotatingAssembly(M);
  root.add(rotating.root);

  // ------------------------------------------------------ highlighted cylinder
  const focus = CYLINDERS.find((c) => c.id === 1);
  const dir = BANK_DIR[focus.bank];
  const boreAxis = new THREE.Vector3(dir.x, dir.y, 0).normalize();

  const highlight = new THREE.Group();
  highlight.name = 'CYLINDER_1_HIGHLIGHT';
  root.add(highlight);

  // gas volume inside the bore, resized every frame between crown and deck
  const charge = new THREE.Mesh(cylinder(45, 45, 1, 32), M.charge);
  charge.name = 'Cylinder1_Charge';
  charge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), boreAxis);
  charge.userData.axis = boreAxis;
  highlight.add(charge);

  // glowing ring on the deck of cylinder 1
  const ring = new THREE.Mesh(new THREE.TorusGeometry(50, 3.2, 10, 48), M.accent);
  ring.name = 'Cylinder1_DeckRing';
  ring.position.copy(boreAxis).multiplyScalar(LAYOUT.deckHeight);
  ring.position.z = focus.z;
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), boreAxis);
  highlight.add(ring);

  // ------------------------------------------------------- exploded offsets
  const explodeGroups = [];
  const set = (obj, dir3, dist) => {
    if (!obj) return;
    obj.userData.explode = dir3.clone().normalize().multiplyScalar(dist);
    explodeGroups.push(obj);
  };

  set(block.root.getObjectByName('MAIN_BEARING_CAPS'), v(0, -1, 0), 220);
  set(block.root.getObjectByName('OIL_PAN_ASSEMBLY'), v(0, -1.15, 0), 470);
  set(block.root.getObjectByName('OIL_FILTER'), v(1, -0.3, 0.2), 380);
  set(block.root.getObjectByName('TIMING_COVER'), v(0, 0.1, 1), 340);
  set(block.root.getObjectByName('HEAD_BOLTS'), v(0, 1, 0), 230);
  set(rotating.flywheel, v(0, 0, -1), 420);
  set(rotating.crank, v(0, -1, 0), 260);
  set(rotating.timing, v(0, 0.1, 1), 200);
  for (const cyl of rotating.cylinders) {
    const d = BANK_DIR[cyl.def.bank];
    set(cyl.wrap, v(d.x, d.y, 0), 420);
  }
  for (const bank of ['L', 'R']) {
    const d = BANK_DIR[bank];
    set(heads.heads[bank].wrap, v(d.x, d.y, 0), 420);
    set(heads.root.getObjectByName(`CAM_COVER_${bank}`), v(d.x, d.y, 0), 430);
    set(headers.root.getObjectByName(`HEADER_${bank}`), v(Math.sign(d.x), -0.2, 0), 420);
  }
  set(intake.root, v(0, 1, 0), 400);
  set(intake.root.getObjectByName('ThrottleBody'), v(0, 0.55, 1), 520);
  const acc = accessories.root;
  set(acc.getObjectByName('WaterPump'), v(0, 0.15, 1), 300);
  set(acc.getObjectByName('Alternator'), v(-0.8, 0.3, 1), 520);
  set(acc.getObjectByName('Crank_Damper'), v(0, 0, 1), 700);

  // ------------------------------------------------------------------ labels
  const LABELS = [
    ['CylinderBlock_Casting', 'Blok silnika 60° V6, aluminiowy odlew'],
    ['Block_DeckPlate_R', 'Płaszczyzna głowicy, tuleja 94 mm'],
    ['CylinderHead_R', 'Głowica z wałkiem rozrządu'],
    ['CAMSHAFT_R', 'Wałek rozrządu, 6 krzywek'],
    ['Valve_R_Cyl1_intake', 'Zawór dolotowy'],
    ['Piston_Cyl1', 'Tłok 94 mm'],
    ['ConnectingRod_Cyl1', 'Korbowód 148 mm'],
    ['CRANKSHAFT', 'Wał korbowy, skok 85 mm'],
    ['IntakePlenum', 'Kolektor dolotowy'],
    ['HEADER_R', 'Kolektor wydechowy 3 w 1'],
    ['Timing_Chain', 'Łańcuszek rozrządu'],
    ['Serpentine_Belt', 'Pasek osprzętu'],
    ['FLYWHEEL', 'Koło zamachowe'],
  ];
  root.updateMatrixWorld(true);
  const labels = [];
  for (const [name, text] of LABELS) {
    const obj = root.getObjectByName(name);
    if (!obj) {
      console.warn('label target missing:', name);
      continue;
    }
    const b = new THREE.Box3().setFromObject(obj);
    const local = obj.worldToLocal(b.getCenter(new THREE.Vector3()));
    labels.push({ el: null, object: obj, local, text });
  }

  // ---------------------------------------------------------------- updater
  function updateCrank(crankDeg) {
    rotating.update(crankDeg);
    // gas volume between the piston crown and the deck
    const { s } = pistonPinDistance(focus, crankDeg);
    const crown = s + LAYOUT.pistonHeight / 2 - 2;
    const deck = LAYOUT.deckHeight;
    const len = Math.max(2, deck - crown);
    charge.scale.set(1, len, 1);
    charge.position.copy(boreAxis).multiplyScalar(crown + len / 2);
    charge.position.z = focus.z;
  }
  updateCrank(0);

  return {
    root,
    block,
    heads,
    intake,
    headers,
    accessories,
    rotating,
    explodeGroups,
    labels,
    valvetrain: heads.valvetrain,
    focus,
    highlight,
    charge,
    ring,
    updateCrank,
  };
}
