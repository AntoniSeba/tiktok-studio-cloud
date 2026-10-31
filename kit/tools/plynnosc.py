"""Bramka PŁYNNOŚCI: sprawdza gotowe MP4 klatka po klatce, czy obraz nie miga i się nie zacina.

  python3 plynnosc.py film.mp4 [--do 5]      # --do: sprawdź tylko pierwsze N sekund

Czego szuka (to widz widzi jako "zbugowane", a snapshoty co 0,25 s tego nie łapią):
- MIGNIĘCIE: pojedyncza klatka wyraźnie inna niż obie sąsiednie, które są do siebie podobne
  (np. na jedną klatkę wraca stan początkowy sceny, znika filtr albo napisy). Każde to FAIL.
- ZACINANIE: w trakcie ruchu klatka identyczna z poprzednią, a następna znowu się rusza
  (ruch idzie skokami, np. co trzecia klatka stoi). Więcej niż 4% takich klatek to FAIL.
- SKOK: duża zmiana całego kadru w jednej klatce, która zostaje (twarde cięcie albo przeskok koloru).
  Tylko informacja z czasami: w ciągłym ujęciu hooka (0-5 s) nie powinno być żadnego.
Darmowe, bez modelu. Mierzy różnicę jasności na zmniejszonych klatkach (108x192).
"""
import subprocess, sys

args = sys.argv[1:]
if not args: sys.exit(__doc__)
path, limit = args[0], None
if "--do" in args: limit = float(args[args.index("--do") + 1])

W, H = 108, 192
cmd = ["ffmpeg", "-nostdin", "-v", "error", "-i", path]
if limit: cmd += ["-t", str(limit)]
cmd += ["-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"]
raw = subprocess.run(cmd, capture_output=True).stdout
fps_s = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", path],
                       capture_output=True, text=True).stdout.strip() or "30/1"
num, den = (fps_s.split(",")[0].split("/") + ["1"])[:2]
fps = float(num) / float(den or 1)
n = W * H
fr = [raw[i:i + n] for i in range(0, len(raw) - n + 1, n)]
if len(fr) < 3: sys.exit("FAIL: za mało klatek w " + path)

def diff(a, b):
    return sum(abs(x - y) for x, y in zip(a, b)) / n

d = [0.0] + [diff(fr[i], fr[i - 1]) for i in range(1, len(fr))]
t = lambda i: f"{i / fps:.2f} s"
flashes, stutters, jumps = [], [], []
for i in range(1, len(fr) - 1):
    a, b = d[i], d[i + 1]
    if a > 10 and b > 10 and diff(fr[i - 1], fr[i + 1]) < 0.35 * min(a, b):
        flashes.append(i)
    elif d[i] < 0.05 and d[i - 1] > 0.3 and b > 0.3:
        stutters.append(i)
    elif a > 25 and b < 0.35 * a and (i - 1) not in flashes:
        jumps.append(i)

ratio = len(stutters) / len(fr)
print(f"klatek: {len(fr)} ({fps:g} kl/s)")
print(f"mignięcia: {len(flashes)}" + (" w " + ", ".join(t(i) for i in flashes[:12]) if flashes else "") + " (cel 0)")
print(f"zacinanie: {len(stutters)} klatek stoi w trakcie ruchu ({ratio:.0%}, cel <= 4%)" + (", np. " + ", ".join(t(i) for i in stutters[:6]) if stutters else ""))
print(f"skoki całego kadru: {len(jumps)}" + (" w " + ", ".join(t(i) for i in jumps[:12]) if jumps else "") + " (w ciągłym ujęciu hooka cel 0)")
# NIEPOKÓJ: ile razy na sekundę kadr wyraźnie szarpie i jak dużo klatek jest spokojnych.
# Dobre filmy kanałów (silniki z B-rollem, Wykłady Razem): 0,3 do 2,6 szarpnięcia/s i 80 do 93% spokojnych klatek.
# Film z frazami wlatującymi i wylatującymi co pół sekundy miał 4,3/s i 68%: widz dostaje oczopląsu.
secs = len(fr) / fps
jerks = sum(1 for x in d if x > 8) / secs
calm = sum(1 for x in d if x < 3) / len(d)
calm_ok = jerks <= 3.0 and calm >= 0.78
print(f"niepokój: {jerks:.2f} szarpnięcia/s (cel <= 3,0), spokojne klatki {calm:.0%} (cel >= 78%)")
ok = not flashes and ratio <= 0.04 and calm_ok
if not calm_ok:
    print("FAIL: film jest nerwowy (oczopląs). Napis zostaje na ekranie co najmniej 1,2 s i zmienia się na całe zdanie albo frazę, nie co 2 słowa; "
          "jedno miękkie wejście, wyjście samym zanikiem lub czystym cięciem (bez wylatywania w górę i rozsypywania liter); "
          "bez pełnoekranowych zmian koloru tła poza cięciem sceny; kamera i tło stoją albo jadą jednym wolnym ruchem. Popraw i wyrenderuj raz jeszcze.")
print("PASS" if ok else "FAIL: film miga albo się zacina. Najczęstsze przyczyny: ciężkie filtry CSS (kilka drop-shadow, blur, brightness) animowane co klatkę, "
      "stan zależny od poprzedniej klatki zamiast czystej funkcji czasu, elementy ładowane leniwie, mało miejsca na dysku przy renderze. "
      "Uprość filtry (cień jako osobny statyczny element), licz wszystko z t, wyrenderuj ponownie i sprawdź jeszcze raz." if calm_ok else "FAIL")
sys.exit(0 if ok else 1)
