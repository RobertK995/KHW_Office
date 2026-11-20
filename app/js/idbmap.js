// KHW Manager – Listen-Zuordnung (nur Admin-Modus).
// Knotendiagramm: links die IDB-Listen, rechts die Stellen der App, die daraus ziehen („Verwendungen“, K.IDB_SLOTS).
// Verbinden: am Punkt einer Liste ziehen und auf einer Verwendung loslassen – oder erst die Liste, dann die Verwendung
// anklicken. Lösen: auf das × am Listennamen in der Verwendung klicken. Eine Verwendung darf mehrere Listen haben;
// gezogen wird dann aus allen zusammen.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc } = K;
  const icon = n => `<span class="ms">${n}</span>`;
  const api = () => K.idbApi;

  /** Listen, auf die ein Eintrag per {liste:name=…} verweist (nur zur Anzeige). */
  function refsOf(list, all) {
    const names = new Set();
    list.entries.forEach(e => (e.text.match(/\{liste:name=([^};]+)/g) || []).forEach(x => names.add(x.replace('{liste:name=', '').trim())));
    return [...names].filter(n => all.some(l => l.name === n));
  }

  K.views.idbmap = {
    title: 'Listen-Zuordnung', icon: 'account_tree', adminOnly: true,
    render(m, st) {
      const lists = api().lists(), links = api().links();
      const used = new Set(Object.values(links).flat());
      const sel = st.mapSel;
      const listNodes = lists.map((l, i) => {
        const refs = refsOf(l, lists);
        return `<div class="map-node list ${sel === l.id ? 'sel' : ''} ${used.has(l.id) ? 'linked' : ''}" data-map-list="${l.id}">
          <span class="map-grip" title="Zum Verschieben ziehen">${icon('drag_indicator')}<span>${i + 1}</span></span>
          <div class="map-txt"><b>${esc(l.name || 'Ohne Namen')}</b><small>${l.entries.length} Einträge${refs.length ? ` · nutzt ${refs.map(esc).join(', ')}` : ''}</small></div>
          <span class="port out" data-port-list="${l.id}" title="Ziehen, um zu verbinden"></span></div>`;
      }).join('') || '<p class="empty">Noch keine Listen im IDB.</p>';

      const slotNode = s => {
        const ids = links[s.id] || [];
        const chips = ids.map(id => { const l = lists.find(x => x.id === id); return l ? `<span class="chip map-chip">${esc(l.name)}<button data-map-unlink="${esc(s.id)}" data-list="${id}" title="Verbindung lösen">${icon('close')}</button></span>` : ''; }).join('');
        return `<div class="map-node slot ${s.active ? 'active' : 'inactive'} ${ids.length ? 'linked' : 'open'}" data-map-slot="${esc(s.id)}">
          <span class="port in" data-port-slot="${esc(s.id)}"></span>
          <div><b>${esc(s.label)}</b>${s.hint ? `<small>${esc(s.hint)}</small>` : ''}<div class="map-chips">${chips || '<small class="muted">keine Liste – hier wird nichts gezogen</small>'}</div></div></div>`;
      };
      const areas = [...new Set(K.IDB_SLOTS.map(s => s.area))];
      const slotNodes = areas.map(a => {
        const slots = K.IDB_SLOTS.filter(s => s.area === a);
        const active = slots.some(s => s.active);
        return `<div class="map-area area-${esc(a)}"><h5>${esc(a)}${active ? '' : ' <small>noch nicht in der App aktiv</small>'}</h5>${slots.map(slotNode).join('')}</div>`;
      }).join('');
      // Kombinationen fürs Postfach: je zwei Seiten (z. B. Absender × Thema), Gewicht = wie oft sie gewürfelt wird
      const combos = api().combos(), slots = K.idbSlots();
      const comboNodes = Object.entries(K.COMBO).map(([kind, [label, a, b]]) => {
        const mine = combos.filter(c => c.kind === kind), sum = mine.reduce((n, c) => n + (Number(c.weight) || 0), 0) || 1;
        return `<div class="map-area area-Postfach combo-kind"><h5>${esc(label)}-Kombinationen <small>${esc(a)} × ${esc(b)}</small>
            <button class="btn text sm" data-combo-add="${kind}">${icon('add')}Kombination</button></h5>
          ${mine.map(c => `<div class="map-combo"><div class="combo-h"><b>${esc(c.name)}</b>
              <label title="Wie oft diese Kombination gewürfelt wird">Gewicht <input class="field combo-w" type="number" min="0" step="1" value="${Number(c.weight) || 0}" data-combo-w="${esc(c.id)}"></label>
              <small class="muted">${Math.round((Number(c.weight) || 0) / sum * 100)} %</small>
              <button class="btn icon" data-combo-rename="${esc(c.id)}" title="Umbenennen">${icon('edit')}</button>
              <button class="btn icon" data-combo-del="${esc(c.id)}" title="Kombination löschen">${icon('delete')}</button></div>
            ${slots.filter(s => s.combo === c.id).map(slotNode).join('')}</div>`).join('') || '<p class="hint">Noch keine Kombination – dann entsteht diese Art nicht.</p>'}</div>`;
      }).join('');
      const unused = api().unusedLists(), removed = api().removedLists();
      const tidy = `<div class="map-tidy">${unused.length ? `<button class="btn tonal sm" data-map-tidy>${icon('cleaning_services')}${unused.length} unbenutzte ${unused.length === 1 ? 'Liste' : 'Listen'} entfernen</button>` : '<small class="muted">Alle Listen werden genutzt.</small>'}
        ${removed.length ? `<button class="btn text sm" data-map-restore title="${esc(removed.map(x => x.name).join(', '))}">${icon('restore')}${removed.length} entfernte wiederherstellen</button>` : ''}</div>`;

      return `<p class="hint">${icon('touch_app')} Am Punkt einer Liste ziehen und auf einer Verwendung loslassen – oder erst die Liste, dann die Verwendung anklicken. Eine Verwendung kann mehrere Listen haben; gezogen wird dann aus allen zusammen.
        Im Postfach würfelt die App zuerst eine Kombination (nach Gewicht) und zieht dann aus deren beiden Seiten – so legt ihr fest, wer was ansprechen kann.</p>${tidy}
        <section class="card"><div class="card-b">
          <div class="map" id="idb-map">
            <div class="map-col"><h4 class="map-h">${icon('database')}IDB-Listen</h4>${listNodes}</div>
            <div class="map-gap"></div>
            <div class="map-col"><h4 class="map-h">${icon('hub')}Verwendung in der App</h4>${slotNodes}${comboNodes}</div>
            <svg class="map-svg" id="map-svg"></svg>
          </div>
        </div></section>`;
    },
  };
  const group = K.NAV.find(g => g[0] === 'Admin');
  if (group) group[1].push('idbmap'); else K.NAV.push(['Admin', ['idbmap']]);

  /* ───────────── Linien ───────────── */
  const center = (el, box) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; };
  const curve = (a, b) => { const dx = Math.max(60, (b[0] - a[0]) / 2); return `M${a[0]},${a[1]} C${a[0] + dx},${a[1]} ${b[0] - dx},${b[1]} ${b[0]},${b[1]}`; };
  function draw() {
    const map = document.getElementById('idb-map'), svg = document.getElementById('map-svg');
    if (!map || !svg) return;
    const box = map.getBoundingClientRect();
    svg.setAttribute('width', box.width); svg.setAttribute('height', box.height);
    const links = api().links(), sel = K.state.mapSel;
    let out = '';
    K.idbSlots().forEach(s => (links[s.id] || []).forEach(id => {
      const p1 = map.querySelector(`[data-port-list="${id}"]`), p2 = map.querySelector(`[data-port-slot="${s.id}"]`);
      if (!p1 || !p2) return;
      const cls = ['edge', 'area-' + s.area, s.active ? 'active' : 'inactive', sel === id ? 'hl' : ''].join(' ');
      out += `<path class="${cls}" data-edge-list="${id}" d="${curve(center(p1, box), center(p2, box))}"/>`;
    }));
    svg.innerHTML = out + '<path class="edge temp" id="map-temp" d=""/>';
  }
  K.afterRender = K.afterRender || [];
  K.afterRender.push(view => { if (view === 'idbmap') setTimeout(draw, 0); });
  window.addEventListener('resize', () => { if (K.state && K.state.view === 'idbmap') draw(); });

  /* ───────────── Bedienung ───────────── */
  let drag = null;
  function link(slot, listId) { api().setLink(slot, listId, true); K.state.mapSel = null; K.render(); K.toast('Verbunden'); }
  document.addEventListener('mousedown', e => {
    const port = e.target.closest('[data-port-list]');
    if (!port) return;
    e.preventDefault();
    drag = { list: Number(port.dataset.portList), from: port };
    document.documentElement.classList.add('map-dragging');
  });
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    const map = document.getElementById('idb-map'), tmp = document.getElementById('map-temp');
    if (!map || !tmp) return;
    const box = map.getBoundingClientRect();
    tmp.setAttribute('d', curve(center(drag.from, box), [e.clientX - box.left, e.clientY - box.top]));
    document.querySelectorAll('.map-node.slot').forEach(n => n.classList.toggle('drop', n.contains(e.target)));
  });
  document.addEventListener('mouseup', e => {
    if (!drag) return;
    const slot = e.target.closest && e.target.closest('[data-map-slot]');
    const d = drag; drag = null;
    document.documentElement.classList.remove('map-dragging');
    if (slot) link(slot.dataset.mapSlot, d.list); else draw();
  });
  // Kombinationen anlegen, umbenennen, löschen, gewichten; unbenutzte Listen aufräumen
  document.addEventListener('click', e => {
    const t = e.target;
    const add = t.closest('[data-combo-add]');
    if (add) { api().addCombo(add.dataset.comboAdd); K.render(); return; }
    const ren = t.closest('[data-combo-rename]');
    if (ren) {
      const c = api().combos().find(x => x.id === ren.dataset.comboRename);
      K.dialog.prompt({ title: 'Kombination umbenennen', label: 'Name', value: c ? c.name : '' }).then(v => { if (v && v.trim()) { api().updateCombo(c.id, { name: v.trim() }); K.render(); } });
      return;
    }
    const del = t.closest('[data-combo-del]');
    if (del) {
      const c = api().combos().find(x => x.id === del.dataset.comboDel);
      K.dialog.confirm({ title: `${c.name} löschen?`, icon: 'delete', danger: true, ok: 'Löschen', text: 'Die Listen bleiben erhalten, nur diese Verbindung entfällt.' })
        .then(yes => { if (yes) { api().removeCombo(c.id); K.render(); } });
      return;
    }
    if (t.closest('[data-map-tidy]')) {
      const names = api().unusedLists().map(x => x.name);
      K.dialog.confirm({ title: 'Unbenutzte Listen entfernen?', icon: 'cleaning_services', ok: 'Entfernen', text: `${names.join('\n')}\n\nSie lassen sich danach wiederherstellen.` })
        .then(yes => { if (yes) { const n = api().removeUnused(); K.render(); K.toast(`${n} ${n === 1 ? 'Liste' : 'Listen'} entfernt`); } });
      return;
    }
    if (t.closest('[data-map-restore]')) { const n = api().restoreRemoved(); K.render(); K.toast(`${n} ${n === 1 ? 'Liste' : 'Listen'} wiederhergestellt`); }
  });
  document.addEventListener('change', e => {
    const w = e.target.dataset && e.target.dataset.comboW;
    if (w) { api().updateCombo(w, { weight: Math.max(0, Number(e.target.value) || 0) }); setTimeout(() => K.render(), 0); }
  });

  document.addEventListener('click', e => {
    const un = e.target.closest('[data-map-unlink]');
    if (un) { e.stopPropagation(); api().setLink(un.dataset.mapUnlink, Number(un.dataset.list), false); K.render(); K.toast('Verbindung gelöst'); return; }
    const li = e.target.closest('[data-map-list]');
    if (li && !e.target.closest('[data-port-list], .map-grip')) { const id = Number(li.dataset.mapList); K.state.mapSel = K.state.mapSel === id ? null : id; K.render(); return; }
    const sl = e.target.closest('[data-map-slot]');
    if (sl && K.state.mapSel) link(sl.dataset.mapSlot, K.state.mapSel);
  });
  // Listen links am Griff ziehen und sortieren – wie die Zeilen im Show-Editor (der Punkt rechts bleibt fürs Verbinden)
  let moving = null;
  const clearDrop = () => document.querySelectorAll('.map-node.list.drop-before, .map-node.list.drop-after').forEach(n => n.classList.remove('drop-before', 'drop-after'));
  document.addEventListener('mousedown', e => {
    const h = e.target.closest && e.target.closest('.map-grip');
    if (h) h.closest('.map-node.list').draggable = true;
  });
  document.addEventListener('mouseup', () => { if (moving === null) document.querySelectorAll('.map-node.list[draggable="true"]').forEach(n => { n.draggable = false; }); });
  document.addEventListener('dragstart', e => {
    const n = e.target.closest && e.target.closest('.map-node.list[data-map-list]');
    if (!n || !n.draggable) return;
    moving = Number(n.dataset.mapList);
    n.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(moving));
  });
  document.addEventListener('dragover', e => {
    if (moving === null) return;
    const n = e.target.closest && e.target.closest('.map-node.list[data-map-list]');
    if (!n) return;
    e.preventDefault();
    const r = n.getBoundingClientRect();
    clearDrop();
    n.classList.add(e.clientY > r.top + r.height / 2 ? 'drop-after' : 'drop-before');
  });
  document.addEventListener('drop', e => {
    if (moving === null) return;
    const n = e.target.closest && e.target.closest('.map-node.list[data-map-list]');
    if (!n) return;
    e.preventDefault();
    api().moveList(moving, Number(n.dataset.mapList), n.classList.contains('drop-after'));
    moving = null;
    K.render();
  });
  document.addEventListener('dragend', () => {
    moving = null; clearDrop();
    document.querySelectorAll('.map-node.list').forEach(n => { n.draggable = false; n.classList.remove('dragging'); });
  });

  // Beim Überfahren einer Liste ihre Verbindungen hervorheben
  document.addEventListener('mouseover', e => {
    const li = e.target.closest && e.target.closest('[data-map-list]');
    document.querySelectorAll('.map-svg .edge').forEach(p => p.classList.toggle('hover', !!li && p.dataset.edgeList === li.dataset.mapList));
  });
})(window.KHW);
