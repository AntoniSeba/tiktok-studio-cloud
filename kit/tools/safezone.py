"""Martwe strefy TikToka na klatkach kontrolnych.

python3 safezone.py <katalog ze snapshotami>   (np. project/snapshots)

Na każdą klatkę frame-*.png nakłada przybliżone strefy interfejsu TikToka (1080x1920):
- góra 0-200 px: pasek statusu i zakładki "Obserwowani / Dla Ciebie",
- dół 1440-1920 px: nick, opis, dźwięk, pasek nawigacji,
- prawa kolumna x 940-1080, y 600-1440: awatar, serce, komentarze, zapis, udostępnij.
Zapisuje <katalog>/safezone/frame-*.png i arkusz <katalog>/safezone-sheet.jpg do obejrzenia.
Wymaga tylko ffmpeg.
"""
import glob, os, subprocess, sys

ZONES = [(0, 0, 1080, 200), (0, 1440, 1080, 480), (940, 600, 140, 840)]
SAFE = (60, 200, 880, 1240)   # zielona ramka: tu muszą być napisy, liczby i kluczowe obiekty

d = sys.argv[1] if len(sys.argv) > 1 else "snapshots"
frames = sorted(glob.glob(os.path.join(d, "frame-*.png")))
if not frames:
    sys.exit(f"brak plików frame-*.png w {d}")
out = os.path.join(d, "safezone"); os.makedirs(out, exist_ok=True)
vf = ",".join([f"scale=1080:1920"] + [f"drawbox=x={x}:y={y}:w={w}:h={h}:color=red@0.38:t=fill" for x, y, w, h in ZONES]
              + [f"drawbox=x={SAFE[0]}:y={SAFE[1]}:w={SAFE[2]}:h={SAFE[3]}:color=lime@0.9:t=4"])
outs = []
for f in frames:
    o = os.path.join(out, os.path.basename(f))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f, "-vf", vf, o], check=True)
    outs.append(o)
cols = 4; rows = -(-len(outs) // cols)
lst = os.path.join(out, "list.txt")
with open(lst, "w") as fh:
    for o in outs + [outs[-1]] * (rows * cols - len(outs)):
        fh.write(f"file '{os.path.abspath(o)}'\n")
sheet = os.path.join(d, "safezone-sheet.jpg")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                "-vf", f"scale=360:640,tile={cols}x{rows}", "-frames:v", "1", "-q:v", "3", sheet], check=True)
os.remove(lst)
print(f"{len(outs)} klatek -> {sheet} (czerwone = UI TikToka, zielona ramka = bezpieczna strefa)")
