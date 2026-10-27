# B-roll: co mamy i jak tego używać

Kopie w `~/.claude/skills/tiktok-silnik-film/assets/broll/`. Oryginały w `/Users/antoni/Downloads/ssstik.io_@<autor>_*.mp4` (pobrane z TikToka). Wszystkie pionowe, niska rozdzielczość (540 do 720 px szerokości), więc skalujemy do 1080x1920 z przycięciem i trzymamy krótko (1 do 4 s). NIE mają dźwięku w filmie (`-an`, `muted`).

## Używane (sprawdzone w filmach)

| Plik | Długość | Zawartość | Dobre fragmenty (start, długość) | Do czego |
|---|---|---|---|---|
| `1-filipzabielski65.mp4` | 15,5 s | chłopak liczy banknoty na stole, śnieg przed willą, wanna z płatkami róż, bilard, kryty basen | kasa: 0,0 do 2,0 | "płacisz", "kasa", koszty, luksus |
| `2-speedkar9.mp4` | 56 s | rozebrany V6 na trawie, ręka w rękawicy pokazuje fioletowym długopisem łańcuch rozrządu, miska olejowa, wnętrze | 0,4 / 2,4 (rozbiórka), 19,3 / 1,7 (silnik), 35,2 / 1,0 | rozbiórka silnika, "rozebrany do ostatniej śruby", mechanika |
| `3-brembohoward.mp4` | 14,5 s | czerwone małe auto skacze po polu, jedzie przez błoto, ląduje w stawie, dachuje | 0,3 / 3,6 (jazda pod górkę), 1,8 / 1,7 (skok) | "zajechać", rajd, jazda w terenie, porażka |
| `4-altuniverse.ai.mp4` | 15 s | widok z kokpitu na autostradzie, przed nami zardzewiały VW Golf kombi w kamuflażu dymi czarnym dymem | 0,5 / 2,36 (hook), 0,5 / 4,4 (kombi), 0,6 / 3,0 (auto) | autostrada, kombi, diesel, dymienie, "pełne auto" |
| `5-aimechanicvibes.mp4` | 10 s | (AI) zbliżenie zardzewiałego cylindra: świeca, iskra, dym, tłok | 5,2 / 1,8, 5,6 / 1,1 (iskra) | zapłon, iskra, spalanie, samozapłon |

Już wycięte wersje z poprzednich filmów (nazwa → źródło): `c1-rozbior` (speedkar9 0,4 / 2,4), `c2-skok` (brembohoward 1,8 / 1,7), `c3-iskra` (aimechanicvibes 5,6 / 1,1), `c4-kasa` (filipzabielski65), `c5-kombi` (altuniverse), `d1-auto` (altuniverse 0,6 / 3,0), `d2-gorka` (brembohoward 0,3 / 3,6), `d3-silnik` (speedkar9 19,3 / 1,7), `d4-iskra` (aimechanicvibes 5,2 / 1,8), `d5-walenie`, `d6-kasa`, `e1-autostrada`, `e2-lodka`, `e3-iskra`, `e4-tuner`, `e5-kasa`, `f1-kombi` (altuniverse 0,5 / 4,4). Nie kopiuj starych wycinków, wytnij na nowo z źródła pod długość ujęcia.

## Dostępne, jeszcze nieużyte

| Plik | Długość | Zawartość | Uwagi |
|---|---|---|---|
| `x-lilannachen.ytb.mp4` (w skillu) | 6 s | biały SUV dymi na parkingu przy budce poboru opłat, biały bus stoi w chmurze pary na drodze | przegrzanie, awaria, dym; znak wodny w rogu |
| `x-nm_auto1.mp4` (w skillu) | 9,3 s | gęsty biały dym z wydechu auta na parkingu, chmura zasłania kadr | "pali olej", uszczelka pod głowicą, zimny start |
| `x-d.krbxy.mp4` (w skillu) | 11,8 s | rozbity VW Golf, dym z wydechu, logo VW "Das", czarne pasy (materiał poziomy) | trzeba przyciąć, czarne pasy |
| `/Users/antoni/Downloads/ssstik.io_@ceramizator_*.mp4` | 52 s | reklama Ceramizatora: opiłki w oleju, zegary, głowica, pompa oleju | WYPALONE NAPISY i marka: tylko krótkie kawałki bez tekstu albo przykryte; nie reklamować marki |
| `/Users/antoni/Downloads/ssstik.io_@funnydog_0411_*.mp4` | 64 s | kompilacja "Mechanic fail": zmiana koła, podnośnik, wgniecenie, nawiew | wypalone napisy, czarne plansze; tylko wycinki |
| `/Users/antoni/Downloads/ssstik.io_@te_videos_*.mp4` | 9,5 min, 131 MB | POV mechanika w warsztacie: praca pod autem, komora silnika, klucze | dużo czystego materiału "warsztat" bez napisów |

Pliki `/Users/antoni/Downloads/broll-scene-*.mp4` i `broll-1789...mp4` to materiał z innego projektu (pielęgnacja twarzy), NIE do motoryzacji.

## Jak wyciąć

```bash
ffmpeg -nostdin -v error -y -ss <start> -t <długość> -i assets/broll/src/<plik>.mp4 -an \
  -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" \
  -c:v libx264 -preset fast -crf 17 -g 10 -pix_fmt yuv420p assets/broll/cut/<nazwa>.mp4
```
`-g 10` = gęste klatki kluczowe, żeby render mógł przewijać dokładnie.

W `index.html`:
```html
<video id="br-kombi" class="broll" src="assets/broll/cut/f1-kombi.mp4" data-start="23.32" data-duration="4.18" data-media-start="0" data-track-index="20" muted playsinline></video>
```
Ujęcie w tabeli `SHOTS` ma rodzaj `"broll"`; w tym czasie canvas i `#ui` są ukryte, widoczna warstwa `#brUi` (napisy natywne, stemple).

## Zasady B-rolla

- Tylko gdy treść mówi o świecie (droga, kasa, rodzinne auto, warsztat, dym), nie jako wypełniacz. Mechanizm pokazujemy na modelu.
- Napisy natywne albo stemple na B-rollu dosłownie ze słów lektora.
- Filtr `contrast(1.06) saturate(0.96)`, kadr pełny, bez ramek.
- Źródło spoza listy: Antoni pobiera z TikToka przez ssstik.io; nie pobieraj niczego sam z niezaufanych stron, zaproponuj, czego szukać.
