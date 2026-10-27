// Przekrój łożyska korbowodowego: stopa korbowodu, panewka (stal + stop łożyskowy),
// czop wału i klin olejowy. Jednostki: czop ma promień 1, grupa jest skalowana do mm.
// Luz jest powiększony, żeby był widoczny (tak jak w poprzedniej wersji filmu).
import * as THREE from "three";

export const Rj = 1.0, Ri = 1.25, Ro = 1.56, RoH = 2.0, BW = 0.66, LIN = 0.07;
export const CLEAR = Ri - Rj;

function hatch(angleDeg, bg, line, spacing, lw, rep = 1.9) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = bg;
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = line;
  x.lineWidth = lw;
  x.save();
  x.translate(128, 128);
  x.rotate((angleDeg * Math.PI) / 180);
  x.translate(-128, -128);
  for (let i = -300; i < 560; i += spacing) { x.beginPath(); x.moveTo(i, -300); x.lineTo(i, 560); x.stroke(); }
  x.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  t.anisotropy = 8;
  return t;
}

function extrude(shape, depth, bevel, seg = 96) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: !!bevel, bevelThickness: bevel ? 0.02 : 0, bevelSize: bevel ? 0.02 : 0, bevelSegments: 2, curveSegments: seg,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}
const ring = (r0, r1) => {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.absarc(0, 0, r0, 0, Math.PI * 2, true);
  s.holes.push(h);
  return s;
};

export function buildBearing() {
  const group = new THREE.Group();
  group.name = "BEARING_SECTION";

  // stopa korbowodu z trzonem uciętym nad kadrem
  const rodShape = new THREE.Shape();
  const bx = 0.42, yj = Math.sqrt(RoH * RoH - bx * bx);
  const aL = Math.atan2(yj, -bx), aR = Math.atan2(yj, bx);
  rodShape.moveTo(-0.3, 5.2);
  rodShape.lineTo(-bx, yj);
  rodShape.absarc(0, 0, RoH, aL, aR + Math.PI * 2, false);
  rodShape.lineTo(0.3, 5.2);
  rodShape.closePath();
  const rodHole = new THREE.Path();
  rodHole.absarc(0, 0, Ro + 0.004, 0, Math.PI * 2, true);
  rodShape.holes.push(rodHole);
  const rodCut = new THREE.MeshStandardMaterial({ color: 0xffffff, map: hatch(30, "#3c4652", "#1a2028", 30, 6, 1.1), metalness: 0.4, roughness: 0.7 });
  const rodSide = new THREE.MeshStandardMaterial({ color: 0x4c5661, metalness: 0.85, roughness: 0.4 });
  const rod = new THREE.Mesh(extrude(rodShape, BW * 0.96, true), [rodCut, rodSide]);
  group.add(rod);
  // śruby pokrywy korbowodu po bokach
  const boltMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.95, roughness: 0.25 });
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.5, 24), boltMat);
    b.position.set(sx * 1.78, 0.05, BW * 0.25);
    group.add(b);
    const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.16, 6), boltMat);
    hd.position.set(sx * 1.78, -0.78, BW * 0.25);
    group.add(hd);
  }

  // panewka: stalowa skorupa i cienka warstwa stopu łożyskowego od strony czopu
  const shellCut = new THREE.MeshStandardMaterial({ color: 0xffffff, map: hatch(45, "#56616e", "#232a33", 34, 7), metalness: 0.42, roughness: 0.62 });
  const shellSide = new THREE.MeshStandardMaterial({ color: 0x6a7682, metalness: 0.9, roughness: 0.3 });
  const shell = new THREE.Mesh(extrude(ring(Ri + LIN, Ro), BW, true), [shellCut, shellSide]);
  group.add(shell);
  const linCut = new THREE.MeshStandardMaterial({ color: 0xffffff, map: hatch(-20, "#8a6a3a", "#5a4020", 18, 4, 3), metalness: 0.6, roughness: 0.45, emissive: new THREE.Color(0xff2a10), emissiveIntensity: 0 });
  const linSide = new THREE.MeshStandardMaterial({ color: 0xb08a50, metalness: 0.85, roughness: 0.3, emissive: new THREE.Color(0xff2a10), emissiveIntensity: 0 });
  const lining = new THREE.Mesh(extrude(ring(Ri, Ri + LIN + 0.002), BW * 1.005, false, 128), [linCut, linSide]);
  group.add(lining);

  // czop wału: przekrój kreskowany w przeciwną stronę, obraca się, niesie czytelność obrotu
  const jCut = new THREE.MeshStandardMaterial({ color: 0xffffff, map: hatch(-45, "#6d7986", "#2b333c", 34, 7), metalness: 0.45, roughness: 0.55, emissive: new THREE.Color(0xff8a1c), emissiveIntensity: 0 });
  const jSide = new THREE.MeshStandardMaterial({ color: 0x8a95a2, metalness: 0.95, roughness: 0.2 });
  const jShape = new THREE.Shape();
  jShape.absarc(0, 0, Rj, 0, Math.PI * 2, false);
  const journal = new THREE.Group();
  const jMesh = new THREE.Mesh(extrude(jShape, BW * 1.02, true), [jCut, jSide]);
  journal.add(jMesh);
  // dalsza część wału za przekrojem
  const back = new THREE.Mesh(new THREE.CylinderGeometry(Rj * 0.985, Rj * 0.985, 3.2, 64), jSide);
  back.rotation.x = Math.PI / 2;
  back.position.z = -BW / 2 - 1.6;
  journal.add(back);
  // otwór olejowy w czopie: jednoznaczny znacznik obrotu
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.115, 48), new THREE.MeshStandardMaterial({ color: 0x0f1318, metalness: 0.3, roughness: 0.9 }));
  hole.position.set(0.52, 0.28, BW * 0.53 + 0.022);
  journal.add(hole);
  const holeRing = new THREE.Mesh(new THREE.RingGeometry(0.115, 0.15, 48), new THREE.MeshStandardMaterial({ color: 0xd0dae6, metalness: 0.7, roughness: 0.35 }));
  holeRing.position.copy(hole.position);
  journal.add(holeRing);
  group.add(journal);

  // olej: pierścień mimośrodowy, wypełniany od kanału zasilającego u góry
  const oilMat = new THREE.MeshStandardMaterial({
    color: 0xb4560c, emissive: new THREE.Color(0x5a2a02), emissiveIntensity: 0.55, metalness: 0, roughness: 0.22, transparent: true, opacity: 0.96,
  });
  const oil = new THREE.Mesh(new THREE.BufferGeometry(), oilMat);
  group.add(oil);
  let key = "";
  function oilGeo(e, f) {
    if (f >= 0.999) {
      const s = new THREE.Shape();
      s.absarc(0, 0, Ri - 0.004, 0, Math.PI * 2, false);
      const h = new THREE.Path();
      h.absarc(0, -e, Rj + 0.004, 0, Math.PI * 2, true);
      s.holes.push(h);
      return extrude(s, BW * 0.97, false, 96);
    }
    // wycinek pierścienia rozlewający się w obie strony od góry
    const a0 = Math.PI / 2 - Math.PI * f, a1 = Math.PI / 2 + Math.PI * f, n = 64;
    const s = new THREE.Shape();
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      const x = Math.cos(a) * (Ri - 0.004), y = Math.sin(a) * (Ri - 0.004);
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    for (let i = n; i >= 0; i--) {
      const a = a0 + (a1 - a0) * (i / n);
      s.lineTo(Math.cos(a) * (Rj + 0.004), Math.sin(a) * (Rj + 0.004) - e);
    }
    s.closePath();
    return extrude(s, BW * 0.97, false, 8);
  }
  function setOil(e, f) {
    const k = (Math.round(e * 500) / 500).toFixed(3) + "|" + (Math.round(f * 120) / 120).toFixed(3);
    if (k === key) return;
    key = k;
    const old = oil.geometry;
    const [qe, qf] = k.split("|").map(Number);
    oil.geometry = qf <= 0.001 ? new THREE.BufferGeometry() : oilGeo(qe, qf);
    old.dispose();
  }

  // żar w miejscu, gdzie film znika: metal zaczyna dotykać metalu
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,240,205,1)");
  g.addColorStop(0.2, "rgba(255,124,42,0.88)");
  g.addColorStop(0.58, "rgba(200,42,12,0.3)");
  g.addColorStop(1, "rgba(160,20,5,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const contactTex = new THREE.CanvasTexture(c);
  contactTex.colorSpace = THREE.SRGBColorSpace;
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.9),
    new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  contact.position.set(0, -Ri + 0.02, BW * 0.5 + 0.05);
  group.add(contact);

  // własne światło stanowiska: dystans ograniczony, silnik 80 m dalej go nie czuje
  const keyL = new THREE.PointLight(0xfff3e6, 2.2e6, 4000, 2);
  keyL.position.set(-3.5, 4.5, 6.5);
  group.add(keyL);
  const oilLight = new THREE.PointLight(0xff8c14, 0, 900, 2);
  oilLight.position.set(-1.6, 1.3, 2.4);
  group.add(oilLight);
  const heatLight = new THREE.PointLight(0xff3a12, 0, 700, 2);
  heatLight.position.set(0, -1.2, 1.3);
  group.add(heatLight);

  // stan: kąt czopu, mimośród (czop zjeżdża w dół pod obciążeniem), napełnienie olejem, żar
  function setState(s) {
    journal.rotation.z = s.ang;
    journal.position.y = -s.e;
    setOil(s.e, s.fill);
    const h = (CLEAR - s.e) / CLEAR;
    const hot = Math.pow(Math.max(0, 1 - h * 3.2), 1.5) * s.fill;
    contact.material.opacity = hot;
    heatLight.intensity = hot * 5.5e5;
    oilLight.intensity = 1.2e5 * s.fill;
    linCut.emissiveIntensity = hot * 0.8;
    linSide.emissiveIntensity = hot * 0.6;
    jCut.emissiveIntensity = s.glow || 0;
    oilMat.emissiveIntensity = 0.55 + 0.35 * (s.oilGlow || 0);
  }
  setState({ ang: 0, e: 0.1, fill: 1 });
  return { group, journal, setState, hole };
}
