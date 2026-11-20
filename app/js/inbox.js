// KHW Manager – Postfach: News, Mails und Termine (ersetzt Interaktionen und HK Casino Bar).
//
// Ablauf
//   • Nach „Show beenden“ entstehen 0–4 Einträge (Mails bevorzugt, nach PPVs öfter Termine; Regelwerk → Postfach).
//     Dabei wird nur die Überschrift gebaut, aus dem IDB (Absender, Thema, Ort …) – ohne Anfrage an die KI.
//   • Erst beim Öffnen geht eine Anfrage raus. Wer zuerst öffnet, sperrt den Eintrag (pending); alle anderen sehen
//     „wird geschrieben …“ und bekommen das Ergebnis über den gemeinsamen Speicher (heute zwischen Tabs, mit Supabase
//     zwischen Geräten).
//   • News sind einseitig. Auf Mails antwortet man, Termine sind ein Rollenspiel. Vor jeder eigenen Nachricht lassen
//     sich Fertigkeiten wählen; die Spielleitung würfelt verdeckt, das Ergebnis geht an die KI. Aspekt = leichtere Würfe.
//   • Eigene Mails und Termine kosten Skillpunkte, Antworten sind frei (Aspekt kostet extra).
//   • Die KI liefert nur Text. Entscheidungen und Folgen setzen die Spieler selbst um.
//   • Alles bleibt erhalten (store.inbox), bis man es löscht. Gelesen/ungelesen gilt je Gerät.
//   • Gedächtnis: Die KI darf je Person kurze Notizen hinterlassen ([Merken: …]); sie gehen beim nächsten Mal mit.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc } = K;
  const icon = n => `<span class="ms">${n}</span>`;
  const LOCK_MS = 120000;   // eine Sperre gilt höchstens 2 Minuten (falls ein Tab mitten im Schreiben geschlossen wird)
  const VIEW = { news: 'news', mail: 'mails', meet: 'meets' };
  const KIND_OF = { news: 'news', mails: 'mail', meets: 'meet' };

  /* ───────────── Gerät, Gelesen, Speicher ───────────── */
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } } };
  const DEVICE = ls.get('khw.device', null) || (() => { const id = 'd' + Math.random().toString(36).slice(2, 10); ls.set('khw.device', id); return id; })();
  const readSet = () => new Set(ls.get('khw.inbox.read', []));
  const markRead = id => { const s = readSet(); if (!s.has(id)) { s.add(id); ls.set('khw.inbox.read', [...s].slice(-2000)); } };
  const items = () => (K.store.state.inbox || []);
  const find = id => items().find(x => x.id === id);
  const edit = (id, fn) => K.store.update(st => { const it = (st.inbox || []).find(x => x.id === id); if (it) fn(it, st); });
  const CONF = () => Object.assign(K.conf.defaults('inbox'), K.conf.get('inbox') || {});
  const spendSkill = n => K.store.update(st => { st.game.skillPoints = (st.game.skillPoints || 0) - n; });
  const skills = m => (m.interaction && m.interaction.skills || []).filter(s => s.name);

  /** Anzahl ungelesener Einträge je Seite (für die Zahl in der Navigation). */
  K.navBadge = view => {
    const kind = KIND_OF[view]; if (!kind) return 0;
    const r = readSet();
    return items().filter(x => x.kind === kind && !r.has(x.id)).length;
  };

  /* ───────────── Zutaten aus dem IDB ───────────── */
  // Einträge, deren Variable gerade niemanden findet („[kein passender Wrestler]“), werden verworfen und neu gezogen
  const draw = (slot, m) => {
    for (let i = 0; i < 6; i++) { const h = K.idbDrawSlot ? K.idbDrawSlot(slot, m, {}) : null; if (!h) return ''; if (!/\[kein passende/.test(h.text)) return h.text; }
    return '';
  };
  const pickWeighted = w => { const e = Object.entries(w), sum = e.reduce((s, [, v]) => s + Number(v || 0), 0); let r = K.random() * sum; for (const [k, v] of e) { r -= Number(v || 0); if (r < 0) return k; } return e[0][0]; };
  const nameOf = text => String(text).replace(/\s*\(.*\)\s*$/, '').trim();   // „Bones (hat verloren)“ → „Bones“
  /** Wrestler hinter einem Text: genannte Wrestler und Mitglieder genannter Teams. */
  function peopleIn(m, text) {
    const n = nameOf(text);
    if (m.byName.has(n)) return [n];
    const t = K.teamMembers(m, n);
    if (t) return t.slice(0, 3);
    return m.roster.map(w => w.name).filter(x => x.length > 3 && text.includes(x)).slice(0, 2);
  }
  const newId = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /** Kombination würfeln (nach Gewicht, nur solche mit verknüpften Listen auf beiden Seiten) und aus beiden Seiten ziehen.
      Gelingt es mit einer Kombination nicht (Listen leer), wird die nächste versucht. */
  function drawCombo(kind, m) {
    const links = K.idbApi.links(), slot = (c, s) => `inbox.combo.${c.id}.${s}`;
    const pool = K.idbApi.combos().filter(c => c.kind === kind && Number(c.weight) > 0 && ['a', 'b'].every(s => (links[slot(c, s)] || []).length));
    while (pool.length) {
      const pick = pickWeighted(Object.fromEntries(pool.map((c, i) => [i, c.weight])));
      const c = pool.splice(Number(pick), 1)[0], a = draw(slot(c, 'a'), m), b = draw(slot(c, 'b'), m);
      if (a && b) return { combo: c.name, a, b };
    }
    return null;
  }
  // Die letzte Show kommt nur in den Kontext, wenn es News sind oder ein Beteiligter bei einer KHW-Show auftritt
  const atKhw = (m, people) => people.some(p => { const w = m.byName.get(p); return w && w.show; });

  function makeItem(kind, m, s) {
    const week = s ? K.weekIdx(s.date) : m.curWeek;
    const base = { id: newId(), kind, created: week, createdText: K.weekText(week, m.curYear), showKey: s ? s.key : null, origin: 'auto', status: 'open', turns: [], pending: null, suggest: [] };
    const d = drawCombo(kind, m);
    if (!d) return null;
    if (kind === 'news') return Object.assign(base, { title: d.b, who: d.a, source: d.a, headline: d.b, combo: d.combo, people: peopleIn(m, d.b), ctxShow: true });
    const people = peopleIn(m, d.a);
    if (kind === 'mail') return Object.assign(base, { title: `Mail von ${nameOf(d.a)}`, who: nameOf(d.a), whoNote: d.a, topic: d.b, combo: d.combo, tone: draw('interaction.tone', m), people, ctxShow: atKhw(m, people) });
    const place = draw('inbox.meet.place', m) || 'im Büro';
    return Object.assign(base, { title: `Treffen ${place} mit ${nameOf(d.a)}`, who: nameOf(d.a), whoNote: d.a, place, reason: d.b, combo: d.combo, tone: draw('interaction.tone', m), people, ctxShow: atKhw(m, people) });
  }

  /** Nach dem Beenden einer Show: 0–4 Einträge würfeln, Mails nie weniger als eine andere Art. */
  function afterShow(m, s) {
    const c = CONF();
    const n = Number(pickWeighted(Object.fromEntries(c.count.map((p, i) => [i, p]))));
    const w = s && s.type === 'PPV' ? c.kindsPPV : c.kinds;
    const kinds = Array.from({ length: n }, () => pickWeighted(w));
    // Mails bevorzugt: Gibt es von einer anderen Art mehr als Mails, wird daraus eine Mail
    const cnt = k => kinds.filter(x => x === k).length;
    for (let i = 0; i < kinds.length; i++) if (kinds[i] !== 'mail' && cnt(kinds[i]) > cnt('mail')) kinds[i] = 'mail';
    const made = kinds.map(k => makeItem(k, m, s)).filter(Boolean);
    if (!made.length) return [];
    K.store.update(st => { st.inbox = (st.inbox || []).concat(made); });
    return made;
  }

  /* ───────────── Anfrage an die KI ───────────── */
  function personCard(m, n) {
    const w = m.byName.get(n); if (!w) return '';
    const mem = ((K.store.state.memory || {})[n] || []).slice(-2).map(x => x.text).join('; ');
    return `${w.name}: ${[w.status, w.show ? 'bei ' + w.show : w.promotion ? 'bei ' + w.promotion : 'ohne Liga', w.alignment, w.gimmick ? 'Gimmick ' + w.gimmick : '',
      w.teams && w.teams.length ? 'Team ' + w.teams.join('/') : '', w.storyline ? 'Storyline ' + w.storyline : '', w.injury ? 'verletzt (' + w.injury + ')' : '',
      w.titles.length ? 'hält ' + w.titles.join('/') : '', mem ? 'erinnert sich: ' + mem : ''].filter(Boolean).join(', ')}.`;
  }
  function lastShow(m) {
    const s = m.shows.slice().reverse().find(x => x.ended && x.hasContent);
    if (!s) return '';
    const res = s.matches.filter(x => x.winner && x.loser).slice(0, 3).map(x => `${x.winner} besiegt ${x.loser}`);
    return `Letzte Show ${K.ui.showTitle(s)}${res.length ? ': ' + res.join('; ') : ''}.`;
  }
  /** Baut die Nachrichten an die KI – so knapp wie möglich (nur nötiger Kontext, nur die letzten Runden). */
  function buildMessages(m, it) {
    const c = CONF(), n = it.kind === 'news' ? c.newsSentences : c.sentences;
    const sys = `${c.system} Antworte mit höchstens ${n} Sätzen.`;
    const ctx = [`Stand: ${K.MONTHS[m.curDate.month]} Woche ${m.curDate.week}, Jahr ${m.curDate.year}.`,
      (it.kind === 'news' || it.ctxShow || it.group === 'khw') ? lastShow(m) : '', ...(it.people || []).slice(0, 2).map(p => personCard(m, p))].filter(Boolean).join('\n');
    const skillNames = skills(m).map(s => s.name).join(', ');
    const tags = it.kind === 'news' ? '' : `\nWenn Knight & Hustler reagieren müssen, letzte Zeile: [Probe: 1–2 aus ${skillNames}].${(it.people || []).length ? ` Ändert sich die Haltung von ${it.who} merklich, zusätzlich eine Zeile [Merken: höchstens 8 Wörter].` : ''}`;
    // In Folgerunden nur der kurze Hinweis (die Liste der Fertigkeiten steht schon in der ersten Nachricht)
    const tagsShort = it.kind === 'news' ? '' : `\nBei Bedarf wieder [Probe: …]${(it.people || []).length ? ' und [Merken: …]' : ''}.`;
    const own = it.origin === 'own', first = own ? it.turns[0] : null;
    let task;
    if (it.kind === 'news') task = `Kurzmeldung von ${it.source}: „${it.headline}“. Frech und überzeichnet.`;
    else if (it.kind === 'mail') task = own ? `Knight & Hustler schreiben an ${it.who}: „${first.text}“${rollText(first)}\nSchreibe die Antwortmail von ${it.who}.`
      : `Schreibe die Mail von ${it.whoNote || it.who} an Knight & Hustler. Anliegen: ${it.topic}.${it.tone ? ' Ton: ' + it.tone + '.' : ''} Nur der Mailtext ohne Betreff, mit offener Frage am Ende.`;
    else task = own ? `Knight & Hustler treffen ${it.who} ${it.place}. Sie beginnen so: „${first.text}“${rollText(first)}\nErzähle knapp, wie ${it.who} reagiert.`
      : `Szene: Treffen ${it.place} mit ${it.whoNote || it.who}.${it.reason ? ' Anlass: ' + it.reason + '.' : ''}${it.tone ? ' Ton: ' + it.tone + '.' : ''} Beschreibe knapp die Lage und ende mit einer Situation, auf die Knight & Hustler reagieren müssen.`;
    const msgs = [{ role: 'user', content: `${ctx}\n${task}${tags}` }];
    // Weitere Runden: KI = assistant, Knight & Hustler = user (mit Würfen und Hinweis aufs Ende)
    let ours = own ? 1 : 0;
    it.turns.slice(own ? 1 : 0).forEach(t => {
      if (t.who === 'ki') { msgs.push({ role: 'assistant', content: t.text }); return; }
      ours++;
      const fin = ours >= c.finalAfter ? ' Lass es jetzt auf ein klares Ergebnis zulaufen.' : '';
      const next = it.kind === 'mail' ? `Schreibe die Antwortmail von ${it.who}.` : 'Erzähle knapp, wie es weitergeht, mit klaren Folgen.';
      msgs.push({ role: 'user', content: `Knight & Hustler ${it.kind === 'mail' ? 'antworten' : 'handeln'}: „${t.text}“${rollText(t)}\n${next}${fin}${tagsShort}` });
    });
    // Token sparen: erste Nachricht (Kontext) plus die letzten 6
    const keep = msgs.length > 7 ? [msgs[0], ...msgs.slice(-6)] : msgs;
    return [{ role: 'system', content: sys }, ...keep];
  }
  const rollText = t => (t && t.rolls && t.rolls.length ? ` Würfe: ${t.rolls.map(r => `${r.name} ${r.result}`).join(', ')}.` : '');

  /** Antwort zerlegen: Text, empfohlene Proben, Notiz fürs Gedächtnis. */
  function parse(m, raw) {
    const probe = (/\[Probe:\s*([^\]]+)\]/i.exec(raw) || [])[1] || '';
    const memo = (/\[Merken:\s*([^\]]+)\]/i.exec(raw) || [])[1] || '';
    const names = skills(m).map(s => s.name);
    const suggest = probe.split(/[,;/]| und /).map(x => x.trim().toLowerCase()).filter(Boolean)
      .map(x => names.find(n => n.toLowerCase().startsWith(x.slice(0, 5)))).filter(Boolean);
    const text = raw.replace(/\[(Probe|Merken):[^\]]*\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
    return { text, suggest: [...new Set(suggest)], memo: memo.trim() };
  }

  async function generate(id) {
    const m = K.model, it0 = find(id);
    if (!m || !it0) return;
    let claimed = false;
    K.store.update(st => {
      const it = (st.inbox || []).find(x => x.id === id);
      if (!it) return;
      if (it.pending && it.pending.by !== DEVICE && Date.now() - it.pending.at < LOCK_MS) return;   // jemand anderes schreibt gerade
      it.pending = { by: DEVICE, at: Date.now() }; it.error = null; claimed = true;
    });
    K.render();
    if (!claimed) return;
    try {
      const raw = await K.ai.chat(buildMessages(m, find(id)), { maxTokens: CONF().maxTokens });
      const p = parse(m, raw);
      K.store.update(st => {
        const it = (st.inbox || []).find(x => x.id === id); if (!it) return;
        it.turns.push({ who: 'ki', text: p.text, at: Date.now() });
        it.suggest = p.suggest; it.pending = null;
        const who = (it.people || [])[0];
        if (p.memo && who) { st.memory = st.memory || {}; st.memory[who] = (st.memory[who] || []).concat({ text: p.memo, week: m.curWeek }).slice(-5); }
      });
    } catch (e) {
      edit(id, it => { it.pending = null; it.error = e.message; });
      K.toast('Die KI hat nicht geantwortet: ' + e.message);
    }
    K.rebuild();
  }

  /** Würfe der Spielleitung für die gewählten Fertigkeiten (Aspekt = leichter, wie bisher +20). */
  function roll(m, names, aspect) {
    const bonus = aspect ? CONF().aspectBonus : 0;
    return names.map(n => {
      const s = skills(m).find(x => x.name === n); const lvl = s ? (s.lvl || 0) : 0;
      const r = K.rand(Math.max(1, 41 - (lvl + bonus) / 2));
      return { name: n, lvl, roll: r, result: K.skillResult(lvl, r) };
    });
  }

  /* ───────────── Ansicht ───────────── */
  const LABEL = { news: ['News', 'newspaper'], mail: ['Mails', 'mail'], meet: ['Termine', 'event'] };
  // Chat-Look (skins.js): runde Kürzel mit fester Farbe je Absender
  const chatAva = name => K.skin && K.skin('chat') ? `<span class="chat-ava" style="--h:${K.skinHash(name) % 360}">${esc(String(name || '?').replace(/[^A-Za-zÄÖÜäöü ]/g, '').split(/\s+/).filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?')}</span>` : '';
  function itemRow(it, sel, read) {
    const state = it.pending ? '<span class="chip outline ib-busy">schreibt …</span>' : !read.has(it.id) ? '<span class="chip accent">neu</span>' : it.status === 'done' ? '<span class="chip outline">abgeschlossen</span>' : '';
    const sub = [it.createdText, it.kind === 'news' ? it.source : it.origin === 'own' ? 'von euch' : ''].filter(Boolean).join(' · ');
    return `<li class="${sel ? 'active' : ''} ${read.has(it.id) ? '' : 'unread'}" data-ib="open" data-id="${esc(it.id)}">${it.kind === 'mail' ? chatAva(it.who) : ''}<div><b>${esc(it.title)}</b><small>${esc(sub)}</small></div>${state}
      <button class="btn icon ib-del" data-ib="del" data-id="${esc(it.id)}" title="Löschen">${icon('delete')}</button></li>`;
  }
  function detail(m, st, it) {
    const u = K.ui, c = CONF();
    if (!it) return u.card('', u.empty('Links einen Eintrag wählen. Erst beim Öffnen schreibt die KI den Inhalt.'));
    const label = t => (t.who === 'ki' ? (it.kind === 'news' ? it.source : it.who) : 'Knight & Hustler');
    const showRolls = (t, i) => t.rolls && t.rolls.length && it.turns[i + 1] ? `<div class="ib-rolls">${t.aspect ? '<span class="chip outline">Aspekt</span>' : ''}${t.rolls.map(r => u.resChip ? `<span class="ib-roll">${esc(r.name)} ${u.resChip(r.result)}</span>` : '').join('')}</div>` : '';
    const thread = it.turns.map((t, i) => `<div class="bubble ${t.who === 'ki' ? 'gm' : 'me'}"><small>${esc(label(t))}</small>${K.nl(t.text)}${showRolls(t, i)}</div>`).join('');
    const busy = it.pending ? `<div class="bubble gm typing"><small>${esc(it.kind === 'news' ? it.source : it.who)}</small><span class="dots"><i></i><i></i><i></i></span>${it.pending.by === DEVICE ? '' : '<em>wird gerade für alle geschrieben …</em>'}</div>` : '';
    const err = it.error ? `<div class="notice">${icon('error')}<div><b>Keine Antwort</b><span>${esc(it.error)}</span></div><button class="btn tonal sm" data-ib="retry" data-id="${esc(it.id)}">Erneut versuchen</button></div>` : '';
    const empty = !it.turns.length && !it.pending && !it.error ? `<button class="btn primary" data-ib="retry" data-id="${esc(it.id)}">${icon('auto_awesome')}Inhalt laden</button>` : '';
    // Antworten (Mail) bzw. Handeln (Termin): Fertigkeiten pro Nachricht frei wählbar, Vorschlag der KI vorausgewählt
    const last = it.turns[it.turns.length - 1];
    let composer = '';
    if (it.kind !== 'news' && it.status !== 'done' && !it.pending && last && last.who === 'ki') {
      st.ibPick = st.ibPick || {};
      const picks = st.ibPick[it.id] || (st.ibPick[it.id] = (it.suggest || []).slice());
      composer = `<div class="ib-compose">
        <div class="ib-skills">${skills(m).map(s => `<button class="chip ${picks.includes(s.name) ? 'accent' : 'outline'}" data-ib="skill" data-id="${esc(it.id)}" data-name="${esc(s.name)}" title="Stufe ${s.lvl}">${esc(s.name)}${(it.suggest || []).includes(s.name) ? ' ★' : ''}</button>`).join('')}</div>
        <textarea class="field area" id="ib-text-${esc(it.id)}" rows="3" placeholder="${it.kind === 'mail' ? 'Eure Antwort …' : 'So handeln Knight & Hustler …'}">${esc((st.ibDraft || {})[it.id] || '')}</textarea>
        <div class="ib-send"><label class="check"><input type="checkbox" id="ib-aspect-${esc(it.id)}"> Aspekt einsetzen (${c.costAspect} Skillpunkte, Würfe leichter)</label>
          <span class="grow"></span><small class="muted">Skillpunkte: ${K.fmt(m.skillPoints)}</small>
          <button class="btn primary" data-ib="send" data-id="${esc(it.id)}">${icon('send')}${it.kind === 'mail' ? 'Antworten' : 'So handeln wir'}</button></div>
        <p class="hint">★ = von der Spielleitung vorgeschlagene Probe. Die Würfe bleiben bis zur Antwort verdeckt.${it.turns.filter(t => t.who === 'us').length + 1 >= c.finalAfter ? ' Ab jetzt läuft es auf ein Ergebnis zu.' : ''}</p></div>`;
    }
    const admin = K.admin && K.admin.on && (it.people || []).length ? `<div class="ib-memory">${icon('psychology')}<b>Gedächtnis (Admin)</b>${it.people.map(p => {
      const mem = (K.store.state.memory || {})[p] || [];
      return `<div><small>${esc(p)}</small>${mem.length ? `<ul>${mem.map((x, i) => `<li>${esc(x.text)} <button class="btn icon" data-ib="forget" data-name="${esc(p)}" data-i="${i}" title="Vergessen">${icon('close')}</button></li>`).join('')}</ul>` : '<em class="muted">noch nichts</em>'}</div>`;
    }).join('')}</div>` : '';
    const meta = [it.createdText, it.kind === 'mail' ? (it.origin === 'own' ? `an ${it.who}` : it.whoNote) : it.kind === 'meet' ? `${it.place}${it.whoNote && it.whoNote !== it.who ? ' · ' + it.whoNote : ''}` : it.source].filter(Boolean).join(' · ');
    const chatHead = it.kind === 'mail' && K.skin && K.skin('chat');
    return `<section class="card ib-detail"><header class="card-h"><div class="${chatHead ? 'chat-head' : ''}">${chatHead ? chatAva(it.who) : ''}<div><h3>${chatHead ? '' : icon(LABEL[it.kind][1])}${esc(it.title)}</h3><small>${chatHead ? '<i class="chat-online"></i>online · ' : ''}${esc(meta)}</small></div></div>
        <span class="ib-actions">${it.kind !== 'news' ? `<button class="btn text" data-ib="${it.status === 'done' ? 'reopen' : 'done'}" data-id="${esc(it.id)}">${icon(it.status === 'done' ? 'undo' : 'task_alt')}${it.status === 'done' ? 'Wieder öffnen' : 'Abschließen'}</button>` : ''}
        <button class="btn icon" data-ib="del" data-id="${esc(it.id)}" title="Löschen">${icon('delete')}</button></span></header>
      <div class="card-b"><div class="thread">${thread}${busy}</div>${err}${empty}${composer}${admin}</div></section>`;
  }

  /* Geöffnete News im Look einer Nachrichtenseite. Jede Quelle bekommt fest eine von fünf Seitenarten (nach ihrem Namen). */
  const PRESS = [
    ['tabloid', ['Die Wahrheit hinter dem Ringseil', 'Exklusiv. Schnell. Meistens wahr.', 'Wir waren dabei. Irgendwie.']],
    ['paper', ['Unabhängig seit 1912', 'Kölns Blatt für Ringsport und Kultur', 'Gegründet in einer Kneipe']],
    ['tv', ['Live aus dem Studio', 'Rund um die Uhr am Ring', 'Bilder, die keiner wollte']],
    ['gossip', ['Gossip, Glitzer & Gürtel', 'Alles über die Stars hinter dem Vorhang', 'Für Fans mit Fernglas']],
    ['forum', ['Das Forum für echte Fans', 'Gerüchte, Leaks & Meinungen', 'Seit 2004 online']],
  ];
  function press(it, inner) {
    if (!(K.skin && K.skin('press'))) return inner;
    const src = it.source || 'Ringtratsch', h = K.skinHash(src), [style, slogans] = PRESS[h % PRESS.length], slogan = slogans[(h >>> 3) % slogans.length];
    const slug = K.skinSlug(src), path = { tabloid: 'exklusiv', paper: 'sport/ringsport', tv: 'mediathek/clip', gossip: 'stars', forum: 'w/khw/thread' }[style];
    const date = esc(it.createdText || '');
    const mast = {
      tabloid: `<div class="press-mast"><b>${esc(src)}</b><span>${slogan}</span></div><div class="press-strip">EXKLUSIV · ${date}</div>`,
      paper: `<div class="press-mast"><span class="pm-side">${date}</span><b>${esc(src)}</b><span class="pm-side">Preis 2,50 €</span></div><div class="press-strip">${slogan} · Ressort Ringsport</div>`,
      tv: `<div class="press-mast"><b>${esc(src)}</b><span class="press-live">LIVE</span><span>${slogan}</span></div><div class="press-ticker"><span>+++ ${esc(it.title)} +++ ${esc(it.title)} +++</span></div>`,
      gossip: `<div class="press-mast"><b>${esc(src)}</b><span>✦ ${slogan} ✦</span></div>`,
      forum: `<div class="press-mast"><b>w/KHW</b><span>${esc(src)} · ${slogan}</span></div><div class="press-strip">Gepostet von u/${slug.slice(0, 12)}_insider · ${date}</div>`,
    }[style];
    return K.frame('press', { url: `www.${slug}.de/${path}/${K.skinSlug(it.title).slice(0, 48)}`, cls: 'press-' + style, brand: mast }, inner);
  }

  function page(kind) {
    return {
      title: LABEL[kind][0], icon: LABEL[kind][1],
      render(m, st) {
        const all = items().filter(x => x.kind === kind).slice().reverse(), read = readSet();
        st.ibSel = st.ibSel || {};
        const sel = all.find(x => x.id === st.ibSel[kind]) || null;
        const c = CONF();
        const bar = kind === 'news' ? '' : `<div class="toolbar"><button class="btn tonal" data-ib="new" data-kind="${kind}">${icon(kind === 'mail' ? 'edit' : 'event_available')}${kind === 'mail' ? 'Neue Mail' : 'Neuer Termin'}</button>
          <small class="muted">kostet ${c.costOwn} Skillpunkte · Antworten sind frei</small></div>`;
        const list = all.length ? `<ul class="ib-list">${all.map(it => itemRow(it, sel && it.id === sel.id, read)).join('')}</ul>` : K.ui.empty(kind === 'news' ? 'Noch keine News.' : kind === 'mail' ? 'Keine Mails.' : 'Keine Termine.');
        let left = `<section class="card"><div class="card-b">${list}</div></section>`, right = detail(m, st, sel);
        // Looks (skins.js): geöffnete News als Nachrichtenseite, Mails als Chat-Programm
        if (kind === 'news' && sel) right = press(sel, right);
        const layout = `<div class="ib-layout">${left}${right}</div>`;
        return bar + (kind === 'mail' ? K.frame('chat', { app: 'Schnackr – Knight & Hustler', appIcon: '<span class="chat-logo">S</span>' }, layout) : layout);
      },
    };
  }
  K.views.news = page('news'); K.views.mails = page('mail'); K.views.meets = page('meet');
  // Navigation: eigener Bereich über den Notizen; Interaktionen und HK Casino Bar sind ersetzt (bleiben im Code)
  if (K.views.interaction) K.views.interaction.hidden = true;
  if (K.views.bar) K.views.bar.hidden = true;
  const ablage = K.NAV.findIndex(g => g[0] === 'Ablage');
  K.NAV.splice(ablage < 0 ? K.NAV.length : ablage, 0, ['Postfach', ['news', 'mails', 'meets']]);

  /* ───────────── Bedienung ───────────── */
  function newOwn(kind) {
    const m = K.model, c = CONF();
    const fields = [{ id: 'who', label: kind === 'mail' ? 'An' : 'Mit wem', suggest: 'fighters', placeholder: 'Wrestler, Team oder frei, z. B. Sponsor Kölsch-Brauerei' }];
    if (kind === 'meet') fields.push({ id: 'place', label: 'Wo', value: 'im Büro', placeholder: 'z. B. an der Bar des HK Casino' });
    fields.push({ id: 'text', label: kind === 'mail' ? 'Eure Mail' : 'So beginnt ihr', type: 'textarea', rows: 4 });
    K.dialog.form({ title: kind === 'mail' ? 'Neue Mail' : 'Neuer Termin', icon: kind === 'mail' ? 'edit' : 'event_available', ok: `Senden (${c.costOwn} Skillpunkte)`, fields })
      .then(v => {
        if (!v) return;
        const who = v.who.trim(), text = v.text.trim();
        if (!who || !text) { K.toast('Bitte Empfänger und Text angeben.'); return; }
        if (m.skillPoints < c.costOwn) { K.toast(`Dafür fehlen ${K.fmt(c.costOwn - m.skillPoints)} Skillpunkte.`); return; }
        const it = { id: newId(), kind, origin: 'own', status: 'open', created: m.curWeek, createdText: K.weekText(m.curWeek, m.curYear), who, whoNote: who, people: peopleIn(m, who),
          title: kind === 'mail' ? `Mail an ${who}` : `Treffen ${v.place.trim() || 'im Büro'} mit ${who}`, place: v.place ? v.place.trim() || 'im Büro' : '',
          turns: [{ who: 'us', text, at: Date.now() }], pending: null, suggest: [] };
        spendSkill(c.costOwn);
        K.store.update(st => { st.inbox = (st.inbox || []).concat(it); });
        markRead(it.id);
        K.state.ibSel = Object.assign({}, K.state.ibSel, { [kind]: it.id });
        K.rebuild();
        generate(it.id);
      });
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ib]');
    if (!b || !K.model) return;
    const st = K.state, act = b.dataset.ib, id = b.dataset.id, it = id ? find(id) : null;
    st.ibPick = st.ibPick || {};
    if (act === 'del') {
      e.stopPropagation();
      if (!it) return;
      K.dialog.confirm({ title: `${it.title} löschen?`, icon: 'delete', danger: true, ok: 'Löschen', text: 'Der Eintrag verschwindet für alle.' })
        .then(yes => { if (yes) { K.store.update(s => { s.inbox = (s.inbox || []).filter(x => x.id !== id); }); K.rebuild(); } });
    } else if (act === 'open' && it) {
      st.ibSel = Object.assign({}, st.ibSel, { [it.kind]: id });
      markRead(id);
      K.render();
      // Erst beim Öffnen schreibt die KI – nur wenn es noch keinen Inhalt gibt und niemand anderes gerade schreibt
      if (!it.turns.length && !it.error && !(it.pending && Date.now() - it.pending.at < LOCK_MS)) generate(id);
    } else if (act === 'retry' && it) generate(id);
    else if (act === 'new') newOwn(b.dataset.kind);
    else if (act === 'skill' && it) {
      const p = st.ibPick[id] || (st.ibPick[id] = []); const n = b.dataset.name, i = p.indexOf(n);
      if (i >= 0) p.splice(i, 1); else p.push(n);
      saveDraft(id); K.render();
    } else if (act === 'send' && it) {
      const m = K.model, c = CONF(), ta = document.getElementById('ib-text-' + id), text = ta ? ta.value.trim() : '';
      const aspect = !!(document.getElementById('ib-aspect-' + id) || {}).checked;
      if (!text) { if (ta) ta.focus(); return; }
      if (aspect && m.skillPoints < c.costAspect) { K.toast(`Für den Aspekt fehlen ${K.fmt(c.costAspect - m.skillPoints)} Skillpunkte.`); return; }
      const rolls = roll(m, (st.ibPick[id] || []), aspect);
      if (aspect) spendSkill(c.costAspect);
      edit(id, x => { x.turns.push({ who: 'us', text, rolls, aspect, at: Date.now() }); });
      delete (st.ibDraft || {})[id]; delete st.ibPick[id];
      generate(id);
    } else if ((act === 'done' || act === 'reopen') && it) { edit(id, x => { x.status = act === 'done' ? 'done' : 'open'; }); K.rebuild(); }
    else if (act === 'forget') {
      K.store.update(s => { const l = (s.memory || {})[b.dataset.name]; if (l) l.splice(Number(b.dataset.i), 1); }); K.rebuild();
    }
  });
  // Entwurf merken, damit Neuaufbau (z. B. Nachricht vom Mitspieler) nichts löscht
  const saveDraft = id => { const ta = document.getElementById('ib-text-' + id); if (ta) { K.state.ibDraft = K.state.ibDraft || {}; K.state.ibDraft[id] = ta.value; } };
  document.addEventListener('input', e => { const x = /^ib-text-(.+)$/.exec(e.target.id || ''); if (x) saveDraft(x[1]); });

  K.inbox = { afterShow, generate, buildMessages, items, DEVICE };
})(window.KHW);
