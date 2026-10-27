// engine.js - the assembly. Everything is one tree of named groups so the page
// can move the two cast shells apart for a section, lift the covers and the
// airbox off, and spin the whole thing from one crank angle.
//
// The split line for the section is the cylinder axis plane (z = 0). The shells
// move, the internals stay: nothing is ever clipped or made transparent.

import * as THREE from 'three';
import * as K from '../kinematics.js';
import { RAD } from './profile.js';
import {
  buildBlock,
  buildHead,
  buildCovers,
  buildTimingCase,
  buildGasket,
  HEAD_W,
} from './static.js';
import { buildCrank, buildRods, buildPistons, updateRotating } from './rotating.js';
import { buildCam, buildValves, buildValvetrainStatics, updateValves } from './valvetrain.js';
import { buildTiming } from './timing.js';
import { buildInduction, buildExhaust } from './induction.js';

export const CUT_TRAVEL = 230; // how far each shell slides for the section

export function buildEngine(M) {
  const root = new THREE.Group();
  root.name = 'ENGINE';
  const shellR = new THREE.Group(); // +z half: the intake side
  shellR.name = 'SHELL_R';
  const shellL = new THREE.Group(); // -z half: the exhaust side
  shellL.name = 'SHELL_L';
  const center = new THREE.Group();
  center.name = 'CENTER';
  root.add(shellR, shellL, center);

  const explode = [];
  const add = (parent, obj, dir, name) => {
    parent.add(obj);
    explode.push({ obj, base: obj.position.toArray(), dir, name: name || obj.name });
    return obj;
  };

  // ---- iron and alloy castings
  const blk = buildBlock(M);
  const blockR = new THREE.Group();
  blockR.name = 'BLOCK_R';
  add(shellR, blockR, [0, 0, 0]);
  blockR.add(blk.right, blk.deckRight, blk.boresRight);
  const blockL = new THREE.Group();
  blockL.name = 'BLOCK_L';
  add(shellL, blockL, [0, 0, 0]);
  blockL.add(blk.left, blk.deckLeft, blk.boresLeft);

  const head = buildHead(M);
  const gasket = buildGasket(M);
  const headR = new THREE.Group();
  headR.name = 'HEAD_R_WRAP';
  add(shellR, headR, [0, 150, 0], 'headR');
  headR.add(head.right, gasket.right);
  const headL = new THREE.Group();
  headL.name = 'HEAD_L_WRAP';
  add(shellL, headL, [0, 150, 0], 'headL');
  headL.add(head.left, gasket.left);

  const covers = buildCovers(M);
  const coverR = new THREE.Group();
  coverR.name = 'COVER_R_WRAP';
  add(shellR, coverR, [0, 300, 0], 'coverR');
  coverR.add(covers.right);
  const coverL = new THREE.Group();
  coverL.name = 'COVER_L_WRAP';
  add(shellL, coverL, [0, 300, 0], 'coverL');
  coverL.add(covers.left);

  // ---- crankcase internals: bulkheads, sump, bearing caps
  const sump = new THREE.Group();
  sump.name = 'SUMP_WRAP';
  add(center, sump, [0, -160, 0], 'sump');
  sump.add(blk.bulkheads, blk.pan);

  // ---- rotating assembly
  const crank = buildCrank(M);
  const rods = buildRods(M);
  const pistons = buildPistons(M);
  add(center, crank, [0, 0, 0]);
  rods.forEach((r, i) => center.add(r));
  pistons.forEach((p) => center.add(p));

  // ---- valvetrain
  const camIn = buildCam(M, 'inlet');
  const camEx = buildCam(M, 'exhaust');
  add(center, camIn, [0, 120, 0], 'camIn');
  add(center, camEx, [0, 120, 0], 'camEx');
  const vStatics = buildValvetrainStatics(M);
  center.add(vStatics);
  const valves = buildValves(M);
  for (const v of valves) center.add(v.group);
  for (const v of valves) v.baseY = v.group.position.y;

  // ---- timing drive and VANOS
  const timing = buildTiming(M);
  const timingWrap = new THREE.Group();
  timingWrap.name = 'TIMING_WRAP';
  add(center, timingWrap, [-170, 0, 0], 'timing');
  timingWrap.add(timing.group);

  // ---- induction (intake side) and exhaust (exhaust side)
  const ind = buildInduction(M);
  const intakeR = new THREE.Group();
  intakeR.name = 'INTAKE_WRAP';
  add(shellR, intakeR, [0, 0, 130], 'intake');
  intakeR.add(ind.bodies, ind.shaft, ind.fuel);
  const airbox = new THREE.Group();
  airbox.name = 'AIRBOX_WRAP';
  add(shellR, airbox, [0, 40, 190], 'airbox');
  airbox.add(ind.airbox);

  const exhaust = buildExhaust(M);
  const exhaustL = new THREE.Group();
  exhaustL.name = 'EXHAUST_WRAP';
  add(shellL, exhaustL, [0, -60, -140], 'exhaust');
  exhaustL.add(exhaust);

  const timingCase = buildTimingCase(M);
  const caseWrap = new THREE.Group();
  caseWrap.name = 'CASE_WRAP';
  add(center, caseWrap, [-360, 0, 0], 'timingCase');
  caseWrap.add(timingCase);

  // ---- engine mounts and ancillaries, so the block reads as an installed engine
  const anc = new THREE.Group();
  anc.name = 'ANCILLARIES';
  center.add(anc);
  for (const s of [-1, 1]) {
    const mnt = new THREE.Group();
    mnt.name = `EngineMount_${s > 0 ? 'R' : 'L'}`;
    mnt.position.set(40, -30, s * 96);
    anc.add(mnt);
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(120, 26, 12),
      M.ironBlockDark
    );
    plate.name = 'MountPlate';
    plate.castShadow = true;
    mnt.add(plate);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 60, 18), M.aluCast);
    arm.name = 'MountArm';
    arm.rotation.x = Math.PI / 2;
    arm.position.set(0, -8, s * 30);
    arm.castShadow = true;
    mnt.add(arm);
  }
  // oil filter housing and water pump on the exhaust side of the block
  const ofh = new THREE.Group();
  ofh.name = 'OIL_FILTER_HOUSING';
  ofh.position.set(-150, 40, -118);
  anc.add(ofh);
  const ofhBody = new THREE.Mesh(new THREE.CylinderGeometry(46, 52, 74, 28), M.aluCast);
  ofhBody.name = 'OilFilterHousing';
  ofhBody.rotation.x = Math.PI / 2;
  ofhBody.castShadow = true;
  ofh.add(ofhBody);
  const filt = new THREE.Mesh(new THREE.CylinderGeometry(42, 42, 84, 24), M.aluCastDark);
  filt.name = 'OilFilter';
  filt.rotation.x = Math.PI / 2;
  filt.position.z = -60;
  filt.castShadow = true;
  ofh.add(filt);

  const wp = new THREE.Group();
  wp.name = 'WATER_PUMP';
  wp.position.set(-K.HALF_LENGTH - 40, -10, -40);
  anc.add(wp);
  const wpBody = new THREE.Mesh(new THREE.CylinderGeometry(44, 46, 70, 28), M.aluCast);
  wpBody.name = 'WaterPumpBody';
  wpBody.rotation.z = Math.PI / 2;
  wpBody.castShadow = true;
  wp.add(wpBody);
  const wpPulley = new THREE.Mesh(new THREE.CylinderGeometry(58, 58, 18, 32), M.blackOxide);
  wpPulley.name = 'WaterPumpPulley';
  wpPulley.rotation.z = Math.PI / 2;
  wpPulley.position.x = -52;
  wpPulley.castShadow = true;
  wp.add(wpPulley);

  // ---- per cylinder ignition: one coil per plug, on top of the plug
  const ignition = new THREE.Group();
  ignition.name = 'IGNITION';
  center.add(ignition);
  for (let c = 0; c < K.S54.nCyl; c++) {
    const holder = new THREE.Group();
    holder.name = `Coil_${c + 1}`;
    holder.position.set(K.CYL_X[c], K.CAM_Y - 2, 0);
    ignition.add(holder);
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 96, 20), M.blackOxide);
    coil.name = `CoilBody_${c + 1}`;
    coil.castShadow = true;
    holder.add(coil);
    const plugTop = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 30, 16), M.ceramic);
    plugTop.position.y = -70;
    holder.add(plugTop);
  }
  explode.push({ obj: ignition, base: ignition.position.toArray(), dir: [0, 90, 0], name: 'coils' });

  // ---------------------------------------------------------------- update
  const parts = {
    root,
    shellR,
    shellL,
    center,
    crank,
    rods,
    pistons,
    valves,
    camIn,
    camEx,
    plates: ind.plates,
    chains: timing.chains,
    vanosPistons: timing.pistons,
    groups: { blk, head, covers, ind, exhaust, timing, timingCase, anc },
  };

  function update(st, o = {}) {
    const cut = o.cut ?? 0;
    const ex = o.explode ?? 0;
    shellR.position.z = cut * CUT_TRAVEL;
    shellL.position.z = -cut * CUT_TRAVEL;
    for (const e of explode) {
      e.obj.position.set(
        e.base[0] + e.dir[0] * ex,
        e.base[1] + e.dir[1] * ex,
        e.base[2] + e.dir[2] * ex
      );
    }
    updateRotating({ crank, rods, pistons }, st);
    updateValves(valves, st);
    const camR = RAD(K.camAngle(st.crank) - K.camPhaseOffset('inlet', st.vanos));
    const camE = RAD(K.camAngle(st.crank) - K.camPhaseOffset('exhaust', st.vanos));
    camIn.rotation.x = camR;
    camEx.rotation.x = camE;
    const plateAngle = RAD(st.plateAngle);
    for (const p of ind.plates) p.rotation.x = plateAngle;
    ind.shaft.rotation.x = plateAngle * 0.35;
    timing.pistons.forEach((p, i) => {
      p.position.x = (i === 0 ? -1 : 1) * st.vanos * 26;
    });
    // the chain advances by the crank sprocket's surface speed
    const rCrank = K.sprocketRadius(K.CHAIN.crankTeeth);
    const travel = (st.crank / 360) * 2 * Math.PI * rCrank;
    timing.chains[0].advance(travel);
    timing.chains[1].advance(travel);
  }

  return { root, parts, update, explode };
}
