// KHW Manager – eigene Dialoge statt der Browser-Fenster (confirm, alert, prompt).
// Ein Fenster im Stil der App über abgedunkeltem Hintergrund. Alle Funktionen liefern ein Promise.
//   K.dialog.confirm({ title, text, ok, cancel, danger })  → true / false
//   K.dialog.alert({ title, text, ok })                     → true
//   K.dialog.prompt({ title, text, label, value, ok })      → Text oder null
//   K.dialog.form({ title, text, fields, ok })              → { feld: Wert } oder null
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let open = null;

  function show(o, kind) {
    if (open) open.finish(kind === 'prompt' ? null : false);
    return new Promise(resolve => {
      const back = document.createElement('div');
      back.className = 'modal-scrim';
      back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          ${o.icon ? `<span class="ms modal-icon ${o.danger ? 'danger' : ''}">${esc(o.icon)}</span>` : ''}
          <h2 id="modal-title">${esc(o.title || '')}</h2>
          ${o.text ? `<p>${esc(o.text).replace(/\n/g, '<br>')}</p>` : ''}
          ${o.html || ''}
          ${kind === 'prompt' ? `<label class="ro"><span>${esc(o.label || '')}</span><input class="field" id="modal-input" value="${esc(o.value || '')}"></label>` : ''}
          ${kind === 'form' ? (o.fields || []).map((f, i) => {
            const id = i === 0 ? 'id="modal-input"' : '';
            // Farbwahl: options = [[farbe, name], …]; geklickt wird ein Farbfeld, kein Browser-Farbwähler
            if (f.type === 'swatches') {
              return `<div class="ro"><span>${esc(f.label)}</span><div class="swatches"><input type="hidden" data-mf="${esc(f.id)}" value="${esc(f.value || '')}">${f.options.map(([c, l]) =>
                `<button type="button" class="swatch ${String(c) === String(f.value) ? 'on' : ''}" data-sw="${esc(c)}" title="${esc(l)}" style="--sw:${esc(c)}"></button>`).join('')}</div></div>` + (f.hint ? `<small class="hint">${esc(f.hint)}</small>` : '');
            }
            if (f.type === 'textarea') {   // mehrzeilig, z. B. eine Zeile je Punkt
              return `<label class="ro"><span>${esc(f.label)}</span><textarea class="field area" ${id} data-mf="${esc(f.id)}" rows="${f.rows || 6}" placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea></label>` + (f.hint ? `<small class="hint">${esc(f.hint)}</small>` : '');
            }
            const ctl = f.type === 'select'
              ? `<select class="field" ${id} data-mf="${esc(f.id)}">${f.options.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${String(v) === String(f.value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`
              : f.type === 'checkbox'
                ? `<label class="check modal-check"><input type="checkbox" data-mf="${esc(f.id)}" ${f.value ? 'checked' : ''}> ${esc(f.label)}</label>`
                : `<input class="field" ${id} data-mf="${esc(f.id)}" type="${f.type || 'text'}" ${f.step ? `step="${f.step}"` : ''} ${f.suggest ? `data-suggest="${esc(f.suggest)}" autocomplete="off"` : ''} ${f.multi ? 'data-suggest-multi' : ''} value="${esc(f.value === undefined ? '' : f.value)}" placeholder="${esc(f.placeholder || '')}">`;
            return (f.type === 'checkbox' ? ctl : `<label class="ro"><span>${esc(f.label)}</span>${ctl}</label>`) + (f.hint ? `<small class="hint">${esc(f.hint)}</small>` : '');
          }).join('') : ''}
          <div class="modal-actions">
            ${kind !== 'alert' ? `<button class="btn" data-modal="cancel">${esc(o.cancel || 'Abbrechen')}</button>` : ''}
            <button class="btn primary ${o.danger ? 'danger' : ''}" data-modal="ok">${esc(o.ok || 'OK')}</button>
          </div></div>`;
      document.body.appendChild(back);
      requestAnimationFrame(() => back.classList.add('show'));
      const focusEl = back.querySelector('#modal-input') || back.querySelector('[data-modal=ok]');
      focusEl.focus();
      if (focusEl.select) focusEl.select();

      const finish = value => {
        if (!open || open.back !== back) return;
        open = null;
        back.classList.remove('show');
        setTimeout(() => back.remove(), 160);
        resolve(value);
      };
      const formValues = () => { const v = {}; back.querySelectorAll('[data-mf]').forEach(el => { v[el.dataset.mf] = el.type === 'checkbox' ? el.checked : el.value; }); return v; };
      const ok = () => finish(kind === 'prompt' ? back.querySelector('#modal-input').value : kind === 'form' ? formValues() : true);
      const cancel = () => finish(kind === 'prompt' || kind === 'form' ? null : kind === 'alert');
      open = { back, finish: v => finish(v) };

      back.addEventListener('mousedown', e => { if (e.target === back) cancel(); });
      back.addEventListener('click', e => {
        const sw = e.target.closest('[data-sw]');
        if (sw) {
          const box = sw.parentElement;
          box.querySelector('input[type=hidden]').value = sw.dataset.sw;
          box.querySelectorAll('.swatch').forEach(x => x.classList.toggle('on', x === sw));
          return;
        }
        const b = e.target.closest('[data-modal]');
        if (b) b.dataset.modal === 'ok' ? ok() : cancel();
      });
      back.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        else if (e.key === 'Enter' && e.target.dataset && e.target.dataset.sw) { e.preventDefault(); e.target.click(); }
        else if (e.key === 'Enter' && e.target.tagName === 'TEXTAREA') { /* neue Zeile */ }
        else if (e.key === 'Enter' && !(e.target.tagName === 'BUTTON' && e.target.dataset.modal === 'cancel')) { e.preventDefault(); ok(); }
        else if (e.key === 'Tab') {   // Fokus bleibt im Fenster
          const f = [...back.querySelectorAll('button, input, textarea')].filter(x => !x.classList.contains('dd-native') && x.offsetParent !== null);
          const i = f.indexOf(document.activeElement);
          e.preventDefault();
          f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
        }
      });
    });
  }

  K.dialog = {
    confirm: o => show(Object.assign({ icon: 'help', ok: 'Bestätigen' }, o), 'confirm'),
    alert: o => show(Object.assign({ icon: 'info', ok: 'OK' }, o), 'alert'),
    prompt: o => show(Object.assign({ icon: 'edit', ok: 'Übernehmen' }, o), 'prompt'),
    /** Mehrere Felder: fields = [{ id, label, value, type, step, placeholder, hint }] → { id: Wert } oder null. */
    form: o => show(Object.assign({ icon: 'edit', ok: 'Übernehmen' }, o), 'form'),
  };
})(window.KHW);
