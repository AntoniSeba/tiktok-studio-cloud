// rotating.js - crankshaft with three split crankpins, six pistons and rods,
// the flywheel, the crank sprocket and the timing chain. Piston and rod
// positions come from a real slider-crank solution, so the mechanism stays
// consistent at every crank angle.

import * as THREE from 'three';
import {
  arcDisc,
  chamferBox,
  cylinder,
  softCylinder,
  beltPath,
  beltRibbon,
  gearGeometry,
  cached,
  mesh,
  fastener,
} from '../lib/geom.js';
import {
  LAYOUT,
  CYLINDERS,
  MAIN_Z,
  BANK_DIR,
  BANK_ROT_Z,
  crankPinPosition,
  pistonPinDistance,
  crankRotation,
} from '../lib/layout.js';

const ROD_BIG_R = 30;
const ROD_SMALL_R = 17;
const PIN_R = 12;

function buildCrank(M) {
  const g = new THREE.Group();
  g.name = 'CRANKSHAFT';

  const shaft = mesh(cylinder(28, 28, 350, 32), M.crankSteel, 'CrankShaft_Main', g);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 15;
  shaft.castShadow = true;

  MAIN_Z.forEach((z, i) => {
    const j = mesh(softCylinder(LAYOUT.mainJournalR, 52, 32, 2), M.steel, `Crank_MainJournal_${i + 1}`, g, [0, 0, z]);
    j.rotation.x = Math.PI / 2;
  });

  // three crankpins, each carrying two rods offset by 60 deg (split pin)
  const pins = [108, 0, -108];
  pins.forEach((z, i) => {
    const pair = CYLINDERS.filter((c) => c.z === z);
    const angles = pair.map((c) => (c.journalAngle * Math.PI) / 180);
    pair.forEach((c, k) => {
      const a = (c.journalAngle * Math.PI) / 180;
      const jz = z + (k === 0 ? 17 : -17);
      const j = mesh(softCylinder(LAYOUT.rodJournalR, 46, 32, 2), M.steel, `Crank_RodJournal_Cyl${c.id}`, g, [Math.cos(a) * LAYOUT.crankRadius, Math.sin(a) * LAYOUT.crankRadius, jz]);
      j.rotation.x = Math.PI / 2;
    });
    const mid = (angles[0] + angles[1]) / 2;
    for (const dz of [-34, 34]) {
      const cw = mesh(arcDisc(76, mid + Math.PI * 0.42, mid + Math.PI * 1.58, 24, 34), M.crankSteel, `Crank_Counterweight_${i + 1}${dz < 0 ? 'a' : 'b'}`, g, [0, 0, z + dz]);
      cw.castShadow = true;
    }
  });

  // crank sprocket for the timing chain
  const sprocket = mesh(gearGeometry(24, 34, 6, 16), M.darkSteel, 'CrankSprocket', g, [0, 0, LAYOUT.chainZ]);
  sprocket.castShadow = true;
  const spBolt = fastener(12, 40, 20, M.darkSteel, 'CrankSprocketBolt');
  spBolt.position.set(0, 0, LAYOUT.chainZ + 16);
  spBolt.rotation.x = Math.PI / 2;
  g.add(spBolt);

  // front snout (damper + belt pulleys) and rear flange (flywheel)
  const snout = mesh(cylinder(22, 22, 150, 26), M.crankSteel, 'CrankSnout', g);
  snout.rotation.x = Math.PI / 2;
  snout.position.z = 255;
  const rear = mesh(softCylinder(60, 60, 30, 2), M.crankSteel, 'CrankRearFlange', g, [0, 0, -205]);
  rear.rotation.x = Math.PI / 2;

  return g;
}

function buildFlywheel(M, crank) {
  const g = new THREE.Group();
  g.name = 'FLYWHEEL';
  g.position.z = -240;
  crank.add(g);
  const disc = mesh(softCylinder(149, 26, 56, 3), M.crankSteel, 'Flywheel_Disc', g);
  disc.rotation.x = Math.PI / 2;
  disc.castShadow = true;
  const ring = mesh(gearGeometry(104, 152, 8, 26), M.darkSteel, 'Flywheel_RingGear', g);
  ring.castShadow = true;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const b = fastener(11, 28, 19, M.darkSteel, `FlywheelBolt_${i + 1}`);
    b.position.set(Math.cos(a) * 100, Math.sin(a) * 100, 13);
    b.rotation.x = Math.PI / 2;
    g.add(b);
  }
  return g;
}

function buildRodsAndPistons(M) {
  const root = new THREE.Group();
  root.name = 'PISTONS_AND_RODS';

  const pistonGeo = cached('piston', () => softCylinder(46.6, LAYOUT.pistonHeight, 40, 3));
  const ringGeo = cached('pistonring', () => new THREE.CylinderGeometry(47, 47, 2.4, 40));
  const makePiston = () => {
    const p = new THREE.Group();
    p.name = 'Piston';
    mesh(pistonGeo, M.piston, 'Piston_Body', p).castShadow = true;
    // dish in the crown so it reads as a piston, and three rings
    mesh(cylinder(38, 38, 4, 32), M.bore, 'Piston_CrownDish', p, [0, 26, 0]);
    [21, 14, 7].forEach((y, i) => mesh(ringGeo, M.darkSteel, `Piston_Ring_${i + 1}`, p, [0, y - 12, 0]));
    for (const s of [1, -1]) {
      mesh(chamferBox(18, 30, 4, 2, 1), M.bore, `Piston_SkirtRelief_${s > 0 ? 'R' : 'L'}`, p, [s * 42, -14, 0]);
    }
    return p;
  };

  const bigGeo = cached('rodbig', () => {
    const g = new THREE.CylinderGeometry(ROD_BIG_R, ROD_BIG_R, 40, 28);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const bigBear = cached('rodbearing', () => {
    const g = new THREE.CylinderGeometry(LAYOUT.rodJournalR + 2.5, LAYOUT.rodJournalR + 2.5, 42, 24);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const smallGeo = cached('rodsmall', () => {
    const g = new THREE.CylinderGeometry(ROD_SMALL_R, ROD_SMALL_R, 26, 22);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const pinGeo = cached('wristpin', () => {
    const g = new THREE.CylinderGeometry(PIN_R, PIN_R, 56, 20);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const makeRod = () => {
    const r = new THREE.Group();
    r.name = 'ConnectingRod';
    const big = mesh(bigGeo, M.darkSteel, 'Rod_BigEnd', r);
    big.castShadow = true;
    mesh(bigBear, M.bearing, 'Rod_BigEndBearing', r);
    mesh(chamferBox(15, LAYOUT.rodLength - 46, 26, 5, 3), M.darkSteel, 'Rod_Beam', r, [0, LAYOUT.rodLength / 2, 0]).castShadow = true;
    mesh(smallGeo, M.darkSteel, 'Rod_SmallEnd', r, [0, LAYOUT.rodLength, 0]);
    mesh(pinGeo, M.steel, 'Rod_WristPin', r, [0, LAYOUT.rodLength, 0]);
    for (const s of [1, -1]) {
      const b = fastener(8, 42, 15, M.darkSteel, `RodBolt_${s > 0 ? 'R' : 'L'}`);
      b.position.set(s * 31, 0, 0);
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
    piston.rotation.z = BANK_ROT_Z[c.bank];
    const rod = rodTemplate.clone(true);
    rod.name = `ConnectingRod_Cyl${c.id}`;
    wrap.add(piston, rod);
    cylinders.push({ def: c, wrap, piston, rod });
  }
  return { root, cylinders };
}

function buildTimingChain(M) {
  const g = new THREE.Group();
  g.name = 'TIMING_DRIVE';
  const samples = beltPath([
    { x: 0, y: 0, r: 38 },
    { x: 161, y: 279, r: 60 },
    { x: -161, y: 279, r: 60 },
  ]);
  const chain = mesh(beltRibbon(samples, 16, 9, LAYOUT.chainZ, 24), M.chainSteel, 'Timing_Chain', g);
  chain.castShadow = true;
  // chain guide + tensioner shoe
  const guide = mesh(chamferBox(14, 130, 20, 6, 3), M.plastic, 'Timing_ChainGuide', g, [-52, 120, LAYOUT.chainZ]);
  guide.rotation.z = 0.22;
  const tens = mesh(chamferBox(14, 110, 20, 6, 3), M.plastic, 'Timing_ChainTensioner', g, [118, 110, LAYOUT.chainZ]);
  tens.rotation.z = -0.5;
  return g;
}

export function buildRotatingAssembly(M) {
  const root = new THREE.Group();
  root.name = 'ROTATING_ASSEMBLY';

  const crank = buildCrank(M);
  root.add(crank);
  const flywheel = buildFlywheel(M, crank);

  const { root: pistons, cylinders } = buildRodsAndPistons(M);
  root.add(pistons);

  const timing = buildTimingChain(M);
  root.add(timing);

  function update(crankDeg) {
    crank.rotation.z = crankRotation(crankDeg);
    for (const cyl of cylinders) {
      const { bank, z } = cyl.def;
      const pin = crankPinPosition(cyl.def, crankDeg);
      const { s } = pistonPinDistance(cyl.def, crankDeg);
      const dir = BANK_DIR[bank];
      const pinHead = new THREE.Vector3(dir.x * s, dir.y * s, z);
      cyl.piston.position.copy(pinHead);
      cyl.rod.position.set(pin.x, pin.y, z);
      cyl.rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pinHead.clone().sub(new THREE.Vector3(pin.x, pin.y, z)).normalize());
    }
  }
  update(0);

  return { root, crank, flywheel, timing, cylinders, update };
}
