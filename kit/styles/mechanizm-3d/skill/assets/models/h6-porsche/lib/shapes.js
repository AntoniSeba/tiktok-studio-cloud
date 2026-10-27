// shapes.js - dodatki do geometrii dla silnika plaskiego: lustrzenie bryly w X
// (bank B jest odbiciem, nie obrotem banku A) oraz profile, ktore wygodniej
// budowac w plaszczyznie YZ i wyciskac wzdluz osi walu.

import * as THREE from 'three';

// Odbicie w X bez odwracania scian: skalujemy i odwracamy kolejnosc trojkatow,
// inaczej normals wychodza na zewnatrz i bryla swieci od srodka.
export function mirrorX(geo) {
  const g = geo.clone();
  g.scale(-1, 1, 1);
  const idx = g.getIndex();
  if (idx) {
    const a = idx.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i];
      a[i] = a[i + 2];
      a[i + 2] = t;
    }
    idx.needsUpdate = true;
  } else {
    for (const name of Object.keys(g.attributes)) {
      const attr = g.attributes[name];
      if (attr.itemSize < 3 || attr.array.length < 9) continue;
      const a = attr.array;
      const s = attr.itemSize;
      for (let i = 0; i + 3 * s <= a.length; i += 3 * s) {
        for (let k = 0; k < s; k++) {
          const t = a[i + k];
          a[i + k] = a[i + 2 * s + k];
          a[i + 2 * s + k] = t;
        }
      }
      attr.needsUpdate = true;
    }
  }
  g.computeVertexNormals();
  return g;
}

// Plaski pierscien (podkladka, tuleja o duzej srednicy).
export function annulus(rOut, rIn, depth, seg = 48) {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.8,
    bevelThickness: 0.8,
    bevelSegments: 1,
    curveSegments: seg,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

// Polowa pierscienia po stronie +X (dla banku A) lub -X (bank B).
export function halfAnnulus(rOut, rIn, depth, side = 1, seg = 32) {
  const a0 = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  const a1 = side > 0 ? Math.PI / 2 : (3 * Math.PI) / 2;
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, a0, a1, false);
  s.absarc(0, 0, rIn, a1, a0, true);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.7,
    bevelThickness: 0.7,
    bevelSegments: 1,
    curveSegments: seg,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

// Profil rysowany w (z, y) i wyciskany wzdluz X, od x0 do x0 + grubosc.
// Uzywane do plaszczyzn prostopadlych do osi cylindra (plaszczyzna glowicy,
// flansze kanalow), ktorych nie da sie zrobic wyciskaniem po Z.
export function plateAlongX(points, thickness, x0, seg = 24) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  for (const holePts of arguments[4] || []) {
    const h = new THREE.Path();
    h.moveTo(holePts[0][0], holePts[0][1]);
    for (let i = 1; i < holePts.length; i++) h.lineTo(holePts[i][0], holePts[i][1]);
    h.closePath();
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 1.2,
    bevelThickness: 1.2,
    bevelSegments: 1,
    curveSegments: seg,
  });
  // ksztalt rysowany w (x = z_world, y = y_world); rotateY(-90) daje
  // (x, y, z) -> (-z_extrude, y, x_kszaltu), wiec wycisniecie idzie w -X
  g.rotateY(-Math.PI / 2);
  g.translate(x0 + thickness, 0, 0);
  g.computeVertexNormals();
  return g;
}

// Okragly otwor jako lista punktow do plateAlongX.
export function circlePoints(r, cz, cy, seg = 32) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push([cz + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

// Walek o osi X (wal korbowy, walki rozrzadu, sworznie).
export function cylinderX(r, len, seg = 32) {
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, false);
  g.rotateZ(Math.PI / 2);
  return g;
}

export function softCylinderX(r, len, seg = 40, chamfer = 2) {
  const w = len / 2;
  const pts = [
    new THREE.Vector2(0, -w),
    new THREE.Vector2(r - chamfer, -w),
    new THREE.Vector2(r, -w + chamfer),
    new THREE.Vector2(r, w - chamfer),
    new THREE.Vector2(r - chamfer, w),
    new THREE.Vector2(0, w),
  ];
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}
