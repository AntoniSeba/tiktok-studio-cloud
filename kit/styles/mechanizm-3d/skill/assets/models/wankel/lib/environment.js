// environment.js - studio environment built procedurally (no external HDR).
// A gradient sky with soft warm/cool panels gives metals smooth, believable
// reflections; the background is a separate, softer gradient so the engine
// reads against a calm backdrop instead of black.

import * as THREE from 'three';

export function buildStudioEnvironment(renderer) {
  // ---- reflection environment (equirectangular, PMREM filtered)
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');

  // A photographic dark studio: mostly dark with a few hard, very bright
  // sources. Contrast in the environment is what makes polished metal read as
  // metal instead of as flat grey plastic.
  ctx.fillStyle = '#090b0e';
  ctx.fillRect(0, 0, 1024, 512);

  // dim ceiling dome
  const sky = ctx.createLinearGradient(0, 0, 0, 260);
  sky.addColorStop(0.0, '#5c6875');
  sky.addColorStop(0.55, '#2b3239');
  sky.addColorStop(1.0, '#0b0d10');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1024, 300);

  // long strip light: gives shafts, tubes and chamfers their highlight streak
  const strip = ctx.createLinearGradient(0, 96, 0, 150);
  strip.addColorStop(0, 'rgba(255,255,255,0)');
  strip.addColorStop(0.45, 'rgba(255,253,248,1)');
  strip.addColorStop(0.55, 'rgba(255,253,248,1)');
  strip.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = strip;
  ctx.fillRect(140, 96, 620, 54);
  ctx.fillRect(820, 118, 190, 34);

  // two hard edged softboxes
  const box = (x, y, w, h, color, a, feather) => {
    ctx.save();
    ctx.filter = `blur(${feather}px)`;
    ctx.fillStyle = `rgba(${color},${a})`;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  };
  box(120, 200, 300, 150, '255,250,240', 0.95, 16);
  box(700, 210, 250, 130, '206,226,250', 0.8, 18);
  box(430, 300, 180, 90, '255,244,228', 0.5, 22);

  // small bare bulb hotspots: pinpoint speculars
  const bulb = (x, y, r, a, col) => {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(0.35, `rgba(${col},${a * 0.35})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  bulb(300, 120, 40, 1.0, '255,255,255');
  bulb(760, 96, 30, 0.95, '255,252,246');
  bulb(960, 200, 26, 0.75, '226,238,255');

  // floor: dark, with a soft warm bounce and a cool one
  const warm = ctx.createRadialGradient(320, 420, 20, 320, 420, 300);
  warm.addColorStop(0, 'rgba(140,108,72,0.28)');
  warm.addColorStop(1, 'rgba(140,108,72,0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 180, 660, 332);
  const cool = ctx.createRadialGradient(820, 430, 20, 820, 430, 280);
  cool.addColorStop(0, 'rgba(96,120,150,0.22)');
  cool.addColorStop(1, 'rgba(96,120,150,0)');
  ctx.fillStyle = cool;
  ctx.fillRect(520, 200, 504, 312);

  const envTex = new THREE.CanvasTexture(c);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(envTex).texture;
  envTex.dispose();
  pmrem.dispose();

  // ---- background: calm vertical gradient with a soft glow behind the engine
  const b = document.createElement('canvas');
  b.width = 64;
  b.height = 512;
  const bctx = b.getContext('2d');
  const bg = bctx.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0.0, '#20262e');
  bg.addColorStop(0.45, '#171c22');
  bg.addColorStop(1.0, '#0d1013');
  bctx.fillStyle = bg;
  bctx.fillRect(0, 0, 64, 512);
  const glow = bctx.createLinearGradient(0, 150, 0, 380);
  glow.addColorStop(0, 'rgba(120,150,190,0)');
  glow.addColorStop(0.5, 'rgba(120,150,190,0.16)');
  glow.addColorStop(1, 'rgba(120,150,190,0)');
  bctx.fillStyle = glow;
  bctx.fillRect(0, 150, 64, 230);
  const bgTex = new THREE.CanvasTexture(b);
  bgTex.colorSpace = THREE.SRGBColorSpace;

  return { env, background: bgTex };
}

// Soft radial shadow catcher: an invisible floor that only accumulates the
// shadow, so the engine appears to float in a lit space.
export function makeRadialFadeTexture(size = 256, inner = 0.35, outer = 1.0) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * inner * 0.5, size / 2, size / 2, size * outer * 0.5);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#bdbdbd');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function makeStudioFloor(size = 14000) {
  const geo = new THREE.CircleGeometry(size * 0.5, 96);
  const fade = makeRadialFadeTexture(512, 0.25, 1.0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0f1216,
    roughness: 0.44,
    metalness: 0.5,
    transparent: true,
    alphaMap: fade,
    depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  m.name = 'StudioFloor';
  return m;
}

export function makeShadowFloor(size = 9000) {
  const geo = new THREE.CircleGeometry(size * 0.5, 96);
  const mat = new THREE.ShadowMaterial({ opacity: 0.34 });
  mat.color = new THREE.Color(0x05080c);
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  m.name = 'ShadowFloor';
  return m;
}
