// kinematics.js - the whole engine motion, as closed-form maths and nothing
// else. No three.js import, so verify.mjs can import this file straight in node.
//
// 1 unit = 1 mm. The crankshaft centre sits at (y = 0), the cylinder axis is
// vertical (+y), the crankshaft runs along the engine length (+x, cylinder 1 at
// the front, negative x) and the lateral axis is +z (intake side) / -z (exhaust
// side). Every number below that is not a published BMW figure is derived from
// the published ones, and the derivation is printed by verify.mjs.

// --------------------------------------------------------------- S54B32 data
export const S54 = {
  code: 'S54B32',
  bore: 87.0,
  stroke: 91.0,
  rodLength: 139.0, // forged rod, centre to centre
  compressionHeight: 32.3, // piston pin axis to crown
  pitch: 91.0, // bore spacing, cylinders 1..6
  nCyl: 6,
  firingOrder: [1, 5, 3, 6, 2, 4],
  compressionRatio: 11.5,
  redline: 8000,
  peakPowerRpm: 7900,
  peakTorqueRpm: 4900,
  valvesPerCylinder: 4,
  nValves: 24,
  deckClearance: 1.2, // crown to deck at TDC (derived so DECK lands on 218.0)
  crankJournals: { main: 60.0, rod: 45.0 }, // diameters
  counterweights: 12,
  material: 'żeliwo (blok), aluminium (głowica)',
};

// M50B25 (M50TÜ) for comparison: single VANOS on the inlet cam only.
export const M50 = {
  code: 'M50B25',
  bore: 84.0,
  stroke: 75.0,
  rodLength: 135.0,
  compressionHeight: 34.0,
  pitch: 91.0,
  nCyl: 6,
  firingOrder: [1, 5, 3, 6, 2, 4],
  compressionRatio: 10.5,
  redline: 6500,
  camAdjustment: 'VANOS tylko na wałku dolotowym',
};

// -------------------------------------------------------------- valve timing
// Crank degrees, 0 = TDC firing of the cylinder. The opening points are the
// S54 figures BMW M quotes in the workshop data: inlet opens 12 deg BTDC and
// closes 58 deg ABDC (250 deg duration), exhaust opens 52 deg BBDC and closes
// 12 deg ATDC (244 deg duration). Expressed as positive crank angles measured
// from TDC firing these are inlet 348..598 and exhaust 128..372. They are the
// *base* timing; VANOS moves them.
export const CAM = {
  inlet: { open: 348, close: 598, lift: 11.5, duration: 250, label: '12 deg przed GMP, zamyka 58 deg po DMP' },
  exhaust: { open: 128, close: 372, lift: 11.0, duration: 244, label: '52 deg przed DMP, zamyka 12 deg po GMP' },
};

// VANOS travel. The S54 runs stepless double VANOS; the full authority is
// about 40 crank degrees on the inlet cam and 25 on the exhaust cam, which is
// what the slider spans.
export const VANOS = { inletAdvanceCrank: 40, exhaustRetardCrank: 25 };

// ------------------------------------------------------------------ geometry
export const BORE_R = S54.bore / 2;
export const CRANK_R = S54.stroke / 2;
export const DECK = CRANK_R + S54.rodLength + S54.compressionHeight + S54.deckClearance;
export const WALL = S54.pitch - S54.bore; // 4.0 mm: siamese bores
export const END_WALL = 28.0;
export const BLOCK_LENGTH = 2 * END_WALL + S54.nCyl * S54.bore + (S54.nCyl - 1) * WALL;
export const HALF_LENGTH = BLOCK_LENGTH / 2;

// cylinder centre lines along the crankshaft axis
export const CYL_X = Array.from(
  { length: S54.nCyl },
  (_, i) => -HALF_LENGTH + END_WALL + BORE_R + i * S54.pitch
);

// Piston pin phase on the crank, in crank degrees. The order 1-5-3-6-2-4 with
// even 120 degree firing intervals pins this down exactly: a cylinder fires at
// TDC, so its pin phase must equal its firing angle modulo 360.
export const PIN_PHASE = (() => {
  const p = new Array(S54.nCyl).fill(null);
  S54.firingOrder.forEach((cyl, k) => {
    p[cyl - 1] = (k * 120) % 360;
  });
  return p;
})();

// firing angle of each cylinder in the 720 degree cycle
export const FIRE_ANGLE = S54.firingOrder.map((cyl, k) => ({ cyl, angle: k * 120 }));

// ------------------------------------------------------------------- motion
const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => ((r * 180) / Math.PI + 360000) % 360;

// crank angle -> pin angle for one cylinder
export function pinAngle(cyl, crank) {
  return crank - PIN_PHASE[cyl - 1];
}

// piston pin centre height above the crank axis
export function pistonPinY(cyl, crank) {
  const s = Math.sin(rad(pinAngle(cyl, crank)));
  const c = Math.cos(rad(pinAngle(cyl, crank)));
  return CRANK_R * c + Math.sqrt(S54.rodLength * S54.rodLength - CRANK_R * CRANK_R * s * s);
}

// crown height (the surface that closes the chamber)
export function pistonCrownY(cyl, crank) {
  return pistonPinY(cyl, crank) + S54.compressionHeight;
}

// rod small end relative to the crank pin: the angle of the rod axis off vertical
export function rodTilt(cyl, crank) {
  const s = Math.sin(rad(pinAngle(cyl, crank)));
  return Math.asin((CRANK_R * s) / S54.rodLength);
}

// throw of the crank pin in the (y, z) plane of the front view
export function crankPinPos(cyl, crank) {
  const a = rad(pinAngle(cyl, crank));
  return { y: CRANK_R * Math.cos(a), z: CRANK_R * Math.sin(a) };
}

// 0 = TDC firing, 180 = BDC of the power stroke, 360 = TDC overlap, 540 = BDC of intake
export function cyclePhase(cyl, crank) {
  return (((crank - FIRE_ANGLE[cyl - 1].angle) % 720) + 720) % 720;
}
export function strokeIndex(cyl, crank) {
  return Math.floor(cyclePhase(cyl, crank) / 180);
}
export const STROKE_PL = ['PRACA', 'WYDECH', 'SSANIE', 'SPRĘŻANIE'];

// ------------------------------------------------------------------- valving
// Camshaft degrees are half the crank degrees. "vanos" is 0..1: it advances the
// inlet cam and retards the exhaust cam by the VANOS travel above.
export function camAngle(crank) {
  return crank / 2;
}
export function camPhaseOffset(bank, vanos) {
  // inlet: advance (opens earlier => smaller cam angle)
  // exhaust: retard (closes later => larger cam angle)
  if (bank === 'inlet') return -(VANOS.inletAdvanceCrank * vanos) / 2;
  return (VANOS.exhaustRetardCrank * vanos) / 2;
}
export function valveEvent(bank, vanos = 0) {
  const off = camPhaseOffset(bank, vanos);
  const e = CAM[bank];
  return { open: e.open / 2 + off, close: e.close / 2 + off, duration: e.duration / 2, lift: e.lift };
}
// smooth cam nose: flat on top, zero slope at both ends of the event
function nose(x) {
  if (x <= 0 || x >= 1) return 0;
  return Math.pow(0.5 - 0.5 * Math.cos(2 * Math.PI * x), 0.55);
}
export function valveLift(bank, crank, vanos = 0) {
  const ev = valveEvent(bank, vanos);
  const a = camAngle(crank);
  const x = (((a - ev.open) % 360) + 360) % 360;
  if (x >= ev.duration) return 0;
  return ev.lift * nose(x / ev.duration);
}
// throttle: 0 = closed, 1 = wide open; plate turns 0..80 degrees
export function throttlePlateAngle(throttle) {
  return 80 * throttle;
}

// ------------------------------------------------------------------- volumes
export const PISTON_AREA = (Math.PI / 4) * S54.bore * S54.bore; // mm^2
export function sweptVolumePerCyl() {
  return (PISTON_AREA * (pistonPinY(1, 0) - pistonPinY(1, 180))) / 1000; // cm^3
}
export function sweptVolumeTotal() {
  return sweptVolumePerCyl() * S54.nCyl;
}
export function sweptVolumePublished(spec) {
  const a = (Math.PI / 4) * spec.bore * spec.bore;
  return (a * spec.stroke * spec.nCyl) / 1000;
}
// chamber volume implied by the published compression ratio
export function impliedClearanceVolume() {
  return sweptVolumePerCyl() / (S54.compressionRatio - 1);
}
// the part of that clearance that lives in the cylinder above the crown
export function deckClearanceVolume() {
  return (PISTON_AREA * S54.deckClearance) / 1000;
}
// what is left has to be the combustion chamber recess in the head
export function chamberVolume() {
  return impliedClearanceVolume() - deckClearanceVolume();
}
export function chamberDepth() {
  return (chamberVolume() * 1000) / PISTON_AREA;
}
export function compressionRatioFromGeometry() {
  return (sweptVolumePerCyl() + impliedClearanceVolume()) / impliedClearanceVolume();
}

// --------------------------------------------------------------------- chain
// Single chain from the crank sprocket to the exhaust cam sprocket, then a
// short chain from the exhaust to the inlet cam sprocket (S54 single chain
// layout). Tooth counts give the 2:1 reduction.
export const CHAIN = { pitch: 9.525, crankTeeth: 19, camTeeth: 38 };
export function sprocketRadius(teeth) {
  return (teeth * CHAIN.pitch) / (2 * Math.PI);
}
export function chainLengthBetween(r1, x1, y1, r2, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const alpha = Math.acos(Math.max(-1, Math.min(1, Math.abs(r2 - r1) / d)));
  const tangent = 2 * Math.sqrt(Math.max(0, d * d - (r2 - r1) * (r2 - r1)));
  const wrap1 = Math.PI + 2 * alpha;
  const wrap2 = Math.PI - 2 * alpha;
  return tangent + wrap1 * r1 + wrap2 * r2;
}
export function timingChainLength() {
  const rCrank = sprocketRadius(CHAIN.crankTeeth);
  const rCam = sprocketRadius(CHAIN.camTeeth);
  const main = chainLengthBetween(rCrank, 0, 0, rCam, 0, CAM_Y);
  const secondary = chainLengthBetween(rCam, -CAM_U, CAM_Y, rCam, CAM_U, CAM_Y);
  return { main, secondary, linksMain: Math.round(main / CHAIN.pitch), linksSecondary: Math.round(secondary / CHAIN.pitch) };
}

// ------------------------------------------------------------------ valvetrain
export const VALVE_TILT = 12.0;
export const VALVE_DIAM = { inlet: 31.0, exhaust: 29.0 };
export const VALVE_X = 16.5; // each pair straddles the cylinder axis by this much
export const VALVE_U = 12.5; // lateral seat offset, each side of the split
export const VALVE_LENGTH = 100.0;
export const TAPPET_H = 12.0;
export const CAM_BASE_R = 16.0;
export const CAM_U = VALVE_U + VALVE_LENGTH * Math.sin((VALVE_TILT * Math.PI) / 180); // 33.3

// The pentroof chamber is the last unknown in the clearance volume. Its apex
// height follows from the published 11.5:1: everything else in the clearance
// volume (the deck gap above the crown, the four valve pockets in the piston)
// is geometry, so what is left has to be the roof. Modelling the roof as a tent
// over the bore, apex above the deck and sloping down to the bore edge, gives
// the apex directly. The model then draws that roof, so the picture and the
// compression ratio cannot drift apart.
export const CHAMBER_HALF = 30.0;
export const POCKET = { n: 4, r: 11.0, depth: 1.5 };
export function pocketVolume() {
  return (POCKET.n * Math.PI * POCKET.r * POCKET.r * POCKET.depth) / 1000; // cm^3
}
export function chamberApex() {
  const v = chamberVolume() - pocketVolume(); // cm^3 that has to be in the head
  return (v * 1000) / (CHAMBER_HALF * S54.bore); // mm, tent across z, 87 mm along x
}
export const VALVE_SEAT_Y = DECK + chamberApex() * (1 - VALVE_U / CHAMBER_HALF);
export const CAM_Y = VALVE_SEAT_Y + VALVE_LENGTH * Math.cos((VALVE_TILT * Math.PI) / 180) + TAPPET_H + CAM_BASE_R;

// --------------------------------------------------------------- whole-engine
// Overlap in crank degrees: how long both valves of one cylinder are off the
// seat at the TDC between the exhaust and intake strokes.
export function overlap(crankDeg = 0) {
  const i = valveEvent('inlet', crankDeg);
  const e = valveEvent('exhaust', crankDeg);
  return (e.close - i.open) * 2;
}

// One call returns everything a renderer or a test needs for a crank angle.
export function state(crank, opts = {}) {
  const vanos = opts.vanos ?? 0;
  const throttle = opts.throttle ?? 0.15;
  const cylinders = [];
  for (let c = 1; c <= S54.nCyl; c++) {
    // each cylinder's valves are 120 crank degrees away from the next, so the
    // lift has to be asked for at that cylinder's own angle in the cycle
    const own = crank - FIRE_ANGLE[c - 1].angle;
    cylinders.push({
      cyl: c,
      x: CYL_X[c - 1],
      pinPhase: PIN_PHASE[c - 1],
      pin: crankPinPos(c, crank),
      pinY: pistonPinY(c, crank),
      crownY: pistonCrownY(c, crank),
      rodTilt: rodTilt(c, crank),
      phase: cyclePhase(c, crank),
      stroke: strokeIndex(c, crank),
      strokePl: STROKE_PL[strokeIndex(c, crank)],
      inletLift: valveLift('inlet', own, vanos),
      exhaustLift: valveLift('exhaust', own, vanos),
    });
  }
  return {
    crank,
    cam: camAngle(crank),
    vanos,
    throttle,
    plateAngle: throttlePlateAngle(throttle),
    cylinders,
    firingOrder: S54.firingOrder,
  };
}
