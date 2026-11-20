// KHW Manager – Startliste für das IDB: Verletzungen.
// Nur der Grund, ohne Zeitraum. Geheilt wird über die Seite „Verletzte“ (Behandlung zum Preis von „Doktor, Doktor..!“).
// Die Einträge sind Beispiele; die Liste wird einmalig übernommen und danach im IDB-Editor gepflegt.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const GRUENDE = [
    'Bänderriss im Knie', 'Gehirnerschütterung', 'ausgekugelte Schulter', 'geprellte Rippen', 'Bandscheibenvorfall',
    'gebrochene Nase', 'Muskelfaserriss im Oberschenkel', 'verstauchter Knöchel', 'Platzwunde über dem Auge', 'Nackenverletzung',
  ];
  K.IDB_SEEDS = (K.IDB_SEEDS || []).concat([{
    key: 'verletzungen-v1',
    lists: [{ name: 'Verletzungen', entries: GRUENDE.map(text => ({ text })) }],
  }]);
})(window.KHW);
