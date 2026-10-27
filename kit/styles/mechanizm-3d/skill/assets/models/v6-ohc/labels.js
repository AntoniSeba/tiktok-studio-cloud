// labels.js - DOM overlay labels with leader lines that follow parts through
// the exploded view. Kept out of WebGL so text stays crisp and out of the GLB.
//
// Dwa dodatki na potrzeby ujec filmowych:
//   setFiltr([...])  - pokaz tylko podpisy, ktorych tekst zawiera ktorys z podanych fragmentow
//   rozsuwanie       - etykiety blisko siebie sa rozsuwane w pionie, zeby nie nachodzily na siebie

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
  let filtr = null;
  let granice = null; // [gora, dol] - podpisy poza tym pasem sa ukrywane

  // minimalny odstep miedzy etykietami w pionie, w pikselach planszy
  const ODSTEP = 62;

  function pasuje(l) {
    if (!filtr) return true;
    return filtr.some((f) => l.text.toLowerCase().includes(f.toLowerCase()));
  }

  function wGranicach(sy) {
    if (!granice) return true;
    return sy >= granice[0] && sy <= granice[1];
  }

  function update() {
    if (!visible) return;
    const w = container.clientWidth;
    const h = container.clientHeight;

    // najpierw policz pozycje wszystkich widocznych etykiet
    const widoczne = [];
    for (const l of labels) {
      if (!pasuje(l)) {
        l.el.style.display = 'none';
        continue;
      }
      const p = l.object.localToWorld(l.local.clone());
      ndc.copy(p).project(camera);
      const behind = ndc.z > 1 || ndc.z < -1;
      const sx = (ndc.x * 0.5 + 0.5) * w;
      const sy = (-ndc.y * 0.5 + 0.5) * h;
      if (behind || sx < -240 || sx > w + 240 || sy < -120 || sy > h + 120 || !wGranicach(sy)) {
        l.el.style.display = 'none';
        continue;
      }
      l.el.style.display = '';
      widoczne.push({ l, sx, sy, ndcZ: ndc.z });
    }

    // rozsun w pionie: sortuj po stronie i wysokosci, podnos kolejne jesli za blisko
    for (const strona of [true, false]) {
      const grupa = widoczne
        .filter((v) => (v.sx < w * 0.6) === strona)
        .sort((a, b) => a.sy - b.sy);
      let poprzednia = -Infinity;
      for (const v of grupa) {
        if (poprzednia !== -Infinity && v.sy - poprzednia < ODSTEP) {
          v.sy = poprzednia + ODSTEP;
        }
        if (!wGranicach(v.sy)) {
          v.l.el.style.display = 'none';
          v.ukryty = true;
        }
        poprzednia = v.sy;
      }
    }

    for (const v of widoczne) {
      if (v.ukryty) continue;
      const { l, sx, sy } = v;
      const toRight = sx < w * 0.6;
      l.dot.style.left = `${sx}px`;
      l.dot.style.top = `${sy}px`;
      l.line.style.left = toRight ? `${sx}px` : `${sx - 30}px`;
      l.line.style.top = `${sy}px`;
      l.textEl.style.left = toRight ? `${sx + 32}px` : `${sx - 32}px`;
      l.textEl.style.top = `${sy}px`;
      l.textEl.style.transform = toRight ? 'translate(0, -50%)' : 'translate(-100%, -50%)';
      l.el.style.zIndex = String(1000 - Math.round(v.ndcZ * 500));
    }
  }

  function setVisible(on) {
    visible = on;
    wrap.style.display = on ? '' : 'none';
  }

  function setFiltr(lista) {
    filtr = lista && lista.length ? lista : null;
  }

  // Gora i dol pasa, w ktorym podpisy moga sie pokazywac. Bez tego na telefonie
  // wchodza na podpis tekstowy i na pasek odtwarzania.
  function setGranice(gora, dol) {
    granice = typeof gora === 'number' && typeof dol === 'number' && dol > gora ? [gora, dol] : null;
  }

  return { update, setVisible, setFiltr, setGranice };
}
