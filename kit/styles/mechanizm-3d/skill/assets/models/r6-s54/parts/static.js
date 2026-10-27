// static.js - the castings that never move relative to each other: the block
// halves, the closed deck, the siamese bore casting, the head halves, the
// magnesium valve cover, the sump and the timing case.
//
// The split line for the section view is the cylinder axis plane (z = 0), so
// the two shells are real castings cut in half, not one solid part that has
// been hidden. Nothing is ever made see-through.

import * as THREE from 'three';
import * as K from '../kinematics.js';
import { alongX, alongY, tube, slab, circle, mesh } from './profile.js';

export const HALF_W_TOP = 66.0; // block width across the water jacket
export const HALF_W_BOT = 102.0; // block width across the crankcase
export const CRANKCASE_R = 92.5; // inner wall of the crankcase
export const HEAD_W = 72.0; // head width on each side of the split
export const HEAD_TOP = 388.0;
export const COVER_TOP = 424.0;
export const PAN_BOTTOM = -152.0;
export const BORE_SLEEVE_R = K.S54.pitch / 2; // 45.5: siamese, wall 2 mm

// The seven main bearing bulkheads sit halfway between the crankpins.
export const MAIN_X = [-273, -182, -91, 0, 91, 182, 273];

// ---------------------------------------------------------------------------
// block shell: one half of the iron casting. The cross-section is a constant
// wall that flares out from the water jacket to the crankcase.
function blockHalfProfile() {
  return [
    [56.5, K.DECK],
    [HALF_W_TOP, K.DECK],
    [HALF_W_TOP, 60],
    [HALF_W_BOT, 18],
    [HALF_W_BOT, -70],
    [CRANKCASE_R, -70],
    [CRANKCASE_R, 10],
    [56.5, 52],
  ];
}

export function buildBlock(M) {
  const out = {};

  const shellGeo = alongX(blockHalfProfile(), K.BLOCK_LENGTH + 6);
  const right = new THREE.Group();
  right.name = 'BLOCK_SHELL_R';
  mesh(shellGeo, M.ironBlock, 'BlockShell_R', right, [0, 0, 0]);
  const left = new THREE.Group();
  left.name = 'BLOCK_SHELL_L';
  const m = mesh(shellGeo, M.ironBlock, 'BlockShell_L', left, [0, 0, 0]);
  m.scale.z = -1;
  out.right = right;
  out.left = left;

  // closed deck: a full-width plate with six round bores through it. Split down
  // the cylinder axis plane like everything else.
  const deckPts = (side) => {
    const p = [];
    const x0 = -K.HALF_LENGTH - 3;
    const x1 = K.HALF_LENGTH + 3;
    const z1 = HALF_W_TOP;
    p.push([x0, side * 0]);
    for (let i = 0; i < K.CYL_X.length; i++) {
      const cx = K.CYL_X[i];
      if (side > 0) {
        p.push([cx - K.BORE_R, 0]);
        p.push([cx, K.BORE_R]);
        p.push([cx + K.BORE_R, 0]);
      } else {
        p.push([cx + K.BORE_R, 0]);
        p.push([cx, -K.BORE_R]);
        p.push([cx - K.BORE_R, 0]);
      }
    }
    p.push([x1, 0]);
    p.push([x1, side * z1]);
    p.push([x0, side * z1]);
    return p;
  };
  const deckGeo = (side) => alongY(deckPts(side), 205, 13);
  const deckR = new THREE.Group();
  deckR.name = 'DECK_R';
  mesh(deckGeo(1), M.ironBlockDark, 'Deck_R', deckR);
  const deckL = new THREE.Group();
  deckL.name = 'DECK_L';
  mesh(deckGeo(-1), M.ironBlockDark, 'Deck_L', deckL);
  out.deckRight = deckR;
  out.deckLeft = deckL;

  // siamese bore casting: six bores 87 mm on a 91 mm pitch, so the wall between
  // two neighbours is 2 mm. Cut in half down the cylinder axis plane.
  const boreGeo = (side) => {
    const phi = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    const g = tube(K.BORE_R, BORE_SLEEVE_R, 40, 206, 40, phi, Math.PI);
    return g;
  };
  const boreR = new THREE.Group();
  boreR.name = 'BORES_R';
  const boreL = new THREE.Group();
  boreL.name = 'BORES_L';
  K.CYL_X.forEach((x, i) => {
    const a = mesh(boreGeo(1), M.boreHone, `Bore_${i + 1}_R`, boreR, [x, 0, 0]);
    a.material = M.boreHone;
    mesh(boreGeo(-1), M.boreHone, `Bore_${i + 1}_L`, boreL, [x, 0, 0]);
  });
  out.boresRight = boreR;
  out.boresLeft = boreL;

  // pan rail bolting bosses, main bearing bulkheads, oil pan
  const panPts = [
    [-HALF_W_TOP - 4, -70],
    [HALF_W_TOP + 4, -70],
    [HALF_W_TOP + 4, -96],
    [HALF_W_BOT - 6, -120],
    [HALF_W_BOT - 46, -120],
    [HALF_W_BOT - 46, PAN_BOTTOM],
    [-(HALF_W_BOT - 46), PAN_BOTTOM],
    [-(HALF_W_BOT - 46), -120],
    [-(HALF_W_BOT - 6), -120],
    [-(HALF_W_TOP + 4), -96],
    [-(HALF_W_TOP + 4), -70],
  ];
  const pan = new THREE.Group();
  pan.name = 'OIL_PAN';
  mesh(alongX(panPts, K.BLOCK_LENGTH - 40), M.aluCastDark, 'OilPan', pan);
  mesh(new THREE.CylinderGeometry(9, 9, 14, 18), M.blackOxide, 'DrainPlug', pan, [0, PAN_BOTTOM - 3, 40]);
  out.pan = pan;

  // main bearing bulkheads: the webs the crankshaft is bolted into
  const bulkheads = new THREE.Group();
  bulkheads.name = 'BULKHEADS';
  const webPts = [
    [0, 46],
    [CRANKCASE_R, 46],
    [CRANKCASE_R, -20],
    [0, -20],
  ];
  const capPts = [
    [0, -16],
    [46, -16],
    [46, -64],
    [0, -64],
  ];
  MAIN_X.forEach((x, i) => {
    mesh(alongX(webPts, 15), M.ironBlockDark, `Bulkhead_${i + 1}`, bulkheads, [x, 0, 0]);
    const cap = mesh(alongX(capPts, 116), M.ironBlockDark, `MainCap_${i + 1}`, bulkheads, [x, 0, 0]);
    cap.scale.z = -1;
    for (const s of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(6, 6, 30, 12), M.blackOxide, `MainBolt_${i + 1}_${s}`, bulkheads, [
        x,
        -58,
        s * 30,
      ]);
    }
  });
  out.bulkheads = bulkheads;

  return out;
}

// ---------------------------------------------------------------------------
// cylinder head: alloy, DOHC 24v, with the inlet ports on +z and the exhaust
// ports on -z. The chamber is a pentroof whose apex height is whatever the
// published clearance volume leaves, so the compression ratio and the model
// cannot disagree.
export function buildHead(M) {
  const CH = K.chamberApex();
  const CHAMBER_HALF = K.CHAMBER_HALF;
  const PORT_Y0 = 244.0;
  const PORT_Y1 = 276.0;
  const PORT_OUT0 = 268.0;
  const PORT_OUT1 = 306.0;
  const PORT_IN = 20.0;

  const borePts = (side) => {
    // inlet side (+z) has the inlet port, exhaust side (-z) the exhaust port
    return [
      [0, K.DECK + CH],
      [side * CHAMBER_HALF, K.DECK],
      [side * HEAD_W, K.DECK],
      [side * HEAD_W, PORT_OUT0],
      [side * PORT_IN, PORT_Y0],
      [side * PORT_IN, PORT_Y1],
      [side * HEAD_W, PORT_OUT1],
      [side * HEAD_W, HEAD_TOP],
      [0, HEAD_TOP],
    ];
  };
  const wallPts = (side) => [
    [0, K.DECK],
    [side * HEAD_W, K.DECK],
    [side * HEAD_W, HEAD_TOP],
    [0, HEAD_TOP],
  ];

  const out = { left: new THREE.Group(), right: new THREE.Group() };
  out.left.name = 'HEAD_L';
  out.right.name = 'HEAD_R';

  const deckPlate = (side) => {
    const p = [];
    const x0 = -K.HALF_LENGTH - 3;
    const x1 = K.HALF_LENGTH + 3;
    p.push([x0, 0]);
    K.CYL_X.forEach((cx) => {
      p.push([cx - K.BORE_R, 0]);
      p.push([cx, side * K.BORE_R]);
      p.push([cx + K.BORE_R, 0]);
    });
    p.push([x1, 0]);
    p.push([x1, side * HEAD_W]);
    p.push([x0, side * HEAD_W]);
    return p;
  };
  // the head's bottom face covers the full width, with six round chamber
  // openings in it, so the head is a single casting per side again
  const bottom = (side) => alongY(deckPlate(side), K.DECK, 3.0);

  // stacked sections along the engine axis: bore sections carry the chamber and
  // the port, wall sections are solid with the water jacket behind them
  const seq = [];
  seq.push({ type: 'wall', x0: -K.HALF_LENGTH - 3, x1: -K.HALF_LENGTH + 25 });
  K.CYL_X.forEach((cx, i) => {
    seq.push({ type: 'bore', x0: cx - K.BORE_R, x1: cx + K.BORE_R });
    if (i < K.CYL_X.length - 1) seq.push({ type: 'wall', x0: cx + K.BORE_R, x1: cx + K.BORE_R + K.WALL });
  });
  seq.push({ type: 'wall', x0: K.CYL_X[5] + K.BORE_R, x1: K.HALF_LENGTH + 3 });

  for (const side of [1, -1]) {
    const g = side > 0 ? out.right : out.left;
    for (const s of seq) {
      const len = s.x1 - s.x0;
      const p = s.type === 'bore' ? borePts(side) : wallPts(side);
      const geo = alongX(p, len);
      const m = mesh(geo, M.aluCast, `Head_${side > 0 ? 'R' : 'L'}_${s.x0.toFixed(0)}`, g, [
        (s.x0 + s.x1) / 2,
        0,
        0,
      ]);
      if (side < 0) m.scale.z = -1;
    }
    const bm = mesh(bottom(side), M.aluCast, `HeadBottom_${side > 0 ? 'R' : 'L'}`, g);
    if (side < 0) bm.scale.z = -1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// valve cover (magnesium on an S54) and the timing case at the front
export function buildCovers(M) {
  const mk = (side) => {
    const g = new THREE.Group();
    const p = [
      [side * HEAD_W, HEAD_TOP - 3],
      [side * (HEAD_W - 3), COVER_TOP - 16],
      [side * (HEAD_W - 12), COVER_TOP - 3],
      [side * (HEAD_W - 22), COVER_TOP],
      [0, COVER_TOP],
      [0, HEAD_TOP - 3],
    ];
    return { group: g, pts: p };
  };
  const right = mk(1);
  const left = mk(-1);
  right.group.name = 'COVER_R';
  left.group.name = 'COVER_L';
  const geoR = alongX(right.pts, K.BLOCK_LENGTH - 16);
  mesh(geoR, M.magnesium, 'ValveCover_R', right.group, [4, 0, 0]);
  const geoL = alongX(left.pts, K.BLOCK_LENGTH - 16);
  const ml = mesh(geoL, M.magnesium, 'ValveCover_L', left.group, [4, 0, 0]);
  ml.scale.z = -1;
  // oil filler cap on one cover
  mesh(new THREE.CylinderGeometry(20, 22, 12, 24), M.blackOxide, 'OilFillerCap', right.group, [180, COVER_TOP + 4, 24]);
  return { right: right.group, left: left.group };
}

// front timing case: slides off whole, which is what opens the chain drive up
export function buildTimingCase(M) {
  const g = new THREE.Group();
  g.name = 'TIMING_CASE';
  const pts = [
    [0, K.DECK + 6],
    [HEAD_W + 4, K.DECK + 6],
    [HEAD_W + 4, HEAD_TOP + 34],
    [0, HEAD_TOP + 34],
    [0, K.DECK + 6],
  ];
  const top = alongX(pts, 26);
  const mt = mesh(top, M.aluCast, 'TimingCase_Upper', g, [-K.HALF_LENGTH - 12, 0, 0]);
  mt.scale.z = -1;
  const low = alongX(
    [
      [0, K.DECK + 6],
      [HEAD_W, K.DECK + 6],
      [HEAD_W, -70],
      [74, -74],
      [74, -74],
      [0, -70],
    ],
    26
  );
  const ml = mesh(low, M.aluCast, 'TimingCase_Lower', g, [-K.HALF_LENGTH - 12, 0, 0]);
  ml.scale.z = -1;
  const low2 = alongX(
    [
      [0, K.DECK + 6],
      [HEAD_W, K.DECK + 6],
      [HEAD_W, -70],
      [74, -74],
      [0, -70],
    ],
    26
  );
  const ml2 = mesh(low2, M.aluCast, 'TimingCase_Lower2', g, [-K.HALF_LENGTH - 12, 0, 0]);
  ml2.scale.z = -1;
  return g;
}

// head gasket: composite, with the six bores punched through
export function buildGasket(M) {
  const out = { right: new THREE.Group(), left: new THREE.Group() };
  out.right.name = 'GASKET_R';
  out.left.name = 'GASKET_L';
  for (const side of [1, -1]) {
    const p = [];
    const x0 = -K.HALF_LENGTH - 3;
    const x1 = K.HALF_LENGTH + 3;
    p.push([x0, 0]);
    K.CYL_X.forEach((cx) => {
      p.push([cx - K.BORE_R, 0]);
      p.push([cx, side * K.BORE_R]);
      p.push([cx + K.BORE_R, 0]);
    });
    p.push([x1, 0]);
    p.push([x1, side * (HEAD_W + 2)]);
    p.push([x0, side * (HEAD_W + 2)]);
    const m = mesh(alongY(p, K.DECK - 0.9, 1.8), M.gasket, `HeadGasket_${side > 0 ? 'R' : 'L'}`, side > 0 ? out.right : out.left);
    if (side < 0) m.scale.z = -1;
  }
  return out;
}
