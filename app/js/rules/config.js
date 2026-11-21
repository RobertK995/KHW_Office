// KHW Manager – Regelwerk: alle einstellbaren Zahlen und Regeln an einer Stelle.
//
// DEFAULTS enthält die Werte aus der Tabelle bzw. aus den bisherigen Regeln. Was im Admin-Modus auf der Seite
// „Regelwerk“ geändert wird, liegt bereichsweise darüber (localStorage „khw.rules“) und gilt sofort für beide Spieler.
// Wie das IDB übersteht das Regelwerk „Klickdummy zurücksetzen“; „Stand sichern/laden“ nimmt es mit.
// Texte gehören ins IDB, Zahlen und Regeln hierher. Später wandert beides in die Datenbank.
//
// Lesen:   K.conf.get('halls')                       → aktueller Stand eines Bereichs (nicht verändern!)
// Ändern:  K.conf.edit('halls', v => { … })         → Kopie bearbeiten, speichern
// Zurück:  K.conf.reset('halls')                    → wieder die Standardwerte
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const KEY = 'khw.rules';

  const DEFAULTS = {
    /* Vertrag (aus Vertrag.gs, scriptA/scriptB) */
    contract: {
      // Preisbausteine je Einstufung:
      //   Einmalig  → base + Zufall(lo…hi) × step × TryOut-Faktor (tryOnce)
      //   Laufzeit  → Monate × monthFactor × perMonth + Zufall(lo…hi) × step × TryOut-Faktor (tryMonths)
      prices: {
        'Newcomer':   { base: 450,  perMonth: 350,  lo: 1, hi: 5,  step: 450,  tryOnce: 0.25, tryMonths: 0.35 },
        'Lowercard':  { base: 760,  perMonth: 860,  lo: 1, hi: 8,  step: 850,  tryOnce: 0.25, tryMonths: 0.35 },
        'Midcard':    { base: 1260, perMonth: 1460, lo: 2, hi: 8,  step: 850,  tryOnce: 0.25, tryMonths: 0.35 },
        'Uppercard':  { base: 2400, perMonth: 2600, lo: 4, hi: 10, step: 850,  tryOnce: 0.25, tryMonths: 0.3 },
        'Main Event': { base: 3020, perMonth: 3160, lo: 6, hi: 12, step: 1450, tryOnce: 0.5,  tryMonths: 0.5 },
      },
      demands: { 'Newcomer': 0, 'Lowercard': 1, 'Midcard': 1, 'Uppercard': 2, 'Main Event': 2 },   // Forderungen in Angebot 1
      monthFactor: 2.5,     // Laufzeit-Preis: Monate × Faktor × Monatsbetrag
      altMarkup: 25,        // Angebot 2: so viel Prozent mehr Gehalt (dafür ein Zugeständnis)
      unavailable: 25,      // Einmalig: Wahrscheinlichkeit in %, dass der Wrestler gerade nicht verfügbar ist
      abort: -4,            // Verhandlung: ab diesem Punktwert (oder darunter) bricht der Wrestler ab
      once: true,           // „Einmalig“ als Zeitraum anbieten
      maxMonths: 12,        // längste Laufzeit in Monaten
      // KI-Antwort in der Verhandlung (Grundregeln der Spielwelt kommen aus „Postfach“). Ausgang und Gehalt bestimmen die Würfe.
      aiSentences: 3, aiMaxTokens: 200,
    },

    /* Hallen (Finanzen!A26:K55). Nur der Hallentyp zählt für die Rechnung, Land und Stadt sind Kosmetik.
       price   Ticketpreis Preisklasse 1 [PPV, normal]; Klasse 2 = ×1,5, Klasse 3 = ×2 (noClass3: keine Klasse 3)
       sold    verkaufte Tickets je Preisklasse [von, bis]          ads   zusätzlich durch Werbung
       vip     verkaufte VIP-Tickets Klasse 1 und 2                 vipPrice  VIP-Preis [PPV, normal]
       insurance  Versicherung [von, bis] (×0,98)                   rent  Miete: base + Anstieg mit Followern (grow, null = fest) */
    halls: {
      'HK Casino': { capacity: 490, price: [16.99, 11.99], noClass3: true, sold: [[100, 300], [30, 150], [0, 0]], ads: [[100, 300], [30, 150], [0, 0]],
        vip: [[1, 25], [1, 15]], vipPrice: [100, 100], insurance: [360, 1805], rent: { base: 12500, offset: 40, grow: null } },
      'Klassische Sportarena': { capacity: 1270, price: [19.99, 16.99], sold: [[250, 800], [80, 250], [50, 150]], ads: [[250, 800], [0, 250], [0, 150]],
        vip: [[0, 50], [0, 20]], vipPrice: [199, 169], insurance: [2800, 3020], rent: { base: 80000, offset: 400, grow: 0.45 } },
      'Großes OutdoorStadion 2': { capacity: 20200, price: [24.99, 19.99], sold: [[4000, 12000], [2000, 6000], [650, 2000]], ads: [[0, 2400], [0, 1200], [0, 400]],
        vip: [[0, 150], [0, 50]], vipPrice: [299, 199], insurance: [15000, 20000], rent: { base: 250000, offset: 40, grow: 2.35 } },
      'Großes OutdoorStadion 1': { capacity: 40350, price: [24.99, 19.99], sold: [[7500, 22500], [3000, 10000], [2500, 7500]], ads: [[0, 4500], [0, 2000], [0, 1500]],
        vip: [[0, 250], [0, 100]], vipPrice: [299, 249], insurance: [20000, 25000], rent: { base: 500000, offset: 40, grow: 1.45 } },
      'Freiluft Bühne': { capacity: 50500, price: [34.99, 24.99], sold: [[8000, 25000], [4500, 15000], [3000, 10000]], ads: [[0, 5000], [0, 3000], [0, 2000]],
        vip: [[0, 300], [0, 200]], vipPrice: [499, 299], insurance: [25000, 29000], rent: { base: 2000000, offset: 40, grow: 1.75 } },
      'IndoorStadion': { capacity: 70750, price: [38.49, 29.99], sold: [[12000, 40000], [6500, 20000], [5000, 15000]], ads: [[0, 8000], [0, 4000], [0, 3000]],
        vip: [[0, 500], [0, 250]], vipPrice: [499, 349], insurance: [29000, 34000], rent: { base: 4000000, offset: 40, grow: 0.45 } },
      // In der Tabelle gibt es nur die Miete (M4, −100.000 €); alle anderen Werte sind Annahmen.
      'Besondere Arena': { capacity: 8000, price: [29.99, 22.99], sold: [[1500, 5000], [600, 2000], [300, 1000]], ads: [[0, 1500], [0, 600], [0, 300]],
        vip: [[0, 100], [0, 40]], vipPrice: [249, 199], insurance: [8000, 12000], rent: { base: 100000, offset: 40, grow: 0.45 }, assumed: true },
    },

    /* Finanzen */
    finance: {
      discounts: [0, 25, 50, 75],               // wählbare Rabattstufen (Store und Veranstaltungsorte)
      fees: { ads: 20000, sponsoring: 40000 },  // M10 Werbung, M11 Großes Sponsoring
      adDiscount: 20,                           // mit Werbung: so viel Prozent Nachlass auf die Werbekosten
      prices: { abo: null, ppv: null },         // KHW+ Monatspreis und PPV-Preis; leer = Wert aus der Tabelle (U3/U4)
      stream: { production: [2000, 3800], internet: 850 },
      merch: [   // Vor Ort: Anteil (%) der Zuschauer einer Preisklasse × Stückpreis; online: Zufallsbetrag
        { label: 'Poster', cls: 0, share: [2, 8], price: 11.95, online: [550, 990] },
        { label: 'T-Shirts, Caps und Masken', cls: 1, share: [2, 12], price: 16.95, online: [1500, 3900] },
        { label: 'Autogramme und Unikate', cls: 2, share: [2, 6], price: 120.95, online: [1000, 2600], rare: true },   // online nur selten
      ],
      staff: [3200, 5750],                      // Personal für den Merch-Stand [von, bis]
    },

    /* Mitarbeiter (aus Mitarbeiter.gs). Zeiten laufen in echter Zeit, wie bisher in der Tabelle. */
    staff: {
      capacity: [10, 10, 5, 5, 5, 5],          // Lagerplätze für Vorteile je Platz 1–6
      unlock: [null, null, null, null, { money: 400000, stars: 400 }, { money: 800000, stars: 800 }],   // Freischalten (Platz 5 und 6 sind gesperrt)
      rareChance: 30,                          // % seltene Bewerber
      money: { normal: [2000, 20000, 200], rare: [10000, 250000, 1000] },   // Gehalt [von, bis, Schritt]
      stars: { normal: [20, 90, 10], rare: [100, 250, 10] },                // Sterne beim Einstellen [von, bis, Schritt]
      contractDays: [1, 30],                   // Vertragsdauer in Tagen
      prodShare: { normal: [5, 20], rare: [10, 25] },   // Produktionszeit in % der Vertragsdauer
      cooldownMinutes: 30, cooldownStars: 20,  // Ablehnen / Platz räumen
      // Schmiede: Vorteile einsetzen (während der Laufzeit gesperrt, danach weg), Ergebnis kommt ins Lager.
      // rareChance = Wahrscheinlichkeit in %, dass das Ergebnis aus der Liste der seltenen Vorteile kommt (Skript: 70 %).
      forge: { hours: 24, stars: 50, upgrade: { count: 5, rareChance: 100 }, recycle: { count: 3, rareChance: 70 } },
    },

    /* Storylines: Belohnung beim Abschluss (aus StoryBelohnung). Je Wert wird ein Faktor zufällig gezogen und
       mit der Zahl der Wochen multipliziert, in denen die Story aktiv war. Main-Event-Beteiligte bringen Bonus-Sterne. */
    stories: { skill: [0, 3, 4, 5], skillFactor: 2.5, stars: [0, 4, 6], money: [0, 500, 750, 1000, 2000], meBonus: 25 },

    /* Postfach (News, Mails, Termine). Nach jeder beendeten Show entstehen 0–4 Einträge, Mails haben Vorrang. */
    inbox: {
      count: [15, 30, 30, 15, 10],                       // Wahrscheinlichkeit in % für 0, 1, 2, 3, 4 Einträge
      kinds: { mail: 55, meet: 25, news: 20 },          // Anteil je Art nach einer normalen Show
      kindsPPV: { mail: 40, meet: 45, news: 15 },       // nach einem PPV öfter Termine
      costOwn: 20, costAspect: 40, aspectBonus: 20,     // Skillpunkte: eigene Mail/Termin, Aspekt; Aspekt-Bonus auf den Wurf
      finalAfter: 4,                                    // ab so vielen eigenen Antworten soll es auf ein Ergebnis zulaufen
      sentences: 4, newsSentences: 2, maxTokens: 220,   // Länge der KI-Antworten (Token sparen)
      // Grundregeln an die KI (geht bei jeder Anfrage mit, deshalb kurz)
      system: 'Du bist die Spielwelt eines Wrestling-Management-Rollenspiels für Erwachsene. KHW (Knight & Hustler Wrestling) ist eine Wrestling-Liga aus Köln: '
        + 'wöchentlich die Shows TryOut (Nachwuchs) und Lucky7 im HK Casino, dazu PPVs. Die Spieler sind Mr. Knight und Mr. Hustler, die Eigentümer. '
        + 'Stil: überzeichnete Satire einer absurden Medienwelt, Figuren als Stereotypen, kein Kayfabe (echte Menschen hinter den Gimmicks). '
        + 'Du sprichst nur für die anderen Figuren, nie für Knight und Hustler, und entscheidest nichts für sie. '
        + 'Deutsch. Keine Einleitung, keine Listen, nichts wiederholen. Zeitangaben nur in Wochen.',
    },

    /* Lager: Bild je Kategorie (Adresse), leer = Platzhalter aus img/lager */
    storage: { images: {} },
    /* Fertigkeiten (Charisma, Athletik …): eigene Stufe je Fertigkeit; nicht eingetragen = Wert aus der Tabelle.
       Gilt überall, wo gewürfelt wird (Vertrag, Postfach). */
    skills: { levels: {} },
    /* Ranking: Status-Stufen nach Platz je Show und Geschlecht („TryOut|m“ …). Ohne Eintrag gelten die Farben der Tabelle.
       { unit: 'count' | 'pct', 'Main Event': n, Uppercard: n, Midcard: n, Lowercard: n } – wer danach kommt, ist Newcomer. */
    ranking: { bands: {} },

    /* Store: null = Artikel aus der Tabelle (Finanzen G3:I19). Sonst [{ name, cost, discountable }] mit cost als Ausgabe (positiv). */
    store: null,

    /* Titel */
    titles: {
      extra: ['Try me Out'],   // zusätzliche Titel (z. B. vakant, die Tabelle erkennt Titel nur an ihrem Träger)
      hidden: [],              // ausgeblendete Titel
      // Haupttitel je Show (Label der Showreihe) und Geschlecht, z. B. für „Titelchance“-Forderungen im Vertrag
      main: { Lucky7: { m: 'Lucky7 Champion (Male)', w: 'Lucky7 Champion (Female)' }, TryOut: { m: 'Try me Out', w: 'King of the Kingdom' } },
    },
  };

  const clone = v => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));
  let over = {};
  const skey = () => (K.cloud ? K.cloud.key(KEY) : KEY);   // im Testmodus die Test-Kopie
  function load() { try { over = JSON.parse(localStorage.getItem(skey()) || '{}') || {}; } catch (e) { over = {}; } }
  const local = () => { try { localStorage.setItem(skey(), JSON.stringify(over)); } catch (e) { /* nur bis zum Neuladen */ } };
  function save() { local(); if (K.cloud) K.cloud.changed('regelwerk'); }
  load();
  if (K.cloud) K.cloud.register('regelwerk', 'khw_regelwerk', () => over, obj => { over = obj || {}; local(); }, local);

  K.conf = {
    SECTIONS: Object.keys(DEFAULTS),
    get: sec => (Object.prototype.hasOwnProperty.call(over, sec) ? over[sec] : DEFAULTS[sec]),
    defaults: sec => clone(DEFAULTS[sec]),
    changed: sec => Object.prototype.hasOwnProperty.call(over, sec),
    /** Bereich ändern: fn bekommt eine Kopie (oder base, falls der Bereich noch leer ist) und darf sie verändern. */
    edit(sec, fn, base) {
      const cur = K.conf.get(sec);
      const v = clone(cur === null || cur === undefined ? base : cur);
      const r = fn(v);
      over[sec] = r === undefined ? v : r;
      save();
    },
    reset(sec) { delete over[sec]; save(); },
    /** Für „Stand sichern/laden“. */
    all: () => clone(over),
    replace(obj) { over = clone(obj || {}); save(); },
  };

  // Änderungen aus einem anderen Tab übernehmen.
  window.addEventListener('storage', e => {
    if (K.cloud && K.cloud.on) return;   // mit Supabase kommt das über Realtime
    if (e.key !== KEY) return;
    load();
    if (K.onRemoteChange) K.onRemoteChange();
  });
})(window.KHW);
