// layout.js - the single source of truth for V8 architecture dimensions.
// Numbers follow a classic 90-degree pushrod V8 (small-block pattern):
// bore spacing 111.76 mm, deck height 229 mm, bore 101.6 mm, stroke 88.4 mm,
// rod length 152 mm. Everything else is derived from these.

export const LAYOUT = {
  // architecture
  bankAngle: 45, // each bank tilted 45 deg -> 90 deg included angle
  deckHeight: 229, // crank centreline -> deck face, measured along the bore axis
  boreSpacing: 111.76,
  bore: 101.6,
  stroke: 88.4,
  rodLength: 152,
  crankRadius: 88.4 / 2, // 44.2 mm throw
  mainJournalR: 32,
  rodJournalR: 27.5,
  pistonHeight: 62,
  pistonPinOffset: 0, // pin height above crown (0 = centred on the crown)

  // extents
  blockLength: 560, // along the crank axis (Z)
  frontZ: 280, // block front face (all belt drive hangs off +Z)
  rearZ: -280,
  headThickness: 110,
  headLength: 510,
  headWidth: 156,
  valveCoverHeight: 58,
  camY: 186, // camshaft centreline height (in-block cam, valley)
  beltZ: 395, // serpentine belt plane
  chainZ: 296, // timing chain plane (behind the cover)
};

// Cylinder positions, +Z is the front of the engine.
// 90-degree V8 numbering: odd 1,3,5,7 on the left bank (front to rear),
// even 2,4,6,8 on the right bank. Two cylinders share one crank journal.
const BORE_Z = [167.64, 55.88, -55.88, -167.64];
const THROW_PHASE = [0, 90, 270, 180]; // degrees, cross-plane style

export const CYLINDERS = [];
for (let i = 0; i < 4; i++) {
  CYLINDERS.push({
    id: i * 2 + 1,
    bank: 'L',
    z: BORE_Z[i],
    throwPhase: THROW_PHASE[i],
    label: `Cylinder_${i * 2 + 1}_L`,
  });
  CYLINDERS.push({
    id: i * 2 + 2,
    bank: 'R',
    z: BORE_Z[i],
    throwPhase: THROW_PHASE[i],
    label: `Cylinder_${i * 2 + 2}_R`,
  });
}

// Bank bore-axis unit vectors in world space (X right, Y up, Z forward).
export const BANK_DIR = {
  R: { x: Math.SQRT1_2, y: Math.SQRT1_2, z: 0 }, // +X bank
  L: { x: -Math.SQRT1_2, y: Math.SQRT1_2, z: 0 }, // -X bank
};
export const BANK_ROT_Z = { R: -Math.PI / 4, L: Math.PI / 4 };
export const BANK_ANGLE_DEG = { R: 45, L: 135 };

// Slider-crank: piston pin distance from the crank centreline along the bore
// axis for a given crank angle (degrees) and throw phase.
export function pistonPinDistance(throwPhaseDeg, bank, crankAngleDeg = 0) {
  const r = LAYOUT.crankRadius;
  const L = LAYOUT.rodLength;
  const theta =
    ((throwPhaseDeg + crankAngleDeg - BANK_ANGLE_DEG[bank]) * Math.PI) / 180;
  return r * Math.cos(theta) + Math.sqrt(L * L - (r * Math.sin(theta)) ** 2);
}

// Crank pin (rod journal) centre for a throw.
export function crankPinPosition(throwPhaseDeg, z, crankAngleDeg = 0) {
  const a = ((throwPhaseDeg + crankAngleDeg) * Math.PI) / 180;
  const r = LAYOUT.crankRadius;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r, z };
}

// Main bearing positions (5 mains, straddling the 4 rod journals).
export const MAIN_Z = [-223.52, -111.76, 0, 111.76, 223.52];
