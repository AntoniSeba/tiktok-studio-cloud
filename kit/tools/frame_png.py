"""Statyczny HTML -> PNG jednej klatki (projekt pierwszej klatki filmu), przez Chrome bez okna.

  python3 frame_png.py hook/frame.html hook/hook.png [--size 1080x1920]

Chrome czeka, aż załadują się obrazy i fonty (wirtualny czas 4 s), potem robi zrzut dokładnie w podanym rozmiarze.
"""
import argparse, os, shutil, subprocess, sys, tempfile

CANDIDATES = [os.environ.get("CHROME_BIN"), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              shutil.which("google-chrome"), shutil.which("chromium"), shutil.which("chromium-browser")]

p = argparse.ArgumentParser()
p.add_argument("html"); p.add_argument("png"); p.add_argument("--size", default="1080x1920")
o = p.parse_args()
chrome = next((c for c in CANDIDATES if c and os.path.exists(c)), None) or sys.exit("brak Chrome (ustaw CHROME_BIN)")
w, h = o.size.lower().split("x")
os.makedirs(os.path.dirname(os.path.abspath(o.png)) or ".", exist_ok=True)
with tempfile.TemporaryDirectory() as prof:
    r = subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                        f"--user-data-dir={prof}", f"--window-size={w},{h}", "--virtual-time-budget=4000",
                        "--allow-file-access-from-files", f"--screenshot={os.path.abspath(o.png)}",
                        "file://" + os.path.abspath(o.html)], capture_output=True, text=True, timeout=120)
if not os.path.exists(o.png): sys.exit("zrzut nie powstał: " + r.stderr[-400:])
try:
    from PIL import Image
    im = Image.open(o.png); print(f"{o.png}: {im.width}x{im.height}")
    if (im.width, im.height) != (int(w), int(h)): print("UWAGA: rozmiar inny niż zamówiony", file=sys.stderr)
except ImportError:
    print(o.png)
