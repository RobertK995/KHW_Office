// KHW Manager – Shows (Klickdummy).
// Links alle Shows des Jahres zum Durchscrollen (TryOut jeden Dienstag ab Februar, Lucky7 jeden Mittwoch, PPV Sonntag
// in Woche 2 und 4, dazu Sonder-Events). Rechts zwei Monate Kalender (blättert beim Scrollen mit, aufklappbar aufs Jahr),
// darunter die nächsten PPVs und die aktuellen Storylines. „Show bearbeiten“ öffnet die Matches nah an der Tabelle.
// Inhalte sind gemeinsame Daten (beide Spieler sehen dieselbe Show), Auswahl und offener Editor gelten je Tab.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc, eur, fmt } = K;
  const ui = () => K.ui;
  const SR = () => K.rules.show;
  const DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  /* ───────────── Speicher ───────────── */
  const plain = mt => ({ type: mt.type || '', winner: mt.winner || '', loser: mt.loser || '', extra: mt.extra || '', storyline: mt.storyline || '',
    stars: mt.stars === null || mt.stars === undefined ? '' : mt.stars, bet: !!mt.bet, notes: [mt.notes, ...(mt.cellNotes || [])].filter(Boolean).join('\n'), marks: mt.marks || {},
    title: mt.title || '', bonus: !!mt.bonus });
  /** Beim ersten Bearbeiten wird der Stand der Tabelle in den Speicher übernommen. */
  function ensureOwn(m, key) {
    if (K.store.state.shows[key] && K.store.state.shows[key].matches) return;
    const s = m.show(key);
    K.store.update(st => { st.shows[key] = Object.assign({}, st.shows[key], { matches: s.matches.map(plain), venue: Object.assign({}, s.venue), name: s.name }); });
  }
  const own = key => K.store.state.shows[key];
  const edit = (key, fn) => K.store.update(st => fn(st.shows[key]));

  /* ───────────── Bausteine ───────────── */
  const starTxt = x => x === null || x === undefined || x === '' ? '' : `${fmt(x, x % 1 ? 1 : 0)} ★`;
  const venueTxt = v => [v.stadt, v.land].filter(Boolean).join(', ') + (v.halle ? ' · ' + v.halle : '');
  const shortDate = s => `${K.MONTHS[s.date.month].slice(0, 3)} W${s.date.week}`;

  /** Quote und möglicher Gewinn eines Wett-Matches (Planung). */
  function betInfo(m, mt) {
    const o = K.betOdds(m, mt);
    if (!o) return { text: 'Zu wenige Teilnehmer für eine Quote.' };
    if (!o.list) return { text: 'Die Teilnehmer stehen nicht in einer gemeinsamen Rangliste.' };
    return { list: o.list, rows: o.rows.map(r => Object.assign({}, r, { range: SR().betRange(r.quote) })) };
  }

  /* ───────────── Würfel im Editor: passende Paarung vorschlagen ─────────────
     Kandidaten: Wrestler der Show (bei PPV/Event alle KHW-Shows), mit Vertrag, nicht verletzt, nicht „nicht verfügbar“,
     noch in keinem anderen Match dieser Show. Typ mit „Tag“/„Team“ → Teams, sonst Einzel (gleiches Geschlecht).
     Jede Paarung sammelt Gründe mit Punkten; gewürfelt wird gewichtet unter den besten. Titelmatch: Champion gegen den
     Bestplatzierten im Ranking. Ohne Grund: ELO-Nachbarn. Daten nur aus gelaufenen Shows. */
  K.diceMatch = (m, s, row) => {
    if (!s) return null;
    const x = s.matches[row] || {}, weekNow = K.weekIdx(s.date), label = s.seriesLabel || s.type;
    const fit = w => w && w.contracted && !w.injury && !w.unavailable;
    // Schon in anderen Matches dieser Show eingeplant (Teams zählen mit ihren Mitgliedern; Promos/Segmente zählen nicht)
    const used = new Set(s.matches.filter((mt, j) => j !== row && !mt.promo).flatMap(mt => K.participants(mt)).flatMap(n => [n, ...(K.teamMembers(m, n) || [])]));
    const elo = n => fmt(Math.round(rating(n)));
    let pool = m.roster.filter(w => w.show === label && fit(w) && !used.has(w.name));
    if (pool.length < 2) pool = m.roster.filter(w => K.khwShows().includes(w.show) && fit(w) && !used.has(w.name));
    const ok = new Set(pool.map(w => w.name));
    const tag = /tag|team/i.test(x.type || '');
    const sides = tag ? m.teams.filter(t => t.members.length > 1 && t.members.every(n => ok.has(n)) && !used.has(t.name)).map(t => t.name) : pool.map(w => w.name);

    // Direkte Duelle aus gelaufenen Shows: Siege, letztes Duell, Sterne
    const h2h = new Map(), pk = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
    m.shows.filter(sh => sh.ended).forEach(sh => sh.matches.forEach(mt => {
      if (mt.promo) return;
      const W = K.winners(mt), L = K.losers(mt), all = K.participants(mt);
      const pairs = [];
      if (W.length && L.length) W.forEach(a => L.forEach(b => pairs.push([a, b, a])));
      else all.forEach((a, i) => all.slice(i + 1).forEach(b => pairs.push([a, b, null])));
      pairs.forEach(([a, b, win]) => {
        const k = pk(a, b), e = h2h.get(k) || { n: 0, wins: {}, stars: [], last: -1, lastShow: null, lastWin: null };
        e.n++; if (win) e.wins[win] = (e.wins[win] || 0) + 1;
        if (typeof mt.stars === 'number') e.stars.push(mt.stars);
        const wk = K.weekIdx(sh.date);
        if (wk >= e.last) { e.last = wk; e.lastShow = sh; e.lastWin = win; }
        h2h.set(k, e);
      });
    }));
    const rating = n => K.ratingOf(m, n) || 1000;

    // Titelmatch: Champion gegen den Bestplatzierten (bzw. bei vakantem Titel die beiden Besten)
    if (x.title) {
      const t = m.titles.find(y => y.name === x.title), holder = t && t.holder;
      // Der Champion darf auch aus einer anderen Show kommen, muss aber einsatzfähig und noch frei sein
      const champPeople = holder ? (m.byName.has(holder) ? [m.byName.get(holder)] : (K.teamMembers(m, holder) || []).map(n => m.byName.get(n))) : [];
      const champ = holder && champPeople.length && champPeople.every(fit) && !used.has(holder) && champPeople.every(w => !used.has(w.name)) ? holder : null;
      if (holder && !champ) return { error: `Champion ${holder} ist schon eingeplant, verletzt, nicht verfügbar oder ohne Vertrag.` };
      const g = champ && m.byName.get(champ) ? m.byName.get(champ).gender : /female|women|frau/i.test(x.title) ? 'w' : 'm';
      const ranked = sides.filter(n => n !== champ && (!m.byName.get(n) || m.byName.get(n).gender === g)).sort((a, b) => rating(b) - rating(a));
      if (champ && ranked.length) return { names: [champ, ranked[0]], reason: `Titelchance: ${ranked[0]} ist der Bestplatzierte (ELO ${elo(ranked[0])}) und fordert ${champ} heraus` };
      if (!holder && ranked.length > 1) return { names: ranked.slice(0, 2), reason: 'Titel vakant: die zwei Bestplatzierten kämpfen um den Gürtel' };
    }

    const cands = [];
    sides.forEach((a, i) => sides.slice(i + 1).forEach(b => {
      const wa = m.byName.get(a), wb = m.byName.get(b);
      if (!tag && wa && wb && wa.gender !== wb.gender) return;
      const e = h2h.get(pk(a, b)), why = [];
      let score = 0, storyline = '';
      // 1. Gemeinsame aktive Storyline
      const st = m.storylines.find(y => y.status === 'active' && [a, b].every(n => y.participants.includes(n) || (K.teamMembers(m, n) || []).some(p => y.participants.includes(p))));
      if (st) { score += 5; storyline = st.title; why.push(`Storyline „${st.title}“ geht weiter`); }
      if (e) {
        const wa2 = e.wins[a] || 0, wb2 = e.wins[b] || 0, weeks = weekNow - e.last;
        // 2. Ausgeglichene Bilanz
        if (wa2 + wb2 >= 2 && Math.abs(wa2 - wb2) <= 1) { score += 3; why.push(`Bilanz ${wa2}–${wb2} – Zeit für eine Entscheidung`); }
        // 3. Lange nicht gegeneinander
        if (weeks >= 8) { score += 2 + Math.min(3, weeks / 8); why.push(`zuletzt vor ${weeks} Wochen gegeneinander (${ui().showTitle(e.lastShow)})`); }
        // 4. Liefert oft hohe Sterne
        const avg = e.stars.length ? e.stars.reduce((t, v) => t + v, 0) / e.stars.length : 0;
        if (e.stars.length >= 2 && avg >= 3.9) { score += avg - 2; why.push(`im Schnitt ${fmt(avg, 1)} ★ in ${e.stars.length} Duellen`); }
        // 5. Revanche: kürzlich verloren
        if (e.lastWin && weeks >= 0 && weeks <= 4) { const loser = e.lastWin === a ? b : a; score += 2; why.push(`Revanche: ${loser} verlor vor ${weeks || 'weniger als einer'} Woche${weeks === 1 ? '' : 'n'} (${ui().showTitle(e.lastShow)})`); }
      } else if (Math.abs(rating(a) - rating(b)) < 60) {
        // 6. Noch nie gegeneinander, aber auf Augenhöhe
        score += 1.5; why.push(`noch nie gegeneinander, ELO fast gleich (${elo(a)} / ${elo(b)})`);
      }
      // 7. Aufsteiger gegen Etablierten: großer Statussprung, aber knapper ELO-Abstand
      if (!tag && wa && wb && Math.abs(K.STATUS.indexOf(wa.status) - K.STATUS.indexOf(wb.status)) >= 2 && Math.abs(rating(a) - rating(b)) < 120) {
        score += 1; why.push('Bewährungsprobe: Aufsteiger trifft auf Etablierten');
      }
      if (score > 0) cands.push({ names: [a, b], score, reason: why.join(' · '), storyline });
    }));
    if (cands.length) {
      const top = cands.sort((p, q) => q.score - p.score).slice(0, 12);
      let r = K.random() * top.reduce((t, c) => t + c.score, 0);
      for (const c of top) { r -= c.score; if (r <= 0) return c; }
      return top[0];
    }
    // Kein besonderer Grund: zwei ELO-Nachbarn
    if (sides.length < 2) return null;
    const sorted = sides.slice().sort((p, q) => rating(q) - rating(p));
    for (let tries = 0; tries < 20; tries++) {
      const i = K.rand(sorted.length - 1), a = sorted[i], b = sorted[i + 1], wa = m.byName.get(a), wb = m.byName.get(b);
      if (tag || !wa || !wb || wa.gender === wb.gender) return { names: [a, b], reason: 'Zufall: zwei Nachbarn im Ranking' };
    }
    return null;
  };

  /** Sterne zum Anklicken: fünf Sterne nebeneinander, linke Hälfte eines Sterns = halber Stern. */
  const starPick = (key, i, v) => `<span class="star-pick" data-sp-key="${esc(key)}" data-sp-i="${i}" data-sp-v="${v === null || v === undefined ? '' : v}" title="Sterne vergeben – linke Hälfte eines Sterns für halbe Sterne, erneut klicken zum Entfernen">${
    [1, 2, 3, 4, 5].map(n => `<span class="sp" data-n="${n}"><i style="width:${v >= n ? 100 : v >= n - 0.5 ? 50 : 0}%"></i></span>`).join('')}<b class="sp-val">${v ? fmt(v, v % 1 ? 1 : 0) : ''}</b></span>`;

  /**
   * Kompakte Matchliste wie im Wireframe: „Match 1 · A besiegt B“, darunter Titel, Storyline, Sterne, Wette, Typ, Notiz.
   * Ist die Show noch nicht gelaufen, lassen sich Notizen direkt bearbeiten; bei der fälligen Show auch die Sterne.
   */
  function compactMatches(m, s) {
    const u = ui();
    const notesEditable = !s.ended, starsEditable = s.state === 'current';
    let k = 0;
    return `<ol class="mlist">${s.matches.map((mt, i) => {
      const label = mt.promo ? 'Segment' : `Match ${++k}`;
      const hurt = key => mt.marks && mt.marks[key] ? `<span class="ms sm hurt" title="War zu diesem Zeitpunkt verletzt eingetragen">healing</span>` : '';
      const vs = mt.winner && mt.loser ? `<b>${u.wlList(mt.winner)}${hurt('winner')}</b> <span class="muted">besiegt</span> ${u.wlList(mt.loser)}${hurt('loser')}`
        : mt.winner ? `<b>${u.wlList(mt.winner)}</b>` : mt.loser ? `${u.wlList(mt.loser)}` : '';
      const extra = mt.extra ? `${vs ? '<span class="muted"> · mit </span>' : ''}${u.wlList(mt.extra)}${hurt('extra')}` : '';
      let bet = '';
      if (mt.bet) {
        const b = betInfo(m, mt), w = b.rows && (b.rows.find(r => K.winners(mt).includes(r.name)) || null);
        bet = `<span class="chip accent">Wette${w && w.quote ? ` · ${fmt(w.quote, 1)} %` : ''}</span>`;
      }
      const stars = starsEditable ? starPick(s.key, i, mt.stars) : mt.stars !== null ? `<span class="stars">${starTxt(mt.stars)}</span>${mt.bonus ? '<small> inkl. Bonus</small>' : ''}` : '';
      const meta = [mt.title ? `<span class="chip title-chip">${u.icon('emoji_events')}${esc(mt.title)}</span>` : '', mt.storyline ? `<span class="chip story">${esc(mt.storyline)}</span>` : '', stars, bet].filter(Boolean).join(' ');
      // Nur Teilnehmer, noch kein Sieger: Sieger direkt hier per Klick festlegen (ohne Editor).
      const pool = K.splitNames(mt.extra).concat(K.splitNames(mt.loser));
      const winPick = notesEditable && !mt.promo && !mt.winner && pool.length > 1
        ? `<div class="win-pick"><small>Sieger festlegen:</small>${pool.map(n => `<button class="chip" data-win="${esc(s.key)}" data-i="${i}" data-name="${esc(n)}">${u.icon('emoji_events')}${esc(n)}</button>`).join('')}</div>`
        : notesEditable && !mt.promo && mt.winner && mt.wonPicked
          ? `<button class="btn text undo-win" data-unwin="${esc(s.key)}" data-i="${i}" title="Sieger wieder zu den Teilnehmern">${u.icon('undo')}Sieger zurücksetzen</button>` : '';
      const notes = notesEditable
        ? `<textarea class="m-note-in" id="mn-${esc(s.key)}-${i}" data-mnote="${esc(s.key)}" data-i="${i}" rows="1" placeholder="Notiz …">${esc([mt.notes, ...(mt.cellNotes || [])].filter(Boolean).join('\n'))}</textarea>`
        : mt.notes ? `<div class="m-notes">${K.nl(mt.notes)}</div>` : '';
      // Geplante Shows: Verletzte im Match sind ein Fehler (Show lässt sich so nicht beenden), Nicht Verfügbare nur ein Hinweis
      const hurtNow = !s.ended && K.isMatchRow && K.isMatchRow(mt) ? K.injuredIn(m, mt) : [];
      const awayNow = !s.ended && K.unavailableIn ? K.unavailableIn(m, mt) : [];
      const freeNow = !s.ended && K.noContractIn ? K.noContractIn(m, mt) : [];
      const warn = (freeNow.length ? `<div class="m-warn bad">${u.icon('contract')}Ohne Vertrag, darf nicht auftreten: ${freeNow.map(esc).join(', ')}</div>` : '')
        + (hurtNow.length ? `<div class="m-warn bad">${u.icon('healing')}Verletzt, darf in keinem Match auftreten: ${hurtNow.map(n => `${esc(n)} (${esc(K.injuryWhy(m, n))})`).join(', ')}</div>` : '')
        + (awayNow.length ? `<div class="m-warn">${u.icon('event_busy')}Nicht verfügbar: ${awayNow.map(w => `${esc(w.name)} (${esc(w.unavailable)})`).join(', ')}</div>` : '');
      return `<li class="${mt.promo ? 'is-promo' : ''}"><span class="m-no">${label}</span><div class="m-body">
          <div class="m-vs">${vs}${extra}${!vs && !extra ? `<span class="muted">${esc(mt.type || 'Ohne Angaben')}</span>` : ''}</div>${warn}
          ${meta ? `<div class="m-meta">${meta}</div>` : ''}
          ${mt.type && (vs || extra) ? `<div class="m-type">${esc(mt.type)}</div>` : ''}
          ${winPick}${notes}</div></li>`;
    }).join('')}</ol>`;
  }

  /** Allgemeine Info-Notiz zur Show (schnelle Notizen, in Liste und Editor bearbeitbar). */
  const infoNote = s => `<label class="info-note">${ui().icon('sticky_note_2')}<textarea class="info-in" id="info-${esc(s.key)}" data-info="${esc(s.key)}" rows="1" placeholder="Info zur Show …">${esc(s.info || '')}</textarea></label>`;

  function showCard(m, s, st) {
    const u = ui(), sel = s.key === st.show;
    const admin = K.admin && K.admin.on;
    const actions = s.ended
      ? `<span class="chip outline">${s.result ? 'abgerechnet' : 'gelaufen'}</span>${admin ? `<button class="btn sm admin-btn" data-sh="edit" data-key="${esc(s.key)}" title="Admin: gelaufene Show korrigieren">${u.icon('shield_person')}Korrigieren</button>` : ''}`
      : `<button class="btn tonal sm" data-sh="edit" data-key="${esc(s.key)}">${u.icon('edit')}Show bearbeiten</button>`;
    const body = s.hasContent ? compactMatches(m, s) : `<p class="empty">${s.ended ? 'Keine Einträge.' : 'Noch nicht geplant.'}</p>`;
    const extra = sel && s.hasContent && s.no !== null ? `<div class="grid g-2 show-extra"><div><h5>Vorschau-Fakten</h5>${u.hypeBlock(s)}</div><div><h5>Wettquoten</h5>${u.oddsBlock(s)}</div></div>` : '';
    return `<section class="card show-item show-${esc(s.type)} ${sel ? 'selected' : ''} is-${s.state}" id="show-${esc(s.key)}" data-set="show" data-value="${esc(s.key)}" data-month="${K.absMonth(s.date)}"${K.seriesStyle(s)}>
      <header class="card-h"><div><h3>${esc(u.showTitle(s))} ${u.showChip(s.type === 'Event' ? '' : s.type, s.seriesLabel, K.seriesStyle(s))}</h3>
        <small>${esc(u.showSub(s))} · ${esc(venueTxt(s.venue))}</small></div>
        <div class="show-actions">${s.stars ? u.stars(s.stars) : ''}${actions}</div></header>
      <div class="card-b">${infoNote(s)}${body}${extra}</div></section>`;
  }

  /* ───────────── Kalender ───────────── */
  // Kalendermonate sind fortlaufend (Jahr × 12 + Monat), damit es über das Jahresende hinaus weitergeht.
  // Ältere Stände merkten sich nur den Monat (0–11) im Jahr der Tabelle.
  const calAbs = v => (v < 12 ? K.YEAR * 12 + v : v);
  function monthGrid(m, abs, st, mini) {
    const month = abs % 12, year = Math.floor(abs / 12);
    const shows = m.shows.filter(s => K.absMonth(s.date) === abs);
    const due = m.dueShow;
    const days = [];
    for (let d = 1; d <= 28; d++) {
      const evs = shows.filter(s => s.date.day === d);
      const s = evs[0];
      const cls = ['day', s ? 'has t-' + s.type : '', s && s.key === st.show ? 'sel' : '', s && due && s.key === due.key ? 'due' : '', s && s.ended ? 'past' : ''].join(' ');
      days.push(s ? `<a class="${cls}"${K.seriesStyle(s)} data-set="show" data-value="${esc(s.key)}" data-scroll title="${esc(evs.map(x => ui().showTitle(x)).join(' · '))}">${d}${evs.length > 1 ? '<i>+</i>' : ''}</a>` : `<span class="${cls}">${d}</span>`);
    }
    return `<div class="cal-month ${mini ? 'mini' : ''}"><h4 ${mini ? `data-cal-month="${abs}"` : ''}>${K.MONTHS[month]}${mini ? '' : ` <small>Jahr ${year}</small>`}</h4>
      <div class="cal-grid">${DAY_SHORT.map(x => `<b>${x}</b>`).join('')}${days.join('')}</div></div>`;
  }

  function calHtml(m, st) {
    const u = ui();
    const first = K.absMonth(m.shows[0].date), last = K.absMonth(m.shows[m.shows.length - 1].date);
    const abs = st.calMonth === undefined || st.calMonth === null ? K.absMonth((m.show(st.show) || m.dueShow || m.shows[0]).date) : calAbs(st.calMonth);
    const year = Math.floor(abs / 12);
    const nav = (to, ic, title) => `<button class="btn icon" ${to < first || to > last ? 'disabled' : `data-cal-go="${to}"`} title="${title}">${u.icon(ic)}</button>`;
    const legend = `<div class="cal-legend"><span class="day has t-TryOut">TryOut</span><span class="day has t-Lucky7">Lucky7</span><span class="day has t-PPV">PPV</span><span class="day has t-Event">Event</span></div>`;
    // Ganzes Jahr: Pfeile blättern jahresweise, sonst monatsweise
    const head = `<header class="card-h"><h3>${u.icon('calendar_month')}${st.calYear ? `Jahr ${year}` : 'Kalender'}</h3><div class="cal-nav">
        ${st.calYear ? nav(Math.max(first, (year - 1) * 12), 'chevron_left', 'Vorheriges Jahr') + nav(Math.min(last, (year + 1) * 12), 'chevron_right', 'Nächstes Jahr')
          : nav(abs - 1, 'chevron_left', 'Vorheriger Monat') + nav(abs + 1, 'chevron_right', 'Nächster Monat')}
        <button class="btn text" data-set="show" data-value="${esc(m.dueShow ? m.dueShow.key : '')}" data-scroll>Heutige Show</button>
        <button class="btn icon" data-cal-year title="${st.calYear ? 'Zwei Monate zeigen' : 'Ganzes Jahr zeigen'}">${u.icon(st.calYear ? 'close_fullscreen' : 'open_in_full')}</button></div></header>`;
    const start = Math.max(first, Math.min(abs, last - 1));
    const body = st.calYear
      ? `<div class="cal-year">${K.MONTHS.map((_, i) => monthGrid(m, year * 12 + i, st, true)).join('')}</div>`
      : `<div class="cal-two">${monthGrid(m, start, st)}${monthGrid(m, start + 1, st)}</div>`;
    return `<section class="card cal" id="cal-box">${head}<div class="card-b">${body}${legend}</div></section>`;
  }

  function sideHtml(m, st) {
    const u = ui();
    const ppvs = m.shows.filter(s => s.type === 'PPV' && !s.ended).slice(0, 3);
    const main = s => { const x = s.matches.filter(mt => !mt.promo).slice(-1)[0]; return x ? [x.winner || x.loser, x.loser && x.winner ? x.loser : ''].filter(Boolean).join(' vs. ') : ''; };
    const next = ppvs.length ? `<ul class="side-list">${ppvs.map(s => `<li data-set="show" data-value="${esc(s.key)}" data-scroll><span class="date-tag">${esc(shortDate(s))}</span>
        <div><b>${esc(u.showTitle(s))}</b><small>${s.hasContent ? `${s.matches.length} Einträge${main(s) ? ' · Main Event: ' + esc(main(s)) : ''}` : 'Noch nicht geplant'} · ${esc(s.venue.halle)}</small></div></li>`).join('')}</ul>`
      : u.empty('Keine PPVs mehr in diesem Jahr.');
    // Storylines der gewählten (sonst fälligen) Show zuerst; bei PPVs und Events ohne Vorrang
    const cur = m.show(st.show) || m.dueShow, curShow = cur && cur.series ? (cur.seriesLabel || cur.type) : '';
    const stories = m.stories.filter(s => s.steps.length).sort((a, b) => (curShow ? (b.show === curShow) - (a.show === curShow) : 0));
    const storyList = stories.length ? `<ul class="side-list">${stories.slice(0, 6).map(s => `<li><span class="date-tag show-${esc(s.show)}">${esc(s.show)}</span>
        <div><b>${esc(s.name)}</b><small>${s.steps.length} Schritte${s.start ? ' · seit ' + esc(s.start) : ''}</small></div></li>`).join('')}</ul>`
      : u.empty('Keine laufenden Storylines.');
    return calHtml(m, st)
      + u.card('Nächste PPVs', next, { icon: 'local_activity' })
      + u.card('Aktuelle Storylines', storyList, { icon: 'auto_stories', aside: '<a class="btn text" href="#stories">Alle Storylines</a>' })
      + (K.admin && K.admin.on ? seriesCard(m) : '')
      + (st.addEvent ? addForm(st) : u.card('Show hinzufügen', `<p class="hint">Einen PPV oder ein Event mit freiem Datum anlegen. Nur PPVs werden als PPV abgerechnet, Events wie eine normale Show.</p>
          <button class="btn tonal" data-sh="add-event">${u.icon('add')}Show hinzufügen</button>`, { icon: 'add_circle' }));
  }

  /* ───────────── Showreihen (nur Admin) ───────────── */
  function seriesCard(m) {
    const u = ui(), conf = K.seriesConf();
    const rows = Object.values(conf).map(cf => {
      const count = m.shows.filter(s => s.series === cf.id).length;
      return `<li class="${cf.deletedFrom ? 'is-deleted' : ''}"><span class="date-tag show-${cf.custom ? 'Weekly' : esc(cf.id)}"${K.seriesStyle(cf.id)}>${esc(K.WEEKDAYS[cf.weekday].slice(0, 2))}</span>
        <div><b>${esc(cf.label)}</b><small>jeden ${esc(K.WEEKDAYS[cf.weekday])} · ab ${esc(K.MONTHS[cf.startMonth].slice(0, 3))} W${cf.startWeek} · erste Nummer #${cf.firstNumber} · ${count} Termine · am Tag ${cf.order}.${cf.deletedFrom ? ' · <b class="neg">entfällt ab heute</b>' : ''}</small></div>
        <span class="ser-act"><button class="btn icon" data-ser="edit" data-id="${esc(cf.id)}" title="Reihe ändern">${u.icon('edit')}</button>
        ${cf.deletedFrom ? `<button class="btn icon" data-ser="restore" data-id="${esc(cf.id)}" title="Wiederherstellen">${u.icon('restore')}</button>` : `<button class="btn icon" data-ser="del" data-id="${esc(cf.id)}" title="Reihe löschen">${u.icon('delete')}</button>`}</span></li>`;
    }).join('');
    return u.card('Showreihen', `<p class="admin-note">${u.icon('shield_person')} Admin: wöchentliche Shows für alle Termine ändern, löschen oder neu anlegen.</p>
      <ul class="side-list series-list">${rows}</ul>
      <button class="btn tonal" data-ser="new">${u.icon('add')}Neue Showreihe</button>`, { icon: 'event_repeat', cls: 'admin-card' });
  }
  function seriesDialog(cf) {
    return K.dialog.form({
      title: cf ? `Showreihe „${cf.label}“ ändern` : 'Neue Showreihe', icon: 'event_repeat', ok: cf ? 'Übernehmen' : 'Anlegen',
      text: cf ? 'Gilt für alle Termine der Reihe. Gelaufene Shows behalten ihre Inhalte.' : 'Eine neue wöchentliche Show, z. B. eine dritte Marke. Sie wird wie eine normale Show abgerechnet.',
      fields: [
        { id: 'label', label: 'Name', value: cf ? cf.label : '', placeholder: 'z. B. Friday Night Fight' },
        { id: 'weekday', label: 'Wochentag', type: 'select', value: cf ? cf.weekday : 3, options: K.WEEKDAYS.map((d, i) => [i, d]) },
        { id: 'startMonth', label: 'Erste Show im Monat', type: 'select', value: cf ? cf.startMonth : (K.model.dueShow || K.model.shows[0]).date.month, options: K.MONTHS.map((d, i) => [i, d]) },
        { id: 'startWeek', label: 'in Woche', type: 'select', value: cf ? cf.startWeek : 1, options: [1, 2, 3, 4].map(w => [w, 'Woche ' + w]) },
        { id: 'firstNumber', label: 'Nummer der ersten Show', type: 'number', step: '1', value: cf ? cf.firstNumber : 1 },
        { id: 'order', label: 'Reihenfolge am selben Tag', type: 'select', value: cf ? cf.order : K.SHOW_ORDER.Weekly, options: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [n, n + '. Show des Tages']),
          hint: 'Fallen mehrere Shows auf einen Tag, läuft die kleinere Zahl zuerst. Standard: TryOut 1, Lucky7 2, PPV 3, Event 4, eigene Reihen 5.' },
        // Farbe nur für eigene Reihen; TryOut und Lucky7 behalten ihre festen Farben
        ...(!cf || cf.custom ? [{ id: 'color', label: 'Farbe', type: 'swatches', value: (cf && cf.color) || K.SERIES_COLORS[0][0], options: K.SERIES_COLORS }] : []),
      ],
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ser]');
    if (!b || !K.model) return;
    const m = K.model, id = b.dataset.id, conf = K.seriesConf(), cf = conf[id];
    const save = (sid, v) => K.store.update(st => { st.series[sid] = Object.assign({}, st.series[sid], v); });
    const clean = v => Object.assign({ label: (v.label || '').trim() || 'Showreihe', weekday: Number(v.weekday), startMonth: Number(v.startMonth), startWeek: Number(v.startWeek), firstNumber: Number(v.firstNumber) || 1, order: Number(v.order) || 5 },
      v.color ? { color: v.color } : {});
    if (b.dataset.ser === 'new') {
      seriesDialog(null).then(v => { if (!v) return; const sid = 'w' + Date.now().toString(36); save(sid, clean(v)); K.rebuild(); K.toast(`Showreihe „${clean(v).label}“ angelegt`); });
    } else if (b.dataset.ser === 'edit') {
      seriesDialog(cf).then(v => { if (!v) return; save(id, clean(v)); K.rebuild(); K.toast('Showreihe geändert'); });
    } else if (b.dataset.ser === 'del') {
      const today = m.dueShow ? m.dueShow.date : { month: 0, day: 1 };
      K.dialog.confirm({ title: `„${cf.label}“ löschen?`, icon: 'delete', danger: true, ok: 'Löschen',
        text: `Alle künftigen Termine der Reihe ab ${K.MONTHS[today.month]}, Woche ${Math.ceil(today.day / 7)} entfallen, auch schon geplante. Gelaufene Shows bleiben erhalten.` })
        .then(yes => {
          if (!yes) return;
          const ended = m.shows.some(s => s.series === id && s.ended);
          K.store.update(st => {
            if (cf.custom && !ended) { delete st.series[id]; Object.keys(st.shows).filter(k => String(k).startsWith(id + ':')).forEach(k => delete st.shows[k]); }
            else st.series[id] = Object.assign({}, st.series[id], { deletedFrom: K.dateKey(today, '') - 9 });
          });
          K.rebuild(); K.toast(`„${cf.label}“ gelöscht`);
        });
    } else if (b.dataset.ser === 'restore') {
      K.store.update(st => { st.series[id] = Object.assign({}, st.series[id], { deletedFrom: null }); });
      K.rebuild(); K.toast(`„${cf.label}“ wiederhergestellt`);
    }
  });

  /* ───────────── Sonder-Event anlegen ───────────── */
  function addForm(st) {
    const u = ui();
    const d = st.addEvent || { name: '', type: 'PPV', month: K.YEAR * 12, day: 1 };
    // Monat fortlaufend ab dem aktuellen, zwei Jahre im Voraus (über das Jahresende hinaus)
    const from = K.model ? K.model.curAbs : K.YEAR * 12, curYear = Math.floor(from / 12);
    const months = Array.from({ length: 24 }, (_, i) => from + i);
    return `<section class="card add-event"><header class="card-h"><h3>${u.icon('add_circle')}Show hinzufügen</h3></header><div class="card-b">
      <div class="form-row two">
        <label class="ro"><span>Art</span><select class="field" id="ev-type"><option value="PPV" ${d.type === 'PPV' ? 'selected' : ''}>PPV</option><option value="Event" ${d.type === 'Event' ? 'selected' : ''}>Event</option></select></label>
        <label class="ro"><span>Name</span><input class="field" id="ev-name" value="${esc(d.name)}" placeholder="z. B. Würfel-Wahnsinn"></label>
        <label class="ro"><span>Monat</span><select class="field" id="ev-month">${months.map(a => `<option value="${a}" ${a === d.month ? 'selected' : ''}>${K.monthText(a, curYear)}</option>`).join('')}</select></label>
        <label class="ro"><span>Tag</span><select class="field" id="ev-day">${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}" ${i + 1 === d.day ? 'selected' : ''}>${i + 1} · ${K.WEEKDAYS[i % 7]}</option>`).join('')}</select></label>
      </div>
      <p class="hint">${d.type === 'PPV' ? 'Wird als PPV abgerechnet (PPV-Preise, Streaming und Follower ×2,5).' : 'Wird wie eine normale Show abgerechnet.'}</p>
      <div class="actions"><button class="btn primary" data-sh="create">${u.icon('add')}Anlegen und bearbeiten</button><button class="btn text" data-sh="cancel-add">Abbrechen</button></div>
    </div></section>`;
  }

  /* ───────────── Editor ───────────── */
  function editor(m, s, st) {
    const u = ui();
    if (own(s.key) && !own(s.key).matches) ensureOwn(m, s.key);   // z. B. nur die Reihenfolge am Tag war gespeichert
    const o = own(s.key) || { matches: [], venue: s.venue, name: s.name };
    const v = Object.assign({}, SR().DEFAULT_VENUE, o.venue);
    const sel = (id, list, cur, attrs) => `<select class="field" id="${id}" ${attrs || ''}>${list.map(x => { const [val, lab] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(val)}" ${String(val) === String(cur) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;
    // Gewinner, Verlierer und Teilnehmer: mehrere Namen mit Komma; Vorschläge aus allen Wrestlern und Teams.
    const inp = (i, f, val, ph, sug, multi) => `<input class="field" id="sm-${i}-${f}" data-sm="${f}" data-i="${i}" value="${esc(val)}" placeholder="${ph}" ${sug ? `data-suggest="${sug}"` : ''} ${multi ? 'data-suggest-multi' : ''} autocomplete="off">`;
    const titles = m.titles.map(t => t.name);
    const rows = o.matches.map((x, i) => `<tr data-row="${i}" class="${x.title ? 'is-title' : ''}">
        <td class="drag-h" title="Zum Verschieben ziehen">${u.icon('drag_indicator')}<span>${i + 1}</span></td>
        <td>${inp(i, 'type', x.type, x.title ? 'Titelmatch' : /promo/i.test(x.type) ? 'Promo' : 'Singles Match')}
          ${x.title ? sel(`sm-${i}-title`, titles, x.title, `data-sm="title" data-i="${i}"`) : ''}</td>
        <td>${inp(i, 'winner', x.winner, 'Gewinner', 'fighters', true)}</td>
        <td>${inp(i, 'loser', x.loser, 'Verlierer', 'fighters', true)}</td>
        <td>${inp(i, 'extra', x.extra, 'Name, Name …', 'fighters', true)}</td>
        <td>${inp(i, 'storyline', x.storyline, 'Storyline', 'storylines')}</td>
        <td class="col-bet"><label class="check"><input type="checkbox" data-sm="bet" data-i="${i}" ${x.bet ? 'checked' : ''}></label></td>
        <td><textarea class="field note-in" id="sm-${i}-notes" data-sm="notes" data-i="${i}" rows="2" placeholder="Notizen">${esc(x.notes)}</textarea></td>
        <td class="col-act"><div class="act-stack">${!s.ended && !/promo|segment/i.test(x.type) ? `<button class="btn icon dice" data-sh="dice" data-i="${i}" title="Würfeln: passende Paarung vorschlagen (Grund steht danach in den Notizen)">${u.icon('casino')}</button>` : ''}<button class="btn icon" data-sh="del" data-i="${i}" title="Entfernen">${u.icon('delete')}</button></div></td>
      </tr>`).join('');
    const total = o.matches.reduce((t, x) => t + (Number(x.stars) || 0), 0);
    return `<section class="card show-editor">
      <header class="card-h"><div><h3>${u.icon('edit')}${esc(u.showTitle(s))} bearbeiten</h3><small>${esc(u.showSub(s))}</small></div>
        <div class="actions">${(s.extra || s.type === 'PPV') && !s.ended ? `<button class="btn text" data-sh="del-event">${u.icon('delete')}${s.type === 'PPV' ? 'PPV' : 'Event'} löschen</button>` : ''}<button class="btn primary" data-sh="done">${u.icon('check')}Fertig</button></div></header>
      <div class="card-b">
        <div data-presence-warn="${esc(String(s.key))}"></div>
        ${s.ended ? `<p class="admin-note">${u.icon('shield_person')} Admin-Korrektur: Diese Show ist bereits ${s.result ? 'abgerechnet' : 'gelaufen'}. Änderungen ändern keine Buchungen, Sterne oder ELO-Werte im Nachhinein.</p>` : ''}
        ${infoNote(s)}
        <h5>Show</h5>
        <div class="form-row four">
          <label class="ro"><span>Name ${s.type === 'PPV' || s.extra ? '' : '(optional)'}</span><input class="field" id="sv-name" data-sv="name" value="${esc(o.name || '')}" placeholder="${s.type === 'PPV' ? 'Name des PPV' : s.extra ? 'Name des Events' : esc(s.type + ' #' + s.typeIndex)}"></label>
          <label class="ro"><span>Land</span><input class="field" id="sv-land" data-sv="land" value="${esc(v.land)}"></label>
          <label class="ro"><span>Stadt</span><input class="field" id="sv-stadt" data-sv="stadt" value="${esc(v.stadt)}"></label>
          <label class="ro"><span>Hallentyp</span>${sel('sv-halle', SR().HALL_NAMES, v.halle, 'data-sv="halle"')}</label>
        </div>
        <p class="hint">Für die Abrechnung zählt nur der Hallentyp. ${SR().HALLS[v.halle] && SR().HALLS[v.halle].assumed ? 'Für die Besondere Arena gibt es in der Tabelle keine Formeln, die Werte sind vorläufig angenommen.' : ''}</p>
        ${sameDay(m, s)}
        <h5>Matches und Segmente <small>${o.matches.length} Einträge · ${starTxt(total) || '0 ★'}</small></h5>
        <div class="table-wrap"><table class="table edit-table"><thead><tr><th>#</th><th>Typ</th><th>Gewinner</th><th>Verlierer</th><th>Teilnehmer</th><th>Storyline</th><th>Wette</th><th>Notizen</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="9" class="empty">Noch keine Matches. Leg das erste an.</td></tr>`}</tbody></table></div>
        <div class="actions"><button class="btn tonal" data-sh="add">${u.icon('add')}Match hinzufügen</button><button class="btn tonal" data-sh="add-title">${u.icon('emoji_events')}Titelmatch hinzufügen</button><button class="btn" data-sh="add-seg">${u.icon('mic')}Segment hinzufügen</button></div>
        <div id="bet-box">${betBox(m, s.key)}</div>
        <p class="hint">${u.icon('sync')} Änderungen werden sofort gespeichert und sind für beide Spieler sichtbar. Zeilen am Griff ${u.icon('drag_indicator')} verschieben. Mehrere Namen mit Komma trennen. Beim Titelmatch bekommt der Sieger den Titel, sobald die Show beendet wird. Sterne vergibst du in der Showliste bei der fälligen Show.</p>
      </div></section>`;
  }

  /**
   * Mehrere Shows am selben Tag: Reihenfolge wählen. Die Show bekommt eine eigene Position (1–9, kleiner = früher);
   * ohne eigene Angabe gilt die der Showreihe bzw. der Standard (TryOut 1, Lucky7 2, PPV 3, Event 4, eigene Reihen 5).
   */
  function sameDay(m, s) {
    const day = m.shows.filter(x => x.date.year === s.date.year && x.date.month === s.date.month && x.date.day === s.date.day);
    if (day.length < 2) return '';
    const u = ui(), pos = day.indexOf(s);
    const opts = day.map((x, i) => [i, i === pos ? `${i + 1}. – aktuelle Position` : `${i + 1}. – ${i < pos ? 'vor' : 'nach'} ${u.showTitle(x)}`]);
    return `<div class="same-day"><b>${u.icon('low_priority')}Am selben Tag: ${day.map(x => esc(u.showTitle(x))).join(' → ')}</b>
      <label class="ro"><span>Diese Show läuft als</span><select class="field" id="sv-order" data-sv="order">${opts.map(([v, l]) => `<option value="${v}" ${v === pos ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      ${(own(s.key) || {}).order !== undefined ? `<button class="btn text" data-sh="order-reset">${u.icon('restart_alt')}Standard-Reihenfolge</button>` : ''}</div>`;
  }

  /**
   * Verletzte in einem Match: Beim Planen nur nachfragen (Wunsch des Nutzers: vorausplanen soll möglich sein).
   * „Trotzdem eintragen“ lässt den Namen stehen, „Herausnehmen“ entfernt ihn. Beendet werden kann die Show erst,
   * wenn kein Verletzter mehr in einem Match steht (showend.js). Segmente sind immer erlaubt.
   */
  // Ebenso Wrestler ohne Vertrag: Sie dürfen gar nicht auftreten (auch nicht im Segment); auch hier wird nur nachgefragt.
  const injuredOk = new Set();   // schon bestätigt: „Show|Zeile|Name“ (gilt bis zum Neuladen)
  function blockInjured(k, i) {
    const m = K.model, row = (own(k) || {}).matches && own(k).matches[i];
    if (!m || !row) return false;
    // Einträge im Feld (Wrestler oder Team) mit Grund
    const issues = [];
    if (K.isMatchRow && K.isMatchRow(row)) K.injuredIn(m, row).forEach(n => issues.push({ entry: n, text: `${n}: verletzt (${K.injuryWhy(m, n)})` }));
    if (K.noContractIn) K.participants(row).forEach(p => {
      const miss = K.noContractIn(m, { winner: p, loser: '', extra: '' });
      if (miss.length && !issues.some(x => x.entry === p)) issues.push({ entry: p, text: `${miss.join(', ')}: kein Vertrag` });
    });
    const bad = issues.filter(x => !injuredOk.has(`${k}|${i}|${x.entry}`));
    if (!bad.length || blockInjured.open) return false;
    blockInjured.open = true;
    // Erst nach dem laufenden Ereignis fragen: Mitten im Verlassen eines Feldes (blur) darf die Seite nicht ersetzt werden.
    setTimeout(() => {
      const s = m.show(k), due = m.dueShow && m.dueShow.key === k;
      const anyContract = bad.some(x => /kein Vertrag/.test(x.text)), anyHurt = bad.some(x => /verletzt/.test(x.text));
      K.dialog.confirm({
        title: anyContract && !anyHurt ? 'Ohne Vertrag trotzdem eintragen?' : 'Trotzdem eintragen?', icon: anyContract && !anyHurt ? 'contract' : 'healing', ok: 'Trotzdem eintragen', cancel: 'Herausnehmen',
        text: `${bad.map(x => x.text).join('\n')}\n\n${anyHurt ? 'Verletzte dürfen in keinem Match auftreten (Segmente schon). ' : ''}${anyContract ? 'Ohne Vertrag darf niemand auftreten. ' : ''}${due ? 'Diese Show ist als Nächste fällig und' : `„${ui().showTitle(s)}“`} lässt sich erst beenden, wenn das geklärt ist.`,
      }).then(yes => {
        blockInjured.open = false;
        const entries = bad.map(x => x.entry);
        if (yes) entries.forEach(n => injuredOk.add(`${k}|${i}|${n}`));
        else edit(k, o => { const x = o.matches[i]; ['winner', 'loser', 'extra'].forEach(f => { x[f] = K.splitNames(x[f]).filter(n => !entries.includes(n)).join(', '); }); });
        K.rebuild();
      });
    }, 0);
    return false;
  }

  /** Show k an Position to unter den Shows ihres Tages setzen; alle Shows des Tages bekommen dann feste Positionen. */
  function setDayOrder(k, to) {
    const m = K.model, s = m.show(k);
    if (!s) return;
    const day = m.shows.filter(x => x.date.year === s.date.year && x.date.month === s.date.month && x.date.day === s.date.day && x !== s);
    day.splice(Math.max(0, Math.min(to, day.length)), 0, s);
    K.store.update(st => day.forEach((x, i) => { st.shows[x.key] = Object.assign({}, st.shows[x.key], { order: i + 1 }); }));
    K.rebuild();
    K.toast(`Reihenfolge am ${s.date.day}. ${K.MONTHS[s.date.month]}: ${day.map(x => ui().showTitle(x)).join(' → ')}`);
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-sh="order-reset"]') || !K.model) return;
    const s = K.model.show(K.state.editShow);
    if (!s) return;
    const day = K.model.shows.filter(x => x.date.year === s.date.year && x.date.month === s.date.month && x.date.day === s.date.day);
    K.store.update(st => day.forEach(x => { if (st.shows[x.key]) delete st.shows[x.key].order; }));
    K.rebuild(); K.toast('Standard-Reihenfolge');
  });

  /** Wettquote fürs Planen: Quote je Teilnehmer und möglicher Gewinn, falls er gewinnt. */
  function betBox(m, key) {
    const u = ui(), o = own(key);
    const x = o && o.matches.find(mt => mt.bet);
    if (!x) return `<p class="hint">${u.icon('casino')} Ein Match als Wette markieren, um Quote und möglichen Gewinn zu sehen. Pro Show zählt eine Wette.</p>`;
    const mt = { winner: x.winner, loser: x.loser, extra: x.extra };
    const b = betInfo(m, mt), wins = K.winners(mt);
    if (!b.rows) return `<div class="bet-box"><b>${u.icon('casino')}Wette</b><p class="hint">${esc(b.text)}</p></div>`;
    return `<div class="bet-box"><b>${u.icon('casino')}Wette · ${esc(b.list)}</b>
      <table class="table slim"><thead><tr><th>Teilnehmer</th><th class="num">Rang</th><th class="num">Quote</th><th class="num">Gewinn, falls Sieger</th></tr></thead><tbody>${b.rows.map(r =>
        `<tr class="${wins.includes(r.name) ? 'picked' : ''}"><td>${u.wl(r.name)}${wins.includes(r.name) ? ' <small>(eingetragener Sieger)</small>' : ''}</td><td class="num">${fmt(r.rank)}</td><td class="num">${fmt(r.quote, 1)} %</td><td class="num">${r.range ? `${eur(r.range[0], true)} – ${eur(r.range[1], true)}` : '–'}</td></tr>`).join('')}</tbody></table>
      <p class="hint">Ausgezahlt wird auf den Sieger. Je kleiner seine Quote, desto mehr bringt die Wette.</p></div>`;
  }

  /* ───────────── Seite ───────────── */
  K.views.shows = {
    title: 'Card', icon: 'stadium',
    render(m, st) {
      if (st.show === undefined || st.show === null || !m.show(st.show)) st.show = m.dueShow ? m.dueShow.key : m.shows[0].key;
      const ed = st.editShow !== undefined && st.editShow !== null ? m.show(st.editShow) : null;
      if (ed && (!ed.ended || (K.admin && K.admin.on))) return editor(m, ed, st);
      st.editShow = null;
      return `<div class="shows-layout"><div class="show-list">
          ${m.shows.map(s => showCard(m, s, st)).join('')}
        </div><div class="cal-col">${sideHtml(m, st)}</div></div>`;
    },
  };

  // Vorschläge im Editor
  K.suggest = K.suggest || {};
  // Alle Wrestler und Teams. Wer zur Show gehört, die gerade bearbeitet wird, steht oben (bei PPVs und Events:
  // alle KHW-Shows). Teams bekommen die Show ihrer Mitglieder.
  K.suggest.fighters = () => {
    const m = K.model; if (!m) return [];
    const s = K.state.editShow !== null && K.state.editShow !== undefined ? m.show(K.state.editShow) : null;
    const own = s && (s.type === 'TryOut' || s.type === 'Lucky7') ? [s.type] : ['TryOut', 'Lucky7'];
    const rank = show => (own.includes(show) ? 0 : show ? 1 : 2);
    // Teams bekommen die häufigste Show ihrer Mitglieder
    const teams = (m.teams || []).map(t => {
      const c = {}; t.members.forEach(n => { const w = m.byName.get(n); if (w && w.show) c[w.show] = (c[w.show] || 0) + 1; });
      const show = Object.keys(c).sort((a, b) => c[b] - c[a])[0] || '';
      return { value: t.name, label: t.name, sub: ['Team', show].filter(Boolean).join(' · '), rank: rank(show) };
    });
    return m.roster.map(w => ({ value: w.name, label: w.name, sub: [w.show, w.status, w.contracted ? '' : 'ohne Vertrag', w.injury ? 'verletzt' : '', w.unavailable ? 'nicht verfügbar' : ''].filter(Boolean).join(' · '), rank: rank(w.show) + (w.injury || !w.contracted ? 3 : 0) })).concat(teams);
  };
  K.suggest.storylines = () => (K.model ? K.model.stories.map(s => ({ value: s.name, label: s.name, sub: s.show })) : []);

  /* ───────────── Bedienung ───────────── */
  const model = () => K.model;
  const key = () => K.state.editShow;
  const refreshBet = () => { const box = document.getElementById('bet-box'); if (box && model()) box.innerHTML = betBox(model(), key()); };

  // Erfasst in der Capture-Phase, damit „Show bearbeiten“ nicht zusätzlich die ganze Karte auswählt.
  document.addEventListener('click', e => {
    const m = model(), st = K.state; if (!m) return;
    // Felder direkt in der Showliste: Klick darf die Karte nicht auswählen (sonst baut die Seite neu auf).
    if (e.target.closest('.info-note, .m-note-in')) { e.stopPropagation(); return; }
    // Sieger aus den Teilnehmern wählen bzw. zurücksetzen
    const wb = e.target.closest('[data-win], [data-unwin]');
    if (wb) {
      e.stopPropagation();
      const k = keyOf(wb.dataset.win !== undefined ? wb.dataset.win : wb.dataset.unwin), i = Number(wb.dataset.i);
      ensureOwn(m, k);
      edit(k, o => {
        const x = o.matches[i];
        if (wb.dataset.win !== undefined) {
          const name = wb.dataset.name;
          x.extra = K.splitNames(x.extra).filter(n => n !== name).join(', ');
          x.loser = K.splitNames(x.loser).filter(n => n !== name).join(', ');
          x.winner = name; x.wonPicked = true;
        } else {
          x.extra = K.splitNames(x.winner).concat(K.splitNames(x.extra)).join(', ');
          x.winner = ''; x.wonPicked = false;
        }
      });
      K.rebuild();
      return;
    }
    const sp = e.target.closest('.star-pick .sp');
    if (sp) {
      e.stopPropagation();
      const pick = sp.parentElement, k = isNaN(Number(pick.dataset.spKey)) ? pick.dataset.spKey : Number(pick.dataset.spKey), i = Number(pick.dataset.spI);
      const v = starValue(sp, e), cur = pick.dataset.spV === '' ? null : Number(pick.dataset.spV);
      ensureOwn(m, k);
      edit(k, o => { o.matches[i].stars = cur === v ? '' : v; });   // gleicher Wert nochmal = entfernen
      K.rebuild();
      return;
    }
    const yr = e.target.closest('[data-cal-year]');
    if (yr) { st.calYear = !st.calYear; K.render(); return; }
    const go = e.target.closest('[data-cal-go]');
    if (go) { st.calMonth = Number(go.dataset.calGo); refreshCal(); return; }
    const mm = e.target.closest('[data-cal-month]');
    if (mm) { st.calMonth = Number(mm.dataset.calMonth); st.calYear = false; K.render(); return; }
    const b = e.target.closest('[data-sh]');
    if (!b || b.disabled) return;
    const act = b.dataset.sh, i = Number(b.dataset.i);
    if (act === 'edit') {
      e.stopPropagation();
      const k = isNaN(Number(b.dataset.key)) ? b.dataset.key : Number(b.dataset.key);
      ensureOwn(m, k); st.editShow = k; K.render(); document.querySelector('.main').scrollTop = 0; return;
    }
    if (act === 'done') { st.show = key(); st.editShow = null; st.scrollShow = true; K.rebuild(); const el = document.getElementById('show-' + st.show); if (el) el.scrollIntoView({ block: 'start' }); return; }
    if (act === 'add-event') { st.addEvent = { name: '', type: 'PPV', month: m.curAbs, day: 1 }; K.render(); return; }   // month: fortlaufend
    if (act === 'cancel-add') { st.addEvent = null; K.render(); return; }
    if (act === 'create') {
      const d = st.addEvent, k = 'x' + Date.now().toString(36), name = d.name.trim() || d.type;
      const abs = calAbs(d.month);
      K.store.update(s => { s.extras.push({ key: k, type: d.type, name, month: abs % 12, year: Math.floor(abs / 12), day: d.day }); s.shows[k] = { matches: [], venue: Object.assign({}, SR().DEFAULT_VENUE), name }; });
      st.addEvent = null; st.editShow = k; K.rebuild(); return;
    }
    if (act === 'del-event') {
      const k = key(), s = m.show(k), what = s && s.type === 'PPV' ? 'PPV' : 'Event';
      K.dialog.confirm({ title: `${what} löschen?`, text: `„${ui().showTitle(s)}“ und alle eingetragenen Matches werden gelöscht.`, icon: 'delete', danger: true, ok: 'Löschen' }).then(yes => {
        if (!yes) return;
        // Selbst angelegt: ganz entfernen. PPV aus dem alten Raster der Tabelle: als gelöscht markieren.
        K.store.update(st2 => { if (s.extra) { st2.extras = st2.extras.filter(x => x.key !== k); delete st2.shows[k]; } else st2.shows[k] = { deleted: true }; });
        st.editShow = null; st.show = null; K.rebuild();
      });
      return;
    }
    const k = key(); if (k === null || k === undefined) return;
    const blankMatch = { winner: '', loser: '', extra: '', storyline: '', stars: '', bet: false, notes: '', title: '' };
    if (act === 'add') edit(k, o => o.matches.push(Object.assign({}, blankMatch, { type: '' })));
    else if (act === 'add-seg') edit(k, o => o.matches.push(Object.assign({}, blankMatch, { type: 'Promo' })));
    else if (act === 'add-title') {
      const s = m.show(k), g = s && s.type === 'TryOut' ? 'Try me Out' : 'Lucky7 Champion (Male)';
      const first = m.titles.find(t => t.name === g) || m.titles[0];
      edit(k, o => o.matches.push(Object.assign({}, blankMatch, { type: 'Titelmatch', title: first ? first.name : '' })));
    }
    else if (act === 'del') edit(k, o => o.matches.splice(i, 1));
    else if (act === 'dice') {
      const r = K.diceMatch(m, m.show(k), i);
      if (r && r.error) { K.toast(r.error); return; }
      if (!r) { K.toast(/tag|team/i.test((m.show(k).matches[i] || {}).type || '') ? 'Keine zwei freien Teams in dieser Show (alle Mitglieder brauchen Vertrag, keine Verletzung, noch kein Match).' : 'Keine passende Paarung gefunden (alle schon eingeplant, verletzt oder ohne Vertrag?)'); return; }
      edit(k, o => {
        const x = o.matches[i];
        // Ein vorheriger Würfel-Grund wird ersetzt, eigene Notizen bleiben stehen
        const keep = String(x.notes || '').split('\n').filter(l => l.trim() && !/^Würfel:/.test(l));
        Object.assign(x, { winner: '', loser: '', extra: r.names.join(', '), notes: ['Würfel: ' + r.reason, ...keep].join('\n') });
        // Storyline: eine vom letzten Wurf gesetzte wird ersetzt bzw. entfernt, eine selbst eingetragene bleibt
        if (x.diceStory && x.storyline === x.diceStory) x.storyline = '';
        if (r.storyline) x.storyline = r.storyline;
        x.diceStory = r.storyline || '';
      });
      K.toast('Gewürfelt: ' + r.names.join(' vs. '));
    }
    else return;
    K.rebuild();
  }, true);

  // Eingaben im Editor: Text wird beim Tippen gespeichert (ohne neu aufzubauen, sonst springt der Cursor).
  const grow = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
  const keyOf = v => (isNaN(Number(v)) ? v : Number(v));
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'ev-name' && K.state.addEvent) { K.state.addEvent.name = t.value; return; }
    // Info-Notiz der Show (Liste und Editor)
    if (t.dataset.info !== undefined) { const k = keyOf(t.dataset.info); K.store.update(st => { st.shows[k] = Object.assign({}, st.shows[k], { info: t.value }); }); grow(t); return; }
    // Notiz eines Matches direkt in der Liste
    if (t.dataset.mnote !== undefined) { const k = keyOf(t.dataset.mnote); ensureOwn(model(), k); edit(k, o => { o.matches[Number(t.dataset.i)].notes = t.value; }); grow(t); return; }
    const k = key(); if (k === null || k === undefined || !own(k)) return;
    if (t.dataset.sm && t.type !== 'checkbox' && t.tagName !== 'SELECT') {
      edit(k, o => { o.matches[Number(t.dataset.i)][t.dataset.sm] = t.value; });
      if (['winner', 'loser', 'extra'].includes(t.dataset.sm)) refreshBet();
      if (t.tagName === 'TEXTAREA') grow(t);
    }
    else if (t.dataset.sv && t.tagName !== 'SELECT') edit(k, o => { if (t.dataset.sv === 'name') o.name = t.value; else o.venue = Object.assign({}, SR().DEFAULT_VENUE, o.venue, { [t.dataset.sv]: t.value }); });
  });
  document.addEventListener('change', e => {
    const t = e.target, st = K.state;
    if (t.id === 'ev-type' && st.addEvent) { st.addEvent.type = t.value; K.render(); return; }
    if (t.id === 'ev-month' && st.addEvent) { st.addEvent.month = Number(t.value); return; }
    if (t.id === 'ev-day' && st.addEvent) { st.addEvent.day = Number(t.value); return; }
    const k = key(); if (k === null || k === undefined) return;
    if (t.dataset.sv === 'order') { setDayOrder(k, Number(t.value)); return; }
    if (!own(k)) return;
    if (t.dataset.sm === 'bet') { edit(k, o => o.matches.forEach((x, j) => { x.bet = j === Number(t.dataset.i) ? t.checked : false; })); K.rebuild(); }
    else if (t.dataset.sm) {
      edit(k, o => { o.matches[Number(t.dataset.i)][t.dataset.sm] = t.value; });   // z. B. Name aus den Vorschlägen, Titel
      if (['winner', 'loser', 'extra', 'type'].includes(t.dataset.sm) && blockInjured(k, Number(t.dataset.i))) return;
      refreshBet();
    }
    else if (t.dataset.sv === 'halle') { edit(k, o => { o.venue = Object.assign({}, SR().DEFAULT_VENUE, o.venue, { halle: t.value }); }); K.rebuild(); }
  });

  /* ───────────── Sterne: Wert aus der Mausposition (linke Hälfte = halber Stern), Vorschau beim Überfahren ───────────── */
  function starValue(sp, e) {
    const r = sp.getBoundingClientRect(), n = Number(sp.dataset.n);
    return e.clientX < r.left + r.width / 2 ? n - 0.5 : n;   // 0,5 bis 5
  }
  const paint = (pick, v) => pick.querySelectorAll('.sp').forEach(sp => { const n = Number(sp.dataset.n); sp.firstChild.style.width = (v >= n ? 100 : v >= n - 0.5 ? 50 : 0) + '%'; });
  document.addEventListener('mousemove', e => {
    const sp = e.target.closest && e.target.closest('.star-pick .sp');
    if (!sp) return;
    const pick = sp.parentElement, v = starValue(sp, e);
    paint(pick, v); pick.classList.add('preview');
    pick.querySelector('.sp-val').textContent = fmt(v, v % 1 ? 1 : 0);
  });
  document.addEventListener('mouseout', e => {
    const pick = e.target.closest && e.target.closest('.star-pick');
    if (!pick || (e.relatedTarget && pick.contains(e.relatedTarget))) return;
    const v = pick.dataset.spV === '' ? 0 : Number(pick.dataset.spV);
    paint(pick, v); pick.classList.remove('preview');
    pick.querySelector('.sp-val').textContent = v ? fmt(v, v % 1 ? 1 : 0) : '';
  });

  /* ───────────── Editor: Zeilen am Griff ziehen ───────────── */
  let dragRow = null;
  document.addEventListener('mousedown', e => {
    const h = e.target.closest('.edit-table .drag-h');
    if (h) h.parentElement.draggable = true;
  });
  document.addEventListener('dragstart', e => {
    const tr = e.target.closest && e.target.closest('.edit-table tr[data-row]');
    if (!tr || !tr.draggable) return;
    dragRow = Number(tr.dataset.row);
    tr.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragRow));
  });
  document.addEventListener('dragover', e => {
    if (dragRow === null) return;
    const tr = e.target.closest && e.target.closest('.edit-table tr[data-row]');
    if (!tr) return;
    e.preventDefault();
    const r = tr.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
    document.querySelectorAll('.edit-table tr.drop-before, .edit-table tr.drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after'));
    tr.classList.add(after ? 'drop-after' : 'drop-before');
  });
  document.addEventListener('drop', e => {
    if (dragRow === null) return;
    const tr = e.target.closest && e.target.closest('.edit-table tr[data-row]');
    if (!tr) return;
    e.preventDefault();
    const to = Number(tr.dataset.row) + (tr.classList.contains('drop-after') ? 1 : 0), from = dragRow, k = key();
    dragRow = null;
    if (k !== null && k !== undefined) edit(k, o => { const [x] = o.matches.splice(from, 1); o.matches.splice(to > from ? to - 1 : to, 0, x); });
    K.rebuild();
  });
  document.addEventListener('dragend', () => {
    dragRow = null;
    document.querySelectorAll('.edit-table tr').forEach(x => { x.draggable = false; x.classList.remove('dragging', 'drop-before', 'drop-after'); });
  });

  // Notizfelder wachsen mit ihrem Inhalt
  K.afterRender = K.afterRender || [];
  K.afterRender.push(view => { if (view === 'shows') document.querySelectorAll('.m-note-in, .info-in, .edit-table .note-in').forEach(grow); });

  /* ───────────── Kalender blättert beim Scrollen mit ───────────── */
  function refreshCal() {
    const box = document.getElementById('cal-box'), m = model();
    if (!box || !m) return;
    box.outerHTML = calHtml(m, K.state);
  }
  let ticking = false;
  document.addEventListener('scroll', e => {
    if (ticking || !e.target.classList || !e.target.classList.contains('main')) return;
    const st = K.state;
    if (!st || st.view !== 'shows' || (st.editShow !== null && st.editShow !== undefined) || st.calYear) return;
    ticking = true;
    setTimeout(() => {
      ticking = false;
      const items = document.querySelectorAll('.show-item');
      for (const el of items) {
        if (el.getBoundingClientRect().bottom > 140) {
          const month = Number(el.dataset.month);
          if (month !== st.calMonth) { st.calMonth = month; refreshCal(); }
          break;
        }
      }
    }, 60);
  }, true);
})(window.KHW);
