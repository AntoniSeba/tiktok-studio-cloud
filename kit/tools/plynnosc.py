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
ok = not flashes and ratio <= 0.04
print("PASS" if ok else "FAIL: film miga albo się zacina. Najczęstsze przyczyny: ciężkie filtry CSS (kilka drop-shadow, blur, brightness) animowane co klatkę, "
      "stan zależny od poprzedniej klatki zamiast czystej funkcji czasu, elementy ładowane leniwie, mało miejsca na dysku przy renderze. "
      "Uprość filtry (cień jako osobny statyczny element), licz wszystko z t, wyrenderuj ponownie i sprawdź jeszcze raz.")
sys.exit(0 if ok else 1)
