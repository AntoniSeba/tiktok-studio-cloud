// materials.js - PBR palette for a 2JZ-GTE. Same rule as the wankel-engine and
// car-suspension projects: real metal values (metalness 0.7-1.0, roughness
// 0.1-0.6) plus procedural roughness/bump maps, otherwise cast aluminium reads
// as grey plastic. Every material here is a metal, a rubber, a ceramic or
// glass-filled plastic - nothing is a flat untextured primitive.

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

export function castMaps(size = 512) {
  const rough = canvasTexture(size, size, (u, v) => {
    const grit = fbm(u * 46, v * 46, 4, 3);
    const blotch = fbm(u * 6, v * 6, 3, 11) * 1.6;
    const x = Math.round(140 + grit * 74 + blotch * 34);
    return [x, x, x];
  });
  const bump = canvasTexture(size, size, (u, v) => {
    const grit = fbm(u * 70, v * 70, 5, 7);
    const x = Math.round(60 + grit * 190);
    return [x, x, x];
  });
  rough.repeat.set(2.5, 2.5);
  bump.repeat.set(2.5, 2.5);
  return { rough, bump };
}

// lathe / milled finish: fine concentric lines plus a little chatter
export function turnedMaps(size = 512) {
  const rough = canvasTexture(size, size, (u, v) => {
    const lines = Math.sin(v * Math.PI * 2 * 34) * 0.5 + 0.5;
    const chatter = fbm(u * 4, v * 60, 3, 5);
    const x = Math.round(60 + lines * 46 + chatter * 40);
    return [x, x, x];
  });
  const bump = canvasTexture(size, size, (u, v) => {
    const lines = Math.sin(v * Math.PI * 2 * 34) * 0.5 + 0.5;
    const x = Math.round(70 + lines * 150);
    return [x, x, x];
  });
  rough.repeat.set(2, 2);
  bump.repeat.set(2, 2);
  return { rough, bump };
}

// brushed / drawn steel: streaks along one axis
export function brushedMaps(size = 512) {
  const rough = canvasTexture(size, size, (u, v) => {
    const streak = fbm(u * 90, v * 3, 3, 13);
    const x = Math.round(40 + streak * 130);
    return [x, x, x];
  });
  const bump = canvasTexture(size, size, (u, v) => {
    const streak = fbm(u * 120, v * 4, 4, 29);
    const x = Math.round(80 + streak * 150);
    return [x, x, x];
  });
  return { rough, bump };
}

// orange-peel paint (cam covers, plenum)
export function paintMaps(size = 256) {
  const rough = canvasTexture(size, size, (u, v) => {
    const peel = fbm(u * 26, v * 26, 3, 23);
    const x = Math.round(96 + peel * 70);
    return [x, x, x];
  });
  rough.repeat.set(4, 4);
  return rough;
}

// hot side of the turbine housing: white/red heat bloom baked into a roughness
// and a subtle colour map so cast iron does not read as one flat dark lump
function heatMaps(size = 512) {
  const rough = canvasTexture(size, size, (u, v) => {
    const n = fbm(u * 18, v * 18, 4, 41);
    const x = Math.round(120 + n * 100);
    return [x, x, x];
  });
  const tint = canvasTexture(size, size, (u, v) => {
    const n = fbm(u * 9, v * 9, 3, 61);
    const rust = Math.max(0, n - 0.42) * 2.2;
    return [
      Math.round(96 + rust * 60),
      Math.round(88 + rust * 18),
      Math.round(84 - rust * 10),
    ];
  });
  tint.colorSpace = THREE.SRGBColorSpace;
  return { rough, tint };
}

export function makeBeltRibTexture(ribs = 5) {
  const w = 64;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#131518';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < ribs; i++) {
    const y = (i + 0.5) * (h / ribs);
    const grd = ctx.createLinearGradient(0, y - 9, 0, y + 9);
    grd.addColorStop(0, '#0a0c0e');
    grd.addColorStop(0.5, '#31353a');
    grd.addColorStop(1, '#0a0c0e');
    ctx.fillStyle = grd;
    ctx.fillRect(0, y - h / ribs / 2, w, h / ribs);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// timing belt: HTD teeth on the inner face
export function makeTimingBeltTexture(teeth = 44) {
  const w = 256;
  const h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#171a1e';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < teeth; i++) {
    const x = (i / teeth) * w;
    ctx.fillStyle = i % 2 ? '#0c0e10' : '#22262b';
    ctx.fillRect(x, h * 0.62, w / teeth - 1.4, h * 0.34);
  }
  ctx.fillStyle = 'rgba(220,226,232,0.10)';
  ctx.fillRect(0, 0, w, h * 0.6);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// cast-in lettering: 2JZ-GTE TWIN TURBO 24V, on an opaque cover-coloured base so
// it works as a colour map
export function makeStampTexture(text = '2JZ-GTE   24V') {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2b2f34';
  ctx.fillRect(0, 0, 1024, 128);
  ctx.font = 'bold 66px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(12,14,17,0.85)';
  ctx.fillText(text, 514, 68);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillText(text, 510, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createMaterials() {
  const cast = castMaps();
  const turned = turnedMaps();
  const brushed = brushedMaps();
  const peel = paintMaps();
  const heat = heatMaps();
  const beltTex = makeBeltRibTexture();
  const timingTex = makeTimingBeltTexture();
  const stamp = makeStampTexture();
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const P = (o) => new THREE.MeshPhysicalMaterial(o);

  const M = {};

  // ------------------------------------------------------------- casings
  M.aluCast = S({
    name: 'AluminiumCast',
    color: 0x9ba1a8,
    metalness: 0.82,
    roughness: 0.52,
    roughnessMap: cast.rough,
    bumpMap: cast.bump,
    bumpScale: 0.5,
    envMapIntensity: 1.1,
  });
  M.aluMachined = S({
    name: 'AluminiumMachined',
    color: 0xc2c8ce,
    metalness: 0.95,
    roughness: 0.26,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.12,
    envMapIntensity: 1.25,
  });
  M.aluDark = S({
    name: 'AluminiumDark',
    color: 0x5c6268,
    metalness: 0.72,
    roughness: 0.55,
    roughnessMap: cast.rough,
    bumpMap: cast.bump,
    bumpScale: 0.3,
  });
  // 2JZ cam covers and the plenum are cast aluminium with black crackle paint
  M.coverCast = P({
    name: 'CamCoverCast',
    color: 0x2b2f34,
    metalness: 0.55,
    roughness: 0.42,
    roughnessMap: peel,
    clearcoat: 0.35,
    clearcoatRoughness: 0.34,
    envMapIntensity: 1.0,
  });
  // the same casting with the 2JZ-GTE 24V lettering moulded in, used only on the
  // cover top plates so the text does not tile over the whole engine
  M.coverStamped = M.coverCast.clone();
  M.coverStamped.name = 'CamCoverStamped';
  M.coverStamped.map = stamp;
  M.plastic = S({ name: 'Plastic', color: 0x1c1f23, metalness: 0.1, roughness: 0.52, roughnessMap: peel });
  M.nylon = S({ name: 'Nylon', color: 0x23262a, metalness: 0.05, roughness: 0.62, roughnessMap: peel });

  // ---------------------------------------------------------- mechanisms
  M.steel = S({
    name: 'SteelPolished',
    color: 0xc9ced4,
    metalness: 1.0,
    roughness: 0.17,
    roughnessMap: brushed.rough,
    bumpMap: brushed.bump,
    bumpScale: 0.06,
    envMapIntensity: 1.4,
  });
  M.darkSteel = S({
    name: 'SteelDark',
    color: 0x7b8288,
    metalness: 0.96,
    roughness: 0.38,
    roughnessMap: cast.rough,
    bumpMap: cast.bump,
    bumpScale: 0.14,
    envMapIntensity: 1.05,
  });
  M.crankSteel = S({
    name: 'CrankSteel',
    color: 0x8f969d,
    metalness: 1.0,
    roughness: 0.3,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.1,
    envMapIntensity: 1.2,
  });
  M.journal = S({
    name: 'JournalNitrided',
    color: 0xd6dade,
    metalness: 1.0,
    roughness: 0.13,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.05,
    envMapIntensity: 1.5,
  });
  M.rodSteel = S({
    name: 'RodForged',
    color: 0x9aa1a8,
    metalness: 1.0,
    roughness: 0.34,
    roughnessMap: brushed.rough,
    bumpMap: brushed.bump,
    bumpScale: 0.1,
    envMapIntensity: 1.15,
  });
  M.headerSteel = S({
    name: 'HeaderTube',
    color: 0xbcaf98, // heat-tinted stainless
    metalness: 1.0,
    roughness: 0.24,
    roughnessMap: brushed.rough,
    bumpMap: brushed.bump,
    bumpScale: 0.08,
    envMapIntensity: 1.35,
  });
  M.turboIron = S({
    name: 'TurbineHousingIron',
    color: 0x6d6a66,
    metalness: 0.9,
    roughness: 0.62,
    roughnessMap: heat.rough,
    bumpMap: heat.rough,
    bumpScale: 0.9,
    map: heat.tint,
    envMapIntensity: 0.85,
  });
  M.bearing = S({ name: 'BearingShell', color: 0xb0a894, metalness: 0.85, roughness: 0.36, roughnessMap: cast.rough });
  M.piston = S({
    name: 'Piston',
    color: 0xa6adb4,
    metalness: 0.94,
    roughness: 0.3,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.1,
    envMapIntensity: 1.15,
  });
  M.pistonSkirt = S({
    name: 'PistonSkirtCoat',
    color: 0x3c4044,
    metalness: 0.4,
    roughness: 0.62,
    roughnessMap: turned.rough,
  });
  M.ring = S({ name: 'PistonRing', color: 0x41454a, metalness: 1.0, roughness: 0.28, roughnessMap: turned.rough });
  M.valveSteel = S({
    name: 'ValveSteel',
    color: 0xd2d7dd,
    metalness: 1.0,
    roughness: 0.17,
    envMapIntensity: 1.45,
  });
  M.valveFace = S({ name: 'ValveFace', color: 0x8d7c66, metalness: 0.95, roughness: 0.4, roughnessMap: cast.rough });
  M.spring = S({ name: 'ValveSpring', color: 0x9ba2a9, metalness: 1.0, roughness: 0.3, roughnessMap: turned.rough });
  M.camshaft = S({
    name: 'Camshaft',
    color: 0x8a9198,
    metalness: 1.0,
    roughness: 0.22,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.06,
    envMapIntensity: 1.3,
  });
  M.rubber = S({ name: 'Rubber', color: 0x141619, metalness: 0.0, roughness: 0.86, roughnessMap: peel });
  M.hoseRubber = S({ name: 'HoseRubber', color: 0x1b1e22, metalness: 0.0, roughness: 0.72, roughnessMap: peel });
  M.silicone = S({ name: 'SiliconeHose', color: 0x17191c, metalness: 0.0, roughness: 0.55 });
  M.beltRubber = S({
    name: 'BeltRibbed',
    color: 0x1f2225,
    metalness: 0.0,
    roughness: 0.74,
    map: beltTex,
    bumpMap: beltTex,
    bumpScale: 1.6,
  });
  M.timingBelt = S({
    name: 'TimingBelt',
    color: 0x1a1d20,
    metalness: 0.0,
    roughness: 0.7,
    map: timingTex,
    bumpMap: timingTex,
    bumpScale: 2.0,
  });
  M.brass = S({ name: 'Brass', color: 0xa8874f, metalness: 1.0, roughness: 0.3, roughnessMap: brushed.rough });
  M.copper = S({ name: 'Copper', color: 0xa4643c, metalness: 1.0, roughness: 0.32, roughnessMap: brushed.rough });
  M.ceramic = S({ name: 'Ceramic', color: 0xe6dfd1, metalness: 0.0, roughness: 0.28, roughnessMap: peel });
  M.gasket = S({ name: 'Gasket', color: 0x2a2d31, metalness: 0.12, roughness: 0.8, roughnessMap: cast.rough });
  M.wire = S({ name: 'Loom', color: 0x2b3038, metalness: 0.1, roughness: 0.6, roughnessMap: peel });
  M.bore = S({
    name: 'BoreWall',
    color: 0x2b2f34,
    metalness: 0.9,
    roughness: 0.34,
    roughnessMap: turned.rough,
    side: THREE.DoubleSide,
  });
  M.oil = S({ name: 'OilPan', color: 0x585e64, metalness: 0.85, roughness: 0.48, roughnessMap: cast.rough, bumpMap: cast.bump, bumpScale: 0.4 });

  // --------------------------------------------------- explainer accents
  M.accent = S({ name: 'Accent', color: 0x3f8cff, metalness: 0.6, roughness: 0.26, emissive: 0x1136a0, emissiveIntensity: 0.7 });
  M.charge = new THREE.MeshBasicMaterial({ name: 'Charge', color: 0x5aa6ff, transparent: true, opacity: 0.28, depthWrite: false });
  M.gas = new THREE.MeshBasicMaterial({ name: 'Gas', color: 0x7f8a94, transparent: true, opacity: 0.13, depthWrite: false });

  // variants so a 6 cylinder casting does not repeat one flat colour
  M.casing = [M.aluCast, M.aluMachined, M.aluDark, M.coverCast, M.plastic, M.gasket, M.bore, M.bearing, M.oil];
  const mkVariants = (base, list) => {
    const out = [base];
    for (const [color, rough] of list) {
      const v = base.clone();
      v.color.setHex(color);
      v.roughness = rough;
      out.push(v);
    }
    return out;
  };
  M.aluCastVariants = mkVariants(M.aluCast, [
    [0x949aa1, 0.58],
    [0xa8aeb5, 0.46],
    [0x8d939a, 0.62],
  ]);
  M.aluMachinedVariants = mkVariants(M.aluMachined, [
    [0xb6bcc2, 0.32],
    [0xcdd3d9, 0.22],
  ]);
  M.darkSteelVariants = mkVariants(M.darkSteel, [
    [0x6d747a, 0.44],
    [0x878e94, 0.34],
  ]);
  M.casing.push(...M.aluCastVariants.slice(1), ...M.aluMachinedVariants.slice(1), ...M.darkSteelVariants.slice(1));
  for (const m of [...M.aluCastVariants.slice(1), ...M.aluMachinedVariants.slice(1), ...M.darkSteelVariants.slice(1)]) {
    m.roughnessMap = M.aluCast.roughnessMap;
    m.bumpMap = M.aluCast.bumpMap;
  }
  M.pick = (list, k) => list[k % list.length];
  return M;
}

export function applyMaterialVariation(root, M) {
  let i = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    i++;
    const m = o.material;
    if (Array.isArray(m)) return;
    if (m === M.aluCast) o.material = M.pick(M.aluCastVariants, (i * 7) % 11);
    else if (m === M.aluMachined) o.material = M.pick(M.aluMachinedVariants, (i * 5) % 7);
    else if (m === M.darkSteel) o.material = M.pick(M.darkSteelVariants, (i * 3) % 5);
  });
}
