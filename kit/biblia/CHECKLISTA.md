# Checklista Biblii TikToka (bramka każdego filmu)

[S] = sprawdza skrypt (`scripts/audyt.py` albo pojedynczy skrypt), [R] = ręcznie, głową.
Film nie wychodzi do Antoniego z żadnym FAIL w [S] i z żadnym pustym polem w [R].

## A. Przed skryptem (temat i plan testu)
1. [R] Karta DNA kanału istnieje i ją znam (`DNA.md`: wyróżnik, sygnatura klatki 0, znak marki, paleta, głos, stałe elementy).
2. [R] Temat ma stawkę osobistą: kieszeń, duma, tożsamość, spór, legenda. Nie "ciekawostka", nie ton wykładu.
3. [R] Zmienna testu wpisana do `EKSPERYMENTY.md`: co ten film robi inaczej niż 3 poprzednie (1 do 2 zmienne) i hipoteza.
4. [R] Ten sam film nie był już publikowany. Ta sama konstrukcja hooka nie była użyta 2 razy z rzędu.
5. [R] Kompozycja wybrana świadomie (powody, historia, quiz, ranking, mit kontra fakt, eksperyment, POV...), nie z przyzwyczajenia.

## B. Skrypt
6. [R] Pierwsze zdanie = najmocniejsza informacja filmu podana wprost (teza, liczba w sprzeczności, oskarżenie w 2. osobie, fakt wprost). Bez pytania "dlaczego", bez wstępu.
7. [R] Hook spłacony do 4. s (pierwszy dowód, nie zapowiedź).
8. [R] Obietnica w 3 do 10 s: konkretna (nazwa, liczba, marka), widoczna na ekranie.
9. [R] Drugi hook w 8 do 12 s i ponowne zahaczenia w ok. 1/3 i 2/3 filmu.
10. [R] Nagroda dowozi obietnicę dosłownie i z naddatkiem ("kurwa, nauczyłem się").
11. [R] Magnes na komentarz zaplanowany i zapisany (anomalia, drobny nieszkodliwy błąd, niedopowiedzenie, kontrowersyjne miejsce, słowo-dziwak), z gotową odpowiedzią do przypięcia. Błąd nigdy w tezie ani w radzie o pieniądzach, zdrowiu, bezpieczeństwie.
12. [R] Ego bait: rama "dla znawców" w pierwszych 10 s i przy pytaniu, subtelnie.
13. [R] Pytanie-wybór A/B, na które da się odpowiedzieć dopiero po obejrzeniu. Zero "napisz TAK", zero "daj lajka, jeśli".
14. [R] Powód do zapisu (lista, liczby, procedura) i zdanie do udostępnienia.
15. [R] CTA wplecione w temat: problem zasiany wcześniej, produkt jako rada albo dowód, przed nagrodą albo jako puenta.
16. [R] Koniec urwany, BEZ podsumowania. Ostatnie słowa wpadają w pierwsze zdanie (pętla zdaniowa).
17. [R] Długość wynika z gęstości: każdy segment ma mikronagrodę. Słowa pod tempo 1,12x (ok. 2,6 do 2,9 słowa/s).
18. [R] Fakty sprawdzone, zero zmyślonych badań i statystyk.

## C. Lektor
19. [S] `tts_tnij.py`: każda cisza i oddech wycięte, przerwy max 120 ms, start max 30 ms, mowa zachowana 100%.
20. [S] Tempo 1,12x zastosowane dokładnie raz (na lektorze albo `przyspiesz.py` na MP4).
21. [R] Transkrypcja słowo w słowo z przetworzonego pliku; nic nie wycięte z treści bez pytania.

## D. Produkcja
22. [S] Klatka 0 w ruchu, dźwięk od pierwszej setnej (`petla.py`, `audyt.py`).
23. [R] Nagłówek z tezą stoi od klatki 0, czytelny bez dźwięku. Sygnatura DNA widoczna w pierwszej klatce.
24. [S] Hook gęsty: mediana odstępu zmian max 1,6 s w pierwszych ok. 6 s (`kasyno.py`).
25. [S] Efekt kasyna: brak przestojów ponad 3,5 s (explainer), zmienność odstępów co najmniej 0,25, zero serii 3 równych odstępów (`kasyno.py`).
26. [R] Siła trafień zmienna (małe, średnie, duże), duże trafienia w nieprzewidywalnych momentach; najwyżej 2 ujęcia tego samego typu pod rząd; B-roll z prawdziwego świata.
27. [S] Martwe strefy: żaden napis w y < 250, y > 1430 ani w prawej szynie (x > 850, y > 1000); nic uciętego (`strefy.py`).
28. [S] Pętla: ostatnia klatka = pierwsza (szew nie większy niż zwykła różnica klatek), koniec bez wyciszenia i czarnej klatki (`petla.py`).
29. [R] Każde wejście grafiki na słowie lektora; jedna informacja pokazana raz; zero literówek; smooth (bez fleszy poza hookiem, bez pompowania kamery).
30. [S] Audio: szczyt ok. -3,5 dBFS (nie powyżej -1), głośność ok. -14 LUFS (`audyt.py`).

## E. Oddanie i publikacja
31. [R] Raport dla Antoniego: wynik audytu, co film testuje, magnes i ego bait, pełne ścieżki bezwzględne. Grep półpauz = 0.
32. [R] Pytanie-wybór także w opisie i jako przypięty komentarz; odpowiedź na magnes gotowa do przypięcia po pierwszej fali.
33. [R] Render i publikacja tylko na wyraźne polecenie.

## F. Po publikacji (48 h)
34. [S] `analiza_eksportu.py` na eksporcie z TikTok Studio.
35. [R] Wynik do `EKSPERYMENTY.md`: retencja 5 s, strata 2 do 5 s, retencja 30 s, średni czas, komentarze, udostępnienia, zapisy na 1000, wyświetlenia; decyzja: zostaje, odpada, test jeszcze raz.
36. [R] Najlepsze komentarze zamienione w kolejne hooki albo odpowiedzi filmem.
