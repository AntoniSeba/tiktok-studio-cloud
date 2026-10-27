# Pułapki (każda już raz kosztowała czas)

## Render i HyperFrames

- **Zawsze `--workers 1`.** Wiele workerów zapisuje każdą klatkę jako plik (4200 plików na 140 s) i render pada na braku miejsca. Zanim zdiagnozujesz "brak miejsca", przeczytaj CAŁY błąd (raz niepotrzebnie kazałem skasować 3 GB).
- **Studio dopisuje `data-hf-id` do `index.html`.** Edytuj z tolerancją na te atrybuty (regex, nie dokładny string); renderuj z izolowanej kopii z wyczyszczonymi atrybutami (`tools/render.sh`).
- **Render tylko na polecenie.** Po zmianach Studio.
- Jeden render naraz; czekaj na koniec `until ! pgrep -f "hyperframes@0.8.58 render"; do sleep 5; done` (w tle).
- `data-duration` roota i audio = długość `vo.mp3`.
- `window.__timelines["main"]` musi istnieć (pusty gsap timeline), inaczej HyperFrames nie widzi kompozycji.
- Port 4330 zajmuje serwer modeli 2JZ (`python3 -m http.server 4330 --directory /Users/antoni/projekty`); Studia na 4324, 4326, 4328, 4332... każdy film swój port.

## Kod animacji

- **Czysta funkcja czasu.** Żadnego `clock.getDelta()`, akumulacji kątów, wygładzania klatka po klatce, `setTimeout`. Kąty z całki prędkości policzonej raz.
- **`visible` tylko boolean.** Three sprawdza `visible === false`, więc `visible = st.pow && ...` z `st.pow = 0` daje `0` i obiekt dalej się renderuje (ze starą pozycją z innego ujęcia). Zawsze `!!`.
- **Zerowe normalne = czarne prostokąty.** Zdublowane punkty w konturach `ExtrudeGeometry` dają normalne (0,0,0), shader robi NaN, SSAO i bloom rozmazują to w czarne bloki. `fixNormals(root)` na każdym modelu.
- **SSAO**: seedowany `Math.random` przy tworzeniu (inaczej szum inny w każdym renderze) i `usePassCam(cam)` przed każdym panelem splitu (SSAO trzyma własne macierze projekcji).
- **Split**: kamerę panelu B ustaw (`applyCam(..., cameraB)`) ZANIM narysujesz nakładki SVG, które przez nią rzutują (wymiary, strzałki). Inaczej po przewinięciu osi czasu nakładka bierze kamerę z poprzedniej klatki.
- **Stałe przed użyciem**: `const` użyte w bloku budującym planszę na starcie modułu musi być zdefiniowane wyżej w pliku (błąd "Cannot access 'ORDER_ID' before initialization" wywala cały film).
- **Klon materiału do podświetlenia traci przezroczystość Fresnela** (`onBeforeCompile` się nie kopiuje). Części, które mają znikać w trybie przezroczystym, chowaj.
- **`getTotalLength()` / `getPointAtLength()`** działa tylko na widocznym SVG: najpierw `display: block` grupy planszy, potem pomiar.
- **Cienie `.shade-top/.shade-bot` leżą NAD SVG** (`#ui` z-index 5 > `#svg` 4). Linie i opisy SVG w dolnej części kadru giną pod gradientem; w takich ujęciach zmniejsz `.shade-bot`.
- Kolejność świateł: najpierw kamera, potem `lightAt(base, cam)` (światło po stronie kamery).
- Model obrócony w grupie nadrzędnej: `worldCenter` i bboxy licz po `updateMatrixWorld(true)`.
- Błędy importów w modelach Antoniego się zdarzają (brak `taperBox` w Audi): testuj model w node przed filmem (`buildEngine` z materiałami-atrapami przez Proxy, bbox, NaN w geometrii).

## Audio i transkrypcja

- `hyperframes transcribe` NADPISUJE `assets/transcript.json`: kopia przed ponownym puszczeniem.
- Mierz na pliku po wycięciu ciszy, nie przeliczaj z oryginału.
- Transkrypcja skleja i myli słowa ("Wtwórce", "słów pracy", "Rerl", "twórki", "naprzód"): czas z transkrypcji, tekst ze skryptu. Gdy coś brzmi odwrotnie merytorycznie, puść fragment osobno.
- Nie wycinaj z nagrania nic poza ciszą bez pytania (raz wyciąłem zamierzone "Byczku"). Podsumowanie na końcu: wycinamy zawsze i mówimy o tym.
- Szczyt MP4 ok. -3,5 dBFS; -1,3 dBFS przesterowuje na niektórych kodekach. Poprawka bez renderu: `ffmpeg -i in.mp4 -af volume=-2dB -c:v copy -c:a aac out.mp4`.
- SFX jako FLAC, nie mp3 (przesunięcie o kilkadziesiąt ms).

## Podgląd i przeglądarka

- Karta "seed" sama przełącza się na Studio: do surowego podglądu otwieraj nową kartę (`tabs_create` + `navigate`).
- Surowy podgląd ma `#root` o wysokości 0 i nie ma fontów: fragment 1 z `debug-snippets.js`. Bez fontów napisy wyglądają szerzej niż w renderze.
- Zrzut ekranu nie łapie WebGL: `snapAt(t)` kopiuje canvas do `<img>`.
- Surowy podgląd nie steruje klipami B-roll: wszystkie `<video class="broll">` leżą naraz na wierzchu. W `snapAt` pokazuj tylko klip, w którego oknie (`data-start`, `data-duration`) jest t, ustaw mu `currentTime = t - start` i poczekaj na `seeked`; dopiero potem zrzut (Studio i render robią to same).
- Viewport 1080x1920 kasuje się przy zmianie szerokości panelu i na końcu tury: ustaw ponownie przed zrzutami.
- Długi asynchroniczny kod w `javascript_tool` wisi: pomiary (np. szew pętli) synchronicznie, w osobnym wywołaniu.
- `read_console_messages` pokazuje też stare błędy z poprzednich wczytań: oceniaj po świeżym przeładowaniu.
- Studio odtwarza na żywo i może się przycinać (SSAO, dwa silniki): MP4 jest płynny, powiedz to Antoniemu.

## Powłoka

- zsh: niecytowana zmienna w pętli z ffmpeg psuje ścieżki ze spacjami. Pętle w `bash -c '...'`, ścieżki w cudzysłowach.
- macOS `sed -i ''` (z pustym argumentem).
- ffmpeg z filtrami (`subtitles=`) nie lubi spacji w ścieżce: uruchamiaj z katalogu projektu ze ścieżkami względnymi.
- Nie zabijaj procesów, których nie uruchomiłeś.
