"""Składa efekty dźwiękowe filmu o Wanklu w jedną ścieżkę, zsynchronizowaną z obrazem.

Każde zdarzenie ma widoczną przyczynę na ekranie; czasy biorą się z tych samych
torów co animacja (bęben, liczniki, śruby). Wynik: assets/sfx/sfx-mix.wav
"""
import json, math, subprocess
import numpy as np

SR = 48000
END = 91.25
SRC = "assets/sfx/src/"


def load(name, a=0.0, b=None, reverse=False, norm=True):
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", SRC + name, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()
    x = x[int(a * SR): int(b * SR) if b else None]
    if reverse:
        x = x[::-1].copy()
    if norm:
        x /= max(1e-6, np.abs(x).max())
    return x


def fade(x, fin=0.0, fout=0.0):
    n = len(x)
    if fin > 0:
        k = min(n, int(fin * SR)); x[:k] *= np.linspace(0, 1, k)[:, None]
    if fout > 0:
        k = min(n, int(fout * SR)); x[n - k:] *= np.linspace(1, 0, k)[:, None]
    return x


def pitch(x, ratio):
    # prosta zmiana wysokości przez przepróbkowanie (krótkie tyknięcia)
    n = int(len(x) / ratio)
    idx = np.linspace(0, len(x) - 1, n)
    return np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in range(2)], axis=1).astype(np.float32)


def lowpass(x, cutoff):
    a = math.exp(-2 * math.pi * cutoff / SR)
    y = np.zeros_like(x)
    for c in range(2):
        s = 0.0
        col = x[:, c]
        out = y[:, c]
        for i in range(len(col)):
            s = (1 - a) * col[i] + a * s
            out[i] = s
    return y / max(1e-6, np.abs(y).max())


def hsh(i):
    v = math.sin(i * 127.1 + 311.7) * 43758.5453
    return v - math.floor(v)


# ---------------------------------------------------------------- próbki
S = {
    "tick": fade(load("1131-click.wav", 0.095, 0.165), 0, 0.012),
    "tick2": fade(load("1131-click.wav", 0.515, 0.585), 0, 0.012),
    "whoosh": fade(load("1490-whoosh.wav", 0.0, 0.92), 0.05, 0.16),
    "sweep": fade(load("166-sweep.wav", 0.0, 0.75), 0.02, 0.12),
    "metal": fade(load("2639-metal-sweep.wav", 0.0, 1.4), 0.03, 0.3),
    "pop": fade(load("3005-pop.wav"), 0, 0.03),
    "ding": fade(load("1935-payout-ding.wav", 0.05, 1.3), 0.0, 0.45),
    "rumble": fade(load("2297-rumble.wav", 0.0, 3.0), 0.4, 1.0),
    "spin": fade(load("2650-spin-whoosh.wav", 0.0, 2.6), 0.3, 0.05),
    "lock": fade(load("2858-gear-lock.wav", 0.0, 0.6), 0, 0.15),
    "scrape": fade(load("2799-scrape.wav", 0.04, 0.3), 0.01, 0.08),
    "impact": fade(load("2908-impact.wav", 0.0, 2.6), 0.0, 0.8),
    "hammer": fade(load("833-hammer.wav", 0.08, 0.6), 0, 0.2),
}
S["thud"] = fade(lowpass(S["hammer"], 900.0), 0, 0.2)
# riser z Mixkit opada; odwrócony narasta dokładnie do wypłaty bębna
riser_full = load("2295-riser.wav", reverse=True)

mix = np.zeros((int((END + 1.0) * SR), 2), dtype=np.float32)
cues = []


def put(t, name, db, align=0.0, sample=None, note=""):
    x = sample if sample is not None else S[name]
    start = int(round((t - align) * SR))
    g = 10 ** (db / 20)
    a0 = max(0, start); b0 = min(len(mix), start + len(x))
    if b0 > a0:
        mix[a0:b0] += x[a0 - start: b0 - start] * g
    cues.append({"t": round(t, 3), "sfx": name, "db": db, "note": note})


def ticks(times, db, base_i=0, note=""):
    for j, tt in enumerate(times):
        r = 0.93 + 0.16 * hsh(base_i + j)
        smp = pitch(S["tick" if j % 2 == 0 else "tick2"], r)
        put(tt, "tick", db, 0.0, smp, note)


# ---------------------------------------------------------------- hook: rozkład
ticks([0.05 + i * 0.06 + 0.02 for i in range(10)], -17, 0, "10 śrub wyskakuje po kolei")
put(0.67, "metal", -19, 0.61, note="pokrywa zjeżdża do kamery")
put(1.30, "sweep", -25, 0.33, note="obudowa wirnika się odsuwa")

# ---------------------------------------------------------------- bęben "Na końcu:"
BURSTS = [(2.9, 3.9, 12), (16.8, 17.5, 12), (29.6, 30.4, 12), (42.2, 43.2, 12), (58.9, 59.6, 12), (73.7, 78.63, 23)]


def ease_out(x):
    x = min(1.0, max(0.0, x)); return 1 - (1 - x) ** 3


for bi, (a, b, n) in enumerate(BURSTS):
    ts = []
    for k in range(1, n + 1):
        # moment, w którym k-te słowo przejeżdża przez okienko: easeOut(u) = k/n
        u = 1 - (1 - k / n) ** (1 / 3)
        ts.append(a + u * (b - a))
    last = bi == len(BURSTS) - 1
    ticks(ts, -24 if not last else -22, 100 + bi * 40, "bęben: słowo przejeżdża przez okienko")

# ---------------------------------------------------------------- jak działa
put(9.82, "whoosh", -19, 0.72, note="cięcie na widok osiowy z najazdem")
put(10.40, "pop", -27, 0.01, note="trójkąt się podświetla")
sweep_slow = fade(pitch(S["sweep"], 0.72), 0.02, 0.15)
put(12.30, "sweep", -24, 0.09, sweep_slow, "rysuje się obrys ósemki")
for k, tt in enumerate([15.18, 15.32, 15.46]):
    put(tt + 0.02, "pop", -27, 0.01, note=f"numer komory {k + 1}")
ticks([23.721, 24.458, 25.30], -14, 300, "licznik wału +1")
put(25.30, "pop", -23, 0.01, note="trójkąt kończy obrót: licznik 1")
put(25.74, "whoosh", -19, 0.72, note="cięcie na planszę Wankla")
put(27.52, "thud", -20, 0.02, note="pieczątka SAMOUK")
put(27.94, "thud", -21, 0.02, note="pieczątka BEZ DYPLOMU")

# ---------------------------------------------------------------- wizja Wankla i NSU
put(36.19, "spin", -20, len(S["spin"]) / SR, note="cały silnik się rozpędza")
put(36.19, "lock", -6, 0.03, note="HIT 1: obudowa unieruchomiona")

# ---------------------------------------------------------------- dramat
put(42.12, "rumble", -25, 0.0, note="dron: dramat")
heat_keys = [(44.13, 0.0), (46.0, 0.6), (48.64, 1.0), (49.8, 1.0)]


def heat(t):
    for (a, va), (b, vb) in zip(heat_keys, heat_keys[1:]):
        if a <= t < b:
            return va + (vb - va) * (t - a) / (b - a)
    return 1.0 if t >= heat_keys[-1][0] else 0.0


t = 44.30
j = 0
while t < 49.75:
    h = heat(t)
    put(t, "scrape", -30 + 12 * h, 0.0, pitch(S["scrape"], 0.9 + 0.2 * hsh(500 + j)), "uszczelka trze o ścianę")
    t += 0.30 - 0.08 * h + 0.03 * hsh(600 + j)
    j += 1
put(49.89, "whoosh", -19, 0.72, note="cięcie na długą komorę")
put(50.51, "pop", -27, 0.01, note="napis DŁUGA")
put(50.92, "pop", -27, 0.01, note="napis I PŁASKA")

# ---------------------------------------------------------------- historia
put(58.82, "whoosh", -19, 0.72, note="plansza NSU Ro 80")
put(60.87, "thud", -19, 0.02, note="pieczątka SAMOCHÓD ROKU")
put(65.77, "whoosh", -21, 0.72, note="NSU przechodzi do Volkswagena")
put(67.50, "whoosh", -19, 0.72, note="cięcie na silnik: A Mazda?")
ticks([69.805, 69.815, 69.826, 69.836, 69.847, 69.859, 69.87, 69.883, 69.895, 69.909, 69.923, 69.937, 69.953, 69.969,
       69.987, 70.005, 70.025, 70.048, 70.072, 70.1, 70.132, 70.171, 70.223, 70.308], -27, 700, "licznik lat 1967 do 1991")
put(72.20, "impact", -20, 0.95, note="HIT 2: pieczątka JEDYNA BEZ TŁOKA")
put(73.01, "pop", -26, 0.01, note="karta: genialny czy głupi")

# ---------------------------------------------------------------- spłata obietnicy
seg = riser_full[-int(4.93 * SR):].copy()
seg = fade(seg / max(1e-6, np.abs(seg).max()), 0.6, 0.0)
put(78.63, "riser", -18, len(seg) / SR, seg, "jedyny riser: ostatnia seria bębna")
put(78.12, "pop", -27, 0.01, note="pudełko PRĄDNICA")
put(78.42, "pop", -27, 0.01, note="pudełko BATERIA")
put(78.63, "ding", -13, 0.05, note="bęben staje: PRĄDNICA")
put(79.76, "sweep", -25, 0.09, note="pasek obrotów się rozciąga")

# ---------------------------------------------------------------- składanie, pętla
put(84.60, "metal", -20, 0.61, note="obudowa i wirnik wracają")
put(85.50, "metal", -23, 0.61, note="pokrywa wraca")
ticks([84.9 + (9 - i) * 0.08 + 0.33 for i in range(10)], -22, 900, "10 śrub wkręca się po kolei")
put(86.90, "whoosh", -19, 0.72, note="plansza prawa jazdy")
put(87.22, "pop", -26, 0.01, note="naklejka następny silnik")
put(89.66, "hammer", -7, 0.02, note="HIT 3: pieczątka BRAK")
put(89.66, "thud", -12, 0.02, note="dół pod pieczątkę BRAK")

# ---------------------------------------------------------------- szew pętli: cisza na końcu
tail0 = int(90.2 * SR); tail1 = int(90.6 * SR)
mix[tail0:tail1] *= np.linspace(1, 0, tail1 - tail0)[:, None]
mix[tail1:] = 0
mix = mix[: int(END * SR)]

# ---------------------------------------------------------------- kontrola poziomu razem z lektorem
raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", "assets/vo.mp3", "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
vo = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)
n = min(len(vo), len(mix))
both = vo[:n] + mix[:n]
peak_both = 20 * math.log10(np.abs(both).max() + 1e-9)
peak_sfx = 20 * math.log10(np.abs(mix).max() + 1e-9)
if peak_both > -3.0:
    g = 10 ** ((-3.0 - peak_both) / 20)
    # przycinamy tylko efekty, lektor zostaje nietknięty
    mix *= min(1.0, g)
    print(f"UWAGA: efekty przyciszone globalnie o {20 * math.log10(min(1.0, g)):.1f} dB")
    both = vo[:n] + mix[:n]
    peak_both = 20 * math.log10(np.abs(both).max() + 1e-9)

pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-",
                "assets/sfx/sfx-mix.wav"], input=pcm.tobytes(), check=True)
json.dump(sorted(cues, key=lambda c: c["t"]), open("assets/sfx/cues.json", "w"), ensure_ascii=False, indent=1)
print(f"cues {len(cues)}  sfx peak {peak_sfx:.1f} dBFS  vo+sfx peak {peak_both:.1f} dBFS")
