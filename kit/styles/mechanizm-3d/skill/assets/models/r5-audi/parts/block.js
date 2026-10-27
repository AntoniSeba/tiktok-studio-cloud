// block.js - cylinder block of the 2.2 T R5, cast iron.
//
// The block is built the way the casting actually is, not as one box:
//   * crankcase side walls, extruded along the crank axis, open at the bottom
//   * an end bulkhead at each end of the crankcase
//   * six main bearing bulkheads, plates perpendicular to the crank, each with
//     an open keyhole so the crank can drop in, plus the caps that close them
//   * a cylinder section: a footprint in the XZ plane with five real 81 mm
//     bores extruded vertically from the crankcase ceiling to the deck face
//   * sump, front timing cover, mounts, filter
//
// The counterweight swing circle is 60 mm, which is why the crankcase void is
// 66 mm half width. The deck face sits at 220 mm above the crank axis, and that
// 220 comes straight out of r + L + compression height in the kinematic model.

import * as THREE from 'three';
import {
  chamferBox,
  taperBox,
  extrudeProfile,
  sleeve,
  smoothDisc,
  softCylinder,
  cached,
  mesh,
  fastener,
} from '../lib/geom.js';
import { LAYOUT, CYLINDERS, SPEC } from '../lib/kinematics.js';

export const BLOCK = {
  halfWidth: 80, // crankcase outer wall
  cylHalfWidth: 66, // cylinder section outer wall
  cavityHalf: 66, // crankcase void
  wallThickness: 14,
  panRailY: -105,
  crankcaseTopY: 46, // where the side walls stop and the cylinder section starts
  bulkheadZ: [-220, -132, -44, 44, 132, 220],
  bulkheadT: 22,
  counterweightSwing: 60,
};

function buildCrankcase(M) {
  const g = new THREE.Group();
  g.name = 'BLOCK_CRANKCASE';
  const { cavityHalf: c, halfWidth: w, panRailY: y0, crankcaseTopY: y1 } = BLOCK;

  // one wall at a time, as a plain rectangle in XY extruded along the crank
  const wallProfile = [
    [c, y0],
    [w, y0],
    [w, y1],
    [c, y1],
  ];
  for (const s of [1, -1]) {
    const pts = wallProfile.map(([x, y]) => [s * x, y]);
    if (s < 0) pts.reverse();
    const wall = mesh(extrudeProfile(pts, LAYOUT.blockLength, 4), M.ironCast, `Block_SideWall_${s > 0 ? 'R' : 'L'}`, g);
    wall.castShadow = true;
    wall.receiveShadow = true;

    // pan rail: a wider flange at the bottom of each wall
    const rail = mesh(chamferBox(26, 13, LAYOUT.blockLength, 4, 2), M.ironCast, `Block_PanRail_${s > 0 ? 'R' : 'L'}`, g, [s * (w - 8), y0 + 2, 0]);
    rail.castShadow = true;

    // ribs down the flanks
    for (const z of [-186, -62, 62, 186]) {
      const rib = mesh(taperBox(24, 14, 60, 14, 5, 2), M.ironCast, `Block_Rib_${s > 0 ? 'R' : 'L'}_${z}`, g, [s * (w + 3), y0 + 56, z]);
      rib.castShadow = true;
    }
    // water jacket core plugs
    for (const z of [-176, -88, 0, 88, 176]) {
      const p = mesh(smoothDisc(18, 9, 20, 2.5), M.brass, `Block_CorePlug_${s > 0 ? 'R' : 'L'}_${z}`, g, [s * (w + 2), -6, z]);
      p.rotation.z = Math.PI / 2;
    }
  }

  // closed end bulkhead at each end of the crankcase
  const endShape = [
    [-w, y0],
    [w, y0],
    [w, y1],
    [-w, y1],
  ];
  for (const [z, tag] of [[LAYOUT.frontZ - 7, 'Front'], [LAYOUT.rearZ + 7, 'Rear']]) {
    const geo = extrudeProfile(endShape, 14, 3);
    geo.translate(0, 0, z);
    const plate = mesh(geo, M.ironCast, `Block_${tag}EndBulkhead`, g);
    plate.castShadow = true;
  }

  return g;
}

// Six bulkheads. Each carries the main bearing saddle, so the crank has
// something to sit in once the caps are off. The outline is a plate with an
// open keyhole: rectangular slot up from the pan rail into a circular saddle.
function buildBulkheads(M) {
  const g = new THREE.Group();
  g.name = 'BLOCK_BULKHEADS';
  const R = LAYOUT.mainJournalR + 3;
  const w = BLOCK.halfWidth;
  const shape = new THREE.Shape();
  shape.moveTo(-w, BLOCK.panRailY);
  shape.lineTo(-R, BLOCK.panRailY);
  shape.lineTo(-R, 0);
  shape.absarc(0, 0, R, Math.PI, 0, true); // up over the journal saddle
  shape.lineTo(R, BLOCK.panRailY);
  shape.lineTo(w, BLOCK.panRailY);
  shape.lineTo(w, BLOCK.crankcaseTopY);
  shape.lineTo(-w, BLOCK.crankcaseTopY);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: BLOCK.bulkheadT, bevelEnabled: true, bevelSize: 2, bevelThickness: 2, bevelSegments: 2, curveSegments: 26 });
  geo.translate(0, 0, -BLOCK.bulkheadT / 2);
  geo.computeVertexNormals();

  const saddle = cached('mainsaddle', () => {
    const hg = new THREE.CylinderGeometry(LAYOUT.mainJournalR + 1.7, LAYOUT.mainJournalR + 1.7, 26, 28, 1, false, Math.PI, Math.PI);
    hg.rotateX(Math.PI / 2);
    return hg;
  });

  BLOCK.bulkheadZ.forEach((z, i) => {
    const b = mesh(geo, M.ironCast, `MainBulkhead_${i + 1}`, g, [0, 0, z]);
    b.castShadow = true;
    mesh(saddle, M.bearing, `MainBearingShell_${i + 1}`, g, [0, 0, z]);
    for (const s of [1, -1]) {
      const bolt = fastener(11, 74, 19, M.darkSteel, `MainCapBolt_${i + 1}_${s > 0 ? 'R' : 'L'}`);
      bolt.position.set(s * 54, -22, z);
      bolt.rotation.z = Math.PI;
      g.add(bolt);
    }
  });
  return g;
}

function buildMainCaps(M) {
  const g = new THREE.Group();
  g.name = 'MAIN_CAPS';
  const R = LAYOUT.mainJournalR + 3;
  const shape = new THREE.Shape();
  shape.moveTo(52, -46);
  shape.lineTo(52, -12);
  shape.lineTo(R + 1.6, 0);
  shape.absarc(0, 0, R + 1.6, 0, Math.PI, true);
  shape.lineTo(-52, -12);
  shape.lineTo(-52, -46);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 30, bevelEnabled: true, bevelSize: 2, bevelThickness: 2, bevelSegments: 2, curveSegments: 26 });
  geo.translate(0, 0, -15);
  geo.computeVertexNormals();
  const shell = cached('maincapbrg', () => {
    const hg = new THREE.CylinderGeometry(LAYOUT.mainJournalR + 1.7, LAYOUT.mainJournalR + 1.7, 28, 28, 1, false, 0, Math.PI);
    hg.rotateX(Math.PI / 2);
    return hg;
  });
  BLOCK.bulkheadZ.forEach((z, i) => {
    const c = mesh(geo, M.ironDark, `MainCap_${i + 1}`, g, [0, 0, z]);
    c.castShadow = true;
    mesh(shell, M.bearing, `MainCapBearingShell_${i + 1}`, g, [0, 0, z]);
  });
  return g;
}

// The cylinder section: a footprint in XZ with five 81 mm bores, extruded
// vertically. This is the piece that makes this a five cylinder block rather
// than a brick, and the bores are real holes, so the pistons run inside them.
function buildCylinderSection(M) {
  const g = new THREE.Group();
  g.name = 'BLOCK_CYLINDER_SECTION';
  const height = LAYOUT.deckHeight - BLOCK.crankcaseTopY;
  const halfZ = LAYOUT.blockLength / 2;
  const hw = BLOCK.cylHalfWidth;

  const shape = new THREE.Shape();
  const r = 14;
  shape.moveTo(-hw + r, -halfZ);
  shape.lineTo(hw - r, -halfZ);
  shape.quadraticCurveTo(hw, -halfZ, hw, -halfZ + r);
  shape.lineTo(hw, halfZ - r);
  shape.quadraticCurveTo(hw, halfZ, hw - r, halfZ);
  shape.lineTo(-hw + r, halfZ);
  shape.quadraticCurveTo(-hw, halfZ, -hw, halfZ - r);
  shape.lineTo(-hw, -halfZ + r);
  shape.quadraticCurveTo(-hw, -halfZ, -hw + r, -halfZ);

  for (const c of CYLINDERS) {
    const hole = new THREE.Path();
    hole.absarc(0, c.z, SPEC.bore / 2, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSize: 2,
    bevelThickness: 2,
    bevelSegments: 2,
    curveSegments: 34,
  });
  // the shape lies in XY; rotate so the extrusion runs up +Y with the holes
  // landing exactly on the cylinder positions
  geo.rotateX(Math.PI / 2);
  geo.translate(0, BLOCK.crankcaseTopY + height, 0);
  geo.computeVertexNormals();
  const section = new THREE.Mesh(geo, [M.ironMachined, M.ironCast]);
  section.name = 'Block_CylinderSection';
  section.castShadow = true;
  section.receiveShadow = true;
  g.add(section);

  // honed liner inside every bore: this is what the pistons slide in
  const liner = sleeve(SPEC.bore / 2 - 0.2, SPEC.bore / 2 + 2.6, height - 6, 44, 1.2);
  for (const c of CYLINDERS) {
    mesh(liner.clone(), M.bore, `BoreLiner_Cyl${c.id}`, g, [0, BLOCK.crankcaseTopY + 3 + (height - 6) / 2, c.z]);
    // machined counterbore ring around each bore on the deck face
    mesh(sleeve(SPEC.bore / 2 - 0.3, SPEC.bore / 2 + 7, 5, 44, 0.6).clone(), M.ironMachined, `DeckCounterbore_Cyl${c.id}`, g, [0, LAYOUT.deckHeight + 1.5, c.z]);
  }

  // deck ribs over the webs between the bores
  for (let i = 0; i < 4; i++) {
    const z = 176 - i * 88 - 44;
    const rib = mesh(chamferBox(hw * 2 - 8, 6, 30, 5, 2), M.ironCast, `Block_DeckRib_${i + 1}`, g, [0, LAYOUT.deckHeight + 2, z]);
    rib.castShadow = true;
  }

  // head bolt bosses, two per cylinder
  let hb = 0;
  for (const c of CYLINDERS) {
    for (const s of [1, -1]) {
      mesh(softCylinder(15, 22, 24, 2), M.ironCast, `HeadBoltBoss_${++hb}`, g, [s * (SPEC.bore / 2 + 13), LAYOUT.deckHeight - 1, c.z]);
    }
  }
  return g;
}

function buildSump(M) {
  const g = new THREE.Group();
  g.name = 'SUMP_ASSEMBLY';
  const y0 = BLOCK.panRailY;
  mesh(chamferBox(BLOCK.halfWidth * 2 + 6, 5, LAYOUT.blockLength + 4, 4, 1.5), M.gasket, 'Sump_Gasket', g, [0, y0 - 3, 0]);

  const sump = mesh(taperBox(BLOCK.halfWidth * 2 + 10, 116, 82, LAYOUT.blockLength - 52, 16, 5), M.aluCast, 'Sump_Body', g, [0, y0 - 47, -6]);
  sump.castShadow = true;
  const deep = mesh(chamferBox(132, 58, 152, 14, 5), M.aluCast, 'Sump_DeepSection', g, [0, y0 - 94, -100]);
  deep.castShadow = true;
  const front = mesh(chamferBox(122, 44, 118, 14, 5), M.aluCast, 'Sump_FrontSection', g, [0, y0 - 74, 126]);
  front.castShadow = true;
  const wing = mesh(chamferBox(60, 54, 130, 12, 4), M.aluCast, 'Sump_OilReturnWing', g, [BLOCK.halfWidth + 20, y0 - 60, 40]);
  wing.castShadow = true;

  const drain = mesh(cached('drainplug22', () => new THREE.CylinderGeometry(13, 13, 15, 6)), M.darkSteel, 'Sump_DrainPlug', g, [40, y0 - 128, -120]);
  drain.rotation.x = Math.PI;

  let n = 0;
  for (const s of [1, -1]) {
    for (let i = 0; i < 7; i++) {
      const b = fastener(8, 26, 14, M.darkSteel, `SumpBolt_${++n}`);
      b.position.set(s * (BLOCK.halfWidth - 6), y0 - 8, -196 + i * 64);
      b.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(b);
    }
  }
  return g;
}

function buildFrontCover(M) {
  const g = new THREE.Group();
  g.name = 'TIMING_COVER';
  const z0 = LAYOUT.frontZ + 26;
  const sh = new THREE.Shape();
  sh.moveTo(-BLOCK.halfWidth - 6, BLOCK.panRailY - 4);
  sh.lineTo(BLOCK.halfWidth + 6, BLOCK.panRailY - 4);
  sh.lineTo(BLOCK.halfWidth + 6, BLOCK.crankcaseTopY + 30);
  sh.lineTo(BLOCK.cylHalfWidth, BLOCK.crankcaseTopY + 30);
  sh.lineTo(BLOCK.cylHalfWidth, LAYOUT.deckHeight + 10);
  sh.lineTo(-BLOCK.cylHalfWidth, LAYOUT.deckHeight + 10);
  sh.lineTo(-BLOCK.cylHalfWidth, BLOCK.crankcaseTopY + 30);
  sh.lineTo(-BLOCK.halfWidth - 6, BLOCK.crankcaseTopY + 30);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 20, bevelEnabled: true, bevelSize: 3, bevelThickness: 3, bevelSegments: 2, curveSegments: 6 });
  geo.translate(0, 0, z0);
  geo.computeVertexNormals();
  const plate = mesh(geo, M.aluCast, 'TimingCover_Plate', g);
  plate.castShadow = true;

  const hump = mesh(chamferBox(170, 126, 28, 42, 5), M.aluCast, 'TimingCover_CamHump', g, [6, LAYOUT.deckHeight + 92, z0 + 9]);
  hump.castShadow = true;

  let n = 0;
  for (const [x, y] of [[68, 148], [74, 40], [66, -40], [46, -98], [0, -116], [-46, -98], [-66, -40], [-74, 40], [-68, 148], [0, 198], [-32, 244], [32, 244]]) {
    const b = fastener(8, 24, 13, M.darkSteel, `TimingCoverBolt_${++n}`);
    b.position.set(x, y, z0 + 22);
    b.rotation.x = -Math.PI / 2;
    g.add(b);
  }
  return g;
}

export function buildBlockAssembly(M) {
  const root = new THREE.Group();
  root.name = 'BLOCK_ASSEMBLY';

  const crankcase = buildCrankcase(M);
  const cylinderSection = buildCylinderSection(M);
  const bulkheads = buildBulkheads(M);
  const mainCaps = buildMainCaps(M);
  const sump = buildSump(M);
  const timingCover = buildFrontCover(M);

  const filter = new THREE.Group();
  filter.name = 'OIL_FILTER';
  const fb = mesh(smoothDisc(37, 102, 30, 6), M.darkSteel, 'OilFilter_Body', filter, [-(BLOCK.halfWidth + 56), -4, 92]);
  fb.rotation.z = Math.PI / 2;
  fb.castShadow = true;
  const stem = mesh(smoothDisc(26, 34, 22, 4), M.aluCast, 'OilFilter_Stem', filter, [-(BLOCK.halfWidth + 12), -4, 92]);
  stem.rotation.z = Math.PI / 2;
  root.add(filter);

  const cooler = mesh(chamferBox(118, 32, 38, 8, 3), M.aluCast, 'OilCooler_Body', root, [-(BLOCK.halfWidth + 42), -72, 166]);
  cooler.castShadow = true;

  for (const s of [1, -1]) {
    const mount = mesh(taperBox(52, 38, 78, 104, 9, 4), M.ironDark, `MotorMount_${s > 0 ? 'R' : 'L'}`, root, [s * (BLOCK.halfWidth + 18), -40, 130]);
    mount.castShadow = true;
    for (const dz of [-30, 30]) {
      const b = fastener(11, 34, 19, M.darkSteel, `MotorMountBolt_${s > 0 ? 'R' : 'L'}_${dz}`);
      b.position.set(s * (BLOCK.halfWidth + 18), -40, 130 + dz);
      b.rotation.z = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      root.add(b);
    }
  }

  mesh(smoothDisc(14, 22, 18, 3), M.plastic, 'KnockSensor_1', root, [BLOCK.halfWidth + 8, -30, 44]).rotation.z = Math.PI / 2;
  mesh(smoothDisc(14, 22, 18, 3), M.plastic, 'KnockSensor_2', root, [BLOCK.halfWidth + 8, -30, -132]).rotation.z = Math.PI / 2;

  root.add(crankcase, cylinderSection, bulkheads, mainCaps, sump, timingCover);

  return {
    root,
    groups: { crankcase, cylinderSection, bulkheads, mainCaps, sump, timingCover, filter },
  };
}
