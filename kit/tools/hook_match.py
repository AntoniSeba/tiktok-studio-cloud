"""Czy klatka 0,0 s filmu to projekt pierwszej klatki (hook/hook.png)?

  python3 hook_match.py project/snapshots/KLATKA_0.png hook/hook.png

Średnia różnica jasności na zmniejszonym obrazie (0-255). Do 22: ta sama kompozycja (drobne różnice ruchu i renderu).
Więcej: animator zmienił otwarcie albo elementy hooka wjeżdżają dopiero później. Wynik PASS albo FAIL.
"""
import sys
import numpy as np
from PIL import Image

LIMIT = 22.0
if len(sys.argv) < 3: sys.exit(__doc__)
a, b = (np.asarray(Image.open(f).convert("L").resize((108, 192)), dtype=np.float32) for f in sys.argv[1:3])
d = float(np.abs(a - b).mean())
print(f"różnica {d:.1f} (limit {LIMIT:.0f})")
print("PASS" if d <= LIMIT else "FAIL: klatka 0 nie odtwarza projektu z hook/hook.png. Zacznij film dokładnie od tego kadru.")
sys.exit(0 if d <= LIMIT else 1)
