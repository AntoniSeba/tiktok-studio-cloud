// engine.js - the single source of truth for the Toyota 2JZ-GTE. Pure maths, no
// three.js: the browser and scripts/verify.mjs import the same numbers and the
// same formulas, so what you see in the model is what is checked in node.
//
// Published 2JZ-GTE figures used here (Toyota service data / parts books):
//   inline six, 86.0 mm bore x 86.0 mm stroke, 2997 cm3
//   DOHC 24 valves, four per cylinder, mechanical bucket tappets
//   compression ratio 8.5:1, firing order 1-5-3-6-2-4, even 120 deg firing
//   connecting rod 142 mm centre to centre
//   block deck height 219.7 mm (8.65 in), so the piston compression height is
//   219.7 - 43.0 - 142.0 = 34.7 mm, which is the published 1.365 in
//   crankshaft: 7 main bearings, 52 mm rod journals
//   valve head diameters 33.5 mm intake / 29.0 mm exhaust, lift 8.6 mm
//   twin sequential turbochargers (CT20), internal wastegates
//
// World frame: X along the crankshaft (+X = rear, flywheel end), Y up, Z across
// (+Z = intake side, -Z = exhaust / turbo side). Cylinder 1 is at -X.
// 1 three.js unit = 1 mm.

export const mm = (v) => v;

export const SPEC = {
  name: 'Toyota 2JZ-GTE',
  layout: 'R6 24v DOHC twin turbo',
  bore: 86.0,
  stroke: 86.0,
  cylinders: 6,
  displacementCc: 2997,
  compressionRatio: 8.5,
  rodLength: 142.0,
  deckHeight: 219.7,
  compressionHeight: 34.7,
  boreSpacing: 110.0,
  mainJournals: 7,
  mainJournalDia: 62.0,
  rodJournalDia: 52.0,
  rodJournalWidth: 22.0,
  valveIntakeDia: 33.5,
  valveExhaustDia: 29.0,
  valvesPerCylinder: 4,
  valveLift: 8.6,
  camBaseR: 18.0,
  intakeDuration: 232,
  exhaustDuration: 232,
  intakeCentreATDC: 105,
  exhaustCentreBTDC: 110,
  firingOrder: [1, 2, 3],
  firingInterval: 240,
  // JDM rating
  powerPs: 280,
  powerRpm: 5600,
  torqueNm: 435,
  torqueRpm: 3600,
  redlineRpm: 7200,
  turboRatio: 14, // turbine rotational speed / crank speed at full boost
  turboMaxRpm: 130000,
  boostTargetBar: 1.0,
};

export const CRANK_R = SPEC.stroke / 2; // 43.0
export const ROD_L = SPEC.rodLength; // 142.0

// ------------------------------------------------------------------ layout
// Every part file reads its heights from here. Keeping them in one place is
// what lets verify.mjs reason about the real geometry instead of a copy of it.
export const L = {
  deckY: SPEC.deckHeight, // 219.7 top of the block
  boreR: SPEC.bore / 2, // 43
  linerR: SPEC.bore / 2 + 5, // 48 barrel outer wall
  linerBottomY: 70,
  // block / crankcase
  blockHalfZ: 105, // splash plane: side walls sit outside this
  blockWallZ: 128,
  blockXFront: -170,
  blockXRear: 170,
  crankcaseBottomY: -96,
  capBottomY: -132,
  panBottomY: -178,
  // rotating assembly
  pistonCrownAtTdcY: SPEC.deckHeight - 0.5, // 219.2 deck clearance
  pistonSkirtH: 52,
  ringLandY: [-7, -12, -17], // ring grooves below the crown
  rodSmallEndR: 11,
  rodBigEndR: 31,
  // head
  chamberDepth: 7.75, // flat chamber recess in the head -> see chamberVolume()
  chamberRoofY: SPEC.deckHeight + 7.75, // 227.45
  valveSeatY: SPEC.deckHeight + 8.7,
  valveHeadThickness: 6.5,
  valveStemR: 3.0,
  valvesPerCam: 2,
  valveXOffset: 20, // the two same-side valves sit +-20 mm along the bore
  intakeZ: 22,
  exhaustZ: -22,
  valveTipY: 338, // stem tip at zero lift
  bucketH: 25,
  bucketR: 17.5,
  camY: 381, // camshaft axis height above the crank axis
  camJournalR: 13,
  springSeatY: 299,
  springTopY: 335,
  guideTopY: 298,
  deckSlabTopY: 245,
  headTopY: 403,
  coverTopY: 432,
  portRunnerR: 21, // intake port diameter
  // timing drive
  timingPlateX: -195, // front face of the block, behind the belt
  camSprocketX: -217,
  crankSprocketX: -382,
  crankSprocketR: 36,
  camSprocketR: 72, // exactly twice the crank sprocket: half speed
  crankTeeth: 24,
  camTeeth: 48,
  beltPulleyX: -235,
  // turbochargers
  turboX: [0],
  turboY: 46,
  turboZ: -196,
  turbineWheelR: 30,
  compressorWheelR: 33,
  compressorInletR: 27,
  // accessories / charge cooling
  icX: -305,
  icSize: [60, 170, 440], // X thickness, Y height, Z width
  accX: -239,
};

// ------------------------------------------------------------------ timing
// The firing order is the published figure, and everything else is derived from
// it: cylinder FIRE_ORDER[k] fires at crank angle 120*k, and its crank pin must
// therefore be at TDC (pin at top) at that instant. Cylinders sharing a pin are
// 360 degrees apart in the 720 degree cycle, which is exactly what an inline six
// crank gives: pins at 0, 240, 120, 120, 240, 0 degrees.
export const FIRE_ORDER = SPEC.firingOrder;

// Crank angle at which each cylinder is at TDC of its firing stroke, 0..720.
export const FIRE_PHASE_DEG = (() => {
  const a = new Array(FIRE_ORDER.length).fill(0);
  FIRE_ORDER.forEach((cyl, k) => {
    a[cyl - 1] = k * SPEC.firingInterval;
  });
  return a;
})();

// Angular position of each crank pin, measured from the pin-1 reference.
export const PIN_OFFSET_DEG = FIRE_PHASE_DEG.map((p) => (((360 - p) % 360) + 360) % 360);

export const CYL_X = FIRE_ORDER.map((_, i) => (i - (FIRE_ORDER.length - 1) / 2) * SPEC.boreSpacing);
// main bearing positions: one at each end and one between every pair of cylinders
export const MAIN_X = Array.from({ length: FIRE_ORDER.length + 1 }, (_, i) => (i - FIRE_ORDER.length / 2) * SPEC.boreSpacing);

export const RAD = Math.PI / 180;
export const wrap = (a, n) => ((a % n) + n) % n;

// ------------------------------------------------------------------ pistons
export function pinOffsetDeg(cyl) {
  return PIN_OFFSET_DEG[cyl - 1];
}

// TDC of firing in the 720 degree cycle for cylinder cyl
export function firePhaseDeg(cyl) {
  return FIRE_PHASE_DEG[cyl - 1];
}

// Piston pin height above the crank axis, straight from the slider-crank
// constraint: r*cos(t) + sqrt(l^2 - (r*sin(t))^2).
export function pistonPinY(thetaDeg, cyl) {
  const t = (thetaDeg + pinOffsetDeg(cyl)) * RAD;
  const r = CRANK_R;
  const s = r * Math.sin(t);
  return r * Math.cos(t) + Math.sqrt(ROD_L * ROD_L - s * s);
}

// Piston crown face. At TDC the crown sits 0.5 mm below the deck, so the crown
// is 34.2 mm above the pin there (219.2 - (43 + 142)); over the cycle it simply
// follows the pin, because the compression height is a property of the piston.
export const PISTON_CROWN_ABOVE_PIN = L.pistonCrownAtTdcY - (CRANK_R + ROD_L);

export function pistonCrownY(thetaDeg, cyl) {
  return pistonPinY(thetaDeg, cyl) + PISTON_CROWN_ABOVE_PIN;
}

// Rod obliquity: the small end swings off the bore axis by asin(r sin t / l).
export function rodAngleDeg(thetaDeg, cyl) {
  const t = (thetaDeg + pinOffsetDeg(cyl)) * RAD;
  const s = (CRANK_R * Math.sin(t)) / ROD_L;
  return Math.asin(Math.max(-1, Math.min(1, s))) / RAD;
}

// Crank pin centre, in the XY plane of the crank axis.
export function crankPinXY(thetaDeg, cyl) {
  const t = (thetaDeg + pinOffsetDeg(cyl)) * RAD;
  return { x: CRANK_R * Math.sin(t), y: CRANK_R * Math.cos(t) };
}

// ------------------------------------------------------------------ valvetrain
// 3-4-5 polynomial lift law: s(0)=0, s(1)=1, zero velocity and acceleration at
// both ends, which is the usual smooth cam approximation. The lobe geometry in
// parts/head.js is generated from this same function, so the drawn lobe and the
// valve law cannot disagree.
export function camLiftLaw(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return 10 * x ** 3 - 15 * x ** 4 + 6 * x ** 5;
}

// Camshaft angle. One full cam turn per two crank turns: 0.5 exactly.
export function camAngleDeg(thetaDeg) {
  return wrap(thetaDeg / 2, 360);
}

// Crank angle of peak lift for one valve of one cylinder.
// which: 'in' | 'ex'
export function valveNoseDeg(cyl, which) {
  const base = firePhaseDeg(cyl) + 360; // TDC at the intake / exhaust exchange
  const nose = which === 'in' ? base + SPEC.intakeCentreATDC : base - SPEC.exhaustCentreBTDC;
  return wrap(nose, 720);
}

export function valveDuration(which) {
  return which === 'in' ? SPEC.intakeDuration : SPEC.exhaustDuration;
}

// Valve lift in mm at a given crank angle. Peak lift happens exactly when the
// cam has turned to the lobe nose, which is the point the geometry aims at.
export function valveLiftMm(thetaDeg, cyl, which) {
  const durCam = valveDuration(which) / 2; // cam degrees
  const half = durCam / 2;
  const local = wrap(camAngleDeg(thetaDeg) - valveNoseDeg(cyl, which) / 2, 360);
  const d = local > 180 ? local - 360 : local;
  if (Math.abs(d) >= half) return 0;
  return SPEC.valveLift * camLiftLaw(1 - Math.abs(d) / half);
}

// Valve head bottom face, i.e. the surface that could meet a piston.
export function valveHeadBottomY(thetaDeg, cyl, which) {
  const rest = L.valveSeatY - L.valveHeadThickness;
  return rest - valveLiftMm(thetaDeg, cyl, which);
}

// Radial profile of one cam lobe around its base circle, as a closed polyline
// in the lobe's own frame (nose pointing along +X of the outline).
export function camLobePoints(baseR = SPEC.camBaseR, samples = 180, which = 'in') {
  const half = valveDuration(which) / 4; // cam degrees, half of the cam event
  const pts = [];
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * 360 - 180; // -180..180 around the nose
    const lift = Math.abs(a) >= half ? 0 : SPEC.valveLift * camLiftLaw(1 - Math.abs(a) / half);
    const r = baseR + lift;
    pts.push([Math.cos(a * RAD) * r, Math.sin(a * RAD) * r]);
  }
  return pts;
}

// ------------------------------------------------------------------ cycle
export const STROKES = ['ssanie', 'sprężanie', 'praca', 'wydech'];

// Index 0 = intake, 1 = compression, 2 = power, 3 = exhaust.
export function cyclePhase(thetaDeg, cyl) {
  const t = wrap(thetaDeg - firePhaseDeg(cyl), 720);
  const idx = Math.floor(wrap(t + 360, 720) / 180) % 4;
  return { index: idx, t: (wrap(t + 360, 720) % 180) / 180 };
}

// ------------------------------------------------------------------ volumes
export function sweptVolumeCc() {
  const a = (Math.PI / 4) * SPEC.bore ** 2; // mm^2
  return (a * SPEC.stroke * SPEC.cylinders) / 1000;
}

export function sweptVolumePerCylinderCc() {
  return sweptVolumeCc() / SPEC.cylinders;
}

// The chamber is modelled as three measurable pieces of the real geometry:
//   1. the recess in the head, bore diameter x chamberDepth
//   2. the dish in the piston crown, dish diameter x dish depth
//   3. the deck clearance volume plus the compressed head gasket
// plus the volume the valve heads displace out of the recess. Those five
// numbers are the ones the parts are built from, so the compression ratio
// below is a measurement of the model, not a copy of the spec sheet.
export const CHAMBER = {
  dishDia: 70.0,
  dishDepth: 3.0,
  gasketThickness: 1.2,
  gasketBore: 87.0,
  clearance: 0.5, // deck clearance at TDC
};

export function chamberVolumeCc() {
  const r = SPEC.bore / 2;
  const recess = Math.PI * r * r * L.chamberDepth;
  const dish = Math.PI * (CHAMBER.dishDia / 2) ** 2 * CHAMBER.dishDepth;
  const clearance = Math.PI * r * r * CHAMBER.clearance;
  const gasket = Math.PI * (CHAMBER.gasketBore / 2) ** 2 * CHAMBER.gasketThickness;
  return (recess + dish + clearance + gasket) / 1000;
}

export function compressionRatio() {
  const vc = chamberVolumeCc();
  return (sweptVolumePerCylinderCc() + vc) / vc;
}

// Piston top face area that the gas pushes on, for a rough force readout.
export function pistonAreaMm2() {
  return Math.PI * (SPEC.bore / 2) ** 2;
}

// ------------------------------------------------------------------ turbo
// Twin CT20s in parallel (the model shows both turbos boosting the same plenum,
// which is how a 2JZ-GTE behaves once the sequential changeover is done).
// spool() is what the exhaust energy delivers; boostBar() is what the wastegate
// lets through, so the two are separate curves and the wastegate starts to
// crack just before the target is reached and is wide open above it.
export const BOOST_RAW = 1.45; // bar of turbine drive available at full spool

export function spool(rpm) {
  return 1 - Math.exp(-((rpm / 2400) ** 2));
}

export function boostBar(rpm) {
  return Math.min(BOOST_RAW * spool(rpm), SPEC.boostTargetBar);
}

export function rawBoostBar(rpm) {
  return BOOST_RAW * spool(rpm);
}

export function wastegateOpen(rpm) {
  const over = BOOST_RAW * spool(rpm) - SPEC.boostTargetBar * 0.92;
  return Math.max(0, Math.min(1, over / (SPEC.boostTargetBar * 0.5)));
}

export function turboRpm(rpm) {
  const s = 1 - Math.exp(-((rpm / 2600) ** 2) * 1.4);
  return Math.min(SPEC.turboMaxRpm, rpm * SPEC.turboRatio * s);
}

// ------------------------------------------------------------------ checks
// Small self-checks that verify.mjs calls: every one of them either returns a
// number that is compared against a published figure or throws.
export function tdcAngle(cyl) {
  // crank angle in the first 360 degrees where the pin is at its highest
  return wrap(-pinOffsetDeg(cyl), 360);
}

export function rodObliquityMaxDeg() {
  return Math.asin(CRANK_R / ROD_L) / RAD;
}
