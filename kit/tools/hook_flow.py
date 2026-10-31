"""Bramka OBIETNICY: czy pierwsze 5 sekund płynie i zmienia nastrój, a nie stoi jedną klatką.

  python3 hook_flow.py film.mp4                       # z gotowego MP4
  python3 hook_flow.py project/snapshots/hook5        # z klatek co 0,25 s (nazwy z at-<sekundy>s, np. ze snapshot --at)

Klatki 0,0-5,0 s co 0,25 s, zmniejszone. Liczy:
- stany: ile razy obraz wyraźnie przeszedł w nowy stan (zmiana względem poprzedniego stanu > 15, liczona na rozmytym
  obrazie, więc sam zmieniający się napis się nie liczy), cel: co najmniej 3, pierwszy do 1,5 s, potem najwyżej co 1,5 s,
- bezruch: najdłuższy odcinek, w którym obraz prawie stoi (zmiana między klatkami < 1,2), cel: najwyżej 0,75 s,
- szarpnięcia: skoki między sąsiednimi klatkami > 55 (twarde cięcie bez przejścia), cel: 0,
- nastrój: różnica między 0,0 s a 5,0 s, cel: > 25 (widz ma poczuć, że film dokądś jedzie).
Wynik PASS albo FAIL z listą przyczyn. Darmowe, bez modelu.
"""
import glob, os, re, subprocess, sys, tempfile
import numpy as np
from PIL import Image

T = [round(i * 0.25, 2) for i in range(21)]

def load(p):
    # heavy downscale + blur: captions and small text barely register, picture changes do
    from PIL import ImageFilter
    return np.asarray(Image.open(p).convert("L").resize((45, 80)).filter(ImageFilter.GaussianBlur(2)), dtype=np.float32)

def frames(src):
    if os.path.isdir(src):
        got = {}
        for f in glob.glob(os.path.join(src, "*.png")) + glob.glob(os.path.join(src, "*.jpg")):
            m = re.search(r"at-([0-9.]+)s", os.path.basename(f)) or re.search(r"t([0-9]+\.[0-9]+)", os.path.basename(f))
            if m: got[round(float(m.group(1).rstrip(".")), 2)] = f
        return [load(got[t]) for t in T if t in got]
    out = []
    with tempfile.TemporaryDirectory() as tmp:
        for i, t in enumerate(T):
            p = os.path.join(tmp, f"{i}.png")
            subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-ss", f"{t:.2f}", "-i", src, "-frames:v", "1", p], check=True)
            if os.path.exists(p): out.append(load(p))
    return out

if len(sys.argv) < 2: sys.exit(__doc__)
F = frames(sys.argv[1])
if len(F) < 15: sys.exit(f"FAIL: za mało klatek ({len(F)}); potrzeba klatek 0,0-5,0 s co 0,25 s")
step = [float(np.abs(F[i] - F[i - 1]).mean()) for i in range(1, len(F))]
states, ref, at = 0, F[0], [0.0]
for i, f in enumerate(F[1:], 1):
    if float(np.abs(f - ref).mean()) > 15: states += 1; ref = f; at.append(T[i])
gap = max(b - a for a, b in zip(at, at[1:] + [T[len(F) - 1]]))
run = longest = 0
for d in step:
    run = run + 1 if d < 1.2 else 0; longest = max(longest, run)
still = longest * 0.25
jumps = sum(d > 55 for d in step)
mood = float(np.abs(F[-1] - F[0]).mean())
print("zmiany co 0,25 s: " + " ".join(f"{d:.0f}" for d in step))
print(f"stany: {states} w {', '.join(f'{t:.2f}' for t in at[1:]) or 'brak'} s, najdłuższa przerwa {gap:.2f} s (cel >= 3, przerwa <= 1,5) | bezruch: {still:.2f} s (cel <= 0,75) | szarpnięcia: {jumps} (cel 0) | nastrój 0 s -> 5 s: {mood:.0f} (cel > 25)")
why = []
if states < 3: why.append("za mało nowych stanów: obraz musi przejść przez co najmniej 3 wyraźne kroki w 5 s (sam zmieniający się napis to nie krok)")
if gap > 1.75: why.append(f"obraz stoi w jednym stanie {gap:.2f} s: nowy obraz najpóźniej co 1,5 s")
if still > 0.75: why.append(f"obraz stoi przez {still:.2f} s: kamera, światło albo element ma płynąć cały czas")
if jumps > 0: why.append(f"{jumps} twarde skoki: łącz kroki przejściem (najazd przez obiekt, dopasowany kształt, przesunięcie kamery)")
if mood <= 25: why.append("brak zmiany nastroju: 5. sekunda ma wyglądać inaczej niż pierwsza (światło, kolor, skala, miejsce)")
print("PASS" if not why else "FAIL: " + "; ".join(why))
sys.exit(0 if not why else 1)
