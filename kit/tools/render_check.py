"""Kontrola po renderze: czy MP4 wyglada jak snapshoty, na ktorych byly bramki.

  python3 render_check.py project/renders/film.mp4 project/snapshots

Snapshoty musza miec czas w nazwie (np. frame-03-at-4.9s.png, jak z npx hyperframes snapshot). Dla kazdego
wyciaga klatke z MP4 w tej samej sekundzie i liczy srednia roznice jasnosci (0-255) na zmniejszonym obrazie.
Ruch miedzy klatkami daje zwykle ponizej 25; zepsuty render (np. animacje nie zadzialaly i wszystkie sceny
leza na sobie) daje duzo wiecej. Wynik PASS albo FAIL z lista klatek. Nie kosztuje nic (bez modelu).
"""
import glob, os, re, subprocess, sys, tempfile
import numpy as np
from PIL import Image

LIMIT = 30.0
if len(sys.argv) < 3: sys.exit(__doc__)
mp4, snaps = sys.argv[1], sys.argv[2]
rows, worst = [], 0.0
with tempfile.TemporaryDirectory() as tmp:
    for f in sorted(glob.glob(os.path.join(snaps, "*.png")) + glob.glob(os.path.join(snaps, "*.jpg"))):
        m = re.search(r"at-([0-9.]+)s", os.path.basename(f)) or re.match(r"t([0-9]+\.[0-9]+)\.(png|jpg)$", os.path.basename(f))
        if not m: continue
        t = float(m.group(1).rstrip("."))
        out = os.path.join(tmp, "f.png")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-i", mp4, "-frames:v", "1", out], check=True)
        a = np.asarray(Image.open(f).convert("L").resize((108, 192)), dtype=np.float32)
        b = np.asarray(Image.open(out).convert("L").resize((108, 192)), dtype=np.float32)
        d = float(np.abs(a - b).mean()); worst = max(worst, d)
        rows.append((t, d))
for t, d in rows: print(f"{t:6.2f} s: roznica {d:5.1f}{'  <- inna niz snapshot' if d > LIMIT else ''}")
if not rows: sys.exit("FAIL: brak snapshotow z czasem w nazwie")
if worst > LIMIT:
    print(f"FAIL: render rozni sie od snapshotow (max {worst:.1f}, limit {LIMIT:.0f}). Wyrenderuj ponownie z --sdr; jesli nadal FAIL, szukaj elementow bez animacji wejscia/wyjscia.")
    sys.exit(1)
print(f"PASS (max {worst:.1f})")
