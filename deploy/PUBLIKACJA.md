# Co pójdzie na zewnątrz (czeka na zgodę)

## A. Wdrożenie na VPS Soft Synergy (193.180.211.30)

1. Kod do `/home/admin/tiktok-studio-cloud` (bez `data/`, `.env`, `node_modules`), `npm ci` na Node 22 (`/home/admin/node22`), nowy proces PM2 `tiktok-studio-cloud` na `127.0.0.1:4318`. Istniejące procesy PM2 i lokalne Studio (port 4317 na Macu) bez zmian.
2. Plik `.env` na serwerze (tylko tam, nie w repo):
   - `NODE_ENV=production`, `PORT=4318`, `HOST=127.0.0.1`
   - `APP_URL=https://tiktok-studio.realizacje.soft-synergy.com` (albo `https://studio.soft-synergy.com`, patrz punkt 4)
   - `OPENROUTER_API_KEY` = Twój obecny klucz OpenRouter z Maca (koszty AI idą na to konto; domyślny model ok. 0,10 USD za 1M tokenów wejścia, jedna analiza to ułamek centa)
   - `BREVO_SMTP_USER`, `BREVO_SMTP_KEY`, `MAIL_FROM`: brak kluczy (lokalnie też DRY). Bez nich maile nie wychodzą, w tym reset hasła. Potrzebny klucz SMTP z Brevo i adres nadawcy z domeny zweryfikowanej w Brevo.
3. nginx: nowy vhost z `deploy/nginx-studio.soft-synergy.com.conf` (proxy na 4318), `nginx -t`, reload, certyfikat `certbot --nginx`.
4. Domena, dwie opcje:
   - `tiktok-studio.realizacje.soft-synergy.com`: działa od razu (wildcard DNS już wskazuje na VPS).
   - `studio.soft-synergy.com`: wymaga rekordu A w Cloudflare (`studio` -> `193.180.211.30`), którego nie mam jak dodać.
5. Rejestracja otwarta dla każdego (to SaaS). Limity prób są włączone.

## A2. Generator filmów na VPS (opencode + DeepSeek)

Stan serwera (sprawdzone 2026-10-26): 6 rdzeni, 7 GB RAM (wolne ok. 2 GB), dysk 96 GB zajęty w 93% (wolne ok. 7 GB). Brak ffmpeg, Chrome, numpy, whisper i opencode. Jest Docker.

- Obraz `tiktok-studio-gen` z `deploy/generator.Dockerfile` (Node 22, opencode, ffmpeg, Chromium, Python z numpy, Pillow, faster-whisper). Rozmiar ok. 2 do 3 GB.
- Każde zadanie generatora startuje w osobnym kontenerze (`GEN_SANDBOX=docker`), który widzi tylko folder zadania, kit tylko do odczytu i bibliotekę wycinanek konta. Agent wykonuje polecenia powłoki, więc w SaaS to warunek bezpieczeństwa: kontener nie ma dostępu do bazy, `.env` ani innych kont.
- Klucz OpenRouter dla generatora: osobny klucz z limitem wydatków w panelu OpenRouter (`GEN_OPENROUTER_API_KEY`), bo agent w kontenerze go widzi.
- Limity: 1 film naraz na serwer (`GEN_MAX_CONCURRENT=1`), 3 filmy dziennie na konto (`GEN_DAILY_LIMIT`), 75 min na film.
- Silniki agenta: opencode + DeepSeek (OpenRouter, tani) albo headless Claude Code (`claude/sonnet`, `claude/opus`). Claude Code na serwerze wymaga `GEN_ANTHROPIC_API_KEY` (rozliczenie przez API Anthropic, nie abonament).
- Załączniki PDF: na hoście `apt install poppler-utils` (wyciąganie tekstu z PDF).
- Zakładka Agent: model `AGENT_MODEL` (domyślnie deepseek/deepseek-v4-flash przez OpenRouter), odpowiedzi strumieniowane (nginx: `proxy_buffering off`).
- Ryzyko: mało wolnego dysku i RAM. Render jednego filmu to kilka minut pełnego obciążenia CPU i ok. 1 GB RAM. Przy wielu użytkownikach generator powinien dostać osobną maszynę.

## B. Realizacja na stronie Soft Synergy

Portfolio na soft-synergy.com pochodzi z Ofertownika (`oferty.soft-synergy.com/api/portfolio`). Nowa pozycja (POST z kluczem integracji Claude, kategoria `web`):

- Tytuł PL: TikTok Studio: planowanie i analiza filmów TikTok (SaaS)
- Tytuł EN: TikTok Studio: TikTok video planning and analytics (SaaS)
- Technologie: Node.js, Express, SQLite, opencode + DeepSeek, HyperFrames, OpenRouter AI, Docker, Brevo
- Link: adres z punktu A.4
- Obraz: `deploy/realizacja-landing.png` (zrzut strony głównej 1440x900)
- Opis PL:
  TikTok Studio to aplikacja SaaS dla twórców i agencji, którzy publikują na TikToku regularnie. W jednym miejscu łączy listę filmów, kalendarz publikacji, kolejkę pomysłów od skryptu do renderu i analizę, która porównuje hooki, tematy i formaty, żeby wskazać, co powtarzać. Raporty i przypomnienia o publikacji przychodzą mailem w strefie czasowej konta.
  Nowy użytkownik konfiguruje kanał na dwa sposoby: wkleja dowolne notatki, a asystent AI (OpenRouter, tani model z możliwością zmiany) układa z nich kanał, filmy, kolejkę i terminy z podglądem przed zapisem, albo przechodzi krótki kreator krok po kroku. Generatory wideo podłączają się przez API z kluczem konta, a wyniki można wgrać z eksportu CSV TikTok Studio.
  Projekt objął budowę wielokontowego backendu (konta, sesje, izolacja danych, klucze API), landing page, onboarding, pełny audyt UX ścieżki od rejestracji do pierwszego zaplanowanego filmu oraz testy całej ścieżki.
- Opis EN:
  TikTok Studio is a SaaS app for creators and agencies who post on TikTok on a schedule. It brings the video list, a publishing calendar, an idea-to-render queue and an analysis that compares hooks, topics and formats to show what to repeat into one place. Reports and publishing reminders arrive by email in the account's time zone.
  New users set up their channel in one of two ways: paste any notes and an AI assistant (OpenRouter, low-cost model, switchable) turns them into a channel, videos, a queue and a schedule with a preview before saving, or follow a short step-by-step wizard. Video generators connect through an API with an account key, and results can be imported from a TikTok Studio CSV export.
  The project covered a multi-account backend (accounts, sessions, data isolation, API keys), a landing page, onboarding, a full UX audit of the path from sign-up to the first scheduled video, and end-to-end tests.
- Wyniki (pole results): Od rejestracji do pierwszego zaplanowanego filmu w około 3 minuty; 16 testów automatycznych całej ścieżki; 17 problemów UX znalezionych i naprawionych w testach przeglądarkowych.
