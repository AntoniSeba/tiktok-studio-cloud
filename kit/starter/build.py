# Składa project/index.html z Twoich plików. Uruchom z folderu filmu: python3 build.py
#   style.css  -> wstawiany do <head>       scene.html -> zawartość kompozycji (Twoje elementy)
#   film.js    -> logika animacji (czysta funkcja czasu, patrz README.md)
#   caps.json  -> (opcjonalnie) napisy słowo po słowie, dostępne jako window.CAPS
#   fonts.css  -> (opcjonalnie) @font-face systemu wizualnego; pliki z fonts/ kopiowane do project/assets/fonts
# Lektor project/assets/vo.mp3 i efekty project/assets/sfx.mp3 są dołączane automatycznie.
# Rozmiar kadru: domyślnie 1080x1920, dla filmu poziomego: W=1920 H=1080 python3 build.py
import json, os, subprocess

def dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True).stdout.strip()
    return float(out or 0)

D = float(os.environ.get("D") or (dur("project/assets/vo.mp3") if os.path.exists("project/assets/vo.mp3") else 10))
D = round(D + 0.4, 2)
W, H = int(os.environ.get("W") or 1080), int(os.environ.get("H") or 1920)
read = lambda f, d="": open(f, encoding="utf-8").read() if os.path.exists(f) else d

fonts_css = read("fonts.css").replace("url(fonts/", "url(assets/fonts/")
if fonts_css and os.path.isdir("fonts"):
    import shutil
    os.makedirs("project/assets/fonts", exist_ok=True)
    for f in os.listdir("fonts"):
        shutil.copy(os.path.join("fonts", f), os.path.join("project/assets/fonts", f))

audio = ""
if os.path.exists("project/assets/vo.mp3"):
    audio += f'    <audio id="vo" src="assets/vo.mp3" data-start="0" data-duration="{D}" data-track-index="30"></audio>\n'
if os.path.exists("project/assets/sfx.mp3"):
    audio += f'    <audio id="sfx" src="assets/sfx.mp3" data-start="0" data-duration="{D}" data-track-index="31"></audio>\n'
if os.path.exists("project/assets/music.mp3"):
    audio += f'    <audio id="music" src="assets/music.mp3" data-start="0" data-duration="{D}" data-track-index="32" data-volume="0.25"></audio>\n'

html = f'''<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <style>
    html, body {{ margin: 0; width: {W}px; height: {H}px; overflow: hidden; background: #000; }}
    #root {{ position: relative; width: {W}px; height: {H}px; overflow: hidden; }}
{fonts_css}
{read("style.css")}
  </style>
</head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="{D}" data-width="{W}" data-height="{H}">
{read("scene.html")}
{audio}  </div>
  <script>
    window.FILM = {{ D: {D}, W: {W}, H: {H} }};
    window.CAPS = {read("caps.json", "[]")};
    window.__timelines = window.__timelines || {{}};
    window.__timelines["main"] = gsap.timeline({{ paused: true }});
  </script>
  <script src="film.js"></script>
</body>
</html>
'''
os.makedirs("project", exist_ok=True)
open("project/index.html", "w", encoding="utf-8").write(html)
open("project/film.js", "w", encoding="utf-8").write(read("film.js", "// brak film.js\n"))
print(f"D = {D}, {W}x{H}")
