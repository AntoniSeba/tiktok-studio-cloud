// rotary.js - the 13B sandwich: front side housing, rotor housing with the
// epitrochoidal bore, rear side housing with the stationary gear, the rotor
// with apex/side seals and its bolted ring gear, the eccentric shaft with both
// counterweights and journals, spark plugs, ports, through bolts.
//
// Units are millimetres, the shaft runs along +Z, the trochoid lives in XY.
// Everything that moves is driven by trochoid.js, nothing is keyframed.

import * as THREE from 'three';
import { chamferBox, softCylinder, cylinder, extrudeShape, mesh, fastener, cached } from '../lib/geom.js';
import * as T from '../lib/trochoid.js';

const FE = T.ECC;            // 15
const BORE_W = 80.2;         // rotor housing thickness / chamber width
const ROTOR_W = 79.6;        // rotor width, side clearance modelled
const Z_BORE0 = 60.0;        // rear face of the rotor housing
const Z_BORE1 = Z_BORE0 + BORE_W;
const Z_FRONT1 = 195;        // front face of the front side housing
const Z_REAR0 = 10;          // rear face of the rear side housing

// ---------------------------------------------------------------- helpers
function trochoidShape(offset = 0, samples = 260) {
  const sh = new THREE.Shape();
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    const p = T.housingPoint(t);
    const n = p.clone().normalize();
    const q = p.clone().add(n.multiplyScalar(offset));
    if (i === 0) sh.moveTo(q.x, q.y);
    else sh.lineTo(q.x, q.y);
  }
  sh.closePath();
  return sh;
}

function outlineShape(points) {
  const sh = new THREE.Shape();
  points.forEach((p, i) => (i ? sh.lineTo(p.x, p.y) : sh.moveTo(p.x, p.y)));
  sh.closePath();
  return sh;
}

function ringShape(points, insetSteps) {
  // outline scaled radially toward the rotor centre, used for the side seals
  return points.map((p) => p.clone().multiplyScalar(insetSteps));
}

// involute-ish internal ring gear: teeth point inward
function internalGearShape(teeth, rPitch, module, depth) {
  const rTip = rPitch - depth;
  const rRoot = rPitch + depth * 0.9;
  const sh = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  const halfTooth = step * 0.27;
  let first = true;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [
      [rRoot, a - step * 0.5 + halfTooth * 0.2],
      [rRoot, a - halfTooth],
      [rTip, a - halfTooth * 0.45],
      [rTip, a + halfTooth * 0.45],
      [rRoot, a + halfTooth],
      [rRoot, a + step * 0.5 - halfTooth * 0.2],
    ];
    for (const [r, ang] of pts) {
      const x = r * Math.cos(ang);
      const y = r * Math.sin(ang);
      if (first) {
        sh.moveTo(x, y);
        first = false;
      } else sh.lineTo(x, y);
    }
    void module;
  }
  sh.closePath();
  return sh;
}

function externalGearShape(teeth, rPitch, depth) {
  const rTip = rPitch + depth;
  const rRoot = rPitch - depth * 1.15;
  const sh = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  const halfTooth = step * 0.26;
  let first = true;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [
      [rRoot, a - step * 0.5 + halfTooth * 0.2],
      [rRoot, a - halfTooth],
      [rTip, a - halfTooth * 0.5],
      [rTip, a + halfTooth * 0.5],
      [rRoot, a + halfTooth],
      [rRoot, a + step * 0.5 - halfTooth * 0.2],
    ];
    for (const [r, ang] of pts) {
      const x = r * Math.cos(ang);
      const y = r * Math.sin(ang);
      if (first) {
        sh.moveTo(x, y);
        first = false;
      } else sh.lineTo(x, y);
    }
  }
  sh.closePath();
  return sh;
}

// ---------------------------------------------------------------- prism
// A chamber volume as a fast updatable prism: two caps plus a side band, buffers
// allocated once and rewritten in place as the crank turns.
function makePrism(z0, z1, material, name, parent) {
  const geo = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(new Float32Array(0), 3);
  geo.setAttribute('position', pos);
  const m = new THREE.Mesh(geo, material);
  m.name = name;
  m.castShadow = false;
  parent.add(m);
  return {
    mesh: m,
    z0,
    z1,
    set(raw) {
      // Clean the contour first: the wall arc and the rotor flank share both
      // endpoints, so the closing point duplicates the first one and ear
      // clipping silently produced overlapping triangles (measured area 56%
      // above the true chamber area).
      const poly = [];
      for (const p of raw) {
        const last = poly[poly.length - 1];
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.6) continue;
        poly.push(p);
      }
      while (poly.length > 2 && Math.hypot(poly[0].x - poly[poly.length - 1].x, poly[0].y - poly[poly.length - 1].y) < 0.6) poly.pop();
      const n = poly.length;
      // ear clipping is safe now that the contour is a clean two-arc lens with
      // the apex cap spikes removed (measured area now matches exactly)
      const tri = THREE.ShapeUtils.triangulateShape(poly.map((p) => p.clone()), []);
      const tris = tri.map((f) => [poly[f[0]], poly[f[1]], poly[f[2]]]);
      const verts = new Float32Array(tris.length * 6 * 3 + n * 6 * 3);
      let o = 0;
      const push = (x, y, z) => {
        verts[o++] = x;
        verts[o++] = y;
        verts[o++] = z;
      };
      for (const f of tris) {
        push(f[0].x, f[0].y, z1); push(f[1].x, f[1].y, z1); push(f[2].x, f[2].y, z1);
      }
      for (const f of tris) {
        push(f[0].x, f[0].y, z0); push(f[2].x, f[2].y, z0); push(f[1].x, f[1].y, z0);
      }
      for (let i = 0; i < n; i++) {
        const p = poly[i];
        const q = poly[(i + 1) % n];
        push(p.x, p.y, z0); push(q.x, q.y, z0); push(q.x, q.y, z1);
        push(p.x, p.y, z0); push(q.x, q.y, z1); push(p.x, p.y, z1);
      }
      const attr = m.geometry.getAttribute('position');
      if (attr.array.length !== verts.length) {
        m.geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      } else {
        attr.array.set(verts);
        attr.needsUpdate = true;
      }
      m.geometry.computeBoundingSphere();
    },
  };
}

// ---------------------------------------------------------------- build
export function buildRotary(M) {
  const root = new THREE.Group();
  root.name = 'ROTARY_13B';

  // ===================================================== rear side housing
  const rearHousing = new THREE.Group();
  rearHousing.name = 'SIDE_HOUSING_REAR';
  rearHousing.position.z = 0;
  root.add(rearHousing);

  const boreT = trochoidShape(0);

  const plateGeo = cached('sidePlateRear', () => {
    const sh = trochoidShape(31);
    sh.holes.push(new THREE.Path(boreT.getPoints(240)));
    return new THREE.ExtrudeGeometry(sh, { depth: 50, bevelEnabled: true, bevelSize: 2, bevelThickness: 1.5, bevelSegments: 2, curveSegments: 6 });
  });
  mesh(plateGeo, M.aluCast, 'RearHousing_Plate', rearHousing, [0, 0, Z_REAR0]);
  // ground steel side plate the rotor's side seals run on
  const sidePlateGeo = cached('sidePlateSteelRear', () => {
    const sh = trochoidShape(0.4);
    sh.holes.push(new THREE.Path(trochoidShape(-14).getPoints(200)));
    return new THREE.ExtrudeGeometry(sh, { depth: 6, bevelEnabled: false, curveSegments: 6 });
  });
  mesh(sidePlateGeo, M.sidePlate, 'RearHousing_SteelFace', rearHousing, [0, 0, Z_BORE0 - 6]);
  // stationary gear: 34 teeth pinion pressed into the side housing
  const pinionGeo = cached('pinion34', () => {
    const sh = externalGearShape(34, 30, 1.4);
    sh.holes.push(new THREE.Path().absarc(0, 0, 11, 0, Math.PI * 2, true));
    return new THREE.ExtrudeGeometry(sh, { depth: 14, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 1, curveSegments: 4 });
  });
  mesh(pinionGeo, M.gear, 'Stationary_Gear_34T', rearHousing, [0, 0, Z_BORE0]);
  // its retaining bolts
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const b = fastener(7, 26, 11, M.blackOxide, `StationaryGear_Bolt_${i + 1}`);
    b.position.set(Math.cos(a) * 38, Math.sin(a) * 38, Z_BORE0 - 4);
    b.rotation.x = Math.PI / 2;
    rearHousing.add(b);
  }
  // rear main bearing bore
  mesh(cylinder(24, 24, 18, 40), M.shaftHard, 'RearHousing_BearingBore', rearHousing, [0, 0, Z_REAR0 + 9]);
  // intake: side port window in the steel face plus an external manifold flange
  const intakeShape = new THREE.Shape();
  intakeShape.moveTo(-34, 22);
  intakeShape.quadraticCurveTo(0, 46, 42, 20);
  intakeShape.quadraticCurveTo(4, -8, -34, 22);
  mesh(
    new THREE.ShapeGeometry(intakeShape),
    M.gasket,
    'RearHousing_IntakePort',
    rearHousing,
    [0, 0, Z_BORE0 - 6.1]
  );
  const rhManifold = chamferBox(78, 62, 26, 8, 3);
  mesh(rhManifold, M.aluMachined, 'RearHousing_IntakeFlange', rearHousing, [0, 34, Z_REAR0 - 12]);
  mesh(cylinder(30, 34, 26, 28), M.aluMachined, 'RearHousing_IntakeRunner', rearHousing, [0, 44, Z_REAR0 - 26]);

  // ===================================================== rotor housing
  const rotorHousing = new THREE.Group();
  rotorHousing.name = 'ROTOR_HOUSING';
  root.add(rotorHousing);
  const rhGeo = cached('rotorHousing', () => {
    const sh = trochoidShape(31);
    sh.holes.push(new THREE.Path(trochoidShape(0).getPoints(240)));
    return new THREE.ExtrudeGeometry(sh, { depth: BORE_W, bevelEnabled: true, bevelSize: 2, bevelThickness: 1.6, bevelSegments: 2, curveSegments: 6 });
  });
  mesh(rhGeo, M.aluCast, 'RotorHousing_Casting', rotorHousing, [0, 0, Z_BORE0]);
  // the hard chromed trochoid surface itself
  const boreGeo = cached('rotorBore', () => {
    const sh = trochoidShape(0);
    sh.holes.push(new THREE.Path(trochoidShape(-3.5).getPoints(200)));
    return new THREE.ExtrudeGeometry(sh, { depth: BORE_W - 1, bevelEnabled: false, curveSegments: 3 });
  });
  mesh(boreGeo, M.chrome, 'RotorBore_Chrome', rotorHousing, [0, 0, Z_BORE0 + 0.5]);
  // water jacket bosses and the spark plug bosses
  // water jacket bosses: flat pads on the outer wall, not fat drums
  for (const a of [Math.PI * 0.5, Math.PI * 1.5]) {
    const p = T.housingPoint(a);
    const n = p.clone().normalize();
    const boss = mesh(chamferBox(44, 30, BORE_W + 6, 8, 3), M.aluCast, `RotorHousing_WaterBoss_${a > 3 ? 2 : 1}`, rotorHousing, [
      p.x + n.x * 8,
      p.y + n.y * 8,
      Z_BORE0 + BORE_W / 2,
    ]);
    boss.rotation.z = a - Math.PI / 2;
    const nipple = mesh(cylinder(9, 11, 22, 18), M.aluMachined, `RotorHousing_WaterNipple_${a > 3 ? 2 : 1}`, rotorHousing, [
      p.x + n.x * 30,
      p.y + n.y * 30,
      Z_BORE0 + BORE_W / 2,
    ]);
    nipple.rotation.z = a - Math.PI / 2;
  }
  // two spark plugs, leading and trailing, set into the top of the wall
  for (const [idx, xOff] of [[0, -30], [1, 18]]) {
    const ang = Math.atan2(xOff, 112);
    const px = Math.sin(ang) * 112;
    const py = Math.cos(ang) * 112;
    const boss = chamferBox(34, 34, BORE_W + 10, 8, 3);
    mesh(boss, M.aluMachined, `SparkPlug_Boss_${idx + 1}`, rotorHousing, [px, py, Z_BORE0 + BORE_W / 2]);
    const plug = new THREE.Group();
    plug.name = `SPARK_PLUG_${idx + 1}`;
    plug.position.set(px, py, Z_BORE0 + BORE_W / 2);
    plug.rotation.z = -ang;
    rotorHousing.add(plug);
    // shell, hex, insulator, terminal: a real plug in section
    mesh(softCylinder(9.5, 22, 28, 1.5), M.shaftHard, `SparkPlug_Shell_${idx + 1}`, plug, [0, -12, 0]);
    mesh(softCylinder(13, 12, 6, 13, 0.6), M.blackOxide, `SparkPlug_Hex_${idx + 1}`, plug, [0, 12, 0]);
    mesh(softCylinder(8.2, 30, 24, 1), M.ceramic, `SparkPlug_Insulator_${idx + 1}`, plug, [0, 33, 0]);
    mesh(softCylinder(9.4, 5, 20, 0.6), M.ceramic, `SparkPlug_Rib_${idx + 1}`, plug, [0, 40, 0]);
    mesh(softCylinder(4.2, 9, 16, 0.6), M.brass, `SparkPlug_Terminal_${idx + 1}`, plug, [0, 52, 0]);
    // electrode tip reaching into the bore
    mesh(softCylinder(3.2, 12, 12, 0.4), M.shaftHard, `SparkPlug_Tip_${idx + 1}`, plug, [0, -28, 0]);
  }
  // peripheral exhaust port: dark opening in the bore plus a cast stub
  {
    const a = Math.PI * 1.32;
    const p = T.housingPoint(a);
    const n = p.clone().normalize();
    const portShape = new THREE.Shape();
    portShape.moveTo(-40, -16);
    portShape.lineTo(40, -20);
    portShape.lineTo(44, 16);
    portShape.lineTo(-40, 20);
    const port = mesh(new THREE.ShapeGeometry(portShape), M.gasket, 'Exhaust_Port', rotorHousing, [
      p.x - n.x * 1.5,
      p.y - n.y * 1.5,
      Z_BORE0 + BORE_W / 2,
    ]);
    port.rotation.z = a - Math.PI / 2;
    const stub = new THREE.Group();
    stub.name = 'EXHAUST_STUB';
    stub.position.set(p.x + n.x * 10, p.y + n.y * 10, Z_BORE0 + BORE_W / 2);
    stub.rotation.z = a - Math.PI / 2;
    rotorHousing.add(stub);
    mesh(chamferBox(96, 40, 60, 10, 4), M.aluCastDark, 'ExhaustFlange_Cast', stub, [0, 10, 0]);
    mesh(cylinder(34, 38, 40, 28), M.aluCastDark, 'ExhaustFlange_Neck', stub, [0, 44, 0]);
  }

  // ===================================================== front side housing
  const frontHousing = new THREE.Group();
  frontHousing.name = 'SIDE_HOUSING_FRONT';
  root.add(frontHousing);
  const fhGeo = cached('frontHousing', () => {
    const sh = trochoidShape(31);
    sh.holes.push(new THREE.Path(trochoidShape(-16).getPoints(200)));
    return new THREE.ExtrudeGeometry(sh, { depth: Z_FRONT1 - Z_BORE1, bevelEnabled: true, bevelSize: 2, bevelThickness: 1.5, bevelSegments: 2, curveSegments: 6 });
  });
  mesh(fhGeo, M.aluCast, 'FrontHousing_Casting', frontHousing, [0, 0, Z_BORE1]);
  const frontSteelGeo = cached('frontSteel', () => {
    const sh = trochoidShape(0.4);
    sh.holes.push(new THREE.Path(trochoidShape(-14).getPoints(200)));
    return new THREE.ExtrudeGeometry(sh, { depth: 6, bevelEnabled: false, curveSegments: 6 });
  });
  mesh(frontSteelGeo, M.sidePlate, 'FrontHousing_SteelFace', frontHousing, [0, 0, Z_BORE1]);
  mesh(cylinder(24, 24, 22, 40), M.shaftHard, 'FrontHousing_BearingBore', frontHousing, [0, 0, Z_FRONT1 - 11]);
  mesh(softCylinder(30, 10, 40, 1.5), M.rubber, 'FrontHousing_OilSeal', frontHousing, [0, 0, Z_FRONT1 + 2]);

  // ===================================================== through bolts
  const bolts = new THREE.Group();
  bolts.name = 'TENSION_BOLTS';
  root.add(bolts);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
    const p = T.housingPoint(a);
    const n = p.clone().normalize();
    const x = p.x + n.x * 16;
    const y = p.y + n.y * 16;
    const bolt = new THREE.Group();
    bolt.name = `TensionBolt_${i + 1}`;
    bolt.position.set(x, y, 0);
    bolt.rotation.x = Math.PI / 2;
    bolts.add(bolt);
    const zc = (Z_REAR0 + Z_FRONT1) / 2;
    mesh(softCylinder(7.5, Z_FRONT1 - Z_REAR0 + 6, 18, 0.6), M.blackOxide, `TensionBolt_Shank_${i + 1}`, bolt, [0, zc, 0]);
    mesh(softCylinder(12, 8, 6, 12, 0.8), M.blackOxide, `TensionBolt_Washer_${i + 1}`, bolt, [0, Z_FRONT1 + 3, 0]);
    mesh(softCylinder(10, 16, 6, 14, 0.8), M.shaftHard, `TensionBolt_Nut_${i + 1}`, bolt, [0, Z_FRONT1 + 12, 0]);
  }

  // ===================================================== rotor
  const rotor = new THREE.Group();
  rotor.name = 'ROTOR';
  root.add(rotor);
  const rotorGeo = cached('rotorBody', () => {
    const sh = outlineShape(T.ROTOR_OUTLINE);
    sh.holes.push(new THREE.Path().absarc(0, 0, 58, 0, Math.PI * 2, true));
    return new THREE.ExtrudeGeometry(sh, { depth: ROTOR_W, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.8, bevelSegments: 1, curveSegments: 3 });
  });
  mesh(rotorGeo, M.rotorSteel, 'Rotor_Body', rotor, [0, 0, Z_BORE0 + (BORE_W - ROTOR_W) / 2]);
  // flank combustion recess, sitting just inside each flank face
  for (let k = 0; k < 3; k++) {
    const f = T.FLANKS[k];
    const a0 = f.start + f.span * 0.22;
    const a1 = f.start + f.span * 0.78;
    const pts = [];
    for (let i = 0; i <= 22; i++) {
      const t = a0 + ((a1 - a0) * i) / 22;
      pts.push(new THREE.Vector2(f.c.x + (f.r - 3.2) * Math.cos(t), f.c.y + (f.r - 3.2) * Math.sin(t)));
    }
    const sh = new THREE.Shape();
    pts.forEach((p, i) => (i ? sh.lineTo(p.x, p.y) : sh.moveTo(p.x, p.y)));
    sh.closePath();
    mesh(
      new THREE.ExtrudeGeometry(sh, { depth: ROTOR_W - 22, bevelEnabled: false, curveSegments: 3 }),
      M.rotorRecess,
      `Rotor_Recess_${k + 1}`,
      rotor,
      [0, 0, Z_BORE0 + (BORE_W - ROTOR_W) / 2 + 11]
    );
  }
  // bolted internal ring gear, 51 teeth
  const ringGearGeo = cached('ringGear51', () => {
    const sh = internalGearShape(51, 45, 1.77, 1.6);
    sh.holes.push(new THREE.Path().absarc(0, 0, 30.5, 0, Math.PI * 2, true));
    return new THREE.ExtrudeGeometry(sh, { depth: 16, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.25, bevelSegments: 1, curveSegments: 3 });
  });
  mesh(ringGearGeo, M.gear, 'Rotor_RingGear_51T', rotor, [0, 0, Z_BORE0 + 2]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const b = fastener(6, 22, 10, M.blackOxide, `RingGear_Bolt_${i + 1}`);
    b.position.set(Math.cos(a) * 52, Math.sin(a) * 52, Z_BORE0 + 18);
    b.rotation.x = -Math.PI / 2;
    rotor.add(b);
  }
  // rotor bearing on the eccentric journal
  mesh(cylinder(27, 27, 20, 40), M.shaftHard, 'Rotor_BearingOuter', rotor, [0, 0, Z_BORE0 + 30]);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const roller = mesh(cylinder(3.4, 3.4, 18, 10), M.seal, `Rotor_BearingRoller_${i + 1}`, rotor, [
      Math.cos(a) * 23.5,
      Math.sin(a) * 23.5,
      Z_BORE0 + 30,
    ]);
    roller.rotation.x = Math.PI / 2;
  }
  // apex seals with their springs
  const apexSeals = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const g = new THREE.Group();
    g.name = `APEX_SEAL_${k + 1}`;
    g.position.set((T.R - 3.4) * Math.cos(a), (T.R - 3.4) * Math.sin(a), Z_BORE0 + BORE_W / 2);
    g.rotation.z = a;
    rotor.add(g);
    apexSeals.push(g);
    mesh(chamferBox(3.6, 4.2, ROTOR_W + 0.5, 0.6, 0.5), M.seal, `ApexSeal_Bar_${k + 1}`, g, [0, 2.6, 0]);
    mesh(chamferBox(2.2, 2.4, ROTOR_W - 6, 0.4, 0.4), M.shaftHard, `ApexSeal_Spring_${k + 1}`, g, [0, -1.4, 0]);
  }
  // side seals: one ribbon per rotor face, following the outline
  const Z_ROTOR0 = Z_BORE0 + (BORE_W - ROTOR_W) / 2;
  for (const sign of [1, -1]) {
    // seal faces flush with the rotor's own face so they are visible
    const z = sign > 0 ? Z_ROTOR0 + ROTOR_W - 1.9 : Z_ROTOR0 - 0.3;
    const sh = outlineShape(ringShape(T.ROTOR_OUTLINE, 0.972));
    sh.holes.push(new THREE.Path(ringShape(T.ROTOR_OUTLINE, 0.948)));
    mesh(
      new THREE.ExtrudeGeometry(sh, { depth: 2.2, bevelEnabled: false, curveSegments: 3 }),
      M.seal,
      `SideSeal_${sign > 0 ? 'Front' : 'Rear'}`,
      rotor,
      [0, 0, z]
    );
    const or = new THREE.Mesh(new THREE.TorusGeometry(52, 2.6, 10, 64), M.rubber);
    or.name = `OilSeal_Ring_${sign > 0 ? 'Front' : 'Rear'}`;
    or.rotation.x = Math.PI / 2;
    or.position.set(0, 0, sign > 0 ? Z_ROTOR0 + ROTOR_W - 0.5 : Z_ROTOR0 + 0.5);
    rotor.add(or);
  }

  // ===================================================== eccentric shaft
  const eshaft = new THREE.Group();
  eshaft.name = 'ECCENTRIC_SHAFT';
  root.add(eshaft);
  const zm = Z_BORE0 + BORE_W / 2; // rotor mid plane
  // front main journal, counterweight, rear main journal, eccentric journal
  const journals = [
    ['EShaft_FrontJournal', 24, Z_FRONT1 + 6, Z_FRONT1 + 105, 0, 0],
    ['EShaft_RearJournal', 22, Z_REAR0 - 30, Z_REAR0 + 40, 0, 0],
  ];
  for (const [name, r, z0, z1, ox, oy] of journals) {
    const c = mesh(cylinder(r, r, z1 - z0, 44), M.shaft, name, eshaft, [ox, oy, (z0 + z1) / 2]);
    c.rotation.x = Math.PI / 2;
  }
  // eccentric journal: ground offset lobe the rotor bearing rides on
  const ecc = mesh(cylinder(21.6, 21.6, ROTOR_W - 6, 44), M.shaftHard, 'EShaft_EccentricJournal', eshaft, [0, 0, zm]);
  ecc.rotation.x = Math.PI / 2;
  // counterweights, opposite the eccentric
  const cwGeo = cached('counterweight', () => {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const a = -Math.PI * 0.62 + (Math.PI * 1.24 * i) / 60;
      pts.push(new THREE.Vector2(96 * Math.cos(a), 96 * Math.sin(a)));
    }
    for (let i = 60; i >= 0; i--) {
      const a = -Math.PI * 0.62 + (Math.PI * 1.24 * i) / 60;
      pts.push(new THREE.Vector2(30 * Math.cos(a), 30 * Math.sin(a)));
    }
    const sh = new THREE.Shape();
    pts.forEach((p, i) => (i ? sh.lineTo(p.x, p.y) : sh.moveTo(p.x, p.y)));
    sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: 34, bevelEnabled: true, bevelSize: 2, bevelThickness: 1.5, bevelSegments: 2, curveSegments: 4 });
  });
  for (const [idx, z] of [[0, Z_FRONT1 + 112], [1, Z_REAR0 - 46]]) {
    const g = new THREE.Group();
    g.name = `COUNTERWEIGHT_${idx + 1}`;
    eshaft.add(g);
    const cw = mesh(cwGeo, M.shaftHard, `Counterweight_${idx + 1}`, g, [0, 0, z]);
    cw.rotation.z = Math.PI; // heavy side away from the eccentric
    void cw;
  }
  // front pulley and rear flywheel so the shaft is not left bare
  const pulley = mesh(cylinder(58, 58, 26, 40), M.aluMachined, 'Front_Pulley', eshaft, [0, 0, Z_FRONT1 + 130]);
  pulley.rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const groove = mesh(cylinder(66, 66, 6, 40), M.aluCastDark, `Pulley_Groove_${i + 1}`, eshaft, [0, 0, Z_FRONT1 + 120 + i * 9]);
    groove.rotation.x = Math.PI / 2;
  }
  const flywheel = mesh(cylinder(140, 140, 24, 60), M.shaftHard, 'Flywheel', eshaft, [0, 0, Z_REAR0 - 76]);
  flywheel.rotation.x = Math.PI / 2;
  const ring = mesh(cylinder(150, 150, 12, 72), M.blackOxide, 'Flywheel_StarterRing', eshaft, [0, 0, Z_REAR0 - 72]);
  ring.rotation.x = Math.PI / 2;
  mesh(softCylinder(30, 40, 36, 2), M.rubber, 'Rear_MainSeal', eshaft, [0, 0, Z_REAR0 - 32]);

  // ===================================================== gas volumes
  const gasRoot = new THREE.Group();
  gasRoot.name = 'CHAMBER_GAS';
  root.add(gasRoot);
  // intake / compression / power / exhaust: distinct hues, because two
  // chambers sit in the same phase for much of the cycle and identical
  // colours made three separate volumes read as one.
  const phases = [0x2f7fe0, 0xf0c020, 0xff3d00, 0xb2564a];
  const gases = [];
  for (let k = 0; k < 3; k++) {
    const mat = new THREE.MeshStandardMaterial({
      color: phases[0],
      emissive: 0x000000,
      transparent: true,
      opacity: 0.5,
      metalness: 0.1,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const prism = makePrism(Z_BORE0 + 1.2, Z_BORE1 - 1.2, mat, `ChamberGas_${k + 1}`, gasRoot);
    gases.push(prism);
  }

  // ===================================================== update
  const _q = new THREE.Quaternion();
  const ZAXIS = new THREE.Vector3(0, 0, 1);
  const lastPoly = [[], [], []];

  function update(theta, opts = {}) {
    const pose = T.rotorPose(theta);
    // rotor: orbit the centre, spin at exactly one third of shaft speed
    rotor.position.set(pose.centre.x, pose.centre.y, 0);
    rotor.quaternion.setFromAxisAngle(ZAXIS, pose.spin);
    // eccentric shaft turns as one piece; its eccentric journal carries the rotor
    eshaft.quaternion.setFromAxisAngle(ZAXIS, theta);
    void _q;
    void pose;
    if (opts.gas !== false) {
      for (let k = 0; k < 3; k++) {
        const poly = (lastPoly[k] = T.chamberPolygon(theta, k, 44, 34));
        gases[k].set(poly);
        const ph = T.chamberPhase(theta, k);
        const mat = gases[k].mesh.material;
        mat.color.setHex(phases[ph.index]);
        const burn = ph.index === 2 ? Math.max(0, 1 - ph.t * 2.4) : 0;
        mat.emissive.setRGB(burn * 0.9, burn * 0.25, 0);
        mat.opacity = 0.4 + 0.3 * Math.max(burn, ph.index === 0 ? 0.2 : 0.6);
        if (ph.index === 2) mat.emissive.setRGB(0.55 + burn * 0.45, 0.12 + burn * 0.2, 0);
      }
    }
  }

  const groups = { frontHousing, rotorHousing, rearHousing, rotor, eshaft, bolts, gasRoot, gases, apexSeals };
  return { root, groups, update, info: { R: T.R, e: T.ECC, width: T.WIDTH, sweep: T.sweptVolume() } };
}
