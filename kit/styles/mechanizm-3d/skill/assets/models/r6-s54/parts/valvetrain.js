// valvetrain.js - two camshafts, 24 valves, 24 springs, 24 hydraulic tappets.
// The cam lobe is not a drawing of a lobe: its radius at every angle is the
// valve lift the timing figures ask for at that angle, so rotating the shaft by
// half the crank angle produces exactly the lift curve verify.mjs checks.

import * as THREE from 'three';
import * as K from '../kinematics.js';
import { alongX, mesh, RAD, sprocketShape } from './profile.js';
import { cached, coilSpring } from '../lib/geom.js';

const STEM_R = 3.5;
const HEAD_T = 4.5;
const SPRING_Y0 = 26.0;
const SPRING_LEN = 62.0;

// ---------------------------------------------------------------------------
// cam lobe: r(phi) = base + lift(-90 - phi - phase). phi is measured in the
// (z, y) plane from +z towards +y, so the nose ends up pointing at -y, which is
// where the tappet sits.
export function lobeGeo(bank, phaseCamDeg) {
  return cached(`lobe|${bank}|${Math.round(phaseCamDeg * 100)}`, () => {
    const pts = [];
    const N = 160;
    for (let i = 0; i < N; i++) {
      const phi = (i / N) * 360;
      const camAngle = -90 - phi - phaseCamDeg;
      const r = K.CAM_BASE_R + K.valveLift(bank, camAngle * 2, 0);
      pts.push([r * Math.sin(RAD(phi)), r * Math.cos(RAD(phi))]);
    }
    return alongX(pts, 16);
  });
}

/** One camshaft: shaft, twelve lobes, five bearing journals, sprocket land. */
export function buildCam(M, bank) {
  const g = new THREE.Group();
  g.name = bank === 'inlet' ? 'CAMSHAFT_INLET' : 'CAMSHAFT_EXHAUST';
  g.position.set(0, K.CAM_Y, bank === 'inlet' ? K.CAM_U : -K.CAM_U);

  const shaft = cached('camShaft', () => {
    const geo = new THREE.CylinderGeometry(14, 14, K.BLOCK_LENGTH + 40, 28);
    geo.rotateZ(Math.PI / 2);
    return geo;
  });
  mesh(shaft, M.journal, 'CamShaft', g, [4, 0, 0]);

  for (let c = 0; c < K.S54.nCyl; c++) {
    const phase = K.FIRE_ANGLE[c].angle / 2; // cam degrees
    for (const s of [-1, 1]) {
      mesh(lobeGeo(bank, phase), M.crankSteel, `Lobe_${bank}_${c + 1}_${s}`, g, [
        K.CYL_X[c] + s * K.VALVE_X,
        0,
        0,
      ]);
    }
  }

  const cj = cached('camJournal', () => {
    const geo = new THREE.CylinderGeometry(19, 19, 20, 28);
    geo.rotateZ(Math.PI / 2);
    return geo;
  });
  for (let i = 0; i < 5; i++) {
    const x = -K.HALF_LENGTH + 40 + (i * (K.BLOCK_LENGTH - 80)) / 4;
    mesh(cj, M.journal, `CamJournal_${bank}_${i + 1}`, g, [x, 0, 0]);
  }

  const spk = cached('camSprocket', () =>
    sprocketShape(K.CHAIN.camTeeth, K.sprocketRadius(K.CHAIN.camTeeth) - 4, 24, 14)
  );
  mesh(spk, M.chainSteel, 'CamSprocket', g, [-K.HALF_LENGTH - 22, 0, 0]);

  if (bank === 'inlet') {
    const hub = cached('vanosHub', () => {
      const geo = new THREE.CylinderGeometry(46, 46, 30, 32);
      geo.rotateZ(Math.PI / 2);
      return geo;
    });
    mesh(hub, M.aluMachined, 'VanosHub', g, [-K.HALF_LENGTH - 46, 0, 0]);
  }

  const trig = cached('trigger', () => {
    const geo = new THREE.CylinderGeometry(38, 38, 4, 40);
    geo.rotateZ(Math.PI / 2);
    return geo;
  });
  mesh(trig, M.blackOxide, 'CamTriggerWheel', g, [K.HALF_LENGTH - 6, 0, 0]);

  return g;
}

// ---------------------------------------------------------------------------
/** The parts of the valvetrain that never move: guides, seats, cam bearing caps. */
export function buildValvetrainStatics(M) {
  const g = new THREE.Group();
  g.name = 'VALVETRAIN_STATIC';

  const guide = cached('valveGuide', () => new THREE.CylinderGeometry(7.5, 6.5, 44, 18));
  const seat = cached('valveSeat', () => new THREE.CylinderGeometry(17.5, 15.0, 5, 28));
  const capGeo = cached('camCapHalf', () => {
    const geo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(19, -13),
        new THREE.Vector2(33, -13),
        new THREE.Vector2(33, 13),
        new THREE.Vector2(19, 13),
      ],
      28,
      Math.PI,
      Math.PI
    );
    geo.rotateZ(Math.PI / 2); // ring axis onto the engine axis
    geo.rotateX(Math.PI); // and the half that is left onto the top
    return geo;
  });
  const stud = cached('camCapStud', () => new THREE.CylinderGeometry(5.5, 5.5, 16, 12));

  for (let c = 0; c < K.S54.nCyl; c++) {
    const x = K.CYL_X[c];
    for (const [dv, bank] of [
      [1, 'inlet'],
      [-1, 'exhaust'],
    ]) {
      for (const sx of [-1, 1]) {
        const holder = new THREE.Group();
        holder.name = `Guide_${bank}_${c + 1}_${sx}`;
        holder.position.set(x + sx * K.VALVE_X, K.VALVE_SEAT_Y, dv * K.VALVE_U);
        holder.rotation.x = dv * RAD(K.VALVE_TILT);
        g.add(holder);
        mesh(guide, M.aluMachined, `GuideBody_${bank}_${c + 1}_${sx}`, holder, [0, 64, 0]);
        mesh(seat, M.steelBright, `Seat_${bank}_${c + 1}_${sx}`, holder, [0, 0.5, 0]);
      }
    }
  }

  for (let i = 0; i < 5; i++) {
    const x = -K.HALF_LENGTH + 40 + (i * (K.BLOCK_LENGTH - 80)) / 4;
    for (const dv of [1, -1]) {
      mesh(capGeo, M.aluMachined, `CamCap_${i + 1}_${dv > 0 ? 'I' : 'E'}`, g, [
        x,
        K.CAM_Y,
        dv * K.CAM_U,
      ]);
      for (const s of [-1, 1]) {
        mesh(stud, M.blackOxide, `CamStud_${i + 1}_${dv > 0 ? 'I' : 'E'}_${s}`, g, [
          x,
          K.CAM_Y + 26,
          dv * K.CAM_U + s * 26,
        ]);
      }
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
/** 24 valves, each with its spring, retainer and hydraulic tappet. */
export function buildValves(M) {
  const valves = [];
  const valveGeo = cached('valveBody', () => {
    const pts = [
      new THREE.Vector2(0, -HEAD_T),
      new THREE.Vector2(12.5, -HEAD_T),
      new THREE.Vector2(15.5, -1.5),
      new THREE.Vector2(15.5, 0.8),
      new THREE.Vector2(13.5, 3.5),
      new THREE.Vector2(STEM_R, 8),
      new THREE.Vector2(STEM_R, K.VALVE_LENGTH),
      new THREE.Vector2(0, K.VALVE_LENGTH),
    ];
    return new THREE.LatheGeometry(pts, 28);
  });
  const tappetGeo = cached('tappet', () =>
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(17, 0),
        new THREE.Vector2(17, K.TAPPET_H),
        new THREE.Vector2(12, K.TAPPET_H + 3),
        new THREE.Vector2(0, K.TAPPET_H + 3),
      ],
      28
    )
  );
  const retainerGeo = cached('retainer', () =>
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(4.5, 0),
        new THREE.Vector2(15, 0),
        new THREE.Vector2(13, 5),
        new THREE.Vector2(4.5, 6),
        new THREE.Vector2(4.5, 0),
      ],
      24
    )
  );
  const springGeo = cached('valveSpring', () => coilSpring(10.5, SPRING_LEN, 6.5, 2.4, 10));
  const dScale = { inlet: K.VALVE_DIAM.inlet / 31, exhaust: K.VALVE_DIAM.exhaust / 31 };

  for (let c = 0; c < K.S54.nCyl; c++) {
    for (const [dv, bank] of [
      [1, 'inlet'],
      [-1, 'exhaust'],
    ]) {
      for (const sx of [-1, 1]) {
        const g = new THREE.Group();
        g.name = `VALVE_${bank}_${c + 1}_${sx}`;
        g.position.set(K.CYL_X[c] + sx * K.VALVE_X, K.VALVE_SEAT_Y, dv * K.VALVE_U);
        g.rotation.x = dv * RAD(K.VALVE_TILT);
        const head = mesh(valveGeo, bank === 'inlet' ? M.steelBright : M.blackOxide, `ValveHead_${bank}_${c + 1}_${sx}`, g);
        head.scale.set(dScale[bank], 1, dScale[bank]);
        mesh(retainerGeo, M.springSteel, `Retainer_${bank}_${c + 1}_${sx}`, g, [0, K.VALVE_LENGTH - 8, 0]);
        const spring = new THREE.Group();
        spring.name = `Spring_${bank}_${c + 1}_${sx}`;
        spring.position.set(0, SPRING_Y0, 0);
        g.add(spring);
        mesh(springGeo, M.springSteel, `SpringCoil_${bank}_${c + 1}_${sx}`, spring);
        mesh(tappetGeo, M.steelBright, `Tappet_${bank}_${c + 1}_${sx}`, g, [0, K.VALVE_LENGTH, 0]);
        valves.push({ group: g, spring, bank, cyl: c + 1, side: sx, dv });
      }
    }
  }
  return valves;
}

/** Drive the valves along their own tilted axes; lift comes from the timing. */
export function updateValves(valves, st) {
  const cos = Math.cos(RAD(K.VALVE_TILT));
  const sin = Math.sin(RAD(K.VALVE_TILT));
  for (const v of valves) {
    const lift = v.bank === 'inlet' ? st.cylinders[v.cyl - 1].inletLift : st.cylinders[v.cyl - 1].exhaustLift;
    v.group.position.y = K.VALVE_SEAT_Y - lift * cos;
    v.group.position.z = v.dv * K.VALVE_U - v.dv * lift * sin;
    v.spring.scale.y = (SPRING_LEN - lift) / SPRING_LEN;
    v.spring.position.y = SPRING_Y0 + lift;
  }
}
