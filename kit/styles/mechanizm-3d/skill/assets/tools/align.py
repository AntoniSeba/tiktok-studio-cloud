"""Dopasowanie słów ze skryptu do znaczników czasu z transkrypcji.

Tekst bierzemy ze skryptu (jest pewny), czas z transkrypcji. Słowa, których
rozpoznawanie nie złapało, dostają czas interpolowany między sąsiadami.
Wynik: film/words.js z tablicą [tekst, start, koniec] dla każdego słowa skryptu.

użycie: python3 tools/align.py skrypt.txt transkrypcja.json film/words.js
"""
import difflib, json, re, sys, unicodedata


def norm(w):
    w = unicodedata.normalize("NFKD", w.lower())
    w = "".join(c for c in w if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", w.replace("ł", "l"))


def load_words(path):
    data = json.load(open(path))
    if isinstance(data, dict):
        for k in ("words", "transcript", "segments"):
            if k in data:
                data = data[k]
                break
    out = []
    for w in data:
        if "words" in w:
            out += [(x.get("text") or x.get("word"), x["start"], x["end"]) for x in w["words"]]
        else:
            out.append((w.get("text") or w.get("word"), w["start"], w["end"]))
    return [(t.strip(), float(s), float(e)) for t, s, e in out if t and t.strip()]


script = open(sys.argv[1]).read().split()
hyp = load_words(sys.argv[2])
# transkrypcja potrafi skleić lub rozbić słowa ("V6" -> "V", "6"), więc porównujemy znormalizowane
a = [norm(w) for w in script]
b = [norm(w[0]) for w in hyp]
sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
times = [None] * len(script)
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == "equal":
        for k in range(i2 - i1):
            times[i1 + k] = (hyp[j1 + k][1], hyp[j1 + k][2])
    elif tag == "replace" and j2 > j1:
        # rozkładamy blok transkrypcji proporcjonalnie na słowa skryptu
        s0, s1 = hyp[j1][1], hyp[j2 - 1][2]
        n = i2 - i1
        lens = [max(1, len(a[i])) for i in range(i1, i2)]
        tot = sum(lens)
        acc = 0
        for k in range(n):
            st = s0 + (s1 - s0) * acc / tot
            acc += lens[k]
            times[i1 + k] = (st, s0 + (s1 - s0) * acc / tot)

# brakujące: interpolacja między znanymi
known = [i for i, t in enumerate(times) if t]
for i, t in enumerate(times):
    if t:
        continue
    prev = max([k for k in known if k < i], default=None)
    nxt = min([k for k in known if k > i], default=None)
    s = times[prev][1] if prev is not None else 0.0
    e = times[nxt][0] if nxt is not None else s + 0.3
    span = (nxt if nxt is not None else i + 1) - (prev if prev is not None else i - 1) - 1
    pos = i - (prev if prev is not None else i - 1)
    times[i] = (s + (e - s) * (pos - 1) / span, s + (e - s) * pos / span)

matched = sum(1 for tag, i1, i2, *_ in sm.get_opcodes() if tag == "equal" for _ in range(i2 - i1))
rows = ",\n".join(f'  [{json.dumps(w, ensure_ascii=False)}, {s:.3f}, {e:.3f}]' for w, (s, e) in zip(script, times))
open(sys.argv[3], "w").write("// wygenerowane przez tools/align.py: słowo skryptu, start, koniec (s)\nexport const WORDS = [\n" + rows + "\n];\n")
print(f"{len(script)} słów skryptu, {len(hyp)} w transkrypcji, {matched} dopasowanych wprost")
