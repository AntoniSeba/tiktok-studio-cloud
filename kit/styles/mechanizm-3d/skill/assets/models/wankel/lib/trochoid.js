// trochoid.js - the actual geometry of a Mazda 13B rotor housing, plus the
// kinematics that fall out of it. Everything is solved, nothing is drawn by eye.
//
// Published 13B (Renesis) figures used here:
//   generating radius (rotor centre to apex) R = 105 mm
//   eccentricity (rotor centre offset from shaft) e = 15 mm
//   rotor width b = 80 mm
//   displacement per rotor V = 3*sqrt(3)*e*R*b = 654 cc
//   gearing: internal rotor ring meshing a stationary pinion, ratio 2:3
//            (34 teeth stationary, 51 teeth rotor per the parts books),
//            so the rotor turns 1/3 of shaft speed in the same direction
//
// The housing's inner profile is the 2-lobed peritrochoid
//   x(t) = R cos t + e cos 3t
//   y(t) = R sin t + e sin 3t
// which oscillates between R + e = 120 and R - e = 90 mm.

import * as THREE from 'three';

export const R = 105;
export const ECC = 15;
export const WIDTH = 80;
export const LOBES = 3;
// apex tip radius of the rotor, and the flank radius.
// For a flat flanked rotor at e/R = 0.25 the flank is a straight chord; at the
// 13B's e/R = 0.1429 the flank bulges outward, its midpoint at e + R/2 = 67.5
// from the rotor centre against 52.5 for the bare chord, i.e. a 15 mm crown.
// Flank crown. The classical relation (crown = e) leaves the 13B at 6.9:1,
// while Mazda rates it 9.4:1, so the crown is set to the value that reproduces
// the published compression ratio while keeping the published displacement.
export const FLANK_MID = 72.2; // crown of 19.7 mm: the value that reproduces Mazda's published 9.4:1
export const APEX_TIP_R = 11.5;

export function housingPoint(t) {
  return new THREE.Vector2(R * Math.cos(t) + ECC * Math.cos(3 * t), R * Math.sin(t) + ECC * Math.sin(3 * t));
}

// ---- housing polyline, sampled once and reused everywhere -------------------
export const HOUSING_N = 2880;
export const HOUSING = (() => {
  const pts = [];
  for (let i = 0; i < HOUSING_N; i++) pts.push(housingPoint((i / HOUSING_N) * Math.PI * 2));
  return pts;
})();

// ---- rotor outline ---------------------------------------------------------
// 3 convex flank arcs through apexes at radius R spaced 120 degrees, with the
// mid flank crowned to FLANK_MID, apexes rounded to APEX_TIP_R whose outermost
// point lands exactly on R.
function flankArc(a0, a1) {
  const A = new THREE.Vector2(R * Math.cos(a0), R * Math.sin(a0));
  const B = new THREE.Vector2(R * Math.cos(a1), R * Math.sin(a1));
  const mid = new THREE.Vector2().addVectors(A, B).multiplyScalar(0.5);
  const out = mid.clone().normalize();
  const crown = FLANK_MID - mid.length();
  const chord = A.distanceTo(B);
  const r = (chord * chord) / (8 * crown) + crown / 2;
  // flank is CONVEX: it bulges outward, so the arc centre sits inward of the
  // crown point by r. (Sign matters: reversed, the flank caves in and the
  // chamber never closes, which is what made the compression ratio nonsense.)
  const c = mid.clone().add(out.clone().multiplyScalar(crown - r));
  const start = Math.atan2(A.y - c.y, A.x - c.x);
  const end = Math.atan2(B.y - c.y, B.x - c.x);
  let span = end - start;
  // walk the short way; with the centre inward the arc must bow away from it
  while (span <= 0) span += Math.PI * 2;
  while (span > Math.PI * 2) span -= Math.PI * 2;
  if (span > Math.PI) {
    span -= Math.PI * 2;
  }
  return { c, r, start, span, A, B };
}

export const FLANKS = [0, 1, 2].map((k) =>
  flankArc((k / 3) * Math.PI * 2, ((k + 1) / 3) * Math.PI * 2)
);

export const APEX_CENTRES = [0, 1, 2].map((k) => {
  const a = (k / 3) * Math.PI * 2;
  // centre pulled inward so the rounded tip peaks at exactly R
  const d = R - APEX_TIP_R;
  return new THREE.Vector2(d * Math.cos(a), d * Math.sin(a));
});

// The outline is stored as three sectors, sector k running from apex k to
// apex k+1 (each = the flank arc plus the rounded apex it ends on). The chamber
// polygon is then exactly wall(k..k+1) + reverse(sector k): no angle filtering,
// which is what previously let points from another lobe leak in and inflate the
// measured volume.
function buildSectors(samplesPerFlank = 90, samplesPerApex = 14) {
  const sectors = [];
  for (let k = 0; k < 3; k++) {
    const f = FLANKS[k];
    const pts = [];
    const inApex = (p) => APEX_CENTRES.some((c) => p.distanceTo(c) < APEX_TIP_R - 1e-6);
    for (let i = 0; i <= samplesPerFlank; i++) {
      const t = f.start + (f.span * i) / samplesPerFlank;
      const p = new THREE.Vector2(f.c.x + f.r * Math.cos(t), f.c.y + f.r * Math.sin(t));
      if (!inApex(p)) pts.push(p);
    }
    // rounded apex k+1, walked onward in the same sense
    const c = APEX_CENTRES[(k + 1) % 3];
    const aFrom = Math.atan2(pts[pts.length - 1].y - c.y, pts[pts.length - 1].x - c.x);
    const aTo = aFrom + Math.PI; // cap endpoints, trimmed where the next flank starts
    for (let i = 1; i <= samplesPerApex; i++) {
      const a = aFrom + ((aTo - aFrom) * i) / samplesPerApex;
      const p = new THREE.Vector2(c.x + APEX_TIP_R * Math.cos(a), c.y + APEX_TIP_R * Math.sin(a));
      if (i === samplesPerApex) {
        const nextFlank = FLANKS[(k + 1) % 3];
        const nf = new THREE.Vector2(
          nextFlank.c.x + nextFlank.r * Math.cos(nextFlank.start),
          nextFlank.c.y + nextFlank.r * Math.sin(nextFlank.start)
        );
        pts.push(nf);
      } else pts.push(p);
    }
    sectors.push(pts);
  }
  return sectors;
}

export const SECTORS = buildSectors();
export const ROTOR_OUTLINE = SECTORS.flat();

export function rotorOutline() {
  return ROTOR_OUTLINE;
}

// rotor-local outline of sector k (apex k -> apex k+1) rotated into world space
export function sectorWorld(theta, k) {
  const pose = rotorPose(theta);
  const cs = Math.cos(pose.spin);
  const sn = Math.sin(pose.spin);
  return SECTORS[k].map(
    (p) => new THREE.Vector2(pose.centre.x + p.x * cs - p.y * sn, pose.centre.y + p.x * sn + p.y * cs)
  );
}

export function rotorFlankBetween(theta, k) {
  return sectorWorld(theta, k);
}

// Same sector but with the rounded apex caps removed. The caps are a spike that
// doubles back on itself (the wall and the flank both pass through the apex tip),
// which makes the chamber contour non simple: ear clipping then produced
// overlapping triangles and the gas volume rendered inside out.
export function sectorWorldNoCaps(theta, k) {
  const pose = rotorPose(theta);
  const cs = Math.cos(pose.spin);
  const sn = Math.sin(pose.spin);
  const out = [];
  for (const p of SECTORS[k]) {
    let inCap = false;
    for (const c of APEX_CENTRES) {
      if (p.distanceTo(c) < APEX_TIP_R + 0.6) {
        inCap = true;
        break;
      }
    }
    if (inCap) continue;
    out.push(new THREE.Vector2(pose.centre.x + p.x * cs - p.y * sn, pose.centre.y + p.x * sn + p.y * cs));
  }
  return out;
}

// ---- kinematics ------------------------------------------------------------
// Crank angle theta: rotor centre orbits on radius e, rotor spins theta/3 in
// the same direction (that is what the 2:3 internal gear pair produces).
export const SPIN_RATIO = 1 / 3;

export function rotorPose(theta) {
  const centre = new THREE.Vector2(ECC * Math.cos(theta), ECC * Math.sin(theta));
  const spin = theta * SPIN_RATIO;
  const apexes = [0, 1, 2].map((k) => {
    const a = spin + (k / 3) * Math.PI * 2;
    return new THREE.Vector2(centre.x + R * Math.cos(a), centre.y + R * Math.sin(a));
  });
  return { centre, spin, apexes };
}

function fnv(h) {
  return ((h % 1) + 1) % 1;
}

// Housing parameter where apex k touches the wall. Tracked continuously between
// frames (it advances exactly with theta) and re-acquired by brute force when
// the track drifts, so it can never lock onto the wrong lobe.
const track = new Float64Array(3).fill(NaN);

export function contactParams(theta) {
  const pose = rotorPose(theta);
  const out = [];
  for (let k = 0; k < 3; k++) {
    const target = pose.apexes[k];
    let best = null;
    const scan = (c0, span, steps) => {
      for (let i = 0; i <= steps; i++) {
        const t = c0 + (span * i) / steps;
        const p = housingPoint(t);
        const d = (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
        if (!best || d < best.d) best = { d, t };
      }
    };
    if (!Number.isNaN(track[k])) {
      scan(track[k] - 0.12, 0.24, 60);
      if (best.d > 4) {
        best = null;
        scan(0, Math.PI * 2, HOUSING_N);
      }
    } else {
      scan(0, Math.PI * 2, HOUSING_N);
    }
    // golden polish
    let a = best.t - 0.02;
    let b = best.t + 0.02;
    for (let i = 0; i < 60; i++) {
      const m1 = a + (b - a) * 0.382;
      const m2 = a + (b - a) * 0.618;
      const p1 = housingPoint(m1);
      const p2 = housingPoint(m2);
      const d1 = (p1.x - target.x) ** 2 + (p1.y - target.y) ** 2;
      const d2 = (p2.x - target.x) ** 2 + (p2.y - target.y) ** 2;
      if (d1 < d2) b = m2;
      else a = m1;
    }
    track[k] = (a + b) / 2;
    out.push(track[k]);
  }
  return out;
}

// ---- chambers --------------------------------------------------------------
// Chamber k sits between apex k and apex k+1: bounded by the housing wall from
// one contact point to the next, and by the rotor's flank going back.
export function chamberPolygon(theta, k, wallSamples = 46, flankSamples = 34) {
  const t = contactParams(theta);
  const pose = rotorPose(theta);
  let t0 = t[k];
  let t1 = t[(k + 1) % 3];
  let span = fnv((t1 - t0) / (Math.PI * 2)) * Math.PI * 2;
  if (span < 1e-6 || span > Math.PI * 2 * 0.9) span = (Math.PI * 2) / 3;
  const poly = [];
  for (let i = 0; i <= wallSamples; i++) poly.push(housingPoint(t0 + (span * i) / wallSamples));
  // rotor flank from apex k+1 back to apex k
  const outline = sectorWorldNoCaps(theta, k);
  for (let i = outline.length - 1; i >= 0; i--) poly.push(outline[i]);
  return poly;
}

function shoelace(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

export function chamberArea(theta, k) {
  const poly = chamberPolygon(theta, k);
  const local = [];
  for (const p of poly) local.push({ x: p.x, y: p.y });
  return shoelace(local);
}

export function chamberAreas(theta) {
  return [chamberArea(theta, 0), chamberArea(theta, 1), chamberArea(theta, 2)];
}

export function chamberVolumes(theta) {
  return chamberAreas(theta).map((a) => (a * WIDTH) / 1000); // cm^3
}

export function sweptVolume() {
  // V = 3*sqrt(3)*e*R*b, in cm^3
  return (3 * Math.sqrt(3) * ECC * R * WIDTH) / 1000;
}

// ---- phase -----------------------------------------------------------------
// One face of the rotor runs intake -> compression -> power -> exhaust over
// 1080 degrees of crank. Chamber 0 leads chamber 1 by 360 degrees.
export const STROKES = ['ssanie', 'sprężanie', 'praca', 'wydech'];

export function chamberPhase(theta, k) {
  const a = fnv((theta - (k * Math.PI * 2) / 3) / (Math.PI * 6)) * 4;
  return { index: Math.floor(a) % 4, t: a % 1 };
}
