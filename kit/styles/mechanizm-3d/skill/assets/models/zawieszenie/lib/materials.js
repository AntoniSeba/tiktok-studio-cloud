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

function beltRibTexture(ribs = 4) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#141619';
  ctx.fillRect(0, 0, 64, 128);
  for (let i = 0; i < ribs; i++) {
    const y = (i + 0.5) * (128 / ribs);
    const g = ctx.createLinearGradient(0, y - 8, 0, y + 8);
    g.addColorStop(0, '#0b0d0f');
    g.addColorStop(0.5, '#31353a');
    g.addColorStop(1, '#0b0d0f');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 16, 64, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// tyre: tread blocks around the circumference, sidewall lettering across
function tyreTexture() {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#131518';
  ctx.fillRect(0, 0, W, H);
  // tread blocks (middle band of the profile)
  for (let i = 0; i < 44; i++) {
    const x = (i / 44) * W;
    const off = i % 2 ? 14 : 0;
    ctx.fillStyle = `rgb(${22 + (i % 3) * 4},${24 + (i % 3) * 4},${26 + (i % 3) * 4})`;
    ctx.fillRect(x + 2, 78 + off, W / 44 - 5, 44);
    ctx.fillRect(x + 2, 138 - off, W / 44 - 5, 40);
  }
  // circumferential grooves
  ctx.fillStyle = '#0b0d0e';
  ctx.fillRect(0, 124, W, 10);
  ctx.fillRect(0, 74, W, 6);
  ctx.fillRect(0, 182, W, 6);
  // sidewall lettering
  ctx.save();
  ctx.translate(W / 2, 34);
  ctx.fillStyle = 'rgba(210,214,220,0.55)';
  ctx.font = 'bold 22px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('245 / 40 R18   94Y', 0, 0);
  ctx.translate(0, H - 40);
  ctx.fillStyle = 'rgba(190,196,204,0.4)';
  ctx.font = 'bold 18px Helvetica, Arial, sans-serif';
  ctx.fillText('MAX LOAD 670 kg   MAX 340 kPa', 0, 0);
  ctx.restore();
  // fine sidewall texture
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
    ctx.fillRect(x, y, 2, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createMaterials() {
  const cast = castMaps();
  const brushed = brushedMaps();
  const disc = discMaps();
  const belt = beltRibTexture();
  const tyre = tyreTexture();
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const F = (o) => new THREE.MeshPhysicalMaterial(o);

  const M = {};
  M.aluCast = S({
    name: 'AluminiumCast',
    color: 0x9ba1a8,
    metalness: 0.8,
    roughness: 0.54,
    roughnessMap: cast.rough,
    bumpMap: cast.bump,
    bumpScale: 0.35,
    envMapIntensity: 1.3,
  });
  M.aluForged = S({
    name: 'AluminiumForged',
    color: 0xc3c9cf,
    metalness: 0.95,
    roughness: 0.3,
    roughnessMap: brushed.rough,
    bumpMap: brushed.bump,
    bumpScale: 0.12,
    envMapIntensity: 1.4,
  });
  M.steelDark = S({
    name: 'SteelDark',
    color: 0x6b7076,
    metalness: 0.94,
    roughness: 0.44,
    roughnessMap: cast.rough,
    bumpMap: cast.bump,
    bumpScale: 0.2,
    envMapIntensity: 1.15,
  });
  M.chrome = S({
    name: 'Chrome',
    color: 0xd7dbe0,
    metalness: 1.0,
    roughness: 0.1,
    envMapIntensity: 1.6,
  });
  M.anodisedRed = F({
    name: 'AnodisedRed',
    color: 0x7e1a1a,
    metalness: 0.65,
    roughness: 0.32,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
    envMapIntensity: 1.3,
  });
  M.springCoat = F({
    name: 'SpringCoat',
    color: 0xb8231f,
    metalness: 0.35,
    roughness: 0.26,
    clearcoat: 0.65,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.2,
  });
  M.caliper = F({
    name: 'CaliperPaint',
    color: 0x1d4a8f,
    metalness: 0.5,
    roughness: 0.3,
    clearcoat: 0.6,
    clearcoatRoughness: 0.22,
    envMapIntensity: 1.25,
  });
  M.disc = S({
    name: 'BrakeDisc',
    color: 0xb5bac0,
    metalness: 1.0,
    roughness: 0.34,
    roughnessMap: disc,
    bumpMap: disc,
    bumpScale: 0.06,
    envMapIntensity: 1.35,
  });
  M.discHat = S({
    name: 'DiscHat',
    color: 0x4b4f55,
    metalness: 0.9,
    roughness: 0.42,
    envMapIntensity: 1.1,
  });
  M.rubber = S({
    name: 'Rubber',
    color: 0x15171a,
    metalness: 0.0,
    roughness: 0.88,
  });
  M.bush = S({
    name: 'Bushing',
    color: 0x1b1d20,
    metalness: 0.0,
    roughness: 0.82,
  });
  M.boot = S({
    name: 'CvBoot',
    color: 0x101214,
    metalness: 0.0,
    roughness: 0.78,
  });
  M.tyre = S({
    name: 'Tyre',
    color: 0x1a1c1f,
    metalness: 0.0,
    roughness: 0.92,
    map: tyre,
    bumpMap: tyre,
    bumpScale: 0.7,
  });
  M.rim = F({
    name: 'Rim',
    color: 0xc6cbd1,
    metalness: 1.0,
    roughness: 0.24,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.45,
  });
  M.rimDark = S({
    name: 'RimInner',
    color: 0x3c4045,
    metalness: 0.85,
    roughness: 0.5,
  });
  M.hose = S({ name: 'BrakeHose', color: 0x22252a, metalness: 0.05, roughness: 0.7 });
  M.belt = S({
    name: 'Belt',
    color: 0x1c1f22,
    metalness: 0.05,
    roughness: 0.7,
    map: belt,
    bumpMap: belt,
    bumpScale: 1.0,
  });
  M.brass = S({ name: 'Brass', color: 0xa8874f, metalness: 1.0, roughness: 0.32 });
  M.pad = S({ name: 'BrakePad', color: 0x3a3d41, metalness: 0.2, roughness: 0.85 });

  return M;
}

export function applyMaterialVariation(root, M) {
  let i = 0;
  const pick = (list, k) => list[k % list.length];
  const variants = {
    aluCast: [M.aluCast],
    aluForged: [M.aluForged],
    steelDark: [M.steelDark],
  };
  for (const key of Object.keys(variants)) {
    const base = variants[key][0];
    for (const [color, rough] of [
      [0x949aa1, base.roughness + 0.06],
      [0xa8aeb5, Math.max(0.16, base.roughness - 0.06)],
    ]) {
      const v = base.clone();
      v.color.setHex(color);
      v.roughness = rough;
      variants[key].push(v);
    }
  }
  root.traverse((o) => {
    if (!o.isMesh) return;
    i++;
    const m = o.material;
    if (Array.isArray(m)) return;
    for (const key of Object.keys(variants)) {
      if (m === M[key]) o.material = pick(variants[key], (i * 7) % 11);
    }
  });
}
