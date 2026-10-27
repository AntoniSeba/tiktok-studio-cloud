// head.js - the 24 valve cylinder head of the 2JZ-GTE: flat combustion chambers,
// twelve intake and twelve exhaust ports, valve guides, springs, retainers,
// buckets, the two camshafts with twelve lobes each, spark plugs and coils,
// injectors and fuel rail, the head shells and the three cam covers.
//
// Valve motion, cam rotation and lobe phase all come from engine.js:
//   cam angle  = crank angle / 2, exactly
//   lobe nose  = the crank angle at which that valve peaks
//   valve lift = the same 3-4-5 law the lobe outline is sampled from
// so the drawn lobe and the valve law cannot disagree.
//
// Units: mm. X along the crank, Y up, Z across (+Z = intake).
// Note on orientation: extrudeVertical maps the profile's y to world -Z and
// extrudeAlongX maps it to -Z as well, so profiles that are not symmetric in z
// are authored through zyShape(), which negates z.

import * as THREE from 'three';
import { chamferBox, softCylinder, cylinder, circlePath, extrudeAlongX, extrudeVertical, gearGeometry, mesh, fastener, cached } from '../lib/geom.js';
import * as E from '../lib/engine.js';

const L = E.L;
const RAD = Math.PI / 180;
const CORE_Z = 46; // half width of the head core strip
const SKIN_Z = 128; // outer face of the head, where the manifolds bolt
const F = 352; // cam cover gasket face
const TOWER_X = E.MAIN_X;
// the cam-to-cam gear pair, between the front cam tower and the sprocket
const CAM_GEAR_X = -358;

function shapeFrom(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}
// profile given as world (z, y): extrudeAlongX and extrudeVertical both mirror z
const zyShape = (pts) => shapeFrom(pts.map(([z, y]) => [-z, y]));

// The lobe outline is the base circle plus the lift law, sampled all the way
// round: the nose points along the shape's +X and the profile is symmetric,
// which the mirror inside extrudeAlongX cannot disturb.
function camLobeGeo(which, width) {
  return cached(`lobe|${which}|${width}`, () => {
    const half = E.valveDuration(which) / 4; // cam degrees, half the event
    const N = 180;
    const out = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * 360 - 180;
      const lift = Math.abs(a) >= half ? 0 : E.SPEC.valveLift * E.camLiftLaw(1 - Math.abs(a) / half);
      const r = E.SPEC.camBaseR + lift;
      out.push([Math.cos(a * RAD) * r, Math.sin(a * RAD) * r]);
    }
    return extrudeAlongX(shapeFrom(out), width, 1.2);
  });
}

export function buildHead(M) {
  const root = new THREE.Group();
  root.name = 'HEAD';

  const core = new THREE.Group();
  core.name = 'HEAD_CORE';
  root.add(core);

  const spanX = L.blockXRear - L.blockXFront;

  // ============================================================ deck casting
  const deckShape = shapeFrom([
    [-spanX / 2, -CORE_Z],
    [spanX / 2, -CORE_Z],
    [spanX / 2, CORE_Z],
    [-spanX / 2, CORE_Z],
  ]);
  for (const x of E.CYL_X) deckShape.holes.push(circlePath(x, 0, L.boreR, 48));
  const deckGeo = cached('headDeck', () => extrudeVertical(deckShape, L.deckSlabTopY - L.deckY, 2.5));
  mesh(deckGeo, M.aluCast, 'Head_DeckCasting', core, [0, (L.deckSlabTopY + L.deckY) / 2, 0]);

  // chamber roofs: the 7.75 mm gap between the deck face and this disc is the
  // recess whose volume sets the compression ratio
  const roofGeo = cached('chamberRoof', () => cylinder(L.boreR, L.boreR, L.deckSlabTopY - L.chamberRoofY, 48));
  for (const x of E.CYL_X) {
    mesh(roofGeo, M.aluMachined, `ChamberRoof_Cyl${x}`, core, [x, (L.deckSlabTopY + L.chamberRoofY) / 2, 0]);
  }
  // valve seats, four per cylinder, set into the chamber roof
  for (let i = 0; i < E.CYL_X.length; i++) {
    for (const [w, z, dia] of [['in', L.intakeZ, E.SPEC.valveIntakeDia], ['ex', L.exhaustZ, E.SPEC.valveExhaustDia]]) {
      for (const s of [-1, 1]) {
        const seat = mesh(
          cached(`vseat|${dia}`, () => new THREE.TorusGeometry(dia / 2 - 1.4, 1.7, 8, 32)),
          M.valveFace,
          `ValveSeat_${w}_Cyl${i + 1}_${s > 0 ? 'A' : 'B'}`,
          core,
          [E.CYL_X[i] + s * L.valveXOffset, L.chamberRoofY - 0.4, z]
        );
        seat.rotation.x = Math.PI / 2;
      }
    }
  }

  // =============================================================== port tubes
  // Twelve intake ports rising to the intake face and twelve exhaust ports to
  // the exhaust face. With the head shells slid away these tubes are what you
  // see, which is how a cutaway head reads.
  const ports = new THREE.Group();
  ports.name = 'HEAD_PORTS';
  core.add(ports);
  for (let i = 0; i < E.CYL_X.length; i++) {
    const x = E.CYL_X[i];
    for (const w of ['in', 'ex']) {
      const zIn = w === 'in' ? L.intakeZ : L.exhaustZ;
      const sgn = w === 'in' ? 1 : -1;
      const zOut = sgn * SKIN_Z;
      const yOut = w === 'in' ? 292 : 262;
      for (const s of [-1, 1]) {
        const xa = x + s * L.valveXOffset;
        const curve = new THREE.CatmullRomCurve3(
          [
            new THREE.Vector3(xa, 236, zIn),
            new THREE.Vector3(xa + s * 2, 246, zIn + sgn * 10),
            new THREE.Vector3(xa + s * 3, yOut - 24, zIn + sgn * 36),
            new THREE.Vector3(xa + s * 4, yOut, zOut - sgn * 12),
          ],
          false,
          'catmullrom',
          0.4
        );
        const tube = mesh(new THREE.TubeGeometry(curve, 28, L.portRunnerR, 18, false), w === 'in' ? M.aluMachined : M.headerSteel, `Port_${w}_Cyl${i + 1}_${s > 0 ? 'A' : 'B'}`, ports, [0, 0, 0]);
        void tube;
        mesh(cached('portFlange', () => chamferBox(58, 50, 10, 9, 2.5)), w === 'in' ? M.aluMachined : M.aluCast, `PortFlange_${w}_Cyl${i + 1}_${s > 0 ? 'A' : 'B'}`, ports, [xa + s * 4, yOut, zOut - sgn * 14]);
      }
    }
  }

  // ============================================================== valvetrain
  const valves = [];
  const springs = [];
  const buckets = [];
  const guides = new THREE.Group();
  guides.name = 'VALVE_GUIDES';
  core.add(guides);

  const guideGeo = cached('guide', () => cylinder(9.5, 9.5, L.guideTopY - L.deckSlabTopY + 14, 24));
  const springSeatGeo = cached('springSeat', () => cylinder(17, 17, 3, 32));
  const springGeo = cached('vSpring', () => {
    const pts = [];
    const coils = 6.5;
    const steps = 120;
    const len = L.springTopY - L.springSeatY;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * coils * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 13.4, t * len, Math.sin(a) * 13.4));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps * 2, 2.5, 8, false);
  });
  const retainerGeo = cached('retainer', () => {
    const pts = [
      [0, 0],
      [14, 0],
      [14, -3],
      [7.5, -5],
      [7.5, -11],
      [0, -11],
    ];
    return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 32);
  });
  const valveGeoCached = (dia) =>
    cached(`valve|${dia}`, () => {
      const headY = L.valveSeatY - L.valveHeadThickness;
      const pts = [
        [0, headY],
        [dia / 2 - 2.2, headY],
        [dia / 2, headY + 2.6],
        [dia / 2 - 1.2, headY + L.valveHeadThickness],
        [L.valveStemR, headY + L.valveHeadThickness + 1.0],
        [L.valveStemR, L.valveTipY],
        [0, L.valveTipY],
      ];
      return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y)), 40);
    });
  const bucketShellGeo = cached('bucketShell', () => new THREE.CylinderGeometry(L.bucketR, L.bucketR, L.bucketH, 40, 1, true));
  const bucketDiscGeo = cached('bucketDisc', () => new THREE.CylinderGeometry(L.bucketR, L.bucketR, 3, 40));
  const bucketShimGeo = cached('bucketShim', () => new THREE.CylinderGeometry(L.bucketR - 4.5, L.bucketR - 4.5, 4, 32));

  for (let i = 0; i < E.CYL_X.length; i++) {
    const x = E.CYL_X[i];
    for (const w of ['in', 'ex']) {
      const z = w === 'in' ? L.intakeZ : L.exhaustZ;
      for (const s of [-1, 1]) {
        const xa = x + s * L.valveXOffset;
        const tag = `${w === 'in' ? 'IN' : 'EX'}_CYL${i + 1}_${s > 0 ? 'A' : 'B'}`;
        const v = new THREE.Group();
        v.name = `VALVE_${tag}`;
        v.position.set(xa, 0, z);
        core.add(v);
        mesh(valveGeoCached(w === 'in' ? E.SPEC.valveIntakeDia : E.SPEC.valveExhaustDia), M.valveSteel, `Valve_${tag}`, v, [0, 0, 0]);
        valves.push({ obj: v, cyl: i + 1, which: w });

        mesh(guideGeo, M.brass, `ValveGuide_${tag}`, guides, [xa, (L.guideTopY + L.deckSlabTopY) / 2 + 7, z]);
        mesh(springSeatGeo, M.aluMachined, `SpringSeat_${tag}`, guides, [xa, L.springSeatY - 1.5, z]);

        const sp = new THREE.Group();
        sp.name = `SPRING_${tag}`;
        sp.position.set(xa, L.springSeatY, z);
        core.add(sp);
        mesh(springGeo, M.spring, `ValveSpring_${tag}`, sp, [0, 0, 0]);
        springs.push({ obj: sp, cyl: i + 1, which: w });

        const ret = new THREE.Group();
        ret.name = `RETAINER_${tag}`;
        ret.position.set(xa, L.springTopY + 4, z);
        core.add(ret);
        mesh(retainerGeo, M.spring, `Retainer_${tag}`, ret, [0, 0, 0]);

        const b = new THREE.Group();
        b.name = `BUCKET_${tag}`;
        b.position.set(xa, 0, z);
        core.add(b);
        mesh(bucketShellGeo, M.journal, `Bucket_Cup_${tag}`, b, [0, L.valveTipY + L.bucketH / 2, 0]);
        mesh(bucketDiscGeo, M.journal, `Bucket_Bottom_${tag}`, b, [0, L.valveTipY + 1.5, 0]);
        mesh(bucketShimGeo, M.steel, `Bucket_Shim_${tag}`, b, [0, L.valveTipY + L.bucketH - 2.5, 0]);
        buckets.push({ obj: b, cyl: i + 1, which: w });
      }
    }
  }

  // ============================================== bucket ladder and cam towers
  const ladder = new THREE.Group();
  ladder.name = 'CAM_LADDER';
  core.add(ladder);
  const padShape = shapeFrom([
    [-35, -CORE_Z],
    [35, -CORE_Z],
    [35, CORE_Z],
    [-35, CORE_Z],
  ]);
  for (const s of [-1, 1]) for (const z of [L.intakeZ, L.exhaustZ]) padShape.holes.push(circlePath(s * L.valveXOffset, z, L.bucketR + 0.6, 32));
  const padGeo = cached('camPad', () => extrudeVertical(padShape, 16, 2));
  E.CYL_X.forEach((x, i) => mesh(padGeo, M.aluCast, `CamLadder_Pad_${i + 1}`, ladder, [x, 346, 0]));

  // seven towers per cam, each carrying a saddle and a bolted cap
  const towerGeo = cached('camTower', () =>
    extrudeVertical(
      shapeFrom([
        [-19, -22],
        [19, -22],
        [19, 22],
        [-19, 22],
      ]),
      L.camY - L.deckSlabTopY,
      2.5
    )
  );
  TOWER_X.forEach((x, i) => {
    for (const w of ['in', 'ex']) {
      const z = w === 'in' ? L.intakeZ : L.exhaustZ;
      mesh(towerGeo, M.aluCast, `CamTower_${w}_${i + 1}`, ladder, [x, (L.camY + L.deckSlabTopY) / 2, z]);
      mesh(cached('camCap', () => chamferBox(38, 26, 44, 6, 2)), M.aluMachined, `CamCap_${w}_${i + 1}`, ladder, [x, L.camY + 13, z]);
      const bearing = mesh(cached('camBearing', () => new THREE.TorusGeometry(14, 2.4, 8, 28)), M.bearing, `CamBearing_${w}_${i + 1}`, ladder, [x, L.camY, z]);
      bearing.rotation.y = Math.PI / 2;
      for (const s of [-1, 1]) {
        const bolt = fastener(10, 58, 16, M.darkSteel, `CamCap_Bolt_${w}_${i + 1}_${s > 0 ? 'A' : 'B'}`);
        bolt.position.set(x + s * 13, L.camY + 26, z + 17);
        ladder.add(bolt);
      }
    }
  });

  // =============================================================== camshafts
  const cams = {};
  for (const w of ['in', 'ex']) {
    const z = w === 'in' ? L.intakeZ : L.exhaustZ;
    const g = new THREE.Group();
    g.name = w === 'in' ? 'CAMSHAFT_INTAKE' : 'CAMSHAFT_EXHAUST';
    g.position.set(0, L.camY, z);
    core.add(g);
    const shaft = mesh(cached('camShaft', () => cylinder(E.SPEC.camBaseR, E.SPEC.camBaseR, spanX + 40, 32)), M.camshaft, `Cam_Shaft_${w}`, g, [0, 0, 0]);
    shaft.rotation.z = Math.PI / 2;
    for (const x of TOWER_X) {
      const j = mesh(cached('camJournal', () => cylinder(L.camJournalR, L.camJournalR, 26, 32)), M.journal, `Cam_Journal_${w}_${x}`, g, [x, 0, 0]);
      j.rotation.z = Math.PI / 2;
    }
    for (let i = 0; i < E.CYL_X.length; i++) {
      for (const s of [-1, 1]) {
        const noseRad = (E.valveNoseDeg(i + 1, w) / 2) * RAD;
        const lobe = mesh(camLobeGeo(w, 16), M.camshaft, `CamLobe_${w}_Cyl${i + 1}_${s > 0 ? 'A' : 'B'}`, g, [E.CYL_X[i] + s * L.valveXOffset, 0, 0]);
        // at rest the outline's nose points at -Y (down at the bucket); the
        // cam's rotation carries it, so the local phase is the negative nose
        // the intake cam turns the other way (it is geared off the exhaust
        // cam), so its lobes are laid out mirrored
        lobe.rotation.x = w === 'in' ? noseRad : -noseRad;
      }
    }
    // Front drive. The belt turns the exhaust cam through one 48-tooth
    // sprocket; the intake cam, only 44 mm away, is driven from it by a pair
    // of equal gears (the two 72 mm sprockets could not sit side by side).
    const noseLen = -L.camSprocketX - spanX / 2 - 20 + 14;
    const camNose = mesh(cached(`camNose|${w}`, () => cylinder(14, 14, w === 'ex' ? noseLen + 12 : 40, 24)), M.camshaft, `Cam_Nose_${w}`, g, [w === 'ex' ? L.camSprocketX + noseLen / 2 - 6 : -spanX / 2 - 28, 0, 0]);
    camNose.rotation.z = Math.PI / 2;
    const camGear = mesh(gearGeometry(22, 20, 3, 12), M.steel, `Cam_DriveGear_${w}`, g, [CAM_GEAR_X, 0, 0]);
    camGear.rotation.y = Math.PI / 2;
    // half a tooth of phase on the intake gear so the teeth interleave
    if (w === 'in') camGear.rotation.z = Math.PI / 22;
    if (w === 'ex') {
      const sp = mesh(gearGeometry(L.camTeeth, L.camSprocketR - 3.5, 3.5, 26), M.steel, 'Cam_Sprocket_ex', g, [L.camSprocketX, 0, 0]);
      sp.rotation.y = Math.PI / 2;
      for (const s of [-1, 1]) {
        const guide = mesh(cached('camSprocketGuide', () => cylinder(L.camSprocketR + 6, L.camSprocketR + 6, 1.6, 72)), M.journal, `Cam_SprocketGuide_${s > 0 ? 'Rear' : 'Front'}`, g, [L.camSprocketX + s * 15, 0, 0]);
        guide.rotation.z = Math.PI / 2;
      }
      const hubS = mesh(cached('camSprocketHub', () => softCylinder(26, 34, 32, 2)), M.darkSteel, 'Cam_SprocketHub_ex', g, [L.camSprocketX - 4, 0, 0]);
      hubS.rotation.z = Math.PI / 2;
      // lightening holes, so the half-speed turn reads on camera
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const hole = mesh(cached('camSprocketHole', () => cylinder(11, 11, 28, 20)), M.rubber, `Cam_SprocketWindow_${k + 1}`, g, [L.camSprocketX, Math.cos(a) * 46, Math.sin(a) * 46]);
        hole.rotation.z = Math.PI / 2;
      }
      mesh(cached('camMark', () => chamferBox(30, 5, 4, 1, 0.4)), M.accent, 'Cam_TimingMark', g, [L.camSprocketX, L.camSprocketR - 12, 0]);
    }
    cams[w] = g;
  }

  // ================================================= spark plugs and coils
  const ignition = new THREE.Group();
  ignition.name = 'IGNITION';
  core.add(ignition);
  for (let i = 0; i < E.CYL_X.length; i++) {
    const x = E.CYL_X[i];
    const plug = new THREE.Group();
    plug.name = `SPARK_PLUG_${i + 1}`;
    plug.position.set(x, 0, 0);
    ignition.add(plug);
    mesh(cached('plugTip', () => softCylinder(3.4, 12, 12, 0.4)), M.journal, `Plug_Tip_${i + 1}`, plug, [0, 224, 0]);
    mesh(cached('plugThread', () => softCylinder(7.4, 22, 22, 0.6)), M.darkSteel, `Plug_Thread_${i + 1}`, plug, [0, 236, 0]);
    mesh(cached('plugShell', () => softCylinder(9.5, 26, 26, 1.4)), M.darkSteel, `Plug_Shell_${i + 1}`, plug, [0, 258, 0]);
    mesh(cached('plugHex', () => softCylinder(13, 12, 6, 12, 0.6)), M.darkSteel, `Plug_Hex_${i + 1}`, plug, [0, 275, 0]);
    mesh(cached('plugIns', () => softCylinder(8.6, 52, 22, 1)), M.ceramic, `Plug_Insulator_${i + 1}`, plug, [0, 305, 0]);
    mesh(cached('plugRib', () => softCylinder(9.6, 5, 20, 0.6)), M.ceramic, `Plug_Rib_${i + 1}`, plug, [0, 330, 0]);
    mesh(cached('plugTerm', () => softCylinder(4.2, 10, 16, 0.6)), M.brass, `Plug_Terminal_${i + 1}`, plug, [0, 338, 0]);
    const coil = new THREE.Group();
    coil.name = `IGNITION_COIL_${i + 1}`;
    coil.position.set(x, 0, 0);
    ignition.add(coil);
    mesh(cached('coilBoot', () => softCylinder(15, 46, 22, 1.6)), M.rubber, `Coil_Boot_${i + 1}`, coil, [0, 362, 0]);
    mesh(cached('coilBody', () => softCylinder(17, 60, 24, 2)), M.plastic, `Coil_Body_${i + 1}`, coil, [0, 412, 0]);
    mesh(cached('coilTop', () => softCylinder(14, 14, 20, 1.2)), M.coverCast, `Coil_Top_${i + 1}`, coil, [0, 446, 0]);
    mesh(cached('coilLead', () => chamferBox(22, 16, 14, 4, 1.4)), M.plastic, `Coil_Connector_${i + 1}`, coil, [0, 430, -20]);
  }

  // ================================================= injectors and fuel rail
  const fuel = new THREE.Group();
  fuel.name = 'FUEL_SYSTEM';
  root.add(fuel);
  for (let i = 0; i < E.CYL_X.length; i++) {
    const x = E.CYL_X[i];
    const inj = new THREE.Group();
    inj.name = `INJECTOR_${i + 1}`;
    inj.position.set(x, 288, SKIN_Z - 26);
    inj.rotation.x = -0.6;
    fuel.add(inj);
    mesh(cached('injBody', () => softCylinder(8.5, 58, 20, 1)), M.plastic, `Injector_Body_${i + 1}`, inj, [0, 0, 0]);
    mesh(cached('injNozzle', () => softCylinder(4.6, 16, 16, 0.6)), M.steel, `Injector_Nozzle_${i + 1}`, inj, [0, -36, 0]);
    mesh(cached('injSeal', () => softCylinder(6.4, 6, 16, 0.8)), M.rubber, `Injector_Seal_${i + 1}`, inj, [0, -25, 0]);
    mesh(cached('injClip', () => chamferBox(22, 12, 20, 4, 1.2)), M.plastic, `Injector_Clip_${i + 1}`, inj, [0, 34, 0]);
    mesh(cached('injPlug', () => chamferBox(18, 14, 16, 3, 1)), M.plastic, `Injector_Connector_${i + 1}`, inj, [0, 30, -20]);
  }
  const rail = new THREE.Group();
  rail.name = 'FUEL_RAIL';
  fuel.add(rail);
  const railZ = SKIN_Z - 26;
  mesh(
    cached('railTube', () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(-155, 322, railZ + 22),
          new THREE.Vector3(-75, 326, railZ + 24),
          new THREE.Vector3(75, 326, railZ + 24),
          new THREE.Vector3(155, 322, railZ + 22),
        ]),
        60,
        13,
        16,
        false
      )
    ),
    M.aluMachined,
    'FuelRail_Tube',
    rail,
    [0, 0, 0]
  );
  for (let i = 0; i < E.CYL_X.length; i++) {
    mesh(cached('railBoss', () => softCylinder(15, 20, 20, 1.4)), M.aluMachined, `FuelRail_Boss_${i + 1}`, rail, [E.CYL_X[i], 308, railZ + 14]);
  }
  const feed = mesh(cached('fuelFeed', () => softCylinder(7, 90, 16, 0.8)), M.steel, 'Fuel_FeedLine', rail, [L.blockXFront + 5, 334, railZ + 22]);
  feed.rotation.z = Math.PI / 2;
  mesh(cached('fpr', () => softCylinder(22, 44, 24, 2)), M.aluMachined, 'Fuel_PressureRegulator', rail, [L.blockXRear - 17, 334, railZ + 22]);

  // =============================================================== head skins
  const skinIn = new THREE.Group();
  skinIn.name = 'HEAD_SKIN_INTAKE';
  root.add(skinIn);
  {
    const prof = zyShape([
      [CORE_Z, L.deckY],
      [SKIN_Z, L.deckY],
      [SKIN_Z, F],
      [SKIN_Z - 16, F],
      [CORE_Z + 8, 300],
      [CORE_Z, 250],
    ]);
    mesh(cached('headSkinIn', () => extrudeAlongX(prof, spanX, 2.5)), M.aluCast, 'Head_Shell_Intake', skinIn, [0, 0, 0]);
    for (let i = 0; i < E.CYL_X.length; i++) {
      mesh(cached('injBoss', () => softCylinder(19, 44, 18, 1.6)), M.aluMachined, `Injector_Boss_${i + 1}`, skinIn, [E.CYL_X[i], 290, SKIN_Z - 20]);
    }
    mesh(cached('inFlange', () => chamferBox(spanX, 76, 12, 8, 2)), M.aluMachined, 'Intake_FlangeFace', skinIn, [0, 292, SKIN_Z + 4]);
    mesh(cached('inFlangePorts', () => chamferBox(spanX - 30, 40, 6, 6, 1.4)), M.gasket, 'Intake_Gasket', skinIn, [0, 292, SKIN_Z + 11]);
  }
  const skinEx = new THREE.Group();
  skinEx.name = 'HEAD_SKIN_EXHAUST';
  root.add(skinEx);
  {
    const prof = zyShape([
      [-CORE_Z, L.deckY],
      [-SKIN_Z, L.deckY],
      [-SKIN_Z, F - 8],
      [-SKIN_Z + 16, F - 8],
      [-CORE_Z - 8, 288],
      [-CORE_Z, 246],
    ]);
    mesh(cached('headSkinEx', () => extrudeAlongX(prof, spanX, 2.5)), M.aluCast, 'Head_Shell_Exhaust', skinEx, [0, 0, 0]);
    for (let i = 0; i < E.CYL_X.length; i++) {
      mesh(cached('exFlange', () => chamferBox(96, 56, 14, 10, 2.5)), M.aluCast, `Exhaust_Flange_${i + 1}`, skinEx, [E.CYL_X[i], 262, -SKIN_Z - 6]);
      mesh(cached('exGasket', () => chamferBox(92, 46, 4, 6, 1.2)), M.gasket, `Exhaust_Gasket_${i + 1}`, skinEx, [E.CYL_X[i], 262, -SKIN_Z - 14]);
    }
  }

  // =============================================================== cam covers
  const covers = new THREE.Group();
  covers.name = 'CAM_COVERS';
  root.add(covers);
  for (const w of ['in', 'ex']) {
    const sg = w === 'in' ? 1 : -1;
    const g = new THREE.Group();
    g.name = w === 'in' ? 'CAM_COVER_INTAKE' : 'CAM_COVER_EXHAUST';
    covers.add(g);
    const prof = zyShape([
      [sg * 8, F],
      [sg * (SKIN_Z - 2), F],
      [sg * (SKIN_Z - 8), F + 56],
      [sg * (SKIN_Z - 44), F + 80],
      [sg * 8, F + 80],
    ]);
    mesh(cached(`camCover|${w}`, () => extrudeAlongX(prof, spanX, 3)), M.coverCast, `CamCover_${w}`, g, [0, 0, 0]);
    // cast-in lettering on a plane, so the UVs are exactly 0..1 and the text
    // does not tile over the casting
    const plate = mesh(cached(`coverPlate|${w}`, () => new THREE.PlaneGeometry(spanX - 60, 62)), M.coverStamped, `CamCover_Plate_${w}`, g, [0, F + 80.6, sg * 44]);
    plate.rotation.x = -Math.PI / 2;
    plate.rotation.z = sg > 0 ? 0 : Math.PI;
    // the intake cover carries the oil filler, both carry a breather
    if (w === 'in') {
      mesh(cached('fillerNeck', () => softCylinder(26, 26, 22, 1.6)), M.coverCast, 'Oil_Filler_Neck', g, [-110, F + 94, 68]);
      mesh(cached('fillerCap', () => softCylinder(30, 16, 24, 1.4)), M.plastic, 'Oil_Filler_Cap', g, [-110, F + 114, 68]);
    }
    const breather = mesh(cached('breatherNip', () => softCylinder(11, 34, 16, 1)), M.plastic, `Cover_Breather_${w}`, g, [110, F + 84, sg * 56]);
    breather.rotation.z = 0;
  }
  // valley cover between the cams, over the coils
  const valley = new THREE.Group();
  valley.name = 'VALLEY_COVER';
  covers.add(valley);
  mesh(cached('valleyPlate', () => chamferBox(spanX - 10, 16, 18, 6, 2)), M.plastic, 'Valley_Cover_Plate', valley, [0, F + 88, 0]);
  for (let i = 0; i < E.CYL_X.length; i++) {
    mesh(cached('coilWell', () => softCylinder(25, 26, 28, 2)), M.plastic, `Coil_Well_${i + 1}`, valley, [E.CYL_X[i], F + 84, 0]);
  }

  // ================================================================== update
  const freeSpring = L.springTopY - L.springSeatY;
  function update(thetaDeg) {
    const camAng = E.camAngleDeg(thetaDeg) * RAD;
    cams.in.rotation.x = -camAng;
    cams.ex.rotation.x = camAng;
    for (const v of valves) v.obj.position.y = -E.valveLiftMm(thetaDeg, v.cyl, v.which);
    for (const b of buckets) b.obj.position.y = -E.valveLiftMm(thetaDeg, b.cyl, b.which);
    for (const s of springs) {
      const lift = E.valveLiftMm(thetaDeg, s.cyl, s.which);
      s.obj.scale.y = Math.max(0.55, (freeSpring - lift) / freeSpring);
    }
  }
  update(0);

  return { root, groups: { core, ports, guides, ladder, covers, valley, skinIn, skinEx, fuel, ignition }, cams, update };
}
