// block.js - skrzynia korbowa 9A2: dwie polowki odlewu AlSi7MgCu0.5 (zamknieta
// komora wodna, powloka zelazna w gladzi), siodemka czopow glownych, miska
// olejowa z tworzywa, zintegrowana sucha miska, pompa oleju o zmiennej wydajnosci,
// chlodniczka oleju, pompa wody z przelaczaniem, termostat i mocowania.
// Bank A jest budowany, bank B jest jego odbiciem w X.

import * as THREE from 'three';
import { chamferBox, taperBox, extrudeProfile, softCylinder, cylinder, tubeThrough, cached, mesh, fastener, gearGeometry } from '../lib/geom.js';
import { mirrorX, halfAnnulus, annulus, plateAlongX, circlePoints, cylinderX, softCylinderX } from '../lib/shapes.js';
import { LAYOUT, CYLINDERS, MAIN_JOURNAL_Z, MAIN_JOURNAL_R } from '../lib/layout.js';

const CHAMBER_R = LAYOUT.crankChamberR; // 82
const CASE_HALF_Y = 104;
const BARREL_RO = 66;
const CASE_Z = LAYOUT.caseZ; // 200

// Profil polowki skrzyni korbowej w XY, wyciskany wzdluz Z.
function halfCaseProfile() {
  const s = new THREE.Shape();
  s.moveTo(0, CASE_HALF_Y);
  s.lineTo(96, CASE_HALF_Y - 8);
  s.lineTo(96, -CASE_HALF_Y + 8);
  s.lineTo(0, -CASE_HALF_Y);
  s.lineTo(0, -CHAMBER_R);
  s.absarc(0, 0, CHAMBER_R, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(0, CASE_HALF_Y);
  s.closePath();
  return s;
}

function buildHalfCase(M, sign) {
  const g = new THREE.Group();
  g.name = sign > 0 ? 'HALF_CASE_A' : 'HALF_CASE_B';

  const prof = halfCaseProfile();
  let geo = new THREE.ExtrudeGeometry(prof, {
    depth: CASE_Z * 2,
    bevelEnabled: true,
    bevelSize: 3,
    bevelThickness: 3,
    bevelSegments: 2,
    curveSegments: 40,
  });
  geo.translate(0, 0, -CASE_Z);
  geo.computeVertexNormals();
  if (sign < 0) geo = mirrorX(geo);
  const body = new THREE.Mesh(geo, M.caseCast);
  body.name = `Crankcase_Half_${sign > 0 ? 'A' : 'B'}`;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const pos = (x, y, z) => [x * sign, y, z];

  // ---- czopy glowne: polowa pierscienia w kazdej polowce (podzial w X)
  MAIN_JOURNAL_Z.forEach((z, i) => {
    const ring = new THREE.Mesh(halfAnnulus(96, MAIN_JOURNAL_R, 26, sign), M.caseMachined);
    ring.name = `MainBearing_${i + 1}`;
    ring.position.set(0, 0, z);
    ring.castShadow = true;
    g.add(ring);
    // tuleja lozyska
    const shell = new THREE.Mesh(halfAnnulus(MAIN_JOURNAL_R + 2.5, MAIN_JOURNAL_R, 24, sign, 24), M.bearing);
    shell.name = `MainBearingShell_${i + 1}`;
    shell.position.set(0, 0, z);
    g.add(shell);
  });

  // ---- rzedy cylindrow: zewnetrzna sciana, plaszcz wodny, gladz z powloka Fe
  for (const c of CYLINDERS.filter((c) => c.bankSign === sign)) {
    const barrel = new THREE.Mesh(softCylinderX(BARREL_RO, 128, 40, 3), M.caseCast);
    barrel.name = `CylinderBarrel_${c.id}`;
    barrel.position.set(sign * (LAYOUT.barrelFrom + 64), 0, c.z);
    barrel.castShadow = true;
    g.add(barrel);

    const jacket = new THREE.Mesh(cylinderX(BARREL_RO + 7, 96, 40), M.caseCastDark);
    jacket.name = `CylinderWaterJacket_${c.id}`;
    jacket.position.set(sign * (LAYOUT.barrelFrom + 70), 0, c.z);
    jacket.castShadow = true;
    g.add(jacket);

    // gladz cylindra (powloka zelazna) - widoczna po zdjeciu glowicy
    const liner = new THREE.Mesh(cylinderX(LAYOUT.bore / 2, 130, 56), M.bore);
    liner.name = `CylinderBore_${c.id}`;
    liner.position.set(sign * (LAYOUT.barrelFrom + 62), 0, c.z);
    g.add(liner);
    const rimGeo = annulus(BARREL_RO - 2, LAYOUT.bore / 2, 6, 40);
    const rim = new THREE.Mesh(sign > 0 ? rimGeo : mirrorX(rimGeo), M.linerEdge);
    rim.name = `CylinderBoreRim_${c.id}`;
    rim.rotation.y = Math.PI / 2;
    rim.position.set(sign * (LAYOUT.deckHeight - 6), 0, c.z);
    g.add(rim);
  }

  // ---- plaszczyzna glowicy (deck) z trzema otworami pod cylindry
  const deckHoles = CYLINDERS.filter((c) => c.bankSign === sign).map((c) => circlePoints(LAYOUT.bore / 2, c.z, 0, 40));
  let deck = plateAlongX(
    [
      [-LAYOUT.headHalfZ, -96],
      [LAYOUT.headHalfZ, -96],
      [LAYOUT.headHalfZ, 96],
      [-LAYOUT.headHalfZ, 96],
    ],
    10,
    LAYOUT.deckHeight - 10,
    12,
    deckHoles
  );
  if (sign < 0) deck = mirrorX(deck);
  const deckMesh = new THREE.Mesh(deck, [M.caseMachined, M.bore, M.caseMachined]);
  deckMesh.name = 'Crankcase_DeckFace';
  deckMesh.castShadow = true;
  g.add(deckMesh);

  // ---- zebra odlewu i wzmocnienia
  for (const z of [-150, -75, 75, 150]) {
    const rib = mesh(taperBox(30, 22, 20, 116, 6, 2), M.caseCast, `Case_Rib_${sign > 0 ? 'A' : 'B'}_${z}`, g, pos(96, 0, z), [0, 0, 0], null);
    rib.castShadow = true;
  }
  for (const z of [-170, 0, 170]) {
    const boss = mesh(cylinder(16, 16, 22, 18), M.caseMachined, `Case_Boss_${sign > 0 ? 'A' : 'B'}_${z}`, g, pos(60, CASE_HALF_Y - 6, z));
    boss.rotation.z = Math.PI / 2;
  }

  // ---- sruby skrecajace polowki (w plaszczyznie podzialu x = 0)
  let bolt = 0;
  for (const y of [CASE_HALF_Y - 12, 40, -40, -CASE_HALF_Y + 12]) {
    for (const z of [-150, -50, 50, 150]) {
      const b = fastener(12, 46, 19, M.darkSteel, `CaseBolt_${sign > 0 ? 'A' : 'B'}_${++bolt}`);
      b.position.set(sign * 4, y, z);
      b.rotation.z = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(b);
    }
  }
  // dlugie sruby przez poprzeczki lozysk
  MAIN_JOURNAL_Z.forEach((z, i) => {
    if (i % 2) return;
    for (const y of [70, -70]) {
      const b = fastener(11, 120, 17, M.darkSteel, `CaseThroughBolt_${sign > 0 ? 'A' : 'B'}_${i}_${y}`);
      b.position.set(sign * 20, y, z);
      b.rotation.z = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(b);
    }
  });

  // ---- czujniki spalania stukowego (dwa na silniku, po jednym na polowke)
  const knockZ = sign > 0 ? 150 : -150;
  const knock = mesh(cylinder(14, 14, 26, 16), M.blackOxide, 'KnockSensor', g, pos(88, 60, knockZ));
  knock.rotation.z = Math.PI / 2;
  mesh(taperBox(30, 22, 14, 30, 5, 2), M.caseMachined, 'KnockSensor_Boss', g, pos(74, 60, knockZ));

  // ---- korek spustowy plaszcza wodnego
  for (const z of [-100, 100]) {
    const plug = mesh(softCylinder(15, 12, 18, 3), M.brass, `CorePlug_${sign > 0 ? 'A' : 'B'}_${z}`, g, pos(60, -CASE_HALF_Y + 4, z));
  }

  // ---- odma / separator oleju
  if (sign > 0) {
    const aos = mesh(softCylinder(40, 66, 24, 4), M.caseCastDark, 'AirOilSeparator', g, [70, CASE_HALF_Y + 30, 120]);
    aos.castShadow = true;
    mesh(cylinder(18, 18, 40, 16), M.rubber, 'AirOilSeparator_Neck', g, [70, CASE_HALF_Y + 70, 120]);
  }

  return g;
}

// ---------------------------------------------------------------------------
// Uklad olejowy: zintegrowana sucha miska, pompa zmiennej wydajnosci,
// chlodniczka oleju (plytowa), obudowa filtra, czujnik poziomu.
// ---------------------------------------------------------------------------
function buildOilSystem(M) {
  const g = new THREE.Group();
  g.name = 'OIL_SYSTEM';

  const panH = LAYOUT.panTop - LAYOUT.panBottom;
  const pan = mesh(chamferBox(392, panH, 424, 26, 5), M.panPlastic, 'OilPan_Plastic', g, [0, (LAYOUT.panTop + LAYOUT.panBottom) / 2, 0]);
  pan.castShadow = true;
  mesh(chamferBox(400, 4, 430, 20, 2), M.gasket, 'OilPan_Gasket', g, [0, LAYOUT.panTop + 2, 0]);
  // przetloczenia miski
  for (const z of [-140, -50, 50, 140]) {
    mesh(chamferBox(330, 10, 24, 8, 3), M.panPlastic, `OilPan_Rib_${z}`, g, [0, LAYOUT.panBottom + 6, z]);
  }
  const drain = mesh(new THREE.CylinderGeometry(14, 14, 18, 6), M.darkSteel, 'OilDrainPlug', g, [-120, LAYOUT.panBottom - 6, 100]);
  const level = mesh(softCylinder(17, 46, 20, 3), M.blackOxide, 'OilLevelSensor', g, [150, LAYOUT.panBottom + 34, -140]);
  level.rotation.z = Math.PI / 2;

  // plyta przepywowa i smok pompy (widoczne po zdjeciu miski)
  const baffle = mesh(chamferBox(360, 5, 392, 30, 2), M.caseMachined, 'OilBafflePlate', g, [0, LAYOUT.panTop - 22, 0]);
  mesh(cylinder(26, 26, 40, 20), M.pumpAlu, 'OilPickup', g, [0, LAYOUT.panTop - 52, 0]);

  // pompa oleju o zmiennej wydajnosci na koncu walu (naped z walu)
  const pump = new THREE.Group();
  pump.name = 'OIL_PUMP';
  pump.position.set(0, -70, LAYOUT.oilPumpZ);
  g.add(pump);
  mesh(softCylinder(52, 34, 32, 4), M.pumpAlu, 'OilPump_Body', pump).rotation.x = Math.PI / 2;
  mesh(softCylinder(30, 30, 18, 3), M.caseMachined, 'OilPump_Cover', pump, [0, 0, -26]).rotation.x = Math.PI / 2;
  const sprocket = mesh(gearGeometry(20, 26, 5, 14), M.darkSteel, 'OilPump_Sprocket', pump, [0, 0, 28]);
  sprocket.rotation.x = 0;
  mesh(cylinder(13, 13, 44, 16), M.steel, 'OilPump_RegulatorValve', pump, [0, -46, 0]).rotation.z = Math.PI / 2;

  // chlodniczka oleju: modul plytowy z woda (wymiennik)
  const cooler = new THREE.Group();
  cooler.name = 'OIL_COOLER';
  cooler.position.set(-152, 30, LAYOUT.oilPumpZ + 6);
  g.add(cooler);
  mesh(softCylinder(52, 108, 40, 3), M.pumpAlu, 'OilHeatExchanger', cooler).rotation.x = Math.PI / 2;
  for (let i = 0; i < 9; i++) {
    mesh(annulus(56, 46, 3.4, 40), M.caseMachined, `OilHeatExchanger_Plate_${i}`, cooler, [0, 0, -46 + i * 11]).rotation.y = Math.PI / 2;
  }
  mesh(tubeThrough([[0, 34, -50], [-20, 70, -80], [-30, 96, -120]], 12, 24, 10, false), M.hose, 'CoolantHose_OilCooler_1', cooler);
  mesh(tubeThrough([[0, -34, -50], [-10, -70, -86], [10, -96, -122]], 12, 24, 10, false), M.hose, 'CoolantHose_OilCooler_2', cooler);

  // obudowa filtra oleju
  const filt = new THREE.Group();
  filt.name = 'OIL_FILTER';
  filt.position.set(150, 40, LAYOUT.oilPumpZ + 6);
  g.add(filt);
  mesh(softCylinder(46, 96, 28, 4), M.pumpAlu, 'OilFilterHousing', filt).rotation.x = Math.PI / 2;
  mesh(softCylinder(50, 26, 28, 4), M.caseMachined, 'OilFilterCap', filt, [0, 0, 62]).rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(40, 40, 8, 6), M.darkSteel, 'OilFilterCap_Hex', filt, [0, 0, 80]).rotation.x = Math.PI / 2;
  const sw = mesh(softCylinder(15, 34, 18, 3), M.blackOxide, 'OilPressureSensor', filt, [-60, 34, 0]);
  sw.rotation.z = Math.PI / 2;

  return g;
}

// ---------------------------------------------------------------------------
// Termika: pompa wody z przelaczaniem, termostat sterowany mapa, rury.
// ---------------------------------------------------------------------------
function buildThermal(M) {
  const g = new THREE.Group();
  g.name = 'THERMAL_MANAGEMENT';

  const wp = new THREE.Group();
  wp.name = 'WATER_PUMP';
  wp.position.set(-84, 74, 214);
  g.add(wp);
  mesh(softCylinder(50, 54, 32, 4), M.pumpAlu, 'WaterPump_Body', wp).rotation.x = Math.PI / 2;
  mesh(softCylinder(28, 22, 24, 3), M.caseMachined, 'WaterPump_Snout', wp, [0, 0, 40]).rotation.x = Math.PI / 2;
  const pulley = mesh(softCylinder(62, 24, 40, 3), M.steel, 'WaterPump_Pulley', wp, [0, 0, 70]);
  pulley.rotation.x = Math.PI / 2;
  mesh(annulus(62, 56, 6, 40), M.darkSteel, 'WaterPump_Pulley_Groove', wp, [0, 0, 74]).rotation.y = Math.PI / 2;
  // przelaczanie (switchable pump)
  const sw = mesh(softCylinder(20, 40, 16, 3), M.blackOxide, 'WaterPump_Switch', wp, [0, -46, 10]);
  sw.rotation.z = Math.PI / 2;

  const th = new THREE.Group();
  th.name = 'THERMOSTAT';
  th.position.set(40, 96, 208);
  g.add(th);
  mesh(chamferBox(64, 44, 58, 10, 3), M.pumpAlu, 'ThermostatHousing', th);
  mesh(softCylinder(22, 40, 18, 3), M.blackOxide, 'Thermostat_Actuator', th, [0, 40, 0]);

  // rury plaszcza wodnego w poprzek silnika
  for (const y of [116, 146]) {
    mesh(
      tubeThrough([[-160, y, 196], [-40, y + 6, 150], [80, y + 4, 60], [170, y - 4, -60], [186, y - 10, -170]], 17, 60, 12, false),
      M.hose,
      `CoolantCrossoverPipe_${y}`,
      g
    );
  }
  // krocca powrotu wody do glowic
  for (const s of [1, -1]) {
    mesh(
      tubeThrough([[s * 60, 100, 206], [s * 120, 118, 140], [s * 150, 112, 40]], 13, 32, 10, false),
      M.hose,
      `CoolantHeadFeed_${s > 0 ? 'A' : 'B'}`,
      g
    );
  }
  return g;
}

// ---------------------------------------------------------------------------
// Mocowanie trzypunktowe (dwa na silniku, jedno na skrzyni biegow) i osprzet kadluba.
// ---------------------------------------------------------------------------
function buildMounts(M) {
  const g = new THREE.Group();
  g.name = 'ENGINE_MOUNTS';
  for (const s of [1, -1]) {
    const z = s * 152;
    const br = mesh(taperBox(96, 70, 62, 44, 12, 4), M.caseCastDark, `EngineMount_${s > 0 ? 'Front' : 'Rear'}`, g, [0, 128, z]);
    br.castShadow = true;
    const isolator = mesh(chamferBox(112, 34, 96, 16, 4), M.rubber, `EngineMount_Isolator_${s > 0 ? 'Front' : 'Rear'}`, g, [0, 170, z]);
    isolator.castShadow = true;
    mesh(cylinder(12, 12, 40, 6), M.darkSteel, `EngineMount_Stud_${s > 0 ? 'Front' : 'Rear'}`, g, [0, 196, z]);
    for (const dx of [-30, 30]) {
      const b = fastener(11, 40, 19, M.darkSteel, `EngineMountBolt_${s > 0 ? 'F' : 'R'}_${dx}`);
      b.position.set(dx, 118, z);
      b.rotation.x = -Math.PI / 2;
      g.add(b);
    }
  }
  return g;
}

export function buildBlockAssembly(M) {
  const root = new THREE.Group();
  root.name = 'BLOCK_ASSEMBLY';

  const halfA = buildHalfCase(M, 1);
  const halfB = buildHalfCase(M, -1);
  root.add(halfA, halfB);
  root.add(buildOilSystem(M));
  root.add(buildThermal(M));
  root.add(buildMounts(M));

  return { root, halfA, halfB, CASE_HALF_Y, BARREL_RO };
}
