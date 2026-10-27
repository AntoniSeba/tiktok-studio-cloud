// animation.js - the explainer director. A fixed, non-interactive timeline:
//   0-5 s    exploded view, slow orbit, title card
//   5-13 s   the parts fly together, assembly steps listed
//   13-37 s  two full four-stroke cycles on cylinder 1, casings ghosted
// The timeline loops. Camera, exploded factor, crank angle, valve motion,
// in-cylinder gas colour and the captions are all driven from here.

import * as THREE from 'three';
import { setCasingGhost } from './lib/materials.js';
import { LAYOUT, STROKES, CYLINDERS, cycleAngle, lift, camRotation, strokeOf, pistonPinDistance } from './lib/layout.js';

const T_INTRO_END = 5;
const T_ASSEMBLY_END = 13;
const CYCLE_SECONDS = 12; // one full 720 deg cycle
const CYCLES = 2;
const T_CYCLE_END = T_ASSEMBLY_END + CYCLE_SECONDS * CYCLES;
export const DURATION = T_CYCLE_END + 4.5;

const smoothstep = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => a + ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * t;

const CYCLE_TEXT = {
  intake: {
    title: 'SUW 1: SSANIE',
    sub: 'Tłok idzie w dół, zawór dolotowy otwarty, do cylindra wchodzi mieszanka paliwa i powietrza.',
  },
  compression: {
    title: 'SUW 2: SPREZANIE',
    sub: 'Oba zawory zamknięte. Tłok spręża mieszankę około dziesięciokrotnie.',
  },
  power: {
    title: 'SUW 3: PRACA',
    sub: 'Iskra zapala mieszankę. Gazy rozprężają się i pchają tłok w dół, to jedyny suw, który daje moc.',
  },
  exhaust: {
    title: 'SUW 4: WYDECH',
    sub: 'Zawór wydechowy otwarty, tłok wypycha spaliny do kolektora.',
  },
};

export function createDirector({ engine, M, camera, ui }) {
  const { BUCKET_TOP, BUCKET_H } = engine.heads.constants;
  const base = new Map();
  for (const g of engine.explodeGroups) base.set(g, g.position.clone());
  const focus = engine.focus;
  const target = new THREE.Vector3();

  function applyExplode(t) {
    for (const g of engine.explodeGroups) {
      const b = base.get(g);
      const d = g.userData.explode;
      if (!d) g.position.copy(b);
      else g.position.copy(b).addScaledVector(d, t);
    }
  }

  function setCameras(t, el) {
    // ---- camera choreography
    let az;
    let elev;
    let radius;
    if (el < T_INTRO_END) {
      const k = el / T_INTRO_END;
      az = lerp(-2.45, -2.05, k);
      elev = lerp(0.30, 0.26, k);
      radius = lerp(1450, 1300, k);
      target.set(0, 230, 0);
    } else if (el < T_ASSEMBLY_END) {
      const k = smoothstep((el - T_INTRO_END) / (T_ASSEMBLY_END - T_INTRO_END));
      az = lerp(-2.05, -1.30, k);
      elev = lerp(0.26, 0.20, k);
      radius = lerp(1300, 980, k);
      target.set(0, 230, 0);
    } else {
      const k = Math.min(1, (el - T_ASSEMBLY_END) / 2.2);
      const cycleT = (el - T_ASSEMBLY_END) / CYCLE_SECONDS;
      az = lerp(-1.30, -0.72, k) + Math.sin(cycleT * 0.7) * 0.05;
      elev = lerp(0.20, 0.16, k) + Math.sin(cycleT * 0.5) * 0.02;
      radius = lerp(980, 560, k);
      target.set(lerp(0, 74, k), lerp(230, 196, k), lerp(0, focus.z * 0.85, k));
    }

    // Nadpisanie kamery z zewnatrz: pozwala krecic to samo ujecie z roznych
    // stron i z bliska, bez powtarzania kadru. Ustawiane przez window.__kamera.
    const ov = window.__kamera;
    if (ov) {
      if (typeof ov.az === 'number') az = ov.az;
      if (typeof ov.elev === 'number') elev = ov.elev;
      if (typeof ov.radius === 'number') radius = ov.radius;
      if (typeof ov.tx === 'number') target.x = ov.tx;
      if (typeof ov.ty === 'number') target.y = ov.ty;
      if (typeof ov.tz === 'number') target.z = ov.tz;
      if (typeof ov.fov === 'number') {
        camera.fov = ov.fov;
        camera.updateProjectionMatrix();
      }
    }

    const cx = target.x + Math.cos(az) * Math.cos(elev) * radius;
    const cy = target.y + Math.sin(elev) * radius;
    const cz = target.z + Math.sin(az) * Math.cos(elev) * radius;
    camera.position.set(cx, cy, cz);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }

  function setValves(crank) {
    for (const vt of engine.valvetrain) {
      const cyl = CYLINDERS.find((c) => c.id === vt.cylId);
      const phase = cycleAngle(cyl, crank);
      const l = lift(vt.which, phase);
      vt.bucket.position.y = BUCKET_TOP - l - BUCKET_H / 2;
      vt.retainer.position.y = BUCKET_TOP - BUCKET_H - 2 - l;
      vt.stem.position.y = 250 - l;
      vt.vhead.position.y = LAYOUT.deckHeight - 4 - l;
      vt.spring.position.y = vt.springSeat;
      vt.spring.scale.y = Math.max(0.35, (60 - l) / vt.springFree);
    }
    const camAngle = camRotation(crank) * (Math.PI / 180);
    for (const bank of ['L', 'R']) engine.heads.heads[bank].cam.rotation.z = camAngle;
  }

  function setGas(phase) {
    const m = engine.charge.material;
    const p = phase;
    if (p < 180) {
      const k = p / 180;
      m.color.setHex(0x5aa6ff);
      m.opacity = lerp(0.07, 0.22, k);
    } else if (p < 360) {
      const k = (p - 180) / 180;
      m.color.setHex(0x7cc0ff);
      m.opacity = lerp(0.24, 0.44, k);
    } else if (p < 400) {
      const k = (p - 360) / 40;
      m.color.lerpColors(new THREE.Color(0xffb066), new THREE.Color(0xff6a1e), k);
      m.opacity = lerp(0.9, 0.5, k);
    } else if (p < 540) {
      const k = (p - 400) / 140;
      m.color.lerpColors(new THREE.Color(0xff6a1e), new THREE.Color(0x8d7a6a), k);
      m.opacity = lerp(0.5, 0.3, k);
    } else {
      const k = (p - 540) / 180;
      m.color.lerpColors(new THREE.Color(0x9aa0a6), new THREE.Color(0x6c7075), k);
      m.opacity = lerp(0.34, 0.06, k);
    }
  }

  function setCaption(el, crank) {
    if (!ui.caption) return;
    if (el < T_INTRO_END) {
      ui.captionTitle.textContent = 'SILNIK V6 60°';
      ui.captionSub.textContent =
        '3.0 litra, 6 cylindrów, 12 zaworów, dwa wałki rozrządu w głowicach, napęd łańcuszkiem. Kliknij lub przewiń, aby zatrzymać.';
      ui.steps?.classList.remove('visible');
      ui.strokes?.classList.remove('visible');
      ui.readout?.classList.remove('visible');
    } else if (el < T_ASSEMBLY_END) {
      ui.captionTitle.textContent = 'SKŁADANIE SILNIKA';
      ui.captionSub.textContent = 'Części wracają na swoje miejsce, w kolejności montażu.';
      ui.steps?.classList.add('visible');
      const k = (el - T_INTRO_END) / (T_ASSEMBLY_END - T_INTRO_END);
      const n = Math.min(5, 1 + Math.floor(k * 5));
      ui.steps.querySelectorAll('li').forEach((li, i) => li.classList.toggle('active', i === n - 1));
      ui.strokes?.classList.remove('visible');
      ui.readout?.classList.remove('visible');
    } else {
      const phase = cycleAngle(focus, crank);
      const stroke = strokeOf(focus, crank);
      const txt = CYCLE_TEXT[stroke];
      const cycleNo = Math.floor((el - T_ASSEMBLY_END) / CYCLE_SECONDS) + 1;
      ui.captionTitle.textContent = `${txt.title}`;
      ui.captionSub.textContent = txt.sub;
      ui.steps?.classList.remove('visible');
      ui.strokes?.classList.add('visible');
      ui.strokes.querySelectorAll('[data-stroke]').forEach((el2) => {
        el2.classList.toggle('active', el2.dataset.stroke === stroke);
      });
      if (ui.readout) {
        ui.readout.classList.add('visible');
        const intake = lift('intake', phase);
        const exhaust = lift('exhaust', phase);
        ui.readout.innerHTML = `
          <span><b>${Math.round(phase)}°</b> z 720° cyklu</span>
          <span>obrót ${cycleNo} z ${CYCLES}</span>
          <span>wałek rozrządu <b>${Math.round(((camRotation(crank) % 360) + 360) % 360)}°</b></span>
          <span>zawór dolotowy <b>${intake.toFixed(1)} mm</b></span>
          <span>zawór wydechowy <b>${exhaust.toFixed(1)} mm</b></span>`;
      }
    }
  }

  function update(time) {
    const el = time % DURATION;
    // ---- exploded factor
    let explode;
    if (el < T_INTRO_END) explode = 1;
    else if (el < T_ASSEMBLY_END) explode = 1 - smoothstep((el - T_INTRO_END) / (T_ASSEMBLY_END - T_INTRO_END));
    else explode = 0;
    applyExplode(explode);

    // ---- crank angle: parked during assembly, running during the cycle
    let crank = 0;
    if (el >= T_ASSEMBLY_END) {
      const ct = (el - T_ASSEMBLY_END) % CYCLE_SECONDS;
      crank = (ct / CYCLE_SECONDS) * 720;
    }
    engine.updateCrank(crank);

    // ---- ghost the casings and mark the focus cylinder during the cycle
    const ghost = smoothstep((el - (T_ASSEMBLY_END - 0.4)) / 1.4);
    setCasingGhost(M, ghost);
    // the cam covers sit right on top of the valvetrain, so fade them out
    // completely once the x-ray phase starts
    M.coverPlastic.opacity *= 1 - 0.9 * ghost;
    M.plastic.opacity *= 1 - 0.75 * ghost;
    engine.ring.visible = ghost > 0.05 && el >= T_ASSEMBLY_END - 0.4;
    engine.charge.visible = el >= T_ASSEMBLY_END - 0.4;
    if (engine.charge.visible) setGas(cycleAngle(focus, crank));

    setValves(crank);
    setCameras(el, el);
    setCaption(el, crank);

    if (ui.progress) ui.progress.style.width = `${(el / DURATION) * 100}%`;
    if (ui.labelsToggle) ui.labelsToggle.checked = el < T_ASSEMBLY_END;
    ui.labels?.setVisible(el < T_ASSEMBLY_END + 0.2);

    return { explode, crank, ghost, elapsed: el };
  }

  return { update, DURATION, T_ASSEMBLY_END, CYCLE_SECONDS, CYCLES, applyExplode, setValves };
}
