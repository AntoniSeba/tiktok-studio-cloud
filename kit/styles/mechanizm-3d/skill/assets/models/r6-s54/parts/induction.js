// induction.js - the part that makes an S54 an S54: six individual throttle
// bodies, one per cylinder, on a common shaft, bolted straight to the head with
// no plenum in between. Plus the airbox, the fuel rail and the six injectors,
// and on the other side a six into two exhaust manifold.

import * as THREE from 'three';
import * as K from '../kinematics.js';
import { alongZ, alongX, mesh, RAD, circle } from './profile.js';
import { cached } from '../lib/geom.js';
import { HEAD_W } from './static.js';

const PORT_Y = 287.0; // centre of the inlet port flange
const BODY_Z0 = HEAD_W;
const BODY_Z1 = HEAD_W + 58;
const BORE_R = 25.0;

function rectShape(x0, x1, y0, y1, r = 8) {
  const p = [];
  const arc = (cx, cy, a0, a1, n = 4) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  arc(x1 - r, y0 + r, -Math.PI / 2, 0);
  arc(x1 - r, y1 - r, 0, Math.PI / 2);
  arc(x0 + r, y1 - r, Math.PI / 2, Math.PI);
  arc(x0 + r, y0 + r, Math.PI, 1.5 * Math.PI);
  return p;
}

export function buildInduction(M) {
  const out = {};
  const bodies = new THREE.Group();
  bodies.name = 'THROTTLE_BODIES';
  const plates = [];

  const bodyGeo = cached('itbBody', () =>
    alongZ(rectShape(-38, 38, PORT_Y - 38, PORT_Y + 38, 12), BODY_Z0, BODY_Z1 - BODY_Z0, [
      circle(0, PORT_Y, BORE_R, 40),
    ])
  );
  const flangeGeo = cached('itbFlange', () =>
    alongZ(rectShape(-44, 44, PORT_Y - 44, PORT_Y + 44, 14), BODY_Z0 - 6, 8, [
      circle(0, PORT_Y, BORE_R + 4, 40),
    ])
  );
  const boreGeo = cached('itbBore', () => {
    const g = new THREE.CylinderGeometry(BORE_R, BORE_R, BODY_Z1 - BODY_Z0 + 4, 40, 1, true);
    g.rotateX(Math.PI / 2);
    g.translate(0, PORT_Y, (BODY_Z0 + BODY_Z1) / 2);
    return g;
  });
  const plateGeo = cached('itbPlate', () => {
    const g = new THREE.CylinderGeometry(BORE_R - 1.2, BORE_R - 1.2, 2.6, 40);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const stackGeo = cached('itbStack', () => {
    const pts = [
      new THREE.Vector2(BORE_R, 0),
      new THREE.Vector2(BORE_R + 5, 12),
      new THREE.Vector2(BORE_R + 10, 26),
      new THREE.Vector2(BORE_R + 24, 44),
      new THREE.Vector2(BORE_R + 26, 47),
      new THREE.Vector2(BORE_R + 20, 45),
    ];
    const g = new THREE.LatheGeometry(pts, 36);
    g.rotateX(Math.PI / 2);
    return g;
  });

  for (let i = 0; i < K.S54.nCyl; i++) {
    const x = K.CYL_X[i];
    const g = new THREE.Group();
    g.name = `ITB_${i + 1}`;
    g.position.set(x, 0, 0);
    bodies.add(g);
    mesh(flangeGeo, M.aluMachined, `ITB_Flange_${i + 1}`, g);
    mesh(bodyGeo, M.aluCast, `ITB_Body_${i + 1}`, g);
    mesh(boreGeo, M.aluMachined, `ITB_Bore_${i + 1}`, g);
    // brass throttle shaft bushes
    for (const s of [-1, 1]) {
      mesh(
        new THREE.CylinderGeometry(9, 9, 10, 16),
        M.brass,
        `ITB_Bush_${i + 1}_${s}`,
        g,
        [s * 38, PORT_Y, BODY_Z0 + 34]
      ).rotation.z = Math.PI / 2;
    }
    // the butterfly plate: it turns about the common shaft, which runs the
    // length of the engine, so the plate's rotation is about x
    const plate = new THREE.Group();
    plate.name = `ThrottlePlate_${i + 1}`;
    plate.position.set(0, PORT_Y, BODY_Z0 + 34);
    g.add(plate);
    mesh(plateGeo, M.plateAnodised, `PlateDisc_${i + 1}`, plate);
    for (const s of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(4.6, 4.6, 12, 12), M.steelBright, `PlateStub_${i + 1}_${s}`, plate, [
        s * 12,
        0,
        0,
      ]).rotation.z = Math.PI / 2;
    }
    plates.push(plate);
    // velocity stack, chromed inside
    const stack = mesh(stackGeo, M.aluMachined, `ITB_Stack_${i + 1}`, g);
    stack.position.set(0, PORT_Y, BODY_Z1);
    // idle bypass screw and linkage lever
    mesh(new THREE.CylinderGeometry(6, 6, 12, 6), M.brass, `ITB_IdleScrew_${i + 1}`, g, [
      0,
      PORT_Y + 40,
      BODY_Z0 + 44,
    ]);
    const lever = mesh(
      cached('itbLever', () => alongZ(rectShape(-7, 7, -34, 6, 4), 0, 7)),
      M.steelBright,
      `ITB_Lever_${i + 1}`,
      g
    );
    lever.position.set(0, PORT_Y, BODY_Z0 + 44);
  }
  out.bodies = bodies;
  out.plates = plates;

  // the common throttle shaft and the linkage rod across all six
  const shaft = new THREE.Group();
  shaft.name = 'THROTTLE_SHAFT';
  const shaftGeo = cached('itbShaft', () => {
    const g = new THREE.CylinderGeometry(5, 5, K.BLOCK_LENGTH + 40, 16);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  mesh(shaftGeo, M.steelBright, 'ThrottleShaft', shaft, [0, PORT_Y, BODY_Z0 + 34]);
  mesh(shaftGeo, M.steelBright, 'LinkageRod', shaft, [0, PORT_Y + 46, BODY_Z0 + 44]).scale.set(0.7, 0.7, 0.7);
  for (const s of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(10, 10, 16, 18), M.aluCast, `ThrottleBearing_${s}`, shaft, [
      s * (K.HALF_LENGTH + 14),
      PORT_Y,
      BODY_Z0 + 34,
    ]).rotation.z = Math.PI / 2;
  }
  out.shaft = shaft;

  // fuel rail and six injectors pointing into the ports
  const fuel = new THREE.Group();
  fuel.name = 'FUEL_RAIL';
  const railGeo = cached('fuelRail', () => {
    const g = new THREE.CylinderGeometry(13, 13, K.BLOCK_LENGTH - 60, 20);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  mesh(railGeo, M.aluMachined, 'FuelRail', fuel, [0, 330, 34]);
  const injGeo = cached('injector', () => {
    const pts = [
      new THREE.Vector2(0, -30),
      new THREE.Vector2(8, -22),
      new THREE.Vector2(11, -6),
      new THREE.Vector2(11, 20),
      new THREE.Vector2(6, 30),
      new THREE.Vector2(0, 30),
    ];
    const g = new THREE.LatheGeometry(pts, 20);
    g.rotateX(Math.PI / 2);
    return g;
  });
  for (let i = 0; i < K.S54.nCyl; i++) {
    const holder = new THREE.Group();
    holder.name = `Injector_${i + 1}`;
    holder.position.set(K.CYL_X[i], 330, 34);
    holder.rotation.x = RAD(-52);
    fuel.add(holder);
    mesh(injGeo, M.injectorBody, `InjectorBody_${i + 1}`, holder);
    mesh(new THREE.CylinderGeometry(5, 4, 16, 12), M.brass, `InjectorTip_${i + 1}`, holder, [0, 0, 42]);
  }
  out.fuel = fuel;

  // airbox: a box over all six stacks, on its own so it can be lifted off
  const airbox = new THREE.Group();
  airbox.name = 'AIRBOX';
  const boxGeo = cached('airbox', () =>
    alongZ(rectShape(-K.HALF_LENGTH - 10, K.HALF_LENGTH + 10, 232, 344, 26), BODY_Z1 + 44, 76)
  );
  mesh(boxGeo, M.aluCastDark, 'Airbox', airbox);
  mesh(
    cached('airboxLid', () => alongZ(rectShape(-K.HALF_LENGTH - 4, K.HALF_LENGTH + 4, 238, 338, 24), BODY_Z1 + 120, 12)),
    M.blackOxide,
    'AirboxLid',
    airbox
  );
  mesh(
    cached('airboxBoot', () => {
      const g = new THREE.CylinderGeometry(38, 44, 60, 28, 1, true);
      g.rotateZ(Math.PI / 2);
      return g;
    }),
    M.rubber,
    'AirboxInletBoot',
    airbox,
    [-K.HALF_LENGTH - 40, 288, BODY_Z1 + 82]
  );
  mesh(new THREE.CylinderGeometry(56, 50, 26, 28), M.aluCast, 'MAF_Housing', airbox, [
    -K.HALF_LENGTH - 76,
    288,
    BODY_Z1 + 82,
  ]).rotation.z = Math.PI / 2;
  out.airbox = airbox;

  return out;
}

// ---------------------------------------------------------------------------
export function buildExhaust(M) {
  const g = new THREE.Group();
  g.name = 'EXHAUST_MANIFOLD';
  const runner = cached('exhRunner', () =>
    new THREE.CylinderGeometry(22, 22, 1, 20, 1, true)
  );
  void runner;
  const COLLECTORS = [-136, 136];
  for (let i = 0; i < K.S54.nCyl; i++) {
    const x = K.CYL_X[i];
    const cx = COLLECTORS[i < 3 ? 0 : 1];
    const pts = [
      new THREE.Vector3(x, PORT_Y, -HEAD_W + 2),
      new THREE.Vector3(x, PORT_Y - 16, -HEAD_W - 54),
      new THREE.Vector3(x * 0.86, 210, -HEAD_W - 108),
      new THREE.Vector3(cx + (x - cx) * 0.28, 140, -HEAD_W - 132),
      new THREE.Vector3(cx, 92, -HEAD_W - 138),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
    const geo = new THREE.TubeGeometry(curve, 48, 21.5, 20, false);
    mesh(geo, M.blackOxide, `ExhaustRunner_${i + 1}`, g);
    // port flange at the head
    mesh(
      cached('exhFlange', () => alongX([[-44, PORT_Y - 30], [44, PORT_Y - 30], [44, PORT_Y + 30], [-44, PORT_Y + 30]], 10)),
      M.blackOxide,
      `ExhaustFlange_${i + 1}`,
      g,
      [x, 0, -HEAD_W - 3]
    );
  }
  for (const cx of COLLECTORS) {
    mesh(
      cached('collector', () => {
        const geo = new THREE.CylinderGeometry(34, 30, 150, 24);
        return geo;
      }),
      M.blackOxide,
      `Collector_${cx > 0 ? 'R' : 'L'}`,
      g,
      [cx, 30, -HEAD_W - 138]
    );
    mesh(
      cached('downpipe', () => {
        const geo = new THREE.CylinderGeometry(30, 30, 120, 24);
        return geo;
      }),
      M.blackOxide,
      `Downpipe_${cx > 0 ? 'R' : 'L'}`,
      g,
      [cx, -80, -HEAD_W - 138]
    );
  }
  return g;
}
