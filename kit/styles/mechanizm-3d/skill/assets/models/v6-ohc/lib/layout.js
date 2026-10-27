// layout.js - the single source of truth for a 60 degree V6.
// Architecture follows a modern light-truck V6: 60 degree included angle,
// bore 94 mm, stroke 85 mm, 148 mm rods, 108 mm bore spacing, deck height
// 210 mm measured along the bore axis. 6 cylinders, 12 valves, one overhead
// cam per bank, chain driven from the crank.
//
// World: X across, Y up, Z along the crank axis, +Z = front (belt end).
// Bank-local frames: +Y up the bore axis, +X outboard, Z along the crank.

export const LAYOUT = {
  bankTilt: 30, // each bank 30 deg off vertical -> 60 deg included angle
  deckHeight: 210,
  boreSpacing: 108,
  bore: 94,
  stroke: 85,
  rodLength: 148,
  crankRadius: 42.5,
  mainJournalR: 30,
  rodJournalR: 25,
  journalSplit: 60, // degrees between the two journals on one crankpin
  pistonHeight: 58,

  blockLength: 380,
  frontZ: 190,
  rearZ: -190,

  headThickness: 92,
  headLength: 350,
  headWidth: 148,
  camAboveDeck: 112, // cam axis above the deck face, bank-local
  valveLift: 11,
  valveHeadR: 19,
  bucketR: 20,
  valveZOffsets: { intake: 24, exhaust: -24 },

  chainZ: 214,
  beltZ: 300,

  // casting cross-section control points (world XY)
  casting: {
    railX: 100,
    railY: -85,
    cavityX: 88,
    cavityTop: 95,
    wallX: 95,
    wallY: 24.6,
    deckOuter: [130.6, 86.2],
    deckInner: [11.1, 155.2],
    valleyApex: [0, 140],
    deckPlate: { x: [-68, 72], y: [140, 210] },
  },
};

// Cylinder table. Bank R = cylinders 1,3,5; bank L = 2,4,6 (front to rear).
// cycleOffset = crank angle at which that cylinder is at TDC of compression
// (equivalently the start of its intake stroke), giving even 120 deg firing.
const Z_SLOTS = [108, 0, -108];
export const CYLINDERS = [];
for (let i = 0; i < 3; i++) {
  CYLINDERS.push({
    id: i * 2 + 1,
    bank: 'R',
    z: Z_SLOTS[i],
    cycleOffset: i * 240,
    label: `Cylinder_${i * 2 + 1}_R`,
  });
  CYLINDERS.push({
    id: i * 2 + 2,
    bank: 'L',
    z: Z_SLOTS[i],
    cycleOffset: i * 240 + 120,
    label: `Cylinder_${i * 2 + 2}_L`,
  });
}
// journal angle (crank throw) per cylinder, derived so that the piston reaches
// TDC of compression exactly at cycleOffset. Pairs sharing a pin end up with a
// 60 deg split, which is what makes an even-firing 60 degree V6 work.
export const BANK_WORLD_ANGLE = { R: 90 - LAYOUT.bankTilt, L: 90 + LAYOUT.bankTilt };
export const BANK_ROT_Z = { R: -LAYOUT.bankTilt * (Math.PI / 180), L: LAYOUT.bankTilt * (Math.PI / 180) };
export const BANK_DIR = {
  R: { x: Math.cos((BANK_WORLD_ANGLE.R * Math.PI) / 180), y: Math.sin((BANK_WORLD_ANGLE.R * Math.PI) / 180) },
  L: { x: Math.cos((BANK_WORLD_ANGLE.L * Math.PI) / 180), y: Math.sin((BANK_WORLD_ANGLE.L * Math.PI) / 180) },
};
for (const c of CYLINDERS) {
  c.journalAngle = ((BANK_WORLD_ANGLE[c.bank] - c.cycleOffset) % 360 + 360) % 360;
}

export const MAIN_Z = [-162, -54, 54, 162];
export const FIRING_ORDER = [1, 2, 3, 4, 5, 6];

const D2R = Math.PI / 180;
const wrap720 = (a) => ((a % 720) + 720) % 720;

// Slider-crank: piston pin distance from the crank centre along the bore axis.
// crankDeg increases in the direction a real engine turns: clockwise seen from
// the front of the engine (+Z looking back), hence the minus signs.
export function pistonPinDistance(cyl, crankDeg) {
  const r = LAYOUT.crankRadius;
  const L = LAYOUT.rodLength;
  const theta = (cyl.journalAngle - crankDeg - BANK_WORLD_ANGLE[cyl.bank]) * D2R;
  const s = r * Math.cos(theta) + Math.sqrt(L * L - (r * Math.sin(theta)) ** 2);
  return { s, theta };
}

export function crankPinPosition(cyl, crankDeg) {
  const a = (cyl.journalAngle - crankDeg) * D2R;
  const r = LAYOUT.crankRadius;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r, z: cyl.z };
}

export function crankRotation(crankDeg) {
  return -crankDeg * D2R;
}

// ---------------------------------------------------------------- valve timing
// Cylinder-relative crank angle: 0 = TDC start of intake, 180 = BDC,
// 360 = TDC compression (ignition), 540 = BDC, 720 = TDC start of intake.
export const VALVE_EVENTS = {
  intake: { open: -10, duration: 240 }, // opens 10 deg BTDC, closes 50 deg ABDC
  exhaust: { open: 490, duration: 240 }, // opens 50 deg BBDC, closes 10 deg ATDC
};

export function cycleAngle(cyl, crankDeg) {
  return wrap720(crankDeg - cyl.cycleOffset);
}

export function valveLift(which, phase) {
  return lift(which, phase);
}

// Monotone-clean lift curve (0 at the seat, peak mid-event).
export function lift(which, phase) {
  const ev = VALVE_EVENTS[which];
  let d = phase - ev.open;
  d = ((d % 720) + 720) % 720;
  if (d > ev.duration) return 0;
  const t = d / ev.duration;
  return LAYOUT.valveLift * 0.5 * (1 - Math.cos(Math.PI * 2 * t));
}

// Cam rotates at half crank speed in the same direction as the crank (chain).
// Lobe geometry is built with its nose along +X, so the baked phase that puts
// the nose under the bucket at maximum lift is: -90 + (crankAtMax / 2).
export function camRotation(crankDeg) {
  return -crankDeg / 2;
}

export function lobePhase(cyl, which) {
  const ev = VALVE_EVENTS[which];
  const crankAtMax = cyl.cycleOffset + ev.open + ev.duration / 2;
  return (-90 + crankAtMax / 2) * D2R;
}

export function maxLiftCrank(cyl, which) {
  const ev = VALVE_EVENTS[which];
  return cyl.cycleOffset + ev.open + ev.duration / 2;
}

// Which of the four strokes a cylinder is in, for a given crank angle.
export function strokeOf(cyl, crankDeg) {
  const p = cycleAngle(cyl, crankDeg);
  if (p < 180) return 'intake';
  if (p < 360) return 'compression';
  if (p < 540) return 'power';
  return 'exhaust';
}

export const STROKES = [
  { key: 'intake', name: 'SSANIE', en: 'Intake' },
  { key: 'compression', name: 'SPREZANIE', en: 'Compression' },
  { key: 'power', name: 'PRACA', en: 'Power' },
  { key: 'exhaust', name: 'WYDECH', en: 'Exhaust' },
];
