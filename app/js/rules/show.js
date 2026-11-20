// KHW Manager – Regeln für das Beenden einer Show.
// Nachgebaut aus EndShow() (GewinnVerlust.gs) mit TransferStars, RunCardBet, UpdateEloFromCard, GewinnVerlust und
// UpdateDropdown sowie den Formeln in Finanzen!A26:K55 und M2:M11. Reine Rechenfunktionen ohne Oberfläche und Speicher.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const R = (a, b) => K.randBetween(a, b);
  const rr = range => R(range[0], range[1]);

  // Hallen, Rabattstufen, Kosten für Werbung und Sponsoring, Streaming und Merch stehen im Regelwerk
  // (rules/config.js, Admin-Seite „Regelwerk“). Hier wird nur damit gerechnet.
  const HALLS = () => K.conf.get('halls');
  const FIN = () => K.conf.get('finance');
  const hallOf = name => { const h = HALLS(); return h[name] ? name : (h['HK Casino'] ? 'HK Casino' : Object.keys(h)[0]); };

  // Stufenboni je Follower-Stufe (Index = Stufe 0–4)
  const TIER = {
    tickets: [null, [100, 240], [240, 440], [360, 740], [500, 1000]],
    stream: [null, [1200, 2200], [2200, 5000], [4700, 7900], [5000, 10000]],
    merch: [null, [2500, 5000], [5000, 10000], [7500, 15000], [10000, 20000]],
    sponsor: [[2500, 5000], [12500, 25000], [22500, 45000], [32500, 65000], [42500, 85000]],
  };
  const tierRoll = (table, level) => table[level] ? rr(table[level]) : 0;

  /** Miet-Faktor aus der Follower-Veränderung der letzten Show (P3): 0,8 bis 1,45. */
  const rentFactor = (rent, p3) => !rent.grow ? 1 : p3 < 0 ? 0.8 : p3 > 4000 ? 1.45 : (p3 + (rent.offset || 0)) / 6740 * rent.grow + 0.8;

  K.rules = K.rules || {};
  K.rules.show = {
    get HALLS() { return HALLS(); },
    get HALL_NAMES() { return Object.keys(HALLS()); },
    get DISCOUNTS() { return FIN().discounts; },
    get FEES() { return FIN().fees; },
    hallOf,
    DEFAULT_VENUE: { land: 'Deutschland', stadt: 'Köln', halle: 'HK Casino' },
    STAR_STEPS: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5],

    /** Kosten für Werbung oder Sponsoring nach Rabatt. */
    fee(kind, discount) { return (FIN().fees[kind] || 0) * (1 - (discount || 0) / 100); },

    /**
     * Sterne übertragen (TransferStars): Segmente unter 3 Sternen mit Storyline bekommen zufällig +1 bis +2,5
     * (auf halbe Sterne gerundet). Liefert die Sterne je Match und die Summe.
     */
    stars(show) {
      let total = 0;
      const rows = show.matches.map(mt => {
        let val = typeof mt.stars === 'number' && !Number.isNaN(mt.stars) ? mt.stars : null;
        if (val === null) return { mt, stars: null, bonus: 0 };
        let bonus = 0;
        if (val < 3 && mt.storyline) { bonus = K.pick([1, 1.5, 2, 2.5]); val = Math.round((val + bonus) * 2) / 2; }
        total += val;
        return { mt, stars: val, bonus };
      });
      return { rows, total };
    },

    /** Möglicher Wettgewinn bei Quote q (Prozent). Die Quote zählt stärker als im Original (Außenseiter bringen mehr). */
    betRange(q) {
      if (!q) return null;
      const f = 101.04 * (100 - q) / 100 * Math.sqrt(50 / q);
      return [40 * f, 60 * f];
    },
    betGain(q) { return q ? R(40, 60) * 101.04 * (100 - q) / 100 * Math.sqrt(50 / q) : 0; },

    /** Wette (RunCardBet): erstes als Wette markiertes Match; ausgezahlt wird auf den Sieger. */
    bet(m, show) {
      const mt = show.matches.find(x => x.bet);
      if (!mt) return { rows: [], gain: 0, note: 'Keine Wette.' };
      const o = K.betOdds(m, mt);
      if (!o || !o.list) return { rows: [], gain: 0, note: 'Die Teilnehmer stehen nicht in einer gemeinsamen Rangliste.' };
      const rows = o.rows.map(r => ({ name: r.name, rank: r.rank, quote: r.quote, gain: this.betGain(r.quote) }));
      const win = rows.find(r => K.winners(mt).includes(r.name)) || rows[0];
      return { rows: [win, ...rows.filter(r => r !== win)], gain: win.gain, list: o.list, match: mt };
    },

    /**
     * ELO (UpdateEloFromCard): K = 32, je Match Sieger gegen Verlierer; Teams zählen mit dem Schnitt ihrer Mitglieder.
     * Stehen mehrere Namen (mit Komma) auf einer Seite, gilt die Seite wie ein Team: Schnitt der Wertungen,
     * die Änderung wird auf alle verteilt.
     */
    elo(m, show) {
      const r = new Map(m.roster.map(w => [w.name, w.elo === null ? 1000 : w.elo]));
      const start = new Map(r);
      const teams = new Map();
      (m.teams || []).forEach(t => teams.set(t.name, t.members.filter(n => r.has(n))));
      const rating = e => r.has(e) ? r.get(e) : teams.has(e) ? teams.get(e).reduce((s, n) => s + r.get(n), 0) / teams.get(e).length : null;
      const apply = (e, d) => { if (r.has(e)) r.set(e, r.get(e) + d); else if (teams.has(e)) teams.get(e).forEach(n => r.set(n, r.get(n) + d / teams.get(e).length)); };
      const side = names => { const rs = names.map(rating); return rs.some(x => x === null) || !rs.length ? null : rs.reduce((a, b) => a + b, 0) / rs.length; };
      show.matches.forEach(mt => {
        const W = K.winners(mt), L = K.losers(mt);
        if (!W.length || !L.length) return;
        const rw = side(W), rl = side(L);
        if (rw === null || rl === null) return;
        const d = 32 * (1 - 1 / (1 + Math.pow(10, (rl - rw) / 400)));
        W.forEach(e => apply(e, d / W.length)); L.forEach(e => apply(e, -d / L.length));
      });
      const changes = [];
      r.forEach((v, name) => { const a = start.get(name); if (Math.abs(v - a) > 0.001) changes.push({ name, from: a, to: Math.round(v * 10) / 10 }); });
      return changes;
    },

    /** Titelmatches: Der Sieger bekommt den Titel (mehrere Sieger zusammen, z. B. „A & B“). */
    titleChanges(m, show) {
      return show.matches.filter(mt => mt.title && mt.winner).map(mt => {
        const t = m.titles.find(x => x.name === mt.title);
        const holder = K.winners(mt).join(' & ');
        return { title: mt.title, from: t ? t.holder : '', to: holder, defended: !!t && t.holder === holder };
      });
    },

    /**
     * Follower (Social Media in GewinnVerlust), neu nach dem Sterne-DURCHSCHNITT statt der Summe, damit kurze Shows
     * nicht automatisch schlecht abschneiden. Segmente ohne Sterne (leer oder 0) zählen nicht mit.
     * Umrechnung: Der Schnitt wird so behandelt, als hätte die Show 9 bewertete Segmente (eine übliche Show der
     * Tabelle), und dann wie im Original gerechnet: Summe 10 → −5, Summe 28 → +5; PPV zählt 2,5-fach.
     * Beispiele: Ø 3,4 ≈ wie bisher eine gute Show; Ø 2 ≈ leicht negativ; Ø 1,1 = deutlich negativ.
     */
    REF_SEGMENTS: 9,
    followers(rows, ppv) {
      const rated = rows.map(r => r.stars).filter(v => typeof v === 'number' && v > 0);
      const avg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
      const eq = avg * this.REF_SEGMENTS;
      let t5 = (eq - 10) / 18 * 10 - 5;
      if (ppv) t5 *= 2.5;
      const off = Math.min(Math.floor(K.random() * t5 * 1200), 5500);
      return { delta: Math.round(off + K.random() * 20.22 - 10), avg, rated: rated.length };
    },

    /**
     * Abrechnung (GewinnVerlust, Finanzen!A26:K55). opts: { ads, sponsoring, discount }.
     * f = Finanzmodell vor der Show (Follower, Stufen, Preise). Liefert dieselbe Struktur wie die Abrechnung der Tabelle.
     */
    finance(show, f, opts) {
      const ppv = show.type === 'PPV';
      const hall = hallOf(show.venue.halle);
      const H = HALLS()[hall], F = FIN();
      const disc = 1 - (opts.discount || 0) / 100;
      const lvl = i => (f.tiers[i] ? f.tiers[i].level : 0);
      const q3 = f.followers || 0, p3 = f.followerDelta || 0;

      // Tickets
      const p1 = ppv ? H.price[0] : H.price[1];
      const prices = [p1, p1 * 1.5, H.noClass3 ? 0 : p1 * 2];
      const tickets = prices.map((price, i) => {
        const sold = rr(H.sold[i]), byAds = opts.ads ? rr(H.ads[i]) : 0, byTier = i === 0 ? tierRoll(TIER.tickets, lvl(0)) : 0;
        return { label: 'Preisklasse ' + (i + 1), price, sold, byAds, byTier, revenue: price * (sold + byAds + byTier) };
      });
      const ticketRevenue = tickets.reduce((s, t) => s + t.revenue, 0);
      const rentFull = H.rent.base * rentFactor(H.rent, p3);
      const rent = rentFull * disc;
      const ticketProfit = ticketRevenue - rent;

      // Streaming
      const sPrice = ppv ? f.prices.ppv : Math.floor(f.prices.abo / 8.5 * 100) / 100;
      const count = Math.max(0, ppv ? Math.floor((q3 - f.prices.ppv * 2 * R(2250, 2750)) * 0.025) : Math.floor((q3 - f.prices.abo * 2 * R(2300, 2850)) * 0.3));
      const stream = {
        price: sPrice, count, byAds: count < 1000 ? 0 : opts.ads ? R(600, 1600) : 0, byTier: count < 1000 ? 0 : tierRoll(TIER.stream, lvl(1)),
        production: rr(F.stream.production) * 1.02, internet: F.stream.internet,
      };
      stream.revenue = stream.price * (stream.count + stream.byAds + stream.byTier);
      stream.cost = stream.production + stream.internet;
      const streamProfit = stream.revenue - stream.cost;

      // Merchandising
      const soldAll = t => t.sold + t.byAds + t.byTier;
      // Merch je Artikel: vor Ort Anteil der Zuschauer einer Preisklasse × Stückpreis, dazu online.
      // „rare“ (Autogramme): online meist nichts, sonst das 2- bis 3-Fache (wie in der Tabelle).
      const merch = F.merch.map(x => ({
        label: x.label,
        onsite: rr(x.share) / 100 * soldAll(tickets[Math.min(2, x.cls || 0)]) * x.price,
        online: x.rare ? K.pick([0, 0, 0, 0, 2, 3]) * rr(x.online) * 0.93 : rr(x.online) * 0.96,
      }));
      merch.push({ label: 'Autogramme und Unikate (Stufenbonus)', onsite: tierRoll(TIER.merch, lvl(2)), online: tierRoll(TIER.merch, lvl(2)) });
      const merchRevenue = merch.reduce((s, x) => s + x.onsite + x.online, 0);
      const staffCost = rr(F.staff) * 0.9;
      const merchProfit = merchRevenue - staffCost;

      // Sponsoring und Werbung
      const base = opts.sponsoring ? rr(TIER.sponsor[lvl(3)]) * 1.1 : 0;
      const sponsor = { base, big: opts.sponsoring ? base * R(1, 2) : 0 };
      const sponsorRevenue = sponsor.base + sponsor.big;
      const adCosts = [['Social Media und Influencer-Marketing', R(500, 2500) * 1.1], ['Online-Anzeigen', R(200, 1500) * 1.1], ['Flyer und Plakate', R(200, 1500) * 1.1]];
      const adSum = adCosts.reduce((s, x) => s + x[1], 0);
      const adDiscount = opts.ads ? adSum * (F.adDiscount || 0) / 100 : 0;
      const adTotal = adSum - adDiscount;
      const sponsorProfit = sponsorRevenue - adTotal;

      // VIP
      const vp = ppv ? H.vipPrice[0] : H.vipPrice[1];
      const vip = [{ label: 'Preisklasse 1', price: vp, sold: rr(H.vip[0]) }, { label: 'Preisklasse 2', price: vp * (ppv ? 1.5 : 1.25), sold: rr(H.vip[1]) }];
      const vipRevenue = vip.reduce((s, x) => s + x.price * x.sold, 0);
      const insurance = rr(H.insurance) * 0.98;
      const vipProfit = vipRevenue - insurance;

      const visitors = tickets.reduce((s, t) => s + t.sold, 0) + vip.reduce((s, x) => s + x.sold, 0);
      return {
        venue: [show.venue.stadt, hall].filter(Boolean).join(' · '), hall, place: show.venue, ppv, ads: !!opts.ads, sponsoring: !!opts.sponsoring,
        capacity: H.capacity, assumed: !!H.assumed, discount: opts.discount || 0,
        tickets, ticketRevenue, rent, rentFull, rentDiscount: rentFull - rent, ticketProfit,
        stream, streamProfit, merch, merchRevenue, staffCost, merchProfit,
        sponsor, sponsorRevenue, adCosts, adDiscount, adTotal, sponsorProfit,
        vip, vipRevenue, insurance, vipProfit, visitors,
        income: ticketProfit + streamProfit + merchProfit + sponsorProfit + vipProfit,
      };
    },
  };
})(window.KHW);
