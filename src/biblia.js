// biblia.js: the TikTok Bible (Antoni's standard from the engines channel: 49 videos, 5.4M views) split into
// elements the user can switch off one by one in the generate dialog. Each element adds its rule to the
// brief; some also switch a production step (voice cut + 1.12x, casino plan, loudness, audit gate).
export const BIBLIA = [
  { id: 'start0', name: 'Akcja od pierwszej setnej sekundy', short: 'Lektor i ruch od klatki 0, bez planszy tytułowej.',
    rule: 'Akcja od pierwszej setnej sekundy: lektor mówi od 0 (najpóźniej 30 ms), obraz rusza się od klatki 0, nagłówek stoi od klatki 0. Żadnego powolnego wejścia ani planszy tytułowej.' },
  { id: 'hook', name: 'Hook wprost', short: 'Najmocniejsze zdanie filmu na start, bez wstępu.',
    rule: 'Hook = najmocniejsze zdanie filmu podane wprost: teza, liczba w sprzeczności, oskarżenie w drugiej osobie albo fakt wprost. Bez pytań "dlaczego" na start i bez wstępu. Wzory: $KIT/biblia/hooki.md.' },
  { id: 'bramka5', name: 'Bramka 5 sekundy', short: 'Hook spłacony do 4 s, obietnica w 3-10 s, drugi hook w 8-12 s.',
    rule: 'Bramka 5 sekundy: hook spłacony do 4. s, konkretna obietnica (nazwa, liczba, rzecz) w 3-10 s, drugi hook w 8-12 s.' },
  { id: 'dynamika', name: 'Dynamika co 2-3 s', short: 'Nowe ujęcie, grafika albo akcent co 2-3 s, w hooku co 1 s.',
    rule: 'Dynamika co 2-3 s (w hooku co ok. 1 s przez pierwsze 5-7 s): nowe ujęcie, wejście grafiki, punch-in, zmiana koloru, akcent dźwiękowy. Najdłużej 3,5 s bez żadnej zmiany obrazu.' },
  { id: 'kasyno', name: 'Efekt kasyna', short: 'Nieregularny rytm zmian z planu kasyno.py.',
    rule: 'Efekt kasyna: zmiany NIGDY w równym rytmie. Różne odstępy i różna siła "trafień", duże trafienia w nieprzewidywalnych momentach. Czasy cięć i wejść bierzesz z plan.json (kasyno.py --generuj).' },
  { id: 'obietnica', name: 'Obietnica dowieziona', short: 'To, co obiecuje hook, dowozimy dosłownie i z konkretem.',
    rule: 'Obietnica jest umową: to, co obiecuje hook, dowozisz dosłownie i z konkretem, tak żeby widz pomyślał "nauczyłem się czegoś".' },
  { id: 'magnes', name: 'Magnes na komentarz', short: 'Zaplanowane niedopowiedzenie, anomalia albo drobny błąd.',
    rule: 'Magnes na komentarz: jedno zaplanowane niedopowiedzenie, anomalia w kadrze albo drobny, nieszkodliwy błąd w oczywistej rzeczy (zapisz w DECYZJE.md, co to jest). Wzory: $KIT/biblia/komentarze-i-ego-bait.md.' },
  { id: 'egobait', name: 'Ego bait', short: 'Oczywiste podane jak wiedza dla znawców, subtelnie.',
    rule: 'Ego bait: oczywistą rzecz podaj jak wiedzę dla znawców, subtelnie ("większość tego nie wie", "mechanik ci nie powie"). Widz w temacie ma poczuć się mądry.' },
  { id: 'zaangazowanie', name: 'Pytanie-wybór i powód do zapisu', short: 'Pytanie A albo B po obejrzeniu, lista warta zapisania.',
    rule: 'Zaangażowanie organicznie: pytanie-wybór A albo B, na które da się odpowiedzieć dopiero po obejrzeniu, i powód do zapisu (lista, liczba, procedura). Nigdy "napisz TAK", "daj suba".' },
  { id: 'cta', name: 'CTA wplecione w temat', short: 'Produkt albo rada jako dowód, bez bloku reklamowego.',
    rule: 'CTA wplecione w temat: problem zasiany wcześniej, produkt albo rada jako dowód ({{CTA}}). Nigdy osobny blok reklamowy na końcu.' },
  { id: 'petla', name: 'Pętla i urwany koniec', short: 'Ostatnia klatka jak pierwsza, ostatnie słowa wpadają w hook.',
    rule: 'Koniec urwany, bez podsumowania. Pętla: ostatnia klatka wygląda jak pierwsza (ten sam kadr i układ, bez czarnej klatki i bez wyciszenia), a ostatnie słowa lektora wpadają w pierwsze zdanie hooka.' },
  { id: 'strefy', name: 'Martwe strefy TikToka', short: 'Treść poza interfejsem aplikacji (góra, dół, prawa szyna).',
    rule: 'Martwe strefy: treść tylko w y 250-1430, poniżej y 1000 tylko do x 850 (prawa szyna z sercem i komentarzami), 40 px od lewej i prawej krawędzi.' },
  { id: 'tts', name: 'Cięcie ciszy i tempo 1,12x', short: 'Każda cisza i oddech wycięte, lektor przyspieszony raz.', step: true },
  { id: 'glosnosc', name: 'Głośność -14 LUFS', short: 'Normalizacja dźwięku gotowego filmu.', step: true },
  { id: 'audyt', name: 'Audyt Biblii przed oddaniem', short: 'audyt.py musi dać PASS, inaczej poprawki i ponowny render.', step: true },
];
export const BIBLIA_IDS = BIBLIA.map(b => b.id);
export const bibliaList = () => BIBLIA.map(({ id, name, short }) => ({ id, name, short }));

/** Which elements are on: everything except what the user switched off. */
export function bibliaOn(off = [], vertical = true) {
  const set = new Set(BIBLIA_IDS.filter(id => !(off || []).includes(id)));
  if (!vertical) { set.delete('strefy'); set.delete('petla'); }   // a 16:9 YouTube video has no TikTok UI and no loop
  return set;
}

/** Placeholder values for kit/PIPELINE.md built from the switched-on elements. */
export function bibliaFill(on, { cta }) {
  const rules = BIBLIA.filter(b => b.rule && on.has(b.id)).map(b => '- ' + b.rule.replace('{{CTA}}', cta));
  const offNames = BIBLIA.filter(b => !on.has(b.id)).map(b => b.name);
  const block = rules.length
    ? ['# BIBLIA TIKTOKA (standard kanału, ma pierwszeństwo przed stylem)',
       'Zasady z danych kanału o silnikach (49 filmów, 5,4 mln wyświetleń): zasięg rośnie z czasem oglądania mocniej niż liniowo, więc każda sekunda ma trzymać widza. Pełna Biblia z powodami i liczbami: $KIT/biblia/BIBLIA.md.',
       ...rules,
       offNames.length ? `- Użytkownik WYŁĄCZYŁ w tym filmie: ${offNames.join(', ')}. Tych zasad nie stosuj.` : '',
      ].filter(Boolean).join('\n')
    : '# BIBLIA TIKTOKA\nWyłączona w tym filmie: rytm, hook i zakończenie projektujesz sam.';
  const needDecisions = ['hook', 'bramka5', 'magnes', 'egobait', 'zaangazowanie', 'cta', 'petla'].filter(id => on.has(id));
  return {
    BIBLIA_BLOCK: block,
    BIBLIA_PLAN: needDecisions.length
      ? ` i sekcja "Biblia": ${[on.has('hook') && 'typ hooka i jego zdanie', on.has('bramka5') && 'obietnica i drugi hook', on.has('magnes') && 'magnes na komentarz', on.has('egobait') && 'ego bait',
          on.has('zaangazowanie') && 'pytanie-wybór i powód do zapisu', on.has('cta') && 'jak wpleciony jest CTA', on.has('petla') && 'zdanie pętli'].filter(Boolean).join(', ')}`
      : '',
    BIBLIA_SCRIPT: [on.has('hook') && 'Pierwsze zdanie to hook.', on.has('petla') && 'Ostatnie zdanie wpada w pierwsze (pętla), bez podsumowania.'].filter(Boolean).join(' '),
    VO_CUT: on.has('tts')
      ? 'python3 $KIT/tools/biblia/tts_tnij.py raw.wav vo.wav   (wycina KAŻDĄ ciszę i oddech, tempo 1,12x i poziom w jednym kroku; musi dać PASS; tempa nie zmieniaj już nigdzie indziej)'
      : 'cp raw.wav vo.wav   (użytkownik wyłączył cięcie ciszy i przyspieszenie: lektor zostaje w naturalnym tempie)',
    KASYNO_STEP: on.has('kasyno') ? ', plan rytmu: python3 $KIT/tools/biblia/kasyno.py --generuj <długość vo.wav w s> --slowa words.json --zapisz plan.json' : '',
    KASYNO_TIMES: on.has('kasyno') ? ' i plan.json (efekt kasyna)' : '',
    LOOP_FRAME: on.has('petla') ? ' Ostatnia klatka ma wyglądać jak pierwsza.' : '',
    LOUDNORM: on.has('glosnosc') ? ' Głośność: ffmpeg -y -i renders/film.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k renders/film-n.mp4 && mv renders/film-n.mp4 renders/film.mp4' : '',
    AUDIT_STEP: on.has('audyt')
      ? '6a. AUDYT BIBLII (bramka): python3 $KIT/tools/biblia/audyt.py renders/film.mp4 --lektor assets/vo.mp3 . Każdy FAIL dotyczący włączonych zasad poprawiasz w projekcie, renderujesz i audytujesz ponownie (najwyżej 2 poprawki); FAIL z wyłączonych zasad pomijasz. WARN to wskazówka. Odpowiedz na punkty ręczne z raportu w DECYZJE.md. Skopiuj raport: cp renders/audyt-film.mp4.md ../audyt.md'
      : '',
    STREFY_TOOL: on.has('strefy') ? 'python3 $KIT/tools/biblia/strefy.py project/snapshots (martwe strefy na zrzutach), ' : '',
  };
}
