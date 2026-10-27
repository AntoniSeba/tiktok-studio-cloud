#!/usr/bin/env python3
"""Przyspieszenie gotowego filmu o 1,12x (obraz i dźwięk, wysokość głosu bez zmian).

Używaj TYLKO wtedy, gdy lektor NIE był przyspieszony przez tts_tnij.py (np. nagranie UGC, materiał
z kamery, film zmontowany w CapCut na surowym lektorze). Tempo 1,12x stosujemy dokładnie raz.

Użycie:
  python3 przyspiesz.py film.mp4 film-112.mp4
  python3 przyspiesz.py film.mp4 film-112.mp4 --tempo 1.12 --fps 30
"""
import argparse
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _wspolne import czas_trwania, ma_audio, wymagaj  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("wejscie")
    ap.add_argument("wyjscie")
    ap.add_argument("--tempo", type=float, default=1.12)
    ap.add_argument("--fps", type=int, default=30)
    a = ap.parse_args()
    wymagaj("ffmpeg")
    przed = czas_trwania(a.wejscie)
    if ma_audio(a.wejscie):
        fc = f"[0:v]setpts=PTS/{a.tempo}[v];[0:a]atempo={a.tempo}[a]"
        mapy = ["-map", "[v]", "-map", "[a]", "-c:a", "aac", "-b:a", "192k"]
    else:
        fc = f"[0:v]setpts=PTS/{a.tempo}[v]"
        mapy = ["-map", "[v]"]
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", a.wejscie, "-filter_complex", fc] + mapy +
                   ["-r", str(a.fps), "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", a.wyjscie], check=True)
    po = czas_trwania(a.wyjscie)
    print(f"{przed:.2f} s -> {po:.2f} s (tempo {a.tempo}x)\nPlik: {os.path.abspath(a.wyjscie)}")


if __name__ == "__main__":
    main()
