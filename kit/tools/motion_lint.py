"""Bramka KAŻDY RUCH MA CEL: szuka w kodzie animacji ruchu, który do niczego nie prowadzi.

  python3 motion_lint.py project            # czyta film.js, index.html i compositions/*.html w projekcie

Czego szuka (każde to FAIL, chyba że linia ma komentarz z celem, np. // CEL: budzik dzwoni, to jest akcja historii):
- drgania i trzęsienie: słowa shake/wiggle/wobble/jitter/tremble/trzes/drga, pętle for z naprzemiennymi wartościami (i % 2, tablice wartości),
  ten sam element obracany albo przesuwany tam i z powrotem kilka razy w ciągu ~1,2 s,
- zapętlony ruch ozdobny: repeat (inne niż 0), yoyo,
- pompowanie: ten sam element powiększany i zaraz zmniejszany (scale 1.0x -> 1) więcej niż 2 razy w filmie,
- ruch skokowy zamiast płynnego: steps(...) albo własne funkcje stepped,
- losowość: Math.random (też psuje powtarzalność renderu).
Wynik: lista linii z powodem, PASS albo FAIL. Darmowe, bez modelu.
"""
import glob, os, re, sys
from collections import defaultdict

if len(sys.argv) < 2: sys.exit(__doc__)
root = sys.argv[1]
files = [f for f in [os.path.join(root, "film.js"), os.path.join(root, "index.html")] + glob.glob(os.path.join(root, "compositions", "*.html")) if os.path.exists(f)]
if not files: sys.exit("FAIL: nie ma film.js ani index.html w " + root)

WORDS = re.compile(r"\b(shake|wiggle|wobble|jitter|tremble|trzes\w*|drga\w*|CustomWiggle|RoughEase)\b", re.I)
SEL = re.compile(r"\.(?:to|fromTo|from|set)\(\s*['\"]([^'\"]+)['\"]")
POS = re.compile(r"\}\s*,\s*([0-9]+(?:\.[0-9]+)?)\s*\)")
CEL = re.compile(r"//\s*CEL\s*:|/\*\s*CEL\s*:", re.I)
problems, rot, xs, punch = [], defaultdict(list), defaultdict(list), defaultdict(list)

for f in files:
    lines = open(f, encoding="utf-8", errors="ignore").read().split("\n")
    stepped = set(re.findall(r"(?:const|let|var|function)\s+(\w+)\s*=?\s*\(?[^;\n]*steps\(", "\n".join(lines)))
    for n, line in enumerate(lines, 1):
        if CEL.search(line): continue
        where = f"{os.path.relpath(f, root)}:{n}"
        if WORDS.search(line): problems.append((where, "drganie/trzęsienie bez celu", line))
        if re.search(r"\brepeat\s*:\s*-?[1-9]", line) or re.search(r"\byoyo\s*:\s*true", line): problems.append((where, "zapętlony ruch ozdobny (repeat/yoyo)", line))
        if "Math.random" in line: problems.append((where, "losowy ruch (Math.random)", line))
        if re.search(r"\bsteps\(\d", line) or any(re.search(rf"\b{s}\(", line) for s in stepped):
            problems.append((where, "ruch skokowy (steps) zamiast płynnego", line))
        if re.search(r"\bfor\s*\(", line) and re.search(r"i\s*%\s*\d|\[[-0-9., ]+\]\[i", line) and re.search(r"rotation|\bx\s*:|\by\s*:|scale", line):
            problems.append((where, "pętla drgań (naprzemienne wartości w pętli)", line))
        sel, pos = SEL.search(line), POS.search(line)
        if sel and pos:
            t = float(pos.group(1)); s = sel.group(1)
            for m in re.finditer(r"\brotation\s*:\s*(-?[0-9.]+)", line): rot[s].append((t, float(m.group(1)), where, line))
            for m in re.finditer(r"\bx\s*:\s*(-?[0-9.]+)", line): xs[s].append((t, float(m.group(1)), where, line))
            m = re.search(r"\bscale\s*:\s*(1\.0[1-9]\d*|1\.1\d*)", line)
            if m: punch[s].append((t, where, line))
        # keyframes oscillating rotation inside one tween
        kf = re.findall(r"rotation\s*:\s*(-?[0-9.]+)", line)
        if "keyframes" in line and len(kf) >= 3: problems.append((where, "kiwanie w keyframes (rotation tam i z powrotem)", line))

def oscillates(series, limit):
    out = []
    for s, pts in series.items():
        pts.sort()
        for i in range(2, len(pts)):
            a, b, c = pts[i - 2], pts[i - 1], pts[i]
            if c[0] - a[0] <= 1.2 and abs(b[1]) <= limit and (b[1] - a[1]) * (c[1] - b[1]) < 0:
                out.append((c[2], f"'{s}' tam i z powrotem w {c[0] - a[0]:.1f} s (drganie)", c[3])); break
    return out
problems += oscillates(rot, 30) + oscillates(xs, 60)
pumps = [(w, l) for s, v in punch.items() for (_, w, l) in v]
if len(pumps) > 2: problems += [(w, f"pompowanie skali ({len(pumps)} razy w filmie, limit 2)", l) for w, l in pumps[2:]]

seen = set()
for where, why, line in problems:
    if (where, why) in seen: continue
    seen.add((where, why))
    print(f"{where}: {why}: {line.strip()[:140]}")
print(f"\nPASS (sprawdzono {len(files)} plików)" if not seen else f"\nFAIL: {len(seen)} ruchów bez celu. Usuń je albo zamień na ruch, który do czegoś prowadzi; jeśli ruch JEST akcją historii (np. budzik dzwoni), dopisz w tej linii // CEL: ...")
sys.exit(0 if not seen else 1)
