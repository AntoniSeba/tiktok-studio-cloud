// scene.js - złożenie Audi 2.2 T R5 do filmu: te same części i to samo
// rozłożenie co w przeglądarce (main.js), ale jako czysta funkcja kąta wału,
// bez własnego zegara. Oś wału wzdłuż Z, +Z to przód silnika.

import * as THREE from 'three';
import { buildBlockAssembly } from './parts/block.js';
import { buildHead } from './parts/head.js';
import { buildRotatingAssembly } from './parts/rotating.js';
import { buildTurbo } from './parts/turbo.js';
import { buildAccessories } from './parts/accessories.js';
import * as K from './lib/kinematics.js';

export function buildEngine(M) {
  const root = new THREE.Group();
  root.name = 'R5_ENGINE';
  const spec = K.SPEC.variants[0];
  const block = buildBlockAssembly(M);
  const head = buildHead(M, { mode: '20v' });
  const rotating = buildRotatingAssembly(M, head);
  const turbo = buildTurbo(M);
  const accessories = buildAccessories(M, head, spec);
  root.add(block.root, head.root, rotating.root, turbo.root, accessories.root);

  // gaz w cylindrach: kolor i wysokość z fazy czterosuwu
  const gases = K.CYLINDERS.map((c) => {
    const mat = M.charge.clone();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(K.SPEC.bore / 2 - 0.6, K.SPEC.bore / 2 - 0.6, 1, 30, 1, true), mat);
    mesh.visible = false;
    root.add(mesh);
    return { def: c, mesh, mat };
  });

  const explode = [];
  const add = (obj, v) => { if (obj) explode.push({ obj, rest: obj.position.clone(), delta: new THREE.Vector3(...v) }); };
  add(head.groups.covers, [0, 430, 0]);
  add(head.groups.bolts, [0, 400, 0]);
  add(head.root, [0, 300, 0]);
  add(block.groups.timingCover, [0, 0, 300]);
  add(block.groups.cylinderSection, [0, 62, 0]);
  add(block.groups.crankcase, [0, -46, 0]);
  add(block.groups.bulkheads, [0, -150, 0]);
  add(block.groups.mainCaps, [0, -210, 0]);
  add(block.groups.sump, [0, -320, 0]);
  add(block.groups.filter, [-190, 0, 0]);
  add(rotating.flywheel, [0, 0, -300]);
  add(accessories.groups.exhaust, [230, 90, 0]);
  add(accessories.groups.intake, [-230, 90, 0]);
  add(accessories.groups.intercooler, [0, 40, 340]);
  add(accessories.groups.ignition, [0, 470, 0]);
  add(accessories.groups.drive, [0, 0, 260]);
  add(turbo.groups.comp, [90, 30, -140]);
  add(turbo.root, [150, 40, 0]);

  // o = { explode, turboDeg, boost, gas }
  function update(crankDeg, o = {}) {
    head.update(crankDeg);
    rotating.update(crankDeg);
    turbo.update(o.turboDeg || 0, o.boost ?? 0.6);
    const e = o.explode || 0;
    for (const x of explode) x.obj.position.copy(x.rest).addScaledVector(x.delta, e);
    for (const g of gases) {
      if (!o.gas) { g.mesh.visible = false; continue; }
      const phase = K.cycleAngle(g.def, crankDeg);
      const { s } = K.pistonPinDistance(g.def, crankDeg);
      const crownY = s + K.LAYOUT.pistonCompressionHeight;
      const h = Math.max(0.6, K.LAYOUT.deckHeight - crownY);
      g.mesh.scale.y = h;
      g.mesh.position.set(0, crownY + h / 2, g.def.z);
      g.mesh.visible = h > 0.8;
      const stroke = K.strokeOf(g.def, crankDeg).key;
      if (stroke === 'intake') { g.mat.color.setHex(0x4f9bff); g.mat.opacity = 0.16 + 0.1 * (h / K.SPEC.stroke); }
      else if (stroke === 'compression') { g.mat.color.setHex(0x8ec6ff); g.mat.opacity = 0.2 + 0.26 * (1 - h / K.SPEC.stroke); }
      else if (stroke === 'power') { const k = Math.min(1, Math.max(0, (phase - 360) / 60)); g.mat.color.setHex(k < 0.5 ? 0xffb066 : 0xff5a12); g.mat.opacity = 0.55 - 0.2 * k; }
      else { g.mat.color.setHex(0x9aa0a6); g.mat.opacity = 0.14 + 0.14 * (1 - h / K.SPEC.stroke); }
    }
  }
  update(0);
  return { root, block, head, rotating, turbo, accessories, gases, explode, update };
}
