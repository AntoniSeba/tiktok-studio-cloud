# Szkielet filmu HyperFrames

To tylko szkielet techniczny. Wygląd, układ, kolory, fonty i animacje wyznacza styl wizualny z ZADANIE.md. Jeśli styl ma własny szablon index.html, możesz go użyć zamiast tego szkieletu.

## Pliki, które piszesz
- `scene.html`: elementy filmu (sceny, teksty, obrazy, kształty). Każdy element absolutnie pozycjonowany w kadrze.
- `style.css`: style. Fonty: własne woff2 w `project/assets/fonts` (są Gabarito, Hanken Grotesk, Caveat) albo inne pobrane do tego folderu.
- `film.js`: animacja. `python3 build.py` składa `project/index.html`.

## Kontrakt HyperFrames (twardy)
- Render ustawia czas klatki sam. Animacja musi być deterministyczna: zbuduj ją na osi `window.__timelines.main` (gsap.timeline, już utworzona i zatrzymana), np.
  `const tl = window.__timelines.main; tl.fromTo('#title', {opacity: 0, y: 60}, {opacity: 1, y: 0, duration: 0.4}, 0.2);`
- Zero `requestAnimationFrame`, `setTimeout`, `setInterval`, animacji CSS (`@keyframes`, `transition`) i losowości bez stałego ziarna. Wszystko, co się rusza, rusza się przez timeline.
- Oś musi trwać dokładnie `window.FILM.D` sekund: na końcu `tl.set({}, {}, window.FILM.D);`.
- Napisy: `window.CAPS` to tablica grup słów z czasami (z caps.py). Pokazuj każdą grupę w jej czasie przez timeline.
- Obrazy, wideo i dźwięki tylko lokalnie z `project/assets`. Z CDN wolno ładować wyłącznie biblioteki (gsap, three.js) i fonty Google.

## Polecenia
- `python3 build.py` (poziomo: `W=1920 H=1080 python3 build.py`)
- `cd project && npx --yes hyperframes@0.8.58 lint .` (musi być 0 błędów)
- `npx --yes hyperframes@0.8.58 snapshot . --at 1,5,12 --no-end` (klatki w `snapshots/`)
- `npx --yes hyperframes@0.8.58 render . -q high -o renders/film.mp4`
