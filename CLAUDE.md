# TikTok Studio Cloud

Nowa instalacja (brak `node_modules`, brak `.env` albo użytkownik prosi o instalację lub uruchomienie): przeczytaj w całości `INSTALL.md` i wykonaj go krok po kroku. Użytkownik może nie znać terminala: wszystko robisz sam, pytasz tylko o hasło komputera, klucze i logowanie, po jednym pytaniu.

Kontrola stanu instalacji w każdej chwili: `bash scripts/doctor.sh`.

Zasady pracy w tym repo:
- Klucze są tylko w `.env` (w `.gitignore`). Nigdy ich nie wypisuj ani nie commituj.
- Restart serwera przerywa filmy w toku. Restartuj, gdy nic się nie generuje (`sqlite3 data/cloud.db "SELECT id FROM gen_jobs WHERE status='running'"` jest puste).
- Bez półpauz i pauz (znaki U+2013 i U+2014) i bez emoji w plikach i tekstach.
