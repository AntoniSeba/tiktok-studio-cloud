// materials.js - simple physically-plausible material set.
// Values are deliberately within the range of real surfaces: die-cast
// aluminium ~0.9 metalness / ~0.6 roughness, machined steel polished,
// rubber near-dielectric, etc.

import * as THREE from 'three';

// Procedural micro-variation map so cast surfaces are not perfectly uniform.
export function makeCastRoughnessTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // cheap value noise, two octaves + tooling streaks
      const n1 = Math.sin(x * 0.31) * Math.cos(y * 0.27) * 0.5 + 0.5;
      const n2 = (Math.sin(x * 1.7 + y * 0.6) * 0.5 + 0.5) * 0.35;
      const streak = (Math.sin(y * 0.09) * 0.5 + 0.5) * 0.2;
      const v = 165 + (n1 * 45 + n2 * 30 + streak * 25);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.min(255, v);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

// Belt texture: ribs run along the belt (constant along u, varying across v).
export function makeBeltRibTexture(ribs = 6) {
  const w = 64;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#141516';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < ribs; i++) {
    const y = (i + 0.5) * (h / ribs);
    const grd = ctx.createLinearGradient(0, y - 8, 0, y + 8);
    grd.addColorStop(0, '#08090a');
    grd.addColorStop(0.5, '#33363a');
    grd.addColorStop(1, '#08090a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, y - h / ribs / 2, w, h / ribs);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function createMaterials() {
  const rough = makeCastRoughnessTexture();
  const beltTex = makeBeltRibTexture();

  const M = {};
  M.castAluminium = new THREE.MeshStandardMaterial({
    name: 'CastAluminium',
    color: 0xa9aeb4,
    metalness: 0.82,
    roughness: 0.58,
    roughnessMap: rough,
    envMapIntensity: 1.0,
  });
  M.castAluminiumBright = new THREE.MeshStandardMaterial({
    name: 'CastAluminiumMachined',
    color: 0xc2c7cc,
    metalness: 0.9,
    roughness: 0.34,
    roughnessMap: rough,
    envMapIntensity: 1.1,
  });
  M.castIron = new THREE.MeshStandardMaterial({
    name: 'CastIron',
    color: 0x50545a,
    metalness: 0.7,
    roughness: 0.72,
    roughnessMap: rough,
    envMapIntensity: 0.9,
  });
  M.machinedSteel = new THREE.MeshStandardMaterial({
    name: 'MachinedSteel',
    color: 0x9ba1a8,
    metalness: 1.0,
    roughness: 0.3,
    envMapIntensity: 1.2,
  });
  M.polishedSteel = new THREE.MeshStandardMaterial({
    name: 'PolishedSteel',
    color: 0xd2d6da,
    metalness: 1.0,
    roughness: 0.14,
    envMapIntensity: 1.35,
  });
  M.headerSteel = new THREE.MeshStandardMaterial({
    name: 'HeaderSteel',
    color: 0xb6bac0,
    metalness: 1.0,
    roughness: 0.22,
    envMapIntensity: 1.3,
  });
  M.bearingBabbitt = new THREE.MeshStandardMaterial({
    name: 'BearingBabbitt',
    color: 0xb9b2a4,
    metalness: 0.85,
    roughness: 0.42,
  });
  M.rubber = new THREE.MeshStandardMaterial({
    name: 'Rubber',
    color: 0x1a1b1d,
    metalness: 0.0,
    roughness: 0.86,
  });
  M.beltRubber = new THREE.MeshStandardMaterial({
    name: 'BeltRubber',
    color: 0x2a2c2f,
    metalness: 0.0,
    roughness: 0.78,
    map: beltTex,
  });
  M.plasticBlack = new THREE.MeshStandardMaterial({
    name: 'BlackPlastic',
    color: 0x232528,
    metalness: 0.05,
    roughness: 0.55,
  });
  M.magnesium = new THREE.MeshStandardMaterial({
    name: 'Magnesium',
    color: 0xa9a49b,
    metalness: 0.75,
    roughness: 0.5,
    roughnessMap: rough,
  });
  M.ceramic = new THREE.MeshStandardMaterial({
    name: 'CeramicInsulator',
    color: 0xe6e0d2,
    metalness: 0.0,
    roughness: 0.32,
  });
  M.brass = new THREE.MeshStandardMaterial({
    name: 'Brass',
    color: 0xb08d57,
    metalness: 1.0,
    roughness: 0.34,
  });
  M.copper = new THREE.MeshStandardMaterial({
    name: 'Copper',
    color: 0x9c5d3a,
    metalness: 1.0,
    roughness: 0.35,
  });
  M.gasket = new THREE.MeshStandardMaterial({
    name: 'CompositeGasket',
    color: 0x33363a,
    metalness: 0.1,
    roughness: 0.85,
  });
  M.wire = new THREE.MeshStandardMaterial({
    name: 'IgnitionWire',
    color: 0xc8481c,
    metalness: 0.05,
    roughness: 0.5,
  });
  M.bore = new THREE.MeshStandardMaterial({
    name: 'BoreWall',
    color: 0x2b2e31,
    metalness: 0.85,
    roughness: 0.42,
    side: THREE.DoubleSide,
  });
  M.chamber = new THREE.MeshStandardMaterial({
    name: 'CombustionChamber',
    color: 0x3a3d41,
    metalness: 0.9,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });

  return M;
}
