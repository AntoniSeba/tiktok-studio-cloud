// labels.js - DOM overlay labels with leader lines, following parts through
// the exploded view. Kept out of the WebGL scene so the text stays crisp and
// stays out of the exported GLB.

import * as THREE from 'three';

export function createLabels(container, camera, labels) {
  const wrap = document.createElement('div');
  wrap.className = 'labels';
  container.appendChild(wrap);

  for (const l of labels) {
    const el = document.createElement('div');
    el.className = 'label';
    el.innerHTML = `<span class="label-dot"></span><span class="label-line"></span><span class="label-text">${l.text}</span>`;
    wrap.appendChild(el);
    l.el = el;
    l.dot = el.querySelector('.label-dot');
    l.line = el.querySelector('.label-line');
    l.textEl = el.querySelector('.label-text');
  }

  const ndc = new THREE.Vector3();
  let visible = true;

  function update() {
    if (!visible) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const l of labels) {
      const p = l.object.localToWorld(l.local.clone());
      ndc.copy(p).project(camera);
      const behind = ndc.z > 1 || ndc.z < -1;
      const sx = (ndc.x * 0.5 + 0.5) * w;
      const sy = (-ndc.y * 0.5 + 0.5) * h;
      if (behind || sx < -200 || sx > w + 200 || sy < -100 || sy > h + 100) {
        l.el.style.display = 'none';
        continue;
      }
      l.el.style.display = '';
      const toRight = sx < w * 0.62;
      l.dot.style.left = `${sx}px`;
      l.dot.style.top = `${sy}px`;
      l.line.style.left = toRight ? `${sx}px` : `${sx - 34}px`;
      l.line.style.top = `${sy}px`;
      l.textEl.style.left = toRight ? `${sx + 36}px` : `${sx - 36}px`;
      l.textEl.style.top = `${sy}px`;
      l.textEl.style.transform = toRight ? 'translate(0, -50%)' : 'translate(-100%, -50%)';
      // nearer labels sit on top
      l.el.style.zIndex = String(1000 - Math.round(ndc.z * 500));
    }
  }

  function setVisible(on) {
    visible = on;
    wrap.style.display = on ? '' : 'none';
  }

  return { update, setVisible };
}
