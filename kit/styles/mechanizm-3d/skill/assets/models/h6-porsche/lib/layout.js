// layout.js - jedyne zrodlo prawdy dla silnika Porsche 4.0 H6 (9A2 evo, 718 Cayman GT4 / Spyder).
// Plik nie importuje three, wiec ten sam kod liczy model w przegladarce i weryfikacje w node.
//
// DANE ZWERYFIKOWANE W ZRODLACH (surowe cytaty w RAPORT.md):
//   pojemnosc 3995 cm3, bore 102.0 mm, stroke 81.5 mm, korbowod 138 mm,
//   czop glowny 67 mm, czop korbowy 53 mm, rozstaw cylindrow 118 mm,
//   stopien sprezenia 13.0 +- 0.3, zaplon 1-6-2-4-3-5, odciecie 8000 obr/min,
//   nominalnie 309 kW (420 PS) przy 7600 obr/min, 420 Nm przy 5000-6800 obr/min.
//   Zrodla:
//   [A] M. Baumann, T. Wasserbaech, R. Schmidt, F. Lauer (Dr. Ing. h.c. F. Porsche AG),
//       "The New Six-Cylinder Naturally Aspirated Boxer Engine from Porsche",
//       28th Aachen Colloquium Automobile and Engine Technology 2019, rozdz. 1.2 i 2.1, tabela danych.
//   [B] Porsche Newsroom, press kit 718 Spyder / 718 Cayman GT4, "Engine and performance".
//   [C] Porsche (Newsroom), dane techniczne 718 Spyder: 3.995 cm3, 102,0 x 81,5 mm, 13,0:1, 8.000 obr/min.
//
// Uklad wspolrzednych (mm, 1 jednostka = 1 mm, os Z = os walu):
//   X - poprzecznie: bank A (cyl 1,2,3) przy +X, bank B (cyl 4,5,6) przy -X
//   Y - w gore: gora = kolektor dolotowy, dol = miska olejowa i wydech
//   Z - os walu: +Z = przod silnika (naped pomocniczy, tlumik drgan skretnych),
//       -Z = kolo zamachowe i naped rozrzadu (lancuch)
// Wal korbowy obraca sie wokol osi Z.

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;

export const LAYOUT = {
  // ---- dane katalogowe (zweryfikowane)
  displacement: 3995, // cm3, [A][C]
  bore: 102.0, // mm, [A][C]
  stroke: 81.5, // mm, [A][C]
  rodLength: 138.0, // mm, [A]
  mainJournalD: 67.0, // mm, [A][B]
  rodJournalD: 53.0, // mm, [A]
  cylinderSpacing: 118.0, // mm, [A]
  compressionRatio: 13.0, // [A] 13.0 +- 0.3, [C] 13,0:1
  firingOrder: [1, 6, 2, 4, 3, 5], // [A][B]
  maxRpm: 8000, // obr/min, [A][B]
  nominalRpm: 7600,
  nominalKw: 309,
  nominalTorqueNm: 420,
  torqueRpmFrom: 5000,
  torqueRpmTo: 6800,
  valveCount: 24,
  valvesPerCylinder: 4,
  camshafts: 4, // dwie glowice po dwa walki

  // ---- geometria wyliczona z danych katalogowych
  crankRadius: 40.75, // stroke / 2
  bankCount: 2,
  cylPerBank: 3,

  // ---- wymiary wewnetrzne modelu (kalibrowane tak, by stopien sprezenia wyszedl 13,0)
  deckHeight: 209.0, // od osi walu do plaszczyzny glowicy (wzdluz osi cylindra)
  pistonCompressionHeight: 30.25, // od osi sworznia do korony (korona rowna z plaszczyzna)
  pistonHeight: 52.0, // korona - dol spodnicy
  pistonDishDepth: 3.0, // niecka w koronie (objetosc komory)
  pistonDishR: 40.0,
  roofApexHeight: 7.5, // wysokosc dachu komory (pent roof) nad plaszczyzna
  gasketThickness: 1.2,
  valvePocketDepth: 3.0, // kieszenie zaworowe w koronie tloka (detal z [A], rozdz. 2.1)
  crankChamberR: 82.0, // promien komory korbowej w skrzyni korbowej
  barrelFrom: 82.0, // poczatek gladzi cylindra wzdluz osi X

  // ---- rozrzad
  valveLift: 11.5, // mm (przyjete, niekatalogowane)
  valveHeadR: { intake: 19.0, exhaust: 16.0 },
  valveTilt: 20.0, // stopnie od osi cylindra, w strone kanalu
  valveSeatX: 217.0, // odleglosc gniazda od osi walu (lokalnie w glowicy)
  valveSeatY: 32.0, // przesuniecie gniazda od osi cylindra
  camBaseR: 22.0,
  camAboveDeck: 80.0, // os walka rozrzadu nad osia cylindra (lokalnie Y)
  camX: 272.0, // os walka wzdluz osi cylindra (lokalnie X)
  valveZOffset: 21.0, // przesuniecie zaworow wzdluz Z od osi cylindra
  camChainZ: -202.0, // plaszczyzna napedu rozrzadu
  accessoryBeltZ: 278.0, // plaszczyzna paska napedu pomocniczego

  // ---- kadlub
  caseHalfX: 0.0, // plaszczyzna podzialu polowek skrzyni korbowej
  caseZ: 200.0, // polowa dlugosci skrzyni korbowej
  headThickness: 121.0, // grubosc odlewu glowicy
  headOuterY: 120.0,
  headHalfZ: 178.0,
  coverFrom: 352.0, // poczatek pokrywy walkow (lokalnie X)
  coverTo: 392.0,
  flywheelZ: -242.0,
  timingCoverZ: -226.0,

  // ---- uklad olejowy (zintegrowana sucha miska, [A] rozdz. 2.2)
  panTop: -72.0,
  panBottom: -134.0,
  oilPumpZ: -212.0,
};

// --------------------------------------------------------------------------
// Tablica cylindrow.
// Numeracja Porsche: bank A = cylindry 1, 2, 3 (przod, srodek, tyl), bank B = 4, 5, 6.
// phi = kat walu, przy ktorym tlok danego cylindra jest w GMP (w dowolnym suwie, mod 360).
// fireAngle = kat walu GMP suwu pracy (zaplonu) dla kolejnosci 1-6-2-4-3-5, co 120 stopni.
// Kolejnosc zaplonu wymusza geometrie walu: dwa czopy na jedna pozycje osiowa sa
// obrocone o 180 stopni, wiec przeciwlegle tloki sa w GMP jednoczesnie, a ich zaplony
// dzieli pelny obrot (360 stopni).
// --------------------------------------------------------------------------
export const CYLINDERS = [];
{
  const zSlots = [118, 0, -118];
  const bankA = [
    { id: 1, phi: 0, fire: 0 },
    { id: 2, phi: 240, fire: 240 },
    { id: 3, phi: 120, fire: 480 },
  ];
  const bankB = [
    { id: 4, phi: 0, fire: 360 },
    { id: 5, phi: 240, fire: 600 },
    { id: 6, phi: 120, fire: 120 },
  ];
  const push = (defs, bank, sign) => {
    defs.forEach((d, i) => {
      CYLINDERS.push({
        id: d.id,
        bank,
        bankSign: sign, // +1 = bank A (+X), -1 = bank B (-X)
        bankAngle: sign > 0 ? 0 : 180,
        slot: i,
        z: zSlots[i],
        phi: d.phi,
        fireAngle: d.fire,
        label: `Cylinder_${d.id}_${bank}`,
      });
    });
  };
  push(bankA, 'A', 1);
  push(bankB, 'B', -1);
}
CYLINDERS.sort((a, b) => a.id - b.id);

export const FIRING_SEQUENCE = LAYOUT.firingOrder.map((id) => CYLINDERS.find((c) => c.id === id));

// Czopy korbowe: pozycja osiowa, bank, kat bazowy czopu (w ukladzie swiata, kat 0 = +X).
export const ROD_JOURNALS = [];
for (const c of CYLINDERS) {
  ROD_JOURNALS.push({
    cyl: c.id,
    bank: c.bank,
    z: c.z,
    baseAngle: (c.bankAngle + c.phi) % 360,
    r: LAYOUT.rodJournalD / 2,
  });
}

// Siedem czopow glownych: na koncach i miedzy parami czopow korbowych.
export const MAIN_JOURNAL_Z = [-177, -118, -59, 0, 59, 118, 177];
export const MAIN_JOURNAL_R = LAYOUT.mainJournalD / 2;

// --------------------------------------------------------------------------
// Kinematyka korbowo-tlokowa
// --------------------------------------------------------------------------

// Odleglosc osi sworznia tloka od osi walu, wzdluz osi tego cylindra.
export function pistonPinDistance(cyl, crankDeg) {
  const r = LAYOUT.crankRadius;
  const L = LAYOUT.rodLength;
  const theta = (cyl.bankAngle + cyl.phi - crankDeg) * D2R; // kat czopu wzgledem osi banku
  const s = r * Math.cos(theta) + Math.sqrt(L * L - (r * Math.sin(theta)) ** 2);
  return { s, theta };
}

// Srodek czopa korbowego w ukladzie swiata (os walu = Z).
export function crankPinPosition(cyl, crankDeg) {
  const a = (cyl.bankAngle + cyl.phi - crankDeg) * D2R;
  const r = LAYOUT.crankRadius;
  return { x: r * Math.cos(a), y: r * Math.sin(a), z: cyl.z };
}

export function crankRotation(crankDeg) {
  return -crankDeg * D2R;
}

// Faza cyklu 0-720: 0 = GMP zaplonu, 180 = DMP pracy, 360 = GMP wydechu, 540 = DMP ssania.
export function cyclePhase(cyl, crankDeg) {
  return (((crankDeg - cyl.fireAngle) % 720) + 720) % 720;
}

export const STROKES = [
  { key: 'power', from: 0, to: 180, name: 'PRACA' },
  { key: 'exhaust', from: 180, to: 360, name: 'WYDECH' },
  { key: 'intake', from: 360, to: 540, name: 'SSANIE' },
  { key: 'compression', from: 540, to: 720, name: 'SPREZANIE' },
];

export function strokeOf(cyl, crankDeg) {
  const p = cyclePhase(cyl, crankDeg);
  for (const s of STROKES) if (p >= s.from && p < s.to) return s;
  return STROKES[0];
}

// --------------------------------------------------------------------------
// Rozrzad: 4 walki, naped lancuchem od walu (polowa obrotu, ten sam kierunek).
// Wznios zaworu podany jako funkcja fazy cyklu (0 = GMP zaplonu).
// --------------------------------------------------------------------------
export const VALVE_EVENTS = {
  // otwarcie / dlugosc w stopniach fazy cyklu
  intake: { open: 350, duration: 240 }, // 10 st. przed GMP, zamkniecie 50 st. po DMP
  exhaust: { open: 130, duration: 240 }, // 50 st. przed DMP, zamkniecie 10 st. po GMP
};

export function valveLift(which, phase) {
  const ev = VALVE_EVENTS[which];
  let d = phase - ev.open;
  d = ((d % 720) + 720) % 720;
  if (d > ev.duration) return 0;
  const t = d / ev.duration;
  return LAYOUT.valveLift * 0.5 * (1 - Math.cos(Math.PI * 2 * t));
}

export function valveLiftCrank(cyl, which, crankDeg) {
  return valveLift(which, cyclePhase(cyl, crankDeg));
}

// Kat walu, przy ktorym dany zawor jest maksymalnie otwarty (srodek wzniosu).
export function maxLiftCrank(cyl, which) {
  const ev = VALVE_EVENTS[which];
  return cyl.fireAngle + ev.open + ev.duration / 2;
}

// Walki obracaja sie z polowa predkosci walu, w tym samym kierunku.
export function camRotation(crankDeg) {
  return -crankDeg / 2 * D2R;
}

// Kat zamodelowanego klina krzywki (walki obracaja sie wokol Z).
// Zawor ssacy lezy pod walkiem (kontakt od -Y), wydechowy nad walkiem (kontakt +Y),
// dlatego noy krzywki musi trafic odpowiednio na -90 i +90 stopni.
export function lobePhase(cyl, which) {
  const contactAngle = which === 'intake' ? -90 : 90;
  return (contactAngle + maxLiftCrank(cyl, which) / 2) * D2R;
}

// Kat obrotu walka (w stopniach) przy danym kacie walu.
export function camAngleDeg(crankDeg) {
  return -crankDeg / 2;
}

// --------------------------------------------------------------------------
// Objetosci i stopien sprezenia (weryfikacja liczbowa)
// --------------------------------------------------------------------------
const MM3_TO_CM3 = 1 / 1000;

export function boreArea() {
  return Math.PI * (LAYOUT.bore / 2) ** 2;
}

// Objetosc skokowa jednego cylindra i calego silnika.
export function sweptVolumePerCylinder() {
  return boreArea() * LAYOUT.stroke * MM3_TO_CM3;
}
export function sweptVolumeTotal(cylinders = 6) {
  return sweptVolumePerCylinder() * cylinders;
}

// Objetosc komory sprezania z geometrii modelu: dach komory + niecka tloka + uszczelka.
export function clearanceVolume() {
  const A = boreArea();
  const roof = 0.5 * A * LAYOUT.roofApexHeight * MM3_TO_CM3; // dwa plaskie polacie dachu
  const dish = Math.PI * LAYOUT.pistonDishR ** 2 * LAYOUT.pistonDishDepth * MM3_TO_CM3;
  const gasket = A * LAYOUT.gasketThickness * MM3_TO_CM3;
  return { roof, dish, gasket, total: roof + dish + gasket };
}

export function compressionRatio() {
  const vc = clearanceVolume().total;
  return (sweptVolumePerCylinder() + vc) / vc;
}

// --------------------------------------------------------------------------
// Sprawdzenia mechaniczne (uzywane przez verify.mjs)
// --------------------------------------------------------------------------

// Minimalna odleglosc korony tloka od grzybka zaworu, w stopniach walu, dla wszystkich 24 zaworow.
export function valveToPistonClearance() {
  const out = [];
  for (const c of CYLINDERS) {
    for (const which of ['intake', 'exhaust']) {
      let min = { gap: Infinity, crank: 0 };
      for (let d = 0; d < 720; d += 0.5) {
        const { s } = pistonPinDistance(c, d);
        const crown = s + LAYOUT.pistonCompressionHeight; // plaszczyzna korony
        const pocket = crown - LAYOUT.valvePocketDepth; // dno kieszeni zaworowej
        const valveTip = LAYOUT.valveSeatX - valveLiftCrank(c, which, d); // grzybek zaworu
        const clearance = valveTip - pocket; // dno kieszeni minus grzybek
        if (clearance < min.gap) min = { gap: clearance, crank: d };
      }
      out.push({ cyl: c.id, which, ...min });
    }
  }
  return out;
}

// Sily bezwladnosci tlokow: suma po 6 cylindrach, dla pelnego cyklu 720 stopni.
// Plaski szesciocylindrowiec z czopami co 60 stopni jest zrownowazony: suma wypada 0.
export function pistonForceBalance(pistonMass = 0.45) {
  const rpm = LAYOUT.maxRpm;
  const omega = (rpm * 2 * Math.PI) / 60;
  const r = LAYOUT.crankRadius;
  const L = LAYOUT.rodLength;
  let maxSum = 0;
  let maxSingle = 0;
  for (let d = 0; d < 720; d += 1) {
    let sum = 0;
    for (const c of CYLINDERS) {
      // druga pochodna pozycji po czasie, numerycznie
      const dt = 1e-3;
      const a = pistonPinDistance(c, d - 0.05).s;
      const b1 = pistonPinDistance(c, d).s;
      const b2 = pistonPinDistance(c, d + 0.05).s;
      const d2s = (a - 2 * b1 + b2) / ((0.05 * D2R / omega) ** 2);
      const f = pistonMass * d2s * c.bankSign; // kierunek: znak banku
      sum += f;
      maxSingle = Math.max(maxSingle, Math.abs(f));
    }
    maxSum = Math.max(maxSum, Math.abs(sum));
  }
  void r;
  void L;
  return { maxSum, maxSingle, ratio: maxSum / maxSingle };
}

// Srednia predkosc tloka i maksymalne przyspieszenie (wielkosci katalogowe).
export function pistonKinematics(rpm = LAYOUT.maxRpm) {
  const r = LAYOUT.crankRadius;
  const L = LAYOUT.rodLength;
  const omega = (rpm * 2 * Math.PI) / 60;
  const meanPistonSpeed = (2 * LAYOUT.stroke * rpm) / 60 / 1000; // m/s
  // kat maksymalnej predkosci tloka
  let best = { v: 0, angle: 0 };
  const R = LAYOUT.crankRadius / LAYOUT.rodLength;
  for (let d = 0; d < 180; d += 0.1) {
    const t = d * D2R;
    const v = -r * Math.sin(t) - (r * r * Math.sin(2 * t)) / (2 * Math.sqrt(L * L - r * r * Math.sin(t) ** 2));
    if (Math.abs(v) > Math.abs(best.v)) best = { v, angle: d };
  }
  const maxAccel = omega * omega * r * (1 + R); // ~ przy GMP dla lambda < 1
  return { meanPistonSpeed, maxSpeedAngle: best.angle, maxAccel, rodRatio: L / r, R };
}

// Zestaw danych katalogowych do karty na stronie.
export const SPEC = [
  ['Pojemnosc', '3995 cm3', 'Porsche [A][C]'],
  ['Srednica cylindra', '102,0 mm', 'Porsche [A][C]'],
  ['Skok tloka', '81,5 mm', 'Porsche [A][C]'],
  ['Rozstaw cylindrow', '118 mm', 'Porsche [A]'],
  ['Dlugosc korbowodu', '138 mm', 'Porsche [A]'],
  ['Czop glowny', '67 mm', 'Porsche [A][B]'],
  ['Czop korbowodu', '53 mm', 'Porsche [A]'],
  ['Stopien sprezenia', '13,0 : 1', 'Porsche [A][C]'],
  ['Kolejnosc zaplonu', '1-6-2-4-3-5', 'Porsche [A][B]'],
  ['Odciecie', '8000 obr/min', 'Porsche [A][B]'],
  ['Moc', '309 kW (420 PS) przy 7600', 'Porsche [A][B]'],
  ['Moment', '420 Nm przy 5000-6800', 'Porsche [A][B]'],
  ['Zawory', '24 (4 na cylinder)', 'Porsche [A]'],
  ['Walki rozrzadu', '4 (VarioCam, 2 glowice)', 'Porsche [B]'],
  ['Smarowanie', 'zintegrowana sucha miska, miska z tworzywa', 'Porsche [A][B]'],
];
