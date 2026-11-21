// KHW Manager – IDB-Editor.
// Werkzeug, um Einträge für das Interaktionssystem zu schreiben (Tonalitäten, Absender, Themen, Belohnungen …).
// Was in der Tabelle Formeln waren, sind hier Variablen in geschweiften Klammern, z. B. {wrestler:show=Lucky7;ausrichtung=Heel}.
// Die Einträge liegen vorerst im Browser dieses Geräts (localStorage) und lassen sich als Datei sichern.
// Später wandern sie in die Datenbank.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc } = K;
  const icon = n => `<span class="ms">${n}</span>`;
  const STORE = 'khw.idb';
  const rnd = list => K.pick(list);   // echter Zufall (store.js)

  /* ───────────── Daten ───────────── */
  let db = null;
  function load() {
    if (db) return db;
    try { db = JSON.parse(localStorage.getItem(K.cloud ? K.cloud.key(STORE) : STORE) || 'null'); } catch (e) { db = null; }
    if (!db || !Array.isArray(db.lists)) db = { nextId: 1, lists: [] };
    prepare();
    return db;
  }
  /** Neue Startlisten und einmalige Bereinigungen nachziehen (auch für einen Stand, der von Supabase kommt). */
  function prepare() {
    seed();
    // Einmalig (Wunsch des Nutzers): Postfach-Kombinationen einrichten, dann Listen entfernen, die nirgends genutzt werden.
    // Entfernte Listen bleiben in db.removed und lassen sich in der Listen-Zuordnung wiederherstellen.
    // Erst die automatische Zuordnung (links), sonst gälten frisch übernommene Listen als unbenutzt.
    if (!db.cleanup1 && K.IDB_SLOTS) { links(); ensureCombos(); removeUnused(); db.cleanup1 = true; save(); }
    return db;
  }
  /** Startlisten (z. B. Vertragsbedingungen) einmalig übernehmen. Danach gehören sie dem Nutzer: Gelöschtes kommt nicht wieder. */
  function seed() {
    db.seeded = db.seeded || [];
    let changed = false;
    (K.IDB_SEEDS || []).forEach(s => {
      if (db.seeded.includes(s.key)) return;
      if (s.patch) s.patch(db);
      (s.lists || []).forEach(l => {
        if (db.lists.some(x => x.name === l.name)) return;
        db.lists.push({ id: db.nextId++, name: l.name, entries: l.entries.map(e => ({ id: db.nextId++, text: e.text, formula: e.formula || '', todo: !!e.todo })) });
      });
      db.seeded.push(s.key); changed = true;
    });
    if (changed) save();
  }
  const local = () => { try { localStorage.setItem(K.cloud ? K.cloud.key(STORE) : STORE, JSON.stringify(db)); } catch (e) { /* bleibt dann nur für diese Sitzung */ } };
  function save() { local(); if (K.cloud) K.cloud.changed('idb'); }
  // Abgleich über Supabase (cloud.js): kommt ein Stand vom Server, ersetzt er den des Browsers
  if (K.cloud) K.cloud.register('idb', 'khw_idb', () => load(), obj => { db = Object.assign({ nextId: 1 }, obj || {}); if (!Array.isArray(db.lists)) db.lists = []; prepare(); local(); }, () => { if (db) local(); });
  // Änderungen aus einem anderen Tab: neu laden und anzeigen (aber nicht mitten ins Tippen hinein).
  window.addEventListener('storage', e => {
    if (K.cloud && K.cloud.on) return;   // mit Supabase kommt das über Realtime
    if (e.key !== STORE) return;
    db = null;
    if (K.state && K.state.view === 'idb' && document.activeElement && document.activeElement.id === 'idb-text') return;
    if (K.onRemoteChange) K.onRemoteChange();
  });
  const id = () => db.nextId++;
  const listOf = st => load().lists.find(l => l.id === st.idbList) || load().lists[0] || null;
  const entryOf = (st, list) => list ? list.entries.find(e => e.id === st.idbEntry) || null : null;

  /* ───────────── Variablen ─────────────
     Schreibweise:  {funktion:parameter=wert;parameter=wert}
     Merken:        {a=wrestler:show=Lucky7}   → gibt den Namen aus und merkt sich den Wrestler als "a"
     Wiederverwenden: {a.gimmick}              → ein Feld des gemerkten Wrestlers                                  */
  const W_FIELDS = {
    name: w => w.name, gimmick: w => w.gimmick, tagteam: w => w.tagTeam,
    stable: w => w.stable, titel: w => w.titles.join(', '), status: w => w.status, show: w => w.show, ausrichtung: w => w.alignment,
    promotion: w => w.promotion, verletzung: w => w.injury, storyline: w => w.storyline, vertragsende: w => w.contractEnd,
    geschlecht: w => w.gender, besonderheiten: w => w.notes,
  };
  const eq = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
  // Haupttitel je Show und Geschlecht (für „Titelchance“-Einträge im Vertrag) stehen im Regelwerk (Bereich „titles“).
  const showTitle = (show, g) => { const main = K.conf.get('titles').main || {}; return ((main[show] || main.Lucky7 || {})[g]) || ''; };
  /** Wert für „wie Person“ und „Vertrag“ auflösen; ohne Person oder Vertrag fällt der Filter weg. */
  const ctxVal = (v, ctx, field) => v === 'wie Person' ? (ctx.person ? ctx.person[field] : '') : v === 'Vertrag' ? (ctx.show || '') : v;
  const num = (v, p) => {
    let x = Number(v) * (Number(p.mal) || 1) / (Number(p.durch) || 1);
    const step = Number(p.runden) || 0;
    if (step) x = Math.round(x / step) * step;
    return K.fmt(x, step && step < 1 ? 2 : x % 1 ? 2 : 0);
  };

  const FUNCS = {
    wrestler: {
      label: 'Wrestler', icon: 'person', hint: 'Zufälliger Wrestler aus der Datenbank. Innerhalb eines Eintrags wird niemand doppelt gezogen.',
      params: m => [
        ['show', 'Show', ['', ...K.khwShows(), 'keine', ['Vertrag', 'Show des Vertrags']]], ['geschlecht', 'Geschlecht', ['', 'm', 'w', 'wie Person']], ['ausrichtung', 'Ausrichtung', ['', 'Face', 'Heel']],
        ['status', 'Status', ['', ...K.STATUS, 'wie Person']], ['promotion', 'Promotion', ['', ...new Set(m.roster.map(w => w.promotion).filter(Boolean))]],
        ['verletzt', 'Verletzungsstatus', ['', 'ja', 'nein']], ['champion', 'Hält einen Titel', ['', 'ja', 'nein']],
        ['besonderheit', 'Besonderheiten enthalten (optional, z. B. EX KHW)', null],
        ['feld', 'Ausgabe', Object.keys(W_FIELDS)], ['als', 'Kürzel zum Wiederverwenden (optional, z. B. a)', null],
      ],
      run(p, m, ctx) {
        // „Vertrag“ = Show des laufenden Vertrags, „wie Person“ = wie der Vertragspartner. Der Vertragspartner selbst wird nie gezogen.
        const show = ctxVal(p.show, ctx), g = ctxVal(p.geschlecht, ctx, 'gender'), status = ctxVal(p.status, ctx, 'status');
        const pool = m.roster.filter(w =>
          (!show || (show === 'keine' ? !w.show : eq(w.show, show))) && (!g || eq(w.gender, g)) &&
          (!p.ausrichtung || eq(w.alignment, p.ausrichtung)) && (!status || eq(w.status, status)) && (!p.promotion || eq(w.promotion, p.promotion)) &&
          (!p.besonderheit || String(w.notes || '').toLowerCase().includes(p.besonderheit.toLowerCase())) &&
          (!p.verletzt || (p.verletzt === 'ja') === !!w.injury) && (!p.champion || (p.champion === 'ja') === (w.titles.length > 0)) && !ctx.used.has(w.name));
        if (!pool.length) return { text: '[kein passender Wrestler]' };
        const w = rnd(pool); ctx.used.add(w.name);
        return { text: fieldOf(w, p.feld), obj: w };
      },
    },
    team: {
      label: 'Tag Team', icon: 'group', hint: 'Zufälliges Tag Team aus der Datenbank.',
      params: () => [['show', 'Show', ['', ...K.khwShows()]], ['geschlecht', 'Geschlecht', ['', 'm', 'w']]],
      run(p, m) {
        // Team passt, wenn alle Mitglieder zu Show und Geschlecht passen
        const teams = (m.teams || []).filter(t => t.members.every(n => { const w = m.byName.get(n); return w && (!p.show || eq(w.show, p.show)) && (!p.geschlecht || eq(w.gender, p.geschlecht)); })).map(t => t.name);
        return { text: teams.length ? rnd(teams) : '[kein passendes Team]' };
      },
    },
    titel: {
      label: 'Titel', icon: 'emoji_events', hint: 'Ein Titel oder sein aktueller Träger. „Haupttitel der Vertrags-Show“ wählt den Titel passend zu Show und Geschlecht des Vertragspartners.',
      params: m => [['name', 'Titel', [['Vertrags-Show', 'Haupttitel der Vertrags-Show'], ...m.titles.map(t => t.name)]], ['feld', 'Ausgabe', [['traeger', 'Träger'], ['name', 'Name des Titels']]]],
      run(p, m, ctx) {
        let name = p.name;
        if (name === 'Vertrags-Show') {
          const g = ctx.person && eq(ctx.person.gender, 'w') ? 'w' : 'm';
          name = showTitle(ctx.show, g);
        }
        const t = m.titles.find(x => eq(x.name, name));
        // Vakante Titel fehlen in der Titelliste (die Tabelle erkennt einen Titel nur an seinem Träger).
        if (!t && p.name === 'Vertrags-Show') return { text: p.feld === 'name' ? name : 'niemand (vakant)' };
        if (!t) return { text: '[Titel unbekannt]' };
        return p.feld === 'name' ? { text: t.name } : { text: t.holder || 'niemand (vakant)', obj: m.byName.get(t.holder) };
      },
    },
    person: {
      label: 'Vertragspartner', icon: 'badge', hint: 'Die Person, um die es gerade geht (z. B. im Vertrag). Mit „Wenn/Dann“ gibt es je nach Wert einen anderen Text, z. B. Ausrichtung: wenn Face → „einen Heel-Turn“, sonst „einen Face-Turn“.',
      params: () => [['feld', 'Angabe', Object.keys(W_FIELDS)], ['wenn1', 'Wenn der Wert … ist (optional)', null], ['dann1', '… dann dieser Text', null],
        ['wenn2', 'Wenn der Wert … ist (optional)', null], ['dann2', '… dann dieser Text', null], ['sonst', 'Sonst dieser Text (optional)', null]],
      run(p, m, ctx) {
        if (!ctx.person) return { text: '[kein Vertragspartner]' };
        const v = fieldOf(ctx.person, p.feld);
        if (p.wenn1 && eq(v, p.wenn1)) return { text: p.dann1 || '' };
        if (p.wenn2 && eq(v, p.wenn2)) return { text: p.dann2 || '' };
        if (p.wenn1 || p.wenn2 || p.sonst) return { text: p.sonst !== undefined ? p.sonst : v };
        return { text: v, obj: ctx.person };
      },
    },
    nurwenn: {
      label: 'Nur wenn', icon: 'filter_alt', hint: 'Bedingung für den ganzen Eintrag: Passt der Vertragspartner nicht, wird der Eintrag beim Ziehen übersprungen. Gibt selbst keinen Text aus.',
      params: () => [['geschlecht', 'Geschlecht', ['', 'm', 'w']], ['ausrichtung', 'Ausrichtung', ['', 'Face', 'Heel']], ['status', 'Status', ['', ...K.STATUS]],
        ['champion', 'Hält einen Titel', ['', 'ja', 'nein']], ['show', 'Show des Vertrags', ['', 'TryOut', 'Lucky7']]],
      run(p, m, ctx) {
        const w = ctx.person;
        const ok = !w ? true : (!p.geschlecht || eq(w.gender, p.geschlecht)) && (!p.ausrichtung || eq(w.alignment, p.ausrichtung)) &&
          (!p.status || eq(w.status, p.status)) && (!p.champion || (p.champion === 'ja') === (w.titles.length > 0)) && (!p.show || eq(ctx.show, p.show));
        if (!ok) ctx.skip = true;
        return { text: '' };
      },
    },
    vertrag: {
      label: 'Vertrag', icon: 'contract', hint: 'Werte des Vertrags, der gerade angeboten wird. Zahlen lassen sich teilen, malnehmen und runden (z. B. Angebot 2 durch 300, auf 10 gerundet).',
      params: () => [['feld', 'Angabe', [['gehalt', 'Gehalt (Angebot 1)'], ['alternative', 'Gehalt (Angebot 2)'], ['show', 'Show'], ['laufzeit', 'Laufzeit']]],
        ['durch', 'Geteilt durch (optional)', null], ['mal', 'Mal (optional)', null], ['runden', 'Runden auf (optional, z. B. 10 oder 0.01)', null]],
      run(p, m, ctx) {
        const c = ctx.contract;
        if (!c) return { text: '[kein Vertrag]' };
        if (p.feld === 'show') return { text: ctx.show || '' };
        if (p.feld === 'laufzeit') return { text: c.duration === 'Einmalig' ? 'einmalig' : c.duration + ' Monate' };
        const v = p.feld === 'alternative' ? c.altPrice : c.price;
        return { text: v === null || v === undefined ? '0' : num(v, p) };
      },
    },
    stable: {
      label: 'Stable', icon: 'diversity_3', hint: 'Zufälliges Stable aus der Datenbank. Das Stable des Vertragspartners wird ausgelassen.',
      params: () => [['show', 'Show', ['', ...K.khwShows(), ['Vertrag', 'Show des Vertrags']]]],
      run(p, m, ctx) {
        const show = ctxVal(p.show, ctx), own = ctx.person ? (ctx.person.stables || []) : [];
        // Stables mit mindestens einem Wrestler dieser Show (auch über ein Team), ohne die des Vertragspartners
        const list = [...new Set(m.roster.filter(w => w.stables && w.stables.length && (!show || eq(w.show, show))).flatMap(w => w.stables))].filter(s => !own.includes(s));
        return { text: list.length ? rnd(list) : '[kein passendes Stable]' };
      },
    },
    letzteShow: {
      label: 'Letzte Show', icon: 'history', hint: 'Angaben zur zuletzt gelaufenen Show mit Einträgen in der Card.',
      params: () => [['feld', 'Ausgabe', ['name', 'sieger', 'verlierer', 'match', 'sterne', 'bestesMatch']]],
      run(p, m) {
        const s = m.shows.slice().reverse().find(x => x.ended && x.hasContent);
        if (!s) return { text: '[keine gelaufene Show]' };
        const decided = s.matches.filter(x => x.winner && x.loser);
        const f = p.feld || 'name';
        if (f === 'name') return { text: s.name || s.type };
        if (f === 'sterne') return { text: String(s.stars).replace('.', ',') };
        if (!decided.length) return { text: '[kein entschiedenes Match]' };
        const mt = f === 'bestesMatch' ? decided.reduce((b, x) => (x.stars || 0) > (b.stars || 0) ? x : b) : rnd(decided);
        if (f === 'sieger') return { text: mt.winner, obj: m.byName.get(mt.winner) };
        if (f === 'verlierer') return { text: mt.loser, obj: m.byName.get(mt.loser) };
        return { text: `${mt.winner} besiegte ${mt.loser}${mt.stars ? ` (${String(mt.stars).replace('.', ',')} Sterne)` : ''}` };
      },
    },
    liga: {
      label: 'Liga-Wert', icon: 'domain', hint: 'Aktuelle Werte der Liga.',
      params: () => [['feld', 'Ausgabe', ['monat', 'woche', 'aktuelleShow', 'naechsterPPV', 'uebernaechsterPPV', 'vermoegen', 'follower', 'sterne', 'skillpunkte']],
        ['plus', 'Monat (nur bei Ausgabe „monat“)', [['', 'aktueller Monat'], ['1', 'nächster Monat'], ...Array.from({ length: 10 }, (_, i) => [String(i + 2), `in ${i + 2} Monaten`])]]],
      run(p, m) {
        const cur = m.show(m.currentShow), f = p.feld || 'monat';
        const ppvs = m.shows.filter(s => !s.ended && s.type === 'PPV');   // auch selbst angelegte PPVs und Folgejahre
        const ppvName = s => s ? (s.name || 'PPV') : '';
        const map = {
          // plus = Folgemonate; nach Dezember geht es mit Januar weiter
          monat: () => cur ? K.MONTHS[(cur.date.month + (Number(p.plus) || 0)) % 12] : '', woche: () => cur ? 'Woche ' + cur.date.week : '', aktuelleShow: () => cur ? (cur.name || cur.type) : '',
          naechsterPPV: () => ppvName(ppvs[0]), uebernaechsterPPV: () => ppvName(ppvs[1]), vermoegen: () => K.eur(m.finance.balance, true), follower: () => K.fmt(m.finance.followers),
          sterne: () => K.fmt(m.staff.stars), skillpunkte: () => K.fmt(m.skillPoints),
        };
        return { text: map[f] ? map[f]() : '[Wert unbekannt]' };
      },
    },
    storyline: {
      label: 'Storyline', icon: 'auto_stories', hint: 'Name einer laufenden Storyline.',
      params: () => [['show', 'Show', ['', 'TryOut', 'Lucky7']]],
      run(p, m) { const s = m.stories.filter(x => !p.show || eq(x.show, p.show)); return { text: s.length ? rnd(s).name : '[keine Storyline]' }; },
    },
    zahl: {
      label: 'Zufallszahl', icon: 'casino', hint: 'Ganze Zufallszahl zwischen zwei Grenzen. „mal“ multipliziert das Ergebnis (z. B. 250).',
      params: () => [['von', 'Von', null], ['bis', 'Bis', null], ['mal', 'Mal (optional)', null]],
      run(p) {
        const a = Number(p.von), b = Number(p.bis);
        if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return { text: '[von/bis fehlt]' };
        return { text: String(K.randBetween(a, b) * (Number(p.mal) || 1)) };
      },
    },
    wahl: {
      label: 'Auswahl', icon: 'alt_route', hint: 'Zufällig einer von mehreren Texten. Die Texte mit | trennen.',
      params: () => [['aus', 'Texte, mit | getrennt', null]],
      run(p) { const o = String(p.aus || '').split('|').map(s => s.trim()).filter(Boolean); return { text: o.length ? rnd(o) : '[keine Auswahl]' }; },
    },
    liste: {
      label: 'Aus Liste', icon: 'list', hint: 'Zufälliger Eintrag aus einer anderen IDB-Liste (dessen Variablen werden mit aufgelöst).',
      params: () => [['name', 'Liste', load().lists.map(l => l.name)]],
      run(p, m, ctx, depth) {
        const l = load().lists.find(x => eq(x.name, p.name));
        if (!l || !l.entries.length) return { text: '[Liste leer oder unbekannt]' };
        return { text: depth > 3 ? '[zu tief verschachtelt]' : resolve(rnd(l.entries).text, m, ctx, depth + 1).replace(/[\u0001-\u0004]/g, '') };
      },
    },
  };
  const fieldOf = (w, feld) => { const f = W_FIELDS[String(feld || 'name').toLowerCase()]; const v = f ? f(w) : null; return (v === null || v === undefined || v === '') ? '–' : String(v); };

  function token(body, m, ctx, depth) {
    const ref = /^([A-Za-z]\w*)\.(\w+)$/.exec(body);
    if (ref && ctx.alias[ref[1]]) return fieldOf(ctx.alias[ref[1]], ref[2]);
    let alias = null;
    const as = /^([A-Za-z]\w*)\s*=\s*([A-Za-z]\w*)(:.*)?$/.exec(body);
    if (as && FUNCS[as[2]]) { alias = as[1]; body = as[2] + (as[3] || ''); }
    const i = body.indexOf(':'), name = i < 0 ? body : body.slice(0, i);
    const fn = FUNCS[name];
    if (!fn) return null;
    const p = {};
    if (i >= 0) body.slice(i + 1).split(';').forEach(part => { const j = part.indexOf('='); if (j > 0) p[part.slice(0, j).trim()] = part.slice(j + 1).trim(); });
    const res = fn.run(p, m, ctx, depth);
    if (alias && res.obj) ctx.alias[alias] = res.obj;
    return res.text;
  }

  /**
   * Kontext beim Auflösen. person/show/contract kommen vom aufrufenden Bereich (z. B. Vertrag):
   * person = Vertragspartner (Wrestler-Objekt), show = Show des Vertrags, contract = { price, altPrice, duration }.
   */
  const makeCtx = (o = {}) => {
    const ctx = { alias: {}, used: new Set(), person: o.person || null, show: o.show || '', contract: o.contract || null, skip: false };
    if (ctx.person) ctx.used.add(ctx.person.name);   // niemand fordert ein Match gegen sich selbst
    return ctx;
  };

  /** Löst alle Variablen eines Textes auf. Treffer sind mit Steuerzeichen markiert (für die farbige Vorschau). */
  function resolve(text, m, ctx, depth) {
    ctx = ctx || makeCtx();
    return String(text).replace(/\{([^{}]+)\}/g, (all, body) => {
      const out = token(body.trim(), m, ctx, depth || 0);
      return out === null ? `\u0001${all}\u0002` : `\u0003${out}\u0004`;
    });
  }
  const clean = s => s.replace(/[\u0001-\u0004]/g, '').replace(/\s{2,}/g, ' ').trim();
  K.idbResolve = (text, m, o) => clean(resolve(text, m, makeCtx(o)));

  /**
   * Zieht einen zufälligen Eintrag aus einer IDB-Liste und löst ihn auf. Einträge, deren „Nur wenn“ nicht passt,
   * werden übersprungen; exclude enthält Eintrags-IDs, die schon gezogen wurden.
   * Rückgabe: { id, text } oder null, wenn die Liste fehlt oder nichts passt.
   */
  K.idbDraw = (listName, m, o = {}) => {
    const l = load().lists.find(x => eq(x.name, listName));
    if (!l) return null;
    const pool = l.entries.filter(e => e.text.trim() && !(o.exclude || []).includes(e.id));
    while (pool.length) {
      const e = pool.splice(K.rand(pool.length), 1)[0];
      const ctx = makeCtx(o), text = clean(resolve(e.text, m, ctx));
      if (!ctx.skip) return { id: e.id, text };
    }
    return null;
  };
  K.idbHasList = name => load().lists.some(x => eq(x.name, name));

  /** Beispiel-Kontext für die Vorschau im Editor: der Vertrag, der gerade auf der Vertragsseite steht. */
  const previewCtx = m => {
    const d = (K.store && K.store.state.drafts.contract) || null;
    const person = d && m.byName.get(d.person);
    if (!person) return makeCtx();
    return makeCtx({ person, show: d.show, contract: { price: d.price || null, altPrice: d.alt ? d.alt.price : null, duration: d.duration } });
  };
  const previewHtml = (text, m) => {
    const ctx = previewCtx(m);
    const html = esc(resolve(text, m, ctx)).replace(/\u0001/g, '<span class="var-bad" title="Unbekannte Variable">').replace(/\u0003/g, '<span class="var-ok">').replace(/[\u0002\u0004]/g, '</span>').replace(/\n/g, '<br>');
    return ctx.skip ? `<span class="muted">${html}</span><br><small>${icon('filter_alt')} „Nur wenn“ passt nicht zu ${esc(ctx.person.name)} – dieser Eintrag würde für ihn/sie übersprungen.</small>` : html;
  };
  const previewWho = m => { const c = previewCtx(m); return c.person ? `Vorschau für ${esc(c.person.name)} · ${esc(c.show)} (aus der Vertragsseite)` : 'Vorschau mit den aktuellen Daten'; };
  const varCount = t => (String(t).match(/\{[^{}]+\}/g) || []).length;

  /* ───────────── Ansicht ───────────── */
  let model = null;

  /** Formular „Gleicher Wrestler“: setzt eine weitere Angabe zu einem Wrestler ein, der im Eintrag schon mit Kürzel gezogen wird. */
  function refParams(entry) {
    const aliases = [...new Set([...String(entry.text).matchAll(/\{\s*([A-Za-z]\w*)\s*=\s*wrestler\b/g)].map(x => x[1]))];
    const intro = `<b>${icon('link')}Gleicher Wrestler</b><small>Setzt eine weitere Angabe zu einem Wrestler ein, der in diesem Eintrag schon gezogen wird.
      Beispiel: „{a=wrestler:show=Lucky7} will reden. Sein Gimmick: {a.gimmick}“ ergibt „Eddie Guerrero will reden. Sein Gimmick: Schummler, Film-Star“.</small>`;
    if (!aliases.length) return `<div class="idb-params">${intro}<p class="hint">In diesem Eintrag gibt es noch keinen Wrestler mit Kürzel. Füge zuerst eine Wrestler-Variable ein und trage dort unter „Kürzel zum Wiederverwenden“ z. B. <b>a</b> ein.</p>
      <div class="toolbar"><button class="btn tonal" data-idb="func" data-id="wrestler">${icon('person')}Wrestler einfügen</button><button class="btn text" data-idb="func" data-id="">Abbrechen</button></div></div>`;
    return `<div class="idb-params">${intro}<div class="idb-fields">
        <label>Wrestler (Kürzel)<select class="field" data-p="alias">${aliases.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}</select></label>
        <label>Angabe<select class="field" data-p="feld">${Object.keys(W_FIELDS).map(f => `<option value="${f}">${f}</option>`).join('')}</select></label></div>
      <div class="toolbar"><button class="btn tonal" data-idb="insertRef">${icon('add')}Einfügen</button><button class="btn text" data-idb="func" data-id="">Abbrechen</button></div></div>`;
  }
  K.views.idb = {
    title: 'IDB-Editor', icon: 'database',
    render(m, st) {
      model = m;
      const d = load(), list = listOf(st), entry = entryOf(st, list);
      if (list) st.idbList = list.id;
      const fn = FUNCS[st.idbFunc];

      const side = `<aside class="note-list">
          <button class="btn tonal" data-idb="newList">${icon('add')}Neue Liste</button>
          <ul>${d.lists.map(l => `<li class="${list && l.id === list.id ? 'active' : ''}" data-idb="openList" data-id="${l.id}">
            <b>${esc(l.name || 'Ohne Namen')}</b><small>${l.entries.length} Einträge</small></li>`).join('') || '<li class="none"><small>Noch keine Listen.</small></li>'}</ul>
          <div class="idb-io">
            <button class="btn" data-idb="export">${icon('download')}Als Datei sichern</button>
            <label class="btn">${icon('upload')}Datei laden<input type="file" id="idb-file" accept=".json,application/json" hidden></label>
          </div>
          <p class="hint">${icon('info')} Änderungen gelten sofort für beide Spieler. „Als Datei sichern“ legt zusätzlich eine Kopie auf diesem Gerät ab.</p>
        </aside>`;

      if (!list) return `<div class="notes-layout">${side}<section class="card"><div class="card-b"><p class="empty">Lege eine Liste an (z. B. „Tonalität“ oder „Themen Lucky7“).</p></div></section></div>`;

      const q = (st.idbQuery || '').toLowerCase();
      const rows = list.entries.filter(e => !q || e.text.toLowerCase().includes(q));

      const params = fn ? `<div class="idb-params"><b>${icon(fn.icon)}${esc(fn.label)}</b><small>${esc(fn.hint)}</small><div class="idb-fields">${fn.params(m).map(([k, label, opts]) =>
          `<label>${esc(label)}${opts ? `<select class="field" data-p="${k}">${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o || 'egal']; return `<option value="${esc(v)}">${esc(l)}</option>`; }).join('')}</select>` : `<input class="field" data-p="${k}">`}</label>`).join('')}</div>
          <div class="toolbar"><button class="btn tonal" data-idb="insert">${icon('add')}Einfügen</button><button class="btn text" data-idb="func" data-id="">Abbrechen</button></div></div>` : st.idbFunc === 'ref' ? refParams(entry) : '';

      const editor = entry ? `<section class="card idb-editor"><header class="card-h"><h3>${icon('edit')}Eintrag bearbeiten</h3>
            <div><button class="btn icon" data-idb="delEntry" title="Eintrag löschen">${icon('delete')}</button></div></header>
          <div class="card-b">
            <div class="idb-funcs"><small>Variable einfügen:</small>${Object.entries(FUNCS).map(([k, f]) => `<button class="chip ${st.idbFunc === k ? 'accent' : 'outline'}" data-idb="func" data-id="${k}" title="${esc(f.hint)}">${icon(f.icon)}${esc(f.label)}</button>`).join('')}
              <button class="chip ${st.idbFunc === 'ref' ? 'accent' : 'outline'}" data-idb="func" data-id="ref" title="Weitere Angabe zu einem Wrestler, der in diesem Eintrag schon gezogen wurde">${icon('link')}Gleicher Wrestler</button></div>
            ${params}
            <textarea id="idb-text" class="idb-text" spellcheck="true" placeholder="Text des Eintrags. Variablen stehen in geschweiften Klammern.">${esc(entry.text)}</textarea>
            <div class="idb-preview"><div><small>${previewWho(m)}</small><button class="btn text" data-idb="reroll">${icon('casino')}Neu würfeln</button></div><p id="idb-preview">${previewHtml(entry.text, m)}</p></div>
          </div></section>` : '';

      return `<div class="notes-layout">${side}<div>
          <section class="card"><div class="note-head"><input id="idb-list-name" class="note-title" placeholder="Name der Liste" value="${esc(list.name)}">
            <button class="btn tonal" data-idb="newEntry">${icon('add')}Neuer Eintrag</button><button class="btn icon" data-idb="delList" title="Liste löschen">${icon('delete')}</button></div></section>
          ${editor}
          <section class="card"><div class="card-b">
            <div class="toolbar wrap"><input id="idb-query" class="field grow" type="search" placeholder="In dieser Liste suchen …" value="${esc(st.idbQuery || '')}">
              <span class="count">${rows.length} von ${list.entries.length}</span></div>
            <ul class="idb-entries">${rows.map(e => `<li class="${entry && e.id === entry.id ? 'active' : ''}" data-idb="openEntry" data-id="${e.id}"><span>${esc(e.text) || '<i>Leer</i>'}</span>
              ${varCount(e.text) ? `<span class="chip accent">${varCount(e.text)} Var.</span>` : ''}
              <button class="btn icon idb-quick-del" data-idb="quickDel" data-id="${e.id}" title="Eintrag löschen">${icon('delete')}</button></li>`).join('') || '<li class="none">Keine Einträge.</li>'}</ul>
          </div></section></div></div>`;
    },
  };
  // Nur im Admin-Modus erreichbar
  K.views.idb.adminOnly = true;
  const group = K.NAV.find(g => g[0] === 'Admin');
  if (group) group[1].unshift('idb'); else K.NAV.push(['Admin', ['idb']]);

  /* ───────────── Verwendungen (Listen-Zuordnung) ─────────────
     Die App zieht nicht aus festen Listennamen, sondern aus Verwendungen („Slots“), z. B. contract.demands.
     Welche Listen eine Verwendung speisen, wird im Admin-Modus im Knotendiagramm festgelegt (db.links). */
  K.IDB_SLOTS = [
    { id: 'contract.demands', area: 'Vertrag', label: 'Forderungen', hint: 'Angebot 1 · je nach Einstufung 0–2 Einträge', active: true, guess: /^vertrag:\s*forderung/i },
    { id: 'contract.concessions', area: 'Vertrag', label: 'Zugeständnisse', hint: 'Angebot 2 · ein Eintrag', active: true, guess: /^vertrag:\s*zugest/i },
    { id: 'staff.advantage', area: 'Mitarbeiter', label: 'Vorteile', hint: 'Was ein normaler Mitarbeiter produziert (bisher FS!F)', active: true, guess: /^mitarbeiter:\s*vorteile$/i },
    { id: 'staff.advantageRare', area: 'Mitarbeiter', label: 'Vorteile (selten)', hint: 'Was ein seltener Mitarbeiter produziert (bisher FS!G)', active: true, guess: /^mitarbeiter:\s*vorteile\s*\(selten\)/i },
    { id: 'staff.firstName', area: 'Mitarbeiter', label: 'Vornamen', hint: 'Für den Namen neuer Bewerber (bisher IDB!L12)', active: true, guess: /^mitarbeiter:\s*vornamen/i },
    { id: 'staff.lastName', area: 'Mitarbeiter', label: 'Nachnamen', hint: 'Für den Namen neuer Bewerber (bisher IDB!L13)', active: true, guess: /^mitarbeiter:\s*nachnamen/i },
    { id: 'injury.reason', area: 'Verletzungen', label: 'Grund der Verletzung', hint: 'Ein Eintrag, wenn sich ein Wrestler verletzt (Interaktionen oder „Verletzung eintragen“)', active: true, guess: /^verletzung/i },
    // Postfach: allgemeine Zutaten. Wer was anspricht, legen die Kombinationen fest (siehe COMBO unten).
    { id: 'interaction.tone', area: 'Postfach', label: 'Tonalität', hint: 'Wie Mails und Termine klingen', active: true, guess: /tonal/i },
    { id: 'inbox.meet.place', area: 'Postfach', label: 'Termin · Orte', active: true, guess: /^termin:\s*orte/i },
  ];
  function links() {
    const d = load();
    // Zuordnung anhand der Listennamen vorschlagen – für jede Verwendung, die noch nie zugeordnet war
    // (auch für neu hinzugekommene Verwendungen). Bewusst gelöste Verbindungen bleiben gelöst.
    // Ältere Stände ohne „guessed“: Die Verwendungen von damals hatten ihren Vorschlag schon.
    if (!d.guessed) d.guessed = d.links ? K.IDB_SLOTS.map(s => s.id) : [];
    d.links = d.links || {};
    let changed = false;
    K.IDB_SLOTS.forEach(s => {
      if (d.guessed.includes(s.id)) return;
      if (!d.links[s.id] || !d.links[s.id].length) {
        const hit = d.lists.filter(l => typeof s.guess === 'function' ? s.guess(l.name) : s.guess.test(l.name));
        if (hit.length) d.links[s.id] = hit.map(l => l.id);
      }
      d.guessed.push(s.id); changed = true;
    });
    if (changed) save();
    return d.links;
  }
  /* ───────────── Kombinationen fürs Postfach ─────────────
     Eine Kombination verbindet zwei Seiten: Mail = Absender × Thema, Termin = Personen × Anlass, News = Quellen × Schlagzeilen.
     Gewürfelt wird erst eine Kombination (nach Gewicht), dann je ein Eintrag aus ihren Listen. So bestimmt ihr,
     welche Gruppe von Personen was ansprechen kann. Gespeichert in db.combos, die Listen hängen an den Verwendungen
     „inbox.combo.<id>.a“ und „…b“ (wie alle anderen Verwendungen in db.links). */
  K.COMBO = { mail: ['Mail', 'Absender', 'Themen'], meet: ['Termin', 'Personen', 'Anlass'], news: ['News', 'Quellen', 'Schlagzeilen'] };
  const comboSlots = c => ['a', 'b'].map((side, i) => ({ id: `inbox.combo.${c.id}.${side}`, area: 'Postfach', label: K.COMBO[c.kind][i + 1], combo: c.id, active: true }));
  /** Alle Verwendungen: feste und die der Kombinationen. */
  K.idbSlots = () => K.IDB_SLOTS.concat(...(load().combos || []).map(comboSlots));
  function ensureCombos() {
    const d = load();
    if (Array.isArray(d.combos)) return;
    // Erste Einrichtung: aus den bisherigen Postfach-Verwendungen bzw. Startlisten
    const byName = n => (d.lists.find(l => l.name === n) || {}).id;
    const old = d.links || {};
    const from = (slot, name) => (old[slot] && old[slot].length ? old[slot].slice() : byName(name) ? [byName(name)] : []);
    const defs = [
      ['mail', 'KHW-Wrestler', 50, from('inbox.mail.sender.khw', 'Mail: Absender · KHW'), from('inbox.mail.topic', 'Mail: Themen')],
      ['mail', 'Fremde Wrestler', 15, from('inbox.mail.sender.foreign', 'Mail: Absender · Fremde'), from('inbox.mail.topic', 'Mail: Themen')],
      ['mail', 'Sonstige', 35, from('inbox.mail.sender.other', 'Mail: Absender · Sonstige'), from('inbox.mail.topic', 'Mail: Themen')],
      ['meet', 'Termine', 1, from('inbox.meet.person', 'Termin: Personen'), from('inbox.meet.reason', 'Termin: Anlass')],
      ['news', 'News', 1, from('inbox.news.source', 'News: Quellen'), from('inbox.news.topic', 'News: Schlagzeilen')],
    ];
    d.links = d.links || {};
    d.combos = defs.map(([kind, name, weight, a, b]) => {
      const c = { id: 'c' + (d.nextId++), kind, name, weight };
      d.links[`inbox.combo.${c.id}.a`] = a; d.links[`inbox.combo.${c.id}.b`] = b;
      return c;
    });
    Object.keys(d.links).filter(k => /^inbox\.(mail\.(sender|topic)|meet\.(person|reason)|news\.)/.test(k)).forEach(k => delete d.links[k]);
    save();
  }
  /** Listen, die nirgends gezogen werden: an keiner Verwendung und von keinem Eintrag per {liste:name=…} genutzt. */
  function unusedLists() {
    const d = load(), l = links(), used = new Set(K.idbSlots().flatMap(s => l[s.id] || []));
    const named = new Set(d.lists.flatMap(x => x.entries.flatMap(e => [...String(e.text).matchAll(/\{liste:name=([^};]+)/g)].map(m => m[1].trim().toLowerCase()))));
    return d.lists.filter(x => !used.has(x.id) && !named.has(String(x.name).toLowerCase()));
  }
  function removeUnused() {
    const d = load(), gone = unusedLists();
    if (!gone.length) return 0;
    d.removed = (d.removed || []).concat(gone.map(x => Object.assign({}, x, { removedAt: Date.now() })));   // zum Wiederherstellen
    d.lists = d.lists.filter(x => !gone.includes(x));
    save();
    return gone.length;
  }

  K.idbApi = {
    reload() { db = null; },
    lists: () => load().lists,
    combos: () => { ensureCombos(); return load().combos; },
    addCombo(kind) { ensureCombos(); const d = load(), n = d.combos.filter(c => c.kind === kind).length + 1; const c = { id: 'c' + (d.nextId++), kind, name: `${K.COMBO[kind][0]} ${n}`, weight: 10 }; d.combos.push(c); save(); return c; },
    updateCombo(id, patch) { const c = (load().combos || []).find(x => x.id === id); if (c) { Object.assign(c, patch); save(); } },
    removeCombo(id) { const d = load(); d.combos = (d.combos || []).filter(x => x.id !== id); ['a', 'b'].forEach(s => delete (d.links || {})[`inbox.combo.${id}.${s}`]); save(); },
    unusedLists, removeUnused,
    removedLists: () => load().removed || [],
    restoreRemoved() { const d = load(), r = d.removed || []; r.forEach(x => { if (!d.lists.some(y => y.name === x.name)) { const c = Object.assign({}, x); delete c.removedAt; d.lists.push(c); } }); d.removed = []; save(); return r.length; },
    /** Liste an eine andere Stelle schieben (vor bzw. hinter eine andere Liste). */
    moveList(id, targetId, after) {
      const l = load().lists, from = l.findIndex(x => x.id === id);
      if (from < 0 || id === targetId) return;
      const [x] = l.splice(from, 1);
      const to = l.findIndex(y => y.id === targetId);
      l.splice(to < 0 ? l.length : to + (after ? 1 : 0), 0, x);
      save();
    },
    links,
    setLink(slot, listId, on) {
      const l = links(); const cur = l[slot] || [];
      l[slot] = on ? [...new Set(cur.concat(listId))] : cur.filter(x => x !== listId);
      save();
    },
  };
  /** Zieht einen Eintrag aus allen Listen, die einer Verwendung zugeordnet sind (wie K.idbDraw). */
  K.idbDrawSlot = (slot, m, o = {}) => {
    const ids = links()[slot] || [];
    const pool = load().lists.filter(l => ids.includes(l.id)).flatMap(l => l.entries).filter(e => e.text.trim() && !(o.exclude || []).includes(e.id));
    while (pool.length) {
      const e = pool.splice(K.rand(pool.length), 1)[0];
      const ctx = makeCtx(o), text = clean(resolve(e.text, m, ctx));
      if (!ctx.skip) return { id: e.id, text };
    }
    return null;
  };

  /* ───────────── Bedienung ───────────── */
  const $ = s => document.querySelector(s);
  let caret = null;   // Schreibmarke im Textfeld, damit Variablen an der richtigen Stelle landen
  const rememberCaret = () => { const t = $('#idb-text'); if (t) caret = [t.selectionStart, t.selectionEnd]; };
  const refreshPreview = () => { const st = K.state, e = entryOf(st, listOf(st)), p = $('#idb-preview'); if (e && p && model) p.innerHTML = previewHtml(e.text, model); };

  function insert(text) {
    const st = K.state, e = entryOf(st, listOf(st)); if (!e) return;
    const [a, b] = caret || [e.text.length, e.text.length];
    e.text = e.text.slice(0, a) + text + e.text.slice(b);
    caret = [a + text.length, a + text.length];
    save(); st.idbFunc = ''; K.render();
    const t = $('#idb-text'); if (t) { t.focus(); t.setSelectionRange(caret[0], caret[1]); }
  }


  document.addEventListener('click', e => {
    const act = e.target.closest('[data-idb]');
    if (!act) return;
    const st = K.state, d = load(), list = listOf(st), entry = entryOf(st, list), what = act.dataset.idb;
    if (what === 'newList') { const l = { id: id(), name: '', entries: [] }; d.lists.push(l); st.idbList = l.id; st.idbEntry = null; }
    else if (what === 'openList') { st.idbList = Number(act.dataset.id); st.idbEntry = null; st.idbQuery = ''; st.idbFunc = ''; }
    else if (what === 'delList') {
      if (!list) return;
      K.dialog.confirm({ title: 'Liste löschen?', text: `„${list.name || 'Ohne Namen'}“ mit ${list.entries.length} Einträgen wird gelöscht.`, icon: 'delete', danger: true, ok: 'Löschen' })
        .then(yes => { if (!yes) return; d.lists.splice(d.lists.indexOf(list), 1); st.idbList = null; st.idbEntry = null; save(); K.render(); });
      return;
    }
    else if (what === 'newEntry') { if (!list) return; const n = { id: id(), text: '', formula: '', todo: false }; list.entries.unshift(n); st.idbEntry = n.id; st.idbQuery = ''; st.idbTodo = false; caret = [0, 0]; }
    else if (what === 'openEntry') { st.idbEntry = Number(act.dataset.id); st.idbFunc = ''; caret = null; }
    else if (what === 'quickDel') {
      // Schnell löschen (beim Überfahren der Zeile) – ohne Rückfrage, dafür mit „Rückgängig“
      if (!list) return;
      const idx = list.entries.findIndex(x => x.id === Number(act.dataset.id));
      if (idx < 0) return;
      const [gone] = list.entries.splice(idx, 1);
      if (st.idbEntry === gone.id) st.idbEntry = null;
      save(); K.render();
      K.toast(`Eintrag gelöscht: ${gone.text.slice(0, 50) || 'Leer'}`, { action: 'Rückgängig', onAction: () => { list.entries.splice(idx, 0, gone); save(); K.render(); } });
      return;
    }
    else if (what === 'delEntry') {
      if (!entry) return;
      K.dialog.confirm({ title: 'Eintrag löschen?', text: entry.text.slice(0, 160) || 'Leerer Eintrag', icon: 'delete', danger: true, ok: 'Löschen' })
        .then(yes => { if (!yes) return; list.entries.splice(list.entries.indexOf(entry), 1); st.idbEntry = null; save(); K.render(); });
      return;
    }
    else if (what === 'func') { st.idbFunc = act.dataset.id; }
    else if (what === 'reroll') { refreshPreview(); return; }
    else if (what === 'insertRef') {
      const a = $('.idb-params [data-p="alias"]'), f = $('.idb-params [data-p="feld"]');
      if (a && f) insert(`{${a.value}.${f.value}}`);
      return;
    }
    else if (what === 'insert') {
      const parts = []; let alias = '';
      document.querySelectorAll('.idb-params [data-p]').forEach(el => {
        const v = el.value.trim(); if (!v) return;
        if (el.dataset.p === 'als') alias = v.replace(/\W/g, ''); else if (!(el.dataset.p === 'feld' && v === 'name')) parts.push(el.dataset.p + '=' + v);
      });
      insert(`{${alias ? alias + '=' : ''}${st.idbFunc}${parts.length ? ':' + parts.join(';') : ''}}`);
      return;
    }
    else if (what === 'export') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
      a.download = 'khw-idb.json'; a.click(); URL.revokeObjectURL(a.href); return;
    }
    save(); K.render();
    if (what === 'newEntry') { const t = $('#idb-text'); if (t) t.focus(); }
    if (what === 'newList') { const t = $('#idb-list-name'); if (t) t.focus(); }
  });

  document.addEventListener('input', e => {
    const st = K.state; if (!st) return;
    const t = e.target, list = listOf(st);
    if (t.id === 'idb-text') {
      const en = entryOf(st, list); if (!en) return;
      en.text = t.value; save(); rememberCaret(); refreshPreview();
      const li = $('.idb-entries li.active span'); if (li) li.textContent = t.value || 'Leer';
    } else if (t.id === 'idb-list-name' && list) {
      list.name = t.value; save();
      const b = $('.note-list li.active b'); if (b) b.textContent = t.value || 'Ohne Namen';
    } else if (t.id === 'idb-query') {
      st.idbQuery = t.value; K.render();
      const q = $('#idb-query'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }
  });
  ['keyup', 'mouseup', 'focusout'].forEach(ev => document.addEventListener(ev, e => { if (e.target.id === 'idb-text') rememberCaret(); }));

  document.addEventListener('change', e => {
    const st = K.state;
    if (e.target.id === 'idb-file' && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        let data;
        try {
          data = JSON.parse(reader.result);
          if (!Array.isArray(data.lists)) throw new Error('Die Datei enthält keine IDB-Listen.');
        } catch (err) { K.dialog.alert({ title: 'Datei konnte nicht gelesen werden', icon: 'error', text: err.message }); return; }
        // Zuordnung und Kombinationen mitnehmen, wenn die Datei sie enthält; die einmalige Bereinigung nicht erneut laufen lassen
        const apply = () => { db = Object.assign({ links: data.links || {}, guessed: data.guessed || [] }, data.combos ? { combos: data.combos } : {}, { nextId: data.nextId || 1e6, lists: data.lists, seeded: data.seeded || [], removed: data.removed || [], cleanup1: true }); save(); st.idbList = null; st.idbEntry = null; K.render(); };
        if (!load().lists.length) { apply(); return; }
        K.dialog.confirm({ title: 'Listen ersetzen?', text: 'Die geladene Datei ersetzt alle vorhandenen Listen.', icon: 'upload', danger: true, ok: 'Ersetzen' })
          .then(yes => { if (yes) apply(); });
      };
      reader.readAsText(e.target.files[0]);
    }
  });
})(window.KHW);
