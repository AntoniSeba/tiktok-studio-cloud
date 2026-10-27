// rotating.js - the parts that turn and the parts that are pushed: crankshaft
// (forged, twelve counterweights, three crankpin planes at 120 degrees),
// connecting rods, pistons, flywheel. Every position comes from kinematics.js
// at the crank angle you ask for, so there is not one keyframe here.

import * as THREE from 'three';
import * as K from '../kinematics.js';
import { alongX, mesh, RAD } from './profile.js';
import { cached } from '../lib/geom.js';
import { MAIN_X } from './static.js';
import { sprocketShape } from './profile.js';

const R_MAIN = K.S54.crankJournals.main / 2; // 30
const R_ROD = K.S54.crankJournals.rod / 2; // 22.5
const PIN_W = 24;
const WEB_T = 18;
const WEB_X = 22; // web centre offset from the crankpin centre
const CW_R = 84;

function cylX(r, len, seg = 32, r2 = null) {
  const g = new THREE.CylinderGeometry(r2 === null ? r : r2, r, len, seg);
  g.rotateZ(Math.PI / 2);
  return g;
}

// one crank web: a crescent counterweight opposite the pin, plus the arm that
// carries the crankpin. Authored with the pin on +y, then rotated into phase.
// A cleaner outline: counterweight arc, then a chord in to a hub radius, then
// the rectangular arm out to the crankpin, mirrored on the other side.
function webShape() {
  const arc = [];
  for (let a = 197; a <= 343; a += 4) arc.push(a);
  const pts = [];
  const P = (r, deg) => [Math.sin(RAD(deg)) * r, Math.cos(RAD(deg)) * r]; // [z, y]
  for (const a of arc) pts.push(P(CW_R, a));
  pts.push(P(38, 343));
  pts.push([-30, 6]);
  pts.push([-30, K.CRANK_R]);
  pts.push([30, K.CRANK_R]);
  pts.push([30, 6]);
  pts.push(P(38, 197));
  return pts;
}

/** The crankshaft group. Rotate it by rotation.x = crank angle (radians). */
export function buildCrank(M) {
  const g = new THREE.Group();
  g.name = 'CRANKSHAFT';

  // main journals on the engine axis
  MAIN_X.forEach((x, i) => {
    mesh(cylX(R_MAIN, 26), M.journal, `MainJournal_${i + 1}`, g, [x, 0, 0]);
  });
  // main journal fillets read as a forged crank rather than a stack of tubes
  for (let i = 0; i < MAIN_X.length; i++) {
    for (const s of [-1, 1]) {
      mesh(cylX(R_MAIN + 5, 5, 24, R_MAIN), M.crankSteel, `MainFillet_${i + 1}_${s}`, g, [
        MAIN_X[i] + s * 15.5,
        0,
        0,
      ]);
    }
  }

  const ws = webShape();
  for (let i = 0; i < K.S54.nCyl; i++) {
    const x = K.CYL_X[i];
    const alpha = -RAD(K.PIN_PHASE[i]);
    const y = K.CRANK_R * Math.cos(alpha);
    const z = K.CRANK_R * Math.sin(alpha);
    mesh(cylX(R_ROD, PIN_W, 28), M.journal, `Crankpin_${i + 1}`, g, [x, y, z]);
    for (const s of [-1, 1]) {
      const holder = new THREE.Group();
      holder.name = `Web_${i + 1}_${s}`;
      holder.position.set(x + s * WEB_X, 0, 0);
      holder.rotation.x = alpha;
      g.add(holder);
      const w = mesh(alongX(ws, WEB_T), M.crankSteel, `WebBody_${i + 1}_${s}`, holder);
      void w;
    }
  }

  // front of the crank: nose, oil pump drive, sprocket (19 teeth, chain drive)
  mesh(cylX(24, 60, 24), M.crankSteel, 'CrankNose', g, [-K.HALF_LENGTH - 4, 0, 0]);
  const spk = sprocketShape(K.CHAIN.crankTeeth, R_MAIN + 3, R_MAIN - 2, 12);
  mesh(spk, M.chainSteel, 'CrankSprocket', g, [-K.HALF_LENGTH - 22, 0, 0]);
  // torsional damper / accessory pulley
  const damper = cached('damper', () => {
    const pts = [
      new THREE.Vector2(0, -18),
      new THREE.Vector2(60, -18),
      new THREE.Vector2(78, -14),
      new THREE.Vector2(78, 14),
      new THREE.Vector2(60, 18),
      new THREE.Vector2(0, 18),
    ];
    const geo = new THREE.LatheGeometry(pts, 48);
    geo.rotateZ(Math.PI / 2);
    return geo;
  });
  mesh(damper, M.blackOxide, 'VibrationDamper', g, [-K.HALF_LENGTH - 62, 0, 0]);

  // rear: crank flange, flywheel, starter ring gear
  mesh(cylX(52, 26, 32), M.crankSteel, 'CrankFlange', g, [K.HALF_LENGTH + 10, 0, 0]);
  const fw = cached('flywheel', () => {
    const geo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(125, 0),
        new THREE.Vector2(125, 16),
        new THREE.Vector2(0, 16),
      ],
      64
    );
    geo.rotateZ(Math.PI / 2);
    return geo;
  });
  mesh(fw, M.steelBright, 'Flywheel', g, [K.HALF_LENGTH + 34, 0, 0]);
  const ring = sprocketShape(116, 152, 145, 12);
  mesh(ring, M.chainSteel, 'StarterRingGear', g, [K.HALF_LENGTH + 26, 0, 0]);
  // six flywheel bolts
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mesh(cylX(7, 10, 12), M.blackOxide, `FlywheelBolt_${i + 1}`, g, [
      K.HALF_LENGTH + 22,
      Math.cos(a) * 70,
      Math.sin(a) * 70,
    ]);
  }
  return g;
}

// ---------------------------------------------------------------------------
/** A forged I-beam rod, big end at the local origin, small end at +y. */
export function rodGeometry(M) {
  const key = 'rodParts';
  return cached(key, () => {
    const parts = [];
    // big end eye, axis along the crank axis (x)
    const big = new THREE.LatheGeometry(
      [
        new THREE.Vector2(R_ROD, -13),
        new THREE.Vector2(34, -13),
        new THREE.Vector2(34, 13),
        new THREE.Vector2(R_ROD, 13),
      ],
      36
    );
    big.rotateZ(Math.PI / 2);
    parts.push(big);
    // small end eye
    const small = new THREE.LatheGeometry(
      [
        new THREE.Vector2(11, -10),
        new THREE.Vector2(26, -10),
        new THREE.Vector2(26, 10),
        new THREE.Vector2(11, 10),
      ],
      28
    );
    small.rotateZ(Math.PI / 2);
    small.translate(0, K.S54.rodLength, 0);
    parts.push(small);
    return parts;
  });
}

export function buildRods(M) {
  const out = [];
  for (let i = 0; i < K.S54.nCyl; i++) {
    const g = new THREE.Group();
    g.name = `ROD_${i + 1}`;
    const [big, small] = rodGeometry(M);
    mesh(big, M.rodForged, `RodBigEnd_${i + 1}`, g);
    mesh(small, M.rodForged, `RodSmallEnd_${i + 1}`, g);
    // I-beam shank: two flanges and a central web, exactly the forging shape
    const y0 = 26;
    const y1 = K.S54.rodLength - 22;
    const h = y1 - y0;
    const shank = cached('rodShank', () => alongX([[-13, 0], [13, 0], [13, h], [-13, h]], 5));
    for (const s of [-1, 1]) {
      mesh(shank, M.rodForged, `RodFlange_${i + 1}_${s}`, g, [s * 8.5, y0, 0]);
    }
    const web = cached('rodWeb', () => alongX([[-4.5, 0], [4.5, 0], [4.5, h], [-4.5, h]], 3));
    mesh(web, M.rodForged, `RodWeb_${i + 1}`, g, [0, y0, 0]);
    // big end cap: the half of the eye the rod bolts pull against
    const cap = cached('rodCap', () => {
      const geo = new THREE.LatheGeometry(
        [
          new THREE.Vector2(R_ROD, -13),
          new THREE.Vector2(34, -13),
          new THREE.Vector2(34, 13),
          new THREE.Vector2(R_ROD, 13),
        ],
        24,
        Math.PI,
        Math.PI
      );
      geo.rotateZ(Math.PI / 2);
      return geo;
    });
    mesh(cap, M.rodForged, `RodCap_${i + 1}`, g);
    for (const s of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(5, 5, 44, 12), M.blackOxide, `RodBolt_${i + 1}_${s}`, g, [
        0,
        0,
        s * 30,
      ]);
      mesh(new THREE.CylinderGeometry(8, 8, 8, 6), M.blackOxide, `RodNut_${i + 1}_${s}`, g, [
        0,
        -24,
        s * 30,
      ]);
    }
    out.push(g);
  }
  return out;
}

// ---------------------------------------------------------------------------
/** A forged high compression piston, pin axis at the local origin. */
export function buildPistons(M) {
  const out = [];
  const PH = K.S54.compressionHeight;
  const skirt = cached('pistonBody', () => {
    const pts = [
      new THREE.Vector2(0, -34),
      new THREE.Vector2(K.BORE_R - 6.5, -34),
      new THREE.Vector2(K.BORE_R - 0.6, -30),
      new THREE.Vector2(K.BORE_R - 0.4, -2),
      new THREE.Vector2(K.BORE_R - 0.4, PH - 6),
      new THREE.Vector2(K.BORE_R - 2.0, PH - 1.5),
      new THREE.Vector2(K.BORE_R - 6.0, PH),
      new THREE.Vector2(0, PH),
    ];
    return new THREE.LatheGeometry(pts, 48);
  });
  const ringGeo = cached('pistonRing', () => {
    const g = new THREE.TorusGeometry(K.BORE_R - 1.4, 1.5, 8, 48);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const pinGeo = cached('wristPin', () => {
    const g = new THREE.CylinderGeometry(11, 11, 52, 24);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  for (let i = 0; i < K.S54.nCyl; i++) {
    const g = new THREE.Group();
    g.name = `PISTON_${i + 1}`;
    mesh(skirt, M.pistonAlu, `PistonBody_${i + 1}`, g);
    // crown is a separate, slightly darker face, as on a coated piston
    const crown = cached('pistonCrown', () => {
      const geo = new THREE.CylinderGeometry(K.BORE_R - 0.4, K.BORE_R - 0.4, 2.4, 48);
      return geo;
    });
    mesh(crown, M.pistonCrown, `PistonCrown_${i + 1}`, g, [0, PH - 1.2, 0]);
    // valve relief pockets: a real S54 piston is a flat-top with four eyebrows
    for (const [dx, dz] of [
      [-16.5, 12.5],
      [16.5, 12.5],
      [-16.5, -12.5],
      [16.5, -12.5],
    ]) {
      const pocket = cached('pocket', () => new THREE.CylinderGeometry(8, 8, 3.2, 20));
      mesh(pocket, M.pistonCrown, `PistonRelief_${i + 1}_${dx}_${dz}`, g, [dx, PH - 0.6, dz]);
    }
    for (let r = 0; r < 3; r++) {
      mesh(ringGeo, M.ringSteel, `PistonRing_${i + 1}_${r + 1}`, g, [0, PH - 8 - r * 6, 0]);
    }
    mesh(pinGeo, M.steelBright, `WristPin_${i + 1}`, g, [0, 0, 0]);
    for (const s of [-1, 1]) {
      const circ = cached('pinCirc', () => new THREE.TorusGeometry(11.6, 1.6, 8, 24));
      const c = mesh(circ, M.blackOxide, `PinClip_${i + 1}_${s}`, g, [s * 25, 0, 0]);
      c.rotation.y = Math.PI / 2;
    }
    out.push(g);
  }
  return out;
}

// ---------------------------------------------------------------------------
/** Drive everything that turns from one crank angle. */
export function updateRotating(parts, st) {
  parts.crank.rotation.x = RAD(st.crank);
  for (let i = 0; i < K.S54.nCyl; i++) {
    const cyl = st.cylinders[i];
    parts.rods[i].position.set(cyl.x, cyl.pin.y, cyl.pin.z);
    parts.rods[i].rotation.x = -cyl.rodTilt;
    parts.pistons[i].position.set(cyl.x, cyl.pinY, 0);
  }
}
