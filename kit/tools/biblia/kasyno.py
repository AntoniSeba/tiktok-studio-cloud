#!/usr/bin/env python3
"""Efekt kasyna: kontrola rytmu zdarzeń (PASS / FAIL) i generator nieregularnego planu cięć.

Zasada z Biblii: coś nowego co 2 do 3 s, ale NIGDY w równym rytmie. Odstępy mają być różne
(zmienny harmonogram nagród, jak w automacie), hook gęstszy (co ok. 1 s przez pierwsze 5 do 7 s),
a duże "trafienia" (B-roll, split, licznik, karta, zmiana systemu wizualnego) przychodzą
w nieprzewidywalnych odstępach. Widz nie wie, kiedy przyjdzie następne trafienie, więc zostaje.

Kontrola:
  python3 kasyno.py film.mp4                         # zdarzenia wykryte z obrazu (cięcia, wejścia grafik)
  python3 kasyno.py --czasy zdarzenia.json           # [1.2, 2.9, ...] albo [{"t": 1.2}, ...] albo txt/csv
  python3 kasyno.py --hf /projekt/hyperframes        # tablica SHOTS z film/main.js (tylko cięcia ujęć)
  python3 kasyno.py film.mp4 --format ugc            # UGC: bez limitu 3,5 s, tylko nieregularność
Plan (do budowy osi czasu):
  python3 kasyno.py --generuj 165 --slowa assets/transcript.json --seed 7 --zapisz plan.json

Kod wyjścia 1 przy FAIL.
"""
import argparse
import json
import os
import random
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _wspolne import FAIL, PASS, WARN, Raport, czas_trwania, klatki_szare  # noqa: E402

PROGI = {
    # hook_koniec, hook_mediana_max, przerwa_fail, przerwa_warn, cv_fail, cv_warn, srednia_min, srednia_max
    "explainer": dict(hook=6.0, hook_med=1.6, gap_fail=3.5, gap_warn=3.0, cv_fail=0.18, cv_warn=0.25,
                      sr_min=1.3, sr_max=3.0),
    "ugc": dict(hook=4.0, hook_med=2.5, gap_fail=99.0, gap_warn=6.0, cv_fail=0.18, cv_warn=0.25,
                sr_min=1.0, sr_max=6.0),
}


def zdarzenia_z_mp4(sciezka):
    """Zmiana skokowa obrazu w siatce 4x4 pól: różnica średnich 0,2 s przed i po, minus ruch wewnątrz
    tych okien (płynna orbita kamery to nie zdarzenie). Lokalnie, więc łapie też wejście napisu
    albo elementu planszy, nie tylko cięcie. Sprawdzone: 43 z 44 cięć filmu R5 plus wejścia grafik."""
    f, fps = klatki_szare(sciezka, 72, 128, fps=15)
    czasy, ruch0 = zdarzenia_z_klatek(f, fps)
    return czasy, len(f) / fps, ruch0


def zdarzenia_z_klatek(f, fps):
    """f: (n, 128, 72) uint8 albo float. Zwraca (czasy zdarzeń, ruch w pierwszych 0,1 s)."""
    f = f.astype(np.float32)
    n = len(f)
    k = max(2, int(round(fps * 0.2)))
    cs = np.concatenate([np.zeros((1,) + f.shape[1:], np.float32), np.cumsum(f, axis=0)])

    def pola(a):
        return a.reshape(a.shape[0], 4, 32, 4, 18).mean(axis=(2, 4)).reshape(a.shape[0], -1)

    wynik = np.zeros(n)
    for s in range(k, n - k, 600):
        idx = np.arange(s, min(n - k, s + 600))
        A = (cs[idx] - cs[idx - k]) / k
        B = (cs[idx + k] - cs[idx]) / k
        wew = (np.abs(f[idx - 1] - f[idx - k]) + np.abs(f[np.minimum(n - 1, idx + k - 1)] - f[idx])) / 2
        wynik[idx] = (pola(np.abs(B - A)) - 0.5 * pola(wew)).max(axis=1)
    prog = max(7.0, 1.6 * float(np.percentile(wynik, 75)))
    odl = int(fps * 0.35)
    czasy = [0.0]
    i = 0
    while i < n:
        if wynik[i] > prog and wynik[i] == wynik[max(0, i - odl): i + odl + 1].max():
            t = i / fps
            if t - czasy[-1] >= 0.35:
                czasy.append(round(t, 3))
            i += odl
        else:
            i += 1
    # ruch na starcie: czy klatka 0 już się rusza
    ruch0 = float(np.abs(f[min(n - 1, max(1, int(round(fps * 0.1))))] - f[0]).mean()) if n > 3 else 0.0
    return czasy, ruch0


def czasy_z_pliku(sciezka):
    txt = open(sciezka, encoding="utf-8").read()
    try:
        d = json.loads(txt)
        if isinstance(d, dict):
            d = d.get("zdarzenia") or d.get("events") or d.get("plan") or list(d.values())[0]
        out = []
        for x in d:
            if isinstance(x, (int, float)):
                out.append(float(x))
            elif isinstance(x, dict):
                out.append(float(x.get("t", x.get("start", 0))))
            elif isinstance(x, (list, tuple)):
                out.append(float(x[0]))
        return sorted(out)
    except json.JSONDecodeError:
        return sorted(float(v) for v in re.findall(r"\d+(?:[.,]\d+)?", txt.replace(",", ".")))


def czasy_z_hf(katalog):
    js = open(os.path.join(katalog, "film", "main.js"), encoding="utf-8").read()
    m = re.search(r"const SHOTS\s*=\s*\[(.*?)\];", js, re.S)
    if not m:
        sys.exit("Nie znalazłem tablicy SHOTS w film/main.js. Podaj --czasy albo MP4.")
    return sorted({float(a) for a in re.findall(r"\[\s*([\d.]+)\s*,", m.group(1))})


def ocen(czasy, D, fmt, ruch0=None, zrodlo=""):
    p = PROGI[fmt]
    czasy = sorted(set([0.0] + [t for t in czasy if 0 <= t < D]))
    iv = np.diff(czasy + [D])
    r = Raport(f"Efekt kasyna ({fmt}): {zrodlo} | {len(czasy)} zdarzeń na {D:.1f} s")

    if ruch0 is not None:
        r.dodaj("klatka 0 w ruchu", PASS if ruch0 > 0.6 else FAIL,
                f"zmiana obrazu w pierwszych 0,1 s: {ruch0:.2f} (min 0,6)")

    hook = [b - a for a, b in zip(czasy, czasy[1:]) if a < p["hook"]]
    if hook:
        med = float(np.median(hook))
        r.dodaj("hook gęsty", PASS if med <= p["hook_med"] else FAIL,
                f"mediana odstępu w pierwszych {p['hook']:.0f} s: {med:.2f} s (max {p['hook_med']} s)")
    else:
        r.dodaj("hook gęsty", FAIL, "brak zdarzeń w hooku")

    cialo = np.array([b - a for a, b in zip(czasy, czasy[1:] + [D]) if a >= p["hook"]])
    if len(cialo) < 3:
        r.dodaj("rytm", WARN, "za mało zdarzeń po hooku do oceny")
        return r, czasy, iv
    starty = [a for a in czasy if a >= p["hook"]]
    najdl = float(cialo.max())
    gdzie = starty[int(cialo.argmax())]
    dlugie = [(a, b) for a, b in zip(starty, cialo) if b > p["gap_fail"]]
    st = FAIL if dlugie else (WARN if najdl > p["gap_warn"] else PASS)
    r.dodaj("brak przestojów", st, f"najdłużej bez zmiany: {najdl:.2f} s od {gdzie:.1f} s"
            + (f" | ponad {p['gap_fail']} s: " + ", ".join(f"{a:.1f}s ({b:.1f})" for a, b in dlugie[:8])
               if dlugie else ""))
    sr = float(cialo.mean())
    r.dodaj("średni odstęp", PASS if p["sr_min"] <= sr <= p["sr_max"] else WARN,
            f"{sr:.2f} s (cel {p['sr_min']} do {p['sr_max']} s)")
    cv = float(cialo.std() / max(sr, 1e-6))
    r.dodaj("nieregularność (CV)", FAIL if cv < p["cv_fail"] else (WARN if cv < p["cv_warn"] else PASS),
            f"zmienność odstępów {cv:.2f} (min {p['cv_warn']}; niżej to metronom)")

    # serie metronomu: kolejne odstępy prawie równe
    serie, biez = [], [cialo[0]]
    for a, b in zip(cialo, cialo[1:]):
        if abs(b - np.mean(biez)) <= 0.15:
            biez.append(b)
        else:
            if len(biez) >= 3:
                serie.append(len(biez))
            biez = [b]
    if len(biez) >= 3:
        serie.append(len(biez))
    najd = max(serie, default=0)
    r.dodaj("bez metronomu", FAIL if najd >= 4 else (WARN if najd == 3 else PASS),
            f"najdłuższa seria równych odstępów: {najd} (max 2)" if najd else "brak serii równych odstępów")

    kosze = np.floor(cialo / 0.3)
    _, ile = np.unique(kosze, return_counts=True)
    dom = float(ile.max() / len(cialo))
    r.dodaj("rozrzut długości", PASS if dom <= 0.40 else WARN,
            f"najczęstsza długość (okno 0,3 s) to {dom * 100:.0f}% odstępów (max 40%)")
    return r, czasy, iv


def pasek(czasy, D):
    """Jedna kreska na sekundę: liczba zdarzeń w tej sekundzie."""
    zn = []
    for s in range(int(np.ceil(D))):
        k = sum(1 for t in czasy if s <= t < s + 1)
        zn.append("." if k == 0 else ("|" if k == 1 else ("#" if k == 2 else "@")))
    linie = ["".join(zn[i:i + 60]) for i in range(0, len(zn), 60)]
    return "\n".join(f"  {i * 60:>4d}s {l}" for i, l in enumerate(linie))


def generuj(D, slowa, hook_koniec, seed):
    rnd = random.Random(seed)
    starty = []
    if slowa:
        w = json.load(open(slowa, encoding="utf-8"))
        w = w if isinstance(w, list) else w.get("words", [])
        starty = sorted(float(x["start"]) for x in w)

    def kandydaci(t, poprz):
        """Najbliższe początki słów (do 0,3 s od celu), potem sam cel."""
        k = sorted((s for s in starty if abs(s - t) <= 0.30 and s - poprz >= 0.55), key=lambda s: abs(s - t))
        return [round(s, 2) for s in k] + [round(t, 2)]

    plan = [{"t": 0.0, "typ": "duzy", "co": "klatka 0 w ruchu: głos, ruch i nagłówek od pierwszej setnej"}]
    t, ostatnie, do_duzego = 0.0, [], rnd.randint(3, 6)
    duze_hook = 0
    while True:
        w_hooku = t < hook_koniec
        nowy = None
        for _ in range(20):
            if w_hooku:
                odst = rnd.uniform(0.7, 1.4)
            else:
                u = rnd.random()  # trzy "kosze" długości: krótki, średni, długi (zmienny harmonogram)
                odst = (rnd.uniform(1.0, 1.6) if u < 0.35 else rnd.uniform(1.9, 2.6) if u < 0.70
                        else rnd.uniform(2.6, 3.0))
            for c in kandydaci(t + odst, t):
                rz = c - t
                if rz > (1.6 if w_hooku else 3.0) or rz < 0.55:
                    continue
                if not w_hooku and ostatnie and abs(rz - ostatnie[-1]) < 0.30:
                    continue  # anty metronom: dwa kolejne odstępy nigdy prawie równe
                nowy = c
                break
            if nowy is not None:
                break
        if nowy is None:
            nowy = round(t + rnd.uniform(1.0, 2.9), 2)
        if nowy >= D - 0.6:
            break
        ostatnie.append(nowy - t)
        t = nowy
        if t < hook_koniec:
            typ = "duzy" if (duze_hook < 2 and rnd.random() < 0.4) else "sredni"
            duze_hook += typ == "duzy"
        else:
            do_duzego -= 1
            if do_duzego <= 0:
                typ, do_duzego = "duzy", rnd.randint(3, 6)
            else:
                typ = "sredni" if rnd.random() < 0.55 else "maly"
        co = {"duzy": "przerwanie wzoru: B-roll, split, licznik, karta, zmiana planu albo systemu wizualnego",
              "sredni": "nowe ujęcie, kąt kamery albo nowa plansza",
              "maly": "nowy napis, etykieta, podświetlenie, element na planszy"}[typ]
        plan.append({"t": t, "typ": typ, "co": co})
    if D - t > 2.8:  # ostatni odcinek do końca filmu też bez przestoju
        plan.append({"t": round(t + (D - t) * rnd.uniform(0.4, 0.6), 2), "typ": "maly",
                     "co": "nowy napis, etykieta, podświetlenie, element na planszy"})
    for frac, opis in [(0.07, "drugi hook (8 do 12 s): zwrot, liczba, która podbija stawkę"),
                       (0.33, "ponowne zahaczenie: mini obietnica albo pytanie"),
                       (0.62, "ponowne zahaczenie: zwrot akcji przed nagrodą")]:
        cel = max(8.0, frac * D) if frac < 0.1 else frac * D
        najb = min(plan[1:], key=lambda r: abs(r["t"] - cel))
        najb["typ"] = "duzy"
        najb["co"] = opis
    return plan


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("wideo", nargs="?")
    ap.add_argument("--czasy")
    ap.add_argument("--hf")
    ap.add_argument("--dlugosc", type=float)
    ap.add_argument("--format", choices=list(PROGI), default="explainer")
    ap.add_argument("--generuj", type=float, metavar="DLUGOSC_S")
    ap.add_argument("--slowa", help="transcript.json (słowa z czasami) do przyciągania cięć do słów")
    ap.add_argument("--hook", type=float, default=6.0)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--zapisz")
    a = ap.parse_args()

    if a.generuj:
        plan = generuj(a.generuj, a.slowa, a.hook, a.seed)
        r, _, iv = ocen([p["t"] for p in plan], a.generuj, "explainer", zrodlo="wygenerowany plan")
        for p in plan:
            print(f"  {p['t']:7.2f}s  {p['typ']:6s}  {p['co']}" + (f"  [{p['uwaga']}]" if "uwaga" in p else ""))
        r.wypisz()
        if a.zapisz:
            json.dump(plan, open(a.zapisz, "w"), ensure_ascii=False, indent=1)
            print(f"Plan: {os.path.abspath(a.zapisz)}")
        return

    ruch0 = None
    if a.wideo:
        czasy, D, ruch0 = zdarzenia_z_mp4(a.wideo)
        zrodlo = os.path.basename(a.wideo) + " (wykryte z obrazu)"
    elif a.czasy:
        czasy = czasy_z_pliku(a.czasy)
        D = a.dlugosc or (czasy[-1] + 2.0)
        zrodlo = os.path.basename(a.czasy)
    elif a.hf:
        czasy = czasy_z_hf(a.hf)
        from _wspolne import dlugosc_hyperframes
        D = a.dlugosc or dlugosc_hyperframes(a.hf) or (czasy[-1] + 2.0)
        zrodlo = "SHOTS z film/main.js (tylko cięcia ujęć; wejścia grafik wewnątrz ujęć nie są liczone)"
    else:
        ap.error("podaj MP4, --czasy, --hf albo --generuj")

    r, czasy, iv = ocen(czasy, D, a.format, ruch0, zrodlo)
    print(pasek(czasy, D))
    print("  legenda: . brak zmiany w tej sekundzie, | jedna, # dwie, @ trzy i więcej")
    r.wypisz()
    if a.zapisz:
        json.dump({**r.json(), "zdarzenia": czasy}, open(a.zapisz, "w"), ensure_ascii=False, indent=1)
    sys.exit(1 if r.status() == FAIL else 0)


if __name__ == "__main__":
    main()
