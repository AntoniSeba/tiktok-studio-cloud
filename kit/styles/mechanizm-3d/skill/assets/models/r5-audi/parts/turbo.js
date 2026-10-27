// turbo.js - the single KKK turbocharger of the 2.2 T R5 (K24-7000 on 3B / AAN
// / ABY, K24-7200 on the RS2's ADU).
//
// The shaft is parallel to the crank, as it is on the real engine, and it sits
// on the exhaust side. Both housings are true volutes: the cross section of the
// gas path shrinks as it sweeps around, which is what makes a turbo housing a
// snail. The compressor wheel has six full blades and six splitters, the
// turbine wheel eleven blades.
//
// The shaft speed is NOT a function of the crank angle. It is integrated from
// turboShaftRpm(rpm, boost) over elapsed time, so the wheels spin at their own
// rate: at 6000 rpm the shaft turns about 26 times for every turn of the crank,
// and that ratio changes with load, which a mechanically driven shaft could
// never do.

import * as THREE from 'three';
import {
  voluteGeometry,
  vaneWheelGeometry,
  chamferBox,
  taperBox,
  softCylinder,
  sleeve,
  smoothDisc,
  annulus,
  tubeThrough,
  tubeBetween,
  cached,
  mesh,
  fastener,
} from '../lib/geom.js';
import { TURBO, LAYOUT } from '../lib/kinematics.js';

export const TURBO_POS = new THREE.Vector3(LAYOUT.turboShaftX, LAYOUT.turboShaftY, LAYOUT.turboShaftZ);

export function buildTurbo(M) {
  const root = new THREE.Group();
  root.name = 'TURBOCHARGER';
  root.position.copy(TURBO_POS);

  // The shaft axis is Z. The compressor sits at -Z (outboard), the turbine at
  // +Z (towards the header), and the bearing housing straddles the middle.
  const ZC = -30; // compressor backplate plane
  const ZT = 46; // turbine backplate plane

  // ------------------------------------------------------------ bearing housing
  const chra = new THREE.Group();
  chra.name = 'Turbo_CentreHousing';
  const body = mesh(sleeve(17, 32, 74, 40, 1.5), M.ironDark, 'CHRA_Body', chra, [0, 0, 4]);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  for (const z of [-22, 30]) {
    const ring = mesh(annulus(32, 44, 8, 34, 1.2), M.ironDark, `CHRA_Flange_${z}`, chra, [0, 0, z]);
    ring.rotation.x = Math.PI / 2;
  }
  // oil inlet banjo on top, oil drain underneath
  mesh(softCylinder(11, 26, 20, 1), M.brass, 'CHRA_OilInlet', chra, [0, 42, 4]).rotation.x = Math.PI / 2;
  mesh(sleeve(11, 24, 40, 26, 1.2), M.ironDark, 'CHRA_OilDrainFlange', chra, [0, -40, 4]).rotation.x = Math.PI / 2;
  // water jacket ports on the flanks
  for (const s of [1, -1]) {
    mesh(softCylinder(9, 22, 14, 1), M.brass, `CHRA_WaterPort_${s > 0 ? 'R' : 'L'}`, chra, [s * 30, 6, 4]).rotation.z = Math.PI / 2;
  }
  root.add(chra);

  // ------------------------------------------------------- compressor housing
  const comp = new THREE.Group();
  comp.name = 'Turbo_CompressorHousing';
  const compVolute = new THREE.Mesh(
    voluteGeometry({ rSpiral: 78, rStart: 30, rEnd: 15, turns: 1, seg: 110, radialSeg: 26, z: ZC }),
    M.turboAlu
  );
  compVolute.name = 'Compressor_Volute';
  compVolute.castShadow = true;
  comp.add(compVolute);
  // backplate and the axial inlet bell
  const back = mesh(softCylinder(66, 14, 42, 2), M.turboAlu, 'Compressor_Backplate', comp, [0, 0, ZC + 22]);
  back.rotation.x = Math.PI / 2;
  const bell = mesh(sleeve(38, 47, 58, 34, 2), M.turboAlu, 'Compressor_InletBell', comp, [0, 0, ZC - 48]);
  bell.rotation.x = Math.PI / 2;
  bell.castShadow = true;
  const bellLip = mesh(annulus(38, 51, 6, 34, 1.2), M.turboAlu, 'Compressor_InletLip', comp, [0, 0, ZC - 76]);
  bellLip.rotation.x = Math.PI / 2;
  // tangential outlet
  const outlet = mesh(tubeThrough([new THREE.Vector3(74, 6, ZC), new THREE.Vector3(108, 26, ZC), new THREE.Vector3(120, 52, ZC)], 27, 20, 20, false, 0.4), M.turboAlu, 'Compressor_Outlet', comp);
  outlet.castShadow = true;
  const outletFlange = mesh(annulus(20, 36, 8, 24, 1.2), M.turboAlu, 'Compressor_OutletFlange', comp, [120, 58, ZC]);
  outletFlange.rotation.x = Math.PI / 2;
  root.add(comp);

  // --------------------------------------------------------- turbine housing
  const turb = new THREE.Group();
  turb.name = 'Turbo_TurbineHousing';
  const turbVolute = new THREE.Mesh(
    voluteGeometry({ rSpiral: 66, rStart: 27, rEnd: 13, turns: 1, seg: 100, radialSeg: 24, z: ZT }),
    M.turboIron
  );
  turbVolute.name = 'Turbine_Volute';
  turbVolute.castShadow = true;
  turb.add(turbVolute);
  const tBack = mesh(softCylinder(56, 14, 36, 2), M.turboIron, 'Turbine_Backplate', turb, [0, 0, ZT + 18]);
  tBack.rotation.x = Math.PI / 2;
  // axial outlet towards the downpipe
  const outBell = mesh(sleeve(28, 36, 52, 30, 2), M.turboIron, 'Turbine_OutletFlange', turb, [0, 0, ZT + 50]);
  outBell.rotation.x = Math.PI / 2;
  outBell.castShadow = true;
  // tangential inlet flange, facing the header
  const inletFlange = mesh(chamferBox(56, 46, 12, 10, 3), M.turboIron, 'Turbine_InletFlange', turb, [58, 34, ZT]);
  inletFlange.castShadow = true;
  const inletNeck = mesh(tubeThrough([new THREE.Vector3(64, 40, ZT), new THREE.Vector3(46, 30, ZT), new THREE.Vector3(38, 20, ZT)], 15, 14, 14, false, 0.4), M.turboIron, 'Turbine_InletNeck', turb);
  // internal wastegate: a port in the volute throat with a swinging valve
  const wgPort = mesh(softCylinder(19, 16, 20, 1.2), M.turboIron, 'Wastegate_Port', turb, [30, 46, ZT + 12]);
  const wgCover = mesh(chamferBox(52, 20, 44, 8, 3), M.turboIron, 'Wastegate_Cover', turb, [40, 66, ZT + 10]);
  wgCover.castShadow = true;
  const wgValve = mesh(smoothDisc(20, 6, 26, 1.5), M.ironMachined, 'Wastegate_Valve', turb, [34, 50, ZT + 12]);
  wgValve.rotation.z = 0.35;
  root.add(turb);

  // ------------------------------------------------------------- the wheels
  const shaft = mesh(softCylinder(7.5, 92, 20, 0.8), M.steel, 'Turbo_Shaft', root);
  shaft.rotation.x = Math.PI / 2;

  const compWheel = new THREE.Group();
  compWheel.name = 'Compressor_Wheel';
  const full = vaneWheelGeometry({ rHub: 11, rTip: 29, height: 26, blades: TURBO.compressorBlades, thickness: 1.7, lean: 0.62, hubFlare: 0.4 });
  const split = vaneWheelGeometry({ rHub: 13, rTip: 29, height: 16, blades: TURBO.compressorSplitters, thickness: 1.4, lean: 0.62, hubFlare: 0.3 });
  full.children.forEach((c, i) => {
    c.material = M.compressorWheel;
    c.name = `Compressor_Blade_${i + 1}`;
    compWheel.add(c);
  });
  split.children.forEach((c, i) => {
    c.material = M.compressorWheel;
    c.name = `Compressor_Splitter_${i + 1}`;
    c.rotation.z += Math.PI / TURBO.compressorSplitters;
    compWheel.add(c);
  });
  const compHub = mesh(softCylinder(13, 30, 24, 1.2), M.compressorWheel, 'Compressor_Hub', compWheel, [0, 0, -14]);
  compHub.rotation.x = Math.PI / 2;
  compWheel.position.z = ZC - 20;
  root.add(compWheel);

  const turbWheel = new THREE.Group();
  turbWheel.name = 'Turbine_Wheel';
  const tGeo = vaneWheelGeometry({ rHub: 12, rTip: 26, height: 18, blades: TURBO.turbineBlades, thickness: 2.6, lean: 0.95, hubFlare: 0.5 });
  tGeo.children.forEach((c, i) => {
    c.material = M.turbineWheel;
    c.name = `Turbine_Blade_${i + 1}`;
    turbWheel.add(c);
  });
  const tHub = mesh(softCylinder(14, 26, 22, 1.5), M.turbineWheel, 'Turbine_Hub', turbWheel, [0, 0, 12]);
  tHub.rotation.x = Math.PI / 2;
  turbWheel.position.z = ZT + 16;
  root.add(turbWheel);

  // ------------------------------------------------------------ wastegate actuator
  const act = new THREE.Group();
  act.name = 'WASTEGATE_ACTUATOR';
  const can = mesh(softCylinder(31, 44, 40, 2), M.darkSteel, 'Wastegate_ActuatorCan', act, [96, 96, ZT]);
  can.rotation.x = Math.PI / 2;
  can.castShadow = true;
  mesh(annulus(10, 34, 6, 26, 1.2), M.darkSteel, 'Wastegate_ActuatorLid', act, [96, 96, ZT - 24]).rotation.x = Math.PI / 2;
  const bracket = mesh(chamferBox(70, 12, 40, 6, 2), M.darkSteel, 'Wastegate_ActuatorBracket', act, [70, 82, ZT]);
  bracket.castShadow = true;
  const rod = mesh(softCylinder(4.5, 78, 12, 0.5), M.steel, 'Wastegate_Rod', act, [56, 74, ZT + 12]);
  rod.rotation.z = Math.PI / 2;
  const arm = mesh(chamferBox(10, 34, 8, 4, 2), M.darkSteel, 'Wastegate_Arm', act, [34, 62, ZT + 12]);
  arm.rotation.z = 0.4;
  const hose = mesh(tubeThrough([new THREE.Vector3(96, 96, ZT - 30), new THREE.Vector3(96, 70, ZC - 40), new THREE.Vector3(70, 40, ZC - 60)], 4, 20, 8, false, 0.4), M.rubber, 'Wastegate_BoostHose', act);
  root.add(act);

  // ------------------------------------------------------------------ plumbing
  const plumbing = new THREE.Group();
  plumbing.name = 'TURBO_PLUMBING';
  const oilFeed = mesh(tubeThrough([new THREE.Vector3(-40, 90, 4), new THREE.Vector3(-16, 70, 4), new THREE.Vector3(0, 46, 4)], 5, 18, 8, false, 0.4), M.braidedLine, 'Turbo_OilFeedLine', plumbing);
  oilFeed.castShadow = true;
  mesh(tubeThrough([new THREE.Vector3(0, -46, 6), new THREE.Vector3(10, -90, 10), new THREE.Vector3(20, -130, 30)], 13, 18, 10, false, 0.4), M.ironDark, 'Turbo_OilDrainPipe', plumbing);
  for (const s of [1, -1]) {
    mesh(tubeThrough([new THREE.Vector3(s * 32, 8, 4), new THREE.Vector3(s * 54, 20, 30), new THREE.Vector3(s * 60, 44, 70)], 6, 16, 8, false, 0.4), M.rubber, `Turbo_WaterLine_${s > 0 ? 'R' : 'L'}`, plumbing);
  }
  root.add(plumbing);

  function update(turboDeg, boost) {
    compWheel.rotation.z = THREE.MathUtils.degToRad(turboDeg);
    turbWheel.rotation.z = THREE.MathUtils.degToRad(-turboDeg);
    shaft.rotation.z = 0;
    // the actuator rod extends as boost rises: that is the wastegate opening
    const k = Math.min(1, Math.max(0, boost));
    rod.position.x = 56 - k * 16;
    arm.rotation.z = 0.4 + k * 0.34;
    wgValve.rotation.z = 0.35 - k * 0.28;
    wgValve.position.y = 50 - k * 3;
  }
  update(0, 0);

  return { root, update, compWheel, turbWheel, shaft, actuator: act, groups: { chra, comp, turb, plumbing } };
}
