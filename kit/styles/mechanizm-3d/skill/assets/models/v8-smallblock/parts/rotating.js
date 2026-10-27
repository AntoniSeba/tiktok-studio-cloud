// rotating.js - crankshaft, connecting rods, pistons, camshaft and the timing
// drive. The crank/rod/piston positions come from a real slider-crank
// solution, so the assembly stays mechanically consistent at any crank angle.

import * as THREE from 'three';
import {
  arcDisc,
  chamferBox,
  cached,
  cylinder,
  mesh,
  fastener,
  gearGeometry,
  beltPath,
  beltRibbon,
  coilSpring,
} from '../lib/geom.js';
import {
  LAYOUT,
  CYLINDERS,
  MAIN_Z,
  BANK_DIR,
  BANK_ROT_Z,
  crankPinPosition,
  pistonPinDistance,
} from '../lib/layout.js';
import { CAM_FRAME, LIFTER_X } from './block.js';

const ROD_BIG_R = 33;
const ROD_SMALL_R = 20;
const WRIST_PIN_R = 12;

// --------------------------------------------------------------- crankshaft
function buildCrank(M) {
  const g = new THREE.Group();
  g.name = 'CRANKSHAFT';

  const boreZ = CYLINDERS.filter((c) => c.bank === 'R').map((c) => c.z);
  const phases = CYLINDERS.filter((c) => c.bank === 'R').map((c) => c.throwPhase);

  // main line
  const shaft = mesh(cylinder(30, 30, 530, 24), M.machinedSteel, 'CrankShaft_Main', g);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 15;
  shaft.castShadow = true;

  // main journals
  MAIN_Z.forEach((z, i) => {
    const j = mesh(cylinder(LAYOUT.mainJournalR, LAYOUT.mainJournalR, 62, 24), M.polishedSteel, `Crank_MainJournal_${i + 1}`, g);
    j.rotation.x = Math.PI / 2;
    j.position.z = z;
  });

  // rod journals + counterweights
  const cwGeo = {};
  boreZ.forEach((z, i) => {
    const phase = phases[i];
    const rad = (phase * Math.PI) / 180;
    const pin = crankPinPosition(phase, z);
    const j = mesh(cylinder(LAYOUT.rodJournalR, LAYOUT.rodJournalR, 58, 20), M.polishedSteel, `Crank_RodJournal_${i + 1}`, g);
    j.rotation.x = Math.PI / 2;
    j.position.set(pin.x, pin.y, z);

    const key = `cw${i}`;
    cwGeo[key] = arcDisc(95, rad + Math.PI / 2, rad + (3 * Math.PI) / 2, 24, 26);
    for (const dz of [-32, 32]) {
      const cw = mesh(cwGeo[key], M.machinedSteel, `Crank_Counterweight_${i + 1}${dz < 0 ? 'a' : 'b'}`, g);
      cw.position.z = z + dz;
      cw.castShadow = true;
    }
  });

  // front snout (carries the damper, sprocket and both belt pulleys)
  const snout = mesh(cylinder(22, 22, 200, 20), M.machinedSteel, 'CrankSnout', g);
  snout.rotation.x = Math.PI / 2;
  snout.position.z = 360;
  // woodruff key detail on the snout
  const key = mesh(chamferBox(6, 10, 44, 1, 1), M.machinedSteel, 'CrankSnout_Key', g, [11, 11, 340]);

  // rear flange that carries the flywheel
  const rear = mesh(cylinder(70, 70, 66, 26), M.machinedSteel, 'CrankRearFlange', g);
  rear.rotation.x = Math.PI / 2;
  rear.position.z = -277;

  return g;
}

// ----------------------------------------------------------------- flywheel
function buildFlywheel(M, crank) {
  const g = new THREE.Group();
  g.name = 'FLYWHEEL';
  g.position.z = -318;
  crank.add(g);
  const disc = mesh(cylinder(170, 170, 24, 44), M.machinedSteel, 'Flywheel_Disc', g);
  disc.rotation.x = Math.PI / 2;
  disc.castShadow = true;
  const ring = mesh(gearGeometry(112, 168, 9, 20), M.castIron, 'Flywheel_RingGear', g);
  ring.castShadow = true;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const b = fastener(12, 30, 21, M.machinedSteel, `FlywheelBolt_${i + 1}`);
    b.position.set(Math.cos(a) * 115, Math.sin(a) * 115, 14);
    b.rotation.x = Math.PI / 2;
    g.add(b);
  }
  return g;
}

// --------------------------------------------------------- rods + pistons
function buildRodsAndPistons(M) {
  const root = new THREE.Group();
  root.name = 'PISTONS_AND_RODS';

  // piston template (axis +Y, pin at the origin)
  const pistonGeo = cached('piston', () => new THREE.CylinderGeometry(50.4, 50.4, 62, 32));
  const ringGeo = cached('pistonring', () => new THREE.CylinderGeometry(50.8, 50.8, 2.6, 32));
  const makePiston = () => {
    const p = new THREE.Group();
    p.name = 'Piston';
    mesh(pistonGeo, M.machinedSteel, 'Piston_Body', p).castShadow = true;
    [22, 14.5, 7].forEach((y, i) => mesh(ringGeo, M.castIron, `Piston_Ring_${i + 1}`, p, [0, y, 0]));
    // skirt reliefs so it reads as a piston rather than a drum
    for (const s of [1, -1]) {
      mesh(chamferBox(20, 34, 4, 2, 1), M.bore, `Piston_SkirtRelief_${s > 0 ? 'R' : 'L'}`, p, [s * 46, -14, 0]);
    }
    return p;
  };

  // rod template: big end at the origin, small end at +Y = rod length
  const rodGeoBig = cached('rodbig', () => {
    const g = new THREE.CylinderGeometry(ROD_BIG_R, ROD_BIG_R, 44, 22);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const rodBearing = cached('rodbearing', () => {
    const g = new THREE.CylinderGeometry(LAYOUT.rodJournalR + 2.5, LAYOUT.rodJournalR + 2.5, 46, 20);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const rodSmall = cached('rodsmall', () => {
    const g = new THREE.CylinderGeometry(ROD_SMALL_R, ROD_SMALL_R, 30, 18);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const pinGeo = cached('wristpin', () => {
    const g = new THREE.CylinderGeometry(WRIST_PIN_R, WRIST_PIN_R, 62, 16);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const makeRod = () => {
    const r = new THREE.Group();
    r.name = 'ConnectingRod';
    mesh(rodGeoBig, M.machinedSteel, 'Rod_BigEnd', r);
    mesh(rodBearing, M.bearingBabbitt, 'Rod_BigEndBearing', r);
    mesh(chamferBox(16, LAYOUT.rodLength - 52, 26, 4, 3), M.machinedSteel, 'Rod_Beam', r, [0, LAYOUT.rodLength / 2, 0]).castShadow = true;
    mesh(rodSmall, M.machinedSteel, 'Rod_SmallEnd', r, [0, LAYOUT.rodLength, 0]);
    mesh(pinGeo, M.polishedSteel, 'Rod_WristPin', r, [0, LAYOUT.rodLength, 0]);
    for (const s of [1, -1]) {
      const b = fastener(9, 46, 16, M.machinedSteel, `RodBolt_${s > 0 ? 'R' : 'L'}`);
      b.position.set(s * 34, 0, 0);
      b.rotation.z = Math.PI / 2;
      r.add(b);
    }
    return r;
  };

  const rodTemplate = makeRod();
  const pistonTemplate = makePiston();

  const cylinders = [];
  for (const c of CYLINDERS) {
    // wrapper carries the exploded-view offset; children are animated inside it
    const wrap = new THREE.Group();
    wrap.name = c.label;
    root.add(wrap);
    const piston = pistonTemplate.clone(true);
    piston.name = `Piston_Cyl${c.id}`;
    piston.rotation.z = BANK_ROT_Z[c.bank];
    const rod = rodTemplate.clone(true);
    rod.name = `ConnectingRod_Cyl${c.id}`;
    wrap.add(piston, rod);
    cylinders.push({ def: c, wrap, piston, rod });
  }
  return { root, cylinders };
}

// ------------------------------------------------------------------- camshaft
function camLobeGeometry(nosePhase) {
  return cached(`lobe|${Math.round(nosePhase * 180 / Math.PI)}`, () => {
    const pts = [];
    const n = 72;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      // base circle 22 mm, nose +11 mm, smooth ramp like a real cam profile
      const c = Math.cos(t - nosePhase);
      const lift = c > -0.35 ? Math.pow((c + 0.35) / 1.35, 2.2) * 11 : 0;
      pts.push(new THREE.Vector2(Math.cos(t) * (22 + lift), Math.sin(t) * (22 + lift)));
    }
    const shape = new THREE.Shape();
    shape.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 20, bevelEnabled: false, curveSegments: 2 });
    g.translate(0, 0, -10);
    g.computeVertexNormals();
    return g;
  });
}

function buildCam(M) {
  const g = new THREE.Group();
  g.name = 'CAMSHAFT';
  const shaft = mesh(cylinder(22, 22, 540, 20), M.machinedSteel, 'CamShaft', g);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 5;
  shaft.castShadow = true;

  // Bearing journals
  [-200, -80, 60, 200].forEach((z, i) => {
    const j = mesh(cylinder(26, 26, 30, 20), M.polishedSteel, `Cam_Journal_${i + 1}`, g);
    j.rotation.x = Math.PI / 2;
    j.position.z = z;
  });

  // 16 lobes. Nose phase spreads the lift events and keeps every nose away
  // from its lifter so the static assembly does not self-intersect.
  let n = 0;
  for (const c of CYLINDERS) {
    for (const v of [
      { zOff: -45, tag: 'Intake', k: 0 },
      { zOff: 45, tag: 'Exhaust', k: 1 },
    ]) {
      const spread = (((c.id * 37 + v.k * 61) % 120) - 60) * (Math.PI / 180);
      const nosePhase = Math.PI + spread; // away from the lifter contact
      const lobe = mesh(camLobeGeometry(nosePhase), M.machinedSteel, `CamLobe_Cyl${c.id}_${v.tag}`, g);
      lobe.position.set(CAM_FRAME.x * Math.SQRT1_2 * 0 - 0 + 0, 0, c.z + v.zOff);
      lobe.position.set(0, 0, c.z + v.zOff);
      lobe.castShadow = true;
      n++;
    }
  }

  // distributor / oil pump drive gear at the front
  const dg = mesh(gearGeometry(13, 26, 6, 22), M.machinedSteel, 'Cam_DistributorGear', g);
  dg.position.z = 250;
  return g;
}

// -------------------------------------------------------------- timing drive
function buildTimingDrive(M) {
  const g = new THREE.Group();
  g.name = 'TIMING_DRIVE';
  const z = LAYOUT.chainZ - 6;

  const crankSprocket = mesh(gearGeometry(21, 34, 6, 20), M.machinedSteel, 'Timing_CrankSprocket', g);
  crankSprocket.position.set(0, 0, z);
  const camSprocket = mesh(gearGeometry(38, 62, 6, 20), M.machinedSteel, 'Timing_CamSprocket', g);
  camSprocket.position.set(0, LAYOUT.camY, z);

  const chain = beltRibbon(
    beltPath([
      { x: 0, y: 0, r: 38 },
      { x: 0, y: LAYOUT.camY, r: 66 },
    ]),
    20,
    9,
    z
  );
  const chainMesh = mesh(chain, M.beltRubber, 'Timing_Chain', g);
  chainMesh.castShadow = true;

  // chain damper on the slack side
  const damper = mesh(chamferBox(16, 120, 18, 8, 3), M.plasticBlack, 'Timing_ChainDamper', g, [-58, 70, z]);
  damper.rotation.z = 0.12;
  return g;
}

// ---------------------------------------------------------------- assembly
export function buildRotatingAssembly(M) {
  const root = new THREE.Group();
  root.name = 'ROTATING_ASSEMBLY';

  const crank = buildCrank(M);
  root.add(crank);
  buildFlywheel(M, crank);

  const { root: pistons, cylinders } = buildRodsAndPistons(M);
  root.add(pistons);

  const cam = buildCam(M);
  root.add(cam);

  const timing = buildTimingDrive(M);
  root.add(timing);

  // Slider-crank solution: pin position along the bore axis and the crank pin
  // position for a given crank angle. +angle = clockwise seen from the front.
  function update(crankAngleDeg) {
    const a = -crankAngleDeg;
    crank.rotation.z = -crankAngleDeg * (Math.PI / 180);
    for (const cyl of cylinders) {
      const { bank, z, throwPhase } = cyl.def;
      const pin = crankPinPosition(throwPhase, z, a);
      const s = pistonPinDistance(throwPhase, bank, a);
      const dir = BANK_DIR[bank];
      const pinHead = new THREE.Vector3(dir.x * s, dir.y * s, z);
      cyl.piston.position.copy(pinHead);
      cyl.rod.position.set(pin.x, pin.y, z);
      cyl.rod.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        pinHead.clone().sub(new THREE.Vector3(pin.x, pin.y, z)).normalize()
      );
    }
  }
  update(0);

  return { root, crank, cam, timing, flywheel: crank.getObjectByName('FLYWHEEL'), cylinders, update };
}
