// suspension.js - one ultra detailed front corner: double wishbone, upright,
// hub, vented disc and four piston caliper, coilover, steering rack and tie
// rod, anti roll bar with droplink, driveshaft with two CV joints, wheel and
// tyre. Every moving part is driven by the constraint solver in kinematics.js,
// so the linkage stays connected at any travel or steering angle.

import * as THREE from 'three';
import {
  chamferBox,
  taperBox,
  cylinder,
  softCylinder,
  tubeBetween,
  tubeThrough,
  lathe,
  cached,
  mesh,
  fastener,
} from '../lib/geom.js';
import { P, CONSTANTS } from '../kinematics.js';

const AXIS_L = CONSTANTS.AXIS_L;
const AXIS_U = CONSTANTS.AXIS_U;
const UP = new THREE.Vector3(0, 1, 0);
const XAXIS = new THREE.Vector3(1, 0, 0);

// ---------------------------------------------------------------- helpers
// A forged-looking beam between two points (used for every arm and bracket).
function strut(a, b, w, h, mat, name, parent, bevel = 3) {
  const m = new THREE.Mesh(chamferBox(w, h, 1, Math.min(w, h) * 0.28, bevel), mat);
  m.name = name;
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  m.scale.set(1, 1, len);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}

function rod(a, b, r, mat, name, parent, seg = 16) {
  const m = new THREE.Mesh(tubeBetween(a, b, r, seg), mat);
  m.name = name;
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}

function disc(geoR, len, mat, name, parent, pos, axis = 'x') {
  const m = new THREE.Mesh(softCylinder(geoR, len, 40, 3), mat);
  m.name = name;
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  else if (axis === 'y') m.rotation.x = 0;
  else m.rotation.x = Math.PI / 2;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}

function pivotMatrix(pivot, axis, angle) {
  return new THREE.Matrix4()
    .makeTranslation(pivot.x, pivot.y, pivot.z)
    .multiply(new THREE.Matrix4().makeRotationAxis(axis, angle))
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
}

function setMatrix(obj, m) {
  obj.matrixAutoUpdate = false;
  obj.matrix.copy(m);
  obj.matrixWorldNeedsUpdate = true;
}

// orient a rest-posed group onto two new points (links: tie rod, droplink,
// driveshaft). Scaling along the link axis keeps the ends on the joints.
const _linkMid = new THREE.Vector3();
const _linkDir = new THREE.Vector3();
const _linkScale = new THREE.Vector3(1, 1, 1);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
// Links (tie rod, droplink, driveshaft) are authored in their own local frame:
// centred on the origin, axis along +Y, length = restLen. placeLink therefore
// composes the world matrix straight from the two joint positions instead of
// using a rest-delta, which is what kept them stranded at the origin.
function placeLink(obj, a, b, restLen) {
  const mid = _linkMid.copy(a).add(b).multiplyScalar(0.5);
  const d = _linkDir.subVectors(b, a);
  const len = d.length();
  if (len < 1e-6) return;
  obj.matrixAutoUpdate = false;
  obj.matrix.compose(
    mid,
    _q.setFromUnitVectors(UP, d.divideScalar(len)),
    _linkScale.set(1, restLen > 0 ? len / restLen : 1, 1)
  );
  obj.matrixWorldNeedsUpdate = true;
}

function orientLink(obj, restA, restB, a, b) {
  _a.subVectors(restB, restA);
  _b.subVectors(b, a);
  const restLen = _a.length();
  const len = _b.length();
  _q.setFromUnitVectors(_a.normalize(), _b.normalize());
  const midRest = new THREE.Vector3().addVectors(restA, restB).multiplyScalar(0.5);
  const midNow = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const m = new THREE.Matrix4()
    .makeTranslation(midNow.x, midNow.y, midNow.z)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(_q))
    .multiply(new THREE.Matrix4().makeScale(1, 1, len / restLen))
    .multiply(new THREE.Matrix4().makeTranslation(-midRest.x, -midRest.y, -midRest.z));
  setMatrix(obj, m);
}

const REST_DROPLINK = P.arbLinkOnWishbone.distanceTo(P.arbArmEnd);
const REST_TIE = P.steerArm.distanceTo(P.rackEnd);
const REST_SHAFT = P.hubInner.distanceTo(P.diffOut);

export function buildSuspension(M) {
  const root = new THREE.Group();
  root.name = 'FRONT_SUSPENSION_R';

  // ============================================================== chassis
  const chassis = new THREE.Group();
  chassis.name = 'CHASSIS_ASSEMBLY';
  root.add(chassis);

  // longitudinal rail + cross members + lower subframe plate
  const rail = mesh(chamferBox(96, 130, 640, 16, 5), M.steelDark, 'Chassis_Rail', chassis, [285, 235, -20]);
  rail.castShadow = true;
  for (const [z, w] of [[250, 330], [-300, 330], [-60, 300]]) {
    mesh(chamferBox(w, 84, 110, 14, 4), M.steelDark, `Subframe_CrossMember_${z}`, chassis, [170, 195, z]).castShadow = true;
  }
  const plate = mesh(chamferBox(380, 20, 560, 14, 4), M.steelDark, 'Subframe_LowerPlate', chassis, [205, 148, -30]);
  plate.castShadow = true;

  // strut tower
  // stamped sheet metal tower rather than a turned drum: reads as a real
  // inner wing structure instead of a can
  const towerGeo = cached('tower', () => chamferBox(300, 112, 300, 30, 6));
  const tower = mesh(towerGeo, M.aluCast, 'StrutTower', chassis, [505, 600, 5]);
  tower.castShadow = true;
  mesh(softCylinder(112, 16, 40, 3), M.aluCast, 'StrutTower_TopPlate', chassis, [505, 648, 5]).castShadow = true;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const b = fastener(11, 34, 19, M.chrome, `TopMountStud_${i + 1}`);
    b.position.set(505 + Math.cos(a) * 74, 664, 5 + Math.sin(a) * 74);
    chassis.add(b);
  }
  // tower bracing back to the rail
  strut(new THREE.Vector3(400, 300, 60), new THREE.Vector3(500, 590, 20), 54, 40, M.steelDark, 'StrutTower_Brace', chassis);

  // pickup brackets for the four inner pivots
  const pickup = (p, name, len) => {
    const g = new THREE.Group();
    g.name = name;
    chassis.add(g);
    const box = mesh(chamferBox(74, 78, 66, 12, 4), M.steelDark, `${name}_Bracket`, g, [p.x, p.y - 26, p.z]);
    box.castShadow = true;
    const t = new THREE.Mesh(softCylinder(30, len, 32, 2), M.steelDark);
    t.name = `${name}_BushTube`;
    t.rotation.x = Math.PI / 2;
    t.position.set(p.x, p.y, p.z);
    t.castShadow = true;
    g.add(t);
    return g;
  };
  pickup(P.lcaFront, 'Pickup_LCA_Front', 96);
  pickup(P.lcaRear, 'Pickup_LCA_Rear', 96);
  pickup(P.ucaFront, 'Pickup_UCA_Front', 86);
  pickup(P.ucaRear, 'Pickup_UCA_Rear', 86);

  // steering rack
  const rack = new THREE.Group();
  rack.name = 'STEERING_RACK';
  chassis.add(rack);
  const rackTube = new THREE.Mesh(softCylinder(40, 330, 40, 3), M.aluCast);
  rackTube.rotation.z = Math.PI / 2;
  rackTube.position.set(240, 200, -215);
  rackTube.castShadow = true;
  rack.add(rackTube);
  mesh(chamferBox(96, 84, 90, 14, 4), M.aluCast, 'Rack_PinionHousing', rack, [150, 236, -215]).castShadow = true;
  disc(46, 70, M.chrome, 'Rack_Pinion', rack, [150, 280, -215]);
  const bootGeo = cached('rackboot', () => {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push(new THREE.Vector2(22 + Math.sin(t * Math.PI) * 22, t * 110));
    }
    return new THREE.LatheGeometry(pts, 24);
  });
  const rackBoot = new THREE.Mesh(bootGeo, M.boot);
  rackBoot.name = 'Rack_Boot';
  rackBoot.rotation.z = -Math.PI / 2;
  rackBoot.position.set(330, 200, -215);
  rack.add(rackBoot);
  const tieInner = mesh(softCylinder(20, 44, 20, 2), M.steelDark, 'TieRod_InnerJoint', rack, [P.rackEnd.x, P.rackEnd.y, P.rackEnd.z]);
  tieInner.rotation.z = Math.PI / 2;

  // anti roll bar: bar, two bushings, the right hand arm
  const arb = new THREE.Group();
  arb.name = 'ANTI_ROLL_BAR';
  chassis.add(arb);
  const barLen = 560;
  const bar = new THREE.Mesh(softCylinder(22, barLen, 28, 2), M.steelDark);
  bar.name = 'ARB_Bar';
  bar.rotation.z = Math.PI / 2;
  bar.position.set(P.arbAxis.x - 130, P.arbAxis.y, P.arbAxis.z);
  bar.castShadow = true;
  arb.add(bar);
  for (const bx of [-120, 120]) {
    const clamp = mesh(chamferBox(46, 74, 60, 10, 3), M.aluDark ?? M.aluCast, `ARB_Bushing_${bx}`, arb, [P.arbAxis.x + bx - 130, P.arbAxis.y - 4, P.arbAxis.z]);
    clamp.castShadow = true;
    const bush = new THREE.Mesh(softCylinder(28, 34, 26, 2), M.bush);
    bush.rotation.z = Math.PI / 2;
    bush.position.set(P.arbAxis.x + bx - 130, P.arbAxis.y, P.arbAxis.z);
    arb.add(bush);
  }

  // differential + driveshaft inner flange
  const diff = new THREE.Group();
  diff.name = 'DIFFERENTIAL';
  chassis.add(diff);
  const diffBody = mesh(chamferBox(190, 190, 230, 22, 6), M.aluCast, 'Diff_Housing', diff, [140, 250, -30]);
  diffBody.castShadow = true;
  for (const dz of [-70, 0, 70]) {
    mesh(chamferBox(24, 150, 22, 8, 3), M.aluCast, `Diff_Rib_${dz}`, diff, [66, 250, -30 + dz]);
  }
  disc(62, 40, M.steelDark, 'Diff_OutputFlange', diff, [P.diffOut.x, P.diffOut.y, P.diffOut.z]);

  // brake line bracket on the rail
  mesh(chamferBox(40, 30, 46, 8, 3), M.steelDark, 'BrakeLine_Bracket', chassis, [330, 300, 60]).castShadow = true;

  // ========================================================= lower wishbone
  const lowerArm = new THREE.Group();
  lowerArm.name = 'LOWER_WISHBONE';
  root.add(lowerArm);
  const lcaBoss = new THREE.Vector3(716, 152, 44);
  strut(P.lcaFront, lcaBoss, 62, 40, M.aluForged, 'LCA_FrontLeg', lowerArm);
  strut(P.lcaRear, new THREE.Vector3(712, 150, 26), 58, 34, M.aluForged, 'LCA_RearLeg', lowerArm);
  strut(new THREE.Vector3(430, 158, 60), new THREE.Vector3(700, 152, 40), 44, 22, M.aluForged, 'LCA_Rib', lowerArm);
  disc(78, 46, M.aluForged, 'LCA_Boss', lowerArm, [lcaBoss.x, lcaBoss.y, lcaBoss.z], 'y');
  disc(40, 90, M.chrome, 'LCA_BushTube_Front', lowerArm, [P.lcaFront.x, P.lcaFront.y, P.lcaFront.z]);
  disc(40, 90, M.chrome, 'LCA_BushTube_Rear', lowerArm, [P.lcaRear.x, P.lcaRear.y, P.lcaRear.z]);
  disc(52, 84, M.bush, 'LCA_Bush_Front', lowerArm, [P.lcaFront.x, P.lcaFront.y, P.lcaFront.z]);
  disc(52, 84, M.bush, 'LCA_Bush_Rear', lowerArm, [P.lcaRear.x, P.lcaRear.y, P.lcaRear.z]);
  // ball joint + boot
  const bjBootGeo = cached('bjboot', () => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(new THREE.Vector2(16 + Math.sin(t * Math.PI * 0.9) * 26, t * 34));
    }
    return new THREE.LatheGeometry(pts, 24);
  });
  const bjBoot = new THREE.Mesh(bjBootGeo, M.boot);
  bjBoot.name = 'LowerBallJoint_Boot';
  bjBoot.position.set(P.ballLower.x, P.ballLower.y - 24, P.ballLower.z);
  lowerArm.add(bjBoot);
  mesh(softCylinder(36, 26, 24, 2), M.steelDark, 'LowerBallJoint_Housing', lowerArm, [P.ballLower.x, P.ballLower.y - 6, P.ballLower.z]).castShadow = true;
  // spring seat + damper clevis
  const seat = mesh(chamferBox(150, 18, 170, 14, 4), M.aluForged, 'LCA_SpringSeat', lowerArm, [P.damperLower.x, P.damperLower.y + 4, P.damperLower.z]);
  seat.castShadow = true;
  mesh(chamferBox(56, 90, 74, 14, 4), M.aluForged, 'LCA_DamperClevis', lowerArm, [P.damperLower.x - 6, P.damperLower.y - 30, P.damperLower.z]);
  const clevisBolt = fastener(14, 110, 24, M.chrome, 'LCA_ClevisBolt');
  clevisBolt.position.set(P.damperLower.x - 6, P.damperLower.y, P.damperLower.z);
  clevisBolt.rotation.z = Math.PI / 2;
  lowerArm.add(clevisBolt);
  // anti roll bar drop link tab
  mesh(chamferBox(48, 86, 60, 12, 3), M.aluForged, 'LCA_ARBTab', lowerArm, [P.arbLinkOnWishbone.x, P.arbLinkOnWishbone.y - 20, P.arbLinkOnWishbone.z]);

  // ========================================================= upper wishbone
  const upperArm = new THREE.Group();
  upperArm.name = 'UPPER_WISHBONE';
  root.add(upperArm);
  strut(P.ucaFront, new THREE.Vector3(686, 353, 46), 52, 32, M.aluForged, 'UCA_FrontLeg', upperArm);
  strut(P.ucaRear, new THREE.Vector3(684, 351, 26), 50, 30, M.aluForged, 'UCA_RearLeg', upperArm);
  disc(60, 40, M.aluForged, 'UCA_Boss', upperArm, [P.ballUpper.x, P.ballUpper.y, P.ballUpper.z], 'y');
  disc(34, 82, M.chrome, 'UCA_BushTube_Front', upperArm, [P.ucaFront.x, P.ucaFront.y, P.ucaFront.z]);
  disc(34, 82, M.chrome, 'UCA_BushTube_Rear', upperArm, [P.ucaRear.x, P.ucaRear.y, P.ucaRear.z]);
  disc(46, 76, M.bush, 'UCA_Bush_Front', upperArm, [P.ucaFront.x, P.ucaFront.y, P.ucaFront.z]);
  disc(46, 76, M.bush, 'UCA_Bush_Rear', upperArm, [P.ucaRear.x, P.ucaRear.y, P.ucaRear.z]);
  const ujBoot = new THREE.Mesh(bjBootGeo, M.boot);
  ujBoot.name = 'UpperBallJoint_Boot';
  ujBoot.rotation.z = Math.PI;
  ujBoot.position.set(P.ballUpper.x, P.ballUpper.y + 22, P.ballUpper.z);
  upperArm.add(ujBoot);
  // camber adjustment shims
  for (const dz of [-24, 24]) {
    mesh(chamferBox(10, 56, 40, 3, 1), M.steelDark, `UCA_Shim_${dz}`, upperArm, [P.ucaFront.x + 4, P.ucaFront.y, P.ucaFront.z + dz]);
  }

  // =============================================================== knuckle
  const knuckle = new THREE.Group();
  knuckle.name = 'STEERING_KNUCKLE';
  root.add(knuckle);
  // upright body between the two ball joints
  strut(P.ballLower, P.ballUpper, 118, 130, M.aluCast, 'Knuckle_Upright', knuckle, 4);
  // hub carrier + hub + flange + studs
  const hubAxisPos = new THREE.Vector3(700, 320, 42);
  disc(94, 96, M.aluCast, 'Knuckle_HubBoss', knuckle, [hubAxisPos.x, hubAxisPos.y, hubAxisPos.z]);
  const hub = new THREE.Mesh(softCylinder(48, 66, 32, 3), M.steelDark);
  hub.name = 'Hub_Bearing';
  hub.rotation.z = Math.PI / 2;
  hub.position.set(716, 320, 42);
  hub.castShadow = true;
  knuckle.add(hub);
  const flange = new THREE.Mesh(softCylinder(80, 16, 32, 2), M.steelDark);
  flange.name = 'Hub_Flange';
  flange.rotation.z = Math.PI / 2;
  flange.position.set(748, 320, 42);
  flange.castShadow = true;
  knuckle.add(flange);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const stud = fastener(13, 46, 22, M.chrome, `WheelStud_${i + 1}`);
    stud.position.set(760, 320 + Math.cos(a) * 57, 42 + Math.sin(a) * 57);
    stud.rotation.z = -Math.PI / 2;
    knuckle.add(stud);
  }
  // steering arm + its ball joint
  strut(new THREE.Vector3(690, 236, -6), P.steerArm, 62, 44, M.aluCast, 'Knuckle_SteeringArm', knuckle);
  mesh(softCylinder(30, 34, 24, 2), M.steelDark, 'TieRod_OuterJoint', knuckle, [P.steerArm.x, P.steerArm.y, P.steerArm.z]).castShadow = true;
  // brake caliper (four piston, radial mount)
  // caliper carrier bolted to the upright: without it the caliper reads as
  // hovering over the disc
  strut(new THREE.Vector3(700, 372, -18), new THREE.Vector3(697, 446, -58), 52, 46, M.aluCast, 'Caliper_Bracket', knuckle);
  for (const dy of [-22, 22]) {
    const cb = fastener(13, 30, 22, M.steelDark, `Caliper_Bolt_${dy}`, knuckle);
    cb.position.set(676, 446 + dy, -58);
    cb.rotation.z = Math.PI / 2;
    knuckle.add(cb);
  }
  const shield = disc(196, 4, M.steelDark, 'Brake_DustShield', knuckle, [672, P.wheelCentre.y, P.wheelCentre.z], 'x');
  void shield;
  const caliper = new THREE.Group();
  caliper.name = 'Brake_Caliper';
  knuckle.add(caliper);
  const calR = 152;
  const calAng = (38 * Math.PI) / 180;
  const calPos = new THREE.Vector3(698, 320 + Math.cos(calAng) * calR, 42 - Math.sin(calAng) * calR);
  caliper.position.copy(calPos);
  caliper.rotation.x = -calAng;
  const calBody = mesh(chamferBox(150, 104, 190, 16, 5), M.caliper, 'Caliper_Body', caliper);
  calBody.castShadow = true;
  mesh(chamferBox(24, 88, 170, 8, 3), M.caliper, 'Caliper_Bridge', caliper, [0, 60, 0]);
  for (const dx of [-40, 40]) {
    mesh(chamferBox(30, 60, 62, 8, 3), M.aluCast, `Caliper_Piston_${dx}`, caliper, [dx * 1.0, 34, 0]);
  }
  for (const dz of [-72, 72]) {
    mesh(chamferBox(20, 96, 56, 5, 2), M.pad, `BrakePad_${dz}`, caliper, [0, 6, dz]);
  }
  for (const [dx, dz] of [[-58, -74], [58, -74], [-58, 74], [58, 74]]) {
    const b = fastener(12, 74, 21, M.chrome, `CaliperBolt_${dx}_${dz}`);
    b.position.set(dx, 30, dz);
    caliper.add(b);
  }
  disc(26, 60, M.chrome, 'Caliper_Bleed', caliper, [0, 92, 20], 'y');
  // ABS sensor + wire stub
  disc(16, 40, M.plastic ?? M.rubber, 'ABS_Sensor', knuckle, [676, 268, -30]);
  // brake hose bracket
  mesh(chamferBox(30, 44, 34, 8, 3), M.aluCast, 'Knuckle_HoseBracket', knuckle, [640, 400, 40]).castShadow = true;

  // ================================================================ wheel
  const wheel = new THREE.Group();
  wheel.name = 'WHEEL_ASSEMBLY';
  knuckle.add(wheel);
  const rimGroup = new THREE.Group();
  rimGroup.name = 'WHEEL_RIM_TYRE';
  wheel.add(rimGroup);
  const wc = P.wheelCentre;
  const rimOuter = 229;
  const barrelGeo = cached('rimbarrel', () => {
    const pts = [
      new THREE.Vector2(206, -108),
      new THREE.Vector2(222, -104),
      new THREE.Vector2(224, -96),
      new THREE.Vector2(224, 96),
      new THREE.Vector2(222, 104),
      new THREE.Vector2(206, 108),
    ];
    const g = new THREE.LatheGeometry(pts, 48);
    return g;
  });
  const barrel = new THREE.Mesh(barrelGeo, M.rim);
  barrel.name = 'Rim_Barrel';
  barrel.rotation.z = -Math.PI / 2;
  barrel.position.set(wc.x, wc.y, wc.z);
  barrel.castShadow = true;
  rimGroup.add(barrel);
  // spokes: five doubles, slightly dished
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    for (const side of [-1, 1]) {
      const a = angle + side * 0.19;
      const inner = new THREE.Vector3(wc.x + 4, wc.y + Math.cos(a) * 58, wc.z + Math.sin(a) * 58);
      const outer = new THREE.Vector3(wc.x - 44, wc.y + Math.cos(a) * 208, wc.z + Math.sin(a) * 208);
      strut(inner, outer, 46, 26, M.rim, `Rim_Spoke_${i}_${side > 0 ? 'a' : 'b'}`, rimGroup, 4);
    }
  }
  const hubFace = new THREE.Mesh(softCylinder(78, 26, 32, 3), M.rim);
  hubFace.name = 'Rim_HubFace';
  hubFace.rotation.z = Math.PI / 2;
  hubFace.position.set(wc.x + 12, wc.y, wc.z);
  rimGroup.add(hubFace);
  disc(44, 26, M.rim, 'Rim_CenterCap', rimGroup, [wc.x + 26, wc.y, wc.z]);
  // tyre
  const tyreGeo = cached('tyre', () => {
    const pts = [];
    const push = (r, y) => pts.push(new THREE.Vector2(r, y));
    push(229, -108);
    push(258, -104);
    push(288, -96);
    push(312, -84);
    push(324, -66);
    push(326, -50);
    push(326, 50);
    push(324, 66);
    push(312, 84);
    push(288, 96);
    push(258, 104);
    push(229, 108);
    push(229, -108);
    const g = new THREE.LatheGeometry(pts, 64);
    g.computeVertexNormals();
    return g;
  });
  const tyre = new THREE.Mesh(tyreGeo, M.tyre);
  tyre.name = 'Tyre';
  tyre.rotation.z = -Math.PI / 2;
  tyre.position.set(wc.x, wc.y, wc.z);
  tyre.castShadow = true;
  rimGroup.add(tyre);
  const valve = mesh(softCylinder(9, 34, 12, 2), M.rubber, 'Tyre_ValveStem', wheel, [wc.x - 96, wc.y + 60, wc.z + 160]);
  valve.rotation.x = 0.5;
  // brake disc (spins with the wheel)
  const discRingFront = new THREE.Mesh(softCylinder(170, 12, 60, 3), M.disc);
  discRingFront.name = 'BrakeDisc_OuterFace';
  discRingFront.rotation.z = Math.PI / 2;
  discRingFront.position.set(706, 320, 42);
  discRingFront.castShadow = true;
  wheel.add(discRingFront);
  const discRingRear = new THREE.Mesh(softCylinder(170, 12, 60, 3), M.disc);
  discRingRear.name = 'BrakeDisc_InnerFace';
  discRingRear.rotation.z = Math.PI / 2;
  discRingRear.position.set(686, 320, 42);
  wheel.add(discRingRear);
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(150, 150, 12, 48, 1, true), M.discHat);
  vent.name = 'BrakeDisc_Vent';
  vent.rotation.z = Math.PI / 2;
  vent.position.set(696, 320, 42);
  wheel.add(vent);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const fin = mesh(chamferBox(10, 26, 18, 2, 1), M.discHat, `BrakeDisc_Vane_${i}`, wheel, [696, 320 + Math.cos(a) * 130, 42 + Math.sin(a) * 130]);
    fin.rotation.x = -a;
  }
  const hat = new THREE.Mesh(softCylinder(104, 40, 40, 3), M.discHat);
  hat.name = 'BrakeDisc_Hat';
  hat.rotation.z = Math.PI / 2;
  hat.position.set(716, 320, 42);
  wheel.add(hat);

  // ============================================================== coilover
  const damper = new THREE.Group();
  damper.name = 'COILOVER';
  root.add(damper);
  const D_REST = CONSTANTS.L_DAMPER;
  const seatLow = 96;
  const seatHigh = D_REST - 44;
  const springRest = seatHigh - seatLow;
  const bodyLen = 300;
  const damperAxisRest = new THREE.Vector3().subVectors(P.damperTop, P.damperLower).normalize();
  // body (anodised) from the lower mount up
  const dBody = new THREE.Mesh(softCylinder(32, bodyLen, 32, 4), M.anodisedRed);
  dBody.name = 'Damper_Body';
  dBody.position.copy(P.damperLower).addScaledVector(damperAxisRest, bodyLen / 2);
  dBody.quaternion.setFromUnitVectors(UP, damperAxisRest);
  dBody.castShadow = true;
  damper.add(dBody);
  mesh(softCylinder(38, 44, 32, 3), M.aluCast, 'Damper_ThreadedCollar', damper, [P.damperLower.x, P.damperLower.y + 26, P.damperLower.z]);
  // rod (chrome) from the body top to the top mount
  const rodStart = new THREE.Vector3().copy(P.damperLower).addScaledVector(damperAxisRest, bodyLen);
  const rodRest = new THREE.Vector3().subVectors(P.damperTop, rodStart).length();
  const dRod = new THREE.Mesh(tubeBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, rodRest, 0), 13, 20), M.chrome);
  dRod.name = 'Damper_Rod';
  dRod.castShadow = true;
  const rodGroup = new THREE.Group();
  rodGroup.name = 'Damper_RodAssembly';
  rodGroup.position.copy(rodStart);
  rodGroup.quaternion.setFromUnitVectors(UP, damperAxisRest);
  rodGroup.add(dRod);
  const bumpStop = new THREE.Mesh(softCylinder(30, 46, 24, 3), M.bush);
  bumpStop.name = 'Damper_BumpStop';
  bumpStop.position.set(0, rodRest - 30, 0);
  rodGroup.add(bumpStop);
  const upperSeat = new THREE.Mesh(softCylinder(74, 18, 36, 3), M.aluCast);
  upperSeat.name = 'Damper_UpperSeat';
  upperSeat.position.set(0, seatLow + springRest - bodyLen, 0);
  rodGroup.add(upperSeat);
  damper.add(rodGroup);
  // lower seat
  const lowerSeat = new THREE.Mesh(softCylinder(74, 18, 36, 3), M.aluCast);
  lowerSeat.name = 'Damper_LowerSeat';
  lowerSeat.position.copy(P.damperLower).addScaledVector(damperAxisRest, seatLow);
  lowerSeat.quaternion.setFromUnitVectors(UP, damperAxisRest);
  damper.add(lowerSeat);
  // spring (originated at its bottom so it can be scaled about the seat)
  const springGeo = cached('coilspring', () => {
    const pts = [];
    const coils = 8;
    const steps = coils * 26;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * coils * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 58, t * springRest, Math.sin(a) * 58));
    }
    return tubeThrough(pts, 10, steps * 2, 10, false);
  });
  const spring = new THREE.Mesh(springGeo, M.springCoat);
  spring.name = 'Coil_Spring';
  spring.castShadow = true;
  const springGroup = new THREE.Group();
  springGroup.name = 'SpringAssembly';
  springGroup.position.copy(P.damperLower).addScaledVector(damperAxisRest, seatLow);
  springGroup.quaternion.setFromUnitVectors(UP, damperAxisRest);
  springGroup.add(spring);
  damper.add(springGroup);
  // top mount on the tower
  const topMount = mesh(softCylinder(96, 20, 36, 3), M.aluCast, 'Damper_TopMount', damper, [P.damperTop.x, P.damperTop.y - 18, P.damperTop.z]);
  topMount.castShadow = true;
  disc(30, 40, M.chrome, 'Damper_TopNut', damper, [P.damperTop.x, P.damperTop.y + 6, P.damperTop.z]);
  // dust boot over the rod
  const dustGeo = cached('dustboot', () => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(new THREE.Vector2(40 + Math.sin(t * Math.PI) * 22, t * (springRest * 0.55)));
    }
    return new THREE.LatheGeometry(pts, 28);
  });
  const dust = new THREE.Mesh(dustGeo, M.boot);
  dust.name = 'Damper_DustBoot';
  dust.position.copy(P.damperLower).addScaledVector(damperAxisRest, seatLow + springRest * 0.2);
  dust.quaternion.setFromUnitVectors(UP, damperAxisRest);
  damper.add(dust);

  // ================================================== anti roll bar arm + link
  const arbArm = new THREE.Group();
  arbArm.name = 'ARB_ARM';
  root.add(arbArm);
  const barRootRest = new THREE.Vector3(P.arbAxis.x - 30, P.arbAxis.y, P.arbAxis.z);
  strut(barRootRest, P.arbArmEnd, 40, 34, M.steelDark, 'ARB_Arm', arbArm);
  disc(30, 34, M.steelDark, 'ARB_Arm_Boss', arbArm, [P.arbArmEnd.x, P.arbArmEnd.y, P.arbArmEnd.z]);
  const droplink = new THREE.Group();
  droplink.name = 'ARB_DROPLINK';
  root.add(droplink);
  {
    const mid = new THREE.Vector3().addVectors(P.arbArmEnd, P.arbLinkOnWishbone).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(P.arbLinkOnWishbone, P.arbArmEnd);
    const len = dir.length();
    const g = rod(new THREE.Vector3(0, -len / 2, 0), new THREE.Vector3(0, len / 2, 0), 14, M.steelDark, 'Droplink_Rod', droplink);
    void g;
    for (const y of [-len / 2 + 6, len / 2 - 6]) {
      const b = new THREE.Mesh(softCylinder(20, 26, 20, 2), M.steelDark);
      b.name = `Droplink_Joint_${y}`;
      b.position.set(0, y, 0);
      droplink.add(b);
    }
    droplink.position.copy(mid);
    droplink.quaternion.setFromUnitVectors(UP, dir.normalize());
  }

  // ================================================================ tie rod
  const tieRod = new THREE.Group();
  tieRod.name = 'TIE_ROD';
  root.add(tieRod);
  {
    const restA = P.rackEnd;
    const restB = P.steerArm;
    const mid = new THREE.Vector3().addVectors(restA, restB).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(restB, restA);
    const len = dir.length();
    tieRod.position.copy(mid);
    tieRod.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    const shaft = rod(new THREE.Vector3(0, -len / 2 + 30, 0), new THREE.Vector3(0, len / 2 - 20, 0), 13, M.chrome, 'TieRod_Shaft', tieRod);
    shaft.castShadow = true;
    const sleeve = new THREE.Mesh(softCylinder(19, 110, 24, 2), M.steelDark);
    sleeve.name = 'TieRod_Sleeve';
    tieRod.add(sleeve);
    mesh(chamferBox(30, 40, 30, 6, 2), M.steelDark, 'TieRod_JamNut', tieRod, [0, len / 2 - 44, 0]);
    const bootGeo2 = cached('tiebood', () => {
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        pts.push(new THREE.Vector2(14 + Math.sin(t * Math.PI * 0.9) * 16, t * 26));
      }
      return new THREE.LatheGeometry(pts, 20);
    });
    const tb = new THREE.Mesh(bootGeo2, M.boot);
    tb.name = 'TieRod_Boot';
    tb.position.set(0, len / 2 - 12, 0);
    tb.rotation.x = Math.PI;
    tieRod.add(tb);
  }

  // ============================================================= driveshaft
  const driveshaft = new THREE.Group();
  driveshaft.name = 'DRIVESHAFT';
  root.add(driveshaft);
  const restA = P.diffOut;
  const restB = P.hubInner;
  {
    const mid = new THREE.Vector3().addVectors(restA, restB).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(restB, restA);
    const len = dir.length();
    driveshaft.position.copy(mid);
    driveshaft.quaternion.setFromUnitVectors(XAXIS, dir.clone().normalize());
    const shaft = rod(new THREE.Vector3(-len / 2 + 60, 0, 0), new THREE.Vector3(len / 2 - 46, 0, 0), 22, M.steelDark, 'Driveshaft_Shaft', driveshaft);
    shaft.castShadow = true;
    // inner CV (tripod) at the diff
    const innerCv = new THREE.Mesh(softCylinder(56, 76, 32, 3), M.steelDark);
    innerCv.name = 'CV_Inner_Tulip';
    innerCv.rotation.z = Math.PI / 2;
    innerCv.position.set(-len / 2 + 38, 0, 0);
    driveshaft.add(innerCv);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const roller = new THREE.Mesh(softCylinder(17, 26, 20, 2), M.chrome);
      roller.name = `CV_Inner_Roller_${i}`;
      roller.rotation.z = Math.PI / 2;
      roller.position.set(-len / 2 + 30, Math.cos(a) * 34, Math.sin(a) * 34);
      driveshaft.add(roller);
    }
    const innerBoot = new THREE.Mesh(softCylinder(46, 62, 28, 3), M.boot);
    innerBoot.name = 'CV_Inner_Boot';
    innerBoot.rotation.z = Math.PI / 2;
    innerBoot.position.set(-len / 2 + 96, 0, 0);
    driveshaft.add(innerBoot);
    // outer CV at the hub
    const outerCv = new THREE.Mesh(softCylinder(50, 70, 32, 3), M.steelDark);
    outerCv.name = 'CV_Outer_Housing';
    outerCv.rotation.z = Math.PI / 2;
    outerCv.position.set(len / 2 - 40, 0, 0);
    driveshaft.add(outerCv);
    const outerBoot = new THREE.Mesh(softCylinder(44, 58, 28, 3), M.boot);
    outerBoot.name = 'CV_Outer_Boot';
    outerBoot.rotation.z = Math.PI / 2;
    outerBoot.position.set(len / 2 - 96, 0, 0);
    driveshaft.add(outerBoot);
  }

  // ================================================================ brake hose
  const hosePts = [new THREE.Vector3(330, 300, 60), new THREE.Vector3(470, 330, 70), new THREE.Vector3(560, 380, 60), new THREE.Vector3(640, 400, 40)];
  const hose = new THREE.Group();
  hose.name = 'BRAKE_HOSE';
  root.add(hose);
  const hoseGeo = cached('hosemesh', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePts), 32, 6, 10, false));
  const hoseMesh = new THREE.Mesh(hoseGeo, M.hose);
  hoseMesh.name = 'BrakeHose_Tube';
  hose.add(hoseMesh);
  const hoseFitting = mesh(softCylinder(11, 26, 14, 2), M.brass, 'BrakeHose_Fitting', hose, [640, 400, 40]);
  void hoseFitting;

  // ================================================================ shadowing
  root.traverse((o) => {
    if (o.isMesh && o.castShadow === undefined) o.castShadow = true;
  });

  const groups = { chassis, lowerArm, upperArm, knuckle, wheel, rimGroup, damper, arbArm, droplink, tieRod, driveshaft, springGroup, rodGroup, dRod, dust, damperAxisRest, seatLow, springRest, rodRest };

  // ---------------------------------------------------------------- update
  function update(sol, spin) {
    setMatrix(lowerArm, pivotMatrix(P.lcaFront, AXIS_L, sol.angleLower));
    setMatrix(upperArm, pivotMatrix(P.ucaFront, AXIS_U, sol.angleUpper));
    setMatrix(knuckle, sol.knuckleMatrix);

    // wheel spin inside the knuckle frame
    const spinM = new THREE.Matrix4()
      .makeTranslation(wc.x, wc.y, wc.z)
      .multiply(new THREE.Matrix4().makeRotationAxis(XAXIS, spin))
      .multiply(new THREE.Matrix4().makeTranslation(-wc.x, -wc.y, -wc.z));
    setMatrix(wheel, spinM);

    // coilover: rotate the whole strut onto the new lower mount, then
    // compress the spring and slide the rod
    const restAxis = damperAxisRest;
    const nowAxis = sol.damperAxis;
    const q = new THREE.Quaternion().setFromUnitVectors(restAxis, nowAxis);
    const dm = new THREE.Matrix4()
      .makeTranslation(sol.damperLowerNow.x, sol.damperLowerNow.y, sol.damperLowerNow.z)
      .multiply(new THREE.Matrix4().makeRotationFromQuaternion(q))
      .multiply(new THREE.Matrix4().makeTranslation(-P.damperLower.x, -P.damperLower.y, -P.damperLower.z));
    setMatrix(damper, dm);
    const gap = Math.max(30, sol.damperLength - seatLow - 44);
    springGroup.scale.set(1, gap / springRest, 1);
    const rodNow = Math.max(40, sol.damperLength - bodyLen);
    rodGroup.scale.set(1, rodNow / rodRest, 1);
    rodGroup.position.copy(P.damperLower).addScaledVector(restAxis, bodyLen);
    dust.visible = sol.damperLength > bodyLen + 70;

    // anti roll bar arm
    setMatrix(arbArm, pivotMatrix(P.arbAxis, XAXIS, sol.arbTwist));
    placeLink(droplink, sol.arbArmEndNow, sol.linkOnWishbone, REST_DROPLINK);
    placeLink(tieRod, sol.tieRod.a, sol.tieRod.b, REST_TIE);
    placeLink(driveshaft, sol.driveshaft.a, sol.driveshaft.b, REST_SHAFT);
  }

  return { root, groups, update, points: P };
}
