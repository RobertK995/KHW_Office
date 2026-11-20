// KHW Manager – Teams und Stables: anlegen, bearbeiten, auflösen.
// Teams: Name + Wrestler (keine Trennung mehr in Mixed und normal; ein Wrestler kann in mehreren Teams sein).
// Stables: Name + Mitglieder, die Wrestler und/oder Teams sein können.
// Die Listen stehen in m.teams / m.stables (model.js: aus der Tabelle oder aus store.groups). Geändert wird immer
// die ganze Liste in store.groups, damit beide Spieler denselben Stand haben.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc } = K;
  const icon = n => `<span class="ms">${n}</span>`;

  const avg = ws => { const e = ws.map(w => (w.elo === null ? 1000 : w.elo)); return e.length ? e.reduce((a, b) => a + b, 0) / e.length : null; };
  /** Wrestler hinter einem Namen (Wrestler selbst oder alle Mitglieder eines Teams). */
  const people = (m, n) => (m.byName.has(n) ? [m.byName.get(n)] : (K.teamMembers(m, n) || []).map(x => m.byName.get(x)).filter(Boolean));
  const titlesOf = (m, name, ws) => m.titles.filter(x => x.holder && (x.holder === name || (ws.length > 1 && x.holder.split(/\s*&\s*/).sort().join('|') === ws.map(w => w.name).sort().join('|')))).map(x => x.name);

  function info(m, g) {
    const ws = [...new Map(g.members.flatMap(n => people(m, n)).map(w => [w.name, w])).values()];
    return {
      ws, shows: [...new Set(ws.map(w => w.show).filter(Boolean))], promotions: [...new Set(ws.map(w => w.promotion).filter(Boolean))],
      elo: avg(ws), active: ws.some(w => w.show), titles: titlesOf(m, g.name, ws),
    };
  }

  /* ───────────── Ansicht ───────────── */
  const memberLine = (m, n, u) => {
    const w = m.byName.get(n);
    if (w) return `<li>${w.image ? `<img src="${esc(w.image)}" alt="" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : '<span class="tm-ph"></span>'}<span>${u.wl(n)}</span>${u.tier(w.status)}</li>`;
    const t = m.teamByName.get(n);
    return `<li class="is-team"><span class="tm-ph">${icon('group')}</span><span><b>${u.wl(n)}</b><small>${t ? t.members.map(esc).join(' & ') : 'Team nicht gefunden'}</small></span><span class="chip outline">Team</span></li>`;
  };

  // Spalten der Liste: [Schlüssel, Titel, Zelle, Sortierwert, Klasse]. Wie in der Datenbank: Klick sortiert
  // (erneuter Klick dreht die Richtung), Ziehen am Spaltenkopf verschiebt die Spalte (wird im Browser gemerkt).
  const TCOLS = [
    // Teamnamen öffnen die Team-Kartei rechts (wie Wrestler-Namen)
    ['name', 'Name', (x, m, u) => `<b>${m.teamByName.get(x.g.name) === x.g ? u.wl(x.g.name) : esc(x.g.name)}</b>`, x => x.g.name],
    ['members', 'Mitglieder', (x, m, u) => x.g.members.map(n => m.byName.has(n) ? u.wl(n) : `<b>${u.wl(n)}</b> <small class="muted">(Team)</small>`).join(', '), x => x.g.members.join(', ')],
    ['show', 'Show', (x, m, u) => x.shows.map(s => u.showChip(s)).join('') || `<span class="muted">${esc(x.promotions.join(', ') || 'ohne Show')}</span>`, x => x.shows.join(', ') || '~' + x.promotions.join(', ')],
    ['titles', 'Titel', (x, m, u) => x.titles.map(t => u.chip(t, 'accent')).join(''), x => x.titles.join(', ')],
    ['count', 'Wrestler', x => String(x.ws.length), x => x.ws.length, 'num'],
    ['elo', 'ELO Ø', x => (x.elo === null ? '–' : K.elo(x.elo)), x => (x.elo === null ? -1 : x.elo), 'num'],
  ];
  const TCOLS_KEY = 'khw.teamCols';
  const colOrder = () => {
    let saved = []; try { saved = JSON.parse(localStorage.getItem(TCOLS_KEY) || '[]'); } catch (e) { /* Standardreihenfolge */ }
    const all = TCOLS.map(c => c[0]), known = saved.filter(k => all.includes(k));
    return known.concat(all.filter(k => !known.includes(k)));
  };
  const saveOrder = o => { try { localStorage.setItem(TCOLS_KEY, JSON.stringify(o)); } catch (e) { /* nur für diese Sitzung */ } };

  K.views.teams = {
    title: 'Teams und Stables', icon: 'groups',
    // Layout „Liste“ (vom Nutzer gewählt), bedienbar wie die Datenbank
    render(m, st) {
      const u = K.ui, tab = st.tgTab === 'stables' ? 'stables' : 'teams';
      const f = st.tf || (st.tf = { q: '', show: 'aktiv' });
      const groups = (tab === 'teams' ? m.teams : m.stables).map(g => Object.assign({ g }, info(m, g)));
      const q = f.q.toLowerCase();
      const list = groups.filter(x => (!f.show || (f.show === 'aktiv' ? x.active : x.shows.includes(f.show))) &&
        (!q || [x.g.name, ...x.g.members, ...x.ws.map(w => w.name)].join(' ').toLowerCase().includes(q)))
        .sort((a, b) => b.active - a.active || a.g.name.localeCompare(b.g.name, 'de'));
      const shows = [...new Set(groups.flatMap(x => x.shows))].sort();
      const word = tab === 'teams' ? 'Team' : 'Stable';
      const bar = `<div class="seg tg-tabs"><button class="${tab === 'teams' ? 'on' : ''}" data-set="tgTab" data-value="teams">${icon('group')}Teams · ${m.teams.length}</button><button class="${tab === 'stables' ? 'on' : ''}" data-set="tgTab" data-value="stables">${icon('diversity_3')}Stables · ${m.stables.length}</button></div>
        <div class="toolbar wrap">
          <input class="field grow" id="tf-q" type="search" placeholder="Suchen: ${word} oder Mitglied …" value="${esc(f.q)}" data-tf="q">
          <select class="field" data-tf="show">${[['aktiv', `Aktive ${tab === 'teams' ? 'Teams' : 'Stables'}`], ...shows.map(s => [s, s]), ['', 'Alle']].map(([v, l]) => `<option value="${esc(v)}" ${f.show === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
          <span class="count">${list.length} von ${groups.length}</span>
          <button class="btn tonal" data-grp="new" data-kind="${tab}">${icon(tab === 'teams' ? 'group_add' : 'add_circle')}${word} anlegen</button></div>`;
      if (!list.length) return bar + u.card('', u.empty(`Keine ${tab === 'teams' ? 'Teams' : 'Stables'} für diese Auswahl.`));
      const acts = x => `<span class="tm-act"><button class="btn icon" data-grp="edit" data-kind="${tab}" data-name="${esc(x.g.name)}" title="Bearbeiten">${icon('edit')}</button><button class="btn icon" data-grp="del" data-kind="${tab}" data-name="${esc(x.g.name)}" title="Auflösen">${icon('delete')}</button></span>`;
      const cols = colOrder().map(k => TCOLS.find(c => c[0] === k));
      const sk = st.tgSort || 'name', dir = st.tgDir || 1, sc = TCOLS.find(c => c[0] === sk) || TCOLS[0];
      list.sort((a, b) => {
        const x = sc[3](a), y = sc[3](b);
        return (typeof x === 'number' ? (x - y) : String(x).localeCompare(String(y), 'de')) * dir || a.g.name.localeCompare(b.g.name, 'de');
      });
      const moved = colOrder().join() !== TCOLS.map(c => c[0]).join();
      return bar + `<p class="hint">Spalten lassen sich am Spaltenkopf an eine andere Stelle ziehen. Ein Klick sortiert, ein zweiter dreht die Richtung.${moved ? ' <a class="btn text" data-tg-reset>Reihenfolge zurücksetzen</a>' : ''}</p>
        <div class="table-wrap"><table class="table db tm-table"><thead><tr>${cols.map(c =>
          `<th class="sort ${c[4] || ''}" data-tsort="${c[0]}" data-tcol="${c[0]}" draggable="true">${c[1]}${sk === c[0] ? icon(dir > 0 ? 'arrow_drop_up' : 'arrow_drop_down') : ''}</th>`).join('')}<th></th></tr></thead>
        <tbody>${list.map(x => `<tr class="${x.active ? '' : 'inactive'}">${cols.map(c => `<td class="${c[4] || ''}">${c[2](x, m, u)}</td>`).join('')}<td class="num">${acts(x)}</td></tr>`).join('')}</tbody></table></div>`;
    },
  };
  const group = K.NAV.find(g => g[0] === 'Kader');
  if (group && !group[1].includes('teams')) group[1].splice(group[1].indexOf('roster') + 1, 0, 'teams');

  /* ───────────── Speichern ───────────── */
  const current = m => ({ teams: m.teams.map(t => ({ name: t.name, members: t.members.slice() })), stables: m.stables.map(s => ({ name: s.name, members: s.members.slice() })) });
  const saveGroups = g => { K.store.update(st => { st.groups = g; }); K.rebuild(); };
  const nextTeamName = g => { let i = 1; while (g.teams.some(t => t.name === 'Team ' + i)) i++; return 'Team ' + i; };

  function save(kind, oldName, v) {
    const m = K.model, g = current(m), listKey = kind === 'teams' ? 'teams' : 'stables';
    const names = [...new Set(K.splitNames(v.members).filter(Boolean))];
    let name = v.name.trim();
    if (kind === 'teams') {
      const unknown = names.filter(n => !m.byName.has(n));
      if (unknown.length) { K.toast(`Kein Wrestler: ${unknown.join(', ')}`); return; }
      if (names.length < 2) { K.toast('Ein Team braucht mindestens zwei Wrestler.'); return; }
      if (!name) name = oldName && /^Team \d+$/.test(oldName) ? oldName : nextTeamName(g);   // ohne Namen: Team 1, Team 2 …
    } else {
      const unknown = names.filter(n => !m.byName.has(n) && !g.teams.some(t => t.name === n));
      if (unknown.length) { K.toast(`Weder Wrestler noch Team: ${unknown.join(', ')}`); return; }
      if (!names.length) { K.toast('Ein Stable braucht mindestens ein Mitglied.'); return; }
      if (!name) { K.toast('Ein Stable braucht einen Namen.'); return; }
    }
    const list = g[listKey];
    if (list.some(x => x.name.toLowerCase() === name.toLowerCase() && x.name !== oldName)) { K.toast(`„${name}“ gibt es schon.`); return; }
    if (kind === 'teams' && m.byName.has(name)) { K.toast(`„${name}“ ist schon der Name eines Wrestlers.`); return; }
    const item = oldName ? list.find(x => x.name === oldName) : null;
    if (item) { item.name = name; item.members = names; } else list.push({ name, members: names });
    // Umbenanntes Team auch in den Stables umbenennen
    if (kind === 'teams' && oldName && oldName !== name) g.stables.forEach(s => { s.members = s.members.map(x => (x === oldName ? name : x)); });
    saveGroups(g);
    K.toast(`${oldName ? 'Gespeichert' : 'Angelegt'}: ${name}`);
  }

  const dialog = (kind, x) => K.dialog.form({
    title: x ? `${x.name} bearbeiten` : kind === 'teams' ? 'Team anlegen' : 'Stable anlegen', icon: kind === 'teams' ? 'group' : 'diversity_3', ok: x ? 'Speichern' : 'Anlegen',
    text: kind === 'teams' ? 'Mitglieder mit Komma trennen. Ein Wrestler kann in mehreren Teams sein. Ohne Namen heißt das Team „Team 1“, „Team 2“ …'
      : 'Mitglieder sind Wrestler und/oder Teams, mit Komma getrennt.',
    fields: [
      { id: 'name', label: kind === 'teams' ? 'Teamname (optional)' : 'Name des Stables', value: x ? x.name : '', placeholder: kind === 'teams' ? 'z. B. The Usos' : 'z. B. The Bloodline' },
      { id: 'members', label: 'Mitglieder', value: x ? x.members.join(', ') : '', suggest: kind === 'teams' ? 'wrestlers' : 'fighters', multi: true, placeholder: 'Name, Name …' },
    ],
  });

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-grp]');
    if (!b || !K.model) return;
    const m = K.model, kind = b.dataset.kind === 'stables' ? 'stables' : 'teams', list = kind === 'teams' ? m.teams : m.stables;
    const x = list.find(y => y.name === b.dataset.name);
    if (b.dataset.grp === 'new') dialog(kind, null).then(v => { if (v) save(kind, null, v); });
    else if (b.dataset.grp === 'edit' && x) dialog(kind, x).then(v => { if (v) save(kind, x.name, v); });
    else if (b.dataset.grp === 'del' && x) {
      const inStables = kind === 'teams' ? m.stables.filter(s => s.members.includes(x.name)).map(s => s.name) : [];
      K.dialog.confirm({ title: `${x.name} auflösen?`, icon: 'delete', danger: true, ok: 'Auflösen',
        text: `Die Mitglieder bleiben in der Datenbank. Gelaufene Matches bleiben unverändert.${inStables.length ? `\nDas Team wird auch aus diesen Stables genommen: ${inStables.join(', ')}.` : ''}` })
        .then(yes => {
          if (!yes) return;
          const g = current(K.model);
          g[kind] = g[kind].filter(y => y.name !== x.name);
          if (kind === 'teams') g.stables.forEach(s => { s.members = s.members.filter(n => n !== x.name); });
          saveGroups(g); K.toast(`${x.name} aufgelöst`);
        });
    }
  });
  // Sortieren per Klick auf den Spaltenkopf (gilt nur für diesen Tab)
  document.addEventListener('click', e => {
    if (e.target.closest('[data-tg-reset]')) { try { localStorage.removeItem(TCOLS_KEY); } catch (err) { /* egal */ } K.render(); return; }
    const th = e.target.closest('th[data-tsort]');
    if (!th) return;
    const k = th.dataset.tsort, st = K.state;
    st.tgDir = (st.tgSort || 'name') === k ? -(st.tgDir || 1) : 1; st.tgSort = k;
    K.render();
  });
  // Spalten per Ziehen am Spaltenkopf verschieben
  let dragCol = null;
  const clearDrop = () => document.querySelectorAll('th[data-tcol].drop-l, th[data-tcol].drop-r').forEach(el => el.classList.remove('drop-l', 'drop-r'));
  const side = (th, e) => { const r = th.getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? 'l' : 'r'; };
  document.addEventListener('dragstart', e => { const th = e.target.closest && e.target.closest('th[data-tcol]'); if (!th) return; dragCol = th.dataset.tcol; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragCol); });
  document.addEventListener('dragover', e => {
    const th = dragCol && e.target.closest && e.target.closest('th[data-tcol]'); if (!th) return;
    e.preventDefault(); clearDrop(); if (th.dataset.tcol !== dragCol) th.classList.add('drop-' + side(th, e));
  });
  document.addEventListener('drop', e => {
    const th = dragCol && e.target.closest && e.target.closest('th[data-tcol]'); if (!th) return;
    e.preventDefault();
    const target = th.dataset.tcol;
    if (target !== dragCol) { const o = colOrder().filter(k => k !== dragCol); o.splice(o.indexOf(target) + (side(th, e) === 'r' ? 1 : 0), 0, dragCol); saveOrder(o); }
    dragCol = null; K.render();
  });
  document.addEventListener('dragend', () => { dragCol = null; clearDrop(); });

  // Filter gelten nur für diesen Tab
  document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.tf; if (k && k !== 'q' && K.state.tf) { K.state.tf[k] = e.target.value; K.render(); } });
  document.addEventListener('input', e => {
    if (!e.target.dataset || e.target.dataset.tf !== 'q' || !K.state.tf) return;
    K.state.tf.q = e.target.value; K.render();
    const q = document.getElementById('tf-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  });
})(window.KHW);
