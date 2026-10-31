"""Bramka stylu: czy film wygląda jak wybrany styl wizualny? Model wizyjny porównuje klatki filmu ze wzorcem stylu.
  python3 style_check.py WZOR.jpg project/snapshots "Nazwa stylu: krótki opis"
  python3 style_check.py WZOR.jpg film.mp4 "Nazwa stylu: krótki opis"      (klatki wycina sam)
Wynik: ocena 1-10, lista różnic i poprawek techniki. To informacja, nie próg: kod wyjścia zawsze 0.
Klucz: OPENROUTER_API_KEY ze środowiska."""
import base64, glob, json, os, subprocess, sys, tempfile, urllib.request

if len(sys.argv) < 3: sys.exit(__doc__)
wzor, src = sys.argv[1], sys.argv[2]
opis = sys.argv[3] if len(sys.argv) > 3 else ""
key = os.environ.get("OPENROUTER_API_KEY") or sys.exit("brak OPENROUTER_API_KEY")
tmp = tempfile.mkdtemp()
sheet = os.path.join(tmp, "film.jpg")

# klatki filmu w jednym arkuszu 4x2 (tak samo jak wzorzec)
if os.path.isdir(src):
    frames = sorted(glob.glob(os.path.join(src, "*.png")) + glob.glob(os.path.join(src, "*.jpg")))
    frames = [f for f in frames if "contact" not in os.path.basename(f)]
    if not frames: sys.exit(f"brak klatek w {src} (zrób snapshot)")
    step = max(1, len(frames) // 8)
    pick = frames[::step][:8]
    lst = os.path.join(tmp, "lista.txt")
    open(lst, "w").write("".join(f"file '{os.path.abspath(f)}'\nduration 1\n" for f in pick))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-vf", "scale=-2:420,tile=4x2", "-frames:v", "1", "-q:v", "4", sheet], check=True)
else:
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src], capture_output=True, text=True).stdout.strip() or 10)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-vf", f"fps=8/{dur},scale=-2:420,tile=4x2", "-frames:v", "1", "-q:v", "4", sheet], check=True)

b64 = lambda p: base64.b64encode(open(p, "rb").read()).decode()
prompt = (f"Obraz 1 to WZORZEC stylu wizualnego ({opis}). Obraz 2 to klatki z nowego filmu, który MA być w tym samym stylu (inny temat, ten sam wygląd).\n"
          "Oceń zgodność stylu, nie treści: technika (np. rysunek, 3D, kolaż, typografia), postacie i obiekty, tło i faktura, paleta, typografia, kompozycja i wypełnienie kadru, "
          "czy to scenki z akcją, czy statyczne plansze z tekstem. Bądź surowy: plansze z napisami na płaskim tle, gdy wzorzec ma scenki, to ocena najwyżej 4.\n"
          "Poprawki dotyczą wyłącznie techniki (paleta, faktura, typografia, ramki, sposób ruchu). NIGDY nie proponuj dokładania elementów, naklejek, kolorów, dodatkowych napisów ani efektów; przeładowany kadr to błąd, wtedy proponuj usuwanie.\n"
          'Odpowiedz wyłącznie JSON: {"ocena": 1-10, "co_zgodne": ["..."], "roznice": ["..."], "poprawki": ["konkretna zmiana w scenach, kodzie lub grafice"]} po polsku.')
body = {"model": os.environ.get("STYLE_CHECK_MODEL", "google/gemini-2.5-flash"), "max_tokens": 1500, "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": [{"type": "text", "text": prompt},
                                                  {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + b64(wzor)}},
                                                  {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + b64(sheet)}}]}]}
req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
                             headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
txt = json.load(urllib.request.urlopen(req, timeout=180))["choices"][0]["message"]["content"]
try:
    r = json.loads(txt.strip().strip("`").removeprefix("json").strip())
except Exception:
    print(txt); sys.exit(2)
ocena = int(r.get("ocena", 0))
print(f"OCENA STYLU: {ocena}/10 (informacja, nie próg)")
for k, t in (("co_zgodne", "Zgodne"), ("roznice", "Różnice"), ("poprawki", "Poprawki")):
    for x in r.get(k, []): print(f"- {t}: {x}")
print(f"Arkusz klatek filmu: {sheet}")
sys.exit(0)
