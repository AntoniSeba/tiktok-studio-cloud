// accessories.js - front accessory drive (pulleys, serpentine + V belts,
// water pump, alternator, power steering pump) and the ignition system
// (distributor + plug wires routed to the real plug boot positions).

import * as THREE from 'three';
import {
  chamferBox,
  cylinder,
  tubeThrough,
  tubeBetween,
  cached,
  mesh,
  fastener,
  beltPath,
  beltRibbon,
} from '../lib/geom.js';
import { LAYOUT } from '../lib/layout.js';

const BELT_Z = LAYOUT.beltZ; // 395
const VBELT_Z = 448;

// --------------------------------------------------------------- pulleys
function makePulley(name, r, width, kind = 'serpentine') {
  const g = new THREE.Group();
  g.name = name;
  const rim = mesh(cylinder(r, r, width, 36), M_STEEL, `${name}_Rim`, g);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  for (const s of [1, -1]) {
    const f = mesh(cylinder(r + 7, r + 7, 5, 36), M_STEEL, `${name}_Flange_${s > 0 ? 'F' : 'R'}`, g, [0, 0, s * (width / 2 + 2)]);
    f.rotation.x = Math.PI / 2;
  }
  const hub = mesh(cylinder(26, 26, width + 8, 18), M_STEEL, `${name}_Hub`, g);
  hub.rotation.x = Math.PI / 2;
  if (kind === 'serpentine') {
    for (let i = 0; i < 5; i++) {
      const off = (i - 2) * (width / 6);
      const ribg = mesh(cylinder(r + 1.5, r + 1.5, width / 12, 36), M_DARK, `${name}_Groove_${i + 1}`, g, [0, 0, off]);
      ribg.rotation.x = Math.PI / 2;
    }
  } else {
    const v = mesh(cylinder(r - 6, r - 6, width * 0.6, 32), M_DARK, `${name}_VGroove`, g);
    v.rotation.x = Math.PI / 2;
  }
  return g;
}

let M_STEEL;
let M_DARK;

export function buildAccessoryDrive(M, ports) {
  M_STEEL = M.polishedSteel;
  M_DARK = M.castIron;
  const root = new THREE.Group();
  root.name = 'ACCESSORY_DRIVE';

  // ---------------------------------------------------- serpentine drive
  const serp = new THREE.Group();
  serp.name = 'SERPENTINE_DRIVE';
  serp.userData.explode = new THREE.Vector3(0, 0, 1).multiplyScalar(520);
  root.add(serp);

  const pulleys = {
    crank: { x: 0, y: 0, r: 85 },
    idler: { x: 185, y: 110, r: 42 },
    water: { x: 0, y: 190, r: 72 },
    alt: { x: -330, y: 165, r: 48 },
    tensioner: { x: -165, y: -60, r: 45 },
  };

  // harmonic damper on the crank snout
  const damper = new THREE.Group();
  damper.name = 'Crank_Damper';
  damper.position.set(0, 0, 328);
  serp.add(damper);
  const d1 = mesh(cylinder(88, 88, 22, 40), M_STEEL, 'Damper_OuterRing', damper);
  d1.rotation.x = Math.PI / 2;
  const d2 = mesh(cylinder(74, 74, 26, 36), M_STEEL, 'Damper_InnerHub', damper);
  d2.rotation.x = Math.PI / 2;
  const dr = mesh(cylinder(80, 80, 14, 40), M.rubber, 'Damper_RubberElement', damper);
  dr.rotation.x = Math.PI / 2;

  const crankPulley = makePulley('CrankPulley_Serpentine', 85, 40);
  crankPulley.position.set(0, 0, BELT_Z);
  serp.add(crankPulley);

  const wpPulley = makePulley('WaterPumpPulley', 72, 36);
  wpPulley.position.set(0, 190, BELT_Z);
  serp.add(wpPulley);

  const altPulley = makePulley('AlternatorPulley', 48, 30);
  altPulley.position.set(-330, 165, BELT_Z);
  serp.add(altPulley);

  const idlerPulley = makePulley('IdlerPulley', 42, 32);
  idlerPulley.position.set(185, 110, BELT_Z);
  serp.add(idlerPulley);

  const tensPulley = makePulley('TensionerPulley', 45, 34);
  tensPulley.position.set(-165, -60, BELT_Z);
  serp.add(tensPulley);
  // tensioner arm + spring housing
  const arm = mesh(chamferBox(20, 120, 20, 8, 3), M.castAluminium, 'Tensioner_Arm', serp, [-140, -20, BELT_Z - 30]);
  arm.rotation.z = -0.5;
  mesh(cylinder(34, 34, 46, 22), M.castAluminium, 'Tensioner_SpringHousing', serp, [-96, 30, BELT_Z - 34]).rotation.x = Math.PI / 2;
  // idler bracket
  mesh(chamferBox(24, 90, 60, 8, 3), M.castAluminium, 'Idler_Bracket', serp, [206, 120, BELT_Z - 32]);

  const serpSamples = beltPath([
    pulleys.crank,
    pulleys.idler,
    pulleys.water,
    pulleys.alt,
    pulleys.tensioner,
  ]);
  const serpBelt = mesh(beltRibbon(serpSamples, 30, 9, BELT_Z), M.beltRubber, 'Serpentine_Belt', serp);
  serpBelt.castShadow = true;
  serp.userData.beltLength = serpSamples.reduce((acc, s, i, arr) => {
    const p = arr[(i - 1 + arr.length) % arr.length];
    return acc + Math.hypot(s.p.x - p.p.x, s.p.y - p.p.y);
  }, 0);

  // ------------------------------------------------------- V-belt drive
  const vbelt = new THREE.Group();
  vbelt.name = 'V_BELT_DRIVE';
  vbelt.userData.explode = new THREE.Vector3(0, 0, 1).multiplyScalar(600);
  root.add(vbelt);
  const crankV = makePulley('CrankPulley_VBelt', 95, 34, 'v');
  crankV.position.set(0, 0, VBELT_Z);
  vbelt.add(crankV);
  const psPulley = makePulley('PowerSteeringPulley', 55, 30, 'v');
  psPulley.position.set(340, 175, VBELT_Z);
  vbelt.add(psPulley);
  const vSamples = beltPath([
    { x: 0, y: 0, r: 99 },
    { x: 340, y: 175, r: 59 },
  ]);
  mesh(beltRibbon(vSamples, 22, 12, VBELT_Z, 60), M.beltRubber, 'V_Belt', vbelt).castShadow = true;

  // --------------------------------------------------- accessory units
  const units = new THREE.Group();
  units.name = 'ACCESSORY_UNITS';
  units.userData.explode = new THREE.Vector3(0, 0, 1).multiplyScalar(230);
  root.add(units);

  // water pump
  const wp = new THREE.Group();
  wp.name = 'WaterPump';
  units.add(wp);
  const wpBody = mesh(cylinder(78, 78, 74, 34), M.castAluminium, 'WaterPump_Body', wp, [0, 190, 340]);
  wpBody.rotation.x = Math.PI / 2;
  wpBody.castShadow = true;
  mesh(cylinder(24, 24, 40, 18), M.machinedSteel, 'WaterPump_Shaft', wp, [0, 190, 386]).rotation.x = Math.PI / 2;
  const inlet = mesh(cylinder(31, 31, 92, 22), M.castAluminium, 'WaterPump_Inlet', wp, [-56, 154, 330]);
  inlet.rotation.z = Math.PI / 2;
  inlet.castShadow = true;
  mesh(cylinder(35, 35, 12, 22), M.machinedSteel, 'WaterPump_InletClamp', wp, [-96, 154, 330]).rotation.z = Math.PI / 2;
  mesh(chamferBox(150, 130, 8, 8, 2), M.gasket, 'WaterPump_Gasket', wp, [0, 150, 305]);
  for (const [x, y] of [[-58, 236], [58, 236], [-58, 96], [58, 96]]) {
    const b = fastener(10, 40, 17, M.machinedSteel, `WaterPumpBolt_${x}_${y}`);
    b.position.set(x, y, 300);
    b.rotation.x = Math.PI / 2;
    wp.add(b);
  }

  // alternator
  const alt = new THREE.Group();
  alt.name = 'Alternator';
  units.add(alt);
  const altBody = mesh(cylinder(62, 62, 128, 30), M.castAluminium, 'Alternator_Body', alt, [-330, 165, 310]);
  altBody.rotation.x = Math.PI / 2;
  altBody.castShadow = true;
  for (const z of [248, 372]) {
    const cap = mesh(cylinder(64, 64, 14, 30), M.castAluminium, `Alternator_EndFrame_${z}`, alt, [-330, 165, z]);
    cap.rotation.x = Math.PI / 2;
  }
  mesh(cylinder(20, 20, 40, 14), M.machinedSteel, 'Alternator_Shaft', alt, [-330, 165, 392]).rotation.x = Math.PI / 2;
  mesh(
    tubeBetween(new THREE.Vector3(-288, 172, 175), new THREE.Vector3(-300, 168, 250), 9, 10),
    M.machinedSteel,
    'Alternator_AdjusterStrap',
    alt
  );
  const altBracket = mesh(chamferBox(20, 150, 100, 8, 3), M.castIron, 'Alternator_Bracket', alt, [-286, 168, 205]);
  altBracket.castShadow = true;
  for (const y of [120, 215]) {
    const b = fastener(12, 60, 21, M.machinedSteel, `AlternatorBracketBolt_${y}`);
    b.position.set(-292, y, 190);
    b.rotation.z = Math.PI / 2;
    alt.add(b);
  }

  // power steering pump (V-belt driven, right side)
  const ps = new THREE.Group();
  ps.name = 'PowerSteeringPump';
  units.add(ps);
  const psBody = mesh(cylinder(46, 46, 112, 26), M.castIron, 'PowerSteering_Body', ps, [340, 175, 330]);
  psBody.rotation.x = Math.PI / 2;
  psBody.castShadow = true;
  const psRes = mesh(chamferBox(112, 96, 132, 14, 4), M.castIron, 'PowerSteering_Reservoir', ps, [340, 232, 322]);
  psRes.castShadow = true;
  mesh(cylinder(18, 18, 40, 14), M.machinedSteel, 'PowerSteering_Shaft', ps, [340, 175, 400]).rotation.x = Math.PI / 2;
  const psBracket = mesh(chamferBox(20, 120, 110, 8, 3), M.castIron, 'PowerSteering_Bracket', ps, [290, 180, 300]);
  psBracket.castShadow = true;
  for (const y of [140, 220]) {
    const b = fastener(12, 58, 21, M.machinedSteel, `PSBracketBolt_${y}`);
    b.position.set(284, y, 290);
    b.rotation.z = -Math.PI / 2;
    ps.add(b);
  }

  // --------------------------------------------------------- ignition
  const ign = new THREE.Group();
  ign.name = 'IGNITION_SYSTEM';
  ign.userData.explode = new THREE.Vector3(0, 0.4, -1).normalize().multiplyScalar(420);
  root.add(ign);

  const dist = new THREE.Group();
  dist.name = 'Distributor';
  dist.position.set(0, 300, -215);
  ign.add(dist);
  const body = mesh(cylinder(38, 38, 104, 26), M.castAluminium, 'Distributor_Body', dist, [0, 0, 0]);
  body.castShadow = true;
  mesh(cylinder(13, 13, 150, 12), M.machinedSteel, 'Distributor_Shaft', dist, [0, -120, 0]);
  mesh(cylinder(26, 26, 16, 20), M.machinedSteel, 'Distributor_Collar', dist, [0, -46, 0]);
  const cap = mesh(cylinder(46, 46, 54, 26), M.plasticBlack, 'Distributor_Cap', dist, [0, 76, 0]);
  cap.castShadow = true;
  mesh(cylinder(20, 20, 22, 18), M.plasticBlack, 'Distributor_CapTower', dist, [0, 112, 0]);
  const vac = mesh(cylinder(23, 23, 76, 20), M.castAluminium, 'Distributor_VacuumAdvance', dist, [0, 16, -62]);
  vac.rotation.x = Math.PI / 2;
  mesh(cylinder(7, 7, 70, 8), M.machinedSteel, 'Distributor_VacuumLink', dist, [0, 26, 8]);
  mesh(chamferBox(70, 12, 40, 4, 2), M.machinedSteel, 'Distributor_HoldDownClamp', dist, [-30, -40, -20]);
  const holdBolt = fastener(10, 70, 17, M.machinedSteel, 'Distributor_HoldDownBolt');
  holdBolt.position.set(-56, -30, -20);
  holdBolt.rotation.z = Math.PI / 2;
  dist.add(holdBolt);

  // plug wires: distributor cap terminals -> real boot positions
  const terminals = {};
  for (const bank of ['L', 'R']) {
    ports
      .filter((p) => p.bank === bank)
      .sort((a, b) => b.z - a.z)
      .forEach((p, i) => {
        const spread = [-0.35, -0.75, -1.15, -1.55][i];
        const ang = (bank === 'R' ? spread : Math.PI - spread) * 1;
        terminals[p.id] = new THREE.Vector3(
          Math.cos(ang) * 38,
          400,
          Math.sin(ang) * 38 - 215
        );
      });
  }
  for (const p of ports) {
    const t = terminals[p.id];
    const s = p.bank === 'R' ? 1 : -1;
    const midA = new THREE.Vector3(s * 120, 430, -180);
    const midB = new THREE.Vector3(s * 132, 402, (p.z + -180) / 2);
    const pts = [t, t.clone().add(new THREE.Vector3(s * 40, 30, 8)), midA, midB, p.boot.clone().add(new THREE.Vector3(s * 6, 14, 0)), p.boot.clone()];
    const wire = mesh(tubeThrough(pts, 5.5, 60, 7), M.wire, `PlugWire_Cyl${p.id}`, ign);
    wire.castShadow = true;
  }
  // wire separators along the valve covers
  for (const s of [1, -1]) {
    for (const z of [-60, 120]) {
      mesh(chamferBox(26, 14, 90, 5, 2), M.plasticBlack, `PlugWire_Separator_${s}_${z}`, ign, [s * 130, 408, z - 180]);
    }
  }

  return { root, pulleys: { ...pulleys } };
}
