// KHW Manager – Regeln für Arbeitsverträge.
// Nachgebaut aus Vertrag.gs und den Formeln im Blatt „Vertrag“. Reine Spiellogik: Diese Funktionen
// rechnen nur und wissen nichts von Oberfläche oder Speicher.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const R = K.randBetween;

  // Preisbausteine, Forderungen, Aufschlag, Verfügbarkeit, Abbruch und Laufzeiten stehen im Regelwerk
  // (rules/config.js, Admin-Seite „Regelwerk“). „Main Event“ ist in der Tabelle der Sonst-Fall.
  const CF = () => K.conf.get('contract');
  const tierOf = status => CF().prices[status] ? status : 'Main Event';

  /** Würfelergebnis → Gewicht in der Verhandlung. */
  const WEIGHT = { 'Voller Erfolg': 2, 'Erfolg': 1, 'absoluter Gleichstand': 0, 'Gleichstand': -1, 'Fehlschlag': -2 };

  K.rules = K.rules || {};
  K.rules.contract = {
    get DURATIONS() {
      const c = CF();
      return [...(c.once ? ['Einmalig'] : []), ...Array.from({ length: Math.max(1, c.maxMonths || 12) }, (_, i) => i + 1)];
    },
    SHOWS: ['TryOut', 'Lucky7'],

    /** Neuer, leerer Entwurf. */
    draft(person, duration, show) {
      return { person: person || '', duration: duration || 'Einmalig', show: show || 'Lucky7', stage: 'setup', picks: [], proposal: '', counterPrice: null };
    },

    /** Die laufende Spielwoche, z. B. "1-3" (Februar, Woche 3). Pro Wrestler gibt es ein Angebot je Spielwoche. */
    week(m) {
      const d = m.curDate;
      // Ab Jahr 5 mit Jahr davor, damit sich Wochen verschiedener Jahre nicht gleichen
      return d ? `${d.year > K.YEAR ? d.year + ':' : ''}${d.month}-${d.week}` : String(m.currentShow);
    },
    weekLabel(m) {
      const d = m.curDate;
      return d ? `${K.MONTHS[d.month]}, Woche ${d.week}${d.year !== K.YEAR ? ` · Jahr ${d.year}` : ''}` : '';
    },

    /**
     * Angebot einholen (Knopf „Angebot einholen“): Preis, Forderungen, Alternativangebot und die verdeckten
     * Würfe der Spielleitung. Entspricht Vertrag() → scriptA/scriptB + VertragWurf().
     * draw(listName, ctx, exclude) zieht einen Eintrag aus dem IDB (K.idbDraw) und liefert { id, text } oder null.
     * Gezogen wird aus den Verwendungen contract.demands und contract.concessions (Zuordnung im Admin-Modus).
     */
    requestOffer(d, w, draw, skills, week) {
      const c = CF(), p = c.prices[tierOf(w && w.status)];
      const once = d.duration === 'Einmalig';
      const tf = d.show === 'TryOut' ? (once ? p.tryOnce : p.tryMonths) : 1;
      const out = Object.assign({}, d, { week, stage: 'offered', negotiating: false, picks: [], proposal: '', counterPrice: null, answer: null, neg: null, accepted: null });
      // Die Spielleitung würfelt verdeckt gegen jede Fertigkeit: Zufall von 0 bis 40 − Stufe/2.
      out.rolls = skills.map(s => ({ name: s.name, lvl: s.lvl, roll: K.rand(41 - (s.lvl || 0) / 2) }));

      if (once) {
        // Einmalige Auftritte: manchmal ist der Wrestler gerade nicht zu haben (Standard: 1 von 4 Fällen).
        if (K.random() * 100 < (c.unavailable || 0)) return Object.assign(out, { stage: 'unavailable', price: null, demands: [], alt: null });
        out.price = Math.round(p.base + R(p.lo, p.hi) * p.step * tf);
        out.demands = [];
        out.alt = null;
        return out;
      }

      out.price = Math.round(d.duration * c.monthFactor * p.perMonth + R(p.lo, p.hi) * p.step * tf);
      // Alternative: mehr Geld (Standard 25 %), dafür macht der Wrestler ein Zugeständnis. Der Preis steht vorher fest,
      // weil manche Forderungen sich darauf beziehen (z. B. Zusatzhonorar = Angebot 2 / 300).
      const altPrice = Math.round(out.price * (1 + (c.altMarkup || 0) / 100));
      const ctx = { person: w, show: d.show, contract: { price: out.price, altPrice, duration: d.duration } };
      // Forderungen je Einstufung (Standard: Newcomer keine, Lowercard und Midcard eine, ab Uppercard zwei; nie zweimal dieselbe).
      const status = tierOf(w && w.status);
      const count = Number(c.demands[status]) || 0;
      const picked = [];
      out.demands = [];
      for (let i = 0; i < count; i++) {
        const x = draw('contract.demands', ctx, picked);
        if (x) { picked.push(x.id); out.demands.push(x.text); }
      }
      const conc = draw('contract.concessions', ctx, []);
      out.alt = { price: altPrice, concession: conc ? conc.text : 'keine Besonderheiten' };
      out.demandText = '';
      return out;
    },

    /** Ergebnis eines Wurfs, nur für angehakte Fertigkeiten sinnvoll. */
    results(d) {
      return (d.rolls || []).filter(r => d.picks.includes(r.name)).map(r => Object.assign({}, r, { result: K.skillResult(r.lvl, r.roll) }));
    },

    /**
     * Verhandlung (Knopf „Verhandlung starten“): Ein Punktwert aus den angehakten Würfen entscheidet, wie weit
     * der Wrestler beim Preis nachgibt. Ergebnis: Angebot 1 und 2 bleiben unverändert, dazu kommt Angebot 3 (neg)
     * mit Preis und Bedingungen aus der Verhandlung. Bricht der Wrestler ab, ist alles vom Tisch.
     * Ausgang und Gehalt stehen hier fest. Den Antworttext und die Bedingungen schreibt danach die KI (contract.js);
     * die Texte hier sind nur der Ersatz, falls die KI nicht antwortet.
     */
    negotiate(d, w) {
      const res = this.results(d);
      // Nur die Würfe zählen (Bindung und Beliebtheit gibt es nicht mehr).
      const score = res.reduce((s, r) => s + (WEIGHT[r.result] || 0), 0);
      const give = Math.max(0, Math.min(.35, .04 + score * .04));   // höchster Nachlass, den er akzeptiert
      const ask = d.counterPrice && d.counterPrice < d.price ? 1 - d.counterPrice / d.price : 0;
      const name = d.person;
      let outcome, price = d.price, text;

      if (score <= CF().abort) {
        outcome = 'abbruch'; price = null;
        text = `${name} steht auf. „Mit diesem Auftreten brauchen wir gar nicht weiterzureden.“ Das Angebot ist vom Tisch.`;
      } else if (!ask) {
        outcome = 'einig';
        text = `${name} nickt. „Dann sind wir uns einig.“ Die Bedingungen bleiben wie angeboten.`;
      } else if (ask <= give) {
        outcome = 'einig'; price = d.counterPrice;
        text = `${name} überlegt kurz. „In Ordnung, ${K.eur(price)} – aber dann will ich auch liefern dürfen.“`;
      } else if (score >= 0) {
        outcome = 'mitte'; price = Math.round(d.price * (1 - give) / 10) * 10;
        text = `${name} schüttelt den Kopf. „So tief gehe ich nicht. ${K.eur(price)} ist mein letztes Wort.“`;
      } else {
        outcome = 'nein';
        text = `${name} lacht. „Netter Versuch. ${K.eur(d.price)} oder ihr sucht euch jemand anderen.“`;
      }
      const answer = { text, outcome, score, results: res, price, placeholder: true };
      if (price === null) return Object.assign({}, d, { stage: 'unavailable', answer, neg: null });
      // Lehnt er ab, bleibt alles wie angeboten: kein drittes Angebot.
      if (outcome === 'nein') return Object.assign({}, d, { stage: 'negotiated', answer, neg: null });
      // Ersatz, bis die KI die vereinbarten Bedingungen zusammenfasst: unser Vorschlag, sonst die Forderungen aus Angebot 1.
      const terms = d.proposal && d.proposal.trim()
        ? [`Vereinbart: ${d.proposal.trim()}`]
        : (d.demands || []).map(x => `${name} fordert ${x}`);
      return Object.assign({}, d, { stage: 'negotiated', answer, neg: { price, terms, placeholder: true } });
    },

    /**
     * Vertrag annehmen. Liefert, was sich dadurch ändert – gebucht wird in der Ansicht über den Speicher.
     * which: 'main' (Angebot 1), 'alt' (Angebot 2) oder 'neg' (Angebot 3 aus der Verhandlung).
     */
    accept(d, which, m) {
      const price = which === 'alt' ? d.alt.price : which === 'neg' ? d.neg.price : d.price;
      const once = d.duration === 'Einmalig';
      const terms = which === 'alt' ? [`${d.person} bietet ${d.alt.concession}`]
        : which === 'neg' ? d.neg.terms.slice()
        : (d.demands || []).map(x => `${d.person} fordert ${x}`);
      const w = m.byName.get(d.person);
      // Laufzeit: Ein laufender Vertrag wird verlängert (die Monate kommen auf sein Ende drauf), sonst ab dem aktuellen Monat.
      // Beispiel: im Oktober 3 Monate → bis Januar (des nächsten Jahres). Der Vertrag gilt einschließlich des Endmonats.
      const running = w && w.contractEndAbs !== null && w.contractEndAbs >= m.curAbs;
      const endAbs = once ? null : (running ? w.contractEndAbs : m.curAbs) + Number(d.duration);
      const endStore = endAbs === null ? '' : `${K.MONTHS[endAbs % 12]} Jahr ${Math.floor(endAbs / 12)}`;
      return {
        record: {
          person: d.person, duration: d.duration, show: d.show, price, terms, which,
          signedAt: m.currentShow, endMonth: endAbs === null ? '' : K.monthText(endAbs, m.curYear), extended: !!running, answer: d.answer ? d.answer.text : '',
        },
        booking: { text: `Vertrag ${d.person} (${once ? 'einmalig' : d.duration + ' Monate'}, ${d.show})`, amount: -price, show: m.currentShow },
        // Einmalig: Der Vertrag steht am Wrestler und erlischt nach seinem ersten Auftritt (Show beenden).
        // Mit Laufzeit wechselt der Wrestler zur KHW und in die Show.
        wrestler: once ? { onceContract: { show: d.show, since: K.MONTHS[m.curDate.month] + ', Woche ' + m.curDate.week } } : {
          show: d.show, promotion: 'KHW', contractEnd: endStore,
          notes: [w && w.notes, ...terms].filter(Boolean).join(' · '),
        },
      };
    },
  };
})(window.KHW);
