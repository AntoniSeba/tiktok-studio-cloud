// Turbosprężarka z filmu "Jak działa turbo", przeniesiona do modułu.
// Oś wału wzdłuż X: turbina (gorąca) na -X, sprężarka (zimna) na +X. Jednostki jak w oryginale.
import * as THREE from "three";

const X_TURB = -1.35, X_COMP = 1.35, R_TIP = 0.62, R_HUB = 0.19;

function wheelBlades(o) {
  const N = o.count, NM = 18, NH = 5, pos = [], idx = [];
  let vert = 0;
  for (let b = 0; b < N; b++) {
    const th0 = (b / N) * Math.PI * 2, base = vert;
    for (let i = 0; i <= NM; i++) {
      const m = i / NM, sm = m * m * (3 - 2 * m);
      const r0 = o.rIn + (o.rOut - o.rIn) * sm, x0 = o.xIn + (o.xOut - o.xIn) * m;
      const k = (Math.PI / 2) * (o.flip ? 1 - m : m);
      const dr = Math.cos(k), dx = Math.sin(k) * o.hSign;
      const th = th0 + o.wrap * sm;
      for (let h = 0; h <= NH; h++) {
        const hh = h / NH, r = r0 + hh * o.height * dr, x = x0 + hh * o.height * dx;
        pos.push(x, Math.cos(th) * r, Math.sin(th) * r);
        vert++;
      }
    }
    for (let i = 0; i < NM; i++) for (let h = 0; h < NH; h++) {
      const a = base + i * (NH + 1) + h, c = a + (NH + 1);
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function hubGeometry(xIn, xOut, rIn, rOut, flip) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const m = i / 24, sm = m * m * (3 - 2 * m);
    pts.push(new THREE.Vector2(Math.max(0.02, (rIn + (rOut - rIn) * sm) * (flip ? 0.55 : 0.5)), xIn + (xOut - xIn) * m));
  }
  const g = new THREE.LatheGeometry(pts, 48);
  g.rotateZ(Math.PI / 2);
  return g;
}
function voluteGeometry(o) {
  const NP = 120, NT = 20, pos = [], idx = [];
  for (let i = 0; i <= NP; i++) {
    const f = i / NP, phi = o.phi0 + (o.phi1 - o.phi0) * f;
    const R = o.R0 + o.spiral * f, a = o.a0 * (1 - o.taper * f);
    const cy = Math.cos(phi) * R, cz = Math.sin(phi) * R;
    for (let j = 0; j <= NT; j++) {
      const t = (j / NT) * Math.PI * 2, ca = Math.cos(t) * a, sa = Math.sin(t) * a;
      pos.push(o.x + sa, cy + Math.cos(phi) * ca, cz + Math.sin(phi) * ca);
    }
  }
  for (let i = 0; i < NP; i++) for (let j = 0; j < NT; j++) {
    const A = i * (NT + 1) + j, C = A + (NT + 1);
    idx.push(A, C, A + 1, A + 1, C, C + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildTurbo() {
  const turbo = new THREE.Group();
  turbo.name = "TURBO";
  const hotShell = new THREE.MeshStandardMaterial({ color: 0x7a4636, metalness: 0.75, roughness: 0.5, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const coldShell = new THREE.MeshStandardMaterial({ color: 0x8a96a5, metalness: 0.8, roughness: 0.38, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const turbMat = new THREE.MeshStandardMaterial({ color: 0x8c8378, metalness: 0.92, roughness: 0.32, side: THREE.DoubleSide, emissive: new THREE.Color(0xff4a10), emissiveIntensity: 0 });
  const compMat = new THREE.MeshStandardMaterial({ color: 0xc8d1db, metalness: 0.96, roughness: 0.18, side: THREE.DoubleSide });
  const centerMat = new THREE.MeshStandardMaterial({ color: 0x5b6573, metalness: 0.85, roughness: 0.4 });
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0xd6dde5, metalness: 0.97, roughness: 0.15 });

  const turbWheel = new THREE.Group();
  turbWheel.add(new THREE.Mesh(wheelBlades({ count: 11, rIn: R_TIP, rOut: R_HUB + 0.08, xIn: X_TURB + 0.16, xOut: X_TURB - 0.3, height: 0.2, hSign: -1, wrap: -0.55, flip: true }), turbMat));
  turbWheel.add(new THREE.Mesh(hubGeometry(X_TURB + 0.16, X_TURB - 0.3, R_TIP, R_HUB + 0.08, true), turbMat));
  turbo.add(turbWheel);
  const compWheel = new THREE.Group();
  compWheel.add(new THREE.Mesh(wheelBlades({ count: 7, rIn: R_HUB + 0.04, rOut: R_TIP, xIn: X_COMP + 0.3, xOut: X_COMP - 0.14, height: 0.22, hSign: 1, wrap: -0.95, flip: false }), compMat));
  compWheel.add(new THREE.Mesh(hubGeometry(X_COMP + 0.3, X_COMP - 0.14, R_HUB + 0.04, R_TIP * 0.42, false), compMat));
  turbo.add(compWheel);
  turbo.add(new THREE.Mesh(voluteGeometry({ x: X_TURB + 0.05, R0: 1.37, spiral: -0.42, a0: 0.3, taper: 0.5, phi0: 0.15, phi1: Math.PI * 2 * 0.97 }), hotShell));
  turbo.add(new THREE.Mesh(voluteGeometry({ x: X_COMP - 0.02, R0: 1.37, spiral: -0.42, a0: 0.29, taper: 0.48, phi0: 0.15, phi1: Math.PI * 2 * 0.97 }), coldShell));
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.55, 36), centerMat);
  body.rotation.z = Math.PI / 2; turbo.add(body);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, X_COMP - X_TURB + 0.4, 24), shaftMat);
  shaft.rotation.z = Math.PI / 2; turbo.add(shaft);
  const axIn = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.9, 30, 1, true), coldShell);
  axIn.rotation.z = Math.PI / 2; axIn.position.set(X_COMP + 0.75, 0, 0); turbo.add(axIn);

  function setState(ang, heat) {
    turbWheel.rotation.x = ang;
    compWheel.rotation.x = ang;
    turbMat.emissiveIntensity = 0.8 * heat;
  }
  setState(0, 0);
  return { group: turbo, setState };
}
