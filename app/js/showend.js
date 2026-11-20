// KHW Manager – Show beenden (Klickdummy), auf der Finanzen-Seite.
// Ablauf wie EndShow() aus GewinnVerlust.gs:
//   1. Sterne aufs Sternekonto (mit Bonus für schwache Segmente mit Storyline)
//   2. Wette berechnen und auszahlen
//   3. Einnahmen der Show berechnen (Ort, PPV, Werbung, Sponsoring, Rabatt) und Follower aktualisieren
//   4. ELO der Show berechnen und in die Datenbank schreiben
//   5. Auf- und Abstiege aus dem Ranking übernehmen, nächste Show wird aktuell
// Jede Kontobewegung bekommt einen Namen. Die Show ist danach gesperrt.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc, eur, fmt } = K;
  const SR = () => K.rules.show;
  const ui = () => K.ui;

  // Rabatte (gemeinsam für beide Spieler), getrennt einstellbar: „store“ für Store-Artikel, „venue“ für Miete,
  // Werbung und Großes Sponsoring. Gesetzt werden sie unten auf der Finanzen-Seite an der jeweiligen Liste.
  K.discount = kind => ((K.store.state.drafts.discounts || {})[kind]) || 0;
  K.setDiscount = (kind, v) => K.store.update(s => { s.drafts.discounts = Object.assign({}, s.drafts.discounts, { [kind]: v }); });

  // Einstellungen der Abrechnung: Werbung und Großes Sponsoring; der Rabatt kommt von den Veranstaltungsorten.
  const opts = () => Object.assign({ ads: false, sponsoring: false }, K.store.state.drafts.endShow, { discount: K.discount('venue') });
  const setOpts = patch => K.store.update(s => { s.drafts.endShow = Object.assign({}, s.drafts.endShow, patch); });

  /**
   * Reguläre Shows bestimmen das Spieldatum: Raster der Tabelle (Jahr 4) und die Reihen TryOut/Lucky7 ab Jahr 5.
   * Nächste reguläre Show nach s, auch im nächsten Jahr; Rückgabe ist ihr Schlüssel.
   */
  const isRegular = s => s.no !== null || !!(s.series && (K.seriesConf()[s.series] || {}).builtin);
  function nextRegular(m, s) {
    const next = m.shows.find(x => x.sortKey > s.sortKey && isRegular(x));
    return next ? next.key : s.key;
  }

  /* ───────────── Karte auf der Finanzen-Seite ───────────── */
  K.endShowCard = m => {
    const u = ui(), s = m.dueShow;
    if (!s) return u.card('Show abrechnen', u.empty('Alle Shows dieses Jahres sind abgerechnet.'), { icon: 'flag' });
    const o = opts();
    const missing = s.matches.filter(mt => mt.stars === null).length;
    const betMt = s.matches.find(mt => mt.bet);
    const fee = k => eur(SR().fee(k, o.discount));
    return u.card(`Show abrechnen: ${u.showTitle(s)}`, `
      <div class="end-head">
        <div><small>${esc(u.showSub(s))}</small><div class="chips">${u.showChip(s.type === 'Event' ? '' : s.type)}<span class="chip outline">${esc([s.venue.stadt, s.venue.land].filter(Boolean).join(', '))} · ${esc(s.venue.halle)}</span></div></div>
        <div class="end-stats">
          <div><small>Einträge</small><b>${s.matches.length}</b></div>
          <div><small>Sterne</small><b>${fmt(s.stars, s.stars % 1 ? 1 : 0)}</b>${missing ? `<span class="neg">${missing} ohne Sterne</span>` : ''}</div>
          <div><small>Wette</small><b>${betMt ? esc(betMt.winner || '–') : '–'}</b>${betMt ? '' : '<span class="muted">keine</span>'}</div>
        </div>
      </div>
      <h5>Extras</h5>
      <div class="end-opts">
        <label class="opt ${o.ads ? 'on' : ''}"><input type="checkbox" data-eo="ads" ${o.ads ? 'checked' : ''}><span><b>Werbung</b><small>${fee('ads')} · mehr Tickets und Streams, 20 % Rabatt auf Werbekosten</small></span></label>
        <label class="opt ${o.sponsoring ? 'on' : ''}"><input type="checkbox" data-eo="sponsoring" ${o.sponsoring ? 'checked' : ''}><span><b>Großes Sponsoring</b><small>${fee('sponsoring')} · Sponsoring-Einnahmen nach Stufe</small></span></label>
      </div>
      ${o.discount ? `<p class="hint">${u.icon('sell')} Rabatt der Veranstaltungsorte: ${o.discount} % auf Miete, Werbung und Sponsoring.</p>` : ''}
      <div class="actions"><button class="btn primary" data-end="run">${u.icon('flag')}Show beenden</button>
        <a class="btn text" href="#shows" data-set="show" data-value="${esc(s.key)}">Zur Show</a></div>
      <p class="hint">Beim Beenden: Sterne übertragen → Wette auszahlen → Einnahmen buchen → ELO aktualisieren → Auf- und Abstiege übernehmen. Danach ist die Show gesperrt.</p>`,
      { icon: 'flag', cls: 'end-card' });
  };

  /** Zusätzliche Ergebnisse der letzten Abrechnung (Sterne, Follower, ELO, Auf- und Abstiege). */
  /*
   * Ergebnis der letzten Abrechnung, nach Wichtigkeit gegliedert:
   *   Primär     Einnahmen gesamt · Sterne · Follower (große, hervorgehobene Kacheln)
   *   Sekundär   Auf- und Abstiege · Wette
   *   Ausklappbar  ELO, Sterne je Segment, vollständige Abrechnung
   */
  K.endShowSummary = (L, f) => {
    if (!L || !L.dummy) return '';
    const u = ui();
    const n1 = x => fmt(x, x % 1 ? 1 : 0);
    const starRows = L.starRows.filter(r => r.stars !== null);
    const bonus = starRows.reduce((t, r) => t + (r.bonus || 0), 0);
    const elo = L.elo.slice().sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));
    const fees = (L.fees.ads || 0) + (L.fees.sponsoring || 0);

    const tile = (cls, ic, label, value, sub) => `<div class="hero-tile ${cls}"><span class="ms">${ic}</span><small>${label}</small><b>${value}</b><span>${sub}</span></div>`;
    const primary = `<div class="hero-tiles">
      ${tile('t-money ' + (L.total < 0 ? 'is-neg' : ''), 'payments', 'Einnahmen gesamt', u.signed(L.total),
        [`Show ${eur(L.income, true)}`, L.betGain ? `Wette ${eur(L.betGain, true)}` : '', fees ? `Extras −${eur(fees, true)}` : ''].filter(Boolean).join(' · '))}
      ${tile('t-stars', 'star', 'Sterne', `${n1(L.stars)} ★`, `aufs Sternekonto${bonus ? ` · inkl. ${n1(bonus)} Bonus` : ''}`)}
      ${tile('t-fans ' + (L.followerDelta < 0 ? 'is-neg' : ''), 'groups', 'Follower', `${L.followerDelta >= 0 ? '+' : ''}${fmt(L.followerDelta)}`,
        [f ? `jetzt ${fmt(f.followers)}` : '', L.starAvg !== undefined ? `Ø ${fmt(L.starAvg, 1)} Sterne aus ${L.starRated} Segmenten` : ''].filter(Boolean).join(' · '))}
    </div>`;

    const bw = L.betRows && L.betRows[0];
    const load = L.capacity ? Math.min(100, L.visitors / L.capacity * 100) : null;
    const secondary = `<div class="grid g-3 tight result-secondary">
      <div><h5>Auslastung · ${esc(L.hall || L.venue)}</h5>${load === null ? u.empty('Kapazität unbekannt.') : `<div class="load-line"><b>${fmt(load, load < 10 ? 1 : 0)} %</b><small>${fmt(L.visitors)} von ${fmt(L.capacity)} Plätzen</small></div>
        <div class="bar load-bar"><i style="width:${load}%"></i></div>`}</div>
      <div><h5>Auf- und Abstiege</h5>${L.statusChanges.length ? `<ul class="plain">${L.statusChanges.map(c => `<li>${u.icon(c.up ? 'arrow_upward' : 'arrow_downward')} ${u.wl(c.name)} ${u.tier(c.from)} → ${u.tier(c.to)}</li>`).join('')}</ul>` : u.empty('Keine Änderungen.')}
        ${(L.titleChanges || []).length ? `<h5 class="sub-h">Titel</h5><ul class="plain">${L.titleChanges.map(c => `<li>${u.icon('emoji_events')} <b>${esc(c.title)}</b>: ${c.defended ? `${u.wlList(c.to.replace(/\s*&\s*/g, ', '))} verteidigt` : `${c.from ? esc(c.from) + ' → ' : ''}${u.wlList(c.to.replace(/\s*&\s*/g, ', '))}`}</li>`).join('')}</ul>` : ''}</div>
      <div><h5>Wette</h5>${bw ? `<div class="bet-line"><div>${u.wl(bw.name)} <small>Rang ${fmt(bw.rank)} · Quote ${fmt(bw.quote, 1)} %</small></div><b>${u.signed(L.betGain)}</b></div>` : u.empty(L.betNote || 'Keine Wette.')}</div>
    </div>`;

    const more = `<details class="more"><summary>Weitere Infos: ELO, Sterne je Segment, Abrechnung</summary>
      <div class="grid g-2 tight">
        <div><h5>ELO</h5>${elo.length ? `<table class="table slim">${elo.map(c => `<tr><td>${u.wl(c.name)}</td><td class="num">${fmt(c.from, 1)} → <b>${fmt(c.to, 1)}</b></td><td class="num ${c.to >= c.from ? 'pos' : 'neg'}">${c.to >= c.from ? '+' : ''}${fmt(c.to - c.from, 1)}</td></tr>`).join('')}</table>` : u.empty('Kein entschiedenes Match.')}</div>
        <div><h5>Sterne je Segment</h5>${starRows.length ? `<table class="table slim">${starRows.map(r => `<tr><td>${esc(r.label)}</td><td class="num">${n1(r.stars)} ★${r.bonus ? ` <small class="pos">+${n1(r.bonus)} Bonus</small>` : ''}</td></tr>`).join('')}</table>` : u.empty('Keine Sterne eingetragen.')}</div>
      </div>
      <h5>Abrechnung · ${esc(L.venue)}</h5>${f ? u.billing(L, f) : ''}
    </details>`;

    return u.card(`Ergebnis: ${L.showTitle}`, primary + secondary + more, { icon: 'emoji_events', cls: 'result-card' });
  };

  /* ───────────── Ablauf ───────────── */
  function endShow(key, o) {
    const R = SR();
    let m = K.model;
    const s = m.show(key);
    if (!s || s.ended) return;
    const title = ui().showTitle(s);

    // 1. Sterne (mit Bonus)
    const stars = R.stars(s);
    // 2. Wette
    const bet = R.bet(m, s);
    // 3. Einnahmen und Follower
    const fin = R.finance(s, m.finance, o);
    const fol = R.followers(stars.rows, s.type === 'PPV');
    const followerDelta = fol.delta;
    // 4. ELO
    const elo = R.elo(m, s);
    // Titelmatches: Sieger bekommen den Titel
    const titles = R.titleChanges(m, s);

    const fees = { ads: o.ads ? R.fee('ads', o.discount) : 0, sponsoring: o.sponsoring ? R.fee('sponsoring', o.discount) : 0 };
    const bookings = [{ text: `Show-Einnahmen ${title}`, amount: fin.income, show: key }];
    if (bet.gain) bookings.push({ text: `Wette ${title}`, amount: bet.gain, show: key });
    if (fees.ads) bookings.push({ text: `Werbung ${title}`, amount: -fees.ads, show: key });
    if (fees.sponsoring) bookings.push({ text: `Großes Sponsoring ${title}`, amount: -fees.sponsoring, show: key });

    let k = 0;
    const result = Object.assign(fin, {
      dummy: true, showKey: key, showTitle: title, stars: stars.total, starAvg: fol.avg, starRated: fol.rated, followerDelta, elo, fees, bookings,
      starRows: stars.rows.map(r => ({ label: r.mt.promo ? 'Segment' : `Match ${++k}`, stars: r.stars, bonus: r.bonus })),
      betRows: bet.rows, betGain: bet.gain, betNote: bet.note || '', betList: bet.list || '',
      total: bookings.reduce((t, b) => t + b.amount, 0), sheetTotal: null, statusChanges: [], titleChanges: titles,
    });

    K.store.update(st => {
      const base = st.shows[key] && st.shows[key].matches ? st.shows[key] : { matches: s.matches.map(mt => ({ type: mt.type, winner: mt.winner, loser: mt.loser, extra: mt.extra, storyline: mt.storyline, stars: mt.stars === null ? '' : mt.stars, bet: mt.bet, notes: mt.notes, marks: mt.marks, title: mt.title })), venue: s.venue, name: s.name };
      titles.filter(c => !c.defended).forEach(c => { st.titles[c.title] = (st.titles[c.title] || []).concat({ holder: c.to, show: key }); });
      base.matches.forEach((x, i) => { const r = stars.rows[i]; if (r && r.stars !== null) { x.stars = r.stars; x.bonus = r.bonus > 0; } });
      st.shows[key] = Object.assign(base, { ended: true });
      bookings.forEach(b => st.bookings.push(b));
      st.game.stars = (st.game.stars || 0) + stars.total;
      st.game.followers = (st.game.followers || 0) + followerDelta;
      st.game.lastFollowerDelta = followerDelta;
      st.game.lastStars = stars.total;
      // ELO samt Verlauf [Woche, ELO, Show] (für die Kurve im Wrestler-Panel); der erste Eintrag hält den Wert davor fest
      const wk = K.weekIdx(s.date);
      elo.forEach(c => {
        const prev = st.wrestlers[c.name] || {}, hist = (prev.eloHist || []).slice();
        if (!hist.length) hist.push([wk - 1, Math.round(c.from * 10) / 10, null]);
        hist.push([wk, Math.round(c.to * 10) / 10, key]);
        st.wrestlers[c.name] = Object.assign({}, prev, { elo: c.to, eloHist: hist.slice(-80) });
      });
      // Zeiger auf die aktuelle Show weiterrücken, auch über das Jahresende hinaus (Jahr 5, 6 …)
      const cur = m.show(m.currentShow);
      if (isRegular(s) && (!cur || s.sortKey >= cur.sortKey)) st.game.currentShow = nextRegular(m, s);
      // Einmalige Verträge erlöschen mit dem ersten Auftritt (egal wie oft in dieser Show)
      const appeared = new Set(s.matches.flatMap(mt => K.participants(mt)).flatMap(n => (m.byName.has(n) ? [n] : (K.teamMembers(m, n) || []))));
      appeared.forEach(n => { const w = m.byName.get(n); if (w && w.onceContract) st.wrestlers[n] = Object.assign({}, st.wrestlers[n], { onceContract: null }); });
      st.drafts.endShow = { ads: false, sponsoring: false };
    });

    // 5. Auf- und Abstiege: erst mit den neuen ELO-Werten steht fest, wer wo im Ranking landet.
    K.rebuild();
    m = K.model;
    const changes = m.statusChanges.slice();
    result.statusChanges = changes;
    K.store.update(st => {
      changes.forEach(c => { st.wrestlers[c.name] = Object.assign({}, st.wrestlers[c.name], { status: c.to }); });
      st.shows[key].result = { total: result.total, income: fin.income, stars: stars.total };
      st.game.lastResult = result;
    });
    // Postfach: 0–4 neue Einträge (nur Überschriften; die KI schreibt erst beim Öffnen)
    const fresh = K.inbox ? K.inbox.afterShow(K.model, s) : [];
    K.rebuild();
    const kinds = { mail: 'Mail', meet: 'Termin', news: 'News' };
    const post = fresh.length ? ' · Neu: ' + Object.entries(fresh.reduce((a, x) => (a[x.kind] = (a[x.kind] || 0) + 1, a), {})).map(([k, n]) => `${n} ${kinds[k]}${n > 1 && k !== 'news' ? (k === 'mail' ? 's' : 'e') : ''}`).join(', ') : '';
    K.toast(`${title} beendet · ${eur(result.total)} gebucht${post}`);  }

  /* ───────────── Bedienung ───────────── */
  document.addEventListener('change', e => {
    const t = e.target;
    if (!t.dataset || !t.dataset.eo) return;
    setOpts({ [t.dataset.eo]: t.type === 'checkbox' ? t.checked : Number(t.value) });
    K.render();
  });
  // Rabatt ändern (Store oder Veranstaltungsorte)
  document.addEventListener('change', e => {
    const t = e.target;
    if (!t.dataset || !t.dataset.disc) return;
    K.setDiscount(t.dataset.disc, Number(t.value));
    K.render();
  });

  // Store: Artikel per Klick kaufen
  document.addEventListener('click', e => {
    const row = e.target.closest('[data-buy]');
    if (!row || !K.model) return;
    const item = K.model.finance.store[Number(row.dataset.buy)];
    if (!item) return;
    const d = item.discountable ? K.discount('store') : 0;
    const price = item.price * (1 - d / 100);   // Preise sind negativ (Ausgabe)
    K.dialog.confirm({
      title: 'Artikel kaufen?', icon: 'add_shopping_cart', ok: 'Kaufen',
      text: `${item.name}\nPreis: ${eur(-price)}${d ? ` (inkl. ${d} % Rabatt)` : ''}\n\nDer Betrag wird sofort vom Konto gebucht.`,
    }).then(yes => {
      if (!yes) return;
      K.store.update(s => { s.bookings.push({ text: `Store: ${item.name}`, amount: price, show: K.model.currentShow }); });
      K.rebuild();
      K.toast(`${item.name} gekauft · ${eur(price)}`);
    });
  });

  // Kontobewegung von Hand (z. B. „Sonstiges“, „Vertragsverlängerung“)
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-ledger="add"]')) return;
    K.dialog.form({
      title: 'Buchung hinzufügen', icon: 'add_card', ok: 'Buchen',
      fields: [
        { id: 'text', label: 'Bezeichnung', value: 'Sonstiges' },
        { id: 'amount', label: 'Betrag (€)', type: 'number', step: '0.01', placeholder: 'z. B. -2500 oder 1200', hint: 'Ausgaben mit Minus eintragen.' },
      ],
    }).then(v => {
      if (!v) return;
      const amount = Number(String(v.amount).replace(',', '.'));
      if (!amount || Number.isNaN(amount)) { K.toast('Kein Betrag eingetragen – nichts gebucht.'); return; }
      const text = v.text.trim() || 'Sonstiges';
      K.store.update(s => { s.bookings.push({ text, amount, manual: true, show: K.model ? K.model.currentShow : null }); });
      K.rebuild();
      K.toast(`${text}: ${eur(amount)} gebucht`);
    });
  });

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-end="run"]');
    if (!b) return;
    const m = K.model, s = m && m.dueShow;
    if (!s) return;
    const o = opts(), u = ui();
    // Verletzte dürfen in keinem Match auftreten: vorher korrigieren (z. B. behandeln oder umbuchen)
    // … und ohne Vertrag darf niemand auftreten
    const hurt = K.injuredInShow ? K.injuredInShow(m, s) : [];
    const free = K.noContractInShow ? K.noContractInShow(m, s) : [];
    if (hurt.length || free.length) {
      K.dialog.alert({ title: 'Show kann nicht beendet werden', icon: hurt.length ? 'healing' : 'contract',
        text: [hurt.length ? `In Matches stehen verletzte Wrestler:\n${hurt.map(x => `• ${x.names.map(n => `${n} (${K.injuryWhy(m, n)})`).join(', ')}`).join('\n')}\nBehandeln (Seite Verletzte), umbuchen oder als Segment führen.` : '',
          free.length ? `Ohne Vertrag stehen auf der Card:\n${[...new Set(free.flatMap(x => x.names))].map(n => `• ${n}`).join('\n')}\nVertrag abschließen (auch einmalig) oder umbuchen.` : ''].filter(Boolean).join('\n\n') });
      return;
    }
    const missing = s.matches.filter(mt => mt.stars === null).length;
    const extras = [o.ads && 'Werbung', o.sponsoring && 'Großes Sponsoring'].filter(Boolean).join(' und ') || 'keine';
    K.dialog.confirm({
      title: `${u.showTitle(s)} beenden?`, icon: 'flag', ok: 'Show beenden',
      text: `${s.matches.length} Einträge · ${fmt(s.stars, s.stars % 1 ? 1 : 0)} Sterne${missing ? ` (${missing} ohne Sterne)` : ''}\nHalle: ${s.venue.halle}${s.type === 'PPV' ? ' · PPV' : ''}\nExtras: ${extras} · Rabatt ${o.discount} %\n\nDanach ist die Show gesperrt.`,
    }).then(yes => { if (yes) endShow(s.key, o); });
  });
})(window.KHW);
