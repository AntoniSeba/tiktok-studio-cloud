// exhaust.js - two stainless 3-into-1 headers, built from the head exhaust
// port positions so the primaries land on the port faces.

import * as THREE from 'three';
import { chamferBox, cylinder, tubeThrough, mesh, fastener } from '../lib/geom.js';

const TUBE_R = 18;

export function buildHeaders(M, ports) {
  const root = new THREE.Group();
  root.name = 'EXHAUST_HEADERS';

  for (const bank of ['L', 'R']) {
    const wrap = new THREE.Group();
    wrap.name = `HEADER_${bank}`;
    root.add(wrap);
    const s = bank === 'R' ? 1 : -1;

    const A = new THREE.Vector3(s * 206, -48, -96);
    const B = new THREE.Vector3(s * 208, -62, -252);
    const axis = B.clone().sub(A).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(axis, up).normalize();
    const perpUp = new THREE.Vector3().crossVectors(side, axis).normalize();

    const bankPorts = ports.filter((p) => p.bank === bank).sort((a, b) => b.z - a.z);
    bankPorts.forEach((p, i) => {
      const off = [
        side.clone().multiplyScalar(11).addScaledVector(perpUp, 11),
        side.clone().multiplyScalar(-11).addScaledVector(perpUp, 11),
        side.clone().multiplyScalar(0).addScaledVector(perpUp, -13),
      ][i];
      const pts = [
        p.exhaust.clone().addScaledVector(new THREE.Vector3(s, 0, 0), 6),
        p.exhaust.clone().addScaledVector(new THREE.Vector3(s, 0, 0), 26),
        new THREE.Vector3(s * 232, 122, p.z - 24),
        new THREE.Vector3(s * 224, 24, p.z - 62),
        A.clone().add(off).addScaledVector(axis, -44),
        B.clone().add(off).addScaledVector(axis, -14),
      ];
      const tube = mesh(tubeThrough(pts, TUBE_R, 72, 16), M.headerSteel, `HeaderPrimary_${bank}_Cyl${p.id}`, wrap);
      tube.castShadow = true;

      const flange = mesh(chamferBox(12, 84, 92, 6, 2), M.headerSteel, `HeaderFlange_${bank}_Cyl${p.id}`, wrap);
      flange.position.set(p.exhaust.x + s * 9, p.exhaust.y, p.exhaust.z);
      flange.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      flange.castShadow = true;
      for (const du of [-28, 28]) {
        const b = fastener(9, 30, 15, M.darkSteel, `HeaderNut_${bank}_Cyl${p.id}_${du}`);
        b.position.set(p.exhaust.x + s * 15, p.exhaust.y + du, p.exhaust.z);
        b.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
        wrap.add(b);
      }
    });

    const coneLen = A.distanceTo(B);
    const cone = mesh(new THREE.CylinderGeometry(68, 40, coneLen, 30, 1, true), M.headerSteel, `HeaderCollector_${bank}`, wrap);
    cone.position.copy(A).lerp(B, 0.5);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    cone.material = M.headerSteel.clone();
    cone.material.side = THREE.DoubleSide;
    cone.castShadow = true;

    const outlet = mesh(cylinder(42, 42, 80, 26), M.headerSteel, `HeaderOutlet_${bank}`, wrap);
    outlet.position.copy(B).addScaledVector(axis, 26);
    outlet.quaternion.copy(cone.quaternion);
    outlet.castShadow = true;
    const outFlange = mesh(chamferBox(14, 116, 116, 10, 3), M.headerSteel, `HeaderOutletFlange_${bank}`, wrap);
    outFlange.position.copy(B).addScaledVector(axis, 68);
    outFlange.quaternion.copy(cone.quaternion);
    const ring = mesh(cylinder(70, 70, 18, 30, 1, true), M.headerSteel, `HeaderCollectorRing_${bank}`, wrap);
    ring.material = cone.material;
    ring.position.copy(A).addScaledVector(axis, -4);
  }

  return { root };
}
