# Kompozycja kanału o silnikach, na dowolny temat

To jest kompozycja kanału Antoniego o silnikach (49 filmów, 5,4 mln wyświetleń), przeniesiona na INNY temat. Kopiujesz układ kadru, rytm, typy plansz, bęben obietnicy, karty i zasady ruchu. Temat, obiekty i treść są nowe. Wzorzec: `$KIT/styles/kompozycja-silnikow/wzor.jpg`.

Pełne źródła (czytaj w tej kolejności):
1. `$KIT/styles/mechanizm-3d/skill/reference/02-rytm-i-os-czasu.md` (liczby, szkielet osi czasu, reguły cięcia, przykładowa lista ujęć)
2. `$KIT/styles/mechanizm-3d/skill/reference/03-komponenty-wizualne.md` (tokeny, pozycje, katalog plansz, bęben, karty)
3. Kod do kopiowania i przerabiania: `$KIT/styles/mechanizm-3d/skill/assets/template/index.html` i `.../template/film/main.js` (film R5). Bierz z niego CSS, bęben, górny blok, plansze, karty, przenikanie i osiadanie kamery. Silnik 3D zastąp obiektem Twojego tematu.

## Wygląd (bez zmian względem kanału)
- Tło `#0a0c10`, scena: gradient `#1c232c` do `#0a0d11` z subtelną siatką 90 px. Akcent `#f5aa3c` (słowo kluczowe w nagłówku w `<em>`), zło/wada `#ff6a4d`, dobrze `#86dba1`, chłód `#7cc4ff`, tekst `#eef2f7` / `#b6c1cf`.
- Fonty: Oswald 600 WIELKIE LITERY (nagłówki, etykiety), IBM Plex Mono (kickery, liczby, podpisy). Oba mają polskie znaki.
- Kicker: mono 23 px, rozstrzelony, pomarańczowy, z linią, top 250, left 70 (np. "SERIA TECHNIKA · CZĘŚĆ 1", "POWÓD 2", "UCZCIWIE").
- Nagłówek górny: top ok. 300, 76 px, max 2 linie, dokładnie słowa lektora (nie parafraza), zmieniany na słowach.
- Bęben "NA KOŃCU: ???" w prawym górnym rogu (top 250, right 70) od obietnicy do nagrody.
- Środek kadru (y ok. 450 do 1000): bohater sceny. W kanale to model 3D silnika, u Ciebie obiekt tematu: model three.js zbudowany z prymitywów (jak w szablonie: orbita kamery, przezroczysty "ghost", rozłożenie na części, podświetlenie części kolorem akcentu) albo cienkoliniowy schemat SVG w stylu plansz.
- Dół (y 1180 do 1300, lewa kolumna): chipy, licznik, tarcza, karty. Martwe strefy jak w Biblii.
- Napisy słowo po słowie na środku są w kanale WYŁĄCZONE: tekst niesie nagłówek górny, etykiety, chipy i plansze. Jeśli dajesz napisy z caps.json, to małe, dyskretne, w kolumnie x do 850, poniżej bohatera.

## Rytm i struktura (film ok. 2:30 do 3:00)
Hook (jasne, kontrowersyjne stwierdzenie, często split dwóch rzeczy z etykietami układającymi zdanie) → wyprzedzenie zarzutu → OBIETNICA z bębnem ("Na końcu zobaczysz...", bęben duży na środku, potem dokuje w rogu) → kontra i otwarta pętla ("Tylko że...", "Więc czemu...?") → czym to jest (budowa) → Powód 1..5 (każdy: krótkie ujęcie otwierające "Powód N / temat" 1,3 do 1,8 s, potem 1 do 2 plansz różnych typów) → Uczciwie: wada + riposta → NAGRODA ("A teraz obiecane", bęben znów duży i staje na odpowiedzi) → karta serii w szczycie → pytanie-wybór (karta wyboru A czy B) → CTA (karta, wplecione) → pętla (ostatnie słowa wpadają w hook, stan kadru jak w klatce 0).
- Ujęć ok. 45 do 50 na 160 s, długości mieszane 1,3 do 5,5 s; plansza do 9 s, ale co 1,5 do 2 s nowy krok.
- Każde cięcie na słowie lektora (czasy z words.json). Najwyżej 2 plansze pod rząd i najwyżej 2 ujęcia bohatera pod rząd.
- Plansza ↔ scena: przenikanie 0,4 s. Scena → scena: twarde cięcie z miękkim osiadaniem kamery w azymucie.

## Ruch: smooth, bez fleszy (najważniejsze)
- NIE: błyski na cięciach, szarpnięcia kamery, podskakiwanie obiektu, sprężyste wejścia (backOut), stemple ze skali 1,8, pompowanie kamery (dojazd, cięcie, znów dojazd), dwa ujęcia z tym samym ruchem, ta sama informacja dwa razy w kadrze, migające liczniki.
- TAK: ciągła orbita kamery w ujęciu (stała odległość i fov), miękkie wejścia tekstu (easeOut 0,35 do 0,4 s, przesunięcie 18 do 30 px), płynne rozkładanie i składanie, żar zamiast błysku.

## Lektor
- Ton jak w kanale: pewny siebie, trochę zaczepny, szybki, mówi do widza w drugiej osobie. Długie zdania tnij na krótkie.
- Znaczniki Gemini oszczędnie (patrz sekcja lektora w ZADANIE.md): krótka pauza przed puentą i przed odpowiedzią z bębna, akcent na słowie kluczu.
