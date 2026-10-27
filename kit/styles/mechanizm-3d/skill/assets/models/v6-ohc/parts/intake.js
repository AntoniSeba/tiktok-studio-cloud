// intake.js - V6 intake manifold: a slim plenum in the valley with six
// curved runners to the head intake faces, plus a throttle body.

import * as THREE from 'three';
import { chamferBox, taperBox, softCylinder, cylinder, tubeThrough, mesh, fastener } from '../lib/geom.js';

export function buildIntakeManifold(M, ports) {
  const root = new THREE.Group();
  root.name = 'INTAKE_MANIFOLD';

  const plenum = mesh(taperBox(132, 104, 96, 330, 20, 5), M.aluCast, 'IntakePlenum', root, [0, 352, 0]);
  plenum.castShadow = true;
  const base = mesh(taperBox(150, 120, 26, 350, 12, 4), M.aluMachined, 'IntakePlenum_Base', root, [0, 300, 0]);
  base.castShadow = true;
  mesh(chamferBox(140, 6, 340, 6, 2), M.gasket, 'IntakeGasket_Plenum', root, [0, 292, 0]);

  for (const p of ports) {
    const n = new THREE.Vector3(-1, 0, 0).applyQuaternion(p.quat).normalize();
    const s = Math.sign(n.x) || 1;
    const dy = p.z > 0 ? 18 : -14;
    const entry = new THREE.Vector3(s * 54, 336, p.z);
    const pts = [
      p.intake.clone().addScaledVector(n, -2),
      p.intake.clone().addScaledVector(n, 18),
      new THREE.Vector3(s * 76, 282, p.z + dy),
      new THREE.Vector3(s * 66, 306, p.z + dy * 0.6),
      entry,
    ];
    const runner = mesh(tubeThrough(pts, 19, 72, 20), M.aluCast, `IntakeRunner_Cyl${p.id}`, root);
    runner.castShadow = true;
    const flange = mesh(chamferBox(14, 62, 76, 6, 2), M.aluMachined, `IntakeFlange_Cyl${p.id}`, root);
    flange.position.copy(p.intake).addScaledVector(n, 6);
    flange.quaternion.copy(p.quat);
    flange.castShadow = true;
    const g = mesh(chamferBox(4, 64, 78, 4, 1), M.gasket, `IntakeGasket_Cyl${p.id}`, root);
    g.position.copy(p.intake).addScaledVector(n, -2);
    g.quaternion.copy(p.quat);
  }

  // throttle body on the front of the plenum
  const tb = new THREE.Group();
  tb.name = 'ThrottleBody';
  tb.position.set(0, 360, 186);
  root.add(tb);
  const tbBody = mesh(softCylinder(46, 44, 32, 4), M.aluMachined, 'ThrottleBody_Body', tb);
  tbBody.rotation.x = Math.PI / 2;
  tbBody.castShadow = true;
  mesh(cylinder(36, 36, 46, 28, true), M.bore, 'ThrottleBody_Bore', tb).rotation.x = Math.PI / 2;
  mesh(chamferBox(26, 20, 22, 5, 2), M.darkSteel, 'ThrottleBody_Lever', tb, [52, 0, -6]);
  mesh(cylinder(8, 8, 60, 10), M.darkSteel, 'ThrottleBody_Shaft', tb).rotation.z = Math.PI / 2;

  // intake duct stub
  const duct = mesh(
    tubeThrough(
      [
        new THREE.Vector3(0, 360, 208),
        new THREE.Vector3(0, 380, 250),
        new THREE.Vector3(-30, 396, 286),
      ],
      40,
      26,
      16
    ),
    M.plastic,
    'IntakeDuct',
    root
  );
  duct.castShadow = true;

  let bolt = 0;
  for (const [x, y] of [[-104, 300], [104, 300]]) {
    const b = fastener(9, 54, 15, M.darkSteel, `IntakeManifoldBolt_${++bolt}`);
    b.position.set(x, y + 24, 0);
    b.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    root.add(b);
  }

  return { root, plenum, throttleBody: tb };
}
