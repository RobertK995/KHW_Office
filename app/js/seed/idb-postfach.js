// KHW Manager – Startlisten für das IDB: News, Mails und Termine (ersetzt Interaktionen und HK Casino Bar).
// Kurze Beispiele, gedacht zum Ausbauen im IDB-Editor. Variablen wie {wrestler:show=Lucky7} ziehen echte Wrestler.
// Die alten Listen „Absender …“ und „Themen …“ aus der Tabelle werden dabei gelöscht.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const list = (name, a) => ({ name, entries: a.map(text => ({ text })) });
  K.IDB_SEEDS = (K.IDB_SEEDS || []).concat([{
    key: 'postfach-v1',
    // Alte Absender-/Themenlisten samt Zuordnung entfernen
    patch(db) {
      const gone = db.lists.filter(l => /^(absender|themen)\b/i.test(l.name)).map(l => l.id);
      db.lists = db.lists.filter(l => !gone.includes(l.id));
      if (db.links) Object.keys(db.links).forEach(k => {
        if (/^interaction\.(sender|topic|reward)/.test(k)) delete db.links[k];
        else db.links[k] = db.links[k].filter(id => !gone.includes(id));
      });
      if (db.guessed) db.guessed = db.guessed.filter(k => !/^interaction\.(sender|topic|reward)/.test(k));
    },
    lists: [
      list('Mail: Absender · KHW', [
        '{wrestler:show=Lucky7} (nach der letzten Show)', '{wrestler:show=TryOut} (hat zuletzt verloren)',
        '{wrestler:show=Lucky7;status=Main Event} (Main-Event-Star)', '{team:show=Lucky7} (Tag Team)', '{wrestler:show=TryOut;status=Newcomer} (Neuling)',
      ]),
      list('Mail: Absender · Fremde', [
        '{wrestler:show=keine} (sucht einen Vertrag)', '{wrestler:besonderheit=EX KHW} (Ex-KHW, will zurück)', '{wrestler:promotion=Wrestlution} (von der Konkurrenz)',
      ]),
      list('Mail: Absender · Sonstige', [
        'Hasso Klotz, Anwalt der Brauerei Pittermännchen (Sponsor)', 'Gabi Gerstner, Reporterin beim Ringtratsch', 'Ordnungsamt Köln-Deutz',
        'Die Mutter von {wrestler:show=TryOut}', 'Kevin (42), Präsident des KHW-Fanclubs', 'Heinz Pflaume, Hausmeister des HK Casino', 'Influencerin Mandy Mega (2 Mio. Follower)',
      ]),
      list('Mail: Themen', [
        'will mehr Sendezeit', 'fühlt sich vom Booking übergangen', 'bietet einen dubiosen Deal an', 'will eine Titelchance', 'droht mit Kündigung',
        'hat peinliche Fotos von jemandem', 'will Werbung im Ring platzieren', 'braucht dringend Geld', 'schlägt eine absurde PR-Aktion vor', 'beschwert sich über das Catering',
      ]),
      list('Interaktion: Tonalität', [
        'wütend', 'schleimig', 'verzweifelt', 'größenwahnsinnig', 'verschwörerisch', 'überdreht fröhlich', 'passiv-aggressiv', 'betrunken', 'beleidigt',
      ]),
      list('Termin: Personen', [
        '{wrestler:show=Lucky7}', '{wrestler:show=TryOut}', '{team:show=Lucky7}', 'Ralf Rüdiger, Chef der Brauerei Pittermännchen', 'Dr. Pillmann, Ringarzt mit fragwürdiger Lizenz', 'Gabi Gerstner vom Ringtratsch',
      ]),
      list('Termin: Orte', [
        'im Büro', 'an der Bar des HK Casino', 'in der Umkleide', 'im Parkhaus', 'beim Catering', 'im Krankenhaus', 'auf dem Domplatz', 'im Brauhaus',
      ]),
      list('Termin: Anlass', [
        'will unter vier Augen reden', 'hat ein Geheimnis ausgeplaudert', 'eskaliert gerade', 'braucht einen Gefallen', 'fordert eine Entschuldigung', 'macht ein unmoralisches Angebot',
      ]),
      list('News: Quellen', [
        'Ringtratsch (Klatschblatt)', 'Kölner Express', 'WrestleWatch (Podcast)', 'Social Media', 'Wrestlution (Konkurrenz)',
      ]),
      list('News: Schlagzeilen', [
        '{wrestler:show=Lucky7} mit Prinzenmütze im Karneval erwischt', 'Fans fordern Rückkehr von {wrestler:besonderheit=EX KHW}', 'Gerücht: Trennung bei {team:show=Lucky7}?',
        'Wrestlution lästert über KHW', '{wrestler:show=TryOut} startet eigene Kochshow', 'Werbespot des Sponsors löst Shitstorm aus', 'Wer war der Mann mit der Maske im HK Casino?',
      ]),
    ],
  }]);
})(window.KHW);
