// KHW Manager – Rivalen Aktionen: die Daten.
// Aus dem Blatt „Rivalen Aktionen“ der Google-Tabelle übernommen (Stand 22.11.2026), eine Zeile je Aktion, Reihenfolge wie in der Tabelle.
// Spalten: [Kategorie, Name, Wer ist dabei?, Inhalt, Besonderheit, Tag?, Single?, Zusatz (optional)]
//   Tag? / Single? = 1 oder 0. Zusatz = Angabe aus den Spalten rechts neben „Single?“ (Zahl oder Zeitangabe), sonst weglassen.
// Ändert sich etwas, wird es hier direkt angepasst. Die Seite (rivalen.js) liest nur diese Liste, geschrieben wird nirgends.
// Texte stehen so da wie in der Tabelle (auch Tippfehler wie „Respecktlosigkeit“), damit ein Abgleich mit der Tabelle einfach bleibt.
window.KHW = window.KHW || {};
window.KHW.RIVALS = [
  // ── Überfall ──
  ['Überfall', 'Überfall beim Einzug', '1vs1', 'wird angegriffen von der seite vom ring mit einem elbow aus dem lauf', '', 1, 1],
  ['Überfall', 'Ablenkung und Überfall', '1vs1 gegen 3te', 'nach dem match angreifer kommt von hinten in den ring schlag in nackten, schüchtert ref ein und feiert', 'Opfer muss gewinnen für anschluss-aktion', 1, 1],
  ['Überfall', 'Einzugsangriff durch Dritte', '1vs1 gegen 3te', 'Gegner wartet im Ring. beim einzug angriff von hinten in den nacken schlagen, gegen die treppe schmeißen dann in den ring schmeißen. Anschließend wird der Agreifer vom Ref rausgeschickt', '', 0, 1, '3'],
  ['Überfall', 'Gezieler Arm-Überfall', '1vs1', 'beim einzug von hinten angegriffen und dann in die treppe. nach dem match angreifer holt stuhl und schlägt auf den arm', 'Angreifer muss gewinnen für anschluss-aktion', 1, 1],
  ['Überfall', 'Gezieler Bein-Überfall', '1vs1', 'beim einzug von hinten in die knie angegriffen. nach dem match angreifer holt stuhl und schlägt auf bein', 'Angreifer muss gewinnen für anschluss-aktion', 1, 1],
  ['Überfall', 'Kendo-Angriff nach dem Match', '1vs1 gegen 3te', 'angriff mit kendostick nach dem match und feiert anschließend', 'Opfer muss gewinnen für anschluss-aktion', 1, 1],
  ['Überfall', 'Wilder Angriff nach dem Match', '1vs1 gegen 3te', 'jemand kommt rein und geht auf alle', '', 0, 1],
  ['Überfall (Champion)', 'Überfall nach dem Match', '1vs1 gegen 3te', 'champion greift an', 'Opfer muss gewinnen für anschluss-aktion', 0, 1, '0:00-8:56'],
  ['Überfall (Champion)', 'Angriff vor dem Match', '1vs1', 'champion greift an', '', 0, 1],
  ['Überfall (Champion)', 'den Champion Überfallen', '1vs1 gegen 3te', 'champion wird bei feiern angegriffen und dann mit titel angegriffen', '', 0, 1],
  ['Überfall', 'Monster-Überfall', '1vs1 gegen 3te', 'nach match licht geht aus angreifer steht im ring und gibt chokeslam', 'muss heavy sein', 0, 1],
  ['Überfall', 'Angriff während des Partnereinzugs', '1vs1', 'angreifer kommt aus dem publikum in den ring gelaufen und greift von hinten an und wird dann vom ref zurückgehalten. match beginnt', '', 1, 0],
  ['Überfall', 'Rachsüchtiger Tag-Ersatz', '2vs2', 'tag gegner werden beim einzug angegriffen und durch die angreifer ersetzt', '', 1, 0],
  ['Überfall', 'Tag-Überfall nach dem Match', '2vs2 gegen 3te', 'werden nach dem match im ring angegriffen', 'gewinner werden angegriffen', 1, 0],
  ['Überfall', 'Tag-Einzugüberfall duch Dritte', '2vs2 gegen 3te', 'Gegner warten im Ring. beim einzug angriff von hinten in den nacken schlagen, dann in den ring schmeißen. Angreifer gehen langsam raus', '', 1, 0, '3'],
  ['Überfall', 'Tag-Einzugshinterhalt', '2vs2', 'beim einzug Angreifer greifen von hinten an und sprügeln auf die gegner ein , neben dem ring. angreifer bleiben da', '', 1, 0],
  ['Überfall', 'Tag-Champ-Überfall nach dem Match', '2vs2 gegen 3te', 'champion greift an', 'Opfer muss gewinnen für anschluss-aktion', 1, 0],
  ['Überfall', 'Tag-Champ-Überfall vor dem Match', '2vs3', 'champion greift an', '', 1, 0],

  // ── Ablenkung ──
  ['Ablenkung', 'Ablenkung neben dem Ring im Match', '1vs1 gegen 3te', 'jemand kommt raus und steht dann neben dem ring um abzulenken', '', 1, 1],
  ['Ablenkung', 'Ablenkungsangriff im Match', '1vs1 gegen 3te', 'einzug startet doch keiner kommt .plötzlich steht der angreifer hinter der person und greift an und verschwindet wieder', '', 1, 1],
  ['Ablenkung', 'Bühnenablenkung im Match', '1vs1 gegen 3te', 'tritt auf gegner ein plötzlich soll wohl einer reinkommen und der tritt erschreckt sich', '', 1, 1],
  ['Ablenkung', 'Den Gast neben dem Ring loswerden', '1vs1 gegen 3te', 'im match kommt jemand rein setzt sich auf den stuhl. anschließend gehen die wrestler raus und kämpfen weiter dabei wird der auf dem stuhl getroffen und fällt', '', 0, 1],
  ['Ablenkung', 'Manager-Ablenkung', '1vs1 gegen 3te', '', 'muss Manager sein', 1, 1],
  ['Ablenkung', 'Musikalische Ablenkung im Match', '1vs1 gegen 3te oder Tag', 'lässt sich durch musik ablenken', '', 1, 1],
  ['Ablenkung', 'Special Guest Referee', '1vs1', '', '', 0, 1],
  ['Ablenkung (Champion)', 'Dieb', '1vs1 gegen 3te', '', '', 0, 1],
  ['Ablenkung (Champion)', 'MITB-Ablenkung', '1vs1 gegen 3te', '', 'benötigt ein Titel und andere Koffer', 0, 1],
  ['Ablenkung', 'Rache-Ablenkung im Match', '1vs1 gegen 3te', 'tritt auf gegner ein plötzlich soll wohl einer reinkommen und der tritt ist bereit für den neuen gegner', 'die ausfürhrt muss das letzte Ziel gewesen sein', 1, 1],
  ['Ablenkung', 'Den Partner neben dem Ring loswerden', '1vs1', '', '', 1, 0],
  ['Ablenkung', 'Doppel-Ablenkung', '1vs1', '', '', 1, 0],
  ['Ablenkung', 'Managerausschluss', '2vs2', '', '', 1, 0],
  ['Ablenkung', 'Partner-Ablenkung neben dem Ring', '1vs1', '', '', 1, 0],
  ['Ablenkung', 'Partner-Chaos im Ring', '1vs1', '', '', 1, 0],

  // ── Angriff ──
  ['Angriff', 'Angekündigter Angriff im Match', '1vs1 gegen 3te', 'no DQ.während eines matches ein weiterer ist plötzlich auf die bühne mit einzug und ist im match dabei', '', 1, 1],
  ['Angriff', 'Angriff beim Einzug', '1vs1', 'beim einzug Angreifer springt von der Trepper mit einem schlag von oben. angreifer bleibt da', '', 1, 1],
  ['Angriff', 'Angriff im Match', '1vs1 gegen 3te', 'no DQ.während eines matches ein weiterer ist plötzlich mit im match', '', 1, 1],
  ['Angriff', 'Dreister Matchauftakt', '1vs1', 'nach match beginn geht es direkt zur sache', '', 1, 1],
  ['Angriff', 'Erniedrigender Angriff nach dem Match', '1vs1', 'sieger will gehen kommt zurück und greift gegner am boden an', 'Gewinner demütigt andere', 1, 1],
  ['Angriff', 'Feindseliger Matchauftakt', '1vs1', '', '', 1, 1],
  ['Angriff', 'Gegenseitige Agression', '1vs1', '', '', 1, 1],
  ['Angriff', 'Ladder-Kampf nach dem Match', '1vs1', 'sieger will gehen kommt zurück und greift mit leiter an', 'Gewinner greift mit Leiter an', 0, 1],
  ['Angriff', 'Provozierter Angriff', '1vs1', 'erst trash talk vor dem ring dann gehts zur sache', '', 0, 1],
  ['Angriff', 'Rache-Angriff vor dem Match', '1vs1 gegen 3te', 'Gegner warten im Ring. beim einzug angriff von hinten in den nacken, am boden dann weiter, ref will unterbrechen schafft es nicht. Angreifer wird von security raus geschickt. Nach dem match prügeln sich beide weiter security kommt erneut', '', 1, 1, '09:06-21:50'],
  ['Angriff', 'Racheangriff', '1vs1', 'es geht direkt zur sache', '', 1, 1],
  ['Angriff', 'Rachsüchtiger Ersatz', '1vs1', '', '', 0, 1],
  ['Angriff', 'Rumpfverletzung nach dem Match', '1vs1', 'sieger greift mit stuhl an', 'Attackierende muss gewinnen sonst gekontert', 1, 1],
  ['Angriff', 'Stomping nach dem Match', '1vs1', 'sieger feiert oder tritt auf gegner ein', 'Attackierende muss gewinnen sonst gekontert', 0, 1],
  ['Angriff', 'Table-Kampf nach dem Match', '1vs1', 'Gewinner greift mit Tisch an', 'Gewinner greift mit Tisch an', 0, 1],
  ['Angriff', 'Wütender Angriff nach dem Match', '1vs1', '', 'Attackierende muss gewinnen sonst gekontert', 0, 1],
  ['Angriff', 'Erniedrigender Tag-Sieg', '2vs2', '', 'die die demütigen müssen gewinnen', 1, 0],
  ['Angriff', 'Prügel in Überzahl', '1vs1', '', 'ein zufälliger 3ter wird vom spiel gewählt', 1, 0],
  ['Angriff', 'Respektloser Tag-Sieg', '2vs2', 'nach sieg wird einer vom gegner tagteam aus dem ring geschmissen', '', 1, 0],
  ['Angriff', 'Stuhlangriff nach dem Match', '2vs2', 'sieger greifen mit stuhl an', '', 1, 0],
  ['Angriff', 'Tag-Scharmützel vor dem Match', '2vs2', 'tag teams gehen direkt auf einander los', '', 1, 0],

  // ── Brawl ──
  ['Brawl', 'Brawl nach dem Match neben dem Ring', '1vs1 gegen 3te', '', '', 0, 1],
  ['Brawl', 'DQ und Brawl neben dem Ring', '1vs1 gegen 3te', 'dritter kommt rein und setzt sich auf den stuhl. mitten im match greift er an und das match wird unterbrochen', 'Match beenden durch DQ', 0, 1],
  ['Brawl', 'Einzugsablenkung und Brawl', '1vs1', 'Gegner wartet im Ring. beim einzug angriff von hinten in den nacken schlagen, ins gesicht mit dem Rücken gegn den apron und dann auf den Boden. Anschließend wird der Agreifer vom Ref zurück gehalten. angreifer bleibt da', 'Match endet Unentschieden', 1, 1],
  ['Brawl', 'Einzugsangriff und Prügelei', '1vs1', 'Gegner wartet im Ring und wird von hinten angegriffen und fällt zu boden,angreifer geht weiter drauf. Anschließend wird der Agreifer vom Ref zurück gehalten, angreifer geht jedoch am ref vorbei. match geht los', 'Match endet Unentschieden', 0, 1, '22:13-25:30'],
  ['Brawl', 'Racheprügelei', '1vs1', '', 'Match endet Unentschieden', 0, 1],
  ['Brawl', 'Rachsüchtiger Brawl', '1vs1', '', 'Match endet Unentschieden', 0, 1],
  ['Brawl', 'Rachsüchtiger Ersatz und reversal', '1vs1', '', 'Match endet Unentschieden', 0, 1],

  // ── Fallout ──
  ['Fallout', 'Tag Team-Zusammenbruch', '2vs2 gegen 3te', '', '', 0, 1],
  ['Fallout', 'Triple-Threat-Kreuzfeuer', '1vs1vs3te', '', 'Rivalen müssen Verbündete sein', 0, 1],

  // ── Promo ──
  ['Promo', 'Eigen-Promo', 'allein', '', '', 1, 1],
  ['Promo', 'Offene Herausfprderung Annehmen', '1vs1', '', '', 0, 1],
  ['Promo', 'Offene Herausfprderung Aussprechen', '1vs1 gegen 3te', '', '', 0, 1],
  ['Promo', 'Promo-Unterbrechung', '1vs1', '', '', 1, 1],
  ['Promo', 'Zur Rede stellen', '1vs1', '', '', 1, 1],

  // ── Respecktlosigkeit ──
  ['Respecktlosigkeit', 'Überraschender Matcherzwinger', '1vs1 gegen 3te', '', '', 1, 1],
  ['Respecktlosigkeit', 'Aufgeblasener Tag-Partner', '2vs2 gegen 3te', '', '', 0, 1],
  ['Respecktlosigkeit', 'Die Respektlosigkeit Zuückgeben', '1vs1', '', '', 1, 1],
  ['Respecktlosigkeit', 'Fingerfertiger Handschlag', '1vs1', '', '', 1, 1],
  ['Respecktlosigkeit', 'Gedemütigter Matchverlasser', '1vs1', '', '', 1, 1],
  ['Respecktlosigkeit', 'Matcherzwinger', '1vs1 gegen 3te', '', '', 1, 1],
  ['Respecktlosigkeit', 'Rampen-Wächter', '1vs1 gegen 3te', '', '', 1, 1],
  ['Respecktlosigkeit', 'Respeklosigkeit nach dem Match', '1vs1', '', '', 1, 1],
  ['Respecktlosigkeit', 'Tag Team-Desaster', '2vs2 gegen 3te', '', '', 0, 1],
  ['Respecktlosigkeit', 'Trashtalk von der Bühne', '1vs1 gegen 3te', '', '', 0, 1],
  ['Respecktlosigkeit', 'Verlassener Tag-Partner', '2vs2', '', 'handicap', 0, 1],
  ['Respecktlosigkeit', 'Wütender Tag-Partner', '2vs2', '', 'handicap', 0, 1],
  ['Respecktlosigkeit', 'Widersprüchliche Tag-Partner', '1vs2 gegen 3te', '', '', 0, 1],
  ['Respecktlosigkeit', 'Arroganter Herausforderer vs Verbündeter', '1vs1', '', 'müssen verbündete sein und einer champion', 0, 1],
  ['Respecktlosigkeit', 'den Champion zur Rede stellen', '1vs1 gegen 3te', '', 'opfer muss champion sein', 0, 1],
  ['Respecktlosigkeit', 'Sprungbrett', '1vs1', '', 'müssen verbündete sein', 0, 1],
  ['Respecktlosigkeit', 'Verbündeter vs Wichtigtuer-Champ', '1vs1', '', 'müssen verbündete sein und einer champion', 0, 1],
  ['Respecktlosigkeit', 'Zerbrochenes Bündnis', '1vs1', '', 'müssen verbündete sein', 0, 1],
  ['Respecktlosigkeit', 'Respeklosigkeit des Partners', '1vs1', '', '', 1, 0],
  ['Respecktlosigkeit', 'Team-Trashtalk von der Bühne', '2vs2 gegen 3te', '', '', 1, 0],
  ['Respecktlosigkeit', 'Die Tag-Champions bedrohen', '2vs2 gegen 3te', '', 'opfer muss champion sein', 1, 0],
  ['Respecktlosigkeit', 'Die Tag-Champions zur Rede stellen', '2vs2 gegen 3te', '', 'opfer muss champion sein', 1, 0],

  // ── Reversal ──
  ['Reversal', 'Überraschungsersatz', '1vs1 gegen 3te', '', '', 1, 1],
  ['Reversal', 'Feiglings-Ersatz', '1vs1 gegen 3te', '', '', 1, 1],
  ['Reversal', 'Sieger rettet Verlierer', '1vs1 gegen 3te', '', '', 0, 1],
  ['Reversal', 'Stuhlangriff-Rettung', '1vs1', '', 'zufällige verbündete wird vom spiel zugeteilt', 1, 1],
  ['Reversal', 'Cash-In-Versuch-Rettung', '1vs1 gegen 3te', '', 'benötigt ein Titel und andere Koffer', 0, 1],
  ['Reversal', 'Vereitelter Cash-In-Versuch', '1vs1 gegen 3te', '', 'benötigt ein Titel und andere Koffer', 0, 1],
  ['Reversal', 'Tag-Stuhlangriff-Rettung', '1vs1', '', 'Tag verbündete wird vom spiel zugeteilt', 1, 0],

  // ── Showdown ──
  ['Showdown', 'Auge in Auge nach dem Match', '1vs1 gegen 3te', 'feiert wird unterbrochen. stare down', '', 0, 1],
  ['Showdown', 'Anstarr-Duell der Champions', '1vs1 gegen 3te', 'ein champion kommt raus in den ring dann stare down', 'die ohne Match benötigt single-title', 0, 1],
  ['Showdown', 'Auge in Auge mit dem Champion', '1vs1 gegen 3te', 'champion feiert wird unterbrochen. stare down', 'die im Match benötigt single-title', 0, 1],

  // ── Sportsgeist ──
  ['Sportsgeist', 'Gegenseiter Respekt', '1vs1', 'handschlag vor dem match', '', 1, 1],
  ['Sportsgeist', 'Handschlag nach dem Match', '1vs1', 'handschlag nach dem match', '', 1, 1],
  ['Sportsgeist', 'Manager-Feier', '1vs1', 'nach dem match wird der manager nochmal extra in den jubel mit eingebaut', 'die mit Manager muss gewinnen', 0, 1],
  ['Sportsgeist', 'Respekt von der Bühne', '1vs1 gegen 3te', 'jemand kommt raus und klatscht für den sieger', '', 0, 1],
  ['Sportsgeist', 'Respekt vor dem Match', '1vs1', 'handschlag vor dem match', '', 1, 1],
  ['Sportsgeist', 'Unbeständige Partnerschaft', '1vs1 gegen 3te', 'tag team partner kommt in den ring und freut sich für den sieg. oder bei niederlage kommt rein und ist entäuscht', 'bei sieg zusammen feiern, bei niederlage gibt es streit', 0, 1],
  ['Sportsgeist', 'Das Kriegsbeil begraben', '1vs1', '', 'müssen feinde sein', 0, 1],
  ['Sportsgeist', 'Der Champion begräbt das Kriegsbeil', '1vs1', '', 'müssen feinde sein und ein Champion dabei', 0, 1],
  ['Sportsgeist', 'Frieden zwischen Feinden', '1vs1', 'faceoff doch nichts passiert. nach dem match sieger feiert die andere person ist leicht angefressen (rempelt sieger an) geht jedoch', 'müssen feinde sein', 0, 1],
  ['Sportsgeist', 'Kooperation zwischen Rivalen', '2vs2 gegen 3te', '', 'müssen feinde sein', 0, 1],
  ['Sportsgeist', 'Zögern zwischen Rivalen', '2vs2 gegen 3te', '', 'müssen feinde sein', 0, 1],
  ['Sportsgeist', 'Partnerfeier', '1vs1', 'nach dem match wird der tag partner nochmal extra in den jubel mit eingebaut', '', 1, 0],
  ['Sportsgeist', 'Team-Respekt von der Bühne', '2vs2 gegen 3te', 'tag team kommt eaus und klatscht den siegern', '', 1, 0],

  // ── Teamwork ──
  ['Teamwork', 'Überraschungs-Manager', '1vs1', 'manager kommt an den ring zum unterstützen (erwünscht)', 'mit Manager', 0, 1],
  ['Teamwork', 'Manager greift ins Match ein', '1vs1 gegen 3te', '', 'Rivalitätsperson ist Manager', 1, 1],
  ['Teamwork', 'Pin-Unterbrechung des Managers', '1vs1 gegen 3te', 'manager weißt auf ropebreake hin', 'Rivalitätsperson ist Manager', 1, 1],
  ['Teamwork', 'Stuhl-Assist des Managers', '1vs1', 'ref wird ausversehen umgehauen, manager schmeißt stuhl rein. nach dem match erneuter stuhl angriff von beiden', 'dritte Person ist Manager / Ringrichter wird geknocked', 1, 1],
  ['Teamwork', 'Ungewöhnlicher Manager', '1vs1 gegen 3te', 'manager kommt an den ring zum unterstützen (nicht erwünscht)', 'Manager von Rivalen / Rivalen Verbünden sich', 0, 1],
  ['Teamwork', 'Vorübergehendes Bündnis', '1vs1vs3te', 'angreifer greift ins match ein wird jedoch von gegner gestoppt und rausgeschmissen', '', 0, 1],
  ['Teamwork', 'Fan-Liebling Tag-Sieg', '2vs2', '', 'Rivalitätsperson muss gewinnen', 1, 0],
  ['Teamwork', 'Tag Team-Einheit', '2vs2', '', '', 1, 0],

  // ── Unfaire Attacke ──
  ['Unfaire Attacke', 'Köder des Matchverlassers', '1vs1', '', '', 1, 1],
  ['Unfaire Attacke', 'Pre-Match-Überraschungsschlag', '1vs1', 'handschlag andeutung dann schlag', '', 1, 1],
  ['Unfaire Attacke', 'Ringrichter KO 1', '1vs1', 'ref wird umgerannt', 'Ringrichter wird geknocked', 1, 1],
  ['Unfaire Attacke', 'Ringrichter KO 2', '1vs1', 'gegner wird in ref geschubst', 'Ringrichter wird geknocked', 1, 1],
  ['Unfaire Attacke', 'Unfaire Aktion nach dem Match', '1vs1', '', '', 1, 0],

  // ── Verrat ──
  ['Verrat', 'Tiefschlag-Verrat', '1vs1 gegen 3te', '', 'müssen verbündete sein / eine Rivalitätsperson ist Manager', 0, 1],
  ['Verrat', 'Verrat im Match', '1vs1 gegen 3te', '', 'müssen verbündete sein / No DQ Match / Erlaubt in Titel Match', 0, 1],
  ['Verrat', 'Verrat nach dem Match', '1vs1 gegen 3te', '', 'müssen verbündete sein / Rivalitätsperson muss gewinnen', 0, 1],

  // ── Cash-In ──
  ['Cash-In', 'MITB-Cash-In nach dem Match', '1vs1 gegen 3te', '', '', 0, 1],
  ['Cash-In', 'MITB-Cash-In-Angriff nach dem Match', '1vs1 gegen 3te', '', '', 0, 1, '26:05-27:16'],
  ['Cash-In', 'MITB-Triple-Threat-Cash-In', '1vs1 gegen 3te', '', 'wird zu einem Triple Threat Match', 0, 1],
];
