"""Gemini TTS przez OpenRouter: każdy akapit osobno, PCM 24 kHz, sklejone z krótką przerwą.
  python3 tts.py tts.txt raw.wav GŁOS ["instrukcja stylu lektora"]
Instrukcja stylu idzie osobnym polem (nie jest czytana na głos), np. "pewny siebie prowadzący TikToka, szybko, z uśmiechem".
W tts.txt wolno używać znaczników Gemini w nawiasach kwadratowych, np. [short pause], [excited]; nie są czytane."""
import json, os, re, sys, time, urllib.request, urllib.error, wave
from concurrent.futures import ThreadPoolExecutor

URL = "https://openrouter.ai/api/v1/audio/speech"
MODEL = "google/gemini-3.8-flash-tts"
RATE = 24000
MODEL = os.environ.get("GEMINI_TTS_MODEL", MODEL)
KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()
if not KEY: sys.exit("TTS niedostępny: brak OPENROUTER_API_KEY w środowisku")

def speak(text, voice, tries=3):
    req_body = {"model": MODEL, "input": text, "voice": voice, "response_format": "pcm"}
    if STYLE: req_body["instructions"] = STYLE
    body = json.dumps(req_body).encode()
    last = None
    for i in range(tries):
        req = urllib.request.Request(URL, data=body, headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = r.read()
            if len(data) > RATE:
                return data
            last = f"za krótka odpowiedź ({len(data)} B)"
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}: {e.read()[:300]!r}"
        except Exception as e:
            last = repr(e)
        time.sleep(3 * (i + 1))
    raise RuntimeError(last)

src, out, voice = sys.argv[1], sys.argv[2], sys.argv[3]
STYLE = (sys.argv[4] if len(sys.argv) > 4 else os.environ.get("TTS_STYLE", "")).strip()[:500]
paras = [p.strip() for p in re.split(r"\n\s*\n", open(src, encoding="utf-8").read()) if p.strip()]
with ThreadPoolExecutor(5) as ex:
    pcms = list(ex.map(lambda p: speak(p, voice), paras))
gap = b"\x00\x00" * int(RATE * 0.25)
with wave.open(out, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
    w.writeframes(gap.join(pcms))
print(out, sum(len(p) for p in pcms) / 2 / RATE, "s")
