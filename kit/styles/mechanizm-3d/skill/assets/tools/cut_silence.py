"""Wycina każdą ciszę z lektora: silencedetect -33 dB, min 0,10 s, 60 ms oddechu na każdym cięciu."""
import json, re, subprocess, sys

SRC, DST = sys.argv[1], sys.argv[2]
PAD = 0.06

dur = float(subprocess.check_output(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", SRC]).decode())
log = subprocess.run(
    ["ffmpeg", "-hide_banner", "-i", SRC, "-af", "silencedetect=noise=-33dB:d=0.10", "-f", "null", "-"],
    capture_output=True, text=True).stderr

sil, start = [], None
for line in log.splitlines():
    m = re.search(r"silence_start: ([\d.]+)", line)
    if m:
        start = float(m.group(1))
    m = re.search(r"silence_end: ([\d.]+)", line)
    if m and start is not None:
        sil.append((start, float(m.group(1))))
        start = None
if start is not None:
    sil.append((start, dur))

keep, cur = [], 0.0
for s, e in sil:
    a = s + PAD if s > 0.001 else 0.0
    b = e - PAD if e < dur - 0.001 else dur
    if b <= a:
        continue
    if a > cur:
        keep.append((cur, a))
    cur = b
if cur < dur:
    keep.append((cur, dur))
keep = [(max(0.0, a), b) for a, b in keep if b - a > 0.02]

parts = "".join(f"[0:a]atrim={a:.4f}:{b:.4f},asetpts=PTS-STARTPTS[a{i}];" for i, (a, b) in enumerate(keep))
fc = parts + "".join(f"[a{i}]" for i in range(len(keep))) + f"concat=n={len(keep)}:v=0:a=1[c];[c]volume=-1.5dB[out]"
WAV = DST.rsplit(".", 1)[0] + ".tmp.wav"
subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", SRC, "-filter_complex", fc,
                "-map", "[out]", WAV], check=True)
subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", WAV, "-b:a", "160k", DST], check=True)
import os; os.remove(WAV)

out = []
t = 0.0
for a, b in keep:
    out.append({"src": [round(a, 4), round(b, 4)], "dst": [round(t, 4), round(t + b - a, 4)]})
    t += b - a
json.dump({"segments": out, "raw": dur, "cut": t}, open(DST.rsplit("/", 1)[0] + "/silence-map.json", "w"), indent=1)
print(f"raw {dur:.2f}s -> {t:.2f}s, {len(keep)} segments")
