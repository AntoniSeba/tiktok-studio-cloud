# Modele 3D: pełna lista i API

Wszystkie wersje filmowe leżą w `~/.claude/skills/tiktok-silnik-film/assets/models/` (bez `node_modules`). `new_project.sh` kopiuje wybrane do `model/<nazwa>/` projektu. Źródła (przeglądarki interaktywne Antoniego) są w `/Users/antoni/projekty/`. Jednostki: milimetry. Wszystkie modele mają `lib/materials.js` (`createMaterials()`, zwykle `applyMaterialVariation(root, M)`) i prawie wszystkie `lib/environment.js` (`buildStudioEnvironment(renderer)`; w R5, V6, V8 zwraca obiekt `{env}`, w starszych samą teksturę; sprawdź). W filmie mnożymy `envMapIntensity` materiałów x1,3 i robimy `fixNormals(root)` oraz `castShadow/receiveShadow` na meshach.

Konwencja kamery w filmach: `P(az, el, r, x, y, z, fov, oy)`, pozycja kamery = cel + (cos az · cos el · r, sin el · r, sin az · cos el · r). Tam, gdzie wał leży wzdłuż X: az = π/2 to widok z boku (+Z), az = π to przód (-X), az = 0 tył (+X). W starszych filmach `Pc` mnożył `r` (S54 i R3 x1,5, 2JZ x1,75), bo te silniki są dłuższe; nowe filmy piszą `r` wprost.

## Tabela

| Katalog | Silnik | Źródło | Użyty w filmach | Co pokazuje najlepiej |
|---|---|---|---|---|
| `r5-audi` | Audi 2.2 T R5 20V turbo (3B/ABY/AAN), era Quattro | `projekty/audi-22t-engine` | R5 lepsze od R6 | pięć cylindrów, turbo, intercooler, pasek rozrządu, 20V, przezroczysty odlew |
| `r6-s54` | BMW S54 (M3 E46) rzędowa szóstka, VANOS | `projekty/m50-s54-engine` | R6 najlepszy, downsizing, R5 | długość R6, wał z 12 przeciwwagami, zapłon co 120°, łańcuchy |
| `r6-2jz` | Toyota 2JZ-GTE, twin turbo | `projekty/2jz-engine` | 2JZ 1000 KM | żeliwny blok z zamkniętym pokładem, wał kuty na 7 łożyskach, dysze oleju, turbiny |
| `r3-turbo` | 3-cylindrowy "litr z turbo" (pochodna 2JZ: 3 cylindry, 1-2-3 co 240°, jedna turbina) | film downsizing | Litr z turbo | mały silnik z turbo, kołysanie trzycylindrowca |
| `v6-ohc` | V6 60° z wałkami w głowicach (z filmu V8 kontra V6) | `v8-vs-v6/model/src` (pochodna `projekty/v6-engine`) | V6, V8 kontra V6, panewki v2, downsizing, R6 | przecięty czop wału (split pin), dwa rzędy, łatka na nierówny zapłon |
| `v8-ohc` | V8 90° z wałkami w głowicach, wał krzyżowy | `v8-vs-v6/model/src8` | V8 kontra V6, V8 najlepszy | krzyż wału, 2 korbowody na czop, zapłon co 90° |
| `v8-smallblock` | Chevrolet small block V8, jeden wałek w bloku, popychacze | `projekty/v8-engine` | V8 najlepszy | wałek w bloku, popychacze, dźwigienki, niska zabudowa |
| `wankel` | silnik Wankla, wirnik w trochoidzie | `projekty/wankel-engine` | Wankel | wirnik, uszczelki wierzchołkowe, trzy komory z objętościami |
| `zawieszenie` | zawieszenie na podwójnych wahaczach (narożnik auta) | `projekty/car-suspension` | Zawieszenie | ugięcie, bump steer, amortyzator, stabilizator, półoś |
| `turbo-standalone.js` | turbosprężarka (koło turbiny i sprężarki, obudowy) | film "Jak działa turbo" | 2JZ, downsizing, R6, panewki | dmuchanie, żarzenie turbiny, `buildTurbo()` |
| `panewka-standalone.js` | panewka z klinem olejowym (czop, szczelina) | panewki v2 | 1200 obrotów | klin olejowy, zerwanie filmu olejowego |
| `h6-porsche` | Porsche 4.0 H6 bokser (9A2 evo, 718 GT4), dwa rzędy po 3 w 180° | `projekty/porsche-h6-engine` | H6 najlepszy silnik | płaska sylwetka, tłoki naprzeciw siebie, krótki wał na 7 czopach, przezroczysty kadłub |
| `vendor` | three.js (module + addons) | | wszystkie | |

Jeszcze NIEPRZEROBIONE na film (są tylko przeglądarki): `projekty/v6-engine` (bardzo szczegółowy V6 z localhost:8124, osobne `tiktok.js`, `tiktok-main.js`), pełny `projekty/m50-s54-engine` (M50 i S54). Przerabianie: skopiuj `src/`, napisz `scene.js` z `buildEngine(M)` i `update(deg, opts)` jako czystą funkcję (wzór: `r5-audi/scene.js`), zrób test w node (bbox, NaN w geometrii), sprawdź importy (w `projekty/audi-22t-engine/src/parts/rotating.js` brakowało importu `taperBox`; w kopii skilla dopisany).

## API po kolei

### `r5-audi` (Audi 2.2 T R5)
```js
import { createMaterials, applyMaterialVariation, setCasingGhost } from "../model/r5-audi/lib/materials.js";
import { buildStudioEnvironment } from "../model/r5-audi/lib/environment.js";
import { buildEngine } from "../model/r5-audi/scene.js";
import * as K from "../model/r5-audi/lib/kinematics.js";
const E = buildEngine(M);          // { root, block, head, rotating, turbo, accessories, gases, explode, update }
E.update(deg, { turboDeg, boost: 0.6 });   // explode liczymy sami z E.explode [{obj, rest, delta}]
```
- Osie modelu: X w poprzek (wydech +X), Y w górę, Z wzdłuż wału (+Z przód, cylinder 1 z przodu). W filmie obracamy: `R5H.rotation.y = -π/2` (przód → -X, wydech → +Z), żeby był zgodny z S54.
- `K.CYLINDERS` (id, z: 176/88/0/-88/-176, cycleOffset k·144, journalAngle), `K.SPEC` (bore 81, stroke 86,4, firingOrder [1,2,4,5,3]), `K.LAYOUT` (deckHeight 220, blockLength 464, frontZ 232, pistonCompressionHeight 32,8, crankRadius 43,2), `K.cycleAngle`, `K.pistonPinDistance`, `K.strokeOf`, `K.boostBar`.
- Grupy: `block.groups` {crankcase, cylinderSection, bulkheads, mainCaps, sump, timingCover, filter}; `head.groups` {casting, carrier, cams, valvetrain, covers, intake, exhaust, gasket, bolts}; `rotating` {crank, flywheel, timing, cylinders[{def, piston, rod}]}; `turbo.groups` {chra, comp, turb, plumbing}; `accessories.groups` {exhaust, intake, intercooler, ignition, drive}.
- Nazwy części wału: `Crank_RodJournal_Cyl#`, `Crank_Web_Cyl#`, `Crank_Web2_Cyl#`, `Crank_Counterweight_Cyl#_A/B`, nos wału: dzieci wału z `position.z > 225`.
- Wymiary: bbox ok. 760 x 690 x 600 mm; rozłożony (e=1) ok. 1700 mm wysokości. Cały silnik r 3000 do 3400, rozłożony 0,75 r 5400, rozłożony 1,0 r 6900, sam wał z przodu r 2000, split r 4100 do 5100.

### `r6-s54` (BMW S54)
```js
import { createMaterials, applyMaterialVariation } from "../model/r6-s54/lib/materials.js";
import { buildEngine } from "../model/r6-s54/parts/engine.js";
import * as K from "../model/r6-s54/kinematics.js";
const E = buildEngine(M);   // { root, parts, update, explode }
E.update(K.state(deg), { cut: 0..1, explode: 0..1 });
```
- Wał wzdłuż X, cylinder 1 z przodu (-X), +Z strona dolotu. `K.CYL_X`, `K.DECK`, `K.BORE_R`, `K.BLOCK_LENGTH` (598), `K.HALF_LENGTH`, `K.FIRE_ANGLE`, `K.cyclePhase(cyl, deg)` (0 = zapłon), `K.pistonCrownY(cyl, deg)`.
- `parts`: shellR, shellL (skorupy bloku, `cut` rozsuwa je), center, crank, pistons[6], rods[6], valves, camIn, camEx, chains, groups {blk, head, covers, ind, exhaust, timing, timingCase, anc}. Nazwy: `MainJournal_1..7`, `Web_*`, `Crankpin*`, `VibrationDamper`, `EXHAUST_WRAP`. Materiały bloku `M.ironBlock`, `M.ironBlockDark`.
- `explode`: [{obj, base, dir, name}] z nazwami m.in. headR, headL, coverR, coverL, camIn, camEx, coils.
- Wymiary: długość z rozrządem i kołem ok. 950 mm. Cały r 3400 do 4700.

### `r6-2jz` (Toyota 2JZ-GTE) i `r3-turbo` (3 cylindry)
```js
import { createMaterials, applyMaterialVariation } from "../model/r6-2jz/lib/materials.js";
import { buildEngine } from "../model/r6-2jz/scene.js";
import * as K from "../model/r6-2jz/lib/engine.js";
const E = buildEngine(M);  // { root, parts: { block, rotating, head, induction, timing }, explode, update }
E.update(thetaDeg, { explode: 0..1, turboDeg });   // z turboDeg funkcja czysta
```
- Wał wzdłuż X. `K.CYL_X`, `K.FIRE_ORDER`, `K.firePhaseDeg`, `K.cyclePhase`, `K.pistonCrownY`, `K.boostBar`, `K.SPEC`. Rozkład kaskadowy wbudowany (`at` na grupę), tłoki wyjeżdżają z cylindrów przy e > 0,3.
- `r3-turbo` ma to samo API, `firingOrder [1,2,3]`, zapłon co 240°, `MAIN_X`, `blockXFront/Rear ±170`, jedna turbina `turboX [0]`.
- Wymiary 2JZ: długi (6 cylindrów, ok. 1000 mm z rozrządem). W filmie `Pc` r x1,75 (np. r 3000 → 5250).

### `v6-ohc` i `v8-ohc` (V z wałkami w głowicach)
```js
import { createMaterials, applyMaterialVariation, setCasingGhost } from "../model/v8-ohc/lib/materials.js";
import { buildEngine } from "../model/v8-ohc/scene.js";
import * as L from "../model/v8-ohc/lib/layout.js";
const E = buildEngine(M);  // { root, block, heads, intake, headers, accessories, rotating, explodeGroups, labels, valvetrain, focus, highlight, charge, ring, updateCrank }
E.updateCrank(deg); E.ring.visible = false; E.charge.visible = false;
```
- Wał wzdłuż Z. `L.CYLINDERS` (id, bank "L"/"R", z, cycleOffset, journalAngle), `L.BANK_DIR[bank]` (wektor osi cylindra), `L.Z_SLOTS` (V8), `L.LAYOUT` (deckHeight, pistonHeight), `L.cycleAngle`, `L.pistonPinDistance`, `L.FIRING_ORDER`.
- Nazwy: `Crank_RodJournal_Cyl#`, `Crank_Counterweight_#a/b`, `CAMSHAFT_L/R`, `HEADER_L/R`, `CAM_COVER_*`, `TIMING_COVER`, `PISTONS_AND_RODS`, `MAIN_BEARING_CAPS`, `IntakePlenum`. Każdy cylinder w `rotating.cylinders` ma `piston`, `rod`, `wrap`.
- Rozkład: `explodeGroups` z `userData.explode` + rozrzut "units" (wzór w `reference-films/v8-najlepszy/main.js`, sekcja "jednostki do rozkładania"), wyciąganie jednego cylindra, moneta na kolektorze na wolnych obrotach.
- Wymiary: cały r 2800 do 3500.

### `v8-smallblock` (Chevrolet small block)
```js
import { createMaterials } from "../model/v8-smallblock/lib/materials.js";
import { buildEngine } from "../model/v8-smallblock/scene.js";
const SB = buildEngine(MS);  // { root, labels, box, explodeGroups, rotating, accessories, intake, headers, heads, block, setCrankAngle }
SB.setCrankAngle(deg); SB.rotating.cam.rotation.z = -deg * 0.5 * D2R;
```
- Nazwy: `PUSHRODS`, `LIFTERS`, `VALVE_COVER_L/R`, `RockerArm_*`, `RockerCup_*`; odlewy `MS.castIron`, `MS.castAluminium`, `MS.castAluminiumBright` (przezroczystość robimy ręcznie: opacity 0,28, depthWrite false). Brak `environment.js` (używamy środowiska z innego modelu).
- Wymiary: r 2550 do 2800.

### `h6-porsche` (Porsche 4.0 H6 bokser)
```js
import { createMaterials, applyMaterialVariation } from "../model/h6-porsche/lib/materials.js";
import { buildStudioEnvironment } from "../model/h6-porsche/lib/environment.js";   // zwraca { env, background }
import { buildEngine } from "../model/h6-porsche/scene.js";
import * as KH from "../model/h6-porsche/lib/layout.js";
const E = buildEngine(M);  // { root, block, heads, rotating, intake, exhaust, covers, transmission, explode, update }
E.update(deg);             // wał, tłoki, korbowody, zawory; explode liczymy sami z E.explode [{obj, name, rest, delta}]
```
- Osie: wał wzdłuż Z (+Z przód), bank A (cyl. 1, 2, 3) przy +X, bank B (4, 5, 6) przy -X, Y w górę. W `P(az, ...)`: az = 0 bok od banku A (widać długość), az = π/2 przód (płaska sylwetka), el > 1,2 widok z góry (wtedy `camera.up` ustawiony na przód, wzór w `filmy/h6-najlepszy/film/main.js`).
- `KH.CYLINDERS` (id, bank, bankSign, slot, z, fireAngle), `KH.LAYOUT` (deckHeight 209, pistonCompressionHeight 30,25, bore 102, caseZ 200), `KH.cyclePhase`, `KH.pistonPinDistance`, kolejność 1-6-2-4-3-5 co 120°.
- Grupy po nazwie: `HALF_CASE_A/B`, `HEAD_A/B`, `CAM_COVER_A/B`, `INTAKE_SYSTEM`, `EXHAUST_SYSTEM`, `OIL_SYSTEM`, `THERMAL_MANAGEMENT`, `TIMING_COVER`, `TIMING_DRIVE`, `ACCESSORY_DRIVE`, `FLYWHEEL_ASSEMBLY`; wał `CRANKSHAFT` z `Crank_MainJournal_1..7`, `Crank_RodJournal_Cyl#`; tłoki `E.rotating.recip.cylinders[{def, piston, rod}]`.
- `scene.js` chowa skrzynię biegów, tłumik i rury za katalizatorami. Brak `setCasingGhost`: przezroczysty kadłub robimy klonami materiałów `HALF_CASE_*` i `HEAD_*` (wzór `setGhost` w filmie).
- Wymiary: ok. 916 x 830 x 750 mm. Cały r 3400 do 3900, przód r 3700, sam wał r 2100 do 2200, split r 4600 do 5400.

### `wankel`
```js
import { createMaterials } from "../model/wankel/lib/materials.js";
import { buildRotary } from "../model/wankel/parts/rotary.js";
import * as T from "../model/wankel/lib/trochoid.js";
const rotary = buildRotary(M);  // { root, groups: { frontHousing, rotorHousing, rearHousing, rotor, eshaft, bolts, gasRoot, gases, apexSeals }, update, info }
rotary.update(theta, { gas: true });
```
- `T.rotorPose`, `T.chamberVolumes`, `T.chamberPhase`, `T.SPIN_RATIO` (wirnik 1/3 prędkości wału), `T.STROKES`. Film Wankel był w jednym `index.html` (wzór: `reference-films/wankel/index.html`).

### `zawieszenie`
```js
import { buildSuspension } from "../model/zawieszenie/parts/suspension.js";
import { solveCorner, P, LIMITS } from "../model/zawieszenie/kinematics.js";
const S = buildSuspension(M);  // { root, groups: { chassis, lowerArm, upperArm, knuckle, wheel, rimGroup, damper, arbArm, droplink, tieRod, driveshaft, springGroup, ... }, update, points }
S.update(solveCorner(travelMm, steerDeg), spinDeg);
```
- X na zewnątrz auta, Y w górę, Z do przodu; rozwiązanie z więzów (nie keyframe'y).

### `turbo-standalone.js`
`import { buildTurbo } from "./turbo.js"` → `{ group, setState(angleDeg, heat0..1) }`. Oś wału wzdłuż X, turbina (gorąca) na -X, sprężarka na +X, jednostki ok. 1 (skaluj x78 przy S54). W R5 turbo jest częścią modelu.

## Przydatne wzorce w kodzie filmów

- Dwa silniki: drugi w `SP = (0, -80000, 0)`, `lightAt(base, cam)` przenosi światła.
- Podświetlenie: `glowMats` klonuje materiał, więc klon NIE ma przezroczystości Fresnela: części, które mają znikać w trybie `g`, chowaj (`core`), a nie podświetlaj.
- Czop / przeciwwaga: podmiana materiału na klon z emisją (wzór V8).
- Gaz i żar: `MeshBasicMaterial` addytywny, `depthWrite: false`, walec skalowany od denka tłoka do pokładu.
- Kołysanie: obrót grupy nadrzędnej `R5W.rotation.z`, amplituda max 0,008 rad, płynny sinus.
