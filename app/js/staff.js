// KHW Manager – Mitarbeiter (Klickdummy).
// Nachgebaut aus Mitarbeiter.gs, die vier Knöpfe je Platz zu einem Ablauf zusammengelegt:
//
//   gesperrt ──Freischalten (Geld + Sterne)──► frei ──Bewerber ansehen (LoadMitarbeiter)──► Bewerber
//   Bewerber ──Einstellen (HireMitarbeiter: Sterne + Gehalt, erste Produktion startet)──► eingestellt
//   Bewerber ──Ablehnen (LoadCooldown: 20 Sterne, 30 Min.)──► Cooldown ──► frei
//   eingestellt: Produktion fertig ──Einlagern──► Vorteil ins Lager des Platzes (begrenzt: 10 / 10 / 5 / 5 / 5 / 5)
//                noch genug Vertragszeit ──Produktion starten (StartProduction)
//                Vertrag abgelaufen ──Platz räumen (LoadCooldown)──► Cooldown
//
// Zeiten laufen in echter Zeit (wie in der Tabelle). Alle Zahlen stehen im Regelwerk (Bereich „staff“),
// Vorteile und Namen im IDB (Verwendungen staff.*). Gespeichert wird je Platz in store.staff[nr].
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const { esc, eur, fmt } = K;
  const icon = n => `<span class="ms">${n}</span>`;
  const H = 3600 * 1000;
  const CFG = () => K.conf.get('staff');
  const AVATAR = seed => `https://xsgames.co/randomusers/avatar.php?g=pixel&seed=${encodeURIComponent(seed)}`;

  /* ───────────── Stand je Platz ───────────── */
  /** Platz aus der Tabelle in die Form des Klickdummys bringen. */
  function fromSheet(x) {
    const base = { inventory: x.inventory.slice() };
    if (x.state === 'locked') return Object.assign(base, { state: 'locked' });
    if (x.state === 'cooldown') return Object.assign(base, { state: 'cooldown', until: x.target ? x.target.getTime() : 0 });
    if (x.state !== 'employee') return Object.assign(base, { state: 'free' });
    const prod = x.prodTarget ? x.prodTarget.getTime() : null;
    return Object.assign(base, {
      state: x.hired ? 'employee' : 'candidate', name: x.name, money: x.money || 0, stars: x.skill || 0, hours: x.hours || 1,
      contractEnd: x.end ? x.end.getTime() : 0, advantage: x.advantage || '', rare: false, seed: x.end ? String(x.end.getTime()) : x.name,
      // Eine in der Tabelle schon fertige Produktion gilt als eingelagert (das wurde dort von Hand gemacht).
      prodUntil: prod && prod > Date.now() ? prod : null,
    });
  }
  /** Alle sechs Plätze mit abgeleitetem Zustand (phase) für die Anzeige. */
  K.staffSlots = m => {
    const c = CFG(), own = (K.store.state.staff || {}), t = Date.now();
    return m.staff.slots.map(x => {
      const s = own[x.id] ? JSON.parse(JSON.stringify(own[x.id])) : fromSheet(x);
      s.id = x.id;
      s.cap = Number(c.capacity[x.id - 1]) || 5;
      s.inventory = s.inventory || [];
      s.unlock = c.unlock[x.id - 1] || { money: 0, stars: 0 };
      if (s.state === 'cooldown' && s.until <= t) s.phase = 'free';
      else if (s.state === 'employee') {
        s.expired = t >= s.contractEnd;
        s.phase = s.prodUntil && t < s.prodUntil ? 'producing' : s.prodUntil ? 'ready' : 'idle';
        s.canProduce = !s.expired && s.contractEnd - t >= s.hours * H;
      } else s.phase = s.state;
      return s;
    });
  };
  /**
   * Gemeinsames Lager: Jeder Mitarbeiter legt seinen Vorteil hier ab. Größe = Summe der Lagerplätze aller
   * freigeschalteten Plätze (Regelwerk), wächst also mit jedem Freischalten. Gespeichert in store.staff.inv;
   * bis dahin gelten die Vorteile, die in der Tabelle unter den Plätzen lagen.
   */
  // Einträge: { t: Text, lock: true während sie in der Schmiede stecken }
  K.staffStore = m => {
    const slots = K.staffSlots(m), own = (K.store.state.staff || {}).inv;
    const items = (Array.isArray(own) ? own : slots.reduce((a, s) => a.concat(s.inventory), [])).map(x => (typeof x === 'string' ? { t: x } : Object.assign({}, x)));
    const cap = slots.filter(s => s.phase !== 'locked').reduce((n, s) => n + s.cap, 0);
    return { items, cap, full: items.length >= cap, free: items.filter(x => !x.lock) };
  };
  const saveInv = items => K.store.update(st => { st.staff = st.staff || {}; st.staff.inv = items; });

  /** Schmiede: { until, mode } solange sie läuft, sonst null. Phase idle / running / ready. */
  K.staffForge = () => {
    const f = (K.store.state.staff || {}).forge || null;
    return f ? Object.assign({ phase: Date.now() < f.until ? 'running' : 'ready' }, f) : { phase: 'idle' };
  };
  const saveForge = f => K.store.update(st => { st.staff = st.staff || {}; st.staff.forge = f; });

  /** Ordnung im Lager: Art eines Vorteils (für die Ansicht „Nach Art“). */
  const KINDS = [
    ['Hallen und Umbau', 'stadium', /halle|stadion|arena|bühne|casino|sportarena|umbau/i],
    ['Arzt und Verletzungen', 'medical_services', /arzt|verletzung/i],
    ['Sponsoring, Werbung, Follower', 'campaign', /sponsor|werbung|follower/i],
    ['Verträge', 'contract', /vertrag/i],
    ['Training und Skills', 'fitness_center', /train|skill|elo|move/i],
    ['Sonstiges', 'category', /./],
  ];
  const kindOf = t => KINDS.find(k => k[2].test(t));
  /** Gleiche Vorteile zusammenfassen: [{ t, n }] */
  const stacks = items => { const m = new Map(); items.forEach(x => m.set(x.t, (m.get(x.t) || 0) + 1)); return [...m].map(([t, n]) => ({ t, n })).sort((a, b) => b.n - a.n || a.t.localeCompare(b.t, 'de')); };

  /** Gespeicherte Form (ohne abgeleitete Felder). */
  const pure = s => { const o = Object.assign({}, s); ['id', 'cap', 'unlock', 'phase', 'expired', 'canProduce'].forEach(k => delete o[k]); if (o.state === 'cooldown' && o.until <= Date.now()) o.state = 'free'; return o; };
  const save = (id, s) => K.store.update(st => { st.staff = st.staff || {}; st.staff[id] = pure(s); });
  const spendStars = n => K.store.update(st => { st.game.stars = (st.game.stars || 0) - n; });
  const book = (text, amount) => K.store.update(st => { st.bookings.push({ text, amount, show: K.model ? K.model.currentShow : null }); });

  /* ───────────── Bewerber erzeugen (LoadMitarbeiter) ───────────── */
  const draw = (slot, m) => { const h = K.idbDrawSlot ? K.idbDrawSlot(slot, m, {}) : null; return h ? h.text : ''; };
  // Wörter, die als Spitzname nichts taugen (Füllwörter, Adjektive und Verben aus den Vorteilen)
  const STOP = new Set(['um', 'auf', 'für', 'mit', 'von', 'der', 'die', 'das', 'ein', 'eine', 'den', 'dem', 'und', 'ist', 'sind', 'nach', 'ohne', 'eines', 'einen',
    'reduziert', 'rabatt', 'kostenlos', 'kostenlose', 'kostenloser', 'kostenloses', 'zusätzlicher', 'zusätzliche', 'möglich', 'heilen', 'zahlen', 'freigeschaltet',
    'monats', 'monaten', 'monat', 'einem', 'verwendung', 'anpassung', 'zugriff', 'punkte']);
  /** Name wie in der Tabelle: Vor- und Nachname, oft mit einem Wort aus dem Vorteil als Spitzname, höchstens 24 Zeichen. */
  function makeName(first, last, advantage) {
    first = first || 'Max'; last = last || 'Mustermann';
    const role = (/\[(.*?)\]/.exec(advantage) || [])[1];
    const words = advantage.replace(/\[.*?\]/g, '').split(/[\s,.\-!/]+/).filter(w => w.length > 2 && isNaN(w) && !STOP.has(w.toLowerCase()));
    const nick = words.length ? K.pick(words) : '';
    const r = K.randBetween(1, 100);
    let name = r <= 40 || !nick ? `${first} ${last}`
      : r <= 70 ? `${first} "${nick}" ${last}`
      : r <= 85 ? `${first}-${nick} ${last}`
      : r <= 95 ? `"${nick}" ${first} ${last}`
      : `${first} ${last}-${nick}`;
    name = `${name}${role ? ` [${role}]` : ''}`;
    if (name.length > 24) name = name.replace(/-[A-Za-zÄÖÜäöüß]+/, '');
    if (name.length > 24) name = `${first} ${last}${role ? ` [${role}]` : ''}`;
    if (name.length > 24) name = name.slice(0, 21) + '…';
    return name;
  }
  function candidate(m) {
    const c = CFG(), rare = K.random() * 100 < c.rareChance, kind = rare ? 'rare' : 'normal';
    const step = ([a, b, s]) => a + K.rand(Math.floor((b - a) / (s || 1)) + 1) * (s || 1);
    const end = new Date();
    end.setDate(end.getDate() + K.randBetween(c.contractDays[0], c.contractDays[1]));
    end.setHours(K.rand(24), 0, 0, 0);
    const [lo, hi] = c.prodShare[kind];
    const hours = Math.max(1, Math.ceil(Math.max(1, (end - Date.now()) / H) * (lo + K.random() * (hi - lo)) / 100));
    const advantage = draw(rare ? 'staff.advantageRare' : 'staff.advantage', m) || 'Vorteil';
    return {
      state: 'candidate', name: makeName(draw('staff.firstName', m), draw('staff.lastName', m), advantage),
      money: step(c.money[kind]), stars: step(c.stars[kind]), hours, contractEnd: end.getTime(), advantage, rare,
      seed: K.random().toString(36).slice(2, 10), prodUntil: null,
    };
  }

  /* ───────────── Ansicht ───────────── */
  const until = (ms, done) => `<span class="countdown" data-until="${ms}" data-done="${esc(done)}"></span>`;
  const when = ms => new Date(ms).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const btn = (label, act, id, opt = {}) => `<button class="btn ${opt.cls || 'primary'} sm" data-staff="${act}" data-id="${id}" ${opt.disabled ? `disabled title="${esc(opt.disabled)}"` : ''}>${opt.icon ? icon(opt.icon) : ''}${esc(label)}</button>`;
  const skip = (id, what) => K.admin && K.admin.on ? `<button class="btn icon sm-ic" data-staff="skip" data-id="${id}" data-what="${what}" title="Admin: Zeit sofort ablaufen lassen">${icon('fast_forward')}</button>` : '';

  function person(s) {
    return `<div class="st-person"><img src="${esc(AVATAR(s.seed))}" alt="" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">
      <div><b>${esc(s.name)}</b>${s.rare ? '<span class="chip accent">selten</span>' : ''}<small>${s.state === 'candidate' ? 'Bewerber' : 'eingestellt'}</small></div></div>`;
  }
  const facts = rows => `<dl class="st-facts">${rows.filter(Boolean).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;

  function slotBody(m, s, stars, full) {
    const c = CFG();
    if (s.phase === 'locked') {
      const short = stars < s.unlock.stars ? `Es fehlen ${fmt(s.unlock.stars - stars)} Sterne.` : '';
      return `<div class="st-state">${icon('lock')}<p>Gesperrt</p><b>${eur(s.unlock.money, true)} · ${fmt(s.unlock.stars)} Sterne</b></div>
        <div class="st-actions">${btn('Freischalten', 'unlock', s.id, { icon: 'lock_open', disabled: short })}</div>`;
    }
    if (s.phase === 'cooldown') return `<div class="st-state">${icon('hourglass_top')}<p>Cooldown</p><b>${until(s.until, 'Neuer Mitarbeiter verfügbar')}</b>${skip(s.id, 'until')}</div>`;
    if (s.phase === 'free') return `<div class="st-state">${icon('person_add')}<p>Neuer Mitarbeiter verfügbar</p></div>
        <div class="st-actions">${btn('Bewerber ansehen', 'load', s.id, { icon: 'person_search' })}</div>`;
    if (s.phase === 'candidate') {
      const days = Math.max(0, (s.contractEnd - Date.now()) / H / 24);
      return person(s) + facts([['Gehalt', `<b>${eur(s.money, true)}</b>`], ['Sterne', `<b>${fmt(s.stars)}</b>`], ['Vertrag', `${fmt(days, 1)} Tage · bis ${when(s.contractEnd)}`],
        ['Produktion', `${fmt(s.hours)} Stunden je Vorteil`], ['Vorteil', esc(s.advantage)]])
        + `<div class="st-actions">${btn('Einstellen', 'hire', s.id, { icon: 'how_to_reg', disabled: stars < s.stars ? `Es fehlen ${fmt(s.stars - stars)} Sterne.` : '' })}
          ${btn(`Ablehnen (${fmt(c.cooldownStars)} Sterne)`, 'reject', s.id, { cls: 'tonal', icon: 'person_off', disabled: stars < c.cooldownStars ? 'Nicht genug Sterne für den Cooldown.' : '' })}</div>`;
    }
    // eingestellt
    const prod = s.phase === 'producing' ? `${until(s.prodUntil, 'fertig')}${skip(s.id, 'prodUntil')}`
      : s.phase === 'ready' ? '<b class="pos">fertig, bereit zum Einlagern</b>'
      : s.expired ? '<span class="muted">keine (Vertrag abgelaufen)</span>' : s.canProduce ? '<span class="muted">bereit für eine neue</span>' : '<span class="muted">Vertragszeit reicht nicht mehr</span>';
    let acts = '';
    if (s.phase === 'ready') {
      acts += btn(s.canProduce ? 'Einlagern und neu starten' : 'Einlagern', 'collect', s.id, { icon: 'move_to_inbox', disabled: full ? 'Das Lager ist voll. Erst einen Vorteil einlösen.' : '' });
    } else if (s.phase === 'idle' && s.canProduce) acts += btn('Produktion starten', 'produce', s.id, { icon: 'play_arrow' });
    if (s.expired && s.phase !== 'producing') acts += btn(`Platz räumen (${fmt(c.cooldownStars)} Sterne)`, 'dismiss', s.id, { cls: s.phase === 'ready' ? 'tonal' : 'primary', icon: 'logout', disabled: stars < c.cooldownStars ? 'Nicht genug Sterne für den Cooldown.' : '' });
    else if (!s.expired) acts += `<button class="btn text sm" data-staff="dismiss" data-id="${s.id}">Vorzeitig entlassen</button>`;
    return person(s) + facts([
      ['Vertrag', s.expired ? '<b class="neg">abgelaufen</b>' : `${until(s.contractEnd, 'abgelaufen')} ${skip(s.id, 'contractEnd')}<small>bis ${when(s.contractEnd)}</small>`],
      ['Produktion', prod], ['Dauer', `${fmt(s.hours)} Stunden je Vorteil`], ['Vorteil', esc(s.advantage)],
    ]) + `<div class="st-actions">${acts}</div>`;
  }

  // Schmiede-Werte aus dem Regelwerk; Fehlendes (z. B. aus einem älteren Stand) kommt aus den Standardwerten.
  /**
   * Upgraden: derselbe Vorteil eine Stufe höher. Gesucht wird in den Vorteils-Listen des IDB ein Eintrag mit gleichem
   * Text, nur mit der nächsthöheren Zahl, z. B. „Rabatt auf HK Casino um 25%“ → „… um 50%“, „500 Follower“ → „1000 Follower“.
   * Gibt es keinen (höchste Stufe), lässt sich der Vorteil nicht upgraden.
   */
  const slotTexts = slot => {
    if (!K.idbApi) return [];
    const ids = K.idbApi.links()[slot] || [];
    return K.idbApi.lists().filter(l => ids.includes(l.id)).flatMap(l => l.entries.map(e => String(e.text).trim())).filter(Boolean);
  };
  // Die Stufe ist die Prozentzahl (z. B. „um 25%“), sonst die erste Zahl. Andere Zahlen gehören zum Namen
  // (z. B. „Großes OutdoorStadion 2“) und müssen gleich bleiben.
  const level = s => { const p = /(\d+)\s*%/.exec(s) || /(\d+)/.exec(s); return p ? { n: Number(p[1]), key: (s.slice(0, p.index) + s.slice(p.index).replace(p[1], '#')).replace(/\s+/g, ' ').trim().toLowerCase() } : null; };
  // Prozent-Vorteile: Die höchste Stufe ist „Kostenlos …“ (entspricht 100 %). Gibt es dafür keinen eigenen Eintrag
  // in den Listen, wird die 100-%-Fassung gebildet (z. B. „Arztkosten um 100% reduziert“).
  const FILL = new Set(['rabatt', 'auf', 'um', 'reduziert', 'für', 'einen', 'eine', 'der', 'die', 'das']);
  const words = s => s.toLowerCase().replace(/\d+\s*%?/g, ' ').split(/[^a-zäöüß]+/).filter(w => w.length > 1 && !FILL.has(w));
  K.staffUpgrade = t => {
    const me = level(t);
    if (!me || /^kostenlos/i.test(t.trim())) return null;
    const pool = [...new Set(slotTexts('staff.advantage').concat(slotTexts('staff.advantageRare')))];
    const up = pool.map(x => ({ x, l: level(x) })).filter(o => o.l && o.l.key === me.key && o.l.n > me.n).sort((a, b) => a.l.n - b.l.n);
    if (up.length) return up[0].x;
    if (!/%/.test(t) || me.n >= 100) return null;   // ohne Prozent kein „Kostenlos“; 100 % ist schon das Maximum
    const need = words(t);
    const free = pool.find(x => /^kostenlos/i.test(x.trim()) && need.length && need.every(w => x.toLowerCase().includes(w)));
    return free || t.replace(/(\d+)(\s*%)/, '100$2');
  };

  const FORGE = () => {
    const d = K.conf.defaults('staff').forge, f = CFG().forge || {};
    const pickNum = (a, b) => (typeof a === 'number' ? a : b);
    return { hours: pickNum(f.hours, d.hours), stars: pickNum(f.stars, d.stars), upgrade: Object.assign({}, d.upgrade, f.upgrade), recycle: Object.assign({}, d.recycle, f.recycle) };
  };
  const MODE = { upgrade: 'Upgraden', recycle: 'Recyceln' };

  /**
   * Gemeinsames Lager, gleiche Vorteile zusammengefasst. Zwei Ansichten zur Wahl (Layout-Schalter oben rechts):
   *   stack – eine Liste, häufigste zuerst         cats – nach Art gruppiert (Hallen, Arzt, Sponsoring …)
   * Wählt man gerade Vorteile für die Schmiede, fügt ein Klick auf einen Stapel einen davon hinzu.
   */
  function inventory(inv, layout) {
    const pick = K.state.forgePick, sel = pick ? pick.sel : [];
    const need = FORGE().upgrade.count;
    const row = s => {
      // Upgraden: ein Klick legt genau 5 gleiche hinein; nur Vorteile, die man oft genug hat und die eine nächste Stufe haben
      if (pick && pick.mode === 'upgrade') {
        const next = s.n >= need ? K.staffUpgrade(s.t) : null, on = pick.sel[0] === s.t;
        const note = s.n < need ? `nur ${s.n}× – es braucht ${need}` : next ? `→ ${next}` : 'höchste Stufe';
        return `<li class="${next ? 'pickable' : 'off'} ${on ? 'chosen' : ''}" ${next ? `data-staff="pick-up" data-t="${esc(s.t)}"` : ''}><b class="st-n">${s.n}×</b><span>${esc(s.t)}<small class="st-next">${esc(note)}</small></span>${on ? `<span class="st-chosen">${need} gewählt</span>` : ''}</li>`;
      }
      const chosen = sel.filter(t => t === s.t).length;
      const act = pick
        ? `${chosen ? `<span class="st-chosen">${chosen} gewählt</span><button class="btn icon" data-staff="unpick" data-t="${esc(s.t)}" title="Einen weniger">${icon('remove')}</button>` : ''}`
        : `<button class="btn icon" data-staff="redeem" data-t="${esc(s.t)}" title="Einen einlösen (aus dem Lager nehmen)">${icon('redeem')}</button>`;
      return `<li class="${pick ? 'pickable' : ''} ${chosen ? 'chosen' : ''}" ${pick ? `data-staff="pick" data-t="${esc(s.t)}"` : ''}><b class="st-n">${s.n}×</b><span>${esc(s.t)}</span>${act}</li>`;
    };
    const free = stacks(inv.free);
    let body;
    if (!free.length) body = '<p class="empty">Keine freien Vorteile im Lager.</p>';
    else if (layout === 'cats') {
      body = KINDS.map(([label, ic]) => {
        const g = free.filter(s => kindOf(s.t)[0] === label);
        if (!g.length) return '';
        return `<div class="st-kind"><h5>${icon(ic)}${esc(label)} <small>${g.reduce((n, s) => n + s.n, 0)}</small></h5><ul class="st-stack">${g.map(row).join('')}</ul></div>`;
      }).join('');
      body = `<div class="st-kinds">${body}</div>`;
    } else body = `<ul class="st-stack cols">${free.map(row).join('')}</ul>`;
    const locked = inv.items.length - inv.free.length;
    const pct = inv.cap ? Math.min(100, inv.items.length / inv.cap * 100) : 100;
    return `<section class="card st-store"><header class="card-h"><h3>${icon('inventory_2')}Lager</h3>
        <span class="st-fill"><span class="bar"><i style="width:${pct}%"></i></span><b>${inv.items.length} / ${inv.cap}</b>${inv.full ? '<span class="chip accent">voll</span>' : ''}</span></header>
      <div class="card-b">${pick ? `<p class="st-pickhint">${icon('touch_app')}${pick.mode === 'upgrade' ? `Upgraden: Auf einen Vorteil klicken, den du mindestens ${need}× hast. Ein Klick legt ${need} davon in die Schmiede.` : 'Für die Schmiede auf einen Vorteil klicken, um ihn einzusetzen.'}</p>` : ''}${body}
      <p class="hint">Gemeinsam für alle Mitarbeiter, jeder freigeschaltete Platz vergrößert das Lager.${locked ? ` ${locked} Vorteile stecken gerade in der Schmiede (gesperrt, zählen mit).` : ''} Ist es voll, erst einen Vorteil einlösen.</p></div></section>`;
  }

  /** Schmiede: Vorteile einsetzen (5 zum Upgraden, 3 zum Recyceln), 24 Stunden und 50 Sterne, Ergebnis ins Lager. */
  function forgeCard(inv, stars) {
    const F = FORGE(), f = K.staffForge(), pick = K.state.forgePick;
    let body;
    if (f.phase === 'running' || f.phase === 'ready') {
      const used = inv.items.filter(x => x.lock).map(x => x.t);
      body = `<div class="st-state">${icon(f.phase === 'ready' ? 'task_alt' : 'local_fire_department')}<p>${MODE[f.mode] || 'Schmiede'}${f.to ? `<br><small>Ergebnis: ${esc(f.to)}</small>` : ''}</p>
          <b>${f.phase === 'ready' ? 'fertig' : `${until(f.until, 'fertig')}${K.admin && K.admin.on ? ` <button class="btn icon sm-ic" data-staff="forge-skip" data-id="0" title="Admin: Zeit sofort ablaufen lassen">${icon('fast_forward')}</button>` : ''}`}</b></div>
        <h5 class="st-sub">Eingesetzt (gesperrt)</h5><ul class="st-stack">${stacks(used.map(t => ({ t }))).map(s => `<li class="locked"><b class="st-n">${s.n}×</b><span>${esc(s.t)}</span>${icon('lock')}</li>`).join('')}</ul>
        ${f.phase === 'ready' ? `<div class="st-actions">${btn('Ergebnis abholen', 'forge-collect', 0, { icon: 'move_to_inbox' })}</div>` : ''}`;
    } else if (pick && pick.mode === 'upgrade') {
      const need = F.upgrade.count, t = pick.sel[0];
      body = `<div class="st-state">${icon('upgrade')}<p>Upgraden: ${need} gleiche Vorteile → nächste Stufe</p>
          ${t ? `<b>${need}× ${esc(t)}</b><small class="st-to">→ ${esc(pick.to)}</small>` : '<b>noch keiner gewählt</b>'}</div>
        <div class="st-actions">${btn(`Upgraden starten (${fmt(F.stars)} Sterne)`, 'forge-start', 0, { icon: 'local_fire_department', disabled: !t ? 'Erst einen Vorteil im Lager wählen.' : stars < F.stars ? 'Nicht genug Sterne.' : '' })}
          <button class="btn text sm" data-staff="forge-cancel" data-id="0">Abbrechen</button></div>`;
    } else if (pick) {
      const need = F[pick.mode].count, n = pick.sel.length;
      body = `<div class="st-state">${icon('touch_app')}<p>${MODE[pick.mode]}: ${need} Vorteile einsetzen</p><b>${n} / ${need} gewählt</b></div>
        <div class="st-actions">${btn(`${MODE[pick.mode]} starten (${fmt(F.stars)} Sterne)`, 'forge-start', 0, { icon: 'local_fire_department', disabled: n !== need ? `Genau ${need} Vorteile wählen.` : stars < F.stars ? 'Nicht genug Sterne.' : '' })}
          <button class="btn text sm" data-staff="forge-cancel" data-id="0">Abbrechen</button></div>`;
    } else {
      const canUp = stacks(inv.free).some(s => s.n >= F.upgrade.count && K.staffUpgrade(s.t));
      const opt = mode => {
        const x = F[mode];
        const why = mode === 'upgrade'
          ? (!canUp ? `Kein Vorteil, den ihr ${x.count}× habt und der eine nächste Stufe hat.` : stars < F.stars ? 'Nicht genug Sterne.' : '')
          : (inv.free.length < x.count ? `Dafür braucht es ${x.count} freie Vorteile im Lager.` : stars < F.stars ? 'Nicht genug Sterne.' : '');
        const sub = mode === 'upgrade' ? `${x.count} gleiche Vorteile → derselbe Vorteil eine Stufe höher` : `${x.count} beliebige Vorteile → zufälliger neuer Vorteil (${fmt(x.rareChance)} % selten)`;
        return `<div class="st-mode"><b>${MODE[mode]}</b><small>${sub}</small>${btn(mode === 'upgrade' ? 'Vorteil wählen' : 'Vorteile wählen', 'forge-pick', 0, { cls: 'tonal', icon: mode === 'upgrade' ? 'upgrade' : 'recycling', disabled: why }).replace('data-id="0"', `data-id="0" data-mode="${mode}"`)}</div>`;
      };
      body = `<p class="hint">${fmt(F.hours)} Stunden und ${fmt(F.stars)} Sterne. Die eingesetzten Vorteile sind so lange gesperrt und verschwinden danach, das Ergebnis kommt ins Lager.</p>${opt('upgrade')}${opt('recycle')}`;
    }
    return `<section class="card st-forge"><header class="card-h"><h3>${icon('construction')}Schmiede</h3></header><div class="card-b">${body}</div></section>`;
  }

  K.views.staff = {
    title: 'Mitarbeiter', icon: 'engineering',
    // Seite im Layout „Raster“, Lager in der Ansicht „Nach Art“ (beides vom Nutzer gewählt).
    render(m) {
      const sf = m.staff, slots = K.staffSlots(m), stars = sf.stars || 0, inv = K.staffStore(m);
      const fg = K.staffForge();
      const head = `<div class="kpis">
          <div class="kpi">${icon('star')}<div><small>Sterne</small><b>${fmt(stars, 2)}</b><span>für Einstellen, Cooldown und Freischalten</span></div></div>
          <div class="kpi">${icon('account_balance')}<div><small>Kontostand</small><b>${eur(m.finance.balance, true)}</b><span>Gehälter werden sofort gebucht</span></div></div>
          <div class="kpi">${icon('inventory_2')}<div><small>Lager</small><b>${inv.items.length} / ${inv.cap}</b><span>gemeinsam für alle Mitarbeiter</span></div></div>
          <div class="kpi">${icon('construction')}<div><small>Schmiede</small><b>${fg.phase === 'running' ? until(fg.until, 'fertig') : fg.phase === 'ready' ? 'fertig' : 'bereit'}</b><span>${fg.phase === 'idle' ? `${fmt(FORGE().hours)} Std. · ${fmt(FORGE().stars)} Sterne` : MODE[fg.mode]}</span></div></div></div>`;
      const cards = slots.map(s => `<section class="card st-slot st-${s.phase}"><header class="card-h"><h3>Platz ${s.id}</h3>
          <span class="chip outline" title="So viel bringt dieser Platz ins gemeinsame Lager">${s.phase === 'locked' ? '+' : ''}${s.cap} Lagerplätze</span></header>
        <div class="card-b"><div class="st-main">${slotBody(m, s, stars, inv.full)}</div></div></section>`).join('');
      return `${head}<div class="st-wrap st-grid">${cards}</div>
        <div class="grid g-2-1 st-bottom">${inventory(inv, 'cats')}${forgeCard(inv, stars)}</div>
        <p class="hint">${icon('schedule')} Zeiten laufen in echter Zeit, wie in der Tabelle.</p>`;
    },
  };

  /* ───────────── Bedienung ───────────── */
  const slotOf = id => K.staffSlots(K.model).find(s => s.id === id);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-staff]');
    if (!b || b.disabled || !K.model) return;
    const m = K.model, id = Number(b.dataset.id), s = slotOf(id), c = CFG(), act = b.dataset.staff;
    if (!s && id !== 0 && !b.dataset.t) return;   // Lager und Schmiede (id 0 bzw. data-t) betreffen keinen Platz
    const stars = m.staff.stars || 0;
    const done = msg => { K.rebuild(); if (msg) K.toast(msg); };

    if (act === 'unlock') {
      K.dialog.confirm({ title: `Platz ${id} freischalten?`, icon: 'lock_open', ok: 'Freischalten',
        text: `Kosten: ${eur(s.unlock.money)} und ${fmt(s.unlock.stars)} Sterne.\nDanach kann hier ein Mitarbeiter arbeiten (Lager: ${s.cap} Plätze).` })
        .then(yes => {
          if (!yes) return;
          if ((K.model.staff.stars || 0) < s.unlock.stars) { K.toast('Nicht genug Sterne.'); return; }
          spendStars(s.unlock.stars); if (s.unlock.money) book(`Mitarbeiter: Platz ${id} freigeschaltet`, -s.unlock.money);
          save(id, { state: 'free', inventory: s.inventory });
          done(`Platz ${id} freigeschaltet`);
        });
    } else if (act === 'load') {
      save(id, Object.assign(candidate(m), { inventory: s.inventory }));
      done();
    } else if (act === 'hire') {
      if (stars < s.stars) { K.toast('Nicht genug Sterne.'); return; }
      K.dialog.confirm({ title: `${s.name} einstellen?`, icon: 'how_to_reg', ok: 'Einstellen',
        text: `Gehalt: ${eur(s.money)} (wird sofort gebucht)\nSterne: ${fmt(s.stars)}\nVertrag bis ${when(s.contractEnd)}\n\nDie erste Produktion startet sofort (${fmt(s.hours)} Stunden).` })
        .then(yes => {
          if (!yes) return;
          spendStars(s.stars); book(`Mitarbeiter: ${s.name}`, -s.money);
          save(id, Object.assign({}, s, { state: 'employee', hiredAt: Date.now(), prodUntil: Date.now() + s.hours * H }));
          done(`${s.name} eingestellt · Produktion läuft`);
        });
    } else if (act === 'reject' || act === 'dismiss') {
      const early = act === 'dismiss' && !s.expired;
      if (stars < c.cooldownStars) { K.toast(`Für den Cooldown fehlen ${fmt(c.cooldownStars - stars)} Sterne.`); return; }
      const lost = act === 'dismiss' && (s.phase === 'ready' || s.phase === 'producing') ? '\nDie laufende oder fertige Produktion geht verloren.' : '';
      K.dialog.confirm({ title: act === 'reject' ? `${s.name} ablehnen?` : early ? `${s.name} vorzeitig entlassen?` : 'Platz räumen?', icon: 'person_off', danger: early, ok: act === 'reject' ? 'Ablehnen' : early ? 'Entlassen' : 'Platz räumen',
        text: `Kosten: ${fmt(c.cooldownStars)} Sterne. Danach ${fmt(c.cooldownMinutes)} Minuten Cooldown, dann ist ein neuer Mitarbeiter verfügbar.${lost}` })
        .then(yes => {
          if (!yes) return;
          spendStars(c.cooldownStars);
          save(id, { state: 'cooldown', until: Date.now() + c.cooldownMinutes * 60 * 1000, inventory: s.inventory });
          done(act === 'reject' ? 'Bewerber abgelehnt' : 'Platz geräumt');
        });
    } else if (act === 'collect') {
      const inv = K.staffStore(m);
      if (inv.full) { K.toast('Das Lager ist voll. Erst einen Vorteil einlösen.'); return; }
      saveInv(inv.items.concat({ t: s.advantage }));
      const next = Object.assign({}, s, { prodUntil: null });
      // Reicht die Vertragszeit, startet die nächste Produktion gleich mit (StartProduction).
      if (s.canProduce) next.prodUntil = Date.now() + s.hours * H;
      save(id, next);
      done(`Eingelagert: ${s.advantage}${s.canProduce ? ' · neue Produktion läuft' : ''}`);
    } else if (act === 'produce') {
      if (!s.canProduce) return;
      save(id, Object.assign({}, s, { prodUntil: Date.now() + s.hours * H }));
      done('Produktion gestartet');
    } else if (act === 'redeem') {
      // Einen Vorteil dieser Art einlösen: er wird gelöscht, die Wirkung tragen die Spieler selbst ein.
      const item = b.dataset.t;
      K.dialog.confirm({ title: 'Vorteil einlösen?', icon: 'redeem', ok: 'Einlösen', text: `${item}\n\nDer Vorteil wird aus dem Lager genommen. Die Wirkung tragt ihr wie bisher selbst ein.` })
        .then(yes => {
          if (!yes) return;
          const inv = K.staffStore(K.model).items, at = inv.findIndex(x => x.t === item && !x.lock);   // aktueller Stand, falls der Mitspieler etwas geändert hat
          if (at < 0) return;
          inv.splice(at, 1);
          saveInv(inv);
          done(`Eingelöst: ${item}`);
        });
    } else if (act === 'forge-pick') {
      K.state.forgePick = { mode: b.dataset.mode, sel: [] }; K.render();
    } else if (act === 'forge-cancel') {
      K.state.forgePick = null; K.render();
    } else if (act === 'pick-up') {
      // Upgraden: ein Klick = 5 gleiche Vorteile in die Schmiede (erneuter Klick auf denselben nimmt sie wieder heraus)
      const p = K.state.forgePick; if (!p || p.mode !== 'upgrade') return;
      const t = b.dataset.t, need = FORGE().upgrade.count, to = K.staffUpgrade(t);
      if (p.sel[0] === t) { p.sel = []; p.to = null; }
      else if (to && K.staffStore(m).free.filter(x => x.t === t).length >= need) { p.sel = Array(need).fill(t); p.to = to; }
      K.render();
    } else if (act === 'pick' || act === 'unpick') {
      const p = K.state.forgePick; if (!p) return;
      const t = b.dataset.t, have = K.staffStore(m).free.filter(x => x.t === t).length, chosen = p.sel.filter(x => x === t).length;
      if (act === 'unpick') { e.stopPropagation(); p.sel.splice(p.sel.lastIndexOf(t), 1); }
      else if (chosen >= have) { K.toast('Von diesem Vorteil sind schon alle gewählt.'); return; }
      else if (p.sel.length >= FORGE()[p.mode].count) { K.toast(`Es sind schon ${FORGE()[p.mode].count} Vorteile gewählt.`); return; }
      else p.sel.push(t);
      K.render();
    } else if (act === 'forge-start') {
      const p = K.state.forgePick, F = FORGE();
      if (!p || p.sel.length !== F[p.mode].count || K.staffForge().phase !== 'idle') return;
      if (stars < F.stars) { K.toast('Nicht genug Sterne.'); return; }
      // Gewählte Vorteile sperren (sie zählen weiter im Lager, verschwinden beim Abholen)
      const items = K.staffStore(m).items, rest = p.sel.slice();
      items.forEach(x => { const j = rest.indexOf(x.t); if (!x.lock && j >= 0) { x.lock = true; rest.splice(j, 1); } });
      if (rest.length) { K.toast('Die Auswahl passt nicht mehr zum Lager. Bitte neu wählen.'); K.state.forgePick = null; K.render(); return; }
      if (p.mode === 'upgrade' && (!p.to || p.sel.some(t => t !== p.sel[0]))) { K.toast('Upgraden geht nur mit gleichen Vorteilen.'); return; }
      spendStars(F.stars); saveInv(items);
      saveForge(Object.assign({ until: Date.now() + F.hours * H, mode: p.mode }, p.mode === 'upgrade' ? { from: p.sel[0], to: p.to } : {}));
      K.state.forgePick = null;
      done(`Schmiede läuft: ${MODE[p.mode]} (${fmt(F.hours)} Std.)`);
    } else if (act === 'forge-collect') {
      const f = K.staffForge(); if (f.phase !== 'ready') return;
      // Upgraden: das beim Start festgelegte nächste Level. Recyceln: Zufall aus den Listen (Chance auf selten laut Regelwerk).
      let result, label;
      if (f.mode === 'upgrade' && f.to) { result = f.to; label = `Upgrade: ${f.from} → ${f.to}`; }
      else {
        const rare = K.random() * 100 < FORGE().recycle.rareChance;
        result = draw(rare ? 'staff.advantageRare' : 'staff.advantage', m) || 'Vorteil';
        label = `${rare ? 'Seltener Vorteil' : 'Vorteil'}: ${result}`;
      }
      saveInv(K.staffStore(m).items.filter(y => !y.lock).concat({ t: result }));
      saveForge(null);
      K.dialog.alert({ title: 'Schmiede fertig', icon: 'construction', text: `${label}\n\nDie eingesetzten Vorteile sind weg, das Ergebnis liegt im Lager.` });
      done();
    } else if (act === 'forge-skip') {
      const f = (K.store.state.staff || {}).forge; if (f) { saveForge(Object.assign({}, f, { until: Date.now() - 1000 })); done(); }
    } else if (act === 'skip') {
      // Admin: Zeit sofort ablaufen lassen (zum Testen)
      save(id, Object.assign({}, s, { [b.dataset.what]: Date.now() - 1000 }));
      done();
    }
  });

  // Läuft eine Zeit ab, die Seite neu aufbauen (neue Knöpfe), aber nicht mitten in einem Dialog.
  setInterval(() => {
    if (!K.state || K.state.view !== 'staff' || document.querySelector('.modal-scrim, .dd-menu')) return;
    const t = Date.now();
    const due = [...document.querySelectorAll('#content [data-until]')].some(el => Number(el.dataset.until) <= t);
    if (due) K.render();
  }, 1000);
})(window.KHW);
