// materials.js - suspension-specific PBR palette. Same rule as the engine
// project: real metal values, procedural micro detail, and a contrasty studio
// environment behind it, otherwise aluminium reads as plastic.

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

// cast aluminium: pitting plus slow blotches
function castMaps(size = 512) {
  const rough = canvasTexture(size, size, (u, v) => {
    const grit = fbm(u * 46, v * 46, 4, 3);
    const blotch = fbm(u * 6, v * 6, 3, 11) * 1.6;
    const x = Math.round(140 + grit * 74 + blotch * 30);
    return [x, x, x];
  });
  const bump = canvasTexture(size, size, (u, v) => {
    const grit = fbm(u * 70, v * 70, 5, 7);
    const x = Math.round(60 + grit * 190);
    return [x, x, x];
  });
  return { rough, bump };
}

// brushed / forged aluminium
function brushedMaps(size = 512) {
  const rough = canvasTexture(size, size, (u, v) => {
    const streak = fbm(u * 90, v * 3, 3, 13);
    const x = Math.round(50 + streak * 120);
    return [x, x, x];
  });
  const bump = canvasTexture(size, size, (u, v) => {
    const streak = fbm(u * 120, v * 4, 4, 29);
    const x = Math.round(80 + streak * 150);
    return [x, x, x];
  });
  return { rough, bump };
}

// machined disc face: concentric turning rings, cross drilled holes, and a
// darker swept wear band
function discMaps(size = 1024) {
  const rough = canvasTexture(size, size, (u, v) => {
    const x = u - 0.5;
    const y = v - 0.5;
    const r = Math.sqrt(x * x + y * y) * 2;
    const rings = Math.sin(r * 260) * 0.5 + 0.5;
    const wear = r > 0.42 && r < 0.95 ? 1 : 0;
    const holes = (() => {
      const a = Math.atan2(y, x);
      const n = 32;
      const ring = r > 0.72 ? 0 : r > 0.56 ? 1 : 2;
      const step = (Math.PI * 2) / n;
      const da = Math.abs(((a + Math.PI) % step) - step / 2);
      const rr = r - (0.78 - ring * 0.11);
      return Math.sqrt(da * da * 0.06 + rr * rr) < 0.022 ? -60 : 0;
    })();
    const base = wear ? 120 + rings * 40 : 175 + rings * 20;
    const x2 = Math.round(Math.max(0, Math.min(255, base + holes)));
    return [x2, x2, x2];
  });
  return rough;
}


// ---------------------------------------------------------------------------
// Rotary specific palette. Same rule as the piston engine project: real metal
// values plus procedural micro detail, and a contrasty studio environment
// behind them, or aluminium reads as plastic. The rotor housing's bore is
// hard chrome, the rotor is nitrided steel, the side plates are ground steel.
// ---------------------------------------------------------------------------
export function createMaterials() {
  const cast = castMaps(512);
  const brushed = brushedMaps(512);
  const turned = discMaps(1024);
  const micro = (maps) => ({
    roughnessMap: maps.rough,
    bumpMap: maps.bump,
    bumpScale: 0.35,
  });

  const M = {};

  // rotor housing / side housings: cast aluminium, oxide dulled
  M.aluCast = new THREE.MeshStandardMaterial({
    color: 0xb4b8bd,
    metalness: 0.72,
    roughness: 0.56,
    ...micro(cast),
  });
  M.aluCastDark = new THREE.MeshStandardMaterial({
    color: 0x8d9298,
    metalness: 0.7,
    roughness: 0.62,
    ...micro(cast),
  });
  M.aluMachined = new THREE.MeshStandardMaterial({
    color: 0xc6cbd1,
    metalness: 0.86,
    roughness: 0.28,
    roughnessMap: brushed.rough,
  });

  // hard chromed trochoid bore: the one mirror bright surface in the engine
  M.chrome = new THREE.MeshStandardMaterial({
    color: 0xe2e7ee,
    metalness: 1.0,
    roughness: 0.07,
    roughnessMap: brushed.rough,
    bumpMap: brushed.bump,
    bumpScale: 0.08,
  });

  // ground steel side plates that the rotor's side seals run against
  M.sidePlate = new THREE.MeshStandardMaterial({
    color: 0x8a9098,
    metalness: 0.95,
    roughness: 0.3,
    roughnessMap: brushed.rough,
    bumpMap: brushed.bump,
    bumpScale: 0.2,
  });

  // rotor body: nitrided steel, warm grey with a slightly duller finish
  M.rotorSteel = new THREE.MeshStandardMaterial({
    color: 0x7c736a,
    metalness: 0.88,
    roughness: 0.44,
    roughnessMap: brushed.rough,
    bumpMap: brushed.bump,
    bumpScale: 0.28,
  });
  M.rotorRecess = new THREE.MeshStandardMaterial({
    color: 0x574f47,
    metalness: 0.8,
    roughness: 0.6,
    roughnessMap: cast.rough,
  });

  // apex and side seals: dark hardened steel
  M.seal = new THREE.MeshStandardMaterial({
    color: 0x4c5158,
    metalness: 0.95,
    roughness: 0.22,
    roughnessMap: brushed.rough,
  });

  // eccentric shaft journals: ground and lapped
  M.shaft = new THREE.MeshStandardMaterial({
    color: 0xb8bec6,
    metalness: 1.0,
    roughness: 0.13,
    roughnessMap: brushed.rough,
  });
  M.shaftHard = new THREE.MeshStandardMaterial({
    color: 0x9ba1a8,
    metalness: 0.98,
    roughness: 0.2,
    roughnessMap: turned,
  });
  M.gear = new THREE.MeshStandardMaterial({
    color: 0xa6acb4,
    metalness: 1.0,
    roughness: 0.24,
    roughnessMap: brushed.rough,
    bumpMap: brushed.bump,
    bumpScale: 0.4,
  });

  M.rubber = new THREE.MeshStandardMaterial({ color: 0x1b1d21, metalness: 0.05, roughness: 0.82 });
  M.gasket = new THREE.MeshStandardMaterial({ color: 0x2b2723, metalness: 0.15, roughness: 0.7 });
  M.ceramic = new THREE.MeshStandardMaterial({ color: 0xf1eee6, metalness: 0.0, roughness: 0.22 });
  M.brass = new THREE.MeshStandardMaterial({ color: 0xb08a45, metalness: 0.95, roughness: 0.28 });
  M.blackOxide = new THREE.MeshStandardMaterial({ color: 0x35393e, metalness: 0.85, roughness: 0.42 });

  M.casing = [M.aluCast, M.aluMachined, M.aluCastDark, M.sidePlate, M.shaftHard, M.gear];
  return M;
}

// Slight tint/roughness spread over repeated parts so a wall of housings does
// not read as one flat grey mass.
export function applyMaterialVariation(root, M) {
  const variants = {
    aluCast: [M.aluCast, M.aluCastDark],
    gear: [M.gear, M.aluMachined],
  };
  for (const key of Object.keys(variants)) {
    const base = variants[key][0];
    for (const [color, rough] of [
      [0x9ba0a6, base.roughness + 0.06],
      [0xc2c8ce, Math.max(0.12, base.roughness - 0.07)],
    ]) {
      const v = base.clone();
      v.color.setHex(color);
      v.roughness = rough;
      variants[key].push(v);
    }
  }
  let i = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    for (const key of Object.keys(variants)) {
      if (o.material === variants[key][0] && variants[key].length > 2) {
        o.material = variants[key][1 + (i++ % (variants[key].length - 1))];
        return;
      }
    }
  });
}
