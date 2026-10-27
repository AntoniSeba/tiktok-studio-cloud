// profile.js - the few shape helpers the castings need. Everything is built
// from extruded cross-sections, so the block and the head are real castings
// with real walls, water jackets and ports, not boxes with holes painted on.
//
// Engine frame: +x = engine length (cylinder 1 at -x, the front), +y = up
// (crank axis at y = 0), +z = lateral towards the intake side.

import * as THREE from 'three';
import { cached } from '../lib/geom.js';

const EPS = 1e-9;

// signed area, so the ring of points can be forced counter-clockwise before it
// reaches THREE.Shape - a reversed outline extrudes inside out
export function ccw(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a >= 0 ? pts : pts.slice().reverse();
}

export function shapeFrom(pts, holes = []) {
  const s = new THREE.Shape();
  const p = ccw(pts);
  s.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
  s.closePath();
  for (const h of holes) {
    const path = new THREE.Path();
    const q = ccw(h).slice().reverse();
    path.moveTo(q[0][0], q[0][1]);
    for (let i = 1; i < q.length; i++) path.lineTo(q[i][0], q[i][1]);
    path.closePath();
    s.holes.push(path);
  }
  return s;
}

// A cross-section laid out in the (z, y) plane, swept along the engine axis.
export function alongX(pts, length, holes = [], bevel = 0) {
  const key = `ax|${length}|${bevel}|${JSON.stringify(pts)}|${holes.length}`;
  return cached(key, () => {
    const s = shapeFrom(
      pts.map(([z, y]) => [-z, y]),
      holes.map((h) => h.map(([z, y]) => [-z, y]))
    );
    const g = new THREE.ExtrudeGeometry(s, {
      depth: length,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 2,
      curveSegments: 24,
    });
    g.translate(0, 0, -length / 2);
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  });
}

// A horizontal cross-section in the (x, z) plane, swept vertically from y0.
export function alongY(pts, y0, thickness, holes = [], bevel = 0) {
  const key = `ay|${y0}|${thickness}|${bevel}|${JSON.stringify(pts)}|${holes.length}`;
  return cached(key, () => {
    const s = shapeFrom(
      pts.map(([x, z]) => [x, -z]),
      holes.map((h) => h.map(([x, z]) => [x, -z]))
    );
    const g = new THREE.ExtrudeGeometry(s, {
      depth: thickness,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 2,
      curveSegments: 24,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y0, 0);
    g.computeVertexNormals();
    return g;
  });
}

// A cross-section in the (x, y) plane, swept along the lateral engine axis.
export function alongZ(pts, z0, thickness, holes = []) {
  const key = `az|${z0}|${thickness}|${JSON.stringify(pts)}|${holes.length}`;
  return cached(key, () => {
    const s = shapeFrom(pts, holes);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: thickness,
      bevelEnabled: true,
      bevelSize: 1.5,
      bevelThickness: 1.5,
      bevelSegments: 2,
      curveSegments: 20,
    });
    g.translate(0, 0, z0);
    g.computeVertexNormals();
    return g;
  });
}

export function circle(cx, cz, r, n = 48) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    p.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return p;
}

// Half of a circle, clipped at z = 0, used for the siamese bore casting.
export function halfCircle(cx, r, n = 24, side = 1) {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI;
    p.push([cx + Math.cos(a) * r * side, Math.sin(a) * r]);
  }
  return p;
}

// A tube: open cylinder with a wall, lathed so the rim is chamfered.
export function tube(rIn, rOut, y0, y1, seg = 32, phiStart = 0, phiLength = Math.PI * 2) {
  const key = `tb|${rIn}|${rOut}|${y0}|${y1}|${seg}|${phiStart.toFixed(3)}|${phiLength.toFixed(3)}`;
  return cached(key, () => {
    const c = Math.min(1.6, (rOut - rIn) * 0.35);
    const pts = [
      new THREE.Vector2(rIn, y0),
      new THREE.Vector2(rIn + c, y0),
      new THREE.Vector2(rOut - c, y0),
      new THREE.Vector2(rOut, y0 + c),
      new THREE.Vector2(rOut, y1 - c),
      new THREE.Vector2(rOut - c, y1),
      new THREE.Vector2(rIn + c, y1),
      new THREE.Vector2(rIn, y1 - c),
    ];
    const g = new THREE.LatheGeometry(pts, seg, phiStart, phiLength);
    return g;
  });
}

// A slab in the (x, z) plane with a rounded-rectangle outline, swept in y.
export function slab(w, d, y0, thickness, radius = 12, cornerSeg = 6) {
  const key = `sl|${w}|${d}|${y0}|${thickness}|${radius}`;
  return cached(key, () => {
    const r = Math.max(0.5, Math.min(radius, w / 2 - 1, d / 2 - 1));
    const pts = [];
    const push = (x, z) => pts.push([x, z]);
    const arc = (cx, cz, a0, a1, n = cornerSeg) => {
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        push(cx + Math.cos(a) * r, cz + Math.sin(a) * r);
      }
    };
    arc(w / 2 - r, -d / 2 + r, -Math.PI / 2, 0);
    arc(w / 2 - r, d / 2 - r, 0, Math.PI / 2);
    arc(-w / 2 + r, d / 2 - r, Math.PI / 2, Math.PI);
    arc(-w / 2 + r, -d / 2 + r, Math.PI, 1.5 * Math.PI);
    const g = alongY(pts, y0, thickness);
    return g;
  });
}

// A gear tooth ring: rollers or a sprocket, teeth as trapezoids on a disc.
export function sprocketShape(teeth, rPitch, rRoot, depth) {
  const key = `spk|${teeth}|${rPitch.toFixed(3)}|${rRoot.toFixed(3)}|${depth}`;
  return cached(key, () => {
    const p = [];
    const step = (Math.PI * 2) / teeth;
    for (let i = 0; i < teeth; i++) {
      const a = i * step;
      const tip = rPitch + (rPitch - rRoot) * 0.55;
      const q = (r, ang) => [Math.cos(ang) * r, Math.sin(ang) * r];
      p.push(q(rRoot, a));
      p.push(q(tip, a + step * 0.12));
      p.push(q(tip, a + step * 0.38));
      p.push(q(rRoot, a + step * 0.5));
    }
    const s = shapeFrom(p);
    const g = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelSize: 0.8,
      bevelThickness: 0.8,
      bevelSegments: 1,
      curveSegments: 2,
    });
    g.translate(0, 0, -depth / 2);
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  });
}

export function mesh(geo, mat, name, parent, pos, rot, scale) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  if (parent) parent.add(m);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const RAD = (d) => (d * Math.PI) / 180;
export { EPS };
