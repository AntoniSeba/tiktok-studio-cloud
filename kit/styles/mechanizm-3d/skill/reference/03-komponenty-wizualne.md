# Komponenty wizualne (katalog)

Kod wszystkich komponentów jest w szablonie `assets/template/film/main.js` + `assets/template/index.html` (film R5, najnowszy, po wszystkich poprawkach). Starsze warianty: `assets/reference-films/*`. Kopiuj i przerabiaj, nie pisz od zera.

## 0. Wygląd (tokeny)

| Token | Wartość | Użycie |
|---|---|---|
| `--oil` | `#f5aa3c` | akcent główny, `<em>` w nagłówkach, bęben, pigułka, podświetlenia części (AMBER `0xff8a1c` w 3D) |
| `--heat` / `--hot` | `#e2492b` / `#ff6a4d` | źle, wada, "nie" (`class="hot"`), RED `0xff2a10` w 3D |
| `--ok` | `#86dba1` | dobrze, pasuje (`class="ok"`), GREEN `0x3cff7a` w 3D |
| `--ice` | `#7cc4ff` | zimne, ssanie, drugi rząd V (ICE `0x3aa0ff`) |
| `--fg` / `--fg-2` | `#eef2f7` / `#b6c1cf` | tekst / tekst drugorzędny |
| tło | `#0a0c10`, scena 3D: gradient `#1c232c → #0a0d11` z siatką 90 px | |
| Fonty | Oswald 600 WIELKIE LITERY (nagłówki, etykiety); IBM Plex Mono 600/400 (kickery, liczby, podpisy) | HyperFrames ściąga je sam przy renderze |

Pozycje (kadr 1080x1920, bezpieczny pas y 250 do 1430, poniżej y 1000 x ≤ 850):

| Element | Pozycja |
|---|---|
| kicker (`.kick`) | top 250 do 262, left 70, mono 23 px, rozstrzelony, pomarańczowy, z linią |
| nagłówek górny `#topH` | top ok. 300, 76 px, max 2 linie |
| nagłówek planszy `.ph` | top 300, 80 px |
| bęben `#reelBar` | top 250, right 70 (w trybie dużym przesunięty o (-40, +560) i skala 1,7) |
| etykiety paneli splitu | `#pA` top 300, `#pB` top 872 (110 px + tag statusu 48 px) |
| linia podziału splitu | y 840 (`SEAM`), pigułka na linii |
| chipy / licznik / tarcza | y 1180 do 1300, lewa kolumna |
| karta wyboru | top 1110; karta serii top 1170; karta YouTube top 1100; left 70, szer. 780 |
| cienie | `.shade-top` 600 px, `.shade-bot` 820 px (UWAGA: przykrywają SVG; w splitach z wymiarami na dole zmniejsz `.shade-bot` do 0,15) |

## 1. Hook na podzielonym ekranie (`SPLIT`, `SPLIT_UI.hook`)

- Dwa panele renderowane nożyczkami: panel A `renderer.setScissor(0, H - SEAM, W, SEAM)` (góra 0 do 840), panel B reszta. Każdy panel ma własną kamerę (`camera`, `cameraB`), własny stan (`states(t, name, "A"|"B")`) i własne światło (`lightAt(base, cam)`).
- Drugi silnik stoi 80 m niżej (`SP = (0, -80000, 0)`), żeby nie wchodził w kadr pierwszego.
- Offset widoku `setViewOffset(W, H, 0, oy, W, H)`: dodatnie `oy` podnosi silnik w kadrze. Panel A: oy ok. 390 do 490 (środek silnika ok. y 470 do 560); panel B: oy ok. -120 do -200 (środek ok. y 1110 do 1150).
- Etykiety `#pA`/`#pB` (wielkie słowo + tag statusu ok/hot/oil) i pigułka na linii układają zdanie: "PIĄTKA [R5]" / "LEPSZA OD" / "SZÓSTKI [R6]".
- W hooku etykiety i pigułka widoczne od klatki 0 (pop z czasem -1); w outro wchodzą i na D stoją jak na 0.
- Kicker serii w hooku: "Seria silniki · część N" (`#hkK`, right 470, żeby nie wchodzić pod bęben).

## 2. Górny blok (`TOPS`, `drawTop(t, si)`)

- Lista `[czas, kicker, nagłówek HTML]`, czas = słowo lektora. `<em>` pomarańczowe, `<span class="hot">` czerwone, `<span class="ok">` zielone.
- Wyłączony w: splitach (tam etykiety paneli), ujęciach z dużym bębnem (obietnica, odpowiedź), od karty wyboru do końca.
- Nie może powtarzać tego, co mówi inny element w kadrze (bęben, licznik, tarcza, etykieta).
- Wybiera się z renderowanego ujęcia (`si`), więc przy przenikaniu w planszę gaśnie razem z 3D.

## 3. Bęben obietnicy (`RW`, `BURSTS`, `ANS`, `T_ANS`, `drawEng`)

- Pojawia się na słowie "Na końcu" (ok. 7 do 8 s) DUŻY na środku (bigK), po ok. 1,5 s dokuje w prawym górnym rogu i zostaje do nagrody.
- Słowa na bębnie `RW`: 5 do 6 podpowiedzi z tematu ("? ? ?", "Audi", "Volvo", "Turbo", "Quattro", "RS3").
- `BURSTS`: krótkie zakręcenia (0,7 do 1 s) na początku każdej sekcji ("Pierwszy powód", "Drugi powód"...), ostatnie zakręcenie kończy się dokładnie na słowie odpowiedzi (`T_ANS`) i bęben staje na `ANS`, etykieta zmienia się na "Odpowiedź:", tekst pomarańczowy.
- Rozmycie w trakcie kręcenia `blur(spin*3px)`, bez błysku.
- Przy nagrodzie bęben znów duży: na "A teraz obiecane" i na odpowiedzi; górny blok wtedy wyłączony (dubel).

## 4. Plansze (`.pres`, `.grp`, `drawBoard(t, id)`)

Pełnoekranowe tło z siatką. Nagłówek `.ph` zmieniany krokami na słowach (`stepH(el, t, [[t0, html], ...])`). Każda plansza ma ruch co 1,5 do 2 s. Typy, które już są w kodzie:

| Typ | Id w R5 | Opis |
|---|---|---|
| Rzędy kółek (cylindry) | `gBetween` | R4 / R5 / R6 jako rzędy kółek, wchodzą na słowach, wyróżniony pomarańczowy, reszta przygasa |
| Kolejność zapłonu | `gOrder` | 5 kółek w rzędzie (przód, tył), kółko świeci na słowie cyfry, łuk skoku od poprzedniego |
| Pojemności i paski | `gLitres` | cylindry napełniają się cieczą, wielka liczba "2,5 LITRA", paski długości R4 / R5 / R6 z linią odniesienia |
| Auto z góry, silnik w poprzek | `gTrans` | nadwozie, koła, silnik + skrzynia wjeżdża; mieści się (zielony) albo nachodzi na koła (czerwone pola); półosie i strzałki napędu |
| Wiersze z tagiem | `gRows` | `.rw` z nazwą, podpisem i tagiem (np. "R5"), wiersze i tagi na słowach |
| Oś 720° "kto pcha" | `gOverlap` | suwy pracy jako paski w torach, nawias "180°", zakładki na zielono, krzywa momentu (suma sinusów), czerwone kropki w zerach ("dziury"), kursor, licznik "PCHA: n" |
| Fale wydechu | `gWaves` | tłumione sinusy na impulsach, przerywane linie obrotów, liczby zapłonów na obrót (3-2-3-2) |
| Układ V | `gV10` | dwa rzędy kółek w V, jeden gaśnie, "= R5" |
| Wielki rok + chipy + droga | `gRally` | rok mono 220 px, nagłówek, chipy `.mk`, kręta droga rysowana z autem (kropka po `getPointAtLength`) |
| Góra z serpentynami | `gPikes` | sylwetka góry, droga, auto jedzie w górę, licznik wysokości przy aucie, stempel "Rekord trasy", czas |
| Licznik kilometrów | `gOdo` | 7 cyfr, cyfry znaczące pomarańczowe, auto (taksówka) wjeżdża z boku |
| Wielka liczba + auto | `gVolvo` | licznik do "20+", podpis, kombi wjeżdża |
| Puchary | `gTrophy` | 9 pucharów w siatce 3x3 z rokami, wchodzą po kolei co 0,16 s |
| Wielki licznik | `gRS3` | 0 → 400 z easeIO, podpis, nagłówek; pod spodem karta serii |

Starsze typy (w `reference-films/v8-najlepszy`, `v8-vs-v6`, `downsizing`, `panewki-v2`): lista legend (`gList`), pickup z przyczepą (`gTruck`), obrotomierz F1 (`gTach`), zera sił (`gCall`), cylindry "5 → 6 → 7 litrów" (`gCap`), krzywa momentu (`gTorque`), cytat (`gQuote`), radiowóz i taksówka (`gCops`), Europa z przekreślonym V8 (`gEurope`), porównanie rozmiarów (`gSize`), 100 milionów kafelków (`g100m`), manometr doładowania, wykres testu spalania, paragon, przekrój cylindra ze spalaniem stukowym, pasek w oleju rozpadający się na płatki, panewka z klinem olejowym.

## 5. Stany silnika 3D (`states`, `pose5`, `pose6`)

Wszystko jako czysta funkcja czasu. Pola stanu (R5):

| Pole | Efekt |
|---|---|
| `e` | rozłożenie 0..1, kaskadowo (`stag(e, k)`, części z góry ruszają pierwsze) |
| `g` | przezroczysty odlew (`setCasingGhost(M, g)`, Fresnel: krawędzie widać, ściany prawie znikają) |
| `core` | chowa osprzęt (pokrywy wałków, kolektory, intercooler, turbo, osłona rozrządu, filtr), żeby było widać tłoki |
| `crankOnly` | zostaje sam wał (do gwiazdy wykorbień) |
| `fire` | miękki żar zapłonu nad tłokiem w chwili zapłonu (`softFire`) |
| `pow` | gaz suwu pracy (walec od denka tłoka do głowicy, obwiednia sinusa) |
| `pist`, `pin`, `web`, `exh`, `turb` | podświetlenia: tłoki i korbowody, czopy korbowe, ramiona i przeciwwagi, kolektor wydechowy (czerwony), koło turbiny (czerwony) |
| `rock` | bardzo delikatne kołysanie wzdłużne (0,008 rad) + strzałki na końcach silnika |
| `fire6`, `pow6`, `ex6`, `crank6` | to samo dla drugiego silnika (S54) |

Podświetlenie części: `glowMats(obj, kolor)` klonuje materiały i zwraca listę; `setGlow(mats, k, kolor)` ustawia emisję. Kolory: AMBER (neutralnie ważne), RED (gorące, złe), GREEN (dobre), ICE (zimne, drugi rząd).

## 6. Nakładki rzutowane z 3D (SVG w `#svg`)

- **Numery cylindrów** (`.badge`): kółka nad głowicą w `localPoint(E.root, 0, deck + 260, c.z)`, wchodzą po kolei co 0,1 s.
- **Gwiazda wykorbień** (`drawStar`): ramiona od piasty do kąta czopa (`journalAngle`) w płaszczyźnie przed wałem, numery na końcach, łuk z kątem między dwoma ramionami ("72°"). Kamera z przodu, r ok. 2000, sam wał.
- **Tarcza zapłonu** (`drawDial`): koło, wskazówka = kąt cyklu / 2, znaczniki w kątach zapłonu każdego cylindra, znacznik rośnie i jaśnieje, gdy dany cylinder odpala. Lewy dół (cx 200, cy 1290).
- **Etykiety z linią** (`TAGS`, `drawTags`): tekst w ramce, linia rysowana dashoffsetem do kropki na części, pozycja ograniczona do bezpiecznego pasa.
- **Wymiary** (`drawDims`): linia z ogonkami i podpisem pod silnikiem, rysowana od lewej; w splicie w tej samej skali; brakujący kawałek jako czerwona przerywana.
- **Strzałki kołysania** (`drawRock`): strzałki na obu końcach silnika w przeciwfazie, długość = sin(kąt wału).
- **Kąt między rzędami V** (w `v8-najlepszy`: `arcG`): wycinek koła 90° między rzędami.
- **Krzyż wału V8** (`drawCross` w `v8-najlepszy`).

## 7. Elementy HUD

- **Chipy** (`.chips > .chip`, klasy `ok` / `hot`): pojedyncze słowa na słowach lektora ("Proste", "Wolne", "Nie do zajechania").
- **Licznik** (`#cnt`): wielka liczba mono + podpis. Tylko gdy liczba nie dubluje nagłówka i się nie miga.
- **Stempel** (`.stampX`): obrócony o -7°, ramka 6 px; wejście miękkie: opacity 0 → 1 i skala 1,12 → 1 przez 0,4 s (NIE slam z 1,8). Oszczędnie (1 do 3 na film).
- **Pigułka splitu** (`#splitPill`).

## 8. Karty engagement (`#eng`, `drawEng`)

- **Karta wyboru** `#pickCard`: pytanie "To jak? <em>A</em> czy <em>B</em>?", dwie opcje z krótkim opisem, podświetlana opcja zgodna z tym, o czym mówi lektor, potem naprzemiennie; dymek komentarza "Napisz, co wybierasz" na słowie "Napisz". Stoi na dwóch ujęciach (każdy silnik po kolei), znika przed CTA.
- **Karta serii** `#serCard`: pigułka "Część N", "Który silnik <em>następny?</em>", czerwony przycisk z plusem, "Obserwuj, żeby nie przegapić". W szczycie wartości (zaraz po odpowiedzi), ok. 3,5 s, wjeżdża z lewej o 60 px.
- **Karta YouTube** `#ytCard`: czerwone logo play, "YouTube / pełny film", "V6 rozebrany <em>do ostatniej śruby</em>", "8 min", pomarańczowe "Link w bio". Od "A jeśli chcesz" do "Link w bio", znika tuż przed pętlą.

## 9. B-roll z napisami natywnymi

- `<video class="broll" src="assets/broll/cut/xx.mp4" data-start data-duration data-media-start data-track-index="20" muted playsinline>`, kadrowany do 1080x1920.
- Na B-rollu: nagłówki natywne `.cap` albo stemple (V8: "Przeżytek", "Paliwożerny", "Dinozaur" na słowach).
- Warstwa `#brUi` widoczna tylko w ujęciach `broll`.

## 10. Napisy na środku (opcjonalne)

`.cap` 86 px biały z obrysem, kluczowe słowo `#ffb347`; dane z `film/captions.js` (`tools/make_captions.py`). Domyślnie wyłączone.

## 11. Przejścia

- 3D → 3D: twarde cięcie + osiadanie azymutu.
- 3D ↔ plansza: przenikanie 0,4 s (w `renderAt`: w pierwszych 0,4 s nowego ujęcia renderujemy też poprzednie).
- Bez flash, bez whip pan, bez zoom punch.
