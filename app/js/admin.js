// KHW Manager – Admin-Modus.
// Eine zweite Version der App für Tests und Korrekturen. Der Standardmodus bleibt unverändert; umgeschaltet wird
// dezent über das Profilmenü (Kreis „KH“ oben rechts). Der Modus gilt für dieses Gerät (nicht für den Mitspieler).
//
// Im Admin-Modus:
//   · Admin-Leiste unter der Kopfzeile: Spieldatum springen, Werte korrigieren, Stand sichern/laden, zurücksetzen
//   · Seiten nur für Admins: IDB-Editor, Listen-Zuordnung (Knotendiagramm) und Regelwerk
//   · Datenbank zeigt alle Spalten; Wrestler lassen sich in der Kartei bearbeiten
//   · Abgerechnete Shows lassen sich korrigieren
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc, eur, fmt } = K;
  const KEY = 'khw-admin';
  const $ = s => document.querySelector(s);
  const icon = n => `<span class="ms">${n}</span>`;
  let on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) { /* ohne Speicher: aus */ }
  const apply = () => document.documentElement.classList.toggle('is-admin', on);
  apply();

  K.admin = {
    get on() { return on; },
    set(v) {
      on = !!v;
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* nur bis zum Neuladen */ }
      apply();
      if (K.state && K.state.rf) K.state.rf.show = on ? '' : 'aktiv';   // Datenbank: im Admin-Modus alle Wrestler
      if (K.route) K.route(); else K.render();
      K.toast(on ? 'Admin-Modus an' : 'Admin-Modus aus');
    },

    /** Leiste unter der Kopfzeile (nur im Admin-Modus). */
    renderBar(m) {
      const bar = $('#admin-bar');
      if (!bar) return;
      bar.hidden = !on;
      if (!on || !m) { bar.innerHTML = ''; return; }
      const due = m.dueShow, cur = m.show(m.currentShow);
      const d = cur || due;
      bar.innerHTML = `<span class="admin-tag">${icon('shield_person')}Admin-Modus</span>
        <span class="ab-date"><small>Spieldatum · Jahr ${d ? d.date.year : ''}</small><b>${d ? `${K.MONTHS[d.date.month]}, Woche ${d.date.week} · ${K.WEEKDAYS[d.date.dow]}` : '–'}</b><span>${d ? esc(K.ui.showTitle(d)) : ''}</span></span>
        <span class="ab-actions">
          <button class="btn sm" data-adm="jump">${icon('event_repeat')}Datum springen</button>
          <button class="btn sm" data-adm="fix">${icon('tune')}Werte korrigieren</button>
          <a class="btn sm" href="#idb">${icon('database')}IDB</a>
          <a class="btn sm" href="#idbmap">${icon('account_tree')}Listen-Zuordnung</a>
          <a class="btn sm" href="#rules">${icon('rule')}Regelwerk</a>
          <button class="btn sm" data-adm="ai" title="KI-Einstellungen dieses Geräts">${icon('smart_toy')}KI${K.ai && K.ai.settings.live ? ' · live' : ' · Simulation'}</button>
          <button class="btn sm" data-adm="export" title="Klickdummy und IDB als Datei sichern">${icon('download')}Stand sichern</button>
          <label class="btn sm" title="Gesicherten Stand laden">${icon('upload')}Stand laden<input type="file" id="adm-file" accept=".json,application/json" hidden></label>
          ${K.cloud && K.cloud.on ? '' : `<button class="btn sm" data-adm="reset">${icon('restart_alt')}Zurücksetzen</button>`}
        </span>
        <button class="btn icon" data-adm="off" title="Admin-Modus beenden">${icon('close')}</button>`;
    },
  };

  /* ───────────── Profilmenü mit Schalter ───────────── */
  let menu = null;
  const closeMenu = () => { if (menu) { menu.remove(); menu = null; } };
  function openMenu(anchor) {
    closeMenu();
    menu = document.createElement('div');
    menu.className = 'avatar-menu';
    // Mit Supabase: wer an diesem Gerät angemeldet ist; sonst wie bisher Knight & Hustler
    const who = K.cloud && K.cloud.on && K.cloud.email ? { ini: K.cloud.me.slice(0, 2).toUpperCase(), name: K.cloud.me, sub: K.cloud.email } : { ini: 'KH', name: 'Knight & Hustler', sub: 'KHW Office' };
    menu.innerHTML = `<div class="am-head"><span class="avatar">${esc(who.ini)}</span><div><b>${esc(who.name)}</b><small>${esc(who.sub)}</small></div></div>
      <label class="switch-row"><span><b>Admin-Modus</b><small>Tests und Korrekturen: Datum springen, Werte ändern, IDB</small></span>
        <input type="checkbox" role="switch" id="admin-switch" ${on ? 'checked' : ''}><span class="switch"></span></label>
      ${K.cloud && K.cloud.on ? `<button class="btn text" id="cloud-logout">${icon('logout')}Auf diesem Gerät abmelden</button>` : ''}`;
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.top = (r.bottom + 8) + 'px';
    menu.style.right = (window.innerWidth - r.right) + 'px';
  }
  document.addEventListener('click', e => {
    if (e.target.closest('#cloud-logout')) { closeMenu(); K.cloud.signOut(); return; }
    const av = e.target.closest('#avatar');
    if (av) { if (menu) closeMenu(); else openMenu(av); return; }
    if (menu && !menu.contains(e.target)) closeMenu();
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'admin-switch') { closeMenu(); K.admin.set(e.target.checked); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* ───────────── Aktionen der Admin-Leiste ───────────── */
  const shortDate = s => `J${s.date.year} ${K.MONTHS[s.date.month].slice(0, 3)} W${s.date.week} · ${K.WEEKDAYS[s.date.dow].slice(0, 2)}`;

  function jump() {
    const m = K.model;
    // Reguläre Shows bestimmen das Spieldatum: Raster der Tabelle (Jahr 4) und TryOut/Lucky7 in den Folgejahren
    const regular = m.shows.filter(s => s.no !== null || (s.series && (K.seriesConf()[s.series] || {}).builtin));
    K.dialog.form({
      title: 'Spieldatum springen', icon: 'event_repeat', ok: 'Springen',
      text: 'Die gewählte Show wird zur aktuellen. Alles davor gilt als gelaufen.',
      fields: [
        { id: 'show', label: 'Neue aktuelle Show', type: 'select', value: m.currentShow, options: regular.map(s => [s.key, `${shortDate(s)} · ${K.ui.showTitle(s)}${s.result ? ' (abgerechnet)' : ''}`]) },
        { id: 'reopen', label: 'Abrechnungen ab diesem Datum wieder öffnen (Buchungen bleiben bestehen)', type: 'checkbox', value: true },
      ],
    }).then(v => {
      if (!v) return;
      const n = /^\d+$/.test(v.show) ? Number(v.show) : v.show, target = m.show(n);
      K.store.update(st => {
        st.game.currentShow = n;
        // Alles davor gilt als gelaufen: Shows außerhalb des Rasters (Folgejahre, eigene Reihen, Events) ausdrücklich markieren
        m.shows.forEach(s => { if (s.no === null && s.sortKey < target.sortKey && !s.ended) st.shows[s.key] = Object.assign({}, st.shows[s.key], { ended: true }); });
        if (v.reopen) Object.keys(st.shows).forEach(k => {
          const s = m.show(isNaN(Number(k)) ? k : Number(k));
          if (s && s.sortKey >= target.sortKey && st.shows[k]) { st.shows[k].ended = false; delete st.shows[k].result; }
        });
      });
      K.rebuild();
      K.toast(`Spieldatum: ${K.MONTHS[target.date.month]} Jahr ${target.date.year}, Woche ${target.date.week} · ${K.ui.showTitle(target)}`);
    });
  }

  function fix() {
    const m = K.model, f = m.finance;
    const round = x => Math.round((x || 0) * 100) / 100;
    K.dialog.form({
      title: 'Werte korrigieren', icon: 'tune', ok: 'Übernehmen',
      text: 'Neue Werte eintragen. Die Differenz wird als Korrektur gespeichert, beim Kontostand als Buchung „Korrektur (Admin)“.',
      fields: [
        { id: 'balance', label: 'Kontostand (€)', type: 'number', step: '0.01', value: round(f.balance) },
        { id: 'stars', label: 'Sternekonto', type: 'number', step: '0.5', value: round(m.staff.stars) },
        { id: 'followers', label: 'Follower', type: 'number', step: '1', value: Math.round(f.followers || 0) },
      ],
    }).then(v => {
      if (!v) return;
      const num = x => Number(String(x).replace(',', '.'));
      const dBal = round(num(v.balance) - f.balance), dStars = num(v.stars) - (m.staff.stars || 0), dFol = Math.round(num(v.followers) - (f.followers || 0));
      K.store.update(st => {
        if (dBal) st.bookings.push({ text: 'Korrektur (Admin)', amount: dBal, manual: true });
        if (dStars) st.game.stars = (st.game.stars || 0) + dStars;
        if (dFol) st.game.followers = (st.game.followers || 0) + dFol;
      });
      K.rebuild();
      K.toast('Werte übernommen');
    });
  }

  /** KI-Einstellungen dieses Geräts (Token bleibt nur im Browser, wird nie angezeigt und nicht mitgesichert). */
  function aiSettings() {
    const s = K.ai.settings, server = K.cloud && K.cloud.on;
    K.dialog.form({
      title: 'KI-Einstellungen (dieses Gerät)', icon: 'smart_toy', ok: 'Speichern',
      text: server
        ? 'Solange „Echte Anfragen“ aus ist, simuliert die App alle Antworten und sendet nichts. Der Token liegt sicher in Supabase (Edge Function „ki“, Secret HF_API_TOKEN) – hier ist keiner nötig.'
        : 'Solange „Echte Anfragen“ aus ist, simuliert die App alle Antworten und sendet nichts. Der Token liegt nur in diesem Browser.',
      fields: [
        { id: 'live', label: 'Echte Anfragen an Hugging Face senden', type: 'checkbox', value: s.live },
        { id: 'model', label: 'Modell', value: s.model, placeholder: K.ai.DEFAULT_MODEL },
        ...(server ? [] : [{ id: 'token', label: s.token ? 'Token (gespeichert – leer lassen, um ihn zu behalten)' : 'Token (HF_API_TOKEN)', type: 'password', placeholder: s.token ? '••••••••' : 'hf_…' }]),
      ],
    }).then(v => {
      if (!v) return;
      const token = server ? '' : ((v.token || '').trim() || s.token);   // mit Supabase keinen Token im Browser behalten
      K.ai.save({ live: !!v.live, model: v.model.trim() || K.ai.DEFAULT_MODEL, token });
      K.render();
      K.toast(v.live ? (server || token ? 'KI: echte Anfragen an' : 'KI: Token fehlt – es wird weiter simuliert') : 'KI: Simulation');
    });
  }


  function exportState() {
    let idb = null;
    try { idb = JSON.parse(localStorage.getItem(K.cloud ? K.cloud.key('khw.idb') : 'khw.idb') || 'null'); } catch (e) { /* ohne IDB */ }
    const data = { app: 'KHW Office', saved: new Date().toISOString(), store: K.store.state, idb, rules: K.conf.all() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `khw-stand-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  function importState(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); if (!data.store) throw new Error('Die Datei enthält keinen gesicherten Stand.'); }
      catch (err) { K.dialog.alert({ title: 'Datei konnte nicht gelesen werden', icon: 'error', text: err.message }); return; }
      K.dialog.confirm({ title: 'Stand laden?', icon: 'upload', danger: true, ok: 'Laden', text: `Gesichert am ${new Date(data.saved).toLocaleString('de-DE')}.\nDer aktuelle Stand (Shows, Verträge, Buchungen${data.idb ? ', IDB' : ''}${data.rules ? ', Regelwerk' : ''}) wird ersetzt.` })
        .then(yes => {
          if (!yes) return;
          K.store.replace(data.store);
          if (data.rules) K.conf.replace(data.rules);
          if (data.idb) { try { localStorage.setItem(K.cloud ? K.cloud.key('khw.idb') : 'khw.idb', JSON.stringify(data.idb)); } catch (e) { /* zu groß */ } if (K.idbApi) K.idbApi.reload(); if (K.cloud) K.cloud.changed('idb'); }
          K.rebuild();
          K.toast('Stand geladen');
        });
    };
    reader.readAsText(file);
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-adm]');
    if (!b) return;
    const a = b.dataset.adm;
    if (a === 'off') K.admin.set(false);
    else if (a === 'jump') jump();
    else if (a === 'fix') fix();
    else if (a === 'export') exportState();
    else if (a === 'reset') { if (K.store.dirty) K.resetState(); else K.toast('Es gibt nichts zurückzusetzen.'); }
    else if (a === 'save-w') saveWrestler(b.dataset.name);
    else if (a === 'ai') aiSettings();
    else if (a === 'del-w') {
      // Nur selbst aufgenommene Wrestler; die aus der Tabelle bleiben
      const name = b.dataset.name;
      K.dialog.confirm({ title: `${name} entfernen?`, icon: 'person_remove', danger: true, ok: 'Entfernen', text: 'Der Wrestler verschwindet aus der Datenbank. Matches, in denen er steht, bleiben unverändert.' })
        .then(yes => {
          if (!yes) return;
          K.store.update(st => { st.added = (st.added || []).filter(x => x.name !== name); delete st.wrestlers[name]; });
          document.getElementById('drawer').classList.remove('open'); document.getElementById('scrim').classList.remove('open');
          K.rebuild(); K.toast(`${name} entfernt`);
        });
    }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'adm-file' && e.target.files[0]) { importState(e.target.files[0]); e.target.value = ''; }
  });

  /* ───────────── Wrestler in der Kartei bearbeiten ───────────── */
  const WFIELDS = [
    ['show', 'Show', () => ['', ...K.khwShows()]], ['status', 'Status', () => ['', ...K.STATUS]], ['alignment', 'Ausrichtung', ['', 'Face', 'Heel']],
    ['gender', 'Geschlecht', ['m', 'w']], ['promotion', 'Promotion'], ['injury', 'Verletzung (Grund)'], ['unavailable', 'Nicht verfügbar (Grund)'],
    ['contractEnd', 'Vertragsende'], ['gimmick', 'Gimmick'], ['notes', 'Besonderheiten'],
    ['elo', 'ELO', 'number'], ['image', 'Bild (Adresse)'],
  ];
  const baseSheet = K.wrestlerSheet;
  K.wrestlerSheet = (m, name) => {
    const html = baseSheet(m, name);
    if (!on || !html) return html;
    const w = m.byName.get(name);
    const ctl = ([k, label, t]) => {
      const opts = typeof t === 'function' ? t() : t;
      const v = w[k] === null || w[k] === undefined ? '' : w[k];
      return `<label class="ro"><span>${esc(label)}</span>${Array.isArray(opts)
        ? `<select class="field" data-wf="${k}">${opts.map(o => `<option value="${esc(o)}" ${String(o) === String(v) ? 'selected' : ''}>${esc(o || '–')}</option>`).join('')}</select>`
        : `<input class="field" data-wf="${k}" ${t === 'number' ? 'type="number" step="0.1"' : ''} value="${esc(v)}">`}</label>`;
    };
    return html + `<section class="admin-edit"><h4 class="section">${icon('shield_person')} Admin: Daten bearbeiten</h4>
      <div class="aw-grid">${WFIELDS.map(ctl).join('')}</div>
      <div class="actions"><button class="btn primary" data-adm="save-w" data-name="${esc(name)}">${icon('save')}Speichern</button>
        ${w.added ? `<button class="btn text" data-adm="del-w" data-name="${esc(name)}">${icon('person_remove')}Aus der Datenbank entfernen</button>` : ''}</div>
      <p class="hint">Änderungen gelten im Klickdummy für beide Spieler. Die Tabelle bleibt unverändert.</p>
      <h4 class="section">${icon('psychology')} Gedächtnis der KI</h4>${((K.store.state.memory || {})[name] || []).length
        ? `<ul class="plain">${K.store.state.memory[name].map((x, i) => `<li>${esc(x.text)} <button class="btn icon" data-ib="forget" data-name="${esc(name)}" data-i="${i}" title="Vergessen">${icon('close')}</button></li>`).join('')}</ul>`
        : '<p class="hint">Noch keine Notizen aus Mails und Terminen.</p>'}</section>`;
  };
  function saveWrestler(name) {
    const patch = {};
    document.querySelectorAll('#drawer [data-wf]').forEach(el => {
      const f = WFIELDS.find(x => x[0] === el.dataset.wf);
      patch[el.dataset.wf] = f && f[2] === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value.trim();
    });
    K.store.update(st => { st.wrestlers[name] = Object.assign({}, st.wrestlers[name], patch); });
    K.rebuild();
    const body = document.getElementById('drawer-body');
    if (body) body.innerHTML = K.wrestlerSheet(K.model, name);
    K.toast(`${name} gespeichert`);
  }
})(window.KHW);
