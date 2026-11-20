// KHW Manager – Auswahlfelder im Design der App.
// Die aufgeklappte Liste eines normalen <select> zeichnet der Browser selbst und lässt sich nicht gestalten.
// Deshalb bekommt jedes <select class="field"> einen eigenen Knopf mit eigener Liste. Das Original bleibt unsichtbar
// im Dokument: Wert und „change“-Ereignis funktionieren wie bisher, keine Ansicht muss angepasst werden.
// Zusätzlich: Eingabefelder mit data-suggest="…" bekommen Vorschläge im selben Stil (statt <datalist>).
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let menu = null, owner = null, active = -1, items = [];

  /* ───────────── Liste (gemeinsam für Auswahl und Vorschläge) ───────────── */
  function open(anchor, list, onPick, current) {
    close();
    owner = { anchor, onPick };
    items = list;
    menu = document.createElement('div');
    menu.className = 'dd-menu';
    menu.setAttribute('role', 'listbox');
    menu.innerHTML = list.length ? list.map((x, i) => `<div class="dd-item ${x.value === current ? 'on' : ''}" role="option" data-i="${i}">
        <span>${esc(x.label)}</span>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}${x.value === current ? '<span class="ms sm">check</span>' : ''}</div>`).join('')
      : '<div class="dd-empty">Keine Treffer</div>';
    document.body.appendChild(menu);
    place();
    active = Math.max(0, list.findIndex(x => x.value === current));
    mark(true);
    anchor.classList.add('dd-open');
  }
  function place() {
    if (!menu || !owner) return;
    const r = owner.anchor.getBoundingClientRect();
    menu.style.minWidth = r.width + 'px';
    menu.style.left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 8) + 'px';
    const below = window.innerHeight - r.bottom - 12, h = Math.min(menu.scrollHeight, 320);
    if (below < h && r.top > below) { menu.style.top = ''; menu.style.bottom = (window.innerHeight - r.top + 6) + 'px'; }
    else { menu.style.bottom = ''; menu.style.top = (r.bottom + 6) + 'px'; }
  }
  function mark(scroll) {
    if (!menu) return;
    menu.querySelectorAll('.dd-item').forEach((el, i) => el.classList.toggle('hover', i === active));
    const el = menu.querySelector('.dd-item.hover');
    // Nur die Liste selbst scrollen (scrollIntoView würde auch die Seite bewegen und die Liste damit schließen).
    if (el && scroll) {
      if (el.offsetTop < menu.scrollTop) menu.scrollTop = el.offsetTop - 6;
      else if (el.offsetTop + el.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = el.offsetTop + el.offsetHeight - menu.clientHeight + 6;
    }
  }
  function close() {
    if (owner) owner.anchor.classList.remove('dd-open');
    if (menu) menu.remove();
    menu = null; owner = null; items = []; active = -1;
  }
  function pick(i) { const x = items[i], o = owner; close(); if (x && o) o.onPick(x); }

  // mousedown statt click: Das Eingabefeld darf vorher nicht den Fokus verlieren (sonst feuert es „change“ mit halbem Text).
  document.addEventListener('mousedown', e => {
    const item = e.target.closest('.dd-item');
    if (item && menu && menu.contains(item)) { e.preventDefault(); pick(Number(item.dataset.i)); return; }
    if (menu && !menu.contains(e.target) && !(owner && owner.anchor.contains(e.target))) close();
  });
  window.addEventListener('resize', place);
  document.addEventListener('scroll', e => { if (menu && !menu.contains(e.target)) close(); }, true);

  /* ───────────── Auswahlfelder ───────────── */
  const labelOf = sel => { const o = sel.options[sel.selectedIndex]; return o ? o.textContent : ''; };
  function enhance(sel) {
    if (sel.dataset.dd) return;
    sel.dataset.dd = '1';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = sel.className + ' dd';
    if (sel.title) b.title = sel.title;
    if (sel.disabled) b.disabled = true;
    b.innerHTML = `<span class="dd-label">${esc(labelOf(sel))}</span><span class="ms sm">expand_more</span>`;
    b._select = sel;
    sel._dd = b;
    sel.classList.add('dd-native');
    sel.tabIndex = -1;
    sel.after(b);
  }
  /** Beschriftung nachziehen, wenn ein Skript den Wert ohne Ereignis ändert. */
  K.syncSelect = sel => { if (sel && sel._dd) sel._dd.querySelector('.dd-label').textContent = labelOf(sel); };
  function openSelect(b) {
    const sel = b._select;
    const list = [...sel.options].map(o => ({ value: o.value, label: o.textContent }));
    open(b, list, x => {
      if (sel.value !== x.value) { sel.value = x.value; K.syncSelect(sel); sel.dispatchEvent(new Event('change', { bubbles: true })); }
      b.focus();
    }, sel.value);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('button.dd');
    if (!b) return;
    e.preventDefault();
    if (owner && owner.anchor === b) close(); else openSelect(b);
  });
  document.addEventListener('change', e => { if (e.target._dd) K.syncSelect(e.target); });

  /* ───────────── Vorschläge für Eingabefelder ───────────── */
  // Quellen: K.suggest[name] = input => [{ value, label, sub, rank }]. Das Feld trägt data-suggest="name".
  // rank: kleinere Zahl = weiter oben (z. B. Wrestler der betroffenen Show zuerst).
  // Mit data-suggest-multi dürfen mehrere Namen mit Komma stehen; ergänzt wird immer der Name nach dem letzten Komma.
  K.suggest = K.suggest || {};
  function suggestFor(input) {
    const src = K.suggest[input.dataset.suggest];
    if (!src) return;
    const multi = 'suggestMulti' in input.dataset;
    const cut = multi ? input.value.lastIndexOf(',') : -1;
    const prefix = cut >= 0 ? input.value.slice(0, cut + 1) + ' ' : '';
    const token = (cut >= 0 ? input.value.slice(cut + 1) : input.value).trim();
    const chosen = multi ? K.splitNames(input.value.slice(0, Math.max(0, cut))) : [];
    const q = token.toLowerCase();
    const all = src(input).filter(x => !chosen.includes(x.value));
    const pos = x => x.label.toLowerCase().indexOf(q);
    const hits = (q ? all.filter(x => pos(x) >= 0) : all)
      .sort((a, b) => ((a.rank || 0) - (b.rank || 0)) || (q ? (pos(a) > 0) - (pos(b) > 0) : 0) || a.label.localeCompare(b.label, 'de'))
      .slice(0, 60);
    open(input, hits, x => {
      input.value = prefix + x.value;
      input._picking = true;   // das folgende input-Ereignis soll die Liste nicht wieder öffnen
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input._picking = false;
    }, token);
    if (q) { active = 0; mark(false); }
  }
  document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.suggest && !e.target._picking) suggestFor(e.target); });
  document.addEventListener('focusin', e => {
    const t = e.target;
    if (!t.dataset || !t.dataset.suggest) return;
    if ('suggestMulti' in t.dataset) t.setSelectionRange(t.value.length, t.value.length); else t.select();
    suggestFor(t);
  });
  document.addEventListener('focusout', e => { if (owner && owner.anchor === e.target) setTimeout(() => { if (owner && owner.anchor === e.target) close(); }, 0); });

  /* ───────────── Tastatur ───────────── */
  document.addEventListener('keydown', e => {
    const t = e.target;
    const isDd = t.classList && t.classList.contains('dd'), isSug = t.dataset && t.dataset.suggest;
    if (!isDd && !isSug) return;
    if (!menu || owner.anchor !== t) {
      if (isDd && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openSelect(t); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); mark(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); mark(true); }
    else if (e.key === 'Enter' || (isDd && e.key === ' ')) { e.preventDefault(); if (active >= 0) pick(active); }
    else if (e.key === 'Escape' || e.key === 'Tab') close();
  });

  /* ───────────── Automatisch auf alle neuen Auswahlfelder anwenden ───────────── */
  const scan = root => (root.querySelectorAll ? root.querySelectorAll('select.field:not([data-dd])') : []).forEach(enhance);
  new MutationObserver(list => {
    list.forEach(r => r.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches('select.field')) enhance(n); scan(n); } }));
    // Wurde das Feld zur offenen Liste neu aufgebaut, gehört die Liste nicht mehr dazu.
    if (menu && owner && !document.documentElement.contains(owner.anchor)) close(); else if (menu) place();
  })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => scan(document));
})(window.KHW);
