// intake.js - dual-plane style intake manifold: valley plenum, eight curved
// runners to the head intake faces, carburettor flange, 4-barrel carburettor
// and the thermostat housing.

import * as THREE from 'three';
import { chamferBox, cylinder, tubeThrough, cached, mesh, fastener } from '../lib/geom.js';
import { LAYOUT } from '../lib/layout.js';

const PLENUM = { y: 288, halfX: 55, depth: 330 };

export function buildIntakeManifold(M, ports) {
  const root = new THREE.Group();
  root.name = 'INTAKE_MANIFOLD';

  // ---- plenum + valley pan
  const plenum = mesh(chamferBox(PLENUM.halfX * 2, 96, PLENUM.depth, 18, 5), M.castAluminium, 'IntakePlenum', root, [0, PLENUM.y, 0]);
  plenum.castShadow = true;
  const pan = mesh(chamferBox(168, 22, 430, 10, 3), M.castAluminium, 'IntakeValleyPan', root, [0, 246, 0]);
  pan.castShadow = true;

  // ---- runners
  const runnerGeoCache = new Map();
  for (const p of ports) {
    const n = new THREE.Vector3(-1, 0, 0).applyQuaternion(p.quat).normalize(); // into the valley
    const s = Math.sign(n.x) || 1;
    const i = Math.abs(p.z) > 100 ? 0 : 1;
    const dy = i === 0 ? 20 : -14; // dual-plane nesting
    const entry = new THREE.Vector3(s * PLENUM.halfX, PLENUM.y, p.z);
    const pts = [
      p.intake.clone().addScaledVector(n, -2),
      p.intake.clone().addScaledVector(n, 26),
      new THREE.Vector3(s * 126, 250, p.z + dy),
      new THREE.Vector3(s * 96, 272, p.z + dy),
      entry,
    ];
    const key = `${p.id}`;
    const geo = tubeThrough(pts, 21, 56, 12);
    runnerGeoCache.set(key, geo);
    const runner = mesh(geo, M.castAluminium, `IntakeRunner_Cyl${p.id}`, root);
    runner.castShadow = true;

    // port flange + gasket
    const flange = mesh(chamferBox(14, 68, 84, 5, 2), M.castAluminium, `IntakeFlange_Cyl${p.id}`, root);
    flange.position.copy(p.intake).addScaledVector(n, 6);
    flange.quaternion.copy(p.quat);
    flange.castShadow = true;
    const g = mesh(chamferBox(4, 70, 86, 4, 1), M.gasket, `IntakeGasket_Cyl${p.id}`, root);
    g.position.copy(p.intake).addScaledVector(n, -2);
    g.quaternion.copy(p.quat);
  }

  // ---- carburettor flange / spacer
  const spacer = mesh(chamferBox(210, 30, 250, 12, 3), M.castAluminium, 'Carb_Spacer', root, [0, 350, 0]);
  spacer.castShadow = true;
  mesh(chamferBox(150, 6, 190, 6, 2), M.gasket, 'Carb_Gasket', root, [0, 367, 0]);

  // ---- 4-barrel carburettor
  const carb = new THREE.Group();
  carb.name = 'Carburettor';
  root.add(carb);
  const body = mesh(chamferBox(170, 74, 196, 14, 4), M.castAluminium, 'Carb_Body', carb, [0, 406, 0]);
  body.castShadow = true;
  const horn = mesh(chamferBox(160, 34, 186, 16, 4), M.castAluminium, 'Carb_AirHorn', carb, [0, 458, 0]);
  horn.castShadow = true;
  mesh(chamferBox(168, 8, 194, 6, 2), M.polishedSteel, 'Carb_AirCleanerStudPlate', carb, [0, 476, 0]);
  // four venturi bores
  const boreOuter = cached('carbbore', () => new THREE.CylinderGeometry(30, 30, 96, 20, 1, true));
  const boreInner = cached('carbliner', () => new THREE.CylinderGeometry(25, 25, 92, 18, 1, true));
  for (const [dx, dz] of [
    [-38, -42], [38, -42], [-38, 42], [38, 42],
  ]) {
    mesh(boreOuter, M.castAluminium, `Carb_Venturi_${dx}_${dz}`, carb, [dx, 430, dz]);
    mesh(boreInner, M.bore, `Carb_VenturiBore_${dx}_${dz}`, carb, [dx, 430, dz]);
  }
  // throttle linkage + choke horn detail
  mesh(cylinder(6, 6, 90, 8), M.polishedSteel, 'Carb_ThrottleShaft', carb, [0, 384, 0]).rotation.z = Math.PI / 2;
  mesh(chamferBox(26, 20, 20, 4, 2), M.machinedSteel, 'Carb_ThrottleLever', carb, [96, 384, 40]);
  // fuel line
  const fuel = mesh(
    tubeThrough(
      [
        new THREE.Vector3(-120, 372, 70),
        new THREE.Vector3(-96, 396, 76),
        new THREE.Vector3(-40, 402, 84),
        new THREE.Vector3(-6, 400, 92),
      ],
      5,
      26,
      7
    ),
    M.brass,
    'Carb_FuelLine',
    carb
  );
  // air cleaner stud
  mesh(cylinder(7, 7, 60, 8), M.machinedSteel, 'Carb_AirCleanerStud', carb, [0, 505, 0]);

  // ---- thermostat housing at the front of the manifold
  const thermo = mesh(chamferBox(92, 50, 76, 12, 3), M.castAluminium, 'ThermostatHousing', root, [0, 344, 178]);
  thermo.castShadow = true;
  mesh(cylinder(30, 30, 34, 16), M.castAluminium, 'ThermostatHousing_Neck', root, [0, 366, 196]).rotation.x = Math.PI / 2;
  let bolt = 0;
  for (const [x, y] of [[-108, 288], [108, 288]]) {
    const b = fastener(9, 60, 15, M.machinedSteel, `IntakeManifoldBolt_${++bolt}`);
    b.position.set(x, y + 26, 0);
    b.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    root.add(b);
  }

  return { root, plenum, carb };
}
