# Pipeline techniczny: od lektora do Studio (i MP4 na polecenie)

## 0. Wejście

Antoni wrzuca plik z ElevenLabs, np. `/Users/antoni/Downloads/ElevenLabs_2026-09-25T19_10_32_Adam - Compelling_pvc_sp100_s50_sb80_v3.mp3`.
Głos: **Adam - Compelling** (PVC), speed 100, stability 50, similarity boost 80, model v3. Tekst do lektora = plik `*-tts.txt` ze skilla `tiktok-silnik-skrypt`.

Samo wrzucenie pliku po skrypcie znaczy: "zrób film ze wszystkimi komponentami". Nie pytaj, rób.

## 1. Projekt

Filmy trzymamy w `<workspace>/videos/<id>` (w tej sesji był to folder sesji `.../scratch-2026-09-20-17b148/videos`; jeśli go nie ma, zapytaj Antoniego o folder albo użyj `request_directory`). Skrypty w `<workspace>/skrypty`.

```bash
bash ~/.claude/skills/tiktok-silnik-film/assets/tools/new_project.sh "<workspace>/videos" <id> <model1> [model2]
```

Kopiuje szablon (R5), narzędzia, `model/vendor` (three.js), wybrane modele, `film/turbo.js`, fonty do `.dbgfonts`. Potem w `film/main.js` podmień importy i budowę silników pod wybrane modele (API w `05-modele-3d.md`).

Struktura:
```
index.html            kompozycja (#root z data-duration = D, canvas #gl, svg #svg, #ui, plansze #bd, karty #eng, audio #vo)
film/main.js          cały obraz jako funkcja czasu renderAt(t), nasłuch "hf-seek"
film/turbo.js         samodzielna turbosprężarka (opcjonalnie)
model/<nazwa>/        modele w wersji filmowej
model/vendor/         three.module.js + addons (importmap: "three" → ./model/vendor/three.module.js)
assets/vo-raw.mp3     oryginał lektora
assets/vo-cut.mp3     po wycięciu ciszy
assets/vo.mp3         z poziomem (to idzie do kompozycji)
assets/transcript.json  słowa z czasami (z vo-cut, czasy identyczne jak vo)
assets/broll/cut/     wycięte fragmenty B-rolla 1080x1920
tools/                cut_silence.py, align.py, make_captions.py, prepare_vo.sh, render.sh, build_sfx.py
.dbgfonts/            fonty do surowego podglądu
```

## 2. Lektor

```bash
cd <projekt> && bash tools/prepare_vo.sh "/Users/antoni/Downloads/ElevenLabs_....mp3"
```

- Cięcie ciszy: `silencedetect=noise=-33dB:d=0.10`, zostaje 60 ms oddechu na każdym cięciu, typowo -12 do -20 procent długości (190 s → 166 s).
- Poziom: szczyt `assets/vo.mp3` ok. -3,6 dBFS.
- Transkrypcja: `npx --yes hyperframes@0.8.58 transcribe assets/vo-cut.mp3 -m medium -l pl --json` (zapisuje `assets/transcript.json`, NADPISUJE, więc kopia). Alternatywa z podpowiedzią nazw: `tools/transcribe_whisper.py` (whisper medium z `initial_prompt` z nazwami: "Quattro, Röhrl, Pikes Peak, TFSI...").
- Wypisz słowa `słowo@start` i na tej liście planuj każde wejście.
- Sprawdź, czy lektor nie nagrał podsumowania na końcu. Jeśli tak: utnij audio tuż po ostatnim słowie CTA + zdaniu pętli (ffmpeg `-t`), zachowaj oryginał jako `vo-cut-full.mp3`, powiedz Antoniemu.
- Transkrypcja myli nazwy ("Wtwórce" = "W czwórce", "słów pracy" = "suw pracy", "Rerl" = "Röhrl"): czasy bierz z niej, tekst na ekran ze skryptu. Gdy coś brzmi merytorycznie odwrotnie, przepuść fragment osobno.
- Bez dostępu do wag whispera (np. sesja w chmurze z zablokowanym huggingface): `python3 tools/align_pauses.py skrypt-tts.txt assets/silence-map.json assets/transcript.json` wyrównuje tekst skryptu do fragmentów mowy między wyciętymi ciszami (granice na interpunkcji, czasy w fragmencie według sylab). Wypisuje każdy fragment z tekstem: sprawdź, czy granice wypadają na kropkach i przecinkach.
- `align.py skrypt.txt assets/transcript.json film/words.js` daje czasy dla każdego słowa skryptu (gdy potrzebne dokładne dopasowanie tekstu skryptu).
- `D` = długość `assets/vo.mp3` (ffprobe), wpisz w `#root data-duration`, w audio `data-duration` i w `main.js`.

## 3. Plan

Przed kodem rozpisz tabelę ujęć `[start, koniec, rodzaj, nazwa]` na słowach (wzór w `02-rytm-i-os-czasu.md`) i sprawdź ją regułami:
- zmiana co 2 do 3 s;
- żadne dwa kolejne ujęcia z tą samą animacją;
- nic nie jest pokazane dwa razy naraz (nagłówek vs bęben vs licznik vs etykieta);
- każdy "Powód" otwiera krótkie 3D;
- nagroda, karta serii, karta wyboru, CTA YT, pętla na swoich miejscach.

## 4. Kod (`film/main.js`)

Zasady twarde:
- **Czysta funkcja czasu.** Żadnego `clock`, `getDelta`, akumulowania, `setTimeout`, wygładzania klatka po klatce. Ta sama sekunda = ta sama klatka (render przewija oś czasu).
- `window.addEventListener("hf-seek", e => renderAt(e.detail.time))`, `window.__renderAt = renderAt`.
- W `index.html` musi być `window.__timelines["main"] = gsap.timeline({ paused: true })`.
- Importmap: `{"three": "./model/vendor/three.module.js", "three/addons/": "./model/vendor/addons/"}`.
- Kamera: klucze `P(az, el, r, x, y, z, fov, oy)` interpolowane monotonicznym Hermite (`mono`), po zbudowaniu `CAM` pętla wyrównuje `r` do stałej w ujęciu (brak pompowania). Hook i outro mają `r` = `P0.r`.
- Postprocess: RenderPass, SSAOPass (z seedowanym `Math.random`, inaczej szum różni się między klatkami), UnrealBloom (0,22 / 0,7 / 0,9), OutputPass, winieta. `usePassCam(cam)` przed każdym renderem panelu (SSAO trzyma własne macierze projekcji).
- Światło kluczowe po stronie kamery (`lightAt(base, cam)`), inaczej przód silnika bywa pod światło.
- `fixNormals(root)` na każdym modelu (zerowe normalne = czarne prostokąty po SSAO).
- `mesh.visible` tylko boolean (`!!`).
- Wał: stała prędkość z domknięciem do 720° (`CRANK_RATE`).
- Przenikanie plansza ↔ 3D w `renderAt` (wzór w szablonie: `XF = 0.4`, `render3D(t, si)`).

## 5. Weryfikacja (zawsze przed pokazaniem)

1. `npx --yes hyperframes@0.8.58 lint <projekt>` → 0 błędów.
2. Uruchom Studio (dodaj konfigurację do `.claude/launch.json` w katalogu roboczym, wolny port, np. 4332, 4334...):
   ```json
   {"name": "studio-<id>", "runtimeExecutable": "npx", "runtimeArgs": ["--yes","hyperframes@0.8.58","preview","--foreground","--port","<port>","--no-open"], "cwd": "<projekt>", "port": <port>}
   ```
   `preview_start` z tą nazwą.
3. Surowy podgląd w NOWEJ karcie (nie "seed"): `http://localhost:<port>/api/projects/<id>/preview/index.html`, viewport 1080x1920, przeładuj, odczekaj 5 s, wklej fragment 1 z `assets/tools/debug-snippets.js` (wysokość 1920, fonty, `snapAt`).
4. Przejdź klatki: co najmniej po jednej na każde ujęcie (środek ujęcia) + wszystkie kluczowe słowa. Zrzuty w skali 0,3 w `browser_batch` po 6 do 8. Patrz na: ucięte kadry, nakładanie tekstów, strefy TikToka, dublowanie, za bliskie/za dalekie kamery, czy element jest widoczny (cienie `.shade-*` przykrywają SVG).
5. Konsola bez błędów (`read_console_messages onlyErrors`; stare błędy z poprzednich wczytań też się tam pokazują, sprawdzaj po przeładowaniu).
6. Szew pętli (fragment 2): różnica t=0 vs D << różnica między sąsiednimi klatkami.
7. `grep -c "$(printf '\xe2\x80\x94')\|$(printf '\xe2\x80\x93')" <pliki>` na `index.html`, `film/*.js`, skryptach: 0.
8. Checklista Antoniego (10 punktów) punkt po punkcie.
9. Zamknij kartę testową, zresetuj viewport, otwórz Studio w karcie "seed": `http://localhost:<port>/#project/<id>`.

Uwaga: Studio odtwarza film na żywo (SSAO, dwa silniki w splicie), więc może się przycinać. MP4 jest płynny. Powiedz to Antoniemu, jeśli ogląda w Studio.

## 6. Render (TYLKO na polecenie)

```bash
bash ~/.claude/skills/tiktok-silnik-film/assets/tools/render.sh "<projekt>" "/Users/antoni/Downloads/<id>.mp4" "<scratchpad>/render-<id>"
```
- Izolowana kopia (Studio dopisuje `data-hf-id` do `index.html`, kopia jest czyszczona `sed`), zawsze `--workers 1` (wiele workerów zapisuje każdą klatkę na dysk i kończy się brak miejsca).
- Uruchamiaj w tle; 140 do 170 s filmu renderuje się ok. 5 do 8 minut.
- Po renderze: ffprobe (1080x1920, czas = D), `volumedetect` (szczyt ok. -3,5 do -3,7 dB), 3 do 4 klatki kontrolne (`ffmpeg -ss T -i out.mp4 -frames:v 1 x.jpg`) obejrzane.
- Plik ląduje w `/Users/antoni/Downloads/` pod czytelną nazwą (np. `r5-lepsze.mp4`).
- Jeśli Antoni prosi o kilka naraz, renderuj po kolei (jeden render naraz).
