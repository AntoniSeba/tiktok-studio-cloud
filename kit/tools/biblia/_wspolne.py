"""Wspólne narzędzia skryptów Biblii TikToka: ffmpeg, klatki, audio, martwe strefy, raport PASS/FAIL.

Nie uruchamiaj bezpośrednio. Importują go: tts_tnij.py, strefy.py, kasyno.py, petla.py, audyt.py.
"""
import json
import os
import re
import shutil
import subprocess
import sys

import numpy as np

W0, H0 = 1080, 1920

# Martwe strefy TikToka w kadrze 1080x1920 (standard kanału, sprawdzony na filmach o silnikach).
# nazwa, x0, y0, x1, y1, poziom (FAIL = nic czytelnego nie może tu stać, WARN = sprawdź okiem)
STREFY = [
    ("gora", 0, 0, 1080, 250, "FAIL"),              # pasek statusu, Obserwowani / Dla Ciebie, LIVE, lupa
    ("dol", 0, 1430, 1080, 1920, "FAIL"),           # nick, opis, dźwięk, kotwica produktu, nawigacja
    ("prawa-szyna", 850, 1000, 1080, 1430, "FAIL"),  # awatar, serce, komentarze, zapisy, udostępnij
    ("prawa-szyna-gora", 850, 860, 1080, 1000, "WARN"),  # na wysokich ekranach awatar wchodzi wyżej
    ("lewy-brzeg", 0, 250, 40, 1430, "WARN"),        # przycięcie boków na ekranach 19,5:9 i 20:9
    ("prawy-brzeg", 1040, 250, 1080, 860, "WARN"),
]

PASS, WARN, FAIL = "PASS", "WARN", "FAIL"


def wymagaj(narzedzie):
    if shutil.which(narzedzie) is None:
        sys.exit(f"Brak programu {narzedzie}. Zainstaluj: brew install {narzedzie}")


def czas_trwania(sciezka):
    wymagaj("ffprobe")
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", sciezka]).decode().strip()
    return float(out)


def info_wideo(sciezka):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
        "stream=width,height,r_frame_rate", "-of", "json", sciezka]).decode()
    s = json.loads(out)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), float(num) / float(den or 1)


def ma_audio(sciezka):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0",
        sciezka]).decode().strip()
    return bool(out)


def wczytaj_audio(sciezka, sr=48000):
    """Mono float32 w zakresie -1..1."""
    wymagaj("ffmpeg")
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", sciezka, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy(), sr


def zapisz_wav(sciezka, x, sr):
    x = np.clip(x, -1, 1).astype(np.float32)
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "-", sciezka],
        input=x.tobytes(), check=True)


def rms_db(x, sr, okno=0.020, krok=0.005):
    """Poziom RMS w dBFS co `krok` sekund, okno `okno`. Zwraca (czasy_srodkow, db)."""
    w = max(1, int(sr * okno))
    h = max(1, int(sr * krok))
    if len(x) < w:
        x = np.pad(x, (0, w - len(x)))
    n = 1 + (len(x) - w) // h
    idx = np.arange(w)[None, :] + h * np.arange(n)[:, None]
    ramki = x[idx]
    r = np.sqrt(np.mean(ramki.astype(np.float64) ** 2, axis=1) + 1e-12)
    t = (np.arange(n) * h + w / 2) / sr
    return t, 20 * np.log10(r)


def biegi(maska):
    """Ciągłe odcinki True w masce bool: lista (start, koniec_wyłącznie)."""
    m = np.concatenate([[False], maska.astype(bool), [False]])
    d = np.diff(m.astype(np.int8))
    starty = np.where(d == 1)[0]
    konce = np.where(d == -1)[0]
    return list(zip(starty, konce))


def klatki_szare(sciezka, szer=72, wys=128, fps=None):
    """Cały film jako tablica (n, wys, szer) uint8, plus fps. Do różnic klatka do klatki."""
    wymagaj("ffmpeg")
    _, _, fps_src = info_wideo(sciezka)
    vf = f"scale={szer}:{wys},format=gray"
    if fps:
        vf = f"fps={fps}," + vf
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", sciezka, "-vf", vf, "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.uint8)
    n = len(a) // (szer * wys)
    return a[: n * szer * wys].reshape(n, wys, szer), (fps or fps_src)


def klatka_rgb(sciezka, t, szer=W0, wys=H0):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", f"{max(0.0, t):.3f}", "-i", sciezka, "-frames:v", "1",
         "-vf", f"scale={szer}:{wys}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True).stdout
    if len(raw) < szer * wys * 3:
        return None
    return np.frombuffer(raw[: szer * wys * 3], dtype=np.uint8).reshape(wys, szer, 3)


def ostatnia_klatka_rgb(sciezka, szer=W0, wys=H0):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-sseof", "-0.5", "-i", sciezka, "-vf", f"scale={szer}:{wys}",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    n = len(raw) // (szer * wys * 3)
    if n == 0:
        return None
    return np.frombuffer(raw[(n - 1) * szer * wys * 3: n * szer * wys * 3], dtype=np.uint8).reshape(wys, szer, 3)


def wersja_hyperframes(katalog):
    """Wersja HyperFrames przypięta w package.json projektu (np. 0.8.58), inaczej None."""
    p = os.path.join(katalog, "package.json")
    if os.path.exists(p):
        m = re.search(r"hyperframes@([\d.]+)", open(p, encoding="utf-8").read())
        if m:
            return m.group(1)
    return None


def czy_projekt_hyperframes(sciezka):
    return os.path.isdir(sciezka) and os.path.exists(os.path.join(sciezka, "hyperframes.json"))


def dlugosc_hyperframes(katalog):
    html = open(os.path.join(katalog, "index.html"), encoding="utf-8").read()
    m = re.search(r'data-composition-id="main"[^>]*data-duration="([\d.]+)"', html) or \
        re.search(r'data-duration="([\d.]+)"', html)
    return float(m.group(1)) if m else None


class Raport:
    """Zbiera wyniki kontroli i wypisuje tabelę PASS / WARN / FAIL."""

    def __init__(self, tytul):
        self.tytul = tytul
        self.wyniki = []

    def dodaj(self, nazwa, status, opis):
        self.wyniki.append({"kontrola": nazwa, "status": status, "opis": opis})

    def status(self):
        st = [w["status"] for w in self.wyniki]
        return FAIL if FAIL in st else (WARN if WARN in st else PASS)

    def wypisz(self):
        print(f"\n=== {self.tytul} ===")
        szer = max([len(w["kontrola"]) for w in self.wyniki] + [8])
        for w in self.wyniki:
            print(f"  [{w['status']:4s}] {w['kontrola']:<{szer}}  {w['opis']}")
        print(f"  WYNIK: {self.status()}\n")

    def json(self):
        return {"tytul": self.tytul, "wynik": self.status(), "kontrole": self.wyniki}
