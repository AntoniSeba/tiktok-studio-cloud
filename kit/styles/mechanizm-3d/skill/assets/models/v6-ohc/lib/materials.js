// materials.js - physically-based material set tuned to read as real engine
// metal rather than plastic:
//   * cast aluminium   : oxide-dulled, metalness ~0.72, rough with pitting
//   * machined faces   : bright aluminium with tool marks
//   * turned parts     : concentric lathe marks on pulleys and hubs
//   * stainless tubes  : polished, with a heat tint on the headers
//   * painted covers   : clear-coated, slight orange peel
// Every surface gets its own procedural roughness + bump detail, so nothing
// is a flat untextured primitive.

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
      const [r, g, b] = fill(x / size, y / size, x, y);
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// cast / blasted alu: pitting plus slow blotches
function castMaps(size = 512) {
  const rough = canvasTexture(size, (u, v) => {
    const grit = fbm(u * 46, v * 46, 4, 3);
    const blotch = fbm(u * 6, v * 6, 3, 11) * 1.6;
    const x = Math.round(140 + grit * 74 + blotch * 34);
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

// lathe / milled finish: fine lines plus a little chatter
function turnedMaps(size = 512) {
  const rough = canvasTexture(size, (u, v) => {
    const lines = Math.sin(v * Math.PI * 2 * 34) * 0.5 + 0.5;
    const chatter = fbm(u * 4, v * 60, 3, 5);
    const x = Math.round(60 + lines * 46 + chatter * 40);
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

// brushed steel: streaks along one axis (tube drawing marks)
function brushedMaps(size = 512) {
  const rough = canvasTexture(size, (u, v) => {
    const streak = fbm(u * 90, v * 3, 3, 13);
    const x = Math.round(40 + streak * 130);
    return [x, x, x];
  });
  const bump = canvasTexture(size, (u, v) => {
    const streak = fbm(u * 120, v * 4, 4, 29);
    const x = Math.round(80 + streak * 150);
    return [x, x, x];
  });
  rough.repeat.set(1, 1);
  bump.repeat.set(1, 1);
  return { rough, bump };
}

// orange-peel paint
function paintMaps(size = 256) {
  const rough = canvasTexture(size, (u, v) => {
    const peel = fbm(u * 26, v * 26, 3, 23);
    const x = Math.round(96 + peel * 70);
    return [x, x, x];
  });
  rough.repeat.set(4, 4);
  return rough;
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

// cast-in lettering for the cam cover
export function makeStampTexture(text = 'V6  24V') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = 'bold 72px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(10,12,14,0.55)';
  ctx.fillText(text, 258, 68);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillText(text, 254, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createMaterials() {
  const cast = castMaps();
  const turned = turnedMaps();
  const brushed = brushedMaps();
  const peel = paintMaps();
  const beltTex = makeBeltRibTexture();
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
    envMapIntensity: 1.05,
  });
  M.aluMachined = S({
    name: 'AluminiumMachined',
    color: 0xc2c8ce,
    metalness: 0.95,
    roughness: 0.26,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.12,
    envMapIntensity: 1.2,
  });
  M.aluDark = S({
    name: 'AluminiumDark',
    color: 0x5c6268,
    metalness: 0.7,
    roughness: 0.55,
    roughnessMap: cast.rough,
    bumpMap: cast.bump,
    bumpScale: 0.3,
  });
  M.coverPlastic = P({
    name: 'CamCover',
    color: 0x23272c,
    metalness: 0.45,
    roughness: 0.34,
    roughnessMap: peel,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
    envMapIntensity: 1.0,
  });
  M.plastic = S({ name: 'Plastic', color: 0x1c1f23, metalness: 0.1, roughness: 0.55, roughnessMap: peel });

  // ---------------------------------------------------------- mechanisms
  M.steel = S({
    name: 'SteelPolished',
    color: 0xc9ced4,
    metalness: 1.0,
    roughness: 0.17,
    roughnessMap: brushed.rough,
    bumpMap: brushed.bump,
    bumpScale: 0.06,
    envMapIntensity: 1.35,
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
    envMapIntensity: 1.3,
  });
  M.bearing = S({ name: 'BearingShell', color: 0xb0a894, metalness: 0.85, roughness: 0.36, roughnessMap: cast.rough });
  M.piston = S({
    name: 'Piston',
    color: 0xa6adb4,
    metalness: 0.94,
    roughness: 0.28,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.1,
    envMapIntensity: 1.15,
  });
  M.valveSteel = S({ name: 'ValveSteel', color: 0xd2d7dd, metalness: 1.0, roughness: 0.17, envMapIntensity: 1.4 });
  M.spring = S({ name: 'ValveSpring', color: 0x9ba2a9, metalness: 1.0, roughness: 0.3, roughnessMap: turned.rough });
  M.rubber = S({ name: 'Rubber', color: 0x141619, metalness: 0.0, roughness: 0.86, roughnessMap: peel });
  M.beltRubber = S({
    name: 'BeltRubber',
    color: 0x1f2225,
    metalness: 0.0,
    roughness: 0.74,
    map: beltTex,
    bumpMap: beltTex,
    bumpScale: 1.6,
  });
  M.chainSteel = S({
    name: 'ChainSteel',
    color: 0x6f767d,
    metalness: 1.0,
    roughness: 0.44,
    roughnessMap: turned.rough,
    bumpMap: turned.bump,
    bumpScale: 0.2,
  });
  M.brass = S({ name: 'Brass', color: 0xa8874f, metalness: 1.0, roughness: 0.3, roughnessMap: brushed.rough });
  M.ceramic = S({ name: 'Ceramic', color: 0xe6dfd1, metalness: 0.0, roughness: 0.28, roughnessMap: peel });
  M.gasket = S({ name: 'Gasket', color: 0x2a2d31, metalness: 0.12, roughness: 0.8, roughnessMap: cast.rough });
  M.wire = S({ name: 'IgnitionWire', color: 0x2b3038, metalness: 0.1, roughness: 0.62 });
  M.bore = S({ name: 'BoreWall', color: 0x2b2f34, metalness: 0.9, roughness: 0.38, roughnessMap: turned.rough, side: THREE.DoubleSide });

  // --------------------------------------------------- explainer accents
  M.accent = S({ name: 'Accent', color: 0x3f8cff, metalness: 0.6, roughness: 0.26, emissive: 0x1136a0, emissiveIntensity: 0.7 });
  M.charge = new THREE.MeshBasicMaterial({ name: 'Charge', color: 0x5aa6ff, transparent: true, opacity: 0.3, depthWrite: false });
  M.flame = new THREE.MeshBasicMaterial({ name: 'Flame', color: 0xff7a2a, transparent: true, opacity: 0.0, depthWrite: false });

  M.casing = [M.aluCast, M.aluMachined, M.aluDark, M.coverPlastic, M.plastic, M.gasket, M.bore, M.bearing];
  for (const m of M.casing) {
    m.userData.baseOpacity = m.opacity ?? 1;
    m.userData.baseDepthWrite = m.depthWrite;
    m.userData.baseEnv = m.envMapIntensity ?? 1;
  }

  // subtle casting-to-casting variation: three alloy tints so a block, a head
  // and a manifold never look like the same grey plastic
  M.aluCastVariants = [M.aluCast];
  for (const [color, rough, metal] of [
    [0x949aa1, 0.66, 0.7],
    [0xa2a8af, 0.58, 0.78],
  ]) {
    const v = M.aluCast.clone();
    v.color.setHex(color);
    v.roughness = rough;
    v.metalness = metal;
    v.roughnessMap = M.aluCast.roughnessMap;
    v.bumpMap = M.aluCast.bumpMap;
    M.aluCastVariants.push(v);
  }
  M.aluMachinedVariants = [M.aluMachined];
  for (const [color, rough] of [
    [0xb7bdc4, 0.32],
    [0xcdd3d9, 0.2],
  ]) {
    const v = M.aluMachined.clone();
    v.color.setHex(color);
    v.roughness = rough;
    M.aluMachinedVariants.push(v);
  }
  M.darkSteelVariants = [M.darkSteel];
  {
    const v = M.darkSteel.clone();
    v.color.setHex(0x868d94);
    v.roughness = 0.32;
    M.darkSteelVariants.push(v);
  }
  // aluminium variants ghost with their base material; the dark steel
  // variants are mechanism parts and stay solid
  M.casing.push(...M.aluCastVariants.slice(1), ...M.aluMachinedVariants.slice(1));
  for (const m of [...M.aluCastVariants.slice(1), ...M.aluMachinedVariants.slice(1)]) {
    m.userData.baseOpacity = 1;
    m.userData.baseDepthWrite = m.depthWrite;
    m.userData.baseEnv = m.envMapIntensity ?? 1;
  }
  // X-ray ghosting for every casing material (the mechanism parts stay solid)
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
    if (m === M.aluCast) o.material = pick(M.aluCastVariants, (i * 7) % 11);
    else if (m === M.aluMachined) o.material = pick(M.aluMachinedVariants, (i * 5) % 7);
    else if (m === M.darkSteel) o.material = pick(M.darkSteelVariants, (i * 3) % 5);
  });
}

// X-ray style ghosting: instead of a flat tint, the alpha follows a Fresnel
// term, so faces seen head on nearly vanish and the silhouette plus the
// crevices stay readable (which is what makes a cutaway look like a drawing
// rather than like a plastic bag).
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
          float f = pow( 1.0 - ndv, 2.8 );
          float a = clamp( 0.03 + f * 0.78, 0.0, 0.62 );
          gl_FragColor.a = mix( gl_FragColor.a, a, uGhost );
        }`
      );
    mat.userData.shader = shader;
  };
  mat.customProgramCacheKey = () => 'fresnel-ghost';
  return mat;
}

// Smoothly blend the casing materials between solid and ghost.
export function setCasingGhost(M, t) {
  const e = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  for (const m of M.casing) {
    m.transparent = e > 0.001;
    m.opacity = 1 - 0.87 * e;
    m.depthWrite = e < 0.5;
    if (m.userData.shader?.uniforms?.uGhost) m.userData.shader.uniforms.uGhost.value = e;
  }
}
