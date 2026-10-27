// heads.js - V6 cylinder heads: tapered casting, one overhead cam per bank
// with lobes and bearing caps, buckets, valves, springs, cam cover and
// spark plugs. Everything is authored in bank-local coordinates inside a
// rotation-only frame so both banks share the same numbers.

import * as THREE from 'three';
import {
  chamferBox,
  taperBox,
  arcDisc,
  cylinder,
  softCylinder,
  camLobeGeometry,
  coilSpring,
  gearGeometry,
  cached,
  mesh,
  fastener,
  mirrorBankX,
} from '../lib/geom.js';
import { LAYOUT, CYLINDERS, BANK_ROT_Z, lobePhase } from '../lib/layout.js';
import { BANK_HALF } from './block.js';

const GASKET_Y = LAYOUT.deckHeight + 3; // 213
const HEAD_TOP = GASKET_Y + LAYOUT.headThickness; // 305
const CAM_Y = LAYOUT.deckHeight + LAYOUT.camAboveDeck; // 322
const CAM_BASE_R = 22;
const BUCKET_TOP = CAM_Y - CAM_BASE_R; // 300, bucket top at zero lift
const BUCKET_H = 16;
const SPRING_SEAT_Y = 222;
const COVER_BOTTOM = HEAD_TOP + 53; // 358
const COVER_TOP = COVER_BOTTOM + 54;

export function buildHeads(M) {
  const root = new THREE.Group();
  root.name = 'CYLINDER_HEADS';
  const heads = {};
  const ports = [];
  const valvetrain = [];

  const bucketGeo = cached('bucket', () => softCylinder(LAYOUT.bucketR, BUCKET_H, 32, 2));
  const stemGeo = cached('valvestem', () => cylinder(4.5, 4.5, 86, 12));
  const valveHeadGeo = cached('valvehead', () => {
    const g = new THREE.CylinderGeometry(LAYOUT.valveHeadR, 12, 12, 24);
    g.translate(0, -4, 0);
    return g;
  });
  const springGeo = cached('vspring', () => coilSpring(15, 62, 7, 3.2, 8));
  const retainerGeo = cached('vretainer', () => softCylinder(15, 8, 24, 1.5));

  for (const bank of ['L', 'R']) {
    const wrap = new THREE.Group();
    wrap.name = `HEAD_${bank}`;
    root.add(wrap);
    const frame = new THREE.Group();
    frame.name = `HEAD_FRAME_${bank}`;
    frame.rotation.z = BANK_ROT_Z[bank];
    wrap.add(frame);

    // ---- casting + gasket
    const head = mesh(
      taperBox(LAYOUT.headWidth, LAYOUT.headWidth - 18, LAYOUT.headThickness, LAYOUT.headLength, 16, 5),
      M.aluCast,
      `CylinderHead_${bank}`,
      frame,
      [0, GASKET_Y + LAYOUT.headThickness / 2, 0]
    );
    head.castShadow = true;
    head.receiveShadow = true;
    mesh(chamferBox(LAYOUT.headWidth - 6, 3, LAYOUT.headLength - 6, 4, 1), M.gasket, `HeadGasket_${bank}`, frame, [0, LAYOUT.deckHeight + 1.5, 0]);
    // machined cam deck
    mesh(chamferBox(120, 10, LAYOUT.headLength - 24, 8, 2), M.aluMachined, `Head_CamDeck_${bank}`, frame, [0, HEAD_TOP - 3, 0]);

    // ---- cam cover (own group so it can lift off in the exploded view)
    const coverGroup = new THREE.Group();
    coverGroup.name = `CAM_COVER_${bank}`;
    coverGroup.rotation.z = BANK_ROT_Z[bank];
    wrap.add(coverGroup);
    const cover = mesh(
      taperBox(156, 104, COVER_TOP - COVER_BOTTOM, 336, 22, 5),
      M.coverPlastic,
      `CamCover_${bank}`,
      coverGroup,
      [0, (COVER_BOTTOM + COVER_TOP) / 2, 0]
    );
    cover.castShadow = true;
    for (const z of [-96, 0, 96]) {
      mesh(chamferBox(22, 8, 60, 4, 2), M.coverPlastic, `CamCover_Rib_${bank}_${z}`, coverGroup, [0, COVER_TOP + 3, z]);
    }
    mesh(chamferBox(152, 4, 332, 4, 1), M.gasket, `CamCoverGasket_${bank}`, coverGroup, [0, COVER_BOTTOM + 1, 0]);
    const filler = mesh(softCylinder(24, 20, 24, 3), M.coverPlastic, `OilFillerCap_${bank}`, coverGroup, [0, COVER_TOP + 12, bank === 'R' ? 140 : -140]);
    filler.castShadow = true;
    for (const z of [-150, -75, 0, 75, 150]) {
      for (const x of [-62, 62]) {
        const b = fastener(7, 26, 12, M.darkSteel, `CamCoverBolt_${bank}_${z}_${x}`);
        b.position.set(x, COVER_BOTTOM + 2, z);
        coverGroup.add(b);
      }
    }
    if (bank === 'L') mirrorBankX(coverGroup);

    // ---- camshaft
    const cam = new THREE.Group();
    cam.name = `CAMSHAFT_${bank}`;
    cam.position.set(0, CAM_Y, 0);
    frame.add(cam);
    const shaft = mesh(cylinder(20, 20, 372, 28), M.darkSteel, `CamShaft_${bank}`, cam);
    shaft.rotation.x = Math.PI / 2;
    shaft.castShadow = true;
    for (const z of [-150, -54, 54, 150]) {
      const j = mesh(cylinder(24, 24, 34, 28), M.steel, `Cam_Journal_${bank}_${z}`, cam, [0, 0, z]);
      j.rotation.x = Math.PI / 2;
      // bearing cap tower
      const cap = mesh(arcDisc(34, 0, Math.PI, 34, 26), M.aluMachined, `Cam_BearingCap_${bank}_${z}`, frame, [0, CAM_Y, z]);
      cap.castShadow = true;
      for (const dx of [-26, 26]) {
        const b = fastener(8, 40, 15, M.darkSteel, `CamCapBolt_${bank}_${z}_${dx}`);
        b.position.set(dx, CAM_Y + 30, z);
        cam.parent.add(b);
      }
    }
    // lobes: one per valve, phase set so the nose lands on the bucket at
    // maximum lift
    for (const c of CYLINDERS.filter((c) => c.bank === bank)) {
      for (const which of ['intake', 'exhaust']) {
        const z = c.z + LAYOUT.valveZOffsets[which];
        const lobe = mesh(camLobeGeometry(lobePhase(c, which), CAM_BASE_R, LAYOUT.valveLift, 17), M.steel, `CamLobe_${bank}_Cyl${c.id}_${which}`, cam, [0, 0, z]);
        lobe.castShadow = true;
      }
    }
    // cam sprocket, driven by the timing chain
    const sprocket = mesh(gearGeometry(38, 56, 7, 16), M.darkSteel, `CamSprocket_${bank}`, cam, [0, 0, LAYOUT.chainZ]);
    sprocket.castShadow = true;
    const bolt = fastener(12, 40, 20, M.darkSteel, `CamSprocketBolt_${bank}`);
    bolt.position.set(0, 0, LAYOUT.chainZ + 16);
    bolt.rotation.x = Math.PI / 2;
    cam.add(bolt);

    // ---- valves, buckets, springs (animated by the director)
    for (const c of CYLINDERS.filter((c) => c.bank === bank)) {
      for (const which of ['intake', 'exhaust']) {
        const z = c.z + LAYOUT.valveZOffsets[which];
        // bucket + retainer ride on the cam
        const bucket = mesh(bucketGeo, M.steel, `Bucket_${bank}_Cyl${c.id}_${which}`, frame, [0, BUCKET_TOP - BUCKET_H / 2, z]);
        bucket.castShadow = true;
        const retainer = mesh(retainerGeo, M.darkSteel, `ValveRetainer_${bank}_Cyl${c.id}_${which}`, frame, [0, BUCKET_TOP - BUCKET_H - 2, z]);
        const spring = mesh(springGeo, M.spring, `ValveSpring_${bank}_Cyl${c.id}_${which}`, frame, [0, SPRING_SEAT_Y, z]);
        spring.castShadow = true;
        const stem = mesh(stemGeo, M.valveSteel, `Valve_${bank}_Cyl${c.id}_${which}`, frame, [0, 250, z]);
        const vhead = mesh(valveHeadGeo, M.valveSteel, `ValveHead_${bank}_Cyl${c.id}_${which}`, frame, [0, LAYOUT.deckHeight - 4, z]);
        const guide = mesh(cylinder(9, 9, 44, 16), M.brass, `ValveGuide_${bank}_Cyl${c.id}_${which}`, frame, [0, 250, z]);
        valvetrain.push({
          bank,
          cylId: c.id,
          which,
          z,
          bucket,
          retainer,
          spring,
          stem,
          vhead,
          springFree: 62,
          springSeat: SPRING_SEAT_Y,
          baseLift: 0,
        });
      }
    }

    // ---- ports
    for (const c of CYLINDERS.filter((c) => c.bank === bank)) {
      const inBoss = mesh(
        taperBox(26, 20, 62, 74, 8, 3),
        M.aluMachined,
        `IntakePortBoss_Cyl${c.id}`,
        frame,
        [-(BANK_HALF + 4), 288, c.z]
      );
      inBoss.castShadow = true;
      const exBoss = mesh(
        taperBox(26, 20, 58, 78, 8, 3),
        M.aluMachined,
        `ExhaustPortBoss_Cyl${c.id}`,
        frame,
        [BANK_HALF + 4, 278, c.z]
      );
      exBoss.castShadow = true;
      // exhaust studs
      for (const dz of [-30, 30]) {
        const b = fastener(9, 30, 15, M.darkSteel, `ExhaustStud_Cyl${c.id}_${dz}`);
        b.position.set(BANK_HALF + 14, 278 + dz, c.z);
        b.rotation.z = -Math.PI / 2;
        frame.add(b);
      }
      for (const dz of [-28, 28]) {
        const b = fastener(8, 30, 14, M.darkSteel, `IntakeStud_Cyl${c.id}_${dz}`);
        b.position.set(-(BANK_HALF + 14), 288 + dz, c.z);
        b.rotation.z = Math.PI / 2;
        frame.add(b);
      }
    }

    // ---- spark plugs, entering from the outboard face at 45 degrees
    for (const c of CYLINDERS.filter((c) => c.bank === bank)) {
      const plug = new THREE.Group();
      plug.name = `SparkPlug_Cyl${c.id}`;
      plug.position.set(64, 292, c.z);
      plug.rotation.z = -Math.PI / 4;
      frame.add(plug);
      mesh(cylinder(7, 3, 34, 12), M.darkSteel, `SparkPlug_Tip_Cyl${c.id}`, plug, [0, -30, 0]);
      mesh(cached('plughex', () => new THREE.CylinderGeometry(11, 11, 14, 6)), M.steel, `SparkPlug_Hex_Cyl${c.id}`, plug, [0, -6, 0]);
      mesh(cylinder(10, 10, 40, 16), M.ceramic, `SparkPlug_Insulator_Cyl${c.id}`, plug, [0, 22, 0]);
      mesh(cylinder(12, 12, 30, 14), M.rubber, `Coil_Boot_Cyl${c.id}`, plug, [0, 56, 0]);
      mesh(chamferBox(40, 56, 40, 10, 4), M.plastic, `Coil_Cyl${c.id}`, plug, [0, 92, 0]);
    }

    if (bank === 'L') mirrorBankX(frame);
    heads[bank] = { wrap, frame, cam };
  }

  // ---- world-space port + datum positions for the intake, exhaust and
  // ignition builders, and for the animation
  root.updateMatrixWorld(true);
  for (const c of CYLINDERS) {
    const { frame } = heads[c.bank];
    const sign = c.bank === 'R' ? 1 : -1;
    const q = new THREE.Quaternion();
    frame.getWorldQuaternion(q);
    ports.push({
      id: c.id,
      bank: c.bank,
      z: c.z,
      intake: frame.localToWorld(new THREE.Vector3(sign * -(BANK_HALF + 4), 288, c.z)),
      exhaust: frame.localToWorld(new THREE.Vector3(sign * (BANK_HALF + 4), 278, c.z)),
      coilTop: frame.localToWorld(new THREE.Vector3(sign * (64 + 78), 292 + 78, c.z)),
      quat: q,
    });
  }

  return { root, heads, ports, valvetrain, constants: { GASKET_Y, HEAD_TOP, CAM_Y, BUCKET_TOP, BUCKET_H, COVER_TOP } };
}
