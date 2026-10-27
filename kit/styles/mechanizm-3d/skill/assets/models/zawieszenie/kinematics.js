// kinematics.js - the real thing: a double wishbone corner solved from
// constraints, not keyframed.
//
//   * the lower wishbone angle comes from the wheel travel
//   * the upper wishbone angle is solved so the knuckle keeps its length
//   * the knuckle swings with the two ball joints, then twists about the
//     steering axis so the tie rod keeps its length (that is what bump steer
//     actually is)
//   * the damper, the anti roll bar droplink and the driveshaft lengths follow
//     from the same solution, so nothing can drift apart
//
// Units: millimetres. X = outboard (toward the modelled wheel, right side),
// Y = up, Z = forward. The car's centre line is at X = 0.

import * as THREE from 'three';

export const P = {
  // chassis / subframe pickups
  lcaFront: new THREE.Vector3(300, 170, 215),
  lcaRear: new THREE.Vector3(300, 165, -135),
  ucaFront: new THREE.Vector3(345, 340, 150),
  ucaRear: new THREE.Vector3(345, 335, -120),
  rackEnd: new THREE.Vector3(330, 200, -215),
  arbArmEnd: new THREE.Vector3(430, 330, -330),
  arbAxis: new THREE.Vector3(0, 205, -350), // bar runs along X through here
  damperTop: new THREE.Vector3(505, 655, 5),
  diffOut: new THREE.Vector3(150, 260, -30),
  // sprung geometry (rest position)
  ballLower: new THREE.Vector3(740, 150, 40),
  ballUpper: new THREE.Vector3(700, 355, 35),
  steerArm: new THREE.Vector3(672, 185, -155),
  hubInner: new THREE.Vector3(700, 300, 42),
  wheelCentre: new THREE.Vector3(752, 320, 42),
  damperLower: new THREE.Vector3(560, 152, 10),
  arbLinkOnWishbone: new THREE.Vector3(500, 145, -230),
  wheelAxisRest: new THREE.Vector3(1, 0, 0),
};

// rigid lengths, measured once from the design position
const L_KNUCKLE = P.ballUpper.distanceTo(P.ballLower);
const L_TIE = P.steerArm.distanceTo(P.rackEnd);
const L_DROPLINK = P.arbLinkOnWishbone.distanceTo(P.arbArmEnd);
const L_DAMPER = P.damperTop.distanceTo(P.damperLower);
const AXIS_L = new THREE.Vector3().subVectors(P.lcaRear, P.lcaFront).normalize();
const AXIS_U = new THREE.Vector3().subVectors(P.ucaRear, P.ucaFront).normalize();

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

function rotateAbout(pivot, axis, angle, point, out) {
  out.copy(point).sub(pivot).applyAxisAngle(axis, angle).add(pivot);
  return out;
}

// 1D constraint solver. Distance constraints are not monotonic (a link can
// reach the target angle on either side of its arc), so a plain bisection can
// silently jump to the wrong branch, which shows up as the wheel flipping.
// Instead: coarse scan, keep the sign change closest to the previous solution,
// then bisect inside it. Falls back to the closest point if nothing brackets.
const prev = { lower: 0, upper: 0, twist: 0, arb: 0 };

// Distance constraints have up to two roots (a link can reach its target on
// either side of its arc). Picking the branch closest to the previous frame is
// not safe: after a jump in input it can land on the reflected solution and the
// wheel snaps sideways. Every one of these linkages physically lives near zero
// rotation, so the root closest to zero always wins and the hint only breaks
// ties. Result is verified against the constraint before it is accepted.
function solveAngle(fn, target, lo, hi, key, samples = 60) {
  const hint = key ? prev[key] ?? 0 : 0;
  let best = null;
  const brackets = [];
  let prevA = lo;
  let prevF = fn(lo) - target;
  if (Math.abs(prevF) < 1e-9) {
    if (key) prev[key] = lo;
    return lo;
  }
  for (let i = 1; i <= samples; i++) {
    const a = lo + ((hi - lo) * i) / samples;
    const f = fn(a) - target;
    if (!best || Math.abs(f) < best.err) best = { a, err: Math.abs(f) };
    if (prevF * f < 0) brackets.push({ a: prevA, b: a });
    prevA = a;
    prevF = f;
  }
  // nearest to zero first, hint only as tiebreak
  brackets.sort((p, q) => {
    const pm = Math.abs((p.a + p.b) / 2);
    const qm = Math.abs((q.a + q.b) / 2);
    if (Math.abs(pm - qm) > 1e-6) return pm - qm;
    return Math.abs((p.a + p.b) / 2 - hint) - Math.abs((q.a + q.b) / 2 - hint);
  });
  let result = null;
  for (const br of brackets) {
    let a = br.a;
    let b = br.b;
    let fa = fn(a) - target;
    for (let i = 0; i < 60; i++) {
      const m = (a + b) / 2;
      const fm = fn(m) - target;
      if (fa * fm <= 0) b = m;
      else {
        a = m;
        fa = fm;
      }
    }
    const root = (a + b) / 2;
    if (Math.abs(fn(root) - target) < 0.05) {
      result = root;
      break;
    }
    if (result === null) result = root;
  }
  if (result === null) result = best ? best.a : hint;
  if (key) prev[key] = result;
  return result;
}

export const LIMITS = { travel: [-70, 70], steer: [-1, 1] };

// travel in mm (+ = bump), steer in -1..1 of rack travel
export function solveCorner(travel, steer) {
  const out = {};

  // ---- lower wishbone: rotate until the lower ball joint reaches the travel
  const rL = new THREE.Vector3().subVectors(P.ballLower, P.lcaFront);
  const angleL = solveAngle(
    (a) => rotateAbout(P.lcaFront, AXIS_L, a, P.ballLower, _v).y,
    P.ballLower.y + travel,
    -0.7,
    0.7,
    'lower'
  );
  const lower = rotateAbout(P.lcaFront, AXIS_L, angleL, P.ballLower, new THREE.Vector3());
  out.angleLower = angleL;
  out.lower = lower.clone();

  // ---- upper wishbone: rotate so the knuckle keeps its length
  const rU = new THREE.Vector3().subVectors(P.ballUpper, P.ucaFront);
  const angleU = solveAngle(
    (a) => rotateAbout(P.ucaFront, AXIS_U, a, P.ballUpper, _v).distanceTo(lower),
    L_KNUCKLE,
    -0.7,
    0.7,
    'upper'
  );
  const upper = rotateAbout(P.ucaFront, AXIS_U, angleU, P.ballUpper, new THREE.Vector3());
  out.angleUpper = angleU;
  out.upper = upper.clone();

  // ---- knuckle: swing onto the ball joints, then twist about the steering
  // axis until the tie rod length works out
  const axisNow = new THREE.Vector3().subVectors(upper, lower).normalize();
  const restAxis = new THREE.Vector3().subVectors(P.ballUpper, P.ballLower).normalize();
  const swing = _q.setFromUnitVectors(restAxis, axisNow).clone();
  out.swing = swing;

  const rArm = new THREE.Vector3().subVectors(P.steerArm, P.ballLower);
  const rackEnd = P.rackEnd.clone();
  rackEnd.x += steer * 62; // rack travel, mm
  out.rackEnd = rackEnd.clone();

  const twist = solveAngle(
    (a) => {
      _q2.setFromAxisAngle(axisNow, a).multiply(swing);
      _v.copy(rArm).applyQuaternion(_q2).add(lower);
      return _v.distanceTo(rackEnd);
    },
    L_TIE,
    -0.7,
    0.7,
    'twist'
  );
  out.angleTwist = twist;
  const qTotal = new THREE.Quaternion().setFromAxisAngle(axisNow, twist).multiply(swing);
  out.quaternion = qTotal;

  // matrix that maps the rest knuckle onto the solved pose
  out.knuckleMatrix = new THREE.Matrix4()
    .makeTranslation(lower.x, lower.y, lower.z)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(qTotal))
    .multiply(new THREE.Matrix4().makeTranslation(-P.ballLower.x, -P.ballLower.y, -P.ballLower.z));

  // ---- points that ride on the knuckle
  const onKnuckle = (restPoint, out2 = new THREE.Vector3()) => {
    out2.copy(restPoint).sub(P.ballLower).applyQuaternion(qTotal).add(lower);
    return out2;
  };
  out.steerArmNow = onKnuckle(P.steerArm);
  out.hubInnerNow = onKnuckle(P.hubInner);
  out.wheelCentreNow = onKnuckle(P.wheelCentre);
  out.wheelAxisNow = P.wheelAxisRest.clone().applyQuaternion(qTotal).normalize();

  // ---- tie rod (straight between the rack end and the steering arm)
  out.tieRod = { a: rackEnd.clone(), b: out.steerArmNow.clone() };

  // ---- damper: the lower mount rides on the lower wishbone
  const damperLowerNow = rotateAbout(P.lcaFront, AXIS_L, angleL, P.damperLower, new THREE.Vector3());
  out.damperLowerNow = damperLowerNow.clone();
  out.damperLength = damperLowerNow.distanceTo(P.damperTop);
  out.damperCompression = L_DAMPER - out.damperLength; // + = compressed
  out.damperAxis = new THREE.Vector3().subVectors(P.damperTop, damperLowerNow).normalize();

  // ---- anti roll bar: the arm has to rotate so the droplink keeps its length
  const linkOnWishbone = rotateAbout(P.lcaFront, AXIS_L, angleL, P.arbLinkOnWishbone, new THREE.Vector3());
  out.linkOnWishbone = linkOnWishbone.clone();
  const barAxis = new THREE.Vector3(1, 0, 0);
  const rBar = new THREE.Vector3().subVectors(P.arbArmEnd, P.arbAxis);
  const arbTwist = solveAngle(
    (a) => rotateAbout(P.arbAxis, barAxis, a, P.arbArmEnd, _v).distanceTo(linkOnWishbone),
    L_DROPLINK,
    -0.8,
    0.8,
    'arb'
  );
  out.arbTwist = arbTwist;
  out.arbArmEndNow = rotateAbout(P.arbAxis, barAxis, arbTwist, P.arbArmEnd, new THREE.Vector3());
  out.droplink = { a: out.arbArmEndNow.clone(), b: linkOnWishbone.clone() };

  // ---- driveshaft: diff end fixed, hub end rides with the knuckle
  out.driveshaft = { a: P.diffOut.clone(), b: out.hubInnerNow.clone() };

  // ---- geometry readouts for the HUD
  const axisUp = out.wheelAxisNow;
  out.camber = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(-axisUp.y, -1, 1)));
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(qTotal);
  out.toe = THREE.MathUtils.radToDeg(Math.atan2(fwd.x, fwd.z));
  out.scrub = out.wheelCentreNow.x - 752;

  return out;
}

export const CONSTANTS = { L_KNUCKLE, L_TIE, L_DROPLINK, L_DAMPER, AXIS_L, AXIS_U };
