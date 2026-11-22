# KHW Office
 
Verwaltungs- und Spiel-App für **Knight & Hustler Wrestling (KHW)**, ein Wrestling-Management-Rollenspiel für zwei Spieler.
Sie ersetzt die frühere Google-Tabelle „KHW Office“. Das sind die Bereiche:
 
- **Liga:** Card (Shows planen, bearbeiten, beenden und abrechnen)
- **Kader:** Weeklie Roster, Datenbank, Teams und Stables, Verletzte, Ranking, Titel, Storylines
- **Geschäft:** Finanzen, Mitarbeiter, Lager, Vertrag (mit KI-Verhandlung)
- **Postfach:** News, Mails und Termine, geschrieben von einer KI
- **Ablage:** Notizen, Rivalen Aktionen (reine Ansicht mit Suche)
- **Admin-Modus:** IDB-Editor, Listen-Zuordnung, Regelwerk, Protokoll
Ein paar Eckdaten:
 
- **Technik:** Reines HTML, CSS und JavaScript, ohne Build-Schritt und ohne Framework.
- **Speicher:** Die Daten liegen in **Supabase** und werden in Echtzeit zwischen den Geräten abgeglichen.
- **KI:** Hugging Face, angebunden über eine Supabase Edge Function.
- **Veröffentlichung:** über **GitHub Pages**.
- **Sprache:** Oberfläche und Code-Kommentare sind komplett auf Deutsch.
---
 
## Inhalt
 
1. [Schnellstart](#schnellstart)
2. [Aufbau in 60 Sekunden](#aufbau-in-60-sekunden)
3. [Datenmodell und Speicher](#datenmodell-und-speicher)
4. [Dateibaum](#dateibaum)
5. [Dateiübersicht](#dateiübersicht)
6. [Was hängt wovon ab](#was-hängt-wovon-ab)
7. [Was alleinstehend geändert werden kann](#was-alleinstehend-geändert-werden-kann)
8. [Regeln und Konventionen](#regeln-und-konventionen)
9. [Testen](#testen)
10. [Veröffentlichen und Sicherheit](#veröffentlichen-und-sicherheit)
---
 
## Schnellstart
 
| Ziel | So geht's |
|---|---|
| Lokal ansehen | `app/index.html` im Browser öffnen. Ist `app/supabase-config.js` leer, läuft die App wie ein Klickdummy nur im Browser. |
| Mit Supabase | Projekt anlegen und `supabase/schema.sql` sowie `supabase/protokoll.sql` ausführen. Die Edge Function `supabase/functions/ki/index.ts` als `ki` deployen und das Secret `HF_API_TOKEN` setzen. URL und Publishable Key in `app/supabase-config.js` eintragen. Die ausführliche Anleitung steht in [`supabase/ANLEITUNG.md`](supabase/ANLEITUNG.md). |
| Live (GitHub Pages) | `app/`, `img/`, `index.html`, `robots.txt`, `.nojekyll` und `.gitignore` hochladen. Die `.gitignore` hält private Dateien fern. Unter Settings → Pages „main / root“ wählen. |
 
Zum Anmelden braucht man ein Konto, das im Supabase-Dashboard unter **Authentication → Users** angelegt wird. Selbst registrieren kann sich niemand.
 
---
 
## Aufbau in 60 Sekunden
 
**Namensraum:** Alle Dateien hängen ihre Funktionen an ein globales Objekt `window.KHW` (im Code `K`). Es gibt keine Module. Die **Reihenfolge der `<script>`-Tags in `app/index.html` ist deshalb wichtig**: Eine Datei darf beim Laden nur nutzen, was davor geladen wurde. Zur Laufzeit, etwa in Klick-Handlern oder beim Rendern, ist alles verfügbar.
 
**Datenfluss:**
 
```
Startstand der Tabelle (Supabase: khw_basis)        ← einmal übernommen, ändert sich praktisch nie
        +  gemeinsamer Spielstand (K.store.state)   ← alles, was in der App passiert
        +  Regelwerk (K.conf)  +  IDB-Texte (K.idbApi)
        ↓  K.buildModel()  (model.js)
   Modell m  (roster, shows, titles, ranking, finance, storage, teams, storylines …)
        ↓  K.views[seite].render(m, K.state)
   HTML in #content   →   Klicks ändern K.store / K.conf / IDB   →   K.rebuild()   →   neu rendern
```
 
**Gemeinsam oder je Tab:**
- **Für beide Spieler, über Supabase:** Spielstand (`K.store.state`), Regelwerk (`K.conf`), IDB und Notizen.
- **Je Tab:** `K.state`, also die gewählte Seite, Filter, offene Dialoge und die gewählte Show.
- **Je Gerät** (localStorage): Admin-Modus, KI-Schalter, gelesene Postfach-Einträge, Spaltenreihenfolge und Testmodus.
**Abgleich (`cloud.js`):** Jeder Speicherbereich wird in Zeilen zerlegt, je Eintrag eine Zeile. Hochgeladen wird nur, was sich geändert hat. Änderungen des anderen Geräts kommen per Supabase Realtime und werden Zeile für Zeile eingespielt; danach baut `K.onRemoteChange()` die Ansicht neu auf. Ein Klick auf den Status-Chip „Supabase · verbunden“ startet den **Testmodus**: Dann arbeitet das Gerät mit einer Kopie, und nichts wird gespeichert.
 
---
 
## Datenmodell und Speicher
 
### Supabase-Tabellen
Alle vier Datentabellen haben dieselbe Form: `schluessel` (Primärschlüssel), `daten` (jsonb), `geaendert_am`, `geaendert_von`.
 
| Tabelle | Inhalt | Quelle in der App |
|---|---|---|
| `khw_stand` | gemeinsamer Spielstand | `K.store.state` (store.js) |
| `khw_regelwerk` | geänderte Regelwerk-Bereiche | `K.conf` (rules/config.js) |
| `khw_idb` | Textlisten, Listen-Zuordnung, Postfach-Kombinationen | `K.idbApi` (idb.js) |
| `khw_basis` | Startstand der Google-Tabelle, eine Zeile je Blatt (`meta`, `blatt/<Name>`) | `cloud.js` (`loadBase`/`saveBase`) |
| `khw_protokoll` | Änderungsprotokoll der letzten 30 Tage, per Trigger befüllt | `protocol.js` |
 
**Zeilenschlüssel** (siehe `cloud.js`):
- `offers/Andre Chase` für einen Eintrag in einem Objekt
- `inbox#i8k2` für ein Element einer Liste mit `id`, Inhalt `{ o: Position, v: Element }`
- `bookings` für einen Wert als Ganzes, Inhalt `{ t: 'val', v }`
- Gliederungszeilen `{ t: 'dict' | 'list' }` kennzeichnen Objekte und Listen.
### Spielstand `K.store.state` (store.js)
`offers`, `drafts`, `contracts`, `bookings` (immer die letzten 30), `wrestlers` (Änderungen je Name), `shows` (bearbeitete Shows je Schlüssel), `extras` (PPVs und Events), `game` (aktuelle Show, Sterne, Follower, letzte Abrechnung …), `titles` (Titelwechsel), `series` (Showreihen), `added` (neue Wrestler), `staff`, `storage` (Ausbau, eingelagerte und entfernte Gegenstände, Tresor), `groups` (Teams und Stables), `stories` (Storylines), `renames`, `inbox`, `memory` (KI-Gedächtnis), `notes`.
 
### Regelwerk `K.conf` (rules/config.js)
Die Bereiche lauten `contract`, `halls`, `finance`, `staff`, `store`, `titles`, `stories`, `inbox`, `storage`, `skills` und `ranking`. Die **Standardwerte stehen in `DEFAULTS`**; gespeichert werden nur Abweichungen. Gelesen wird zur Laufzeit mit `K.conf.get(bereich)`. Zahlen gehören nie fest in den Code.
 
### IDB (idb.js)
Textlisten wie Vertragsforderungen, Verletzungsgründe, Mitarbeiter-Vorteile und Namen, Postfach-Absender und -Themen. Die App zieht nicht nach Listennamen, sondern über **Verwendungen** (`K.IDB_SLOTS`, z. B. `contract.demands`). Welche Liste welche Verwendung speist, legt die Listen-Zuordnung fest (`idbmap.js`). Startlisten kommen aus `js/seed/*.js` und werden einmalig übernommen.
 
---
 
## Dateibaum
 
Legende:
- **●** wird zum Laufen gebraucht; fehlt die Datei, fehlt ein Teil der App oder sie startet nicht
- **○** optional: Die App läuft ohne die Datei, man verliert aber eine Funktion
- **⚙** gehört zu Supabase, wird dort im Dashboard eingespielt und nicht von der App geladen
- **🔒** nur lokal, nie veröffentlichen
- **–** wird nicht gebraucht (Entwicklung, Altbestand)
```
KHW Manager/
├── index.html                    ○  Weiterleitung auf app/ (nur für GitHub Pages)
├── robots.txt                    ○  Suchmaschinen aussperren
├── .nojekyll                     ○  GitHub Pages: Dateien unverändert ausliefern
├── .gitignore                    ○  hält 🔒 und – vom Repository fern
├── README.md                     ○  diese Datei
├── ToDo.md                       –  Arbeitsliste (wird nicht veröffentlicht)
│
├── app/
│   ├── index.html                ●  Gerüst + Ladereihenfolge aller Skripte
│   ├── supabase-config.js        ●  URL + Publishable Key (leer = nur Browser, ohne Abgleich)
│   ├── config.js                 🔒 Zugang zur alten Google-Tabelle (nur ohne Supabase gebraucht)
│   ├── vendor/
│   │   └── supabase-2.117.3.js   ●  Supabase-Bibliothek
│   ├── css/
│   │   ├── app.css               ●  gesamtes Design
│   │   └── skins.css             ●  Looks der „fremden Seiten“
│   └── js/
│       ├── core.js               ●  Hilfsfunktionen
│       ├── ui-select.js          ●  Auswahllisten im App-Design
│       ├── dialog.js             ●  eigene Dialoge
│       ├── cloud.js              ●  Supabase-Abgleich, Anmeldung, Testmodus, Präsenz
│       ├── skins.js              ●  Rahmen der „fremden Seiten“
│       ├── store.js              ●  gemeinsamer Spielstand
│       ├── rules/
│       │   ├── config.js         ●  Regelwerk mit Standardwerten
│       │   ├── contract.js       ●  Vertragsregeln
│       │   └── show.js           ●  Show- und Abrechnungsregeln
│       ├── hype.js               ●  Vorschau-Fakten (von views.js genutzt)
│       ├── model.js              ●  baut das Modell
│       ├── views.js              ●  K.views, K.NAV, K.ui + kleinere Seiten
│       ├── contract.js           ●  Vertrag
│       ├── shows.js              ●  Card, Editor, Würfel
│       ├── showend.js            ●  Show abrechnen/beenden, Rabatte
│       ├── injuries.js           ●  Verletzte
│       ├── staff.js              ●  Mitarbeiter
│       ├── teams.js              ●  Teams und Stables
│       ├── storylines.js         ●  Storylines
│       ├── notes.js              ●  Notizen
│       ├── rivalen-daten.js      ●  Rivalen Aktionen: die Daten (fest im Code, aus der Tabelle übernommen)
│       ├── rivalen.js            ●  Rivalen Aktionen: reine Ansicht mit Suche und Filtern
│       ├── seed/
│       │   ├── idb-vertrag.js        ○  Startlisten (nur für eine neue, leere Einrichtung nötig)
│       │   ├── idb-verletzungen.js   ○
│       │   ├── idb-mitarbeiter.js    ○
│       │   └── idb-postfach.js       ○
│       ├── idb.js                ●  IDB-Editor + Textlisten
│       ├── idbmap.js             ●  Listen-Zuordnung
│       ├── rulebook.js           ●  Regelwerk-Seite
│       ├── protocol.js           ●  Protokoll-Seite
│       ├── ai.js                 ●  KI-Anbindung
│       ├── inbox.js              ●  Postfach
│       ├── admin.js              ●  Admin-Modus
│       └── main.js               ●  Start, Navigation, Rendern (immer als letzte Datei)
│
├── img/
│   ├── logos/
│   │   ├── KHW Logo W.png        ●  Logo oben links
│   │   ├── TryOut.png            ●  Show-Logo
│   │   └── Lucky7.png            ●  Show-Logo
│   ├── titel/
│   │   └── Titel.png             ○  Platzhalter für Titelbilder (fehlt er, bleibt die Fläche leer)
│   └── lager/
│       └── Platzhalter.svg       ○  Platzhalter für Lagerbilder
│
├── supabase/
│   ├── ANLEITUNG.md              –  Einrichtung Schritt für Schritt
│   ├── schema.sql                ⚙  Tabellen, Zugriffsregeln, Realtime
│   ├── protokoll.sql             ⚙  Änderungsprotokoll (Tabelle + Trigger)
│   └── functions/ki/index.ts     ⚙  Edge Function „ki“ (Weiterleitung an Hugging Face)
│
├── data/
│   └── snapshot.js               🔒 lokale Kopie der Google-Tabelle (nur ohne Supabase bzw. für eine neue Einrichtung)
│
├── Google Apps Script/           –  Skripte der alten Tabelle (Vorlage für Regeln, nicht mehr in Betrieb)
├── Screendesign/                 –  Entwürfe
└── tools/                        –  Hilfsskripte aus der Entwicklung
```
 
**Minimal lauffähig mit Supabase:** alles mit ● in `app/` und `img/`, dazu eine eingerichtete Supabase-Instanz (⚙). Die Dateien `config.js` und `snapshot.js` lädt die App zwar, sie fehlen dann aber folgenlos: Den Startstand holt sie aus Supabase.
 
**Neue, leere Einrichtung:** zusätzlich `data/snapshot.js` (Startstand) und die Seeds. Beim ersten Start lädt die App beides einmal nach Supabase hoch.
 
---
 
## Dateiübersicht
 
### Hauptordner
| Datei | Zweck |
|---|---|
| `index.html` | leitet auf GitHub Pages zur App weiter (`app/`) |
| `robots.txt`, `.nojekyll` | Suchmaschinen aussperren, Dateien unverändert ausliefern |
| `.gitignore` | hält private Dateien vom Repository fern |
| `supabase/` | `schema.sql`, `protokoll.sql`, Edge Function `functions/ki/index.ts`, `ANLEITUNG.md` (wird nicht veröffentlicht) |
| `img/` | Logos (`logos/`), Platzhalter für Titel- und Lagerbilder |
 
### `app/`
| Datei | Zweck |
|---|---|
| `index.html` | Gerüst der Seite und **Ladereihenfolge aller Skripte** |
| `supabase-config.js` | Project URL und Publishable Key (öffentlich gedacht). Leer bedeutet: nur Browser. |
| `config.js` | *Nur lokal, nie hochladen.* Zugang zur alten Google-Tabelle. |
| `vendor/supabase-2.117.3.js` | Supabase-Bibliothek (lokale Kopie) |
| `css/app.css` | Gesamtes Design. **Alle Farben stehen oben in `:root`.** |
| `css/skins.css` | Looks der „fremden Seiten“ (Klinik, Bank, Chat, Nachrichtenseiten) |
 
### `app/js/` – Grundlagen
| Datei | Zweck |
|---|---|
| `core.js` | Hilfsfunktionen: `K.esc`, `K.eur`, `K.fmt`, `K.elo`, `K.splitNames`, `K.skillResult`, Tabellen-Zugriff `K.Sheet` |
| `ui-select.js` | ersetzt jedes `select.field` durch eine Auswahlliste im App-Design. Namensvorschläge kommen über `data-suggest` und `K.suggest.*`. |
| `dialog.js` | eigene Dialoge statt Browser-Popups: `K.dialog.confirm/alert/prompt/form` |
| `cloud.js` | Supabase: Anmeldung, Zerlegen und Abgleich der Bereiche, Realtime, Testmodus, Präsenz (wer ist wo), Startstand (`khw_basis`), Protokoll-Zugriff |
| `skins.js` | `K.frame()`, Rahmen für die „fremden Seiten“, dazu kleine Deko-Helfer |
| `store.js` | gemeinsamer Spielstand `K.store` (`update`, `replace`), legt Änderungen übers Modell (`patchRoster`, `patchFinance`, `patchTitles`), Zufall (`K.random`, `K.rand`) |
| `rules/config.js` | Regelwerk `K.conf` mit allen `DEFAULTS` |
| `rules/contract.js` | Vertragsregeln: Angebot, Würfe, Verhandlungsausgang, Abschluss. Reine Rechenfunktionen. |
| `rules/show.js` | Show-Regeln: Sterne, Wette, Abrechnung (Tickets, Streams, Merch, Sponsoring), Follower, ELO, Titelwechsel |
| `hype.js` | Vorschau-Fakten zu Shows (nur auf der ausgeblendeten Büro-Seite) |
| `model.js` | **`K.buildModel(daten)`**: baut aus Startstand, Spielstand und Regelwerk das Modell. Kalender und Jahre, Kader, Verträge, Teams, Titel, Ranking samt Status-Stufen, Shows, Finanzen, Lager, Storylines. |
| `main.js` | Start, Navigation, Routing (`#seite`), Rendern, Suche, Seitenleiste (Wrestler- und Team-Panel), `K.rebuild`, `K.onRemoteChange`, `K.toast` |
 
### `app/js/` – Seiten (jede Datei meldet eine Ansicht in `K.views` an)
| Datei | Seite / Inhalt |
|---|---|
| `views.js` | Sammelt die kleineren Seiten: Weeklie Roster, Datenbank, Ranking, Titel, Finanzen, Lager, Wrestler- und Team-Panel. Dazu **`K.ui`** (gemeinsame Bausteine wie `card`, `chip`, `tier`, `wl` …) und **`K.NAV`** (Navigation). |
| `shows.js` | Card: Showliste, Kalender, Show-Editor, Würfel-Vorschlag (`K.diceMatch`), Showreihen |
| `showend.js` | „Show abrechnen“ und „Show beenden“ (Buchungen, ELO samt Verlauf, Titel, Auf- und Abstiege), Ergebnis-Karte, Rabatte (`K.discount`) |
| `contract.js` | Vertrag: Formular, Angebote, Verhandlung mit KI-Antwort |
| `injuries.js` | Verletzte und „nicht verfügbar“, `K.injure`, Sperren für Matches |
| `staff.js` | Mitarbeiter: Plätze, Bewerber, Produktion, gemeinsames Lager der Vorteile, Schmiede |
| `teams.js` | Teams und Stables: Liste, anlegen, bearbeiten, auflösen |
| `storylines.js` | Storylines: abhakbare Punkte, Stände, Belohnung |
| `notes.js` | gemeinsame Notizen (Rich-Text) |
| `rivalen.js` | Rivalen Aktionen: reine Ansicht, eine Tabelle für alle Kategorien (Kategorien als Zwischenüberschriften, Kopfzeile bleibt beim Scrollen stehen), mit Suche und Filtern (Kategorie, „Wer ist dabei?“, Single/Tag). Menüeintrag direkt hinter „Notizen“; er trägt sich bei jedem Lesen von `K.NAV` selbst wieder ein, falls eine andere Datei die Navigation umbaut. Seitenuntertitel: `SUBS` in `main.js`. Speichert nichts, die Filter gelten je Tab (`K.state.rv`). |
| `rivalen-daten.js` | Die Daten dazu (`K.RIVALS`), eine Zeile je Aktion aus dem Blatt „Rivalen Aktionen“. Änderungen werden direkt hier gemacht. |
| `inbox.js` | Postfach: News, Mails, Termine. Erzeugt nach Show-Ende neue Einträge, baut die KI-Anfragen und deren Sperre, Würfe. |
| `ai.js` | `K.ai.chat()`: KI-Anfrage über die Edge Function oder als Simulation. Der Schalter „live“ gilt je Gerät. |
| `idb.js` | IDB-Editor (Admin), Variablen-Sprache `{wrestler:…}`, Verwendungen `K.IDB_SLOTS`, Ziehen `K.idbDrawSlot`, Postfach-Kombinationen |
| `idbmap.js` | Listen-Zuordnung (Admin): Knotendiagramm Liste → Verwendung, Kombinationen |
| `rulebook.js` | Regelwerk (Admin): ein Reiter je Bereich von `K.conf` |
| `protocol.js` | Protokoll (Admin): Änderungen der letzten 30 Tage, Rückgängig |
| `admin.js` | Admin-Modus: Schalter im Profilmenü, Admin-Leiste (Datum springen, Werte korrigieren, KI, Stand sichern), Admin-Teil der Wrestler-Kartei |
| `seed/idb-*.js` | Startlisten fürs IDB (Vertrag, Verletzungen, Mitarbeiter, Postfach) |
 
---
 
## Was hängt wovon ab
 
Diese Stellen sind **Verträge zwischen Dateien**. Wer hier etwas ändert, muss die genannten Dateien mitprüfen.
 
| Änderung an … | wirkt auf … |
|---|---|
| **Reihenfolge in `app/index.html`** | alle Dateien. `cloud.js` muss vor `store.js`, `rules/config.js` und `idb.js` stehen, `skins.js` vor den Seiten, `views.js` vor allen anderen Seiten (es legt `K.views`, `K.NAV` und `K.ui` an), `main.js` als letzte Datei. |
| **Form von `K.store.state`** (Feld umbenennen oder umbauen) | `store.js`, `model.js` und jede Seite, die das Feld liest oder schreibt. Außerdem **die Daten in Supabase**: Alte Zeilen behalten die alte Form, deshalb braucht es eine Übernahme oder Abwärtskompatibilität. |
| **Felder im Modell** (`model.js`, z. B. `w.status`, `s.matches`, `m.ranking`) | fast alle Seiten, `rules/*.js`, `showend.js`, `inbox.js` (KI-Kontext), `skins`-Looks |
| **`K.ui`-Bausteine** (`views.js`) | alle Seiten. Signaturen nicht ändern, nur ergänzen. |
| **Neuer Regelwerk-Wert** | `rules/config.js` (`DEFAULTS`) **und** `rulebook.js` (Feld im passenden Reiter) **und** die Stelle, die ihn liest. Gespeicherte Bereiche in Supabase haben neue Felder noch nicht, deshalb immer einen Ersatzwert vorsehen (`c.wert ?? Standard`). |
| **Neue IDB-Verwendung** | `K.IDB_SLOTS` in `idb.js` (erscheint dann automatisch in `idbmap.js`), eventuell eine Startliste in `seed/` mit neuem `key` und den Eintrag in `index.html`, dazu die Stelle, die `K.idbDrawSlot('…')` aufruft. |
| **Neuer gemeinsamer Speicherbereich** (neben Stand, Regelwerk, IDB) | `cloud.js` (`register`) **und** eine neue Tabelle in `supabase/schema.sql` (samt Realtime und Zugriffsregel) **und** gegebenenfalls `protokoll.sql` (Trigger). Einfacher ist es, neue gemeinsame Daten in `K.store.state` abzulegen; dann läuft der Abgleich automatisch. |
| **Supabase-Tabellen oder Spalten** | `cloud.js`, `protocol.js`, die SQL-Dateien. SQL im Dashboard neu ausführen. |
| **Edge Function `ki`** (Ein- und Ausgabe) | `ai.js` (`functions.invoke('ki', { body })`, erwartet `{ text }` oder `{ error }`). Nach Änderungen im Dashboard neu deployen. |
| **Prompts / KI-Antwortform** | `inbox.js` (`buildMessages`, `parse`) und `contract.js` (`aiMessages`, `[Bedingungen: …]`). Die Grundregeln stehen im Regelwerk unter `inbox.system`. |
| **Showreihen / KHW-Shows** | `model.js` (`K.seriesConf`, `K.khwShows`). TryOut und Lucky7 stehen noch fest in `views.js` (Weeklie Roster, Ranking), `rules/contract.js` (`SHOWS`), `idb.js` (Show-Auswahl der Variablen), `shows.js`, `hype.js` und `model.js` (`SHOWS` fürs Ranking). |
| **Status-Stufen** (`K.STATUS`) | `model.js` (Ranking, Bänder), `rules/config.js` (Vertragspreise und Forderungen je Stufe), `rulebook.js`, `views.js` |
| **Markup einer Seite**, die einen Look hat | `css/skins.css` greift über Klassen wie `.inj-card`, `.ib-list`, `.bubble`, `.ledger` und `.inv-slot` darauf zu. Verletzte, Lager-Tresor, Finanzen-Kontobewegungen, Mails und News |
| **Farbvariablen in `:root`** (`app.css`) | das ganze Design. Die Looks in `skins.css` überschreiben die Variablen nur innerhalb ihres Rahmens. |
| **Rivalen Aktionen** (`rivalen-daten.js`) | `rivalen.js`. Spalten je Zeile: Kategorie, Name, Wer ist dabei?, Inhalt, Besonderheit, Tag (1/0), Single (1/0), Zusatz (optional). Ladereihenfolge in `app/index.html`: Daten vor der Seite, beide nach `views.js` (legt `K.NAV` an); die Seite macht `K.NAV` zu einer Eigenschaft mit Selbsteintrag (`Object.defineProperty`), die Position im Menü hängt also nicht von der Ladereihenfolge ab. Untertitel der Seite in `SUBS` (`main.js`). |
| **Name eines Wrestlers** | Namen immer über `K.ui.wl()` / `wlList()` ausgeben (Klick öffnet das Panel). Neue Lesestellen aus der Tabelle müssen `K.rn()` nutzen (Umbenennungen). |
 
---
 
## Was alleinstehend geändert werden kann
 
Diese Teile lassen sich ändern, ohne andere Dateien anzufassen, solange Namen und Rückgabeformen gleich bleiben:
 
- **Texte und Hinweise** auf einer Seite, solange sie nicht als Klassen oder Datenwerte dienen
- **Aussehen einzelner Bereiche** in `css/app.css` bzw. `css/skins.css` (Abstände, Schriften, Farben einzelner Bausteine)
- **Ein Look der „fremden Seiten“:** `css/skins.css` und der jeweilige `K.frame(…)`-Aufruf. Abschalten: `K.frame` für die ID einfach nicht aufrufen.
- **Innenleben einer Seite** (`render` und Klick-Handler in der jeweiligen Datei, z. B. `teams.js`, `storylines.js`, `notes.js`, `staff.js`, `injuries.js`, `protocol.js`), solange gelesene Modellfelder und gespeicherte Felder gleich bleiben
- **Rechenregeln** in `rules/contract.js` und `rules/show.js`. Das sind reine Funktionen; Ein- und Ausgabe nicht ändern.
- **Rivalen Aktionen:** neue oder geänderte Einträge in `rivalen-daten.js` (rein lesende Seite, kein Abgleich, kein Regelwerk)
- **Startlisten** in `seed/*.js` (wirken nur bei neuen Installationen bzw. mit neuem `key`)
- **Simulierte KI-Antworten** in `ai.js` (`simulate`)
- **Würfel-Gründe** im Show-Editor (`K.diceMatch` in `shows.js`)
- **Inhalte, die man in der App selbst pflegt**, brauchen gar keinen Code: Zahlen und Regeln im Regelwerk, Texte im IDB, Zuordnungen in der Listen-Zuordnung, Bilder per Adresse im Regelwerk
---
 
## Regeln und Konventionen
 
- **Nur Deutsch** in Oberfläche und Kommentaren.
- **Keine Browser-Popups** (`alert`, `confirm`, `prompt`), immer `K.dialog`.
- **Design „Feld“:** Orange (`--accent`) für Hauptaktionen, Blau (`--accent-2`) für Nebenaktionen. **Keine farbigen Randstreifen**; Zugehörigkeit zeigt eine durchscheinende Fläche.
- **Zahlen ins Regelwerk, Texte ins IDB**, nie fest in den Code.
- **Neue gemeinsame Daten in `K.store.state`** (dann laufen Supabase-Abgleich und Protokoll automatisch). Nie eigenes `localStorage` für gemeinsame Daten verwenden.
- **Ändern:** `K.store.update(st => { … })`, danach `K.rebuild()`. Keine Zustandsänderung ohne `update`.
- **Neuaufbau aus `change`- oder `blur`-Handlern** mit `setTimeout(…, 0)` verzögern, sonst gibt es Fehler beim Ersetzen des HTML.
- **Admin-Seiten** bekommen `adminOnly: true`. Der Standardmodus bleibt unverändert.
- **Seitenwechsel** startet oben; nur die Card springt zur aktuellen Show.
- **KI:** Nur Text, keine automatischen Folgen im Spiel. Token sparen: kurze Prompts, nur der nötige Kontext.
---
 
## Testen
 
Es gibt keine Testsuite. Geprüft wird mit **Chrome ohne Fenster**:
 
- Eine temporäre Kopie von `app/index.html` mit einem Testskript am Ende anlegen (klickt per `dispatchEvent`, schreibt Ergebnisse in ein `<pre>`), dann `chrome --headless=new --dump-dom` (bzw. `--screenshot`) aufrufen und die Kopie wieder löschen.
- **`window.fetch` im Test abfangen**, damit keine echten Anfragen an Hugging Face oder die Tabelle rausgehen.
- **Supabase im Test:** Ein nachgebautes Backend im Elternfenster mit zwei iframes als zwei Geräte. Chrome dafür mit `--allow-file-access-from-files` starten.
- **Endlos-Animationen** (EKG, Laufband) für Screenshots per CSS abschalten, sonst hängt Chrome ohne Fenster.
- Pfade mit Leerzeichen in der Adresse als `%20` schreiben.
---
 
## Veröffentlichen und Sicherheit
 
- **Hochladen:** `app/` (ohne `config.js`), `img/`, `index.html`, `robots.txt`, `.nojekyll`, `.gitignore`, `README.md`.
- **Nie hochladen:** `app/config.js` (Zugang zur Google-Tabelle) und `data/` (Kopie der Tabelle). Die `.gitignore` sorgt dafür.
- **`supabase-config.js`** enthält nur den öffentlichen Publishable Key. Geschützt sind die Daten durch Anmeldung und Zugriffsregeln (RLS: nur angemeldete Konten). **Nie** den Secret- oder service_role-Key eintragen.
- **Der Hugging-Face-Token** liegt nur als Secret `HF_API_TOKEN` bei der Edge Function, nie im Browser oder im Repository.
- **Supabase Free** pausiert Projekte nach etwa einer Woche ohne Nutzung. Im Dashboard reaktivieren, die Daten bleiben.
- **Updates:** geänderte Dateien hochladen. GitHub Pages ist nach etwa einer Minute aktuell. SQL-Änderungen und die Edge Function gehen getrennt über das Supabase-Dashboard.
 
