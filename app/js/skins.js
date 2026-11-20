// KHW Manager – „Fremde Seiten“: einzelne Bereiche sehen aus, als kämen sie per iframe von einer anderen Website
// (Klinik, Bank, Chat-Programm, Nachrichtenseiten). Nur Optik: Layout und Bedienung bleiben gleich.
// Fest eingesetzt (Wunsch des Nutzers): Verletzte = Klinik-Portal, Tresor = Bankschließfach, Kontobewegungen =
// Online-Banking, Mails = Chat-Programm, geöffnete News = Nachrichtenseite. Alle Marken, Namen und Adressen sind erfunden.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /** Looks sind fest an (die Abfrage bleibt, damit sich einzelne später leicht wieder abschalten lassen). */
  K.skin = () => true;

  /**
   * Rahmen um einen Teil der Seite. o.url: Adresse in der „Browserleiste“ · o.app: stattdessen Titel eines Programmfensters
   * o.brand: Kopf der fremden Seite (HTML) · o.cls: zusätzliche Klasse. Ist der Look aus, kommt der Inhalt unverändert zurück.
   */
  K.frame = (id, o, inner) => {
    if (!K.skin(id)) return inner;
    const bar = o.app
      ? `<div class="xf-bar xf-app"><span class="xf-dots"><i></i><i></i><i></i></span><span class="xf-app-title">${o.appIcon || ''}${esc(o.app)}</span><span class="xf-app-spacer"></span></div>`
      : `<div class="xf-bar"><span class="xf-dots"><i></i><i></i><i></i></span><span class="xf-nav">‹ ›</span><span class="xf-url"><span class="ms">lock</span>${esc(o.url || '')}</span><span class="xf-star">☆</span></div>`;
    return `<div class="xframe xf-${id} ${o.cls || ''}">${bar}<div class="xf-body">${o.brand || ''}${inner}</div></div>`;
  };

  /* ───────────── Kleine Helfer für die Looks ───────────── */
  /** Stabile Zahl aus einem Text (z. B. damit dieselbe Quelle immer dieselbe Nachrichtenseite bekommt). */
  K.skinHash = t => { let h = 0; for (const c of String(t || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  K.skinSlug = t => String(t || 'news').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'news';
  /** EKG-Linie (Deko für die Klinik). */
  K.skinEcg = () => `<svg class="ecg" viewBox="0 0 240 40" preserveAspectRatio="none"><polyline points="0,22 40,22 50,22 56,10 62,32 68,4 74,36 80,22 120,22 130,22 136,14 142,28 148,22 240,22"/></svg>`;
})(window.KHW);
