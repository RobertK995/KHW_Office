// KHW Manager – Regelwerk (nur Admin-Modus).
// Alle Zahlen und Regeln, die ohne neuen Code einstellbar sein sollen: Vertrag, Hallen, Finanzen, Store und Titel.
// Die Werte liegen in K.conf (rules/config.js). Jede Änderung wird sofort gespeichert und gilt für beide Spieler.
// Texte (z. B. Antworten der Verhandlung) gehören ins IDB und werden hier nur verlinkt.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc, eur, fmt } = K;
  const icon = n => `<span class="ms">${n}</span>`;

  const SECTIONS = [
    ['contract', 'Vertrag', 'contract'],
    ['halls', 'Hallen', 'stadium'],
    ['finance', 'Finanzen', 'payments'],
    ['store', 'Store', 'storefront'],
    ['staff', 'Mitarbeiter', 'engineering'],
    ['storage', 'Lager', 'inventory_2'],
    ['skills', 'Fertigkeiten', 'casino'],
    ['ranking', 'Ranking', 'leaderboard'],
    ['stories', 'Storylines', 'auto_stories'],
    ['inbox', 'Postfach', 'mail'],
    ['titles', 'Titel', 'emoji_events'],
  ];

  /* ───────────── Eingabefelder ───────────── */
  // Jedes Feld kennt Bereich (data-rw) und Pfad im Bereich (data-path, JSON). Beim Verlassen wird gespeichert.
  const pid = (sec, path) => 'rw-' + sec + '-' + path.join('-').replace(/[^\w-]/g, '_');
  const attrs = (sec, path, kind) => `id="${pid(sec, path)}" data-rw="${sec}" data-path="${esc(JSON.stringify(path))}" data-kind="${kind}"`;
  const val = v => (v === null || v === undefined ? '' : esc(v));
  const num = (sec, path, v, o = {}) => `<input class="field rw-in ${o.cls || ''}" type="number" step="${o.step || 'any'}" ${o.min !== undefined ? `min="${o.min}"` : ''} ${o.max !== undefined ? `max="${o.max}"` : ''}
    ${attrs(sec, path, o.nullable ? 'numnull' : 'num')} value="${val(v)}" ${o.ph !== undefined && o.ph !== null ? `placeholder="${esc(o.ph)}"` : ''}>`;
  const range = (sec, path, v, o = {}) => `<span class="rw-range">${num(sec, [...path, 0], v[0], o)}<i>bis</i>${num(sec, [...path, 1], v[1], o)}</span>`;
  const pair = (sec, path, v, labels, o = {}) => `<span class="rw-range">${num(sec, [...path, 0], v[0], Object.assign({ ph: labels[0] }, o))}<i>/</i>${num(sec, [...path, 1], v[1], Object.assign({ ph: labels[1] }, o))}</span>`;
  const text = (sec, path, v, o = {}) => `<input class="field rw-in wide" ${attrs(sec, path, o.kind || 'text')} value="${val(v)}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''}>`;
  const check = (sec, path, v, inv) => `<input type="checkbox" class="rw-check" ${attrs(sec, path, inv ? 'boolinv' : 'bool')} ${(inv ? !v : !!v) ? 'checked' : ''}>`;
  const select = (sec, path, v, options) => `<select class="field rw-in" ${attrs(sec, path, 'text')}>${options.map(o => { const [k, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(k)}" ${String(k) === String(v === null || v === undefined ? '' : v) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  const row = (label, ctl, hint) => `<div class="rw-row"><div><b>${esc(label)}</b>${hint ? `<small>${hint}</small>` : ''}</div><div class="rw-ctl">${ctl}</div></div>`;

  function head(sec, title, ic, extra) {
    const changed = K.conf.changed(sec);
    return `<header class="card-h"><h3>${icon(ic)}${esc(title)}${changed ? '<span class="chip outline">geändert</span>' : ''}</h3>
      <span class="rw-head-act">${extra || ''}${changed ? `<button class="btn text" data-rwreset="${sec}" title="Alle Werte dieses Bereichs auf den Standard zurücksetzen">${icon('restart_alt')}Standard</button>` : ''}</span></header>`;
  }
  const card = (body, cls) => `<section class="card rw-card ${cls || ''}"><div class="card-b">${body}</div></section>`;

  /* ───────────── Vertrag ───────────── */
  function contract() {
    const c = K.conf.get('contract'), S = 'contract';
    const tiers = K.STATUS.filter(s => c.prices[s]);
    const prices = `<div class="table-wrap"><table class="table rw-table">
      <thead><tr><th>Einstufung</th><th>Einmalig<br><small>Grundbetrag</small></th><th>Laufzeit<br><small>je Monat</small></th><th>Zufall<br><small>von – bis</small></th><th>Schritt<br><small>× Zufall</small></th>
        <th>TryOut-Faktor<br><small>einmalig</small></th><th>TryOut-Faktor<br><small>Laufzeit</small></th><th>Forderungen<br><small>Angebot 1</small></th></tr></thead>
      <tbody>${tiers.map(t => { const p = c.prices[t]; return `<tr><td>${K.ui.tier(t)} ${esc(t)}</td>
        <td>${num(S, ['prices', t, 'base'], p.base, { min: 0 })}</td><td>${num(S, ['prices', t, 'perMonth'], p.perMonth, { min: 0 })}</td>
        <td><span class="rw-range">${num(S, ['prices', t, 'lo'], p.lo, { step: 1, min: 0, cls: 'xs' })}<i>–</i>${num(S, ['prices', t, 'hi'], p.hi, { step: 1, min: 0, cls: 'xs' })}</span></td>
        <td>${num(S, ['prices', t, 'step'], p.step, { min: 0 })}</td><td>${num(S, ['prices', t, 'tryOnce'], p.tryOnce, { step: 0.05, min: 0, cls: 'xs' })}</td>
        <td>${num(S, ['prices', t, 'tryMonths'], p.tryMonths, { step: 0.05, min: 0, cls: 'xs' })}</td><td>${num(S, ['demands', t], c.demands[t], { step: 1, min: 0, max: 5, cls: 'xs' })}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="hint">Einmalig = Grundbetrag + Zufall × Schritt × TryOut-Faktor. Laufzeit = Monate × ${fmt(c.monthFactor, 1)} × je Monat + Zufall × Schritt × TryOut-Faktor.
        Der TryOut-Faktor gilt nur für Verträge bei TryOut, sonst zählt 1. Forderungen werden nie doppelt gezogen.</p>`;
    const offer = [
      row('Laufzeit-Faktor', num(S, ['monthFactor'], c.monthFactor, { step: 0.1, min: 0 }), 'Monate × Faktor × Betrag je Monat'),
      row('Aufschlag Angebot 2', `${num(S, ['altMarkup'], c.altMarkup, { step: 1, min: 0 })}<span class="unit">%</span>`, 'Mehr Gehalt, dafür macht der Wrestler ein Zugeständnis'),
      row('Nicht verfügbar (Einmalig)', `${num(S, ['unavailable'], c.unavailable, { step: 1, min: 0, max: 100 })}<span class="unit">%</span>`, 'Wahrscheinlichkeit, dass es für einen einmaligen Auftritt kein Angebot gibt'),
      row('Abbruch der Verhandlung', num(S, ['abort'], c.abort, { step: 1 }), 'Ab diesem Punktwert (oder darunter) steht der Wrestler auf. Punkte: Voller Erfolg +2, Erfolg +1, absoluter Gleichstand 0, Gleichstand −1, Fehlschlag −2'),
      row('Einmalig anbieten', check(S, ['once'], c.once), 'Zeitraum „Einmalig“ in der Auswahl'),
      row('Längste Laufzeit', `${num(S, ['maxMonths'], c.maxMonths, { step: 1, min: 1, max: 36 })}<span class="unit">Monate</span>`, 'Die Auswahl geht von 1 Monat bis zu diesem Wert'),
      row('KI-Antwort', `${num(S, ['aiSentences'], c.aiSentences || 3, { step: 1, min: 1, cls: 'xs' })}<span class="unit">Sätze</span>${num(S, ['aiMaxTokens'], c.aiMaxTokens || 200, { step: 10, min: 50 })}<span class="unit">max. Token</span>`, 'Die Würfe bestimmen Ausgang und Gehalt, die KI schreibt die Antwort und fasst die Bedingungen zusammen. Grundregeln der Spielwelt: Regelwerk → Postfach'),
    ].join('');
    const texts = `<p class="hint">${icon('database')} Forderungen und Zugeständnisse sind Texte und stehen im IDB (Listen „Vertrag: …“). Welche Liste wofür zählt, legt die Listen-Zuordnung fest. Die Antworten der Verhandlung schreibt die KI.</p>
      <div class="actions"><a class="btn tonal sm" href="#idb">${icon('database')}IDB öffnen</a><a class="btn tonal sm" href="#idbmap">${icon('account_tree')}Listen-Zuordnung</a></div>`;
    return `<section class="card rw-card">${head(S, 'Preise je Einstufung', 'contract')}<div class="card-b">${prices}</div></section>
      <div class="grid g-2-1"><section class="card rw-card"><header class="card-h"><h3>${icon('handshake')}Angebot und Verhandlung</h3></header><div class="card-b rw-rows">${offer}</div></section>
      <section class="card rw-card"><header class="card-h"><h3>${icon('chat')}Texte</h3></header><div class="card-b">${texts}</div></section></div>`;
  }

  /* ───────────── Hallen ───────────── */
  function halls() {
    const H = K.conf.get('halls'), S = 'halls';
    const used = new Set((K.model ? K.model.shows : []).filter(s => !s.ended).map(s => s.venue && s.venue.halle));
    const items = Object.keys(H).map(name => {
      const h = H[name], P = (...p) => [name, ...p];
      const body = [
        row('Kapazität', num(S, P('capacity'), h.capacity, { step: 1, min: 0 }), 'Plätze in der Halle'),
        row('Ticketpreis Klasse 1', pair(S, P('price'), h.price, ['PPV', 'normal'], { step: 0.01, min: 0 }), 'PPV / normale Show. Klasse 2 kostet das 1,5-Fache, Klasse 3 das Doppelte'),
        row('Preisklasse 3 vorhanden', check(S, P('noClass3'), h.noClass3, true)),
        row('Verkaufte Tickets', [0, 1, 2].map(i => `<span class="rw-line"><span class="rw-lab">Kl. ${i + 1}</span>${range(S, P('sold', i), h.sold[i], { step: 1, min: 0 })}</span>`).join(''), 'Zufällig zwischen von und bis'),
        row('Zusätzlich durch Werbung', [0, 1, 2].map(i => `<span class="rw-line"><span class="rw-lab">Kl. ${i + 1}</span>${range(S, P('ads', i), h.ads[i], { step: 1, min: 0 })}</span>`).join(''), 'Nur wenn beim Beenden „Werbung“ gewählt ist'),
        row('VIP-Tickets verkauft', [0, 1].map(i => `<span class="rw-line"><span class="rw-lab">Kl. ${i + 1}</span>${range(S, P('vip', i), h.vip[i], { step: 1, min: 0 })}</span>`).join('')),
        row('VIP-Preis Klasse 1', pair(S, P('vipPrice'), h.vipPrice, ['PPV', 'normal'], { step: 0.01, min: 0 }), 'Klasse 2: PPV × 1,5, normal × 1,25'),
        row('Versicherung', range(S, P('insurance'), h.insurance, { step: 1, min: 0 }), 'Zufällig zwischen von und bis (× 0,98)'),
        row('Miete', num(S, P('rent', 'base'), h.rent.base, { step: 1, min: 0 }), 'Grundbetrag vor Rabatt'),
        row('Mietanstieg mit Followern', num(S, P('rent', 'grow'), h.rent.grow, { step: 0.05, min: 0, nullable: true, ph: 'fest' }), 'Leer = feste Miete. Sonst steigt die Miete mit dem Follower-Zuwachs der letzten Show (Faktor 0,8 bis 1,45)'),
        row('Werte sind Annahmen', check(S, P('assumed'), h.assumed), 'Zeigt im Show-Editor und in der Abrechnung einen Hinweis'),
      ].join('');
      return `<details class="rw-hall" ${K.state.rwHall === name ? 'open' : ''} data-rwhall="${esc(name)}"><summary>
          <b>${esc(name)}</b>${h.assumed ? '<span class="chip outline">angenommen</span>' : ''}
          <small>${fmt(h.capacity)} Plätze · Ticket ab ${eur(h.price[1])} · Miete ${eur(h.rent.base, true)}${used.has(name) ? ' · in Shows eingeplant' : ''}</small>
          <button class="btn icon" data-rwhall-del="${esc(name)}" title="Halle löschen">${icon('delete')}</button></summary>
        <div class="rw-rows">${body}</div></details>`;
    }).join('');
    return `<section class="card rw-card">${head(S, 'Hallen', 'stadium', `<button class="btn tonal sm" data-rwhall-add>${icon('add')}Halle anlegen</button>`)}
      <div class="card-b"><p class="hint">Für die Abrechnung zählt nur der Hallentyp. Neue Hallen stehen sofort im Show-Editor zur Wahl.</p>${items}</div></section>`;
  }

  /* ───────────── Finanzen ───────────── */
  function finance() {
    const F = K.conf.get('finance'), S = 'finance', ps = K.model ? K.model.finance.pricesSheet : {};
    const general = [
      row('Rabattstufen', text(S, ['discounts'], F.discounts.join(', '), { kind: 'numlist', ph: '0, 25, 50, 75' }), 'In Prozent, mit Komma getrennt. Gilt für Store und Veranstaltungsorte'),
      row('Werbung', `${num(S, ['fees', 'ads'], F.fees.ads, { step: 1, min: 0 })}<span class="unit">€</span>`, 'Kosten beim Beenden einer Show, vor Rabatt'),
      row('Großes Sponsoring', `${num(S, ['fees', 'sponsoring'], F.fees.sponsoring, { step: 1, min: 0 })}<span class="unit">€</span>`, 'Kosten beim Beenden einer Show, vor Rabatt'),
      row('Nachlass auf Werbekosten', `${num(S, ['adDiscount'], F.adDiscount, { step: 1, min: 0, max: 100 })}<span class="unit">%</span>`, 'Wenn „Werbung“ gewählt ist'),
      row('KHW+ Monatspreis', `${num(S, ['prices', 'abo'], F.prices.abo, { step: 0.01, min: 0, nullable: true, ph: ps.abo !== undefined && ps.abo !== null ? String(ps.abo).replace('.', ',') + ' (Tabelle)' : 'Tabelle' })}<span class="unit">€</span>`, 'Leer = Wert aus der Tabelle. Ein Stream kostet Monatspreis ÷ 8,5'),
      row('PPV-Preis', `${num(S, ['prices', 'ppv'], F.prices.ppv, { step: 0.01, min: 0, nullable: true, ph: ps.ppv !== undefined && ps.ppv !== null ? String(ps.ppv).replace('.', ',') + ' (Tabelle)' : 'Tabelle' })}<span class="unit">€</span>`, 'Leer = Wert aus der Tabelle'),
    ].join('');
    const stream = [
      row('Produktionskosten', range(S, ['stream', 'production'], F.stream.production, { step: 1, min: 0 }), 'Zufällig zwischen von und bis (× 1,02)'),
      row('Internet', `${num(S, ['stream', 'internet'], F.stream.internet, { step: 1, min: 0 })}<span class="unit">€</span>`, 'Je Show'),
      row('Personal am Merch-Stand', range(S, ['staff'], F.staff, { step: 1, min: 0 }), 'Zufällig zwischen von und bis (× 0,9)'),
    ].join('');
    const merch = `<div class="table-wrap"><table class="table rw-table"><thead><tr><th>Artikel</th><th>Preisklasse<br><small>der Käufer</small></th><th>Anteil der Zuschauer<br><small>% von – bis</small></th><th>Stückpreis</th><th>Online<br><small>€ von – bis</small></th></tr></thead>
      <tbody>${F.merch.map((x, i) => `<tr><td>${text(S, ['merch', i, 'label'], x.label)}</td><td>${select(S, ['merch', i, 'cls'], x.cls, [[0, 'Klasse 1'], [1, 'Klasse 2'], [2, 'Klasse 3']])}</td>
        <td><span class="rw-range">${num(S, ['merch', i, 'share', 0], x.share[0], { step: 1, min: 0, cls: 'xs' })}<i>–</i>${num(S, ['merch', i, 'share', 1], x.share[1], { step: 1, min: 0, cls: 'xs' })}</span></td>
        <td>${num(S, ['merch', i, 'price'], x.price, { step: 0.01, min: 0 })}</td>
        <td><span class="rw-range">${num(S, ['merch', i, 'online', 0], x.online[0], { step: 1, min: 0 })}<i>–</i>${num(S, ['merch', i, 'online', 1], x.online[1], { step: 1, min: 0 })}</span>${x.rare ? '<small class="muted">selten</small>' : ''}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Vor Ort = Anteil × verkaufte Tickets der Preisklasse × Stückpreis. „Selten“: online meist nichts, sonst das 2- bis 3-Fache. Dazu kommt der Stufenbonus.</p>`;
    return `<div class="grid g-2"><section class="card rw-card">${head(S, 'Preise und Extras', 'payments')}<div class="card-b rw-rows">${general}</div></section>
      <section class="card rw-card"><header class="card-h"><h3>${icon('live_tv')}Streaming und Personal</h3></header><div class="card-b rw-rows">${stream}</div></section></div>
      <section class="card rw-card"><header class="card-h"><h3>${icon('checkroom')}Merchandising</h3></header><div class="card-b">${merch}</div></section>`;
  }

  /* ───────────── Store ───────────── */
  const storeBase = () => (K.model ? K.model.finance.storeSheet : []).map(x => ({ name: x.name, cost: Math.abs(x.price), discountable: !!x.discountable, dyn: x.dyn || null }));
  // Preisart: fest oder abhängig vom Merch der letzten Show (wie in der Tabelle, z. B. Poster vor Ort × 12 − Autogramme vor Ort)
  const DYN = [['', 'Fester Preis'], ['0', 'Poster vor Ort ×'], ['1', 'T-Shirts vor Ort ×']];
  function priceCell(S, x, i) {
    const kind = `<select class="field rw-in" ${attrs(S, [i, 'dyn'], 'dyn')}>${DYN.map(([k, l]) => `<option value="${k}" ${String(x.dyn ? x.dyn.merch : '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    if (!x.dyn) return `<span class="rw-range">${kind}${num(S, [i, 'cost'], x.cost, { step: 0.01, min: 0 })}</span>`;
    const now = K.model && K.model.finance.store[i];
    return `<span class="rw-range">${kind}${num(S, [i, 'dyn', 'factor'], x.dyn.factor, { step: 0.5, min: 0, cls: 'xs' })}<i>− Autogramme vor Ort</i></span>
      <small>aktuell ${now && now.dyn ? eur(-now.price) : '–'} · ändert sich nach jeder Show</small>`;
  }
  function store() {
    const own = K.conf.get('store'), S = 'store', list = own || storeBase();
    const rows = list.map((x, i) => `<tr><td>${text(S, [i, 'name'], x.name)}</td><td>${priceCell(S, x, i)}</td>
      <td class="c">${check(S, [i, 'discountable'], x.discountable)}</td><td class="c"><button class="btn icon" data-rwstore-del="${i}" title="Artikel löschen">${icon('delete')}</button></td></tr>`).join('');
    return `<section class="card rw-card">${head(S, 'Store-Artikel', 'storefront', `<button class="btn tonal sm" data-rwstore-add>${icon('add')}Artikel</button>`)}<div class="card-b">
      ${own ? '' : '<p class="hint">Noch die Artikel aus der Tabelle. Sobald du etwas änderst, gilt diese Liste.</p>'}
      <div class="table-wrap"><table class="table rw-table"><thead><tr><th>Artikel</th><th>Preis (€)</th><th class="c">Rabatt möglich</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="empty">Keine Artikel.</td></tr>'}</tbody></table></div>
      <p class="hint">Gekauft wird auf der Finanzen-Seite per Klick. Artikel ohne „Rabatt möglich“ kosten immer gleich viel.</p></div></section>`;
  }

  /* ───────────── Titel ───────────── */
  function titles() {
    const T = K.conf.get('titles'), S = 'titles', m = K.model;
    const all = m ? m.titlesAll : [];
    const hidden = new Set(T.hidden || []);
    const list = all.map(t => `<tr class="${hidden.has(t.name) ? 'is-off' : ''}"><td><b>${esc(t.name)}</b>${t.section ? `<small>${esc(t.section)}</small>` : ''}</td>
      <td>${t.holder ? esc(t.holder) : '<span class="muted">vakant</span>'}</td><td>${(T.extra || []).includes(t.name) ? '<span class="chip outline">ergänzt</span>' : '<span class="muted">Tabelle</span>'}</td>
      <td class="rw-img"><img src="${esc(K.titleImage(t.name))}" alt="" referrerpolicy="no-referrer" onerror="this.src='${K.TITLE_IMG}'">${text(S, ['images', t.name], (T.images || {})[t.name] || '', { ph: 'Platzhalter – Bild-Adresse eintragen' })}</td>
      <td class="c"><input type="checkbox" class="rw-check" data-rwt="vis" data-name="${esc(t.name)}" ${hidden.has(t.name) ? '' : 'checked'} title="In der App zeigen"></td>
      <td class="c">${(T.extra || []).includes(t.name) ? `<button class="btn icon" data-rwt="del" data-name="${esc(t.name)}" title="Titel entfernen">${icon('delete')}</button>` : ''}</td></tr>`).join('');
    const names = ['', ...all.filter(t => !hidden.has(t.name)).map(t => t.name)];
    const series = Object.values(K.seriesConf()).filter(cf => !cf.deletedFrom);
    const main = series.map(cf => { const v = (T.main || {})[cf.label] || {}; return `<tr><td>${K.ui.showChip(cf.custom ? 'Weekly' : cf.id, cf.label, K.seriesStyle(cf.id))}</td>
      <td>${select(S, ['main', cf.label, 'm'], v.m || '', names.map(n => [n, n || '– keiner –']))}</td><td>${select(S, ['main', cf.label, 'w'], v.w || '', names.map(n => [n, n || '– keiner –']))}</td></tr>`; }).join('');
    return `<div><section class="card rw-card">${head(S, 'Titel', 'emoji_events')}<div class="card-b">
        <div class="table-wrap"><table class="table rw-table"><thead><tr><th>Titel</th><th>Träger</th><th>Herkunft</th><th>Bild (Adresse)</th><th class="c">Zeigen</th><th></th></tr></thead><tbody>${list}</tbody></table></div>
        <div class="rw-add"><input class="field" id="rw-newtitle" placeholder="Neuer Titel, z. B. Hardcore Titel"><button class="btn tonal" data-rwt="add">${icon('add')}Titel ergänzen</button></div>
        <p class="hint">Neue Titel sind zunächst vakant. Den ersten Träger bestimmt ein Titelmatch. Ausgeblendete Titel fehlen in der Titelseite und in der Titelauswahl der Shows.</p></div></section>
      <section class="card rw-card"><header class="card-h"><h3>${icon('workspace_premium')}Haupttitel je Show</h3></header><div class="card-b">
        <div class="table-wrap"><table class="table rw-table"><thead><tr><th>Show</th><th>Männer</th><th>Frauen</th></tr></thead><tbody>${main}</tbody></table></div>
        <p class="hint">Gilt z. B. für Vertragsforderungen wie „eine Titelchance auf …“ (IDB-Variable Titel → Haupttitel der Vertrags-Show).</p></div></section></div>`;
  }

  /* ───────────── Mitarbeiter ───────────── */
  function staff() {
    const c = K.conf.get('staff'), S = 'staff';
    const per = (label, path, v, o, hint) => row(label, `<span class="rw-line"><span class="rw-lab">normal</span>${o(S, [...path, 'normal'], v.normal)}</span><span class="rw-line"><span class="rw-lab">selten</span>${o(S, [...path, 'rare'], v.rare)}</span>`, hint);
    const stepRange = (sec, path, v) => `<span class="rw-range">${num(sec, [...path, 0], v[0], { step: 1, min: 0 })}<i>bis</i>${num(sec, [...path, 1], v[1], { step: 1, min: 0 })}<i>in Schritten von</i>${num(sec, [...path, 2], v[2], { step: 1, min: 1, cls: 'xs' })}</span>`;
    const plain = (sec, path, v) => range(sec, path, v, { step: 1, min: 0 });
    const slots = [
      row('Lagerplätze je Platz', [0, 1, 2, 3, 4, 5].map(i => `<span class="rw-line"><span class="rw-lab">Platz ${i + 1}</span>${num(S, ['capacity', i], c.capacity[i], { step: 1, min: 0, cls: 'xs' })}</span>`).join(''), 'Jeder freigeschaltete Platz vergrößert das gemeinsame Lager um diese Zahl. Volles Lager: erst einlösen, dann einlagern'),
      ...[0, 1, 2, 3, 4, 5].filter(i => c.unlock[i]).map(i => row(`Freischalten Platz ${i + 1}`, `${num(S, ['unlock', i, 'money'], c.unlock[i].money, { step: 1000, min: 0 })}<span class="unit">€</span>${num(S, ['unlock', i, 'stars'], c.unlock[i].stars, { step: 10, min: 0 })}<span class="unit">Sterne</span>`)),
      row('Cooldown', `${num(S, ['cooldownMinutes'], c.cooldownMinutes, { step: 1, min: 0 })}<span class="unit">Minuten</span>${num(S, ['cooldownStars'], c.cooldownStars, { step: 1, min: 0 })}<span class="unit">Sterne</span>`, 'Beim Ablehnen eines Bewerbers und beim Räumen eines Platzes'),
    ].join('');
    const people = [
      row('Seltene Bewerber', `${num(S, ['rareChance'], c.rareChance, { step: 1, min: 0, max: 100 })}<span class="unit">%</span>`, 'Selten = teurer, länger, Vorteil aus der Liste „Mitarbeiter: Vorteile (selten)“'),
      per('Gehalt (€)', ['money'], c.money, stepRange),
      per('Sterne beim Einstellen', ['stars'], c.stars, stepRange),
      row('Vertragsdauer', `${plain(S, ['contractDays'], c.contractDays)}<span class="unit">Tage</span>`, 'Ende zu einer zufälligen vollen Stunde'),
      per('Produktionszeit (% der Vertragsdauer)', ['prodShare'], c.prodShare, plain, 'Zum Beispiel 10 Tage Vertrag und 10 % = 24 Stunden je Vorteil'),
    ].join('');
    const fd = K.conf.defaults('staff').forge, f = Object.assign({}, fd, c.forge || {});
    f.upgrade = Object.assign({}, fd.upgrade, f.upgrade); f.recycle = Object.assign({}, fd.recycle, f.recycle);
    const forge = [
      row('Dauer und Kosten', `${num(S, ['forge', 'hours'], f.hours, { step: 1, min: 0 })}<span class="unit">Stunden</span>${num(S, ['forge', 'stars'], f.stars, { step: 1, min: 0 })}<span class="unit">Sterne</span>`),
      row('Upgraden', `${num(S, ['forge', 'upgrade', 'count'], f.upgrade.count, { step: 1, min: 1, cls: 'xs' })}<span class="unit">gleiche Vorteile einsetzen</span>`, 'Ergebnis: derselbe Vorteil eine Stufe höher (nächsthöhere Zahl in den IDB-Listen)'),
      row('Recyceln', `${num(S, ['forge', 'recycle', 'count'], f.recycle.count, { step: 1, min: 1, cls: 'xs' })}<span class="unit">beliebige Vorteile einsetzen</span>${num(S, ['forge', 'recycle', 'rareChance'], f.recycle.rareChance, { step: 1, min: 0, max: 100, cls: 'xs' })}<span class="unit">% selten</span>`, 'Ergebnis: zufälliger neuer Vorteil'),
    ].join('');
    return `<div class="grid g-2"><section class="card rw-card">${head(S, 'Plätze', 'engineering')}<div class="card-b rw-rows">${slots}</div></section>
      <section class="card rw-card"><header class="card-h"><h3>${icon('person_search')}Bewerber</h3></header><div class="card-b rw-rows">${people}</div></section></div>
      <section class="card rw-card"><header class="card-h"><h3>${icon('construction')}Schmiede</h3></header><div class="card-b rw-rows">${forge}</div></section>
      <p class="hint">${icon('database')} Vorteile und Namen stehen im IDB (Listen „Mitarbeiter: …“).</p>`;
  }

  /* ───────────── Lager: Bilder je Kategorie ───────────── */
  function storage() {
    const c = K.conf.get('storage') || {}, S = 'storage';
    const rows = K.STORAGE_CATS.map(cat => row(cat, `<span class="rw-img"><img src="${esc(K.storageImage(cat))}" alt="" referrerpolicy="no-referrer" onerror="this.src='${K.STORAGE_IMG}'">${text(S, ['images', cat], (c.images || {})[cat] || '', { ph: 'Platzhalter – Bild-Adresse eintragen' })}</span>`)).join('');
    return `<section class="card rw-card">${head(S, 'Bilder im Lager', 'image')}<div class="card-b rw-rows">${rows}</div></section>
      <p class="hint">Leer = Platzhalter. Bilder können eine Internet-Adresse sein oder eine Datei im Projektordner, z. B. ../img/lager/Apron.png.</p>`;
  }

  /* ───────────── Fertigkeiten: Stufen ───────────── */
  function skills() {
    const c = K.conf.get('skills') || {}, S = 'skills', own = c.levels || {};
    const list = (K.model && K.model.contract && K.model.contract.skills) || [];
    const rows = list.map(s => row(s.name, `${num(S, ['levels', s.name], typeof own[s.name] === 'number' ? own[s.name] : null, { step: 1, min: 0, nullable: true, ph: s.sheetLvl, cls: 'xs' })}<span class="unit">Stufe</span>`,
      typeof own[s.name] === 'number' ? `Tabelle: ${fmt(s.sheetLvl)}` : '')).join('');
    return `<section class="card rw-card">${head(S, 'Stufen der Fertigkeiten', 'casino')}<div class="card-b rw-rows">${rows || '<p class="empty">Keine Fertigkeiten gefunden.</p>'}</div></section>
      <p class="hint">Gilt überall, wo gewürfelt wird (Vertragsverhandlung, Mails und Termine). Leer = Wert aus der Tabelle (grau angezeigt). Je höher die Stufe, desto leichter die Würfe.</p>`;
  }

  /* ───────────── Ranking: Status-Stufen je Show ───────────── */
  function ranking() {
    const S = 'ranking', c = (K.conf.get('ranking') || {}).bands || {}, m = K.model;
    const TIERS = ['Main Event', 'Uppercard', 'Midcard', 'Lowercard'];
    const rows = (K.RANK_SHOWS || []).flatMap(show => [['m', 'Männer'], ['w', 'Frauen']].map(([g, gl]) => {
      const key = show + '|' + g, own = c[key] || {}, pct = own.unit === 'pct', sheet = (m && m.rankSheetBands[key]) || {};
      const list = m ? m.ranking[show][g].singles : [];
      const count = t => list.filter(e => (e.band || 'Newcomer') === t).length;
      const custom = TIERS.some(t => typeof own[t] === 'number');
      return `<tr><td>${K.ui.showChip(show)} <b>${gl}</b><small>${list.length} im Ranking</small></td>
        <td>${select(S, ['bands', key, 'unit'], own.unit || 'count', [['count', 'Anzahl'], ['pct', 'Prozent']])}</td>
        ${TIERS.map(t => `<td>${num(S, ['bands', key, t], typeof own[t] === 'number' ? own[t] : null, { step: 1, min: 0, max: pct ? 100 : undefined, nullable: true, ph: pct ? '0' : (sheet[t] || 0), cls: 'xs' })}${pct ? '<span class="unit">%</span>' : ''}</td>`).join('')}
        <td class="rw-prev">${TIERS.map(t => `${K.ui.tier(t)}${count(t)}`).join(' ')} ${K.ui.tier('Newcomer')}${count('Newcomer')}<small>${custom ? 'eigene Einstellung' : 'wie in der Tabelle'}</small></td></tr>`;
    })).join('');
    return `<section class="card rw-card">${head(S, 'Status-Stufen nach Platz', 'leaderboard')}<div class="card-b">
        <div class="table-wrap"><table class="table rw-table"><thead><tr><th>Show</th><th>Einheit</th>${TIERS.map(t => `<th>${K.ui.tier(t)} ${esc(t)}</th>`).join('')}<th>So verteilt es sich jetzt</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="hint">Von oben nach unten: Die besten Plätze bekommen Main Event, dann Uppercard, Midcard und Lowercard; wer danach kommt, ist Newcomer.
          <b>Anzahl</b> = feste Plätze (leer = wie in der Tabelle, grau angezeigt). <b>Prozent</b> = Anteil am Kader dieser Show, gerundet – passt sich an, wenn der Kader wächst oder schrumpft.
          Alle Felder leer = Farben der Tabelle. Die Status selbst ändern sich wie bisher beim nächsten „Show beenden“; im Ranking zeigt ${icon('sync_problem')} schon vorher, wer auf- oder absteigt.</p></div></section>`;
  }

  /* ───────────── Storylines: Belohnung ───────────── */
  function stories() {
    const c = Object.assign(K.conf.defaults('stories'), K.conf.get('stories') || {}), S = 'stories';
    const list = (k, label, hint) => row(label, text(S, [k], c[k].join(', '), { kind: 'numlistAny', ph: '0, 4, 6' }), hint);
    const rows = [
      list('skill', 'Skillpunkte: Faktoren', 'Einer wird zufällig gezogen'),
      row('Skillpunkte: Multiplikator', num(S, ['skillFactor'], c.skillFactor, { step: 0.5, min: 0 }), 'Skillpunkte = Faktor × Multiplikator × Wochen'),
      list('stars', 'Sterne: Faktoren', 'Sterne = Faktor × Wochen'),
      list('money', 'Geld: Faktoren (€)', 'Geld = Faktor × Wochen'),
      row('Bonus je Main-Event-Beteiligtem', `${num(S, ['meBonus'], c.meBonus, { step: 1, min: 0 })}<span class="unit">Sterne</span>`),
    ].join('');
    return `<section class="card rw-card">${head(S, 'Belohnung beim Abschluss', 'emoji_events')}<div class="card-b rw-rows">${rows}</div></section>
      <p class="hint">Wie StoryBelohnung in der Tabelle: Wochen = wie lange die Storyline aktiv war (ab „seit …“ bis zum Abschluss). Eine 0 unter den Faktoren heißt: Es kann auch nichts geben.</p>`;
  }

  /* ───────────── Postfach (News, Mails, Termine) ───────────── */
  function inbox() {
    const c = Object.assign(K.conf.defaults('inbox'), K.conf.get('inbox') || {}), S = 'inbox';
    const pct = (path, v) => `${num(S, path, v, { step: 1, min: 0, max: 100, cls: 'xs' })}<span class="unit">%</span>`;
    const trio = (key, v) => [['mail', 'Mails'], ['meet', 'Termine'], ['news', 'News']].map(([k, l]) => `<span class="rw-line"><span class="rw-lab">${l}</span>${pct([key, k], v[k])}</span>`).join('');
    const rows = [
      row('Einträge nach einer Show', [0, 1, 2, 3, 4].map(i => `<span class="rw-line"><span class="rw-lab">${i}</span>${pct(['count', i], c.count[i])}</span>`).join(''), 'Wahrscheinlichkeit für 0 bis 4 neue Einträge'),
      row('Arten nach normaler Show', trio('kinds', c.kinds), 'Mails haben immer Vorrang: Es gibt nie mehr Termine oder News als Mails'),
      row('Arten nach einem PPV', trio('kindsPPV', c.kindsPPV)),
      row('Wer was anspricht', '<a href="#idbmap">Listen-Zuordnung öffnen</a>', 'Absender × Thema (und Personen × Anlass, Quellen × Schlagzeilen) samt Gewicht legt ihr dort als Kombinationen fest'),
      row('Skillpunkte', `${num(S, ['costOwn'], c.costOwn, { step: 1, min: 0, cls: 'xs' })}<span class="unit">eigene Mail / eigener Termin</span>${num(S, ['costAspect'], c.costAspect, { step: 1, min: 0, cls: 'xs' })}<span class="unit">je Aspekt</span>`, 'Antworten sind frei'),
      row('Aspekt-Bonus', num(S, ['aspectBonus'], c.aspectBonus, { step: 1, min: 0, cls: 'xs' }), 'So viel leichter werden die Würfe mit Aspekt (bisher 20)'),
      row('Auf Ergebnis zulaufen ab', `${num(S, ['finalAfter'], c.finalAfter, { step: 1, min: 1, cls: 'xs' })}<span class="unit">eigenen Antworten</span>`, 'Davor gibt es keine Andeutung, wie lang es noch geht'),
      row('Länge', `${num(S, ['sentences'], c.sentences, { step: 1, min: 1, cls: 'xs' })}<span class="unit">Sätze (Mail, Termin)</span>${num(S, ['newsSentences'], c.newsSentences, { step: 1, min: 1, cls: 'xs' })}<span class="unit">Sätze (News)</span>${num(S, ['maxTokens'], c.maxTokens, { step: 10, min: 50 })}<span class="unit">max. Token</span>`, 'Je kürzer, desto weniger Token'),
    ].join('');
    const sys = `<textarea class="field area rw-in wide" rows="7" ${`id="rw-inbox-system" data-rw="inbox" data-path="${esc(JSON.stringify(['system']))}" data-kind="text"`}>${esc(c.system)}</textarea>`;
    return `<section class="card rw-card">${head(S, 'Postfach', 'mail')}<div class="card-b rw-rows">${rows}</div></section>
      <section class="card rw-card"><header class="card-h"><h3>${icon('smart_toy')}Grundregeln an die KI</h3></header><div class="card-b">${sys}
        <p class="hint">Geht bei jeder Anfrage mit – deshalb kurz halten. Die Länge („höchstens … Sätze“) hängt die App selbst an. Modell und Token stellt ihr je Gerät in der Admin-Leiste unter „KI“ ein.</p></div></section>`;
  }

  const RENDER = { contract, halls, finance, store, staff, storage, skills, ranking, stories, inbox, titles };

  K.views.rules = {
    title: 'Regelwerk', icon: 'rule', adminOnly: true,
    // Layout „Reiter“ (vom Nutzer gewählt): ein Bereich nach dem anderen
    render(m, st) {
      const tab = SECTIONS.some(s => s[0] === st.rwTab) ? st.rwTab : 'contract';
      const intro = `<p class="hint">${icon('sync')} Änderungen werden sofort gespeichert und gelten für beide Spieler. „Standard“ am jeweiligen Bereich stellt die ursprünglichen Werte wieder her; ein Punkt am Reiter zeigt, dass dort etwas vom Standard abweicht.</p>`;
      return `${intro}<div class="seg rw-tabs">${SECTIONS.map(([id, label, ic]) => `<button class="${id === tab ? 'on' : ''}" data-set="rwTab" data-value="${id}">${icon(ic)}${label}${K.conf.changed(id) ? ' ·' : ''}</button>`).join('')}</div>
        ${RENDER[tab]()}`;
    },
  };
  const group = K.NAV.find(g => g[0] === 'Admin');
  if (group) group[1].push('rules'); else K.NAV.push(['Admin', ['rules']]);

  /* ───────────── Speichern ───────────── */
  // Nach dem Speichern Modell neu aufbauen; Fokus und Schreibmarke bleiben im gerade aktiven Feld.
  const refresh = () => setTimeout(() => K.onRemoteChange(), 0);
  function setPath(obj, path, v) {
    let o = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (o[path[i]] === undefined || o[path[i]] === null) o[path[i]] = typeof path[i + 1] === 'number' ? [] : {};
      o = o[path[i]];
    }
    o[path[path.length - 1]] = v;
  }
  function parse(el) {
    const k = el.dataset.kind, raw = el.type === 'checkbox' ? el.checked : el.value.trim();
    if (k === 'dyn') return { ok: true, v: raw };
    if (k === 'bool') return { ok: true, v: !!raw };
    if (k === 'boolinv') return { ok: true, v: !raw };
    if (k === 'text') return { ok: true, v: /^\d+$/.test(raw) && el.tagName === 'SELECT' ? Number(raw) : raw };
    if (k === 'numlistAny') { const l = raw.split(/[;,\s]+/).map(x => Number(x.replace(',', '.'))).filter(x => Number.isFinite(x) && x >= 0); return l.length ? { ok: true, v: l } : { ok: false }; }
    if (k === 'numlist') { const l = raw.split(/[;,\s]+/).map(x => Number(x.replace(',', '.'))).filter(x => Number.isFinite(x) && x >= 0 && x < 100); return { ok: true, v: [...new Set(l)].sort((a, b) => a - b) }; }
    if (raw === '') return k === 'numnull' ? { ok: true, v: null } : { ok: false };
    const n = Number(String(raw).replace(',', '.'));
    return Number.isFinite(n) ? { ok: true, v: n } : { ok: false };
  }
  document.addEventListener('change', e => {
    const el = e.target;
    if (!el.dataset || !el.dataset.rw) return;
    const sec = el.dataset.rw, path = JSON.parse(el.dataset.path), p = parse(el);
    if (!p.ok) { refresh(); return; }   // leeres Pflichtfeld: alter Wert erscheint wieder
    if (sec === 'store' && el.dataset.kind === 'dyn') {
      // Preisart wechseln: fest ↔ abhängig vom Merch (Faktor bleibt erhalten, Standard 12)
      K.conf.edit('store', v => { const it = v[path[0]]; it.dyn = el.value === '' ? null : { merch: Number(el.value), factor: (it.dyn && it.dyn.factor) || 12 }; }, storeBase());
    } else if (sec === 'store') K.conf.edit('store', v => { setPath(v, path, p.v); }, storeBase());
    else K.conf.edit(sec, v => { setPath(v, path, p.v); });
    refresh();
  });

  document.addEventListener('click', e => {
    const t = e.target;
    const reset = t.closest('[data-rwreset]');
    if (reset) {
      const sec = reset.dataset.rwreset, label = (SECTIONS.find(s => s[0] === sec) || [, sec])[1];
      K.dialog.confirm({ title: `${label}: Standard wiederherstellen?`, icon: 'restart_alt', danger: true, ok: 'Zurücksetzen', text: sec === 'store' ? 'Danach gelten wieder die Artikel aus der Tabelle.' : 'Alle Änderungen in diesem Bereich gehen verloren.' })
        .then(yes => { if (yes) { K.conf.reset(sec); K.rebuild(); K.toast(`${label}: Standardwerte`); } });
      return;
    }

    // Hallen
    if (t.closest('[data-rwhall-add]')) {
      const names = Object.keys(K.conf.get('halls'));
      K.dialog.form({
        title: 'Halle anlegen', icon: 'stadium', ok: 'Anlegen', text: 'Die neue Halle übernimmt alle Werte der Vorlage. Danach kannst du sie anpassen.',
        fields: [{ id: 'name', label: 'Name', placeholder: 'z. B. Lanxess Arena' }, { id: 'from', label: 'Vorlage', type: 'select', value: 'Klassische Sportarena', options: names.map(n => [n, n]) }],
      }).then(v => {
        if (!v) return;
        const name = v.name.trim();
        if (!name) { K.toast('Ohne Namen wurde keine Halle angelegt.'); return; }
        if (names.includes(name)) { K.toast(`„${name}“ gibt es schon.`); return; }
        K.conf.edit('halls', h => { h[name] = JSON.parse(JSON.stringify(h[v.from] || h[names[0]])); delete h[name].assumed; });
        K.state.rwHall = name;
        K.rebuild(); K.toast(`Halle „${name}“ angelegt`);
      });
      return;
    }
    const hdel = t.closest('[data-rwhall-del]');
    if (hdel) {
      e.preventDefault();
      const name = hdel.dataset.rwhallDel, names = Object.keys(K.conf.get('halls'));
      if (names.length < 2) { K.toast('Die letzte Halle kann nicht gelöscht werden.'); return; }
      const fallback = names.includes('HK Casino') && name !== 'HK Casino' ? 'HK Casino' : names.find(n => n !== name);
      K.dialog.confirm({ title: `${name} löschen?`, icon: 'delete', danger: true, ok: 'Löschen', text: `Shows, die hier geplant sind, werden wie „${fallback}“ abgerechnet, bis du eine andere Halle wählst.` })
        .then(yes => {
          if (!yes) return;
          const before = K.conf.all().halls;
          K.conf.edit('halls', h => { delete h[name]; });
          K.rebuild();
          K.toast(`${name} gelöscht`, { action: 'Rückgängig', onAction: () => { if (before) K.conf.edit('halls', () => before); else K.conf.reset('halls'); K.rebuild(); } });
        });
      return;
    }

    // Store
    if (t.closest('[data-rwstore-add]')) { K.conf.edit('store', v => { v.push({ name: 'Neuer Artikel', cost: 0, discountable: true }); }, storeBase()); K.rebuild(); return; }
    const sdel = t.closest('[data-rwstore-del]');
    if (sdel) {
      const i = Number(sdel.dataset.rwstoreDel);
      const list = K.conf.get('store') || storeBase(), item = list[i];
      K.conf.edit('store', v => { v.splice(i, 1); }, storeBase());
      K.rebuild();
      K.toast(`${item ? item.name : 'Artikel'} gelöscht`, { action: 'Rückgängig', onAction: () => { K.conf.edit('store', v => { v.splice(i, 0, item); }, storeBase()); K.rebuild(); } });
      return;
    }

    // Titel
    const tt = t.closest('[data-rwt]');
    if (tt && tt.dataset.rwt === 'add') {
      const inp = document.getElementById('rw-newtitle'), name = inp ? inp.value.trim() : '';
      if (!name) { if (inp) inp.focus(); return; }
      if (K.model && K.model.titlesAll.some(x => x.name.toLowerCase() === name.toLowerCase())) { K.toast(`„${name}“ gibt es schon.`); return; }
      K.conf.edit('titles', v => { v.extra = (v.extra || []).concat(name); });
      K.rebuild(); K.toast(`Titel „${name}“ ergänzt (vakant)`);
    } else if (tt && tt.dataset.rwt === 'del') {
      const name = tt.dataset.name;
      K.conf.edit('titles', v => { v.extra = (v.extra || []).filter(x => x !== name); v.hidden = (v.hidden || []).filter(x => x !== name); });
      K.rebuild();
      K.toast(`${name} entfernt`, { action: 'Rückgängig', onAction: () => { K.conf.edit('titles', v => { v.extra = (v.extra || []).concat(name); }); K.rebuild(); } });
    }
  });
  // Titel ein- und ausblenden
  document.addEventListener('change', e => {
    const el = e.target;
    if (!el.dataset || el.dataset.rwt !== 'vis') return;
    const name = el.dataset.name, show = el.checked;
    K.conf.edit('titles', v => { v.hidden = (v.hidden || []).filter(x => x !== name).concat(show ? [] : [name]); });
    refresh();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'rw-newtitle') { const b = document.querySelector('[data-rwt="add"]'); if (b) b.click(); } });
  // Geöffnete Halle merken, damit sie nach dem Speichern offen bleibt
  document.addEventListener('toggle', e => {
    const d = e.target;
    if (!d.dataset || !d.dataset.rwhall) return;
    if (d.open) K.state.rwHall = d.dataset.rwhall; else if (K.state.rwHall === d.dataset.rwhall) K.state.rwHall = null;
  }, true);
})(window.KHW);
