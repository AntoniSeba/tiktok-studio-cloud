// scene.js - assembles the complete 2JZ-GTE from the part modules and declares
// the exploded-view offsets. One entry point for the viewer and for the films:
//
//   const eng = buildEngine(M);
//   eng.update(thetaDeg, { explode: 0..1, turboDeg, rpm, dt });
//
// update() is a pure function of its arguments when turboDeg is given (the
// turbo shafts are then set directly instead of being integrated), which is
// what a frame-exact renderer needs.

import * as THREE from 'three';
import { buildBlock } from './parts/block.js';
import { buildRotating } from './parts/rotating.js';
import { buildHead } from './parts/head.js';
import { buildInduction } from './parts/induction.js';
import { buildTiming } from './parts/timing.js';

const RAD = Math.PI / 180;

export function buildEngine(M) {
  const root = new THREE.Group();
  root.name = '2JZ_GTE_ASSEMBLY';

  const block = buildBlock(M);
  const rotating = buildRotating(M);
  const head = buildHead(M);
  const induction = buildInduction(M);
  const timing = buildTiming(M);
  for (const p of [block, rotating, head, induction, timing]) root.add(p.root);

  // A few extruded outlines carry degenerate triangles whose vertex normals
  // come out as (0,0,0); normalize() of that is NaN in the shader, and SSAO or
  // bloom then smear the NaN pixels into black blocks. Give them any unit normal.
  root.traverse((o) => {
    const n = o.isMesh && o.geometry.attributes.normal;
    if (!n) return;
    let fixed = false;
    for (let i = 0; i < n.count; i++) {
      if (Math.abs(n.getX(i)) + Math.abs(n.getY(i)) + Math.abs(n.getZ(i)) < 1e-6) {
        n.setXYZ(i, 0, 1, 0);
        fixed = true;
      }
    }
    if (fixed) n.needsUpdate = true;
  });

  // ------------------------------------------------------- exploded offsets
  // each entry moves by dir * explode; 'at' staggers the start so the engine
  // opens from the outside in rather than all at once
  const explode = [];
  const add = (obj, d, at = 0) => {
    if (!obj) return;
    explode.push({ obj, base: obj.position.clone(), dir: new THREE.Vector3(d[0], d[1], d[2]), at });
  };
  add(block.groups.pan, [0, -300, 0], 0.1);
  add(block.groups.skinIn, [0, 0, 260], 0);
  add(block.groups.skinEx, [0, 0, -260], 0);
  add(head.root, [0, 330, 0], 0.15);
  add(head.groups.covers, [0, 260, 0], 0);
  add(head.groups.skinIn, [0, 0, 230], 0);
  add(head.groups.skinEx, [0, 0, -230], 0);
  add(timing.root, [-300, 0, 0], 0.05);
  add(rotating.groups.flywheel, [260, 0, 0], 0.1);
  // induction: everything on the intake side goes up and out along +Z, the
  // hot side (manifolds, turbos, wastegates, downpipes) out along -Z
  const box = new THREE.Box3();
  const c = new THREE.Vector3();
  root.updateMatrixWorld(true);
  for (const child of [...induction.root.children]) {
    box.setFromObject(child);
    if (box.isEmpty()) continue;
    box.getCenter(c);
    if (c.z >= 0) add(child, [0, 140, 360], 0.05);
    else add(child, [0, -40, -380], 0.05);
  }

  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

  function update(thetaDeg, o = {}) {
    const e = o.explode || 0;
    rotating.update(thetaDeg);
    head.update(thetaDeg);
    timing.update(thetaDeg);
    if (o.turboDeg !== undefined) {
      for (const t of induction.turbos) t.shaft.rotation.x = o.turboDeg * RAD;
    } else if (o.rpm !== undefined) {
      induction.update(o.rpm, o.dt || 0);
    }
    for (const x of explode) {
      const k = smooth((e - x.at) / (1 - x.at));
      x.obj.position.copy(x.base).addScaledVector(x.dir, k);
    }
    // pistons and rods are placed by rotating.update every frame, so their
    // lift out of the bores is added on top of that
    const kp = smooth((e - 0.3) / 0.7);
    if (kp > 0) {
      for (const p of rotating.groups.pistons) p.position.y += 150 * kp;
      for (const r of rotating.groups.rods) r.position.y += 75 * kp;
    }
  }
  update(0);

  return { root, parts: { block, rotating, head, induction, timing }, explode, update };
}
