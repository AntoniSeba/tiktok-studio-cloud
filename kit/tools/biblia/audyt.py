#!/usr/bin/env python3
"""Pełny audyt filmu według Biblii TikToka: wszystko, co da się zmierzyć, w jednym przebiegu.

  python3 audyt.py film.mp4 [--lektor vo.mp3] [--transkrypcja transcript.json] [--format explainer|ugc]
  python3 audyt.py --hf /projekt/hyperframes          # bez renderu MP4 (zrzuty przez hyperframes snapshot)

Automatycznie: format 9:16, poziom audio, cisza w lektorze, martwe strefy, efekt kasyna, pętla,
akcja od klatki 0. Na końcu lista punktów do sprawdzenia głową (hook, obietnica, magnes na komentarz,
ego bait, CTA, DNA kanału, zmienna testu), bo tego nie zmierzy żaden skrypt.
Raport: audyt-<nazwa>.md i .json w --out (domyślnie obok filmu). Kod wyjścia 1 przy FAIL.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kasyno  # noqa: E402
import petla  # noqa: E402
import strefy  # noqa: E402
from _wspolne import (FAIL, PASS, WARN, Raport, biegi, czas_trwania, dlugosc_hyperframes, info_wideo,  # noqa: E402
                      klatki_szare, ma_audio, rms_db, wczytaj_audio)

RECZNIE = [
    "Hook: pierwsze słowa to sedno (teza, liczba w sprzeczności, oskarżenie w 2. osobie albo fakt wprost), bez wstępu.",
    "Hook spłacony do 4. s, obietnica konkretna (nazwa, liczba, marka) w 3 do 10 s, drugi hook w 8 do 12 s.",
    "Obietnica z hooka DOWIEZIONA w nagrodzie, dosłownie i z konkretem.",
    "Magnes na komentarz: jest zaplanowane niedopowiedzenie, anomalia albo drobny, nieszkodliwy błąd (zapisany w planie).",
    "Ego bait: widz w temacie poczuje się mądrzejszy (rama 'dla znawców', 'mechanik ci nie powie'), subtelnie.",
    "Pytanie do komentarzy: wybór A albo B, na który da się odpowiedzieć dopiero po obejrzeniu. Zero 'napisz TAK'.",
    "Powód do zapisu: lista, liczba albo procedura, do której widz wróci.",
    "CTA sprzedażowe wplecione w temat (problem zasiany wcześniej, produkt jako dowód albo rada), nie z dupy.",
    "DNA kanału widoczne w pierwszej klatce (sygnatura: kolor, kicker, logo, typografia, kompozycja).",
    "Zmienna testu: czym ten film różni się od 3 poprzednich (hook, system wizualny, kompozycja, długość) i wpis w EKSPERYMENTY.md.",
    "Koniec urwany, bez podsumowania; ostatnie słowa wpadają w pierwsze zdanie hooka.",
    "Zero literówek na ekranie, napisy dosłownie ze słów lektora, nic nie powtarza tej samej informacji.",
]


def kontrola_audio(r, sciezka, lektor):
    if not ma_audio(sciezka):
        r.dodaj("audio", FAIL, "film nie ma ścieżki dźwiękowej")
        return
    log = subprocess.run(["ffmpeg", "-hide_banner", "-i", sciezka, "-af", "volumedetect,ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    m = re.search(r"max_volume: (-?[\d.]+) dB", log)
    szczyt = float(m.group(1)) if m else 0.0
    lufs = re.findall(r"I:\s+(-?[\d.]+) LUFS", log)
    lufs = float(lufs[-1]) if lufs else None
    r.dodaj("szczyt audio", FAIL if szczyt > -1.0 else (PASS if szczyt <= -3.0 else WARN),
            f"{szczyt:.1f} dBFS (cel ok. -3,5; powyżej -1 kodeki przesterowują)")
    if lufs is not None:
        r.dodaj("głośność", PASS if -16.5 <= lufs <= -11.5 else WARN, f"{lufs:.1f} LUFS (cel -14 +/- 2)")
    if lektor:
        x, sr = wczytaj_audio(lektor, 16000)
        prog = "lektor"
    else:
        x, sr = wczytaj_audio(sciezka, 16000)
        prog = "miks"
    t, db = rms_db(x, sr, okno=0.020, krok=0.005)
    ref = float(np.percentile(db[db > -60], 95)) if (db > -60).any() else -20
    granica = max(-48.0, ref - 30) if lektor else -45.0
    limit = 0.12 if lektor else 0.25
    przerwy = [((e - s) * 0.005, t[s]) for s, e in biegi(db <= granica) if s > 0 and e < len(db)]
    zle = [p for p in przerwy if p[0] > limit]
    r.dodaj(f"cisza ({prog})", FAIL if zle else PASS,
            (f"{len(zle)} przerw dłuższych niż {int(limit * 1000)} ms: " +
             ", ".join(f"{p[1]:.1f}s ({p[0] * 1000:.0f} ms)" for p in zle[:8]) + " -> tts_tnij.py")
            if zle else f"najdłuższa przerwa {max([p[0] for p in przerwy], default=0) * 1000:.0f} ms")


def scal(glowny, inny, prefiks):
    for w in inny.wyniki:
        glowny.dodaj(f"{prefiks}: {w['kontrola']}", w["status"], w["opis"])


def audyt_mp4(a, r):
    W, H, fps = info_wideo(a.wejscie)
    D = czas_trwania(a.wejscie)
    proporcja = W / H
    r.dodaj("format", PASS if (W, H) == (1080, 1920) else (WARN if abs(proporcja - 9 / 16) < 0.01 else FAIL),
            f"{W}x{H}, {fps:.2f} kl/s, {D:.1f} s")
    if fps < 29:
        r.dodaj("klatkaż", WARN, f"{fps:.1f} kl/s, cel 30")
    kontrola_audio(r, a.wejscie, a.lektor)

    print("Dekoduję klatki (kasyno, pętla)...")
    f, fpsk = klatki_szare(a.wejscie, 72, 128)
    czasy, ruch0 = kasyno.zdarzenia_z_klatek(f, fpsk)
    rk, czasy, _ = kasyno.ocen(czasy, D, a.format, ruch0, "z obrazu")
    print(kasyno.pasek(czasy, D))
    scal(r, rk, "kasyno")
    rp = petla.ocen(a.wejscie, a.lektor, a.transkrypcja, a.inna_petla, klatki=(f, fpsk))
    scal(r, rp, "pętla")

    print("Martwe strefy (OCR)...")
    tmp = tempfile.mkdtemp(prefix="audyt-")
    kl = strefy.klatki_z_mp4(a.wejscie, None, tmp, co=a.co)
    return kl, D


def audyt_hf(a, r):
    D = dlugosc_hyperframes(a.hf) or 60.0
    r.dodaj("format", PASS, f"projekt HyperFrames, {D:.1f} s (MP4 nie renderuję bez polecenia)")
    vo = a.lektor or os.path.join(a.hf, "assets", "vo.mp3")
    if os.path.exists(vo):
        kontrola_audio(r, vo, vo)
    czasy = kasyno.czasy_z_pliku(a.czasy) if a.czasy else kasyno.czasy_z_hf(a.hf)
    rk, czasy, _ = kasyno.ocen(czasy, D, a.format, None,
                               "lista zdarzeń" if a.czasy else "SHOTS (tylko cięcia ujęć)")
    print(kasyno.pasek(czasy, D))
    scal(r, rk, "kasyno")
    tmp = tempfile.mkdtemp(prefix="audyt-")
    czasy_s = sorted(set([round(x, 2) for x in np.arange(0, D, a.co)] +
                         [0.03, 0.10, 50.0, 50.03, round(D - 0.04, 2), round(D - 0.01, 2)]))
    czasy_s = [c for c in czasy_s if 0 <= c < D]
    kl = strefy.klatki_z_hyperframes(a.hf, czasy_s, tmp)
    # szew pętli i ruch na starcie z prawdziwych zrzutów
    pl = {round(t, 2): p for t, p in kl}
    from PIL import Image

    def sz(t):
        p = pl.get(round(t, 2))
        return np.asarray(Image.open(p).convert("L").resize((72, 128)), dtype=np.float32) if p else None
    k0, k1, kD = sz(0.0), sz(0.10), sz(round(D - 0.01, 2))
    pary = [(sz(0.0), sz(0.03)), (sz(50.0), sz(50.03)), (sz(round(D - 0.04, 2)), kD)]
    baza = np.median([np.abs(x - y).mean() for x, y in pary if x is not None and y is not None] or [1.0])
    if k0 is not None and kD is not None:
        szew = float(np.abs(k0 - kD).mean())
        st = PASS if szew <= 1.2 * max(baza, 0.3) else (WARN if a.inna_petla or szew <= 3 * max(baza, 0.3) else FAIL)
        r.dodaj("pętla: szew pętli", st, f"różnica koniec/początek {szew:.2f} wobec sąsiednich klatek {baza:.2f}")
    if k0 is not None and k1 is not None:
        ruch0 = float(np.abs(k1 - k0).mean())
        r.dodaj("pętla: ruch od klatki 0", PASS if ruch0 > 0.6 else FAIL, f"zmiana w pierwszych 0,1 s: {ruch0:.2f}")
    if a.transkrypcja or os.path.exists(os.path.join(a.hf, "assets", "transcript.json")):
        petla_tr = a.transkrypcja or os.path.join(a.hf, "assets", "transcript.json")
        w = json.load(open(petla_tr, encoding="utf-8"))
        w = w if isinstance(w, list) else w.get("words", [])
        tx = [(x.get("text") or x.get("word") or "").strip() for x in w]
        print(f"  PĘTLA ZDANIOWA: ...{' '.join(tx[-7:])}  ||  {' '.join(tx[:9])}...")
    return kl, D


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("wejscie", nargs="?")
    ap.add_argument("--hf")
    ap.add_argument("--lektor")
    ap.add_argument("--transkrypcja")
    ap.add_argument("--czasy", help="lista zdarzeń do oceny kasyna (dla --hf)")
    ap.add_argument("--format", choices=list(kasyno.PROGI), default="explainer")
    ap.add_argument("--inna-petla")
    ap.add_argument("--co", type=float, default=1.0, help="co ile sekund klatka do kontroli stref")
    ap.add_argument("--out")
    a = ap.parse_args()
    if not a.wejscie and not a.hf:
        ap.error("podaj film MP4 albo --hf katalog_projektu")

    nazwa = os.path.basename(os.path.normpath(a.hf or a.wejscie))
    r = Raport(f"AUDYT BIBLII: {nazwa}")
    kl, D = audyt_hf(a, r) if a.hf else audyt_mp4(a, r)

    import concurrent.futures as cf
    with cf.ThreadPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as ex:
        wyniki = sorted(ex.map(lambda tp: strefy.analizuj_klatke(tp[1], tp[0]), kl), key=lambda w: w["t"])
    nar = [n for w in wyniki for n in w["naruszenia"]]
    ost = [n for w in wyniki for n in w["ostrzezenia"]]
    if nar:
        po = {}
        for n in nar:
            po.setdefault(n["strefa"], set()).add((n["tekst"].upper(), round(n["t"], 1)))
        for s, zb in po.items():
            teksty = sorted({tx for tx, _ in zb})
            r.dodaj(f"strefy: {s}", FAIL, f"{len(zb)} trafień, np. {', '.join(teksty[:6])}")
    else:
        r.dodaj("strefy: tekst", PASS, f"żaden napis w martwych strefach ({len(kl)} klatek)")
    if ost:
        r.dodaj("strefy: sprawdź okiem", WARN, f"{len(ost)} miejsc z detalem w strefach, patrz kontaktówka")

    out = os.path.abspath(a.out) if a.out else (os.path.abspath(a.hf) if a.hf else os.path.dirname(os.path.abspath(a.wejscie)))
    os.makedirs(out, exist_ok=True)
    kontakt = strefy.kontaktowka(wyniki, os.path.join(out, f"audyt-{nazwa}-strefy.png"))
    r.wypisz()
    print("RĘCZNIE (tego nie zmierzy skrypt, odhacz w głowie albo w raporcie):")
    for i, p in enumerate(RECZNIE, 1):
        print(f"  [ ] {i:2d}. {p}")

    baza = os.path.join(out, f"audyt-{nazwa}")
    json.dump({**r.json(), "recznie": RECZNIE, "dlugosc_s": D}, open(baza + ".json", "w"), ensure_ascii=False, indent=1)
    with open(baza + ".md", "w", encoding="utf-8") as f:
        f.write(f"# Audyt Biblii: {nazwa}\n\nWynik: **{r.status()}** | długość {D:.1f} s\n\n| Status | Kontrola | Opis |\n|---|---|---|\n")
        for w in r.wyniki:
            f.write(f"| {w['status']} | {w['kontrola']} | {w['opis'].replace('|', '/')} |\n")
        f.write("\n## Do sprawdzenia ręcznie\n\n" + "\n".join(f"- [ ] {p}" for p in RECZNIE) + "\n")
        if kontakt:
            f.write(f"\nKontaktówka stref: `{kontakt}`\n")
    print(f"\nRaport: {baza}.md\nJSON: {baza}.json" + (f"\nKontaktówka: {kontakt}" if kontakt else ""))
    sys.exit(1 if r.status() == FAIL else 0)


if __name__ == "__main__":
    main()
