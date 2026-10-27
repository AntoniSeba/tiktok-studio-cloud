// accessories.js - front accessory drive: damper, pulleys, serpentine belt,
// water pump and alternator, all hanging off the front of the block.

import * as THREE from 'three';
import {
  chamferBox,
  taperBox,
  smoothDisc,
  softCylinder,
  cylinder,
  lathe,
  tubeThrough,
  cached,
  mesh,
  fastener,
  beltPath,
  beltRibbon,
} from '../lib/geom.js';
import { LAYOUT } from '../lib/layout.js';

const BELT_Z = LAYOUT.beltZ; // 300

function makePulley(name, r, width, kind, M) {
  const g = new THREE.Group();
  g.name = name;
  const rim = mesh(smoothDisc(r, width, 48, 5), M.aluMachined, `${name}_Rim`, g);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  for (const s of [1, -1]) {
    const f = mesh(smoothDisc(r + 6, 4, 48, 1.5), M.aluMachined, `${name}_Flange_${s > 0 ? 'F' : 'R'}`, g, [0, 0, s * (width / 2 + 2)]);
    f.rotation.x = Math.PI / 2;
  }
  const hub = mesh(softCylinder(24, width + 10, 24, 2), M.darkSteel, `${name}_Hub`, g);
  hub.rotation.x = Math.PI / 2;
  if (kind === 'serpentine') {
    for (let i = 0; i < 4; i++) {
      const g2 = mesh(smoothDisc(r + 2, width / 10, 40, 1), M.darkSteel, `${name}_Rib_${i + 1}`, g, [0, 0, (i - 1.5) * (width / 5)]);
      g2.rotation.x = Math.PI / 2;
    }
  } else {
    const v = mesh(smoothDisc(r - 7, width * 0.7, 40, 3), M.darkSteel, `${name}_VGroove`, g);
    v.rotation.x = Math.PI / 2;
  }
  return g;
}

export function buildAccessoryDrive(M) {
  const root = new THREE.Group();
  root.name = 'ACCESSORY_DRIVE';

  const serp = new THREE.Group();
  serp.name = 'SERPENTINE_DRIVE';
  root.add(serp);

  const pulleys = {
    crank: { x: 0, y: 0, r: 70 },
    idler: { x: 150, y: 80, r: 35 },
    water: { x: 0, y: 150, r: 55 },
    alt: { x: -230, y: 120, r: 42 },
    tensioner: { x: -135, y: -50, r: 38 },
  };

  // damper on the crank snout
  const damper = new THREE.Group();
  damper.name = 'Crank_Damper';
  damper.position.set(0, 0, 250);
  serp.add(damper);
  const dOuter = mesh(smoothDisc(74, 22, 48, 4), M.aluMachined, 'Damper_OuterRing', damper);
  dOuter.rotation.x = Math.PI / 2;
  const dRubber = mesh(smoothDisc(66, 14, 48, 3), M.rubber, 'Damper_Elastomer', damper);
  dRubber.rotation.x = Math.PI / 2;
  const dHub = mesh(softCylinder(44, 34, 32, 3), M.darkSteel, 'Damper_Hub', damper);
  dHub.rotation.x = Math.PI / 2;

  const crankPulley = makePulley('CrankPulley', 70, 34, 'serpentine', M);
  crankPulley.position.set(0, 0, BELT_Z);
  serp.add(crankPulley);
  const wpPulley = makePulley('WaterPumpPulley', 55, 32, 'serpentine', M);
  wpPulley.position.set(0, 150, BELT_Z);
  serp.add(wpPulley);
  const altPulley = makePulley('AlternatorPulley', 42, 28, 'serpentine', M);
  altPulley.position.set(-230, 120, BELT_Z);
  serp.add(altPulley);
  const idlerPulley = makePulley('IdlerPulley', 35, 30, 'serpentine', M);
  idlerPulley.position.set(150, 80, BELT_Z);
  serp.add(idlerPulley);
  const tensPulley = makePulley('TensionerPulley', 38, 30, 'serpentine', M);
  tensPulley.position.set(-135, -50, BELT_Z);
  serp.add(tensPulley);

  const arm = mesh(taperBox(26, 18, 120, 22, 8, 3), M.aluCast, 'Tensioner_Arm', serp, [-108, -12, BELT_Z - 28]);
  arm.rotation.z = -0.52;
  const spring = mesh(softCylinder(26, 44, 28, 3), M.aluDark, 'Tensioner_Housing', serp, [-72, 26, BELT_Z - 32]);
  spring.rotation.x = Math.PI / 2;
  mesh(taperBox(24, 18, 84, 54, 8, 3), M.aluCast, 'Idler_Bracket', serp, [168, 96, BELT_Z - 30]);

  const beltSamples = beltPath([pulleys.crank, pulleys.idler, pulleys.water, pulleys.alt, pulleys.tensioner]);
  const belt = mesh(beltRibbon(beltSamples, 26, 8, BELT_Z, 46), M.beltRubber, 'Serpentine_Belt', serp);
  belt.castShadow = true;

  // ------------------------------------------------------------ accessory units
  const units = new THREE.Group();
  units.name = 'ACCESSORY_UNITS';
  root.add(units);

  const wp = new THREE.Group();
  wp.name = 'WaterPump';
  units.add(wp);
  const wpBody = mesh(smoothDisc(68, 62, 48, 6), M.aluCast, 'WaterPump_Body', wp, [0, 150, 246]);
  wpBody.rotation.x = Math.PI / 2;
  wpBody.castShadow = true;
  const wpShaft = mesh(softCylinder(22, 34, 24, 4), M.darkSteel, 'WaterPump_Shaft', wp, [0, 150, 292]);
  wpShaft.rotation.x = Math.PI / 2;
  const inlet = mesh(tubeThrough([new THREE.Vector3(-52, 124, 236), new THREE.Vector3(-104, 108, 232), new THREE.Vector3(-140, 96, 232)], 26, 24, 16), M.aluCast, 'WaterPump_Inlet', wp);
  inlet.castShadow = true;
  mesh(chamferBox(150, 128, 8, 10, 2), M.gasket, 'WaterPump_Gasket', wp, [0, 150, 212]);
  for (const [x, y] of [[-54, 186], [54, 186], [-54, 112], [54, 112]]) {
    const b = fastener(9, 36, 15, M.darkSteel, `WaterPumpBolt_${x}_${y}`);
    b.position.set(x, y, 208);
    b.rotation.x = Math.PI / 2;
    wp.add(b);
  }

  const alt = new THREE.Group();
  alt.name = 'Alternator';
  units.add(alt);
  const altBody = mesh(smoothDisc(52, 100, 40, 5), M.aluCast, 'Alternator_Body', alt, [-230, 120, 240]);
  altBody.rotation.x = Math.PI / 2;
  altBody.castShadow = true;
  for (const z of [188, 292]) {
    const cap = mesh(smoothDisc(54, 12, 40, 3), M.aluDark, `Alternator_EndFrame_${z}`, alt, [-230, 120, z]);
    cap.rotation.x = Math.PI / 2;
  }
  const altShaft = mesh(softCylinder(16, 30, 20, 3), M.darkSteel, 'Alternator_Shaft', alt, [-230, 120, 296]);
  altShaft.rotation.x = Math.PI / 2;
  const bracket = mesh(taperBox(22, 16, 140, 96, 8, 3), M.aluDark, 'Alternator_Bracket', alt, [-192, 116, 160]);
  bracket.castShadow = true;
  const strap = mesh(taperBox(16, 12, 118, 26, 6, 2), M.aluDark, 'Alternator_AdjusterStrap', alt, [-186, 186, 176]);
  strap.rotation.z = 0.5;
  for (const y of [76, 160]) {
    const b = fastener(11, 50, 19, M.darkSteel, `AlternatorBolt_${y}`);
    b.position.set(-190, y, 150);
    b.rotation.z = Math.PI / 2;
    alt.add(b);
  }

  return { root, pulleys, belt };
}
