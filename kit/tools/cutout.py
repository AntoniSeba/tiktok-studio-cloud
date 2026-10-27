"""Wycinanki do filmów: obiekt bez tła (PNG z przezroczystością) z opisu albo z gotowego obrazka.

  python3 cutout.py --sheet "mózg; dyskietka; kosz na śmieci; ..." assets/cuts [--style sticker]   # DO 9 obiektów za JEDNO zapytanie
  python3 cutout.py "różowy mózg trzymający dyskietkę" assets/cut-mozg.png [--style sticker|photo|paper|clay] [--key green|magenta]
  python3 cutout.py --from-image zdjecie.png assets/cut-x.png        # tylko wycięcie tła z gotowego obrazka (darmowe)
  python3 cutout.py --budget assets                                  # ile ten film już wydał

Generuje przez OpenRouter (najtańszy działający model z listy MODELS) obiekty na płaskim zielonym tle, wycina tło
floodfillem od krawędzi (miękka krawędź + usunięcie zielonej poświaty), przycina do obiektu. Tryb --sheet rysuje
siatkę 3x3 w jednym obrazku i tnie ją na osobne PNG, więc 9 wycinanek kosztuje tyle co jedna.
BUDŻET: twardy limit CUTOUT_FILM_BUDGET (domyślnie 0,05 USD) na film. Film = folder nad "assets/" w ścieżce wyjścia.
Narzędzie odmawia zapytania, które mogłoby przekroczyć limit. Biblioteka i --from-image są darmowe.
Każda wycinanka trafia do wspólnej biblioteki: ten sam opis + styl drugi raz nie kosztuje nic.
Klucz: OPENROUTER_API_KEY ze środowiska (nigdy nie jest wypisywany).
"""
import argparse, base64, hashlib, json, os, shutil, sys, time, urllib.error, urllib.request
import numpy as np
from PIL import Image, ImageDraw

HOME = os.path.expanduser("~")
LIB = os.environ.get("CUTOUT_LIBRARY") or os.path.join(os.getcwd(), "wycinanki")
MODELS = [m for m in [os.environ.get("CUTOUT_MODEL"), "openai/gpt-5-image-mini", "google/gemini-3.1-flash-lite-image"] if m]
BUDGET = float(os.environ.get("CUTOUT_FILM_BUDGET", "0.05"))
# worst-case cost of one call before we have seen a real one (1024px image + prompt); replaced by the max observed cost
EST = {"openai/gpt-5-image-mini": 0.02, "google/gemini-3.1-flash-lite-image": 0.042}
KEYS = {"green": (0, 255, 0), "magenta": (255, 0, 255)}
STYLES = {
    "sticker": "Die-cut sticker of {s}. Bold clean flat vector illustration, vivid saturated colors, simple readable shapes, thick white outline around the whole object",
    "photo": "Photorealistic cutout photo of {s}, crisp studio lighting, sharp focus, the whole object visible",
    "paper": "Paper-cut collage element of {s}, layered colored paper with slightly torn edges and visible paper texture, thick white paper border around the object",
    "clay": "Cute 3D clay render of {s}, soft studio light, rounded shapes, the whole object visible",
}

def api_key():
    if os.environ.get("OPENROUTER_API_KEY"): return os.environ["OPENROUTER_API_KEY"].strip()
    sys.exit("brak OPENROUTER_API_KEY")

def bg_words(key):
    kc = "#00FF00 green" if key == "green" else "#FF00FF magenta"
    avoid = "Do not use green anywhere in the objects." if key == "green" else "Do not use magenta or pink anywhere in the objects."
    return (f"perfectly flat, uniform, pure {kc} background (exactly that one color, no gradient, no texture, no floor, no shadow). "
            f"No text, no letters, no frame. {avoid}")

def single_prompt(subject, style, key):
    return STYLES[style].format(s=subject) + ". Centered, the object fills about 80% of the square frame, isolated on a " + bg_words(key)

def sheet_prompt(subjects, style, key):
    n = len(subjects)
    style_line = STYLES[style].format(s="each object").replace("Die-cut sticker of each object", "Die-cut stickers")
    items = "; ".join(f"cell {i + 1}: {s}" for i, s in enumerate(subjects))
    return (f"A 3x3 grid sheet of {n} separate objects, filled row by row from the top-left; leave unused cells empty. {items}. "
            f"Style for all: {style_line}, one consistent style. Each object sits fully inside its own cell, centered, about 65% of the cell, "
            f"with wide empty background between objects; objects never touch or overlap each other or the image edge. Square image, on a " + bg_words(key))

# ---- budget: one ledger for all films, keyed by the film folder ----
def film_of(out):
    p = os.path.abspath(out)
    parts = p.split(os.sep)
    return os.sep.join(parts[:parts.index("assets")]) if "assets" in parts else (os.path.dirname(p) if os.path.splitext(p)[1] else p)

def ledger():
    f = os.path.join(LIB, "spend.json")
    return f, (json.load(open(f)) if os.path.exists(f) else {"films": {}, "max_cost": {}})

def spent(film):
    return round(sum(c["cost"] for c in ledger()[1]["films"].get(film, [])), 4)

def est_cost(model):
    return max(ledger()[1]["max_cost"].get(model, 0), EST.get(model, 0.05))

def record(film, model, cost, what):
    f, L = ledger()
    L["films"].setdefault(film, []).append({"model": model, "cost": cost, "what": what[:120], "at": time.strftime("%Y-%m-%d %H:%M")})
    L["max_cost"][model] = max(L["max_cost"].get(model, 0), cost)
    json.dump(L, open(f, "w"), ensure_ascii=False, indent=1)

def generate(prompt, film):
    last = ""
    for model in MODELS:
        left = BUDGET - spent(film)
        if est_cost(model) > left + 1e-9:
            last = f"{model}: budżet filmu wyczerpany (wydano {spent(film):.3f} z {BUDGET:.2f} USD, zapytanie ok. {est_cost(model):.3f} USD)"
            continue
        body = {"model": model, "messages": [{"role": "user", "content": prompt}], "modalities": ["image", "text"], "usage": {"include": True}}
        req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
                                     headers={"Authorization": "Bearer " + api_key(), "Content-Type": "application/json"})
        try:
            r = json.load(urllib.request.urlopen(req, timeout=240))
            imgs = r["choices"][0]["message"].get("images") or []
            if imgs:
                data = base64.b64decode(imgs[0]["image_url"]["url"].split(",", 1)[1])
                cost = (r.get("usage") or {}).get("cost")
                cost = float(cost) if cost is not None else est_cost(model)
                record(film, model, cost, prompt)
                return data, model, cost
            last = f"{model}: brak obrazu w odpowiedzi"
        except urllib.error.HTTPError as e:
            last = f"{model}: HTTP {e.code} {e.read()[:200]!r}"
            if e.code == 402: break   # no credit: other models will fail the same way
        except Exception as e:
            last = f"{model}: {e}"
    sys.exit("generowanie nieudane: " + last + "\nUżyj wycinanek z biblioteki (index.json) albo --from-image.")

def cut(img, key=None, trim=True):
    """Background colour = median of the border; flood fill from the border with a colour tolerance, soft edge, despill, trim."""
    im = img.convert("RGB")
    a = np.asarray(im).astype(np.int16)
    h, w, _ = a.shape
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    # background = the real border colour: models rarely paint the exact key (#00FF00), but the border is background
    bg = np.median(border, axis=0)
    if key is not None and np.sqrt(((bg - np.array(KEYS[key])) ** 2).sum()) > 200 and np.abs(border - bg).mean() > 60:
        bg = np.array(KEYS[key])   # border is not a flat colour at all: fall back to the requested key
    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
    # flood fill on a "near background" map so only background connected to the edges disappears
    near = Image.fromarray(((dist < 110) * 255).astype(np.uint8)).copy()   # copy: fromarray can share read-only memory
    seeds = [(x, 0) for x in range(0, w, 16)] + [(x, h - 1) for x in range(0, w, 16)] + [(0, y) for y in range(0, h, 16)] + [(w - 1, y) for y in range(0, h, 16)]
    for s in seeds:
        if near.getpixel(s) == 255: ImageDraw.floodfill(near, s, 128)
    bgmask = np.asarray(near) == 128
    alpha = np.where(bgmask, 0, 255).astype(np.float32)
    # soft edge: pixels next to the cut get partial alpha from their colour distance
    grow = lambda m: m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
    edge = (~bgmask) & grow(bgmask)            # first ring: partial alpha from the colour distance
    band = (~bgmask) & grow(grow(bgmask))      # two rings: despilled
    alpha[edge] = np.clip((dist[edge] - 40) / 120 * 255, 0, 255)
    out = a.astype(np.float32)
    # despill: background colour bleeding into the edge
    if bg[1] > bg[0] + 30 and bg[1] > bg[2] + 30:
        g = np.minimum(out[..., 1], np.maximum(out[..., 0], out[..., 2]) + 10); out[..., 1] = np.where(band | (alpha < 255), g, out[..., 1])
    elif bg[0] > 200 and bg[2] > 200 and bg[1] < 80:
        m = np.maximum(out[..., 1], 0); sel = band | (alpha < 255); out[..., 0] = np.where(sel, np.minimum(out[..., 0], m + 60), out[..., 0]); out[..., 2] = np.where(sel, np.minimum(out[..., 2], m + 60), out[..., 2])
    rgba = np.dstack([np.clip(out, 0, 255), alpha]).astype(np.uint8)
    res = Image.fromarray(rgba, "RGBA")
    if not trim: return res, float((alpha > 10).mean())
    bbox = Image.fromarray((alpha > 10).astype(np.uint8) * 255).getbbox()
    if not bbox: sys.exit("po wycięciu nic nie zostało (tło za podobne do obiektu?)")
    pad = 8
    res = res.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(w, bbox[2] + pad), min(h, bbox[3] + pad)))
    res.thumbnail((900, 900))
    kept = float((alpha > 10).mean())
    return res, kept

def label(mask):
    """Connected components of a small boolean mask (4-neighbour BFS, no scipy needed)."""
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32); n = 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]: continue
        n += 1; lab[y0, x0] = n; st = [(y0, x0)]
        while st:
            y, x = st.pop()
            for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; st.append((yy, xx))
    return lab, n

def _crop(rgba, keep):
    W, H = rgba.size
    a = np.asarray(rgba).copy(); a[..., 3] = np.where(keep, a[..., 3], 0)
    bb = Image.fromarray(((a[..., 3] > 10) * 255).astype(np.uint8)).getbbox()
    if not bb: return None
    pad = 8
    im = Image.fromarray(a, "RGBA").crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(W, bb[2] + pad), min(H, bb[3] + pad)))
    im.thumbnail((900, 900)); return im

def _bands(profile, min_len):
    """Runs of 'busy' rows/columns separated by near-empty gutters (fg share < 2%)."""
    busy = np.convolve(profile, np.ones(5) / 5, mode="same") > 0.02
    runs, start = [], None
    for i, b in enumerate(list(busy) + [False]):
        if b and start is None: start = i
        if not b and start is not None:
            if i - start >= min_len: runs.append((start, i))
            start = None
    return runs

def _reading_order(items):
    """items: (cy, cx, payload). Rows = clusters of centre y (gap > 1/8 of the span), left to right inside a row."""
    items = sorted(items)
    rows, last = [], None
    span = (items[-1][0] - items[0][0]) or 1
    for it in items:
        if last is None or it[0] - last > max(40, span / 8): rows.append([])
        rows[-1].append(it); last = it[0]
    return [p for r in rows for (_, _, p) in sorted(r, key=lambda t: t[1])]

def split_sheet(rgba, n):
    """Cut a sheet of up to 9 objects into PNGs, in reading order (left to right, top to bottom).
    1) grid: components assigned to the 3x3 cell of their centre (the layout we asked for);
    2) if that leaves cells empty but there are enough separate components: components in reading order;
    3) if objects are glued together (shadow, uneven background): cut along empty gutters between rows/columns."""
    W, H = rgba.size
    alpha = np.asarray(rgba)[..., 3]
    s = 4
    small = alpha[: H // s * s, : W // s * s].reshape(H // s, s, W // s, s).max(axis=(1, 3)) > 10
    grown = small | np.roll(small, 1, 0) | np.roll(small, -1, 0) | np.roll(small, 1, 1) | np.roll(small, -1, 1)
    lab, k = label(grown)
    big = np.kron(lab, np.ones((s, s), np.int32))
    big = np.pad(big, ((0, H - big.shape[0]), (0, W - big.shape[1])))
    comps = []
    for c in range(1, k + 1):
        ys, xs = np.nonzero(lab == c)
        if len(ys) * s * s >= W * H * 0.0015: comps.append((c, ys.mean() * s, xs.mean() * s, len(ys), (np.ptp(ys) + 1) * s, (np.ptp(xs) + 1) * s))
    cell_of = {c[0]: int(min(2, c[1] * 3 // H)) * 3 + int(min(2, c[2] * 3 // W)) for c in comps}
    grid = [[c for c, cell in cell_of.items() if cell == i] for i in range(n)]
    # the 3x3 layout is trustworthy when no shape spills over several cells and pieces sharing a cell are close
    # (one object in parts), not two separate objects; then empty cells are real gaps (None)
    pos = {c[0]: (c[1], c[2]) for c in comps}
    spill = any(h > 0.5 * H or w > 0.5 * W for *_, h, w in comps)
    crowded = any(max(np.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]) for a in g for b in g) > 0.18 * W for g in grid if len(g) > 1)
    if comps and not spill and not crowded:
        return [_crop(rgba, np.isin(big, g)) if g else None for g in grid]
    if len(comps) >= n:   # enough separate objects: biggest n, in reading order
        top = sorted(comps, key=lambda c: -c[3])[:n]
        order = _reading_order([(c[1], c[2], c[0]) for c in top])
        return [_crop(rgba, big == c) for c in order]
    # glued together (shadow, uneven background): erode until thin bridges break, then grow each piece back
    fg_s = small
    sh = lambda m, op: op(op(op(op(m, np.roll(m, 1, 0)), np.roll(m, -1, 0)), np.roll(m, 1, 1)), np.roll(m, -1, 1))
    for r in range(2, 16):
        er = fg_s.copy()
        for _ in range(r): er = sh(er, np.logical_and)
        lab2, k2 = label(er)
        pieces = [(c, *np.argwhere(lab2 == c).mean(axis=0), (lab2 == c).sum()) for c in range(1, k2 + 1)]
        pieces = [p for p in pieces if p[3] >= max(4, 0.15 * max(q[3] for q in pieces))]
        if len(pieces) >= n:
            out = []
            for c, cy, cx, _ in sorted(pieces, key=lambda p: -p[3])[:n]:
                m = lab2 == c
                for _ in range(r + 1): m = sh(m, np.logical_or)
                m &= fg_s
                mb = np.kron(m, np.ones((s, s), bool)); mb = np.pad(mb, ((0, H - mb.shape[0]), (0, W - mb.shape[1])))
                out.append((cy * s, cx * s, mb))
            return [_crop(rgba, mb) for mb in _reading_order(out)]
    # last resort: empty gutters between rows/columns
    fg = alpha > 10
    cells = []
    for y0, y1 in _bands(fg.mean(axis=1), H // 20):
        for x0, x1 in _bands(fg[y0:y1].mean(axis=0), W // 20):
            keep = np.zeros_like(fg); keep[y0:y1, x0:x1] = True
            cells.append(((y0 + y1) / 2, (x0 + x1) / 2, keep))
    order = _reading_order(cells) if cells else []
    out = [_crop(rgba, keep) for keep in order[:n]]
    return out + [None] * (n - len(out))

def slug(t):
    t = t.lower().translate(str.maketrans("ąćęłńóśźż", "acelnoszz"))
    return "-".join("".join(ch if ch.isalnum() else " " for ch in t).split())[:40] or "obiekt"

def lib_key(style, key, subject):
    return hashlib.sha1(f"{style}|{key}|{' '.join(subject.lower().split())}".encode()).hexdigest()[:16]

def load_idx():
    f = os.path.join(LIB, "index.json")
    return f, (json.load(open(f)) if os.path.exists(f) else {})

def sheet(o):
    subjects = [x.strip() for x in o.sheet.split(";") if x.strip()]
    if not 1 <= len(subjects) <= 9: sys.exit("--sheet: podaj od 1 do 9 obiektów rozdzielonych średnikiem")
    os.makedirs(o.out, exist_ok=True); os.makedirs(LIB, exist_ok=True)
    film = film_of(os.path.join(o.out, "x.png"))
    idx_f, idx = load_idx()
    res, todo = [], []
    for sub in subjects:   # library first: anything already drawn costs nothing
        h = lib_key(o.style, o.key, sub); dst = os.path.join(o.out, f"cut-{slug(sub)}.png")
        if h in idx and os.path.exists(idx[h]["file"]) and not o.no_cache:
            shutil.copy(idx[h]["file"], dst); res.append({"subject": sub, "file": dst, "source": "biblioteka"})
        else: todo.append(sub)
    cost = 0; model = None
    if todo:
        t = time.time()
        data, model, cost = generate(sheet_prompt(todo, o.style, o.key), film)
        raw = os.path.join(o.out, f"_sheet-{int(t)}.png"); open(raw, "wb").write(data)
        full, _ = cut(Image.open(raw), o.key, trim=False)
        parts = split_sheet(full, len(todo))
        shutil.move(raw, os.path.join(LIB, f"sheet-{int(t)}.png"))   # raw sheet stays in the library (debug, re-cut for free)
        for sub, im in zip(todo, parts):
            dst = os.path.join(o.out, f"cut-{slug(sub)}.png")
            if im is None: res.append({"subject": sub, "file": None, "source": "BRAK (model nie narysował, dodaj do następnego arkusza)"}); continue
            h = lib_key(o.style, o.key, sub); lib_png = os.path.join(LIB, f"{h}.png"); im.save(lib_png); shutil.copy(lib_png, dst)
            idx[h] = {"subject": sub, "style": o.style, "key": o.key, "file": lib_png, "model": model, "cost": round(cost / len(todo), 4), "created": time.strftime("%Y-%m-%d %H:%M"), "sheet": True}
            res.append({"subject": sub, "file": dst, "source": "nowa", "w": im.width, "h": im.height})
        json.dump(idx, open(idx_f, "w"), ensure_ascii=False, indent=1)
    print(json.dumps({"model": model, "cost": cost, "film_spent": spent(film), "budget": BUDGET, "items": res}, ensure_ascii=False, indent=1))
    print("OBEJRZYJ każdy PNG: arkusz bywa pocięty źle (dwa obiekty w jednym pliku, ucięty obiekt).", file=sys.stderr)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("subject", nargs="?"); p.add_argument("out")
    p.add_argument("--style", default="sticker", choices=list(STYLES)); p.add_argument("--key", default="green", choices=list(KEYS))
    p.add_argument("--from-image"); p.add_argument("--no-cache", action="store_true")
    p.add_argument("--sheet", help="do 9 obiektów rozdzielonych średnikiem; 'out' to wtedy folder")
    p.add_argument("--budget", action="store_true", help="pokaż wydatki filmu (out = dowolna ścieżka w filmie)")
    o = p.parse_args()
    if o.budget:
        film = film_of(o.out); print(json.dumps({"film": film, "spent": spent(film), "budget": BUDGET, "calls": ledger()[1]["films"].get(film, [])}, ensure_ascii=False, indent=1)); return
    if o.sheet: return sheet(o)
    os.makedirs(os.path.dirname(os.path.abspath(o.out)), exist_ok=True)
    if o.from_image:
        res, kept = cut(Image.open(o.from_image)); res.save(o.out)
        print(json.dumps({"file": os.path.abspath(o.out), "source": "obrazek", "w": res.width, "h": res.height, "kept": round(kept, 3)}, ensure_ascii=False)); return
    if not o.subject: sys.exit("podaj opis obiektu")
    os.makedirs(LIB, exist_ok=True)
    idx_f, idx = load_idx()
    h = lib_key(o.style, o.key, o.subject)
    if h in idx and os.path.exists(idx[h]["file"]) and not o.no_cache:
        shutil.copy(idx[h]["file"], o.out)
        print(json.dumps({"file": os.path.abspath(o.out), "source": "biblioteka", "cost": 0, "subject": o.subject}, ensure_ascii=False)); return
    t = time.time()
    data, model, cost = generate(single_prompt(o.subject, o.style, o.key), film_of(o.out))
    raw = os.path.join(LIB, f"{h}-raw.png"); open(raw, "wb").write(data)
    res, kept = cut(Image.open(raw), o.key)
    lib_png = os.path.join(LIB, f"{h}.png"); res.save(lib_png); os.remove(raw)
    shutil.copy(lib_png, o.out)
    idx[h] = {"subject": o.subject, "style": o.style, "key": o.key, "file": lib_png, "model": model, "cost": cost, "created": time.strftime("%Y-%m-%d %H:%M")}
    json.dump(idx, open(idx_f, "w"), ensure_ascii=False, indent=1)
    print(json.dumps({"file": os.path.abspath(o.out), "source": "nowa", "model": model, "cost": cost, "film_spent": spent(film_of(o.out)), "seconds": round(time.time() - t, 1),
                      "w": res.width, "h": res.height, "kept": round(kept, 3)}, ensure_ascii=False))
    if kept > 0.9 or kept < 0.03: print("UWAGA: podejrzane wycięcie (zostało %.0f%% kadru), obejrzyj PNG" % (kept * 100), file=sys.stderr)

if __name__ == "__main__":
    main()
