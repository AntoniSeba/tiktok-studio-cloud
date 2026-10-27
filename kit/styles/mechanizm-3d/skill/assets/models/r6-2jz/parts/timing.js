// timing.js - the front of the engine: crank sprocket, toothed timing belt,
// idler, hydraulic tensioner on its arm, the belt's back plate, the crank
// damper with its accessory grooves, and the two-piece timing cover (hidden by
// default so the belt reads). The cam sprocket itself lives on the exhaust
// camshaft in head.js and turns with it; the intake cam is driven from the
// exhaust cam by a gear pair inside the head, so only one sprocket sits on the
// belt.
//
// The belt runs in the Y-Z plane at x = L.camSprocketX. It is authored in 2D
// with u = world Z and v = world Y and then turned onto the engine's front.
// Everything here follows the crank angle; nothing is keyframed.
//
// Units: mm. Crank axis along X at (y = 0, z = 0).

import * as THREE from 'three';
import { beltPath, beltRibbon, gearGeometry, softCylinder, cylinder, chamferBox, mesh, fastener, cached } from '../lib/geom.js';
import * as E from '../lib/engine.js';

const L = E.L;
const RAD = Math.PI / 180;
const BELT_X = L.camSprocketX;
const BELT_W = 30;
const BELT_T = 5;
// pitch lines sit half a belt thickness outside the tooth tips
const PITCH = BELT_T / 2;
// crank sprocket 24 teeth: this is the belt's tooth pitch
const TOOTH_PITCH = (2 * Math.PI * L.crankSprocketR) / L.crankTeeth;
const TEX_TEETH = 44;

// Pulley centres in (u = z, v = y). Order is the belt's loop order, which
// beltPath needs: crank, idler (intake side), exhaust cam, tensioner.
export const PULLEYS = {
  crank: { u: 0, v: 0, r: L.crankSprocketR },
  idler: { u: 70, v: 170, r: 28 },
  cam: { u: L.exhaustZ, v: L.camY, r: L.camSprocketR },
  tensioner: { u: -84, v: 200, r: 28 },
};
const TENSIONER_PIVOT = { u: -52, v: 128 };

// turn a 2D (u, v, depth) authored object so u -> world Z, v -> world Y and the
// authoring +Z (depth) -> world -X
function faceFront(obj) {
  obj.rotation.y = -Math.PI / 2;
  return obj;
}

function outline(samples, grow) {
  // belt samples repeat the tangent points where a straight run meets an arc;
  // coincident outline points give zero-length edges and zero normals, so
  // they are dropped here
  const pts = [];
  for (const p of samples) {
    const v = new THREE.Vector2(p.p.x + p.rad.x * grow, p.p.y + p.rad.y * grow);
    if (!pts.length || v.distanceTo(pts[pts.length - 1]) > 1) pts.push(v);
  }
  if (pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) <= 1) pts.pop();
  return new THREE.Shape(pts);
}

export function buildTiming(M) {
  const root = new THREE.Group();
  root.name = 'TIMING_DRIVE';

  const loop = [PULLEYS.crank, PULLEYS.idler, PULLEYS.cam, PULLEYS.tensioner].map((p) => ({ x: p.u, y: p.v, r: p.r + PITCH }));
  const samples = beltPath(loop);

  // ================================================================== belt
  const beltGroup = new THREE.Group();
  beltGroup.name = 'TIMING_BELT';
  root.add(beltGroup);
  const uvScale = TEX_TEETH * TOOTH_PITCH;
  const beltGeo = beltRibbon(samples, BELT_W, BELT_T, -BELT_X, uvScale);
  const belt = faceFront(mesh(beltGeo, M.timingBelt, 'Timing_Belt', beltGroup));

  // ============================================================ back plate
  // stamped steel shield between the belt and the block, following the belt
  // loop 16 mm outside it
  const plateGroup = new THREE.Group();
  plateGroup.name = 'TIMING_BACKPLATE';
  root.add(plateGroup);
  const plateGeo = new THREE.ExtrudeGeometry(outline(samples, 18), { depth: 3, bevelEnabled: true, bevelSize: 1.5, bevelThickness: 1, bevelSegments: 2, curveSegments: 4 });
  faceFront(mesh(plateGeo, M.aluCast, 'Timing_BackPlate', plateGroup, [BELT_X + BELT_W / 2 + 8, 0, 0]));

  // ===================================================== crank sprocket drive
  const crankDrive = new THREE.Group();
  crankDrive.name = 'CRANK_FRONT';
  root.add(crankDrive);
  const cs = mesh(gearGeometry(L.crankTeeth, L.crankSprocketR - 3.5, 3.5, BELT_W - 4), M.steel, 'Crank_Sprocket', crankDrive, [BELT_X, 0, 0]);
  cs.rotation.y = Math.PI / 2;
  for (const s of [-1, 1]) {
    const fl = mesh(cached('crankGuide', () => cylinder(L.crankSprocketR + 7, L.crankSprocketR + 7, 1.6, 48)), M.journal, `Crank_SprocketGuide_${s > 0 ? 'Rear' : 'Front'}`, crankDrive, [BELT_X + s * (BELT_W / 2), 0, 0]);
    fl.rotation.z = Math.PI / 2;
  }
  const nose = mesh(cached('crankNose', () => cylinder(22, 22, 70, 32)), M.crankSteel, 'Crank_Nose', crankDrive, [BELT_X - 30, 0, 0]);
  nose.rotation.z = Math.PI / 2;

  // harmonic damper: hub, rubber ring, inertia ring with poly-V grooves
  const damper = new THREE.Group();
  damper.name = 'CRANK_DAMPER';
  damper.position.set(L.beltPulleyX - 26, 0, 0);
  crankDrive.add(damper);
  const hub = mesh(cached('damperHub', () => softCylinder(46, 38, 48, 2)), M.darkSteel, 'Damper_Hub', damper);
  hub.rotation.z = Math.PI / 2;
  const rub = mesh(cached('damperRubber', () => cylinder(66, 66, 30, 64)), M.rubber, 'Damper_Rubber', damper);
  rub.rotation.z = Math.PI / 2;
  const ring = mesh(cached('damperRing', () => softCylinder(84, 34, 72, 2.5)), M.steel, 'Damper_InertiaRing', damper);
  ring.rotation.z = Math.PI / 2;
  for (let k = 0; k < 6; k++) {
    const g = mesh(cached('damperGroove', () => new THREE.TorusGeometry(84.2, 1.4, 6, 72)), M.darkSteel, `Damper_Groove_${k + 1}`, damper, [-12.5 + k * 5, 0, 0]);
    g.rotation.y = Math.PI / 2;
  }
  // timing mark notch, so the crank angle reads on camera
  mesh(cached('damperMark', () => chamferBox(36, 5, 4, 1, 0.4)), M.accent, 'Damper_TimingMark', damper, [0, 84, 0]);
  const bolt = fastener(18, 60, 27, M.darkSteel, 'Damper_Bolt');
  bolt.position.set(-18, 0, 0);
  bolt.rotation.z = -Math.PI / 2;
  damper.add(bolt);

  // ===================================================== idler and tensioner
  function smoothPulley(name, p, parent) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(BELT_X, p.v, p.u);
    parent.add(g);
    const spin = new THREE.Group();
    g.add(spin);
    const face = mesh(cached(`pulleyFace|${p.r}`, () => softCylinder(p.r, BELT_W - 2, 48, 2)), M.steel, `${name}_Face`, spin);
    face.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) {
      const lip = mesh(cached(`pulleyLip|${p.r}`, () => cylinder(p.r + 5, p.r + 5, 2, 48)), M.steel, `${name}_Lip`, spin, [s * (BELT_W / 2 + 1), 0, 0]);
      lip.rotation.z = Math.PI / 2;
    }
    // spokes that make the spin visible
    for (let k = 0; k < 5; k++) {
      const sp = mesh(cached(`pulleySpoke|${p.r}`, () => chamferBox(3, p.r * 1.3, 7, 1.5, 0.6)), M.darkSteel, `${name}_Spoke_${k + 1}`, spin, [-BELT_W / 2 - 2, 0, 0]);
      sp.rotation.x = (k / 5) * Math.PI;
    }
    const cap = mesh(cached('pulleyCap', () => softCylinder(11, 8, 24, 1)), M.journal, `${name}_BearingCap`, g, [-BELT_W / 2 - 4, 0, 0]);
    cap.rotation.z = Math.PI / 2;
    const b = fastener(10, 50, 15, M.darkSteel, `${name}_Bolt`);
    b.position.set(-BELT_W / 2 - 8, 0, 0);
    b.rotation.z = -Math.PI / 2;
    g.add(b);
    return { group: g, spin };
  }

  const idler = smoothPulley('Idler', PULLEYS.idler, root);

  const tensionerGroup = new THREE.Group();
  tensionerGroup.name = 'TENSIONER';
  root.add(tensionerGroup);
  const tp = PULLEYS.tensioner;
  const tensioner = smoothPulley('Tensioner', tp, tensionerGroup);
  // arm from the pivot to the pulley, behind the belt plane
  const du = tp.u - TENSIONER_PIVOT.u;
  const dv = tp.v - TENSIONER_PIVOT.v;
  const armLen = Math.hypot(du, dv);
  const arm = mesh(cached('tensArm', () => chamferBox(8, armLen + 30, 34, 10, 2)), M.darkSteel, 'Tensioner_Arm', tensionerGroup, [BELT_X + BELT_W / 2 + 4, (tp.v + TENSIONER_PIVOT.v) / 2, (tp.u + TENSIONER_PIVOT.u) / 2]);
  arm.rotation.x = Math.atan2(du, dv);
  const piv = mesh(cached('tensPivot', () => softCylinder(13, 20, 24, 1.5)), M.journal, 'Tensioner_Pivot', tensionerGroup, [BELT_X + BELT_W / 2 - 2, TENSIONER_PIVOT.v, TENSIONER_PIVOT.u]);
  piv.rotation.z = Math.PI / 2;
  // hydraulic tensioner body pushing on the arm from below
  mesh(cached('tensBody', () => softCylinder(14, 74, 32, 2)), M.aluMachined, 'Tensioner_HydraulicBody', tensionerGroup, [BELT_X + BELT_W / 2 + 21, 90, -70]);
  mesh(cached('tensRod', () => cylinder(5, 5, 40, 16)), M.journal, 'Tensioner_Plunger', tensionerGroup, [BELT_X + BELT_W / 2 + 21, 146, -70]);

  // ============================================================ timing covers
  // upper and lower, split at the idler, shown only when a scene asks for them
  const covers = new THREE.Group();
  covers.name = 'TIMING_COVERS';
  covers.visible = false;
  root.add(covers);
  const coverShape = outline(samples, 26);
  const coverGeo = new THREE.ExtrudeGeometry(coverShape, { depth: BELT_W + 16, bevelEnabled: true, bevelSize: 5, bevelThickness: 5, bevelSegments: 3, curveSegments: 4 });
  faceFront(mesh(coverGeo, M.coverCast, 'TimingCover', covers, [BELT_X + BELT_W / 2 + 6, 0, 0]));

  // ================================================================== update
  const beltTex = M.timingBelt && M.timingBelt.map;
  function update(thetaDeg) {
    const a = thetaDeg * RAD;
    crankDrive.rotation.x = a;
    idler.spin.rotation.x = (a * L.crankSprocketR) / PULLEYS.idler.r;
    tensioner.spin.rotation.x = (a * L.crankSprocketR) / PULLEYS.tensioner.r;
    // belt travel, in texture repeats; the loop is authored against the
    // direction the crank turns, so the pattern runs back along u
    if (beltTex && beltTex.offset) {
      const travel = a * (L.crankSprocketR + PITCH);
      beltTex.offset.x = ((travel / uvScale) % 1 + 1) % 1;
    }
  }
  update(0);

  return {
    root,
    groups: { belt: beltGroup, plate: plateGroup, crankDrive, damper, tensioner: tensionerGroup, covers },
    pulleys: PULLEYS,
    beltLength: beltGeo.userData.beltLength,
    update,
  };
}
