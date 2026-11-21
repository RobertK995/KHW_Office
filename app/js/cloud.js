// KHW Manager – Abgleich über Supabase: ein gemeinsamer Stand für alle Geräte.
//
// Die Bereiche (Spielstand, Regelwerk, IDB) arbeiten weiter mit ihren Objekten im Arbeitsspeicher und speichern
// eine Kopie im Browser (localStorage = Zwischenspeicher). Nach jeder Änderung melden sie K.cloud.changed(bereich).
// Diese Datei zerlegt das Objekt in Zeilen (ein Eintrag je Zeile), vergleicht mit dem zuletzt abgeglichenen Stand und
// schickt nur Geändertes an Supabase. Änderungen des anderen Geräts kommen per Echtzeit (Realtime) und werden
// Zeile für Zeile eingespielt; danach baut die App die Ansicht neu auf (K.onRemoteChange).
//
// Zeilen eines Bereichs (Tabelle mit schluessel | daten):
//   "offers"            { t: 'dict' }            Objekt mit Einträgen  → je Eintrag eine Zeile "offers/<Name>"
//   "inbox"             { t: 'list' }            Liste mit id je Element → je Element eine Zeile "inbox#<id>" = { o: Position, v: Element }
//   "bookings"          { t: 'val', v: [...] }   alles andere als Ganzes
//
// Ohne Eintrag in supabase-config.js bleibt alles wie bisher nur im Browser.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const CFG = window.KHW_SUPABASE || {};
  const on = !!(CFG.url && CFG.key && window.supabase && window.supabase.createClient);
  const TAB = 't' + Math.random().toString(36).slice(2, 10);   // je geöffnetem Fenster, damit das eigene Echo erkannt wird
  const PAGE = 1000, CHUNK = 200;
  const areas = {};
  let client = null, ready = false, channel = null, subscribedOnce = false;
  let status = on ? 'verbinde' : 'aus', statusMsg = '';

  /* ───────────── Zerlegen und Zusammensetzen ───────────── */
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  /** JSON mit sortierten Schlüsseln (Postgres sortiert jsonb um – so bleibt der Vergleich stabil). */
  const canon = v => {
    if (Array.isArray(v)) return '[' + v.map(x => (x === undefined ? 'null' : canon(x))).join(',') + ']';
    if (isObj(v)) return '{' + Object.keys(v).filter(k => v[k] !== undefined && typeof v[k] !== 'function').sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return v === undefined ? 'null' : JSON.stringify(v);
  };
  const hasIds = arr => arr.every(x => isObj(x) && (typeof x.id === 'string' || typeof x.id === 'number')) && new Set(arr.map(x => String(x.id))).size === arr.length;

  function flatten(obj) {
    const rows = new Map();
    Object.keys(obj || {}).forEach(top => {
      const v = obj[top];
      if (v === undefined || typeof v === 'function') return;
      if (isObj(v)) { rows.set(top, { t: 'dict' }); Object.keys(v).forEach(k => { if (v[k] !== undefined) rows.set(top + '/' + k, v[k]); }); }
      else if (Array.isArray(v) && hasIds(v)) { rows.set(top, { t: 'list' }); v.forEach((x, i) => rows.set(top + '#' + x.id, { o: i, v: x })); }
      else rows.set(top, { t: 'val', v });
    });
    return rows;
  }

  /** Eine Zeile in das Objekt einspielen (val === null: Zeile wurde gelöscht). */
  function applyRow(a, obj, key, val) {
    const i = key.search(/[/#]/);
    if (i < 0) {
      if (val === null) delete obj[key];
      else if (val.t === 'dict') { if (!isObj(obj[key])) obj[key] = {}; }
      else if (val.t === 'list') { obj[key] = Array.isArray(obj[key]) ? obj[key].filter(x => isObj(x) && x.id !== undefined) : []; }
      else obj[key] = val.v;
      return;
    }
    const top = key.slice(0, i), sub = key.slice(i + 1);
    if (key[i] === '/') {
      if (!isObj(obj[top])) obj[top] = {};
      if (val === null) delete obj[top][sub]; else obj[top][sub] = val;
      return;
    }
    if (!Array.isArray(obj[top])) obj[top] = [];
    const arr = obj[top], ords = a.ords[top] || (a.ords[top] = new Map());
    const idx = arr.findIndex(x => isObj(x) && String(x.id) === sub);
    if (val === null) { if (idx >= 0) arr.splice(idx, 1); ords.delete(sub); return; }
    ords.set(sub, Number(val.o) || 0);
    if (idx >= 0) arr[idx] = val.v; else arr.push(val.v);
    const pos = new Map(arr.map((x, j) => [x, j]));
    const ord = x => { const o = isObj(x) ? ords.get(String(x.id)) : undefined; return o === undefined ? Infinity : o; };
    arr.sort((x, y) => (ord(x) - ord(y)) || (pos.get(x) - pos.get(y)));
  }

  /* ───────────── Hochladen ───────────── */
  function schedule(a, ms) { clearTimeout(a.timer); a.timer = setTimeout(() => flush(a), ms); }
  async function flush(a) {
    if (!ready) { a.dirty = true; return; }
    if (a.busy) { a.dirty = true; return; }
    a.busy = true; a.dirty = false;
    let failed = false;
    try {
      const rows = flatten(a.get()), up = [], del = [];
      rows.forEach((v, k) => { const c = canon(v); if (a.last.get(k) !== c) up.push([k, v, c]); });
      a.last.forEach((c, k) => { if (!rows.has(k)) del.push(k); });
      const now = new Date().toISOString();
      for (let i = 0; i < up.length; i += CHUNK) {
        const part = up.slice(i, i + CHUNK);
        const { error } = await client.from(a.table).upsert(part.map(([k, v]) => ({ schluessel: k, daten: v, geaendert_am: now, geaendert_von: TAB })));
        if (error) throw error;
        part.forEach(([k, , c]) => a.last.set(k, c));
      }
      for (let i = 0; i < del.length; i += CHUNK) {
        const part = del.slice(i, i + CHUNK);
        const { error } = await client.from(a.table).delete().in('schluessel', part);
        if (error) throw error;
        part.forEach(k => a.last.delete(k));
      }
      if (up.length || del.length) setStatus('verbunden');
    } catch (e) {
      failed = true; a.dirty = true;
      setStatus('fehler', 'Nicht gespeichert: ' + (e.message || e));
    }
    a.busy = false;
    if (a.dirty) schedule(a, failed ? 5000 : 60);
  }

  /* ───────────── Herunterladen und Echtzeit ───────────── */
  async function fetchAll(table, cols) {
    const out = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client.from(table).select(cols).order('schluessel').range(from, from + PAGE - 1);
      if (error) throw error;
      out.push(...data);
      if (data.length < PAGE) return out;
    }
  }
  /** Zeilen aus Supabase als ganzen Bereich übernehmen (Start oder nach einer Verbindungslücke). */
  function adopt(a, rows) {
    const remote = new Map(rows.map(r => [r.schluessel, r.daten]));
    if (!a.loaded) {
      // Erster Abgleich: Stand aus Supabase komplett übernehmen (Gliederungszeilen zuerst)
      const obj = {}; a.ords = {};
      [...remote.keys()].sort((x, y) => (x.search(/[/#]/) < 0 ? 0 : 1) - (y.search(/[/#]/) < 0 ? 0 : 1)).forEach(k => applyRow(a, obj, k, remote.get(k)));
      a.set(obj);
      a.last = new Map([...remote].map(([k, v]) => [k, canon(v)]));
      a.loaded = true;
      return true;
    }
    // Nachholen: nur, was sich auf dem Server geändert hat; eigene, noch nicht gesendete Änderungen bleiben
    const obj = a.get(); let changed = false;
    remote.forEach((v, k) => { const c = canon(v); if (a.last.get(k) !== c) { applyRow(a, obj, k, v); a.last.set(k, c); changed = true; } });
    [...a.last.keys()].forEach(k => { if (!remote.has(k)) { applyRow(a, obj, k, null); a.last.delete(k); changed = true; } });
    if (changed) a.local();
    return changed;
  }
  let remoteTimer = null;
  const remoteChanged = () => { clearTimeout(remoteTimer); remoteTimer = setTimeout(() => { if (K.onRemoteChange) K.onRemoteChange(); }, 60); };

  function onEvent(a, p) {
    const row = p.eventType === 'DELETE' ? p.old : p.new;
    if (!row || !row.schluessel) return;
    if (p.eventType !== 'DELETE' && row.geaendert_von === TAB) return;   // eigenes Echo
    const key = row.schluessel, obj = a.get();
    if (p.eventType === 'DELETE') {
      if (!a.last.has(key)) return;
      applyRow(a, obj, key, null); a.last.delete(key);
    } else {
      const c = canon(row.daten);
      if (a.last.get(key) === c) return;
      applyRow(a, obj, key, row.daten); a.last.set(key, c);
    }
    a.local();
    remoteChanged();
  }

  async function resync() {
    try {
      let changed = false;
      for (const a of Object.values(areas)) changed = adopt(a, await fetchAll(a.table, 'schluessel,daten')) || changed;
      if (changed) remoteChanged();
      Object.values(areas).forEach(a => flush(a));
    } catch (e) { setStatus('fehler', e.message); }
  }

  function subscribe() {
    channel = client.channel('khw-stand');
    Object.values(areas).forEach(a => channel.on('postgres_changes', { event: '*', schema: 'public', table: a.table }, p => onEvent(a, p)));
    channel.subscribe(st => {
      if (st === 'SUBSCRIBED') {
        setStatus('verbunden');
        if (subscribedOnce) resync();   // nach einer Lücke verpasste Änderungen nachholen
        subscribedOnce = true;
      } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') setStatus('getrennt', 'Echtzeit-Verbindung unterbrochen – wird neu aufgebaut');
    });
  }

  /* ───────────── Wer ist gerade wo (Realtime Presence) und kurze Hinweise an den Mitspieler ─────────────
     Jedes verbundene Fenster meldet Name, Seite und ggf. die Show, die es gerade bearbeitet. Oben rechts erscheinen die
     anderen als Kreise; im Show-Editor gibt es einen Hinweis, wenn jemand dieselbe Show bearbeitet. Wichtige Ereignisse
     (Show beendet, Vertrag …) gehen als kurze Meldung an die anderen (Broadcast, nichts wird gespeichert). */
  let presence = null, others = [], myEmail = '', activity = {}, trackTimer = null;
  const nameOf = email => { const p = String(email || '').split('@')[0]; return p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Unbekannt'; };
  function startPresence() {
    presence = client.channel('khw-praesenz', { config: { presence: { key: TAB } } });
    presence.on('presence', { event: 'sync' }, () => {
      const st = presence.presenceState(), seen = new Set();
      others = [];
      Object.entries(st).forEach(([key, metas]) => {
        const p = metas && metas[metas.length - 1];
        if (!p || key === TAB || p.email === myEmail || seen.has(p.email)) return;   // sich selbst (auch auf anderen Geräten) nicht zeigen
        seen.add(p.email); others.push(p);
      });
      renderPresence();
    }).subscribe(st => { if (st === 'SUBSCRIBED') track(); });
  }
  function track() { if (presence && ready) presence.track(Object.assign({ name: nameOf(myEmail), email: myEmail, at: Date.now() }, activity)).catch(() => {}); }
  /** Was dieses Fenster gerade zeigt (aus main.js nach jedem Aufbau). Gemeldet wird nur bei Änderung. */
  function setActivity(a) {
    if (JSON.stringify(a) === JSON.stringify(activity)) return;
    activity = a; clearTimeout(trackTimer); trackTimer = setTimeout(track, 400);
  }
  function renderPresence() {
    const el = document.getElementById('presence');
    if (el) el.innerHTML = others.map(p => `<span class="pres" title="${K.esc(p.name)} · ${K.esc(p.page || '')}${p.editTitle ? ' – bearbeitet ' + K.esc(p.editTitle) : ''}">${K.esc(p.name.slice(0, 2).toUpperCase())}</span>`).join('');
    // Navigation: kleiner Punkt hinter der Seite, auf der gerade jemand anderes ist
    document.querySelectorAll('#nav-links a[href^="#"]').forEach(a => {
      const here = others.filter(p => p.view && '#' + p.view === a.getAttribute('href')).map(p => p.name);
      let dot = a.querySelector('.nav-pres');
      if (!here.length) { if (dot) dot.remove(); return; }
      if (!dot) { dot = document.createElement('span'); dot.className = 'nav-pres'; a.appendChild(dot); }
      dot.title = here.join(', ') + ' ist hier';
    });
    // Show-Editor: Hinweis, wenn jemand anderes dieselbe Show bearbeitet (ohne den Editor neu aufzubauen)
    const warn = document.querySelector('[data-presence-warn]');
    if (warn) {
      const names = others.filter(p => p.editing !== null && p.editing !== undefined && String(p.editing) === warn.dataset.presenceWarn).map(p => p.name);
      warn.innerHTML = names.length ? `<p class="admin-note pres-warn"><span class="ms">group</span>${K.esc(names.join(' und '))} ${names.length > 1 ? 'bearbeiten' : 'bearbeitet'} diese Show gerade auch. Achtet darauf, nicht dasselbe Match gleichzeitig zu ändern.</p>` : '';
    }
  }
  K.afterRender = K.afterRender || [];
  K.afterRender.push(view => {
    if (!presence) return;
    const st = K.state || {}, edit = view === 'shows' && st.editShow !== null && st.editShow !== undefined ? st.editShow : null;
    const s = edit !== null && K.model ? K.model.show(edit) : null;
    setActivity({ view, page: (K.views[view] || {}).title || view, editing: edit, editTitle: s && K.ui ? K.ui.showTitle(s) : '' });
    renderPresence();
  });

  /* ───────────── Anmeldung ───────────── */
  async function login(note) {
    for (;;) {
      const v = await K.dialog.form({
        title: 'Bei KHW Office anmelden', icon: 'login', ok: 'Anmelden',
        text: (note ? note + '\n\n' : '') + 'Einmal je Gerät. Das Konto legst du in Supabase unter Authentication → Users an.',
        fields: [{ id: 'email', label: 'E-Mail', placeholder: 'name@beispiel.de' }, { id: 'password', label: 'Passwort', type: 'password' }],
      });
      if (!v) { note = 'Ohne Anmeldung gibt es keinen gemeinsamen Stand.'; continue; }
      const { data, error } = await client.auth.signInWithPassword({ email: v.email.trim(), password: v.password });
      if (!error && data.session) return data.session;
      note = 'Anmeldung fehlgeschlagen: ' + (error ? error.message : 'unbekannter Fehler');
    }
  }

  /* ───────────── Status ───────────── */
  const LABEL = { aus: 'Nur dieser Browser', verbinde: 'Supabase · verbinde …', verbunden: 'Supabase · verbunden', getrennt: 'Supabase · getrennt', fehler: 'Supabase · Fehler', test: 'Testmodus · getrennt' };
  const HINT = {
    verbunden: 'Klicken, um zu trennen und mit einer Kopie zu testen',
    test: 'Nichts wird gespeichert oder geteilt. Klicken, um wieder zu verbinden (Test-Änderungen werden verworfen)',
  };

  /* ───────────── Testmodus ─────────────
     Getrennt arbeitet dieses Gerät mit einer Kopie des Stands (im Browser): ausprobieren wie im alten Klickdummy,
     nichts geht an Supabase; die KI folgt dem Schalter in den KI-Einstellungen (live = echte Anfragen). Wieder verbinden verwirft die Kopie und lädt den Stand aus
     Supabase – es wird dabei nichts gesendet. Der Schalter gilt je Gerät und übersteht das Neuladen. */
  const TEST_KEY = 'khw.cloud.test';
  // Beim Laden der Seite festgelegt (und beim Trennen umgestellt): ein verbundener Tab im selben Browser bleibt verbunden
  let testMode = (() => { try { return localStorage.getItem(TEST_KEY) === '1'; } catch (e) { return false; } })();
  const testOn = () => testMode;
  const setTest = v => { testMode = !!v; try { if (v) localStorage.setItem(TEST_KEY, '1'); else localStorage.removeItem(TEST_KEY); } catch (e) { /* egal */ } };
  // Die Test-Kopie liegt unter eigenen Schlüsseln („… .test“), damit ein verbundener Tab im selben Browser sie nicht überschreibt
  const TEST_KEYS = new Set();
  const storageKey = k => { TEST_KEYS.add(k + '.test'); return testOn() ? k + '.test' : k; };
  async function disconnect() {
    // Erst alles Ungesendete hochladen, damit nichts vom echten Stand verloren geht
    for (const a of Object.values(areas)) { clearTimeout(a.timer); while (a.busy) await new Promise(r => setTimeout(r, 50)); await flush(a); }
    if (Object.values(areas).some(a => a.dirty)) throw new Error('Nicht alles konnte gespeichert werden. Bitte später erneut versuchen.');
    ready = false;
    if (channel) { try { await client.removeChannel(channel); } catch (e) { /* egal */ } channel = null; }
    if (presence) { try { await client.removeChannel(presence); } catch (e) { /* egal */ } presence = null; others = []; renderPresence(); }
    setTest(true);
    Object.values(areas).forEach(a => a.local());   // Kopie unter den Test-Schlüsseln anlegen
    setStatus('test');
  }
  function reconnect() {   // beim Start gilt dann der Stand aus Supabase
    setTest(false);
    try { Object.keys(localStorage).filter(k => TEST_KEYS.has(k) || /^khw.*\.test$/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) { /* egal */ }
    location.reload();
  }
  document.addEventListener('click', e => {
    if (!on || !e.target.closest('.cloud-chip')) return;
    if (status === 'test') {
      K.dialog.confirm({ title: 'Wieder mit Supabase verbinden?', icon: 'cloud_sync', ok: 'Verbinden', text: 'Alles, was du im Testmodus geändert hast, wird verworfen. Danach gilt wieder der gemeinsame Stand aus Supabase. Es wird nichts gesendet.' })
        .then(yes => { if (yes) reconnect(); });
    } else if (status === 'verbunden') {
      K.dialog.confirm({ title: 'Trennen und testen?', icon: 'science', ok: 'Trennen',
        text: 'Dieses Gerät arbeitet dann mit einer Kopie des aktuellen Stands – zum Ausprobieren wie im alten Klickdummy. Nichts wird gespeichert oder an das andere Gerät geschickt. Die KI läuft wie in den KI-Einstellungen gewählt – live verbraucht also auch hier Kontingent.\n\nBeim Wiederverbinden wird die Kopie verworfen und der Stand aus Supabase geladen.' })
        .then(yes => { if (yes) disconnect().then(() => { K.toast('Testmodus: getrennt'); if (K.render) K.render(); }).catch(err => K.dialog.alert({ title: 'Trennen nicht möglich', icon: 'error', text: err.message })); });
    } else {
      K.dialog.confirm({ title: 'Neu verbinden?', icon: 'refresh', ok: 'Neu laden', text: (statusMsg ? statusMsg + '\n\n' : '') + 'Die Seite wird neu geladen und verbindet sich erneut mit Supabase.' })
        .then(yes => { if (yes) location.reload(); });
    }
  });
  function setStatus(s, msg) {
    status = s; statusMsg = msg || '';
    const el = document.getElementById('status');
    if (el && K.cloud.on) el.innerHTML = K.cloud.chip();
  }

  /* ───────────── Startstand aus der Tabelle (khw_basis, je Blatt eine Zeile) ───────────── */
  async function loadBase() {
    const rows = await fetchAll('khw_basis', 'schluessel,daten');
    const meta = rows.find(r => r.schluessel === 'meta');
    if (!meta) return null;
    const data = Object.assign({}, meta.daten, { sheets: {} });
    rows.filter(r => r.schluessel.startsWith('blatt/')).forEach(r => { data.sheets[r.schluessel.slice(6)] = r.daten; });
    return data;
  }
  async function saveBase(data) {
    const now = new Date().toISOString(), meta = Object.assign({}, data); delete meta.sheets;
    // „meta“ zuletzt: Erst wenn alle Blätter oben sind, gilt der Startstand als vorhanden
    const rows = [...Object.entries(data.sheets || {}).map(([n, s]) => ({ schluessel: 'blatt/' + n, daten: s })), { schluessel: 'meta', daten: meta }];
    for (const r of rows) {   // einzeln, damit keine Anfrage zu groß wird
      const { error } = await client.from('khw_basis').upsert(Object.assign(r, { geaendert_am: now, geaendert_von: TAB }));
      if (error) throw error;
    }
    const keep = new Set(rows.map(r => r.schluessel));
    const old = (await fetchAll('khw_basis', 'schluessel')).map(r => r.schluessel).filter(k => !keep.has(k));
    if (old.length) await client.from('khw_basis').delete().in('schluessel', old);
  }

  K.cloud = {
    on,
    get ready() { return ready; },
    get client() { return client; },
    get status() { return status; },
    get test() { return status === 'test'; },
    get testMode() { return testOn(); },
    /** Schlüssel im Browser-Speicher für einen Bereich (im Testmodus die Test-Kopie). */
    key: k => (on ? storageKey(k) : k),
    chip() {
      const cls = status === 'verbunden' ? 'accent' : status === 'fehler' || status === 'getrennt' ? 'warn-chip' : status === 'test' ? 'test-chip' : 'outline';
      const tip = [statusMsg, HINT[status] || (status === 'fehler' || status === 'getrennt' ? 'Klicken, um neu zu verbinden' : '')].filter(Boolean).join(' · ');
      return `<button type="button" class="chip cloud-chip ${cls}" title="${K.esc ? K.esc(tip || LABEL[status]) : ''}">${status === 'test' ? '<span class="ms sm">science</span>' : ''}${LABEL[status] || status}</button>`;
    },
    /**
     * Bereich anmelden. get(): aktuelles Objekt · set(obj): Objekt ersetzen (und im Browser zwischenspeichern, ohne
     * changed() zu melden) · local(): aktuelles Objekt im Browser zwischenspeichern.
     */
    register(name, table, get, set, local) { areas[name] = { name, table, get, set, local, last: new Map(), ords: {}, timer: null, busy: false, dirty: false, loaded: false }; },
    /** Ein Bereich hat sich geändert: geänderte Zeilen kurz danach hochladen. */
    changed(name) { const a = areas[name]; if (!a || !on) return; a.dirty = true; if (ready) schedule(a, 120); },
    /**
     * Verbinden, anmelden, Stand laden, Echtzeit starten. Liefert den Startstand aus der Tabelle (oder null).
     * Nur bei der ersten Einrichtung (noch kein Startstand in Supabase) wird der Stand dieses Browsers hochgeladen;
     * sonst gilt immer der Stand aus Supabase, auch wenn ein Bereich dort leer ist.
     * Im Testmodus wird nur der Startstand gelesen; Spielstand, Regelwerk und IDB bleiben die Kopie im Browser.
     */
    async start() {
      client = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'khw.supabase.auth' } });
      let { data: { session } } = await client.auth.getSession();
      if (!session) session = await login();
      myEmail = (session && session.user && session.user.email) || '';
      // Profil-Kreis oben rechts: wer an diesem Gerät angemeldet ist (statt fest „KH“)
      const av = document.getElementById('avatar');
      if (av && myEmail) { av.textContent = nameOf(myEmail).slice(0, 2).toUpperCase(); av.title = `${nameOf(myEmail)} (${myEmail})`; }
      setStatus('verbinde');
      const base = await loadBase();
      if (testOn()) { setStatus('test'); return base; }
      for (const a of Object.values(areas)) {
        const rows = await fetchAll(a.table, 'schluessel,daten');
        if (rows.length || base) adopt(a, rows); else { a.loaded = true; a.dirty = true; }   // erste Einrichtung: lokaler Stand wird hochgeladen
      }
      subscribe();
      ready = true;
      startPresence();
      Object.values(areas).forEach(a => { if (a.dirty) flush(a); });
      setStatus('verbunden');
      return base;
    },
    loadBase, saveBase, nameOf,
    get me() { return nameOf(myEmail); },
    get email() { return myEmail; },
    /** Protokoll (Admin): die letzten Änderungen aus khw_protokoll. */
    async protocol(limit) {
      const { data, error } = await client.from('khw_protokoll').select('*').order('id', { ascending: false }).limit(limit || 300);
      if (error) throw error;
      return data;
    },
    /** Rückgängig: eine Zeile auf ihren alten Inhalt setzen (alt = null: Zeile war neu → löschen). Kommt per Echtzeit überall an. */
    async restore(table, key, alt) {
      if (!ready) throw new Error('Nur verbunden möglich (nicht im Testmodus).');
      const q = alt === null || alt === undefined
        ? client.from(table).delete().eq('schluessel', key)
        : client.from(table).upsert({ schluessel: key, daten: alt, geaendert_am: new Date().toISOString(), geaendert_von: 'rueckgaengig' });
      const { error } = await q;
      if (error) throw error;
    },
    async signOut() { if (client) await client.auth.signOut(); location.reload(); },
  };
})(window.KHW);
