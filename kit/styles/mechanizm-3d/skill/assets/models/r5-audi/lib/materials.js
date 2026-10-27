// materials.js - physically based palette for the Audi 2.2 T R5.
//
// The palette is deliberately not the aluminium-heavy set used on the V6: this
// engine's block and turbine housing are cast IRON, and iron has to read as
// darker, rougher and less reflective than the aluminium head bolted on top of
// it or the whole thing turns into one grey mass.
//
//   cast iron block      : dark, dull, high roughness, oxide pitting
//   machined iron faces  : deck and main saddles, brighter with tool marks
//   cast aluminium head  : brighter, more reflective than the block
//   forged steel crank   : near mirror, concentric turning marks
//   KKK turbine housing  : iron with a heat tint
//   compressor housing   : cast aluminium
// Every surface carries its own procedural roughness and bump map, so nothing
// in the assembly is a flat untextured primitive.

import * as THREE from 'three';

// ---------------------------------------------------------------- noise tools
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

function canvasTexture(size, fill) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rg = fill(x / size, y / size, x, y);
      const i = (y * size + x) * 4;
      img.data[i] = rg[0];
      img.data[i + 1] = rg[1];
      img.data[i + 2] = rg[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// sand cast iron: coarse pitting, sand grain, oxide blotches
function ironMaps(size = 512) {
  const rough = canvasTexture(size, (u, v) => {
    const grain = fbm(u * 118, v * 118, 4, 41);
    const pit = fbm(u * 34, v * 34, 3, 5);
    const blotch = fbm(u * 5, v * 5, 3, 71) * 1.8;
    const x = Math.round(168 + grain * 58 + pit * 22 + blotch * 16);
    return [x, x, x];
  });
  const bump = canvasTexture(size, (u, v) => {
    const grain = fbm(u * 150, v * 150, 5, 19);
    const clump = fbm(u * 26, v * 26, 3, 61);
    const x = Math.round(40 + grain * 170 + clump * 46);
    return [x, x, x];
  });
  rough.repeat.set(3, 3);
  bump.repeat.set(3, 3);
  return { rough, bump };
}

// blasted aluminium: softer pitting than iron
function castMaps(size = 512) {
  const rough = canvasTexture(size, (u, v) => {
    const grit = fbm(u * 46, v * 46, 4, 3);
    const blotch = fbm(u * 6, v * 6, 3, 11) * 1.6;
    const x = Math.round(136 + grit * 74 + blotch * 34);
    return [x, x, x];
  });
  const bump = canvasTexture(size, (u, v) => {
    const grit = fbm(u * 70, v * 70, 5, 7);
    const x = Math.round(60 + grit * 190);
    return [x, x, x];
  });
  rough.repeat.set(2.5, 2.5);
  bump.repeat.set(2.5, 2.5);
  return { rough, bump };
}

// lathe / milled finish: fine concentric lines plus a little chatter
function turnedMaps(size = 512) {
  const rough = canvasTexture(size, (u, v) => {
    const lines = Math.sin(v * Math.PI * 2 * 34) * 0.5 + 0.5;
    const chatter = fbm(u * 4, v * 60, 3, 5);
    const x = Math.round(58 + lines * 48 + chatter * 42);
    return [x, x, x];
  });
  const bump = canvasTexture(size, (u, v) => {
    const lines = Math.sin(v * Math.PI * 2 * 34) * 0.5 + 0.5;
    const x = Math.round(70 + lines * 150);
    return [x, x, x];
  });
  rough.repeat.set(2, 2);
  bump.repeat.set(2, 2);
  return { rough, bump };
}

// brushed steel: streaks along one axis
function brushedMaps(size = 512) {
  const rough = canvasTexture(size, (u, v) => {
    const streak = fbm(u * 90, v * 3, 3, 13);
    const x = Math.round(36 + streak * 132);
    return [x, x, x];
  });
  const bump = canvasTexture(size, (u, v) => {
    const streak = fbm(u * 120, v * 4, 4, 29);
    const x = Math.round(80 + streak * 150);
    return [x, x, x];
  });
  return { rough, bump };
}

// a deck face that has been fly cut: long overlapping tool arcs
function deckMaps(size = 512) {
  const rough = canvasTexture(size, (u, v) => {
    const arc = Math.sin((u * 3.4 + Math.sin(v * 6.2) * 0.35) * Math.PI * 7) * 0.5 + 0.5;
    const x = Math.round(52 + arc * 60 + fbm(u * 40, v * 40, 2, 9) * 26);
    return [x, x, x];
  });
  rough.repeat.set(3, 3);
  return rough;
}

// orange peel paint for the cam cover
function paintMaps(size = 256) {
  const rough = canvasTexture(size, (u, v) => {
    const peel = fbm(u * 26, v * 26, 3, 23);
    const x = Math.round(96 + peel * 70);
    return [x, x, x];
  });
  rough.repeat.set(4, 4);
  return rough;
}

// heat tint for the turbine housing and the turbine wheel: the exhaust side of
// a turbo that has been hot takes on a straw to blue oxide
function heatTintMaps(size = 512) {
  const tint = canvasTexture(size, (u, v) => {
    const h = fbm(u * 3.2, v * 3.2, 3, 97);
    const s = fbm(u * 22, v * 22, 3, 31);
    const k = Math.min(1, Math.max(0, h * 1.25 + s * 0.22));
    // dark iron, through straw, into a cold blue
    const r = Math.round(58 + k * 96 - k * k * 40);
    const g = Math.round(50 + k * 62 - k * k * 16);
    const b = Math.round(44 + k * 26 + k * k * 96);
    return [r, g, b];
  });
  tint.repeat.set(1.4, 1.4);
  return tint;
}

// toothed timing belt: square teeth across the belt width
export function makeBeltToothTexture(teeth = 10) {
  const w = 64;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#191b1e';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < teeth; i++) {
    const y = (i + 0.5) * (h / teeth);
    const g = ctx.createLinearGradient(0, y - 5, 0, y + 5);
    g.addColorStop(0, '#0b0d0f');
    g.addColorStop(0.42, '#2b3036');
    g.addColorStop(0.58, '#33393f');
    g.addColorStop(1, '#0b0d0f');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 4.4, w, 8.8);
  }
  // fibre weave over the top
  ctx.fillStyle = 'rgba(255,255,255,0.028)';
  for (let i = 0; i < h; i += 3) ctx.fillRect(0, i, w, 1);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// cast in lettering for the cam cover
export function makeStampTexture(text = '20V') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = 'bold 84px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(8,9,11,0.6)';
  ctx.fillText(text, 260, 70);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a braided line material: a ribbed stainless overbraid, used for the oil feed
const braid = canvasTexture(256, (u, v) => {
  const rib = Math.sin(u * Math.PI * 2 * 46) * 0.5 + 0.5;
  const cross = Math.sin(v * Math.PI * 2 * 46) * 0.5 + 0.5;
  const k = rib * 0.6 + cross * 0.4;
  const x = Math.round(96 + k * 118);
  return [x, x, Math.round(x * 0.98)];
});
braid.repeat.set(2, 2);

export function createMaterials() {
  const iron = ironMaps();
  const cast = castMaps();
  const turned = turnedMaps();
  const brushed = brushedMaps();
  const deck = deckMaps();
  const peel = paintMaps();
  const heat = heatTintMaps();
  const beltTex = makeBeltToothTexture(10);
  const stamp = makeStampTexture('20V');
  beltTex.repeat.set(1, 1);
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const P = (o) => new THREE.MeshPhysicalMaterial(o);

  const M = {};

  // ------------------------------------------------------------ iron (block)
  M.ironCast = S({
    name: 'IronCast',
    color: 0x6f7276,
    metalness: 0.72,
    roughness: 0.68,
    roughnessMap: iron.rough,
    bumpMap: iron.bump,
    bumpScale: 0.62,
    envMapIntensity: 0.9,
  });
  M.ironDark = S({
    name: 'IronDark',
    color: 0x585c61,
    metalness: 0.66,
    roughness: 0.78,
    roughnessMap: iron.rough,
    bumpMap: iron.bump,
    bumpScale: 0.7,
    envMapIntensity: 0.8,
  });
  M.ironMachined = S({
    name: 'IronMachined',
    color: 0x93979c,
    metalness: 0.9,
    roughness: 0.34,
    roughnessMap: deck,
    bumpMap: turned.bump,
    bumpScale: 0.1,
    envMapIntensity: 1.1,
  });
  M.ironCrankcase = S({
    name: 'IronCrankcase',
    color: 0x4e5257,
    metalness: 0.68,
    roughness: 0.74,
    roughnessMap: iron.rough,
    bumpMap: iron.bump,
    bumpScale: 0.5,
    envMapIntensity: 0.75,
  });

  // ---------------------------------------------------------- aluminium head
  M.aluCast = S({
    name: 'AluminiumCast',
    color: 0xa8aeb5,
    metalness: 0.84,
    roughness: 0.5,
    roughnessMap: cast.rough,
    bumpMap: cast.bump,
    bumpScale: 0.48,
    envMapIntensity: 1.05,
  });
  M.aluMachined = S({
    name: 'AluminiumMachined',
    color: 0xc8ced4,
    metalness: 0.95,
    roughness: 0.26,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.12,
    envMapIntensity: 1.2,
  });
  M.aluManifold = S({
    name: 'AluminiumManifold',
    color: 0xb4bac1,
    metalness: 0.88,
    roughness: 0.4,
    roughnessMap: cast.rough,
    bumpMap: cast.bump,
    bumpScale: 0.34,
    envMapIntensity: 1.15,
  });
  M.camCover = P({
    name: 'CamCover',
    color: 0x24282d,
    metalness: 0.5,
    roughness: 0.36,
    roughnessMap: peel,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
    map: stamp,
    envMapIntensity: 1.0,
  });
  M.plastic = S({ name: 'Plastic', color: 0x1b1e22, metalness: 0.1, roughness: 0.56, roughnessMap: peel });
  // heat tinted stainless: header pipes that have been hot go straw then blue
  M.headerSteel = S({
    name: 'HeaderTube',
    color: 0xb3a68f,
    metalness: 1.0,
    roughness: 0.26,
    map: heat,
    roughnessMap: brushed.rough,
    bumpMap: brushed.bump,
    bumpScale: 0.08,
    envMapIntensity: 1.3,
  });

  // ------------------------------------------------------------- mechanisms
  M.crankSteel = S({
    name: 'CrankSteel',
    color: 0xa9b0b7,
    metalness: 1.0,
    roughness: 0.24,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.09,
    envMapIntensity: 1.3,
  });
  M.rodSteel = S({
    name: 'RodSteel',
    color: 0x969da4,
    metalness: 0.97,
    roughness: 0.36,
    roughnessMap: cast.rough,
    bumpMap: cast.bump,
    bumpScale: 0.16,
    envMapIntensity: 1.1,
  });
  M.steel = S({
    name: 'SteelPolished',
    color: 0xc9ced4,
    metalness: 1.0,
    roughness: 0.16,
    roughnessMap: brushed.rough,
    bumpMap: brushed.bump,
    bumpScale: 0.06,
    envMapIntensity: 1.35,
  });
  M.darkSteel = S({
    name: 'SteelDark',
    color: 0x767d84,
    metalness: 0.95,
    roughness: 0.4,
    roughnessMap: cast.rough,
    bumpMap: cast.bump,
    bumpScale: 0.14,
    envMapIntensity: 1.0,
  });
  M.piston = S({
    name: 'Piston',
    color: 0xa2a9b0,
    metalness: 0.92,
    roughness: 0.3,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.1,
    envMapIntensity: 1.12,
  });
  M.pistonSkirt = S({
    name: 'PistonSkirt',
    color: 0x8b9299,
    metalness: 0.9,
    roughness: 0.42,
    roughnessMap: brushed.rough,
    bumpMap: brushed.bump,
    bumpScale: 0.14,
  });
  M.bearing = S({ name: 'BearingShell', color: 0xb3a98f, metalness: 0.88, roughness: 0.33, roughnessMap: cast.rough });
  M.valveSteel = S({ name: 'ValveSteel', color: 0xd3d8de, metalness: 1.0, roughness: 0.16, envMapIntensity: 1.4 });
  M.valveHead = S({ name: 'ValveHead', color: 0x8d7f6b, metalness: 1.0, roughness: 0.42, roughnessMap: heat });
  M.spring = S({ name: 'ValveSpring', color: 0x9aa1a8, metalness: 1.0, roughness: 0.32, roughnessMap: turned.rough });
  M.camLobe = S({
    name: 'CamLobe',
    color: 0xbcc2c9,
    metalness: 1.0,
    roughness: 0.19,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.07,
    envMapIntensity: 1.35,
  });

  // ------------------------------------------------------------------ turbo
  M.turboIron = S({
    name: 'TurboIron',
    color: 0x6c6a68,
    metalness: 0.7,
    roughness: 0.72,
    map: heat,
    roughnessMap: iron.rough,
    bumpMap: iron.bump,
    bumpScale: 0.5,
    envMapIntensity: 0.85,
  });
  M.turboAlu = S({
    name: 'TurboAluminium',
    color: 0xb0b6bd,
    metalness: 0.86,
    roughness: 0.44,
    roughnessMap: cast.rough,
    bumpMap: cast.bump,
    bumpScale: 0.4,
    envMapIntensity: 1.1,
  });
  M.turbineWheel = S({
    name: 'TurbineWheel',
    color: 0x857f77,
    metalness: 0.95,
    roughness: 0.44,
    map: heat,
    roughnessMap: cast.rough,
    bumpMap: cast.bump,
    bumpScale: 0.2,
    envMapIntensity: 1.0,
  });
  M.compressorWheel = S({
    name: 'CompressorWheel',
    color: 0xc0c6cc,
    metalness: 0.9,
    roughness: 0.3,
    roughnessMap: cast.rough,
    bumpMap: cast.bump,
    bumpScale: 0.12,
    envMapIntensity: 1.25,
  });
  M.intercooler = S({
    name: 'Intercooler',
    color: 0xaeb4bb,
    metalness: 0.93,
    roughness: 0.38,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.08,
    envMapIntensity: 1.15,
  });

  // ------------------------------------------------------------------- misc
  M.beltRubber = S({
    name: 'BeltRubber',
    color: 0x202326,
    metalness: 0.0,
    roughness: 0.76,
    map: beltTex,
    bumpMap: beltTex,
    bumpScale: 1.4,
  });
  M.chainSteel = S({
    name: 'ChainSteel',
    color: 0x6d747b,
    metalness: 1.0,
    roughness: 0.46,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.22,
  });
  M.rubber = S({ name: 'Rubber', color: 0x141619, metalness: 0.0, roughness: 0.86, roughnessMap: peel });
  M.gasket = S({ name: 'Gasket', color: 0x2a2d31, metalness: 0.12, roughness: 0.8, roughnessMap: iron.rough });
  M.headGasket = S({ name: 'HeadGasket', color: 0x8a7f6a, metalness: 0.85, roughness: 0.5, roughnessMap: cast.rough });
  M.brass = S({ name: 'Brass', color: 0xab8a4d, metalness: 1.0, roughness: 0.3, roughnessMap: brushed.rough });
  M.copper = S({ name: 'Copper', color: 0xa9713f, metalness: 1.0, roughness: 0.34, roughnessMap: brushed.rough });
  M.ceramic = S({ name: 'Ceramic', color: 0xe7e0d2, metalness: 0.0, roughness: 0.28, roughnessMap: peel });
  M.wire = S({ name: 'IgnitionWire', color: 0x2b3038, metalness: 0.1, roughness: 0.62 });
  M.braidedLine = S({
    name: 'BraidedLine',
    color: 0xb8bcc2,
    metalness: 1.0,
    roughness: 0.34,
    map: braid,
    bumpMap: braid,
    bumpScale: 0.6,
    envMapIntensity: 1.25,
  });
  M.bore = S({
    name: 'BoreWall',
    color: 0x24272b,
    metalness: 0.88,
    roughness: 0.4,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.12,
    side: THREE.DoubleSide,
  });
  M.oil = S({
    name: 'Oil',
    color: 0x6b5326,
    metalness: 0.2,
    roughness: 0.24,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });

  // --------------------------------------------------- explainer accents
  M.accent = S({ name: 'Accent', color: 0x3f8cff, metalness: 0.6, roughness: 0.26, emissive: 0x1136a0, emissiveIntensity: 0.7 });
  M.hot = S({ name: 'Hot', color: 0xff6a1e, metalness: 0.4, roughness: 0.4, emissive: 0x8a2400, emissiveIntensity: 0.9 });
  M.charge = new THREE.MeshBasicMaterial({ name: 'Charge', color: 0x5aa6ff, transparent: true, opacity: 0.3, depthWrite: false });
  M.exhaustGas = new THREE.MeshBasicMaterial({ name: 'ExhaustGas', color: 0x8a8f95, transparent: true, opacity: 0.2, depthWrite: false });

  M.casing = [M.ironCast, M.ironDark, M.ironMachined, M.ironCrankcase, M.aluCast, M.aluMachined, M.aluManifold, M.camCover, M.plastic, M.gasket, M.headGasket, M.bore, M.bearing, M.turboIron, M.turboAlu, M.intercooler, M.headerSteel];
  for (const m of M.casing) {
    m.userData.baseOpacity = m.opacity ?? 1;
    m.userData.baseDepthWrite = m.depthWrite;
    m.userData.baseEnv = m.envMapIntensity ?? 1;
  }

  // alloy tint variants so five bores, five main caps and a manifold never read
  // as the same flat grey
  M.ironCastVariants = [M.ironCast];
  for (const [color, rough, metal] of [
    [0x676a6e, 0.74, 0.68],
    [0x787c81, 0.62, 0.76],
    [0x5d6065, 0.8, 0.64],
  ]) {
    const v = M.ironCast.clone();
    v.color.setHex(color);
    v.roughness = rough;
    v.metalness = metal;
    M.ironCastVariants.push(v);
  }
  M.aluCastVariants = [M.aluCast];
  for (const [color, rough, metal] of [
    [0x9ea4ab, 0.58, 0.78],
    [0xb2b8bf, 0.44, 0.88],
  ]) {
    const v = M.aluCast.clone();
    v.color.setHex(color);
    v.roughness = rough;
    v.metalness = metal;
    M.aluCastVariants.push(v);
  }
  M.aluMachinedVariants = [M.aluMachined];
  for (const [color, rough] of [
    [0xbcc2c8, 0.32],
    [0xd2d8de, 0.2],
  ]) {
    const v = M.aluMachined.clone();
    v.color.setHex(color);
    v.roughness = rough;
    M.aluMachinedVariants.push(v);
  }
  M.darkSteelVariants = [M.darkSteel];
  {
    const v = M.darkSteel.clone();
    v.color.setHex(0x828990);
    v.roughness = 0.33;
    M.darkSteelVariants.push(v);
  }
  for (const list of [M.ironCastVariants, M.aluCastVariants, M.aluMachinedVariants]) {
    for (const m of list.slice(1)) {
      m.userData.baseOpacity = 1;
      m.userData.baseDepthWrite = m.depthWrite;
      m.userData.baseEnv = m.envMapIntensity ?? 1;
      M.casing.push(m);
    }
  }
  for (const m of M.casing) makeFresnelGhost(m);
  return M;
}

// Give same-material parts slightly different finishes (deterministic).
export function applyMaterialVariation(root, M) {
  let i = 0;
  const pick = (list, k) => list[k % list.length];
  root.traverse((o) => {
    if (!o.isMesh) return;
    i++;
    const m = o.material;
    if (Array.isArray(m)) return;
    if (m === M.ironCast) o.material = pick(M.ironCastVariants, (i * 7) % 11);
    else if (m === M.aluCast) o.material = pick(M.aluCastVariants, (i * 5) % 7);
    else if (m === M.aluMachined) o.material = pick(M.aluMachinedVariants, (i * 3) % 5);
    else if (m === M.darkSteel) o.material = pick(M.darkSteelVariants, (i * 2) % 3);
  });
}

// X-ray ghosting for the cutaway: alpha follows a Fresnel term, so faces seen
// head on nearly vanish while the silhouette and the crevices stay readable.
// This is for the "przekrój" mode only; the default way to show internals is
// still to slide the shells apart.
export function makeFresnelGhost(mat) {
  mat.transparent = true;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGhost = { value: 0 };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGhost;')
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        if ( uGhost > 0.001 ) {
          float ndv = abs( dot( normalize( vNormal ), normalize( vViewPosition ) ) );
          float f = pow( 1.0 - ndv, 2.6 );
          float a = clamp( 0.04 + f * 0.72, 0.0, 0.55 );
          gl_FragColor.a = mix( gl_FragColor.a, a, uGhost );
        }`
      );
    mat.userData.shader = shader;
  };
  mat.customProgramCacheKey = () => 'fresnel-ghost';
  return mat;
}

export function setCasingGhost(M, t) {
  const e = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  for (const m of M.casing) {
    m.transparent = e > 0.001;
    m.opacity = 1 - 0.9 * e;
    m.depthWrite = e < 0.5;
    if (m.userData.shader?.uniforms?.uGhost) m.userData.shader.uniforms.uGhost.value = e;
  }
}
