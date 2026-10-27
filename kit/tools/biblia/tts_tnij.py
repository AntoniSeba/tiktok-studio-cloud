#!/usr/bin/env python3
"""Lektor TTS (ElevenLabs, Gemini, dowolny) -> agresywne wycięcie KAŻDEJ ciszy i oddechów -> tempo 1,12x -> poziom.

Zasada z Biblii: każda setna sekundy, w której lektor nie mówi, to strata retencji. Tniemy po stronie
agresywnej, ale tak, żeby nie zjadać końcówek słów (syczące "s", "sz", "ść" są ciche, dlatego zostawiamy
im 40 ms ogona). Tempo 1,12x stosujemy RAZ: tutaj na lektorze (gdy film budujemy z lektora) albo
na gotowym MP4 (przyspiesz.py), nigdy w obu miejscach.

Użycie:
  python3 tts_tnij.py WEJSCIE.mp3 WYJSCIE.mp3                 # tryb agresywny, tempo 1,12
  python3 tts_tnij.py WEJSCIE.wav WYJSCIE.mp3 --tryb normalny
  python3 tts_tnij.py WEJSCIE.mp3 WYJSCIE.mp3 --tempo 1.0     # tylko cięcie, bez przyspieszenia
  python3 tts_tnij.py WEJSCIE.mp3 WYJSCIE.mp3 --prog -36      # ręczny próg ciszy w dBFS

Wynik: WYJSCIE.mp3 (mono 48 kHz, szczyt -3,5 dBFS), WYJSCIE.mapa.json (odcinki src -> dst w czasie
po przyspieszeniu, do przeliczania znaczników), raport PASS/FAIL. Kod wyjścia 1 przy FAIL.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _wspolne import FAIL, PASS, WARN, Raport, biegi, rms_db, wczytaj_audio, zapisz_wav  # noqa: E402

TRYBY = {
    # przed: zapas przed słowem, po: ogon po słowie, oddechy: wycinać oddechy, wzgl: próg = poziom mowy - wzgl dB
    "agresywny": dict(przed=0.020, po=0.040, oddechy=True, wzgl=30.0),
    "normalny": dict(przed=0.030, po=0.060, oddechy=False, wzgl=34.0),
    "lagodny": dict(przed=0.045, po=0.090, oddechy=False, wzgl=38.0),
}
SZCZYT_DOCELOWY = -3.5   # dBFS, zapas na kodeki (standard kanału)
MAX_PRZERWA = 0.12       # s, najdłuższa dopuszczalna przerwa po obróbce
MAX_START = 0.03         # s, lektor zaczyna od pierwszej setnej sekundy


def dzwiecznosc(x, sr, t_srodki, okno=0.030):
    """Udział periodyczności (głos dźwięczny) w oknach wokół podanych czasów: 0..1."""
    w = int(sr * okno)
    lag_min, lag_max = int(sr / 400), int(sr / 70)
    out = np.zeros(len(t_srodki))
    pad = np.pad(x, (w, w))
    for i, t in enumerate(t_srodki):
        c = int(t * sr) + w
        f = pad[c - w // 2: c + w // 2].astype(np.float64)
        f = f - f.mean()
        e = np.dot(f, f)
        if e < 1e-9:
            continue
        spec = np.fft.rfft(f, 2 * w)
        ac = np.fft.irfft(spec * np.conj(spec))[: w]
        out[i] = max(0.0, ac[lag_min:lag_max].max() / ac[0]) if lag_max < w else 0.0
    return out


def srodek_widma(k, sr):
    if len(k) < 256:
        return 0.0
    s = np.abs(np.fft.rfft(k * np.hanning(len(k))))
    f = np.fft.rfftfreq(len(k), 1 / sr)
    return float((s * f).sum() / max(s.sum(), 1e-12))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("wejscie")
    ap.add_argument("wyjscie")
    ap.add_argument("--tryb", choices=list(TRYBY), default="agresywny")
    ap.add_argument("--tempo", type=float, default=1.12, help="przyspieszenie (domyślnie 1.12, 1.0 = bez)")
    ap.add_argument("--prog", type=float, default=None, help="próg ciszy w dBFS (domyślnie automatyczny)")
    ap.add_argument("--zostaw-oddechy", action="store_true", help="nie wycinaj oddechów")
    ap.add_argument("--silence-map", help="zapisz też mapę w starym formacie silence-map.json (align_pauses.py)")
    a = ap.parse_args()

    cfg = dict(TRYBY[a.tryb])
    if a.zostaw_oddechy:
        cfg["oddechy"] = False

    x, sr = wczytaj_audio(a.wejscie)
    surowy = len(x) / sr
    krok = 0.005
    t, db = rms_db(x, sr, okno=0.020, krok=krok)
    glosne = db[db > -60]
    poziom_mowy = float(np.percentile(glosne, 95)) if len(glosne) else -20.0
    prog = a.prog if a.prog is not None else float(np.clip(poziom_mowy - cfg["wzgl"], -48, -28))

    mowa = db > prog
    bl = biegi(mowa)

    def cisza_przed(i):
        return (bl[i][0] - bl[i - 1][1]) * krok if i > 0 else 99.0

    def cisza_po(i):
        return (bl[i + 1][0] - bl[i][1]) * krok if i + 1 < len(bl) else 99.0

    # trzaski: bardzo krótkie impulsy daleko od mowy. Impulsy tuż przy słowie (wybuch "k", "t", "d"
    # na końcu wyrazu) zostają, bo to część słowa.
    for i, (s, e) in enumerate(bl):
        if (e - s) * krok < 0.025 and cisza_przed(i) > 0.15 and cisza_po(i) > 0.15:
            mowa[s:e] = False

    # oddechy: ciche, bezdźwięczne kawałki stojące SAMODZIELNIE w pauzie (cisza przed i po).
    # Bezdźwięczna końcówka zdania ("ła", "ce" wypowiedziane szeptem) ma ciszę tylko po sobie,
    # więc nie jest oddechem i zostaje.
    usuniete_oddechy = 0
    oddech = np.zeros(len(mowa), dtype=bool)
    if cfg["oddechy"]:
        for i, (s, e) in enumerate(bl):
            dl = (e - s) * krok
            if not (0.12 <= dl <= 0.80) or cisza_przed(i) < 0.12 or cisza_po(i) < 0.02:
                continue
            if float(np.mean(db[s:e])) > poziom_mowy - 14:
                continue
            # syczące "s", "sz", "ś" na początku słowa mają wysoki środek widma, oddech niski
            if srodek_widma(x[int(t[s] * sr): int(t[e - 1] * sr)], sr) > 3500:
                continue
            probki = t[s:e:4]
            if np.mean(dzwiecznosc(x, sr, probki) > 0.45) < 0.08:
                mowa[s:e] = False
                oddech[s:e] = True
                usuniete_oddechy += 1

    # zapas przed słowem i ogon po słowie
    n = len(mowa)
    rozsz = np.zeros(n, dtype=bool)
    p0, p1 = int(round(cfg["przed"] / krok)), int(round(cfg["po"] / krok))
    for s, e in biegi(mowa):
        rozsz[max(0, s - p0): min(n, e + p1)] = True
    odcinki = [(max(0.0, t[s] - 0.010), min(surowy, t[e - 1] + 0.010)) for s, e in biegi(rozsz)]
    if not odcinki:
        sys.exit("Nie znalazłem mowy w pliku. Sprawdź wejście albo podaj --prog.")
    # pierwszy odcinek zaczyna się dokładnie na pierwszym słowie
    odcinki[0] = (max(0.0, odcinki[0][0] + 0.010 - 0.005), odcinki[0][1])

    # sklejanie z miękkimi zszyciami 3 ms (bez trzasków)
    fade = int(0.003 * sr)
    okno_f = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, fade))
    kawalki = []
    for i, (s, e) in enumerate(odcinki):
        k = x[int(s * sr): int(e * sr)].copy()
        if len(k) > 2 * fade:
            if i > 0:
                k[:fade] *= okno_f
            if i < len(odcinki) - 1:
                k[-fade:] *= okno_f[::-1]
        kawalki.append(k)
    y = np.concatenate(kawalki)
    po_cieciu = len(y) / sr

    with tempfile.TemporaryDirectory() as tmp:
        w1 = os.path.join(tmp, "ciete.wav")
        w2 = os.path.join(tmp, "tempo.wav")
        zapisz_wav(w1, y, sr)
        af = f"atempo={a.tempo:.4f}" if abs(a.tempo - 1.0) > 1e-3 else "anull"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", w1, "-af", af, "-ar", str(sr), "-ac", "1", w2],
                       check=True)
        z, _ = wczytaj_audio(w2, sr)
        szczyt = float(np.max(np.abs(z))) + 1e-12
        zysk_db = SZCZYT_DOCELOWY - 20 * np.log10(szczyt)
        z = z * (10 ** (zysk_db / 20))
        w3 = os.path.join(tmp, "final.wav")
        zapisz_wav(w3, z, sr)
        kodek = ["-b:a", "192k"] if a.wyjscie.lower().endswith(".mp3") else []
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", w3] + kodek + [a.wyjscie], check=True)

    koncowy = len(z) / sr

    # mapa czasów src -> dst (po przyspieszeniu)
    mapa, kursor = [], 0.0
    for s, e in odcinki:
        d = e - s
        mapa.append({"src": [round(s, 4), round(e, 4)],
                     "dst": [round(kursor / a.tempo, 4), round((kursor + d) / a.tempo, 4)]})
        kursor += d
    sciezka_mapy = os.path.splitext(a.wyjscie)[0] + ".mapa.json"
    json.dump({"zrodlo": os.path.abspath(a.wejscie), "tryb": a.tryb, "tempo": a.tempo, "prog_db": round(prog, 1),
               "surowy_s": round(surowy, 3), "po_cieciu_s": round(po_cieciu, 3), "koncowy_s": round(koncowy, 3),
               "odcinki": mapa}, open(sciezka_mapy, "w"), indent=1)
    if a.silence_map:
        json.dump({"segments": mapa, "raw": round(surowy, 4), "cut": round(koncowy, 4), "tempo": a.tempo},
                  open(a.silence_map, "w"), indent=1)

    # kontrola wyniku: przerwy, start, zachowana mowa
    tz, dbz = rms_db(z, sr, okno=0.020, krok=krok)
    prog_z = prog + zysk_db
    cisza = dbz <= prog_z
    przerwy = [((e - s) * krok, tz[s]) for s, e in biegi(cisza) if s > 0 and e < len(cisza)]
    najdl = max([p[0] for p in przerwy], default=0.0)
    za_dlugie = [p for p in przerwy if p[0] > MAX_PRZERWA]
    start = 0.0
    for s, e in biegi(~cisza):
        start = tz[s] - 0.010
        break

    zachowane = np.zeros(len(t), dtype=bool)
    for s, e in odcinki:
        zachowane[(t >= s) & (t <= e)] = True
    energia = 10 ** (db / 10) * ((db > prog) & ~oddech)
    udzial = float(energia[zachowane].sum() / max(energia.sum(), 1e-12))

    r = Raport(f"TTS: {os.path.basename(a.wejscie)} -> {os.path.basename(a.wyjscie)} (tryb {a.tryb}, tempo {a.tempo}x)")
    r.dodaj("dlugosc", PASS, f"surowy {surowy:.2f} s -> po cięciu {po_cieciu:.2f} s "
            f"({100 * (1 - po_cieciu / surowy):.1f}% ciszy) -> po tempie {koncowy:.2f} s")
    r.dodaj("prog", PASS, f"poziom mowy {poziom_mowy:.1f} dBFS, próg ciszy {prog:.1f} dBFS, "
            f"cięć {len(odcinki) - 1}, wyciętych oddechów {usuniete_oddechy}")
    r.dodaj("przerwy", FAIL if za_dlugie else PASS,
            f"najdłuższa pozostała przerwa {najdl * 1000:.0f} ms (limit {MAX_PRZERWA * 1000:.0f} ms)"
            + (f", za długie: {', '.join(f'{p[1]:.2f}s ({p[0] * 1000:.0f} ms)' for p in za_dlugie[:8])}"
               if za_dlugie else ""))
    r.dodaj("start", FAIL if start > MAX_START else PASS,
            f"pierwszy dźwięk po {start * 1000:.0f} ms (limit {MAX_START * 1000:.0f} ms)")
    r.dodaj("mowa zachowana", PASS if udzial >= 0.995 else (WARN if udzial >= 0.98 else FAIL),
            f"{udzial * 100:.2f}% energii mowy zostało w pliku (oddechy są poza mową)")
    r.dodaj("tempo", PASS if abs(a.tempo - 1.12) < 1e-3 else WARN,
            "1,12x zgodnie z Biblią" if abs(a.tempo - 1.12) < 1e-3 else
            f"tempo {a.tempo}x: pamiętaj o 1,12x na gotowym MP4 (przyspiesz.py), jeśli nie tutaj")
    r.wypisz()
    print(f"Plik: {os.path.abspath(a.wyjscie)}\nMapa: {os.path.abspath(sciezka_mapy)}")
    print("Dalej: transkrypcja słowo w słowo z TEGO pliku (czasy po cięciu i tempie), potem oś czasu.")
    sys.exit(1 if r.status() == FAIL else 0)


if __name__ == "__main__":
    main()
