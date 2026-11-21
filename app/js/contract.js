// KHW Manager – Vertrag (Klickdummy).
// Ablauf wie im Wireframe: 01 Wrestler wählen → 02 Zeitraum und Show, Angebot einholen → 03 Angebote prüfen und
// annehmen. Passt keines, lässt sich einmal nachverhandeln; daraus entsteht Angebot 3.
// Pro Wrestler gibt es ein Angebot je Spielwoche. Das Formular ist gemeinsam: Beide Spieler sehen denselben
// Wrestler mit denselben Bedingungen. Welche Seite jemand gerade offen hat, bleibt je Tab frei.
// Regeln: rules/contract.js · Speicher: store.js · Bedingungen: IDB-Listen „Vertrag: …“
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc, eur, fmt } = K;
  const C = () => K.rules.contract;
  const ui = () => K.ui;

  /* ───────────── Zustand ───────────── */
  // Gemeinsam: welcher Wrestler, Zeitraum und welche Show im Formular stehen (Startwert: Stand der Tabelle).
  function tab(m) {
    const f = K.store.state.drafts.contractForm;
    if (f) return f;
    const c = m.contract;
    return { person: c.person, duration: /^\d+$/.test(c.duration) ? Number(c.duration) : 'Einmalig', show: C().SHOWS.includes(c.show) ? c.show : 'Lucky7' };
  }
  const setForm = (m, patch) => K.store.update(s => { s.drafts.contractForm = Object.assign({}, tab(m), patch); });
  // Gemeinsam: das Angebot dieser Spielwoche für einen Wrestler (oder null).
  const offerOf = (m, person) => { const o = K.store.state.offers[person]; return o && o.week === C().week(m) ? o : null; };
  const saveOffer = o => K.store.update(s => { s.offers[o.person] = o; });
  /** Was auf der Seite gezeigt wird: das Angebot der Woche oder ein leerer Entwurf aus der Auswahl dieses Tabs. */
  function current(m) {
    const t = tab(m), o = offerOf(m, t.person);
    return o || C().draft(t.person, t.duration, t.show);
  }

  /* ───────────── KI-Antwort in der Verhandlung ─────────────
     Die Würfe (rules/contract.js) legen Ausgang und Gehalt fest. Erst beim Klick auf „Verhandlung starten“ geht
     EINE Anfrage raus: Die KI schreibt die Antwort des Wrestlers und fasst die vereinbarten Bedingungen zusammen.
     Wer klickt, sendet; der Mitspieler sieht „überlegt …“ und danach dasselbe Ergebnis (Sperre wie im Postfach). */
  const LOCK_MS = 120000;
  const device = () => (K.inbox && K.inbox.DEVICE) || 'dev';
  const waiting = d => !!(d.answer && d.answer.pending && Date.now() - d.answer.pending.at < LOCK_MS);
  const CC = () => Object.assign({ aiSentences: 3, aiMaxTokens: 200 }, K.conf.get('contract') || {});
  const worldRules = () => Object.assign(K.conf.defaults('inbox'), K.conf.get('inbox') || {}).system;

  function aiMessages(m, d) {
    const w = m.byName.get(d.person) || {}, a = d.answer, name = d.person;
    const mem = ((K.store.state.memory || {})[name] || []).slice(-2).map(x => x.text).join('; ');
    const who = [w.status, w.show ? 'bei ' + w.show : w.promotion ? 'bei ' + w.promotion : 'ohne Liga', w.alignment, w.gimmick ? 'Gimmick ' + w.gimmick : '',
      w.notes ? 'Besonderheiten: ' + w.notes : '', mem ? 'erinnert sich: ' + mem : ''].filter(Boolean).join(', ');
    const dur = d.duration === 'Einmalig' ? 'einen einmaligen Auftritt' : `${d.duration} Monate`;
    const sie = String(w.gender || '').toLowerCase() === 'w', er = sie ? 'sie' : 'er', Er = sie ? 'Sie' : 'Er';
    const e = x => `${fmt(Math.round(x))} €`;   // ganze Euro (spart Token)
    const outcome = {
      abbruch: `${Er} bricht die Verhandlung verärgert ab, alle Angebote sind vom Tisch.`,
      einig: d.counterPrice && a.price === d.counterPrice ? `${Er} nimmt das Gegenangebot von ${e(a.price)} an.` : `${Er} ist einverstanden, das Gehalt bleibt ${e(a.price)}.`,
      mitte: `So tief geht ${er} nicht; das letzte Wort ist ${e(a.price)}.`,
      nein: `${Er} lehnt ab und besteht auf ${e(d.price)}; es bleibt bei Angebot 1 und 2.`,
    }[a.outcome];
    const used = (a.results || []).map(r => `${r.name} (${r.result})`).join(', ');
    const user = [`Vertragsverhandlung mit ${name}: ${who}.`,
      `Angebot 1: ${e(d.price)} für ${dur} bei ${d.show}${(d.demands || []).length ? `; ${er} fordert ${d.demands.join('; ')}` : ''}.`,
      d.alt ? `Angebot 2: ${e(d.alt.price)}, dafür bietet ${er} ${d.alt.concession}.` : '',
      d.proposal ? `Knight & Hustler schlagen vor: „${d.proposal.trim()}“.` : '',
      d.counterPrice ? `Ihr Gegenangebot beim Gehalt: ${e(d.counterPrice)}.` : '',
      used ? `Eingesetzt: ${used}.` : '',
      `Der Ausgang steht fest: ${outcome}`,
      `Schreibe nur ${sie ? 'ihre' : 'seine'} Antwort in wörtlicher Rede.${d.neg ? ' Letzte Zeile: [Bedingungen: die vereinbarten Bedingungen knapp, mit ; getrennt, ohne Gehalt, oder „keine“]' : ''}`,
    ].filter(Boolean).join('\n');
    return [{ role: 'system', content: `${worldRules()} Du sprichst als ${name}, höchstens ${CC().aiSentences} Sätze.` }, { role: 'user', content: user }];
  }

  async function aiAnswer(person) {
    const m = model(); if (!m) return;
    let claimed = false, snap = null;
    K.store.update(s => {
      const o = s.offers[person];
      if (!o || !o.answer || o.accepted || o.week !== C().week(m)) return;
      if (o.answer.pending && o.answer.pending.by !== device() && Date.now() - o.answer.pending.at < LOCK_MS) return;   // Mitspieler schreibt gerade
      o.answer.pending = { by: device(), at: Date.now() }; o.answer.error = null; claimed = true; snap = JSON.parse(JSON.stringify(o));
    });
    K.render();
    if (!claimed) return;
    try {
      const raw = await K.ai.chat(aiMessages(m, snap), { maxTokens: CC().aiMaxTokens });
      const tag = raw.match(/\[Bedingungen:\s*([^\]]*)\]/i);
      const text = raw.replace(/\[(Bedingungen|Probe|Merken):[^\]]*\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
      K.store.update(s => {
        const o = s.offers[person]; if (!o || !o.answer) return;
        o.answer = Object.assign({}, o.answer, { text: text || o.answer.text, placeholder: false, pending: null, error: null });
        if (o.neg && tag) {
          const terms = tag[1].split(';').map(x => x.trim()).filter(x => x && !/^keine\.?$/i.test(x));
          // Ohne eigenen Vorschlag und ohne neue Bedingungen bleiben die Forderungen aus Angebot 1
          o.neg = Object.assign({}, o.neg, { terms: terms.length || (o.proposal || '').trim() ? terms : o.neg.terms, placeholder: false });
        }
      });
    } catch (e) {
      K.store.update(s => { const o = s.offers[person]; if (o && o.answer) o.answer = Object.assign({}, o.answer, { pending: null, error: e.message }); });
      K.toast('Die KI hat nicht geantwortet: ' + e.message);
    }
    K.render();
  }

  /* ───────────── Ansicht ───────────── */
  /** Vertragsstand eines Wrestlers als Chip: Laufzeit, einmalig oder keiner (dann darf er nicht auftreten). */
  K.contractChip = w => {
    const parts = [], running = w.contractEndAbs !== null && K.model && w.contractEndAbs >= K.model.curAbs;
    if (running) parts.push(`<span class="chip outline">Vertrag bis ${esc(w.contractEnd)}</span>`);
    if (w.onceContract) parts.push(`<span class="chip outline" title="Erlischt nach dem ersten Auftritt">Einmaliger Vertrag${w.onceContract.show ? ' · ' + esc(w.onceContract.show) : ''}</span>`);
    if (!w.contracted) parts.push(`<span class="chip no-contract">${w.contractEndAbs !== null ? `Vertrag abgelaufen (${esc(w.contractEnd)})` : 'Kein Vertrag'}</span>`);
    return parts.join('');
  };
  const contractChip = w => K.contractChip(w);
  const field = (label, control, hint) => `<label class="ro"><span>${esc(label)}</span>${control}${hint ? `<small>${hint}</small>` : ''}</label>`;
  const ro = (label, html) => `<label class="ro"><span>${esc(label)}</span><div class="ro-box">${html || '<i>–</i>'}</div></label>`;
  const step = (no, title, body) => `<div class="form-step"><h4><b>${no}</b>${esc(title)}</h4>${body}</div>`;
  const btn = (label, act, opt = {}) => `<button class="btn ${opt.cls || 'primary'}" data-ct="${act}" ${opt.disabled ? `disabled title="${esc(opt.disabled)}"` : ''} ${opt.name ? `data-name="${esc(opt.name)}"` : ''}>${opt.icon ? ui().icon(opt.icon) : ''}${esc(label)}</button>`;
  const durLabel = d => d === 'Einmalig' ? 'Einmalig' : `${d} ${Number(d) === 1 ? 'Monat' : 'Monate'}`;

  function offerBlock(no, title, price, termLabel, terms, act, note) {
    return `<div class="offer">
      <div class="offer-h"><small class="sub">Angebot ${no}${title ? ' · ' + esc(title) : ''}</small>${note || ''}</div>
      <div class="form-row one-two">${ro('Gehalt', `<b>${eur(price)}</b>`)}${ro(termLabel, terms)}</div>
      ${act ? btn(`Angebot ${no} annehmen`, act, { icon: 'task_alt' }) : ''}</div>`;
  }

  function render(m) {
    const u = ui(), d = current(m), w = m.byName.get(d.person);
    const hasOffer = d.stage !== 'setup';
    const live = (d.stage === 'offered' || d.stage === 'negotiated') && !d.accepted;
    const weekLabel = C().weekLabel(m);

    // 01 Mitarbeiter
    const who = w ? `<div class="chips">${u.tier(w.status)}${w.status ? `<span class="chip outline">${esc(w.status)}</span>` : ''}${w.promotion ? `<span class="chip outline">${esc(w.promotion)}</span>` : ''}${u.showChip(w.show)}${contractChip(w)}</div>`
      : d.person ? '<p class="hint">Nicht in der Datenbank gefunden.</p>' : '';
    const s1 = `<div class="form-row">${field('Name des Wrestlers', `<input class="field" id="ct-person" data-suggest="wrestlers" value="${esc(d.person)}" placeholder="Name eingeben …" autocomplete="off">`)}</div>${who}`;

    // 02 Angebot – ist diese Woche schon eins eingeholt, stehen Zeitraum und Show fest.
    const sel = (id, list, cur, label) => `<select class="field" id="${id}" ${hasOffer ? 'disabled' : ''}>${list.map(v => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label(v))}</option>`).join('')}</select>`;
    const s2 = `<div class="form-row two">${field('Zeitraum', sel('ct-duration', C().DURATIONS, d.duration, durLabel))}${field('Show', sel('ct-show', C().SHOWS, d.show, v => v))}</div>
      ${hasOffer
        ? `<p class="hint">${u.icon('event_repeat')} Für ${esc(d.person)} wurde in dieser Spielwoche (${esc(weekLabel)}) schon ein Angebot eingeholt. Ein neues gibt es ab der nächsten Woche.</p>`
        : btn('Angebot einholen', 'offer', { icon: 'send', disabled: w ? '' : 'Erst einen Wrestler aus der Datenbank wählen.' }) + '<small class="hint">Pro Wrestler gibt es ein Angebot je Spielwoche.</small>'}`;

    // 03 Bedingungen
    let s3;
    if (!hasOffer) s3 = u.empty('Hier stehen die Angebote, sobald eins eingeholt ist.');
    else if (d.stage === 'unavailable') s3 = `<div class="notice">${u.icon('event_busy')}<div><b>${esc(d.person)} ist ${d.answer ? 'nicht mehr' : 'derzeit nicht'} verfügbar.</b><span>${d.answer ? 'Die Verhandlung wurde abgebrochen, alle Angebote sind vom Tisch.' : 'Kein Angebot für einen einmaligen Auftritt.'} Nächster Versuch ab der nächsten Spielwoche.</span></div></div>`;
    else {
      const done = d.accepted;
      const act = which => done ? '' : 'accept-' + which;
      const doneNote = which => done === which ? '<span class="chip accent">angenommen</span>' : '';
      const demands = d.demands && d.demands.length ? d.demands.map(esc).join('<br>') : 'keine';
      s3 = (done ? `<div class="notice ok">${u.icon('task_alt')}<div><b>Vertrag abgeschlossen.</b><span>Steht unten unter „Abgeschlossene Verträge“.</span></div></div>` : '')
        + offerBlock(1, '', d.price, 'Forderung', demands, act('main'), doneNote('main'))
        + (d.alt ? offerBlock(2, 'Alternative', d.alt.price, 'Zugeständnis', `${esc(d.person)} bietet ${esc(d.alt.concession)}`, act('alt'), doneNote('alt')) : '')
        + (d.neg && !waiting(d) ? offerBlock(3, 'Aus der Verhandlung', d.neg.price, 'Bedingungen', d.neg.terms.map(esc).join('<br>') || 'keine', act('neg'),
          doneNote('neg') || (d.answer && d.answer.placeholder ? `<span class="chip outline" title="Die KI hat nicht geantwortet – Bedingungen nach Regel">${u.icon('rule')}ohne KI</span>` : '')) : '');
    }
    // Während die KI schreibt: Ausgang noch nicht zeigen, nichts annehmen
    if (waiting(d)) s3 = `<div class="notice">${u.icon('hourglass_top')}<div><b>${esc(d.person)} überlegt …</b><span>Die Antwort wird gerade geschrieben.</span></div></div>`;

    // Rechts: Übersicht und Verhandlung
    const res = d.answer ? new Map(d.answer.results.map(r => [r.name, r.result])) : new Map();
    const canPick = d.stage === 'offered' && d.negotiating && !d.accepted;
    const checks = `<ul class="checks ${canPick ? 'live' : ''}">${(d.rolls || m.contract.skills).map(r => {
      const on = (d.picks || []).includes(r.name);
      return `<li class="${on ? 'on' : ''}" ${canPick ? `data-ct="pick" data-name="${esc(r.name)}"` : ''}><span class="tick">${on ? u.icon('check') : ''}</span><span>${esc(r.name)}</span>${on && res.get(r.name) ? u.resChip(res.get(r.name)) : ''}<b title="Stufe">${fmt(r.lvl)}</b></li>`;
    }).join('')}</ul>`;
    const mine = d.proposal || d.counterPrice ? { who: 'me', text: [d.proposal, d.counterPrice ? `Gegenangebot: ${eur(d.counterPrice)}` : ''].filter(Boolean).join('\n') } : null;
    const failed = d.answer && !waiting(d) && d.answer.placeholder && !d.accepted;
    const talk = !d.answer ? '' : waiting(d)
      ? u.thread([mine].filter(Boolean)) + `<p class="hint">${u.icon('hourglass_top')} ${esc(d.person)} antwortet gerade …</p>`
      : u.thread([mine, { who: 'gm', text: d.answer.text }].filter(Boolean))
        + (failed ? `<p class="hint">${u.icon('error')} Die KI hat nicht geantwortet${d.answer.error ? ` (${esc(d.answer.error)})` : ''}. Angezeigt wird die Antwort nach Regel; Ausgang und Gehalt bleiben gleich.</p>${btn('KI erneut fragen', 'ai-retry', { icon: 'refresh', cls: 'tonal' })}` : '');
    let verhandlung;
    if (!hasOffer) verhandlung = '<p class="hint">Verhandeln geht, sobald ein Angebot vorliegt.</p>';
    else if (d.stage === 'offered' && !d.negotiating && !d.accepted) verhandlung = `<p class="hint">Passt keines der beiden Angebote, könnt ihr einmal nachverhandeln. Dabei setzt ihr Fertigkeiten ein, und die Spielleitung würfelt dagegen. Kommt er euch entgegen, erscheint das Ergebnis als Angebot 3; lehnt er ab, bleiben die beiden Angebote; bricht er ab, ist alles vom Tisch.</p>
        ${btn('Nachverhandeln', 'open-neg', { icon: 'handshake', cls: 'tonal' })}`;
    else if (canPick) verhandlung = `<p class="hint">Fertigkeiten anklicken, die wir einsetzen. Die Würfe der Spielleitung bleiben bis zur Antwort verdeckt.</p>${checks}
        ${field('Unser Vorschlag', `<textarea class="field area" id="ct-proposal" rows="3" placeholder="Was bieten wir an, worauf bestehen wir?">${esc(d.proposal || '')}</textarea>`)}
        ${field('Gegenangebot Gehalt (€)', `<input class="field" id="ct-counter" type="number" min="0" step="10" value="${d.counterPrice || ''}" placeholder="${d.price ? Math.round(d.price * .85) : ''}">`, 'Leer lassen, um nur über die Bedingungen zu sprechen.')}
        <div class="actions">${btn('Verhandlung starten', 'negotiate', { icon: 'handshake' })}${btn('Abbrechen', 'close-neg', { cls: 'text' })}</div>`;
    else if (d.answer) verhandlung = checks + talk;
    else verhandlung = '<p class="hint">Keine Verhandlung.</p>';


    // Archiv
    const done = K.store.state.contracts.slice().reverse();
    const archive = done.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Wrestler</th><th>Show</th><th>Laufzeit</th><th class="num">Gehalt</th><th>Bedingungen</th><th class="num">Ab Show</th></tr></thead><tbody>${done.map(c =>
      `<tr><td>${u.wl(c.person)}</td><td>${u.showChip(c.show)}</td><td>${esc(durLabel(c.duration))}${c.endMonth ? `<br><small>${c.extended ? 'verlängert ' : ''}bis ${esc(c.endMonth)}</small>` : c.duration === 'Einmalig' ? '<br><small>bis zum ersten Auftritt</small>' : ''}</td><td class="num">${eur(c.price)}</td><td>${c.terms.map(esc).join('<br>') || '<span class="muted">keine</span>'}</td><td class="num">${typeof c.signedAt === 'number' ? c.signedAt : esc(m.show(c.signedAt) ? u.showTitle(m.show(c.signedAt)) : '')}</td></tr>`).join('')}</tbody></table></div>`
      : u.empty('Noch kein Vertrag abgeschlossen.');

    return `<div class="contract-layout">
      <section class="card form-card">
        <header class="card-h"><h3>Vertragsdetails</h3></header>
        ${step('01', 'Mitarbeiter', s1)}
        ${step('02', 'Angebot', s2)}
        ${step('03', 'Bedingungen', s3)}
      </section>
      <div class="contract-side">
        <section class="card"><header class="card-h"><h3>Vertragsübersicht</h3></header><div class="card-b">
          <dl class="summary">
            <dt>Mitarbeiter</dt><dd>${u.wl(d.person) || '–'}</dd>
            <dt>Rolle</dt><dd>Wrestler bei ${esc(d.show)}</dd>
            <dt>Vertrag</dt><dd>${esc(durLabel(d.duration))}</dd>
            <dt>Einstufung</dt><dd>${w && w.status ? u.tier(w.status) + esc(w.status) : '–'}</dd>
            <dt>Gehalt</dt><dd>${live || d.accepted ? eur(d.price) : '–'}</dd>
            <dt>Kontostand</dt><dd>${eur(m.finance.balance)}</dd>
          </dl></div></section>
        <section class="card"><header class="card-h"><h3>Verhandlung</h3>${d.answer ? '<span class="chip outline">abgeschlossen</span>' : ''}</header><div class="card-b">
          ${verhandlung}</div></section>
      </div>
    </div>
    ${u.card('Abgeschlossene Verträge', archive, { icon: 'history_edu', cls: 'archive' })}`;
  }

  // Namensvorschläge für das Feld „Name des Wrestlers“ (ui-select.js)
  K.suggest = K.suggest || {};
  K.suggest.wrestlers = () => (K.model ? K.model.roster : []).map(w => ({
    value: w.name, label: w.name, sub: [w.status, w.show || w.promotion].filter(Boolean).join(' · '),
  }));

  K.views.contract = {
    title: 'Vertrag', icon: 'contract',
    crumb: m => tab(m).person,
    render,
  };

  /* ───────────── Bedienung ───────────── */
  const model = () => K.model;
  /** Das gezeigte Angebot ändern und für alle speichern. */
  function changeOffer(fn) { const m = model(); if (!m) return; const o = offerOf(m, tab(m).person); if (!o) return; const d = Object.assign({}, o); fn(d, m); saveOffer(d); K.render(); }

  function accept(which) {
    const m = model(), d = offerOf(m, tab(m).person);
    if (!d || d.accepted) return;
    const price = which === 'alt' ? d.alt.price : which === 'neg' ? d.neg.price : d.price;
    const no = which === 'alt' ? 2 : which === 'neg' ? 3 : 1;
    K.dialog.confirm({
      title: `Angebot ${no} annehmen?`, icon: 'contract', ok: 'Vertrag abschließen',
      text: `${d.person} · ${durLabel(d.duration)} bei ${d.show}\nGehalt: ${eur(price)}\n\nDas Gehalt wird sofort vom Konto gebucht.`,
    }).then(yes => {
      if (!yes) return;
      const fresh = offerOf(model(), d.person);   // falls der Mitspieler inzwischen etwas geändert hat
      if (!fresh || fresh.accepted) { K.toast('Dieses Angebot wurde inzwischen schon angenommen.'); K.render(); return; }
      const r = C().accept(fresh, which, model());
      K.store.update(s => {
        s.contracts.push(r.record);
        s.bookings.push(r.booking);
        if (r.wrestler) s.wrestlers[d.person] = Object.assign({}, s.wrestlers[d.person], r.wrestler);
        s.offers[d.person] = Object.assign({}, fresh, { accepted: which });
      });
      K.rebuild();
      K.toast(`Vertrag mit ${d.person} abgeschlossen · ${eur(-price)} gebucht`);    });
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-ct]');
    if (!el || el.disabled) return;
    const m = model(); if (!m) return;
    const act = el.dataset.ct;
    if (act === 'open-neg' || act === 'close-neg') {
      changeOffer(d => { d.negotiating = act === 'open-neg'; if (!d.negotiating) { d.picks = []; d.proposal = ''; d.counterPrice = null; } });
    } else if (act === 'pick') {
      changeOffer(d => { d.picks = d.picks.includes(el.dataset.name) ? d.picks.filter(x => x !== el.dataset.name) : d.picks.concat(el.dataset.name); });
    } else if (act === 'offer') {
      const t = tab(m), w = m.byName.get(t.person);
      if (!w || offerOf(m, t.person)) return;
      // Forderungen und Zugeständnisse kommen aus dem IDB (Listen „Vertrag: …“, im IDB-Editor pflegbar).
      const draw = (slot, ctx, exclude) => K.idbDrawSlot(slot, m, Object.assign({}, ctx, { exclude }));
      saveOffer(C().requestOffer(C().draft(t.person, t.duration, t.show), w, draw, m.contract.skills, C().week(m)));
      K.render();
    } else if (act === 'negotiate') {
      // Erst jetzt geht die Anfrage an die KI raus (eine pro Verhandlung)
      const person = tab(m).person, o = offerOf(m, person);
      if (!o || o.answer || o.accepted) return;
      changeOffer((d, mm) => Object.assign(d, C().negotiate(d, mm.byName.get(d.person))));
      aiAnswer(person);
    } else if (act === 'ai-retry') {
      aiAnswer(tab(m).person);
    } else if (act.startsWith('accept-')) {
      accept(act.slice(7));
    }
  });

  // Auswahl in 01 und 02 gilt für beide Spieler. Liegt für den Wrestler schon ein Angebot vor, wird es angezeigt.
  document.addEventListener('change', e => {
    const id = e.target.id, m = model();
    if (!m || !['ct-person', 'ct-duration', 'ct-show'].includes(id)) return;
    const v = e.target.value.trim();
    if (id === 'ct-person') {
      const o = offerOf(m, v);
      setForm(m, o ? { person: v, duration: o.duration, show: o.show } : { person: v });
    } else if (id === 'ct-duration') setForm(m, { duration: v === 'Einmalig' ? 'Einmalig' : Number(v) });
    else setForm(m, { show: v });
    K.render();
  });
  // Vorschlag und Gegenangebot werden mitgeschrieben (auch für den Mitspieler sichtbar), ohne die Seite neu aufzubauen.
  document.addEventListener('input', e => {
    const m = model(); if (!m || !['ct-proposal', 'ct-counter'].includes(e.target.id)) return;
    const o = offerOf(m, tab(m).person); if (!o) return;
    const d = Object.assign({}, o);
    if (e.target.id === 'ct-proposal') d.proposal = e.target.value;
    else { const v = Number(e.target.value); d.counterPrice = v > 0 ? v : null; }
    saveOffer(d);
  });
})(window.KHW);
