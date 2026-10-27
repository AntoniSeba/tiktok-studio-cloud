# Standard kanału Antoniego: wszystkie ustalenia

Polski kanał motoryzacyjny, pionowe shorty 1080x1920 na TikToka (i YT Shorts), około 2,5 do 3 minut, silniki pokazywane na dopracowanych modelach 3D (three.js w HyperFrames). Poniżej KAŻDA zasada, jaką Antoni ustalił w rozmowach, z powodem. Nie ma tu nic "opcjonalnego": każdy punkt wynika z konkretnej uwagi albo z wyników filmów.

## A. Checklista Antoniego (10 punktów, sprawdzana przed każdym oddaniem)

Antoni wkleił ją 2026-09-25 i napisał "pamiętaj to":

1. **Poprawione napisy.** Zero literówek, poprawna polszczyzna, poprawne nazwy (Röhrl, Quattro, TFSI, RS3). Jeśli coś jest na ekranie, ma być idealne.
2. **Transkrypcja słowo w słowo, idealny match.** Każde wejście grafiki, cyfry, nagłówka, podświetlenia wypada na dokładnym słowie lektora (czas z `assets/transcript.json`, nie "na oko").
3. **Akcja od pierwszej setnej sekundy.** Klatka 0 jest już w ruchu (silnik w połowie rozerwany i płynnie się składa, wał się kręci, kamera jedzie), nagłówek stoi od klatki 0. Żadnego spokojnego ujazdu na starcie.
4. **Martwe strefy TikToka.** Treść tylko w pasie y 250 do 1430; poniżej y 1000 wszystko w kolumnie x ≤ 850 (prawa szyna z sercem i komentarzami).
5. **Efekt kasyna.** Widz nie wie, co przyjdzie za chwilę, ale wszystko jest intuicyjne. Zero powtarzalnego rytmu.
6. **Dynamika co 2 do 3 sekund.** Coś się zmienia: cięcie, nowy nagłówek, nowy element planszy, ruch modelu.
7. **Zapętlenie.** Ostatnia klatka = pierwsza; ostatnie słowa lektora wpadają w pierwsze zdanie hooka.
8. **Satysfakcjonujące, dopracowane animacje, żadnego uciętego kadru.** Model i każdy napis w całości w kadrze, nic nie wystaje poza ekran ani pod interfejs.
9. **Końcówka urwana, BEZ podsumowania.** Cytat: "końcówka z podsumowaniem jest słaba", "powiedziałem ci, że koniec ma być, jakby był ucięty, to podsumowanie, widać taki spike wychodzeń". Po CTA do YouTube film się urywa i wpada w hook.
10. **Engagement.** Obietnica po hooku, pytanie z wyborem do komentarzy, karta serii z obserwuj, na końcu CTA do filmu na YouTube z linkiem w bio.

Plus tematy: **kontrowersyjne, zaczynane jasnym stwierdzeniem w pierwszym zdaniu**, film około 3 minut (w praktyce 2:20 do 2:50 po wycięciu ciszy), z CTA do YT na końcu.

## B. Format (ustalony po filmie o niskich obrotach, 2026-09-21)

1. Przejście co 2 do 3 sekund, żadne ujęcie nie stoi dłużej bez zmiany w kadrze.
2. B-roll (prawdziwy materiał) tam, gdzie treść mówi o świecie (autostrada, kasa, warsztat), napisy natywne na B-rollu.
3. Animacje 3D ekstremalnie dopracowane: to wyróżnik kanału, nie ozdobnik.
4. Mocny hook: jasne, kontrowersyjne stwierdzenie, często w drugiej osobie albo z oskarżeniem ("A ty w nie uwierzyłeś").
5. Treść informacyjna, ale wciągająca: mechanizm, liczby, nie ogólniki.
6. Wycięta KAŻDA cisza w lektorze.

## C. Hook

- **Wygrywa hook zaprojektowany**: plansza z danymi albo grafika na ruchu, nagłówek, liczby, werdykt dosłownie ze słów lektora. Wyniki: oryginał "1200 obrotów" (kicker "Sytuacja, którą znasz", licznik 2700 → 1200, chipy 5 BIEG / GAZ DO DECHY / POD GÓRKĘ, werdykt "PŁACISZ ZA TO PANEWKAMI") poszedł najlepiej; wersja z samym surowym B-rollem gorzej; wersja V6 otwierająca statycznym modelem 3D najgorzej.
- Hook na modelu 3D wolno tylko, gdy od pierwszej setnej sekundy jest głos i ruch (silnik się rozkłada albo składa, kamera jedzie) i na ekranie stoi nagłówek.
- Najlepiej działał hook na podzielonym ekranie (walka dwóch silników): V8 kontra V6, R5 kontra R6. Etykiety paneli układają się w zdanie hooka, np. "PIĄTKA [R5]" / pigułka "LEPSZA OD" / "SZÓSTKI [R6]".
- Werdykt i nagłówek zawsze dosłownie pokrywają się ze zdaniem lektora, nie parafrazują.
- Stara zasada "zero grafiki w pierwszych 5 s" jest NIEAKTUALNA (nadpisana przez hook zaprojektowany).

## D. Smooth, bez fleszy (najważniejsza zasada ruchu)

Cytaty: "te flashe i momenty, gdzie model cały bouncuje, są mega słabe i dodają mi kortyzolu, to ma być dynamiczne, ale nie na siłę, ma być smooth przede wszystkim" (film downsizing). Przy R5: "ani smooth, ani satisfying, za to jest kurwa drażniące", "podwójna ta sama animacja to gówno totalne", "jak jest zbliżenie na 3D i potem oddalenie i znowu zbliżenie".

NIE WOLNO:
- białych i kolorowych błysków (flashy) na cięciach, słowach, zapłonach;
- szarpnięć kamery na słowach (beat shake), trzęsienia i podskakiwania modelu;
- sprężystych wejść z przestrzeleniem (backOut), stempli wbijanych ze skali 1,8;
- **pompowania kamery**: ujęcie zaczyna się dalej i dojeżdża, cięcie, znowu dalej i dojazd. W obrębie ujęcia kamera trzyma STAŁĄ odległość i stałe fov, tylko krąży (azymut, elewacja);
- **dublowania tej samej animacji**: dwa kolejne ujęcia z tym samym ruchem (dwa ujęcia rozłożonego silnika, dwa ujęcia zapłonu w przezroczystym bloku, dwa ujęcia strzałek kołysania) scalamy w JEDNO ujęcie z ciągłą orbitą albo jedno zamieniamy na coś innego;
- **dublowania informacji**: jedna rzecz pokazana raz. Nie: nagłówek u góry "9 razy z rzędu" + licznik "9× z rzędu"; nie: nagłówek "Na końcu zobaczysz" + bęben "Na końcu:"; nie: cyfry 1-2-4-5-3 nad cylindrami i te same cyfry na dole; nie: napis "144°" w nagłówku i w podpisie tarczy;
- stroboskopu zapłonów (kule, które mrugają co 0,4 s);
- migających liczników (np. "tłoki pchają teraz: 1, 2, 1, 2");
- skoków prędkości wału przy cięciach;
- twardego przeskoku 3D ↔ plansza.

ROBIMY:
- dynamika z płynnego ruchu: ciągła orbita kamery, miękkie wejścia grafik (ease out, przesunięcie 18 do 30 px zamiast skoku skali), płynne rozkładanie i składanie modelu;
- po cięciu miękkie "osiadanie" kamery tylko w azymucie (0,07 rad przez 1,1 s), bez zmiany odległości;
- zapłon jako żar: narasta przez ok. 30° wału i gaśnie przez 150°, bez zmiany skali, krycie max ok. 0,45;
- gaz suwu pracy z obwiednią sinusa (wchodzi i gaśnie płynnie);
- wał kręci się CAŁY film tym samym, spokojnym tempem (ok. 130°/s), a czas filmu mieści całkowitą liczbę cykli 720° (pętla);
- plansza i 3D przenikają się przez 0,4 s.

## E. Zasada kasyna

- Każdy kadr nieprzewidywalny, ale intuicyjny. Nie powtarzać: tej samej długości ujęć, tego samego typu przejścia, tej samej kolejności model → plansza → B-roll.
- Jeśli lektor opowiada coś, co widać na modelu, zostajemy na modelu i robimy to na nim (rozłożenie, przekrój, podświetlenie, gwiazda wykorbień), a nie przełączamy na siłę na infografikę.
- Otwieramy pętle (pytanie "Więc czemu...?", zapowiedź "Na końcu zobaczysz") i zamykamy je później.
- Kamera zmieniana jak metronom co 2 s (film "dwójka") była krytykowana: długości ujęć mieszamy, od 1,3 s do 5,5 s, a planszę można trzymać dłużej (5 do 9 s), jeśli co 1,5 do 2 s coś się na niej dzieje.

## F. Pętla

- Wizualnie: ostatnia klatka = pierwsza (ta sama kamera, ten sam stan modelu, ten sam nagłówek i etykiety). Mierzymy: różnica t=0 vs t=D ma być wielokrotnie mniejsza niż między dwiema sąsiednimi klatkami (R5: 0,14 wobec 3,0).
- Skryptowo: ostatnie słowa wpadają w pierwsze zdanie ("Więc powtórzę." → "Rzędowa piątka jest lepsza od rzędowej szóstki.").
- Audio: bez wyciszenia na końcu, bez oddechu przed pierwszym słowem.
- Powód: replay to jeden z najmocniejszych sygnałów TikToka.

## G. Engagement i CTA

1. Nigdy transakcyjnie ("napisz TAK, a..." to engagement bait, TikTok tnie zasięg).
2. Po hooku (3 do 10 s) OBIETNICA zamiast "obserwuj": bęben "Na końcu:" z zakrytą odpowiedzią, który kręci się w trakcie filmu i staje na odpowiedzi przy nagrodzie.
3. Komentarze: pytanie-wybór z dwóch opcji, na które da się odpowiedzieć dopiero po obejrzeniu ("Piątka czy szóstka?"), karta wyboru zaraz po momencie "aha" (ok. 88 do 94 procent filmu).
4. Obserwacja: karta serii ("Część N", "Który silnik następny?", przycisk obserwuj) w szczycie wartości, tuż po nagrodzie (ok. 85 do 90 procent).
5. Na końcu CTA do filmu na YouTube, głosem i kartą: "A jeśli chcesz zobaczyć, jak prawdziwy silnik wygląda w środku, rozebrany do ostatniej śruby, osiem minut o V6 masz na moim YouTubie. Link w bio." Karta YouTube (logo, "V6 rozebrany do ostatniej śruby", "8 min", "Link w bio") stoi do samego końca CTA.
6. Zaraz po CTA 1 do 2 słów pętli i urwanie w hook. Żadnego podsumowania.
7. Poza filmem: to samo pytanie w opisie i jako przypięty komentarz.

## H. Napisy

- Od filmu V8 (2026-09-25): "tym razem bez tych napisów na środku". DOMYŚLNIE BEZ napisów na środku ekranu. Przy każdym oddaniu zaproponuj jednym zdaniem, że można je dodać.
- Jeśli Antoni poprosi o napisy: słowo w słowo, max 3 słowa naraz, max 17 znaków, kluczowe słowo na pomarańczowo, `tools/make_captions.py`, w podzielonym ekranie przesunięte nad linię podziału.
- Tekst na ekranie (nagłówki, etykiety) to nie są napisy: te zawsze są, krótkie (2 do 5 słów), wielkie litery, dosłownie ze słów lektora.

## I. Dźwięk

- Efekty dźwiękowe dodaję TYLKO po zaakceptowaniu tabeli przez Antoniego (moment, co na ekranie, dźwięk, dlaczego). Każdy dźwięk ma widoczną przyczynę. Szczegóły: `07-dzwiek.md`.
- Audio w MP4: szczyt ok. -3,5 dBFS (nie -1,3, bo niektóre kodeki przesterowują).

## J. Współpraca i procedury

- **Nigdy nie renderuj MP4 bez wyraźnego polecenia** ("wygeneruj mp4", "renderuj"). Po zmianach otwórz Studio (web editor) i daj link.
- **Nie wycinaj niczego z nagrania bez pytania** (raz wyciąłem zamierzone "Byczku"). Wyjątek: podsumowanie na końcu, które ma być wycięte zawsze (zasada 9); jeśli lektor je nagrał, wytnij i powiedz o tym.
- Nie zakładaj kont, nie loguj się za Antoniego.
- Nie zabijaj procesów, których nie uruchomiłeś.
- Zawsze pełne ścieżki bezwzględne w odpowiedziach (Antoni wkleja je do Findera).
- Nigdy półpauz ani pauz (znaki U+2014 i U+2013) w żadnym tekście; na koniec grep na plikach, wynik 0.
- Bez emoji.
- Raporty krótko, po polsku, bez żargonu.

## K. Historia: co zadziałało, co nie

| Film | Wynik / uwaga Antoniego | Lekcja |
|---|---|---|
| Klin olejowy (pierwszy) | HUD na `bottom:132px`, schowany pod opisem TikToka | pilnuj stref od początku |
| 1200 obrotów, panewki (oryginał) | najlepsze wyniki | hook zaprojektowany z danymi |
| Ta sama bez grafiki w hooku | gorzej | nie zostawiaj hooka "gołego" |
| V6 (hook statyczny 3D) | najgorzej | 3D w hooku tylko z ruchem i głosem od 0 |
| "Dwójka" | kamera co 2 s jak metronom | mieszaj długości |
| SFX syntetyczne (klin) | "tragedia totalna" | dźwięk tylko z przyczyną, z tabelą |
| V8 kontra V6 | "podoba mi się, jak wyszedł ten filmik" | wzorzec wizualiów (split, bęben, liczniki, karty) |
| 2JZ | "AKCJA OD PIERWSZEJ KLATKI, za mało dynamiki" | klatka 0 w ruchu |
| Downsizing | flesze i podskoki "dodają kortyzolu"; podsumowanie = skok wyjść | smooth, urwany koniec |
| V8 najlepszy | bez napisów na środku, OK, wyrenderowany | domyślnie bez napisów |
| R5 kontra R6 (szkic) | "drażniące": pompowanie zoomu, dublowane animacje, strobo zapłonów, migający licznik | reguły z sekcji D |

## L. B-roll i gęstość ujęć (2026-09-28, film PureTech)

Cytat: "regularnie zapominasz o brollu i za mało ujęć dajesz, np. 3 ujęcia na ten sam model z rzędu, ja ci to już mówiłem; na hooku ma być znacznie bardziej dynamicznie".
- B-roll w KAŻDYM filmie, także w hooku: prawdziwy materiał wszędzie, gdzie lektor mówi o świecie (warsztat, auto, dym, kasa, droga), kilka razy w filmie.
- Nigdy więcej niż 2 ujęcia 3D tego samego modelu pod rząd; potem plansza albo B-roll.
- Hook (0 do ok. 7 s): cięcie co ok. 1 do 1,5 s, mieszanka 3D, B-roll i grafiki. Reszta: ujęcia 1,3 do 3 s.
- Dynamika z cięć i treści, nadal bez fleszy i trzęsienia.
- WYJĄTEK OD "SMOOTH" W HOOKU (Antoni 2026-09-28): w pierwszych ok. 7 s używamy efektów z hooka 2JZ (`filmy/nowy-2jz/film/main.js`): krótki biały błysk `#flash` na 2 do 3 mocnych słowach (0,14 do 0,18 s, krycie ok. 0,5), cięcie wpada z odjazdu i skrętu (r x1,22, az ±0,16 przez 0,5 s), na mocnym słowie najazd (r x0,93) i drgnięcie 0,4 s, zapłon jako ostry błysk, silnik składa się w 0,55 s, słowa hooka zapalają się na słowach lektora, kluczowe słowo z akcentem skali, chipy z backOut. Wzór w `filmy/puretech-debil/film/main.js` (HOOK_END, BEATS, FLASHES). Po hooku reszta filmu smooth.

## M. Reklama z TikTok Shop w filmie (2026-09-28, PureTech)

- Produkt pokazany w użyciu: B-roll albo plansza (gniazdo OBD pod kierownicą, skaner wjeżdża w gniazdo, telefon z błędem i parametrami), napisy dosłownie ze słów lektora.
- Na "w koszyku, na dole filmu": karta produktu (ikona, nazwa, jedna linia) i strzałka w dół po lewej, koniec strzałki max y ok. 1400 (tam TikTok pokazuje kotwicę produktu).
- Wzór: `filmy/puretech-debil` (plansze `gScan`, `gCart`).
- Przed produkcją sprawdź w transkrypcji, że reklama jest w nagraniu lektora.
