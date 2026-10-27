// heads.js - dwie glowice 24v (po 4 zawory na cylinder), po dwa walki rozrzadu
// z krzywkami na zawor, dzwignie palcowe z kompensacja hydrauliczna, VarioCam na
// czterech walkach, wtryskiwacze piezoelektryczne centralnie, cewki na swiecach,
// pokrywy walkow i naped lancuchem (kola zebate + VarioCam).
// Kazda glowica jest budowana w ukladzie swiata z uwzglednieniem znaku banku.

import * as THREE from 'three';
import {
  chamferBox,
  taperBox,
  extrudeProfile,
  cylinder,
  softCylinder,
  camLobeGeometry,
  coilSpring,
  gearGeometry,
  tubeBetween,
  tubeThrough,
  arcDisc,
  cached,
  mesh,
  fastener,
} from '../lib/geom.js';
import { annulus, plateAlongX, circlePoints, cylinderX, softCylinderX, mirrorX } from '../lib/shapes.js';
import { createMaterials } from '../lib/materials.js';
import { LAYOUT, CYLINDERS, D2R, valveLiftCrank, camRotation, lobePhase } from '../lib/layout.js';

const DECK = LAYOUT.deckHeight;
const HEAD_TOP = DECK + LAYOUT.headThickness;
const COVER_FROM = LAYOUT.coverFrom;
const COVER_TO = LAYOUT.coverTo;
const CAM_Y = LAYOUT.camAboveDeck;
const CAM_X = LAYOUT.camX;
const TILT = LAYOUT.valveTilt * D2R;
const SEAT_X = LAYOUT.valveSeatX;
const SEAT_Y = LAYOUT.valveSeatY;
const VZ = LAYOUT.valveZOffset;
const ROCKER_PIVOT_X = 240;
const ROCKER_PIVOT_Y = 62;

// kat kierunku zewnetrznego zaworu, mierzony od +X (0 = +X), znak banku wchodzi w kat
function valveDirection(sign, which) {
  if (sign > 0) return which === 'intake' ? TILT : -TILT;
  return which === 'intake' ? Math.PI - TILT : Math.PI + TILT;
}

export function buildHeads(M) {
  const root = new THREE.Group();
  root.name = 'CYLINDER_HEADS';
  const heads = {};
  const valvetrain = [];
  const cams = [];

  const stemGeo = cached('valvestem', () => cylinder(3.6, 3.6, 74, 14));
  const discGeo = {
    intake: cached('valveheadI', () => {
      const g = new THREE.CylinderGeometry(19, 12, 7, 28);
      g.translate(0, -2, 0);
      return g;
    }),
    exhaust: cached('valveheadE', () => {
      const g = new THREE.CylinderGeometry(16, 10, 7, 28);
      g.translate(0, -2, 0);
      return g;
    }),
  };
  const retainerGeo = cached('vretainer', () => softCylinder(13.5, 7, 24, 1.2));
  const springGeo = cached('vspring', () => coilSpring(13.5, 58, 6, 3.0, 8));
  const bucketGeo = cached('vbucket', () => softCylinder(16.5, 12, 28, 1.5));

  for (const sign of [1, -1]) {
    const bank = sign > 0 ? 'A' : 'B';
    const wrap = new THREE.Group();
    wrap.name = `HEAD_${bank}`;
    root.add(wrap);
    const pos = (x, y, z) => [x * sign, y, z];

    // ---- odlew glowicy: szeroka przy plaszczyznie, zwezona pod pokrywa
    const prof = [
      [DECK, -118],
      [DECK + 60, -122],
      [COVER_FROM - 4, -104],
      [COVER_FROM - 4, 104],
      [DECK + 60, 122],
      [DECK, 118],
    ];
    let headGeo = extrudeProfile(prof, LAYOUT.headHalfZ * 2, 5);
    if (sign < 0) headGeo = mirrorX(headGeo);
    const headMesh = new THREE.Mesh(headGeo, M.headCast);
    headMesh.name = `CylinderHead_${bank}`;
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    wrap.add(headMesh);

    // uszczelka pod glowica (warstwa 1,2 mm = objetosc komory)
    const gasket = mesh(
      chamferBox(LAYOUT.gasketThickness, 236, LAYOUT.headHalfZ * 2, 8, 1.5),
      M.gasket,
      `HeadGasket_${bank}`,
      wrap,
      pos(DECK + 1, 0, 0)
    );

    // ---- kanaly dolotowe (gora) i wydechowe (dol): krocca i krotkie odcinki
    for (const c of CYLINDERS.filter((c) => c.bankSign === sign)) {
      for (const [which, y, portR] of [['intake', 1, 1], ['exhaust', -1, 1]]) {
        for (const dz of [-VZ, VZ]) {
          const port = mesh(
            tubeThrough(
              [
                [sign * (SEAT_X + 6), y * SEAT_Y, c.z + dz],
                [sign * (DECK + 62), y * (SEAT_Y + 26), c.z + dz],
                [sign * (DECK + 74), y * 118, c.z + dz],
              ],
              20 * portR,
              16,
              12,
              false,
              0.4
            ),
            M.caseMachined,
            `Port_${which}_Cyl${c.id}_${dz > 0 ? 'R' : 'L'}`,
            wrap
          );
          port.castShadow = true;
        }
      }
      // gniazda zaworow
      for (const which of ['intake', 'exhaust']) {
        const dir = valveDirection(sign, which);
        const y = which === 'intake' ? 1 : -1;
        for (const dz of [-VZ, VZ]) {
          const gseat = mesh(annulus(LAYOUT.valveHeadR[which] + 3, LAYOUT.valveHeadR[which] - 1, 5, 24), M.valveSeat, `ValveSeat_${bank}_Cyl${c.id}_${which}_${dz > 0 ? 'R' : 'L'}`, wrap, [
            SEAT_X * sign,
            y * SEAT_Y,
            c.z + dz,
          ]);
          gseat.rotation.z = dir - Math.PI / 2;
        }
      }
    }

    // ---- walki rozrzadu z krzywkami
    for (const which of ['intake', 'exhaust']) {
      const cam = new THREE.Group();
      cam.name = `CAMSHAFT_${which.toUpperCase()}_${bank}`;
      cam.position.set(sign * CAM_X, which === 'intake' ? CAM_Y : -CAM_Y, 0);
      wrap.add(cam);
      const shaft = mesh(cylinderX(19, 372, 30), M.darkSteel, `CamShaft_${which}_${bank}`, cam);
      shaft.castShadow = true;
      for (const z of [-155, -59, 59, 155]) {
        mesh(cylinderX(24, 30, 28), M.steel, `CamJournal_${which}_${bank}_${z}`, cam, [0, 0, z]);
      }
      for (const c of CYLINDERS.filter((c) => c.bankSign === sign)) {
        for (const dz of [-VZ, VZ]) {
          const lobe = mesh(
            camLobeGeometry(lobePhase(c, which), LAYOUT.camBaseR, LAYOUT.valveLift, 17),
            M.steel,
            `CamLobe_${bank}_Cyl${c.id}_${which}_${dz > 0 ? 'R' : 'L'}`,
            cam,
            [0, 0, c.z + dz]
          );
          lobe.castShadow = true;
        }
      }
      // kolo zebate napedu rozrzadu i wariator VarioCam
      const sprocket = mesh(gearGeometry(34, 52, 6, 15), M.darkSteel, `CamSprocket_${which}_${bank}`, cam, [0, 0, LAYOUT.camChainZ]);
      sprocket.castShadow = true;
      const phaser = mesh(softCylinder(44, 30, 40, 4), M.caseMachined, `VarioCam_${which}_${bank}`, cam, [0, 0, LAYOUT.camChainZ - 30]);
      phaser.rotation.x = Math.PI / 2;
      phaser.castShadow = true;
      mesh(cylinderX(20, 22, 20), M.darkSteel, `VarioCam_Hub_${which}_${bank}`, cam, [0, 0, LAYOUT.camChainZ - 48]);
      cams.push({ bank, which, group: cam });
    }

    // ---- zawory, sprezyny, dzwignie palcowe
    for (const c of CYLINDERS.filter((c) => c.bankSign === sign)) {
      for (const which of ['intake', 'exhaust']) {
        const ySign = which === 'intake' ? 1 : -1;
        const dir = valveDirection(sign, which);
        for (const dz of [-VZ, VZ]) {
          const vg = new THREE.Group();
          vg.name = `VALVE_${bank}_Cyl${c.id}_${which}_${dz > 0 ? 'R' : 'L'}`;
          vg.position.set(SEAT_X * sign, ySign * SEAT_Y, c.z + dz);
          vg.rotation.z = dir - Math.PI / 2; // lokalne +Y = kierunek na zewnatrz zaworu
          wrap.add(vg);

          const move = new THREE.Group();
          move.name = 'Valve_Moving';
          vg.add(move);
          mesh(stemGeo, M.valve, `ValveStem_${bank}_${c.id}_${which}_${dz > 0 ? 'R' : 'L'}`, move, [0, 30, 0]);
          mesh(discGeo[which], M.valve, `ValveHead_${bank}_${c.id}_${which}_${dz > 0 ? 'R' : 'L'}`, move, [0, 0, 0]);
          const ret = mesh(retainerGeo, M.darkSteel, `ValveRetainer_${bank}_${c.id}_${which}_${dz > 0 ? 'R' : 'L'}`, move, [0, 58, 0]);
          const spring = mesh(springGeo, M.springSteel, `ValveSpring_${bank}_Cyl${c.id}_${which}_${dz > 0 ? 'R' : 'L'}`, vg, [0, 30, 0]);
          spring.castShadow = true;
          mesh(cylinderX(9, 40, 14), M.guide, `ValveGuide_${bank}_Cyl${c.id}_${which}_${dz > 0 ? 'R' : 'L'}`, vg, [0, 46, 0]);

          // dzwignia palcowa: obrot wokol sworznia, docisk od krzywki
          const rocker = new THREE.Group();
          rocker.name = `Rocker_${bank}_Cyl${c.id}_${which}_${dz > 0 ? 'R' : 'L'}`;
          const pivot = [-CAM_X + ROCKER_PIVOT_X * 0, 0, 0];
          void pivot;
          rocker.position.set(sign * ROCKER_PIVOT_X, ySign * ROCKER_PIVOT_Y, c.z + dz);
          wrap.add(rocker);
          mesh(cylinderX(11, 34, 16), M.darkSteel, 'Rocker_Shaft', rocker);
          const arm = mesh(chamferBox(52, 12, 26, 5, 2), M.steel, 'Rocker_Arm', rocker, [sign * 14, -6, 0]);
          arm.castShadow = true;
          mesh(softCylinder(9, 10, 20, 2), M.darkSteel, 'Rocker_Pad', rocker, [sign * 34, -10, 0]).rotation.z = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
          mesh(softCylinder(10, 12, 20, 2), M.darkSteel, 'Rocker_LashElement', rocker, [sign * 2, -14, 0]);
          mesh(cylinderX(13, 40, 16), M.darkSteel, 'Rocker_ShaftPedestal', wrap, [sign * ROCKER_PIVOT_X, ySign * (ROCKER_PIVOT_Y - 16), c.z + dz]);

          valvetrain.push({ bank, sign, cyl: c, which, z: c.z + dz, vg, move, spring, rocker, springFree: 58 });
        }
      }

      // ---- wtryskiwacz piezoelektryczny centralnie i cewka ze swieca
      const injDir = sign > 0 ? 32 * D2R : Math.PI - 32 * D2R;
      const inj = new THREE.Group();
      inj.name = `INJECTOR_Cyl${c.id}`;
      inj.position.set(sign * 224, 6, c.z);
      inj.rotation.z = injDir - Math.PI / 2;
      wrap.add(inj);
      mesh(cylinder(4.5, 9, 22, 14), M.copper, `Injector_Tip_Cyl${c.id}`, inj);
      mesh(cylinder(11, 11, 46, 16), M.darkSteel, `Injector_Body_Cyl${c.id}`, inj, [0, 34, 0]);
      mesh(cylinder(13, 13, 22, 14), M.caseMachined, `Injector_Clamp_Cyl${c.id}`, inj, [0, 62, 0]);

      const plugDir = sign > 0 ? -30 * D2R : Math.PI + 30 * D2R;
      const plug = new THREE.Group();
      plug.name = `SPARK_PLUG_Cyl${c.id}`;
      plug.position.set(sign * 222, -8, c.z);
      plug.rotation.z = plugDir - Math.PI / 2;
      wrap.add(plug);
      mesh(cylinder(7, 3.3, 30, 12), M.darkSteel, `SparkPlug_Tip_Cyl${c.id}`, plug, [0, 12, 0]);
      mesh(cached('plughex', () => new THREE.CylinderGeometry(11, 11, 15, 6)), M.steel, `SparkPlug_Hex_Cyl${c.id}`, plug, [0, 32, 0]);
      mesh(cylinder(10, 10, 34, 16), M.ceramic, `SparkPlug_Insulator_Cyl${c.id}`, plug, [0, 56, 0]);
      mesh(cylinder(13, 13, 20, 14), M.rubber, `Coil_Boot_Cyl${c.id}`, plug, [0, 78, 0]);
      const coil = mesh(chamferBox(40, 52, 40, 10, 4), M.coil, `IgnitionCoil_Cyl${c.id}`, plug, [0, 112, 0]);
      coil.castShadow = true;
    }

    // ---- listwa wtryskowa i pompa wysokiego cisnienia (naped z walka)
    const rail = new THREE.Group();
    rail.name = `FUEL_RAIL_${bank}`;
    wrap.add(rail);
    mesh(cylinderX(13, 340, 20), M.steel, `FuelRail_${bank}`, rail, pos(276, 60, 0));
    for (const c of CYLINDERS.filter((c) => c.bankSign === sign)) {
      mesh(cylinderX(5, 120, 10), M.steel, `FuelLine_${bank}_Cyl${c.id}`, rail, pos(252, 34, c.z)).rotation.z = 0.7 * sign;
    }
    const hpp = mesh(softCylinder(26, 90, 24, 3), M.caseMachined, `HighPressureFuelPump_${bank}`, wrap, pos(CAM_X, -CAM_Y, 186));
    hpp.rotation.x = Math.PI / 2;
    mesh(cylinderX(20, 40, 18), M.steel, `Hpfp_Drive_${bank}`, wrap, pos(CAM_X, -CAM_Y, 224));

    // ---- pokrywa walkow rozrzadu
    const coverGroup = new THREE.Group();
    coverGroup.name = `CAM_COVER_${bank}`;
    wrap.add(coverGroup);
    const cprof = [
      [COVER_FROM, -104],
      [COVER_TO - 10, -96],
      [COVER_TO, -74],
      [COVER_TO, 74],
      [COVER_TO - 10, 96],
      [COVER_FROM, 104],
    ];
    let cgeo = extrudeProfile(cprof, 350, 5);
    if (sign < 0) cgeo = mirrorX(cgeo);
    const cover = new THREE.Mesh(cgeo, M.coverComposite);
    cover.name = `CamCover_${bank}`;
    cover.castShadow = true;
    coverGroup.add(cover);
    mesh(chamferBox(5, 190, 348, 20, 1.5), M.gasket, `CamCover_Gasket_${bank}`, coverGroup, pos(COVER_FROM - 1, 0, 0));
    for (const z of [-120, 0, 120]) {
      mesh(chamferBox(26, 16, 54, 6, 2), M.coverCompositeB, `CamCover_Rib_${bank}_${z}`, coverGroup, pos(COVER_TO + 6, 0, z));
    }
    // korek wlewu oleju
    const filler = mesh(softCylinder(24, 22, 20, 3), M.coverCompositeB, `OilFillerCap_${bank}`, coverGroup, pos(COVER_TO + 14, 40, z_of(bank)));
    void filler;
    mesh(cylinderX(20, 30, 20), M.coverComposite, `OilFiller_Neck_${bank}`, coverGroup, pos(COVER_TO, 40, z_of(bank)));
    // sruby pokrywy
    for (const z of [-150, -100, -50, 0, 50, 100, 150]) {
      for (const y of [-88, 88]) {
        const b = fastener(7, 28, 13, M.darkSteel, `CamCoverBolt_${bank}_${z}_${y}`);
        b.position.set(sign * (COVER_FROM + 4), y, z);
        b.rotation.z = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
        coverGroup.add(b);
      }
    }
    // czujniki walkow
    for (const y of [72, -72]) {
      const cs = mesh(softCylinder(14, 34, 16, 3), M.blackOxide, `CamSensor_${bank}_${y > 0 ? 'I' : 'E'}`, coverGroup, pos(COVER_FROM + 30, y, 150));
      cs.rotation.z = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    heads[bank] = { wrap, coverGroup, sign };
  }

  function z_of(bank) {
    return bank === 'A' ? 140 : -140;
  }

  return { root, heads, valvetrain, cams };
}

// Ustawienie wszystkich ruchomych elementow rozrzadu dla danego kata walu.
export function updateValvetrain(valvetrain, cams, crankDeg) {
  for (const v of valvetrain) {
    const lift = valveLiftCrank(v.cyl, v.which, crankDeg);
    v.move.position.y = -lift;
    const comp = Math.max(0.25, (v.springFree - lift) / v.springFree);
    v.spring.scale.y = comp;
    v.spring.position.y = 30 - (v.springFree * (1 - comp)) / 2;
    v.rocker.rotation.z = (v.sign > 0 ? -1 : 1) * lift * 0.012;
  }
  for (const c of cams) {
    c.group.rotation.z = camRotation(crankDeg);
  }
}

void tubeBetween;
void arcDisc;
void plateAlongX;
void circlePoints;
void softCylinderX;
void createMaterials;
void D2R;
