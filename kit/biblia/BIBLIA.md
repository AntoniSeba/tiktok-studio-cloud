# Biblia TikToka Antoniego

Wersja 1.0, 19.10.2026. Źródła: rozmowa z Antonim z 19.10.2026 (cały standard poniżej to jego zasady), dane kanału o silnikach (17 filmów z retencją sekunda po sekundzie: 1,76 mln wyświetleń, oraz 49 filmów: 5,41 mln wyświetleń w 28 dni, bez reklam), standard kanału o silnikach (`tiktok-silnik-film`, `tiktok-silnik-skrypt`) i research zewnętrzny (lista na końcu).

Dotyczy KAŻDEGO krótkiego wideo: explainery 3D, rysowane, cartoon, UGC, quizy, reklamy aplikacji, filmy 30 s i filmy 5 min. Formaty się zmieniają, te zasady zostają.

Jak czytać poziomy pewności:
- **[DANE]** wynika z liczb kanału (z podanym n i siłą związku),
- **[ANTONI]** zasada z doświadczenia Antoniego, obowiązuje bez dyskusji,
- **[RESEARCH]** wniosek z badań albo praktyki najlepszych kont, do sprawdzenia na naszych danych.

---

## Rozdział 0. Matematyka zasięgu: co naprawdę liczy algorytm

To fundament. Każda zasada niżej służy jednemu z tych czterech mechanizmów.

**0.1 Czas oglądania rządzi wszystkim.** [DANE, 17 filmów] Wyświetlenia = C x (średni czas oglądania) do potęgi 2,47 (r = 0,67, p = 0,003). W praktyce:
- podwojenie średniego czasu oglądania daje ok. 5,5 raza więcej wyświetleń,
- +10 s średniego czasu (z 30 na 40 s) to ok. +110% wyświetleń,
- łączny czas oglądania koreluje z wyświetleniami na poziomie r = 0,98.
TikTok sam pisze, że obejrzenie dłuższego filmu od początku do końca to "silny wskaźnik zainteresowania", ważony mocniej niż słabe sygnały [RESEARCH, TikTok Newsroom].

**0.2 Bramka 5 sekundy.** [DANE, 17 filmów] Strata widzów między 2. a 5. sekundą ma najsilniejszy związek z wyświetleniami w całym zbiorze: r = -0,75 (p = 0,001). Retencja po 1 s nie różnicuje niczego (r = -0,12). Filmy z retencją po 5 s co najmniej 60% miały medianę 117 903 wyświetleń, poniżej 60%: 68 191 (x1,73). Pierwsza sekunda jest "darmowa": każdy film traci na pierwszej klatce ok. 1/6 widzów. Bramka stoi na piątej.

**0.3 Gdzie odchodzą widzowie.** [DANE, 17 filmów] 58% wszystkich odejść przypada na pierwsze 10 s. Koszt sekundy w punktach procentowych widzów: hook 0 do 3 s: 11,7 pkt/s; obietnica 3 do 10 s: 3,0; kontra 10 do 20 s: 0,9; środek filmu: 0,2 do 0,5. Wniosek: filmy nie tracą widza w środku, tylko na starcie. Środek jest tani, więc można go wydłużać (to kupuje czas oglądania), ale słabego startu nie nadrobi.

**0.4 Druga bramka: 10 do 30 s.** [DANE, 49 filmów] Na 3. sekundzie 10 najlepszych i 10 najsłabszych filmów trzyma tyle samo widzów (63% i 63%). Retencja po 30 s ma najsilniejszy związek z wyświetleniami (+0,47), retencja po 3 s prawie żaden (+0,07). Najgroźniejsze są sekundy 4 do 7: w słabszych filmach właśnie tam był największy spadek (do -13 pkt), bo następne ujęcie nie dowiozło obietnicy hooka. Hook to bilet wstępu, nie przewaga. Wygrywa film, który wciąga, a nie tylko zaczepia.

**0.5 Zaangażowanie: komentarze, udostępnienia, zapisy. Lajki nie.** [DANE + ANTONI]
- Udostępnienia na 1000 wyświetleń: +0,44 (49 filmów), +0,37 (17 filmów). Najsilniejszy sygnał zaangażowania. Viral to film, który ktoś wysyła komuś z dopiskiem "to ty".
- Komentarze na 1000: +0,30 (49 filmów), +0,37 (17 filmów) i co ważne, niezależne od retencji (korelacja z retencją 0,03). To druga, osobna dźwignia: film może wygrać, bo wciąga, albo bo kłóci. Najlepiej, gdy robi jedno i drugie. Model Antoniego na ponad 50 filmach (5,5 mln) pokazuje to samo: komentarze mocno idą w parze z zasięgiem.
- Zapisy: w modelu regresji 17 filmów +4 zapisy na 1000 = +98% wyświetleń, w 49 filmach korelacja 0,00. Dane mieszane, ale zapis to sygnał wartości, więc dajemy powód do zapisu w każdym filmie.
- Lajki: +0,07 (17 filmów), -0,26 (49 filmów). Obserwacje: -0,12. **Nie projektujemy pod serduszka.**

**0.6 Dystrybucja.** [DANE, 49 filmów] 96,6% wyświetleń przychodzi z "Dla Ciebie", obserwujący to ok. 4% widzów. Każdy film musi działać sam, dla kogoś, kto nigdy nie widział konta. Rozkład potęgowy: jeden film to 19% wszystkich wyświetleń, 16 z 49 filmów robi 80%. Film żyje ok. 48 godzin. Kilka filmów dziennie się nie kanibalizuje (mediana 65 tys. przy 2+ filmach dziennie, 54 tys. przy jednym). Wrzucanie 12:00 do 16:00 (mediana 132 tys.) wypadło lepiej niż rano (39 tys.), ale próbka jest mała.

**0.7 Wzór do porównywania wariantów przed publikacją** [DANE, 17 filmów, R kwadrat 0,71 w próbie, 0,44 w walidacji, więc do porównań, nie do prognozy co do sztuki]:
log(wyświetlenia) = 1,72 + 0,122 x retencja_5s(pkt) + 0,125 x zapisy_na_1000 + 0,017 x udostępnienia_na_1000 + 0,012 x długość(s).
+5 pkt retencji po 5 s (z 55 na 60) = +58% wyświetleń.

---

## Rozdział 1. Akcja od pierwszej setnej sekundy

[ANTONI] "Pierwsza setna sekundy musi być akcją. Już musi mówić lektor. Już musi się wszystko dziać. Nigdy, kurwa, tak nie rób", czyli nigdy powolnej animacji na wejściu.

Zasady:
1. Lektor zaczyna od 0 (najpóźniej 30 ms; `tts_tnij.py` i `petla.py` to mierzą). Zero oddechu, zero ciszy, zero muzycznego intro.
2. Klatka 0 jest w ruchu: obiekt w trakcie składania albo rozkładania, kamera jedzie, element wchodzi. Nie: ciemny ekran, fade in, logo na wejście, spokojny ujazd.
3. Nagłówek (teza) stoi od klatki 0 i pokrywa się dosłownie ze słowami lektora.
4. Pierwsze 5 do 7 s jest gęstsze niż reszta: cięcie albo nowy element co ok. 0,7 do 1,5 s [ANTONI + DANE: hook 2JZ, 6 cięć w 7 s, najlepszy film kanału 345 tys., potem 496 tys.].
5. Pierwsze 3 s muszą być zrozumiałe bez dźwięku (część ogląda wyciszona): teza na ekranie.

---

## Rozdział 2. Hook: co działa, co nie i dlaczego brak hooka jest hookiem

### 2.1 Co mówią dane [DANE, 17 filmów, retencja sekunda po sekundzie]

| Typ pierwszego zdania | n | mediana wyświetleń | ret. 5 s | strata 2-5 s | przykład |
|---|---|---|---|---|---|
| Oskarżenie w 2. osobie / liczba w sprzeczności | 4 | 189 555 | 62% | 12 pkt | "Toyota zbudowała silnik, który trzyma 1000 koni, a wpisała mu 280, a Ty boisz się chipa" (345 tys.) |
| Kłamstwo / mit, który widz stosuje | 1+ | 132 153 | 48% | 16 pkt | "Olej co 30 tysięcy kilometrów to najdroższe kłamstwo serwisu" |
| X lepsze od Y (spór plemienny) | 2 | 92 602 | 58% | 15 pkt | "Rzędowa piątka jest lepsza od rzędowej szóstki. Tak, wiem, sam mówiłem..." (najwięcej komentarzy: 1,42 na 1000) |
| Fakt wprost, bez hooka | 1 | 87 023 | **64%** | **10 pkt** | "Turbo nie dodaje mocy. Serio. Ani jednego konia." (najlepsza retencja 1 s: 90%) |
| Teza "X to najlepszy silnik na świecie" (powtarzana) | 2 | 44 355 | 51% | 18 pkt | czwarty raz z rzędu ta sama konstrukcja: 20 tys. |
| Pytanie "Dlaczego...?" / "Jak...?" | 3 | **20 565** | 54% | **23 pkt** | "Dlaczego zawieszenie w twoim aucie ciągle się pierdoli?" (9 tys., najgorszy) |

[DANE, 49 filmów]
- Tematy ze stawką osobistą albo oskarżeniem ("Rozgrzewając silnik, zabijasz go", "Dałeś się oszukać", "Litr z turbo to kłamstwo") mają medianę 113 tys., ciekawostki techniczne 45 tys. (2,5 raza mniej).
- Największy hit (986 tys.) mówił ludziom, że robią coś źle każdego ranka. Zagrożenie tożsamości ("ja tak robię!") zatrzymuje kciuk i każe wysłać film komuś, kto robi tak samo.
- Konkretna liczba w sprzeczności przebija przymiotnik: "1000 koni, w papierach 280" (496 tys.), "7,0 l/100 zamiast katalogowego".
- Ton wykładu ("opowiem ci o technologii") jest na dole i w zasięgu, i w komentarzach. Ton kłótni przy piwie niesie.

Wizualnie [DANE]: ten sam film z hookiem zaprojektowanym (licznik 2700 do 1200, trzy chipy, werdykt) zrobił 121 552, z gołym B-rollem 53 627 (x2,27; górna granica, bo druga publikacja to duplikat). Hook na samym statycznym 3D bez danych był najsłabszy.

### 2.2 Wnioski

1. **Najlepszy hook to brak wstępu.** Pierwsze zdanie jest najmocniejszą informacją filmu, podaną wprost. "Turbo nie dodaje mocy" (fakt wprost) miał najlepsze utrzymanie w 1. i 5. sekundzie w całym zbiorze. Tak, brak hooka jest hookiem, pod warunkiem że pierwsze zdanie to sedno, a nie zapowiedź sedna. Zasada Kallawaya [RESEARCH]: hook ma natychmiast dać jasność tematu i trafną ciekawość; cztery błędy hooka to opóźnienie, zamieszanie, nietrafność i nuda.
2. **Nie zaczynamy od pytania "dlaczego".** Pytanie przerzuca pracę na widza i opóźnia sedno. Najgorsze wyniki kanału (9 tys., 20 tys., 20 tys.) to pytania. Jeśli musi być pytanie, to po tezie, nie zamiast niej.
3. **Druga osoba i stawka:** "ty", "twój silnik", "płacisz", "zabijasz", "dałeś się". Widz ma poczuć, że film jest o nim.
4. **Liczba, która się nie zgadza**, najlepiej zmieniająca się na oczach widza (licznik). Liczba zatrzymuje mózg.
5. **Wyprzedzenie zarzutu** ("Tak, wiem. Sam mówiłem, że...") buduje wiarygodność i komentarze.
6. **Nie powtarzamy tej samej konstrukcji hooka 3 razy z rzędu.** Seria "X to najlepszy silnik" spadła z 154 do 20 tys.
7. **Hook spłacony do 4. sekundy.** Jeśli hook mówi "udowodnię", w 3. sekundzie jest pierwszy dowód, nie wstęp. Sekundy 4 do 7 sprawdzają, czy hook był uczciwy.
8. **Drugi hook w 8 do 12 s:** zwrot, liczba, która podbija stawkę ("a to dopiero połowa"). Tu wygrywa się bramkę 10 do 30 s.
9. **Hook zaprojektowany:** dane na ruchu (licznik, chipy, werdykt dosłownie ze słów lektora), B-roll z prawdziwego świata albo split dwóch obiektów. Nie statyczny obiekt.

Pełna biblioteka typów hooków z szablonami: `reference/hooki.md`.

---

## Rozdział 3. Obietnica i dowiezienie

[ANTONI] "To, co mamy w hooku, ta obietnica musi być rozwiązana, musi być dowieziona perfekcyjnie, w sposób, w który mówisz: wow, kurwa, nauczyłem się."

1. **Obietnica w 3 do 10 s, konkretna i sprawdzalna:** nazwa, liczba, marka. "Na końcu zobaczysz, czemu Mercedes wyrzucił V6" (154 tys.), "dlaczego Toyocie nie wolno było napisać, ile on naprawdę ma" (345 tys.). Zakaz ogólników typu "dowiesz się czegoś ciekawego" [DANE].
2. **Obietnica jest widoczna** (np. bęben "Na końcu: ???", licznik, zakryta karta), kręci się w trakcie i staje na odpowiedzi w nagrodzie.
3. **Nagroda dowozi obietnicę dosłownie** i z naddatkiem (liczba, nazwa, rekord, mechanizm). Widz, który doczekał, ma dostać więcej, niż myślał.
4. **Ponowne zahaczenia** w ok. 1/3 i 2/3 filmu: mini obietnica, zwrot, pytanie. MrBeast robi celowe "re-engagement" w stałych punktach filmu, bo uwaga spada falami [RESEARCH].
5. **Mała rzecz może zostać otwarta** (Rozdział 7), ale NIGDY główna obietnica.
6. **Szczyt wartości to moment na kartę serii i obserwuj** (ok. 85 do 90% filmu, tuż po nagrodzie).

---

## Rozdział 4. Dynamika i strategie retencyjne

[ANTONI] Dynamika TikToka to ok. 2 do 3 s: przejście, coś nowego, efekt. Tyle trzeba, żeby trzymać użytkownika. Ale nie każdy format potrzebuje popować co 2 s.

| Format | Strategia | Rytm zmian |
|---|---|---|
| Explainer (3D, rysowany, cartoon, plansze) | efekt kasyna, mikronagrody | hook co 0,7 do 1,5 s przez 5 do 7 s, potem średnio 2 do 3 s, nigdy dłużej niż 3,5 s bez zmiany |
| UGC, mówiąca głowa, POV | tak mocny hook i progresja, że jedno ujęcie trzyma | zmiana kadru, napis, gest albo przybliżenie co 2 do 4 s, bez twardego limitu |
| Historia (in medias res) | otwarte pętle, napięcie | cięcia na zwrotach akcji, ponowne zahaczenia co 15 do 25 s |
| Quiz, zakład, ranking | Zeigarnik (niedokończone zadanie), odliczanie | rytm wyznaczają pytania i odpowiedzi, odpowiedź zawsze o 1 krok później, niż widz chce |
| Satysfakcja (proces, składanie, slow-motion) | wizualna progresja do celu | ciągły ruch, cel widoczny od początku |

Zasady dla wszystkich:
1. Coś się zmienia: cięcie, nowy nagłówek, nowy element planszy, ruch obiektu, przybliżenie, B-roll. Kadr nie stoi.
2. Zmiana na słowie lektora (czas z transkrypcji słowo w słowo, nie na oko).
3. Jeśli lektor opowiada coś, co widać na obiekcie, zostajemy na obiekcie i robimy to na nim (rozłożenie, przekrój, podświetlenie), zamiast przełączać na siłę.
4. Nigdy więcej niż 2 ujęcia tego samego typu pod rząd (3D, 3D, potem plansza albo B-roll) [ANTONI, silniki].
5. Plansza może stać 5 do 9 s, jeśli co 1,5 do 2 s coś się na niej dzieje.
6. Dynamika z płynnego ruchu, nie z fleszy i trzęsienia (poza ok. 7 s hooka). Antoni: flesze i podskakiwanie "dodają mi kortyzolu".

---

## Rozdział 5. Efekt kasyna (klucz do sukcesu)

### 5.1 Definicja

[ANTONI] "Każde ujęcie nie może być w tym samym czasie. Nie możemy wbić użytkownika w rytm 2 s, 2 s, 2 s, albo 2,5, 2,5, 2,5. To jest nieakceptowalne. Każdy segment musi być od siebie inny i w innych odstępach, tak żeby umysł użytkownika był zamknięty w cyklu dopaminowym: każdy segment musi dostać hita dopaminy albo nie dostać go. Tak jak z TikTokiem."

**Efekt kasyna to zmienny harmonogram nagród zastosowany do montażu.** Widz wie, że nagrody (nowy obraz, liczba, zwrot, odpowiedź) na pewno będą, ale nie wie, kiedy przyjdą i jak duże będą. Dlatego nie scrolluje.

### 5.2 Dlaczego to działa [RESEARCH]

- Zmienny harmonogram (nagroda po nieprzewidywalnej liczbie prób) to najsilniejszy znany harmonogram wzmocnień i najbardziej odporny na wygaszanie (Skinner). To mechanizm automatu do gry.
- Dopamina reaguje na błąd przewidywania, nie na samą nagrodę (Schultz 1997): nagroda przewidziana nie daje skoku, nagroda niespodziewana daje duży. Równy rytm mózg przewiduje po 3 powtórzeniach, więc kolejne zmiany przestają działać. Nieregularny rytm za każdym razem daje mały błąd przewidywania.
- Sam TikTok działa tak samo: każdy swipe to los. Nasz film ma być tym samym w małej skali: kasyno w kasynie.
- "Przewidywalny efekt kasyna" [ANTONI]: widz, który zna kanał, WIE, że nagroda przyjdzie (bo poprzednie filmy zawsze płaciły), więc zostaje. Pewność, że wygrana istnieje, plus niepewność, kiedy przyjdzie.

### 5.3 Reguły liczbowe (sprawdza `kasyno.py`)

1. **Gęstość:** hook (0 do ok. 6 s) mediana odstępu najwyżej 1,6 s. Potem średnio 1,3 do 3,0 s.
2. **Brak przestojów:** w explainerze nigdy dłużej niż 3,5 s bez zmiany (ostrzeżenie od 3,0 s).
3. **Nieregularność:** zmienność odstępów (odchylenie / średnia) co najmniej 0,25. Poniżej 0,18 to metronom.
4. **Zero metronomu:** nigdy 3 kolejne odstępy prawie równe (różnica do 0,15 s).
5. **Rozrzut:** żadna długość odstępu (okno 0,3 s) nie może stanowić więcej niż 40% odstępów.
6. **Trzy kosze długości:** krótki (1,0 do 1,6 s), średni (1,9 do 2,6 s), długi (2,6 do 3,0 s), losowane, nie na zmianę.
7. **Siła trafień jest zmienna:** zdarzenie małe (nowy napis, etykieta, podświetlenie), średnie (nowe ujęcie, kąt, plansza), duże (przerwanie wzoru: B-roll, split, licznik, karta, zmiana systemu wizualnego). Duże trafienia co 3 do 6 zdarzeń, losowo.
8. **Czasem brak trafienia:** zbudowane oczekiwanie bez wypłaty (bęben się kręci, odpowiedzi jeszcze nie ma). To też część automatu: przegrana podtrzymuje grę.

Przykład. ŹLE (metronom): 2,0 / 2,0 / 2,1 / 2,0 / 2,0 s, wszystko ujęcia tej samej wagi. DOBRZE (kasyno): 1,2 / 2,4 / 2,9 / 1,4 / 2,2 / 3,0 / 1,1 s, z dużym trafieniem po 2., 6. i 9. zdarzeniu.

Plan osi czasu: `python3 ~/.claude/skills/tiktok-biblia/scripts/kasyno.py --generuj <długość> --slowa assets/transcript.json --zapisz plan.json` daje nieregularny plan zdarzeń przyciągnięty do początków słów, z oznaczeniem siły trafienia i miejscami drugiego hooka i ponownych zahaczeń.

---

## Rozdział 6. Pętla w każdym filmie

[ANTONI] "Każdy film, powtarzam każdy, powinien mieć strategię na zapętlenie użytkownika. Standard: pierwsza i ostatnia klatka jest tą samą klatką i użytkownik nie wie, kiedy filmik się kończy i kiedy zaczyna." Wzór: silniki, gdzie silnik się składa i dwie klatki nakładają się na siebie.

Strategie (każdy film ma co najmniej A albo B, najlepiej obie, plus jedną dodatkową):
- **A. Pętla wizualna:** ostatnia klatka = pierwsza (ta sama kamera, stan obiektu, nagłówek). Mierzy `petla.py`: różnica ostatnia/pierwsza nie większa niż zwykła różnica sąsiednich klatek.
- **B. Pętla zdaniowa:** ostatnie słowa wpadają gramatycznie w pierwsze zdanie ("Więc powtórzę." + "Rzędowa piątka jest lepsza od rzędowej szóstki.").
- **C. Pętla ruchu:** proces, który na końcu wraca do stanu początkowego (silnik rozłożony, składa się, znowu rozłożony).
- **D. Pętla detalu:** coś z początku staje się zrozumiałe dopiero po końcu, więc widz ogląda jeszcze raz, żeby to zobaczyć.
- **E. Pętla dźwiękowa:** rytm albo dźwięk, który na końcu przechodzi w początek bez szwu.

Zawsze: bez wyciszenia na końcu, bez czarnej klatki, bez oddechu przed pierwszym słowem, koniec urwany (Rozdział 12). Powód: powtórka dokłada czas oglądania, a czas oglądania jest paliwem zasięgu (Rozdział 0).

---

## Rozdział 7. Magnes na komentarz: niedopowiedzenie, anomalia, celowy drobny błąd

[ANTONI] Wzór: twórca od kryptowalut nagrywał zwykłe filmy w koszulce Zonda Crypto (giełdy, która upadła i na której wiele osób straciło pieniądze). Nie tracił wiarygodności, bo nic nie mówił o koszulce, ale komentarze były pełne "dobry film, ale ta koszulka". To jest niedopowiedzenie, które samo nabija komentarze.

W explainerach nie musi to być koszulka. Każdy film ma **jeden zaplanowany magnes** (najwyżej dwa), zapisany w planie skryptu w sekcji "Biblia: magnes", z przewidywanym komentarzem i naszą odpowiedzią.

### 7.1 Rodzaje magnesu

1. **Anomalia w kadrze (koszulka Zondy):** element, który budzi pytanie i nie jest wyjaśniony. Przykłady: logo konkurencji albo upadłej marki na przedmiocie w tle, część w dziwnym kolorze, nie ten model auta na B-rollu, kubek z nietypowym napisem, liczba na liczniku, która nie pasuje do słów.
2. **Celowy, nieszkodliwy błąd w oczywistej rzeczy:** coś, co każdy w temacie wie, powiedziane albo napisane lekko źle: przekręcona nazwa, zły rok w ciekawostce pobocznej, dziwne słowo zamiast oczywistego ("zamiast silnik bardzo dziwne słowo"). Ludzie nie potrafią nie poprawić błędu (prawo Cunninghama: najlepszy sposób na dobrą odpowiedź w internecie to podać złą) [RESEARCH].
3. **Niedopowiedzenie:** mała rzecz obiecana albo zasugerowana i niedowieziona ("trzecią rzecz zobaczysz, jeśli wiesz, gdzie patrzeć"), szczegół widoczny przez pół sekundy. Widz ogląda jeszcze raz albo pyta w komentarzu.
4. **Ranking z jednym kontrowersyjnym miejscem** albo teza, z którą połowa się nie zgodzi (spór plemienny: filmy "X lepsze od Y" mają najwięcej komentarzy, do 1,52 na 1000) [DANE].
5. **Słowo-dziwak:** nietypowe, lekko zabawne słowo na coś zwykłego, które ludzie zaczną powtarzać.

### 7.2 Bezpieczniki (nie do złamania)

- Błąd NIGDY w głównej tezie, w obietnicy, w nagrodzie ani w czymś, na czym widz oprze decyzję o pieniądzach, zdrowiu albo bezpieczeństwie. Tylko w rzeczy pobocznej i oczywistej dla znawców.
- Nie wprowadzamy w błąd. Po fali komentarzy przypinamy odpowiedź ("Brawo, ktoś wyłapał. Oczywiście chodziło o...") albo odpowiadamy filmem. To druga fala komentarzy.
- Żadnych zmyślonych badań, statystyk ani cytatów. Polska publiczność to wyłapie i zabije konto w komentarzach.
- Nic, co obraża realną osobę albo firmę (zniesławienie). Anomalia ma budzić pytanie, nie oskarżać.
- Anomalia nie może zasłaniać treści ani łamać stref.

---

## Rozdział 8. Ego baiting

[ANTONI] "Coś, co jest totalnie oczywiste dla ludzi, którzy są troszeczkę w temacie, zaprezentować jako coś, co jest dla znawców. Użytkownik musi poczuć się mądry, wyjątkowy, mimo że to jest totalnie oczywiste, no bo wszyscy muszą poczuć się wyjątkowi. Bardzo subtelnie, w nieoczywisty sposób."

### 8.1 Mechanizm

Ego bait działa w dwie strony naraz:
- **Widz w temacie** dostaje rzecz, którą już wie, podaną jak wiedzę tajemną. Czuje się mądry ("wiedziałem!") i musi to pokazać: pisze "przecież to oczywiste", poprawia, dopowiada szczegół, wysyła kumplowi. Komentarz jest dla niego sygnałem przynależności do grupy znawców.
- **Widz spoza tematu** dostaje rzecz nową, podaną jak sekret. Zapisuje i wysyła dalej.
Oba skutki to dokładnie te sygnały, które liczy algorytm (komentarze, udostępnienia, zapisy).

Podstawy [RESEARCH]: sygnalizowanie tożsamości i przynależności do grupy (Berger: ludzie upodabniają się do grupy, do której chcą należeć, i odróżniają od tej, z którą nie chcą być myleni), pochlebstwo działa nawet wtedy, gdy wiemy, że jest nieszczere (Reeves i Nass), luka ciekawości (pokaż część, wstrzymaj resztę), prawo Cunninghama (poprawianie jest nie do odparcia), luka między "laikiem" a "znawcą" jako rama.

### 8.2 Jak to robią najbardziej clickbaitowe konta (wzorce do użycia)

1. **Rama "sekret od środka":** "Jest jedna rzecz o turbo, której mechanik ci nie powie." (rzecz jest dla mechanika oczywista).
2. **Rama dwóch poziomów:** "Laik powie, że to przez olej. Ktoś, kto się zna, wie, że..." Widz zawsze wybiera poziom znawcy.
3. **Odznaka tożsamości:** "Jeśli wiesz, co to za dźwięk, to wiesz, czemu..." / "Prawdziwi kierowcy dieseli to znają."
4. **"Większość ludzi robi to źle":** zagrożenie tożsamości ("ja tak robię!"), największy hit kanału (986 tys.).
5. **Zgadnij, zanim powiem:** quiz; ludzie piszą odpowiedź, żeby udowodnić, że wiedzieli.
6. **"Ty to pewnie wiesz, ale..." / "Dla ciebie to oczywiste, dla 90% kierowców nie":** komplement wplecionego w zdanie (bez zmyślonego procentu, jeśli go nie mamy: "dla większości").
7. **Prośba o poprawkę:** "Poprawcie mnie, jeśli się mylę" przy rzeczy, w której celowo zostawiamy lukę.
8. **Oczywistość ogłoszona jak odkrycie:** "Nikt o tym nie mówi, ale..." przy rzeczy powszechnie znanej w niszy. Znawcy komentują "każdy to wie", reszta się uczy.

### 8.3 Zasady subtelności

- Jeden wyraźny ego bait w pierwszych 10 s (zwykle w obietnicy albo kontrze), jeden przy pytaniu do komentarzy. Reszta filmu uczy normalnie.
- Nigdy wprost "jesteś mądry". Komplement jest ukryty w ramie ("ktoś, kto się zna", "ty pewnie zauważyłeś").
- Nigdy nie obrażamy widza wprost ("debile tak robią" działa tylko w hooku o produkcie, nie o widzu, i tylko w tonie kanału).
- Ego bait łączy się z magnesem (Rozdział 7): oczywista rzecz lekko przekręcona = znawca poprawia.

Szablony po polsku i więcej przykładów: `reference/komentarze-i-ego-bait.md`.

---

## Rozdział 9. Zaangażowanie: komentarze, udostępnienia, zapisy (organicznie)

[ANTONI] "Lajki idą do dupy, zapisy są istotne i komentarze, i pod to powinniśmy optymalizować. Każdy filmik powinien mieć swoją strategię na komentarze i zapisy. To powinno być organiczne."

Każdy film ma w planie:
1. **Pytanie-wybór do komentarzy:** dwie opcje, na które da się odpowiedzieć dopiero po obejrzeniu ("Piątka czy szóstka?"), w ok. 88 do 94% filmu, głosem i kartą. To samo pytanie w opisie i jako przypięty komentarz.
2. **Magnes na komentarz** (Rozdział 7) i **ego bait** (Rozdział 8).
3. **Powód do zapisu:** konkret, do którego się wraca (lista, liczby, procedura krok po kroku, "zanim kupisz, sprawdź te 3 rzeczy").
4. **Powód do udostępnienia:** zdanie, które widz powtórzy komuś ("90 minut wykładu = 11 minut treści"), temat "to dotyczy kogoś, kogo znasz".
5. **Karta serii** ("Część N", "Który następny?") w szczycie wartości: obserwacja z wartości, nie z prośby.
6. **Odpowiedzi filmem** na najlepsze komentarze (druga fala, nowy film z gotowym hookiem z komentarza).

Zakazy [RESEARCH: zasady TikToka o engagement bait i kwalifikacji do Dla Ciebie]: żadnego "napisz TAK, a...", "daj lajka, jeśli", "skomentuj, żeby dostać", fałszywych nagród. TikTok traktuje wymuszanie interakcji jako manipulację i może wyłączyć film z Dla Ciebie. Pytanie ma być prawdziwą ciekawością, nie transakcją.

---

## Rozdział 10. CTA sprzedażowe i produkty

[ANTONI] Reklama ma być "wpasowana do filmu, a nie że z dupy". Każdy film ma CTA (do produktu, do aplikacji, do YouTube), wplecione w temat.

1. **Problem zasiany wcześniej** w treści (np. "kontrolka oleju zapala się, kiedy jest już za późno"), produkt pojawia się jako rada albo dowód, nie jako bohater.
2. **Miejsce:** tuż przed nagrodą (widz czeka na odpowiedź, nie wyjdzie na reklamie) albo jako puenta.
3. **Pokazany w użyciu** (B-roll albo plansza), napisy dosłownie ze słów lektora, uczciwe ograniczenie produktu, bez zmyślonego "ja używam".
4. **Wezwanie konkretne:** "Masz go w koszyku na dole filmu." / "Link w bio." Karta ze strzałką w strefie bezpiecznej.
5. [DANE] Film, który wygląda jak reklama (stockowe klipy, lektor zachwala preparat), zrobił 1 172 wyświetlenia. Filmy z reklamą wplecioną w treść działały normalnie. Produkt jako dowód albo puenta, nigdy jako blok.
6. Treść komercyjna oznaczona przy publikacji zgodnie z zasadami TikToka.

---

## Rozdział 11. Długość: dłuższy wygrywa, jeśli dowozi

[ANTONI] "3-minutowe filmiki na silnikach sprzedawały się 10 razy lepiej niż minutowe, dlatego, bo ludzie chcieli oglądać. Jeśli robimy zajebiste treści i dowozimy, ludzie chcą oglądać i my musimy im dać tę treść. Pełną treść, nie pobłażliwą."

[DANE, 17 filmów] Filmy 140 s i dłuższe: mediana 123 203 wyświetleń, krótsze: 53 627 (x2,3). Najlepsze filmy miały 147 do 175 s i 380 do 420 słów. Mechanizm: środek filmu kosztuje tylko 0,2 do 0,5 pkt widzów na sekundę, a każda sekunda dokłada czasu oglądania, który mnoży się przez wykładnik 2,47.

[DANE, 49 filmów, uczciwie] Krótsze filmy (poniżej 100 s) trzymają lepiej procentowo (35% po 30 s wobec 27% przy 150 do 200 s), a zasięg miały podobny. Wniosek łączny: **długość jest nagrodą za płaski ogon krzywej**. Wydłużamy, gdy:
- każdy segment dowozi mikronagrodę (efekt kasyna działa do końca),
- retencja po 30 s jest co najmniej 30%, po 60 s co najmniej 22 do 27%,
- jest dość materiału na pełną, gęstą treść (nie lejemy wody).
Jeśli trzy filmy z rzędu mają retencję po 30 s poniżej 28%, skracamy albo zagęszczamy.
Jeśli najważniejsze (CTA, link) jest na końcu, a mało osób dochodzi do końca, CTA idzie wcześniej albo film jest krótszy.

Będą filmy 30-sekundowe i 5-minutowe. Długość wynika z tematu i gęstości, nie z przyzwyczajenia.

---

## Rozdział 12. Koniec urwany

[ANTONI] "Końcówka z podsumowaniem jest słaba", "na podsumowaniu widać spike wyjść". Po CTA 1 do 3 słowa pętli i od razu hook. Nigdy "podsumowując", nigdy "to tyle", nigdy "dzięki za obejrzenie".

---

## Rozdział 13. Lektor TTS: cięcie ciszy i tempo 1,12x

[ANTONI] "TTS z Labsa, Gemini czy czegokolwiek ma dużo martwych stref, pustych bloków, które są dla użytkownika TikToka nieakceptowalne. Oni są tak najebani dopaminą, że każda setna sekundy, której TTS nie mówi, jest stratą retencji. Wycinamy każdą, nawet najmniejszą ciszę, po stronie agresywniejszej, ale tak, żeby słowa się nie zjadały." Oraz: "Każdy TikTok przyspieszony 1,12x. To idealny poziom."

Proces (zawsze, w tej kolejności):
1. Generujesz lektora (ElevenLabs, Gemini TTS, cokolwiek).
2. `python3 ~/.claude/skills/tiktok-biblia/scripts/tts_tnij.py RAW.mp3 assets/vo.mp3`
   - wycina każdą ciszę: próg liczony z poziomu mowy (mowa minus 30 dB), zostawia 20 ms przed słowem i 40 ms po słowie (syczące końcówki są ciche, nie wolno ich obciąć),
   - wycina oddechy stojące samodzielnie w pauzie,
   - przyspiesza 1,12x bez zmiany wysokości głosu,
   - ustawia szczyt na -3,5 dBFS (zapas na kodeki),
   - zapisuje mapę czasów (oryginał do wyniku) i raport PASS/FAIL: najdłuższa przerwa max 120 ms, start max 30 ms, 100% mowy zachowane.
   Sprawdzone 19.10.2026 na lektorze filmu o elektryku: 192,9 s surowego nagrania, 171,2 s po cięciu, 152,9 s po 1,12x, transkrypcja słowo w słowo identyczna z oryginałem (399 słów).
3. Transkrypcja słowo w słowo z przetworzonego pliku (czasy po cięciu i tempie).
4. Oś czasu na tych czasach.

Tempo 1,12x stosujemy **dokładnie raz**: na lektorze (gdy film budujemy z lektora: HyperFrames, Remotion, montaż na lektorze) albo na gotowym MP4 (`przyspiesz.py`, gdy materiał to nagranie UGC albo montaż bez przyspieszonego lektora). Nigdy w obu miejscach.

Długość skryptu przy 1,12x: tempo po cięciu i przyspieszeniu to ok. 2,6 do 2,9 słowa na sekundę. Na 2:45 trzeba ok. 430 do 470 słów (wcześniej, bez 1,12x, ok. 400).

Nigdy nie wycinamy z nagrania słów bez pytania (wyjątek: podsumowanie na końcu, które wycinamy zawsze i mówimy o tym).

---

## Rozdział 14. Martwe strefy TikToka

[ANTONI] "Martwe strefy robią robotę, nie ma na to obejścia. Każdy TikTok ma sprawdzanie martwych stref, skryptem, automatycznie, pass, nie pass."

Strefy w kadrze 1080 x 1920 (sprawdzone na kanale o silnikach; zewnętrzne narzędzia podają od 220 do 254 px u góry i od 420 do 707 px u dołu, więc bierzemy bezpieczną stronę):

| Strefa | Piksele | Co tam jest | Poziom |
|---|---|---|---|
| góra | y 0 do 250 | pasek statusu, "Obserwowani / Dla Ciebie", LIVE, lupa | FAIL dla tekstu |
| dół | y 1430 do 1920 | nick, opis, dźwięk, kotwica produktu TikTok Shop, nawigacja | FAIL dla tekstu |
| prawa szyna | x 850 do 1080, y 1000 do 1430 | awatar, serce, komentarze, zapisy, udostępnij | FAIL dla tekstu |
| prawa szyna wyżej | x 850 do 1080, y 860 do 1000 | awatar na wysokich ekranach | WARN |
| boki | x 0 do 40 i 1040 do 1080 | przycięcie na ekranach 19,5:9 i 20:9 | WARN |

Bezpieczne pole: **y 250 do 1430, a poniżej y 1000 tylko x do 850.** Nic uciętego na krawędzi.

Kontrola: `python3 ~/.claude/skills/tiktok-biblia/scripts/strefy.py film.mp4` albo bez renderu `strefy.py <projekt HyperFrames>`. OCR wykrywa każdy czytelny napis w strefach, wynik PASS albo FAIL, plus kontaktówka z nałożonymi strefami. Nakładka do edytora: `assets/strefy-nakladka-1080x1920.png`.

Przykład z życia (19.10.2026): w projekcie `dpf-miasto-zapycha` bęben "Na końcu" stał na y 150, a kicker na y 205, czyli pod paskiem "Dla Ciebie". Skrypt to złapał.

---

## Rozdział 15. DNA kanału: efekt McDonalda

[ANTONI] "Jak wchodzisz do McDonalda, wiesz, że ten burger będzie dobry. Nie świetny, ale zawsze podobny, w Tajlandii, w Polsce, na Filipinach. Ta powtarzalność daje ludziom komfort. Na TikToku ludzie nie patrzą na profilowe, nie wiedzą, że to to samo konto. Muszą w pierwszej setnej sekundy podświadomie wiedzieć, że trafili na konto, które wcześniej dowiozło, które zrobiło zajebisty film, który oglądali 3 minuty. Więc tym razem też dowiezie."

Dlaczego to ma znaczenie: pierwszy test filmu to kilka do kilkunastu tysięcy widzów, wśród nich ci, którym wcześniejsze filmy się podobały. Jeśli rozpoznają kanał w pierwszej setnej sekundy, dają mu kredyt zaufania i zostają, a to przepycha film przez pierwszą bramkę.

Każdy kanał ma **kartę DNA** (`DNA.md` w projekcie, szablon w `reference/dna-i-eksperymenty.md`):
1. **Wyróżnik (banger):** jedna rzecz, której nie ma nikt inny w niszy. Silniki: piękne, dopracowane animacje 3D silników.
2. **Sygnatura klatki 0:** stały układ pierwszej klatki (gdzie stoi teza, jaki kolor akcentu, jaki krój, co jest w ruchu), rozpoznawalny w 1/100 s.
3. **Znak marki, podprogowo:** małe logo albo stały element (kicker "Seria X · część N", charakterystyczny kolor akcentu, bęben "Na końcu"), zawsze w tym samym miejscu bezpiecznego pola. Ma być wyczuwalny, nie nachalny.
4. **System wizualny:** paleta, kroje, styl ruchu, styl planszy, styl B-rolla.
5. **Głos:** ten sam lektor, ten sam ton (kłótnia przy piwie, nie wykład).
6. **Stałe elementy formatu:** np. bęben obietnicy, karta wyboru, karta serii, CTA.

Zasada: DNA zostaje w każdym filmie. Zmieniamy wszystko inne (Rozdział 16). Design system ma czerpać z samego siebie, żeby kanał był rozpoznawalny, a treść i forma testowały nowe rzeczy.

---

## Rozdział 16. Anty-monotonia: testujemy wszystko poza DNA

[ANTONI] "W silnikach zamknęliśmy się w cyklu dokładnie tej samej kompozycji, tej samej długości: hook, obietnica, po pierwsze, po drugie, po trzecie, po czwarte. To ma swoją rację bytu, ale wtedy nie mamy testów. Nie wiemy, co działa na człowieka. Silniki wybuchły, 5,5 mln w 20 dni, ale to nie zawsze będzie działało. Możemy mieć kanał, który przez pierwsze 100 filmików nie będzie miał zasięgu. Musimy eksperymentować z każdą rzeczą. Ale jeśli każdy film będzie totalnie inny, to nie wygramy, bo ludzie chcą powtarzalności."

Rozwiązanie: **stałe DNA + zmienne testy.**

Zmienne do testowania (każdy film zmienia co najmniej 1, najwyżej 2 naraz względem 3 poprzednich, żeby było wiadomo, co zadziałało):
- typ hooka (teza, liczba w sprzeczności, oskarżenie, fakt wprost, in medias res, quiz, spowiedź, skala, sensoryczny),
- kompozycja (powody 1 do 5, historia, quiz, ranking, mit kontra fakt, eksperyment, odliczanie, POV, porównanie A/B, spowiedź),
- system wizualny w obrębie DNA (3D, plansze, B-roll, split, rysowany, cartoon, nagranie ekranu),
- długość (30 s, 60 s, 90 s, 150 s, 180 s+),
- typ obietnicy (nazwa, liczba, rekord, odpowiedź na pytanie, zakład),
- klasa tematu (kieszeń, duma, tożsamość, spór, legenda, ciekawostka),
- typ magnesu i ego baitu, typ CTA, pora publikacji.

Każdy film ma wpis w `EKSPERYMENTY.md`: hipoteza, co zmieniamy, wynik po 48 h (retencja 5 s, strata 2 do 5 s, retencja 30 s, średni czas, komentarze, udostępnienia, zapisy na 1000, wyświetlenia), decyzja (zostaje, odpada, test jeszcze raz). Co tydzień `analiza_eksportu.py` i przegląd: który wariant wygrywa.

Twarde lekcje z silników [DANE]:
- ta sama teza 4 razy z rzędu: 154 tys., 68 tys., 71 tys., 20 tys.,
- legenda i konkretny bohater (2JZ i Supra) biły kolejny odcinek sporu o tytuł,
- ten sam film opublikowany ponownie: 121 tys., 54 tys., 30 tys. Jeden materiał, jedna publikacja,
- prawo potęgi: hitów nie da się przewidzieć, da się je wylosować. Wygrywa liczba strzałów i różnorodność testów, nie dopieszczanie jednego filmu.

---

## Rozdział 17. Lekcje z kanału o silnikach (co przenosimy, czego nie)

Przenosimy wszędzie:
- hook zaprojektowany na danych, teza w 2. osobie, liczba w sprzeczności,
- obietnica z widocznym bębnem i dosłowna nagroda,
- akcja od klatki 0, gęsty hook (cięcie co ok. 1 s przez 7 s), potem płynnie,
- nigdy więcej niż 2 ujęcia tego samego typu pod rząd, B-roll z prawdziwego świata w każdym filmie (ok. 10 do 12 na film, także w hooku),
- karta wyboru, karta serii, CTA, urwany koniec, pętla,
- reklama wpleciona w treść,
- smooth: bez fleszy, trzęsienia, pompowania kamery i dublowania tej samej animacji albo informacji,
- tematy, które dotykają kieszeni albo dumy.

Nie przenosimy ślepo:
- jedna kompozycja (powody 1 do 5) na każdy film,
- ta sama długość każdego filmu,
- ta sama konstrukcja tezy w kółko.

Inne aplikacje i produkty = inne hooki, inne sposoby na wybicie, zupełnie inna kompozycja filmów. Zasady z tej Biblii zostają.

---

## Rozdział 18. Jakość wykonania (standard minimum)

1. Zero literówek na ekranie, poprawne nazwy własne, napisy dosłownie ze słów lektora (transkrypcja słowo w słowo).
2. Każde wejście grafiki na dokładnym słowie lektora.
3. Jedna informacja pokazana raz (nagłówek nie powtarza bębna, licznika, etykiety).
4. Nic uciętego, nic pod interfejsem (Rozdział 14).
5. Audio: szczyt ok. -3,5 dBFS, głośność ok. -14 LUFS; efekty dźwiękowe tylko z widoczną przyczyną.
6. Render MP4 i publikacja tylko na wyraźne polecenie Antoniego. Bez zakładania kont i logowania za Antoniego.
7. Pisownia: nigdy półpauz ani pauz (U+2014, U+2013), bez emoji, pełne ścieżki bezwzględne.

---

## Rozdział 19. Bramka przed oddaniem

1. `python3 ~/.claude/skills/tiktok-biblia/scripts/audyt.py film.mp4` (albo `--hf <projekt>` bez renderu). Każdy FAIL poprawiamy przed oddaniem.
2. `CHECKLISTA.md`: punkty ręczne (hook, obietnica, magnes, ego bait, pytanie, CTA, DNA, zmienna testu).
3. W raporcie dla Antoniego: wynik audytu (PASS/FAIL), co ten film testuje, jaki ma magnes i ego bait, pełne ścieżki.

---

## Źródła zewnętrzne (research 19.10.2026)

- TikTok Newsroom, "How TikTok recommends videos #ForYou" (2020, 2023): ukończenie dłuższego filmu to silny sygnał ważony mocniej niż słabe. https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you/
- Podręcznik MrBeast Productions (wyciek 2024, autentyczność niepotwierdzona oficjalnie): pierwsza minuta decyduje, celowe ponowne zahaczenia w stałych punktach filmu, miniatura i obietnica muszą być dowiezione. https://simonwillison.net/2024/Sep/15/how-to-succeed-in-mrbeast-production/
- Kallaway (podsumowania): hook = jasność tematu + trafna ciekawość; błędy: opóźnienie, zamieszanie, nietrafność, nuda; pętle ciekawości przez cały film. https://www.castmagic.io/podcast/rhythm-hooks-and-a-billion-views-kane-kallaways-short-form-video-content-secrets
- Prawo Cunninghama i jego manipulacyjny charakter: https://models.substack.com/p/cunninghams-law
- Rage bait (słowo roku Oxford 2025), badanie nagłówków na TikToku: nagłówki rage bait wiązały się z wyższym zaangażowaniem niż nagłówki informacyjne. https://www.researchgate.net/publication/405704177_From_clickbait_to_rage_bait_Pragmatics_and_the_monetization_of_emotions_on_TikTok
- Zmienny harmonogram wzmocnień i dopamina jako błąd przewidywania (Skinner, Schultz 1997): https://scienceinsights.org/what-is-a-variable-ratio-reinforcement-schedule/
- Sygnalizowanie tożsamości (Berger): https://repository.upenn.edu/marketing_papers/307
- Pochlebstwo działa nawet nieszczere (Reeves i Nass): https://www.psychologicalscience.org/publications/observer/2009/july-august-09/news/page/114
- Hooki "tylko X% ludzi wie": https://www.selfstorming.com/tools/libraries/hooks/only-1-of-people-know
- Strefy bezpieczne (narzędzia zewnętrzne, rozbieżne liczby): https://adkit.so/tools/safe-zones/tiktok , https://www.socialync.io/tools/safe-zones/tiktok
- Zasady engagement bait i kwalifikacji do Dla Ciebie (źródło wtórne, oficjalny tekst: Community Guidelines TikToka, sekcja For You feed Eligibility Standards): https://www.auditsocials.com/blog/tiktok-engagement-bait-community-guidelines

Uczciwie o researchu: nie ma badań, które mierzą celowe błędy w krótkich filmach na liczbach. Mechanizmy (Cunningham, tożsamość, luka ciekawości, zmienny harmonogram) są dobrze opisane, a skuteczność u nas sprawdzamy w dzienniku eksperymentów.
