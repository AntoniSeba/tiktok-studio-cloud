"""Kontrola dynamiki BEZ kołysania (styl kolażu):
  python3 motion_check.py project/renders/<slug>.mp4
Liczy różnicę między kolejnymi klatkami (szarość 108x192). Wymagania:
- ODDECH: obraz stoi nieruchomo (różnica < 0,05) przez co najmniej 25% czasu (rzeczy w spoczynku się nie kołyszą).
- BEZ KOŁYSANIA: żaden ciągły ruch nie trwa dłużej niż 2 s (wejścia, przemiany i przejścia są krótkie).
- RYTM (kasyno): coś nowego zaczyna się najpóźniej co 3 s.
- Twarde cięcia (skok > 25): max 1 na 15 s.
- OKO WIDZA: nowa rzecz pojawia się blisko miejsca poprzedniej zmiany albo środka (skok > 750 px max 1 na 20 s); zmiany w górnej części ekranu są wypisane do sprawdzenia.
Wynik: MOTION: OK albo lista miejsc do poprawy (czasy w s)."""
import subprocess, sys, numpy as np
src = sys.argv[1]
fps = 30
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", f"fps={fps},scale=108:192,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, 192, 108).astype(np.float32)
d = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
dur = len(f) / fps
moving = d >= 0.05
still_share = 1 - moving.mean()

runs, starts, run, start = [], [], 0, 0
for i, x in enumerate(list(moving) + [False]):
    if x:
        if run == 0: start = i; starts.append(i / fps)
        run += 1
    else:
        if run / fps > 2.0: runs.append((round(start / fps, 1), round(run / fps, 1)))
        run = 0
gaps, last = [], 0.0
for t in starts + [dur]:
    if t - last > 3: gaps.append((round(last, 1), round(t - last, 1)))
    last = t
cuts = []
for i in np.nonzero(d > 25)[0]:            # cut = an isolated one-frame jump (a page swipe moves over several frames)
    if (i > 0 and d[i - 1] > 8) or (i + 1 < len(d) and d[i + 1] > 8): continue
    t = round(float(i + 1) / fps, 2)
    if not cuts or t - cuts[-1] > 0.2: cuts.append(t)
allowed = max(1, int(dur // 15))

# OKO WIDZA: where does each new change happen? (centroid of the changed area during each motion run)
H, W = f.shape[1], f.shape[2]
jumps, tops, focus = [], [], (W / 2, H * 900 / 1920)
i = 0
while i < len(moving):
    if not moving[i]: i += 1; continue
    j = i
    while j < len(moving) and moving[j]: j += 1
    diff = np.abs(f[j] - f[i]) > 12                      # what changed between the start and the end of this run
    area = diff.mean()
    if area > 0.45: focus = (W / 2, H * 900 / 1920)        # whole screen changed (page swipe, zoom): eye resets to centre
    elif area > 0.004:
        ys, xs = np.nonzero(diff); c = (xs.mean(), ys.mean())
        dist = np.hypot((c[0] - focus[0]) * 1080 / W, (c[1] - focus[1]) * 1920 / H)
        t = round(i / fps, 1)
        if c[1] * 1920 / H < 450: tops.append(t)
        if dist > 750: jumps.append(t)
        focus = c
    i = j
eye_ok = len(jumps) <= max(1, int(dur // 20))
print(f"oko widza: skoki wzroku > 750 px: {jumps or 'brak'} (dozwolone {max(1, int(dur // 20))}) | nowe rzeczy w górnej części ekranu (y < 450): {tops or 'brak'}")
ok = still_share >= 0.25 and not runs and not gaps and len(cuts) <= allowed and eye_ok
print(f"czas {dur:.1f} s | nieruchomo {still_share * 100:.0f}% (min 25%) | ciągły ruch > 2 s: {runs[:8] or 'brak'}"
      f" | przerwy bez niczego nowego > 3 s: {gaps or 'brak'} | twarde cięcia: {cuts or 'brak'} (dozwolone {allowed})")
print("MOTION: OK" if ok else "MOTION: POPRAW (ciągły ruch / mało bezruchu = usuń kołysanie, oddech, pływające tła: rzecz po wejściu stoi;"
      " przerwa = dodaj stempel, liczbę, taśmę, przekreślenie albo przejście; cięcie = zamień na przełożenie strony; skok wzroku = połóż nową rzecz blisko miejsca poprzedniej zmiany albo prowadź wzrok strzałką, bez przesuwania)")
sys.exit(0 if ok else 1)
