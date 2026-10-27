// accessories.js - everything bolted to the outside of the 2.2 T R5: the
// exhaust manifold that feeds the turbo, the intake manifold and throttle body
// on the cold side, the intercooler, the ignition, the accessory drive with its
// ribbed belt, the water pump and the odds and ends.
//
// The exhaust manifold is the heart of what makes this engine feel the way it
// does: five runners merging into a single collector that drops into the
// turbine housing, which is why an R5 turbo sounds like nothing else.

import * as THREE from 'three';
import {
  chamferBox,
  taperBox,
  softCylinder,
  sleeve,
  smoothDisc,
  gearGeometry,
  beltPath,
  beltRibbon,
  tubeThrough,
  cached,
  mesh,
  fastener,
} from '../lib/geom.js';
import { LAYOUT, CYLINDERS, SPEC } from '../lib/kinematics.js';
import { TURBO_POS } from './turbo.js';

const EX_FLANGE_X = 107;
const IN_FLANGE_X = -104;
const PORT_Y = LAYOUT.deckHeight + 60;

function exhaustManifold(M, mode) {
  const g = new THREE.Group();
  g.name = 'EXHAUST_MANIFOLD';
  const half = mode === '20v' ? LAYOUT.valvePairZ : 0;

  for (const c of CYLINDERS) {
    // two ports merge into one runner, then all five merge into the collector
    const merge = half
      ? [new THREE.Vector3(EX_FLANGE_X, PORT_Y, c.z - half), new THREE.Vector3(EX_FLANGE_X + 22, PORT_Y + 12, c.z - half * 0.4), new THREE.Vector3(EX_FLANGE_X + 34, PORT_Y + 18, c.z), new THREE.Vector3(EX_FLANGE_X + 46, PORT_Y + 14, c.z), new THREE.Vector3(158, PORT_Y - 4, c.z)]
      : [new THREE.Vector3(EX_FLANGE_X, PORT_Y, c.z), new THREE.Vector3(EX_FLANGE_X + 30, PORT_Y + 16, c.z), new THREE.Vector3(140, PORT_Y - 10, c.z), new THREE.Vector3(158, PORT_Y - 4, c.z)];
    const runner = mesh(tubeThrough(merge, 15, 26, 12, false, 0.4), M.headerSteel, `ExhaustRunner_Cyl${c.id}`, g);
    runner.castShadow = true;
    if (half) {
      const second = mesh(tubeThrough([new THREE.Vector3(EX_FLANGE_X, PORT_Y, c.z + half), new THREE.Vector3(EX_FLANGE_X + 20, PORT_Y + 10, c.z + half * 0.4), new THREE.Vector3(EX_FLANGE_X + 34, PORT_Y + 18, c.z)], 15, 18, 12, false, 0.4), M.headerSteel, `ExhaustRunner_Cyl${c.id}_B`, g);
      second.castShadow = true;
    }
    // flange at the head
    const fl = mesh(softCylinder(half ? 26 : 30, 14, 22, 2), M.ironDark, `ExhaustFlange_Cyl${c.id}`, g, [EX_FLANGE_X - 4, PORT_Y, c.z]);
    fl.rotation.z = Math.PI / 2;
  }
  // collector: a tapering log along the engine that the five runners join
  const collector = mesh(
    tubeThrough([new THREE.Vector3(158, PORT_Y - 4, 196), new THREE.Vector3(166, PORT_Y - 8, 60), new THREE.Vector3(172, PORT_Y - 14, -80), new THREE.Vector3(184, PORT_Y - 24, -176)], 24, 30, 16, false, 0.4),
    M.headerSteel,
    'Exhaust_Collector',
    g
  );
  collector.castShadow = true;
  // drop pipe into the turbine inlet, which sits on top of the turbine volute
  const drop = mesh(
    tubeThrough([new THREE.Vector3(178, PORT_Y - 20, -140), new THREE.Vector3(196, PORT_Y - 60, -60), new THREE.Vector3(TURBO_POS.x + 18, TURBO_POS.y + 74, TURBO_POS.z + 46)], 20, 24, 14, false, 0.4),
    M.headerSteel,
    'Exhaust_DropPipe',
    g
  );
  drop.castShadow = true;
  // heat shield over the collector
  const shield = mesh(chamferBox(74, 6, 340, 8, 2), M.aluMachined, 'Exhaust_HeatShield', g, [176, PORT_Y + 6, -20]);
  shield.rotation.z = -0.12;
  shield.castShadow = true;
  return g;
}

function intakeManifold(M, mode) {
  const g = new THREE.Group();
  g.name = 'INTAKE_MANIFOLD';
  const plenumX = -196;
  const plenumY = PORT_Y + 34;

  const plenum = mesh(
    tubeThrough(
      [
        new THREE.Vector3(plenumX + 16, plenumY - 10, 206),
        new THREE.Vector3(plenumX, plenumY, 120),
        new THREE.Vector3(plenumX - 4, plenumY + 4, -20),
        new THREE.Vector3(plenumX + 4, plenumY - 2, -170),
        new THREE.Vector3(plenumX + 18, plenumY - 14, -206),
      ],
      40,
      36,
      18,
      false,
      0.4
    ),
    M.aluManifold,
    'Intake_Plenum',
    g
  );
  plenum.castShadow = true;

  for (const c of CYLINDERS) {
    const half = mode === '20v' ? LAYOUT.valvePairZ : 0;
    const runner = mesh(
      tubeThrough([new THREE.Vector3(plenumX + 22, plenumY - 4, c.z), new THREE.Vector3(plenumX + 74, plenumY - 8, c.z), new THREE.Vector3(IN_FLANGE_X - 34, PORT_Y + 6, c.z), new THREE.Vector3(IN_FLANGE_X, PORT_Y, c.z + half * 0.5)], 22, 22, 14, false, 0.4),
      M.aluManifold,
      `IntakeRunner_Cyl${c.id}`,
      g
    );
    runner.castShadow = true;
    if (half) {
      mesh(tubeThrough([new THREE.Vector3(IN_FLANGE_X - 30, PORT_Y + 6, c.z), new THREE.Vector3(IN_FLANGE_X, PORT_Y, c.z + half)], 17, 14, 12, false, 0.4), M.aluManifold, `IntakeRunner_Cyl${c.id}_B`, g).castShadow = true;
    }
    const fl = mesh(softCylinder(half ? 26 : 31, 14, 22, 2), M.aluManifold, `IntakeFlange_Cyl${c.id}`, g, [IN_FLANGE_X - 6, PORT_Y, c.z]);
    fl.rotation.z = Math.PI / 2;
  }

  // throttle body at the front of the plenum, with a butterfly in it
  const tb = mesh(sleeve(38, 50, 62, 34, 2), M.aluMachined, 'ThrottleBody_Body', g, [plenumX + 14, plenumY - 4, 236]);
  tb.rotation.x = Math.PI / 2;
  tb.castShadow = true;
  const butterfly = mesh(smoothDisc(37, 5, 26, 1), M.darkSteel, 'ThrottleBody_Butterfly', g, [plenumX + 14, plenumY - 4, 236]);
  butterfly.rotation.x = Math.PI / 2;
  butterfly.rotation.z = 0.28;
  mesh(softCylinder(16, 26, 20, 1.5), M.plastic, 'ThrottleBody_Motor', g, [plenumX + 14, plenumY + 44, 236]).rotation.x = Math.PI / 2;
  const tps = mesh(smoothDisc(18, 12, 20, 2), M.plastic, 'ThrottlePositionSensor', g, [plenumX + 62, plenumY - 4, 236]);
  tps.rotation.z = Math.PI / 2;

  // idle stabiliser valve and the fuel rail with five injectors
  mesh(softCylinder(22, 62, 20, 2), M.aluCast, 'IdleStabiliserValve', g, [plenumX + 30, plenumY + 54, 150]);
  const rail = mesh(softCylinder(11, LAYOUT.blockLength - 120, 20, 1.5), M.aluMachined, 'FuelRail', g, [IN_FLANGE_X - 34, PORT_Y + 30, 0]);
  rail.rotation.x = Math.PI / 2;
  for (const c of CYLINDERS) {
    const inj = mesh(softCylinder(9, 54, 18, 1.2), M.darkSteel, `Injector_Cyl${c.id}`, g, [IN_FLANGE_X - 12, PORT_Y + 4, c.z]);
    inj.rotation.z = 0.5;
  }
  return g;
}

function intercooler(M) {
  const g = new THREE.Group();
  g.name = 'INTERCOOLER';
  const cx = -46;
  const cz = 352;
  const core = new THREE.Group();
  core.name = 'Intercooler_Core';
  const w = 250;
  const h = 190;
  for (let i = 0; i < 22; i++) {
    const plate = mesh(chamferBox(w, 3.2, 68, 1, 0.6), M.intercooler, `Intercooler_Fin_${i + 1}`, core, [0, -h / 2 + 4 + i * ((h - 8) / 21), 0]);
    plate.castShadow = false;
  }
  for (const s of [1, -1]) {
    const tank = mesh(taperBox(60, 44, h + 16, 74, 12, 4), M.aluCast, `Intercooler_EndTank_${s > 0 ? 'R' : 'L'}`, core, [s * (w / 2 + 34), 0, 0]);
    tank.castShadow = true;
  }
  core.position.set(cx, 168, cz);
  g.add(core);
  const inlet = mesh(softCylinder(34, 40, 34, 2), M.aluCast, 'Intercooler_Inlet', g, [cx - w / 2 - 62, 168, cz + 30]);
  inlet.rotation.z = Math.PI / 2;
  const outlet = mesh(softCylinder(38, 44, 34, 2), M.aluCast, 'Intercooler_Outlet', g, [cx - w / 2 - 62, 168, cz - 40]);
  outlet.rotation.y = Math.PI / 2;
  outlet.rotation.x = Math.PI / 2;
  // charge pipe from the compressor outlet round to the intercooler, and the
  // cold pipe from the intercooler to the throttle body
  mesh(
    tubeThrough(
      [
        new THREE.Vector3(TURBO_POS.x + 120, TURBO_POS.y + 58, TURBO_POS.z),
        new THREE.Vector3(250, 250, 60),
        new THREE.Vector3(150, 320, 250),
        new THREE.Vector3(cx - 20, 200, cz - 20),
      ],
      30,
      40,
      16,
      false,
      0.4
    ),
    M.rubber,
    'ChargePipe_Hot',
    g
  ).castShadow = true;
  mesh(
    tubeThrough(
      [
        new THREE.Vector3(cx - w / 2 - 70, 168, cz - 60),
        new THREE.Vector3(-220, 250, 300),
        new THREE.Vector3(-196, 300, 250),
        new THREE.Vector3(-182, 316, 236),
      ],
      30,
      36,
      16,
      false,
      0.4
    ),
    M.rubber,
    'ChargePipe_Cold',
    g
  ).castShadow = true;
  return g;
}

function ignition(M, specCode) {
  const g = new THREE.Group();
  g.name = 'IGNITION';
  // AAN / ABY / ADU drop the distributor for a coil pack rail; the 3B still has
  // one driven off the exhaust camshaft at the back of the head.
  const rail = mesh(softCylinder(9, LAYOUT.blockLength - 150, 18, 1.5), M.plastic, 'CoilPack_Rail', g, [0, 342, -10]);
  rail.rotation.x = Math.PI / 2;
  for (const c of CYLINDERS) {
    const coil = mesh(chamferBox(34, 34, 44, 8, 3), M.plastic, `CoilPack_Cyl${c.id}`, g, [0, 366, c.z + 30]);
    coil.castShadow = true;
    const boot = mesh(softCylinder(13, 40, 16, 1), M.rubber, `CoilBoot_Cyl${c.id}`, g, [0, 342, c.z + 30]);
    const plug = mesh(softCylinder(11, 46, 22, 1), M.ceramic, `SparkPlug_Cyl${c.id}`, g, [0, 300, c.z + 30]);
    plug.castShadow = true;
    mesh(softCylinder(6.5, 22, 14, 0.8), M.steel, `SparkPlugBody_Cyl${c.id}`, g, [0, 272, c.z + 30]);
  }
  if (specCode === '3B') {
    const dist = mesh(softCylinder(30, 62, 26, 2), M.aluCast, 'Distributor_Body', g, [LAYOUT.valveAxisX.exhaust, LAYOUT.deckHeight + LAYOUT.camAboveDeck, -(LAYOUT.blockLength / 2 + 46)]);
    dist.rotation.x = Math.PI / 2;
    dist.castShadow = true;
    mesh(softCylinder(26, 34, 22, 2), M.plastic, 'Distributor_Cap', g, [LAYOUT.valveAxisX.exhaust, LAYOUT.deckHeight + LAYOUT.camAboveDeck, -(LAYOUT.blockLength / 2 + 88)]).rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      mesh(softCylinder(4, 26, 8, 0.6), M.wire, `IgnitionLead_${i + 1}`, g, [LAYOUT.valveAxisX.exhaust + Math.cos(a) * 22, LAYOUT.deckHeight + LAYOUT.camAboveDeck + Math.sin(a) * 22, -(LAYOUT.blockLength / 2 + 100)]).rotation.x = Math.PI / 2;
    }
  }
  return g;
}

function accessoryDrive(M, head) {
  const g = new THREE.Group();
  g.name = 'ACCESSORY_DRIVE';
  const beltZ = LAYOUT.frontZ + 74;
  const crankR = 74;
  const wp = { x: -128, y: 186, r: 36 };
  const alt = { x: 132, y: 132, r: 31 };
  const idler = { x: 46, y: -96, r: 30 };
  const belt = mesh(
    beltRibbon(beltPath([{ x: 0, y: 0, r: crankR }, wp, alt, idler]), 13, 6, beltZ, 18),
    M.beltRubber,
    'Accessory_Belt',
    g
  );
  belt.castShadow = true;

  // water pump: cast body on the intake side, with a pulley and a hose
  const wpBody = mesh(smoothDisc(52, 74, 34, 5), M.aluCast, 'WaterPump_Body', g, [wp.x, wp.y, LAYOUT.blockLength / 2 - 40]);
  wpBody.rotation.x = Math.PI / 2;
  wpBody.castShadow = true;
  const wpPulley = mesh(gearGeometry(28, wp.r - 6, 6, 16), M.darkSteel, 'WaterPump_Pulley', g, [wp.x, wp.y, beltZ]);
  wpPulley.castShadow = true;
  mesh(tubeThrough([new THREE.Vector3(wp.x, wp.y, LAYOUT.blockLength / 2 - 8), new THREE.Vector3(wp.x + 30, 240, 200), new THREE.Vector3(60, 260, 276)], 17, 18, 12, false, 0.4), M.rubber, 'Coolant_Hose_Upper', g);

  // alternator
  const altBody = mesh(smoothDisc(56, 112, 34, 6), M.aluCast, 'Alternator_Body', g, [alt.x, alt.y - 16, LAYOUT.blockLength / 2 - 44]);
  altBody.rotation.z = Math.PI / 2;
  altBody.castShadow = true;
  const altPulley = mesh(gearGeometry(24, alt.r - 5, 5, 15), M.darkSteel, 'Alternator_Pulley', g, [alt.x, alt.y, beltZ]);
  altPulley.castShadow = true;
  const altBracket = mesh(chamferBox(30, 80, 40, 8, 3), M.ironDark, 'Alternator_Bracket', g, [alt.x + 20, alt.y - 70, LAYOUT.blockLength / 2 - 50]);
  altBracket.castShadow = true;
  mesh(softCylinder(14, 80, 16, 1.5), M.darkSteel, 'BeltTensioner_Arm', g, [idler.x + 40, idler.y - 40, beltZ]).rotation.z = Math.PI / 2;
  mesh(smoothDisc(idler.r, 26, 28, 4), M.aluMachined, 'Accessory_Idler', g, [idler.x, idler.y, beltZ]).rotation.x = Math.PI / 2;

  // oil filler cap and the dipstick on the cam cover
  mesh(softCylinder(24, 22, 24, 2), M.plastic, 'OilFillerCap', g, [head.cfg.camAxes[0].x + 8, 400, 150]).rotation.x = Math.PI / 2;
  const dip = mesh(softCylinder(5, 190, 12, 0.6), M.steel, 'Dipstick_Tube', g, [140, -40, 210]);
  const knob = mesh(softCylinder(11, 26, 14, 1.5), M.plastic, 'Dipstick_Handle', g, [140, 66, 210]);
  void dip;
  void knob;
  return g;
}

export function buildAccessories(M, head, spec) {
  const root = new THREE.Group();
  root.name = 'ACCESSORIES';
  const exhaust = exhaustManifold(M, head.mode);
  const intake = intakeManifold(M, head.mode);
  const ic = intercooler(M);
  const ign = ignition(M, spec.code);
  const drive = accessoryDrive(M, head);
  root.add(exhaust, intake, ic, ign, drive);
  return { root, groups: { exhaust, intake, intercooler: ic, ignition: ign, drive } };
}
