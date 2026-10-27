// covers.js - oslony napedu rozrzadu i przeniesienie napedu: pokrywa rozrzadu
// na koncu walu, pokrywa tylna, obudowa sprzegla, skrzynia PDK z wyjsciami
// na polosie i przeguby. Wszystko odsuwane w widoku rozlozonym.

import * as THREE from 'three';
import { chamferBox, taperBox, cylinder, softCylinder, extrudeProfile, cached, mesh, fastener } from '../lib/geom.js';
import { annulus, plateAlongX, circlePoints } from '../lib/shapes.js';
import { LAYOUT } from '../lib/layout.js';

export function buildCovers(M) {
  const root = new THREE.Group();
  root.name = 'COVERS_AND_DRIVELINE';

  // ---- pokrywa napedu rozrzadu (plaszczyzna prostopadla do osi walu)
  const timing = new THREE.Group();
  timing.name = 'TIMING_COVER';
  root.add(timing);
  const prof = [
    [-330, -160],
    [330, -160],
    [392, -120],
    [392, 120],
    [330, 160],
    [-330, 160],
  ];
  const tgeo = extrudeProfile(prof, 26, 5);
  tgeo.translate(0, 0, LAYOUT.timingCoverZ - 13);
  const tcover = new THREE.Mesh(tgeo, M.caseCast);
  tcover.name = 'TimingCover_Plate';
  tcover.castShadow = true;
  timing.add(tcover);
  // garb nad kolami walkow rozrzadu
  for (const s of [1, -1]) {
    const hump = mesh(chamferBox(150, 220, 40, 60, 5), M.caseCast, `TimingCover_CamHump_${s > 0 ? 'A' : 'B'}`, timing, [s * LAYOUT.camX, 0, LAYOUT.timingCoverZ - 34]);
    hump.castShadow = true;
  }
  mesh(chamferBox(120, 170, 40, 50, 5), M.caseCast, 'TimingCover_CrankHump', timing, [0, 0, LAYOUT.timingCoverZ - 34]);
  let tb = 0;
  for (const [x, y] of [
    [200, 140], [200, -140], [330, 100], [330, -100], [370, 0], [-370, 0],
    [-330, 100], [-330, -100], [-200, 140], [-200, -140], [0, 150], [0, -150],
  ]) {
    const b = fastener(9, 34, 16, M.darkSteel, `TimingCoverBolt_${++tb}`);
    b.position.set(x, y, LAYOUT.timingCoverZ - 30);
    b.rotation.x = -Math.PI / 2;
    timing.add(b);
  }

  // ---- obudowa sprzegla i skrzynia PDK
  const br = new THREE.Group();
  br.name = 'TRANSMISSION';
  root.add(br);
  const bell = mesh(taperBox(360, 300, 230, 150, 40, 5), M.caseCast, 'Bellhousing', br, [0, -20, -320]);
  bell.rotation.x = Math.PI / 2;
  bell.castShadow = true;
  mesh(taperBox(300, 260, 190, 420, 34, 5), M.caseCast, 'Gearbox_Housing', br, [0, -20, -520]).rotation.x = Math.PI / 2;
  mesh(chamferBox(260, 60, 200, 40, 4), M.caseCastDark, 'Gearbox_Cover', br, [0, 90, -520]).rotation.x = Math.PI / 2;
  const outL = mesh(softCylinder(52, 60, 20, 4), M.caseMachined, 'DriveFlange_Left', br, [-160, -20, -520]);
  outL.rotation.z = Math.PI / 2;
  const outR = mesh(softCylinder(52, 60, 20, 4), M.caseMachined, 'DriveFlange_Right', br, [160, -20, -520]);
  outR.rotation.z = Math.PI / 2;
  for (const s of [1, -1]) {
    mesh(softCylinder(46, 40, 18, 4), M.darkSteel, `CVJoint_${s > 0 ? 'Right' : 'Left'}`, br, [s * 214, -20, -520]).rotation.z = Math.PI / 2;
    mesh(cylinder(26, 26, 130, 18), M.caseMachined, `DriveShaft_${s > 0 ? 'Right' : 'Left'}`, br, [s * 290, -20, -520]).rotation.z = Math.PI / 2;
  }
  // uchwyt mocowania skrzyni
  mesh(taperBox(90, 70, 70, 130, 14, 4), M.caseCastDark, 'TransmissionMount', br, [0, -170, -380]);
  mesh(chamferBox(70, 40, 90, 18, 3), M.rubber, 'TransmissionMount_Isolator', br, [0, -222, -380]);
  return { root, timing, transmission: br };
}
