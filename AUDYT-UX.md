# Audyt UX: od założenia konta do pierwszego zaplanowanego filmu

Data: 2026-10-26. Zakres: lokalne TikTok Studio (`../tiktok-studio`, port 4317) jako punkt wyjścia, potem nowa wersja SaaS (`tiktok-studio-cloud`, port 4318), przetestowana w przeglądarce jak nowy użytkownik (desktop 1024 px i telefon 375 px).

Cel: każdy, kto pierwszy raz widzi produkt, ma przejść drogę "wejście na stronę, konto, kanał, pierwszy film, termin publikacji" bez instrukcji.

## 1. Problemy w obecnym (lokalnym) Studio

| # | Problem | Waga | Co z tym zrobiono w wersji SaaS |
|---|---|---|---|
| 1 | Brak kont i logowania; README sam ostrzega, że panel wystawiony publicznie jest otwarty dla każdego. | krytyczna | Rejestracja, logowanie, reset hasła, sesje, osobne dane każdego konta, testy izolacji. |
| 2 | Brak strony, która mówi, czym jest produkt. Pierwszy ekran to gęsty pulpit z liczbami (0 wyświetleń, 0%). | wysoka | Landing z obietnicą, 4 krokami, funkcjami, integracjami i FAQ. |
| 3 | Brak prowadzenia nowego użytkownika: pusty pulpit i 8 pozycji menu naraz. | wysoka | Ekran startowy z wyborem: "Wklej, co masz" (AI) albo "Krok po kroku"; na pulpicie lista "Pierwsze kroki" z postępem. |
| 4 | Okno "Nowy film" ma 13 pól, wymagany "ID (slug)", żargon (value/trick, Wizual, Głos, Tempo) i ścieżkę MP4 z dysku. | wysoka | Wymagany tylko tytuł; hook z wyjaśnieniem, po co jest; reszta zwinięta w "Więcej szczegółów (do analizy)"; ref tworzy się sam. |
| 5 | Dodanie filmu i zaplanowanie go to dwa osobne miejsca (Filmy i Kalendarz). | wysoka | W oknie "Dodaj film" od razu dzień i godzina (domyślnie najbliższy wolny dzień, szybkie godziny 12/15/18/20). |
| 6 | Godziny zapisywane bez strefy czasowej, a przypomnienia porównywane z czasem UTC: przypomnienie przychodzi godzinę lub dwie za późno, digest bierze datę UTC. | wysoka (błąd) | Terminy w UTC, wyświetlanie i wpisywanie w strefie konta, scheduler liczy godzinę i dzień w strefie każdego konta. Test: 18:00 w Warszawie zimą = 17:00 UTC. |
| 7 | Kalendarz pisze "Przypomnienia mailowe lecą automatycznie", choć mailer jest w trybie DRY. | średnia | Integracje mówią wprost, czy maile wychodzą, a test maila w trybie DRY pokazuje "zapisany w logu, nie wysłany". |
| 8 | Zaległe publikacje (termin minął, nie oznaczono) wyglądają jak zwykłe. | średnia | Czerwona sekcja "Zaległe publikacje" w kalendarzu, licznik w menu, oznaczenie na pulpicie. |
| 9 | Jedno globalne ustawienie maili i subskille dla wszystkich kont. | średnia | Ustawienia per konto: adres, godzina, dzień raportu, przypomnienia, cel dzienny, strefa, model AI. |
| 10 | Generator wideo i inne narzędzia rejestrują filmy bez żadnego uwierzytelnienia. | wysoka | Klucz API per konto, pokazany raz, z gotową komendą curl do sprawdzenia; zgodność wsteczna z polami lokalnego Studio. |
| 11 | Wyniki trzeba wpisywać tylko ręcznie. | średnia | Import CSV z TikTok Studio (kolumny PL i EN, "12,5 tys.", "1.2K", "31%") i asystent AI dla dowolnego tekstu. |

## 2. Błędy znalezione podczas testów przeglądarkowych nowej wersji (i naprawione)

| # | Co się działo | Przyczyna | Naprawa |
|---|---|---|---|
| 1 | Błędy walidacji (np. zły e-mail) zwracały 500 zamiast czytelnego komunikatu. | Wyjątki synchroniczne omijały obsługę błędów. | Opakowanie tras łapie wszystkie wyjątki; test na 400/409. |
| 2 | W kroku "Twój kanał" wpisany tekst znikał, pole nie miało fokusu. | `autofocus` nie działa na treści wstawianej dynamicznie. | Ręczne ustawienie fokusu po każdym kroku; ścieżka przechodzi samą klawiaturą. |
| 3 | Asystent AI pomylił dzień tygodnia ("w czwartek" zamienił na piątek). | Model źle liczy dni tygodnia. | Do promptu trafia lista 14 najbliższych dni z nazwami. Po poprawce: czwartek 29.10. |
| 4 | Termin z wklejonego tekstu przepadał, gdy film nie trafił na listę filmów. | Model wpisał film tylko do terminów. | Serwer tworzy brakujący film; prompt wymaga spójności. Test. |
| 5 | AI ustawiało godzinę porannego raportu na 18:00. | Pomyliło godzinę publikacji z godziną raportu. | AI nie zmienia już godziny raportu; ustawia ją użytkownik w kroku "Raporty mailem". |
| 6 | Chwilowy błąd dostawcy modelu kończył się komunikatem "Provider returned error". | Brak zapasowego modelu. | Fallback OpenRouter (Mistral Small, Qwen3) i zrozumiały komunikat. |
| 7 | Lider wyników: film z 4 tys. wyświetleń wygrywał z filmem z 38 tys. | Brak wpisanych lajków liczył się jak zero zaangażowania. | Brak danych o zaangażowaniu nie karze filmu (skalowanie pozostałych składników). |
| 8 | Film oznaczony jako opublikowany przed terminem pokazywał "Opublikowany jutro". | Data publikacji brana z planu. | Wcześniejsza publikacja zapisuje rzeczywisty czas. Test. |
| 9 | Kliknięcie pustego dnia w kalendarzu proponowało przesunięcie już zaplanowanego filmu. | Domyślny wybór pierwszego filmu z listy. | Gdy nie ma filmów bez terminu, domyślnie "Nowy film" z polem tytułu. |
| 10 | Wynik "12,5 tys" odrzucany jako błąd. | Walidacja tylko cyfr. | Parser liczb w formacie TikToka (tys., K, mln, spacje, %, s). |
| 11 | Na telefonie landing przewijał się w bok (514 px przy 375). | Siatki w ilustracjach bez `minmax(0, 1fr)`. | Poprawione siatki; zero poziomego scrolla na wszystkich ekranach. |
| 12 | Na telefonie nagłówek strony chował się pod górnym paskiem. | Fokus na widoku przewijał stronę. | Fokus bez przewijania, przewinięcie na górę przy zmianie ekranu. |
| 13 | Skrypt strony głównej nie działał (błąd w konsoli). | Zmienna `top` koliduje z `window.top`. | Skrypt w izolowanym zakresie. |
| 14 | Formularz logowania mógł, przy wyścigu ładowania, wysłać e-mail w adresie URL. | Domyślna metoda GET. | `method="post"` na wszystkich formularzach kont. |
| 15 | Kalendarz: przeszłe tygodnie zajmowały cały ekran, tytuły ucięte do 3 liter. | Stała wysokość dni, jedna linia tekstu. | Przeszłe dni niższe, tytuł w 2 liniach. |
| 16 | "1 terminów", "3 filmów", kropka zamiast przecinka w liczbach. | Brak polskiej odmiany i formatowania. | Funkcja odmiany, przecinek dziesiętny. |
| 17 | "Wpisz wyniki" przy filmie, który jeszcze nie wyszedł; e-mail pokazany dwa razy w menu; mobilne menu nie zamykało się kliknięciem obok; brak wyróżnionej godziny w szybkich przyciskach; tytuł z kolejki małą literą. | Drobne niedopatrzenia. | Wszystkie poprawione. |

## 3. Przejście całej ścieżki (wynik testu)

Ścieżka A, asystent AI (konto testowe "Ola"): strona główna, "Załóż konto", walidacja pustego formularza, rejestracja, ekran startowy, "Wklej, co masz", "Wstaw przykład", analiza (ok. 15 s), podgląd (kanał, 3 filmy, 3 pomysły, termin czw 29.10 18:00), zapis, raporty mailem, ekran "Gotowe". Działa.

Ścieżka B, krok po kroku (konto "Marek", tylko klawiatura): rejestracja, "Krok po kroku", nazwa kanału, tytuł filmu, termin (jutro 20:00), maile, "Gotowe". Działa.

Po konfiguracji przetestowane ekrany: Pulpit (pierwsze kroki, statystyki, najbliższe publikacje, lider), Filmy (zakładki, wyniki, edycja, usuwanie), Kalendarz (miesiąc, klik w dzień, nowy film z dnia, zaległe, okno terminu), Kolejka (dodanie tematu, przesuwanie, "Zrób film" z terminem), Analiza, Integracje (klucz API, zapytanie kluczem jak generator, import CSV, testowy mail), Ustawienia (zapis, błędne hasło), reset hasła z linkiem, wylogowanie, telefon 375 px.

Testy automatyczne: `npm test`, 16 z 16 (rejestracja, logowanie, CSRF, ręczna konfiguracja, terminy w strefie, wyniki, analiza, kolejka, klucz API i stare pola generatora, izolacja kont, CSV, zapis z AI, przypomnienia, zmiana i reset hasła, usunięcie konta, strefy czasowe).

## 4. Co zostaje na później

- Maile realnie wyjdą dopiero po wpisaniu kluczy Brevo w `.env` na serwerze (lokalnie tryb DRY).
- Brak zespołów (kilka osób w jednym studiu) i płatności; model danych (workspace) jest na to gotowy.
- Brak automatycznego pobierania wyników z TikToka (oficjalne API wymaga zgody TikTok); dziś: ręcznie, CSV albo API.
- Przeciąganie kart w kolejce myszką (dziś przyciski "Dalej" i "Wstecz", które działają też na telefonie i z klawiatury).
