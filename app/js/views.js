// KHW Manager – Ansichten. Jede Ansicht liefert HTML aus dem Modell; geschrieben wird nirgends.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc, nl, eur, fmt } = K;

  /* ───────────── Bausteine ───────────── */
  const icon = n => `<span class="ms">${n}</span>`;
  // opt.logo: Name einer Show mit Logo – dann steht das Logo statt des Titeltexts
  const card = (title, body, opt = {}) => `<section class="card ${opt.cls || ''}">${title ? `<header class="card-h"><h3>${opt.icon ? icon(opt.icon) : ''}${opt.logo && K.LOGOS && K.LOGOS[opt.logo] ? K.logo(opt.logo, 'card-logo') : esc(title)}</h3>${opt.aside || ''}</header>` : ''}<div class="card-b">${body}</div></section>`;
  const chip = (t, cls = '') => t ? `<span class="chip ${cls}">${esc(t)}</span>` : '';
  const tier = s => s ? `<span class="tier tier-${K.STATUS_SHORT[s] || 'x'}" title="${esc(s)}">${K.STATUS_SHORT[s] || esc(s)}</span>` : '';
  const align = a => a ? `<span class="align align-${esc(a.toLowerCase())}">${esc(a)}</span>` : '';
  const empty = t => `<p class="empty">${esc(t)}</p>`;
  const kv = rows => `<dl class="kv">${rows.filter(r => r && r[1] !== '' && r[1] !== null && r[1] !== undefined).map(r => `<dt>${esc(r[0])}</dt><dd>${r[2] ? r[1] : esc(r[1])}</dd>`).join('')}</dl>`;
  const stars = x => (x === null || x === undefined) ? '' : `<span class="stars">${fmt(x, x % 1 ? 1 : 0)}<span class="ms sm">star</span></span>`;
  const signed = x => `<span class="${x < 0 ? 'neg' : 'pos'}">${eur(x)}</span>`;
  // style: optional, z. B. K.seriesStyle(show) für die eigene Farbe einer Showreihe
  // Logos der Shows (Ordner img im Projekt). Wo es ein Logo gibt, steht es statt des Text-Chips.
  K.LOGOS = { TryOut: '../img/logos/TryOut.png', Lucky7: '../img/logos/Lucky7.png', KHW: '../img/logos/KHW%20Logo%20W.png' };
  K.logo = (name, cls) => (K.LOGOS[name] ? `<img class="show-logo ${cls || ''}" src="${K.LOGOS[name]}" alt="${esc(name)}" title="${esc(name)}">` : '');
  const showChip = (t, label, style) => !t ? '' : K.LOGOS[t] && (!label || label === t) ? K.logo(t) : `<span class="chip show-${esc(t)}"${style || ''}>${esc(label || t)}</span>`;

  let M = null;
  /** Name als Link zur Kartei (Wrestler aus der Datenbank oder Team aus „Teams und Stables“). */
  const wl = name => {
    if (!name) return '';
    if (M.byName.has(name)) return `<a class="wl" data-wrestler="${esc(name)}">${esc(name)}</a>`;
    if (M.teamByName && M.teamByName.has(name)) return `<a class="wl" data-team="${esc(name)}">${esc(name)}</a>`;
    return esc(name);
  };
  const wlList = s => K.splitNames(s).map(wl).join(', ');
  const countdown = (target, doneText, fallback) => target
    ? `<span class="countdown" data-until="${target.getTime()}" data-done="${esc(doneText)}"></span>` : esc(fallback || '');

  /* ───────────── Card-Tabelle ───────────── */
  function matchTable(show) {
    if (!show.matches.length) return empty('Für diese Show ist noch nichts eingetragen.');
    // Farbig hinterlegte Namen in der Tabelle = der Wrestler hatte einen Eintrag im Verletzungsstatus
    const hurt = (mt, k) => mt.marks[k] ? `<span class="ms sm hurt" title="War zu diesem Zeitpunkt mit einem Verletzungsstatus eingetragen">healing</span>` : '';
    const rows = show.matches.map(mt => {
      const versus = (mt.winner && mt.loser)
        ? `<div class="vs"><span class="win">${wlList(mt.winner)}${hurt(mt, 'winner')}</span><span class="vs-x">besiegt</span><span class="lose">${wlList(mt.loser)}${hurt(mt, 'loser')}</span></div>`
        : mt.winner ? `<div class="vs"><span class="vs-x">Sieger:</span><span class="win">${wlList(mt.winner)}${hurt(mt, 'winner')}</span></div>`
        : mt.loser ? `<div class="vs"><span class="vs-x">Verlierer:</span><span class="lose">${wlList(mt.loser)}${hurt(mt, 'loser')}</span></div>` : '';
      const extra = mt.extra ? `<div class="extra">${(mt.winner || mt.loser) ? 'Weitere: ' : ''}${wlList(mt.extra)}${hurt(mt, 'extra')}</div>` : '';
      const notes = [mt.notes, ...mt.cellNotes].filter(Boolean).map(t => `<div class="note">${nl(t)}</div>`).join('');
      const type = mt.promo ? (/promo/i.test(mt.type) ? '' : mt.type) : mt.type;
      return `<tr class="${mt.bet ? 'is-bet' : ''} ${mt.promo ? 'is-promo' : ''}">
        <td class="num">${mt.promo ? `<span class="ms sm" title="Promo / Segment">mic</span>` : (mt.no === null ? '' : fmt(mt.no))}</td>
        <td>${mt.promo ? chip('Promo', 'promo') : ''}${chip(type, 'outline')}${versus}${extra}</td>
        <td>${mt.storyline ? chip(mt.storyline, 'story') : ''}</td>
        <td class="num">${stars(mt.stars)}${mt.bonus ? '<small title="Bonus-Sterne wurden angerechnet">+Bonus</small>' : ''}</td>
        <td>${mt.bet ? chip('Wette', 'accent') : ''}</td>
        <td class="notes">${notes}</td></tr>`;
    }).join('');
    return `<div class="table-wrap"><table class="table card-table"><thead><tr><th>#</th><th>Match / Segment</th><th>Storyline</th><th>Sterne</th><th></th><th>Notizen</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function hypeBlock(show) {
    let facts = [];
    if (show.no === null) return empty('Für Sonder-Events gibt es keine Vorschau-Fakten.');
    try { facts = K.hypeFacts(M.shows.filter(s => s.no !== null), show.no); } catch (e) { return empty('Hype-Fakten konnten nicht berechnet werden: ' + e.message); }
    if (!facts.length) return empty('Keine Fakten: Dafür braucht es nummerierte Matches und eine Vorgeschichte.');
    return `<ol class="facts">${facts.map(f => `<li>${esc(f.text)}</li>`).join('')}</ol>`;
  }

  function oddsBlock(show) {
    const mt = show.matches.find(x => x.bet);
    if (!mt) return empty('In dieser Show ist kein Match als Wette markiert.');
    const o = K.betOdds(M, mt);
    if (!o) return empty('Das Wett-Match hat zu wenige Teilnehmer.');
    if (!o.list) return empty('Die Teilnehmer stehen nicht in einer gemeinsamen Rangliste: ' + o.rows.map(r => r.name).join(', '));
    return `<p class="hint">Rangliste: ${esc(o.list)}</p><table class="table"><thead><tr><th>Name</th><th>Rang</th><th>Quote</th></tr></thead><tbody>${
      o.rows.map(r => `<tr><td>${wl(r.name)}</td><td class="num">${r.rank}</td><td class="num">${fmt(r.quote, 1)} %</td></tr>`).join('')}</tbody></table>`;
  }

  const showTitle = s => s.name || (s.typeIndex ? `${s.seriesLabel || s.type} #${s.typeIndex}` : s.seriesLabel || s.type);
  const showSub = s => `${K.MONTHS[s.date.month]}${s.date.year && M && s.date.year !== M.curYear ? ` Jahr ${s.date.year}` : ''}, Woche ${s.date.week} · ${K.WEEKDAYS[s.date.dow]}${s.no ? ` · Show ${s.no}` : s.series ? '' : ` · ${s.type === 'PPV' ? 'PPV' : 'Event'}`}`;   // Reihen (auch ab Jahr 5) ohne Zusatz

  /* ───────────── Ansichten ───────────── */
  const V = {};

  V.office = {
    title: 'Büro', icon: 'home',
    render(m) {
      const f = m.finance, cur = m.show(m.currentShow), last = f.last;
      const kpi = (label, value, sub, ic) => `<div class="kpi">${icon(ic)}<div><small>${esc(label)}</small><b>${value}</b>${sub ? `<span>${sub}</span>` : ''}</div></div>`;
      const champs = m.titles.map(t => `<li><small>${esc(t.name)}</small><b>${t.holder ? wlList(t.holder.replace(/\s*&\s*/g, ', ')) || esc(t.holder) : '<i>vakant</i>'}</b></li>`).join('');
      const changes = m.statusChanges.length
        ? `<ul class="plain">${m.statusChanges.map(c => `<li>${icon(c.up ? 'arrow_upward' : 'arrow_downward')} ${wl(c.name)} ${tier(c.from)} → ${tier(c.to)}</li>`).join('')}</ul>`
        : empty('Alle Einstufungen passen zur Rangliste.');
      return `
        <div class="kpis">
          ${kpi('Kontostand', eur(f.balance), (f.entries && f.entries.length ? `zuletzt: ${esc(f.entries[f.entries.length - 1].text)}` : ''), 'account_balance')}
          ${kpi('Sterne', fmt(m.staff.stars, 2), `letzte Show: ${fmt(f.stars.lastShow, 1)}`, 'star')}
          ${kpi('Skillpunkte', fmt(m.skillPoints, 1), '', 'psychology')}
          ${kpi('Follower', fmt(f.followers), `${f.followerDelta >= 0 ? '+' : ''}${fmt(f.followerDelta)} zuletzt`, 'groups')}
          ${kpi('Nächste Show', cur ? showTitle(cur) : '–', cur ? showSub(cur) : '', 'event')}
        </div>
        <div class="grid g-2-1">
          <div>
            ${card(cur ? `Aktuelle Card: ${showTitle(cur)}` : 'Aktuelle Card', cur ? matchTable(cur) : empty('Keine Show gefunden.'), { icon: 'stadium', aside: cur ? `<a class="btn text" href="#shows">Alle Shows</a>` : '' })}
            ${card('Vorschau-Fakten', cur ? hypeBlock(cur) : '', { icon: 'campaign' })}
          </div>
          <div>
            ${card('Champions', `<ul class="champs">${champs}</ul>`, { icon: 'emoji_events' })}
            ${card('Letzte Abrechnung', kv([['Ort', last.venue + (last.ppv ? ' (PPV)' : '')], ['Zuschauer', `${fmt(last.visitors)}${last.capacity ? ' / ' + fmt(last.capacity) : ''}`], ['Gesamtgewinn', signed(last.total), true]]), { icon: 'payments', aside: '<a class="btn text" href="#finance">Details</a>' })}
            ${card('Anstehende Auf- und Abstiege', changes, { icon: 'swap_vert' })}
          </div>
        </div>`;
    },
  };

  const FIELDS = [['contractEnd', 'Vertragsende'], ['titles', 'Titel'], ['tagTeam', 'Teams'], ['stable', 'Stable'], ['storyline', 'Storyline'], ['injury', 'Verletzungsstatus'], ['gimmick', 'Gimmick'], ['notes', 'Besonderheiten']];
  const fieldVal = (w, k) => Array.isArray(w[k]) ? w[k].join(', ') : (w[k] || '');
  /**
   * Sortierwert für Felder mit Monaten (allgemeine Regel: Monate laufen nach dem Kalender, nicht alphabetisch).
   * Vertragsende hat einen fortlaufenden Monat; sonst wird eine Monatsangabe im Text erkannt („April“, „April Jahr 5“).
   */
  K.monthOrder = (w, k) => {
    if (k === 'contractEnd') return w.contractEndAbs === null || w.contractEndAbs === undefined ? null : w.contractEndAbs;
    const p = K.parseMonth(fieldVal(w, k));
    return p ? (p.year || K.YEAR) * 12 + p.month : null;
  };

  V.weeklies = {
    title: 'Weeklie Roster', icon: 'groups',
    render(m, st) {
      const key = st.weeklyField || 'contractEnd';
      const block = show => {
        const col = (g, a) => {
          // Monate nach Kalender sortieren, sonst alphabetisch
          const mo = w => K.monthOrder(w, key);
          const ws = m.roster.filter(w => w.show === show && w.gender === g && w.alignment === a)
            .sort((x, y) => (mo(x) !== null || mo(y) !== null ? (mo(x) === null ? 1e9 : mo(x)) - (mo(y) === null ? 1e9 : mo(y)) : fieldVal(x, key).localeCompare(fieldVal(y, key), 'de')) || x.name.localeCompare(y.name, 'de'));
          if (st.weeklyReverse) ws.reverse();
          // Bild wie in der Kartei beschnitten (oben ausgerichtet). Ohne Bild bleibt die Fläche frei, der Abstand gleich.
          const ava = w => w.image
            ? `<img class="ava" src="${esc(w.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">`
            : '<span class="ava"></span>';
          return `<div class="roster-col ${a.toLowerCase()}"><h4><span>${esc(a)}</span><small>${ws.length}</small></h4><ul>${ws.map(w =>
            `<li data-wrestler="${esc(w.name)}">${ava(w)}<span class="rn"><b>${esc(w.name)}</b>${tier(w.status)}</span><span class="rv">${esc(fieldVal(w, key))}</span></li>`).join('') || '<li class="none">–</li>'}</ul></div>`;
        };
        // Aktive Storylines aus der Seite „Storylines“ (mit abgehakten Punkten)
        const stories = m.storylines.filter(s => s.status === 'active' && s.show === show).map(s => ({ name: s.title, start: s.startText, steps: s.steps }));
        return card(show, `
          <div class="roster-grid"><div class="roster-group"><h5>Männer</h5><div class="roster-pair">${col('m', 'Face')}${col('m', 'Heel')}</div></div>
          <div class="roster-group"><h5>Frauen</h5><div class="roster-pair">${col('w', 'Face')}${col('w', 'Heel')}</div></div></div>
          <h5>Storylines</h5>${stories.length ? `<div class="stories">${stories.map(s => `<article><h6>${esc(s.name)}${s.start ? chip('seit ' + s.start, 'outline') : ''}</h6><ol>${s.steps.map(t => `<li class="${t.done ? 'done' : ''}">${nl(t.text)}</li>`).join('')}</ol></article>`).join('')}</div>` : empty('Keine aktive Storyline.')}<a class="btn text" href="#stories">Alle Storylines</a>`,
          { cls: 'show-' + show, logo: show });
      };
      return `<div class="toolbar"><label>Zusatzspalte <select class="field" data-set="weeklyField">${FIELDS.map(([k, l]) => `<option value="${k}" ${k === key ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" data-set="weeklyReverse" ${st.weeklyReverse ? 'checked' : ''}> Sortierung umkehren</label></div>
        ${block('TryOut')}${block('Lucky7')}`;
    },
  };

  // Bild wie in der Kartei beschnitten. Ohne Bild bleibt die Fläche frei, der Abstand gleich.
  const avatar = w => w.image
    ? `<img class="ava" src="${esc(w.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">`
    : '<span class="ava"></span>';

  // Spalten der Datenbank-Ansicht: [Schlüssel, Titel, Zelle, Klasse]. Die Reihenfolge lässt sich per Ziehen ändern.
  const RCOLS = [
    // Im Admin-Modus ist der Name direkt bearbeitbar (Enter oder Feld verlassen = umbenennen, Esc = zurück).
    ['name', 'Name', w => `<div class="rname">${avatar(w)}${K.admin && K.admin.on
      ? `<input class="cell-in name-in" data-wname="${esc(w.name)}" id="wname-${esc(w.name.replace(/[^\w]/g, '_'))}" value="${esc(w.name)}" autocomplete="off" spellcheck="false" title="Admin: umbenennen">`
      : `<b>${esc(w.name)}</b>`}${w.injury ? `<span class="ms sm hurt" title="${esc(w.injury)}">healing</span>` : ''}</div>`],
    ['show', 'Show', w => showChip(w.show)],
    ['status', 'Status', w => tier(w.status)],
    ['alignment', 'Ausrichtung', w => align(w.alignment)],
    ['promotion', 'Promotion', w => esc(w.promotion)],
    ['tagTeam', 'Teams', w => (w.teams || []).map(wl).join(', ')],
    ['titles', 'Titel', w => w.titles.map(t => chip(t, 'accent')).join('')],
    ['contractEnd', 'Vertragsende', w => (w.contractEnd ? `<span class="${w.contractEndAbs !== null && K.model && w.contractEndAbs < K.model.curAbs ? 'neg' : ''}">${esc(w.contractEnd)}</span>` : '') + (w.onceContract ? ' <small class="muted">einmalig</small>' : '')],
    // Besonderheiten direkt in der Tabelle bearbeitbar (gespeichert für beide Spieler)
    ['notes', 'Besonderheiten', w => `<textarea class="cell-in" rows="1" data-wnote="${esc(w.name)}" id="wn-${esc(w.name.replace(/[^\w]/g, '_'))}" placeholder="–">${esc(w.notes)}</textarea>`, 'notes-col'],
    ['elo', 'ELO', w => K.elo(w.elo), 'num'],
  ];
  // Im Admin-Modus zusätzlich alle übrigen Felder der Datenbank (hinten angehängt, sortierbar).
  const ADMIN_RCOLS = [
    ['gender', 'Geschlecht', w => esc(w.gender)], ['stable', 'Stable', w => esc(w.stable)],
    ['storyline', 'Storyline', w => esc(w.storyline)], ['injury', 'Verletzung', w => esc(w.injury || (w.unavailable ? 'nicht verfügbar: ' + w.unavailable : ''))], ['gimmick', 'Gimmick', w => esc(w.gimmick)],
    ['music', 'Musik', w => esc(w.music)], ['in2k', '2K25', w => (w.in2k ? 'ja' : '')], ['image', 'Bild', w => (w.image ? `<a class="btn text" href="${esc(w.image)}" target="_blank" rel="noreferrer">öffnen</a>` : '')],
    ['row', 'Zeile', w => fmt(w.row), 'num'],
  ];
  const RCOLS_KEY = 'khw.rosterCols';
  K.rosterCols = {
    all: RCOLS.map(c => c[0]),
    load() {
      let saved = [];
      try { saved = JSON.parse(localStorage.getItem(RCOLS_KEY) || '[]'); } catch (e) { /* ohne Speicher gilt die Standardreihenfolge */ }
      const known = saved.filter(k => this.all.includes(k));
      return known.concat(this.all.filter(k => !known.includes(k)));
    },
    save(order) { try { localStorage.setItem(RCOLS_KEY, JSON.stringify(order)); } catch (e) { /* nur für diese Sitzung */ } },
    reset() { try { localStorage.removeItem(RCOLS_KEY); } catch (e) { /* nichts zu tun */ } },
  };

  V.roster = {
    title: 'Datenbank', icon: 'badge',
    render(m, st) {
      const f = st.rf || (st.rf = { q: '', show: K.admin && K.admin.on ? '' : 'aktiv', promotion: '', status: '', gender: '', alignment: '' });
      const order = st.rcols || (st.rcols = K.rosterCols.load());
      const admin = K.admin && K.admin.on;
      const cols = order.map(k => RCOLS.find(c => c[0] === k)).concat(admin ? ADMIN_RCOLS : []);
      const uniq = k => [...new Set(m.roster.map(w => w[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
      const sel = (k, label, opts) => `<select class="field" data-rf="${k}"><option value="">${label}</option>${opts.map(o => `<option value="${esc(o[0])}" ${f[k] === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
      const q = f.q.toLowerCase();
      const rows = m.roster.filter(w =>
        (!q || [w.name, w.tagTeam, w.stable, w.gimmick, w.notes, w.titles.join(' ')].join(' ').toLowerCase().includes(q)) &&
        (!f.show || (f.show === 'aktiv' ? !!w.show : f.show === 'ohne' ? !w.show : w.show === f.show)) &&
        (!f.promotion || w.promotion === f.promotion) && (!f.status || w.status === f.status) &&
        (!f.gender || w.gender === f.gender) && (!f.alignment || w.alignment === f.alignment));
      const sk = st.rsort || 'name', dir = st.rdir || 1;
      rows.sort((a, b) => {
        const x = a[sk], y = b[sk];
        // Status nach Rang (Main Event → Newcomer), nicht alphabetisch; ohne Status ans Ende
        if (sk === 'status') { const r = w => { const i = K.STATUS.indexOf(w.status); return i < 0 ? 99 : i; }; return (r(a) - r(b)) * dir || a.name.localeCompare(b.name, 'de'); }
        if (typeof x === 'number' || typeof y === 'number') return ((x === null ? -1e9 : x) - (y === null ? -1e9 : y)) * dir;
        // Monate nach Kalender (und Jahr), nicht alphabetisch; leere Werte ans Ende
        const mx = K.monthOrder(a, sk), my = K.monthOrder(b, sk);
        if (mx !== null || my !== null) return ((mx === null ? 1e9 : mx) - (my === null ? 1e9 : my)) * dir || a.name.localeCompare(b.name, 'de');
        return String(fieldVal(a, sk)).localeCompare(String(fieldVal(b, sk)), 'de') * dir || a.name.localeCompare(b.name, 'de');
      });
      const moved = order.join() !== K.rosterCols.all.join();
      return `<div class="toolbar wrap">
          <input class="field grow" id="rf-q" type="search" placeholder="Suchen: Name, Team, Gimmick …" value="${esc(f.q)}" data-rf="q">
          ${sel('show', 'Alle Shows', [['aktiv', 'Aktiver Kader'], ...uniq('show').map(x => [x, x]), ['ohne', 'Ohne Show']])}
          ${sel('promotion', 'Alle Promotions', uniq('promotion').map(x => [x, x]))}
          ${sel('status', 'Jeder Status', K.STATUS.map(x => [x, x]))}
          ${sel('gender', 'm / w', [['m', 'Männer'], ['w', 'Frauen']])}
          ${sel('alignment', 'Face / Heel', [['Face', 'Face'], ['Heel', 'Heel']])}
          <span class="count">${rows.length} von ${m.roster.length}</span>
          <button class="btn tonal" data-addw>${icon('person_add')}Wrestler aufnehmen</button></div>
        <p class="hint">Spalten lassen sich am Spaltenkopf an eine andere Stelle ziehen. Ein Klick sortiert.${moved ? ' <a class="btn text" data-set="rcols" data-value="">Reihenfolge zurücksetzen</a>' : ''}${admin ? ` <span class="admin-note">${icon('shield_person')} Admin: alle Felder sichtbar. Ein Klick auf eine Zeile öffnet die Kartei zum Bearbeiten.</span>` : ''}</p>
        <div class="table-wrap"><table class="table hover db"><thead><tr>${cols.map(c =>
          `<th class="sort ${c[3] || ''}" data-sort="${c[0]}" data-col="${c[0]}" draggable="true">${c[1]}${sk === c[0] ? icon(dir > 0 ? 'arrow_drop_up' : 'arrow_drop_down') : ''}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(w => `<tr data-wrestler="${esc(w.name)}">${cols.map(c => `<td class="${c[3] || ''}">${c[2](w)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    },
  };

  V.ranking = {
    title: 'Ranking', icon: 'leaderboard',
    render(m, st) {
      const list = (title, rows, team) => `<div class="rank-col"><h5>${title}</h5><ol class="rank">${rows.map(e => `<li><span class="pos">${e.rank}</span><span class="who">${team ? `<b title="${esc(e.members.join(', '))}">${wl(e.name)}</b>` : wl(e.name)}</span>${team ? '' : tier(e.band || e.status)}${!team && e.band && e.band !== e.status ? `<span class="ms sm warn" title="Datenbank: ${esc(e.status || '–')} · Rangliste: ${esc(e.band)}">sync_problem</span>` : ''}<span class="elo">${K.elo(e.elo)}</span></li>`).join('') || '<li class="empty">–</li>'}</ol></div>`;
      // Erst die Einzelnen, dann die Teams (Teams aus „Teams und Stables“)
      const block = show => card(show, `<div class="rank-grid">${list('Männer', m.ranking[show].m.singles)}${list('Frauen', m.ranking[show].w.singles)}${list('Teams', m.ranking[show].teams, true)}</div>`, { cls: 'show-' + show, logo: show });
      const a = st.eloA || '', b = st.eloB || '';
      const ra = a ? K.ratingOf(m, a) : null, rb = b ? K.ratingOf(m, b) : null;
      const res = (ra !== null && rb !== null) ? K.eloAfter(ra, rb) : null;
      const pick = (k, v, ph) => `<input class="field" data-suggest="fighters" autocomplete="off" data-set="${k}" value="${esc(v)}" placeholder="${ph}">`;
      const calc = `<div class="toolbar wrap">${pick('eloA', a, 'Sieger')}<span>besiegt</span>${pick('eloB', b, 'Verlierer')}</div>
        ${res ? kv([[`${a} (Sieger)`, `${K.elo(ra)} → <b>${K.elo(res.winner)}</b> <span class="pos">+${fmt(res.delta, 1)}</span>`, true], [`${b} (Verlierer)`, `${K.elo(rb)} → <b>${K.elo(res.loser)}</b> <span class="neg">−${fmt(res.delta, 1)}</span>`, true]]) : `<p class="hint">Zwei Namen wählen, um die ELO-Änderung eines Matches vorab zu sehen (K-Faktor 32). Team-Namen zählen mit dem Durchschnitt ihrer Mitglieder.</p>`}`;
      return `${card('ELO-Rechner', calc, { icon: 'calculate' })}${block('TryOut')}${block('Lucky7')}
        <p class="hint">Die Farbe zeigt den Status, den die Platzierung vorgibt. ${icon('sync_problem')} bedeutet: In der Datenbank steht noch ein anderer Status.</p>`;
    },
  };

  // Bild je Titel: Adresse aus dem Regelwerk (Titel → Bild), sonst der Platzhalter aus img/titel
  K.TITLE_IMG = '../img/titel/Titel.png';
  K.titleImage = name => (((K.conf.get('titles') || {}).images || {})[name]) || K.TITLE_IMG;

  V.titles = {
    title: 'Titel', icon: 'emoji_events',
    // Gruppiert ausschließlich nach der aktuellen Vergabe: Ein Titel steht bei der Show seines Trägers
    // (bei Teams oder mehreren Trägern die Show der meisten). Haupttitel je Show (Regelwerk) stehen groß vorne.
    render(m) {
      const people = n => (m.byName.has(n) ? [m.byName.get(n)] : (K.teamMembers(m, n) || []).map(x => m.byName.get(x)).filter(Boolean));
      const showOf = t => {
        if (!t.holder) return null;
        const c = {}; t.holder.split(/\s*&\s*/).flatMap(people).forEach(w => { if (w.show) c[w.show] = (c[w.show] || 0) + 1; });
        return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || '';
      };
      const main = (K.conf.get('titles') || {}).main || {};
      const isMain = (show, t) => !!main[show] && (main[show].m === t.name || main[show].w === t.name);
      // Regentschaft in Wochen: gezählt ab einem Titelwechsel in der App (Wechsel aus der Tabelle haben kein Datum)
      const wkOf = key => { const s = key === null || key === undefined ? null : m.show(key); return s ? K.weekIdx(s.date) : null; };
      const weeks = n => (n === null ? '' : `<span class="reign">${n <= 0 ? '< 1 Woche' : `${n} ${n === 1 ? 'Woche' : 'Wochen'}`}</span>`);
      const reignsOf = t => {
        const r = (t.reigns || [...t.former.slice().reverse(), ...(t.holder ? [t.holder] : [])].map(h => ({ holder: h, show: null }))).map(x => Object.assign({ start: wkOf(x.show) }, x));
        return r.map((x, i) => Object.assign(x, { len: x.start === null ? null : (i < r.length - 1 ? (r[i + 1].start === null ? null : r[i + 1].start - x.start) : m.curWeek - x.start) }));
      };
      const beltCard = (t, big) => {
        const r = reignsOf(t), cur = t.holder && r.length && r[r.length - 1].holder === t.holder ? r[r.length - 1] : null;
        const past = (cur ? r.slice(0, -1) : r).reverse();
        return `<section class="card belt ${t.holder ? '' : 'vacant'} ${big ? 'main-belt' : ''}"><div class="card-b">
        ${big ? `<span class="belt-tag">${icon('workspace_premium')}Haupttitel</span>` : ''}
        <img class="belt-img" src="${esc(K.titleImage(t.name))}" alt="" referrerpolicy="no-referrer" onerror="this.src='${K.TITLE_IMG}'"><small>${esc(t.name)}</small>
        <h3>${t.holder ? (wlList(t.holder.replace(/\s*&\s*/g, ', ')) || esc(t.holder)) : 'Vakant'}</h3>
        ${cur && cur.len !== null ? `<small class="reign-now">${icon('schedule')}seit ${cur.len <= 0 ? 'dieser Woche' : `${cur.len} ${cur.len === 1 ? 'Woche' : 'Wochen'}`}</small>` : ''}
        ${past.length ? `<details><summary>${past.length} frühere Träger</summary><ol>${past.map(x => `<li>${esc(x.holder)}${weeks(x.len)}</li>`).join('')}</ol></details>` : ''}</div></section>`;
      };
      const byName = (a, b) => a.name.localeCompare(b.name, 'de');
      const groups = K.khwShows().map(show => ({ show, list: m.titles.filter(t => showOf(t) === show) }))
        .concat([{ show: '', label: 'Träger ohne KHW-Show', list: m.titles.filter(t => showOf(t) === '') }, { show: null, label: 'Vakant', list: m.titles.filter(t => !t.holder) }]);
      return groups.filter(g => g.list.length).map(g => {
        const mains = g.show ? g.list.filter(t => isMain(g.show, t)).sort((a, b) => (main[g.show].m === a.name ? -1 : 1)) : [];
        const rest = g.list.filter(t => !mains.includes(t)).sort(byName);
        const head = g.show ? `<h4 class="section title-show">${K.logo(g.show, 'title-logo') || ''}${esc(g.show)}</h4>` : `<h4 class="section">${esc(g.label)}</h4>`;
        return `${head}${mains.length ? `<div class="grid g-2 main-belts">${mains.map(t => beltCard(t, true)).join('')}</div>` : ''}${rest.length ? `<div class="grid g-4">${rest.map(t => beltCard(t)).join('')}</div>` : ''}`;
      }).join('');
    },
  };

  /* Rabatte (Store und Veranstaltungsorte getrennt) und Store-Artikel zum Kaufen */
  const discountSel = kind => { const d = K.discount ? K.discount(kind) : 0; return `<label class="disc-sel" title="Rabatt">${icon('sell')}<select class="field" data-disc="${kind}">${[...new Set([0, ...K.conf.get('finance').discounts, d])].sort((a, b) => a - b).map(v => `<option value="${v}" ${v === d ? 'selected' : ''}>${v ? v + ' % Rabatt' : 'Kein Rabatt'}</option>`).join('')}</select></label>`; };
  const discounted = (price, d, on) => on && d ? `<s class="muted">${eur(price, true)}</s> ${eur(price * (1 - d / 100), true)}` : eur(price, true);
  function storeList(f) {
    const d = K.discount ? K.discount('store') : 0;
    return `<table class="table slim hover store-tbl">${f.store.map((x, i) => `<tr data-buy="${i}" title="${esc(x.name)} kaufen"><td>${esc(x.name)}${x.discountable ? '' : ' <small class="muted" title="Für diesen Artikel gilt kein Rabatt">fest</small>'}</td><td class="num">${discounted(x.price, d, x.discountable)}</td><td class="buy-ic">${icon('add_shopping_cart')}</td></tr>`).join('')}</table>
      <p class="hint">Zum Kaufen auf einen Artikel klicken. ${d ? `Rabatt ${d} % gilt für alle Artikel ohne „fest“.` : ''}</p>`;
  }

  /** Vollständige Abrechnung einer Show (Tickets, Streaming, Merch, Sponsoring, VIP, Wette, Extras). */
  function billing(L, f) {
    const line = (l, v, cls = '') => `<tr class="${cls}"><td>${esc(l)}</td><td class="num">${v}</td></tr>`;
    const tbl = rows => `<table class="table slim">${rows.join('')}</table>`;
    const flags = [L.ppv && 'PPV', L.ads && 'Werbung', L.sponsoring && 'Großes Sponsoring'].filter(Boolean);
    return `${L.assumed ? '<p class="hint">Besondere Arena: Die Werte sind vorläufig angenommen (in der Tabelle gibt es dafür keine Formeln).</p>' : ''}
            <div class="chips">${flags.map(x => chip(x, 'accent')).join('')}${chip(`${fmt(L.visitors)}${L.capacity ? ' / ' + fmt(L.capacity) : ''} Zuschauer`, 'outline')}</div>
            <div class="grid g-2 tight">
              <div><h5>Tickets</h5>${tbl([...L.tickets.map(t => line(`${t.label} · ${fmt(t.sold + t.byAds + t.byTier)} × ${eur(t.price)}`, eur(t.revenue))), line('Miete und Produktion', eur(-L.rent)), L.rentDiscount ? line(`davon Rabatt ${L.discount} %`, `<span class="pos">${eur(L.rentDiscount)}</span>`) : '', line('Gewinn', signed(L.ticketProfit), 'sum')])}</div>
              <div><h5>Streaming</h5>${tbl([line(`${fmt(L.stream.count)} Streams × ${eur(L.stream.price)}`, eur(L.stream.price * L.stream.count)), line(`Durch Werbung (${fmt(L.stream.byAds)})`, eur(L.stream.price * L.stream.byAds)), line(`Stufenbonus (${fmt(L.stream.byTier)})`, eur(L.stream.price * L.stream.byTier)), line('Produktion und Internet', eur(-L.stream.cost)), line('Gewinn', signed(L.streamProfit), 'sum')])}</div>
              <div><h5>Merchandising</h5>${tbl([...L.merch.map(x => line(x.label, eur(x.onsite + x.online))), line('Personal', eur(-L.staffCost)), line('Gewinn', signed(L.merchProfit), 'sum')])}</div>
              <div><h5>Sponsoring und Werbung</h5>${tbl([line('Sponsoring inkl. Stufenbonus', eur(L.sponsor.base)), line('Großes Sponsoring', eur(L.sponsor.big)), ...L.adCosts.map(x => line(x[0], eur(-x[1]))), L.adDiscount ? line('Rabatt', eur(L.adDiscount)) : '', line('Gewinn', signed(L.sponsorProfit), 'sum')])}</div>
              <div><h5>VIP-Tickets</h5>${tbl([...L.vip.map(x => line(`${x.label} · ${fmt(x.sold)} × ${eur(x.price)}`, eur(x.price * x.sold))), line('Versicherung', eur(-L.insurance)), line('Gewinn', signed(L.vipProfit), 'sum')])}</div>
              <div><h5>Wette</h5>${f.bets.length ? tbl([...f.bets.map((b, i) => line(`${b.name} · Rang ${fmt(b.rank)} · ${fmt(b.quote, 1)} %`, i === 0 ? signed(b.gain) : `<span class="muted">${eur(b.gain)}</span>`)), line(L.dummy ? 'Ausgezahlt auf den Sieger' : 'Gezählt wird die erste Zeile', signed(L.betGain), 'sum')]) : empty(L.betNote || 'Keine Wette.')}</div>
              ${L.dummy && (L.fees.ads || L.fees.sponsoring) ? `<div><h5>Extras</h5>${tbl([L.fees.ads ? line('Werbung', eur(-L.fees.ads)) : '', L.fees.sponsoring ? line('Großes Sponsoring', eur(-L.fees.sponsoring)) : '', L.discount ? line(`Rabatt ${L.discount} % bereits abgezogen`, '') : ''])}</div>` : ''}
            </div>`;
  }

  V.finance = {
    title: 'Finanzen', icon: 'payments',
    render(m) {
      const f = m.finance, L = f.last;
      const line = (l, v, cls = '') => `<tr class="${cls}"><td>${esc(l)}</td><td class="num">${v}</td></tr>`;
      const tbl = rows => `<table class="table slim">${rows.join('')}</table>`;
      const diff = L.sheetTotal !== null && Math.abs(L.sheetTotal - L.total) > 0.01;
      return `
        <div class="kpis">
          <div class="kpi">${icon('account_balance')}<div><small>Kontostand</small><b>${eur(f.balance)}</b><span>${f.entries && f.entries.length ? `zuletzt: ${esc(f.entries[f.entries.length - 1].text)}` : ''}</span></div></div>
          <div class="kpi">${icon('trending_up')}<div><small>Gewinn letzte Show</small><b>${signed(L.total)}</b><span>${esc(L.venue)}${diff ? ` · Tabelle: ${eur(L.sheetTotal)}` : ''}</span></div></div>
          <div class="kpi">${icon('groups')}<div><small>Follower</small><b>${fmt(f.followers)}</b><span>${f.followerDelta >= 0 ? '+' : ''}${fmt(f.followerDelta)} zuletzt</span></div></div>
          <div class="kpi">${icon('subscriptions')}<div><small>KHW+ / PPV</small><b>${eur(f.prices.abo)} / ${eur(f.prices.ppv)}</b><span>Monatspreis / PPV-Preis</span></div></div>
        </div>
        ${K.endShowCard ? K.endShowCard(m) : ''}
        ${K.endShowSummary ? K.endShowSummary(L, f) : ''}
        <div class="grid g-2-1"><div>
          ${L.dummy ? '' : card(`Abrechnung: ${L.venue}`, billing(L, f), { icon: 'receipt_long', aside: `<b class="total">${signed(L.total)}</b>` })}
          ${K.frame('bank', {
            url: 'online.bankhaus-goldzahn.de/konto/umsaetze',
            brand: `<div class="xf-brand bank-brand"><span class="bank-logo">G</span><div><b>Bankhaus Goldzahn &amp; Söhne</b><small>Geschäftskonto Knight &amp; Hustler Wrestling · IBAN DE00 3702 9418 2265 6031 92</small></div>
              <span class="grow"></span><span class="bank-bal"><small>Saldo</small><b>${eur(f.balance)}</b></span></div>`,
          }, card('Kontobewegungen', `<ol class="ledger">${(f.entries || []).map(x => `<li class="${x.carry ? 'carry' : ''}" title="${esc(x.text)}"><span>${esc(x.text)}${x.manual ? ' <small>(von Hand)</small>' : ''}</span>${signed(x.amount)}</li>`).join('')}</ol>`,
            { icon: 'list_alt', aside: `<span class="ledger-aside"><small>die letzten ${K.store.KEEP_BOOKINGS}</small><button class="btn tonal sm" data-ledger="add">${icon('add')}Buchung hinzufügen</button></span>` }))}
        </div><div>
          ${card('Follower-Stufen', f.tiers.map(t => `<div class="tierbar"><div><b>${esc(t.label)}</b>${chip('Stufe ' + t.level, 'accent')}</div><div class="bar"><i style="width:${Math.min(100, f.followers / (t.steps[t.steps.length - 1] || 1) * 100)}%"></i>${t.steps.map(s => `<u style="left:${s / t.steps[t.steps.length - 1] * 100}%"></u>`).join('')}</div><small>${t.next ? `Nächste Stufe ab ${fmt(t.next)} Followern` : 'Höchste Stufe erreicht'}</small></div>`).join(''), { icon: 'stairs' })}
          ${card('Store', storeList(f), { icon: 'storefront', aside: (K.admin && K.admin.on ? `<a class="btn icon" href="#rules" data-set="rwTab" data-value="store" title="Admin: Artikel bearbeiten">${icon('edit')}</a>` : '') + discountSel('store') })}
          ${card('Veranstaltungsorte und Extras', tbl(f.venues.map(x => line(x.name, discounted(x.price, K.discount ? K.discount('venue') : 0, true)))) + '<p class="hint">Der Rabatt gilt für Miete, Werbung und Großes Sponsoring beim Beenden der Show.</p>', { icon: 'location_city', aside: discountSel('venue') })}
          ${card('Vertragsklauseln', kv([['Werbung', f.adClause.map(wl).join(', ') || '–', true], ['Selbstbeteiligung Behandlungskosten', f.medicalClause.map(wl).join(', ') || '–', true]]), { icon: 'gavel' })}
        </div></div>`;
    },
  };

  /**
   * Ausbau des Lagers wie der Store: per Klick kaufen, aber gestaffelt – nur die nächste Stufe ist kaufbar.
   * Gekaufte Stufen sind abgehakt, spätere gesperrt.
   */
  function upgradeList(s) {
    const next = s.upgrades.find(u => s.capacity !== null && u.slots > s.capacity);
    return `<table class="table slim hover store-tbl up-tbl">${s.upgrades.map(u => {
      const done = s.capacity !== null && u.slots <= s.capacity, isNext = u === next;
      return `<tr class="${done ? 'done' : isNext ? '' : 'locked'}" ${isNext ? `data-upgrade="${u.slots}" title="Ausbau auf ${u.slots} Plätze kaufen"` : ''}>
        <td>${icon(done ? 'check_circle' : isNext ? 'add_circle' : 'lock')}${u.slots} Plätze${u.slots === s.capacity ? ' ' + chip('aktuell', 'accent') : ''}</td>
        <td class="num">${done ? '<span class="muted">gekauft</span>' : u.price ? eur(u.price, true) : 'frei'}</td></tr>`;
    }).join('')}</table>
      <p class="hint">${next ? `Als Nächstes: ${next.slots} Plätze. Zum Kaufen auf die Stufe klicken, danach wird die folgende frei.` : 'Höchste Stufe erreicht.'}</p>`;
  }
  // Ausbau kaufen (gebucht wie ein Store-Kauf)
  document.addEventListener('click', e => {
    const row = e.target.closest('[data-upgrade]');
    if (!row || !M) return;
    const s = M.storage, u = s.upgrades.find(x => x.slots === Number(row.dataset.upgrade));
    if (!u || (s.capacity !== null && u.slots <= s.capacity)) return;
    const price = -Math.abs(u.price || 0);
    K.dialog.confirm({ title: 'Lager ausbauen?', icon: 'upgrade', ok: 'Kaufen', text: `Auf ${u.slots} Plätze\nPreis: ${eur(price)}\n\nDer Betrag wird sofort vom Konto gebucht.` })
      .then(yes => {
        if (!yes) return;
        K.store.update(st => { st.storage = Object.assign({}, st.storage, { capacity: u.slots }); if (price) st.bookings.push({ text: `Lager: Ausbau auf ${u.slots} Plätze`, amount: price, show: M.currentShow }); });
        K.rebuild(); K.toast(`Lager ausgebaut: ${u.slots} Plätze`);      });
  });

  /* Einlagern (Plus im ersten freien Platz) und – nur Admin – Entfernen. Gemeinsamer Stand: store.storage.added / .removed */
  const parseRgb = t => {
    const s = String(t || '').trim();
    if (!s) return { rgb: null };
    const hex = /^#?([0-9a-f]{6})$/i.exec(s);
    if (hex) return { rgb: [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)) };
    const n = s.match(/\d+/g);
    if (!n || n.length !== 3 || n.some(x => Number(x) > 255)) return { error: 'RGB bitte als drei Zahlen von 0 bis 255, z. B. 7/16/58 (oder #07103A).' };
    return { rgb: n.map(Number) };
  };
  function addItem(cat, note) {
    K.dialog.form({
      title: 'Neuen Gegenstand einlagern', icon: 'add_box', ok: 'Einlagern',
      text: (note ? note + '\n\n' : '') + 'Belegt einen freien Platz im Lager.',
      fields: [
        { id: 'category', label: 'Kategorie', type: 'select', value: cat || K.STORAGE_CATS[0], options: K.STORAGE_CATS.map(c => [c, c]) },
        { id: 'label', label: 'Name', placeholder: 'z. B. Blau, Gold-Schwarz, Leiter …' },
        { id: 'rgb', label: 'RGB-Wert (optional)', placeholder: 'z. B. 7/16/58' },
        { id: 'image', label: 'Bild-Adresse (optional)', placeholder: 'https://… – leer = Bild der Kategorie' },
      ],
    }).then(v => {
      if (!v) return;
      const label = v.label.trim(), c = parseRgb(v.rgb), image = (v.image || '').trim();
      if (!label) { addItem(v.category, 'Bitte einen Namen eingeben.'); return; }
      if (c.error) { addItem(v.category, c.error); return; }
      const s = M.storage, have = s.items.filter(i => i.count >= 1).length;
      if (s.capacity && have >= s.capacity) { K.toast('Kein freier Platz mehr – erst das Lager ausbauen.'); return; }
      const id = 'a' + Date.now().toString(36);
      K.store.update(st => { st.storage = Object.assign({}, st.storage); st.storage.added = (st.storage.added || []).concat({ id, category: v.category, label, rgb: c.rgb, count: 1, image }); });
      K.rebuild(); K.toast(`Eingelagert: ${v.category} – ${label}`);
    });
  }
  // Lager: farbige Kachel per Klick umdrehen (nur diese Kachel, ohne die Seite neu aufzubauen)
  document.addEventListener('click', e => {
    const s = e.target.closest('[data-inv-color]');
    if (!s || e.target.closest('.inv-del')) return;
    s.classList.toggle('open');
  });

  // Tresor: Platz unbegrenzt; Einträge sind freie Texte (gemeinsamer Stand: storage.vaultAdded / .vaultRemoved)
  document.addEventListener('click', e => {
    if (!M) return;
    if (e.target.closest('[data-vault-add]')) {
      K.dialog.form({ title: 'In den Tresor legen', icon: 'diamond', ok: 'Hinzufügen', fields: [
        { id: 'text', label: 'Was kommt in den Tresor?', placeholder: 'z. B. Ein altes Buch mit kryptischem Inhalt' },
        { id: 'image', label: 'Bild-Adresse (optional)', placeholder: 'https://… – leer = Diamant-Symbol' }] })
        .then(v => {
          const text = v && v.text.trim(); if (!text) return;
          const image = (v.image || '').trim();
          K.store.update(st => { st.storage = Object.assign({}, st.storage); st.storage.vaultAdded = (st.storage.vaultAdded || []).concat({ id: 'v' + Date.now().toString(36), text, image }); });
          K.rebuild(); K.toast('Im Tresor: ' + text);
        });
      return;
    }
    const del = e.target.closest('[data-vault-del]');
    if (!del || !(K.admin && K.admin.on)) return;
    const v = M.storage.vault.find(x => x.key === del.dataset.vaultDel); if (!v) return;
    K.dialog.confirm({ title: 'Aus dem Tresor entfernen?', icon: 'delete', danger: true, ok: 'Entfernen', text: `${v.text}\n\nDer Eintrag verschwindet für beide Spieler.` })
      .then(yes => {
        if (!yes) return;
        K.store.update(st => {
          st.storage = Object.assign({}, st.storage);
          if (v.own) st.storage.vaultAdded = (st.storage.vaultAdded || []).filter(x => x.id !== v.key);
          else st.storage.vaultRemoved = (st.storage.vaultRemoved || []).concat(v.key);
        });
        K.rebuild(); K.toast('Entfernt: ' + v.text);
      });
  });
  document.addEventListener('click', e => {
    const add = e.target.closest('[data-inv-add]');
    if (add && M) { addItem(add.dataset.invAdd); return; }
    const del = e.target.closest('[data-inv-del]');
    if (!del || !M || !(K.admin && K.admin.on)) return;
    e.stopPropagation();
    const no = /^\d+$/.test(del.dataset.invDel) ? Number(del.dataset.invDel) : del.dataset.invDel;
    const it = M.storage.items.find(i => i.no === no); if (!it) return;
    K.dialog.confirm({ title: `${it.label} entfernen?`, icon: 'delete', danger: true, ok: 'Entfernen', text: `${it.name}\n\nDer Gegenstand verschwindet aus dem Lager (für beide Spieler).` })
      .then(yes => {
        if (!yes) return;
        K.store.update(st => {
          st.storage = Object.assign({}, st.storage);
          if (it.own) st.storage.added = (st.storage.added || []).filter(a => a.id !== no);
          else st.storage.removed = (st.storage.removed || []).concat(no);
        });
        K.rebuild(); K.toast(`Entfernt: ${it.label}`);
      });
  }, true);

  const STORAGE_ICON = { Apron: 'curtains', Bodenmatte: 'texture', Pfosten: 'view_column', Ringabsperrung: 'fence', Ringboden: 'grid_on', Ringseile: 'linear_scale', 'Säule': 'account_balance', Treppen: 'stairs', Requisite: 'category' };

  V.storage = {
    title: 'Lager', icon: 'inventory_2',
    render(m, st) {
      const s = m.storage;
      const cats = [...new Set(s.items.map(i => i.category))];
      const cat = cats.includes(st.storageCat) ? st.storageCat : '';
      const have = s.items.filter(i => i.count >= 1);   // Gegenstände mit 0 Stück werden nicht angezeigt
      const shown = have.filter(i => !cat || i.category === cat);
      // Farbige Gegenstände tragen ein Farbdreieck unten rechts; ein Klick zeigt die RGB-Werte.
      const admin = K.admin && K.admin.on;
      // Farbige Gegenstände: Ein Klick lässt die farbige Ecke über die ganze Kachel wischen; dann stehen nur Symbol
      // und RGB-Wert da (Schrift schwarz oder weiß, je nach Helligkeit). Ohne Neuaufbau, damit die Animation läuft.
      const slot = i => {
        const rgb = i.color ? i.color.match(/\d+/g).map(Number) : null;
        const onColor = rgb && (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) > 150 ? '#000' : '#fff';
        return `<div class="inv-slot ${i.color ? 'has-color' : ''}" title="${esc(i.name)} · ${fmt(i.count)} Stück${i.color ? ' · Klick zeigt die Farbe' : ''}"
            ${i.color ? `data-inv-color style="--on-color:${onColor}"` : ''}>
          ${admin ? `<button class="inv-del" data-inv-del="${esc(String(i.no))}" title="Admin: aus dem Lager entfernen">${icon('close')}</button>` : ''}
          <b class="inv-count">${fmt(i.count)}</b>
          ${i.color ? `<i class="inv-tri" style="background:${i.color}"></i>` : ''}
          <span class="inv-icon"><img src="${esc(i.image || K.storageImage(i.category))}" alt="" referrerpolicy="no-referrer" onerror="this.src='${K.STORAGE_IMG}'"></span>
          <span class="inv-name">${esc(i.label)}</span>
          <small>${esc(i.category)}</small>${rgb ? `<span class="inv-rgb">RGB ${rgb[0]}/${rgb[1]}/${rgb[2]}</span>` : ''}</div>`;
      };
      // Leere Plätze bis zur Lagergröße auffüllen (nur in der Gesamtansicht); der erste freie Platz trägt das Plus zum Einlagern
      const room = s.capacity ? Math.max(0, s.capacity - have.length) : 1;
      const free = cat ? Math.min(room, 1) : room;
      const plus = `<button class="inv-slot empty inv-add" data-inv-add="${esc(cat)}" title="Neuen Gegenstand einlagern">${icon('add')}<small>Einlagern</small></button>`;
      const empties = free ? plus + Array.from({ length: free - 1 }, () => '<div class="inv-slot empty"></div>').join('')
        : `<div class="inv-slot empty inv-full" title="Kein freier Platz – Lager ausbauen">${icon('block')}<small>Lager voll</small></div>`;
      const filter = `<div class="chips"><a class="chip ${cat ? 'outline' : 'accent'}" data-set="storageCat" data-value="">Alle</a>${cats.map(c =>
        `<a class="chip ${c === cat ? 'accent' : 'outline'}" data-set="storageCat" data-value="${esc(c)}">${esc(c)} · ${have.filter(i => i.category === c).length}</a>`).join('')}</div>`;
      const next = s.upgrades.find(u => s.capacity !== null && u.slots > s.capacity);
      return `<div class="kpis">
          <div class="kpi">${icon('inventory_2')}<div><small>Belegte Plätze</small><b>${have.length}${s.capacity ? ' / ' + s.capacity : ''}</b><span>ein Platz je Gegenstandsart</span></div></div>
          <div class="kpi">${icon('widgets')}<div><small>Gegenstände gesamt</small><b>${fmt(have.reduce((n, i) => n + i.count, 0))}</b><span>Stück im Lager</span></div></div>
          <div class="kpi">${icon('upgrade')}<div><small>Nächster Ausbau</small><b>${next ? next.slots + ' Plätze' : '–'}</b><span>${next ? eur(next.price, true) : 'höchste Stufe'}</span></div></div></div>
        <div class="grid g-2-1"><div>
          ${card('Inventar', `${filter}<div class="inv-grid">${shown.map(slot).join('')}${empties}</div>`, { icon: 'grid_view' })}
        </div><div>
          ${K.frame('vault', {
            url: 'online.bankhaus-goldzahn.de/schliessfach/1342',
            brand: `<div class="xf-brand bank-brand"><span class="bank-logo">G</span><div><b>Bankhaus Goldzahn &amp; Söhne</b><small>Schließfach Nr. 1342 · Tresorraum B · seit 1897</small></div></div>`,
          }, `${card('Tresor', `<div class="inv-grid vault">${s.vault.map(v => `<div class="inv-slot" title="${esc(v.text)}">${admin ? `<button class="inv-del" data-vault-del="${esc(v.key)}" title="Admin: aus dem Tresor entfernen">${icon('close')}</button>` : ''}<span class="inv-icon">${v.image ? `<img src="${esc(v.image)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'), { className: 'ms', textContent: 'diamond' }))">` : icon('diamond')}</span><span class="inv-name">${esc(v.text)}</span></div>`).join('')}
            <button class="inv-slot empty inv-add" data-vault-add title="Etwas in den Tresor legen">${icon('add')}<small>Hinzufügen</small></button></div>`, { icon: 'lock' })}`)}
          ${card('Notizen', s.notes.length ? `<ul class="plain">${s.notes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : empty('Keine Notizen.'), { icon: 'sticky_note_2' })}
          ${card('Ausbau', upgradeList(s), { icon: 'upgrade' })}
        </div></div>`;
    },
  };

  // Mitarbeiter: eigene Datei staff.js (Ablauf aus Mitarbeiter.gs)

  const skillTable = (rows, two) => `<table class="table slim skills"><thead><tr><th></th><th>Fertigkeit</th><th class="num">Stufe</th><th class="num">Wurf</th><th>Ergebnis</th>${two ? '<th class="num">Wurf 2</th><th>Ergebnis 2</th>' : ''}</tr></thead><tbody>${rows.map(r => `<tr class="${r.picked ? 'picked' : ''}"><td>${r.picked ? icon('check_circle') : ''}</td><td>${esc(r.name)}</td><td class="num">${fmt(r.lvl)}</td><td class="num">${fmt(r.roll)}</td><td>${resChip(r.result)}</td>${two ? `<td class="num">${fmt(r.roll2)}</td><td>${resChip(r.result2)}</td>` : ''}</tr>`).join('')}</tbody></table>`;
  // In "Interaktionen" und "HK Casino Bar" sind Wurf und Ergebnis der Spielleitung unsichtbar (weiße Schrift): nur die KI kennt sie.
  const skillList = rows => `<table class="table slim skills"><thead><tr><th></th><th>Fertigkeit</th><th class="num">Stufe</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.picked ? 'picked' : ''}"><td>${r.picked ? icon('check_circle') : ''}</td><td>${esc(r.name)}</td><td class="num">${fmt(r.lvl)}</td></tr>`).join('')}</tbody></table>`;
  const resChip = r => r ? `<span class="res res-${/Erfolg/.test(r) ? 'ok' : /Fehlschlag/.test(r) ? 'bad' : 'mid'}">${esc(r)}</span>` : '';
  const thread = turns => turns.length ? `<div class="thread">${turns.map(t => `<div class="bubble ${t.who}"><small>${t.who === 'me' ? 'Knight & Hustler' : 'Spielleitung'}</small>${nl(t.text)}</div>`).join('')}</div>` : empty('Gerade läuft kein Gespräch.');

  V.talents = {
    title: 'Talentboard', icon: 'person_search',
    render(m) {
      const t = m.talents;
      const tc = x => `<section class="card talent ${x.name === 'Fehler' ? 'error' : ''}"><div class="card-b"><h3>${esc(x.name)}</h3><div class="chips">${align(x.alignment)}${chip(x.gender, 'outline')}</div>
        ${kv([['Herkunft', x.origin], ['Stil', x.style], ['Gimmick', x.gimmick], ['Besonderheit', x.special], ['Kosten pro Match', eur(x.cost !== null ? Math.abs(x.cost) : null)]])}${x.flag ? `<p class="hint">${esc(x.flag)}</p>` : ''}</div></section>`;
      return `<div class="toolbar wrap">${chip('Suche: ' + (t.search || '–'), 'outline')}${chip('Geschlecht: ' + (t.gender || 'egal'), 'outline')}${chip('Ausrichtung: ' + (t.alignment || 'egal'), 'outline')}</div>
        <div class="grid g-2">${t.list.map(tc).join('') || empty('Keine Talente geladen.')}</div>
        <h4 class="section">Vorgemerkt und bezahlt</h4><div class="grid g-2">${t.booked.map(tc).join('') || empty('Noch niemand vorgemerkt.')}</div>`;
    },
  };

  V.interaction = {
    title: 'Interaktionen', icon: 'forum',
    render(m) {
      const i = m.interaction;
      return `<div class="grid g-2-1"><div>
          ${card(i.channel || 'Gespräch', thread(i.turns), { icon: 'mail' })}
          ${card('Fertigkeiten', skillList(i.skills), { icon: 'casino', aside: chip('Skillpunkte ' + fmt(m.skillPoints, 1), 'accent') })}
        </div><div>
          ${card('Einstellungen', kv([['Wirkt auf', i.metric], ['Aspekt eingesetzt', i.aspect ? 'ja' : 'nein']]), { icon: 'tune' })}
          ${i.story ? card('Laufende Story', `<p>${nl(i.story)}</p>`, { icon: 'auto_stories' }) : ''}
          ${card('Kontakte', i.contacts.length ? `<ul class="plain">${i.contacts.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : empty('Keine Kontakte.'), { icon: 'contacts' })}
        </div></div>`;
    },
  };

  V.bar = {
    title: 'HK Casino Bar', icon: 'local_bar',
    render(m) {
      const b = m.bar;
      return `<div class="grid g-2-1"><div>
          ${card('An der Bar', thread(b.turns), { icon: 'forum' })}
          ${card('Fertigkeiten', skillList(b.skills), { icon: 'casino' })}
        </div><div>
          ${card('Gäste heute', b.guests.length ? `<ul class="guests">${b.guests.map(g => `<li class="${g.picked ? 'picked' : ''}">${icon(g.picked ? 'check_circle' : 'radio_button_unchecked')}<span>${esc(g.text)}</span>${chip(g.show, 'outline')}</li>`).join('')}</ul>` : empty('Die Bar ist leer.'), { icon: 'nightlife' })}
        </div></div>`;
    },
  };

  /* ───────────── Kartei (Seitenleiste) ───────────── */
  // Bilanz, Sterne-Schnitt und Matches: standardmäßig das aktuelle Jahr, per Klick alle Jahre (gilt je Tab)
  const scoped = (m, rec) => {
    const all = !!(K.state && K.state.recAll), rows = all ? rec.rows : rec.rows.filter(r => r.show.date.year === m.curYear);
    const rated = rows.map(r => r.match.stars).filter(x => typeof x === 'number');
    return { all, rows, wins: rows.filter(r => r.result === 'W').length, losses: rows.filter(r => r.result === 'L').length,
      avg: rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null, rated: rated.length };
  };
  const scopeSwitch = (m, sc) => `<div class="seg rec-scope"><button class="${sc.all ? '' : 'on'}" data-rec-scope="year">Jahr ${m.curYear}</button><button class="${sc.all ? 'on' : ''}" data-rec-scope="all">Gesamt</button></div>`;
  const statKpis = (eloTxt, eloLabel, sc) => `<div class="kpis mini three"><div class="kpi"><div><small>${eloLabel}</small><b>${eloTxt}</b></div></div>
    <div class="kpi"><div><small>Bilanz</small><b>${sc.wins}–${sc.losses}</b></div></div>
    <div class="kpi" title="${sc.rated} bewertete Matches"><div><small>Ø Sterne</small><b>${sc.avg === null ? '–' : fmt(sc.avg, 1) + ' ★'}</b></div></div></div>`;
  /** Kleine ELO-Kurve aus dem Verlauf (w.eloHist: [Woche, ELO, Show]); erst ab zwei Punkten. */
  function eloCurve(hist) {
    if (!Array.isArray(hist) || hist.length < 2) return '';
    const W = 300, H = 52, P = 4, xs = hist.map(h => h[0]), ys = hist.map(h => h[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const px = x => P + (x1 === x0 ? (W - 2 * P) / 2 : (x - x0) / (x1 - x0) * (W - 2 * P)), py = y => H - P - (y1 === y0 ? (H - 2 * P) / 2 : (y - y0) / (y1 - y0) * (H - 2 * P));
    const pts = hist.map(h => `${px(h[0]).toFixed(1)},${py(h[1]).toFixed(1)}`).join(' ');
    const last = hist[hist.length - 1], first = hist[0], d = last[1] - first[1];
    return `<div class="elo-curve"><div class="ec-head"><small>ELO-Verlauf · ${hist.length - 1} ${hist.length === 2 ? 'Show' : 'Shows'}</small><small class="${d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? '+' : ''}${fmt(d, 1)}</small></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${pts}"/></svg>
      <div class="ec-foot"><small>${K.elo(y0)}</small><small>${K.elo(y1)}</small></div></div>`;
  }

  K.wrestlerSheet = function (m, name) {
    M = m;
    const w = m.byName.get(name);
    if (!w) return '';
    const rec = scoped(m, K.record(m, name));
    const hist = rec.rows.slice().reverse().slice(0, 40).map(r => `<tr><td><a href="#shows" data-set="show" data-value="${esc(r.show.key)}">${esc(showTitle(r.show))}</a></td><td><span class="res res-${r.result === 'W' ? 'ok' : r.result === 'L' ? 'bad' : 'mid'}">${r.result === 'W' ? 'Sieg' : r.result === 'L' ? 'Niederlage' : 'dabei'}</span></td><td>${esc(K.participants(r.match).filter(p => p !== name).join(', '))}</td><td class="num">${stars(r.match.stars)}</td></tr>`).join('');
    return `${w.image ? `<img class="portrait" src="${esc(w.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
      <h2>${esc(w.name)}</h2>
      <div class="chips">${showChip(w.show)}${tier(w.status)}${align(w.alignment)}${chip(w.promotion, 'outline')}${w.titles.map(t => chip(t, 'accent')).join('')}${K.contractChip ? K.contractChip(w) : ''}</div>
      ${w.unavailable ? `<a class="chip away-chip big" href="#injuries" title="Zur Seite Verletzte">${icon('event_busy')}Nicht verfügbar: ${esc(w.unavailable)}</a>` : ''}
      ${w.injury ? `<a class="chip hurt-chip big" href="#injuries" title="Zur Seite Verletzte">${icon('healing')}${esc(w.injury)}${K.doctorCost ? ` · Behandlung ${eur(typeof w.injuryCost === 'number' ? w.injuryCost : K.doctorCost(m), true)}` : ''}</a>` : ''}
      ${scopeSwitch(m, rec)}${statKpis(K.elo(w.elo), 'ELO', rec)}${eloCurve(w.eloHist)}
      ${kv([['Gimmick', w.gimmick], ['Teams', (w.teams || []).map(wl).join(', '), true], ['Stable', w.stable], ['Storyline', w.storyline], ['Vertragsende', w.contractEnd], ['Besonderheiten', w.notes], ['Anmerkung / Musik', w.music]])}
      <h4 class="section">Matches${rec.all ? '' : ` <small>Jahr ${m.curYear}</small>`}</h4>${hist ? `<table class="table slim">${hist}</table>` : empty(rec.all ? 'Noch keine Auftritte auf der Card.' : `In Jahr ${m.curYear} noch keine Auftritte.`)}`;
  };

  /* ───────────── Team-Kartei (Seitenleiste) ─────────────
     Wie die Kartei eines Wrestlers, ohne Admin-Teil (Teams bearbeitet man auf „Teams und Stables“).
     Ein Match zählt fürs Team, wenn der Teamname drinsteht oder alle Mitglieder zusammen auf einer Seite stehen. */
  K.teamRecord = (m, name) => {
    const t = m.teamByName && m.teamByName.get(name);
    if (!t) return { rows: [], wins: 0, losses: 0 };
    const has = list => list.includes(name) || t.members.every(n => list.includes(n));
    const rows = [];
    m.shows.filter(s => s.ended).forEach(s => s.matches.forEach(mt => {   // nur gelaufene Shows
      const win = has(K.winners(mt)), lose = has(K.losers(mt));
      if (!win && !lose && !has(K.participants(mt))) return;
      rows.push({ show: s, match: mt, result: win ? 'W' : lose ? 'L' : '–' });
    }));
    return { rows, wins: rows.filter(r => r.result === 'W').length, losses: rows.filter(r => r.result === 'L').length };
  };
  K.teamSheet = function (m, name) {
    M = m;
    const t = m.teamByName && m.teamByName.get(name);
    if (!t) return '';
    const ws = t.members.map(n => m.byName.get(n)).filter(Boolean);
    const rec = scoped(m, K.teamRecord(m, name)), elo = K.ratingOf(m, name);
    const set = new Set(t.members);
    const shows = [...new Set(ws.map(w => w.show).filter(Boolean))];
    const titles = m.titles.filter(x => x.holder && (x.holder === name || (ws.length > 1 && x.holder.split(/\s*&\s*/).sort().join('|') === t.members.slice().sort().join('|')))).map(x => x.name);
    const stables = m.stables.filter(s => s.members.includes(name)).map(s => s.name);
    const stories = [...new Set(ws.map(w => w.storyline).filter(Boolean))];
    const hist = rec.rows.slice().reverse().slice(0, 40).map(r => `<tr><td><a href="#shows" data-set="show" data-value="${esc(r.show.key)}">${esc(showTitle(r.show))}</a></td><td><span class="res res-${r.result === 'W' ? 'ok' : r.result === 'L' ? 'bad' : 'mid'}">${r.result === 'W' ? 'Sieg' : r.result === 'L' ? 'Niederlage' : 'dabei'}</span></td><td>${esc(K.participants(r.match).filter(p => p !== name && !set.has(p)).join(', '))}</td><td class="num">${stars(r.match.stars)}</td></tr>`).join('');
    const pics = ws.filter(w => w.image);
    return `${pics.length ? `<div class="team-portraits">${pics.map(w => `<img src="${esc(w.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`).join('')}</div>` : ''}
      <h2>${esc(t.name)}</h2>
      <div class="chips">${shows.map(s => showChip(s)).join('')}${chip('Team', 'outline')}${titles.map(x => chip(x, 'accent')).join('')}</div>
      ${ws.some(w => w.injury) ? `<a class="chip hurt-chip big" href="#injuries" title="Zur Seite Verletzte">${icon('healing')}Verletzt: ${esc(ws.filter(w => w.injury).map(w => w.name).join(', '))}</a>` : ''}
      ${ws.some(w => w.unavailable) ? `<a class="chip away-chip big" href="#injuries" title="Zur Seite Verletzte">${icon('event_busy')}Nicht verfügbar: ${esc(ws.filter(w => w.unavailable).map(w => w.name).join(', '))}</a>` : ''}
      ${scopeSwitch(m, rec)}${statKpis(elo === null ? '–' : K.elo(elo), 'ELO Ø', rec)}
      <h4 class="section">Mitglieder</h4><ul class="team-members">${t.members.map(n => { const w = m.byName.get(n); return `<li>${w && w.image ? `<img src="${esc(w.image)}" alt="" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : '<span class="ph"></span>'}${wl(n)}${w ? tier(w.status) + align(w.alignment) : ''}</li>`; }).join('')}</ul>
      ${kv([['Stables', stables.join(', ')], ['Storyline', stories.join(', ')]])}
      <h4 class="section">Matches${rec.all ? '' : ` <small>Jahr ${m.curYear}</small>`}</h4>${hist ? `<table class="table slim">${hist}</table>` : empty(rec.all ? 'Noch keine Auftritte als Team auf der Card.' : `In Jahr ${m.curYear} noch keine Auftritte als Team.`)}`;
  };

  /* ───────────── Besonderheiten in der Datenbank bearbeiten ───────────── */
  // Wird beim Tippen gespeichert (für beide Spieler), ohne die Tabelle neu aufzubauen. Das Feld wächst mit dem Text.
  const growCell = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
  document.addEventListener('input', e => {
    const el = e.target;
    if (!el.dataset || el.dataset.wnote === undefined) return;
    const name = el.dataset.wnote, v = el.value;
    K.store.update(st => { st.wrestlers[name] = Object.assign({}, st.wrestlers[name], { notes: v }); });
    const w = K.model && K.model.byName.get(name); if (w) w.notes = v;
    growCell(el);
  });
  document.addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.wnote !== undefined) growCell(e.target); });
  document.addEventListener('focusout', e => { if (e.target.dataset && e.target.dataset.wnote !== undefined) e.target.style.height = ''; });

  /* ───────────── Wrestler umbenennen ─────────────
     Wrestler aus der Tabelle: store.renames { Originalname: neuer Name } (model.js wendet das überall an).
     Selbst aufgenommene: direkt in store.added. Gespeicherte Änderungen, Teams, Stables, Matches, Titelwechsel
     und Angebote ziehen auf den neuen Namen um. */
  K.renameWrestler = (oldName, newName) => {
    const m = K.model, name = String(newName || '').replace(/\s+/g, ' ').trim();
    if (!(K.admin && K.admin.on)) return false;   // nur im Admin-Modus
    if (!m || !m.byName.has(oldName) || !name || name === oldName) return false;
    if (m.byName.has(name) || (m.teamByName && m.teamByName.has(name))) { K.toast(`„${name}“ gibt es schon.`); return false; }
    if (/[,&]/.test(name)) { K.toast('Komma und „&“ gehen im Namen nicht (sie trennen mehrere Namen).'); return false; }
    const swap = list => K.splitNames(list).map(n => (n === oldName ? name : n)).join(', ');
    K.store.update(st => {
      const w = m.byName.get(oldName);
      if (w.added) st.added = (st.added || []).map(x => (x.name === oldName ? Object.assign({}, x, { name }) : x));
      else {
        st.renames = st.renames || {};
        const orig = Object.keys(st.renames).find(k => st.renames[k] === oldName) || oldName;
        if (orig === name) delete st.renames[orig]; else st.renames[orig] = name;
      }
      if (st.wrestlers[oldName]) { st.wrestlers[name] = st.wrestlers[oldName]; delete st.wrestlers[oldName]; }
      if (st.offers[oldName]) { st.offers[name] = Object.assign({}, st.offers[oldName], { person: name }); delete st.offers[oldName]; }
      if (st.drafts.contractForm && st.drafts.contractForm.person === oldName) st.drafts.contractForm.person = name;
      if (st.groups) ['teams', 'stables'].forEach(k => (st.groups[k] || []).forEach(g => { g.members = g.members.map(n => (n === oldName ? name : n)); }));
      Object.values(st.shows || {}).forEach(s => (s.matches || []).forEach(mt => ['winner', 'loser', 'extra'].forEach(f => { if (mt[f]) mt[f] = swap(mt[f]); })));
      Object.values(st.titles || {}).forEach(ch => ch.forEach(c => { c.holder = String(c.holder || '').split(/\s*&\s*/).map(n => (n === oldName ? name : n)).join(' & '); }));
    });
    // Neu zeichnen erst nach dem laufenden Ereignis (das Feld wird gerade verlassen)
    setTimeout(() => K.rebuild(), 0);
    K.toast(`${oldName} heißt jetzt ${name}`);
    return true;
  };
  document.addEventListener('change', e => {
    const el = e.target;
    if (!el.dataset || el.dataset.wname === undefined) return;
    const old = el.dataset.wname;
    if (!K.renameWrestler(old, el.value)) el.value = old;
  });
  document.addEventListener('keydown', e => {
    const el = e.target;
    if (!el.dataset || el.dataset.wname === undefined) return;
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { el.value = el.dataset.wname; el.blur(); }
  });

  /* ───────────── Neuen Wrestler in die Datenbank aufnehmen ───────────── */
  // Gespeichert im Klickdummy (store.added), für beide Spieler sichtbar. Weitere Angaben später in der Kartei (Admin).
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-addw]') || !M) return;
    const m = M;
    const shows = ['', ...Object.values(K.seriesConf()).filter(c => !c.deletedFrom).map(c => c.label)];
    const proms = [...new Set(['KHW', ...m.roster.map(w => w.promotion).filter(Boolean)])];
    K.dialog.form({
      title: 'Wrestler aufnehmen', icon: 'person_add', ok: 'Aufnehmen',
      text: 'Der Wrestler steht danach in der Datenbank, in den Vorschlägen und im Vertrag. Weitere Angaben lassen sich in der Kartei ergänzen.',
      fields: [
        { id: 'name', label: 'Name', placeholder: 'z. B. Rhea Ripley' },
        { id: 'gender', label: 'Geschlecht', type: 'select', value: 'm', options: [['m', 'Mann'], ['w', 'Frau']] },
        { id: 'status', label: 'Status', type: 'select', value: 'Newcomer', options: K.STATUS.map(x => [x, x]) },
        { id: 'alignment', label: 'Ausrichtung', type: 'select', value: 'Face', options: [['Face', 'Face'], ['Heel', 'Heel'], ['', '–']] },
        { id: 'show', label: 'Show', type: 'select', value: '', options: shows.map(x => [x, x || 'keine (noch nicht unter Vertrag)']) },
        { id: 'promotion', label: 'Promotion', type: 'select', value: 'KHW', options: proms.map(x => [x, x]) },
        { id: 'gimmick', label: 'Gimmick (optional)', placeholder: 'z. B. High Flyer, Rebell' },
        { id: 'image', label: 'Bild-Adresse (optional)', placeholder: 'https://…' },
      ],
    }).then(v => {
      if (!v) return;
      const name = v.name.trim();
      if (!name) { K.toast('Ohne Namen wurde niemand aufgenommen.'); return; }
      if (m.byName.has(name) || m.roster.some(w => w.name.toLowerCase() === name.toLowerCase())) { K.toast(`${name} steht schon in der Datenbank.`); return; }
      const w = { name, gender: v.gender, status: v.status, alignment: v.alignment, show: v.show, promotion: v.promotion, gimmick: v.gimmick.trim(),
        image: /^https?:\/\//.test(v.image.trim()) ? v.image.trim() : '', elo: 1000 };
      K.store.update(st => { st.added = (st.added || []).concat(w); });
      // Ohne Show würde der Filter „Aktiver Kader“ ihn verstecken: dann alle zeigen
      if (K.state.rf && K.state.rf.show === 'aktiv' && !w.show) K.state.rf.show = '';
      K.rebuild();
      K.toast(`${name} aufgenommen`);
    });
  });

  // Storylines: eigene Datei storylines.js (Quelle für Card, Weeklie Roster und Vorschläge)

  // Büro und Talentboard sind ausgeblendet (hidden), bleiben aber im Code.
  V.office.hidden = true; V.talents.hidden = true;
  K.NAV = [['Liga', ['office', 'shows']], ['Kader', ['weeklies', 'roster', 'ranking', 'titles', 'stories']], ['Geschäft', ['finance', 'staff', 'storage', 'contract', 'talents']], ['Story', ['interaction', 'bar']]];
  K.views = V;
  K.renderView = (id, m, st) => { M = m; return V[id].render(m, st); };
  // Bausteine für Ansichten in eigenen Dateien (z. B. contract.js). wl() braucht das Modell von renderView.
  K.ui = { icon, card, chip, tier, align, empty, kv, stars, showChip, wl, wlList, resChip, thread, signed, hypeBlock, oddsBlock, showTitle, showSub, matchTable, billing };
})(window.KHW);
