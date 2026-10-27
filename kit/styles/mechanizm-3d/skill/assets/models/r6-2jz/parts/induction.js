// induction.js - the twin turbo system of the 2JZ-GTE: a tubular exhaust
// manifold per bank of three cylinders, two CT20 style turbochargers (turbine
// volute, centre housing, compressor volute, both wheels), internal wastegates
// with their actuators, the intake plenum and throttle body, the front mount
// intercooler and the charge pipes, the air filters and the downpipes.
//
// The turbine and compressor wheels are spun by engine.js: their speed is the
// crank speed times the turbo ratio, spooled by an exponential, and the
// wastegate opens progressively once the boost target is reached.
//
// Units: mm. X along the crank (+X = rear / flywheel end), Y up, Z across
// (+Z = intake side, -Z = exhaust and turbo side).

import * as THREE from 'three';
import { chamferBox, softCylinder, cylinder, tubeThrough, mesh, fastener, cached } from '../lib/geom.js';
import * as E from '../lib/engine.js';

const L = E.L;
const RAD = Math.PI / 180;
const TZ = L.turboZ;

function shapeFrom(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

// A volute is a spiral whose radius closes as it goes round: exactly what a
// turbocharger's collecting housing is, so it is swept rather than drawn.
function spiralPoints(cy, cz, r0, r1, turns, samples, xPlane) {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const a = t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    pts.push(new THREE.Vector3(xPlane, cy + Math.sin(a) * r, cz + Math.cos(a) * r));
  }
  return pts;
}

export function buildInduction(M) {
  const root = new THREE.Group();
  root.name = 'INDUCTION';

  const turbos = [];
  const wastegates = [];

  // ==================================================== exhaust manifolds
  const manifolds = new THREE.Group();
  manifolds.name = 'EXHAUST_MANIFOLDS';
  root.add(manifolds);
  for (const turbo of [0, 1]) {
    const bank = turbo === 0 ? [0, 1, 2] : [3, 4, 5];
    const tx = L.turboX[turbo];
    for (const ci of bank) {
      const x = E.CYL_X[ci];
      const portY = 262;
      const rr = 19;
      const curve = new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(x, portY, -148),
          new THREE.Vector3(x, portY - 10, -168),
          new THREE.Vector3(x + (tx - x) * 0.35, portY - 40, -186),
          new THREE.Vector3(tx + (x - tx) * 0.22, L.turboY + 52, TZ - 6),
          new THREE.Vector3(tx + (x - tx) * 0.1, L.turboY + 30, TZ + 4),
        ],
        false,
        'catmullrom',
        0.4
      );
      const runner = mesh(new THREE.TubeGeometry(curve, 42, rr, 16, false), M.headerSteel, `ExhaustRunner_B${turbo + 1}_Cyl${ci + 1}`, manifolds, [0, 0, 0]);
      void runner;
    }
    // collector flange onto the turbine inlet
    mesh(cached('turbineInletFlange', () => chamferBox(96, 20, 74, 10, 3)), M.turboIron, `Turbine_InletFlange_B${turbo + 1}`, manifolds, [tx, L.turboY + 24, TZ + 12]);
    for (const s of [-1, 1]) {
      const b = fastener(11, 52, 17, M.darkSteel, `TurbineFlange_Bolt_B${turbo + 1}_${s > 0 ? 'A' : 'B'}`);
      b.position.set(tx + s * 36, L.turboY + 34, TZ + 16);
      manifolds.add(b);
    }
  }

  // =========================================================== turbochargers
  for (const ti of [0, 1]) {
    const tx = L.turboX[ti];
    const g = new THREE.Group();
    g.name = `TURBO_${ti + 1}`;
    g.position.set(tx, L.turboY, TZ);
    root.add(g);

    const turbineX = -34; // turbine end of the shaft
    const compX = 44; // compressor end

    // --- centre housing (CHRA) with its oil feed and coolant lines
    const chra = mesh(cached('chra', () => cylinder(26, 26, 74, 32)), M.turboIron, `Turbo${ti + 1}_CentreHousing`, g, [0, 0, 0]);
    chra.rotation.z = Math.PI / 2;
    mesh(cached('chraFlange', () => cylinder(34, 34, 12, 32)), M.turboIron, `Turbo${ti + 1}_CHRA_Flange`, g, [turbineX + 40, 0, 0]).rotation.z = Math.PI / 2;
    // oil feed at the top: banjo bolt and a braided line back to the block
    mesh(cached('turboBanjo', () => softCylinder(9, 22, 16, 1)), M.brass, `Turbo${ti + 1}_OilFeed_Banjo`, g, [0, 32, 0]);
    mesh(
      cached(`turboOilLine|${ti}`, () =>
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(
            [
              new THREE.Vector3(tx, L.turboY + 40, TZ),
              new THREE.Vector3(tx + 10, L.turboY + 66, TZ + 30),
              new THREE.Vector3(tx - 30, L.turboY + 84, TZ + 90),
              new THREE.Vector3(tx - 40, L.turboY + 60, TZ + 132),
            ],
            false,
            'catmullrom',
            0.4
          ),
          26,
          5,
          10,
          false
        )
      ),
      M.hoseRubber,
      `Turbo${ti + 1}_OilFeedLine`,
      root,
      [0, 0, 0]
    );
    // oil drain to the block
    mesh(
      cached(`turboDrain|${ti}`, () =>
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(
            [
              new THREE.Vector3(tx, L.turboY - 28, TZ),
              new THREE.Vector3(tx, L.turboY - 44, TZ + 40),
              new THREE.Vector3(tx, L.turboY - 30, TZ + 118),
            ],
            false,
            'catmullrom',
            0.4
          ),
          18,
          8,
          10,
          false
        )
      ),
      M.steel,
      `Turbo${ti + 1}_OilDrain`,
      root,
      [0, 0, 0]
    );

    // --- turbine housing: cast iron volute wrapping the turbine wheel
    const volute = mesh(
      cached(`turbineVolute|${ti}`, () =>
        tubeThrough(spiralPoints(0, 0, 74, 44, 0.92, 60, turbineX), 27, 90, 14, false, 0.4)
      ),
      M.turboIron,
      `Turbo${ti + 1}_TurbineHousing`,
      g,
      [0, 0, 0]
    );
    void volute;
    mesh(cached('turbineBackplate', () => cylinder(58, 58, 14, 40)), M.turboIron, `Turbo${ti + 1}_TurbineBackplate`, g, [turbineX + 16, 0, 0]).rotation.z = Math.PI / 2;
    // turbine outlet flange, axial, leading to the downpipe
    mesh(cached('turbineOutlet', () => cylinder(40, 46, 26, 32)), M.turboIron, `Turbo${ti + 1}_TurbineOutlet`, g, [turbineX - 40, 0, 0]).rotation.z = Math.PI / 2;
    // internal wastegate: a port in the housing with a swinging flapper on an arm
    const wg = new THREE.Group();
    wg.name = `Turbo${ti + 1}_WastegateFlapper`;
    wg.position.set(turbineX - 20, 58, 42);
    g.add(wg);
    mesh(cached('wgPort', () => cylinder(30, 30, 20, 24)), M.turboIron, `Turbo${ti + 1}_WastegatePort`, wg, [0, -10, 0]);
    const armPivot = new THREE.Group();
    armPivot.name = `Turbo${ti + 1}_WastegateArm`;
    armPivot.position.set(turbineX - 20, 52, 78);
    g.add(armPivot);
    mesh(cached('wgArm', () => chamferBox(10, 60, 8, 3, 1)), M.darkSteel, `Turbo${ti + 1}_WastegateArmBar`, armPivot, [0, 26, 0]);
    mesh(cached('wgFlapper', () => cylinder(24, 24, 6, 24)), M.turboIron, `Turbo${ti + 1}_WastegateFlapperDisc`, armPivot, [0, 58, 0]);
    wastegates.push({ arm: armPivot, rod: null, turbo: ti });

    // --- compressor housing: bright aluminium volute with the axial inlet bell
    mesh(
      cached(`compVolute|${ti}`, () =>
        tubeThrough(spiralPoints(0, 0, 84, 52, 0.86, 60, compX), 32, 96, 14, false, 0.4)
      ),
      M.aluMachined,
      `Turbo${ti + 1}_CompressorHousing`,
      g,
      [0, 0, 0]
    );
    mesh(cached('compBackplate', () => cylinder(72, 72, 12, 44)), M.aluMachined, `Turbo${ti + 1}_CompressorBackplate`, g, [compX - 18, 0, 0]).rotation.z = Math.PI / 2;
    const bell = mesh(cached('compBell', () => softCylinder(30, 34, 40, 2)), M.aluMachined, `Turbo${ti + 1}_CompressorInlet`, g, [compX + 34, 0, 0]);
    bell.rotation.z = Math.PI / 2;
    mesh(cached('compInletLip', () => cylinder(33, 27, 8, 36)), M.aluMachined, `Turbo${ti + 1}_CompressorInletLip`, g, [compX + 54, 0, 0]).rotation.z = Math.PI / 2;
    // compressor outlet, tangential, pointing up and out of the volute
    const outDir = new THREE.Group();
    outDir.name = `Turbo${ti + 1}_CompressorOutlet`;
    g.add(outDir);
    const out = mesh(cached('compOutlet', () => cylinder(24, 27, 46, 28)), M.aluMachined, `Turbo${ti + 1}_CompressorOutletNeck`, outDir, [0, 42, 0]);
    void out;
    mesh(cached('compOutletFlange', () => cylinder(32, 32, 10, 28)), M.aluMachined, `Turbo${ti + 1}_CompressorOutletFlange`, outDir, [0, 64, 0]);

    // --- the two wheels, both on the shaft, both spun by the turbine
    const shaft = new THREE.Group();
    shaft.name = `Turbo${ti + 1}_RotorGroup`;
    g.add(shaft);
    const hubGeo = cached('wheelHub', () => {
      const pts = [
        [0, -9],
        [7, -9],
        [9, -4],
        [11, 4],
        [4, 9],
        [0, 9],
      ];
      const geo = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.01, r), y)), 24);
      geo.rotateZ(-Math.PI / 2);
      return geo;
    });
    const shaftRod = mesh(cached('turboShaft', () => cylinder(7, 7, 74, 20)), M.journal, `Turbo${ti + 1}_Shaft`, shaft, [0, 0, 0]);
    shaftRod.rotation.z = Math.PI / 2;
    // turbine wheel: 11 blades
    const turbWheel = new THREE.Group();
    turbWheel.name = `Turbo${ti + 1}_TurbineWheel`;
    turbWheel.position.set(turbineX - 14, 0, 0);
    shaft.add(turbWheel);
    mesh(hubGeo, M.turboIron, `Turbo${ti + 1}_TurbineHub`, turbWheel, [0, 0, 0]);
    // compressor wheel: 14 blades, visible through the inlet bell
    const compWheel = new THREE.Group();
    compWheel.name = `Turbo${ti + 1}_CompressorWheel`;
    compWheel.position.set(compX + 14, 0, 0);
    shaft.add(compWheel);
    mesh(hubGeo, M.aluMachined, `Turbo${ti + 1}_CompressorHub`, compWheel, [0, 0, 0]);
    const bladeGeo = (r0, r1, w, t, slant) =>
      cached(`blade|${r0}|${r1}|${w}|${t}|${slant}`, () => {
        const geo = chamferBox(w, r1 - r0, t, t * 0.4, 0.3);
        geo.rotateZ(slant);
        return geo;
      });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const bl = mesh(bladeGeo(12, 33, 3.4, 9, 0.5), M.aluMachined, `Turbo${ti + 1}_CompBlade_${i + 1}`, compWheel, [0, 0, 0]);
      const r = 22;
      bl.position.set(0, Math.sin(a) * r, Math.cos(a) * r);
      bl.rotation.x = a;
    }
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const bl = mesh(bladeGeo(11, 30, 3.0, 10, -0.7), M.turboIron, `Turbo${ti + 1}_TurbBlade_${i + 1}`, turbWheel, [0, 0, 0]);
      const r = 20;
      bl.position.set(0, Math.sin(a) * r, Math.cos(a) * r);
      bl.rotation.x = a;
    }
    turbos.push({ group: g, shaft, turbineWheel: turbWheel, compWheel, head: g });
  }

  // ============================================== wastegate actuators and rods
  wastegates.forEach((w, i) => {
    const ti = w.turbo;
    const tx = L.turboX[ti];
    const can = new THREE.Group();
    can.name = `Turbo${ti + 1}_WastegateActuator`;
    can.position.set(tx, L.turboY + 78, TZ + 62);
    root.add(can);
    const body = mesh(cached('wgCan', () => softCylinder(38, 62, 32, 2)), M.aluMachined, `Wastegate_Can_B${ti + 1}`, can, [0, 0, 0]);
    body.rotation.x = Math.PI / 2;
    mesh(cached('wgCanCap', () => softCylinder(41, 8, 32, 1.6)), M.darkSteel, `Wastegate_CanCap_B${ti + 1}`, can, [0, 0, -34]).rotation.x = Math.PI / 2;
    mesh(cached('wgNipple', () => softCylinder(5, 22, 12, 0.5)), M.brass, `Wastegate_Nipple_B${ti + 1}`, can, [0, 22, 0]);
    // the rod: it pulls the flapper arm open as boost rises
    const rod = new THREE.Group();
    rod.name = `Turbo${ti + 1}_WastegateRod`;
    rod.position.set(tx, L.turboY + 78 - 40, TZ + 62);
    root.add(rod);
    mesh(cached('wgRod', () => cylinder(4.5, 4.5, 76, 14)), M.steel, `Wastegate_Rod_B${ti + 1}`, rod, [0, -38, 0]);
    mesh(cached('wgRodEnd', () => chamferBox(12, 16, 8, 3, 0.8)), M.steel, `Wastegate_RodEnd_B${ti + 1}`, rod, [0, -78, 0]);
    wastegates[i].rod = rod;
    void w;
  });

  // ============================================================= intake plenum
  const plenum = new THREE.Group();
  plenum.name = 'INTAKE_PLENUM';
  root.add(plenum);
  {
    const prof = shapeFrom([
      [128, 262],
      [232, 262],
      [232, 354],
      [196, 372],
      [128, 372],
    ]);
    const geo = cached('plenumBody', () => {
      const g = new THREE.ExtrudeGeometry(prof, { depth: 640, bevelEnabled: true, bevelSize: 6, bevelThickness: 4, bevelSegments: 2, curveSegments: 3 });
      g.translate(0, 0, -320);
      g.rotateY(Math.PI / 2);
      return g;
    });
    mesh(geo, M.aluCast, 'Intake_Plenum_Body', plenum, [0, 0, 0]);
    // six tapered runners onto the head flange
    for (let i = 0; i < 6; i++) {
      const x = E.CYL_X[i];
      const runner = mesh(cached('plenumRunner', () => cylinder(34, 30, 42, 30)), M.aluCast, `Intake_Runner_${i + 1}`, plenum, [x, 300, 112]);
      runner.rotation.x = Math.PI / 2;
      mesh(cached('plenumInjectorPad', () => chamferBox(70, 50, 22, 10, 3)), M.aluCast, `Plenum_Pad_${i + 1}`, plenum, [x, 292, 168]);
    }
    // throttle body at the front end of the plenum
    const tb = new THREE.Group();
    tb.name = 'THROTTLE_BODY';
    tb.position.set(-340, 316, 180);
    plenum.add(tb);
    mesh(cached('tbBody', () => cylinder(44, 44, 56, 32)), M.aluMachined, 'Throttle_Body_Housing', tb, [0, 0, 22]).rotation.z = Math.PI / 2;
    mesh(cached('tbFlange', () => cylinder(54, 54, 12, 32)), M.aluMachined, 'Throttle_Body_Flange', tb, [0, 0, -8]).rotation.z = Math.PI / 2;
    mesh(cached('tbMotor', () => chamferBox(46, 40, 34, 8, 2)), M.plastic, 'Throttle_Body_Motor', tb, [-6, 30, 24]);
    mesh(cached('tbInlet', () => cylinder(50, 46, 40, 32)), M.aluMachined, 'Throttle_Body_Inlet', tb, [0, 0, 54]).rotation.z = Math.PI / 2;
    // idle speed control and the throttle cable bracket
    mesh(cached('iscv', () => cylinder(26, 26, 40, 24)), M.aluMachined, 'IdleSpeed_ControlValve', tb, [0, -34, 20]).rotation.z = Math.PI / 2;
  }

  // ================================================= intercooler and charge pipes
  const charge = new THREE.Group();
  charge.name = 'CHARGE_COOLER';
  root.add(charge);
  {
    const [thick, height, width] = L.icSize;
    const cx = L.icX;
    const cy = 100;
    // core with its fin pack
    mesh(cached('icCore', () => chamferBox(thick, height, width, 8, 3)), M.aluMachined, 'Intercooler_Core', charge, [cx, cy, 0]);
    for (let i = 0; i < 26; i++) {
      const z = -width / 2 + 14 + i * ((width - 28) / 25);
      mesh(cached('icFin', () => chamferBox(thick + 8, 6, 6, 2, 0.6)), M.aluCast, `Intercooler_Fin_${i + 1}`, charge, [cx, cy, z]);
    }
    mesh(cached('icTankNeg', () => chamferBox(thick + 26, height + 22, 46, 10, 3)), M.aluMachined, 'Intercooler_Tank_Exhaust', charge, [cx, cy, -width / 2 - 24]);
    mesh(cached('icTankPos', () => chamferBox(thick + 26, height + 22, 46, 10, 3)), M.aluMachined, 'Intercooler_Tank_Intake', charge, [cx, cy, width / 2 + 24]);
    // inlet from the turbos, outlet to the throttle body
    mesh(cached('icInlet', () => cylinder(34, 34, 46, 28)), M.aluMachined, 'Intercooler_Inlet', charge, [cx, cy, -width / 2 - 52]).rotation.x = Math.PI / 2;
    mesh(cached('icOutlet', () => cylinder(34, 34, 46, 28)), M.aluMachined, 'Intercooler_Outlet', charge, [cx, cy, width / 2 + 52]).rotation.x = Math.PI / 2;

    // hot side: both compressors into the -Z end tank
    const hotA = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(L.turboX[0], L.turboY + 64, TZ),
          new THREE.Vector3(L.turboX[0], L.turboY + 130, TZ - 4),
          new THREE.Vector3(-330, 150, TZ - 10),
          new THREE.Vector3(cx + 40, 150, -width / 2 - 40),
          new THREE.Vector3(cx + 6, cy + 10, -width / 2 - 52),
        ],
        false,
        'catmullrom',
        0.4
      ),
      56,
      30,
      18,
      false
    );
    mesh(hotA, M.aluMachined, 'ChargePipe_FrontTurbo', charge, [0, 0, 0]);
    const hotB = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(L.turboX[1], L.turboY + 64, TZ),
          new THREE.Vector3(L.turboX[1], L.turboY + 140, TZ - 30),
          new THREE.Vector3(-120, 176, TZ - 60),
          new THREE.Vector3(cx + 40, 168, -width / 2 - 20),
          new THREE.Vector3(cx + 6, cy + 40, -width / 2 - 46),
        ],
        false,
        'catmullrom',
        0.4
      ),
      56,
      30,
      18,
      false
    );
    mesh(hotB, M.aluMachined, 'ChargePipe_RearTurbo', charge, [0, 0, 0]);
    // cold side: the +Z end tank up and back to the throttle body
    const cold = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(cx + 6, cy, width / 2 + 52),
          new THREE.Vector3(-430, 150, width / 2 + 60),
          new THREE.Vector3(-380, 250, width / 2 + 20),
          new THREE.Vector3(-352, 314, 214),
          new THREE.Vector3(-322, 316, 196),
        ],
        false,
        'catmullrom',
        0.4
      ),
      60,
      30,
      18,
      false
    );
    mesh(cold, M.aluMachined, 'ChargePipe_ColdSide', charge, [0, 0, 0]);
    for (const [x, y, z, r] of [
      [-334, L.turboY + 66, TZ, 34],
      [cx + 6, cy + 10, -width / 2 - 52, 36],
      [cx + 6, cy, width / 2 + 52, 36],
    ]) {
      mesh(cached('chargeClamp', () => new THREE.TorusGeometry(1, 1, 8, 24)), M.spring, `ChargeClamp_${x}_${y}`, charge, [x, y, z]).scale.set(r * 0.95, r * 0.95, 2.2);
    }
    // cold air intakes: a cone filter on each compressor
    for (const ti of [0, 1]) {
      const tx = L.turboX[ti];
      const dir = ti === 0 ? -1 : 1;
      mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(
            [
              new THREE.Vector3(tx, L.turboY, TZ + 96),
              new THREE.Vector3(tx, L.turboY + 10, TZ + 160),
              new THREE.Vector3(tx + dir * 40, L.turboY + 6, TZ + 230),
              new THREE.Vector3(tx + dir * 70, L.turboY, TZ + 280),
            ],
            false,
            'catmullrom',
            0.4
          ),
          34,
          29,
          16,
          false
        ),
        M.silicone,
        `AirIntakePipe_Turbo${ti + 1}`,
        charge,
        [0, 0, 0]
      );
      const filterX = tx + dir * 100;
      const filter = mesh(cached('coneFilter', () => softCylinder(46, 130, 32, 2)), M.rubber, `AirFilter_${ti + 1}`, charge, [filterX, L.turboY, TZ + 300]);
      filter.rotation.z = Math.PI / 2;
      mesh(cached('filterClamp', () => cylinder(30, 30, 18, 24)), M.spring, `AirFilter_Clamp_${ti + 1}`, charge, [filterX - dir * 70, L.turboY, TZ + 300]).rotation.z = Math.PI / 2;
      mesh(cached('maf', () => cylinder(32, 32, 40, 24)), M.aluMachined, `MassAirFlowSensor_${ti + 1}`, charge, [filterX - dir * 110, L.turboY, TZ + 300]).rotation.z = Math.PI / 2;
    }
  }

  // ================================================================ downpipes
  const exhaust = new THREE.Group();
  exhaust.name = 'EXHAUST';
  root.add(exhaust);
  {
    for (const ti of [0, 1]) {
      const tx = L.turboX[ti];
      mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(
            [
              new THREE.Vector3(tx, L.turboY, TZ),
              new THREE.Vector3(tx - 60, L.turboY - 20, TZ - 20),
              new THREE.Vector3(tx - 40, L.turboY - 90, TZ - 40),
              new THREE.Vector3(tx + 120, L.turboY - 130, TZ - 40),
              new THREE.Vector3(400, L.turboY - 140, TZ - 30),
            ],
            false,
            'catmullrom',
            0.4
          ),
          60,
          34,
          18,
          false
        ),
        M.headerSteel,
        `Downpipe_Turbo${ti + 1}`,
        exhaust,
        [0, 0, 0]
      );
    }
    // merge collector and the single tail pipe
    mesh(cached('collector', () => softCylinder(52, 90, 32, 3)), M.headerSteel, 'Exhaust_MergeCollector', exhaust, [400, L.turboY - 140, TZ - 30]).rotation.z = Math.PI / 2;
    mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(
          [
            new THREE.Vector3(440, L.turboY - 140, TZ - 30),
            new THREE.Vector3(520, L.turboY - 130, TZ - 10),
            new THREE.Vector3(560, L.turboY - 90, TZ + 40),
          ],
          false,
          'catmullrom',
          0.4
        ),
        30,
        40,
        18,
        false
      ),
      M.headerSteel,
      'Exhaust_TailPipe',
      exhaust,
      [0, 0, 0]
    );
  }

  // ========================================================== turbo control
  // The actuators open as boost rises: the rod extends and the flapper arm
  // swings, both straight from engine.js wastegateOpen().
  let turboAngle = 0;
  function update(rpm, dtSeconds, spinScale = 1) {
    const wg = E.wastegateOpen(rpm);
    turboAngle = (turboAngle + (E.turboRpm(rpm) / 60) * 360 * dtSeconds * spinScale) % 360;
    for (const t of turbos) {
      t.shaft.rotation.x = turboAngle * RAD;
    }
    wastegates.forEach((w, i) => {
      if (w && w.rod) w.rod.position.y = L.turboY + 78 - 40 - wg * 9;
      if (w && w.arm) w.arm.rotation.z = wg * 0.5;
      void i;
    });
  }

  return { root, groups: { manifolds, plenum, charge, exhaust }, turbos, wastegates, update, turboState: () => turboAngle };
}
