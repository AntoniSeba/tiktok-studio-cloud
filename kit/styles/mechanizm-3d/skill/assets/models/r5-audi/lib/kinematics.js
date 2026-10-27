// kinematics.js - single source of truth for the Audi 2.2 T R5 engine family
// (3B / ABY / AAN / ADU, EA828 "20V turbo"). Pure maths, no three.js import,
// so verify.mjs can import this exact file in node and print the raw numbers
// the report quotes. Nothing in the scene is allowed to invent its own
// geometry: every mesh position comes out of the functions below.
//
// World: X across, Y up, Z along the crankshaft axis, +Z = front (belt end).
// 1 unit = 1 mm. Crank angle 0 = cylinder 1 at TDC of compression.

const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;

// ---------------------------------------------------------------------------
// Verified specification. Every value below carries its source in SOURCES.
// ---------------------------------------------------------------------------
export const SPEC = {
  family: 'Audi EA828 R5 20V turbo',
  displacementCc: 2226,
  bore: 81.0, // mm
  stroke: 86.4, // mm
  cylinders: 5,
  configuration: 'R5 inline, one turbocharger, longitudinal',
  firingOrder: [1, 2, 4, 5, 3],
  blockMaterial: 'żeliwo (cast iron), 6 gniazd łożysk głównych',
  headMaterial: 'aluminium, 20 zaworów, DOHC',
  camDrive: 'pasek zębaty z wału na wałek wydechowy, łańcuszek z wydechowego na dolotowy',
  aspiration: 'jedno turbo KKK (Kühnle, Kopp & Kausch), chłodzone cieczą',
  // CR is version dependent, and the sources themselves disagree for the RS2.
  variants: [
    { code: '3B', years: '1990-1992', cr: 9.3, powerPs: 220, torqueNm: [309, 1950], turbo: 'KKK K24-7000', boostBar: 1.0, head: '20V DOHC' },
    { code: 'ABY', years: '1992-1995', cr: 9.3, powerPs: 230, torqueNm: [350, 1950], turbo: 'KKK K24-7000', boostBar: 1.0, head: '20V DOHC, bez rozdzielacza' },
    { code: 'AAN', years: '1991-1997', cr: 9.3, powerPs: 230, torqueNm: [350, 1950], turbo: 'KKK K24-7000', boostBar: 1.0, head: '20V DOHC, bez rozdzielacza' },
    { code: 'ADU', years: '1994-1996', cr: 9.0, crAlt: 9.3, powerPs: 315, torqueNm: [410, 3000], turbo: 'KKK K24-7200', boostBar: 1.4, head: '20V DOHC (RS2, Porsche)' },
  ],
};

// ---------------------------------------------------------------------------
// Layout. Only bore, stroke, rod length, bore spacing and the wrist pin
// diameter are taken from the sources; the rest is derived from them or is a
// declared approximation (see APPROX below).
// ---------------------------------------------------------------------------
export const LAYOUT = {
  boreSpacing: 88.0,
  crankRadius: 43.2, // SPEC.stroke / 2
  rodLength: 144.0, // centre to centre, 5.670 in
  rodJournalR: 23.9, // 47.758-47.778 mm journal diameter
  mainJournalR: 30.0, // ~60 mm, 6 journals
  mainCount: 6,
  pinR: 11.5, // 23 mm wrist pin
  pistonClearance: 0.06, // piston to bore, radial
  pistonCompressionHeight: 32.8, // deck - r - L: crown flush with the deck at TDC
  pistonHeight: 62.0,
  deckHeight: 220.0, // crank axis to the deck face
  blockLength: 464,
  frontZ: 232,
  rearZ: -232,
  flywheelR: 114,
  ringGearTeeth: 130,
  crankSprocketTeeth: 22,
  camSprocketTeeth: 44, // exactly 2x the crank: the cam must turn at half speed
  valveLift: 9.6,
  // 4 valves in an 81 mm bore: 2 x 30 mm intake and 2 x 27 mm exhaust, the
  // largest that still clear each other and the bore wall. Pair centres sit at
  // z = +/-16 so the two valves of a pair are 32 mm apart.
  valveHeadR: { intake: 15.0, exhaust: 13.5 },
  valveHeadR10v: { intake: 19.0, exhaust: 16.0 },
  valveSpacingZ10v: 20.0, // 10V: one cam, the two valves sit in line at z = -/+20
  valveAxisX: { intake: -19.0, exhaust: 19.0 }, // 20V: two cams, two valve axes
  valvePairZ: 16.0,
  valveAxisX10v: { intake: -19.0, exhaust: 19.0 }, // 10V: one cam, valves either side
  bucketR: 19.0,
  camAboveDeck: 118, // 20V DOHC cam axis above the deck face
  camAboveDeck10v: 92, // 10V SOHC, one cam over the middle of the bore
  camBaseR20v: 20,
  camBaseR10v: 22,
  turboShaftZ: -60,
  turboShaftY: 120,
  turboShaftX: 178,
  wastegateRodX: 246,
};

// Declared approximations, listed here so the report can point at them.
export const APPROX = {
  deckHeight: '220 mm: z literatury dla rodziny, przyjęte; wysokość sprężania 32,8 mm wyliczona tak, żeby korona tłoka była równo z płaszczyzną głowicy w GMP',
  mainJournalR: '30 mm: typowa średnica czopa głównego 2,2 20V, nie potwierdzona pojedynczym źródłem',
  valveEvents: 'rozrząd 10/50-50/10 - przyjęty przebieg, nie fabryczny wykres',
  cams: 'profil krzywki kosinusowy, nie fabryczny profil',
  boost: '1,0 bar dla 3B/AAN/ABY, 1,4 bar dla ADU - wartości typowe z literatury, nie fabryczne',
  turboSpeed: 'prędkość turbiny liczona krzywą wznoszenia, nie z mapy sprężarki',
};

// ---------------------------------------------------------------------------
// Cylinders. Zygzak GMP: cylinder 1 z przodu, odstęp 88 mm. cycleOffset to kąt
// wału, przy którym dany cylinder jest w GMP sprężania, więc odstępy wynikają
// wprost z kolejności zapłonu 1-2-4-5-3 i wynoszą 144 stopnie.
// ---------------------------------------------------------------------------
export const CYLINDERS = [];
{
  const slots = [176, 88, 0, -88, -176]; // indexed by cylinder number - 1
  SPEC.firingOrder.forEach((id, k) => {
    CYLINDERS.push({
      id,
      z: slots[id - 1],
      cycleOffset: k * 144,
      label: `Cylinder_${id}`,
      bank: 'I',
    });
  });
  // journalAngle: the crank throw angle at which this cylinder is at TDC.
  // TDC means the pin points straight up (90 deg), so:
  for (const c of CYLINDERS) c.journalAngle = (((90 + c.cycleOffset) % 360) + 360) % 360;
  CYLINDERS.sort((a, b) => a.id - b.id);
}

export const CRANK_PIN_ANGLES = CYLINDERS.map((c) => c.journalAngle);

// ---------------------------------------------------------------------------
// Slider-crank. theta = 0 at TDC of that cylinder.
// ---------------------------------------------------------------------------
export function wrap720(a) {
  return ((a % 720) + 720) % 720;
}

export function pistonPinDistance(cyl, crankDeg) {
  const r = LAYOUT.crankRadius;
  const L = LAYOUT.rodLength;
  const theta = (cyl.journalAngle - crankDeg - 90) * D2R;
  const s = r * Math.cos(theta) + Math.sqrt(L * L - (r * Math.sin(theta)) ** 2);
  return { s, theta };
}

export function crankPinPosition(cyl, crankDeg) {
  const a = (cyl.journalAngle - crankDeg) * D2R;
  const r = LAYOUT.crankRadius;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r, z: cyl.z };
}

// Rod obliquity: the angle between the rod axis and the bore axis.
export function rodAngle(cyl, crankDeg) {
  const r = LAYOUT.crankRadius;
  const L = LAYOUT.rodLength;
  const theta = (cyl.journalAngle - crankDeg - 90) * D2R;
  return Math.asin((r / L) * Math.sin(theta));
}

export function crankRotation(crankDeg) {
  return -crankDeg * D2R;
}

// ---------------------------------------------------------------------------
// Valvetrain. Cylinder relative crank angle: 0 = TDC start of intake,
// 180 = BDC, 360 = TDC compression (ignition), 540 = BDC, 720 = TDC intake.
// ---------------------------------------------------------------------------
export const VALVE_EVENTS = {
  intake: { open: -10, duration: 240 }, // opens 10 BTDC, closes 50 ABDC
  exhaust: { open: 490, duration: 240 }, // opens 50 BBDC, closes 10 ATDC
};

export function cycleAngle(cyl, crankDeg) {
  return wrap720(crankDeg - cyl.cycleOffset);
}

export function lift(which, phase) {
  const ev = VALVE_EVENTS[which];
  let d = phase - ev.open;
  d = ((d % 720) + 720) % 720;
  if (d > ev.duration) return 0;
  const t = d / ev.duration;
  return LAYOUT.valveLift * 0.5 * (1 - Math.cos(Math.PI * 2 * t));
}

export function camRotation(crankDeg) {
  return -crankDeg / 2; // half crank speed, same direction
}

export function maxLiftCrank(cyl, which) {
  const ev = VALVE_EVENTS[which];
  return cyl.cycleOffset + ev.open + ev.duration / 2;
}

// The lobe geometry has its nose along +X. At max lift the nose must point
// straight down (-90 deg) under the bucket, so the baked phase is:
export function lobePhase(cyl, which) {
  return (-90 + maxLiftCrank(cyl, which) / 2) * D2R;
}

export const STROKES = [
  { key: 'intake', name: 'SSANIE' },
  { key: 'compression', name: 'SPRĘŻANIE' },
  { key: 'power', name: 'PRACA' },
  { key: 'exhaust', name: 'WYDECH' },
];

export function strokeOf(cyl, crankDeg) {
  const p = cycleAngle(cyl, crankDeg);
  return STROKES[Math.min(3, Math.floor(p / 180))];
}

// ---------------------------------------------------------------------------
// Volumes. The crown sits flush with the deck at TDC (see
// pistonCompressionHeight), so the whole clearance volume lives in the head and
// the gasket: Vc = Vd / (CR - 1).
// ---------------------------------------------------------------------------
export const BORE_AREA_MM2 = (Math.PI / 4) * SPEC.bore ** 2; // 5153.0 mm2
export const SWEPT_CC = (BORE_AREA_MM2 * SPEC.stroke) / 1000; // per cylinder

export function sweptVolumeCc() {
  return SWEPT_CC * SPEC.cylinders;
}

export function clearanceVolumeCc(cr = 9.3) {
  return SWEPT_CC / (cr - 1);
}

export function chamberVolumeCc(cyl, crankDeg, cr = 9.3) {
  const { s } = pistonPinDistance(cyl, crankDeg);
  const tdc = LAYOUT.crankRadius + LAYOUT.rodLength;
  return clearanceVolumeCc(cr) + ((tdc - s) * BORE_AREA_MM2) / 1000;
}

// CR measured back out of the geometry alone: chamber volume at BDC divided by
// chamber volume at TDC. It has to land on the number quoted for the version.
export function compressionRatioFromChamber(cyl, cr = 9.3) {
  const vTdc = chamberVolumeCc(cyl, cyl.cycleOffset, cr);
  const vBdc = chamberVolumeCc(cyl, cyl.cycleOffset + 180, cr);
  return vBdc / vTdc;
}

// ---------------------------------------------------------------------------
// Turbocharger. The shaft speed is a function of engine speed and boost only,
// never of the crank angle: the turbine has no mechanical link to the crank,
// so its angle is integrated over elapsed time by the caller.
// ---------------------------------------------------------------------------
export const TURBO = {
  model: 'KKK K24',
  compressorInducer: 56.0, // mm, K24-7000 class
  compressorExducer: 76.0,
  compressorBlades: 6,
  compressorSplitters: 6,
  turbineInducer: 62.0,
  turbineExducer: 50.0,
  turbineBlades: 11,
  shaftR: 8.0,
  voluteR: 62.0,
  maxShaftRpm: 165000,
  spoolStartRpm: 1300,
  spoolFullRpm: 3600,
};

export function spool(rpm) {
  const t = (rpm - TURBO.spoolStartRpm) / (TURBO.spoolFullRpm - TURBO.spoolStartRpm);
  return Math.pow(Math.max(0, Math.min(1, t)), 0.85);
}

export function boostBar(rpm, engine = '3B') {
  const v = SPEC.variants.find((x) => x.code === engine) || SPEC.variants[0];
  return v.boostBar * spool(rpm);
}

export function turboShaftRpm(rpm, engine = '3B') {
  const v = SPEC.variants.find((x) => x.code === engine) || SPEC.variants[0];
  // Boost is wastegate limited, so the shaft speed mostly follows the spool
  // curve and then creeps up slowly with engine speed as the exhaust mass flow
  // keeps rising while the wastegate bleeds the surplus.
  const load = 0.34 + 0.66 * (boostBar(rpm, engine) / v.boostBar || 0);
  const creep = 0.84 + 0.16 * Math.max(0, Math.min(1, (rpm - TURBO.spoolFullRpm) / 3400));
  return 18000 + (TURBO.maxShaftRpm - 18000) * spool(rpm) * load * creep;
}

// Ratio of shaft speed to engine speed. It is not constant, which is the whole
// point: a mechanically driven shaft would have a fixed gear ratio.
export function turboSpeedRatio(rpm, engine = '3B') {
  return turboShaftRpm(rpm, engine) / rpm;
}

// ---------------------------------------------------------------------------
// Ignition. Firing intervals must be 144 deg of crank for an even R5.
// ---------------------------------------------------------------------------
export function firingSchedule() {
  const byAngle = [...CYLINDERS].sort((a, b) => a.cycleOffset - b.cycleOffset);
  return byAngle.map((c, i) => ({
    order: i + 1,
    cylinder: c.id,
    crankDeg: c.cycleOffset,
    interval: i === 0 ? null : c.cycleOffset - byAngle[i - 1].cycleOffset,
  }));
}

// At which crank angles does the spark jump in a 720 deg window?
export function sparkAngles() {
  return CYLINDERS.map((c) => ({ cylinder: c.id, deg: wrap720(c.cycleOffset + 360) })).sort((a, b) => a.deg - b.deg);
}

// ---------------------------------------------------------------------------
// Derived figures used in the report and the HUD.
// ---------------------------------------------------------------------------
export function meanPistonSpeed(rpm) {
  return (2 * SPEC.stroke * rpm) / 60 / 1000; // m/s
}

export function maxRodAngleDeg() {
  return Math.asin(LAYOUT.crankRadius / LAYOUT.rodLength) * R2D;
}

export function pistonPinDistanceRange() {
  const c = CYLINDERS[0];
  let min = Infinity;
  let max = -Infinity;
  let minAt = 0;
  let maxAt = 0;
  for (let d = 0; d < 720; d += 0.25) {
    const { s } = pistonPinDistance(c, d);
    if (s < min) {
      min = s;
      minAt = d;
    }
    if (s > max) {
      max = s;
      maxAt = d;
    }
  }
  return { min, max, minAt, maxAt, stroke: max - min };
}

export function valveCount(headMode = '20v') {
  return headMode === '10v' ? 2 : 4;
}

export function valveCountTotal(headMode = '20v') {
  return valveCount(headMode) * SPEC.cylinders;
}
