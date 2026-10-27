// scene.js - assembles the complete V8 and declares the exploded-view
// offsets and the label targets. Object naming: assemblies are UPPER_CASE
// collection groups, individual parts are PascalCase with a suffix.

import * as THREE from 'three';
import { buildBlockAssembly } from './parts/block.js';
import { buildRotatingAssembly } from './parts/rotating.js';
import { buildHeads } from './parts/heads.js';
import { buildIntakeManifold } from './parts/intake.js';
import { buildHeaders } from './parts/exhaust.js';
import { buildAccessoryDrive } from './parts/accessories.js';
import { BANK_DIR } from './lib/layout.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

export function buildEngine(M) {
  const root = new THREE.Group();
  root.name = 'V8_ENGINE_ASSEMBLY';

  const block = buildBlockAssembly(M);
  root.add(block.root);

  const heads = buildHeads(M);
  root.add(heads.root);

  const intake = buildIntakeManifold(M, heads.ports);
  root.add(intake.root);

  const headers = buildHeaders(M, heads.ports);
  root.add(headers.root);

  const accessories = buildAccessoryDrive(M, heads.ports);
  root.add(accessories.root);

  const rotating = buildRotatingAssembly(M);
  root.add(rotating.root);

  // ------------------------------------------------- exploded-view offsets
  // Distance and direction that each collection travels when the exploded
  // slider goes to 1. Bank-oriented assemblies travel along their bore axis.
  const explode = [];
  const set = (obj, dir, dist) => {
    if (!obj) return;
    obj.userData.explode = dir.clone().normalize().multiplyScalar(dist);
    explode.push(obj);
  };

  set(block.root.getObjectByName('MAIN_BEARING_CAPS'), v(0, -1, 0), 300);
  set(block.root.getObjectByName('OIL_PAN_ASSEMBLY'), v(0, -1, 0), 540);
  set(block.root.getObjectByName('TIMING_COVER'), v(0, 0.1, 1), 400);
  set(block.root.getObjectByName('HEAD_BOLTS'), v(0, 1, 0), 260);
  set(rotating.flywheel, v(0, 0, -1), 460);
  set(rotating.crank, v(0, -1, 0), 300);
  set(rotating.cam, v(0, 1, 0), 380);
  set(rotating.timing, v(0, 0, 1), 200);
  for (const cyl of rotating.cylinders) {
    set(cyl.wrap, v(BANK_DIR[cyl.def.bank].x, BANK_DIR[cyl.def.bank].y, 0), 470);
  }

  for (const bank of ['L', 'R']) {
    const d = BANK_DIR[bank];
    set(heads.heads[bank].wrap, v(d.x, d.y, 0), 560);
    set(heads.root.getObjectByName(`VALVE_COVER_${bank}`), v(d.x, d.y, 0), 980);
    set(headers.root.getObjectByName(`HEADER_${bank}`), v(Math.sign(d.x), -0.15, 0), 620);
  }

  set(intake.root, v(0, 1, 0), 700);
  set(intake.root.getObjectByName('Carburettor'), v(0, 1, 0), 1000);

  const acc = accessories.root;
  set(acc.getObjectByName('WaterPump'), v(0, 0.15, 1), 330);
  set(acc.getObjectByName('Alternator'), v(-0.7, 0.25, 1), 560);
  set(acc.getObjectByName('PowerSteeringPump'), v(0.7, 0.25, 1), 560);

  // -------------------------------------------------------------- labels
  // Each label anchors to a named object; the anchor point is the centre of
  // that object's bounding box, expressed in the object's own local space so
  // it follows the part through the exploded view.
  const LABELS = [
    ['CylinderBlock_Casting', 'Cylinder block: 90° V8, deck height 229 mm, bore spacing 111.76 mm'],
    ['Block_DeckPlate_R', 'Deck + 101.6 mm bore (dry liner)'],
    ['CylinderHead_R', 'Cylinder head, 110 mm thick, 2 valves per cylinder'],
    ['VALVE_COVER_R', 'Valve cover (rocker covers underneath)'],
    ['IntakePlenum', 'Intake manifold: dual-plane plenum + 8 runners'],
    ['Carburettor', '4-barrel carburettor'],
    ['HEADER_R', 'Exhaust header: 4-into-1, Ø38 mm primaries'],
    ['CRANKSHAFT', 'Crankshaft: 4 throws at 90°, stroke 88.4 mm'],
    ['PISTONS_AND_RODS', 'Pistons + rods: 152 mm rods, slider-crank drive'],
    ['MAIN_BEARING_CAPS', '5 main bearing caps'],
    ['OIL_PAN_ASSEMBLY', 'Oil pan with rear sump'],
    ['TIMING_DRIVE', 'Timing chain drive (crank 42T -> cam 76T)'],
    ['CAMSHAFT', 'Camshaft: 16 lobes, in-block, gear driven'],
    ['LIFTERS', 'Hydraulic lifters on the cam base circle'],
    ['PUSHRODS', 'Pushrods to the rocker arms'],
    ['WaterPump', 'Water pump + pulley'],
    ['Alternator', 'Alternator, poly-V driven'],
    ['Serpentine_Belt', 'Serpentine belt: wraps 5 pulleys'],
    ['PowerSteeringPump', 'Power steering pump (separate V-belt)'],
    ['Flywheel', 'Flywheel + 112-tooth ring gear'],
    ['Distributor', 'Distributor and 8 ignition wires'],
  ];

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const labels = [];
  for (const [name, text] of LABELS) {
    const obj = root.getObjectByName(name);
    if (!obj) {
      console.warn('label target missing:', name);
      continue;
    }
    const b = new THREE.Box3().setFromObject(obj);
    const center = b.getCenter(new THREE.Vector3());
    const local = obj.worldToLocal(center.clone());
    labels.push({ el: null, object: obj, local, text });
  }

  const api = {
    root,
    labels,
    box,
    explodeGroups: explode,
    rotating,
    accessories,
    intake,
    headers,
    heads,
    block,
    setCrankAngle: rotating.update,
  };
  return api;
}
