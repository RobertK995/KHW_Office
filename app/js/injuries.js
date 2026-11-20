// KHW Manager – Verletzungen.
// Ablauf (Wunsch des Nutzers): Eine Verletzung hat nur einen Grund, keinen Zeitraum. Der Grund kommt aus dem IDB
// (Verwendung injury.reason, Liste „Verletzungen“). Beim Verletzen werden die Behandlungskosten festgehalten:
// der Preis, den „Doktor, Doktor..!“ im Store in diesem Moment hat (er schwankt mit dem Merch der letzten Show).
// Geheilt wird auf der Seite „Verletzte“: Behandlung bezahlen (mit eigenem Rabatt), dann ist das Badge weg.
//
// Für andere Bereiche (später die Interaktionen):  K.injure(name, { reason, source })  – reason leer = aus dem IDB ziehen.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc, eur } = K;
  const icon = n => `<span class="ms">${n}</span>`;

  /** Store-Artikel „Doktor, Doktor..!“ und sein aktueller Preis (ohne Rabatt, positiv). */
  const doctor = m => (m.finance.store || []).find(x => /doktor/i.test(x.name)) || null;
  K.doctorCost = m => { const d = doctor(m); return d ? Math.round(Math.abs(d.price) * 100) / 100 : 0; };

  /** Wrestler verletzen. Gibt den Grund zurück (oder null, wenn es den Wrestler nicht gibt). */
  K.injure = (name, o = {}) => {
    const m = K.model, w = m && m.byName.get(name);
    if (!w) return null;
    let reason = (o.reason || '').trim();
    if (!reason) { const hit = K.idbDrawSlot ? K.idbDrawSlot('injury.reason', m, { person: w }) : null; reason = hit ? hit.text : 'Verletzung'; }
    const cur = m.show(m.currentShow) || m.dueShow;
    const when = cur ? `${K.MONTHS[cur.date.month]}, Woche ${cur.date.week}` : '';
    K.store.update(st => {
      st.wrestlers[name] = Object.assign({}, st.wrestlers[name], { injury: reason, injuryCost: K.doctorCost(m), injuredAt: when, injurySource: o.source || '' });
    });
    K.rebuild();
    return reason;
  };

  /* ───────────── Regeln für die Card ─────────────
     Verletzte dürfen in keinem Match auftreten (Segmente sind erlaubt). Nicht Verfügbare sind nur ein Hinweis. */
  K.isMatchRow = mt => !(mt.promo || /promo|segment/i.test(mt.type || ''));
  /** Namen eines Eintrags, die verletzt sind. Ein Tag Team zählt als verletzt, wenn ein Mitglied verletzt ist. */
  K.injuredIn = (m, mt) => K.participants(mt).filter(p => {
    const w = m.byName.get(p);
    if (w) return !!w.injury;
    return (K.teamMembers(m, p) || []).some(n => { const x = m.byName.get(n); return x && x.injury; });
  });
  K.unavailableIn = (m, mt) => K.participants(mt).map(p => m.byName.get(p)).filter(w => w && w.unavailable);
  /** Alle verletzten Namen in Matches einer Show: [{ i, label, names }] */
  K.injuredInShow = (m, s) => s.matches.map((mt, i) => ({ i, mt, names: K.isMatchRow(mt) ? K.injuredIn(m, mt) : [] })).filter(x => x.names.length);
  /**
   * Ohne Vertrag darf niemand auftreten (Match oder Segment), egal für welche Show der Vertrag gilt.
   * Liefert die Namen ohne Vertrag; bei einem Team die betroffenen Mitglieder („Name (Team)“).
   */
  K.noContractIn = (m, mt) => K.participants(mt).flatMap(p => {
    const w = m.byName.get(p);
    if (w) return w.contracted ? [] : [p];
    return (K.teamMembers(m, p) || []).filter(n => { const x = m.byName.get(n); return x && !x.contracted; }).map(n => `${n} (${p})`);
  });
  K.noContractInShow = (m, s) => s.matches.map((mt, i) => ({ i, mt, names: K.noContractIn(m, mt) })).filter(x => x.names.length);
  const why = (m, n) => { const w = m.byName.get(n); return w ? w.injury : ((K.teamMembers(m, n) || []).find(x => (m.byName.get(x) || {}).injury) || '') + ' verletzt'; };
  K.injuryWhy = why;

  /** Behandlungskosten eines Verletzten: festgehaltener Betrag; Verletzungen aus der Tabelle haben keinen, dann gilt der aktuelle Preis. */
  const costOf = (m, w) => (typeof w.injuryCost === 'number' ? w.injuryCost : K.doctorCost(m));
  const pay = (m, w) => costOf(m, w) * (1 - K.discount('doctor') / 100);

  /* ───────────── Seite ───────────── */
  function discountSel() {
    // Wie im Store, zusätzlich 100 % (Behandlung kostenlos)
    const d = K.discount('doctor'), steps = [...new Set([0, ...K.conf.get('finance').discounts, 100, d])].sort((a, b) => a - b);
    return `<label class="disc-sel" title="Rabatt auf Behandlungen">${icon('sell')}<select class="field" data-disc="doctor">${steps.map(v => `<option value="${v}" ${v === d ? 'selected' : ''}>${v ? v + ' % Rabatt' : 'Kein Rabatt'}</option>`).join('')}</select></label>`;
  }
  const priceHtml = (m, w) => {
    const full = costOf(m, w), d = K.discount('doctor');
    return d ? `<s class="muted">${eur(full, true)}</s> <b>${eur(full * (1 - d / 100), true)}</b>` : `<b>${eur(full, true)}</b>`;
  };
  const meta = (m, w) => [w.show || w.promotion, w.injuredAt ? 'seit ' + w.injuredAt : 'aus der Tabelle', typeof w.injuryCost === 'number' ? '' : 'Kosten: aktueller Preis'].filter(Boolean).join(' · ');

  // Gezeigt werden nur Wrestler, die bei KHW unter Vertrag sind.
  const khw = w => /^khw$/i.test(String(w.promotion || '').trim());
  const top = (w, sub) => `<div class="inj-top">${w.image ? `<img src="${esc(w.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="inj-ph">${icon('person')}</span>`}
      <div><b>${K.ui.wl(w.name)}</b><small>${esc(sub)}</small></div></div>`;

  K.views.injuries = {
    title: 'Verletzte', icon: 'healing',
    // Layout „Karten“ (vom Nutzer gewählt)
    render(m) {
      const u = K.ui, byName = (a, b) => a.name.localeCompare(b.name, 'de');
      const hurt = m.roster.filter(w => w.injury && khw(w)).sort(byName);
      const away = m.roster.filter(w => w.unavailable && khw(w)).sort(byName);
      const total = hurt.reduce((s, w) => s + pay(m, w), 0);
      const doc = doctor(m);
      const head = `<div class="kpis">
          <div class="kpi">${icon('healing')}<div><small>Verletzt</small><b>${hurt.length}</b><span>dürfen in keinem Match auftreten</span></div></div>
          <div class="kpi">${icon('event_busy')}<div><small>Nicht verfügbar</small><b>${away.length}</b><span>Hinweis in der Card, nicht gesperrt</span></div></div>
          <div class="kpi">${icon('medical_services')}<div><small>Doktor, Doktor..! aktuell</small><b>${doc ? eur(K.doctorCost(m), true) : '–'}</b><span>neue Verletzungen kosten diesen Betrag</span></div></div>
          <div class="kpi">${icon('payments')}<div><small>Alle behandeln</small><b>${eur(total, true)}</b><span>Kontostand ${eur(m.finance.balance, true)}</span></div></div>
        </div>`;
      const btn = w => `<button class="btn primary sm" data-inj="heal" data-name="${esc(w.name)}">${icon('medical_services')}Behandeln</button>`;
      const hurtCards = hurt.length ? `<div class="inj-grid">${hurt.map(w => `<section class="card inj-card"><div class="card-b">
          ${top(w, meta(m, w))}
          <span class="chip hurt-chip">${icon('healing')}${esc(w.injury)}</span>
          <div class="inj-pay"><span>Behandlung ${priceHtml(m, w)}</span>${btn(w)}</div></div></section>`).join('')}</div>` : u.card('', u.empty('Niemand bei KHW ist verletzt.'));
      const awayCards = away.length ? `<div class="inj-grid">${away.map(w => `<section class="card inj-card away"><div class="card-b">
          ${top(w, [w.show, w.unavailableAt ? 'seit ' + w.unavailableAt : ''].filter(Boolean).join(' · ') || 'KHW')}
          <span class="chip away-chip">${icon('event_busy')}${esc(w.unavailable)}</span>
          <div class="inj-pay"><span class="muted">ohne Kosten</span><button class="btn tonal sm" data-inj="back" data-name="${esc(w.name)}">${icon('how_to_reg')}Wieder verfügbar</button></div></div></section>`).join('')}</div>` : u.card('', u.empty('Alle sind verfügbar.'));
      // Oberer Teil im Look eines Klinik-Patientenportals (skins.js; im Profilmenü abschaltbar)
      const clinic = K.frame ? K.frame('clinic', {
        url: 'patientenportal.st-brutus-klinikum.de/station-7/ringsport',
        brand: `<div class="xf-brand clinic-brand"><span class="clinic-cross"></span><div><b>St. Brutus Klinikum</b><small>Station 7 · Ringsport-Traumatologie · Patientenportal für Vereine</small></div>
          <span class="grow"></span><span class="clinic-meta"><small>Angemeldet als</small><b>KHW · Vereinskonto 27-3864</b></span>${K.skinEcg()}</div>`,
      }, head + `<div class="inj-head"><h4 class="section">Verletzt</h4><button class="btn tonal sm" data-inj="new">${icon('personal_injury')}Verletzung eintragen</button><span class="grow"></span>${discountSel()}</div>
        ${hurtCards}`) : head + hurtCards;
      return clinic + `
        <div class="inj-head"><h4 class="section">Nicht verfügbar</h4><button class="btn tonal sm" data-inj="away">${icon('event_busy')}Nicht verfügbar setzen</button></div>
        ${awayCards}`;
    },
  };
  const group = K.NAV.find(g => g[0] === 'Kader');
  if (group) group[1].splice(group[1].indexOf('roster') + 1, 0, 'injuries');

  /* ───────────── Bedienung ───────────── */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-inj]');
    if (!b || !K.model) return;
    const m = K.model;
    if (b.dataset.inj === 'heal') {
      const w = m.byName.get(b.dataset.name);
      if (!w) return;
      const price = Math.round(pay(m, w) * 100) / 100, d = K.discount('doctor');
      K.dialog.confirm({
        title: `${w.name} behandeln?`, icon: 'medical_services', ok: 'Bezahlen',
        text: `${w.injury}\nBehandlung: ${eur(price)}${d ? ` (inkl. ${d} % Rabatt)` : ''}\n\nDer Betrag wird sofort vom Konto gebucht, danach ist ${w.name} wieder fit.`,
      }).then(yes => {
        if (!yes) return;
        K.store.update(st => {
          if (price > 0) st.bookings.push({ text: `Doktor, Doktor..!: ${w.name}`, amount: -price, show: m.currentShow });   // 100 % Rabatt: keine Buchung
          st.wrestlers[w.name] = Object.assign({}, st.wrestlers[w.name], { injury: '', injuryCost: null, injuredAt: '', injurySource: '' });
        });
        K.rebuild();
        K.toast(`${w.name} ist wieder fit${price > 0 ? ' · ' + eur(-price) : ' (kostenlos)'}`);
      });
    } else if (b.dataset.inj === 'back') {
      // Nicht verfügbar entfernen: ohne Kosten
      const name = b.dataset.name;
      K.store.update(st => { st.wrestlers[name] = Object.assign({}, st.wrestlers[name], { unavailable: '', unavailableAt: '' }); });
      K.rebuild(); K.toast(`${name} ist wieder verfügbar`);
    } else if (b.dataset.inj === 'away') {
      // Nicht verfügbar wird nur von Hand gesetzt (z. B. Streik, Tournee, exklusiv bei einer anderen Liga)
      K.dialog.form({
        title: 'Nicht verfügbar setzen', icon: 'event_busy', ok: 'Setzen',
        text: 'Der Wrestler bleibt buchbar, die Card weist aber auf ihn hin. Entfernen geht jederzeit ohne Kosten.',
        fields: [
          { id: 'name', label: 'Wrestler', suggest: 'wrestlers', placeholder: 'Name eingeben …' },
          { id: 'reason', label: 'Grund', placeholder: 'z. B. Streik, Auf Tournee, Exklusiv bei …' },
        ],
      }).then(v => {
        if (!v) return;
        const name = v.name.trim(), w = m.byName.get(name), reason = v.reason.trim();
        if (!w) { K.toast(name ? `${name} steht nicht in der Datenbank.` : 'Kein Wrestler gewählt.'); return; }
        if (!reason) { K.toast('Bitte einen Grund angeben.'); return; }
        const cur = m.show(m.currentShow) || m.dueShow;
        K.store.update(st => { st.wrestlers[name] = Object.assign({}, st.wrestlers[name], { unavailable: reason, unavailableAt: cur ? `${K.MONTHS[cur.date.month]}, Woche ${cur.date.week}` : '' }); });
        K.rebuild(); K.toast(`${name}: nicht verfügbar (${reason})`);
      });
    } else if (b.dataset.inj === 'new') {
      K.dialog.form({
        title: 'Verletzung eintragen', icon: 'personal_injury', ok: 'Eintragen',
        text: `Später kommt das aus den Interaktionen. Die Behandlung kostet, was „Doktor, Doktor..!“ gerade kostet: ${eur(K.doctorCost(m), true)}.`,
        fields: [
          { id: 'name', label: 'Wrestler', suggest: 'wrestlers', placeholder: 'Name eingeben …' },
          { id: 'reason', label: 'Grund (leer = aus der IDB-Liste „Verletzungen“ ziehen)', placeholder: 'z. B. Bänderriss im Knie' },
        ],
      }).then(v => {
        if (!v) return;
        const name = v.name.trim(), w = m.byName.get(name);
        if (!w) { K.toast(name ? `${name} steht nicht in der Datenbank.` : 'Kein Wrestler gewählt.'); return; }
        if (w.injury) { K.toast(`${name} ist schon verletzt (${w.injury}).`); return; }
        const reason = K.injure(name, { reason: v.reason, source: 'von Hand' });
        K.toast(`${name}: ${reason}`);
      });
    }
  });
})(window.KHW);
