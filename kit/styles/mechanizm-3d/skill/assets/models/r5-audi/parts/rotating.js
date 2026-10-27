// rotating.js - crankshaft, connecting rods, pistons, flywheel and the timing
// drive of the 2.2 T R5.
//
// The crank has five throws at 72 degrees, one rod per throw, and six main
// journals. Every position in here comes out of kinematics.js: piston pin
// distance from the slider-crank solution, the rod aimed along the line from
// the big end to the wrist pin, the crank group turned by crankRotation().
// Nothing is keyframed, so the mechanism stays consistent at every crank angle,
// including the 17.46 degree maximum rod obliquity.

import * as THREE from 'three';
import {
  arcDisc,
  chamferBox,
  taperBox,
  softCylinder,
  sleeve,
  smoothDisc,
  gearGeometry,
  beltPath,
  beltRibbon,
  cached,
  mesh,
  tubeThrough,
  fastener,
} from '../lib/geom.js';
import {
  LAYOUT,
  SPEC,
  CYLINDERS,
  crankPinPosition,
  pistonPinDistance,
  crankRotation,
  rodAngle,
} from '../lib/kinematics.js';

export const ROTATING = {
  rodBigR: 33,
  rodBigW: 42,
  rodSmallR: 15.5,
  rodSmallW: 28,
  pistonR: SPEC.bore / 2 - LAYOUT.pistonClearance,
  counterweightR: 60, // has to clear the 66 mm crankcase void
  crankSprocketTeeth: LAYOUT.crankSprocketTeeth,
  crankSprocketR: 24.5, // half of the cam sprocket pitch radius: exactly 2:1
  camSprocketR: 49,
  beltZ: LAYOUT.frontZ + 20,
  chainZ: LAYOUT.frontZ + 40,
  flywheelZ: -292,
};

function buildCrank(M) {
  const g = new THREE.Group();
  g.name = 'CRANKSHAFT';

  const shaft = mesh(softCylinder(26, LAYOUT.blockLength - 20, 30, 2), M.crankSteel, 'Crank_MainShaft', g);
  shaft.rotation.x = Math.PI / 2;
  shaft.castShadow = true;

  // six main journals
  [-220, -132, -44, 44, 132, 220].forEach((z, i) => {
    const j = mesh(softCylinder(LAYOUT.mainJournalR, 30, 34, 2), M.steel, `Crank_MainJournal_${i + 1}`, g, [0, 0, z]);
    j.rotation.x = Math.PI / 2;
  });

  // five throws, each at its own journal angle, one rod each
  const cwGeo = cached('counterweight', () => {
    const shape = new THREE.Shape();
    const r = ROTATING.counterweightR;
    const a0 = Math.PI * 0.62;
    shape.moveTo(0, 0);
    shape.absarc(0, 0, r, a0, Math.PI * 2 - a0, false);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 26, bevelEnabled: true, bevelSize: 2, bevelThickness: 2, bevelSegments: 2, curveSegments: 30 });
    geo.translate(0, 0, -13);
    geo.computeVertexNormals();
    return geo;
  });

  for (const c of CYLINDERS) {
    const a = (c.journalAngle * Math.PI) / 180;
    const pin = mesh(softCylinder(LAYOUT.rodJournalR, 48, 34, 2), M.steel, `Crank_RodJournal_Cyl${c.id}`, g, [Math.cos(a) * LAYOUT.crankRadius, Math.sin(a) * LAYOUT.crankRadius, c.z]);
    pin.rotation.x = Math.PI / 2;
    pin.castShadow = true;
    // web out to the counterweight, opposite the throw
    const web = mesh(chamferBox(44, 96, 20, 12, 4), M.crankSteel, `Crank_Web_Cyl${c.id}`, g, [Math.cos(a + Math.PI) * 26, Math.sin(a + Math.PI) * 26, c.z - 34]);
    web.rotation.z = a;
    web.castShadow = true;
    for (const dz of [-34, 34]) {
      const cw = mesh(cwGeo, M.crankSteel, `Crank_Counterweight_Cyl${c.id}_${dz < 0 ? 'A' : 'B'}`, g, [0, 0, c.z + dz]);
      cw.rotation.z = a + Math.PI - Math.PI * 0.62;
      cw.castShadow = true;
    }
    // web on the other flank as well, so the throw reads as a forging
    const web2 = mesh(chamferBox(40, 76, 18, 10, 4), M.crankSteel, `Crank_Web2_Cyl${c.id}`, g, [Math.cos(a + Math.PI) * 22, Math.sin(a + Math.PI) * 22, c.z + 34]);
    web2.rotation.z = a;
  }

  // front snout with the timing sprocket and the accessory pulley
  const snout = mesh(softCylinder(23, 96, 26, 1.5), M.crankSteel, 'Crank_Snout', g, [0, 0, LAYOUT.frontZ + 48]);
  snout.rotation.x = Math.PI / 2;
  const sprocket = mesh(gearGeometry(ROTATING.crankSprocketTeeth, 21, 7, 17), M.darkSteel, 'CrankSprocket', g, [0, 0, ROTATING.beltZ]);
  sprocket.castShadow = true;
  const damper = mesh(smoothDisc(74, 34, 48, 6), M.darkSteel, 'Crank_DamperPulley', g, [0, 0, LAYOUT.frontZ + 74]);
  damper.rotation.x = Math.PI / 2;
  damper.castShadow = true;
  for (let i = 0; i < 4; i++) {
    const b = fastener(10, 30, 17, M.darkSteel, `DamperBolt_${i + 1}`);
    b.position.set(Math.cos((i / 4) * Math.PI * 2) * 46, Math.sin((i / 4) * Math.PI * 2) * 46, LAYOUT.frontZ + 92);
    b.rotation.x = -Math.PI / 2;
    g.add(b);
  }
  mesh(chamferBox(12, 40, 12, 4, 2), M.darkSteel, 'Crank_TimingMark', g, [54, 0, LAYOUT.frontZ + 74]).rotation.x = 0;

  // rear flange for the flywheel
  const flange = mesh(softCylinder(62, 34, 2), M.crankSteel, 'Crank_RearFlange', g, [0, 0, LAYOUT.rearZ - 16]);
  flange.rotation.x = Math.PI / 2;
  flange.castShadow = true;
  return g;
}

function buildFlywheel(M, crank) {
  const g = new THREE.Group();
  g.name = 'FLYWHEEL';
  g.position.z = ROTATING.flywheelZ;
  crank.add(g);
  const disc = mesh(softCylinder(114, 30, 54, 3), M.crankSteel, 'Flywheel_Disc', g);
  disc.rotation.x = Math.PI / 2;
  disc.castShadow = true;
  const ring = mesh(gearGeometry(130, 118, 8, 26), M.darkSteel, 'Flywheel_RingGear', g);
  ring.castShadow = true;
  // clutch friction face and the dowel ring
  const face = mesh(smoothDisc(104, 6, 48, 1.5), M.ironMachined, 'Flywheel_FrictionFace', g, [0, 0, 18]);
  face.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const b = fastener(11, 28, 19, M.darkSteel, `FlywheelBolt_${i + 1}`);
    b.position.set(Math.cos(a) * 96, Math.sin(a) * 96, 14);
    b.rotation.x = Math.PI / 2;
    g.add(b);
  }
  return g;
}

function buildRodsAndPistons(M) {
  const root = new THREE.Group();
  root.name = 'PISTONS_AND_RODS';

  const pistonGeo = cached('piston', () => softCylinder(ROTATING.pistonR, LAYOUT.pistonHeight, 44, 3));
  const ringGeo = cached('pistonring', () => new THREE.CylinderGeometry(ROTATING.pistonR + 0.3, ROTATING.pistonR + 0.3, 2.4, 44));
  const dishGeo = cached('pistondish', () => {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(new THREE.Vector2((1 - t) * 34, -6 * Math.sin(t * Math.PI)));
    }
    return new THREE.LatheGeometry(pts, 34);
  });
  const pinGeo = cached('wristpin', () => {
    const g = new THREE.CylinderGeometry(LAYOUT.pinR, LAYOUT.pinR, 60, 24);
    g.rotateX(Math.PI / 2);
    return g;
  });

  const makePiston = () => {
    const p = new THREE.Group();
    p.name = 'Piston';
    // local origin at the wrist pin; the crown sits compressionHeight above it
    const ch = LAYOUT.pistonCompressionHeight;
    mesh(pistonGeo, M.piston, 'Piston_Body', p, [0, ch - LAYOUT.pistonHeight / 2, 0]).castShadow = true;
    mesh(dishGeo, M.pistonSkirt, 'Piston_CrownDish', p, [0, ch - 4, 0]);
    [ch - 9, ch - 16, ch - 23].forEach((y, i) => mesh(ringGeo, M.darkSteel, `Piston_Ring_${i + 1}`, p, [0, y, 0]));
    // skirt panels, relieved on the thrust faces
    for (const s of [1, -1]) {
      mesh(chamferBox(9, 30, 46, 3, 1.5), M.bore, `Piston_SkirtRelief_${s > 0 ? 'R' : 'L'}`, p, [s * (ROTATING.pistonR - 1.5), -12, 0]);
    }
    mesh(pinGeo, M.steel, 'Piston_WristPin', p, [0, 0, 0]);
    for (const s of [1, -1]) {
      mesh(pinClipGeo(), M.darkSteel, `Piston_PinClip_${s > 0 ? 'R' : 'L'}`, p, [0, 0, s * 29]);
    }
    return p;
  };

  function pinClipGeo() {
    return cached('pinclip', () => new THREE.TorusGeometry(LAYOUT.pinR + 1.2, 1.5, 8, 24));
  }

  const bigGeo = cached('rodbig', () => {
    const g = new THREE.CylinderGeometry(ROTATING.rodBigR, ROTATING.rodBigR, ROTATING.rodBigW, 34);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const bigShell = cached('rodshell', () => sleeve(LAYOUT.rodJournalR + 1.0, LAYOUT.rodJournalR + 3.6, ROTATING.rodBigW - 2, 30, 0.6));
  const smallGeo = cached('rodsmall', () => {
    const g = new THREE.CylinderGeometry(ROTATING.rodSmallR, ROTATING.rodSmallR, ROTATING.rodSmallW, 28);
    g.rotateX(Math.PI / 2);
    return g;
  });

  const makeRod = () => {
    const r = new THREE.Group();
    r.name = 'ConnectingRod';
    const big = mesh(bigGeo, M.rodSteel, 'Rod_BigEnd', r);
    big.castShadow = true;
    mesh(bigShell, M.bearing, 'Rod_BigEndBearing', r);
    // I-beam: a pair of flanges with a waist between them
    mesh(chamferBox(17, LAYOUT.rodLength - 32, 26, 6, 3), M.rodSteel, 'Rod_IBeamWeb', r, [0, LAYOUT.rodLength / 2, 0]).castShadow = true;
    for (const s of [1, -1]) {
      mesh(chamferBox(30, LAYOUT.rodLength - 32, 9, 5, 2.5), M.rodSteel, `Rod_IBeamFlange_${s > 0 ? 'R' : 'L'}`, r, [0, LAYOUT.rodLength / 2, s * 8.5]).castShadow = true;
    }
    mesh(smallGeo, M.rodSteel, 'Rod_SmallEnd', r, [0, LAYOUT.rodLength, 0]);
    mesh(sleeve(LAYOUT.pinR + 1.5, LAYOUT.pinR + 5, ROTATING.rodSmallW - 3, 24, 0.6), M.bearing, 'Rod_SmallEndBush', r, [0, LAYOUT.rodLength, 0]);
    // rod cap and its bolts
    const cap = mesh(arcDisc(ROTATING.rodBigR + 1, Math.PI, Math.PI * 2, ROTATING.rodBigW, 30), M.rodSteel, 'Rod_Cap', r, [0, 0, 0]);
    cap.castShadow = true;
    for (const s of [1, -1]) {
      const b = fastener(9, 46, 16, M.darkSteel, `RodBolt_${s > 0 ? 'R' : 'L'}`);
      b.position.set(s * 34, -4, 0);
      b.rotation.z = Math.PI / 2;
      r.add(b);
    }
    return r;
  };

  const pistonTemplate = makePiston();
  const rodTemplate = makeRod();
  const cylinders = [];
  for (const c of CYLINDERS) {
    const wrap = new THREE.Group();
    wrap.name = c.label;
    root.add(wrap);
    const piston = pistonTemplate.clone(true);
    piston.name = `Piston_Cyl${c.id}`;
    // the piston is rotated about the bore axis so the pin is along Z, and its
    // skirt relief panels face the thrust sides
    const rod = rodTemplate.clone(true);
    rod.name = `ConnectingRod_Cyl${c.id}`;
    wrap.add(piston, rod);
    cylinders.push({ def: c, wrap, piston, rod });
  }
  return { root, cylinders };
}

// Belt path needs the pulleys in world XY, and both the crank and the exhaust
// cam sprocket sit in the same plane, so the drive is planar and the 2:1 ratio
// is exact.
function buildTimingDrive(M, head) {
  const g = new THREE.Group();
  g.name = 'TIMING_DRIVE';
  const camY = head.cfg.camAxisY;
  const camX = head.cfg.camAxes.find((a) => a.which === 'exhaust').x;
  const belt = mesh(
    beltRibbon(
      beltPath([
        { x: 0, y: 0, r: ROTATING.crankSprocketR },
        { x: -44, y: 150, r: 30 },
        { x: camX, y: camY, r: ROTATING.camSprocketR },
      ]),
      17,
      8.5,
      ROTATING.beltZ,
      22
    ),
    M.beltRubber,
    'Timing_Belt',
    g
  );
  belt.castShadow = true;

  // tensioner and idler
  const tens = mesh(smoothDisc(30, 26, 28, 4), M.aluMachined, 'BeltTensioner_Pulley', g, [-44, 150, ROTATING.beltZ]);
  tens.rotation.x = Math.PI / 2;
  const arm = mesh(taperBox(16, 12, 70, 20, 5, 2), M.aluCast, 'BeltTensioner_Arm', g, [-70, 108, ROTATING.beltZ]);
  arm.rotation.z = -0.5;
  mesh(smoothDisc(24, 24, 22, 3), M.darkSteel, 'BeltIdler_Pulley', g, [26, 196, ROTATING.beltZ]).rotation.x = Math.PI / 2;

  // the short chain inside the belt, exhaust cam to intake cam: both sprockets
  // are the same size, so both cams turn at the same speed
  const intakeX = head.cfg.camAxes.find((a) => a.which === 'intake');
  if (head.mode === '20v' && intakeX) {
    const r = 28;
    const A = new THREE.Vector2(camX, camY);
    const B = new THREE.Vector2(intakeX.x, camY);
    const pts = chainLoop(A, B, r, 26);
    const chain = mesh(tubeThrough(pts, 4.6, 140, 10, true, 0.5), M.chainSteel, 'CamDrive_Chain', g);
    chain.castShadow = true;
    mesh(gearGeometry(30, 24, 6, 15), M.chainSteel, 'ChainGuide_Lower', g, [camX, camY - 46, ROTATING.chainZ]);
    const guide = mesh(taperBox(14, 10, 120, 16, 5, 2), M.plastic, 'ChainGuide_Shoe', g, [0, camY - 62, ROTATING.chainZ]);
    guide.rotation.z = Math.PI / 2;
    mesh(taperBox(14, 10, 110, 16, 5, 2), M.plastic, 'ChainTensioner_Shoe', g, [0, camY + 62, ROTATING.chainZ]).rotation.z = Math.PI / 2;
    const tens2 = mesh(softCylinder(18, 40, 20, 1.5), M.aluCast, 'ChainTensioner_Body', g, [0, camY + 92, ROTATING.chainZ]);
    tens2.rotation.x = Math.PI / 2;
  }

  // front belt cover plate (removable, it is what hides the belt)
  const cover = mesh(chamferBox(150, 120, 16, 20, 4), M.aluCast, 'BeltCover_Lower', g, [10, 74, ROTATING.beltZ + 22]);
  cover.castShadow = true;
  return g;
}

function chainLoop(A, B, r, segs) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const pts = [];
  const angA = Math.atan2(ny, nx);
  // straight run on the +n side
  for (let i = 0; i <= 4; i++) pts.push(new THREE.Vector3(A.x + nx * r + ux * ((i / 4) * L), A.y + ny * r + uy * ((i / 4) * L), ROTATING.chainZ));
  // around B the long way
  for (let i = 1; i <= segs; i++) {
    const a = angA - (i / segs) * Math.PI * 2;
    pts.push(new THREE.Vector3(B.x + Math.cos(a) * r, B.y + Math.sin(a) * r, ROTATING.chainZ));
  }
  // back along the -n side
  for (let i = 1; i <= 4; i++) pts.push(new THREE.Vector3(B.x - nx * r - ux * ((i / 4) * L), B.y - ny * r - uy * ((i / 4) * L), ROTATING.chainZ));
  // around A the rest of the way
  for (let i = 1; i <= segs; i++) {
    const a = angA + Math.PI - (i / segs) * Math.PI * 2;
    pts.push(new THREE.Vector3(A.x + Math.cos(a) * r, A.y + Math.sin(a) * r, ROTATING.chainZ));
  }
  return pts;
}

export function buildRotatingAssembly(M, head) {
  const root = new THREE.Group();
  root.name = 'ROTATING_ASSEMBLY';

  const crank = buildCrank(M);
  root.add(crank);
  const flywheel = buildFlywheel(M, crank);
  const { root: pistons, cylinders } = buildRodsAndPistons(M);
  root.add(pistons);
  const timing = buildTimingDrive(M, head);
  root.add(timing);

  function update(crankDeg) {
    crank.rotation.z = crankRotation(crankDeg);
    for (const cyl of cylinders) {
      const pin = crankPinPosition(cyl.def, crankDeg);
      const { s } = pistonPinDistance(cyl.def, crankDeg);
      cyl.piston.position.set(0, s, cyl.def.z);
      cyl.rod.position.set(pin.x, pin.y, cyl.def.z);
      const smallEnd = new THREE.Vector3(0, s, cyl.def.z);
      const bigEnd = new THREE.Vector3(pin.x, pin.y, cyl.def.z);
      cyl.rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), smallEnd.clone().sub(bigEnd).normalize());
    }
  }
  update(0);

  return { root, crank, flywheel, timing, cylinders, update };
}
