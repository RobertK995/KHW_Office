// KHW Manager – Rivalen Aktionen.
// Reine Ansicht mit Suche und Filtern. Die Daten stehen fest in rivalen-daten.js (K.RIVALS) und werden dort bei Änderungen angepasst.
// Es wird nichts gespeichert und nichts über Supabase abgeglichen. Die Filter gelten je Tab (K.state.rv).
// Aufbau: EINE Tabelle für alle Kategorien. Die Kategorien sind Zwischenüberschriften, dadurch haben alle Zeilen dieselben Spalten.
// Suche und Filter blenden Zeilen nur ein und aus, die Seite wird dabei nicht neu aufgebaut (das Suchfeld behält den Fokus).
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc } = K;
  const { card, chip, empty } = K.ui;
  const icon = n => `<span class="ms">${n}</span>`;

  // Symbol je Kategorie (Material Symbols); unbekannte Kategorien bekommen ein Standardsymbol
  const ICONS = {
    'Überfall': 'bolt', 'Ablenkung': 'notifications_active', 'Angriff': 'sports_mma', 'Brawl': 'sports_kabaddi', 'Fallout': 'warning',
    'Promo': 'mic', 'Respecktlosigkeit': 'thumb_down', 'Reversal': 'swap_horiz', 'Showdown': 'visibility', 'Sportsgeist': 'handshake',
    'Teamwork': 'groups', 'Unfaire Attacke': 'report', 'Verrat': 'heart_broken', 'Cash-In': 'work',
  };

  // Zeilen der Tabelle in Objekte umwandeln. „(Champion)“ hinter der Kategorie wird zum Merkmal, die Aktion steht dann in der Hauptkategorie.
  const CHAMP = /\s*\(Champion\)\s*$/i;
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');   // „Überfall“ findet man auch mit „uberfall“
  const ITEMS = (K.RIVALS || []).map((r, i) => {
    const it = { i, cat: String(r[0]).replace(CHAMP, '').trim(), champ: CHAMP.test(r[0]), name: r[1] || '', who: r[2] || '', text: r[3] || '', note: r[4] || '', tag: !!r[5], single: !!r[6], extra: String(r[7] || '').trim() };
    it.hay = norm([it.cat, it.champ ? 'champion' : '', it.name, it.who, it.text, it.note, it.extra, it.tag ? 'tag' : '', it.single ? 'single' : ''].join(' '));
    return it;
  });
  const CATS = [...new Set(ITEMS.map(x => x.cat))];                                                        // Reihenfolge wie in der Tabelle
  const WHOS = [...new Set(ITEMS.map(x => x.who).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));

  const fresh = () => ({ q: '', cat: '', who: '', mode: '' });
  const active = f => !!(f.q.trim() || f.cat || f.who || f.mode);
  /** Trifft eine Aktion die Suche und die Filter? Mehrere Suchwörter müssen alle vorkommen. */
  const match = (it, f) => (!f.cat || it.cat === f.cat) && (!f.who || it.who === f.who)
    && (f.mode !== 'single' || it.single) && (f.mode !== 'tag' || it.tag)
    && norm(f.q).split(/\s+/).filter(Boolean).every(w => it.hay.includes(w));

  const dash = '<span class="muted">–</span>';
  const row = (it, show) => `<tr data-i="${it.i}" ${show ? '' : 'hidden'}>
    <td class="rv-name"><b>${esc(it.name)}</b>${it.champ ? chip('Champion', 'accent') : ''}</td>
    <td class="rv-who">${it.who ? `<span class="chip outline" title="${esc(it.who)}">${esc(it.who)}</span>` : ''}</td>
    <td class="rv-text">${it.text ? esc(it.text) : dash}</td>
    <td class="rv-note">${it.note ? esc(it.note) : (it.extra ? '' : dash)}${it.extra ? ` <span class="chip outline" title="Zusatzangabe aus der Tabelle">${esc(it.extra)}</span>` : ''}</td>
    <td class="rv-use">${it.single ? chip('Single', 'outline') : ''}${it.tag ? chip('Tag', 'outline') : ''}</td></tr>`;

  K.views.rivals = {
    title: 'Rivalen Aktionen', icon: 'sports_kabaddi',
    render(m, st) {
      if (!ITEMS.length) return card('Rivalen Aktionen', empty('Keine Daten geladen. Die Datei rivalen-daten.js fehlt oder ist leer.'), { icon: 'sports_kabaddi' });
      const f = st.rv || (st.rv = fresh());
      const sel = (k, label, opts) => `<select class="field" data-rv="${k}"><option value="">${label}</option>${opts.map(o => `<option value="${esc(o[0])}" ${f[k] === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
      let total = 0;
      const groups = CATS.map(c => {
        const rows = ITEMS.filter(x => x.cat === c), shown = rows.filter(x => match(x, f));
        total += shown.length;
        return `<tbody class="rv-group" data-cat="${esc(c)}" ${shown.length ? '' : 'hidden'}>
          <tr class="rv-cat"><th colspan="5"><div class="rv-cat-in"><span class="rv-cat-t">${icon(ICONS[c] || 'bolt')}${esc(c)}</span><small class="rv-count">${shown.length} von ${rows.length}</small></div></th></tr>
          ${rows.map(x => row(x, shown.includes(x))).join('')}</tbody>`;
      }).join('');
      return `<div id="rv-root">
        <div class="toolbar wrap">
          <input class="field grow" id="rv-q" type="search" placeholder="Suchen: Name, Inhalt, Besonderheit …" value="${esc(f.q)}" autocomplete="off">
          ${sel('cat', 'Alle Kategorien', CATS.map(c => [c, c]))}
          ${sel('who', 'Wer ist dabei?', WHOS.map(w => [w, w]))}
          ${sel('mode', 'Single und Tag', [['single', 'Nur Single'], ['tag', 'Nur Tag']])}
          <span class="count" id="rv-total">${total} von ${ITEMS.length}</span>
          <button class="btn text" data-rv-reset style="${active(f) ? '' : 'display:none'}">${icon('filter_alt_off')}Zurücksetzen</button></div>
        <p class="hint">Reine Ansicht. Die Suche findet Wörter in allen Spalten, mehrere Wörter müssen alle vorkommen. „Single“ und „Tag“ zeigen, wo die Aktion einsetzbar ist.</p>
        <div class="rv-list"><table class="table rv-table">
          <colgroup><col class="c-name"><col class="c-who"><col class="c-text"><col class="c-note"><col class="c-use"></colgroup>
          <thead><tr><th>Aktion</th><th>Wer ist dabei?</th><th>Inhalt</th><th>Besonderheit</th><th>Einsatz</th></tr></thead>
          ${groups}</table>
          <p class="empty rv-none" id="rv-none" ${total ? 'hidden' : ''}>Keine Aktion passt zu dieser Suche.</p></div></div>`;
    },
  };

  // Menü: direkt hinter „Notizen“ in der Gruppe „Ablage“. main.js liest K.NAV bei jedem Aufbau der Seitenleiste neu.
  // Damit der Eintrag nicht verloren geht, wenn eine andere Datei K.NAV später umbaut oder ersetzt, trägt sich die Seite
  // bei jedem Lesen von K.NAV selbst wieder ein, falls sie fehlt (K.NAV verhält sich sonst wie bisher).
  const sorge = nav => {
    if (!Array.isArray(nav) || nav.some(g => Array.isArray(g[1]) && g[1].includes('rivals'))) return nav;
    const grp = nav.find(g => g[0] === 'Ablage' && Array.isArray(g[1]));
    if (grp) { const at = grp[1].indexOf('notes'); grp[1].splice(at < 0 ? grp[1].length : at + 1, 0, 'rivals'); }
    else nav.push(['Ablage', ['rivals']]);
    return nav;
  };
  let navList = sorge(K.NAV);
  Object.defineProperty(K, 'NAV', { configurable: true, enumerable: true, get: () => sorge(navList), set: v => { navList = v; } });

  /* ───────────── Bedienung ───────────── */
  /** Zeilen nach den aktuellen Filtern ein- und ausblenden, Zähler und leere Kategorien nachziehen. */
  function apply() {
    const root = document.getElementById('rv-root'), f = K.state && K.state.rv;
    if (!root || !f) return;
    let total = 0;
    root.querySelectorAll('.rv-group').forEach(g => {
      const trs = g.querySelectorAll('tr[data-i]');
      let n = 0;
      trs.forEach(tr => { const ok = match(ITEMS[Number(tr.dataset.i)], f); tr.hidden = !ok; if (ok) n++; });
      g.hidden = !n;
      const c = g.querySelector('.rv-count'); if (c) c.textContent = `${n} von ${trs.length}`;
      total += n;
    });
    const t = document.getElementById('rv-total'); if (t) t.textContent = `${total} von ${ITEMS.length}`;
    const none = document.getElementById('rv-none'); if (none) none.hidden = total > 0;
    const reset = root.querySelector('[data-rv-reset]'); if (reset) reset.style.display = active(f) ? '' : 'none';
  }

  document.addEventListener('input', e => {
    if (e.target.id !== 'rv-q' || !K.state) return;
    (K.state.rv || (K.state.rv = fresh())).q = e.target.value;
    apply();
  });
  document.addEventListener('change', e => {
    const k = e.target.dataset && e.target.dataset.rv;
    if (!k || !K.state) return;
    (K.state.rv || (K.state.rv = fresh()))[k] = e.target.value;
    apply();
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-rv-reset]') || !K.state) return;
    K.state.rv = fresh();
    K.render();
  });
})(window.KHW);
