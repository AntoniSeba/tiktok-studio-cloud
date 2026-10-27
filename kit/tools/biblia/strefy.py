#!/usr/bin/env python3
"""Kontrola martwych stref TikToka: PASS / FAIL, automatycznie, dla każdego filmu.

Sprawdza, czy w strefach zasłoniętych przez interfejs TikToka (góra, dół z opisem, prawa szyna
z przyciskami) nie stoi żaden czytelny tekst i czy żaden napis nie jest ucięty na krawędzi kadru.
Tekst wykrywa OCR (tesseract) na wycinkach stref, w wersji zwykłej i odwróconej (biały na ciemnym).
Grafika bez tekstu jest oznaczana jako WARN, gdy w strefie jest dużo detalu: wtedy patrz na kontaktówkę.

Wejście (dowolne z tych):
  python3 strefy.py film.mp4                     # klatka co 1 s (zmień: --co 0.5)
  python3 strefy.py klatka.png | katalog_z_png/
  python3 strefy.py /sciezka/projekt-hyperframes  # bez renderu MP4: zrzuty przez `hyperframes snapshot`
  python3 strefy.py film.mp4 --at 0,1.5,7.2       # tylko wskazane chwile
  python3 strefy.py --nakladka strefy.png         # sama przezroczysta nakładka 1080x1920 do edytora

Wynik: tabela, strefy-raport.json i strefy-kontaktowka.png w --out (domyślnie obok wejścia).
Kod wyjścia 1, gdy FAIL. Strefy są w _wspolne.py (STREFY), w pikselach kadru 1080x1920.
"""
import argparse
import concurrent.futures as cf
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _wspolne import (FAIL, H0, PASS, STREFY, W0, WARN, Raport, czas_trwania, czy_projekt_hyperframes,  # noqa: E402
                      dlugosc_hyperframes, wersja_hyperframes, wymagaj)

MARGINES = 40           # wycinek strefy sięga 40 px w głąb bezpiecznego pola, żeby złapać napisy na granicy
MIN_PEWNOSC = 62        # pewność OCR (0..100)
MIN_WYSOKOSC = 16       # px w kadrze 1080x1920, mniejsze to szum
UDZIAL_W_STREFIE = 0.30  # słowo łamie strefę, gdy co najmniej 30% jego pola jest w strefie


def font(rozmiar):
    for f in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc",
              "/Library/Fonts/Arial.ttf"]:
        if os.path.exists(f):
            return ImageFont.truetype(f, rozmiar)
    return ImageFont.load_default()


def nakladka(sciezka):
    im = Image.new("RGBA", (W0, H0), (0, 0, 0, 0))
    d = ImageDraw.Draw(im, "RGBA")
    for nazwa, x0, y0, x1, y1, poziom in STREFY:
        kol = (230, 40, 40, 110) if poziom == FAIL else (255, 160, 0, 80)
        d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=kol)
        if x1 - x0 > 150 and y1 - y0 > 60:
            d.text((x0 + 16, y0 + 12), f"{nazwa} ({poziom})", fill=(255, 255, 255, 230), font=font(30))
    d.rectangle([0, 250, W0 - 1, 1429], outline=(40, 220, 120, 200), width=3)
    d.text((24, 262), "bezpieczne pole: y 250..1430, ponizej y 1000 tylko x <= 850", fill=(40, 220, 120, 230),
           font=font(28))
    im.save(sciezka)
    return sciezka


def ocr(obraz):
    """Słowa z tesseract (TSV): lista (x, y, w, h, pewność, tekst) w pikselach obrazu."""
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        obraz.save(f.name)
        p = f.name
    try:
        out = subprocess.run(["tesseract", p, "stdout", "--psm", "11", "-l", "eng", "tsv"],
                             capture_output=True, text=True,
                             env={**os.environ, "OMP_THREAD_LIMIT": "1"}).stdout
    finally:
        os.remove(p)
    slowa = []
    for linia in out.splitlines()[1:]:
        c = linia.split("\t")
        if len(c) < 12 or c[0] != "5":
            continue
        tekst = c[11].strip()
        try:
            pew = float(c[10])
        except ValueError:
            continue
        if pew < MIN_PEWNOSC or len(re.sub(r"[^0-9A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]", "", tekst)) < 2:
            continue
        slowa.append((int(c[6]), int(c[7]), int(c[8]), int(c[9]), pew, tekst))
    return slowa


def analizuj_klatke(sciezka_png, t, bez_ocr=False):
    im = Image.open(sciezka_png).convert("RGB")
    if im.size != (W0, H0):
        im = im.resize((W0, H0))
    szary = im.convert("L")
    arr = np.asarray(szary).astype(np.float32)
    naruszenia, ostrzezenia = [], []

    if not bez_ocr:
        widziane = []
        # trzy wycinki pokrywają wszystkie strefy (z marginesem w głąb kadru): pas górny, pas dolny,
        # prawa kolumna. Napis przy krawędzi bocznej łapie się w nich albo w teście "ucięty".
        wycinki = [(0, 0, W0, 250 + MARGINES), (0, 1430 - MARGINES, W0, H0),
                   (850 - MARGINES, 860 - MARGINES, W0, 1430 + MARGINES)]
        for cx0, cy0, cx1, cy1 in wycinki:
            wyc = szary.crop((cx0, cy0, cx1, cy1))
            skala = 1.0 if (cx1 - cx0) * (cy1 - cy0) < 300_000 else 0.8
            if skala != 1.0:
                wyc = wyc.resize((int(wyc.width * skala), int(wyc.height * skala)))
            for wariant in (wyc, Image.eval(wyc, lambda v: 255 - v)):
                for (x, y, w, h, pew, tekst) in ocr(wariant):
                    X, Y, Wd, Hd = cx0 + x / skala, cy0 + y / skala, w / skala, h / skala
                    if Hd < MIN_WYSOKOSC:
                        continue
                    klucz = (round(X / 20), round(Y / 20), tekst.lower())
                    if klucz in widziane:
                        continue
                    widziane.append(klucz)
                    pole = Wd * Hd
                    for n2, a0, b0, a1, b1, pz in STREFY:
                        ix = max(0, min(X + Wd, a1) - max(X, a0))
                        iy = max(0, min(Y + Hd, b1) - max(Y, b0))
                        if pole > 0 and ix * iy / pole >= UDZIAL_W_STREFIE:
                            rek = {"t": t, "strefa": n2, "tekst": tekst, "pewnosc": round(pew),
                                   "box": [int(X), int(Y), int(Wd), int(Hd)]}
                            (naruszenia if pz == FAIL else ostrzezenia).append(rek)
                            break
                    if X <= 3 or Y <= 3 or X + Wd >= W0 - 3 or Y + Hd >= H0 - 3:
                        naruszenia.append({"t": t, "strefa": "krawedz (uciety napis)", "tekst": tekst,
                                           "pewnosc": round(pew), "box": [int(X), int(Y), int(Wd), int(Hd)]})

    # gęstość detalu (grafiki bez tekstu): krawędzie w strefach FAIL kontra bezpieczne pole
    gy, gx = np.gradient(arr)
    kraw = np.hypot(gx, gy) > 60
    bezp = kraw[250:1430, 40:850].mean()
    for nazwa, x0, y0, x1, y1, poziom in STREFY:
        if poziom != FAIL:
            continue
        g = kraw[y0:y1, x0:x1].mean()
        if g > max(0.06, 1.8 * bezp):
            ostrzezenia.append({"t": t, "strefa": nazwa, "tekst": f"duzo detalu ({g:.2f} vs {bezp:.2f})",
                                "pewnosc": 0, "box": [x0, y0, x1 - x0, y1 - y0]})
    return {"t": t, "plik": sciezka_png, "naruszenia": naruszenia, "ostrzezenia": ostrzezenia}


def klatki_z_mp4(sciezka, czasy, katalog, co=None):
    """Klatki do kontroli. Z `co` jedno przejście ffmpeg (szybko), bez niego klatka po klatce."""
    wymagaj("ffmpeg")
    wynik = []
    if co:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", sciezka, "-vf", f"fps=1/{co},scale={W0}:{H0}",
                        "-start_number", "0", os.path.join(katalog, "g%05d.png")], check=True)
        for p in sorted(glob.glob(os.path.join(katalog, "g*.png"))):
            i = int(re.search(r"g(\d+)\.png$", p).group(1))
            wynik.append((round(i * co, 3), p))
        p = os.path.join(katalog, "koniec.png")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-sseof", "-0.1", "-i", sciezka, "-frames:v", "1",
                        "-vf", f"scale={W0}:{H0}", p], check=True)
        if os.path.exists(p):
            wynik.append((round(czas_trwania(sciezka) - 0.05, 3), p))
        return wynik
    for i, t in enumerate(czasy):
        p = os.path.join(katalog, f"k{i:04d}.png")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", sciezka, "-frames:v", "1",
                        "-vf", f"scale={W0}:{H0}", p], check=True)
        if os.path.exists(p):
            wynik.append((t, p))
    return wynik


def klatki_z_hyperframes(katalog_proj, czasy, katalog):
    wer = wersja_hyperframes(katalog_proj) or "latest"
    print(f"HyperFrames {wer}: zrzucam {len(czasy)} klatek (bez renderu MP4)...")
    wynik = []
    for i in range(0, len(czasy), 40):
        paczka = czasy[i:i + 40]
        sub = os.path.join(katalog, f"p{i:04d}")
        os.makedirs(sub, exist_ok=True)
        subprocess.run(["npx", "--yes", f"hyperframes@{wer}", "snapshot", katalog_proj, "--at",
                        ",".join(f"{t:.2f}" for t in paczka), "--no-end", "--describe", "false",
                        "--output", sub], check=True, capture_output=True)
        for p in sorted(glob.glob(os.path.join(sub, "frame-*-at-*s.png"))):
            m = re.search(r"-at-([\d.]+)s\.png$", p)
            if m:
                wynik.append((float(m.group(1)), p))
    return sorted(wynik)


def kontaktowka(wyniki, sciezka, max_klatek=48):
    z_problemem = [w for w in wyniki if w["naruszenia"] or w["ostrzezenia"]]
    reszta = [w for w in wyniki if w not in z_problemem]
    krok = max(1, len(reszta) // max(1, max_klatek - len(z_problemem)))
    wybrane = sorted(z_problemem + reszta[::krok], key=lambda w: w["t"])[:max_klatek]
    if not wybrane:
        return None
    s = 0.2
    tw, th = int(W0 * s), int(H0 * s)
    kol = min(8, len(wybrane))
    rz = (len(wybrane) + kol - 1) // kol
    arkusz = Image.new("RGB", (kol * (tw + 6) + 6, rz * (th + 30) + 6), (18, 18, 20))
    over = Image.open(nakladka(sciezka + ".tmp.png")).resize((tw, th))
    os.remove(sciezka + ".tmp.png")
    d = ImageDraw.Draw(arkusz)
    for i, w in enumerate(wybrane):
        x, y = 6 + (i % kol) * (tw + 6), 6 + (i // kol) * (th + 30)
        im = Image.open(w["plik"]).convert("RGBA").resize((tw, th))
        im.alpha_composite(over)
        dd = ImageDraw.Draw(im)
        for rek in w["naruszenia"]:
            bx, by, bw, bh = rek["box"]
            dd.rectangle([bx * s, by * s, (bx + bw) * s, (by + bh) * s], outline=(255, 230, 0), width=3)
        for rek in w["ostrzezenia"]:
            bx, by, bw, bh = rek["box"]
            dd.rectangle([bx * s, by * s, (bx + bw) * s, (by + bh) * s], outline=(255, 160, 0), width=1)
        arkusz.paste(im.convert("RGB"), (x, y))
        status = "FAIL" if w["naruszenia"] else ("WARN" if w["ostrzezenia"] else "ok")
        kolor = (255, 80, 80) if status == "FAIL" else ((255, 170, 0) if status == "WARN" else (150, 150, 150))
        d.text((x + 4, y + th + 6), f"{w['t']:.1f}s {status}", fill=kolor, font=font(16))
    arkusz.save(sciezka)
    return sciezka


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("wejscie", nargs="?")
    ap.add_argument("--co", type=float, default=1.0, help="odstęp próbek w sekundach (MP4 i HyperFrames)")
    ap.add_argument("--at", default=None, help="konkretne chwile, np. 0,1.5,7.2")
    ap.add_argument("--out", default=None, help="katalog na raport i kontaktówkę")
    ap.add_argument("--bez-ocr", action="store_true", help="tylko gęstość detalu (szybko, bez tekstu)")
    ap.add_argument("--nakladka", default=None, help="zapisz przezroczystą nakładkę stref 1080x1920 i wyjdź")
    ap.add_argument("--watki", type=int, default=max(2, (os.cpu_count() or 4) - 1))
    a = ap.parse_args()

    if a.nakladka:
        print(nakladka(a.nakladka))
        return
    if not a.wejscie:
        ap.error("podaj plik MP4, PNG, katalog z PNG albo projekt HyperFrames")
    if not a.bez_ocr:
        wymagaj("tesseract")

    wej = os.path.abspath(a.wejscie)
    out = os.path.abspath(a.out) if a.out else (wej if os.path.isdir(wej) else os.path.dirname(wej))
    os.makedirs(out, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="strefy-")

    if czy_projekt_hyperframes(wej):
        D = dlugosc_hyperframes(wej) or 60.0
        czasy = [float(x) for x in a.at.split(",")] if a.at else list(np.arange(0, D, a.co)) + [max(0, D - 0.05)]
        klatki = klatki_z_hyperframes(wej, czasy, tmp)
    elif os.path.isdir(wej):
        pliki = sorted(glob.glob(os.path.join(wej, "*.png")) + glob.glob(os.path.join(wej, "*.jpg")))
        klatki = []
        for i, p in enumerate(pliki):
            m = re.search(r"-at-([\d.]+)s\.", p)
            klatki.append((float(m.group(1)) if m else float(i), p))
    elif wej.lower().endswith((".png", ".jpg", ".jpeg")):
        klatki = [(0.0, wej)]
    else:
        D = czas_trwania(wej)
        if a.at:
            klatki = klatki_z_mp4(wej, [float(x) for x in a.at.split(",")], tmp)
        else:
            klatki = klatki_z_mp4(wej, None, tmp, co=a.co)

    if not klatki:
        sys.exit("Nie udało się pobrać żadnej klatki.")
    print(f"Sprawdzam {len(klatki)} klatek...")
    with cf.ThreadPoolExecutor(max_workers=a.watki) as ex:
        wyniki = list(ex.map(lambda tp: analizuj_klatke(tp[1], tp[0], a.bez_ocr), klatki))
    wyniki.sort(key=lambda w: w["t"])

    nar = [n for w in wyniki for n in w["naruszenia"]]
    ost = [n for w in wyniki for n in w["ostrzezenia"]]
    r = Raport(f"Martwe strefy: {os.path.basename(wej)} ({len(klatki)} klatek)")
    if nar:
        po_strefach = {}
        for n in nar:
            po_strefach.setdefault(n["strefa"], []).append(n)
        for s, lst in po_strefach.items():
            # ten sam napis w wielu klatkach (np. stały nagłówek) pokazujemy raz, z zakresem czasu
            po_tekscie = {}
            for n in lst:
                po_tekscie.setdefault(n["tekst"].upper(), []).append(n["t"])
            przyk = "; ".join(
                f"\"{tx}\" {min(ts):.1f}s" + (f" do {max(ts):.1f}s ({len(set(ts))} klatek)" if len(set(ts)) > 1 else "")
                for tx, ts in sorted(po_tekscie.items(), key=lambda kv: -len(kv[1]))[:6])
            y_max = max(n["box"][1] + n["box"][3] for n in lst) if s == "gora" else None
            dop = f" | najniższy napis kończy się na y {y_max}, przesuń treść poniżej y 250" if y_max else ""
            r.dodaj(f"tekst w strefie {s}", FAIL, f"{len(lst)} trafień: {przyk}{dop}")
    else:
        r.dodaj("tekst w martwych strefach", PASS, "żaden czytelny napis nie wchodzi w strefy interfejsu")
    if ost:
        po = {}
        for n in ost:
            po.setdefault(n["strefa"], []).append(n)
        for s, lst in po.items():
            przyk = ", ".join(f"{n['t']:.1f}s" for n in lst[:8])
            r.dodaj(f"sprawdź okiem: {s}", WARN, f"{len(lst)} klatek ({przyk})")
    r.wypisz()

    kontakt = kontaktowka(wyniki, os.path.join(out, "strefy-kontaktowka.png"))
    rap = os.path.join(out, "strefy-raport.json")
    json.dump({**r.json(), "klatki": wyniki}, open(rap, "w"), ensure_ascii=False, indent=1)
    print(f"Raport: {rap}")
    if kontakt:
        print(f"Kontaktówka (czerwone = martwe strefy, żółte ramki = naruszenia): {kontakt}")
    sys.exit(1 if r.status() == FAIL else 0)


if __name__ == "__main__":
    main()
