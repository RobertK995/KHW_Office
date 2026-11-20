// KHW Manager – Notizen.
// Gemeinsam für beide Spieler: Die Notizen liegen im Spielstand (K.store.state.notes, mit Supabase auf allen Geräten).
// Welche Notiz gerade offen ist, gilt je Tab (K.state.noteId). „Klickdummy zurücksetzen“ lässt die Notizen stehen.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc } = K;
  const icon = n => `<span class="ms">${n}</span>`;
  const newNote = () => ({ id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: '', html: '' });
  const notesOf = () => {
    const s = K.store.state;
    if (!Array.isArray(s.notes) || !s.notes.length) K.store.update(x => { x.notes = [newNote()]; });
    return K.store.state.notes;
  };
  const current = st => notesOf().find(n => n.id === st.noteId) || notesOf()[0];
  // Beim Tippen sofort im Speicher, gespeichert (und an das andere Gerät geschickt) kurz nach der letzten Taste
  let saveTimer = null;
  const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => K.store.update(() => {}), 400); };

  // Werkzeugleiste: [Befehl, Symbol, Titel, Argument]
  const TOOLS = [
    [['undo', 'undo', 'Rückgängig (Strg+Z)'], ['redo', 'redo', 'Wiederholen (Strg+Y)']],
    [['bold', 'format_bold', 'Fett (Strg+B)'], ['italic', 'format_italic', 'Kursiv (Strg+I)'], ['underline', 'format_underlined', 'Unterstrichen (Strg+U)'],
      ['strikeThrough', 'format_strikethrough', 'Durchgestrichen'], ['hiliteColor', 'format_ink_highlighter', 'Markieren', '#fbbc04'], ['code', 'code', 'Code']],
    [['insertUnorderedList', 'format_list_bulleted', 'Aufzählung'], ['insertOrderedList', 'format_list_numbered', 'Nummerierte Liste'], ['todo', 'checklist', 'Checkliste'],
      ['outdent', 'format_indent_decrease', 'Ausrücken (Umschalt+Tab)'], ['indent', 'format_indent_increase', 'Einrücken (Tab)']],
    [['createLink', 'link', 'Link einfügen'], ['insertHorizontalRule', 'horizontal_rule', 'Trennlinie'], ['table', 'table', 'Tabelle einfügen']],
    [['removeFormat', 'format_clear', 'Formatierung entfernen']],
  ];
  const BLOCKS = [['p', 'Text'], ['h1', 'Überschrift 1'], ['h2', 'Überschrift 2'], ['h3', 'Überschrift 3'], ['blockquote', 'Zitat'], ['pre', 'Codeblock']];

  K.views.notes = {
    title: 'Notizen', icon: 'edit_note',
    render(m, st) {
      const notes = notesOf(), cur = current(st);
      st.noteId = cur.id;
      const plain = html => { const d = document.createElement('div'); d.innerHTML = html; return (d.textContent || '').trim(); };
      return `<div class="notes-layout">
        <aside class="note-list">
          <button class="btn tonal" data-note="new">${icon('add')}Neue Notiz</button>
          <ul>${notes.map(n => `<li class="${n.id === cur.id ? 'active' : ''}" data-note="open" data-id="${n.id}">
            <b>${esc(n.title || 'Ohne Titel')}</b><small>${esc(plain(n.html).slice(0, 60)) || 'Leer'}</small></li>`).join('')}</ul>
          <p class="hint">${icon('info')} Wird automatisch gespeichert und ist für beide Spieler sichtbar.</p>
        </aside>
        <section class="card note-editor">
          <div class="note-head"><input id="note-title" class="note-title" placeholder="Titel" value="${esc(cur.title)}">
            <button class="btn icon" data-note="del" title="Notiz löschen">${icon('delete')}</button></div>
          <div class="note-tools">
            <select class="field" id="note-block" title="Absatzformat">${BLOCKS.map(b => `<option value="${b[0]}">${b[1]}</option>`).join('')}</select>
            ${TOOLS.map(g => `<span class="tool-group">${g.map(t => `<button class="btn icon" data-cmd="${t[0]}" ${t[3] ? `data-arg="${t[3]}"` : ''} title="${t[2]}">${icon(t[1])}</button>`).join('')}</span>`).join('')}
          </div>
          <div id="note-body" class="note-body" contenteditable="true" spellcheck="true" data-placeholder="Schreib los …">${cur.html}</div>
        </section></div>`;
    },
  };
  K.NAV.push(['Ablage', ['notes']]);

  /* ───────────── Bedienung ───────────── */
  const body = () => document.getElementById('note-body');
  const sync = () => { const b = body(), st = K.state; if (b && st) { const n = current(st); if (n.html !== b.innerHTML) { n.html = b.innerHTML; persist(); } } };
  const exec = (cmd, arg) => document.execCommand(cmd, false, arg);

  const elAtCaret = () => { const n = window.getSelection().anchorNode; return n && (n.nodeType === 1 ? n : n.parentElement); };
  const listAtCaret = () => { const el = elAtCaret(), ul = el && el.closest('ul'), b = body(); return ul && b && b.contains(ul) ? ul : null; };

  function run(cmd, arg) {
    const b = body(); if (!b) return;
    b.focus();
    if (cmd === 'createLink') {
      // Die Textauswahl merken: Das Dialogfenster nimmt den Fokus, danach wird sie wiederhergestellt.
      const sel = window.getSelection(), range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      K.dialog.prompt({ title: 'Link einfügen', label: 'Adresse des Links', value: 'https://', icon: 'link' }).then(url => {
        b.focus();
        if (range) { sel.removeAllRanges(); sel.addRange(range); }
        if (url && url !== 'https://') { exec('createLink', url); sync(); }
      });
      return;
    } else if (cmd === 'code') {
      const text = String(window.getSelection());
      if (text) exec('insertHTML', `<code>${esc(text)}</code>&nbsp;`);
    } else if (cmd === 'todo') {
      // Macht aus der Liste an der Schreibmarke eine Checkliste (oder wieder eine normale Aufzählung).
      let ul = listAtCaret();
      if (!ul) { exec('insertUnorderedList'); ul = listAtCaret(); }
      if (ul) ul.classList.toggle('todo');
    } else if (cmd === 'table') {
      const row = '<tr><td><br></td><td><br></td><td><br></td></tr>';
      exec('insertHTML', `<table><tbody>${row}${row}${row}</tbody></table><p><br></p>`);
    } else if (cmd === 'hiliteColor') {
      exec('styleWithCSS', true);
      const on = document.queryCommandValue('hiliteColor').replace(/\s/g, '') === 'rgb(251,188,4)';
      exec('hiliteColor', on ? 'transparent' : arg);
      exec('foreColor', on ? '#e8eaed' : '#202124');
      exec('styleWithCSS', false);
    } else exec(cmd, arg);
    sync(); marks();
  }

  /** Zeigt in der Werkzeugleiste, welche Formate an der Schreibmarke aktiv sind. */
  function marks() {
    const b = body(); if (!b || !b.contains(document.activeElement) && document.activeElement !== b) return;
    document.querySelectorAll('.note-tools [data-cmd]').forEach(btn => {
      let on = false;
      try { on = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'].includes(btn.dataset.cmd) && document.queryCommandState(btn.dataset.cmd); } catch (e) { /* Befehl hier nicht verfügbar */ }
      btn.classList.toggle('on', on);
    });
    const sel = document.getElementById('note-block');
    if (sel) { const v = String(document.queryCommandValue('formatBlock') || 'p').toLowerCase(); sel.value = BLOCKS.some(x => x[0] === v) ? v : 'p'; if (K.syncSelect) K.syncSelect(sel); }
  }

  // Die Auswahl im Text darf beim Klick auf ein Werkzeug nicht verloren gehen.
  document.addEventListener('mousedown', e => { if (e.target.closest('.note-tools [data-cmd]')) e.preventDefault(); });

  document.addEventListener('click', e => {
    const tool = e.target.closest('.note-tools [data-cmd]');
    if (tool) { run(tool.dataset.cmd, tool.dataset.arg); return; }
    const act = e.target.closest('[data-note]');
    if (act) {
      const st = K.state;
      sync();
      if (act.dataset.note === 'new') { const n = newNote(); K.store.update(s => { s.notes = notesOf().concat(n); }); st.noteId = n.id; }
      else if (act.dataset.note === 'open') st.noteId = act.dataset.id;
      else if (act.dataset.note === 'del') {
        const cur = current(st);
        K.dialog.confirm({ title: 'Notiz löschen?', text: `„${cur.title || 'Ohne Titel'}“ wird für beide Spieler gelöscht.`, icon: 'delete', danger: true, ok: 'Löschen' }).then(yes => {
          if (!yes) return;
          K.store.update(s => { s.notes = (s.notes || []).filter(n => n.id !== cur.id); });
          st.noteId = notesOf()[0].id;
          K.render();
        });
        return;
      }
      K.render();
      const focus = act.dataset.note === 'new' ? document.getElementById('note-title') : null;
      if (focus) focus.focus();
      return;
    }
    // Checkliste: Klick auf das Kästchen vor dem Eintrag hakt ab
    const li = e.target.closest('.note-body ul.todo > li');
    if (li && e.target === li && e.clientX - li.getBoundingClientRect().left < 24) { li.classList.toggle('done'); sync(); }
  });

  document.addEventListener('input', e => {
    const st = K.state; if (!st) return;
    if (e.target.id === 'note-body') {
      // Ein neuer Checklisten-Eintrag (Enter) soll nicht schon abgehakt sein.
      const el = elAtCaret(), li = el && el.closest('ul.todo > li.done');
      if (li && !li.textContent.trim()) li.classList.remove('done');
      sync();
      const small = document.querySelector('.note-list li.active small');
      if (small) small.textContent = (e.target.textContent || '').trim().slice(0, 60) || 'Leer';
    } else if (e.target.id === 'note-title') {
      current(st).title = e.target.value; persist();
      const b = document.querySelector('.note-list li.active b');
      if (b) b.textContent = e.target.value || 'Ohne Titel';
    }
  });

  document.addEventListener('change', e => { if (e.target.id === 'note-block') run('formatBlock', e.target.value); });

  document.addEventListener('keydown', e => {
    if (e.target.id === 'note-title' && e.key === 'Enter') { e.preventDefault(); const b = body(); if (b) b.focus(); return; }
    if (e.target.id !== 'note-body') return;
    if (e.key === 'Tab') { e.preventDefault(); run(e.shiftKey ? 'outdent' : 'indent'); }
  });
  document.addEventListener('selectionchange', marks);
})(window.KHW);
