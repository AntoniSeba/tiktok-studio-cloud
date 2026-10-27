// block.js - the 2JZ-GTE cylinder block: a closed deck casting with six 86 mm
// bores, seven main bearing bulkheads with their caps, front and rear walls and
// the oil pan. The two side skins (outer walls plus one half of every cylinder
// barrel) are separate groups so the cutaway view can slide them outwards and
// look straight into the bores - the interior is revealed by moving shells, not
// by a cutting plane.
//
// Units: mm. X along the crank (+X = rear), Y up, Z across (+Z = intake side).

import * as THREE from 'three';
import { chamferBox, softCylinder, cylinder, extrudeShape, extrudeVertical, extrudeAlongX, arcShell, roundedRectShape, circlePath, tubeBetween, mesh, fastener, cached, extrudeProfile } from '../lib/geom.js';
import * as E from '../lib/engine.js';

const L = E.L;
const MAIN_X = [-330, -220, -110, 0, 110, 220, 330];
const WALL_T = L.blockWallZ - L.blockHalfZ; // 23 mm outer wall
const DECK_BOTTOM = 150;

// a semicircular profile, either through the top (+r) or the bottom (-r)
function halfCirclePts(r, seg = 24, down = false) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const a = (down ? 0 : Math.PI) - (Math.PI * i) / seg;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts; // (r,0) .. (0,+-r) .. (-r,0)
}

function shapeFrom(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

export function buildBlock(M) {
  const root = new THREE.Group();
  root.name = 'BLOCK';

  // =============================================================== block core
  const core = new THREE.Group();
  core.name = 'BLOCK_CORE';
  root.add(core);

  const spanX = L.blockXRear - L.blockXFront; // 670

  // --- closed deck plate, six bores, top face machined
  const deckShape = roundedRectShape(spanX, L.blockWallZ * 2, 14);
  for (const x of E.CYL_X) deckShape.holes.push(circlePath(x, 0, L.boreR, 48));
  const deckGeo = cached('deck', () => extrudeVertical(deckShape, L.deckY - DECK_BOTTOM, 3));
  mesh(deckGeo, M.aluCast, 'Deck_Plate', core, [0, (L.deckY + DECK_BOTTOM) / 2, 0]);

  // machined top face: the surface the gasket and the head sit on
  const faceShape = roundedRectShape(spanX, L.blockWallZ * 2 - 4, 12);
  for (const x of E.CYL_X) faceShape.holes.push(circlePath(x, 0, L.boreR, 56));
  const faceGeo = cached('deckFace', () => extrudeVertical(faceShape, 1.6, 0));
  mesh(faceGeo, M.aluMachined, 'Deck_FaceMachined', core, [0, L.deckY + 0.8, 0]);

  // --- seven bulkheads, their caps and the bearing shells
  const bulkShape = shapeFrom([
    [-L.blockHalfZ, 0],
    ...halfCirclePts(34, 22, false),
    [L.blockHalfZ, 0],
    [L.blockHalfZ, DECK_BOTTOM + 1],
    [-L.blockHalfZ, DECK_BOTTOM + 1],
  ]);
  const bulkGeo = cached('bulkhead', () => extrudeAlongX(bulkShape, 26, 2));
  const capShape = shapeFrom([
    [34, 0],
    ...halfCirclePts(34, 22, true),
    [-70, 0],
    [-70, L.capBottomY],
    [70, L.capBottomY],
    [70, 0],
  ]);
  const capGeo = cached('mainCap', () => extrudeAlongX(capShape, 26, 2));
  const shellUp = cached('shellUp', () => extrudeAlongX(shapeFrom([[-34, 0], ...halfCirclePts(34, 20, false), [34, -7], [-34, -7]]), 24, 0.4));
  const shellDown = cached('shellDown', () => extrudeAlongX(shapeFrom([[34, 0], ...halfCirclePts(34, 20, true), [-34, 7], [34, 7]]), 24, 0.4));
  MAIN_X.forEach((x, i) => {
    mesh(bulkGeo, M.aluCast, `Bulkhead_${i + 1}`, core, [x, 0, 0]);
    mesh(capGeo, M.darkSteel, `MainCap_${i + 1}`, core, [x, 0, 0]);
    mesh(shellUp, M.bearing, `MainShell_Upper_${i + 1}`, core, [x, 0, 0]);
    mesh(shellDown, M.bearing, `MainShell_Lower_${i + 1}`, core, [x, 0, 0]);
    for (const side of [-1, 1]) {
      const bolt = fastener(14, 76, 21, M.darkSteel, `MainBolt_${i + 1}_${side > 0 ? 'A' : 'B'}`);
      bolt.position.set(x, 40, side * 56);
      bolt.rotation.x = Math.PI / 2;
      core.add(bolt);
    }
  });

  // --- piston cooling jets: one per cylinder on the exhaust side, bolted to
  // the block just below the bore and outside the crank's sweep (78 mm), aimed
  // up past the skirt at the underside of the crown
  const oilJets = new THREE.Group();
  oilJets.name = 'OIL_JETS';
  core.add(oilJets);
  const jets = [];
  E.CYL_X.forEach((x, i) => {
    const base = new THREE.Vector3(x - 34, 62, -74);
    const tip = new THREE.Vector3(x - 20, 72, -50);
    const aim = new THREE.Vector3(x, 150, -4);
    mesh(cached('jetBody', () => chamferBox(20, 16, 24, 3, 1)), M.aluMachined, `OilJet_Body_${i + 1}`, oilJets, [base.x, base.y, base.z]);
    const bolt = fastener(6, 22, 10, M.darkSteel, `OilJet_Bolt_${i + 1}`);
    bolt.position.set(base.x, base.y + 4, base.z - 12);
    bolt.rotation.x = -Math.PI / 2;
    oilJets.add(bolt);
    mesh(tubeBetween(base, tip, 3.4, 10), M.brass, `OilJet_Tube_${i + 1}`, oilJets);
    const dir = aim.clone().sub(tip).normalize();
    mesh(tubeBetween(tip, tip.clone().addScaledVector(dir, 9), 2.4, 10), M.journal, `OilJet_Nozzle_${i + 1}`, oilJets);
    jets.push({ cyl: i + 1, tip: tip.clone().addScaledVector(dir, 9), aim });
  });

  // --- front and rear walls of the crankcase
  const frontShape = shapeFrom([
    [-L.blockWallZ, L.crankcaseBottomY],
    [L.blockWallZ, L.crankcaseBottomY],
    [L.blockWallZ, L.deckY],
    [-L.blockWallZ, L.deckY],
  ]);
  frontShape.holes.push(circlePath(0, 0, 46, 40));
  const frontGeo = cached('frontWall', () => extrudeAlongX(frontShape, 26, 2));
  mesh(frontGeo, M.aluCast, 'Crankcase_FrontWall', core, [L.blockXFront + 13, 0, 0]);

  const rearShape = shapeFrom([
    [-L.blockWallZ, L.crankcaseBottomY - 26],
    [L.blockWallZ, L.crankcaseBottomY - 26],
    [L.blockWallZ, L.deckY],
    [-L.blockWallZ, L.deckY],
  ]);
  rearShape.holes.push(circlePath(0, 0, 64, 40));
  const rearGeo = cached('rearWall', () => extrudeAlongX(rearShape, 26, 2));
  mesh(rearGeo, M.aluCast, 'Crankcase_RearWall', core, [L.blockXRear - 13, 0, 0]);

  // rear main seal housing and the bellhousing flange
  mesh(cached('rearSeal', () => cylinder(62, 62, 22, 48)), M.rubber, 'Rear_Main_Seal', core, [L.blockXRear - 26, 0, 0]);
  mesh(cached('bell', () => cylinder(120, 120, 14, 52)), M.aluCast, 'Bellhousing_Flange', core, [L.blockXRear + 7, 0, 0]);

  // --- head bolt bosses / studs around every bore
  for (let i = 0; i < 6; i++) {
    const x = E.CYL_X[i];
    for (const [dx, dz] of [[-38, 96], [38, 96], [-38, -96], [38, -96]]) {
      const boss = mesh(cached(`hboss`, () => softCylinder(13, 14, 20, 1.5)), M.aluCast, `HeadBoss_${i + 1}_${dx}${dz}`, core, [x + dx, L.deckY + 2, dz]);
      void boss;
      const stud = mesh(cached('hstud', () => softCylinder(7.5, 30, 18, 0.6)), M.darkSteel, `HeadStud_${i + 1}_${dx}_${dz}`, core, [x + dx, L.deckY + 20, dz]);
      void stud;
    }
  }

  // ========================================================= intake side skin
  const skinIn = new THREE.Group();
  skinIn.name = 'BLOCK_SKIN_INTAKE';
  root.add(skinIn);
  {
    const w = chamferBox(spanX, L.deckY - L.crankcaseBottomY + 4, WALL_T, 12, 2.5);
    mesh(w, M.aluCast, 'Block_Wall_Intake', skinIn, [0, (L.deckY + L.crankcaseBottomY) / 2, L.blockWallZ - WALL_T / 2]);
    // ribbed casting look
    for (let i = 0; i < 7; i++) {
      const x = -300 + i * 100;
      mesh(cached('wrib', () => chamferBox(10, 240, 6, 3, 0.8)), M.aluCast, `Block_WallRib_Intake_${i + 1}`, skinIn, [x, 60, L.blockWallZ + 2.4]);
    }
    // engine mount bracket on the intake side
    const mount = new THREE.Group();
    mount.name = 'EngineMount_Intake';
    mount.position.set(-150, -60, L.blockWallZ + 10);
    skinIn.add(mount);
    mesh(chamferBox(120, 90, 26, 10, 2), M.aluCast, 'EngineMount_Bracket', mount, [0, 0, 0]);
    mesh(cached('mountpad', () => softCylinder(26, 30, 24, 2)), M.aluCast, 'EngineMount_Pad', mount, [0, 10, 24]);
    for (const dx of [-40, 40]) {
      const b = fastener(12, 44, 18, M.darkSteel, `EngineMount_Bolt_${dx}`);
      b.position.set(dx, 0, -16);
      b.rotation.x = -Math.PI / 2;
      mount.add(b);
    }
  }
  // one half of every cylinder barrel rides with the intake skin
  for (const x of E.CYL_X) {
    mesh(cached('linerIn', () => arcShell(L.boreR, L.linerR, L.deckY - L.linerBottomY, Math.PI / 2, Math.PI * 1.5, 64, 0.6)), M.bore, `Liner_Intake_${x}`, skinIn, [x, (L.deckY + L.linerBottomY) / 2, 0]);
  }

  // ======================================================== exhaust side skin
  const skinEx = new THREE.Group();
  skinEx.name = 'BLOCK_SKIN_EXHAUST';
  root.add(skinEx);
  {
    const w = chamferBox(spanX, L.deckY - L.crankcaseBottomY + 4, WALL_T, 12, 2.5);
    mesh(w, M.aluCast, 'Block_Wall_Exhaust', skinEx, [0, (L.deckY + L.crankcaseBottomY) / 2, -(L.blockWallZ - WALL_T / 2)]);
    for (let i = 0; i < 4; i++) {
      const x = -230 + i * 130;
      mesh(cached('wribE', () => chamferBox(10, 200, 6, 3, 0.8)), M.aluCast, `Block_WallRib_Exhaust_${i + 1}`, skinEx, [x, 40, -(L.blockWallZ + 2.4)]);
    }
    // oil filter housing and cooler take-off on the exhaust side
    const filt = new THREE.Group();
    filt.name = 'OilFilter_Housing';
    filt.position.set(-250, -40, -(L.blockWallZ + 4));
    skinEx.add(filt);
    mesh(chamferBox(90, 80, 30, 12, 2), M.aluCast, 'OilFilter_Boss', filt, [0, 0, 0]);
    const f = mesh(cached('oilfilter', () => softCylinder(38, 76, 32, 2)), M.oil, 'Oil_Filter', filt, [0, -6, -46]);
    f.rotation.x = Math.PI / 2;
    void f;
  }
  // and the other half of every barrel
  for (const x of E.CYL_X) {
    mesh(cached('linerEx', () => arcShell(L.boreR, L.linerR, L.deckY - L.linerBottomY, -Math.PI / 2, Math.PI / 2, 64, 0.6)), M.bore, `Liner_Exhaust_${x}`, skinEx, [x, (L.deckY + L.linerBottomY) / 2, 0]);
  }

  // ================================================================= oil pan
  const pan = new THREE.Group();
  pan.name = 'OIL_PAN';
  root.add(pan);
  {
    // profile is (z, y): the pan is as wide as the block, 620 mm long in X
    const prof = shapeFrom([
      [-112, L.crankcaseBottomY],
      [112, L.crankcaseBottomY],
      [112, -152],
      [104, -160],
      [-104, -160],
      [-112, -152],
    ]);
    mesh(cached('pan', () => extrudeAlongX(prof, 616, 3)), M.oil, 'OilPan_Body', pan, [6, 0, 0]);
    // deep sump at the front, where the 2JZ pickup and drain plug sit
    const sump = shapeFrom([
      [-104, -158],
      [104, -158],
      [104, -206],
      [-104, -216],
    ]);
    mesh(cached('sump', () => extrudeAlongX(sump, 180, 3)), M.oil, 'OilPan_Sump', pan, [-205, 0, 0]);
    const plug = mesh(cached('drain', () => softCylinder(10, 14, 14, 1)), M.brass, 'OilPan_DrainPlug', pan, [-205, -214, 30]);
    plug.rotation.x = Math.PI;
    const dip = mesh(cached('dip', () => softCylinder(7, 190, 14, 0.8)), M.steel, 'Oil_DipstickTube', pan, [-90, -20, 108]);
    dip.rotation.z = 0.06;
    mesh(cached('dipTop', () => softCylinder(9, 26, 14, 1)), M.plastic, 'Oil_Dipstick_Handle', pan, [-96, 78, 108]);
  }

  // crankcase breather and the block drain
  mesh(cached('breather', () => softCylinder(14, 40, 18, 1.2)), M.aluMachined, 'Block_Breather', core, [240, L.deckY - 26, L.blockWallZ - 26]);

  return { root, groups: { core, skinIn, skinEx, pan, oilJets }, jets };
}
