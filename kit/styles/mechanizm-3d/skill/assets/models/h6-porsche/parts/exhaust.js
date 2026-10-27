// exhaust.js - uklad wydechowy 9A2: po trzy krotkie kanaly z kazdej glowicy,
// zbieracz 3-1, katalizator, filtr czastek stalych (GPF), czujniki lambda,
// oslony termiczne i wspolny tlumik siodlowy z dwoma wylotami i klapa.

import * as THREE from 'three';
import { chamferBox, taperBox, cylinder, softCylinder, tubeThrough, cached, mesh, fastener } from '../lib/geom.js';
import { annulus } from '../lib/shapes.js';
import { LAYOUT, CYLINDERS } from '../lib/layout.js';

const DECK = LAYOUT.deckHeight;

export function buildExhaust(M) {
  const root = new THREE.Group();
  root.name = 'EXHAUST_SYSTEM';

  for (const sign of [1, -1]) {
    const bank = sign > 0 ? 'A' : 'B';
    const g = new THREE.Group();
    g.name = `EXHAUST_BANK_${bank}`;
    root.add(g);

    // ---- trzy krotkie kanaly i zbieracz 3-1
    const cyLs = CYLINDERS.filter((c) => c.bankSign === sign);
    cyLs.forEach((c, i) => {
      const primary = mesh(
        tubeThrough(
          [
            [sign * (DECK + 70), -122, c.z],
            [sign * (DECK + 130), -168, c.z + sign * 14],
            [sign * 300, -230, c.z + sign * 30],
            [sign * 336, -288, -26 + i * 22 * sign],
          ],
          22,
          30,
          14,
          false,
          0.4
        ),
        M.exhaust,
        `Exhaust_Primary_Cyl${c.id}`,
        g
      );
      primary.castShadow = true;
      // kolnierz przy glowicy
      const fl = mesh(chamferBox(26, 82, 88, 12, 4), M.exhaustHot, `Exhaust_Flange_Cyl${c.id}`, g, [sign * (DECK + 78), -124, c.z]);
      fl.castShadow = true;
      for (const dz of [-30, 30]) {
        const b = fastener(9, 32, 16, M.darkSteel, `ExhaustStud_Cyl${c.id}_${dz}`);
        b.position.set(sign * (DECK + 88), -124 + dz, c.z);
        b.rotation.z = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(b);
      }
    });

    const collector = mesh(softCylinder(52, 110, 32, 4), M.exhaustHot, `Exhaust_Collector_${bank}`, g, [sign * 336, -300, -110]);
    collector.rotation.x = Math.PI / 2;
    collector.castShadow = true;
    mesh(annulus(58, 46, 14, 32), M.exhaust, `Exhaust_CollectorFlange_${bank}`, g, [sign * 336, -300, -166]).rotation.y = Math.PI / 2;

    // ---- katalizator z oslona i dwiema sondami lambda
    const cat = mesh(softCylinder(64, 210, 36, 4), M.exhaustHot, `Catalyst_${bank}`, g, [sign * 336, -300, -280]);
    cat.rotation.x = Math.PI / 2;
    cat.castShadow = true;
    const shield = mesh(taperBox(190, 150, 20, 230, 30, 3), M.shield, `Catalyst_HeatShield_${bank}`, g, [sign * 336, -228, -280]);
    shield.rotation.x = Math.PI / 2;
    shield.castShadow = true;
    for (const [i, z] of [-222, -338].entries()) {
      const s = mesh(softCylinder(15, 44, 16, 3), M.steel, `LambdaSensor_${bank}_${i + 1}`, g, [sign * 336, -238, z]);
      s.rotation.x = Math.PI / 2;
      mesh(cylinder(6, 6, 30, 10), M.brass, `LambdaSensor_Tip_${bank}_${i + 1}`, g, [sign * 336, -272, z]).rotation.x = Math.PI / 2;
    }

    // ---- filtr czastek stalych
    const gpf = mesh(softCylinder(58, 170, 36, 4), M.exhaustHot, `GPF_${bank}`, g, [sign * 336, -300, -452]);
    gpf.rotation.x = Math.PI / 2;
    gpf.castShadow = true;
    mesh(taperBox(160, 130, 18, 200, 26, 3), M.shield, `GPF_HeatShield_${bank}`, g, [sign * 336, -240, -452]).rotation.x = Math.PI / 2;

    // ---- rura do wspolnego tlumika
    const pipe = mesh(
      tubeThrough(
        [
          [sign * 336, -300, -540],
          [sign * 320, -326, -610],
          [sign * 210, -350, -668],
          [sign * 90, -352, -690],
        ],
        26,
        36,
        14,
        false,
        0.45
      ),
      M.exhaust,
      `Exhaust_Pipe_${bank}`,
      g
    );
    pipe.castShadow = true;
    mesh(annulus(30, 24, 12, 24), M.exhaust, `Exhaust_Clamp_${bank}`, g, [sign * 336, -300, -546]).rotation.y = Math.PI / 2;
  }

  // ---- wspolny tlumik siodlowy w ksztalcie siodla (opis Porsche) z klapa
  const muffler = new THREE.Group();
  muffler.name = 'MUFFLER';
  muffler.position.set(0, -352, -742);
  root.add(muffler);
  const body = mesh(taperBox(560, 480, 150, 300, 44, 5), M.exhaustHot, 'Muffler_Body', muffler);
  body.castShadow = true;
  for (const z of [-90, 0, 90]) {
    mesh(chamferBox(500, 16, 20, 24, 4), M.shield, `Muffler_Rib_${z}`, muffler, [0, 0, z]);
  }
  for (const s of [1, -1]) {
    const tail = mesh(tubeThrough([[s * 180, -10, -140], [s * 190, -20, -210], [s * 196, -30, -280]], 44, 24, 16, false), M.exhaust, `Tailpipe_${s > 0 ? 'Outer' : 'Inner'}`, muffler);
    tail.castShadow = true;
    mesh(annulus(46, 38, 14, 28), M.darkSteel, `Tailpipe_Trim_${s > 0 ? 'Outer' : 'Inner'}`, muffler, [s * 196, -30, -286]).rotation.y = Math.PI / 2;
  }
  const valve = mesh(softCylinder(22, 40, 18, 3), M.blackOxide, 'ExhaustValve_Actuator', muffler, [246, -20, 60]);
  valve.rotation.z = Math.PI / 2;
  void cached;
  return { root, muffler };
}
