// intake.js - uklad dolotowy 9A2: centralny kolektor nad silnikiem, szesc
// krotkich kanalow do krocow glowic, przepustnica z napedem elektrycznym,
// dwa zawory rezonansowe (zmienna geometria dolotu) i obudowa filtra powietrza.

import * as THREE from 'three';
import { chamferBox, taperBox, cylinder, softCylinder, tubeThrough, extrudeProfile, cached, mesh, fastener } from '../lib/geom.js';
import { annulus, cylinderX, plateAlongX, circlePoints } from '../lib/shapes.js';
import { LAYOUT, CYLINDERS } from '../lib/layout.js';

const DECK = LAYOUT.deckHeight;

export function buildIntake(M) {
  const root = new THREE.Group();
  root.name = 'INTAKE_SYSTEM';

  // ---- kolektor: skrzynia nad silnikiem, dluga na caly kadlub
  const plenum = new THREE.Group();
  plenum.name = 'INTAKE_PLENUM';
  root.add(plenum);
  const shell = mesh(chamferBox(300, 96, 470, 34, 5), M.intakePlastic, 'IntakePlenum_Shell', plenum, [0, 306, 0]);
  shell.castShadow = true;
  mesh(chamferBox(276, 40, 440, 26, 3), M.intakePlasticB, 'IntakePlenum_Cover', plenum, [0, 358, 0]);
  for (const z of [-180, -90, 0, 90, 180]) {
    mesh(chamferBox(20, 14, 300, 6, 3), M.intakePlasticB, `IntakePlenum_Rib_${z}`, plenum, [0, 356, z]);
  }
  // krocce podcisnienia i czujnik cisnienia
  mesh(cylinder(12, 12, 40, 14), M.intakePlasticB, 'IntakePlenum_VacuumPort', plenum, [-120, 356, 60]);
  mesh(softCylinder(16, 34, 16, 3), M.blackOxide, 'MapSensor', plenum, [80, 356, -40]);

  // ---- przepustnica na przodzie kolektora
  const tb = new THREE.Group();
  tb.name = 'THROTTLE_BODY';
  tb.position.set(0, 306, 254);
  root.add(tb);
  mesh(softCylinder(62, 44, 40, 4), M.pumpAlu, 'ThrottleBody_Body', tb).rotation.x = Math.PI / 2;
  mesh(annulus(62, 52, 10, 40), M.intakePlasticB, 'ThrottleBody_Flange', tb, [0, 0, 26]).rotation.y = Math.PI / 2;
  mesh(softCylinder(38, 46, 28, 3), M.blackOxide, 'ThrottleBody_Actuator', tb, [0, 66, -10]);
  mesh(tubeThrough([[0, -60, 20], [0, -110, 70], [0, -130, 150]], 32, 30, 14, false), M.intakePlastic, 'Intake_Duct_AirFilter', tb);

  // ---- szesc kanalow: po trzy na glowice, z krocow glowicy do kolektora
  for (const c of CYLINDERS) {
    const s = c.bankSign;
    const samples = [
      [s * (DECK + 74), 118, c.z],
      [s * 250, 160, c.z + s * 6],
      [s * 150, 236, c.z + s * 10],
      [s * 70, 296, c.z + s * 8],
      [s * 20, 306, c.z],
    ];
    const runner = mesh(tubeThrough(samples, 26, 34, 14, false, 0.42), M.intakePlastic, `Intake_Runner_Cyl${c.id}`, root);
    runner.castShadow = true;
    // flansz przy glowicy
    const flange = mesh(plateAlongX([[-56, -56], [56, -56], [56, 56], [-56, 56]], 10, DECK + 74, 6, [circlePoints(24, 0, 0, 24), circlePoints(24, 44, 0, 24), circlePoints(24, -44, 0, 24)]), M.caseMachined, `Intake_Flange_Cyl${c.id}`, root, [0, 118, c.z]);
    void flange;
    for (const dz of [-30, 30]) {
      const b = fastener(8, 32, 15, M.darkSteel, `IntakeBolt_Cyl${c.id}_${dz}`);
      b.position.set(s * (DECK + 84), 118 + dz, c.z);
      b.rotation.z = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      root.add(b);
    }
  }

  // ---- dwa zawory rezonansowe zmiennej geometrii dolotu
  for (const z of [-150, 150]) {
    const rv = new THREE.Group();
    rv.name = `ResonanceValve_${z > 0 ? 'Front' : 'Rear'}`;
    rv.position.set(0, 250, z);
    root.add(rv);
    mesh(softCylinder(30, 46, 24, 3), M.blackOxide, `ResonanceValve_Actuator_${z}`, rv);
    mesh(chamferBox(70, 16, 40, 10, 3), M.pumpAlu, `ResonanceValve_Linkage_${z}`, rv, [0, 6, 60]);
  }

  // ---- obudowa filtra powietrza z lewej strony
  const airbox = new THREE.Group();
  airbox.name = 'AIR_FILTER_BOX';
  airbox.position.set(-260, 150, -60);
  root.add(airbox);
  const box = mesh(taperBox(190, 150, 120, 260, 20, 5), M.intakePlastic, 'AirFilterBox', airbox);
  box.rotation.z = Math.PI / 2;
  box.castShadow = true;
  mesh(chamferBox(60, 20, 200, 20, 3), M.intakePlasticB, 'AirFilterBox_Lid', airbox, [-60, 0, 0]).rotation.z = Math.PI / 2;
  mesh(cylinder(40, 40, 60, 18), M.rubber, 'AirFilterBox_Outlet', airbox, [-30, 90, 0]);
  return { root, plenum };
}
