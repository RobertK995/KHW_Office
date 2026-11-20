// KHW Manager – Speicherschicht des Klickdummys.
//
// Die Tabelle bleibt unangetastet. Alles, was im Klickdummy passiert, liegt als „Änderungen“ hier
// und wird beim Aufbau des Modells über den Stand der Tabelle gelegt. Gespeichert wird vorerst im Browser.
// Später wird nur diese Datei gegen Supabase getauscht; Regeln und Ansichten bleiben gleich.
//
// Aufbau des Zustands (gemeinsam für alle Spieler):
//   offers    – Vertragsangebote je Wrestler { "Name": { week, stage, price, … } }, eins pro Spielwoche
//   drafts    – sonstige laufende Vorgänge je Bereich
//   contracts – abgeschlossene Verträge (Archiv)
//   bookings  – Kontobewegungen [{ text, amount, show }]
//   wrestlers – geänderte Felder je Wrestler { "Name": { show, promotion, contractEnd, notes, elo, status } }
//   shows     – bearbeitete Shows je Schlüssel (Shownummer oder „x1“ für Sonder-Events):
//               { matches: [...], venue: { land, stadt, halle }, name, ended, result }
//   extras    – zusätzliche Shows (Sonder-Events) [{ key, name, month, day }]
//   game      – Spielstand: currentShow, stars (Summe neuer Sterne), followers (Summe neuer Follower),
//               lastFollowerDelta, lastStars, lastResult (letzte Abrechnung)
//
// Gemeinsam vs. pro Tab: Alles hier sehen beide Spieler. Was jemand gerade anschaut (Seite, gewählter Wrestler,
// offene Liste …) liegt dagegen in K.state und gilt nur für diesen Tab.
// Abgleich: Ändert ein Tab den Zustand, bekommen die anderen Tabs das über das „storage“-Ereignis sofort mit
// (K.onRemoteChange). Später übernimmt Supabase Realtime diese Rolle zwischen Geräten.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const KEY = 'khw-klickdummy-v1';
  // added: neu aufgenommene Wrestler (stehen nicht in der Tabelle), vollständige Datensätze wie in der Datenbank
  // staff: Mitarbeiterplätze je Nummer, sobald im Klickdummy etwas daran passiert ist (ersetzt dann den Stand der Tabelle)
  const blank = () => ({ offers: {}, drafts: {}, contracts: [], bookings: [], wrestlers: {}, shows: {}, extras: [], game: {}, titles: {}, series: {}, added: [], staff: {} });

  const skey = () => (K.cloud ? K.cloud.key(KEY) : KEY);   // im Testmodus die Test-Kopie
  function load() {
    try { const raw = localStorage.getItem(skey()); if (raw) return Object.assign(blank(), JSON.parse(raw)); } catch (e) { /* ohne Speicher: leerer Stand */ }
    return blank();
  }

  let state = load();
  // Browser-Kopie (mit Supabase nur Zwischenspeicher) und Meldung an den Abgleich (cloud.js)
  const local = () => { try { localStorage.setItem(skey(), JSON.stringify(state)); } catch (e) { /* nur bis zum Neuladen */ } };
  const save = () => { local(); if (K.cloud) K.cloud.changed('stand'); };
  if (K.cloud) K.cloud.register('stand', 'khw_stand', () => state, obj => { state = Object.assign(blank(), obj || {}); local(); }, local);

  K.store = {
    get state() { return state; },
    /** Ändert den Zustand und speichert ihn sofort (mit Supabase: für alle Geräte). */
    update(fn) {
      fn(state);
      // Gespeichert werden nur die letzten 30 Kontobewegungen: jede neue schiebt die älteste raus (auch aus Supabase).
      // Ihr Betrag bleibt nur als unsichtbare Zahl (game.carry) im Kontostand, angezeigt wird er nicht.
      if (state.bookings.length > K.store.KEEP_BOOKINGS) {
        const old = state.bookings.splice(0, state.bookings.length - K.store.KEEP_BOOKINGS);
        state.game.carry = (state.game.carry || 0) + old.reduce((t, b) => t + b.amount, 0);
      }
      save();
    },
    /** Ersetzt den ganzen Stand (Admin: gesicherten Stand laden). */
    replace(obj) {
      state = Object.assign(blank(), obj || {});
      save();
    },
    /** Verwirft alle Änderungen des Klickdummys; danach gilt wieder nur die Tabelle. Notizen bleiben. */
    reset() {
      const notes = state.notes;
      state = blank();
      if (notes) state.notes = notes;
      save();
    },
    get dirty() {
      return state.contracts.length > 0 || state.bookings.length > 0 || state.extras.length > 0 || state.added.length > 0 || !!state.groups || !!state.stories || (state.inbox || []).length > 0 || Object.keys(state.renames || {}).length > 0 ||
        ['wrestlers', 'drafts', 'offers', 'shows', 'game', 'titles', 'series', 'staff', 'storage'].some(k => Object.keys(state[k] || {}).length > 0);
    },

    /* ── Über das Modell legen (wird von K.buildModel aufgerufen) ── */
    patchRoster(roster) {
      // Neu aufgenommene Wrestler anhängen (Name, den es in der Tabelle schon gibt, wird übersprungen)
      (state.added || []).forEach(x => {
        if (roster.some(w => w.name === x.name)) return;
        roster.push(Object.assign({ gender: '', status: '', alignment: '', show: '', promotion: '', tagTeam: '', mixedTeam: '', stable: '', injury: '', contractEnd: '',
          gimmick: '', notes: '', popularity: null, bond: null, personal: '', music: '', image: '', elo: 1000, titles: [], storyline: '' }, x, { added: true }));
      });
      const known = new Set(roster.map(w => w.name));
      Object.entries(state.wrestlers).forEach(([name, patch]) => {
        if (!known.has(name)) return;
        Object.assign(roster.find(w => w.name === name), patch);
      });
    },
    KEEP_BOOKINGS: 30,
    patchFinance(f) {
      // Kontobewegungen mit Namen. Die Tabelle kennt nur Beträge, deshalb heißen ihre Einträge „Startbetrag“ / „Buchung n“.
      // Angezeigt werden nur die letzten 30 Bewegungen, ohne Übertrag (Wunsch des Nutzers). Der Kontostand zählt trotzdem alles.
      const all = f.ledger.map((v, i) => ({ text: i === 0 ? 'Startbetrag' : 'Buchung ' + i, amount: v }));
      if (state.game.carry) f.ledger.push(state.game.carry);
      state.bookings.forEach(b => { f.ledger.push(b.amount); all.push({ text: b.text, amount: b.amount, show: b.show, manual: b.manual }); });
      f.entries = all.slice(-K.store.KEEP_BOOKINGS);
      f.balance = f.ledger.reduce((a, b) => a + b, 0);
      f.bookings = state.bookings.slice();
      const g = state.game;
      if (g.followers) {
        f.followers = (f.followers || 0) + g.followers;
        f.tiers.forEach(t => { t.level = t.steps.filter(x => f.followers >= x).length; t.next = t.steps[t.level] || null; });
      }
      if (g.lastFollowerDelta !== undefined) f.followerDelta = g.lastFollowerDelta;
      if (g.lastStars !== undefined) f.stars.lastShow = g.lastStars;
      if (g.lastResult) { f.last = g.lastResult; f.bets = g.lastResult.betRows || []; }
    },
    /** Titelwechsel: titles = { "Titelname": [{ holder, show }] } in zeitlicher Reihenfolge. */
    patchTitles(titles) {
      Object.entries(state.titles || {}).forEach(([name, changes]) => {
        let t = titles.find(x => x.name === name);
        if (!t) { t = { name, holder: '', former: [], section: '' }; titles.push(t); }
        // Regentschaften (älteste zuerst): Stand der Tabelle ohne Datum, Wechsel aus der App mit Show (→ Wochen zählbar)
        t.reigns = [...t.former.slice().reverse(), ...(t.holder ? [t.holder] : [])].map(h => ({ holder: h, show: null }));
        changes.forEach(c => {
          if (t.holder && t.holder !== c.holder) t.former = [t.holder, ...t.former];
          if (t.holder !== c.holder) t.reigns.push({ holder: c.holder, show: c.show });
          t.holder = c.holder;
        });
      });
    },
    patchStaff(st) { if (state.game.stars) st.stars = (st.stars || 0) + state.game.stars; },
    currentShow(fromSheet) { return state.game.currentShow || fromSheet; },
  };

  // Änderungen aus einem anderen Tab übernehmen (Mitspieler oder zweites Fenster). Mit Supabase kommt das über Realtime.
  window.addEventListener('storage', e => {
    if (K.cloud && K.cloud.on) return;
    if (e.key !== KEY && e.key !== null) return;
    state = load();
    if (K.onRemoteChange) K.onRemoteChange();
  });

  /** Echter Zufall aus dem Zufallsgenerator des Browsers: Kommazahl von 0 (eingeschlossen) bis 1 (ausgeschlossen). */
  K.random = () => {
    const buf = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    return buf[0] / 4294967296;
  };
  /** Ganze Zahl von 0 bis unter n (n darf eine Kommazahl sein, wie Math.floor(Math.random() * n)). */
  K.rand = n => (n <= 0 ? 0 : Math.floor(K.random() * n));
  /** Ganze Zahl zwischen a und b (beide eingeschlossen), wie RANDBETWEEN in der Tabelle. */
  K.randBetween = (a, b) => a + K.rand(b - a + 1);
  K.pick = list => list[K.rand(list.length)];
})(window.KHW);
