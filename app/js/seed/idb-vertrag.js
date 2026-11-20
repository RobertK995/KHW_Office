// KHW Manager – Startlisten für das IDB: Vertragsbedingungen.
// Übersetzt aus dem Blatt „Vertrag“ (C53:C180 Forderungen, D53:D78 Zugeständnisse). Jede Zeile entspricht einer Zeile der
// Tabelle; doppelte Zeilen bleiben erhalten, weil sie dort die Wahrscheinlichkeit erhöhen.
// Die Listen werden einmalig ins IDB übernommen und danach nur noch im IDB-Editor gepflegt.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const GEGNER = '{wrestler:show=Vertrag;geschlecht=wie Person}';
  const SONGS = 'Kraftschlag|Eminem|Cologne Tape|Taylor Swift|Rammstein|Die Toten Hosen|Beatsteaks|Modeselektor|Fritz Kalkbrenner|Deichkind|KIZ|Kraftwerk|Scooter|Peter Fox|Nina Chuba|Apache 207|Billie Eilish|Ed Sheeran|Metallica|AC/DC|Daft Punk|The Chemical Brothers|Justice|LCD Soundsystem|Gorillaz|The Prodigy|Aphex Twin|Gracie Abrams|Burial|Four Tet|Bonobo';
  const WOHNEN = '{wahl:aus=Vergünstigungen auf Wohnungsmiete in Köln|die Überhame der Miete einer Wohnung im Liga-Umfeld|Erstattungen von Weiterbildungskursen|die Kostenübernahme für eine persönliche Trainer/Betreuer|einen Finanziellen Bonus für besondere Erfolge}';
  const SUPPORT = '{wahl:aus=die Bereitstellung eines persönlichen Trainers zur Verbesserung von Fitness und Technik|den Zugang zu erweiterten Rehabilitations- und medizinischen Dienstleistungen|die Unterstützung bei der Entwicklung eines neuen Finishing Moves|die Bereitstellung eines persönlichen Marketing- und PR-Beraters zur Steigerung der Bekanntheit|den Zugang zu einem spezialisierten Ernährungsberater|die Unterstützung bei der Entwicklung und Umsetzung eines neuen Gimmicks|eine Finanzierung eines persönlichen Ringkostüms von einem Top-Designer|die Bereitstellung eines persönlichen Social Media Managers zur Erhöhung der Online-Präsenz|die Finanzierung von Schauspiel- oder Stimmtraining zur Verbesserung von Promos und Segmenten|einen Zugang zu erweiterten Reise- und Unterkunftsoptionen während Touren und Shows}';
  const MATCH_A = '{wahl:aus=Last Man Standing Match|Falls Count Anywhere Match|Extreme Rules Match zum Vertragsstart|Singles Match|Ladder Match}';
  const SPEKTAKEL = '{wahl:aus=No Holds Barred Match|Last Man Standing Match|Hell in a Cell Match|TLC (Tables, Ladders & Chairs) Match|Singles Match}';
  // Internet!A53 war in der Tabelle eine niedrige Zufallszahl, auf die sich mehrere Einträge beziehen.
  // Hier steht dafür {zahl:von=1;bis=10;mal=…}; die Grenzen lassen sich im IDB-Editor anpassen.

  const FORDERUNGEN = [
    '{person:feld=ausrichtung;wenn1=Face;dann1=einen Heel-Turn;sonst=einen Face-Turn}',
    '{wahl:aus=ein Tables Match|ein Extreme Rules Match|ein Singles Match|ein Tag Team Match|ein Titel Match} zum Vertragsstart',
    '{wahl:aus=einen Sieg im ersten Match|eine Niederlage im ersten Match}',
    'ein Match gegen ' + GEGNER,
    'ein Match gegen ' + GEGNER,
    'die Übernahme der Miete für ein Loft {wahl:aus=in der Altstadt|in der Südstadt|in Ehrenfeld|in Deutz} (Wert: {zahl:von=2500;bis=4500} Euro monatlich)',
    'ein Zusatzhonorar von {zahl:von=200;bis=500} Euro pro Sieg via Pinfall und {zahl:von=600;bis=900} Euro pro Sieg via Submission',
    'einen Zuschuss zu einem {wahl:aus=Ford Mustang|Porsche Cayenne|Tesla Model S} inklusive Tankkarte (Wert: {zahl:von=800;bis=1200} Euro monatlich)',
    'ein Match in einer Outdoor Arena',
    'eine neue Allianz mit einem dominanten Tag Team',
    `die Lizenzierung eines Songs von {wahl:aus=${SONGS}} als neue Einzugsmusik`,
    'einen Sieg gegen ' + GEGNER,
    'einen Sieg gegen ' + GEGNER,
    'einen Tagteam-Run',
    'eine Ruhezeit von einer Show nach jedem Auftritt',
    'eine Siegesserie von mindestens {zahl:von=3;bis=10} Matches',
    'einen Manager, der bei {zahl:von=50;bis=100}% aller Matches am Ring steht',
    `ein {wahl:aus=60 Minute Iron Man Match|Titel vs. Karriere Extreme Rules Match|30 Minute Iron Man No Disqualification Singles Match zum Vertragsstart|Singles Match|Tag Team Elimination Match} gegen ${GEGNER}`,
    `ein ${MATCH_A} gegen ${GEGNER}`,
    `ein ${MATCH_A} gegen ${GEGNER}`,
    'Ein eigenen Interview-Segments namens „The {person} Show“ bei jedem PPV',
    'ein Match gegen einen amtierenden Champion',
    'die Erlabuniss bei anderen Wrestlingligen aufzutreten',
    'ein spezielles Match (z. B. Ladder Match, Cage Match) bei {liga:feld=naechsterPPV}',
    'ein Last Man Standing Match bei dem nächsten PPV gegen {wrestler:promotion=KHW;geschlecht=wie Person}',
    'einen Auftritt bei {liga:feld=naechsterPPV}',
    'einen Gewinn bei einem PPV',
    '2 Matches in unter {zahl:von=3;bis=8} Minuten gewinnen',
    'Kostenlose Werbung des eigenen {wahl:aus=Energy Drinks|Craft Beers|Whiskeys|Detox-Tees} mit großem Logo auf der Ringmatte',
    'ein Match in einem Turnier',
    '{zahl:von=2000;bis=5000} Euro für die Ausbildung eines {wahl:aus=Alpakas das|Schimpansen der|Pinguins der|Mini-Ponys das}, {person} zum Ring begleiten muss.',
    'das erlernen von 3 neuen Moves',
    '{zahl:von=1;bis=6} PPV Teilnahmen',
    "eine Wöchentliche Ganzkörper-Behandlung mit {wahl:aus=echtem Blattgold|vulkanischem Heilschlamm|Eselsmilch} zur Erhaltung des 'Main Event Glows' (Wert: {zahl:von=800;bis=2200} Euro)",
    'einen persönlichen Assistenten, der {person} während der Matches das Wasser reicht und bei Bedarf {person:feld=ausrichtung;wenn1=Heel;dann1=die Fans zum Jubeln animiert;sonst=die Fans beleidigt} (Gehalt: 3000 Euro pro Monat)',
    'eine eigenständige Wrestling-Show zu organisieren (Sonderausgabe oder PPV)',
    'innerhalb des Vertragzeitraum mindestens zwei Titelchancen',
    'innerhalb von drei Monaten eine neue Fehde mit {person:feld=geschlecht;wenn1=m;dann1=einem hochrangigen Wrestler;sonst=einer hochrangigen Wrestlerin} zu starten',
    'einen Auftritt bei {liga:feld=naechsterPPV} und {liga:feld=uebernaechsterPPV}',
    'eine spektakuläre Gesichtsbemalung als Charakterentwicklung',
    'bis Ende nächsten Monats {wahl:aus=das Aushängeschild der Liga|in einem neuen Tag Team|Anführer eines neuen Stables} zu sein',
    '{person:feld=ausrichtung;wenn1=Face;dann1=einen Heel-Turn durch einen unfairen Titelgewinn;sonst=einen Face-Turn durch ein einmaliges Turnier}',
    WOHNEN + ' in einem Wert von {zahl:von=1;bis=10;mal=250} pro Monat',
    `ein {wahl:aus=Iron Man Match|Extreme Rules Match|Tables Match|Singles Match|Tag Team Match} gegen ${GEGNER}`,
    `eine persönliche Rivalität gegen ${GEGNER}, weil {wahl:aus=er/sie mein geheimes Familienrezept für Kartoffelsalat gestohlen hat|er/sie behauptet, mein Finisher sähe aus wie ein missglückter Purzelbaum|er/sie mein Lieblings-T-Shirt im Backstage-Bereich als Putzlappen benutzt hat|ich ihm/ihr noch 15 Euro für eine Pizza aus dem Jahr 2019 schuldest|er/sie mein Haarspray gegen Sekundenkleber ausgetauscht hat}`,
    'einen neuen Einzug',
    `einen Sieg in einem spektakulären ${SPEKTAKEL} gegen ${GEGNER}`,
    'einen Titelgewinn',
    '{wrestler:show=Lucky7;ausrichtung=Heel} als Manager',
    `eine persönliche Feindschaft mit ${GEGNER}, da er/sie {wahl:aus=mein geheimes Notizbuch mit Finisher-Ideen gestohlen hat|behauptet, ich hätte mein letztes Match nur durch Bestechung gewonnen|meinen Parkplatz mit seinem/ihrem Auto blockiert hat|vor der versammelten Kabine mein peinlichstes Highschool-Foto gezeigt hat|meinen teuren Designer-Umhang 'aus Versehen' in die Kochwäsche gesteckt hat}`,
    'einen Ideen Boni zwischen 500 und 5000 Euro für die Entwicklung neuer Storyline-Konzepte',
    'ein Zusatzhonorar von {vertrag:feld=alternative;durch=300;runden=10} Euro pro Match',
    'ein Zusatzhonorar von {vertrag:feld=alternative;durch=180;runden=10} Euro pro Sieg in einem Einzelmatch',
    'eine intensive Best-of-5 Serie gegen {wrestler:show=Vertrag;status=wie Person}, um zu klären, wer in der Kabine von {vertrag:feld=show} die Oberhand hat.',
    'eine Extra Zahlung von {vertrag:feld=alternative;durch=3;runden=100}€ pro gewonnenem Match bei einem PPV',
    `einen Sieg in einem spektakulären ${SPEKTAKEL} gegen ${GEGNER}`,
    'ein Match gegen ' + GEGNER,
    'ein Match gegen ' + GEGNER,
    'einen Titelgewinn',
    'ein neues Gimmick',
    'die Teilnahme an internationalen Wrestling-Events der KHW',
    '{zahl:von=1;bis=6} PPV Teilnahmen',
    '{zahl:von=2;bis=4} Main Event Matches bei kommenden PPVs',
    'volle kreative Kontrolle über den Charakter',
    WOHNEN + ' in einem Wert von {zahl:von=1;bis=10;mal=250} pro Monat',
    'Werbeverträge mit {wahl:aus=New Balance|Under Armour|Asics|Puma|Nike} und das Nutzen derer Produkte im Ring',
    'finanzielle Unterstützung für Trainingscamps, Physiotherapie in einem Wert von {zahl:von=1;bis=10;mal=150} Euro',
    'die garantierte Teilnahme an großen KHW Wrestling-Touren',
    'Bonuszahlungen in einem Wert von {zahl:von=1;bis=10;mal=150} Euro pro Match für 5 Sterne Matches',
    'Bonuszahlungen in einem Wert von {zahl:von=1;bis=10;mal=50} Euro pro Match für 5 Sterne Matches',
    'ein Mitspracherecht bei der Auswahl von Gegnern',
    'Spezielle Eintrittsboni für ausverkaufte Shows zwischen 500 und 5000 Euro',
    'eine Erlaubniss für einen Auftritt bei einer großen Wrestling-Convention oder Fan-Expo',
    'eine eigenständige Wrestling-Show zu organisieren (Sonderausgabe oder PPV)',
    'eine Zusage für einen weiteren Vertrag nach dem aktuellen Vertragzeitraum',
    'einen Sieg gegen ' + GEGNER,
    'einen Sieg gegen ' + GEGNER,
    `ein Match gegen ${GEGNER} mit {wrestler:show=Vertrag} als Special Guest Referee.`,
    `ein Match gegen ${GEGNER} mit {wrestler:show=Vertrag} als Special Guest Referee.`,
    'eine Niederlage gegen ' + GEGNER,
    'die exklusive Partnerschaft mit {wahl:aus=Bulk Powders|GNC|MuscleTech|Optimum Nutrition|Lululemon} inklusive dem Firmen-Logo auf einem Shirt beim Einzug',
    'ein Gimmickwechsel inklusive einem neuen Namen',
    'die exklusiven Recht auf die Verwendung des Wrestling-Charakters in allen Medien',
    'eine gnadenlose Storyline-Fehde gegen das Stable {stable:show=Vertrag}',
    'einen Verkaufsstart von gebrandeten {wahl:aus=Eiscreme-Riegeln|Hot-Sauce-Flaschen|BBQ-Saucen|Frühstücksflocken} an den Imbissständen der Arena.',
    WOHNEN + ' in einem Wert von {zahl:von=1;bis=10;mal=250} Euro pro Monat',
    WOHNEN + ' in einem Wert von {zahl:von=1;bis=10;mal=250} Euro pro Monat',
    'bis Ende nächsten Monats {wahl:aus=das Aushängeschild der Liga|in einem neuen Tag Team|Anführer eines neuen Stables} zu sein',
    `ein spektakuläres Ambulance Match gegen ${GEGNER}, präsentiert von '{wahl:aus=Omas Bio-Abführtee|Bestattungshaus 'Fröhliches Ende'|RedBull-Energy: Geschmackssorte Ringstaub|Glitzer-Glatzen-Politur}'`,
    // C142 und C145: Champions fordern etwas zu ihrem Titel, alle anderen eine Chance auf den Haupttitel ihrer Show.
    '{nurwenn:champion=ja}Garantierter Main Event Slot als {person:feld=titel}.',
    '{nurwenn:champion=ja}Ein Match um die Ehre der {person:feld=titel}.',
    '{nurwenn:champion=ja}Sicherstellung der ökologischen Standards als {person:feld=titel}.',
    '{nurwenn:champion=ja}Prämien-Anpassung aufgrund des Status als {person:feld=titel}.',
    '{nurwenn:champion=nein}Ein Match gegen {titel:name=Vertrags-Show;feld=traeger} um den {titel:name=Vertrags-Show;feld=name} Titel.',
    '{nurwenn:champion=nein}Garantierte Chance auf ein Match um den {titel:name=Vertrags-Show;feld=name} Titel.',
    '{nurwenn:champion=nein}Ein #1 Contender Match für die {titel:name=Vertrags-Show;feld=name}.',
    '{nurwenn:champion=nein}Teilnahme an der Battle Royal um den {titel:name=Vertrags-Show;feld=name} Status.',
    '{nurwenn:champion=nein}Sieg-Klausel: Bei Erfolg sofortiges Match um den {titel:name=Vertrags-Show;feld=name} Titel.',
    '{nurwenn:champion=nein}Ein Triple Threat Match um die {titel:name=Vertrags-Show;feld=name} Krone.',
    WOHNEN + ' in einem Wert von {zahl:von=1;bis=10;mal=250} Euro pro Monat',
    'eine Teilnahme an einem exklusiven Turnier mit hochkarätigen Gegnern',
    'eine Teilnahme am jährlichen Würfel-Wahnsin Rumble mit einem bevorzugten Startplatz',
    'ein Match bei einem internationalen WrestleMania-ähnlichen Event',
    `ein Submission Match gegen ${GEGNER} – Klopfen ist die einzige Option.`,
    'ein spezielles Gastauftritt-Match bei einem renommierten Turnier wie z.B. dem WWE dem King of the Ring',
    'eine Teilnahme an einem Tag Team Turnier',
    'ein Iron Man Match bei einem PPV',
    'ein Championship Match bei einem großen Event',
    'einen exklusive Promo-Slot bei einem der größten Events des Jahres',
    'eine spektakuläre Promo nach einem Main Events gegen {wrestler:promotion=KHW;geschlecht=wie Person}',
    WOHNEN + ' in einem Wert von {zahl:von=1;bis=10;mal=250} Euro pro Monat',
    'eine Teilnahme an einem No Disqualification Match',
    'ein Hell in a Cell Match gegen einen Erzrivalen',
    'ein Loser Leaves Town Match zum Vertragsende',
    'eine Teilnahme an einem Steel Cage Match bei einem großen PPV',
    'ein Falls Count Anywhere Match',
    'ein Tables, Ladders, and Chairs (TLC) Match',
    'ein Match mit einer speziellen Stipulation (First Blood Match)',
    'die Möglichkeit, einen neuen Wrestler als Schützling auszuwählen und zu fördern',
    'eine Teilnahme an einem Tag Team Match mit {wrestler:promotion=KHW;geschlecht=wie Person}',
    'die Teilnahme an einer neuen Matchart, die so noch nie bei KHW stattgefunden hat.',
    'Regelmäßige Trainingssessions in einem Wert von {zahl:von=1;bis=10;mal=20} Euro pro Monat',
    'Ein Mentoring-Segment in der wöchentlichen Show',
    `die Lizenzierung eines Songs von {wahl:aus=${SONGS.replace('|Gracie Abrams', '')}} als neue Musik nach einem Sieg`,
    'die Teilnahme an einem Mentor-vs-Schützling-Match, um den Fortschritt des Schützlings zu zeigen',
    SUPPORT + ' in einem Wert von {zahl:von=1;bis=10;mal=25} Euro pro Monat',
    SUPPORT + ' in einem Wert von {zahl:von=1;bis=10;mal=25} Euro pro Monat',
    SUPPORT + ' in einem Wert von {zahl:von=1;bis=10;mal=25} Euro pro Monat',
    'einen neuen Signatur-Move',
    'ein Match in einem Käfig',
    '{zahl:von=12;bis=28} Sterne',
    '{zahl:von=12;bis=28} Skill Punkte',
    '{zahl:von=12;bis=28} Sterne',
    '{zahl:von=12;bis=28} Skill Punkte',
    'Keine Matches im Monat {liga:feld=monat;plus=1} zu haben.',
    'Keine Matches im Monat {liga:feld=monat;plus=2} zu haben.',
  ];

  const ZUGESTAENDNISSE = [
    "Alle Rechte am Namen '{person}'",
    'eine Rückerstattung von {vertrag:feld=alternative;mal=0.1;runden=0.01} Euro bei vorzeitigem Vertragsende',
    'eine Rückerstattung von {vertrag:feld=alternative;mal=0.2;runden=0.01} Euro bei vorzeitigem Vertragsende',
    '50% Selbstbeteiligung an neuen Kostümen',
    'eine Verpflichtung zur Übernahme von {wahl:aus=25|50|75}% aller medizinischen Behandlungskosten',
    'die Verpflichtung zur Abgabe von {zahl:von=500;bis=2000} Euro an die Promotion für jeden externen Auftritt (Filme, andere Ligen, Autogrammstunden)',
    'in den nächsten {zahl:von=3;bis=6} Matches eine Niederlage ohne Widerspruch gegen jeden beliebigen Gegner zu akzeptieren',
    'Verpflichtung zu {zahl:von=5;bis=10} unentgeltliche Auftritte bei Sponsoren-Events oder Wohltätigkeitsveranstaltungen pro Jahr',
    'als Test-Gegner für {zahl:von=3;bis=5} neue Wrestler anzutreten,',
    'kein Essen vom Catering für den privaten Verzehr mit nach Hause nehmen (Strafe: 50 Euro pro Tupperware-Dose)',
    'eine Strafezahlung von 100 Euro für jedes Fluchen in Hörweite von Fans oder Sponsoren',
    '25% Selbstbeteiligung an neuen Kostümen',
    '25% Selbstbeteiligung an neuen Kostümen',
    '25% Selbstbeteiligung an medizinischen Behandlungskosten',
    '25% Selbstbeteiligung an medizinischen Behandlungskosten',
    'kostenlose Werbung bei den ersten 2 Shows an denen {person:feld=geschlecht;wenn1=m;dann1=er;sonst=sie} teilnimmt',
    'einen Skillpunkt',
    'einen einmaligen kostenlosen Comeback Auftirtt von {wrestler:besonderheit=EX KHW}',
    'einen einmaligen kostenlosen Comeback Auftirtt von {wrestler:besonderheit=EX KHW}',
    'kostenlosen Einsatz von großen Verbrauchsgegenständen (Leitern und Tische), bei {zahl:von=2;bis=6} Shows',
    'kostenlosen Einsatz von  kleinen Verbrauchsgegenständen (Sticks und Stühle), bei {zahl:von=5;bis=10} Shows',
    'kiene Besonderheiten',
    'kiene Besonderheiten',
    'kiene Besonderheiten',
    'kiene Besonderheiten',
    'kiene Besonderheiten',
  ];

  const asEntry = x => typeof x === 'string' ? { text: x } : x;
  K.IDB_SEEDS = (K.IDB_SEEDS || []).concat([{
    key: 'vertrag-v1',
    lists: [
      { name: 'Vertrag: Forderungen', entries: FORDERUNGEN.map(asEntry) },
      { name: 'Vertrag: Zugeständnisse', entries: ZUGESTAENDNISSE.map(asEntry) },
    ],
  }, {
    // Die Antworten der Verhandlung kommen später von der KI (Hugging Face), nicht aus dem IDB.
    // Bereits angelegte Listen „Vertrag: Antwort · …“ samt Zuordnung wieder entfernen.
    key: 'vertrag-v4-ohne-antworten',
    patch(db) {
      const gone = db.lists.filter(l => /^Vertrag: Antwort/.test(l.name)).map(l => l.id);
      db.lists = db.lists.filter(l => !gone.includes(l.id));
      if (db.links) Object.keys(db.links).forEach(k => { if (/^contract\.answer\./.test(k)) delete db.links[k]; else db.links[k] = db.links[k].filter(id => !gone.includes(id)); });
      if (db.guessed) db.guessed = db.guessed.filter(k => !/^contract\.answer\./.test(k));
    },
  }, {
    // Nachtrag für Listen, die schon mit dem Platzhalter für Internet!A53 übernommen wurden.
    key: 'vertrag-v2-internet',
    patch(db) {
      db.lists.filter(l => /^Vertrag: /.test(l.name)).forEach(l => l.entries.forEach(e => {
        if (!/\{liga:feld=internetwert/.test(e.text)) return;
        e.text = e.text.replace(/\{liga:feld=internetwert;mal=(\d+)\}/g, '{zahl:von=1;bis=10;mal=$1}');
        e.todo = false; e.formula = '';
      }));
    },
  }]);
})(window.KHW);
