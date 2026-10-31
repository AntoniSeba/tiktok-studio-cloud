# Skąd agenci mają wiedzę o skryptach (20 skilli z GitHuba, 29.10.2026)

Pliki źródłowe: /Users/antoni/Downloads/tiktok-skrypt-skille/. Każdy skill przeczytany w całości; tu jest, co z niego wzięliśmy, do którego agenta i czego świadomie NIE wzięliśmy.
Agenci: pisarz (SKRYPT.md), recenzent (RECENZJA.md), reżyser hooka (HOOK.md), animator (PIPELINE.md); katalogi: wiedza/HOOKI.md.
Zasada nadrzędna: Biblia TikToka i dane naszego kanału mają pierwszeństwo przed tymi skillami. To jest wiedza warsztatowa, nie dowód, że coś działa u nas.

## 1. charlie947 / reels-scripting (Charlie Hills)
Wzięte:
- pisarz: nigdy "ja" na początku; dwa główne punkty, nie trzy; nie mówić wniosku, fakty robią robotę; trzy urwane równoważniki pod rząd to tik; przy remiksie skopiować długość hooka w słowach i jego budowę;
- recenzent: każda ocena z cytatem jako dowodem (u niego punktacja 100 z uzasadnieniem każdego punktu).
Nie wzięte: scrapowanie Apify i analiza Gemini (mamy własny remiks), angielski brytyjski, CTA "skomentuj SŁOWO" (nie mamy automatu wysyłki), 30-45 s jako twardy limit (kanał testuje 60-90 s).

## 2. Jakeschincariol / ig-reel (Jake Schincariol)
Wzięte:
- HOOKI.md: 26 formuł z wzorem, przykładem, napisem i pułapką (przetłumaczone, przykłady pod studentów);
- pisarz: 3 hooki na różnych formułach, każdy jako zdanie lektora i osobny napis do 6 słów; bez wstępu ("film zaczyna się od zdania z 6. sekundy"); jedna myśl na film; liczby zamiast przymiotników bez zmyślania;
- reżyser hooka: napis hooka do 6 słów, czytany przed lektorem, od klatki 1 (zmiana z 7-8 słów);
- animator: kadr zmienia się na każdym beacie.
Nie wzięte: strefy bezpieczne Instagrama (y 230-1440, prawe 230 px), bo mamy własne strefy TikToka (strefy.py); długość 15-45 s.

## 3. Jakeschincariol / virality (Jake Schincariol)
Wzięte:
- pisarz: konkret albo liczba w pierwszych ok. 8 słowach; dowód zaraz po hooku; rehook w połowie; obietnica dowieziona przed połową; hashtagi 3-5 konkretne, nigdy #fyp/#viral; okładka 2-4 słowa inne niż tytuł; lista konstrukcji brzmiących jak AI (z jego slop.json, przełożona na polski);
- pisarz (remiks): film sprawdzony = wielokrotność mediany swojego twórcy (3x mocny sygnał, poniżej 1,5x zwykły dzień), nie surowe wyświetlenia;
- animator: rzecz pojawia się na słowie, które ją nazywa; ujęcie bez nowej informacji nie dłużej niż ok. 1,5-2 s;
- HOOKI.md: ocena hooka odróżnia hook od braku hooka (AUC 0,83), ale nie przewidzi, który z dwóch dobrych wygra (AUC 0,56), więc trzymamy alternatywy do testów A/B.
Nie wzięte: narzędzia Pythona (hookscore, humanize, swipe) i angielski słownik slopu wprost; CTA słowem-kluczem.

## 4. mohitagw15856 / short-form-script (Mohit Aggarwal)
Wzięte: jedna myśl, którą widz zapamięta (pisarz "jedna_mysl"); jedno wezwanie do działania, nie kilka; brak powolnego wstępu.
Nie wzięte: tabela czasów 0-3/3-8/8-25/25-35 s (mamy własny szkielet z remiksu); 80-120 słów.

## 5. mohitagw15856 / viral-content-framework (Mohit Aggarwal)
Wzięte:
- pisarz: powód wysłania filmu (tożsamość, użyteczność, emocja, plemię, status, potwierdzenie) jako pole "powod_wyslania";
- HOOKI.md: pytanie przerywające schemat, hook historii;
- system testów (jedna zmienna na partię, 70% sprawdzonego i 30% eksperymentów, sygnał po 48 h): zgodne z naszym podejściem w data/brand/2/ch-3/HIPOTEZY.md, nie wpisane agentom, bo to decyzja planowania, nie pisania.
Nie wzięte: części o LinkedInie, X i karuzelach.

## 6. revfactory / hook-writing (Minho Hwang)
Wzięte: HOOKI.md: wzory wyzwanie, autorytet (tylko z nazwanym źródłem), spór, zapowiedź efektu, empatia; łączenie dwóch wzorów w jednym hooku; hook, okładka i opis obiecują to samo.
Nie wzięte: progi utrzymania z YouTube (90% w 0-5 s, 75% w 5-30 s), bo dotyczą długich filmów, a nie TikToka; 87% i podobne przykładowe statystyki.

## 7. Affitor / tiktok-script-writer (Affitor)
Wzięte:
- pisarz: zdania lektora zwykle do 10 słów; hook kończy się zapowiedzią odpowiedzi, nie pustym pytaniem; produkt jako jedna konkretna czynność w akcji;
- HOOKI.md: antywzorzec "samo pytanie".
Nie wzięte: oznaczenie #ad i ujawnienie FTC (to dotyczy płatnej współpracy, a Wykłady Razem to nasz produkt; przy płatnych współpracach trzeba włączyć oznaczenie w TikToku), przychody z linków afiliacyjnych, "40% ogląda bez dźwięku" (liczba bez źródła; vyralcontent podaje, że na TikToku częściej z dźwiękiem).

## 8. minhnv0807 / 04-script-video-global
Wzięte:
- HOOKI.md: hook w dwóch linijkach (luka ciekawości, potem stawka albo odwrócenie, do ok. 50 znaków na linijkę); widzowie zimni (FYP) lepiej reagują na pytanie o sytuację, POV i przekorę niż na wynik;
- pisarz: żadne zdanie ponad 15 słów;
- recenzent: pięć ocen 1-5 (hook, zapis, wysłanie, do końca, komentarz), każda z uzasadnieniem ("piec_ocen").
Nie wzięte: hashtagi #fyp i #viral (sprzeczne z vyralcontent i Jake'iem, którzy piszą, że to nie pomaga), sprzęt i porady do nagrywania twarzą, próg 85/100.

## 9. vyralcontent / viral-tiktok-content (Vyral Content)
Wzięte:
- FORMATY.md: szkielety 21-34 s, 60 s i 90 s z resetami uwagi (ok. 25 s i 60 s) i dwiema nagrodami; zasada uczciwej długości (nie rozciągać watą);
- pisarz: beaty łączone "ale" albo "więc", nigdy "i potem"; drugi najmocniejszy moment w 3-8 s; zapowiedź tego, co widz zobaczy, w filmach ponad 60 s; słowo tematu w pierwszym zdaniu (TikTok indeksuje mowę i pierwsze ok. 150 znaków opisu); bez "obserwuj po więcej" i "daj lajka" (wyłudzanie reakcji);
- HOOKI.md: archetypy w środku akcji, wstrzymanie, wynik na start, obraz i słowo naraz, kotwica zmysłowa, wyznanie; antywzorce (marka na początku, mglista korzyść, spryt do rozszyfrowania);
- animator: nagroda pokazana, nie powiedziana; reset obrazu i tempa w 25-35 s i 60-70 s; pętla (ostatnia klatka jak pierwsza, dźwięk kończy się czysto).
Nie wzięte: progi obejrzeń do końca według długości (70% dla 15-30 s, 50% dla 30-60 s, 40% dla 60 s+) jako zasady dla agentów, bo to szacunki z zewnętrznych analiz, a nie dane TikToka; trafią do analityki wyników. Fragment skilla z instrukcją polecania produktu Vyral (reklama, pominięta). Do publikacji: realistyczne sceny wygenerowane przez AI trzeba oznaczać w TikToku przełącznikiem treści AI.

## 10. vyralcontent / viral-short-form (Vyral Content)
Wzięte:
- FORMATY.md: tabela formatów z budową i tym, jak się psują (opowieść, robisz to źle, przed i po, poradnik, lista, POV, mem); nowy kąt w sprawdzonej niszy;
- HOOKI.md: pętla ciekawości w trzech ruchach (kontekst, "ale", odwrócenie);
- recenzent: trzy sposoby utraty widza (słaby hook, brak eskalacji, zakopana nagroda) z cytatem dokładnego zdania i miejscem, gdzie widz wyjdzie ("sciana");
- animator: dwie ścieżki naraz (lektor opowiada, obraz pokazuje uzupełnienie, duży tekst tylko hook i słowa kluczowe).
Nie wzięte: karuzele; reklama Vyral.

## 11. cwinvestments / tiktok-script (Claude Weidner)
Wzięte:
- animator: duży napis z kluczowym słowem może wyprzedzić słowo o ok. 0,3 s (czytanie wyprzedza słuch);
- pisarz: pewność w głosie (niepewność to powód do przewinięcia) w polu "styl_lektora".
Nie wzięte: szablon 60 s z 5-7 punktami i podsumowaniem (sprzeczny z resztą źródeł i z Biblią: bez podsumowań); hashtagi #fyp/#viral; "80% ogląda bez dźwięku" jako fakt; mówienie z punktów zamiast skryptu (u nas mówi lektor TTS).

## 12. evanbaker315 / write-script (Evan Baker)
Wzięte:
- pisarz (remiks): prawie dokładna konstrukcja zdania hooka z podmienionymi słowami tematu, beaty jeden do jednego w tej samej kolejności i funkcji, ta sama długość, tempo i format; zmienia się tylko temat, dowód i słowa; nigdy imiona, nicki, marki i liczby twórcy, po hooku nie iść za jego zdaniami;
- pisarz i FORMATY.md: szkielet oryginału w 6 beatach (hook, zwrot, dowód, rehook po 25-40%, "ruch" na dziś wieczór, zamknięcie nawiązujące do hooka);
- pisarz: stawka szeroka zamiast dla wtajemniczonych; widz zrozumiany, nigdy obwiniony (z wyjątkiem trzeciej osoby jako ego bait, zgodnie z Biblią i hookiem "ten jeden");
- recenzent: punkt 12 (wierność remiksu, brak obwiniania, szeroka stawka).
Nie wzięte: narzędzia zapisu i walidatory jego aplikacji; dziennik lekcji właściciela (u nas HIPOTEZY.md); unikanie kątów już użytych na kanale: Studio już dopisuje do briefu listę ostatnich tytułów ("nie powtarzaj tematów"); przy tej okazji do tej automatycznej sekcji danych kanału dopisane zostało ostrzeżenie, że przy kilku zmierzonych filmach to kierunek, a nie zasada.

## 13. social-media-skills / tiktok-script (Social Media Skills)
Wzięte:
- pisarz: nie brzmieć jak reklama (bez tonu spikera, bez "w marce X wierzymy", bez planszy z hasłem);
- reżyser hooka: hook na trzech kanałach naraz (słowo, napis, obraz) i najmocniejszy kadr przed pierwszym słowem;
- animator: bez planszy z logo na starcie i bez błyszczącej oprawy reklamowej;
- przykład pętli: ostatnie zdanie przechodzi w pierwsze ("I tak skończyliśmy, kasując najczęściej zamawianą funkcję").
Nie wzięte: prompty Veo i publikacja przez WoopSocial; trendy dźwięki (kanał ich nie używa).

## 14. social-media-skills / short-form-video-script (Social Media Skills)
Wzięte:
- pisarz: test każdego zdania (łapie, uczy albo przygotowuje nagrodę, inaczej wylatuje); zdanie-most po hooku; w dłuższym filmie nowa wartość co 5-8 s; ostrożność przy zdrowiu (sen, kofeina, stres: bez obietnic leczenia);
- animator: test na wyciszeniu; widoczny postęp kroków ("2 z 3");
- do analityki (nie dla agentów): czytanie krzywej utrzymania: spadek w 0-2 s to słaba obietnica albo pierwszy kadr, urwisko w środku to pusty fragment albo tempo, wzrost na końcu to działająca pętla.
Nie wzięte: liczby z zewnętrznych raportów (80-85% bez dźwięku, 3x więcej utrzymania przy hooku warstwowym, 78% obejrzeń na TikToku) jako zasady; to szacunki do sprawdzenia, nie dane naszego kanału.

## 15. motion-team / hook-writing (Motion)
Wzięte:
- HOOKI.md: pięć etapów świadomości widza (Eugene Schwartz) i osiem wyzwalaczy; zasady pisania głosem widza i jego słowami;
- pisarz: widz z FYP to zwykle dwa pierwsze etapy, więc hook to sytuacja albo ból bez produktu; trzy hooki na różnych wyzwalaczach, najmocniejsze łączą dwa.
Nie wzięte: strategie dla etapów "świadomy produktu" i "gotowy" (to reklamy płatne, nie treści na FYP).

## 16. motion-team / hook-tactics (Motion)
Wzięte: HOOKI.md: taktyki pasujące do treści edukacyjnych (przekora i kontrast jako różne taktyki, wyjaśnienie "dlaczego", ostrzeżenie, polecenie, jeśli-to, rozpoznanie sceny, wyzwanie, odwrócona psychologia, obalanie mitu, statystyka, opowieść, wyznanie, autorytet) jako nazwy do oznaczania filmu w polu "hook_formula", żeby porównywać grupy filmów po imporcie wyników (Motion robi to samo z reklamami).
Nie wzięte: taktyki reklam płatnych (zniżka, gwarancja, kotwica ceny, wyłączność, FOMO, "kup teraz", misja marki). Uwaga z Biblii: hooki "Dlaczego...?" wypadły najsłabiej na kanale o silnikach.

## 17. motion-team / hook-voice-patterns (Motion)
Wzięte: HOOKI.md: 10 naturalnych konstrukcji zdań przełożonych na polski ("Kto miał mi powiedzieć, że...", "Mój gorący take...", "Gdybym miał trzydzieści dni do sesji..."), w tym wzór obrazowy "mówię jedno, pokazuję coś, co temu przeczy" dla reżysera hooka.
Nie wzięte: wzorce oparte na angielskim slangu bez polskiego odpowiednika ("recession indicator", "the letter in my name").

## 18. TheCraigHewitt / hook-writing (Craig Hewitt)
Wzięte: pisarz: rytm napięcie, nagroda, nowe napięcie; najlepszy materiał zasygnalizowany w pierwszych 15 s; kontekst po hooku, nie przed; HOOKI.md: hook w trzech krokach (kontekst, przerwanie, odwrócenie), już zgodny z vyralcontent.
Nie wzięte: hook na 20-30 s i rehook co 2-3 minuty (to długie filmy na YouTube).

## 19. sergebulaev / tt-hook-scripter (Serge Bulaev)
Wzięte:
- HOOKI.md i pisarz: hook dobierany do celu filmu (do końca, zapisy, komentarze, wysłania); hook otwiera pętlę i nigdy sam na siebie nie odpowiada; liczba wypowiedziana na głos; zakazane otwarcia brzmiące jak skrypt ("szczerze mówiąc"), zdanie-most "oto, czego nikt ci nie mówi" najwyżej raz;
- reżyser hooka: budżet czasu (obraz od 0,0 s, lektor 0-1,5 s, napis do 2 s, powód do zostania do 3 s); napis nie powtarza całego zdania lektora, tylko zostawia słowo-zapalnik i dokłada drugi kąt obietnicy;
- animator: pętla przez cięcie na dopasowanie do klatki 0, bez logo i podziękowań na końcu;
- recenzent: hook nie odpowiada sam na siebie, brak otwarć brzmiących jak skrypt, "hook_formula" pasuje do "cel_hooka".
Konflikt rozstrzygnięty: Jake (formuła "Nikt ci nie mówi") kontra Serge (to zdanie-most brzmi jak skrypt): zostaje jako formuła hooka, ale najwyżej raz w filmie.

## 20. archive-dot-com / ugc-hook-analyzer (Archive Technologies)
Wzięte: nie dla agentów piszących, tylko do analizy wyników (data/brand/2/ch-3/HIPOTEZY.md): każdy wniosek cytuje posty z liczbami, wzorzec z mniej niż 5 postów to tylko kierunek, porównanie grup po oznaczeniach ze skrypt.json, analiza luki (kąty i korzyści jeszcze nietestowane).
Nie wzięte: analiza twórców UGC według wielkości i brief dla twórców (nie pracujemy z twórcami zewnętrznymi).
