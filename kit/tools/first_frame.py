"""Bramka pierwszego kadru: czy otwarcie filmu to obraz sytuacji, a nie gola plansza z tekstem.

  python3 first_frame.py project/snapshots/KLATKA_0s.png [KLATKA_1s.png]

Liczy, jaka czesc kadru to plaskie tlo (kafle 40 px o prawie jednolitym kolorze). Plansza z napisem na gladkim
tle ma go zwykle ponad 55%, zdjecie lub narysowana scena ponizej 35%. Wynik: PASS albo FAIL plus procent.
Po PASS sprawdz jeszcze tresc: python3 $KIT/tools/look.py KLATKA "Nie czytaj napisow. Co przedstawia sam obraz, w 5 slowach?"
i porownaj odpowiedz z tematem filmu. Jesli z samego obrazu nie da sie zgadnac tematu, to tez FAIL.
"""
import sys
import numpy as np
from PIL import Image

LIMIT = 0.45
worst = 0.0
for f in sys.argv[1:]:
    g = np.asarray(Image.open(f).convert("L").resize((540, 960)), dtype=np.float32)
    t = 20
    tiles = g[: 960 // t * t, : 540 // t * t].reshape(960 // t, t, 540 // t, t).swapaxes(1, 2).reshape(-1, t * t)
    flat = float((tiles.std(axis=1) < 4.0).mean())
    worst = max(worst, flat)
    print(f"{f}: plaskie tlo {flat * 100:.0f}% kadru")
if not sys.argv[1:]: sys.exit(__doc__)
print("PASS" if worst <= LIMIT else f"FAIL: otwarcie to plansza na gladkim tle (limit {LIMIT * 100:.0f}%). Daj na pelny ekran obraz sytuacji z tematu.")
sys.exit(0 if worst <= LIMIT else 1)
