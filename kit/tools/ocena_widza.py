"""Ocena widza: model wizyjny ogląda pierwsze 5 sekund jak widz na TikToku i mówi, czy zostaje, czy przewija.
Uruchamia ją Studio po etapie reżysera hooka i po animacji; agent nie unieważnia jej sam.

  python3 ocena_widza.py film.mp4 [wynik.json]          # 20 klatek z 0-5 s co 0,25 s
  python3 ocena_widza.py hook/storyboard.png [wynik.json]   # storyboard: klatka 0 i klatki kluczowe

Wynik: JSON {"werdykt": "OK" albo "POPRAW", "wrazenie": "...", "problemy": [...], "co_usunac": [...], "co_zmienic": [...]}.
To nie jest próg do przejścia, tylko opinia widza. Klucz: OPENROUTER_API_KEY ze środowiska."""
import base64, json, os, subprocess, sys, tempfile, urllib.request

if len(sys.argv) < 2: sys.exit(__doc__)
src, out = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else None)
key = os.environ.get("OPENROUTER_API_KEY") or sys.exit("brak OPENROUTER_API_KEY")

if src.lower().endswith(".mp4"):
    sheet = os.path.join(tempfile.mkdtemp(), "widz.jpg")
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", "-t", "5", "-i", src, "-vf", "fps=4,scale=216:-2,tile=5x4", "-frames:v", "1", "-q:v", "3", sheet], check=True)
    what = ("To 20 kolejnych klatek z pierwszych 5 sekund filmu, co 0,25 s, czytaj wierszami od lewej (pierwsza klatka to 0,0 s). "
            "Sąsiednie klatki dzieli tylko ćwierć sekundy, więc nagła zmiana koloru albo światła w tej samej scenie to w filmie mignięcie; cięcie do nowej sceny, która posuwa historię, jest w porządku.")
else:
    sheet = src
    what = "To storyboard pierwszych 5 sekund filmu: od lewej klatka 0,0 s i kolejne chwile tego samego ujęcia (ok. 1,5 s, 3 s, 4,5 s)."

prompt = (f"{what}\nJesteś zwykłym widzem TikToka (student), przewijasz feed kciukiem. Oceń szczerze, jak widz, nie jak projektant:\n"
          "1. Czy w pierwszej sekundzie od razu wiesz, o czym i o kim to jest, bez myślenia?\n"
          "2. Czy to płynie: każda chwila albo nowa scena (cięcie jest w porządku) przynosi coś nowego w historii, czy coś skacze, miga, zmienia kolory albo światło bez powodu?\n"
          "3. Czy kadr jest czysty (jedna rzecz, na którą patrzysz), czy przeładowany naklejkami, napisami i dodatkami?\n"
          "4. Czy zmiana w tych 5 sekundach wynika z historii (bohater coś robi, zmienia minę, coś się wydarza), czy z ozdobników (przełączanie świateł, kolorowe nakładki, fruwające elementy)?\n"
          "5. Zostajesz czy przewijasz?\n"
          "Zasada: nigdy nie proponuj dokładania elementów, naklejek, kolorów ani efektów. Jeśli coś przeszkadza, mów, co usunąć albo uprościć. Jeśli brakuje zmiany w historii, powiedz, jaka zmiana bohatera by ją dała.\n"
          'Odpowiedz wyłącznie JSON po polsku: {"werdykt": "OK" (zostaję, płynie, czysto) albo "POPRAW", "wrazenie": "jedno zdanie jak widz", '
          '"problemy": ["najwyżej 4, krótko, z numerem klatki lub chwilą"], "co_usunac": ["najwyżej 3"], "co_zmienic": ["najwyżej 3"]}')
b64 = base64.b64encode(open(sheet, "rb").read()).decode()
mime = "image/png" if sheet.lower().endswith(".png") else "image/jpeg"
body = {"model": os.environ.get("WIDZ_MODEL", "anthropic/claude-sonnet-5.5"), "max_tokens": 3000, "usage": {"include": True},
        "messages": [{"role": "user", "content": [{"type": "text", "text": prompt},
                                                  {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}]}]}
req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
                             headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
txt = json.load(urllib.request.urlopen(req, timeout=180))["choices"][0]["message"]["content"]
s = txt[txt.find("{"):txt.rfind("}") + 1]
try:
    r = json.loads(s)
except Exception:
    # a cut-off answer still says what the viewer decided
    r = {"werdykt": "POPRAW" if "POPRAW" in txt.upper() else "OK", "wrazenie": txt[:600], "problemy": [], "co_usunac": [], "co_zmienic": []}
r["werdykt"] = "POPRAW" if str(r.get("werdykt", "")).upper().startswith("POPRAW") else "OK"
if out:
    with open(out, "w", encoding="utf-8") as f: json.dump(r, f, ensure_ascii=False, indent=1)
print(json.dumps(r, ensure_ascii=False))
