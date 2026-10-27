// exhaust.js - tubular 4-into-1 headers, one per bank, built from the actual
// exhaust port positions so the primaries land on the port flanges.

import * as THREE from 'three';
import { chamferBox, cylinder, tubeThrough, mesh, fastener } from '../lib/geom.js';

const TUBE_R = 19;

export function buildHeaders(M, ports) {
  const root = new THREE.Group();
  root.name = 'EXHAUST_HEADERS';

  for (const bank of ['L', 'R']) {
    const wrap = new THREE.Group();
    wrap.name = `HEADER_${bank}`;
    root.add(wrap);
    const group = new THREE.Group();
    group.name = `HEADER_SET_${bank}`;
    wrap.add(group);

    const s = bank === 'R' ? 1 : -1;
    // collector axis: runs rearward under the block on each side
    const A = new THREE.Vector3(s * 252, -58, -196);
    const B = new THREE.Vector3(s * 250, -74, -352);
    const axis = B.clone().sub(A).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(axis, up).normalize();
    const perpUp = new THREE.Vector3().crossVectors(side, axis).normalize();

    const bankPorts = ports.filter((p) => p.bank === bank).sort((a, b) => b.z - a.z);
    bankPorts.forEach((p, i) => {
      const off = [
        side.clone().multiplyScalar(14).addScaledVector(perpUp, 14),
        side.clone().multiplyScalar(-14).addScaledVector(perpUp, 14),
        side.clone().multiplyScalar(14).addScaledVector(perpUp, -14),
        side.clone().multiplyScalar(-14).addScaledVector(perpUp, -14),
      ][i];
      const start = p.exhaust.clone().addScaledVector(new THREE.Vector3(s, 0, 0), 22);
      const pts = [
        p.exhaust.clone().addScaledVector(new THREE.Vector3(s, 0, 0), 4),
        start,
        new THREE.Vector3(s * 286, 40, p.z - 30),
        new THREE.Vector3(s * 276, -34, p.z - 96),
        A.clone().add(off).addScaledVector(axis, -46),
        B.clone().add(off).addScaledVector(axis, -18),
      ];
      const geo = tubeThrough(pts, TUBE_R, 54, 11);
      const tube = mesh(geo, M.headerSteel, `HeaderPrimary_${bank}_Cyl${p.id}`, group);
      tube.castShadow = true;

      // port flange on the tube
      const flange = mesh(chamferBox(12, 96, 104, 6, 2), M.machinedSteel, `HeaderFlange_${bank}_Cyl${p.id}`, group);
      flange.position.set(p.exhaust.x + s * 11, p.exhaust.y, p.exhaust.z);
      flange.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      flange.castShadow = true;
      for (const du of [-32, 32]) {
        const b = fastener(10, 34, 17, M.machinedSteel, `HeaderBolt_${bank}_Cyl${p.id}_${du}`);
        b.position.set(p.exhaust.x + s * 17, p.exhaust.y + du, p.exhaust.z);
        b.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
        group.add(b);
      }
    });

    // collector cone + outlet
    const coneLen = A.distanceTo(B);
    const cone = mesh(
      new THREE.CylinderGeometry(78, 44, coneLen, 26, 1, true),
      M.headerSteel,
      `HeaderCollector_${bank}`,
      group
    );
    cone.position.copy(A).lerp(B, 0.5);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    cone.material.side = THREE.DoubleSide;
    cone.castShadow = true;

    const outlet = mesh(cylinder(46, 46, 90, 22), M.headerSteel, `HeaderOutlet_${bank}`, group);
    outlet.position.copy(B).addScaledVector(axis, 30);
    outlet.quaternion.copy(cone.quaternion);
    outlet.castShadow = true;
    const outFlange = mesh(chamferBox(16, 130, 130, 8, 2), M.machinedSteel, `HeaderOutletFlange_${bank}`, group);
    outFlange.position.copy(B).addScaledVector(axis, 76);
    outFlange.quaternion.copy(cone.quaternion);
    // collector ring detail
    mesh(cylinder(80, 80, 22, 26, 1, true), M.machinedSteel, `HeaderCollectorRing_${bank}`, group)
      .position.copy(A)
      .addScaledVector(axis, -6);
  }

  return { root };
}
