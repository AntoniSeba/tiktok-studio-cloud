"""Ścieżka efektów dźwiękowych z listy momentów (bez muzyki):
  python3 sfx_mix.py sfx.json project/assets/sfx.mp3 [--dur 90]
sfx.json = [{"t": 1.25, "s": "pop-1", "v": 0.6}, ...]  t = sekunda filmu, s = nazwa z $K/sfx (bez .wav), v = głośność 0-1 (domyślnie wg typu).
Dostępne dźwięki: ls $K/sfx (pop, click, tick, ding, swoosh-in/out, thud, wrong, scroll, toggle, paper)."""
import json, os, subprocess, sys
SFX = os.environ.get("SFX_DIR") or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sfx")
if not os.path.isdir(SFX): SFX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sfx")
DEF = {"pop": .55, "click": .45, "tick": .35, "ding": .5, "swoosh": .4, "thud": .5, "wrong": .45, "scroll": .3, "toggle": .4, "paper": .45}
cues, out = json.load(open(sys.argv[1])), sys.argv[2]
dur = float(sys.argv[sys.argv.index("--dur") + 1]) if "--dur" in sys.argv else max(c["t"] for c in cues) + 2
if len(cues) > 200: sys.exit("max 200 efektów")
ins, parts = [], []
for i, c in enumerate(sorted(cues, key=lambda c: c["t"])):
    f = os.path.join(SFX, c["s"] + ".wav")
    if not os.path.exists(f): sys.exit(f"brak dźwięku {c['s']} (ls {SFX})")
    v = c.get("v", DEF.get(c["s"].split("-")[0], .45))
    ins += ["-i", f]
    parts.append(f"[{i}:a]volume={v},adelay={int(c['t'] * 1000)}|{int(c['t'] * 1000)}[a{i}]")
mix = "".join(f"[a{i}]" for i in range(len(cues)))
flt = ";".join(parts) + f";{mix}amix=inputs={len(cues)}:normalize=0,apad,atrim=0:{dur}[o]"
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", *ins, "-filter_complex", flt, "-map", "[o]", "-ac", "2", "-b:a", "160k", out], check=True)
print(f"{out}: {len(cues)} efektów, {dur:.1f} s")
