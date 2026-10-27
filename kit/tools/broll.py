"""B-roll z internetu: wideo i zdjęcia z Pexels (darmowa licencja), zdjęcia awaryjnie z Openverse (CC).
  python3 broll.py "blue sky clouds" project/assets/broll --kind video --n 3
  python3 broll.py "sunset over sea" project/assets/broll --kind photo --n 4 --orient landscape
Zapytania pisz po angielsku, konkretnie (obiekt + ujęcie: "close up raindrops on window").
Wideo jest od razu docinane (--sec, domyślnie 8 s), skalowane do kadru filmu (W x H z env, domyślnie 1080x1920),
bez dźwięku i z gęstymi klatkami kluczowymi (płynne przewijanie w renderze).
Wynik: pliki broll-<slug>-N.mp4/.jpg i dopisany wpis w OUT/credits.json (autor, źródło).
Klucz: PEXELS_API_KEY ze środowiska (bez niego tylko zdjęcia z Openverse)."""
import argparse, json, os, re, subprocess, sys, urllib.parse, urllib.request

ap = argparse.ArgumentParser()
ap.add_argument("query"); ap.add_argument("out")
ap.add_argument("--kind", choices=["video", "photo"], default="video")
ap.add_argument("--n", type=int, default=3)
ap.add_argument("--orient", choices=["portrait", "landscape", "square"], default=None)
ap.add_argument("--sec", type=float, default=8.0)
a = ap.parse_args()

W, H = int(os.environ.get("W") or 1080), int(os.environ.get("H") or 1920)
orient = a.orient or ("portrait" if H > W else "landscape")
key = os.environ.get("PEXELS_API_KEY", "")
os.makedirs(a.out, exist_ok=True)
slug = re.sub(r"[^a-z0-9]+", "-", a.query.lower()).strip("-")[:32] or "broll"
UA = {"User-Agent": "tiktok-studio-broll/1.0"}

def get(url, headers=None):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    return json.load(urllib.request.urlopen(req, timeout=40))

def download(url, path):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
        while chunk := r.read(1 << 16):
            f.write(chunk)

def ff(*args):
    p = subprocess.run(["ffmpeg", "-y", "-v", "error", *args], capture_output=True, text=True)
    if p.returncode: raise RuntimeError(p.stderr.strip()[-300:])

cover = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}"
credits_path = os.path.join(a.out, "credits.json")
credits = json.load(open(credits_path)) if os.path.exists(credits_path) else []
saved = []

if a.kind == "video":
    if not key: sys.exit("Brak PEXELS_API_KEY: wideo niedostępne. Użyj --kind photo (Openverse) albo grafiki.")
    q = urllib.parse.urlencode({"query": a.query, "orientation": orient, "per_page": max(a.n * 3, 8), "size": "medium"})
    res = get("https://api.pexels.com/videos/search?" + q, {"Authorization": key}).get("videos", [])
    for v in res:
        if len(saved) >= a.n: break
        if v.get("duration", 0) < 3: continue
        files = [f for f in v.get("video_files", []) if f.get("file_type") == "video/mp4" and f.get("width") and f.get("height")]
        if not files: continue
        target = min(W, H)
        # najmniejszy plik, którego krótszy bok jest co najmniej taki jak kadr; inaczej największy
        good = sorted([f for f in files if min(f["width"], f["height"]) >= target], key=lambda f: f["width"] * f["height"])
        pick = good[0] if good else max(files, key=lambda f: f["width"] * f["height"])
        raw = os.path.join(a.out, f".raw-{v['id']}.mp4")
        dst = os.path.join(a.out, f"broll-{slug}-{len(saved) + 1}.mp4")
        try:
            download(pick["link"], raw)
            ff("-i", raw, "-t", str(min(a.sec, v["duration"])), "-an", "-vf", cover + ",fps=30",
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-g", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", dst)
        except Exception as e:
            print(f"pominięto {v['id']}: {e}", file=sys.stderr); continue
        finally:
            if os.path.exists(raw): os.remove(raw)
        dur = min(a.sec, v["duration"])
        saved.append(dst)
        credits.append({"file": os.path.basename(dst), "kind": "video", "source": "Pexels", "url": v.get("url"),
                        "author": (v.get("user") or {}).get("name"), "duration": dur, "query": a.query})
else:
    items = []
    if key:
        q = urllib.parse.urlencode({"query": a.query, "orientation": orient, "per_page": max(a.n * 2, 6)})
        for p in get("https://api.pexels.com/v1/search?" + q, {"Authorization": key}).get("photos", []):
            items.append({"src": p["src"].get("large2x") or p["src"]["original"], "url": p.get("url"),
                          "author": p.get("photographer"), "source": "Pexels"})
    if len(items) < a.n:
        q = urllib.parse.urlencode({"q": a.query, "page_size": 12, "license_type": "commercial", "mature": "false"})
        try:
            for p in get("https://api.openverse.org/v1/images/?" + q).get("results", []):
                items.append({"src": p["url"], "url": p.get("foreign_landing_url"), "author": p.get("creator"),
                              "source": f"Openverse ({p.get('license', '').upper()} {p.get('license_version', '')})".strip()})
        except Exception as e:
            print(f"Openverse niedostępny: {e}", file=sys.stderr)
    for it in items:
        if len(saved) >= a.n: break
        raw = os.path.join(a.out, ".raw-photo")
        dst = os.path.join(a.out, f"broll-{slug}-{len(saved) + 1}.jpg")
        try:
            download(it["src"], raw)
            # zdjęcie zostaje większe niż kadr (zapas na powolny zoom), ale nie gigantyczne
            ff("-i", raw, "-vf", f"scale='if(gt(iw,ih),-2,{int(max(W, H) * 0.75)})':'if(gt(iw,ih),{int(max(W, H) * 0.75)},-2)'", "-q:v", "3", dst)
        except Exception as e:
            print(f"pominięto zdjęcie: {e}", file=sys.stderr); continue
        finally:
            if os.path.exists(raw): os.remove(raw)
        saved.append(dst)
        credits.append({"file": os.path.basename(dst), "kind": "photo", "source": it["source"], "url": it["url"],
                        "author": it["author"], "query": a.query})

json.dump(credits, open(credits_path, "w"), ensure_ascii=False, indent=1)
if not saved: sys.exit(f"Nic nie znaleziono dla \"{a.query}\". Spróbuj prostszego zapytania po angielsku.")
for s in saved:
    print(s)
