"""Wiralowe napisy: tekst z caps.txt ([czerwone] słowa), czasy słów z whispera, grupy po max 3 słowa."""
import json, re, sys, difflib
caps_txt, words_json, out = sys.argv[1:4]
W = json.load(open(words_json))
norm = lambda s: re.sub(r"[^\wąćęłńóśźż%]", "", s.lower())
toks = []
for m in re.finditer(r"\[([^\]]+)\]|(\S+)", open(caps_txt, encoding="utf-8").read()):
    if m.group(1):
        for w in m.group(1).split(): toks.append({"w": w, "red": True})
    else:
        toks.append({"w": m.group(2), "red": False})
# czerwony nawias może zjeść interpunkcję po nim, np. "[pułapka]." -> "." osobno
merged = []
for t in toks:
    if merged and not norm(t["w"]): merged[-1]["w"] += t["w"]
    else: merged.append(t)
toks = merged
sm = difflib.SequenceMatcher(a=[norm(t["w"]) for t in toks], b=[norm(w["w"]) for w in W], autojunk=False)
for a, b, n in sm.get_matching_blocks():
    for k in range(n): toks[a + k]["t"] = W[b + k]["s"]; toks[a + k]["e"] = W[b + k]["e"]
# brakujące czasy: interpolacja między sąsiadami
known = [i for i, t in enumerate(toks) if "t" in t]
for i, t in enumerate(toks):
    if "t" in t: continue
    p = max([k for k in known if k < i], default=None); q = min([k for k in known if k > i], default=None)
    if p is None: t["t"] = toks[q]["t"]
    elif q is None: t["t"] = toks[p]["e"]
    else: t["t"] = round(toks[p]["t"] + (toks[q]["t"] - toks[p]["t"]) * (i - p) / (q - p), 3)
phrases, cur = [], []
for i, t in enumerate(toks):
    cur.append(t)
    if re.search(r"[.,?!:]$", t["w"]) or i == len(toks) - 1:
        phrases.append(cur); cur = []
# krótkie frazy (1 słowo) doklejam do następnej, jeśli razem max 3 słowa
mp = []
for p in phrases:
    if mp and len(mp[-1]) == 1 and len(mp[-1]) + len(p) <= 3: mp[-1] = mp[-1] + p
    else: mp.append(p)
chunks = []
for p in mp:
    n = -(-len(p) // 3)
    size = -(-len(p) // n)
    i = 0
    while i < len(p):
        j = min(len(p), i + size)
        # nie tnij czerwonej frazy
        while j < len(p) and p[j]["r" if "r" in p[j] else "red"] and p[j - 1]["red"]: j += 1
        chunks.append(p[i:j]); i = j
res = []
for i, c in enumerate(chunks):
    t0 = c[0]["t"]; t1 = chunks[i + 1][0]["t"] if i + 1 < len(chunks) else c[-1].get("e", t0 + 1) + 0.4
    res.append({"t0": round(t0, 3), "t1": round(t1, 3), "w": [{"w": re.sub(r"[.,]$", "", x["w"]), "r": x["red"], "t": round(x["t"], 3)} for x in c]})
json.dump(res, open(out, "w"), ensure_ascii=False)
print(len(res), "grup;", " | ".join(" ".join(("*" if x["r"] else "") + x["w"] for x in c["w"]) for c in res[:12]))
