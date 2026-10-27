// rotating.js - wal korbowy (szesc czopow korbowych, siedem czopow glownych,
// czopy parami co 180 stopni - z tego wynika zaplon 1-6-2-4-3-5 co 120 stopni),
// tloki z kieszeniami zaworowymi, korbowody, kolo zamachowe dwumasowe,
// naped rozrzadu lancuchem i naped pomocniczy paskiem.
// Polozycja tloka i orientacja korbowodu licza sie z wzorow, nie z klatek.

import * as THREE from 'three';
import { chamferBox, taperBox, cylinder, softCylinder, gearGeometry, beltPath, beltRibbon, coilSpring, cached, mesh, fastener } from '../lib/geom.js';
import { annulus, halfAnnulus, cylinderX, softCylinderX } from '../lib/shapes.js';
import { LAYOUT, CYLINDERS, MAIN_JOURNAL_Z, ROD_JOURNALS, D2R, pistonPinDistance, crankPinPosition, crankRotation } from '../lib/layout.js';

const BORE_R = LAYOUT.bore / 2;
const PISTON_R = BORE_R - 0.05;
const ROD_BIG_R = 36;
const ROD_SMALL_R = 17;
const PIN_R = 12;
const BELT_Z = LAYOUT.accessoryBeltZ;

function buildCrank(M) {
  const g = new THREE.Group();
  g.name = 'CRANKSHAFT';

  // czopy glowne (siedem, po 67 mm srednicy)
  for (const [i, z] of MAIN_JOURNAL_Z.entries()) {
    const j = mesh(softCylinderX(LAYOUT.mainJournalD / 2, 30, 34, 2), M.crankJournal, `Crank_MainJournal_${i + 1}`, g, [0, 0, z]);
    j.castShadow = true;
  }
  // czopy korbowe (szesc, po 53 mm srednicy); dwa na jedna pozycje osiowa leza naprzeciw siebie
  for (const rj of ROD_JOURNALS) {
    const a = rj.baseAngle * D2R;
    const j = mesh(
      softCylinderX(LAYOUT.rodJournalD / 2, 22, 30, 2),
      M.crankJournal,
      `Crank_RodJournal_Cyl${rj.cyl}`,
      g,
      [Math.cos(a) * LAYOUT.crankRadius, Math.sin(a) * LAYOUT.crankRadius, rj.z]
    );
    j.castShadow = true;
  }
  // przeciwwagi nie sa potrzebne: szesc czopow co 60 stopni znosi sie samo,
  // zostaja tylko wasy miedzy czopami
  for (const z of [118, 0, -118]) {
    for (const dz of [-14, 14]) {
      const w = mesh(annulus(60, 30, 11, 40), M.crankSteel, `Crank_Web_${z}_${dz}`, g, [0, 0, z + dz]);
      w.castShadow = true;
    }
  }
  // koncowka przednia z tlumikiem drgan skretnych (kuty piasta, [B])
  const snout = mesh(cylinderX(30, 96, 30), M.crankSteel, 'Crank_Snout', g, [0, 0, 214]);
  snout.castShadow = true;
  const damperHub = mesh(softCylinder(58, 44, 34, 3), M.steel, 'CrankDamper_Hub', g, [0, 0, 246]);
  damperHub.rotation.x = Math.PI / 2;
  for (const dz of [0, 1, 2]) {
    const ring = mesh(annulus(96, 70, 10, 48), M.darkSteel, `CrankDamper_PulleyGroove_${dz}`, g, [0, 0, 268 + dz * 10]);
    ring.castShadow = true;
  }
  mesh(softCylinder(96, 22, 48, 3), M.caseMachined, 'CrankDamper_Ring', g, [0, 0, 262]).rotation.x = Math.PI / 2;
  // flansza kola zamachowego i kolo zebate napedu rozrzadu (dwa rzedy lancucha)
  mesh(softCylinder(86, 28, 40, 3), M.crankSteel, 'Crank_RearFlange', g, [0, 0, -188]).rotation.x = Math.PI / 2;
  const sprocket = mesh(gearGeometry(22, 38, 6, 38), M.darkSteel, 'CrankSprocket_Chains', g, [0, 0, LAYOUT.camChainZ]);
  sprocket.castShadow = true;
  return g;
}

function buildFlywheel(M, crank) {
  const g = new THREE.Group();
  g.name = 'FLYWHEEL_ASSEMBLY';
  g.position.z = LAYOUT.flywheelZ;
  crank.add(g);

  const primary = mesh(softCylinder(132, 26, 56, 3), M.crankSteel, 'Flywheel_PrimaryMass', g);
  primary.rotation.x = Math.PI / 2;
  primary.castShadow = true;
  const secondary = mesh(annulus(160, 96, 34, 64), M.crankSteel, 'Flywheel_SecondaryMass', g, [0, 0, -22]);
  secondary.castShadow = true;
  const ring = mesh(gearGeometry(110, 156, 8, 26), M.darkSteel, 'Flywheel_RingGear', g, [0, 0, -6]);
  ring.castShadow = true;
  // sprezyny dwumasowe
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const s = mesh(cylinder(13, 13, 62, 14), M.springSteel, `Flywheel_DmfSpring_${i + 1}`, g, [Math.cos(a) * 112, Math.sin(a) * 112, -22]);
    s.rotation.z = a + Math.PI / 2;
  }
  // tarcza sprzegla i docisk
  mesh(annulus(150, 62, 6, 56), M.darkSteel, 'Clutch_FrictionDisc', g, [0, 0, -44]);
  const press = mesh(taperBox(300, 240, 46, 46, 24, 5), M.caseMachined, 'Clutch_PressurePlate', g, [0, 0, -66]);
  press.rotation.x = Math.PI / 2;
  press.castShadow = true;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const b = fastener(10, 34, 17, M.darkSteel, `FlywheelBolt_${i + 1}`);
    b.position.set(Math.cos(a) * 76, Math.sin(a) * 76, 16);
    b.rotation.x = Math.PI / 2;
    g.add(b);
  }
  return g;
}

function buildStarter(M) {
  const g = new THREE.Group();
  g.name = 'STARTER_MOTOR';
  g.position.set(142, -186, -252);
  const body = mesh(softCylinder(46, 150, 28, 3), M.darkSteel, 'Starter_Body', g);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  mesh(cylinder(28, 28, 26, 20), M.blackOxide, 'Starter_Solenoid', g, [0, 52, 40]).rotation.x = Math.PI / 2;
  const pinion = mesh(gearGeometry(11, 22, 5, 16), M.steel, 'Starter_Pinion', g, [0, 0, 90]);
  void pinion;
  return g;
}

function buildTimingDrive(M) {
  const g = new THREE.Group();
  g.name = 'TIMING_DRIVE';
  // dwa rzedy lancucha, po jednym na glowice, naped z kola zebatego walu
  const banks = [
    { sign: 1, z: LAYOUT.camChainZ + 10 },
    { sign: -1, z: LAYOUT.camChainZ - 10 },
  ];
  for (const b of banks) {
    const samples = beltPath([
      { x: 0, y: 0, r: 42 },
      { x: b.sign * LAYOUT.camX, y: LAYOUT.camAboveDeck, r: 58 },
      { x: b.sign * LAYOUT.camX, y: -LAYOUT.camAboveDeck, r: 58 },
    ]);
    const chain = mesh(beltRibbon(samples, 20, 9, b.z, 22), M.chain, `Timing_Chain_${b.sign > 0 ? 'A' : 'B'}`, g);
    chain.castShadow = true;
    // prowadnice i napinacz
    const guide = mesh(chamferBox(16, 150, 22, 6, 3), M.caseMachined, `Timing_ChainGuide_${b.sign > 0 ? 'A' : 'B'}`, g, [b.sign * 150, 150, b.z]);
    guide.rotation.z = b.sign * 0.5;
    const tens = mesh(chamferBox(16, 130, 24, 6, 3), M.caseMachined, `Timing_ChainTensioner_${b.sign > 0 ? 'A' : 'B'}`, g, [b.sign * 190, -120, b.z]);
    tens.rotation.z = -b.sign * 0.42;
    mesh(cylinder(15, 15, 46, 16), M.darkSteel, `Timing_TensionerPiston_${b.sign > 0 ? 'A' : 'B'}`, g, [b.sign * 230, -60, b.z]);
  }
  return g;
}

function buildAccessoryDrive(M) {
  const g = new THREE.Group();
  g.name = 'ACCESSORY_DRIVE';
  const pulleys = [
    { x: 0, y: 0, r: 96 },
    { x: -84, y: 74, r: 62 },
    { x: -210, y: 138, r: 46 },
    { x: 150, y: 152, r: 46 },
    { x: -20, y: 196, r: 34 },
  ];
  const samples = beltPath(pulleys);
  const belt = mesh(beltRibbon(samples, 24, 10, BELT_Z, 26), M.rubber, 'Accessory_Belt', g);
  belt.castShadow = true;
  // napinacz z ramieniem
  mesh(softCylinder(34, 26, 24, 3), M.darkSteel, 'Belt_TensionerPulley', g, [-20, 196, BELT_Z]).rotation.x = Math.PI / 2;
  const arm = mesh(chamferBox(20, 90, 14, 8, 3), M.caseMachined, 'Belt_TensionerArm', g, [10, 150, BELT_Z + 12]);
  arm.rotation.z = 0.5;
  // alternator
  const alt = new THREE.Group();
  alt.name = 'ALTERNATOR';
  alt.position.set(-210, 138, BELT_Z - 40);
  g.add(alt);
  const altBody = mesh(softCylinder(60, 130, 28, 3), M.caseCast, 'Alternator_Body', alt);
  altBody.rotation.x = Math.PI / 2;
  altBody.castShadow = true;
  mesh(softCylinder(50, 30, 28, 3), M.caseMachined, 'Alternator_FrontHousing', alt, [0, 0, -78]).rotation.x = Math.PI / 2;
  mesh(softCylinder(46, 26, 28, 3), M.darkSteel, 'Alternator_Pulley', alt, [0, 0, -112]).rotation.x = Math.PI / 2;
  mesh(chamferBox(34, 90, 30, 8, 3), M.caseMachined, 'Alternator_Bracket', g, [-210, 76, BELT_Z - 20]).castShadow = true;
  // sprezarka klimatyzacji
  const ac = new THREE.Group();
  ac.name = 'AC_COMPRESSOR';
  ac.position.set(150, 152, BELT_Z - 44);
  g.add(ac);
  const acBody = mesh(softCylinder(52, 120, 24, 3), M.darkSteel, 'ACCompressor_Body', ac);
  acBody.rotation.x = Math.PI / 2;
  acBody.castShadow = true;
  mesh(softCylinder(48, 30, 28, 3), M.caseMachined, 'ACCompressor_Clutch', ac, [0, 0, -86]).rotation.x = Math.PI / 2;
  mesh(softCylinder(46, 26, 28, 3), M.darkSteel, 'ACCompressor_Pulley', ac, [0, 0, -118]).rotation.x = Math.PI / 2;
  mesh(tubeBetweenL([0, 30, -60], [10, 90, -120], 12), M.hose, 'AC_Hose_Low', ac);
  mesh(tubeBetweenL([0, -40, -60], [-16, -96, -130], 11), M.hose, 'AC_Hose_High', ac);
  return g;
}

// mala pomocnicza rurka w ukladzie lokalnym
function tubeBetweenL(a, b, r) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(B, A);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r, r, len, 12, 1, false);
  geo.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  geo.applyMatrix4(new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1)));
  return geo;
}

function buildReciprocating(M) {
  const root = new THREE.Group();
  root.name = 'RECIPROCATING_ASSEMBLY';

  const pistonGeo = cached('h6piston', () => {
    const g = softCylinderX(PISTON_R, LAYOUT.pistonHeight, 56, 3);
    g.translate(LAYOUT.pistonCompressionHeight - LAYOUT.pistonHeight / 2, 0, 0);
    return g;
  });
  const ringGeo = cached('h6ring', () => annulus(PISTON_R, PISTON_R - 5, 2.6, 48));
  const pocketGeo = cached('h6pocket', () => {
    const g = new THREE.CylinderGeometry(21, 18, 4, 24);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const skirtGeo = cached('h6skirt', () => chamferBox(18, 26, 40, 5, 2));

  const makePiston = () => {
    const p = new THREE.Group();
    p.name = 'Piston';
    const body = mesh(pistonGeo, M.piston, 'Piston_Body', p);
    body.castShadow = true;
    mesh(cylinderX(38, 3, 40), M.bore, 'Piston_CrownDish', p, [LAYOUT.pistonCompressionHeight - LAYOUT.pistonDishDepth / 2, 0, 0]);
    for (const [i, x] of [24, 17, 10].entries()) {
      const r = mesh(ringGeo, M.ring, `Piston_Ring_${i + 1}`, p, [x, 0, 0]);
      r.rotation.y = Math.PI / 2;
    }
    // cztery kieszenie zaworowe w koronie (detal z opisu Porsche)
    for (const dz of [-LAYOUT.valveZOffset, LAYOUT.valveZOffset]) {
      for (const s of [1, -1]) {
        mesh(pocketGeo, M.bore, `Piston_ValvePocket_${s > 0 ? 'I' : 'E'}_${dz > 0 ? 'R' : 'L'}`, p, [LAYOUT.pistonCompressionHeight - 1.6, s * LAYOUT.valveSeatY, dz]);
      }
    }
    for (const s of [1, -1]) {
      mesh(skirtGeo, M.pistonSkirt, `Piston_SkirtRelief_${s > 0 ? 'R' : 'L'}`, p, [-6, 0, s * (PISTON_R - 1)]);
    }
    return p;
  };

  const bigGeo = cached('h6rodbig', () => annulus(ROD_BIG_R, LAYOUT.rodJournalD / 2 + 0.6, 20, 40));
  const bearGeo = cached('h6rodbear', () => annulus(LAYOUT.rodJournalD / 2 + 0.4, LAYOUT.rodJournalD / 2, 20, 40));
  const smallGeo = cached('h6rodsmall', () => annulus(ROD_SMALL_R, PIN_R + 0.3, 20, 32));
  const pinGeo = cached('h6pin', () => cylinder(PIN_R, PIN_R, 44, 20));
  const makeRod = () => {
    const r = new THREE.Group();
    r.name = 'ConnectingRod';
    const big = mesh(bigGeo, M.darkSteel, 'Rod_BigEnd', r);
    big.castShadow = true;
    mesh(bearGeo, M.bearing, 'Rod_BigEndBearing', r);
    const beam = mesh(chamferBox(16, LAYOUT.rodLength - 48, 22, 6, 3), M.darkSteel, 'Rod_Beam', r, [0, LAYOUT.rodLength / 2, 0]);
    beam.castShadow = true;
    mesh(smallGeo, M.darkSteel, 'Rod_SmallEnd', r, [0, LAYOUT.rodLength, 0]);
    const pin = mesh(pinGeo, M.steel, 'Rod_WristPin', r, [0, LAYOUT.rodLength, 0]);
    pin.rotation.x = Math.PI / 2;
    void pin;
    for (const s of [1, -1]) {
      const b = fastener(9, 44, 16, M.darkSteel, `RodBolt_${s > 0 ? 'R' : 'L'}`);
      b.position.set(s * 32, 0, 0);
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
    wrap.name = `Cylinder_${c.id}_${c.bank}`;
    root.add(wrap);
    const piston = pistonTemplate.clone(true);
    piston.name = `PISTON_Cyl${c.id}`;
    const rod = rodTemplate.clone(true);
    rod.name = `CONNECTING_ROD_Cyl${c.id}`;
    wrap.add(piston, rod);
    cylinders.push({ def: c, wrap, piston, rod });
  }

  const UP = new THREE.Vector3(0, 1, 0);
  function update(crankDeg) {
    for (const c of cylinders) {
      const def = c.def;
      const { s } = pistonPinDistance(def, crankDeg);
      const pin = crankPinPosition(def, crankDeg);
      const pistonPin = new THREE.Vector3(def.bankSign * s, 0, def.z);
      const crankPin = new THREE.Vector3(pin.x, pin.y, pin.z);
      c.piston.position.copy(pistonPin);
      c.rod.position.copy(crankPin);
      c.rod.quaternion.setFromUnitVectors(UP, pistonPin.clone().sub(crankPin).normalize());
    }
  }
  update(0);

  return { root, cylinders, update, templates: { pistonTemplate, rodTemplate } };
}

export function buildRotatingAssembly(M) {
  const root = new THREE.Group();
  root.name = 'ROTATING_ASSEMBLY';

  const crank = buildCrank(M);
  root.add(crank);
  const flywheel = buildFlywheel(M, crank);
  root.add(buildStarter(M));
  root.add(buildTimingDrive(M));
  root.add(buildAccessoryDrive(M));

  const recip = buildReciprocating(M);
  root.add(recip.root);

  function update(crankDeg) {
    crank.rotation.z = crankRotation(crankDeg);
    recip.update(crankDeg);
  }
  update(0);

  return { root, crank, flywheel, recip, update };
}

void halfAnnulus;
void taperBox;
void coilSpring;
