// KHW Manager – Start, Navigation und Datenabruf.
(function (K) {
  'use strict';
  const $ = s => document.querySelector(s);
  const state = { view: 'shows', show: null };
  let model = null, source = '', loading = false;

  window.addEventListener('error', e => banner('Fehler: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')'));
  function banner(text) { const b = $('#banner'); b.textContent = text; b.hidden = !text; }

  const isAdmin = () => !!(K.admin && K.admin.on);
  // Ausgeblendete Seiten (hidden: Büro, Talentboard) bleiben im Code, sind aber nicht erreichbar.
  const allowed = id => K.views[id] && !K.views[id].hidden && (!K.views[id].adminOnly || isAdmin());
  const HOME = 'shows';   // Startseite (Card)

  function route() {
    const id = location.hash.replace('#', ''), before = state.view;
    state.view = allowed(id) ? id : HOME;
    if (id && id !== state.view) history.replaceState(null, '', '#' + state.view);   // gesperrte Adresse sichtbar umleiten
    if (state.view === 'shows') state.scrollShow = true;   // beim Öffnen zur gewählten bzw. aktuellen Show springen
    render();
    // Jede andere Seite beginnt beim Wechsel oben (sonst bliebe die Scroll-Position der vorigen Seite stehen)
    if (state.view !== 'shows' && state.view !== before) { const main = $('.main'); if (main) main.scrollTop = 0; }
  }

  // Zahl wie am App-Icon: nur wenn es dort etwas Neues gibt (z. B. Postfach)
  const badge = id => { const n = K.navBadge ? K.navBadge(id) : 0; return n ? `<span class="nav-badge">${n > 99 ? '99+' : n}</span>` : ''; };
  function renderNav() {
    // Seiten mit adminOnly erscheinen nur im Admin-Modus; leere Gruppen fallen weg. Gruppen ohne Überschrift, nur dünne Trennlinien.
    $('#nav-links').innerHTML = K.NAV.map(([group, ids]) => [group, ids.filter(allowed)]).filter(g => g[1].length).map(([group, ids]) => `<div class="nav-group ${group === 'Admin' ? 'admin-group' : ''}">${ids.map(id =>
      `<a href="#${id}" class="${id === state.view ? 'active' : ''}"><span class="ms">${K.views[id].icon}</span>${K.views[id].title}${badge(id)}</a>`).join('')}</div>`).join('');
  }

  /* ───────────── Layout-Varianten pro Seite ───────────── */
  // Phase 2: Eine Seite kann mehrere Layouts zum Vergleichen anbieten (view.layouts = [[id, label], …]).
  // Hat der Nutzer sich entschieden, bleibt nur eines übrig und der Schalter verschwindet von selbst.
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ohne Speicher gilt die Wahl nur bis zum Neuladen */ } },
  };
  state.layouts = {};
  const layoutOf = id => {
    const v = K.views[id];
    if (!v.layouts) return null;
    const q = /[?&]layout=(\w+)/.exec(location.search);
    const saved = state.layouts[id] || (q && q[1]) || store.get('khw-layout-' + id);
    return v.layouts.some(l => l[0] === saved) ? saved : v.layouts[0][0];
  };

  const SUBS = {
    office: 'Kennzahlen, aktuelle Card und Champions auf einen Blick',
    shows: 'Alle Shows mit ihrer Card, rechts der Kalender',
    weeklies: 'Der Kader je Show, Face und Heel gegenübergestellt',
    roster: 'Alle Wrestler aus der Datenbank',
    injuries: 'Verletzte Wrestler und ihre Behandlung',
    teams: 'Teams und Stables anlegen und bearbeiten',
    ranking: 'ELO-Ranglisten je Show',
    titles: 'Alle Titel und ihre aktuellen Träger',
    finance: 'Kontostand, letzte Abrechnung und Buchungen',
    staff: 'Mitarbeiter einstellen, produzieren lassen und Vorteile lagern',
    storage: 'Inventar, Tresor und Ausbaustufen',
    contract: 'Einen Arbeitsvertrag zwischen KHW und einem Wrestler aufsetzen',
    talents: 'Neue Talente suchen und vormerken',
    stories: 'Laufende und vergangene Storylines beider Shows',
    interaction: 'Mails und Schicksals-Szenen mit der Spielleitung',
    bar: 'Gespräche an der Bar des HK Casino',
    notes: 'Gemeinsame Notizen für beide Spieler',
    rivals: 'Alle Rivalen-Aktionen nach Kategorie, mit Suche und Filtern',
    idb: 'Listen und Einträge für Mails, Szenen und Verträge pflegen',
    idbmap: 'Welche IDB-Liste speist welche Stelle der App',
    rules: 'Zahlen und Regeln, die ohne neuen Code einstellbar sind',
  };

  function renderHead() {
    const v = K.views[state.view];
    const group = state.view && K.views[state.view].adminOnly ? 'Admin' : '';   // Gruppen haben keine Überschriften mehr
    const extra = v.crumb && model ? v.crumb(model) : '';
    $('#crumbs').innerHTML = [group, `<a href="#${state.view}">${K.esc(v.title)}</a>`, extra && K.esc(extra)].filter(Boolean).map(x => `<span>${x}</span>`).join('<i>/</i>');
    const lay = layoutOf(state.view);
    const seg = lay && v.layouts.length > 1 ? `<div class="seg" title="Layout-Variante dieser Seite">${v.layouts.map(([id, label]) => `<button class="${id === lay ? 'on' : ''}" data-layout="${id}">${label}</button>`).join('')}</div>` : '';
    $('#page-head').innerHTML = `<div><h1>${K.esc(v.title)}</h1>${SUBS[state.view] ? `<p>${SUBS[state.view]}</p>` : ''}</div>${seg}`;
    document.title = v.title + ' · KHW Office';
  }

  /* ───────────── Suche (Wrestler und Shows) ───────────── */
  function searchHits(q) {
    q = q.trim().toLowerCase();
    if (!q || !model) return [];
    const hits = [];
    for (const w of model.byName.values()) {
      if (w.name.toLowerCase().includes(q)) hits.push({ html: `<a data-wrestler="${K.esc(w.name)}"><span class="ms">person</span><b>${K.esc(w.name)}</b><small>${K.esc(w.show || '')}</small></a>`, rank: w.name.toLowerCase().startsWith(q) ? 0 : 1 });
    }
    for (const t of model.teams || []) {
      if (t.name.toLowerCase().includes(q)) hits.push({ html: `<a data-team="${K.esc(t.name)}"><span class="ms">group</span><b>${K.esc(t.name)}</b><small>${K.esc(t.members.join(' & '))}</small></a>`, rank: t.name.toLowerCase().startsWith(q) ? 0 : 1 });
    }
    const when = s => `${K.MONTHS[s.date.month]}${s.date.year !== model.curYear ? ' Jahr ' + s.date.year : ''}, Woche ${s.date.week}`;
    const showLink = (s, icon, title, sub, rank) => hits.push({ html: rank === 3
      ? `<a class="txt-hit" href="#shows" data-set="show" data-value="${K.esc(String(s.key))}" data-scroll><span class="ms">${icon}</span><span class="th"><b>${title}</b><small>${sub}</small></span></a>`
      : `<a href="#shows" data-set="show" data-value="${K.esc(String(s.key))}" data-scroll><span class="ms">${icon}</span><b>${title}</b><small>${sub}</small></a>`, rank });
    // Ausschnitt rund um den Treffer, Treffer hervorgehoben
    const snippet = (text, i) => {
      const a = Math.max(0, i - 30), b = Math.min(text.length, i + q.length + 50);
      return (a ? '…' : '') + K.esc(text.slice(a, i)) + '<mark>' + K.esc(text.slice(i, i + q.length)) + '</mark>' + K.esc(text.slice(i + q.length, b)) + (b < text.length ? '…' : '');
    };
    let texts = 0;
    for (const s of model.shows) {
      const label = K.ui.showTitle(s);
      if ((s.hasContent || s.state === 'current') && (String(s.no) === q || label.toLowerCase().includes(q) || ('show ' + s.no).startsWith(q))) showLink(s, 'stadium', K.esc(label), when(s), 2);
      // Info der Show und Notizen der Matches (ab 3 Zeichen, höchstens 5 Treffer)
      if (q.length < 3 || texts >= 5) continue;
      const found = [['Info', s.info || ''], ...s.matches.map(mt => ['Notiz', [mt.notes, ...(mt.cellNotes || [])].filter(Boolean).join(' ')])]
        .map(([kind, t]) => [kind, t.replace(/\s+/g, ' ')]).find(([, t]) => t.toLowerCase().includes(q));
      if (found) { texts++; showLink(s, found[0] === 'Info' ? 'sticky_note_2' : 'notes', `${K.esc(label)} <small class="muted">· ${found[0]} · ${when(s)}</small>`, snippet(found[1], found[1].toLowerCase().indexOf(q)), 3); }
    }
    return hits.sort((a, b) => a.rank - b.rank).slice(0, 10);
  }
  function renderSearch() {
    const box = $('#search-hits'), q = $('#search').value;
    const hits = searchHits(q);
    box.hidden = !q.trim();
    box.innerHTML = hits.map(h => h.html).join('') || '<p class="empty">Nichts gefunden.</p>';
  }
  function closeSearch() { $('#search-hits').hidden = true; }

  K.afterRender = K.afterRender || [];   // Nacharbeiten nach jedem Aufbau (z. B. Linien im Knotendiagramm)
  function render() {
    if (!allowed(state.view)) state.view = HOME;
    renderNav();
    renderHead();
    if (K.admin) K.admin.renderBar(model);
    if (!model) { $('#content').innerHTML = `<p class="empty">${K.cloud && K.cloud.on ? 'Verbinde mit Supabase …' : 'Daten werden geladen …'}</p>`; return; }
    state.layout = layoutOf(state.view);
    const when = new Date(model.generatedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
    // Mit Supabase zeigt der Chip die Verbindung, sonst woher der Stand der Tabelle kommt
    $('#status').innerHTML = K.cloud && K.cloud.on ? K.cloud.chip()
      : `<span class="chip ${source === 'live' ? 'accent' : 'outline'}">${source === 'live' ? 'Live' : 'Lokaler Stand'} · ${when}</span>`;
    const due = model.dueShow;
    $('#nav-foot').innerHTML = `<b>${due ? K.esc(K.ui.showTitle(due)) : 'Saison beendet'}</b><span>${due ? `${K.MONTHS[due.date.month]}, Woche ${due.date.week} · ${K.WEEKDAYS[due.date.dow]}` : ''}</span><span>${K.eur(model.finance.balance, true)}</span>
      ${K.store.dirty && !cloudOn() ? `<button class="btn text reset" id="dummy-reset" title="Alle Änderungen im Klickdummy verwerfen; danach gilt wieder nur der Stand der Tabelle">${'<span class="ms sm">restart_alt</span>'}Klickdummy zurücksetzen</button>` : ''}`;
    try {
      $('#content').innerHTML = K.renderView(state.view, model, state);
    } catch (e) {
      $('#content').innerHTML = `<p class="empty">Diese Ansicht konnte nicht aufgebaut werden: ${K.esc(e.message)}</p>`;
      console.error(e);
    }
    K.afterRender.forEach(fn => { try { fn(state.view); } catch (e) { console.error(e); } });
    if (state.view === 'shows' && state.scrollShow) {
      const el = document.getElementById('show-' + state.show);
      if (el) el.scrollIntoView({ block: 'start' });
      state.scrollShow = false;
    }
    tick();
  }

  let lastData = null;
  function setModel(data, from) {
    lastData = data;
    model = K.buildModel(data);
    source = from;
    if (!state.show) state.show = model.currentShow;
    render();
  }

  /** Stand aus der Google-Tabelle holen (nur noch ohne Supabase). */
  async function fetchSheet() {
    const cfg = window.KHW_CONFIG || {};
    if (!cfg.apiUrl) throw new Error('Keine Adresse der Tabelle in config.js');
    const res = await fetch(cfg.apiUrl + '?token=' + encodeURIComponent(cfg.token), { redirect: 'follow' });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Unbekannter Fehler');
    return data;
  }
  async function refresh() {
    if (loading) return;
    // Mit Supabase lädt der Knopf den gemeinsamen Stand neu (die Tabelle wird nicht mehr gebraucht)
    if (K.cloud && K.cloud.on) { location.reload(); return; }
    const cfg = window.KHW_CONFIG || {};
    if (!cfg.apiUrl) return;
    loading = true; $('#refresh').classList.add('spin');
    try {
      const data = await fetchSheet();
      banner('');
      setModel(data, 'live');
    } catch (e) {
      banner(model ? 'Live-Abruf fehlgeschlagen, angezeigt wird der lokale Stand. (' + e.message + ')'
                   : 'Die Tabelle ist nicht erreichbar und es gibt keinen lokalen Stand. (' + e.message + ')');
    } finally {
      loading = false; $('#refresh').classList.remove('spin');
    }
  }

  /* ───────────── Zurücksetzen ─────────────
     Nur noch ohne Supabase (reiner Klickdummy im Browser). Mit Supabase ist der Stand live: kein Zurücksetzen;
     zum Ausprobieren gibt es den Testmodus (Klick auf den Chip „Supabase · verbunden“). */
  const cloudOn = () => !!(K.cloud && K.cloud.on);
  K.resetState = () => {
    if (cloudOn()) return;
    K.dialog.confirm({ title: 'Klickdummy zurücksetzen?', icon: 'restart_alt', danger: true, ok: 'Zurücksetzen', text: 'Angebote, abgeschlossene Verträge, Buchungen und Kaderänderungen gehen verloren. Danach gilt wieder der Stand der Tabelle.' })
      .then(yes => { if (yes) { K.store.reset(); K.rebuild(); K.toast('Zurückgesetzt'); } });
  };

  /* ───────────── Start mit Supabase ─────────────
     Anmelden, gemeinsamen Stand laden, Echtzeit starten. Der Startstand liegt in Supabase (khw_basis); die
     Google-Tabelle wird dabei nicht mehr abgefragt. Fehlt er (nur bei einer ganz neuen Einrichtung), kommt er aus
     der lokalen Kopie data/snapshot.js. */
  async function startCloud() {
    try {
      const base = await K.cloud.start();
      banner('');
      if (base) { setModel(base, 'cloud'); return; }
      const data = window.KHW_SNAPSHOT || null;
      if (!data) { banner('In Supabase fehlt der Startstand.'); return; }
      setModel(data, 'cloud');
      await K.cloud.saveBase(data);
      K.toast('Startstand der Tabelle in Supabase übernommen');
    } catch (e) {
      console.error(e);
      // Im Testmodus geht es auch ohne Verbindung weiter (Startstand aus data/snapshot.js)
      if (K.cloud.testMode && window.KHW_SNAPSHOT) { setModel(window.KHW_SNAPSHOT, 'snapshot'); banner('Testmodus ohne Verbindung zu Supabase – Startstand aus der lokalen Kopie der Tabelle.'); return; }
      banner('Supabase nicht erreichbar: ' + (e.message || e) + ' – Seite neu laden, um es erneut zu versuchen.');
    }
  }

  /* Countdowns laufen lokal weiter, statt den eingefrorenen Tabellenwert zu zeigen. */
  function tick() {
    document.querySelectorAll('.countdown').forEach(el => {
      const left = Number(el.dataset.until) - Date.now();
      el.textContent = left <= 0 ? el.dataset.done : K.duration(left);
    });
  }
  setInterval(tick, 1000);

  /* Kartei */
  let drawerTarget = null;   // was die Seitenleiste gerade zeigt (für den Umschalter Jahr/Gesamt)
  function openDrawer(name, team) {
    const html = team ? K.teamSheet(model, name) : K.wrestlerSheet(model, name);
    if (!html) return;
    drawerTarget = { name, team };
    $('#drawer-body').innerHTML = html;
    $('#drawer').classList.add('open'); $('#scrim').classList.add('open');
  }
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#scrim').classList.remove('open'); }

  const cast = v => (v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);

  document.addEventListener('click', e => {
    if (e.target.closest('#scrim, #drawer-close')) { closeDrawer(); return; }
    const scope = e.target.closest('[data-rec-scope]');
    if (scope) { state.recAll = scope.dataset.recScope === 'all'; if (drawerTarget) openDrawer(drawerTarget.name, drawerTarget.team); return; }
    if (e.target.closest('#refresh')) { refresh(); return; }
    if (e.target.closest('#dummy-reset')) { K.resetState(); return; }
    if (!e.target.closest('.search')) closeSearch();
    else if (e.target.closest('#search-hits a')) { closeSearch(); $('#search').value = ''; }
    const lay = e.target.closest('[data-layout]');
    if (lay) { state.layouts[state.view] = lay.dataset.layout; store.set('khw-layout-' + state.view, lay.dataset.layout); render(); return; }
    // Eingabefelder in einer anklickbaren Zeile (z. B. Besonderheiten in der Datenbank) öffnen nicht die Kartei.
    if (e.target.closest('textarea, input, select') && e.target.closest('[data-wrestler]')) return;
    // Das innerste anklickbare Element entscheidet (z. B. ein Name innerhalb einer anklickbaren Show-Karte).
    const hit = e.target.closest('[data-wrestler], [data-team], [data-set][data-value], [data-sort]');
    if (!hit || !model) return;
    if (hit.dataset.wrestler) { e.preventDefault(); openDrawer(hit.dataset.wrestler); return; }
    if (hit.dataset.team) { e.preventDefault(); openDrawer(hit.dataset.team, true); return; }
    if (hit.dataset.sort) {
      const k = hit.dataset.sort;
      state.rdir = (state.rsort || 'name') === k ? -(state.rdir || 1) : 1; state.rsort = k; render(); return;   // Standard ist „Name“
    }
    if (window.getSelection && String(window.getSelection())) return;   // Text markieren soll nichts auslösen
    const key = hit.dataset.set, val = cast(hit.dataset.value);
    if (key === 'show' && val === state.show && !('scroll' in hit.dataset) && hit.tagName !== 'A') return;
    state[key] = val;
    if (key === 'rcols') { K.rosterCols.reset(); state.rcols = null; }
    if (key === 'show') {
      const s = model.show(val);
      if (s) state.calMonth = K.absMonth(s.date);   // fortlaufender Monat (über Jahresgrenzen)
      if ('scroll' in hit.dataset || hit.tagName === 'A') state.scrollShow = true;
    }
    closeDrawer();
    const href = hit.getAttribute('href');
    if (href && href !== '#' + state.view) return;   // Navigation rendert neu
    e.preventDefault(); render();
  });

  /* Datenbank: Spalten per Ziehen am Spaltenkopf umsortieren (nur Ansicht, wird im Browser gemerkt). */
  let dragCol = null;
  const clearDrop = () => document.querySelectorAll('.drop-l, .drop-r').forEach(el => el.classList.remove('drop-l', 'drop-r'));
  const dropSide = (th, e) => { const r = th.getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? 'l' : 'r'; };
  document.addEventListener('dragstart', e => {
    const th = e.target.closest && e.target.closest('th[data-col]');
    if (!th) return;
    dragCol = th.dataset.col;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragCol);
  });
  document.addEventListener('dragover', e => {
    const th = dragCol && e.target.closest && e.target.closest('th[data-col]');
    if (!th) return;
    e.preventDefault();
    clearDrop();
    if (th.dataset.col !== dragCol) th.classList.add('drop-' + dropSide(th, e));
  });
  document.addEventListener('drop', e => {
    const th = dragCol && e.target.closest && e.target.closest('th[data-col]');
    if (!th) return;
    e.preventDefault();
    const target = th.dataset.col;
    if (target !== dragCol) {
      const order = (state.rcols || K.rosterCols.load()).filter(k => k !== dragCol);
      order.splice(order.indexOf(target) + (dropSide(th, e) === 'r' ? 1 : 0), 0, dragCol);
      state.rcols = order;
      K.rosterCols.save(order);
    }
    dragCol = null;
    render();
  });
  document.addEventListener('dragend', () => { dragCol = null; clearDrop(); });

  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.set && !t.dataset.value) { state[t.dataset.set] = t.type === 'checkbox' ? t.checked : cast(t.value); render(); }
    else if (t.dataset.rf && t.tagName === 'SELECT') { state.rf[t.dataset.rf] = t.value; render(); }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'search') { renderSearch(); return; }
    if (t.dataset.rf !== 'q') return;
    state.rf.q = t.value; render();
    const q = $('#rf-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDrawer(); closeSearch(); }
    if (e.key === 'Enter' && e.target.id === 'search') { const a = $('#search-hits a'); if (a) a.click(); }
  });
  window.addEventListener('hashchange', route);

  K.state = state;
  K.render = render;
  K.route = route;
  Object.defineProperty(K, 'model', { get: () => model });
  /** Modell neu aufbauen, z. B. nachdem der Klickdummy Kader oder Konto geändert hat. */
  K.rebuild = () => { if (lastData) { model = K.buildModel(lastData); render(); } };
  /**
   * Ein anderer Tab hat gemeinsame Daten geändert: Modell neu aufbauen und anzeigen. Was dieser Tab gerade
   * anschaut (Seite, Auswahl), bleibt; ein Eingabefeld mit Fokus behält Fokus und Schreibmarke.
   */
  K.onRemoteChange = () => {
    const a = document.activeElement, id = a && a.id && /^(INPUT|TEXTAREA)$/.test(a.tagName) ? a.id : null;
    const sel = id ? [a.selectionStart, a.selectionEnd] : null;
    // Offene Dialoge oder Listen nicht zerreißen, nicht in einen Text hinein, an dem gerade geschrieben wird
    // (Notizen, IDB-Eintrag): dann kurz danach erneut versuchen.
    if (document.querySelector('.modal-scrim, .dd-menu') || (a && (a.isContentEditable || a.id === 'idb-text'))) { clearTimeout(K._remoteRetry); K._remoteRetry = setTimeout(K.onRemoteChange, 600); return; }
    K.rebuild();
    if (id) { const el = document.getElementById(id); if (el) { el.focus(); try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* Feldart ohne Schreibmarke */ } } }
  };
  /** Kurze Meldung unten rechts. */
  let toastTimer = null;
  // Optional mit Knopf, z. B. K.toast('Gelöscht', { action: 'Rückgängig', onAction: fn }); dann bleibt sie länger stehen.
  K.toast = (text, opt = {}) => {
    let el = $('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
    el.innerHTML = `<span>${K.esc(text)}</span>${opt.action ? `<button class="btn text" id="toast-act">${K.esc(opt.action)}</button>` : ''}`;
    el.classList.toggle('has-action', !!opt.action);
    el.classList.add('show');
    const b = $('#toast-act');
    if (b) b.onclick = () => { el.classList.remove('show'); opt.onAction(); };
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), opt.action ? 7000 : 4000);
  };

  if (K.cloud && K.cloud.on) {
    route();
    startCloud();
  } else {
    if (window.KHW_SNAPSHOT) setModel(window.KHW_SNAPSHOT, 'snapshot');
    route();
    if (!/[?&]offline\b/.test(location.search)) refresh();
  }
})(window.KHW);
