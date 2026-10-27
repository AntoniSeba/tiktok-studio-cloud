// rotating.js - crankshaft, the six connecting rods, the six pistons with rings
// and pins, the flywheel and the rear flange. Everything that moves is driven
// by engine.js: the pin centre comes from the crank angle, the piston height
// comes from the slider-crank constraint and the rod's inclination follows from
// the two. Nothing here is keyframed.
//
// Units: mm. The crank axis runs along X at (y = 0, z = 0).

import * as THREE from 'three';
import { chamferBox, softCylinder, cylinder, ringSectorShape, extrudeAlongX, extrudeShape, gearShape, circlePath, mesh, fastener, cached } from '../lib/geom.js';
import * as E from '../lib/engine.js';

const L = E.L;
const RAD = Math.PI / 180;
const MAIN_X = E.MAIN_X;

// world point on the crank's YZ circle: angle measured from +Y towards +Z
const yz = (angleDeg, r) => [r * Math.cos(angleDeg * RAD), r * Math.sin(angleDeg * RAD)];

// annulus in the crank plane, extruded along the crank axis
function ring(rIn, rOut, len, seg = 48, name = 'ring') {
  const b = Math.min(0.8, (rOut - rIn) * 0.25);
  return cached(`${name}|${rIn}|${rOut}|${len}`, () => extrudeAlongX(ringSectorShape(rIn, rOut, 0, Math.PI * 2, seg), len, b));
}
// arc in the crank plane, centred on a world direction, extruded along X
function crankArc(rIn, rOut, spanDeg, len, seg = 40) {
  const half = (spanDeg / 2) * RAD;
  const c = Math.PI / 2;
  const b = Math.min(1.4, (rOut - rIn) * 0.25);
  return extrudeAlongX(ringSectorShape(rIn, rOut, c - half, c + half, seg), len, b);
}

export function buildRotating(M) {
  const root = new THREE.Group();
  root.name = 'ROTATING';

  // ============================================================== crankshaft
  const crank = new THREE.Group();
  crank.name = 'CRANKSHAFT';
  root.add(crank);

  // seven main journals and the webs between them
  MAIN_X.forEach((x, i) => {
    const j = mesh(cached('mainJ', () => cylinder(31, 31, 26, 48)), M.journal, `MainJournal_${i + 1}`, crank, [x, 0, 0]);
    j.rotation.z = Math.PI / 2;
  });
  // six rod journals, each at its own pin phase, plus the counterweights
  E.CYL_X.forEach((x, i) => {
    const off = E.pinOffsetDeg(i + 1);
    const [py, pz] = yz(off, E.CRANK_R);
    const pin = mesh(cached('rodJ', () => cylinder(26, 26, E.SPEC.rodJournalWidth, 44)), M.journal, `RodJournal_${i + 1}`, crank, [x, py, pz]);
    pin.rotation.z = Math.PI / 2;
    // oil hole in the journal
    const hole = mesh(cached('oilHole', () => softCylinder(3, 14, 10, 0.4)), M.bearing, `RodJournal_OilHole_${i + 1}`, crank, [x, py, pz]);
    void hole;

    const cw = mesh(crankArc(26, 78, 136, 20, 44), M.crankSteel, `Counterweight_${i + 1}`, crank, [x, 0, 0]);
    cw.rotation.x = (off + 180) * RAD;
    // web tying the journal to the counterweight
    const web = mesh(cached('web', () => chamferBox(20, 70, 30, 8, 3)), M.crankSteel, `CrankWeb_${i + 1}`, crank, [x, 0, 0]);
    web.rotation.x = (off + 180) * RAD;
    // and a lighter cover on the opposite cheek
    const cheek = mesh(crankArc(24, 62, 60, 20, 30), M.crankSteel, `CrankCheek_${i + 1}`, crank, [x, 0, 0]);
    cheek.rotation.x = off * RAD;
  });

  // front snout out to the sprocket, and the rear flange for the flywheel
  const snout = mesh(cached('snout', () => cylinder(30, 34, 46, 48)), M.crankSteel, 'Crank_FrontSnout', crank, [L.blockXFront - 23, 0, 0]);
  snout.rotation.z = Math.PI / 2;
  const keyway = mesh(cached('key', () => chamferBox(30, 8, 8, 1.5, 0.4)), M.journal, 'Crank_Keyway', crank, [L.blockXFront - 40, 0, 0]);
  void keyway;
  const flange = mesh(cached('flange', () => cylinder(58, 58, 26, 48)), M.crankSteel, 'Crank_RearFlange', crank, [L.blockXRear + 26, 0, 0]);
  flange.rotation.z = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const b = fastener(12, 46, 18, M.darkSteel, `Flywheel_Bolt_${i + 1}`);
    b.position.set(L.blockXRear + 40, Math.cos(a) * 40, Math.sin(a) * 40);
    b.rotation.z = Math.PI / 2;
    crank.add(b);
  }

  // =============================================================== flywheel
  const flywheel = new THREE.Group();
  flywheel.name = 'FLYWHEEL';
  root.add(flywheel);
  const fw = mesh(cached('flywheel', () => softCylinder(132, 22, 64, 3)), M.darkSteel, 'Flywheel_Disc', flywheel, [L.blockXRear + 60, 0, 0]);
  fw.rotation.z = Math.PI / 2;
  const ringGear = mesh(
    cached('starterRing', () => {
      const sh = gearShape(114, 139, 132, 7);
      sh.holes.push(circlePath(0, 0, 130.6, 64));
      const g = extrudeShape(sh, 20, 0.5);
      g.rotateY(Math.PI / 2);
      return g;
    }),
    M.darkSteel,
    'Flywheel_StarterRing',
    flywheel,
    [L.blockXRear + 44, 0, 0]
  );
  void ringGear;
  mesh(cached('clutchFace', () => ring(60, 128, 6, 64, 'clutchRing')), M.journal, 'Flywheel_FrictionFace', flywheel, [L.blockXRear + 74, 0, 0]);

  // ============================================================ rods/pistons
  const rods = [];
  const pistons = [];
  const rodRoot = new THREE.Group();
  rodRoot.name = 'ROD_PISTON_GROUPS';
  root.add(rodRoot);

  const bigEnd = cached('bigEnd', () => ring(26, 31.5, E.SPEC.rodJournalWidth, 40, 'bigEndRing'));
  const bigEndCap = cached('bigEndCap', () => crankArc(26, 31.5, 180, E.SPEC.rodJournalWidth, 30));
  const smallEnd = cached('smallEnd', () => ring(11, 16.5, 20, 32, 'smallEndRing'));

  for (let i = 0; i < E.CYL_X.length; i++) {
    const cyl = i + 1;
    const x = E.CYL_X[i];
    const rod = new THREE.Group();
    rod.name = `ROD_${cyl}`;
    rodRoot.add(rod);
    // rod geometry is authored with the big end at the origin, pointing +Y.
    // The shank is a real I-beam: a thin central web with two flanges on it.
    mesh(cached('rodWeb', () => chamferBox(6, 96, 20, 2.5, 1)), M.rodSteel, `Rod_Web_${cyl}`, rod, [0, 78, 0]);
    for (const s of [-1, 1]) {
      mesh(cached('rodFlange', () => chamferBox(21, 96, 5, 2, 0.8)), M.rodSteel, `Rod_Flange_${cyl}_${s > 0 ? 'A' : 'B'}`, rod, [0, 78, s * 8.5]);
    }
    mesh(bigEnd, M.rodSteel, `Rod_BigEnd_${cyl}`, rod, [0, 0, 0]);
    mesh(bigEndCap, M.rodSteel, `Rod_BigEndCap_${cyl}`, rod, [0, 0, 0]).rotation.x = Math.PI;
    for (const s of [-1, 1]) {
      const b = mesh(cached('rodBoltGeo', () => softCylinder(5.5, 44, 12, 0.8)), M.darkSteel, `Rod_Bolt_${cyl}_${s > 0 ? 'A' : 'B'}`, rod, [0, 22, s * 27]);
      void b;
    }
    mesh(smallEnd, M.rodSteel, `Rod_SmallEnd_${cyl}`, rod, [0, E.ROD_L, 0]);
    mesh(cached('rodBush', () => ring(8, 11.4, 22, 28, 'smallBush')), M.bearing, `Rod_SmallEndBush_${cyl}`, rod, [0, E.ROD_L, 0]);
    // big end bearing shells, one either side of the journal
    mesh(cached('rodShellUp', () => crankArc(23.5, 26.4, 166, 20, 26)), M.bearing, `Rod_ShellUpper_${cyl}`, rod, [0, 0, 0]);
    mesh(cached('rodShellDn', () => crankArc(23.5, 26.4, 166, 20, 26)), M.bearing, `Rod_ShellLower_${cyl}`, rod, [0, 0, 0]).rotation.x = Math.PI;
    rods.push(rod);

    // ---- piston, authored with the pin centre at the origin
    const piston = new THREE.Group();
    piston.name = `PISTON_${cyl}`;
    rodRoot.add(piston);
    const crownY = E.PISTON_CROWN_ABOVE_PIN; // 34.2 above the pin
    const profile = [
      [0, crownY - E.CHAMBER.dishDepth],
      [E.CHAMBER.dishDia / 2, crownY - E.CHAMBER.dishDepth],
      [E.CHAMBER.dishDia / 2 + 1.2, crownY - E.CHAMBER.dishDepth + 0.6],
      [E.CHAMBER.dishDia / 2 + 1.2, crownY],
      [L.boreR - 0.08, crownY],
      [L.boreR - 0.03, crownY - 1.6],
      [L.boreR - 0.03, -20],
      [L.boreR - 2.4, -22.4],
      [0, -22.4],
    ];
    const bodyGeo = cached(`pistonBody|${cyl}`, () =>
      new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.02, r), y)), 64)
    );
    mesh(bodyGeo, M.piston, `Piston_Body_${cyl}`, piston, [0, 0, 0]);
    // three ring grooves, filled with a ring each
    const grooveY = [crownY - 6.0, crownY - 10.5, crownY - 15.0];
    grooveY.forEach((gy, k) => {
      mesh(cached('pRing', () => ring(L.boreR - 2.6, L.boreR - 0.04, 2.6, 56, 'pistonRing')), M.ring, `Piston_Ring_${k + 1}_Cyl${cyl}`, piston, [0, gy, 0]);
    });
    // moly coated skirt band
    mesh(
      cached('skirtBand', () => cylinder(L.boreR - 0.06, L.boreR - 0.3, 20, 56, true)),
      M.pistonSkirt,
      `Piston_Skirt_${cyl}`,
      piston,
      [0, -12, 0]
    );
    // wrist pin and its two circlips
    const pin = mesh(cached('wristPin', () => cylinder(11, 11, 52, 32)), M.journal, `Piston_Pin_${cyl}`, piston, [0, 0, 0]);
    pin.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) {
      const clip = mesh(cached('circlip', () => new THREE.TorusGeometry(11, 1.2, 8, 24)), M.spring, `Piston_Circlip_${cyl}_${s > 0 ? 'A' : 'B'}`, piston, [s * 26, 0, 0]);
      clip.rotation.y = Math.PI / 2;
    }
    // pin bosses
    for (const s of [-1, 1]) {
      const boss = mesh(cached('pinBoss', () => ring(11.4, 19, 54, 28, 'pinBoss')), M.piston, `Piston_Boss_${cyl}_${s}`, piston, [s * 26, 0, 0]);
      void boss;
    }
    pistons.push(piston);
  }

  // ================================================================ update
  function update(thetaDeg) {
    crank.rotation.x = thetaDeg * RAD;
    flywheel.rotation.x = thetaDeg * RAD;
    for (let i = 0; i < E.CYL_X.length; i++) {
      const cyl = i + 1;
      const off = E.pinOffsetDeg(cyl);
      const [py, pz] = yz(thetaDeg + off, E.CRANK_R);
      const rod = rods[i];
      rod.position.set(E.CYL_X[i], py, pz);
      // the rod points from the crank pin at (py,pz) to the pin at (pinY,0)
      const pinY = E.pistonPinY(thetaDeg, cyl);
      rod.rotation.x = Math.atan2(-pz, pinY - py);
      pistons[i].position.set(E.CYL_X[i], pinY, 0);
    }
  }
  update(0);

  return { root, groups: { crank, flywheel, rods, pistons, rodRoot }, update };
}
