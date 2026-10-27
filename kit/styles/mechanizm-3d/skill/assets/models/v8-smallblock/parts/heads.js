// heads.js - cylinder heads, valve covers, valvetrain and spark plugs.
// All geometry is authored in bank-local coordinates inside a rotation-only
// frame, so both banks come from the same numbers.

import * as THREE from 'three';
import { chamferBox, cylinder, cached, mesh, fastener, coilSpring, mirrorBankX } from '../lib/geom.js';
import { LAYOUT, CYLINDERS, BANK_ROT_Z } from '../lib/layout.js';
import { BANK_HALF } from './block.js';

const HEAD_BOTTOM = LAYOUT.deckHeight + 3; // gasket sits between deck and head
const HEAD_TOP = HEAD_BOTTOM + LAYOUT.headThickness;
const COVER_TOP = HEAD_TOP + LAYOUT.valveCoverHeight;
const ROCKER_Y = HEAD_TOP + 2;

// Valve placement, bank-local. Intake is inboard (toward the valley), exhaust
// outboard; both offset along the head so each pair straddles the bore.
const VALVES = [
  { tag: 'Intake', x: -34, zOff: 26, cupX: -70, cupZOff: -45 },
  { tag: 'Exhaust', x: 6, zOff: -26, cupX: -52, cupZOff: 45 },
];

export function buildHeads(M) {
  const root = new THREE.Group();
  root.name = 'CYLINDER_HEADS';
  const heads = {};
  const ports = [];

  const stemGeo = cached('valvestem', () => new THREE.CylinderGeometry(4.5, 4.5, 100, 10));
  const valveHeadGeo = cached('valvehead', () => new THREE.CylinderGeometry(19, 15, 11, 18));
  const retainerGeo = cached('retainer', () => new THREE.CylinderGeometry(14, 14, 6, 14));
  const guideGeo = cached('valveguide', () => new THREE.CylinderGeometry(9, 9, 46, 12));
  const springGeo = cached('valvespring', () => coilSpring(13, 84, 6, 3));

  for (const bank of ['L', 'R']) {
    const wrap = new THREE.Group();
    wrap.name = `HEAD_${bank}`;
    root.add(wrap);
    const frame = new THREE.Group();
    frame.name = `HEAD_FRAME_${bank}`;
    frame.rotation.z = BANK_ROT_Z[bank];
    wrap.add(frame);

    // ---- head casting + gasket
    const head = mesh(
      chamferBox(LAYOUT.headWidth, LAYOUT.headThickness, LAYOUT.headLength, 12, 3),
      M.castAluminium,
      `CylinderHead_${bank}`,
      frame,
      [0, (HEAD_BOTTOM + HEAD_TOP) / 2, 0]
    );
    head.castShadow = true;
    head.receiveShadow = true;
    mesh(
      chamferBox(LAYOUT.headWidth - 4, 3, LAYOUT.headLength - 4, 3, 1),
      M.gasket,
      `HeadGasket_${bank}`,
      frame,
      [0, LAYOUT.deckHeight + 1.5, 0]
    );

    // ---- valve cover with ribs, filler cap and bolts (own group so it can
    // lift off separately in the exploded view)
    const coverGroup = new THREE.Group();
    coverGroup.name = `VALVE_COVER_${bank}`;
    coverGroup.rotation.z = BANK_ROT_Z[bank];
    wrap.add(coverGroup);
    const cover = mesh(
      chamferBox(126, LAYOUT.valveCoverHeight, 490, 14, 4),
      M.plasticBlack,
      `ValveCover_${bank}`,
      coverGroup,
      [0, HEAD_TOP + LAYOUT.valveCoverHeight / 2, 0]
    );
    cover.castShadow = true;
    for (const x of [-38, 0, 38]) {
      mesh(chamferBox(18, 7, 468, 3, 1.5), M.plasticBlack, `ValveCover_Rib_${bank}_${x}`, coverGroup, [x, COVER_TOP + 2, 0]);
    }
    mesh(chamferBox(124, 3, 486, 3, 1), M.gasket, `ValveCoverGasket_${bank}`, coverGroup, [0, HEAD_TOP + 1, 0]);
    const filler = mesh(cylinder(26, 26, 22, 18), M.plasticBlack, `OilFillerCap_${bank}`, coverGroup, [0, COVER_TOP + 10, bank === 'L' ? -170 : 170]);
    filler.castShadow = true;
    for (const z of [-215, -110, 0, 110, 215]) {
      for (const x of [-52, 52]) {
        const b = fastener(7, 26, 12, M.machinedSteel, `ValveCoverBolt_${bank}_${z}_${x}`);
        b.position.set(x, HEAD_TOP + 2, z);
        coverGroup.add(b);
      }
    }
    if (bank === 'L') mirrorBankX(coverGroup);

    // ---- port bosses
    for (const c of CYLINDERS.filter((c) => c.bank === bank)) {
      const inBoss = mesh(
        chamferBox(20, 62, 76, 7, 3),
        M.castAluminium,
        `IntakePortBoss_Cyl${c.id}`,
        frame,
        [-(BANK_HALF + 8), 292, c.z]
      );
      inBoss.castShadow = true;
      mesh(chamferBox(24, 70, 82, 8, 3), M.castAluminium, `ExhaustPortBoss_Cyl${c.id}`, frame, [BANK_HALF + 10, 286, c.z]).castShadow = true;
      // exhaust flange plate + bolts
      const flange = mesh(chamferBox(10, 96, 104, 6, 2), M.castIron, `ExhaustFlange_Cyl${c.id}`, frame, [BANK_HALF + 24, 286, c.z]);
      flange.castShadow = true;
      for (const dz of [-34, 34]) {
        const b = fastener(10, 30, 17, M.machinedSteel, `ExhaustFlangeBolt_Cyl${c.id}_${dz}`);
        b.position.set(BANK_HALF + 30, 286 + dz * 0.0 + dz, c.z);
        b.position.set(BANK_HALF + 30, 286 + dz, c.z);
        b.rotation.z = -Math.PI / 2;
        frame.add(b);
      }
      // intake flange bolts use a 2-stud pattern per port
      for (const dz of [-26, 26]) {
        const b = fastener(9, 34, 15, M.machinedSteel, `IntakeFlangeBolt_Cyl${c.id}_${dz}`);
        b.position.set(-(BANK_HALF + 14), 292 + dz, c.z);
        b.rotation.z = Math.PI / 2;
        frame.add(b);
      }
    }

    // ---- valvetrain: valves, springs, rockers, studs
    for (const c of CYLINDERS.filter((c) => c.bank === bank)) {
      for (const v of VALVES) {
        const z = c.z + v.zOff;
        const stem = mesh(stemGeo, M.polishedSteel, `Valve_Cyl${c.id}_${v.tag}`, frame, [v.x, 290, z]);
        mesh(valveHeadGeo, M.polishedSteel, `ValveHead_Cyl${c.id}_${v.tag}`, frame, [v.x, 236, z]);
        mesh(guideGeo, M.brass, `ValveGuide_Cyl${c.id}_${v.tag}`, frame, [v.x, 276, z]);
        mesh(springGeo, M.machinedSteel, `ValveSpring_Cyl${c.id}_${v.tag}`, frame, [v.x, 288, z]);
        mesh(retainerGeo, M.machinedSteel, `ValveRetainer_Cyl${c.id}_${v.tag}`, frame, [v.x, 334, z]);

        // rocker arm: lever from the pushrod cup to the valve tip
        const cup = new THREE.Vector3(v.cupX, ROCKER_Y, c.z + v.cupZOff);
        const tip = new THREE.Vector3(v.x, ROCKER_Y, z);
        const mid = cup.clone().add(tip).multiplyScalar(0.5);
        const len = cup.distanceTo(tip);
        const rocker = mesh(
          chamferBox(18, 12, len, 4, 2),
          M.machinedSteel,
          `RockerArm_Cyl${c.id}_${v.tag}`,
          frame,
          [mid.x, mid.y, mid.z]
        );
        rocker.rotation.y = Math.atan2(tip.x - cup.x, tip.z - cup.z);
        mesh(cylinder(9, 9, 12, 12), M.machinedSteel, `RockerCup_Cyl${c.id}_${v.tag}`, frame, [cup.x, ROCKER_Y, cup.z]);
        const stud = mesh(cylinder(6, 6, 40, 10), M.machinedSteel, `RockerStud_Cyl${c.id}_${v.tag}`, frame, [mid.x, ROCKER_Y + 12, mid.z]);
        const nut = mesh(cached('rockernut', () => new THREE.CylinderGeometry(11, 11, 14, 6)), M.machinedSteel, `RockerNut_Cyl${c.id}_${v.tag}`, frame, [mid.x, ROCKER_Y + 30, mid.z]);
        // pushrod guide plate hint
        mesh(chamferBox(14, 26, 12, 3, 1.5), M.castIron, `PushrodGuide_Cyl${c.id}_${v.tag}`, frame, [v.cupX, 240, c.z + v.cupZOff]);
      }
    }

    // ---- spark plugs, entering the head from the outboard side
    for (const c of CYLINDERS.filter((c) => c.bank === bank)) {
      const plug = new THREE.Group();
      plug.name = `SparkPlug_Cyl${c.id}`;
      plug.position.set(66, 320, c.z);
      plug.rotation.z = -Math.PI / 4; // 45 deg, pointing into the chamber
      frame.add(plug);
      mesh(cylinder(7, 3, 30, 10), M.machinedSteel, `SparkPlug_Tip_Cyl${c.id}`, plug, [0, -28, 0]);
      mesh(cached('plughex', () => new THREE.CylinderGeometry(12, 12, 16, 6)), M.polishedSteel, `SparkPlug_Hex_Cyl${c.id}`, plug, [0, -4, 0]);
      mesh(cylinder(11, 11, 44, 14), M.ceramic, `SparkPlug_Insulator_Cyl${c.id}`, plug, [0, 24, 0]);
      mesh(cylinder(13, 13, 34, 12), M.rubber, `SparkPlug_Boot_Cyl${c.id}`, plug, [0, 62, 0]);
      mesh(cylinder(9, 9, 10, 10), M.rubber, `SparkPlug_Terminal_Cyl${c.id}`, plug, [0, 80, 0]);
    }

    if (bank === 'L') mirrorBankX(frame);
    heads[bank] = { wrap, frame };
  }

  // ---- collect world-space port positions for the intake and exhaust builders
  root.updateMatrixWorld(true);
  for (const c of CYLINDERS) {
    const { frame } = heads[c.bank];
    const sign = c.bank === 'R' ? 1 : -1;
    const intakeLocal = new THREE.Vector3(sign * -(BANK_HALF + 8), 292, c.z);
    const exhaustLocal = new THREE.Vector3(sign * (BANK_HALF + 10), 286, c.z);
    const bootLocal = new THREE.Vector3(sign * 110, 364, c.z);
    const q = new THREE.Quaternion();
    frame.getWorldQuaternion(q);
    ports.push({
      id: c.id,
      bank: c.bank,
      z: c.z,
      intake: frame.localToWorld(intakeLocal.clone()),
      exhaust: frame.localToWorld(exhaustLocal.clone()),
      boot: frame.localToWorld(bootLocal.clone()),
      quat: q,
    });
  }

  return { root, heads, ports, constants: { HEAD_BOTTOM, HEAD_TOP, COVER_TOP, ROCKER_Y, VALVES } };
}
