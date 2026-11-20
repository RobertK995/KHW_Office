// KHW Manager – Storylines.
// Eine Storyline ist eine kleine Todo-Liste: Titel, darunter feste Punkte, die abgehakt werden. Drei Stände:
//   geplant (Idee) → aktiv (läuft seit einer Spielwoche) → vergangen (alle Punkte erfüllt, Belohnung ausgezahlt)
// Diese Seite ist die Quelle für Card (rechte Spalte), Weeklie Roster, die Storyline-Vorschläge im Editor und das IDB.
// Belohnung wie StoryBelohnung (Apps Script): Zufallsfaktoren × Wochen aktiv, dazu Bonus-Sterne je Main-Event-Beteiligtem.
//
// Standard: anlegen, geplante bearbeiten/starten/löschen, Punkte aktiver Storylines abhaken, abschließen.
// Admin: alles bearbeiten (auch Punkte, Beteiligte, Startwoche und Status laufender und vergangener Storylines),
//        Punkte in jedem Stand abhaken, vergangene wieder öffnen (Belohnung auf Wunsch zurücknehmen), löschen.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc, eur, fmt } = K;
  const icon = n => `<span class="ms">${n}</span>`;
  const admin = () => !!(K.admin && K.admin.on);
  const TABS = [['active', 'Aktiv', 'play_circle'], ['planned', 'Geplant', 'lightbulb'], ['done', 'Vergangen', 'task_alt']];

  /* ───────────── Speichern ───────────── */
  const pure = s => ({ id: s.id, title: s.title, show: s.show, status: s.status, steps: s.steps.map(x => ({ text: x.text, done: !!x.done })),
    participants: (s.participants || []).slice(), start: s.start === undefined ? null : s.start, end: s.end === undefined ? null : s.end, reward: s.reward || null });
  const listOf = m => m.storylines.map(pure);
  const saveList = list => { K.store.update(st => { st.stories = list; }); K.rebuild(); };
  const change = (id, fn) => { const list = listOf(K.model), s = list.find(x => x.id === id); if (!s) return null; fn(s, list); saveList(list); return s; };

  /* ───────────── Belohnung (StoryBelohnung) ───────────── */
  function rollReward(m, s) {
    const c = K.conf.get('stories') || K.conf.defaults('stories');
    const weeks = Math.max(1, m.curWeek - (s.start === null ? m.curWeek : s.start));
    const skill = K.pick(c.skill) * c.skillFactor * weeks, stars = K.pick(c.stars) * weeks, money = K.pick(c.money) * weeks;
    const me = (s.participants || []).filter(n => (m.byName.get(n) || {}).status === 'Main Event');
    return { weeks, skill, stars, money, bonus: me.length * c.meBonus, bonusNames: me };
  }
  /** Belohnung buchen (positiv) oder zurücknehmen (sign = -1). */
  function applyReward(st, r, title, sign) {
    st.game.skillPoints = (st.game.skillPoints || 0) + sign * r.skill;
    st.game.stars = (st.game.stars || 0) + sign * (r.stars + r.bonus);
    if (r.money) st.bookings.push({ text: `${sign > 0 ? 'Storyline' : 'Storyline zurückgenommen'}: ${title}`, amount: sign * r.money, show: K.model.currentShow });
  }
  function complete(id) {
    const m = K.model, s = m.storylines.find(x => x.id === id);
    if (!s || s.status !== 'active') return;
    const r = rollReward(m, s);
    const list = listOf(m), it = list.find(x => x.id === id);
    Object.assign(it, { status: 'done', end: m.curWeek, reward: r });
    K.store.update(st => { st.stories = list; applyReward(st, r, s.title, 1); });
    K.rebuild();
    K.dialog.alert({ title: `${s.title} abgeschlossen`, icon: 'emoji_events',
      text: `${r.weeks} ${r.weeks === 1 ? 'Woche' : 'Wochen'} aktiv.\n\nBelohnung:\n• ${fmt(r.skill, r.skill % 1 ? 1 : 0)} Skillpunkte\n• ${fmt(r.stars)} Sterne${r.bonus ? `\n• +${fmt(r.bonus)} Bonus-Sterne (Main Event: ${r.bonusNames.join(', ')})` : ''}\n• ${eur(r.money, true)}` });
  }

  /* ───────────── Ansicht ───────────── */
  const rewardText = r => r ? `${fmt(r.skill, r.skill % 1 ? 1 : 0)} Skillpunkte · ${fmt(r.stars + r.bonus)} Sterne${r.bonus ? ` (inkl. ${fmt(r.bonus)} Bonus)` : ''} · ${eur(r.money, true)}` : '';
  function storyCard(m, s) {
    const u = K.ui, total = s.steps.length, done = s.doneCount, canTick = s.status === 'active' || admin();
    const when = s.status === 'planned' ? 'Idee' : s.status === 'active' ? (s.startText ? `seit ${s.startText} · ${s.weeks} ${s.weeks === 1 ? 'Woche' : 'Wochen'}` : 'ohne Startwoche (Admin: bearbeiten)')
      : `${s.startText}${s.end !== null ? ' – ' + K.weekText(s.end, m.curYear) : ''} · ${s.weeks || 0} Wochen`;
    const acts = [];
    if (s.status === 'planned') acts.push(`<button class="btn primary sm" data-story="start" data-id="${esc(s.id)}">${icon('play_arrow')}Starten</button>`);
    if (s.status === 'active' && total && done === total) acts.push(`<button class="btn primary sm" data-story="complete" data-id="${esc(s.id)}">${icon('emoji_events')}Abschließen</button>`);
    if (s.status === 'done' && admin()) acts.push(`<button class="btn tonal sm" data-story="reopen" data-id="${esc(s.id)}" title="Admin">${icon('undo')}Wieder öffnen</button>`);
    if (s.status === 'planned' || admin()) acts.push(`<button class="btn icon" data-story="edit" data-id="${esc(s.id)}" title="${s.status === 'planned' ? 'Bearbeiten' : 'Admin: bearbeiten'}">${icon('edit')}</button>`);
    if (s.status === 'planned' || admin()) acts.push(`<button class="btn icon" data-story="del" data-id="${esc(s.id)}" title="Löschen">${icon('delete')}</button>`);
    return `<section class="card story-card st-${s.status}"><div class="card-b">
      <div class="story-head"><div><h3>${esc(s.title)}</h3><small>${u.showChip(s.show)} ${esc(when)}</small></div><span class="story-act">${acts.join('')}</span></div>
      ${total ? `<div class="story-bar" title="${done} von ${total} Punkten"><i style="width:${done / total * 100}%"></i></div>` : ''}
      <ul class="story-steps">${s.steps.map((x, i) => `<li class="${x.done ? 'done' : ''} ${canTick ? 'can-tick' : ''}" ${canTick ? `data-story="tick" data-id="${esc(s.id)}" data-i="${i}"` : ''}>${icon(x.done ? 'check_box' : 'check_box_outline_blank')}<span>${K.nl(x.text)}</span></li>`).join('') || '<li class="none">Noch keine Punkte.</li>'}</ul>
      ${s.participants.length ? `<div class="story-people">${s.participants.map(n => u.wl(n)).join(', ')}</div>` : ''}
      ${s.reward ? `<p class="story-reward">${icon('redeem')}${esc(rewardText(s.reward))}</p>` : ''}</div></section>`;
  }

  K.views.stories = {
    title: 'Storylines', icon: 'auto_stories',
    render(m, st) {
      const tab = TABS.some(t => t[0] === st.storyTab) ? st.storyTab : 'active';
      const f = st.storyShow || '';
      const list = m.storylines.filter(s => s.status === tab && (!f || s.show === f))
        .sort((a, b) => tab === 'done' ? (b.end || 0) - (a.end || 0) : (a.start === null) - (b.start === null) || (a.start || 0) - (b.start || 0) || a.title.localeCompare(b.title, 'de'));
      const shows = K.khwShows();
      const bar = `<div class="toolbar wrap"><div class="seg">${TABS.map(([id, label, ic]) => `<button class="${id === tab ? 'on' : ''}" data-set="storyTab" data-value="${id}">${icon(ic)}${label} · ${m.storylines.filter(s => s.status === id).length}</button>`).join('')}</div>
        <select class="field" data-set="storyShow"><option value="">Alle Shows</option>${shows.map(s => `<option value="${esc(s)}" ${s === f ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
        <span class="grow"></span><button class="btn tonal" data-story="new">${icon('add')}Storyline anlegen</button></div>`;
      const hint = tab === 'active' ? 'Punkte durch Klick abhaken. Sind alle erfüllt, wird die Storyline abgeschlossen und die Belohnung ausgezahlt (je länger aktiv, desto mehr).'
        : tab === 'planned' ? 'Ideen für später. „Starten“ macht sie ab dieser Woche aktiv.' : 'Abgeschlossene Storylines mit ihrer Belohnung.';
      return `${bar}<p class="hint">${hint}${admin() ? ` <span class="admin-note">${icon('shield_person')} Admin: alles bearbeitbar, Punkte in jedem Stand abhaken, Startwoche ändern, vergangene wieder öffnen.</span>` : ''}</p>
        ${list.length ? `<div class="story-grid">${list.map(s => storyCard(m, s)).join('')}</div>` : K.ui.card('', K.ui.empty(tab === 'planned' ? 'Keine Ideen gespeichert.' : tab === 'done' ? 'Noch keine Storyline abgeschlossen.' : 'Keine aktive Storyline.'))}`;
    },
  };

  /* ───────────── Bearbeiten ───────────── */
  function dialog(s) {
    const m = K.model, isAdmin = admin();
    const weeks = [];
    const from = Math.min(m.curWeek - 52, s && s.start !== null && s.start !== undefined ? s.start : m.curWeek), to = m.curWeek + 52;
    for (let w = from; w <= to; w++) weeks.push([w, K.weekText(w, m.curYear) + (w === m.curWeek ? ' (diese Woche)' : '')]);
    const fields = [
      { id: 'title', label: 'Titel', value: s ? s.title : '', placeholder: 'z. B. Die Sekte Part 2' },
      { id: 'show', label: 'Show', type: 'select', value: s ? s.show : K.khwShows()[0], options: K.khwShows().map(x => [x, x]) },
      { id: 'steps', label: 'Punkte (eine Zeile je Punkt)', type: 'textarea', rows: 7, value: s ? s.steps.map(x => x.text).join('\n') : '', placeholder: 'Match zwischen …\nPromo von …\nTitelmatch beim PPV …' },
      { id: 'participants', label: 'Beteiligte (leer = aus dem Text erkennen)', value: s ? s.participants.join(', ') : '', suggest: 'wrestlers', multi: true, placeholder: 'Name, Name …' },
    ];
    if (!s) fields.splice(2, 0, { id: 'status', label: 'Stand', type: 'select', value: 'planned', options: [['planned', 'Geplant (Idee)'], ['active', 'Aktiv ab dieser Woche']] });
    if (s && isAdmin) {
      fields.push({ id: 'status', label: 'Stand (Admin)', type: 'select', value: s.status, options: [['planned', 'Geplant'], ['active', 'Aktiv'], ['done', 'Vergangen']] });
      fields.push({ id: 'start', label: 'Aktiv seit (Admin)', type: 'select', value: s.start === null ? '' : s.start, options: [['', '– noch nicht gestartet –'], ...weeks] });
    }
    return K.dialog.form({ title: s ? `${s.title} bearbeiten` : 'Storyline anlegen', icon: 'auto_stories', ok: s ? 'Speichern' : 'Anlegen', fields });
  }
  function save(s, v) {
    const m = K.model, title = v.title.trim();
    if (!title) { K.toast('Ohne Titel wurde nichts gespeichert.'); return; }
    const lines = v.steps.split('\n').map(x => x.trim()).filter(Boolean);
    let people = K.splitNames(v.participants).filter(n => m.byName.has(n));
    if (!people.length) people = [...new Set(K.storyPeople([title, ...lines].join(' ')))];
    const list = listOf(m);
    if (s) {
      const it = list.find(x => x.id === s.id);
      // Erledigt-Haken bleiben bei Punkten mit gleichem Text erhalten
      it.steps = lines.map(t => ({ text: t, done: !!(it.steps.find(x => x.text === t) || {}).done }));
      Object.assign(it, { title, show: v.show, participants: people });
      if (v.status && v.status !== it.status) {
        if (v.status === 'done' && it.end === null) it.end = m.curWeek;
        if (v.status !== 'done') it.end = null;
        it.status = v.status;
      }
      if (v.start !== undefined) it.start = v.start === '' ? null : Number(v.start);
    } else {
      list.push({ id: 's' + Date.now().toString(36), title, show: v.show, status: v.status || 'planned', steps: lines.map(t => ({ text: t, done: false })),
        participants: people, start: v.status === 'active' ? m.curWeek : null, end: null, reward: null });
    }
    saveList(list);
    K.toast(`${s ? 'Gespeichert' : 'Angelegt'}: ${title}`);
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-story]');
    if (!b || !K.model) return;
    const m = K.model, id = b.dataset.id, s = m.storylines.find(x => x.id === id), act = b.dataset.story;
    if (act === 'new') { dialog(null).then(v => { if (v) save(null, v); }); return; }
    if (!s) return;
    if (act === 'edit') dialog(s).then(v => { if (v) save(s, v); });
    else if (act === 'start') { change(id, x => { x.status = 'active'; x.start = m.curWeek; }); K.toast(`${s.title} läuft ab ${K.weekText(m.curWeek, m.curYear)}`); }
    else if (act === 'tick') {
      if (s.status !== 'active' && !admin()) return;
      const i = Number(b.dataset.i);
      const it = change(id, x => { x.steps[i].done = !x.steps[i].done; });
      // Letzter Punkt abgehakt: gleich abschließen?
      if (it && it.status === 'active' && it.steps.length && it.steps.every(x => x.done)) {
        K.dialog.confirm({ title: 'Alle Punkte erfüllt', icon: 'emoji_events', ok: 'Abschließen und belohnen', cancel: 'Noch nicht',
          text: `${it.title} ist komplett. Jetzt abschließen? Die Belohnung richtet sich nach den Wochen, die die Storyline aktiv war.` })
          .then(yes => { if (yes) complete(id); });
      }
    } else if (act === 'complete') complete(id);
    else if (act === 'reopen') {
      K.dialog.form({ title: `${s.title} wieder öffnen?`, icon: 'undo', ok: 'Wieder öffnen', text: s.reward ? `Belohnung damals: ${rewardText(s.reward)}` : '',
        fields: s.reward ? [{ id: 'revoke', label: 'Belohnung zurücknehmen (Skillpunkte, Sterne und Geld werden abgezogen)', type: 'checkbox', value: true }] : [] })
        .then(v => {
          if (!v) return;
          const list = listOf(m), it = list.find(x => x.id === id), r = it.reward;
          Object.assign(it, { status: 'active', end: null, reward: null });
          K.store.update(st => { st.stories = list; if (r && v.revoke) applyReward(st, r, it.title, -1); });
          K.rebuild(); K.toast(`${it.title} ist wieder aktiv${r && v.revoke ? ' · Belohnung zurückgenommen' : ''}`);
        });
    } else if (act === 'del') {
      K.dialog.confirm({ title: `${s.title} löschen?`, icon: 'delete', danger: true, ok: 'Löschen', text: s.reward ? 'Die bereits ausgezahlte Belohnung bleibt bestehen.' : 'Die Storyline verschwindet überall.' })
        .then(yes => { if (yes) { saveList(listOf(m).filter(x => x.id !== id)); K.toast(`${s.title} gelöscht`); } });
    }
  });
})(window.KHW);
