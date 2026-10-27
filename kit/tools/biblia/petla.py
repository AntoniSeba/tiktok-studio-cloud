#!/usr/bin/env python3
"""Pętla i start: PASS / FAIL.

Sprawdza zasady Biblii, które da się zmierzyć na gotowym MP4:
  1. Szew pętli: ostatnia klatka = pierwsza. Różnica ostatnia/pierwsza ma być nie większa niż zwykła
     różnica między dwiema sąsiednimi klatkami filmu (widz nie widzi, gdzie film się zaczyna).
  2. Akcja od pierwszej setnej sekundy: obraz rusza się w pierwszych 0,1 s, dźwięk jest od 0.
  3. Koniec bez wyciszenia i bez czarnej klatki (urwany koniec, który wpada w hook).
  4. (z --transkrypcja) wypisuje ostatnie i pierwsze słowa do sprawdzenia pętli zdaniowej.

Użycie:
  python3 petla.py film.mp4
  python3 petla.py film.mp4 --lektor assets/vo.mp3 --transkrypcja assets/transcript.json
  python3 petla.py film.mp4 --inna-petla "pętla zdaniowa + ten sam obiekt w kadrze"   # świadomie inna strategia
Kod wyjścia 1 przy FAIL.
"""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _wspolne import (FAIL, PASS, WARN, Raport, klatka_rgb, klatki_szare, ma_audio, ostatnia_klatka_rgb,  # noqa: E402
                      rms_db, wczytaj_audio)


def ocen_szew(f, fps):
    f = f.astype(np.float32)
    sasiednie = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
    baza = float(np.median(sasiednie[sasiednie > 0.01])) if (sasiednie > 0.01).any() else 0.5
    szew = float(np.abs(f[-1] - f[0]).mean())
    # najlepsze dopasowanie końca do pierwszej sekundy (pętla, która ląduje np. na 0,3 s)
    pierwsza = f[: max(1, int(fps))]
    rozn = np.abs(pierwsza - f[-1]).mean(axis=(1, 2))
    return szew, baza, float(rozn.min()), float(rozn.argmin() / fps)


def ocen(sciezka, lektor=None, transkrypcja=None, inna_petla=None, klatki=None):
    r = Raport(f"Pętla i start: {os.path.basename(sciezka)}")
    if klatki is None:
        klatki = klatki_szare(sciezka, 72, 128)
    f, fps = klatki
    szew, baza, najl, gdzie = ocen_szew(f, fps)
    stosunek = szew / max(baza, 1e-6)
    if stosunek <= 1.2:
        st, op = PASS, "ostatnia klatka = pierwsza, szwu nie widać"
    elif inna_petla:
        st, op = WARN, f"obraz nie domyka się, deklarowana inna pętla: {inna_petla}"
    elif stosunek <= 3.0:
        st, op = WARN, "miękki szew: podobny kadr, ale widać przeskok"
    else:
        st, op = FAIL, "twarde cięcie na pętli: widz widzi, że film się skończył"
    r.dodaj("szew pętli", st, f"{op} (różnica {szew:.2f} wobec zwykłej różnicy klatek {baza:.2f}, x{stosunek:.1f})"
            + (f"; koniec najbardziej pasuje do {gdzie:.2f} s" if st != PASS and gdzie > 0 else ""))

    ruch0 = float(np.abs(f[min(len(f) - 1, max(1, int(round(fps * 0.1))))].astype(np.float32)
                         - f[0].astype(np.float32)).mean())
    r.dodaj("ruch od klatki 0", PASS if ruch0 > 0.6 else FAIL,
            f"zmiana obrazu w pierwszych 0,1 s: {ruch0:.2f} (min 0,6; stoi = widz scrolluje)")

    a0 = klatka_rgb(sciezka, 0, 270, 480)
    a1 = ostatnia_klatka_rgb(sciezka, 270, 480)
    if a0 is not None and a1 is not None:
        j0, j1 = float(a0.mean()), float(a1.mean())
        czarna = j1 < 8 and j0 >= 8
        r.dodaj("bez czarnej klatki", FAIL if czarna else PASS,
                f"jasność ostatniej klatki {j1:.0f}, pierwszej {j0:.0f}")

    zrodlo = lektor or (sciezka if ma_audio(sciezka) else None)
    if zrodlo:
        x, sr = wczytaj_audio(zrodlo, 16000)
        t, db = rms_db(x, sr, okno=0.010, krok=0.005)
        glos = np.where(db > -40)[0]
        start = float(t[glos[0]] - 0.005) if len(glos) else 99.0
        r.dodaj("dźwięk od pierwszej setnej", PASS if start <= 0.05 else (WARN if start <= 0.15 else FAIL),
                f"{'lektor' if lektor else 'dźwięk'} zaczyna się po {start * 1000:.0f} ms (limit 50 ms)")
        kon = db[t > (len(x) / sr - 0.30)]
        kon_db = float(np.max(kon)) if len(kon) else -99
        r.dodaj("koniec bez wyciszenia", PASS if kon_db > -45 else WARN,
                f"najgłośniej w ostatnich 0,3 s: {kon_db:.0f} dBFS (cisza na końcu psuje pętlę)")
    else:
        r.dodaj("dźwięk od pierwszej setnej", WARN, "brak ścieżki audio do sprawdzenia")

    if transkrypcja:
        w = json.load(open(transkrypcja, encoding="utf-8"))
        w = w if isinstance(w, list) else w.get("words", [])
        tekst = [(x.get("text") or x.get("word") or "").strip() for x in w]
        print("  PĘTLA ZDANIOWA (przeczytaj na głos jako jedno zdanie):")
        print(f"    ...{' '.join(tekst[-7:])}  ||  {' '.join(tekst[:9])}...")
    return r


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("wideo")
    ap.add_argument("--lektor")
    ap.add_argument("--transkrypcja")
    ap.add_argument("--inna-petla", help="opis świadomie innej strategii pętli (szew wtedy WARN, nie FAIL)")
    a = ap.parse_args()
    r = ocen(a.wideo, a.lektor, a.transkrypcja, a.inna_petla)
    r.wypisz()
    sys.exit(1 if r.status() == FAIL else 0)


if __name__ == "__main__":
    main()
