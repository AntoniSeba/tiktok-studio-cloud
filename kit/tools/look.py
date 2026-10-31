"""Pokaż obraz modelowi wizyjnemu i dostań odpowiedź tekstem (dla agentów, które same nie widzą obrazów).
  python3 look.py OBRAZ.jpg "Czy tekst wchodzi w czerwone strefy? Które klatki?"
Klucz: OPENROUTER_API_KEY ze środowiska."""
import base64, json, os, sys, urllib.request
img, q = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "Opisz krótko, co widać, i wskaż problemy."
key = os.environ.get("OPENROUTER_API_KEY") or sys.exit("brak OPENROUTER_API_KEY")
mime = "image/png" if img.lower().endswith(".png") else "image/jpeg"
b64 = base64.b64encode(open(img, "rb").read()).decode()
body = {"model": os.environ.get("LOOK_MODEL", "anthropic/claude-haiku-5.5"), "max_tokens": 800, "usage": {"include": True},
        "messages": [{"role": "user", "content": [{"type": "text", "text": q + " Odpowiedz po polsku, konkretnie, max 8 zdań."},
                                                   {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}]}]}
req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
                             headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
print(json.load(urllib.request.urlopen(req, timeout=120))["choices"][0]["message"]["content"])
