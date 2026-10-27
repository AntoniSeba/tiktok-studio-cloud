// block.js - V6 cylinder block assembly: casting with an open crankcase,
// deck plates with three real bores per bank, bottom end, oil pan, filter,
// covers, mounts and the block side hardware.

import * as THREE from 'three';
import { chamferBox, taperBox, extrudeProfile, smoothDisc, cached, mesh, fastener, mirrorBankX } from '../lib/geom.js';
import { LAYOUT, CYLINDERS, MAIN_Z, BANK_ROT_Z } from '../lib/layout.js';

export const BANK_HALF = 70;
export const DECK_PLATE_X = LAYOUT.casting.deckPlate.x; // [-68, 72]

function blockProfile() {
  const c = LAYOUT.casting;
  return [
    [c.railX, c.railY],
    [c.wallX, c.wallY],
    [c.deckOuter[0], c.deckOuter[1]],
    [c.deckInner[0], c.deckInner[1]],
    [c.valleyApex[0], c.valleyApex[1]],
    [-c.deckInner[0], c.deckInner[1]],
    [-c.deckOuter[0], c.deckOuter[1]],
    [-c.wallX, c.wallY],
    [-c.railX, c.railY],
    // crankcase, open at the bottom
    [-c.cavityX, c.railY],
    [-c.cavityX, c.cavityTop],
    [c.cavityX, c.cavityTop],
    [c.cavityX, c.railY],
  ];
}

const scaleProfile = (s) => blockProfile().map(([x, y]) => [x * s, y * s]);

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
  const casting = mesh(extrudeProfile(blockProfile(), LAYOUT.blockLength, 6), M.aluCast, 'CylinderBlock_Casting', root);
  casting.castShadow = true;
  casting.receiveShadow = true;

  // cast ribs along the crankcase flanks (soft, tapered)
  for (const s of [1, -1]) {
    for (const z of [-120, -40, 40, 120]) {
      const rib = mesh(taperBox(30, 18, 96, 16, 6, 2), M.aluCast, `Block_Rib_${s > 0 ? 'R' : 'L'}_${z}`, root, [s * 92, -34, z]);
      rib.castShadow = true;
    }
  }

  // deck plates with real bores: lid faces = machined deck, walls = bore
  for (const bank of ['L', 'R']) {
    const px = bank === 'L' ? [-DECK_PLATE_X[1], -DECK_PLATE_X[0]] : DECK_PLATE_X;
    const y = LAYOUT.casting.deckPlate.y;
    const shape = new THREE.Shape();
    shape.moveTo(px[0], -165);
    shape.lineTo(px[1], -165);
    shape.lineTo(px[1], 165);
    shape.lineTo(px[0], 165);
    shape.closePath();
    for (const c of CYLINDERS.filter((c) => c.bank === bank)) {
      const hole = new THREE.Path();
      hole.absarc(0, c.z, LAYOUT.bore / 2, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const thickness = y[1] - y[0];
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelSize: 2,
      bevelThickness: 2,
      bevelSegments: 2,
      curveSegments: 30,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y[0] - 2, 0);
    g.computeVertexNormals();
    const plate = new THREE.Mesh(g, [M.aluMachined, M.bore]);
    plate.name = `Block_DeckPlate_${bank}`;
    plate.castShadow = true;
    plate.receiveShadow = true;
    bankFrames[bank].add(plate);
  }

  // ------------------------------------------------------- bank hardware
  let plugNo = 0;
  for (const bank of ['L', 'R']) {
    const f = new THREE.Group();
    f.name = `BLOCK_DETAILS_${bank}`;
    bankFrames[bank].add(f);
    for (const z of [-120, 0, 120]) {
      const p = mesh(smoothDisc(22, 10, 24, 3), M.brass, `FreezePlug_${++plugNo}`, f, [BANK_HALF + 4, 120, z]);
      p.rotation.z = Math.PI / 2;
    }
    if (bank === 'L') mirrorBankX(f);
  }

  // ---------------------------------------------------- main caps + bearings
  const caps = new THREE.Group();
  caps.name = 'MAIN_BEARING_CAPS';
  root.add(caps);
  const bearGeo = cached('mainbrg', () => {
    const g = new THREE.CylinderGeometry(LAYOUT.mainJournalR + 2.5, LAYOUT.mainJournalR + 2.5, 88, 24, 1, false, Math.PI, Math.PI);
    g.rotateX(Math.PI / 2);
    return g;
  });
  MAIN_Z.forEach((z, i) => {
    const cap = mesh(chamferBox(140, 66, 86, 12, 5), M.aluDark, `MainBearingCap_${i + 1}`, caps, [0, -66, z]);
    cap.castShadow = true;
    mesh(bearGeo, M.bearing, `MainBearing_${i + 1}`, caps, [0, -66, z]);
    for (const s of [1, -1]) {
      const b = fastener(10, 76, 18, M.darkSteel, `MainCapBolt_${i + 1}_${s > 0 ? 'R' : 'L'}`);
      b.position.set(s * 56, -44, z);
      b.rotation.z = Math.PI;
      caps.add(b);
    }
  });

  // ---------------------------------------------------------------- oil pan
  const pan = new THREE.Group();
  pan.name = 'OIL_PAN_ASSEMBLY';
  root.add(pan);
  mesh(chamferBox(242, 6, 356, 4, 1.5), M.gasket, 'OilPan_Gasket', pan, [0, -80, 0]);
  const sump = mesh(taperBox(244, 220, 96, 240, 10, 4), M.aluCast, 'OilPan_Sump', pan, [0, -128, -72]);
  sump.castShadow = true;
  const front = mesh(taperBox(232, 210, 62, 130, 10, 4), M.aluCast, 'OilPan_FrontSection', pan, [0, -111, 106]);
  front.castShadow = true;
  const slope = mesh(chamferBox(224, 10, 86, 4, 3), M.aluCast, 'OilPan_Slope', pan, [0, -142, 36]);
  slope.rotation.x = -0.5;
  slope.castShadow = true;
  const drain = mesh(cached('drainplug', () => new THREE.CylinderGeometry(13, 13, 16, 6)), M.darkSteel, 'OilDrainPlug', pan, [52, -172, -120]);
  drain.rotation.x = Math.PI;
  let panBolt = 0;
  for (const s of [1, -1]) {
    for (let i = 0; i < 6; i++) {
      const b = fastener(8, 28, 14, M.darkSteel, `OilPanBolt_${++panBolt}`);
      b.position.set(s * 106, -84, -150 + i * 60);
      b.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      pan.add(b);
    }
  }

  // ------------------------------------------------------------ oil filter
  const filter = new THREE.Group();
  filter.name = 'OIL_FILTER';
  root.add(filter);
  const filterBody = mesh(smoothDisc(38, 108, 32, 6), M.darkSteel, 'OilFilter_Body', filter, [126, -30, 40]);
  filterBody.rotation.z = Math.PI / 2;
  filterBody.castShadow = true;
  filter.position.set(0, 0, 0);

  // ------------------------------------------- rear flange (bellhousing ring)
  const flangeShape = new THREE.Shape();
  const outer = scaleProfile(1.05);
  flangeShape.moveTo(outer[0][0], outer[0][1]);
  for (let i = 1; i < outer.length; i++) flangeShape.lineTo(outer[i][0], outer[i][1]);
  flangeShape.closePath();
  const inner = scaleProfile(0.5);
  const hole = new THREE.Path();
  hole.moveTo(inner[0][0], inner[0][1]);
  for (let i = 1; i < inner.length; i++) hole.lineTo(inner[i][0], inner[i][1]);
  hole.closePath();
  flangeShape.holes.push(hole);
  const flangeGeo = new THREE.ExtrudeGeometry(flangeShape, {
    depth: 18,
    bevelEnabled: true,
    bevelSize: 3,
    bevelThickness: 3,
    bevelSegments: 2,
    curveSegments: 2,
  });
  flangeGeo.translate(0, 0, LAYOUT.rearZ - 9);
  flangeGeo.computeVertexNormals();
  mesh(flangeGeo, M.aluCast, 'BellhousingFlange', root).castShadow = true;
  let flangeBolt = 0;
  for (const [x, y] of [[118, 40], [-118, 40], [118, -50], [-118, -50], [0, 118], [0, -130]]) {
    const b = fastener(10, 32, 17, M.darkSteel, `BellhousingBolt_${++flangeBolt}`);
    b.position.set(x, y, LAYOUT.rearZ - 22);
    b.rotation.x = -Math.PI / 2;
    root.add(b);
  }

  // --------------------------------------------------------- timing cover
  const cover = new THREE.Group();
  cover.name = 'TIMING_COVER';
  root.add(cover);
  const coverGeo = extrudeProfile(scaleProfile(1.015), 18, 4);
  coverGeo.translate(0, 0, LAYOUT.frontZ + 30);
  const coverMesh = mesh(coverGeo, M.aluCast, 'TimingCover_Plate', cover);
  coverMesh.castShadow = true;
  const hump = mesh(chamferBox(206, 150, 18, 46, 4), M.aluCast, 'TimingCover_CamHump', cover, [0, 232, LAYOUT.frontZ + 30]);
  hump.castShadow = true;
  let coverBolt = 0;
  for (const [x, y] of [[92, 110], [118, 30], [100, -50], [50, -104], [0, -118], [-50, -104], [-100, -50], [-118, 30], [-92, 110], [0, 186]]) {
    const b = fastener(8, 24, 13, M.darkSteel, `TimingCoverBolt_${++coverBolt}`);
    b.position.set(x, y, LAYOUT.frontZ + 40);
    b.rotation.x = -Math.PI / 2;
    cover.add(b);
  }

  // ---------------------------------------------------------- motor mounts
  for (const s of [1, -1]) {
    const m = mesh(taperBox(56, 40, 84, 110, 10, 4), M.aluDark, `MotorMount_${s > 0 ? 'R' : 'L'}`, root, [s * 132, -20, 60]);
    m.castShadow = true;
    for (const dz of [-32, 32]) {
      const b = fastener(11, 36, 19, M.darkSteel, `MotorMountBolt_${s > 0 ? 'R' : 'L'}_${dz}`);
      b.position.set(s * 132, -20, 60 + dz);
      b.rotation.z = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      root.add(b);
    }
  }

  // ------------------------------------------------------------ head bolts
  // 8 per head, sitting in shallow bosses just outside the cam cover line
  const headBolts = new THREE.Group();
  headBolts.name = 'HEAD_BOLTS';
  root.add(headBolts);
  for (const bank of ['L', 'R']) {
    const frame = new THREE.Group();
    frame.rotation.z = BANK_ROT_Z[bank];
    headBolts.add(frame);
    const spots = [
      [BANK_HALF - 5, -148], [-(BANK_HALF - 5), -120], [BANK_HALF - 5, -60], [-(BANK_HALF - 5), -32],
      [BANK_HALF - 5, 32], [-(BANK_HALF - 5), 60], [BANK_HALF - 5, 120], [-(BANK_HALF - 5), 148],
    ];
    spots.forEach(([x, z], i) => {
      const b = fastener(11, 130, 19, M.darkSteel, `HeadBolt_${bank}_${i + 1}`);
      b.position.set(x, LAYOUT.deckHeight + LAYOUT.headThickness + 6, z);
      frame.add(b);
    });
    if (bank === 'L') mirrorBankX(frame);
  }

  return { root, bankFrames };
}
