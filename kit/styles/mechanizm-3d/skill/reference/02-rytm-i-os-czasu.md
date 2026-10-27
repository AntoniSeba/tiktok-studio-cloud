# Rytm i oś czasu

## Liczby, które trzymamy

| Parametr | Wartość |
|---|---|
| Długość po wycięciu ciszy | 140 do 175 s (cel ok. 2:30 do 2:50) |
| Tempo lektora (Adam, ElevenLabs, po cięciu ciszy) | 2,35 do 2,55 słowa na sekundę: 424 słowa = 166 s, 408 = 173 s, 372 = 147 s |
| Liczba ujęć | ok. 45 do 50 na 160 s (średnio 3,3 s) |
| Ujęcie 3D | 1,3 do 5,5 s; ujęcie dłuższe niż 3,5 s ma zmianę w środku (nowy nagłówek, podświetlenie, rozłożenie) |
| Plansza | 2,3 do 9 s; co 1,5 do 2 s nowy krok (nagłówek, wiersz, krzywa, licznik) |
| Zmiana w kadrze | co 2 do 3 s, zawsze na słowie lektora |
| Przenikanie 3D ↔ plansza | 0,4 s (easeIO) |
| Osiadanie kamery po cięciu | azymut ±0,07 rad przez 1,1 s, odległość stała |
| Orbita w ujęciu | azymut zmienia się o 0,2 do 0,5 rad na ujęcie; długie scalone ujęcie do 1,7 rad |
| Wejście tekstu | easeOut 0,35 do 0,4 s, przesunięcie w pionie 18 do 30 px |
| Prędkość wału | stała ok. 130°/s przez cały film: `RATE = 720 * round(D*130/720) / D` |
| Turbina | `TB = 360 * round(2D) / D` stopni na sekundę (pełne obroty w czasie D) |
| Klatka 0 | silnik rozerwany ok. 0,3 i składający się przez 1,6 s (easeOut), nagłówek już stoi |
| Outro | ostatnie 1,2 do 1,5 s: powrót do stanu z klatki 0 (easeIO), etykiety hooka wchodzą z powrotem |

## Szkielet osi czasu (proporcje na film ok. 166 s)

| Część | Czas (przykład R5) | Procent | Co na ekranie |
|---|---|---|---|
| Hook: jasne kontrowersyjne stwierdzenie | 0 do 3,1 | 0 do 2 | podzielony ekran dwóch silników albo plansza z danymi na ruchu; kicker serii; etykiety układają zdanie |
| Wyprzedzenie zarzutu / callback | 3,1 do 7,3 | 2 do 4 | jedno scalone ujęcie z ciągłą orbitą (np. R6 z poprzedniego odcinka), nagłówek u góry |
| Obietnica | 7,3 do 13 | 4 do 8 | bęben "Na końcu:" duży na środku, silnik rozłożony; potem bęben dokuje w prawym górnym rogu; silnik się składa |
| Kontra + otwarta pętla | 13 do 24 | 8 do 14 | ujęcie 3D z nagłówkiem "Tylko że..." i zmianą nagłówka na słowie; plansza porównawcza; ujęcie bohatera z "Więc czemu...?" |
| Czym jest (budowa) | 24 do 35,5 | 14 do 21 | przezroczysty blok z numerami cylindrów, wał sam z gwiazdą wykorbień, tarcza zapłonu, plansza kolejności |
| Powód 1 | 35,5 do 59 | 21 do 36 | krótkie 3D "Powód 1 / Temat" (1,5 s), potem porównanie (split), plansze |
| Powód 2 | 59 do 80 | 36 do 48 | 3D "Powód 2", plansza (może być w dwóch częściach z 3D pomiędzy) |
| Powód 3, 4, 5 | 80 do 120 | 48 do 72 | każdy: 3D otwierające 1,3 do 1,8 s + 1 do 2 plansz, różnych typów |
| Uczciwie (wada) + riposta | 120 do 134,5 | 72 do 81 | split (np. "R6 wyważona / R5 nie do końca"), ujęcie ze strzałkami, plansza riposty |
| Nagroda ("A teraz obiecane") | 134,5 do 152 | 81 do 91 | bęben znów duży, staje na odpowiedzi; plansze z odpowiedzią (puchary, licznik KM); karta serii w szczycie |
| Pytanie-wybór | 152 do 156 | 91 do 94 | karta wyboru na dwóch ujęciach (każdy silnik po kolei) |
| CTA YouTube | 156 do 164,7 | 94 do 99 | JEDNO scalone ujęcie: silnik rozkłada się do ostatniej śruby (0 → 1), karta YouTube |
| Pętla | 164,7 do D | 99 do 100 | 1 do 2 słowa ("Więc powtórzę."), powrót do stanu z klatki 0 |

## Reguły cięcia

1. Każde cięcie na konkretnym słowie (czas `start` z transkrypcji). Nowe ujęcie zaczyna się na pierwszym słowie zdania albo na słowie kluczowym ("Pierwszy powód", "Volvo", "W piątce").
2. Dwa kolejne ujęcia 3D muszą się różnić CZYMŚ istotnym (stan modelu: złożony / rozłożony / przezroczysty / sam wał; albo inny silnik; albo inna strona). Sama inna kamera na tym samym stanie = dublowanie → scal.
3. Nie więcej niż 2 plansze pod rząd; NIE WIĘCEJ NIŻ 2 ujęcia 3D pod rząd bez planszy albo B-rolla (bez wyjątków, uwaga Antoniego 2026-09-28). W każdym filmie kilka B-rolli, jeden w hooku.
4. Plansza po 3D i 3D po planszy przenikają się (0,4 s); cięcia 3D → 3D są twarde, ale z miękkim osiadaniem azymutu.
5. Otwierające ujęcie każdego "Powodu" jest krótkie (1,3 do 1,8 s): "Powód N" + temat jednym słowem.
6. Ujęcie z bardzo dużą zmianą skali (zbliżenie na turbinę po ujęciu całego silnika) jest OK przy cięciu, ale w obrębie ujęcia skala stała.

## Prędkość, pętla, czas

- `D` = długość `assets/vo.mp3` (ffprobe), np. 166.18. `data-duration` roota i audio = D.
- Wał: stała prędkość, domknięcie do wielokrotności 720° w D. Nie robić "odcinków prędkości" (skoki przy cięciach były drażniące). Jeśli coś musi się zgadzać ze słowem (np. kolejność zapłonu), zrób to planszą albo podświetleniem na słowie, nie zmianą prędkości wału.
- Kamera na klatce 0 i na klatce D ta sama (outro kończy się kluczem P0, a klucz za D, `D+1`, ma nachylenie zgodne z początkiem hooka).
- Stan modelu na klatce 0 = na D (explode, podświetlenia, etykiety, pigułka).

## Przykład: pełna lista ujęć filmu R5 (166,18 s, po poprawkach)

```
[0, 3.11, 3d, hook]            split: R5 u góry (e 0.3 → 0), S54 na dole, "PIĄTKA [R5] / LEPSZA OD / SZÓSTKI [R6]"
[3.11, 7.27, 3d, mem]          S54, jedna orbita az 2.6 → 1.72, nagłówki "Sam mówiłem" / "R6 to najlepszy silnik na świecie"
[7.27, 9.08, 3d, promise]      R5 rozłożony 0.75, bęben duży na środku (nagłówek wyłączony)
[9.08, 12.99, 3d, promise2]    R5 składa się 0.75 → 0, nagłówek "9 razy z rzędu", potem "Silnik roku"
[12.99, 17.32, 3d, kontra]     jedna orbita, "Prawie nikt nie robi piątek" → "Że to..." → "To dziwoląg"
[17.32, 20.27, board, gBetween]  kółka R4 / R6 / R5 na słowach "czwórka", "szóstka", "pomiędzy"
[20.27, 23.99, 3d, hero]       "Kto ją zna," → "Nie chce innej"
[23.99, 26.32, 3d, anatomy]    przezroczysty blok, numery 1 do 5 nad cylindrami, tłoki podświetlone
[26.32, 29.76, 3d, crank]      sam wał z przodu, gwiazda 5 ramion co 72°, łuk "72°"
[29.76, 32.02, 3d, fire]       przezroczysty blok z góry, żar zapłonów, tarcza 720°
[32.02, 35.55, board, gOrder]  5 cylindrów w rzędzie, świecą na słowach "jeden, dwa, cztery, pięć, trzy", łuki skoków
[35.55, 37.2, 3d, len0]        "Powód 1 / Długość"
[37.2, 40.99, 3d, lenR6]       S54 z boku, wymiar "6 cylindrów" na słowie "długa"
[40.99, 44.59, 3d, lenSplit]   split w tej samej skali, wymiary "R6 · 6 cylindrów" / "R5 · 5 cylindrów", pigułka "Krótsza o cylinder"
[44.59, 49.66, board, gLitres] 5 cylindrów napełnia się po 0,5 l, "2,5 LITRA", paski R4 / R5 / R6
[49.66, 53.35, board, gTrans]  auto z góry: R5 + skrzynia wjeżdża w poprzek i mieści się, półosie, "napęd na przód"
[53.35, 59.03, board, gRows]   wiersze Volvo / Ford Focus RS z tagiem R5
[59.03, 60.6, 3d, moment0]     "Powód 2 / Moment", gaz suwu pracy
[60.6, 69.79, board, gOverlap] oś 720°: suwy R4, nawias 180°, krzywa momentu z czerwonymi "dziurami"
[69.79, 72.86, 3d, pow5]       "W piątce / Zapłon co 144°", przezroczysty blok z gazem
[72.86, 79.95, board, gOverlap] dochodzi R5 (zakładki na zielono), potem R6, krzywe momentu
[79.95, 81.23, 3d, sound3d]    "Powód 3 / Dźwięk", kolektor wydechowy żarzy się, etykieta "Wydech"
[81.23, 86.97, board, gWaves]  fale wydechu: R4 2-2-2-2, R5 3-2-3-2 zapłony na obrót
[86.97, 90.75, board, gV10]    V10 jako dwa rzędy, lewy gaśnie, "= R5", "pół V10"
[90.75, 92.46, 3d, turbo]      "Powód 4 / Wyścigi", turbina, etykieta "Turbo"
[92.46, 96.31, board, gRally]  "80.", "Audi Quattro", chipy, droga rajdowa rysuje się z autem
[96.31, 99.33, 3d, rally3d]    silnik rozkłada się do 0.45, "Rozniosło rajdy" → "Sport Quattro"
[99.33, 105.23, board, gPikes] "1987", "Walter Röhrl", serpentyny, licznik wysokości, stempel "Rekord trasy", "10:47"
[105.23, 106.99, 3d, trwal]    "Powód 5 / Trwałość", przezroczysty blok, wał podświetlony
[106.99, 111.99, board, gOdo]  licznik km do 1 000 000, taksówka wjeżdża
[111.99, 114.32, 3d, simple]   chipy "Proste", "Wolne", "Nie do zajechania" na słowach
[114.32, 119.99, board, gVolvo] "20+ lat", kombi wjeżdża, "Jeżdżą do dziś"
[119.99, 123.86, 3d, balance]  split: "R6 wyważona" / "R5 nie do końca", strzałki kołysania
[123.86, 129.35, 3d, rock]     jedna orbita, strzałki kołysania, "Lekkie kołysanie" → "Wzdłuż silnika" → "Szorstkie"
[129.35, 134.51, board, gTrans] R6 w poprzek się nie mieści (czerwone koła), R5 tak
[134.51, 136.04, 3d, promised] bęben duży, "A teraz obiecane" mówi lektor (nagłówek wyłączony)
[136.04, 138.35, 3d, tfsi]     bęben staje na "Audi 2.5 TFSI" (nagłówek wyłączony)
[138.35, 144.99, board, gTrophy] 9 pucharów 2010 do 2018
[144.99, 149.1, board, gRS3]   licznik 0 → 400 KM, "Siedzi w poprzek", karta serii "Część 6"
[149.1, 152.11, 3d, final]     split "R6 nie zrobi" / "R5 400 KM", pigułka "W kompakcie"
[152.11, 153.02, 3d, pickA]    R5 + karta wyboru "To jak? Piątka czy szóstka?"
[153.02, 155.92, 3d, pickB]    S54 + karta wyboru, ikona komentarza na "Napisz"
[155.92, 164.67, 3d, yt]       jedna orbita, R5 rozkłada się 0 → 1, karta YouTube
[164.67, D, 3d, outro]         powrót do stanu hooka
```
