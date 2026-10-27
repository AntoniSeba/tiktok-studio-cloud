// materials.js - paleta PBR silnika Porsche 4.0 H6.
// Zasada jak w projektach bazowych: prawdziwe wartosci metali (metalness 0.7-1.0),
// proceduralna mikrostruktura i kontrastowe srodowisko studyjne, inaczej aluminium
// czyta sie jak plastik. Zero plastikowych "metalicznych" kolorow.

import * as THREE from 'three';

function hash(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
const smooth = (t) => t * t * (3 - 2 * t);
function valueNoise(x, y, seed = 1) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
}
function fbm(x, y, octaves = 4, seed = 1) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += valueNoise(x * f, y * f, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.07;
  }
  return v / norm;
}

function canvasTexture(w, h, fill) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rgb = fill(x / w, y / h, x, y);
      const i = (y * w + x) * 4;
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = rgb.length > 3 ? rgb[3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// odlew AlSi7MgCu0.5 po obrobce cieplnej T6: pitting i wolne plamy
function castMaps(size = 512) {
  const rough = canvasTexture(size, size, (u, v) => {
    const grit = fbm(u * 46, v * 46, 4, 3);
    const blotch = fbm(u * 6, v * 6, 3, 11) * 1.6;
    const x = Math.round(132 + grit * 78 + blotch * 32);
    return [x, x, x];
  });
  const bump = canvasTexture(size, size, (u, v) => {
    const grit = fbm(u * 70, v * 70, 5, 7);
    const x = Math.round(60 + grit * 190);
    return [x, x, x];
  });
  return { rough, bump };
}

// aluminium skrawane / polerowane walki
function brushedMaps(size = 512) {
  const rough = canvasTexture(size, size, (u, v) => {
    const streak = fbm(u * 90, v * 3, 3, 13);
    const x = Math.round(46 + streak * 118);
    return [x, x, x];
  });
  const bump = canvasTexture(size, size, (u, v) => {
    const streak = fbm(u * 120, v * 4, 4, 29);
    const x = Math.round(80 + streak * 150);
    return [x, x, x];
  });
  return { rough, bump };
}

// gladz cylindra: honowanie krzyzowe i ciemniejsze smugi
function honeMaps(size = 512) {
  const rough = canvasTexture(size, size, (u, v) => {
    const cross = Math.sin((u * 220 + v * 90)) * 0.5 + 0.5;
    const cross2 = Math.sin((u * 220 - v * 90)) * 0.5 + 0.5;
    const h = (cross + cross2) / 2;
    const x = Math.round(70 + h * 90);
    return [x, x, x];
  });
  const bump = canvasTexture(size, size, (u, v) => {
    const cross = Math.sin((u * 260 + v * 110)) * 0.5 + 0.5;
    const x = Math.round(90 + cross * 140);
    return [x, x, x];
  });
  return { rough, bump };
}

// czopy szlifowane: rowki po toczeniu
function groundMaps(size = 512) {
  const rough = canvasTexture(size, size, (u, v) => {
    const rings = Math.sin(v * 90) * 0.5 + 0.5;
    const x = Math.round(34 + rings * 60);
    return [x, x, x];
  });
  return { rough };
}

export function createMaterials() {
  const cast = castMaps(512);
  const brushed = brushedMaps(512);
  const hone = honeMaps(512);
  const ground = groundMaps(256);
  const micro = (maps, scale = 0.35) => ({ roughnessMap: maps.rough, bumpMap: maps.bump, bumpScale: scale });

  const M = {};

  // skrzynia korbowa: odlew AlSi7MgCu0.5, T6 hartowany powietrzem
  M.caseCast = new THREE.MeshStandardMaterial({ color: 0xadaeb2, metalness: 0.74, roughness: 0.58, ...micro(cast) });
  M.caseCastDark = new THREE.MeshStandardMaterial({ color: 0x878a90, metalness: 0.72, roughness: 0.64, ...micro(cast) });
  M.caseMachined = new THREE.MeshStandardMaterial({
    color: 0xc4c8ce,
    metalness: 0.88,
    roughness: 0.26,
    roughnessMap: brushed.rough,
    bumpMap: brushed.bump,
    bumpScale: 0.18,
  });
  // glowice: taki sam odlew, inna faktura odlewnicza
  M.headCast = new THREE.MeshStandardMaterial({ color: 0xb3b5b9, metalness: 0.73, roughness: 0.55, ...micro(cast, 0.3) });
  // pokrywy walkow: kompozyt (w 9A2 czesciowo tworzywo), matowe, nie metaliczne
  M.coverComposite = new THREE.MeshStandardMaterial({ color: 0x2c2f34, metalness: 0.2, roughness: 0.72, ...micro(cast, 0.25) });
  M.coverCompositeB = new THREE.MeshStandardMaterial({ color: 0x34383e, metalness: 0.22, roughness: 0.7, ...micro(cast, 0.25) });

  // gladz cylindra z powloka zelazna (Fe) w zamknietej skrzyni odlewu aluminiowego
  M.bore = new THREE.MeshStandardMaterial({
    color: 0x9fa3a8,
    metalness: 0.97,
    roughness: 0.24,
    roughnessMap: hone.rough,
    bumpMap: hone.bump,
    bumpScale: 0.12,
  });
  M.linerEdge = new THREE.MeshStandardMaterial({ color: 0x6f7276, metalness: 0.9, roughness: 0.42 });

  // wal korbowy: stal kutwa, czopy szlifowane
  M.crankSteel = new THREE.MeshStandardMaterial({ color: 0xa8adb4, metalness: 0.98, roughness: 0.2, roughnessMap: ground.rough });
  M.crankJournal = new THREE.MeshStandardMaterial({
    color: 0xc0c5cc,
    metalness: 1.0,
    roughness: 0.1,
    roughnessMap: ground.rough,
    bumpMap: brushed.bump,
    bumpScale: 0.06,
  });
  M.steel = new THREE.MeshStandardMaterial({ color: 0xb4b9c0, metalness: 0.95, roughness: 0.24, roughnessMap: brushed.rough });
  M.darkSteel = new THREE.MeshStandardMaterial({ color: 0x5b6067, metalness: 0.92, roughness: 0.38, roughnessMap: brushed.rough });
  M.springSteel = new THREE.MeshStandardMaterial({ color: 0x8d939a, metalness: 0.95, roughness: 0.3, roughnessMap: brushed.rough });
  M.chain = new THREE.MeshStandardMaterial({ color: 0x6b7076, metalness: 0.95, roughness: 0.34, roughnessMap: brushed.rough, bumpMap: brushed.bump, bumpScale: 0.5 });

  // tlok: odkuwka aluminiowa, korona jasna
  M.piston = new THREE.MeshStandardMaterial({ color: 0xcfd2d7, metalness: 0.88, roughness: 0.3, roughnessMap: brushed.rough, bumpMap: brushed.bump, bumpScale: 0.15 });
  M.pistonSkirt = new THREE.MeshStandardMaterial({ color: 0x9ca1a8, metalness: 0.86, roughness: 0.4, roughnessMap: brushed.rough });
  M.ring = new THREE.MeshStandardMaterial({ color: 0x44484d, metalness: 0.95, roughness: 0.28 });

  // zawory i gniazda
  M.valve = new THREE.MeshStandardMaterial({ color: 0x7d8288, metalness: 0.96, roughness: 0.22, roughnessMap: brushed.rough });
  M.valveSeat = new THREE.MeshStandardMaterial({ color: 0x5f646a, metalness: 0.94, roughness: 0.3 });
  M.guide = new THREE.MeshStandardMaterial({ color: 0xa8853f, metalness: 0.95, roughness: 0.32 });

  // wydech: stal nierdzewna, matowa, z odciskiem spawu
  M.exhaust = new THREE.MeshStandardMaterial({ color: 0x8a8f95, metalness: 0.93, roughness: 0.36, ...micro(cast, 0.2) });
  M.exhaustHot = new THREE.MeshStandardMaterial({ color: 0x9a8c7e, metalness: 0.9, roughness: 0.44, ...micro(cast, 0.25) });
  M.shield = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, metalness: 0.85, roughness: 0.42, ...micro(cast, 0.2) });

  // dolot: kompozytowy kolektor i przepustnica
  M.intakePlastic = new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.14, roughness: 0.62, ...micro(cast, 0.3) });
  M.intakePlasticB = new THREE.MeshStandardMaterial({ color: 0x2b2f35, metalness: 0.16, roughness: 0.6, ...micro(cast, 0.3) });

  // miska olejowa i zbiornik: tworzywo (Porsche podaje miske z tworzywa, o 36,5% lzejsza)
  M.panPlastic = new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.12, roughness: 0.74, ...micro(cast, 0.3) });
  M.pumpAlu = new THREE.MeshStandardMaterial({ color: 0xbcbfc4, metalness: 0.86, roughness: 0.32, roughnessMap: brushed.rough });

  M.gasket = new THREE.MeshStandardMaterial({ color: 0x332d28, metalness: 0.14, roughness: 0.72 });
  M.bearing = new THREE.MeshStandardMaterial({ color: 0xd6d9dd, metalness: 0.9, roughness: 0.18, roughnessMap: brushed.rough });
  M.rubber = new THREE.MeshStandardMaterial({ color: 0x17191c, metalness: 0.05, roughness: 0.85 });
  M.ceramic = new THREE.MeshStandardMaterial({ color: 0xf2efe8, metalness: 0.0, roughness: 0.24 });
  M.coil = new THREE.MeshStandardMaterial({ color: 0x1c1e22, metalness: 0.18, roughness: 0.66 });
  M.copper = new THREE.MeshStandardMaterial({ color: 0xb1723c, metalness: 0.95, roughness: 0.3 });
  M.brass = new THREE.MeshStandardMaterial({ color: 0xb08a45, metalness: 0.95, roughness: 0.28 });
  M.blackOxide = new THREE.MeshStandardMaterial({ color: 0x36393e, metalness: 0.86, roughness: 0.42 });
  M.hose = new THREE.MeshStandardMaterial({ color: 0x191b1e, metalness: 0.08, roughness: 0.78 });

  M.casing = [M.caseCast, M.caseMachined, M.caseCastDark, M.headCast, M.steel, M.coverComposite];
  return M;
}

// Lekki rozrzut koloru i chropowatosci na powtarzalnych odlewach, zeby sciana
// skrzyni korbowej nie czytala sie jak jedna plaska bryla.
export function applyMaterialVariation(root, M) {
  const base = M.caseCast;
  const variants = [base];
  for (const [color, rough] of [
    [0x9ba0a6, base.roughness + 0.06],
    [0xc0c5cb, Math.max(0.12, base.roughness - 0.08)],
    [0x8f9399, base.roughness + 0.03],
  ]) {
    const v = base.clone();
    v.color.setHex(color);
    v.roughness = rough;
    variants.push(v);
  }
  let i = 0;
  root.traverse((o) => {
    if (o.isMesh && o.material === base) o.material = variants[1 + (i++ % (variants.length - 1))];
  });
}
