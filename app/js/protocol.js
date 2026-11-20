// KHW Manager – Änderungsprotokoll (nur Admin-Modus, nur mit Supabase).
// Liest khw_protokoll (wird in Supabase per Trigger befüllt, siehe supabase/protokoll.sql): wann, wer, was.
// Schnelle Folgen derselben Änderung (z. B. Tippen in einer Notiz) werden zu einem Eintrag zusammengefasst.
// „Rückgängig“ setzt den Eintrag auf den Stand vor der (ersten zusammengefassten) Änderung – für beide Geräte.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc } = K;
  const icon = n => `<span class="ms">${n}</span>`;
  let cache = null, loading = false, error = '';

  /* ───────────── Beschreibung eines Eintrags ───────────── */
  const GAME = { currentShow: 'aktuelle Show', stars: 'Sterne', followers: 'Follower', skillPoints: 'Skillpunkte', carry: 'Kontostand (ältere Buchungen)', lastResult: 'letztes Show-Ergebnis', lastStars: 'Sterne der letzten Show', lastFollowerDelta: 'Follower der letzten Show' };
  const AREA = { offers: 'Vertragsangebot', contracts: 'Abgeschlossene Verträge', bookings: 'Kontobewegungen', wrestlers: 'Wrestler', shows: 'Show', extras: 'PPVs und Events', game: 'Spielstand',
    titles: 'Titel', series: 'Showreihe', added: 'Neue Wrestler', staff: 'Mitarbeiter', storage: 'Lager', groups: 'Teams und Stables', stories: 'Storylines', renames: 'Umbenennung',
    inbox: 'Postfach', memory: 'KI-Gedächtnis', notes: 'Notiz', drafts: 'Entwurf' };
  const val = d => (d && typeof d === 'object' && 'o' in d && 'v' in d ? d.v : d && d.t === 'val' ? d.v : d);
  function describe(r) {
    const k = r.schluessel, i = k.search(/[/#]/), top = i < 0 ? k : k.slice(0, i), sub = i < 0 ? '' : k.slice(i + 1);
    const d = val(r.neu) || val(r.alt) || {};
    if (r.tabelle === 'khw_regelwerk') return ['rule', `Regelwerk: ${top}${sub ? ' · ' + sub : ''}`];
    if (r.tabelle === 'khw_idb') {
      if (top === 'lists') return ['database', `IDB-Liste: ${d.name || sub}`];
      if (top === 'links') return ['account_tree', `Listen-Zuordnung: ${sub}`];
      if (top === 'combos') return ['account_tree', `Postfach-Kombination: ${d.name || sub}`];
      return ['database', `IDB: ${k}`];
    }
    if (top === 'shows') { const s = K.model && K.model.show(/^\d+$/.test(sub) ? Number(sub) : sub); return ['stadium', `Show: ${s ? K.ui.showTitle(s) : sub}`]; }
    if (top === 'game') return ['sports_score', `Spielstand: ${GAME[sub] || sub}`];
    if (top === 'inbox') return ['mail', `Postfach: ${d.title || sub}`];
    if (top === 'notes') return ['edit_note', `Notiz: ${d.title || 'Ohne Titel'}`];
    if (top === 'stories') return ['auto_stories', `Storyline: ${d.title || sub}`];
    if (top === 'staff') return ['engineering', `Mitarbeiter: ${/^\d+$/.test(sub) ? 'Platz ' + sub : sub === 'inv' ? 'Lager der Vorteile' : sub === 'forge' ? 'Schmiede' : sub}`];
    return ['history', `${AREA[top] || top}${sub ? ': ' + sub : ''}`];
  }
  // Vergleich unabhängig von der Reihenfolge der Schlüssel (Postgres sortiert jsonb um)
  const canon = v => (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v === undefined ? null : v));
  // Regelwerk: Standardwert eines Feldes (Bereich/Feld)
  const ruleDefault = key => { const [sec, field] = key.split('/'); const d = K.conf.defaults(sec); return field && d && typeof d === 'object' ? d[field] : undefined; };
  // Nicht gezeigt: Gliederungszeilen ({ t: 'dict' } / { t: 'list' }) und im Regelwerk die Standardwerte, die beim ersten
  // Ändern eines Bereichs mitkopiert werden (nur das tatsächlich geänderte Feld ist interessant)
  const technical = r => [r.alt, r.neu].every(x => x === null || x === undefined || (x && typeof x === 'object' && (x.t === 'dict' || x.t === 'list') && !('v' in x)))
    || (r.tabelle === 'khw_regelwerk' && r.aktion === 'neu' && canon(r.neu) === canon(ruleDefault(r.schluessel)));
  /** Inhalt vor der Änderung; ein im Regelwerk neu angelegtes Feld war vorher der Standardwert. */
  const before = g => (g.firstAktion !== 'neu' ? g.alt : g.tabelle === 'khw_regelwerk' && ruleDefault(g.schluessel) !== undefined ? ruleDefault(g.schluessel) : null);

  /** Aufeinanderfolgende Änderungen am selben Eintrag durch dieselbe Person (≤ 3 Min.) zusammenfassen. */
  function group(rows) {
    const out = [];
    rows.filter(r => !technical(r)).forEach(r => {   // neueste zuerst
      const last = out[out.length - 1], t = new Date(r.zeit).getTime();
      if (last && last.tabelle === r.tabelle && last.schluessel === r.schluessel && last.nutzer === r.nutzer && last.oldest - t <= 180000) {
        last.count++; last.oldest = t; last.alt = r.alt; last.firstAktion = r.aktion; return;
      }
      out.push(Object.assign({}, r, { count: 1, newest: t, oldest: t, firstAktion: r.aktion }));
    });
    return out;
  }

  /** Was sich geändert hat (oberste Ebene, gekürzt). */
  function diff(a, b) {
    const short = v => { const s = v === undefined ? '–' : JSON.stringify(v); return s.length > 90 ? s.slice(0, 88) + '…' : s; };
    a = val(a); b = val(b);
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return [['Inhalt', short(a), short(b)]];
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => canon(a[k]) !== canon(b[k])).slice(0, 12).map(k => [k, short(a[k]), short(b[k])]);
  }

  const when = t => {
    const d = new Date(t), now = new Date(), same = d.toDateString() === now.toDateString();
    return (same ? 'heute' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  async function load() {
    if (loading) return;
    loading = true; error = '';
    try { cache = await K.cloud.protocol(400); } catch (e) { error = /khw_protokoll|relation|schema cache/i.test(e.message || '') ? 'Die Tabelle khw_protokoll fehlt noch: supabase/protokoll.sql im SQL Editor ausführen.' : (e.message || String(e)); }
    loading = false;
    if (K.state && K.state.view === 'protocol') K.render();
  }

  K.views.protocol = {
    title: 'Protokoll', icon: 'history', adminOnly: true,
    render(m, st) {
      if (!(K.cloud && K.cloud.on)) return `<p class="empty">Das Protokoll gibt es nur mit Supabase.</p>`;
      if (!cache && !error) { load(); return `<p class="empty">Protokoll wird geladen …</p>`; }
      if (error) return `<div class="notice">${icon('error')}<div><b>Protokoll nicht verfügbar</b><span>${esc(error)}</span></div></div><button class="btn tonal" data-prot="reload">${icon('refresh')}Erneut laden</button>`;
      const who = st.protWho || '', q = (st.protQ || '').toLowerCase();
      const users = [...new Set(cache.map(r => r.nutzer).filter(Boolean))];
      const list = group(cache).map(g => Object.assign(g, { desc: describe(g) }))
        .filter(g => (!who || g.nutzer === who) && (!q || g.desc[1].toLowerCase().includes(q)));
      const live = K.cloud.ready;
      const rows = list.slice(0, 200).map((g, i) => {
        // Regelwerk-Feld zum ersten Mal geändert: vorher galt der Standard → „geändert“ (mit Vergleich)
        const ruleNew = g.firstAktion === 'neu' && before(g) !== null;
        if (ruleNew) g.alt = before(g);
        const open = st.protOpen === g.id, act = g.firstAktion === 'neu' && !ruleNew ? 'neu' : g.aktion === 'gelöscht' ? 'gelöscht' : 'geändert';
        return `<li class="prot ${open ? 'open' : ''}">
          <div class="prot-row" data-set="protOpen" data-value="${open ? '' : g.id}">
            <span class="prot-time">${when(g.newest)}</span>
            <span class="prot-who">${esc(K.cloud.nameOf(g.nutzer))}${g.geraet === 'rueckgaengig' ? ' <small>(rückgängig)</small>' : ''}</span>
            <span class="prot-what">${icon(g.desc[0])}${esc(g.desc[1])}${g.count > 1 ? ` <small>· ${g.count}×</small>` : ''}</span>
            <span class="chip outline prot-${act === 'gelöscht' ? 'del' : act === 'neu' ? 'new' : 'mod'}">${act}</span>
          </div>
          ${open ? `<div class="prot-detail">
            ${act === 'geändert' ? `<table class="table slim"><thead><tr><th>Feld</th><th>vorher</th><th>nachher</th></tr></thead><tbody>${diff(g.alt, g.neu).map(([k, a, b]) => `<tr><td>${esc(k)}</td><td><code>${esc(a)}</code></td><td><code>${esc(b)}</code></td></tr>`).join('')}</tbody></table>`
              : `<code class="prot-json">${esc(JSON.stringify(val(act === 'neu' ? g.neu : g.alt)).slice(0, 400))}</code>`}
            <div class="actions"><button class="btn tonal sm" data-prot="undo" data-i="${i}" ${live ? '' : 'disabled title="Nur verbunden möglich"'}>${icon('undo')}Rückgängig${g.count > 1 ? ` (alle ${g.count})` : ''}</button>
              <small class="muted">${act === 'neu' ? 'Löscht den Eintrag wieder.' : act === 'gelöscht' ? 'Stellt den Eintrag wieder her.' : 'Setzt ihn auf den Stand davor.'} Gilt für beide Geräte.</small></div>
          </div>` : ''}</li>`;
      }).join('');
      st.protList = list;
      return `<div class="toolbar wrap">
          <input class="field grow" id="prot-q" type="search" placeholder="Suchen: Show, Wrestler, Notiz …" value="${esc(st.protQ || '')}" data-protq>
          <select class="field" data-set-select="protWho">${[['', 'Alle Spieler'], ...users.map(u => [u, K.cloud.nameOf(u)])].map(([v, l]) => `<option value="${esc(v)}" ${v === who ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
          <span class="count">${list.length} Änderungen</span>
          <button class="btn tonal" data-prot="reload">${icon('refresh')}Aktualisieren</button></div>
        <p class="hint">${icon('info')} Alle Änderungen der letzten 30 Tage, neueste zuerst. Schnelle Folgen am selben Eintrag (z. B. Tippen) sind zusammengefasst. Klick auf eine Zeile zeigt die Einzelheiten.</p>
        <ol class="prot-list">${rows || '<li class="empty">Keine Änderungen.</li>'}</ol>`;
    },
  };
  const grp = K.NAV.find(g => g[0] === 'Admin');
  if (grp) grp[1].push('protocol'); else K.NAV.push(['Admin', ['protocol']]);

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prot]');
    if (!b || b.disabled) return;
    if (b.dataset.prot === 'reload') { cache = null; error = ''; K.render(); return; }
    if (b.dataset.prot === 'undo') {
      const g = (K.state.protList || [])[Number(b.dataset.i)]; if (!g) return;
      const what = describe(g)[1];
      K.dialog.confirm({ title: 'Änderung rückgängig machen?', icon: 'undo', ok: 'Rückgängig', text: `${what}\n${before(g) === null ? 'Der Eintrag wird wieder gelöscht.' : 'Der Eintrag bekommt den Stand von vor dieser Änderung.'}\n\nGilt sofort für beide Geräte.` })
        .then(yes => {
          if (!yes) return;
          K.cloud.restore(g.tabelle, g.schluessel, before(g))
            .then(() => { K.toast('Rückgängig gemacht: ' + what); cache = null; K.render(); })
            .catch(err => K.dialog.alert({ title: 'Nicht möglich', icon: 'error', text: err.message }));
        });
    }
  });
  document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.setSelect; if (k === 'protWho') { K.state.protWho = e.target.value; K.render(); } });
  document.addEventListener('input', e => {
    if (!e.target.dataset || e.target.dataset.protq === undefined) return;
    K.state.protQ = e.target.value; K.render();
    const q = document.getElementById('prot-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  });
})(window.KHW);
