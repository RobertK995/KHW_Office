// KHW Manager – Hype-System (Vorschau-Fakten zu einer Show).
// Die Logik stammt unverändert aus Google Apps Script/Card.gs; hier läuft sie lokal im Browser.
window.KHW = window.KHW || {};
(function (K) {
  function getShowType_(showNo) {
    const g = (showNo - 1) % 5;
    if (g === 4)            return 'PPV';
    if (g === 1 || g === 3) return 'Lucky7';
    return 'TryOut';
  }

  function showNoToMonthLabel_(showNo) {
    const MONTHS = ['Januar','Februar','März','April','Mai','Juni',
                    'Juli','August','September','Oktober','November','Dezember'];
    const monthIdx = Math.min(Math.ceil(showNo / 10) - 1, 11);
    const pos      = ((showNo - 1) % 10) + 1; // 1–10 innerhalb des Monats
    const prefix   = pos <= 4 ? 'Anfang' : pos <= 7 ? 'Mitte' : 'Ende';
    return `${prefix} ${MONTHS[monthIdx]}`;
  }

  /**
   * Zählt wie viele Shows eines bestimmten Typs es bis einschließlich showNo gibt.
   * TryOut: g=0,2 → 2 pro Zyklus | Lucky7: g=1,3 → 2 pro Zyklus | PPV: g=4 → 1 pro Zyklus
   */
  function countShowsOfType_(upToShowNo, type) {
    if (upToShowNo < 1) return 0;
    const gMap   = { TryOut: [0, 2], Lucky7: [1, 3], PPV: [4] };
    const gs     = gMap[type] || [];
    const cycles = Math.floor((upToShowNo - 1) / 5);
    const rem    = (upToShowNo - 1) % 5;
    return cycles * gs.length + gs.filter(g => g <= rem).length;
  }

  function normName_(val) {
    return String(val || '').trim();
  }

  /**
   * Gibt alle Wrestlernamen eines Matches zurück (Gewinner, Verlierer, Weitere).
   * Weitere können kommagetrennt sein.
   */
  function getParticipants_(match) {
    const names = new Set();
    if (match.winner) names.add(match.winner);
    if (match.loser)  names.add(match.loser);
    if (match.additional) {
      match.additional
        .split(/[,;\n]+/)
        .map(n => n.trim())
        .filter(Boolean)
        .forEach(n => names.add(n));
    }
    return [...names];
  }

  function buildWrestlerStats_(history, currentShowNo, allPPVShows) {
    const map = {};

    history.forEach(match => {
      getParticipants_(match).forEach(name => {
        if (!name) return;
        if (!map[name]) map[name] = {
          matches: [],
          lastShowNoByType: { TryOut: 0, Lucky7: 0, PPV: 0 },
        };
        map[name].matches.push({
          showNo:      match.showNo,
          showType:    match.showType,
          matchNum:    match.matchNum,
          isWin:       match.winner === name,
          isLoss:      match.loser  === name,
          isMainEvent: match.isMainEvent,
          stars:       match.stars,
        });
        const prev = map[name].lastShowNoByType[match.showType] || 0;
        if (match.showNo > prev) map[name].lastShowNoByType[match.showType] = match.showNo;
      });
    });

    Object.values(map).forEach(stats => {
      stats.matches.sort((a, b) => a.showNo - b.showNo || a.matchNum - b.matchNum);

      const decisive = stats.matches.filter(m => m.isWin || m.isLoss);

      // Aktuelle Serien
      let winStreak = 0;
      for (let i = decisive.length - 1; i >= 0; i--) { if (decisive[i].isWin) winStreak++;  else break; }
      let loseStreak = 0;
      for (let i = decisive.length - 1; i >= 0; i--) { if (decisive[i].isLoss) loseStreak++; else break; }

      stats.winStreak   = winStreak;
      stats.loseStreak  = loseStreak;
      stats.lastShowNo  = stats.matches.at(-1)?.showNo ?? 0;
      stats.totalWins   = decisive.filter(m => m.isWin).length;
      stats.totalLosses = decisive.filter(m => m.isLoss).length;

      // Alle abgeschlossenen Serien (aktuelle laufende Serie wird NICHT gespeichert)
      const allStreaks = [];
      let curType = null, curLen = 0, curStart = null;
      for (const m of decisive) {
        const t = m.isWin ? 'win' : 'loss';
        if (t === curType) {
          curLen++;
        } else {
          if (curType !== null) allStreaks.push({ type: curType, length: curLen, startShowNo: curStart });
          curType = t; curLen = 1; curStart = m.showNo;
        }
      }
      // Letztes laufendes Element wird bewusst nicht gepusht — das ist die aktuelle Serie

      const pastWinStreaks  = allStreaks.filter(s => s.type === 'win');
      const pastLossStreaks = allStreaks.filter(s => s.type === 'loss');

      // Zuletzt abgeschlossene Serie (für "zuletzt im März hatte er 5 in Folge")
      stats.lastPastWinStreak  = pastWinStreaks.at(-1)  || null;
      stats.lastPastLossStreak = pastLossStreaks.at(-1) || null;

      // Konsekutive PPV-Teilnahmen (vom Ende rückwärts)
      let consecutivePPVs = 0;
      for (let i = allPPVShows.length - 1; i >= 0; i--) {
        if (stats.matches.some(m => m.showNo === allPPVShows[i])) consecutivePPVs++;
        else break;
      }
      stats.consecutivePPVs    = consecutivePPVs;
      stats.ppvAppearances     = stats.matches.filter(m => m.showType === 'PPV').length;

      // Konsekutive PPV Main Events
      let consecutivePPVMainEvents = 0;
      for (let i = allPPVShows.length - 1; i >= 0; i--) {
        if (stats.matches.some(m => m.showNo === allPPVShows[i] && m.isMainEvent))
          consecutivePPVMainEvents++;
        else break;
      }
      stats.consecutivePPVMainEvents = consecutivePPVMainEvents;
      stats.ppvMainEvents            = stats.matches.filter(m => m.showType === 'PPV' && m.isMainEvent).length;
    });

    return map;
  }

  function buildH2HMap_(history) {
    const h2h = {};

    history.forEach(match => {
      const participants = getParticipants_(match);
      // Alle Paarungen innerhalb des Matches bilden
      for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
          const key = [participants[i], participants[j]].sort().join('|');
          if (!h2h[key]) h2h[key] = [];
          h2h[key].push({
            showNo: match.showNo,
            winner: match.winner,
            loser:  match.loser,
            stars:  match.stars,
          });
        }
      }
    });

    return h2h;
  }

  function computeHypeFacts_(currentMatches, history, wrestlerStats, h2hMap, currentShowNo, bestMatchOfYear) {
    const facts = [];

    const typeCountBefore = {
      TryOut: countShowsOfType_(currentShowNo - 1, 'TryOut'),
      Lucky7: countShowsOfType_(currentShowNo - 1, 'Lucky7'),
      PPV:    countShowsOfType_(currentShowNo - 1, 'PPV'),
    };

    // Roster-Rankings — einmalig berechnet, nicht pro Match
    const allEntries = Object.entries(wrestlerStats);

    const winStreakRanking = allEntries
      .filter(([, s]) => s.winStreak >= 3)
      .sort(([, a], [, b]) => b.winStreak - a.winStreak);

    const totalWinsRanking = allEntries
      .filter(([, s]) => s.totalWins >= 5)
      .sort(([, a], [, b]) => b.totalWins - a.totalWins);

    currentMatches.forEach(match => {
      const { isMainEvent, showType } = match;
      const mainBonus    = isMainEvent ? 4 : 0;
      const participants = getParticipants_(match);

      // ── HEAD-TO-HEAD — alle Paarungen des Matches ─────────────────────────────
      for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
          const pA       = participants[i];
          const pB       = participants[j];
          const key      = [pA, pB].sort().join('|');
          const meetings = h2hMap[key] || [];
          const count    = meetings.length;

          if (count === 0) {
            facts.push({
              text:      `${pA} und ${pB} treffen in diesem Jahr zum ersten Mal aufeinander.`,
              score:     3 + mainBonus,
              wrestlers: [pA, pB],
            });
          } else {
            const decisive = meetings.filter(
              m => (m.winner === pA || m.winner === pB) &&
                   (m.loser  === pA || m.loser  === pB)
            );
            const winsA     = decisive.filter(m => m.winner === pA).length;
            const winsB     = decisive.filter(m => m.winner === pB).length;
            const last      = meetings.at(-1);
            const imbalance = Math.abs(winsA - winsB);
            const baseScore = count * 1.5 + imbalance * 2.5;

            if (decisive.length > 0) {
              if (imbalance === 0) {
                facts.push({
                  text:      `${pA} und ${pB} treffen heute zum ${ordinalDE_(count + 1)} Mal aufeinander. Die bisherige Serie steht ${winsA}-${winsB}.`,
                  score:     baseScore + mainBonus + 2,
                  wrestlers: [pA, pB],
                });
              } else {
                const leader   = winsA > winsB ? pA : pB;
                const leaderW  = Math.max(winsA, winsB);
                const trailerW = Math.min(winsA, winsB);
                facts.push({
                  text:      `${pA} und ${pB} treffen heute zum ${ordinalDE_(count + 1)} Mal aufeinander. ${leader} führt die Serie mit ${leaderW}-${trailerW}.`,
                  score:     baseScore + mainBonus,
                  wrestlers: [pA, pB],
                });
              }
            } else {
              facts.push({
                text:      `${pA} und ${pB} standen in diesem Jahr bereits ${count}-mal im selben Match.`,
                score:     count * 1.2 + mainBonus,
                wrestlers: [pA, pB],
              });
            }

            if (last.stars >= 4.5) {
              facts.push({
                text:      `Das letzte Aufeinandertreffen zwischen ${pA} und ${pB} (Show ${last.showNo}) wurde mit ${last.stars} Sternen bewertet.`,
                score:     last.stars * 3 + mainBonus,
                wrestlers: [pA, pB],
              });
            }

            if (decisive.length >= 1 && imbalance !== 0) {
              const lastD = decisive.at(-1);
              facts.push({
                text:      `Das letzte direkte Duell zwischen ${pA} und ${pB} (Show ${lastD.showNo}) gewann ${lastD.winner}.`,
                score:     Math.max(1, baseScore * 0.5 + mainBonus - 2),
                wrestlers: [pA, pB],
              });
            }
          }
        }
      }

      // ── AUSSENSEITER-KONTEXT ───────────────────────────────────────────────────
      const withWinStreak  = participants.filter(p => (wrestlerStats[p]?.winStreak  || 0) >= 3);
      const withLoseStreak = participants.filter(p => (wrestlerStats[p]?.loseStreak || 0) >= 3);
      withWinStreak.forEach(wRes => {
        withLoseStreak.forEach(lRes => {
          if (wRes === lRes) return;
          const ws    = wrestlerStats[wRes].winStreak;
          const ls    = wrestlerStats[lRes].loseStreak;
          facts.push({
            text:      `${wRes} kommt mit ${ws} Siegen in Folge — ${lRes} hat die letzten ${ls} Matches verloren.`,
            score:     (ws + ls) * 1.8 + mainBonus,
            wrestlers: [wRes, lRes],
          });
        });
      });

      // ── MATCH DES BISHERIGEN JAHRES ───────────────────────────────────────────
      if (bestMatchOfYear && bestMatchOfYear.stars >= 4.5 && bestMatchOfYear.showNo < currentShowNo) {
        const bmParts = getParticipants_(bestMatchOfYear);
        const overlap = participants.filter(p => bmParts.includes(p));
        if (overlap.length >= 2) {
          facts.push({
            text:      `Das bisher bestbewertete Match des Jahres fand ${showNoToMonthLabel_(bestMatchOfYear.showNo)} (Show ${bestMatchOfYear.showNo}) statt — ${bestMatchOfYear.stars} Sterne. Heute ein mögliches Rematch.`,
            score:     bestMatchOfYear.stars * 3.5 + mainBonus,
            wrestlers: overlap,
          });
        }
      }

      // ── INDIVIDUELLE FAKTEN ───────────────────────────────────────────────────
      participants.forEach(wrestler => {
        if (!wrestler) return;
        const stats = wrestlerStats[wrestler];

        // KHW-Debüt
        if (!stats) {
          facts.push({
            text:      `${wrestler} gibt heute sein KHW-Debüt.`,
            score:     8 + mainBonus,
            wrestlers: [wrestler],
          });
          return;
        }

        // Format-Debüt
        if (stats.lastShowNoByType[showType] === 0) {
          facts.push({
            text:      `${wrestler} gibt heute sein ${showType}-Debüt — bisher nur bei anderen KHW-Formaten aktiv.`,
            score:     6 + mainBonus,
            wrestlers: [wrestler],
          });
          // Weitermachen — ggf. weitere relevante Stats vorhanden
        }

        // Siegesserie
        if (stats.winStreak >= 3) {
          facts.push({
            text:      `${wrestler} hat die letzten ${stats.winStreak} Matches gewonnen.`,
            score:     stats.winStreak * 2.2 + mainBonus,
            wrestlers: [wrestler],
          });

          // Selbstreferenz: Vergleich mit zuletzt abgeschlossener Siegesserie
          if (stats.lastPastWinStreak) {
            const label = showNoToMonthLabel_(stats.lastPastWinStreak.startShowNo);
            facts.push({
              text:      `${wrestler} hat aktuell ${stats.winStreak} Siege in Folge — zuletzt ${label} stand er auf einer ähnlichen Serie (${stats.lastPastWinStreak.length} in Folge).`,
              score:     stats.winStreak * 1.6 + mainBonus - 1,
              wrestlers: [wrestler],
            });
          }

          // Roster-Vergleich: Siegesserie
          const sRank = winStreakRanking.findIndex(([n]) => n === wrestler);
          if (sRank === 0) {
            facts.push({
              text:      `${wrestler} hat aktuell die längste Siegesserie des Rosters: ${stats.winStreak} in Folge.`,
              score:     stats.winStreak * 2.8 + mainBonus,
              wrestlers: [wrestler],
            });
          } else if (sRank === 1) {
            const [ln, ls] = winStreakRanking[0];
            facts.push({
              text:      `${wrestler} hat ${stats.winStreak} Siege in Folge — nur ${ln} liegt mit ${ls.winStreak} noch vor ihm.`,
              score:     stats.winStreak * 2.3 + mainBonus,
              wrestlers: [wrestler],
            });
          }
        }

        // Niederlagenserie
        if (stats.loseStreak >= 3) {
          facts.push({
            text:      `${wrestler} hat die letzten ${stats.loseStreak} Matches verloren.`,
            score:     stats.loseStreak * 2.0 + mainBonus,
            wrestlers: [wrestler],
          });

          // Selbstreferenz
          if (stats.lastPastLossStreak) {
            const label = showNoToMonthLabel_(stats.lastPastLossStreak.startShowNo);
            facts.push({
              text:      `${wrestler} hat aktuell ${stats.loseStreak} Niederlagen in Folge — zuletzt ${label} stand er auf einer ähnlichen Negativserie (${stats.lastPastLossStreak.length} in Folge).`,
              score:     stats.loseStreak * 1.4 + mainBonus - 1,
              wrestlers: [wrestler],
            });
          }
        }

        // Gesamtsiege — Roster-Vergleich
        if (stats.totalWins >= 5) {
          const wRank = totalWinsRanking.findIndex(([n]) => n === wrestler);
          if (wRank === 0) {
            facts.push({
              text:      `${wrestler} hat in diesem Jahr ${stats.totalWins} Matches gewonnen — mehr als jeder andere im Roster.`,
              score:     stats.totalWins * 1.5 + mainBonus,
              wrestlers: [wrestler],
            });
          } else if (wRank === 1) {
            const [ln, ls] = totalWinsRanking[0];
            facts.push({
              text:      `${wrestler} hat in diesem Jahr ${stats.totalWins} Matches gewonnen — nur ${ln} hat mit ${ls.totalWins} mehr.`,
              score:     stats.totalWins * 1.2 + mainBonus,
              wrestlers: [wrestler],
            });
          }
        }

        // Main-Event-Präsenz (letzte 8 Shows)
        const WINDOW        = 8;
        const windowStart   = Math.max(1, currentShowNo - WINDOW);
        const windowShows   = Math.min(WINDOW, currentShowNo - 1);
        const windowMatches = stats.matches.filter(m => m.showNo >= windowStart && m.showNo < currentShowNo);
        const meCount       = windowMatches.filter(m => m.isMainEvent).length;
        if (meCount >= 3 && windowShows > 0) {
          facts.push({
            text:      `${wrestler} stand in den letzten ${windowShows} Shows ${meCount}-mal im Main Event.`,
            score:     (meCount / windowShows) * 12 + mainBonus,
            wrestlers: [wrestler],
          });
        }

        // Erstes Main Event des Jahres
        if (isMainEvent && stats.matches.filter(m => m.isMainEvent && m.showNo < currentShowNo).length === 0) {
          facts.push({
            text:      `${wrestler} steht heute zum ersten Mal in diesem Jahr im Main Event.`,
            score:     5,
            wrestlers: [wrestler],
          });
        }

        // PPV-Präsenz (nur bei PPV-Shows)
        if (showType === 'PPV') {
          if (stats.consecutivePPVs >= 2) {
            facts.push({
              text:      `${wrestler} steht heute zum ${ordinalDE_(stats.consecutivePPVs + 1)} Mal in Folge bei einem PPV im Einsatz.`,
              score:     stats.consecutivePPVs * 2.5 + mainBonus,
              wrestlers: [wrestler],
            });
          }
          if (isMainEvent && stats.consecutivePPVMainEvents >= 2) {
            facts.push({
              text:      `${wrestler} steht heute zum ${ordinalDE_(stats.consecutivePPVMainEvents + 1)} Mal in Folge im PPV Main Event.`,
              score:     stats.consecutivePPVMainEvents * 4.5 + mainBonus,
              wrestlers: [wrestler],
            });
          }
        }

        // ── COMEBACK / DEBÜT ─────────────────────────────────────────────────────
        const lastOfType   = stats.lastShowNoByType[showType] || 0;
        const rankOfLast   = lastOfType > 0 ? countShowsOfType_(lastOfType, showType) : 0;
        const absentOfType = typeCountBefore[showType] - rankOfLast;

        const formSuffix = () => {
          if (stats.winStreak  >= 2) return ` Zuletzt ${stats.winStreak} Siege in Folge.`;
          if (stats.loseStreak >= 2) return ` Zuletzt ${stats.loseStreak} Niederlagen in Folge.`;
          return '';
        };

        if (absentOfType >= 6 && lastOfType > 0) {
          // Format-spezifisches Comeback
          facts.push({
            text:      `${wrestler} stand zuletzt ${showNoToMonthLabel_(lastOfType)} bei ${showType} im Einsatz — heute ein Comeback nach ${absentOfType} ${showType}-Shows.${formSuffix()}`,
            score:     absentOfType * 1.4 + mainBonus,
            wrestlers: [wrestler],
          });
        } else {
          // Globale Abwesenheit (ab 10 Shows)
          const showsAbsent = currentShowNo - 1 - stats.lastShowNo;
          if (showsAbsent >= 10) {
            facts.push({
              text:      `${wrestler} war zuletzt ${showNoToMonthLabel_(stats.lastShowNo)} aktiv — heute ein Comeback nach ${showsAbsent} Shows.${formSuffix()}`,
              score:     showsAbsent * 1.2 + mainBonus,
              wrestlers: [wrestler],
            });
          }
        }

        // Hoher Match-Schnitt
        const rated = stats.matches.filter(m => (m.isWin || m.isLoss) && m.stars > 0);
        if (rated.length >= 3) {
          const avg = rated.reduce((s, m) => s + m.stars, 0) / rated.length;
          if (avg >= 4.0) {
            facts.push({
              text:      `${wrestler} kommt in diesem Jahr auf einen Match-Schnitt von ${avg.toFixed(1)} Sternen.`,
              score:     avg * 2.2,
              wrestlers: [wrestler],
            });
          }
        }
      });
    });

    return facts;
  }

  function selectTopFacts_(candidates) {
    candidates.sort((a, b) => b.score - a.score);

    const selected       = [];
    const usedWrestlers  = new Set();

    for (const fact of candidates) {
      if (selected.length >= 3) break;
      if (fact.wrestlers.some(w => usedWrestlers.has(w))) continue;
      selected.push(fact);
      fact.wrestlers.forEach(w => usedWrestlers.add(w));
    }

    return selected;
  }

  function ordinalDE_(n) {
    const words = ['ersten','zweiten','dritten','vierten','fünften',
                   'sechsten','siebten','achten','neunten','zehnten'];
    return n >= 1 && n <= 10 ? words[n - 1] : `${n}.`;
  }

  /**
   * Fakten für eine beliebige Show.
   * @param {Array} shows  Alle Shows aus dem Modell (model.shows)
   * @param {number} showNo
   */
  K.hypeFacts = function (shows, showNo) {
    const toHype = show => show.matches
      .filter(m => Number.isFinite(m.no) && m.no >= 1)   // bei PPVs zählen beide Hälften (in Card.gs nur die linke)
      .map(m => ({
        showNo: show.no, showType: show.type, matchNum: m.no, type: m.type,
        winner: m.winner, loser: m.loser, additional: m.extra, stars: m.stars || 0, isMainEvent: false,
      }));
    const mark = list => {
      if (list.length) { const mx = Math.max(...list.map(m => m.matchNum)); list.forEach(m => { m.isMainEvent = m.matchNum === mx; }); }
      return list;
    };
    const history = [];
    shows.filter(s => s.no < showNo).forEach(s => mark(toHype(s)).forEach(m => history.push(m)));
    const cur = shows.find(s => s.no === showNo);
    const current = cur ? mark(toHype(cur)) : [];
    if (!current.length || showNo < 2) return [];

    const allPPVShows = [];
    for (let n = 1; n < showNo; n++) if (getShowType_(n) === 'PPV') allPPVShows.push(n);
    const rated = history.filter(m => m.stars > 0);
    const best = rated.length ? rated.reduce((b, m) => m.stars > b.stars ? m : b) : null;
    const stats = buildWrestlerStats_(history, showNo, allPPVShows);
    const h2h = buildH2HMap_(history);
    return selectTopFacts_(computeHypeFacts_(current, history, stats, h2h, showNo, best));
  };

  K.showType = getShowType_;
  K.monthLabel = showNoToMonthLabel_;
  K.countShowsOfType = countShowsOfType_;
})(window.KHW);
