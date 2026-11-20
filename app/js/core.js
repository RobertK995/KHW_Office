// KHW Manager – Grundfunktionen: Zugriff auf die Blattdaten und Formatierung.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';

  K.colToNum = s => { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
  K.numToCol = n => { let s = ''; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - 1 - r) / 26; } return s; };

  /** Deutsche Zahl ("1.234,5 €") oder Zahl → Number; sonst null. */
  K.num = x => {
    if (typeof x === 'number') return Number.isFinite(x) ? x : null;
    if (typeof x !== 'string') return null;
    const t = x.replace(/[€%\s]/g, '').replace(/\./g, '').replace(',', '.');
    if (t === '' || !/^-?\d+(\.\d+)?$/.test(t)) return null;
    return parseFloat(t);
  };

  /** Ein Blatt aus dem API-Abzug. Zelle = [zeile, spalte, wert, anzeige, formel, notiz, hintergrund]. */
  K.Sheet = class {
    constructor(name, raw) {
      this.name = name;
      this.rows = raw.rows || 0;
      this.cols = raw.cols || 0;
      this.merges = raw.merges || [];
      this.map = new Map();
      (raw.cells || []).forEach(c => this.map.set(c[0] * 1000 + c[1], c));
    }
    rc(r, c) { return this.map.get(r * 1000 + c); }
    a1(a) { const m = /^([A-Z]+)(\d+)$/.exec(a); return this.rc(Number(m[2]), K.colToNum(m[1])); }
    _get(a, c, i) { const cell = c === undefined ? this.a1(a) : this.rc(a, c); return cell ? cell[i] : ''; }
    /** Rohwert */      v(a, c) { return this._get(a, c, 2); }
    /** Anzeigetext */  d(a, c) { const x = this._get(a, c, 3); return x == null ? '' : String(x); }
    /** Formel */       f(a, c) { return this._get(a, c, 4); }
    /** Notiz */        note(a, c) { return this._get(a, c, 5); }
    /** Hintergrund */  bg(a, c) { return this._get(a, c, 6); }
    /** Zahl */         n(a, c) { const x = K.num(this.v(a, c)); return x === null ? K.num(this.d(a, c)) : x; }
    /** Checkbox */     b(a, c) { const x = this.v(a, c); return x === true || x === 'TRUE'; }
  };

  const money = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const money0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  K.eur = (x, short) => (x === null || x === undefined || Number.isNaN(x)) ? '–' : (short ? money0 : money).format(x);
  K.fmt = (x, digits = 0) => (x === null || x === undefined || Number.isNaN(x)) ? '–'
    : new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x);
  K.elo = x => (x === null || x === undefined) ? '–' : K.fmt(x, 1);

  K.esc = s => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  /** Text mit Zeilenumbrüchen als HTML */
  K.nl = s => K.esc(s).replace(/\r?\n/g, '<br>');

  K.splitNames = s => String(s || '').split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);

  /** Fertigkeitsprobe: Stufe gegen Wurf der Spielleitung (aus den Tabellenformeln übernommen). */
  K.skillResult = (lvl, roll) => {
    if (lvl === null || roll === null) return '';
    if (lvl > roll) return lvl - roll >= 3 ? 'Voller Erfolg' : 'Erfolg';
    if (roll > lvl) return roll - lvl >= 3 ? 'Fehlschlag' : 'Gleichstand';
    return 'absoluter Gleichstand';
  };

  /** Beliebtheit / Bindung als Wort (aus den Tabellenformeln übernommen). */
  K.popularityLabel = x => x === null ? '' : x >= 80 ? 'sehr beliebt' : x >= 60 ? 'beliebt' : x >= 40 ? 'neutral' : x >= 0 ? 'unbeliebt' : '';
  K.bondLabel = x => x === null ? '' : x >= 80 ? 'sehr zufrieden / loyal' : x >= 60 ? 'zufrieden / vertrauensvoll' : x >= 40 ? 'neutral' : x >= 0 ? 'verbittert / feindselig' : '';

  /** Liest das Zieldatum aus einer Countdown-Formel: DATE(J;M;T)+TIME(h;m;s). */
  K.countdownTarget = formula => {
    const m = /DATE\((\d+);(\d+);(\d+)\)\+TIME\((\d+);(\d+);(\d+)\)/.exec(formula || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
  };
  K.duration = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const p = n => String(n).padStart(2, '0');
    return `${Math.floor(s / 3600)}:${p(Math.floor(s % 3600 / 60))}:${p(s % 60)}`;
  };
})(window.KHW);
