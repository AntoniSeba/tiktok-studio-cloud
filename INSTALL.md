# INSTALL: instrukcja dla Claude'a (instalacja TikTok Studio Cloud od zera)

Ten plik czyta Claude (Claude Code), nie człowiek. Człowiek mówi tylko: "sklonuj repo tiktok-studio-cloud i zainstaluj według INSTALL.md". Ty robisz resztę.

## Zasady dla Ciebie, Claude (obowiązują przez całą instalację)

1. **Zakładaj, że użytkownik nie zna terminala, programowania ani słowa "zmienna".** Mów po polsku, krótko, bez żargonu. Nigdy nie mów "uruchom npm install": uruchamiasz to sam.
2. **Wszystko robisz sam.** Użytkownika prosisz tylko o rzeczy, których nie możesz zrobić: hasło komputera (sudo), klucze API, logowanie w przeglądarce. Każdą prośbę dawaj jako JEDNO pytanie naraz, z dokładną instrukcją, gdzie kliknąć.
3. **Polecenie wymagające hasła komputera** (sudo, instalacja Homebrew) dajesz użytkownikowi do wklejenia w tym czacie z wykrzyknikiem na początku, np. `! sudo apt-get install -y ffmpeg`, i mówisz: "wklej to, naciśnij Enter, wpisz hasło do komputera (nie będzie widać liter, to normalne) i znowu Enter".
4. **Klucze API są tajne.** Nigdy ich nie powtarzaj, nie wypisuj, nie wklejaj do logów, plików innych niż `.env`, commitów ani wiadomości. Zapisujesz je wyłącznie do `.env` (krok 5), potem `chmod 600 .env`. `.env` jest w `.gitignore`: nigdy go nie commituj i nie wyłączaj z ignorowania.
5. **Po każdym kroku sprawdzasz efekt**, zanim przejdziesz dalej. Narzędzie kontrolne: `bash scripts/doctor.sh` (OK, BRAK z gotową naprawą, UWAGA). Uruchamiaj je po każdej instalacji, aż w części "Programy" i "Projekt" nie będzie żadnego BRAK.
6. **Gdy coś się nie uda**, nie zrzucaj tego na użytkownika. Przeczytaj błąd, sprawdź tabelę "Typowe problemy" na końcu, napraw i powtórz. Pytaj dopiero po 2 nieudanych próbach, jednym zdaniem.
7. Pisz bez półpauz i pauz (znaki U+2013 i U+2014) i bez emoji.
8. Na końcu wypisz użytkownikowi: adres Studio, co działa, czego brakuje (np. opcjonalne klucze) i jedno zdanie, jak zatrzymać albo zrestartować.

## Krok 0. Gdzie jesteś

- Jeśli repo nie jest jeszcze sklonowane: `git clone https://github.com/AntoniSeba/tiktok-studio-cloud.git ~/tiktok-studio-cloud && cd ~/tiktok-studio-cloud`. Prywatne repo: jeśli git prosi o logowanie, użyj `gh auth login` (daj użytkownikowi `! gh auth login` i powiedz, żeby wybrał GitHub.com, HTTPS, logowanie przez przeglądarkę).
- Wykryj system: `uname -s` (Darwin = macOS, Linux) i `uname -m`. Windows: zainstaluj i używaj WSL (Ubuntu), dalej jak Linux.
- **Mac z procesorem Apple (M1, M2, M3...):** sprawdź `sysctl -n hw.optional.arm64`. Jeśli 1, a `uname -m` mówi `x86_64`, ten terminal działa pod Rosettą. Wtedy Pythona testuj i instaluj przez `arch -arm64 python3 ...`, inaczej paczki (numpy) zainstalują się w złej architekturze i generator zgłosi "brak: python3: numpy i Pillow".
- Uruchom `bash scripts/doctor.sh` i zapamiętaj listę BRAK. Instaluj tylko to, czego brakuje.

## Krok 1. Programy systemowe

**macOS:**
1. Homebrew: `command -v brew`. Jeśli brak, użytkownik musi wkleić (wymaga hasła): `! /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`, a po instalacji zrobić to, co Homebrew wypisze w "Next steps" (zwykle dopisanie `brew shellenv` do `~/.zprofile`; zrób to sam).
2. `brew install node@22 ffmpeg tesseract whisper-cpp python@3.12 gh` (pomiń to, co już jest i działa). Jeśli `node -v` nadal pokazuje starszy niż 20: `brew link --overwrite --force node@22`.
3. Model whisper do czasów słów: `mkdir -p ~/.cache/whisper && curl -L -o ~/.cache/whisper/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin` (ok. 150 MB).

**Linux (Ubuntu, Debian, WSL):** daj użytkownikowi do wklejenia (jedno polecenie, wymaga hasła):
`! sudo apt-get update && sudo apt-get install -y ffmpeg tesseract-ocr python3 python3-pip python3-venv git curl ca-certificates fonts-dejavu-core libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2`
Node 22 (jeśli `node -v` < 20 albo brak): `! curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`

## Krok 2. Python

- macOS: `python3 -m pip install --user numpy Pillow` (na Macu Apple pod Rosettą: `arch -arm64 python3 -m pip install --user numpy Pillow`).
- Linux: `python3 -m pip install --user numpy Pillow faster-whisper` (przy błędzie "externally-managed-environment" dodaj `--break-system-packages`).
- Generator woła pierwszy `python3` z PATH. `bash scripts/doctor.sh` pokazuje, który to jest. Jeśli w PATH jest kilka Pythonów, paczki muszą być w tym, który doctor sprawdza (autostart w kroku 7 sam wybierze Pythona z numpy).

## Krok 3. Projekt i silnik renderu

1. `npm install` (w folderze repo).
2. `npx --yes hyperframes@0.8.58 --version` (raz; pobiera narzędzie renderu i jego przeglądarkę, może potrwać kilka minut).
3. Testy: `npm test` (powinno przejść 19 z 20 albo więcej; test "posting and stats feed the analysis" bywa zależny od daty i nie blokuje).

## Krok 4. Claude Code jako silnik agenta wideo

Generator robi filmy, uruchamiając w tle Claude Code (`claude`). Sprawdź `claude --version`.
- Brak: `npm install -g @anthropic-ai/claude-code` (na Linuksie, jeśli brak uprawnień: daj użytkownikowi `! sudo npm install -g @anthropic-ai/claude-code`).
- Logowanie, zapytaj użytkownika jednym pytaniem: "Masz abonament Claude (Pro/Max), czy klucz API Anthropic?"
  - Abonament: daj `! claude` i powiedz: "otworzy się logowanie, zaloguj się w przeglądarce tym samym kontem co w Claude, potem wpisz /exit". Sprawdź: `claude -p "odpowiedz OK" --output-format text` ma zwrócić OK.
  - Klucz API: poproś o klucz (z https://console.anthropic.com/settings/keys) i zapisz go w kroku 5 jako `ANTHROPIC_API_KEY`.

## Krok 5. Klucze (plik .env)

Pytaj o klucze PO JEDNYM, w tej kolejności. Przy każdym powiedz po ludzku, do czego jest, gdzie go wziąć (link) i że można napisać "pomiń" przy opcjonalnych. Zapisuj od razu, bez wypisywania wartości.

| Zmienna | Wymagany? | Po co (powiedz to użytkownikowi) | Skąd |
|---|---|---|---|
| `OPENROUTER_API_KEY` | TAK | głos lektora, obrazy AI, asystent i analiza filmów | https://openrouter.ai/keys (załóż konto, doładuj np. 10 USD, "Create Key") |
| `ANTHROPIC_API_KEY` | tylko bez abonamentu Claude | silnik agenta wideo | https://console.anthropic.com/settings/keys |
| `PEXELS_API_KEY` | nie | prawdziwe ujęcia (B-roll) z internetu w filmach | https://www.pexels.com/api/ (darmowy) |
| `APIFY_API_TOKEN` | nie | trendy muzyczne, wyszukiwarka inspiracji, research konkurencji | https://console.apify.com/settings/integrations |
| `BREVO_SMTP_USER`, `BREVO_SMTP_KEY`, `MAIL_FROM` | nie | maile z planem dnia i raportem | https://app.brevo.com/settings/keys/smtp (MAIL_FROM z domeny zweryfikowanej w Brevo) |

Jak zapisywać (bezpiecznie, bez pokazywania klucza): utwórz plik raz (`touch .env && chmod 600 .env`), a każdy klucz dopisz albo podmień narzędziem do edycji plików (Edit/Write) albo poleceniem, które nie wypisuje wartości, np. `python3 - <<'EOF'` ze skryptem, który ustawia jedną linię `NAZWA=wartość` w `.env`. Nie używaj `echo klucz` w poleceniach, które trafiają do historii, i nie pokazuj zawartości `.env`.

Dopisz też ustawienia (bez pytania):
```
PORT=4318
APP_URL=http://localhost:4318
GEN_MAX_CONCURRENT=2
GEN_MAX_PER_WS=2
GEN_MAX_QUEUED=100
GEN_MIN_FREE_GB=2
```
Na mocnym komputerze (16 GB RAM i więcej, dużo miejsca na dysku) możesz ustawić `GEN_MAX_CONCURRENT=3` i `GEN_MAX_PER_WS=3`.

Potem `bash scripts/doctor.sh`: w części "Projekt" OPENROUTER_API_KEY ma być OK.

## Krok 6. Miejsce na dysku

`bash scripts/doctor.sh` pokazuje wolne miejsce. Generator nie startuje nowego filmu poniżej `GEN_MIN_FREE_GB` (domyślnie 2 GB). Na serię filmów 3D licz co najmniej 10 GB wolnego. Jeśli jest mniej, powiedz to użytkownikowi wprost. Na Macu częsty zjadacz miejsca to porzucone kopie Chrome w `$(getconf DARWIN_USER_TEMP_DIR)/../X/com.google.Chrome.code_sign_clone/` (bezpieczne do usunięcia przy zamkniętym Chrome) i cache: `~/Library/Caches`, `~/.npm/_cacache`, `~/.cache/uv`. Niczego innego nie kasuj bez pytania.

## Krok 7. Uruchomienie na stałe

`bash scripts/autostart.sh`
- macOS: zakłada usługę launchd (start z komputerem, sama wstaje po awarii, na Macu Apple wymusza arm64, wybiera Pythona z numpy).
- Linux: usługa systemd użytkownika.
Skrypt kończy się "DZIAŁA: http://localhost:4318". Sprawdź też `tail -n 5 logs/local-out.log`: linia `generator: gotowy (claude/opus)` znaczy, że generator filmów działa. Jeśli jest `generator: niedostępny (brak: ...)`, napraw brak (tabela niżej) i uruchom `bash scripts/autostart.sh` jeszcze raz.

## Krok 8. Pierwsze konto

Powiedz użytkownikowi: "Otwórz w przeglądarce http://localhost:4318, kliknij Załóż konto, wpisz e-mail i hasło." Potem przeprowadzi go kreator kanału.

## Krok 9 (opcjonalnie). Kanał Silniki: filmy o silnikach z modelami 3D

Tylko jeśli użytkownik chce robić filmy o silnikach (zapytaj jednym zdaniem).
1. Repo z modelami 3D, B-rollem i skillami: `git clone https://github.com/AntoniSeba/silniki-tiktok.git ~/projekty/silniki-tiktok && bash ~/projekty/silniki-tiktok/zainstaluj-skille.sh` (skille trafiają do `~/.claude/skills`). Inne miejsce: dopisz do `.env` `SILNIKI_DIR=<ścieżka>` (i `SKILLS_DIR`, jeśli skille są gdzie indziej).
2. Kanał: `node scripts/kanal-silniki.js` (lista kont), potem `node scripts/kanal-silniki.js <email>`.
3. `bash scripts/doctor.sh`: część "Kanał Silniki" ma być OK. Agenci kanału mają brief w `kit/kanaly/silniki/PIPELINE.md`.
4. Filmy z gotowym lektorem (plik WAV) dodaje się jako zadania z `opts.vo_path`; najprościej poprosić Claude'a w tym repo: "dodaj do kolejki kanału Silniki wszystkie WAV z folderu X".

## Typowe problemy

| Objaw | Przyczyna | Naprawa |
|---|---|---|
| `generator: niedostępny (brak: python3: numpy i Pillow)` | usługa widzi innego Pythona albo zła architektura (Rosetta) | `bash scripts/doctor.sh`, zainstaluj paczki w pokazanym Pythonie, potem `bash scripts/autostart.sh` |
| `AI: wyłączone (brak OPENROUTER_API_KEY)` | klucza nie ma w `.env` | krok 5, potem restart usługi |
| `ENOSPC` albo kolejka stoi, w `logs/local-err.log` "mało miejsca na dysku" | pełny dysk | krok 6; kolejka ruszy sama, gdy miejsce wróci; zadania z błędem: przycisk "Uruchom ponownie" |
| `better-sqlite3` nie buduje się / "NODE_MODULE_VERSION" | inna wersja Node niż przy `npm install` | `rm -rf node_modules && npm install` |
| port 4318 zajęty | działa druga kopia | `lsof -iTCP:4318 -sTCP:LISTEN`, zatrzymaj starą albo ustaw inny `PORT` w `.env` |
| film staje na "Limit, czeka" | limit użycia Claude | wznowi się sam; od razu: przycisk "Uruchom ponownie" |
| restart usługi przerywa filmy | zadanie w toku wraca do kolejki raz; drugi restart = błąd | restartuj, gdy nic się nie generuje, albo potem "Uruchom ponownie" |
| render zawisa na "until mkdir ...render.lock" | został stary plik blokady po awarii | `rmdir /tmp/silniki-render.lock` (tylko gdy żaden render nie trwa) |

## Zatrzymanie i restart

- macOS: `launchctl kickstart -k gui/$(id -u)/com.softsynergy.tiktok-studio-cloud` (restart), `launchctl bootout gui/$(id -u)/com.softsynergy.tiktok-studio-cloud` (stop).
- Linux: `systemctl --user restart tiktok-studio-cloud`, `systemctl --user stop tiktok-studio-cloud`.
- Logi: `logs/local-out.log`, `logs/local-err.log`.
