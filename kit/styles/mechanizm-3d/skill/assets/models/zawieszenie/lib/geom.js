// geom.js - procedural geometry helpers for the V6 assembly.
// 1 three.js unit = 1 mm. Everything favours soft, chamfered, slightly
// tapered forms: no raw hard-edged boxes anywhere in the engine.

import * as THREE from 'three';

const _cache = new Map();

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

// Chamfered box built from a rounded rectangle profile (Z = depth).
export function chamferBox(w, h, d, r = 8, bevel = 3) {
  r = Math.max(1, Math.min(r, w / 2 - 0.5, h / 2 - 0.5));
  bevel = Math.max(0, Math.min(bevel, d / 2 - 0.5, r * 0.9));
  return cached(`cb|${w}|${h}|${d}|${r}|${bevel}`, () => {
    const s = roundedRectShape(w, h, r);
    const g = extrudeShape(s, d, bevel);
    return g;
  });
}

export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  r = Math.max(1, Math.min(r, w / 2 - 1, h / 2 - 1));
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function extrudeShape(shape, depth, bevel = 3, curveSegments = 10) {
  const b = Math.max(0, Math.min(bevel, depth / 2 - 0.5));
  const d = Math.max(depth - b * 2, 0.2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: b > 0,
    bevelSize: b,
    bevelThickness: b,
    bevelSegments: 2,
    curveSegments,
  });
  g.translate(0, 0, -d / 2);
  g.computeVertexNormals();
  return g;
}

// Tapered box: bottom width wB, top width wT, extruded depth d.
export function taperBox(wB, wT, h, d, r = 8, bevel = 3) {
  return cached(`tb|${wB}|${wT}|${h}|${d}|${r}|${bevel}`, () => {
    const rb = Math.max(1, Math.min(r, wB / 2 - 1, h / 2 - 1));
    const rt = Math.max(1, Math.min(r * 0.8, wT / 2 - 1, h / 2 - 1));
    const s = new THREE.Shape();
    const xB = -wB / 2;
    const xT = -wT / 2;
    const y0 = -h / 2;
    const y1 = h / 2;
    s.moveTo(xB + rb, y0);
    s.lineTo(xB + wB - rb, y0);
    s.quadraticCurveTo(xB + wB, y0, xB + wB - (wB - wT) / 2, y1);
    s.lineTo(xT + wT - rt, y1);
    s.quadraticCurveTo(xT + wT, y1, xT + wT - rt * 0.4, y1 - rt * 0.4);
    s.lineTo(xT + rt * 0.7, y1 - rt * 0.7);
    s.quadraticCurveTo(xT, y1, xT + (wB - wT) / 2, y0);
    s.lineTo(xB + rb, y0);
    return extrudeShape(s, d, bevel);
  });
}

// Profile extrusion (block castings). points = [[x,y], ...] closed polygon.
export function extrudeProfile(points, depth, bevel = 3) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  return extrudeShape(s, depth, bevel, 3);
}

// Lathe-turned part with rounded rims (pulleys, hubs).
export function lathe(profile, seg = 40) {
  const pts = profile.map((p) => new THREE.Vector2(p[0], p[1]));
  return new THREE.LatheGeometry(pts, seg);
}

// Pulley-like body with a smooth rim: axis along Y.
export function smoothDisc(r, width, seg = 64, rimR = 4) {
  return cached(`sd|${r}|${width}|${seg}|${rimR}`, () => {
    const w = width / 2;
    const prof = [
      [0, -w],
      [r - rimR, -w],
      [r, -w + rimR],
      [r, w - rimR],
      [r - rimR, w],
      [0, w],
    ];
    const g = new THREE.LatheGeometry(
      prof.map((p) => new THREE.Vector2(p[0], p[1])),
      seg
    );
    return g;
  });
}

export function cylinder(rTop, rBottom, h, seg = 24, open = false) {
  return new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open);
}

// Cylinder with chamfered ends (reads as a machined part).
export function softCylinder(r, h, seg = 48, chamfer = 2) {
  return cached(`sc|${r}|${h}|${seg}|${chamfer}`, () => {
    const w = h / 2;
    const pts = [
      new THREE.Vector2(0, -w),
      new THREE.Vector2(r - chamfer, -w),
      new THREE.Vector2(r, -w + chamfer),
      new THREE.Vector2(r, w - chamfer),
      new THREE.Vector2(r - chamfer, w),
      new THREE.Vector2(0, w),
    ];
    return new THREE.LatheGeometry(pts, seg);
  });
}

export function tubeBetween(a, b, radius, radialSeg = 12) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(radius, radius, len, radialSeg, 1, false);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone(), q, new THREE.Vector3(1, 1, 1)));
  return g;
}

// Smooth swept tube. tension 0.3-0.5 controls how tight the curve is.
export function tubeThrough(points, radius, tubularSeg = 48, radialSeg = 10, closed = false, tension = 0.34) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))),
    closed,
    'catmullrom',
    tension
  );
  return new THREE.TubeGeometry(curve, tubularSeg, radius, radialSeg, closed);
}

export function coilSpring(r, height, coils, wire = 3, seg = 8) {
  const pts = [];
  const steps = coils * 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * coils * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, t * height, Math.sin(a) * r));
  }
  return tubeThrough(pts, wire, steps * 2, 8, false);
}

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
      bevelEnabled: true,
      bevelSize: 1,
      bevelThickness: 1,
      bevelSegments: 1,
      curveSegments: 1,
    });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  });
}

export function arcDisc(r, a1, a2, depth, seg = 28) {
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

// Smooth cam lobe: base circle + a raised nose with a tangent ramp.
export function camLobeGeometry(nosePhase, baseR = 22, lift = 11, width = 18) {
  return cached(`lobe|${Math.round((nosePhase * 180) / Math.PI)}|${baseR}|${lift}|${width}`, () => {
    const pts = [];
    const n = 96;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const c = Math.cos(t - nosePhase);
      const l = c > -0.4 ? Math.pow((c + 0.4) / 1.4, 2.0) * lift : 0;
      pts.push([Math.cos(t) * (baseR + l), Math.sin(t) * (baseR + l)]);
    }
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n; i++) shape.lineTo(pts[i][0], pts[i][1]);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelSize: 1.2, bevelThickness: 1.2, bevelSegments: 1, curveSegments: 2 });
    g.translate(0, 0, -width / 2);
    g.computeVertexNormals();
    return g;
  });
}

// --------------------------------------------------------------- belt drive
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

  const samples = [];
  const push = (p2, rad2) => samples.push({ p: p2, rad: rad2 });
  for (let i = 0; i < n; i++) {
    const line = segs[i];
    const steps = Math.max(2, Math.ceil(line.t1.distanceTo(line.t2) / 16));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      push(line.t1.clone().lerp(line.t2, t), line.nrm.clone());
    }
    const P = pulleys[(i + 1) % n];
    const aIn = Math.atan2(line.t2.y - P.y, line.t2.x - P.x);
    const out = segs[(i + 1) % n];
    const aOut = Math.atan2(out.t1.y - P.y, out.t1.x - P.x);
    const cwSweep = (((aIn - aOut) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const ccwSweep = Math.PI * 2 - cwSweep;
    const score = (sweep, dir) => {
      const midA = aIn + dir * sweep * 0.5;
      return Math.hypot(P.x + Math.cos(midA) * P.r - cx, P.y + Math.sin(midA) * P.r - cy);
    };
    const useCcw = score(ccwSweep, 1) >= score(cwSweep, -1);
    const sweep = useCcw ? ccwSweep : cwSweep;
    const dir = useCcw ? 1 : -1;
    const steps2 = Math.max(3, Math.ceil((sweep * P.r) / 14));
    for (let k = 1; k <= steps2; k++) {
      const a = aIn + dir * sweep * (k / steps2);
      push(V(P.x + Math.cos(a) * P.r, P.y + Math.sin(a) * P.r), V(Math.cos(a), Math.sin(a)));
    }
  }
  return samples;
}

export function beltRibbon(samples, width, thickness, planeZ = 0, uvScale = 48) {
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
    center.push(run);
  }
  const total = run;
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    const o = thickness / 2;
    const z = width / 2;
    pos.push(
      s.p.x + s.rad.x * o, s.p.y + s.rad.y * o, planeZ + z,
      s.p.x - s.rad.x * o, s.p.y - s.rad.y * o, planeZ + z,
      s.p.x - s.rad.x * o, s.p.y - s.rad.y * o, planeZ - z,
      s.p.x + s.rad.x * o, s.p.y + s.rad.y * o, planeZ - z
    );
    const u = (center[i] / total) * (total / uvScale);
    uv.push(u, 0, u, 1, u, 1, u, 0);
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
  g.userData.beltLength = total;
  return g;
}

// ---------------------------------------------------------------- assembly
// The two banks are mirror images, not rotations of each other. Bank parts are
// authored with right-bank numbers inside a rotation-only frame; for the left
// bank the frame's descendants are mirrored in X (position.x -> -x and
// quaternion (w,x,y,z) -> (w,x,-y,-z)), which preserves winding and normals.
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

export function fastener(d = 9, len = 34, hexAcross = 15, material, name = 'Bolt') {
  const key = `bolt|${d}|${len}|${hexAcross}`;
  const g = new THREE.Group();
  g.name = name;
  const head = new THREE.Mesh(
    cached(key + '|h', () => {
      const hg = new THREE.CylinderGeometry(hexAcross / 2, hexAcross / 2, hexAcross * 0.4, 6, 1, false);
      return hg;
    }),
    material
  );
  head.name = name + '_Head';
  head.position.y = hexAcross * 0.2;
  const shank = new THREE.Mesh(
    cached(key + '|s', () => new THREE.CylinderGeometry(d / 2, d / 2, len, 20)),
    material
  );
  shank.name = name + '_Shank';
  shank.position.y = -len / 2 + 1;
  g.add(head, shank);
  return g;
}
