// block.js - cylinder block assembly: casting, deck plates with real bore
// openings, bottom end, covers, mounts, and the block-side valvetrain
// (lifters, pushrods, head bolts).
//
// Coordinate convention
//   world: X = across the engine, Y = up, Z = along the crank axis (+Z = front)
//   bank-local (a group rotated +/-45 deg about Z, origin on the crank centre):
//     +Y = up the bore axis, +X = outboard, Z = along the crank axis
// Bank-local coordinates for the valvetrain are identical on both banks, since
// the valley is always on the -X side of a bank.

import * as THREE from 'three';
import { chamferBox, extrudeProfile, cached, mesh, fastener, mirrorBankX } from '../lib/geom.js';
import { LAYOUT, CYLINDERS, MAIN_Z, BANK_ROT_Z } from '../lib/layout.js';

export const BANK_HALF = 74; // casting face offset from the bore axis
export const DECK_PLATE_BOTTOM = 139; // deck plate is 90 mm thick (139 -> 229)
export const DECK_PLATE_X = [-68, 76]; // inboard edge inset from the casting
export const VALLEY_APEX_Y = 104.7; // world Y where the two valley walls meet
export const CAM_FRAME = { x: -99, y: 99 }; // cam centre in bank-local coords
export const LIFTER_X = -80;
export const LIFTER_Y = [110, 156];

// Casting cross-section in world XY, extruded along Z. The boundary walks the
// outside of the block, then in to form the open-bottom crankcase (pan rails).
export function blockProfile() {
  return [
    [128, -95],
    [116, 11.3],
    [150.6, 46],
    [46, 150.6],
    [0, VALLEY_APEX_Y],
    [-46, 150.6],
    [-150.6, 46],
    [-116, 11.3],
    [-128, -95],
    // crankcase: rails in, up the cavity wall, across the ceiling, back down
    [-105, -95],
    [-105, 60],
    [105, 60],
    [105, -95],
  ];
}

function profileScaled(s) {
  return blockProfile().map(([x, y]) => [x * s, y * s]);
}

export function buildBlockAssembly(M) {
  const root = new THREE.Group();
  root.name = 'BLOCK_ASSEMBLY';

  const bankFrames = { L: new THREE.Group(), R: new THREE.Group() };
  bankFrames.L.name = 'BANK_FRAME_L';
  bankFrames.R.name = 'BANK_FRAME_R';
  bankFrames.L.rotation.z = BANK_ROT_Z.L;
  bankFrames.R.rotation.z = BANK_ROT_Z.R;
  root.add(bankFrames.L, bankFrames.R);

  // ---------------------------------------------------------------- casting
  const casting = mesh(
    extrudeProfile(blockProfile(), LAYOUT.blockLength, 4),
    M.castAluminium,
    'CylinderBlock_Casting',
    root
  );
  casting.castShadow = true;
  casting.receiveShadow = true;

  // side bosses (oil gallery / engine mount pads cast into the crankcase)
  for (const s of [1, -1]) {
    const b = mesh(
      chamferBox(16, 34, 300, 6, 4),
      M.castAluminium,
      `Block_SideBoss_${s > 0 ? 'R' : 'L'}`,
      root,
      [s * 132, -52, -10]
    );
    b.castShadow = true;
  }

  // ------------------------------------------------- deck plates with bores
  for (const bank of ['L', 'R']) {
    // The left bank is a mirror image: its inboard edge is at -DECK_PLATE_X[1].
    const px =
      bank === 'L' ? [-DECK_PLATE_X[1], -DECK_PLATE_X[0]] : DECK_PLATE_X;
    const shape = new THREE.Shape();
    shape.moveTo(px[0], -252);
    shape.lineTo(px[1], -252);
    shape.lineTo(px[1], 252);
    shape.lineTo(px[0], 252);
    shape.closePath();
    for (const c of CYLINDERS.filter((c) => c.bank === bank)) {
      const hole = new THREE.Path();
      hole.absarc(0, c.z, LAYOUT.bore / 2, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const thickness = LAYOUT.deckHeight - DECK_PLATE_BOTTOM;
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelSize: 1.4,
      bevelThickness: 1.4,
      bevelSegments: 1,
      curveSegments: 24,
    });
    g.rotateX(-Math.PI / 2); // extrude axis becomes +Y (bore axis)
    g.translate(0, DECK_PLATE_BOTTOM - 1.4, 0);
    g.computeVertexNormals();

    // material 0 = lid faces (machined deck), 1 = walls (bore + edges)
    const plate = new THREE.Mesh(g, [M.castAluminiumBright, M.bore]);
    plate.name = `Block_DeckPlate_${bank}`;
    plate.castShadow = true;
    plate.receiveShadow = true;
    bankFrames[bank].add(plate);
  }

  // -------------------------------------------------------- freeze plugs
  const plugGeo = cached('freezeplug', () => {
    const g = new THREE.CylinderGeometry(24, 24, 12, 20);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  let plugNo = 0;
  for (const bank of ['L', 'R']) {
    const f = new THREE.Group();
    f.name = `BLOCK_DETAILS_${bank}`;
    bankFrames[bank].add(f);
    for (const z of [-170, 0, 170]) {
      mesh(plugGeo, M.brass, `FreezePlug_${++plugNo}`, f, [BANK_HALF + 2, 120, z]);
    }
    if (bank === 'L') mirrorBankX(f);
  }

  // --------------------------------------------------- main caps + bearings
  const caps = new THREE.Group();
  caps.name = 'MAIN_BEARING_CAPS';
  root.add(caps);
  const bearGeo = cached('mainbrg', () => {
    const g = new THREE.CylinderGeometry(
      LAYOUT.mainJournalR + 3,
      LAYOUT.mainJournalR + 3,
      90,
      20,
      1,
      false,
      Math.PI,
      Math.PI
    );
    g.rotateX(Math.PI / 2);
    return g;
  });
  MAIN_Z.forEach((z, i) => {
    const cap = mesh(chamferBox(146, 74, 92, 10, 4), M.castIron, `MainBearingCap_${i + 1}`, caps, [0, -74, z]);
    cap.castShadow = true;
    mesh(bearGeo, M.bearingBabbitt, `MainBearing_${i + 1}`, caps, [0, -74, z]);
    for (const s of [1, -1]) {
      const b = fastener(11, 84, 19, M.machinedSteel, `MainCapBolt_${i + 1}_${s > 0 ? 'R' : 'L'}`);
      b.position.set(s * 58, -52, z);
      b.rotation.z = Math.PI;
      caps.add(b);
    }
  });

  // ---------------------------------------------------------------- oil pan
  const pan = new THREE.Group();
  pan.name = 'OIL_PAN_ASSEMBLY';
  root.add(pan);
  mesh(chamferBox(258, 6, 512, 4, 1.5), M.gasket, 'OilPan_Gasket', pan, [0, -89, 0]);
  const sump = mesh(chamferBox(258, 126, 300, 8, 4), M.castAluminium, 'OilPan_Sump', pan, [0, -158, -128]);
  sump.castShadow = true;
  const front = mesh(chamferBox(250, 60, 276, 8, 4), M.castAluminium, 'OilPan_FrontSection', pan, [0, -125, 148]);
  front.castShadow = true;
  const slope = mesh(chamferBox(252, 16, 112, 4, 3), M.castAluminium, 'OilPan_Slope', pan, [0, -180, 18]);
  slope.rotation.x = -0.62;
  slope.castShadow = true;
  const drain = mesh(cached('drainplug', () => new THREE.CylinderGeometry(14, 14, 18, 6)), M.machinedSteel, 'OilDrainPlug', pan, [60, -214, -180]);
  drain.rotation.x = Math.PI;
  let panBolt = 0;
  for (const s of [1, -1]) {
    for (let i = 0; i < 7; i++) {
      const b = fastener(9, 30, 15, M.machinedSteel, `OilPanBolt_${++panBolt}`);
      b.position.set(s * 114, -92, -240 + i * 80);
      b.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      pan.add(b);
    }
  }

  // --------------------------------------------- rear flange (ring outline)
  const flangeShape = new THREE.Shape();
  const outer = profileScaled(1.05);
  flangeShape.moveTo(outer[0][0], outer[0][1]);
  for (let i = 1; i < outer.length; i++) flangeShape.lineTo(outer[i][0], outer[i][1]);
  flangeShape.closePath();
  const inner = profileScaled(0.62);
  const hole = new THREE.Path();
  hole.moveTo(inner[0][0], inner[0][1]);
  for (let i = 1; i < inner.length; i++) hole.lineTo(inner[i][0], inner[i][1]);
  hole.closePath();
  flangeShape.holes.push(hole);
  const flangeGeo = new THREE.ExtrudeGeometry(flangeShape, {
    depth: 16,
    bevelEnabled: true,
    bevelSize: 2,
    bevelThickness: 2,
    bevelSegments: 1,
    curveSegments: 2,
  });
  flangeGeo.translate(0, 0, LAYOUT.rearZ - 8);
  flangeGeo.computeVertexNormals();
  const flange = mesh(flangeGeo, M.castAluminium, 'BellhousingFlange', root);
  flange.castShadow = true;
  let flangeBolt = 0;
  for (const [x, y] of [
    [150, 52], [-150, 52], [150, -58], [-150, -58], [0, 140], [0, -150],
  ]) {
    const b = fastener(10, 34, 17, M.machinedSteel, `BellhousingBolt_${++flangeBolt}`);
    b.position.set(x, y, LAYOUT.rearZ - 22);
    b.rotation.x = -Math.PI / 2;
    root.add(b);
  }

  // -------------------------------------------------------- timing cover
  const cover = new THREE.Group();
  cover.name = 'TIMING_COVER';
  root.add(cover);
  const coverGeo = extrudeProfile(profileScaled(1.02), 20, 2);
  coverGeo.translate(0, 0, LAYOUT.frontZ + 12);
  mesh(coverGeo, M.castAluminium, 'TimingCover_Plate', cover).castShadow = true;
  const hump = mesh(
    chamferBox(186, 150, 20, 34, 3),
    M.castAluminium,
    'TimingCover_CamHump',
    cover,
    [0, 196, LAYOUT.frontZ + 12]
  );
  hump.castShadow = true;
  let coverBolt = 0;
  for (const [x, y] of [
    [92, 120], [128, 30], [110, -50], [60, -110], [0, -128],
    [-60, -110], [-110, -50], [-128, 30], [-92, 120], [0, 205],
  ]) {
    const b = fastener(8, 26, 13, M.machinedSteel, `TimingCoverBolt_${++coverBolt}`);
    b.position.set(x, y, LAYOUT.frontZ + 22);
    b.rotation.x = -Math.PI / 2;
    cover.add(b);
  }

  // ----------------------------------------------------------- motor mounts
  for (const s of [1, -1]) {
    const m = mesh(chamferBox(46, 96, 130, 10, 4), M.castIron, `MotorMount_${s > 0 ? 'R' : 'L'}`, root, [s * 140, -30, 78]);
    m.castShadow = true;
    for (const dz of [-40, 40]) {
      const b = fastener(12, 40, 21, M.machinedSteel, `MotorMountBolt_${s > 0 ? 'R' : 'L'}_${dz}`);
      b.position.set(s * 140, -30, 78 + dz);
      b.rotation.z = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      root.add(b);
    }
  }

  // ---- head bolts: heads are blind-drilled from the top, bolts sit just
  // outside the valve cover line so they stay readable in the assembled view
  const headBolts = new THREE.Group();
  headBolts.name = 'HEAD_BOLTS';
  root.add(headBolts);
  for (const bank of ['L', 'R']) {
    const frame = new THREE.Group();
    frame.rotation.z = BANK_ROT_Z[bank];
    headBolts.add(frame);
    [-200, -145, -90, -35, 35, 90, 145, 200].forEach((z, i) => {
      const b = fastener(12, 150, 21, M.machinedSteel, `HeadBolt_${bank}_${i + 1}`);
      b.position.set(i % 2 === 0 ? BANK_HALF - 6 : -(BANK_HALF - 6), LAYOUT.deckHeight + LAYOUT.headThickness + 8, z);
      frame.add(b);
    });
    if (bank === 'L') mirrorBankX(frame);
  }

  // --------------------------------------- valvetrain, block side: lifters
  // Lifters sit in bores at the valley wall, their feet on the cam base circle.
  const lifters = new THREE.Group();
  lifters.name = 'LIFTERS';
  root.add(lifters);
  const pushrods = new THREE.Group();
  pushrods.name = 'PUSHRODS';
  root.add(pushrods);
  const lifterGeo = cached('lifter', () => new THREE.CylinderGeometry(11, 11, LIFTER_Y[1] - LIFTER_Y[0], 16));
  const pushrodGeo = cached('pushrod', () => new THREE.CylinderGeometry(4.5, 4.5, 1, 8));
  for (const bank of ['L', 'R']) {
    const lf = new THREE.Group();
    lf.name = `LIFTERS_${bank}`;
    lf.rotation.z = BANK_ROT_Z[bank];
    lifters.add(lf);
    const pf = new THREE.Group();
    pf.name = `PUSHRODS_${bank}`;
    pf.rotation.z = BANK_ROT_Z[bank];
    pushrods.add(pf);
    for (const c of CYLINDERS.filter((c) => c.bank === bank)) {
      for (const v of [
        { zOff: -45, cupX: -70, tag: 'Intake' },
        { zOff: 45, cupX: -52, tag: 'Exhaust' },
      ]) {
        const z = c.z + v.zOff;
        mesh(lifterGeo, M.machinedSteel, `Lifter_Cyl${c.id}_${v.tag}`, lf, [
          LIFTER_X,
          (LIFTER_Y[0] + LIFTER_Y[1]) / 2,
          z,
        ]);
        const rod = mesh(pushrodGeo, M.machinedSteel, `Pushrod_Cyl${c.id}_${v.tag}`, pf);
        const a = new THREE.Vector3(LIFTER_X, LIFTER_Y[1], z);
        const b = new THREE.Vector3(v.cupX, 341, z);
        rod.scale.set(1, a.distanceTo(b), 1);
        rod.position.copy(a).lerp(b, 0.5);
        rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      }
    }
    if (bank === 'L') {
      mirrorBankX(lf);
      mirrorBankX(pf);
    }
  }

  return { root, bankFrames };
}
