// materials.js - PBR palette for an iron-block, alloy-head BMW six. The rule
// from the two reference projects carries over unchanged: real metalness
// (0.7 to 1.0), procedural micro detail on every surface, and a contrasty
// studio environment behind it, otherwise cast iron reads as grey plastic.
//
// Cast iron is the one material here that is not a metal in the three.js
// sense - it is dull, slightly rough and nearly non-reflective - so it gets a
// low metalness and a heavy bump map, which is exactly how it looks on a bench.

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
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// sand cast surface: coarse pitting over slow blotches (block, head, covers)
function castMaps(size = 512) {
  const rough = canvasTexture(size, size, (u, v) => {
    const grit = fbm(u * 46, v * 46, 4, 3);
    const blotch = fbm(u * 6, v * 6, 3, 11) * 1.6;
    const x = Math.round(150 + grit * 74 + blotch * 26);
    return [x, x, x];
  });
  const bump = canvasTexture(size, size, (u, v) => {
    const grit = fbm(u * 70, v * 70, 5, 7);
    const x = Math.round(60 + grit * 190);
    return [x, x, x];
  });
  return { rough, bump };
}

// forged and then machined steel: fine directional streaks plus turning rings
function forgedMaps(size = 512) {
  const rough = canvasTexture(size, size, (u, v) => {
    const streak = fbm(u * 90, v * 3, 3, 13);
    const x = Math.round(54 + streak * 110);
    return [x, x, x];
  });
  const bump = canvasTexture(size, size, (u, v) => {
    const streak = fbm(u * 130, v * 4, 4, 29);
    const x = Math.round(80 + streak * 150);
    return [x, x, x];
  });
  return { rough, bump };
}

// ground journal: very fine circumferential lines (crank and cam journals)
function groundMaps(size = 512) {
  const rough = canvasTexture(size, size, (u, v) => {
    const rings = Math.sin(v * Math.PI * 260) * 0.5 + 0.5;
    const x = Math.round(24 + rings * 40 + fbm(u * 40, v * 40, 3, 5) * 24);
    return [x, x, x];
  });
  const bump = canvasTexture(size, size, (u, v) => {
    const rings = Math.sin(v * Math.PI * 300) * 0.5 + 0.5;
    return [Math.round(110 + rings * 90), Math.round(110 + rings * 90), Math.round(110 + rings * 90)];
  });
  return { rough, bump };
}

// cross hatch hone inside a cylinder bore: 45 degree scratches both ways
function honeMaps(size = 1024) {
  const rough = canvasTexture(size, size, (u, v) => {
    const a = fbm(u * 220 + v * 220, v * 220 - u * 220, 3, 17);
    const b = fbm(u * 220 - v * 220, v * 220 + u * 220, 3, 31);
    const x = Math.round(46 + a * 46 + b * 46);
    return [x, x, x];
  });
  const bump = canvasTexture(size, size, (u, v) => {
    const a = fbm(u * 260 + v * 260, v * 260 - u * 260, 4, 19);
    const b = fbm(u * 260 - v * 260, v * 260 + u * 260, 4, 41);
    return [Math.round(40 + (a + b) * 110), Math.round(40 + (a + b) * 110), Math.round(40 + (a + b) * 110)];
  });
  return { rough, bump };
}

// piston skirt: turned finish with vertical skirt wear bands
function skirtMaps(size = 512) {
  const rough = canvasTexture(size, size, (u, v) => {
    const bands = fbm(u * 8, v * 2.2, 3, 23);
    const rings = Math.sin(u * Math.PI * 120) * 0.5 + 0.5;
    const x = Math.round(40 + bands * 60 + rings * 34);
    return [x, x, x];
  });
  const bump = canvasTexture(size, size, (u, v) => {
    const rings = Math.sin(u * Math.PI * 150) * 0.5 + 0.5;
    return [Math.round(80 + rings * 120), Math.round(80 + rings * 120), Math.round(80 + rings * 120)];
  });
  return { rough, bump };
}

// chain roller and sprocket steel: hardened, fine
function chainMaps(size = 256) {
  const rough = canvasTexture(size, size, (u, v) => {
    const g = fbm(u * 60, v * 60, 4, 47);
    return [Math.round(30 + g * 60), Math.round(30 + g * 60), Math.round(30 + g * 60)];
  });
  return { rough };
}

export function createMaterials() {
  const cast = castMaps(512);
  const forged = forgedMaps(512);
  const ground = groundMaps(512);
  const hone = honeMaps(1024);
  const skirt = skirtMaps(512);
  const chain = chainMaps(256);

  const micro = (maps, scale = 0.35) => ({ roughnessMap: maps.rough, bumpMap: maps.bump, bumpScale: scale });

  const M = {};

  // ---- cast iron: the S54 and the M50 blocks are both grey cast iron
  M.ironBlock = new THREE.MeshStandardMaterial({
    color: 0x6c6a66,
    metalness: 0.76,
    roughness: 0.66,
    ...micro(cast, 0.5),
  });
  M.ironBlockDark = new THREE.MeshStandardMaterial({
    color: 0x54524f,
    metalness: 0.72,
    roughness: 0.72,
    ...micro(cast, 0.5),
  });

  // ---- cast aluminium: head, covers, ancillaries. Cleaner tooling marks.
  M.aluCast = new THREE.MeshStandardMaterial({
    color: 0xb3b7bc,
    metalness: 0.74,
    roughness: 0.52,
    ...micro(cast, 0.3),
  });
  M.aluCastDark = new THREE.MeshStandardMaterial({
    color: 0x878c93,
    metalness: 0.7,
    roughness: 0.62,
    ...micro(cast, 0.3),
  });
  M.aluMachined = new THREE.MeshStandardMaterial({
    color: 0xc8ccd2,
    metalness: 0.88,
    roughness: 0.24,
    roughnessMap: forged.rough,
    bumpMap: ground.bump,
    bumpScale: 0.08,
  });
  // magnesium valve cover: darker, warmer, slightly more diffuse than the head
  M.magnesium = new THREE.MeshStandardMaterial({
    color: 0x9e9a90,
    metalness: 0.7,
    roughness: 0.56,
    ...micro(cast, 0.34),
  });

  // ---- steel: crank, rods, sprockets, valves, springs
  M.crankSteel = new THREE.MeshStandardMaterial({
    color: 0xa8aeb6,
    metalness: 0.98,
    roughness: 0.22,
    ...micro(forged, 0.22),
  });
  M.journal = new THREE.MeshStandardMaterial({
    color: 0xc4cad2,
    metalness: 1.0,
    roughness: 0.09,
    roughnessMap: ground.rough,
    bumpMap: ground.bump,
    bumpScale: 0.06,
  });
  M.rodForged = new THREE.MeshStandardMaterial({
    color: 0x9ba1a9,
    metalness: 0.95,
    roughness: 0.3,
    ...micro(forged, 0.3),
  });
  M.steelBright = new THREE.MeshStandardMaterial({
    color: 0xbfc5cc,
    metalness: 1.0,
    roughness: 0.16,
    roughnessMap: ground.rough,
  });
  M.springSteel = new THREE.MeshStandardMaterial({
    color: 0x8f959c,
    metalness: 0.95,
    roughness: 0.24,
    ...micro(forged, 0.2),
  });
  M.chainSteel = new THREE.MeshStandardMaterial({
    color: 0x767c84,
    metalness: 0.93,
    roughness: 0.36,
    roughnessMap: chain.rough,
  });
  M.blackOxide = new THREE.MeshStandardMaterial({ color: 0x33373c, metalness: 0.86, roughness: 0.44 });

  // ---- the bore: a honed cast iron wall with a visible cross hatch
  M.boreHone = new THREE.MeshStandardMaterial({
    color: 0x6a6058,
    metalness: 0.8,
    roughness: 0.42,
    roughnessMap: hone.rough,
    bumpMap: hone.bump,
    bumpScale: 0.5,
    side: THREE.BackSide,
  });

  // ---- piston: forged high compression hypereutectic alloy, skirt coated
  M.pistonAlu = new THREE.MeshStandardMaterial({
    color: 0xa9a49c,
    metalness: 0.8,
    roughness: 0.34,
    ...micro(skirt, 0.3),
  });
  M.pistonCrown = new THREE.MeshStandardMaterial({
    color: 0x8d8880,
    metalness: 0.82,
    roughness: 0.46,
    ...micro(skirt, 0.4),
  });
  M.ringSteel = new THREE.MeshStandardMaterial({ color: 0x4e545b, metalness: 0.9, roughness: 0.3 });

  // ---- inlet tract: throttle body castings, brass bearing bushes, rubber
  M.rubber = new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.06, roughness: 0.84 });
  M.gasket = new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.18, roughness: 0.72 });
  M.brass = new THREE.MeshStandardMaterial({ color: 0xb08a45, metalness: 0.95, roughness: 0.3 });
  M.ceramic = new THREE.MeshStandardMaterial({ color: 0xf0ede4, metalness: 0.0, roughness: 0.24 });
  // throttle plate and airbox: anodised dark, but the plate face is polished
  M.plateAnodised = new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.82, roughness: 0.36 });
  M.injectorBody = new THREE.MeshStandardMaterial({ color: 0x2e3338, metalness: 0.4, roughness: 0.5 });

  // cut faces: the sawn-through surface of a casting, deliberately matte and
  // paler so the section reads as a section
  M.cutFace = new THREE.MeshStandardMaterial({
    color: 0x9aa0a6,
    metalness: 0.5,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });

  M.casing = [M.aluCast, M.aluMachined, M.aluCastDark, M.magnesium, M.aluCast];
  M.iron = [M.ironBlock, M.ironBlockDark];
  return M;
}

// Spread a tint and a roughness offset over the repeated castings so a wall of
// six bores and six throttle bodies does not read as one flat grey mass.
export function applyMaterialVariation(root, M) {
  const families = {
    aluCast: [M.aluCast, M.aluCastDark],
    ironBlock: [M.ironBlock, M.ironBlockDark],
    magnesium: [M.magnesium, M.aluCastDark],
    rodForged: [M.rodForged, M.crankSteel],
  };
  for (const key of Object.keys(families)) {
    const base = families[key][0];
    for (const [color, rough] of [
      [0x9ba0a6, base.roughness + 0.06],
      [0xc0c6cc, Math.max(0.1, base.roughness - 0.07)],
    ]) {
      const v = base.clone();
      v.color.setHex(color);
      v.roughness = rough;
      families[key].push(v);
    }
  }
  let i = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    for (const key of Object.keys(families)) {
      const fam = families[key];
      if (o.material === fam[0] && fam.length > 2) {
        o.material = fam[1 + (i++ % (fam.length - 1))];
        return;
      }
    }
  });
}
