"""Wyrównanie tekstu skryptu do lektora bez modelu ASR (brak dostępu do wag whispera).
Segmenty mowy = kawałki między wyciętymi ciszami (silence-map.json). Słowa skryptu dzielimy
na grupy przypisane do segmentów (programowanie dynamiczne: czas segmentu ~ liczba sylab,
granice grup premiowane na interpunkcji), a w segmencie czasy słów rozkładamy wg sylab.
użycie: python3 tools/align_pauses.py skrypt-tts.txt assets/silence-map.json assets/transcript.json"""
import json, re, sys
txt, smap, out = sys.argv[1:4]
words = re.findall(r"\S+", open(txt, encoding="utf-8").read())
V = set("aeiouyąęóAEIOUYĄĘÓ")
def syl(w):
    core = re.sub(r"[^\wąćęłńóśźżĄĆĘŁŃÓŚŹŻ]", "", w)
    if re.fullmatch(r"V\d+", core): return 2
    n = 0; prev = False
    for i, c in enumerate(core):
        v = c in V
        # "i" przed samogłoską to zmiękczenie, nie sylaba
        if c in "iI" and i + 1 < len(core) and core[i + 1] in V: v = False
        if v and not prev: n += 1
        prev = v
    return max(n, 1)
S = [syl(w) for w in words]
punct = [1.0 if re.search(r"[.?!]$", w) else 0.6 if re.search(r"[,:;]$", w) else 0.0 for w in words]
segs = [s["dst"] for s in json.load(open(smap))["segments"]]
N, M = len(words), len(segs)
tot = sum(b - a for a, b in segs) - 0.12 * M
rate = tot / sum(S)  # s na sylabę
pre = [0]
for s in S: pre.append(pre[-1] + s)
INF = 1e18
# dp[j][i]: pierwsze i słów w pierwszych j segmentach
dp = [[INF] * (N + 1) for _ in range(M + 1)]
bk = [[0] * (N + 1) for _ in range(M + 1)]
dp[0][0] = 0
for j in range(1, M + 1):
    a, b = segs[j - 1]; d = b - a - 0.12
    for i in range(1, N + 1):
        best, arg = INF, 0
        for k in range(max(0, i - 25), i):
            if dp[j - 1][k] >= INF: continue
            exp = rate * (pre[i] - pre[k])
            c = dp[j - 1][k] + ((d - exp) / (0.35 + 0.25 * exp)) ** 2
            c += 0 if i == N else (1 - punct[i - 1]) * 3.0
            if c < best: best, arg = c, k
        dp[j][i], bk[j][i] = best, arg
# segment może też być pusty (oddech, szum): pozwól pominąć przez scalenie z poprzednim
groups = []; i = N
for j in range(M, 0, -1):
    k = bk[j][i]; groups.append((k, i)); i = k
groups.reverse()
res = []
for (k, i), (a, b) in zip(groups, segs):
    a += 0.06; b -= 0.06
    tot = pre[i] - pre[k]; t = a
    for w in range(k, i):
        d = (b - a) * S[w] / tot
        res.append({"text": words[w], "start": round(t, 3), "end": round(t + d, 3)}); t += d
json.dump(res, open(out, "w"), ensure_ascii=False, indent=0)
print("koszt", round(dp[M][N], 2), "segmentów", M, "słów", N)
for (k, i), (a, b) in zip(groups, segs):
    print(f"{a:7.2f}-{b:7.2f} {b-a:5.2f}s  exp {rate*(pre[i]-pre[k]):5.2f}  | {' '.join(words[k:i])}")
