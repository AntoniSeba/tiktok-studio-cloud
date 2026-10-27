# Dźwięk: lektor, efekty, poziomy

## Lektor

- ElevenLabs, Adam - Compelling (PVC), speed 100, stability 50, similarity 80, model v3.
- Cięcie ciszy i poziom: `tools/prepare_vo.sh` (szczyt ok. -3,6 dBFS).
- Nic nie może zagłuszać słów.

## Efekty dźwiękowe: zasady Antoniego

Kontekst: "zwykle używasz efektów totalnie bez sensu, bez wyczucia, w losowych momentach", "PROSZĘ NIE ZAWIEDŹ MNIE"; syntetyczne SFX w filmie o klinie olejowym: "tragedia totalna", usunięte.

1. **Najpierw tabela, potem dźwięk.** Rozpisz: moment (s), co się dzieje na ekranie, jaki dźwięk, dlaczego. Pokaż Antoniemu. Dodajesz dopiero po akceptacji. Bez tabeli żadnych SFX (filmy downsizing, V8, R5 poszły bez SFX).
2. Każdy dźwięk ma widoczną przyczynę w tej samej klatce.
3. Ruch = whoosh (jedna rodzina na film, różnicowana długością). Pojawienie się = pop lub migawka. Podświetlenie = cichy dźwięk podświetlenia. Część silnika odczepia się = metaliczny stuk (cięższa część, niższy dźwięk).
4. Riser tylko przed prawdziwą nagrodą. Hit tylko 2 do 3 razy na minutę, jako rozładowanie (często po riserze). Dron na tajemnicę ("???", zakryta karta).
5. Bęben i liczniki: tyknięcie na każdą przejeżdżającą pozycję, więc dźwięk zwalnia razem z obrazem; na zatrzymaniu "payout ding".
6. Pod lektorem cicho: hity 8 do 13 dB pod głosem; szczyt całości -3 dBFS.

## Źródła

- **Mixkit** (licencja darmowa bez atrybucji, WAV do pobrania bez logowania): `https://assets.mixkit.co/active_storage/sfx/<id>/<id>.wav`. Kategorie: whoosh, transition, impact, mechanical, metal, slot-machine.
- Zapsplat wymaga konta (nie zakładaj za Antoniego).
- W skillu (`assets/sfx/`, z filmu Wankel):

| Plik | Użycie |
|---|---|
| `1490-whoosh.wav` | wjazd elementu, cięcie z ruchem |
| `2650-spin-whoosh.wav` | obrót, rozkręcenie |
| `166-sweep.wav`, `2639-metal-sweep.wav` | przejazd kamery wzdłuż metalu |
| `1932-slot-wheel.wav` | bęben "Na końcu" w ruchu |
| `1935-payout-ding.wav` | bęben staje na odpowiedzi |
| `2295-riser.wav` | przed nagrodą |
| `2908-impact.wav` | hit po riserze, werdykt |
| `2297-rumble.wav` | dron, tajemnica, silnik |
| `3005-pop.wav`, `1131-click.wav` | pojawienie się chipa, cyfry, karty |
| `833-hammer.wav`, `2858-gear-lock.wav`, `2799-scrape.wav` | części silnika, zatrzaśnięcie, tarcie |

## Składanie ścieżki

`assets/tools/build_sfx.py` (wzór z filmu Wankel): próbki ładowane przez ffmpeg do numpy, czasy liczone Z KODU ANIMACJI (te same tory co bęben i liczniki), nie na oko, mix do `assets/sfx/sfx-mix.wav`, potem FLAC. Do kompozycji wpinamy **FLAC, nie mp3** (mp3 przesuwa dźwięk o kilkadziesiąt ms):
```html
<audio id="sfx" src="assets/sfx/sfx-mix.flac" data-start="0" data-duration="D" data-track-index="31"></audio>
```
Przed wpięciem zmierz poziom każdego zdarzenia względem głosu i szczyt całości. Przykładowa tabela i znaczniki: `reference/dzwieki-wankel-tabela-przyklad.md`, `assets/sfx/cues-wankel-przyklad.json`.

## Muzyka

Dotąd shorty bez muzyki (sam lektor). Jeśli Antoni poprosi: nastrój pod segment, cisza muzyki na wyjątkowy moment, wyciszenie zapowiada koniec segmentu, zmiana tematu zsynchronizowana z mocniejszą częścią utworu; muzyka zawsze pod głosem.
