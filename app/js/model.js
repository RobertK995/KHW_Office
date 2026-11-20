// KHW Manager – Spielmodell.
// Baut aus den Rohdaten der Tabelle alle Spielobjekte neu auf. Abgeleitete Werte (Ranking, Titelträger,
// Roster, Gewinnrechnung, Quoten …) werden hier selbst berechnet und nicht aus Formelzellen gelesen.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { num } = K;

  K.STATUS = ['Main Event', 'Uppercard', 'Midcard', 'Lowercard', 'Newcomer'];
  K.STATUS_SHORT = { 'Main Event': 'ME', 'Uppercard': 'UC', 'Midcard': 'MC', 'Lowercard': 'LC', 'Newcomer': 'NC' };
  // Farbbänder im Blatt "Ranking" → Zielstatus (aus Ranking.gs)
  const COLOR_STATUS = { '#fff2cc': 'Midcard', '#c9daf8': 'Main Event', '#f4cccc': 'Uppercard', '#d9d2e9': 'Lowercard', '#d9ead3': 'Newcomer' };
  const SHOWS = ['TryOut', 'Lucky7'];

  K.VENUES = {
    'HK Casino': { capacity: 490 }, 'Klassische Sportarena': { capacity: 1270 },
    'Großes OutdoorStadion 2': { capacity: 20200 }, 'Großes OutdoorStadion 1': { capacity: 40350 },
    'Freiluft Bühne': { capacity: 50500 }, 'IndoorStadion': { capacity: 70750 },
  };

  K.buildModel = function (data) {
    const S = {};
    Object.keys(data.sheets).forEach(n => { S[n] = new K.Sheet(n, data.sheets[n]); });
    const m = { sheets: S, generatedAt: data.generatedAt };
    m.currentShow = Number(S.Finanzen.v('J53')) || data.currentShow;
    m.sheetCurrentShow = m.currentShow;
    if (K.store) m.currentShow = K.store.currentShow(m.currentShow);   // im Klickdummy weitergezählt
    m.year = K.YEAR;
    m.titles = buildTitles(S.Titel);
    // Vakante Titel mit leerer Trägerzelle erkennt die Tabelle nicht; sie werden hier ergänzt (Regelwerk: Titel).
    const tconf = K.conf.get('titles');
    (tconf.extra || []).forEach(n => { if (!m.titles.some(t => t.name === n)) m.titles.push({ name: n, holder: '', former: [], section: '', extra: true }); });
    if (K.store) K.store.patchTitles(m.titles);   // Titelwechsel aus dem Klickdummy
    // Ausgeblendete Titel fallen überall weg; das Regelwerk sieht alle (m.titlesAll).
    m.titlesAll = m.titles;
    m.titles = m.titles.filter(t => !(tconf.hidden || []).includes(t.name));
    m.storySheet = buildStories(S.Weeklies);   // Startstand; die Storylines selbst entstehen nach dem Kader (buildStorylines)
    m.stories = [];
    m.seasons = { TryOut: S.Weeklies.n('I4'), Lucky7: S.Weeklies.n('W4') };
    m.roster = buildRoster(S.Datenbank, m);
    if (K.store) K.store.patchRoster(m.roster);   // Änderungen und neu aufgenommene Wrestler aus dem Klickdummy
    m.byName = new Map(m.roster.map(w => [w.name, w]));
    contracts(m);   // Vertragsende mit Jahr, wer gerade einen Vertrag hat
    renameTitleHolders(m);   // umbenannte Wrestler (Matches folgen nach dem Aufbau der Shows)
    buildGroups(m);   // Teams und Stables (eigene Listen, ein Wrestler kann in mehreren Teams sein)
    m.roster.forEach(w => { w.titles = titlesOf(m.titles, w); });
    m.curWeek = K.weekIdx(m.curDate);
    buildStorylines(m, m.storySheet);   // nach den Teams: genannte Teams/Stables bringen ihre Mitglieder mit
    m.ranking = buildRanking(m, S.Ranking);
    m.shows = buildShows(S.Card, m);
    m.shows.forEach(s => s.matches.forEach(mt => { ['winner', 'loser', 'extra'].forEach(f => { mt[f] = K.rnList(mt[f]); }); }));   // umbenannte Wrestler
    m.show = k => m.shows.find(s => s.key === k || (s.no !== null && s.no === k));
    // Die fällige Show: die früheste noch nicht abgerechnete. Sie wird auf der Finanzen-Seite beendet.
    m.dueShow = m.shows.find(s => !s.ended) || null;
    m.shows.forEach(s => { s.state = s.ended ? 'past' : s === m.dueShow ? 'current' : 'future'; });
    m.finance = buildFinance(S.Finanzen);
    if (K.store) K.store.patchFinance(m.finance);
    storePrices(m.finance);
    m.staff = buildStaff(S.Mitarbeiter);
    if (K.store) K.store.patchStaff(m.staff);
    m.storage = buildStorage(S.Lager);
    m.contract = buildContract(S.Vertrag);
    m.talents = buildTalents(S.Talentboard);
    m.interaction = buildInteraction(S.Interaktionen);
    m.bar = buildBar(S['HK Casino Bar']);
    m.skillPoints = (S.Interaktionen.n('M14') || 0) + ((K.store && K.store.state.game.skillPoints) || 0);   // + Belohnungen im Klickdummy
    m.statusChanges = statusChanges(m);
    return m;
  };

  /* ───────────── Titel ───────────── */
  // Im Blatt steht der Titelname zwei Zeilen über dem Träger; die Zellnotiz des Trägers ist die Historie.
  function buildTitles(sh) {
    const texts = [];
    sh.map.forEach(c => { if (String(c[3]).trim()) texts.push({ r: c[0], c: c[1], t: String(c[3]).trim() }); });
    texts.sort((a, b) => a.r - b.r || a.c - b.c);
    const holderCells = new Set(), titles = [], labels = [];
    texts.forEach(x => {
      const key = x.r * 1000 + x.c;
      if (holderCells.has(key)) return;
      const holder = sh.d(x.r + 2, x.c).trim();
      if (!holder) { labels.push(x); return; }
      holderCells.add((x.r + 2) * 1000 + x.c);
      const history = String(sh.note(x.r + 2, x.c) || '').split('\n').map(s => s.trim()).filter(Boolean);
      titles.push({
        name: x.t.replace(/\s*\n\s*/g, ' '), holder: holder === '-' ? '' : holder,
        former: history.filter((h, i) => !(i === 0 && h === holder) && h !== '-'), r: x.r, c: x.c,
      });
    });
    titles.forEach(t => {
      const above = labels.filter(l => l.r < t.r);
      const row = above.length ? Math.max(...above.map(l => l.r)) : 0;
      const cand = above.filter(l => l.r === row).sort((a, b) => Math.abs(a.c - t.c) - Math.abs(b.c - t.c))[0];
      t.section = cand ? cand.t.replace(/^K H W$/, 'KHW') : '';
    });
    return titles;
  }

  function titlesOf(titles, w) {
    const teams = w.teams || (w.tagTeam ? [w.tagTeam] : []);
    return titles.filter(t => t.holder && (
      t.holder === w.name || t.holder.split(/\s*&\s*/).includes(w.name) || teams.includes(t.holder)
    )).map(t => t.name);
  }

  /* ───────────── Teams und Stables ─────────────
     Teams: { name, members: [Wrestler-Namen] } – keine Trennung mehr in Mixed und normal; ein Wrestler kann in mehreren
     Teams sein. Stables: { name, members: [Wrestler- oder Team-Namen] }.
     Solange im Klickdummy nichts geändert wurde, entstehen beide aus der Tabelle (Felder Tag Team, Mixed Tag Team, Stable):
     Mixed Tag Team enthält dort den Namen des Partners. Teams ohne Namen heißen „Team 1“, „Team 2“ …
     Danach gelten die Listen aus store.groups (Seite „Teams und Stables“). */
  K.groupsFromSheet = roster => {
    const teams = [], byName = new Map(roster.map(w => [w.name, w]));
    const find = n => teams.find(t => t.name === n);
    roster.forEach(w => { const n = String(w.tagTeam || '').trim(); if (!n || n === '-') return; (find(n) || (teams.push({ name: n, members: [] }), teams[teams.length - 1])).members.push(w.name); });
    let no = 0;
    const freeName = () => { do { no++; } while (find('Team ' + no)); return 'Team ' + no; };
    roster.forEach(w => {
      const v = String(w.mixedTeam || '').trim();
      if (!v || v === '-') return;
      const t = find(v);
      if (t) { if (!t.members.includes(w.name)) t.members.push(w.name); return; }   // Name eines Teams
      if (!byName.has(v)) return;
      const pair = [w.name, v].sort();
      if (teams.some(x => x.members.length === 2 && x.members.slice().sort().join('|') === pair.join('|'))) return;   // beide Seiten tragen sich gegenseitig ein
      teams.push({ name: freeName(), members: pair });
    });
    const stables = [];
    roster.forEach(w => { const n = String(w.stable || '').trim(); if (!n || n === '-') return; let s = stables.find(x => x.name === n); if (!s) { s = { name: n, members: [] }; stables.push(s); } s.members.push(w.name); });
    // Ganze Teams im Stable als Team führen
    stables.forEach(s => teams.forEach(t => {
      if (t.members.length && t.members.every(n => s.members.includes(n))) s.members = s.members.filter(n => !t.members.includes(n)).concat(t.name);
    }));
    return { teams, stables };
  };
  function buildGroups(m) {
    const own = K.store && K.store.state.groups;
    const g = own && Array.isArray(own.teams) ? JSON.parse(JSON.stringify(own)) : K.groupsFromSheet(m.roster);
    g.teams.forEach(t => { t.members = t.members.map(K.rn); });
    (g.stables || []).forEach(s => { s.members = s.members.map(K.rn); });
    m.teams = g.teams.filter(t => t.members.length);
    m.stables = (g.stables || []).filter(s => s.members.length);
    m.teamByName = new Map(m.teams.map(t => [t.name, t]));
    // Für Anzeigen und Suche: Teams und Stables jedes Wrestlers (auch über ein Team im Stable)
    m.roster.forEach(w => {
      w.teams = m.teams.filter(t => t.members.includes(w.name)).map(t => t.name);
      w.tagTeam = w.teams.join(', ');
      w.stables = m.stables.filter(s => s.members.includes(w.name) || s.members.some(x => w.teams.includes(x))).map(s => s.name);
      w.stable = w.stables.join(', ');
    });
  }
  /** Mitglieder (Wrestler-Namen) eines Teams oder null. */
  K.teamMembers = (m, name) => { const t = m.teamByName && m.teamByName.get(name); return t ? t.members : null; };

  /* ───────────── Storylines (Blatt Weeklies, Zeilen 53–61) ───────────── */
  function buildStories(sh) {
    const out = [];
    for (let c = 2; c <= 26; c++) {
      const name = sh.d(53, c).trim();
      if (!name) continue;
      const steps = [];
      for (let r = 55; r <= 60; r++) { const t = sh.d(r, c).trim(); if (t) steps.push(t); }
      out.push({ name: name.replace(/\s*\n\s*/g, ' '), rawName: name, show: c < 15 ? 'TryOut' : 'Lucky7', steps, start: sh.d(61, c).trim() });   // Zeile 61: Startpunkt der Storyline (z. B. „Okt W4“)
    }
    return out;
  }

  /* Spielwochen: fortlaufend (Monat × 4 + Woche), z. B. für „seit Nov W2“ und die Dauer einer Storyline */
  K.weekIdx = d => K.absMonth(d) * 4 + (d.week - 1);
  K.weekText = (idx, curYear) => { const abs = Math.floor(idx / 4), y = Math.floor(abs / 12); return `${K.MONTHS[abs % 12].slice(0, 3)} W${(idx % 4) + 1}${curYear && y !== curYear ? ` J${y}` : ''}`; };

  /**
   * Storylines: kleine Todo-Listen. { id, title, show, status: planned | active | done, steps: [{ text, done }],
   * participants: [Namen], start / end (Spielwoche), reward }. Die Seite „Storylines“ ist die Quelle; Card, Weeklie Roster,
   * Vorschläge im Editor und die IDB-Variable lesen m.stories (die aktiven, in der alten Form).
   * Solange im Klickdummy nichts geändert wurde, kommen sie aus der Tabelle (Weeklies Zeilen 53–61, alle aktiv).
   */
  function buildStorylines(m, sheet) {
    const own = K.store && K.store.state.stories;
    const sheetWeek = K.weekIdx(K.showDate(m.sheetCurrentShow));
    const names = m.roster.map(w => w.name).sort((a, b) => b.length - a.length);
    // Beteiligte aus dem Text: genannte Wrestler, dazu die Mitglieder genannter Teams und Stables
    const groupMembers = g => g.members.flatMap(n => (m.byName.has(n) ? [n] : (K.teamMembers(m, n) || [])));
    K.storyPeople = text => [...new Set([...names.filter(n => text.includes(n)),
      ...(m.teams || []).filter(t => text.includes(t.name)).flatMap(groupMembers), ...(m.stables || []).filter(s => text.includes(s.name)).flatMap(groupMembers)])];
    let list;
    if (Array.isArray(own)) list = JSON.parse(JSON.stringify(own));
    else {
      list = sheet.map((s, i) => {
        // „Okt W4“: Monat und Woche; liegt der Monat nach dem der Tabelle, war es im Vorjahr
        const x = /^([A-Za-zÄÖÜäöü]+)\.?\s*W(?:oche)?\s*(\d)/i.exec(s.start || '');
        let start = null;
        if (x) {
          const p = K.parseMonth(x[1]);
          if (p) { let abs = K.YEAR * 12 + p.month; if (abs * 4 + Number(x[2]) - 1 > sheetWeek) abs -= 12; start = abs * 4 + Number(x[2]) - 1; }
        }
        return { id: 'sheet' + i, title: s.name, show: s.show, status: 'active', steps: s.steps.map(t => ({ text: t, done: false })),
          participants: [...new Set(K.storyPeople([s.name, ...s.steps].join(' ')))], start, end: null, reward: null };
      });
    }
    list.forEach(s => {
      s.participants = (s.participants || []).map(K.rn);
      s.doneCount = s.steps.filter(x => x.done).length;
      s.weeks = s.start === null || s.start === undefined ? null : Math.max(1, (s.status === 'done' && s.end !== null && s.end !== undefined ? s.end : m.curWeek) - s.start);
      s.startText = s.start === null || s.start === undefined ? '' : K.weekText(s.start, m.curYear);
    });
    m.storylines = list;
    m.stories = list.filter(s => s.status === 'active').map(s => ({ id: s.id, name: s.title, show: s.show, steps: s.steps.map(x => x.text), start: s.startText }));
    m.roster.forEach(w => { const s = list.find(x => x.status === 'active' && x.participants.includes(w.name)); w.storyline = s ? s.title : ''; });
  }

  /**
   * Das Feld „Verletzungsstatus“ der Tabelle enthält zweierlei:
   *   Verletzungen, oft mit Kosten („1890 € (leichte Verletzung - Bluterguss)“, „-8.951 €“, „Verletzt bis März W4“)
   *     → injury (Grund) und injuryCost (Betrag, falls angegeben)
   *   alles andere (Streik, Exklusiv bei …, Auf Tournee, Karriere beendet …) → unavailable („nicht verfügbar“, ohne Kosten)
   * Änderungen aus dem Klickdummy (store.wrestlers) kommen danach und haben Vorrang.
   */
  function splitInjury(w) {
    w.unavailable = '';
    if (!w.injury) return;
    const x = /(-?\d[\d.]*(?:,\d+)?)\s*€/.exec(w.injury);
    if (x) {
      w.injuryCost = Math.abs(Number(x[1].replace(/\./g, '').replace(',', '.')));
      w.injury = w.injury.replace(x[0], '').replace(/^\s*[(\-–:]\s*|\s*\)\s*$/g, '').replace(/^\(|\)$/g, '').trim() || 'Verletzung';
    } else if (!/verletz|bruch|riss|prell|zerrung|gehirn/i.test(w.injury)) {
      w.unavailable = w.injury; w.injury = '';
    }
  }

  /* ───────────── Kader (Blatt Datenbank) ───────────── */
  /** Namen der KHW-Shows: TryOut, Lucky7 und eigene Showreihen (für Auswahllisten und den Kader). */
  K.khwShows = () => Object.values(K.seriesConf()).filter(c => !c.deletedFrom).map(c => c.label);

  /**
   * Umbenannte Wrestler (Datenbank): store.renames = { alter Name: neuer Name }. K.rn wendet das auf einen Namen an,
   * K.rnList auf eine Kommaliste. So zeigen auch Matches, Titel und Teams aus der Tabelle den neuen Namen.
   */
  K.rn = n => { const r = (K.store && K.store.state.renames) || {}; return Object.prototype.hasOwnProperty.call(r, n) ? r[n] : n; };
  K.rnList = s => (s ? K.splitNames(s).map(K.rn).join(', ') : s);
  /**
   * Verträge. Das Vertragsende steht als Monat da („April“, aus dem Klickdummy „April Jahr 5“). Ohne Jahr gilt:
   * ab dem Monat der Tabelle gezählt, frühere Monate liegen im nächsten Jahr. Ein Vertrag gilt bis einschließlich
   * seines Endmonats. Ein einmaliger Vertrag (onceContract) gilt bis zum ersten Auftritt in einer gelaufenen Show.
   *   w.contractEndAbs  fortlaufender Monat (Jahr × 12 + Monat) oder null     w.contracted  darf auftreten
   */
  function contracts(m) {
    const sheetAbs = K.absMonth(K.showDate(m.sheetCurrentShow));
    m.curDate = K.keyDate(m.currentShow); m.curAbs = K.absMonth(m.curDate); m.curYear = m.curDate.year;
    m.roster.forEach(w => {
      const p = K.parseMonth(w.contractEnd);
      if (p) {
        let abs = (p.year || K.YEAR) * 12 + p.month;
        if (p.year === null && abs < sheetAbs) abs += 12;
        w.contractEndAbs = abs; w.contractEnd = K.monthText(abs, m.curYear);
      } else w.contractEndAbs = null;
      w.contracted = !!w.onceContract || (w.contractEndAbs !== null && w.contractEndAbs >= m.curAbs);
    });
  }

  /** Titelträger und frühere Träger auf neue Namen umstellen (mehrere Träger mit „&“). */
  function renameTitleHolders(m) {
    const one = h => (h ? h.split(/\s*&\s*/).map(K.rn).join(' & ') : h);
    m.titlesAll.forEach(t => { t.holder = one(t.holder); t.former = (t.former || []).map(one); });
  }

  function buildRoster(sh, m) {
    const list = [], khwShows = K.khwShows();
    for (let r = 2; r <= sh.rows; r++) {
      const name = K.rn(sh.d(r, 1).trim());
      if (!name) continue;
      const g = c => sh.d(r, c).trim();
      const dash = x => (x === '-' ? '' : x);
      const w = {
        row: r, name, gender: g(2), status: g(3), alignment: dash(g(4)), show: dash(g(5)), promotion: g(6),
        tagTeam: g(8), mixedTeam: K.rn(g(9)), stable: g(10), injury: g(12), contractEnd: g(13), gimmick: g(14),
        notes: g(15), popularity: sh.n(r, 16), bond: sh.n(r, 17), personal: g(18), in2k: sh.b(r, 19),
        music: g(20), image: /^https?:\/\//.test(g(21)) ? g(21) : '', elo: sh.n(r, 22),
      };
      // Nur Shows der KHW zählen (TryOut, Lucky7, eigene Reihen). Shows anderer Ligen (z. B. BlackAce) fallen weg.
      if (w.show && !khwShows.includes(w.show)) w.show = '';
      splitInjury(w);
      w.titles = titlesOf(m.titles, w);
      w.storyline = '';   // wird nach den Storylines gesetzt (buildStorylines)
      list.push(w);
    }
    return list;
  }

  /* ───────────── Ranking (ELO) ───────────── */
  function buildRanking(m, sh) {
    // Statusbänder: Die Hintergrundfarbe der Position bestimmt den Status, den ein Wrestler dort haben soll.
    const bandCols = { 'TryOut|m': 3, 'TryOut|w': 14, 'Lucky7|m': 20, 'Lucky7|w': 31 };
    const out = {};
    SHOWS.forEach(show => {
      out[show] = {};
      ['m', 'w'].forEach(g => {
        const pool = m.roster.filter(w => w.gender.toLowerCase() === g && w.show.toLowerCase().includes(show.toLowerCase()) && w.elo !== null);
        const singles = pool.slice().sort((a, b) => b.elo - a.elo).map((w, i) => ({
          rank: i + 1, name: w.name, elo: w.elo, status: w.status,
          band: COLOR_STATUS[sh.bg(14 + i, bandCols[show + '|' + g])] || '',
        }));
        // Teams dieser Show und dieses Geschlechts: alle Mitglieder gehören dazu
        const inPool = new Set(pool.map(w => w.name));
        const teams = (m.teams || []).filter(t => t.members.length > 1 && t.members.every(n => inPool.has(n)))
          .map(t => { const ws = t.members.map(n => m.byName.get(n)); return { name: t.name, members: t.members.slice(), elo: ws.reduce((s, w) => s + w.elo, 0) / ws.length }; })
          .sort((a, b) => b.elo - a.elo).map((t, i) => Object.assign(t, { rank: i + 1 }));
        out[show][g] = { singles, teams };
      });
      // Alle Teams dieser Show aus der Liste „Teams und Stables“ (auch gemischte): die Show, in der die meisten Mitglieder sind
      const mainShow = t => { const c = {}; t.members.forEach(n => { const w = m.byName.get(n); if (w && w.show) c[w.show] = (c[w.show] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || ''; };
      out[show].teams = (m.teams || []).filter(t => mainShow(t) === show).map(t => {
        const ws = t.members.map(n => m.byName.get(n)).filter(Boolean);
        return { name: t.name, members: t.members.slice(), elo: ws.reduce((s, w) => s + (w.elo === null ? 1000 : w.elo), 0) / (ws.length || 1) };
      }).sort((a, b) => b.elo - a.elo).map((t, i) => Object.assign(t, { rank: i + 1 }));
    });
    return out;
  }

  /** ELO-Rechnung wie in Ranking.gs: K = 32. Liefert das neue Rating des Siegers und des Verlierers. */
  K.eloAfter = (rw, rl) => {
    const exp = 1 / (1 + Math.pow(10, (rl - rw) / 400));
    const delta = 32 * (1 - exp);
    return { winner: rw + delta, loser: rl - delta, delta };
  };

  /** Rating eines Namens: Einzelwrestler oder Durchschnitt eines Tag Teams. */
  K.ratingOf = (m, name) => {
    const w = m.byName.get(name);
    if (w) return w.elo === null ? 1000 : w.elo;
    const members = (K.teamMembers(m, name) || []).map(n => m.byName.get(n)).filter(Boolean);
    if (!members.length) return null;
    return members.reduce((s, x) => s + (x.elo === null ? 1000 : x.elo), 0) / members.length;
  };

  /** Auf- und Abstiege, die sich aus den Statusbändern ergeben (Vorschau von UpdateDropdown). */
  function statusChanges(m) {
    const out = [];
    SHOWS.forEach(show => ['m', 'w'].forEach(g => m.ranking[show][g].singles.forEach(e => {
      if (e.band && e.band !== e.status) {
        out.push({ name: e.name, from: e.status || '–', to: e.band, up: K.STATUS.indexOf(e.band) < (K.STATUS.indexOf(e.status) < 0 ? 99 : K.STATUS.indexOf(e.status)) });
      }
    })));
    return out;
  }

  /* ───────────── Card (alle Shows) ───────────── */
  // Raster wie in Card.gs: je 5 Shows 42 Zeilen; Weekly links (B–J), Weekly rechts (L–T), PPV über beide Hälften.
  K.showGeometry = n => {
    const cycle = Math.floor((n - 1) / 5), g = (n - 1) % 5;
    const rowStart = 5 + cycle * 42 + [0, 0, 1, 1, 2][g] * 14;
    return { rowStart, rowEnd: rowStart + 8, side: g === 4 ? 'PPV' : (g === 1 || g === 3) ? 'R' : 'L' };
  };

  K.MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  K.WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

  /*
   * Wöchentliche Showreihen (im Admin-Modus änderbar, gespeichert in K.store.state.series).
   *   label        angezeigter Name           weekday   0 = Montag … 6 = Sonntag
   *   startMonth/startWeek  erste Show der Reihe in diesem Jahr     firstNumber  Nummer der ersten Show (z. B. #208)
   *   deletedFrom  Reihe entfällt ab diesem Datum (Sortierschlüssel); gelaufene Shows bleiben
   * TryOut und Lucky7 hängen am Raster der Tabelle (Inhalte), eigene Reihen sind frei.
   */
  const SERIES_DEFAULT = {
    // order: Reihenfolge, wenn mehrere Shows auf denselben Tag fallen (kleiner = läuft zuerst)
    TryOut: { label: 'TryOut', weekday: 1, startMonth: 1, startWeek: 1, firstNumber: 1, order: 1 },   // erst ab Februar Woche 1
    Lucky7: { label: 'Lucky7', weekday: 2, startMonth: 0, startWeek: 1, firstNumber: 208, order: 2 },  // die erste Lucky7 dieses Jahres war #208
  };
  K.SHOW_ORDER = { TryOut: 1, Lucky7: 2, PPV: 3, Event: 4, Weekly: 5 };   // Standard je Art
  K.seriesConf = () => {
    const st = (K.store && K.store.state.series) || {};
    const out = {};
    Object.keys(SERIES_DEFAULT).forEach(k => { out[k] = Object.assign({ id: k, builtin: true }, SERIES_DEFAULT[k], st[k]); });
    Object.keys(st).filter(k => !SERIES_DEFAULT[k]).forEach(k => { out[k] = Object.assign({ id: k, custom: true, order: K.SHOW_ORDER.Weekly }, st[k]); });
    // Ältere Stände speicherten „gelöscht ab“ ohne Jahr (Jahr 4): auf den neuen Sortierschlüssel umrechnen
    Object.values(out).forEach(cf => { if (cf.deletedFrom && cf.deletedFrom < 40000) cf.deletedFrom += K.YEAR * 12 * 1000; });
    return out;
  };
  // Farben für eigene Showreihen (Auswahl beim Anlegen). Die erste ist das bisherige Lila.
  K.SERIES_COLORS = [['#c5a3f9', 'Lila'], ['#5ec8c0', 'Türkis'], ['#8fd07a', 'Grün'], ['#f28bc0', 'Pink'], ['#f2c14e', 'Senf'], ['#6fa8ff', 'Blau'], ['#ff9f6e', 'Koralle'], ['#b8b8b8', 'Grau']];
  /** style-Attribut, das die Farbe einer eigenen Reihe setzt (die Klassen show-Weekly / t-Weekly lesen --weekly). */
  K.seriesStyle = idOrShow => {
    const id = idOrShow && typeof idOrShow === 'object' ? idOrShow.series : idOrShow;
    const cf = id && K.seriesConf()[id];
    if (!cf || !cf.custom || !cf.color || !/^#[0-9a-f]{6}$/i.test(cf.color)) return '';
    const n = parseInt(cf.color.slice(1), 16);
    return ` style="--weekly:${cf.color};--weekly-soft:rgba(${n >> 16},${(n >> 8) & 255},${n & 255},.15)"`;
  };
  const beforeStart = (d, cf) => d.month * 4 + d.week < cf.startMonth * 4 + cf.startWeek;

  /**
   * Kalendertag einer Show aus dem Raster der Tabelle. Das KHW-Jahr beginnt an einem Montag, jeder Monat hat
   * genau 4 Wochen zu 7 Tagen. Wochentag von TryOut und Lucky7 aus den Showreihen, PPV sonntags.
   */
  K.showDate = n => {
    const month = Math.min(Math.ceil(n / 10) - 1, 11);
    const week = [1, 1, 2, 2, 2, 3, 3, 4, 4, 4][(n - 1) % 10];
    const type = K.showType(n), cf = K.seriesConf()[type];
    const dow = cf ? cf.weekday : 6;
    return { year: K.YEAR, month, week, dow, day: (week - 1) * 7 + dow + 1 };
  };

  // Jahr der Tabelle (Raster der Card). Danach geht es ohne Ende weiter: Jahr 5, 6 … entstehen aus den Showreihen.
  K.YEAR = 4;
  const SHOWS_PER_YEAR = 120;   // 12 Monate × 10 Shows

  /** Nummer eines PPVs aus dem Raster (Reihen bekommen ihre Nummer nach dem Sortieren, siehe buildShows). */
  K.showNumber = (n, type) => K.countShowsOfType(n, type);

  /** Datum eines Sonder-Events aus Monat (0–11), Tag (1–28) und Jahr. */
  const dateOf = (month, day, year) => ({ year: year || K.YEAR, month, week: Math.ceil(day / 7), dow: (day - 1) % 7, day });
  // Sortierschlüssel: Jahr und Monat, Tag, dann Reihenfolge am Tag (0–9; eigene Angabe der Show/Reihe, sonst Standard je Art).
  const dateKey = (d, type, order) => ((d.year || K.YEAR) * 12 + d.month) * 1000 + d.day * 10 + Math.max(0, Math.min(9, order !== undefined && order !== null && order !== '' ? Number(order) : (K.SHOW_ORDER[type] || 5)));
  K.dateKey = dateKey;
  /** Fortlaufender Monat (Jahr × 12 + Monat), z. B. für Vertragsenden und den Kalender. */
  K.absMonth = d => (d.year || K.YEAR) * 12 + d.month;
  /** „April“ im laufenden Jahr, sonst „Januar (Jahr 5)“. */
  K.monthText = (abs, curYear) => `${K.MONTHS[((abs % 12) + 12) % 12]}${Math.floor(abs / 12) !== curYear ? ` (Jahr ${Math.floor(abs / 12)})` : ''}`;
  /** Monatsangabe lesen: „April“, „April Jahr 5“, „April (Jahr 5)“, „April J5“. Ohne Jahr: null für das Jahr. */
  K.parseMonth = s => {
    const t = String(s || '').trim(); if (!t) return null;
    // Erstes Wort muss ein ganzer Monat sein oder seine Abkürzung (z. B. „Okt“), sonst ist es kein Monat („Janine“ nicht)
    const w = (/^([A-Za-zÄÖÜäöü]+)\.?/.exec(t) || [])[1];
    if (!w) return null;
    const i = K.MONTHS.findIndex(x => x.toLowerCase() === w.toLowerCase() || (w.length === 3 && x.toLowerCase().startsWith(w.toLowerCase())));
    if (i < 0) return null;
    if (!/^[A-Za-zÄÖÜäöü]+\.?\s*(\(?\s*(jahr|j)\s*\d+\s*\)?)?$/i.test(t)) return null;   // nur „Monat“ mit optionalem Jahr
    const y = /(?:jahr|j)\s*(\d+)/i.exec(t);
    return { month: i, year: y ? Number(y[1]) : null };
  };
  /** Datum zu einem Show-Schlüssel ohne die Shows zu kennen (Zeiger „aktuelle Show“): Nummer im Raster oder „Reihe:Jahr-Monat-Woche“. */
  K.keyDate = k => {
    if (typeof k === 'number' || /^\d+$/.test(String(k))) return K.showDate(Number(k));
    const x = /:(\d+)-(\d+)-(\d+)$/.exec(String(k));
    return x ? { year: Number(x[1]), month: Number(x[2]), week: Number(x[3]), dow: 0, day: (Number(x[3]) - 1) * 7 + 1 } : K.showDate(1);
  };

  /** Ein Match aus dem Klickdummy in die Form bringen, die alle Ansichten kennen. */
  const fromStore = (x, i) => ({
    no: i + 1, type: x.type || '', winner: x.winner || '', loser: x.loser || '', extra: x.extra || '', storyline: x.storyline || '',
    stars: x.stars === '' || x.stars === null || x.stars === undefined ? null : Number(x.stars), bet: !!x.bet, notes: x.notes || '',
    bonus: !!x.bonus, cellNotes: [], marks: x.marks || {}, idx: i, promo: /promo|segment/i.test(x.type || ''),
    title: x.title || '',   // Titelmatch: Name des Titels, der Sieger bekommt ihn beim Beenden
    wonPicked: !!x.wonPicked,   // Sieger wurde in der Showliste aus den Teilnehmern gewählt (lässt sich dort zurücksetzen)
  });

  /**
   * Alle Shows des Jahres nach festem Plan: TryOut jeden Dienstag (ab Februar), Lucky7 jeden Mittwoch, PPV am Sonntag
   * in Woche 2 und 4. Inhalte kommen aus der Tabelle (Card) oder, wenn im Klickdummy bearbeitet, aus dem Speicher.
   * Dazu kommen Sonder-Events. Sortiert nach Datum.
   */
  function buildShows(sh, m) {
    const shows = [];
    const st = K.store ? K.store.state : { shows: {}, extras: [] };
    const series = K.seriesConf();
    const neutral = new Set(['', '#ffffff', '#f3f3f3', '#efefef', '#434343', '#cccccc', '#000000']);
    // Gelaufen im Raster (Jahr 4) ist alles vor der aktuellen Show; steht der Zeiger schon in einem späteren Jahr, alles.
    const gridEnded = n => (typeof m.currentShow === 'number' ? n < m.currentShow : true);
    for (let n = 1; n <= SHOWS_PER_YEAR; n++) {
      const geo = K.showGeometry(n);
      const inSheet = geo.rowEnd <= sh.rows;
      const halves = !inSheet ? [] : geo.side === 'PPV' ? ['L', 'R'] : [geo.side];
      const matches = [];
      halves.forEach(half => {
        const o = half === 'R' ? 12 : 2;
        for (let r = geo.rowStart; r <= geo.rowEnd; r++) {
          const t = i => sh.d(r, o + i).trim();
          const mt = {
            row: r, half, no: num(sh.v(r, o)), type: t(1), winner: t(2), loser: t(3), extra: t(4), storyline: t(5).replace(/\s*\n\s*/g, ' '),
            stars: num(sh.v(r, o + 6)), bet: sh.b(r, o + 7), notes: t(8),
            bonus: sh.bg(r, o + 6) === '#fff9c4', cellNotes: [], marks: {},
          };
          if (mt.no === null && !mt.type && !mt.winner && !mt.loser && !mt.extra && !mt.storyline && !mt.notes) continue;
          for (let i = 0; i <= 8; i++) {
            const nt = sh.note(r, o + i); if (nt) mt.cellNotes.push(nt);
            const bg = sh.bg(r, o + i);
            if (i >= 2 && i <= 4 && !neutral.has(bg)) mt.marks[['', '', 'winner', 'loser', 'extra'][i]] = bg;
          }
          matches.push(mt);
        }
      });
      const labels = [];
      if (inSheet) {
        const from = geo.side === 'R' ? 12 : 2, to = geo.side === 'L' ? 10 : 20;
        for (let c = from; c <= to; c++) { const t = sh.d(geo.rowStart - 2, c).trim().replace(/\s*\n\s*/g, ' '); if (t && !labels.includes(t)) labels.push(t); }
      }
      const type = K.showType(n);
      const date = K.showDate(n);
      const ownN = st.shows[n];
      if (ownN && ownN.deleted) continue;   // gelöschter PPV
      const cf = series[type];
      if (cf) {
        if (beforeStart(date, cf) && !matches.length) continue;   // Reihe startet später (TryOut erst im Februar)
        // Reihe gelöscht: künftige Termine entfallen, gelaufene und abgerechnete bleiben
        if (cf.deletedFrom && dateKey(date, type) >= cf.deletedFrom && !gridEnded(n) && !(ownN && ownN.ended)) continue;
      }
      // PPVs haben keine festen Termine mehr: leere Plätze aus dem alten Raster entfallen, neue PPVs legt man selbst an.
      const hasSheetName = labels.some(l => l !== 'TryOut' && l !== 'Lucky7' && l !== 'PPV' && !/Woche\s*\d/.test(l));
      if (type === 'PPV' && !matches.length && !hasSheetName && !(ownN && ownN.matches && ownN.matches.length)) continue;
      // Ein PPV ist eine Show mit doppelter Breite: beide Hälften bilden eine Liste. Sortiert wird nach Nummer, Zeilen ohne Nummer bleiben hinten.
      matches.forEach((mt, i) => { mt.idx = i; mt.promo = /promo/i.test(mt.type) || (mt.no !== null && mt.no % 1 !== 0); });
      matches.sort((a, b) => (a.no === null) - (b.no === null) || (a.no || 0) - (b.no || 0) || a.idx - b.idx);
      const own = st.shows[n];
      const sheetName = labels.find(l => l !== 'TryOut' && l !== 'Lucky7' && !/Woche\s*\d/.test(l)) || '';
      shows.push(finish({
        key: n, no: n, type, side: geo.side, geo, label: labels.filter(l => l !== type).join(' · '),
        matches: own && own.matches ? own.matches.map(fromStore) : matches,
        name: own && own.name !== undefined ? own.name : sheetName,
        venue: Object.assign({}, K.rules.show.DEFAULT_VENUE, own && own.venue),
        // Gelaufen ist alles vor der aktuellen Show (Admin kann das Datum verschieben) und alles, was abgerechnet wurde.
        date, ended: gridEnded(n) || !!(own && own.ended), result: own && own.result,
        month: K.monthLabel(n), typeIndex: cf ? null : K.showNumber(n, type), series: cf ? type : null, seriesLabel: cf ? cf.label : '', edited: !!own,
      }));
    }
    // Wöchentliche Termine einer Reihe für ein Jahr. Eigene Reihen in Jahr 4 behalten ihren alten Schlüssel „Reihe:Monat-Woche“,
    // alles ab Jahr 5 heißt „Reihe:Jahr-Monat-Woche“ (TryOut und Lucky7 haben ab dort kein Raster der Tabelle mehr).
    const weekly = (cf, year) => {
      for (let month = 0; month < 12; month++) for (let week = 1; week <= 4; week++) {
        const date = { year, month, week, dow: cf.weekday, day: (week - 1) * 7 + cf.weekday + 1 };
        const key = year === K.YEAR ? `${cf.id}:${month}-${week}` : `${cf.id}:${year}-${month}-${week}`, own = st.shows[key] || {};
        if ((year === K.YEAR && beforeStart(date, cf)) || own.deleted) continue;   // Startwoche gilt im Jahr der Tabelle
        if (cf.deletedFrom && dateKey(date, 'Weekly') >= cf.deletedFrom && !own.ended) continue;
        shows.push(finish({
          key, no: null, type: cf.custom ? 'Weekly' : cf.id, series: cf.id, seriesLabel: cf.label, side: 'L', name: own.name || '', label: '',
          matches: (own.matches || []).map(fromStore), venue: Object.assign({}, K.rules.show.DEFAULT_VENUE, own.venue),
          date, ended: !!own.ended, result: own.result, month: K.MONTHS[month], typeIndex: null, edited: !!st.shows[key],
        }));
      }
    };
    // Eigene wöchentliche Reihen (Admin) im Jahr der Tabelle
    Object.values(series).filter(cf => cf.custom).forEach(cf => weekly(cf, K.YEAR));
    // Folgejahre ohne Ende: immer bis ein Jahr nach dem Jahr der aktuellen Show (und so weit, wie Shows angelegt sind)
    const yearOfKey = k => { const x = /:(\d+)-\d+-\d+$/.exec(String(k)); return x ? Number(x[1]) : K.YEAR; };
    const lastYear = Math.max(K.YEAR + 1, K.keyDate(m.currentShow).year + 1, ...st.extras.map(x => x.year || K.YEAR), ...Object.keys(st.shows).map(yearOfKey));
    for (let y = K.YEAR + 1; y <= lastYear; y++) Object.values(series).forEach(cf => weekly(cf, y));
    // Sonder-Events
    st.extras.forEach(x => {
      const own = st.shows[x.key] || {};
      shows.push(finish({
        // Selbst angelegte Shows: PPV (wird wie ein PPV abgerechnet) oder Event (wie eine normale Show)
        key: x.key, no: null, type: x.type === 'PPV' ? 'PPV' : 'Event', side: 'PPV', name: own.name !== undefined ? own.name : x.name, label: '',
        matches: (own.matches || []).map(fromStore), venue: Object.assign({}, K.rules.show.DEFAULT_VENUE, own.venue),
        date: dateOf(x.month, x.day, x.year), ended: !!own.ended, result: own.result, month: K.MONTHS[x.month], typeIndex: null, edited: true, extra: true, order: x.order,
      }));
    });
    shows.sort((a, b) => a.sortKey - b.sortKey);
    // Nummern je Reihe in Datumsreihenfolge, beginnend mit der eingestellten ersten Nummer
    const counter = {};
    shows.forEach(s => { if (!s.series) return; const cf = series[s.series]; counter[s.series] = (counter[s.series] || 0) + 1; s.typeIndex = cf.firstNumber + counter[s.series] - 1; });
    return shows;
  }
  function finish(s) {
    const own = K.store ? K.store.state.shows[s.key] : null;
    s.info = (own && own.info) || '';   // allgemeine Info-Notiz zur Show
    s.hasContent = s.matches.length > 0;
    s.stars = s.matches.reduce((t, x) => t + (x.stars || 0), 0);
    // Reihenfolge am Tag: eigene Angabe der Show (Admin), sonst die der Reihe, sonst Standard je Art
    const cf = s.series ? K.seriesConf()[s.series] : null;
    s.order = own && own.order !== undefined && own.order !== null ? own.order : s.order !== undefined ? s.order : cf ? cf.order : undefined;
    s.sortKey = dateKey(s.date, s.type, s.order);
    return s;
  }

  // Gewinner, Verlierer und Teilnehmer dürfen mehrere Namen enthalten, mit Komma getrennt (wie in der Tabelle).
  K.participants = mt => [...new Set([...K.splitNames(mt.winner), ...K.splitNames(mt.loser), ...K.splitNames(mt.extra)])];
  K.winners = mt => K.splitNames(mt.winner);
  K.losers = mt => K.splitNames(mt.loser);

  /** Bilanz eines Wrestlers oder Teams über alle gelaufenen Shows. */
  K.record = (m, name) => {
    const w = m.byName.get(name);
    const aliases = new Set([name, ...((w && w.teams) || [])]);
    const rows = [];
    m.shows.filter(s => s.ended).forEach(s => s.matches.forEach(mt => {   // nur gelaufene Shows, geplante zählen nicht
      const ps = K.participants(mt);
      if (!ps.some(p => aliases.has(p))) return;
      rows.push({ show: s, match: mt, result: K.winners(mt).some(x => aliases.has(x)) ? 'W' : K.losers(mt).some(x => aliases.has(x)) ? 'L' : '–' });
    }));
    return { rows, wins: rows.filter(r => r.result === 'W').length, losses: rows.filter(r => r.result === 'L').length };
  };

  /** Wettquoten wie in Wetten.gs: Gewicht = 1 / Rang, gemeinsame Rangliste aller Teilnehmer nötig. */
  K.betOdds = (m, mt) => {
    const players = K.participants(mt);
    if (players.length < 2) return null;
    const lists = [];
    SHOWS.forEach(show => {
      const r = m.ranking[show];
      lists.push([show + ' · Männer', r.m.singles], [show + ' · Frauen', r.w.singles], [show + ' · Teams', r.teams]);
    });
    for (const [label, list] of lists) {
      const top = list.slice(0, 40);
      const ranks = players.map(p => { const e = top.find(x => x.name === p); return e ? e.rank : null; });
      if (ranks.some(x => x === null)) continue;
      const weights = ranks.map(x => 1 / x), sum = weights.reduce((a, b) => a + b, 0);
      return { list: label, rows: players.map((p, i) => ({ name: p, rank: ranks[i], quote: Math.round(weights[i] / sum * 1000) / 10 })) };
    }
    return { list: null, rows: players.map(p => ({ name: p, rank: null, quote: null })) };
  };

  /* ───────────── Finanzen ───────────── */
  function buildFinance(sh) {
    const f = {};
    // Kontobewegungen: A1:E12, spaltenweise gefüllt (so schreibt die Tabelle neue Buchungen)
    f.ledger = [];
    for (let c = 1; c <= 5; c++) for (let r = 1; r <= 12; r++) { const v = sh.n(r, c); if (v !== null) f.ledger.push(v); }
    f.balance = f.ledger.reduce((a, b) => a + b, 0);
    f.ledgerFree = 60 - f.ledger.length;

    const n = a => sh.n(a) || 0;
    const venue = sh.d('A27').trim();
    const L = { venue, ppv: sh.b('B27'), ads: sh.b('C27'), sponsoring: sh.b('D27'), capacity: (K.conf.get('halls')[venue] || K.VENUES[venue] || {}).capacity || null };

    L.tickets = ['A', 'B', 'C'].map((col, i) => {
      const price = n(col + '31'), sold = n(col + '32'), byAds = n(col + '33'), byTier = n(col + '34');
      return { label: 'Preisklasse ' + (i + 1), price, sold, byAds, byTier, revenue: price * (sold + byAds + byTier) };
    });
    L.ticketRevenue = L.tickets.reduce((s, t) => s + t.revenue, 0);
    L.rent = n('C38');
    L.ticketProfit = L.ticketRevenue - L.rent;

    L.stream = { price: n('G30'), count: n('G31'), byAds: n('G32'), byTier: n('G33'), production: n('G36'), internet: n('G37') };
    L.stream.revenue = L.stream.price * (L.stream.count + L.stream.byAds + L.stream.byTier);
    L.stream.cost = L.stream.production + L.stream.internet;
    L.streamProfit = L.stream.revenue - L.stream.cost;

    L.merch = ['Poster', 'T-Shirts, Caps und Masken', 'Autogramme und Unikate', 'Autogramme und Unikate (Stufenbonus)']
      .map((label, i) => ({ label, onsite: n('J' + (31 + i)), online: n('K' + (31 + i)) }));
    L.merchRevenue = L.merch.reduce((s, x) => s + x.onsite + x.online, 0);
    L.staffCost = n('K38');
    L.merchProfit = L.merchRevenue - L.staffCost;

    L.sponsor = { base: n('C46'), big: n('C47') };
    L.sponsorRevenue = L.sponsor.base + L.sponsor.big;
    L.adCosts = [['Social Media und Influencer-Marketing', n('C50')], ['Online-Anzeigen', n('C51')], ['Flyer und Plakate', n('C52')]];
    const adSum = L.adCosts.reduce((s, x) => s + x[1], 0);
    L.adDiscount = L.ads ? adSum * 0.2 : 0;
    L.adTotal = adSum - L.adDiscount;
    L.sponsorProfit = L.sponsorRevenue - L.adTotal;

    L.vip = ['J', 'K'].map((col, i) => ({ label: 'Preisklasse ' + (i + 1), price: n(col + '47'), sold: n(col + '48') }));
    L.vipRevenue = L.vip.reduce((s, x) => s + x.price * x.sold, 0);
    L.insurance = n('K52');
    L.vipProfit = L.vipRevenue - L.insurance;

    L.visitors = L.tickets.reduce((s, t) => s + t.sold, 0) + L.vip.reduce((s, x) => s + x.sold, 0);

    // Wette der letzten Show (wird von Wetten.gs geschrieben)
    f.bets = [];
    for (let r = 17; r <= 25; r++) { const name = sh.d(r, 1).trim(); if (name) f.bets.push({ name, rank: sh.n(r, 2), quote: sh.n(r, 3), gain: sh.n(r, 4) }); }
    L.betGain = f.bets.length ? (f.bets[0].gain || 0) : 0;   // gezählt wird die erste Zeile = Gewinner

    L.total = L.ticketProfit + L.streamProfit + L.merchProfit + L.sponsorProfit + L.vipProfit + L.betGain;
    L.sheetTotal = sh.n('E27');
    f.last = L;

    // Follower und Stufen
    f.followers = sh.n('Q3'); f.followerDelta = sh.n('P3');
    const tier = (label, rows) => {
      const steps = rows.map(r => sh.n('Q' + r)).filter(x => x !== null);
      const level = steps.filter(x => f.followers >= x).length;
      return { label, steps, level, next: steps[level] || null };
    };
    f.tiers = [tier('Ticketverkauf / Produktionskosten', [5, 6, 7, 8]), tier('Streaming / Wrestler', [12, 13, 14, 15]),
      tier('Merch / Personal', [19, 20, 21, 22]), tier('Sponsoring / Werbung', [26, 27, 28, 29])];

    const list = (colName, colPrice, r1, r2) => {
      const out = [];
      for (let r = r1; r <= r2; r++) { const name = sh.d(colName + r).trim(); const p = sh.n(colPrice + r); if (name && p !== null) out.push({ name, price: p, row: r }); }
      return out;
    };
    // Store: Artikel aus der Tabelle ohne die gestrichenen. Rabattfähig ist, was dort eine Rabatt-Formel hat (I2).
    const STORE_REMOVED = ['zurück ins Theater', 'Tag Team Titel (M)', 'Tag Team Titel (W)', 'Trios Titel', 'Hardcore Titel', 'Iron Man Titel'];
    // Manche Preise hängen in der Tabelle vom Merch der letzten Show ab, z. B. =K33-K31*12
    // (Poster vor Ort × 12 − Autogramme vor Ort). Das wird als dyn = { merch, factor } übernommen und nach jeder Show neu gerechnet.
    const dynOf = formula => { const x = /K3([12])\s*\*\s*([\d,.]+)/.exec(formula || ''); return x ? { merch: Number(x[1]) - 1, factor: Number(x[2].replace(',', '.')) } : null; };
    f.storeSheet = list('G', 'I', 3, 19).filter(x => !STORE_REMOVED.includes(x.name)).map(x => Object.assign(x, { discountable: /I2/.test(sh.f('I' + x.row) || ''), dyn: dynOf(sh.f('I' + x.row)) }));
    // Im Regelwerk gepflegte Artikel ersetzen die der Tabelle (Preise intern negativ = Ausgabe).
    const own = K.conf.get('store');
    f.store = own ? own.map(x => ({ name: x.name, price: -Math.abs(Number(x.cost) || 0), discountable: !!x.discountable, dyn: x.dyn || null })) : f.storeSheet.map(x => Object.assign({}, x));
    f.storeDiscount = sh.d('I2');
    f.venues = list('K', 'M', 3, 11); f.venueDiscount = sh.d('M2');
    // KHW+ und PPV-Preis: aus dem Regelwerk, sonst aus der Tabelle.
    f.pricesSheet = { abo: sh.n('U3'), ppv: sh.n('U4') };
    const pc = K.conf.get('finance').prices || {};
    f.prices = { abo: pc.abo !== null && pc.abo !== undefined ? pc.abo : f.pricesSheet.abo, ppv: pc.ppv !== null && pc.ppv !== undefined ? pc.ppv : f.pricesSheet.ppv };
    f.stars = { lastShow: sh.n('S5'), followerFactor: sh.n('T5') };
    const names = (r1, r2) => { const o = []; for (let r = r1; r <= r2; r++) { const t = sh.d('S' + r).trim(); if (t && !t.startsWith('#')) o.push(t); } return o; };
    f.adClause = names(8, 16); f.medicalClause = names(19, 30);
    return f;
  }

  /** Preise, die vom Merch der letzten Show abhängen: Merch-Artikel vor Ort × Faktor − Autogramme vor Ort (wie in der Tabelle). */
  function storePrices(f) {
    const mr = f.last && f.last.merch;
    if (!mr) return;
    const onsite = i => (mr[i] && Number(mr[i].onsite)) || 0;
    f.store.forEach(x => {
      if (!x.dyn) return;
      const v = onsite(2) - onsite(x.dyn.merch) * x.dyn.factor;
      if (Number.isFinite(v)) x.price = Math.round(v * 100) / 100;
    });
  }

  /* ───────────── Mitarbeiter ───────────── */
  const STAFF = [
    { id: 1, name: 'F15', face: 'H19', money: 'H30', skill: 'H32', end: 'H34', seed: 'I35', prod: 'H36', cd: 'H37', hours: 'I37', adv: 'H38', col: 'H' },
    { id: 2, name: 'Z15', face: 'AB19', money: 'AB30', skill: 'AB32', end: 'AB34', seed: 'AC35', prod: 'AB36', cd: 'AB37', hours: 'AC37', adv: 'AB38', col: 'AB' },
    { id: 3, name: 'AT15', face: 'AV19', money: 'AV30', skill: 'AV32', end: 'AV34', seed: 'AW35', prod: 'AV36', cd: 'AV37', hours: 'AW37', adv: 'AV38', col: 'AV' },
    { id: 4, name: 'BN15', face: 'BP19', money: 'BP30', skill: 'BP32', end: 'BP34', seed: 'BQ35', prod: 'BP36', cd: 'BP37', hours: 'BQ37', adv: 'BP38', col: 'BP' },
    { id: 5, name: 'CH15', face: 'CJ19', money: 'CJ30', skill: 'CJ32', end: 'CJ34', seed: 'CK35', prod: 'CJ36', cd: 'CJ37', hours: 'CK37', adv: 'CJ38', col: 'CJ' },
    { id: 6, name: 'DB15', face: 'DD19', money: 'DD30', skill: 'DD32', end: 'DD34', seed: 'DE35', prod: 'DD36', cd: 'DD37', hours: 'DE37', adv: 'DD38', col: 'DD' },
  ];

  function buildStaff(sh) {
    const st = { stars: sh.n('B5'), forge: { timer: sh.d('D2'), timerTarget: K.countdownTarget(sh.f('D2')), advantage: sh.d('J2').trim(), ruleA: sh.d('D4'), ruleB: sh.d('J4') } };
    st.slots = STAFF.map(cfg => {
      const face = sh.d(cfg.face), name = sh.d(cfg.name).trim();
      const slot = { id: cfg.id, inventory: [] };
      const c = K.colToNum(cfg.col);
      for (let r = 45; r <= 148; r++) { const t = sh.d(r, c).trim(); if (t) slot.inventory.push(t.replace(/\s*\n\s*/g, ' · ')); }
      if (face.includes('🔒')) { slot.state = 'locked'; slot.text = face.replace('🔒', '').trim().replace(/\n/g, ' · '); return slot; }
      const cdF = sh.f(cfg.cd);
      if (name === 'Cooldown' || (!name && cdF)) {
        slot.state = 'cooldown'; slot.target = K.countdownTarget(cdF); slot.text = sh.d(cfg.cd); return slot;
      }
      if (!name) { slot.state = 'empty'; return slot; }
      const endRaw = sh.v(cfg.seed);
      Object.assign(slot, {
        state: 'employee', name, money: sh.n(cfg.money), skill: sh.n(cfg.skill),
        end: endRaw ? new Date(endRaw) : null, hired: !!sh.f(cfg.end),
        hours: sh.n(cfg.hours), prodTarget: K.countdownTarget(sh.f(cfg.prod)), prodText: sh.d(cfg.prod), advantage: sh.d(cfg.adv).trim(),
      });
      return slot;
    });
    return st;
  }

  /* ───────────── Lager (Requisiten und Ringausstattung) ───────────── */
  // Feste Kategorien (mehr gibt es nicht). Bilder je Kategorie im Regelwerk (Lager), sonst der Platzhalter.
  K.STORAGE_CATS = ['Apron', 'Bodenmatte', 'Pfosten', 'Ringabsperrung', 'Ringboden', 'Ringseile', 'Treppen', 'Requisite'];
  K.STORAGE_IMG = '../img/lager/Platzhalter.svg';
  K.storageImage = cat => ((((K.conf.get('storage') || {}).images) || {})[cat]) || K.STORAGE_IMG;
  function buildStorage(sh) {
    const st = { items: [], notes: [], vault: [], upgrades: [] };
    if (!sh) return st;
    for (let r = 21; r <= sh.rows; r++) {
      const name = sh.d(r, 9).trim().replace(/\s*\n\s*/g, ' ');
      if (!name) continue;
      // Farbangabe im Namen, z. B. "Apron - Blau (7/16/58)"
      const rgb = /\((\d{1,3})\/(\d{1,3})\/(\d{1,3})\)/.exec(name);
      const parts = name.replace(/\s*\(\d{1,3}\/\d{1,3}\/\d{1,3}\)/, '').split(/\s+-\s+/);
      const known = K.STORAGE_CATS.filter(k => k !== 'Requisite');   // Säule gehört zu den Requisiten
      const category = known.find(k => name.startsWith(k)) || 'Requisite';
      st.items.push({
        no: sh.n(r, 8), name, count: sh.n(r, 14) || 0, category,
        label: parts.length > 1 ? parts.slice(1).join(' - ') : name, color: rgb ? `rgb(${rgb[1]},${rgb[2]},${rgb[3]})` : '',
      });
    }
    const text = (r, c) => sh.d(r, c).trim().replace(/\s*\n\s*/g, ' ');
    for (let r = 22; r <= 39; r++) { const t = text(r, 17); if (t) st.notes.push(t); }
    // Tresor: Einträge aus der Tabelle (Schlüssel = Text) und selbst hinzugefügte (Schlüssel = id); Platz unbegrenzt
    for (let r = 66; r <= sh.rows; r++) { const t = text(r, 17); if (t) st.vault.push({ key: 't:' + t, text: t }); }
    for (let r = 44; r <= 60; r++) {
      const m = /^(\d+)\s*Plätze/.exec(text(r, 16));
      if (m) st.upgrades.push({ slots: Number(m[1]), price: sh.n(r, 18) });
    }
    const cap = /(\d+)/.exec(text(40, 18));
    st.capacity = cap ? Number(cap[1]) : null;
    // Gekaufter Ausbau, neu eingelagerte und (Admin) entfernte Gegenstände aus dem gemeinsamen Stand
    const own = K.store && K.store.state.storage;
    if (own && own.capacity) st.capacity = own.capacity;
    if (own && Array.isArray(own.removed)) st.items = st.items.filter(i => !own.removed.includes(i.no));
    if (own && Array.isArray(own.vaultRemoved)) st.vault = st.vault.filter(v => !own.vaultRemoved.includes(v.key));
    ((own && own.vaultAdded) || []).forEach(v => st.vault.push({ key: v.id, text: v.text, own: true, image: v.image || '' }));
    ((own && own.added) || []).forEach(a => {
      const rgb = Array.isArray(a.rgb) && a.rgb.length === 3 ? a.rgb : null;
      st.items.push({ no: a.id, own: true, name: `${a.category === 'Requisite' ? '' : a.category + ' - '}${a.label}${rgb ? ` (${rgb.join('/')})` : ''}`,
        count: a.count === undefined ? 1 : a.count, category: a.category, label: a.label, color: rgb ? `rgb(${rgb.join(',')})` : '', image: a.image || '' });
    });
    st.used = st.items.filter(i => i.count >= 1).length;   // ein Platz je Gegenstandsart, unabhängig von der Stückzahl
    return st;
  }

  /* ───────────── Fertigkeiten (Würfelproben) ───────────── */
  function skillRows(sh, r1, r2, cChk, cName, cLvl, cRoll, cRoll2) {
    const out = [];
    for (let r = r1; r <= r2; r++) {
      const name = sh.d(r, cName).trim(); if (!name) continue;
      // Stufe aus dem Regelwerk (Reiter „Fertigkeiten“), sonst aus der Tabelle
      const own = ((K.conf && K.conf.get('skills')) || {}).levels || {};
      const sheetLvl = sh.n(r, cLvl), lvl = typeof own[name] === 'number' ? own[name] : sheetLvl, roll = sh.n(r, cRoll);
      const row = { name, picked: sh.b(r, cChk), lvl, sheetLvl, roll, result: K.skillResult(lvl, roll) };
      if (cRoll2) { row.roll2 = sh.n(r, cRoll2); row.result2 = K.skillResult(lvl, row.roll2); }
      out.push(row);
    }
    return out;
  }
  const C = K.colToNum;

  /* ───────────── Vertrag ───────────── */
  function buildContract(sh) {
    const pop = sh.n('M44'), bond = sh.n('M46');
    return {
      person: sh.d('D20').trim(), duration: sh.d('E29').trim(), show: sh.d('H29').trim(),
      price: sh.n('E32'), priceText: sh.d('E32'), counterPrice: sh.n('E39'),
      demands: [sh.d('D34'), sh.d('D35')].map(s => s.trim()).filter(Boolean), offer: sh.d('D41').trim(),
      popularity: pop, popularityLabel: K.popularityLabel(pop), bond, bondLabel: K.bondLabel(bond),
      proposal: sh.d('P19').trim(), answer: sh.d('P34').trim(),
      skills: skillRows(sh, 7, 16, C('T'), C('U'), C('V'), C('X')), rules: ['L12', 'L13', 'L14'].map(a => sh.d(a).trim()).filter(Boolean),
      // Forderungen und Zugeständnisse (C53:C180, D53:D78) stehen nicht hier, sondern im IDB („Vertrag: …“).
    };
  }

  /* ───────────── Talentboard ───────────── */
  function buildTalents(sh) {
    const row = r => ({
      name: sh.d(r, 2).trim(), gender: sh.d(r, 3), origin: sh.d(r, 4), style: sh.d(r, 5), alignment: sh.d(r, 6),
      gimmick: sh.d(r, 7), special: sh.d(r, 8), flag: sh.note(r, 8), popularity: sh.n(r, 9), cost: sh.n(r, 10),
    });
    const t = { search: sh.d('B3').trim(), gender: sh.d('J3').trim(), alignment: sh.d('J4').trim(), list: [], booked: [] };
    for (let r = 7; r <= 10; r++) { const x = row(r); if (x.name) t.list.push(x); }
    for (let r = 13; r <= sh.rows; r++) { const x = row(r); if (x.name) t.booked.push(x); }
    return t;
  }

  /* ───────────── Interaktionen ───────────── */
  function buildInteraction(sh) {
    const turns = [];
    const add = (who, a) => { const t = sh.d(a).trim(); if (t) turns.push({ who, text: t }); };
    add('gm', 'C4');
    [['C20', 'E20', 'G20', 'I20'], ['C24', 'E24', 'G24', 'I24'], ['C28', 'E28', 'G28', 'I28']]
      .forEach(row => row.forEach((a, i) => add(i % 2 ? 'gm' : 'me', a)));
    const bond = sh.n('C48');
    return {
      metric: sh.d('A8').trim(), aspect: sh.b('A13'), skills: skillRows(sh, 4, 13, C('K'), C('L'), C('M'), C('O'), C('Q')),
      contacts: String(sh.note('L15') || '').split('\n').map(s => s.trim()).filter(Boolean), channel: sh.d('L15').trim(),
      story: sh.d('L20').trim(), turns,
      dice: { message: sh.n('A50'), fate: sh.n('A51'), value: sh.n('A53') },
      event: { kind: sh.d('B50').trim(), from: sh.d('C50').trim(), topic: sh.d('E50').trim(), reward: sh.d('G50').trim(), topic2: sh.d('E51').trim(), reward2: sh.d('G51').trim() },
      person: { name: sh.d('C51').trim(), bond, bondLabel: K.bondLabel(bond), gimmick: sh.d('E49').trim(), personal: sh.d('G49').trim() },
    };
  }

  /* ───────────── HK Casino Bar ───────────── */
  function buildBar(sh) {
    const guests = [];
    for (let r = 5; r <= 10; r++) { const t = sh.d(r, 12).trim(); if (t && !/^\s*(und)?\s*-/.test(t)) guests.push({ text: t, show: sh.d(r, 13).trim(), picked: sh.b(r, 11) }); }
    const turns = [];
    ['B30', 'D30', 'F30', 'H30', 'J30', 'L30'].forEach((a, i) => { const t = sh.d(a).trim(); if (t) turns.push({ who: i % 2 ? 'gm' : 'me', text: t }); });
    return { guests, skills: skillRows(sh, 14, 23, C('K'), C('L'), C('M'), C('O')), mood: sh.d('B50').trim(), turns, mode: sh.d('F16').trim() };
  }
})(window.KHW);
