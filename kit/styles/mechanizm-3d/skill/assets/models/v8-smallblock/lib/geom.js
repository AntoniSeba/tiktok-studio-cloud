// geom.js - reusable procedural geometry helpers for the V8 assembly.
// All dimensions are millimetres (1 three.js unit = 1 mm).

import * as THREE from 'three';

const _cache = new Map();

// Cache geometry per key so repeated parts (bolts, valves, pistons) share buffers.
export function cached(key, factory) {
  let g = _cache.get(key);
  if (!g) {
    g = factory();
    _cache.set(key, g);
  }
  return g;
}

export function disposeCache() {
  for (const g of _cache.values()) g.dispose?.();
  _cache.clear();
}

// ---------------------------------------------------------------- primitives

// Box with chamfered/rounded edges, built by extruding a rounded rectangle
// (Z is the extrusion axis, so `d` is depth along Z).
export function chamferBox(w, h, d, r = 5, bevel = 2) {
  r = Math.max(1, Math.min(r, w / 2 - 0.5, h / 2 - 0.5));
  bevel = Math.max(0, Math.min(bevel, d / 2 - 0.5, r * 0.9));
  return cached(`cb|${w}|${h}|${d}|${r}|${bevel}`, () => {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    const depth = Math.max(d - bevel * 2, 0.2);
    const g = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 2,
      curveSegments: 3,
    });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  });
}

// Extrude an arbitrary XY polygon along Z (used for the block casting profile).
export function extrudeProfile(points, depth, bevel = 2) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  const b = Math.max(0, Math.min(bevel, depth / 2 - 0.5));
  const d = Math.max(depth - b * 2, 0.2);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: d,
    bevelEnabled: b > 0,
    bevelSize: b,
    bevelThickness: b,
    bevelSegments: 1,
    curveSegments: 3,
  });
  g.translate(0, 0, -d / 2);
  g.computeVertexNormals();
  return g;
}

export function cylinder(rTop, rBottom, h, seg = 20, open = false) {
  return new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open);
}

// Straight tube between two points.
export function tubeBetween(a, b, radius, radialSeg = 10) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(radius, radius, len, radialSeg, 1, false);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  );
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone(), q, new THREE.Vector3(1, 1, 1)));
  return g;
}

// Swept tube through a point list (headers, runners, wires).
export function tubeThrough(points, radius, tubularSeg = 40, radialSeg = 8, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))),
    closed,
    'catmullrom',
    0.4
  );
  return new THREE.TubeGeometry(curve, tubularSeg, radius, radialSeg, closed);
}

// Helical compression spring.
export function coilSpring(r, height, coils, wire = 3) {
  const pts = [];
  const turns = coils * 10;
  for (let i = 0; i <= turns; i++) {
    const t = i / turns;
    const a = t * coils * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, t * height, Math.sin(a) * r));
  }
  return tubeThrough(pts, wire, turns * 2, 6, false);
}

// Spur-gear profile (ring gears, timing sprockets, distributor gear).
export function gearShape(teeth, rOut, rIn, toothDepth) {
  const s = new THREE.Shape();
  const pitch = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * pitch;
    const a1 = a0 + pitch * 0.25;
    const a2 = a0 + pitch * 0.5;
    const a3 = a0 + pitch * 0.75;
    const rTip = rIn + toothDepth;
    const p = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
    if (i === 0) s.moveTo(...p(rIn, a0));
    else s.lineTo(...p(rIn, a0));
    s.lineTo(...p(rTip, a0 + pitch * 0.1));
    s.lineTo(...p(rTip, a0 + pitch * 0.4));
    s.lineTo(...p(rIn, a1));
    s.lineTo(...p(rIn, a2));
    s.lineTo(...p(rTip, a2 + pitch * 0.1));
    s.lineTo(...p(rTip, a2 + pitch * 0.4));
    s.lineTo(...p(rIn, a3));
  }
  s.closePath();
  return s;
}

export function gearGeometry(teeth, rIn, toothDepth, depth) {
  return cached(`gear|${teeth}|${rIn}|${toothDepth}|${depth}`, () => {
    const g = new THREE.ExtrudeGeometry(gearShape(teeth, rIn + toothDepth, rIn, toothDepth), {
      depth,
      bevelEnabled: false,
      curveSegments: 1,
    });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  });
}

// Half-round counterweight (crank throws).
export function counterweight(r, depth, startAngle, sweep) {
  return cached(`cw|${r}|${depth}|${startAngle}|${sweep}`, () => {
    const g = new THREE.CylinderGeometry(r, r, depth, 28, 1, false, startAngle, sweep);
    g.rotateX(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  });
}

// Sector disc built from an arc (crank counterweights, gussets).
// a1/a2 in radians measured from +X, extruded along Z.
export function arcDisc(r, a1, a2, depth, seg = 24) {
  return cached(`ad|${r}|${a1}|${a2}|${depth}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.absarc(0, 0, r, a1, a2, false);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: seg });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  });
}


// --------------------------------------------------------------- belt drive
// Belt path generator: given ordered pulleys (x, y, r) in a plane, compute the
// outer tangent lines and the wrap arcs around each pulley, plus per-sample
// outward radial normals. This is what makes the belts sit on the pulleys
// instead of being a decorative ring.
export function beltPath(pulleys) {
  const n = pulleys.length;
  const cx = pulleys.reduce((s, p) => s + p.x, 0) / n;
  const cy = pulleys.reduce((s, p) => s + p.y, 0) / n;
  const V = (x, y) => new THREE.Vector2(x, y);

  const segs = [];
  for (let i = 0; i < n; i++) {
    const A = pulleys[i];
    const B = pulleys[(i + 1) % n];
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const L = Math.hypot(dx, dy);
    const base = Math.atan2(dy, dx);
    const alpha = Math.acos(THREE.MathUtils.clamp((A.r - B.r) / L, -1, 1));
    let best = null;
    for (const s of [1, -1]) {
      const ang = base + s * alpha;
      const nrm = V(Math.cos(ang), Math.sin(ang));
      const t1 = V(A.x, A.y).addScaledVector(nrm, A.r);
      const t2 = V(B.x, B.y).addScaledVector(nrm, B.r);
      const mid = t1.clone().add(t2).multiplyScalar(0.5);
      const d = Math.hypot(mid.x - cx, mid.y - cy);
      if (!best || d > best.d + 1e-6) best = { d, nrm, t1, t2 };
    }
    segs.push({ a: A, b: B, nrm: best.nrm, t1: best.t1, t2: best.t2 });
  }

  // Wrap arc on each pulley: keep the arc that bulges away from the layout
  // centroid (the belt always runs on the outside of a convex drive).
  const samples = [];
  const push = (p2, rad2, tan2) => samples.push({ p: p2, rad: rad2, tan: tan2 });
  for (let i = 0; i < n; i++) {
    const line = segs[i];
    const steps = Math.max(2, Math.ceil(line.t1.distanceTo(line.t2) / 14));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const p = line.t1.clone().lerp(line.t2, t);
      const tan = line.t2.clone().sub(line.t1).normalize();
      push(p, line.nrm.clone(), tan);
    }
    const P = pulleys[(i + 1) % n];
    const aIn = Math.atan2(line.t2.y - P.y, line.t2.x - P.x);
    const out = segs[(i + 1) % n];
    const aOut = Math.atan2(out.t1.y - P.y, out.t1.x - P.x);
    const cwSweep = ((aIn - aOut) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const ccwSweep = Math.PI * 2 - cwSweep;
    // pick the direction whose arc mid-point is farther from the centroid
    const evalSweep = (sweep, dir) => {
      const midA = aIn + dir * sweep * 0.5;
      const mx = P.x + Math.cos(midA) * P.r;
      const my = P.y + Math.sin(midA) * P.r;
      return Math.hypot(mx - cx, my - cy);
    };
    const cwScore = evalSweep(cwSweep, -1);
    const ccwScore = evalSweep(ccwSweep, 1);
    const useCcw = ccwScore >= cwScore;
    const sweep = useCcw ? ccwSweep : cwSweep;
    const dir = useCcw ? 1 : -1;
    const steps2 = Math.max(3, Math.ceil((sweep * P.r) / 12));
    for (let k = 1; k <= steps2; k++) {
      const a = aIn + dir * sweep * (k / steps2);
      const rad = V(Math.cos(a), Math.sin(a));
      const tan = V(-Math.sin(a), Math.cos(a)).multiplyScalar(dir);
      push(V(P.x + rad.x * P.r, P.y + rad.y * P.r), rad, tan);
    }
  }
  return samples;
}

// Belt / chain ribbon: rectangular cross-section swept along a beltPath result.
// width = across the pulley (Z), thickness = radial.
export function beltRibbon(samples, width, thickness, planeZ = 0, uvScale = 45) {
  const pos = [];
  const uv = [];
  const idx = [];
  const n = samples.length;
  let run = 0;
  const center = [];
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    const prev = samples[(i - 1 + n) % n];
    run += Math.hypot(s.p.x - prev.p.x, s.p.y - prev.p.y);
    center.push([s.p, s.rad, run]);
  }
  const total = run;
  const v = (s, signOut, signZ) =>
    pos.push(
      s.p.x + s.rad.x * (thickness / 2) * signOut,
      s.p.y + s.rad.y * (thickness / 2) * signOut,
      planeZ + (width / 2) * signZ
    );
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    v(s, 1, 1);
    v(s, -1, 1);
    v(s, -1, -1);
    v(s, 1, -1);
    const u = (center[i][2] / total) * (total / uvScale);
    uv.push(u, 0, u, 1, u, 1, u, 0);
  }
  const quad = (a, b, c, d) => idx.push(a, b, d, b, c, d);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const o0 = i * 4;
    const o1 = j * 4;
    // outer face (rad +), inner face, and the two side faces
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
  g.userData.beltLength = total;
  return g;
}

// ---------------------------------------------------------------- assembly
// The two banks are mirror images, not rotations of each other. Bank parts are
// authored with right-bank numbers inside a rotation-only frame; for the left
// bank the frame's descendants are mirrored in X. Mirrored transform:
// position.x -> -x and quaternion (w,x,y,z) -> (w,x,-y,-z), which keeps the
// triangle winding and normals intact (a negative scale would not).
export function mirrorBankX(group) {
  group.traverse((o) => {
    if (o === group) return;
    o.position.x *= -1;
    const q = o.quaternion;
    q.set(q.w, q.x, -q.y, -q.z);
  });
  return group;
}

export function mesh(geo, mat, name, parent, pos, rot, scale) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  if (parent) parent.add(m);
  return m;
}

// Hex-head fastener: returns a Group (head + shank) so it can be reused a lot.
export function fastener(d = 10, len = 40, hexAcross = 17, material, name = 'Bolt') {
  const key = `bolt|${d}|${len}|${hexAcross}`;
  const g = new THREE.Group();
  g.name = name;
  const geoHead = cached(key + '|h', () =>
    new THREE.CylinderGeometry(hexAcross / 2, hexAcross / 2, hexAcross * 0.42, 6, 1, false)
  );
  const geoShank = cached(key + '|s', () => new THREE.CylinderGeometry(d / 2, d / 2, len, 10));
  const head = new THREE.Mesh(geoHead, material);
  head.name = name + '_Head';
  head.position.y = hexAcross * 0.21;
  const shank = new THREE.Mesh(geoShank, material);
  shank.name = name + '_Shank';
  shank.position.y = -len / 2 + 1;
  g.add(head, shank);
  return g;
}
