"""Napisy słowo w słowo: czasy z transkrypcji, tekst poprawiony według skryptu.

Używamy TYLKO gdy Antoni chce napisy na środku (od filmu V8 domyślnie ich NIE ma).
Grupy po max 3 słowa i max 17 znaków, grupa kończy się na znaku interpunkcyjnym.

użycie (z katalogu projektu):
  python3 tools/make_captions.py --cut 168.3 --fix fix.json
    --cut   czas (s), po którym słowa są odcięte (np. wycięte podsumowanie), domyślnie brak
    --fix   JSON {"FIX": {"źle": "dobrze"}, "SPLIT": {"sklejone.": ["skle", "jone."]}}
wynik: film/captions.js z CAPS = [{t0, t1, w: [[słowo, start], ...]}, ...]
Pierwsza grupa ma t0 = 0 (napis stoi od klatki 0), ostatnia trwa do końca filmu.
"""
import argparse, json, re

ap = argparse.ArgumentParser()
ap.add_argument("--cut", type=float, default=1e9)
ap.add_argument("--fix", default=None)
ap.add_argument("--src", default="assets/transcript.json")
ap.add_argument("--out", default="film/captions.js")
a = ap.parse_args()

w = json.load(open(a.src))
if isinstance(w, dict):
    w = w.get("words", w.get("transcript", w))
FIX, SPLIT = {}, {}
if a.fix:
    f = json.load(open(a.fix))
    FIX, SPLIT = f.get("FIX", {}), f.get("SPLIT", {})

words = []
for x in w:
    t, s, e = (x.get("text") or x.get("word")).strip(), x["start"], x["end"]
    if s >= a.cut:
        break
    if t in SPLIT:
        parts = SPLIT[t]
        tot = sum(len(p) for p in parts)
        c = s
        for p in parts:
            words.append((p, round(c, 3)))
            c += (e - s) * len(p) / tot
    else:
        words.append((FIX.get(t, t), round(s, 3)))

groups, cur = [], []
for i, (t, s) in enumerate(words):
    cur.append([t, s])
    chars = sum(len(x) for x, _ in cur) + len(cur) - 1
    nxt = words[i + 1][0] if i + 1 < len(words) else ""
    if re.search(r"[.,?!:]$", t) or len(cur) >= 3 or chars + 1 + len(nxt) > 17:
        groups.append(cur)
        cur = []
if cur:
    groups.append(cur)

out = []
for i, g in enumerate(groups):
    t0 = 0.0 if i == 0 else g[0][1]
    t1 = groups[i + 1][0][1] if i + 1 < len(groups) else 999
    out.append({"t0": t0, "t1": t1, "w": g})
open(a.out, "w").write("// wygenerowane przez tools/make_captions.py\nexport const CAPS = " + json.dumps(out, ensure_ascii=False) + ";\n")
print(len(words), "słów,", len(out), "grup")
print(" | ".join(" ".join(x for x, _ in g["w"]) for g in out[:30]))
print(max(len(" ".join(x for x, _ in g["w"])) for g in out), "max znaków w grupie")
