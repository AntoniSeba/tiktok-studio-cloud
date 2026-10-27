// head.js - cylinder head of the 2.2 T R5 in both factory forms.
//
//   mode '20v'  20 valves, two overhead cams, as in 3B / ABY / AAN / ADU.
//               Two 30 mm intake and two 27 mm exhaust valves per cylinder, the
//               pair straddling the bore centre at z = +/-16, buckets directly
//               under the lobes. The belt turns the exhaust cam and a short
//               chain carries the intake cam.
//   mode '10v'  10 valves, one overhead cam, as in the earlier 2.2 turbo
//               (MC / 1B and friends). One big intake and one exhaust valve per
//               cylinder. With a single cam the two valves have to sit in line
//               along the cam axis, at z = -/+20, each under its own lobe, with
//               buckets directly under the cam.
//
// The head casting carries five round valve wells, so with the cams and the
// covers off you look straight down at springs, buckets, stems and valve heads.
// Lift, cam phase and bucket height all come from kinematics.js, so the valves
// are where the crank angle says they are, not in a keyframed pose.

import * as THREE from 'three';
import {
  chamferBox,
  taperBox,
  camLobeGeometry,
  gearGeometry,
  sleeve,
  softCylinder,
  annulus,
  tubeThrough,
  cached,
  mesh,
  fastener,
} from '../lib/geom.js';
import { LAYOUT, CYLINDERS, SPEC, cycleAngle, lift, camRotation, lobePhase, valveCount } from '../lib/kinematics.js';

export const HEAD = {
  thickness: 105,
  camCarrierTop: 336,
  wellR: 37,
  bucketH: 26,
  stemR: 4,
  stemTop: 292,
  springSeatY: 250,
  springFree: 60,
  coverY0: 336,
  coverY1: 392,
};

export function headConfig(mode) {
  const is20 = mode === '20v';
  return {
    is20,
    halfWidth: is20 ? 64 : 70,
    camBaseR: is20 ? LAYOUT.camBaseR20v : LAYOUT.camBaseR10v,
    camAxisY: LAYOUT.deckHeight + (is20 ? LAYOUT.camAboveDeck : LAYOUT.camAboveDeck10v),
    camAxes: is20 ? [{ which: 'intake', x: LAYOUT.valveAxisX.intake }, { which: 'exhaust', x: LAYOUT.valveAxisX.exhaust }] : [{ which: 'exhaust', x: 0 }],
    lobeLift: LAYOUT.valveLift,
  };
}

// every valve in the head, in one table both the meshes and update() read
export function valveSlots(mode) {
  const out = [];
  for (const c of CYLINDERS) {
    if (mode === '20v') {
      out.push({ cylId: c.id, z: c.z, which: 'intake', x: LAYOUT.valveAxisX.intake, dz: -LAYOUT.valvePairZ, headR: LAYOUT.valveHeadR.intake });
      out.push({ cylId: c.id, z: c.z, which: 'intake', x: LAYOUT.valveAxisX.intake, dz: LAYOUT.valvePairZ, headR: LAYOUT.valveHeadR.intake });
      out.push({ cylId: c.id, z: c.z, which: 'exhaust', x: LAYOUT.valveAxisX.exhaust, dz: -LAYOUT.valvePairZ, headR: LAYOUT.valveHeadR.exhaust });
      out.push({ cylId: c.id, z: c.z, which: 'exhaust', x: LAYOUT.valveAxisX.exhaust, dz: LAYOUT.valvePairZ, headR: LAYOUT.valveHeadR.exhaust });
    } else {
      out.push({ cylId: c.id, z: c.z, which: 'intake', x: 0, dz: -LAYOUT.valveSpacingZ10v, headR: LAYOUT.valveHeadR10v.intake });
      out.push({ cylId: c.id, z: c.z, which: 'exhaust', x: 0, dz: LAYOUT.valveSpacingZ10v, headR: LAYOUT.valveHeadR10v.exhaust });
    }
  }
  return out;
}

function headCasting(M, mode, cfg) {
  const g = new THREE.Group();
  g.name = 'HEAD_CASTING_' + mode.toUpperCase();
  const halfZ = LAYOUT.blockLength / 2;
  const height = HEAD.thickness;
  const shape = new THREE.Shape();
  const r = 14;
  const hw = cfg.halfWidth;
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
    hole.absarc(0, c.z, HEAD.wellR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelSize: 2.5, bevelThickness: 2.5, bevelSegments: 2, curveSegments: 34 });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, LAYOUT.deckHeight + height, 0);
  geo.computeVertexNormals();
  const cast = new THREE.Mesh(geo, [M.aluMachined, M.aluCast]);
  cast.name = 'Head_CastingBody';
  cast.castShadow = true;
  cast.receiveShadow = true;
  g.add(cast);

  const chamber = sleeve(HEAD.wellR - 1.6, HEAD.wellR - 0.2, 16, 40, 0.6);
  const wellWall = sleeve(HEAD.wellR - 1.6, HEAD.wellR - 0.2, height - 20, 40, 0.6);
  for (const c of CYLINDERS) {
    mesh(chamber.clone(), M.bore, `Head_Chamber_Cyl${c.id}`, g, [0, LAYOUT.deckHeight + 8, c.z]);
    mesh(wellWall.clone(), M.aluCast, `Head_WellWall_Cyl${c.id}`, g, [0, LAYOUT.deckHeight + 20 + (height - 20) / 2, c.z]);
  }
  // valve seats pressed into the chamber roof
  for (const s of valveSlots(mode)) {
    const x = mode === '20v' ? s.x : (s.which === 'intake' ? -LAYOUT.valveAxisX.intake : LAYOUT.valveAxisX.exhaust) * 0.0;
    const ring = mesh(annulus(s.headR - 4, s.headR + 3, 3, 30, 0.5), M.bearing, `ValveSeat_Cyl${s.cylId}_${s.which}_${s.dz}`, g, [s.x, LAYOUT.deckHeight + 2.4, s.z + s.dz]);
    ring.rotation.x = Math.PI / 2;
  }
  return g;
}

function camCarrier(M, mode, cfg) {
  const g = new THREE.Group();
  g.name = 'CAM_CARRIER_' + mode.toUpperCase();
  const halfZ = LAYOUT.blockLength / 2;
  const hw = cfg.halfWidth;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -halfZ);
  shape.lineTo(hw, -halfZ);
  shape.lineTo(hw, halfZ);
  shape.lineTo(-hw, halfZ);
  for (const c of CYLINDERS) {
    const hole = new THREE.Path();
    hole.absarc(0, c.z, HEAD.wellR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const y0 = LAYOUT.deckHeight + HEAD.thickness;
  const height = HEAD.camCarrierTop - y0;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelSize: 2, bevelThickness: 2, bevelSegments: 2, curveSegments: 30 });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, y0 + height, 0);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, [M.aluMachined, M.aluCast]);
  m.name = 'Head_CamCarrier';
  m.castShadow = true;
  g.add(m);

  const shellR = cfg.camBaseR + 4.5;
  const saddle = cached(`camsaddle|${shellR}`, () => {
    const hg = new THREE.CylinderGeometry(shellR, shellR, 30, 26, 1, false, Math.PI, Math.PI);
    hg.rotateX(Math.PI / 2);
    return hg;
  });
  for (const ax of cfg.camAxes) {
    for (const z of [-220, -132, -44, 44, 132, 220]) {
      mesh(saddle, M.bearing, `CamBearing_${ax.which}_${z}`, g, [ax.x, HEAD.camCarrierTop + 2, z]);
      const cap = mesh(chamferBox(30, 34, 30, 8, 3), M.aluCast, `CamBearingCap_${ax.which}_${z}`, g, [ax.x, HEAD.camCarrierTop + 30, z]);
      cap.castShadow = true;
    }
  }
  return g;
}

function buildCams(M, mode, cfg) {
  const root = new THREE.Group();
  root.name = 'CAMSHAFTS_' + mode.toUpperCase();
  const cams = {};
  for (const ax of cfg.camAxes) {
    const cam = new THREE.Group();
    cam.name = `Camshaft_${ax.which}`;
    cam.position.set(ax.x, cfg.camAxisY, 0);
    const len = LAYOUT.blockLength + 44;
    const shaft = mesh(softCylinder(cfg.camBaseR - 8, len, 28, 1.5), M.darkSteel, `Cam_${ax.which}_Shaft`, cam);
    shaft.rotation.x = Math.PI / 2;
    for (const z of [-220, -132, -44, 44, 132, 220]) {
      const j = mesh(softCylinder(cfg.camBaseR - 2, 26, 28, 1.5), M.camLobe, `Cam_${ax.which}_Journal_${z}`, cam, [0, 0, z]);
      j.rotation.x = Math.PI / 2;
    }
    // one lobe per valve of this cam
    for (const s of valveSlots(mode)) {
      if (s.which !== ax.which) continue;
      const cyl = CYLINDERS.find((c) => c.id === s.cylId);
      const nose = lobePhase(cyl, s.which);
      const lobe = mesh(camLobeGeometry(nose, cfg.camBaseR, cfg.lobeLift, 22), M.camLobe, `CamLobe_Cyl${s.cylId}_${s.which}_${s.dz}`, cam, [0, 0, s.z + s.dz]);
      lobe.castShadow = true;
    }
    // the timing belt sprocket on the exhaust cam, the chain sprocket inside it
    const sprocket = mesh(gearGeometry(LAYOUT.camSprocketTeeth, 41, 8, 17), M.darkSteel, `CamSprocket_${ax.which}`, cam, [0, 0, LAYOUT.frontZ + 20]);
    sprocket.castShadow = true;
    mesh(gearGeometry(30, 28, 6, 14), M.chainSteel, `CamChainSprocket_${ax.which}`, cam, [0, 0, LAYOUT.frontZ + 40]).castShadow = true;
    mesh(smoothDisc22(M), M.darkSteel, `CamEndPlug_${ax.which}`, cam, [0, 0, -(LAYOUT.blockLength / 2 + 22)]).rotation.x = Math.PI / 2;
    root.add(cam);
    cams[ax.which] = cam;
  }
  return { root, cams };
}

function smoothDisc22() {
  return cached('camendplug', () => {
    const pts = [
      new THREE.Vector2(0, -5),
      new THREE.Vector2(15, -5),
      new THREE.Vector2(19, -1),
      new THREE.Vector2(19, 1),
      new THREE.Vector2(15, 5),
      new THREE.Vector2(0, 5),
    ];
    return new THREE.LatheGeometry(pts, 24);
  });
}

function buildValvetrain(M, mode, cfg) {
  const root = new THREE.Group();
  root.name = 'VALVETRAIN_' + mode.toUpperCase();
  const items = [];

  const bucketGeo = cached('bucket', () => {
    const pts = [
      new THREE.Vector2(0, -HEAD.bucketH / 2),
      new THREE.Vector2(LAYOUT.bucketR - 3, -HEAD.bucketH / 2),
      new THREE.Vector2(LAYOUT.bucketR, -HEAD.bucketH / 2 + 3),
      new THREE.Vector2(LAYOUT.bucketR, HEAD.bucketH / 2 - 3),
      new THREE.Vector2(LAYOUT.bucketR - 3, HEAD.bucketH / 2),
      new THREE.Vector2(0, HEAD.bucketH / 2),
    ];
    return new THREE.LatheGeometry(pts, 32);
  });
  const springGeo = cached('vspring', () => {
    // a real wound spring would be far too many triangles across 20 valves, so
    // this is a ribbed tube: it reads correctly at every distance used here
    const pts = [];
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const k = 1 + 0.16 * Math.sin(t * Math.PI * 2 * 7);
      pts.push(new THREE.Vector2(LAYOUT.bucketR * 0.52 * k, HEAD.springFree * (t - 0.5)));
    }
    return new THREE.LatheGeometry(pts, 26);
  });
  const vhead = cached('vheadany', () => {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(1, 0),
      new THREE.Vector2(1, -8),
      new THREE.Vector2(0, -10),
    ];
    return new THREE.LatheGeometry(pts, 20);
  });

  for (const s of valveSlots(mode)) {
    const g = new THREE.Group();
    g.name = `Valve_Cyl${s.cylId}_${s.which}_${s.dz}`;
    g.position.set(s.x, 0, s.z + s.dz);
    // the valve head: a disc of the right diameter with a small margin cone
    const disc = cached(`vhdisc|${s.headR}`, () => {
      const pts = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(s.headR - 1.5, 0),
        new THREE.Vector2(s.headR, -1.4),
        new THREE.Vector2(s.headR - 3, -5.5),
        new THREE.Vector2(HEAD.stemR + 0.5, -8),
        new THREE.Vector2(0, -9),
      ];
      return new THREE.LatheGeometry(pts, 34);
    });
    const head = mesh(disc, M.valveHead, 'Valve_Head', g, [0, LAYOUT.deckHeight + 1.2, 0]);
    const stem = mesh(softCylinder(HEAD.stemR, HEAD.stemTop - LAYOUT.deckHeight + 4, 16, 0.6), M.valveSteel, 'Valve_Stem', g, [0, (HEAD.stemTop + LAYOUT.deckHeight) / 2 + 1, 0]);
    const guide = mesh(sleeve(HEAD.stemR + 0.4, HEAD.stemR + 5.5, 26, 18, 0.8), M.brass, 'Valve_Guide', g, [0, LAYOUT.deckHeight + 40, 0]);
    const spring = mesh(springGeo, M.spring, 'Valve_Spring', g, [0, HEAD.springSeatY + HEAD.springFree / 2, 0]);
    const retainer = mesh(annulus(HEAD.stemR + 1, HEAD.stemR + 12, 6, 22, 1), M.darkSteel, 'Valve_Retainer', g, [0, HEAD.stemTop - 3, 0]);
    const seat = mesh(annulus(HEAD.stemR + 5, HEAD.stemR + 11, 4, 24, 1), M.darkSteel, 'Valve_SpringSeat', g, [0, HEAD.springSeatY, 0]);
    const bucket = mesh(bucketGeo, M.steel, 'Valve_Bucket', g, [0, HEAD.camCarrierTop - 16, 0]);
    root.add(g);
    items.push({ slot: s, group: g, head, stem, guide, spring, retainer, seat, bucket });
  }
  return { root, items };
}

function buildPorts(M, mode, cfg) {
  const intake = new THREE.Group();
  intake.name = 'INTAKE_PORTS_' + mode.toUpperCase();
  const exhaust = new THREE.Group();
  exhaust.name = 'EXHAUST_PORTS_' + mode.toUpperCase();
  const y = LAYOUT.deckHeight + 60;
  for (const s of valveSlots(mode)) {
    const rIn = mode === '20v' ? 21 : 28;
    const rEx = mode === '20v' ? 19 : 25;
    const isIn = s.which === 'intake';
    const xOut = (cfg.halfWidth + 40) * (isIn ? -1 : 1);
    const pts = [
      new THREE.Vector3(s.x, LAYOUT.deckHeight + 16, s.z + s.dz),
      new THREE.Vector3(s.x * 1.6, y - 6, s.z + s.dz),
      new THREE.Vector3((cfg.halfWidth - 10) * (isIn ? -1 : 1), y, s.z + s.dz),
      new THREE.Vector3(xOut, y, s.z + s.dz),
    ];
    const tube = mesh(tubeThrough(pts, isIn ? rIn * 0.55 : rEx * 0.55, 22, 10, false, 0.4), isIn ? M.aluManifold : M.ironDark, `${isIn ? 'Intake' : 'Exhaust'}Port_Cyl${s.cylId}_${s.dz}`, isIn ? intake : exhaust);
    tube.castShadow = true;
    const flange = mesh(softCylinder(isIn ? rIn : rEx, 16, 20, 1.5), isIn ? M.aluManifold : M.ironDark, `${isIn ? 'Intake' : 'Exhaust'}Flange_Cyl${s.cylId}_${s.dz}`, isIn ? intake : exhaust, [xOut, y, s.z + s.dz]);
    flange.rotation.z = Math.PI / 2;
    flange.castShadow = true;
  }
  return { intake, exhaust };
}

function buildHeadCovers(M, mode, cfg) {
  const g = new THREE.Group();
  g.name = 'CAM_COVERS_' + mode.toUpperCase();
  const h = HEAD.coverY1 - HEAD.coverY0;
  cfg.camAxes.forEach((ax, i) => {
    const width = mode === '20v' ? 76 : 118;
    const cover = mesh(taperBox(width + 8, width - 8, h, LAYOUT.blockLength - 22, 13, 5), M.camCover, `CamCover_${ax.which}`, g, [ax.x, HEAD.coverY0 + h / 2, 0]);
    cover.castShadow = true;
    let n = 0;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const b = fastener(7, 20, 12, M.darkSteel, `CamCoverBolt_${ax.which}_${++n}`);
        b.position.set(ax.x + s * (width / 2 - 1), HEAD.coverY0 + 9, -190 + k * 76);
        b.rotation.z = s > 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(b);
      }
    }
  });
  const badge = mesh(chamferBox(70, 6, 28, 6, 2), M.aluMachined, `CamCover_Badge_${mode}`, g, [cfg.camAxes[0].x, HEAD.coverY1 + 2, 54]);
  badge.castShadow = true;
  return g;
}

export function buildHead(M, { mode = '20v' } = {}) {
  const root = new THREE.Group();
  root.name = 'HEAD_ASSEMBLY_' + mode.toUpperCase();
  const cfg = headConfig(mode);

  const casting = headCasting(M, mode, cfg);
  const carrier = camCarrier(M, mode, cfg);
  const { root: cams, cams: camMap } = buildCams(M, mode, cfg);
  const { root: valvetrain, items } = buildValvetrain(M, mode, cfg);
  const covers = buildHeadCovers(M, mode, cfg);
  const { intake, exhaust } = buildPorts(M, mode, cfg);

  const gasket = mesh(chamferBox(cfg.halfWidth * 2 + 10, 4, LAYOUT.blockLength + 2, 4, 1.5), M.headGasket, 'Head_Gasket', root, [0, LAYOUT.deckHeight + 2, 0]);

  const bolts = new THREE.Group();
  bolts.name = 'HEAD_BOLTS';
  let n = 0;
  for (const c of CYLINDERS) {
    for (const s of [1, -1]) {
      const b = fastener(12, 150, 21, M.darkSteel, `HeadBolt_${++n}`);
      b.position.set(s * (SPEC.bore / 2 + 13), LAYOUT.deckHeight + HEAD.thickness + 34, c.z);
      bolts.add(b);
    }
  }

  root.add(casting, carrier, cams, valvetrain, covers, intake, exhaust, gasket, bolts);

  function update(crankDeg) {
    const camAngle = camRotation(crankDeg) * (Math.PI / 180);
    for (const which of Object.keys(camMap)) camMap[which].rotation.z = camAngle;
    for (const it of items) {
      const cyl = CYLINDERS.find((c) => c.id === it.slot.cylId);
      const l = lift(it.slot.which, cycleAngle(cyl, crankDeg));
      it.bucket.position.y = HEAD.camCarrierTop - 16 - l;
      it.retainer.position.y = HEAD.stemTop - 3 - l;
      it.stem.position.y = (HEAD.stemTop + LAYOUT.deckHeight) / 2 + 1 - l;
      it.guide.position.y = LAYOUT.deckHeight + 40 - l * 0.3;
      it.head.position.y = LAYOUT.deckHeight + 1.2 - l;
      it.spring.scale.y = Math.max(0.4, (HEAD.springFree - l) / HEAD.springFree);
      it.spring.position.y = HEAD.springSeatY + (HEAD.springFree - l) / 2;
    }
  }
  update(0);

  return {
    root,
    mode,
    cfg,
    update,
    groups: { casting, carrier, cams, valvetrain, covers, intake, exhaust, gasket, bolts },
    constants: { HEAD, camAxisY: cfg.camAxisY, lobeLift: cfg.lobeLift, items, camMap },
  };
}
