// timing.js - the chain drive. A single row chain from the crank sprocket to
// the exhaust cam sprocket, and a short chain from there to the inlet cam
// sprocket (the S54/S50 single row layout). Both runs are drawn as a real
// roller chain: side plates plus one roller per pitch, spaced at the 9.525 mm
// chain pitch, so the link count is a computed number, not a decoration.

import * as THREE from 'three';
import * as K from '../kinematics.js';
import { mesh, alongX, sprocketShape } from './profile.js';
import { cached } from '../lib/geom.js';

const CHAIN_X = -K.HALF_LENGTH - 22; // the plane both sprockets sit in

// ---------------------------------------------------------------------------
// A two pulley chain path in the (y, z) plane: the two external tangent lines
// plus the wrap arcs. Returns points and their outward normals.
export function chainPath(c1, r1, c2, r2, seg = 32) {
  const dy = c2[0] - c1[0];
  const dz = c2[1] - c1[1];
  const d = Math.hypot(dy, dz);
  const ex = dy / d;
  const ez = dz / d;
  let nx = -ez;
  let nz = ex;
  // outward normals of the two tangent lines (open belt, no crossing)
  if (r2 < r1) {
    nx = -nx;
    nz = -nz;
  }
  const alpha = Math.asin(Math.max(-1, Math.min(1, (r2 - r1) / d)));
  const pts = [];
  const push = (a, b, na, nb) => pts.push({ y: a, z: b, ny: na, nz: nb });
  const A1 = [c1[0] + nx * r1, c1[1] + nz * r1];
  const B1 = [c2[0] + nx * r2, c2[1] + nz * r2];
  const B2 = [c2[0] - nx * r2, c2[1] - nz * r2];
  const A2 = [c1[0] - nx * r1, c1[1] - nz * r1];

  // straight run, pulley 1 to pulley 2
  const nStep = Math.max(2, Math.round(Math.hypot(B1[0] - A1[0], B1[1] - A1[1]) / 18));
  for (let i = 0; i <= nStep; i++) {
    const t = i / nStep;
    push(A1[0] + (B1[0] - A1[0]) * t, A1[1] + (B1[1] - A1[1]) * t, nx, nz);
  }
  // wrap on pulley 2: from angle(B1) to angle(B2), magnitude pi - 2 alpha
  const a0 = Math.atan2(B1[1] - c2[1], B1[0] - c2[0]);
  const a1 = Math.atan2(B2[1] - c2[1], B2[0] - c2[0]);
  const want = Math.PI - 2 * alpha;
  let sweep = a1 - a0;
  while (sweep > 0) sweep -= 2 * Math.PI;
  if (Math.abs(sweep) < want) sweep = a1 - a0 + 2 * Math.PI;
  const st2 = seg;
  for (let i = 1; i <= st2; i++) {
    const a = a0 + (sweep * i) / st2;
    push(c2[0] + Math.cos(a) * r2, c2[1] + Math.sin(a) * r2, Math.cos(a), Math.sin(a));
  }
  // straight run back, pulley 2 to pulley 1
  const nStep2 = Math.max(2, Math.round(Math.hypot(A2[0] - B2[0], A2[1] - B2[1]) / 18));
  for (let i = 1; i <= nStep2; i++) {
    const t = i / nStep2;
    push(B2[0] + (A2[0] - B2[0]) * t, B2[1] + (A2[1] - B2[1]) * t, -nx, -nz);
  }
  // wrap on pulley 1
  const b0 = Math.atan2(A2[1] - c1[1], A2[0] - c1[0]);
  const b1 = Math.atan2(A1[1] - c1[1], A1[0] - c1[0]);
  const want1 = Math.PI + 2 * alpha;
  let sweep1 = b1 - b0;
  while (sweep1 < 0) sweep1 += 2 * Math.PI;
  if (Math.abs(sweep1) > want1 + 0.4) sweep1 = b1 - b0 - 2 * Math.PI;
  for (let i = 1; i <= seg; i++) {
    const a = b0 + (sweep1 * i) / seg;
    push(c1[0] + Math.cos(a) * r1, c1[1] + Math.sin(a) * r1, Math.cos(a), Math.sin(a));
  }
  return pts;
}

// Side plate ribbon: a flat strip standing on the path, plated along x.
function ribbonGeometry(pts, xPlane, width, thickness) {
  const n = pts.length;
  const pos = [];
  const uv = [];
  const idx = [];
  let run = 0;
  const along = [0];
  for (let i = 1; i <= n; i++) {
    const a = pts[i - 1];
    const b = pts[i % n];
    run += Math.hypot(b.y - a.y, b.z - a.z);
    along.push(run);
  }
  const total = run;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const o = thickness / 2;
    const x0 = xPlane - width / 2;
    const x1 = xPlane + width / 2;
    pos.push(
      x0, p.y + p.ny * o, p.z + p.nz * o,
      x1, p.y + p.ny * o, p.z + p.nz * o,
      x1, p.y - p.ny * o, p.z - p.nz * o,
      x0, p.y - p.ny * o, p.z - p.nz * o
    );
    const u = along[i] / 24;
    uv.push(u, 0, u, 0.3, u, 0.7, u, 1);
  }
  const quad = (a, b, c, d) => idx.push(a, b, d, b, c, d);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const o0 = i * 4;
    const o1 = j * 4;
    quad(o0 + 0, o1 + 0, o1 + 1, o0 + 1);
    quad(o0 + 1, o1 + 1, o1 + 2, o0 + 2);
    quad(o0 + 2, o1 + 2, o1 + 3, o0 + 3);
    quad(o0 + 3, o1 + 3, o1 + 0, o0 + 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.length = total;
  return g;
}

/** A complete chain: plates plus one roller per pitch of 9.525 mm. */
export function buildChain(M, c1, r1, c2, r2, name) {
  const g = new THREE.Group();
  g.name = name;
  const pts = chainPath(c1, r1, c2, r2);
  mesh(ribbonGeometry(pts, CHAIN_X, 7.5, 3.2), M.chainSteel, name + '_Plates', g);

  // sample the path at the chain pitch to place rollers
  const cum = [0];
  let total = 0;
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i % pts.length];
    total += Math.hypot(b.y - a.y, b.z - a.z);
    cum.push(total);
  }
  const links = Math.round(total / K.CHAIN.pitch);
  const roller = cached('chainRoller', () => {
    const geo = new THREE.CylinderGeometry(3.6, 3.6, 8.0, 12);
    geo.rotateZ(Math.PI / 2);
    return geo;
  });
  const rollers = new THREE.InstancedMesh(roller, M.steelBright, links);
  rollers.name = name + '_Rollers';
  rollers.castShadow = true;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  const place = (offset) => {
    for (let k = 0; k < links; k++) {
      let s = (k / links) * total + offset;
      s = ((s % total) + total) % total;
      let i = 1;
      while (i < cum.length && cum[i] < s) i++;
      const a = pts[(i - 1) % pts.length];
      const b = pts[i % pts.length];
      const seg = cum[i] - cum[i - 1] || 1;
      const t = (s - cum[i - 1]) / seg;
      m4.compose(pos.set(CHAIN_X, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t), q, one);
      rollers.setMatrixAt(k, m4);
    }
    rollers.instanceMatrix.needsUpdate = true;
  };
  place(0);
  g.add(rollers);
  g.userData.links = links;
  g.userData.length = total;
  return { group: g, links, total, advance: place };
}

// ---------------------------------------------------------------------------
export function buildTiming(M) {
  const g = new THREE.Group();
  g.name = 'TIMING_DRIVE';
  const rCrank = K.sprocketRadius(K.CHAIN.crankTeeth);
  const rCam = K.sprocketRadius(K.CHAIN.camTeeth);
  const cCrank = [0, 0];
  const cCamE = [K.CAM_Y, -K.CAM_U];
  const cCamI = [K.CAM_Y, K.CAM_U];

  const main = buildChain(M, cCrank, rCrank, cCamE, rCam, 'CHAIN_MAIN');
  const second = buildChain(M, cCamE, rCam, cCamI, rCam, 'CHAIN_SECONDARY');
  g.add(main.group, second.group);

  // Guide rail riding the slack straight run of the main chain (the -z run),
  // and a hydraulic tensioner on the other run. The angles are the actual
  // tangent angles of the two sprockets, not guesses.
  const d = Math.hypot(cCamE[0] - cCrank[0], cCamE[1] - cCrank[1]);
  const eY = (cCamE[0] - cCrank[0]) / d;
  const eZ = (cCamE[1] - cCrank[1]) / d;
  const ang = Math.atan2(eZ, eY);
  const railLen = Math.round(d - 40);
  const railGeo = cached('chainRailGeo', () => alongX([[-6, 0], [6, 0], [6, railLen], [-6, railLen]], 14));
  const rail = mesh(railGeo, M.blackOxide, 'ChainGuideRail', g, [
    CHAIN_X + 10,
    24,
    -34,
  ]);
  rail.rotation.x = ang;
  mesh(new THREE.CylinderGeometry(7, 7, 20, 16), M.aluCast, 'RailPivot', g, [
    CHAIN_X + 10,
    24,
    -34,
  ]).rotation.x = Math.PI / 2;
  // short guide on the secondary chain's upper run
  mesh(
    cached('chainRailShort', () => alongX([[-6, 0], [6, 0], [6, 90], [-6, 90]], 12)),
    M.blackOxide,
    'ChainGuideSecondary',
    g,
    [CHAIN_X + 10, K.CAM_Y + 70, -45]
  ).rotation.z = Math.PI / 2;

  // tensioner: a piston in a bore pushing the guide rail
  const tens = new THREE.Group();
  tens.name = 'CHAIN_TENSIONER';
  tens.position.set(CHAIN_X + 10, 120, 62);
  tens.rotation.x = ang;
  tens.rotation.z = 0;
  g.add(tens);
  mesh(new THREE.CylinderGeometry(17, 17, 74, 24), M.aluCast, 'TensionerBody', tens);
  mesh(new THREE.CylinderGeometry(12, 12, 46, 20), M.steelBright, 'TensionerPiston', tens, [0, 48, 0]);
  mesh(new THREE.CylinderGeometry(20, 20, 9, 24), M.blackOxide, 'TensionerCap', tens, [0, -40, 0]);

  // VANOS: the stepless double adjuster on the front of the head. Two actuator
  // bores whose pistons travel with the VANOS amount.
  const vanos = new THREE.Group();
  vanos.name = 'VANOS';
  vanos.position.set(-K.HALF_LENGTH - 70, K.CAM_Y - 6, 0);
  const housing = alongX(
    [
      [-96, -86],
      [96, -86],
      [96, 70],
      [-96, 70],
    ],
    34
  );
  const hm = mesh(housing, M.aluCast, 'VanosHousing', vanos, [0, 0, 0]);
  hm.rotation.y = Math.PI / 2;
  g.add(vanos);
  const pistons = [];
  for (const s of [-1, 1]) {
    const bore = cached('vanosBore', () => {
      const geo = new THREE.CylinderGeometry(21, 21, 60, 28);
      geo.rotateZ(Math.PI / 2);
      return geo;
    });
    const bm = mesh(bore, M.aluMachined, `VanosBore_${s}`, vanos, [s * 0, -20, s * 52]);
    bm.rotation.y = Math.PI / 2;
    const p = new THREE.Group();
    p.name = `VanosPiston_${s}`;
    p.position.set(0, -20, s * 52);
    vanos.add(p);
    const piston = cached('vanosPiston', () => {
      const geo = new THREE.CylinderGeometry(18, 18, 26, 24);
      geo.rotateZ(Math.PI / 2);
      return geo;
    });
    const pm = mesh(piston, M.steelBright, `VanosPistonBody_${s}`, p);
    pm.rotation.y = Math.PI / 2;
    pistons.push(p);
  }
  return { group: g, pistons, chains: [main, second] };
}

const RAD_ = (d) => (d * Math.PI) / 180;
