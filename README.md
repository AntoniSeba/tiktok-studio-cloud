# TikTok Studio Cloud

SaaS dla twórców i agencji prowadzących kanały TikTok: śledzenie filmów, kalendarz publikacji, kolejka pomysłów i renderów, analiza tego, co wygrywa, oraz raporty mailem. Realizacja Soft Synergy.

To wielokontowa wersja lokalnego TikTok Studio (`../tiktok-studio`), z własnym generatorem filmów: wpisujesz temat, a agent (opencode + DeepSeek albo headless Claude Code) robi film od A do Z i MP4 ląduje w zakładce Filmy. Zewnętrzne narzędzia nadal mogą dodawać filmy przez API (`POST /api/videos` z kluczem konta).

## Co jest w środku

| Obszar | Co robi |
|---|---|
| Konta | Rejestracja, logowanie, reset hasła mailem, zmiana hasła, usunięcie konta. Hasła scrypt, sesje w ciasteczku httpOnly (SameSite=Lax, Secure na produkcji). |
| Izolacja danych | Każdy rekord ma `workspace_id`; każde zapytanie filtruje po koncie. Testy sprawdzają, że jedno konto nie czyta ani nie zmienia danych innego. |
| Landing | `/`: co to jest, 4 kroki, funkcje, integracje, FAQ. |
| Konfiguracja | `/app/start`: dwie drogi. (a) "Wklej, co masz": asystent AI (OpenRouter) układa kanał, filmy, kolejkę i terminy, użytkownik widzi podgląd i poprawia przed zapisem. (b) "Krok po kroku": kanał, pierwszy film, termin, maile. |
| Aplikacja | Pulpit z listą pierwszych kroków, Filmy (wyniki, termin, edycja), Kalendarz (miesiąc na desktopie, lista na telefonie), Kolejka (Pomysł, Skrypt, Render, Kontrola, Gotowe), Analiza, Integracje, Ustawienia. |
| Integracje | Klucz API per konto (`Authorization: Bearer tss_...`), import CSV z TikTok Studio, asystent AI, maile Brevo. Dokumentacja: `/integracje`. |
| Generator | `src/generator.js` + `kit/`: agent dostaje brief (`kit/PIPELINE.md`, cel i kontrakt techniczny, bez narzuconego stylu), szkielet HyperFrames (`kit/starter`), narzędzia lektora (Gemini TTS), napisów (whisper), efektów, obrazów AI, podglądu obrazów dla modeli tekstowych (`look.py`) i kontroli. Formaty: TikTok pionowy, długi pionowy, długi 16:9. Opcjonalny PDF jako materiał źródłowy. |
| Style wizualne | W oknie "Wygeneruj film" wybierasz styl, a każdy ma prawdziwy klip przykładowy. Style to skille HyperFrames pobrane od ich autorów (`kit/styles`, manifest `kit/styles/styles.json`, podglądy `public/styles`): 9 gatunków (postacie 3D, bajka rysowana, kinetyczna typografia, wykresy, diagram, kolaż Vox, mechanizm 3D, komiks, motion premium) i 18 stylów z pakietu Creator Style Kit (spolszczone fonty i treść). "Auto" = agent dobiera sam. Podglądy pakietu: `bash scripts/render-style-previews.sh`. |
| B-roll z internetu | Opcja w oknie generowania: agent pobiera prawdziwe ujęcia z Pexels (`kit/tools/broll.py`, zdjęcia awaryjnie z Openverse) i zapisuje autorów w `meta.json`. Wymaga `PEXELS_API_KEY`. |
| Kolejka renderów | Filmy robią się po kolei (`GEN_MAX_CONCURRENT`). Film można dodać bez startu ("czeka na start") i uruchomić później. Restart serwera wraca zadanie na początek kolejki. Limity: dzienny i wielkość kolejki na konto. |
| Agent | Zakładka Agent: czat (DeepSeek przez OpenRouter, narzędzia do całej aplikacji), odpowiedzi strumieniowane. Jedno polecenie typu "seria 20 filmów o X i wyrenderuj" dodaje tematy i kolejkę renderów. |
| Maile | Plan dnia o wybranej godzinie, przypomnienie w godzinie publikacji, raport tygodniowy. Liczone w strefie czasowej konta. Bez kluczy Brevo tryb DRY (tylko log). |

## Uruchomienie lokalne

```bash
npm install
cp .env.example .env    # uzupełnij OPENROUTER_API_KEY, opcjonalnie BREVO_*
npm run dev             # http://localhost:4318
npm test                # 16 testów API na bazie w pamięci
```

## Konfiguracja (.env)

Sekrety są tylko w `.env` (w `.gitignore`). Wzór: `.env.example`.

| Zmienna | Po co |
|---|---|
| `APP_URL` | Publiczny adres, używany w mailach i linkach resetu hasła. |
| `OPENROUTER_API_KEY` | Asystent AI. Bez klucza ścieżka AI jest wyłączona, ręczna działa. |
| `OPENROUTER_MODEL` | Domyślny model (tani): `google/gemini-2.5-flash-lite`. |
| `OPENROUTER_MODELS` | Lista modeli do wyboru w aplikacji (Ustawienia i ekran asystenta). |
| `OPENROUTER_FALLBACKS` | Modele zapasowe, gdy dostawca domyślnego zwróci błąd. |
| `BREVO_SMTP_USER`, `BREVO_SMTP_KEY`, `MAIL_FROM` | Wysyłka maili. `MAIL_FROM` musi być z domeny zweryfikowanej w Brevo. |
| `DB_PATH` | Plik SQLite, domyślnie `data/cloud.db`. |

## Wdrożenie (VPS Soft Synergy)

1. Na serwerze raz: `mkdir -p /home/admin/tiktok-studio-cloud`, utwórz tam `.env` (wzór wyżej, `NODE_ENV=production`, `APP_URL=https://studio.soft-synergy.com`).
2. Lokalnie: `bash scripts/deploy.sh` (wysyła kod bez `data/` i `.env`, instaluje zależności Node 22, restartuje PM2 `tiktok-studio-cloud`).
3. nginx: `deploy/nginx-studio.soft-synergy.com.conf` do `sites-available`, symlink do `sites-enabled`, `nginx -t`, reload, potem `certbot --nginx -d studio.soft-synergy.com`.
4. Kopie zapasowe: plik `data/cloud.db` (SQLite w trybie WAL; do backupu użyj `sqlite3 data/cloud.db ".backup backup.db"`).

Na VPS domyślny Node to 18, a better-sqlite3 12 wymaga 20+, dlatego PM2 dostaje `NODE_BIN=/home/admin/node22/bin/node`.

## Bezpieczeństwo

- Hasła: scrypt z solą. Klucze API i tokeny sesji/resetu przechowywane tylko jako SHA-256.
- CSRF: SameSite=Lax plus wymagany nagłówek `X-Requested-With: fetch` dla zapisów z sesją.
- Limity prób: rejestracja, logowanie, reset, AI, maile.
- Nagłówki: CSP bez inline skryptów, X-Frame-Options DENY, nosniff, HSTS na produkcji.
- Klucz API nie pozwala zmienić hasła, wygenerować nowego klucza ani usunąć konta.

## Struktura

```
src/server.js      trasy, API, zapis konfiguracji (applySetup)
src/db.js          schemat SQLite
src/auth.js        hasła, sesje, klucze API, limity
src/ai.js          asystent AI (OpenRouter), czyszczenie odpowiedzi
src/importers.js   CSV z TikTok Studio, strefy czasowe
src/analysis.js    wynik filmu i porównanie cech
src/scheduler.js   maile per konto, co 5 minut
public/            landing, logowanie, dokumentacja, aplikacja (app/)
test/api.test.js   test całej ścieżki
```

Raport z audytu UX: `AUDYT-UX.md`.
