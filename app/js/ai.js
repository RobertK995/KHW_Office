// KHW Manager – Anbindung an die KI (Hugging Face, Chat-Schnittstelle wie OpenAI).
//
// Einstellungen gelten je Gerät und liegen nur im Browser (localStorage „khw.ai“), nie in einer Datei:
//   live   false = Simulation (es geht KEINE Anfrage raus), true = echte Anfragen
//   token  Hugging-Face-Token (HF_API_TOKEN)        model  Modellname
// Eingestellt im Admin-Modus (Admin-Leiste → KI). Später übernimmt eine Supabase-Funktion den Token.
window.KHW = window.KHW || {};
(function (K) {
  'use strict';
  const KEY = 'khw.ai';
  const ENDPOINT = 'https://router.huggingface.co/v1/chat/completions';
  const DEFAULT_MODEL = 'deepseek-ai/DeepSeek-V3.2-Exp';
  const load = () => { try { return Object.assign({ live: false, token: '', model: DEFAULT_MODEL }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { live: false, token: '', model: DEFAULT_MODEL }; } };

  /** Simulierte Antwort (zum Testen ohne Anfragen). Erkennt grob, was verlangt ist. */
  function simulate(messages) {
    const last = messages[messages.length - 1].content;
    const pick = a => a[Math.floor(Math.random() * a.length)];
    if (/Vertragsverhandlung/.test(last)) {
      const tag = /\[Bedingungen/.test(last) ? '\n[Bedingungen: eigene Garderobe mit Spiegel; Einzug mit Pyro bei jedem Auftritt]' : '';
      if (/bricht die Verhandlung/.test(last)) return '[Simulation] „Wisst ihr was? Ich hab bessere Angebote auf dem Anrufbeantworter als euren Witz hier.“ Er schiebt den Stuhl zurück und geht.';
      if (/lehnt ab und besteht/.test(last)) return '[Simulation] „Süß, wirklich. Aber mein Preis steht – nehmt ihn oder lasst es.“';
      return '[Simulation] „Na gut, ihr Geier. Aber dann will ich auch, dass alle sehen, wer hier der Star ist.“ Er streckt die Hand über den Tisch.' + tag;
    }
    if (/Kurzmeldung/.test(last)) return pick([
      '[Simulation] Exklusiv: Augenzeugen berichten von einem Streit am Buffet, der in einem Kartoffelsalat-Tornado endete. KHW schweigt, die Fans jubeln.',
      '[Simulation] Ein anonymer Insider will wissen, dass hinter den Kulissen gewaltig etwas brodelt. Mehr dazu, sobald wir es uns ausgedacht haben.',
    ]);
    if (/Szene|Treffen/.test(last) && !/Antwortmail/.test(last)) return pick([
      '[Simulation] Er lehnt lässig an der Theke, ein halb leeres Kölsch in der Hand, und mustert euch. „Ihr wisst, warum ich hier bin.“ Hinter ihm verstummt die ganze Bar.\n[Probe: Charisma, Wahrnehmung]',
      '[Simulation] Die Tür fliegt auf, er stürmt herein und knallt einen Stapel Fotos auf den Tisch. „Erklärt mir das. Sofort.“\n[Probe: Täuschung]',
    ]);
    return pick([
      '[Simulation] Liebe Bosse, ich sage es, wie es ist: So geht das nicht weiter. Ich brauche mehr Sendezeit oder ich erzähle der Presse, was im Büro wirklich passiert. Was bietet ihr mir?\n[Probe: Charisma]',
      '[Simulation] Hallo ihr beiden, ich habe da eine Idee, die uns alle reich macht und höchstens ein bisschen illegal ist. Seid ihr dabei oder muss ich erst zu Wrestlution gehen?\n[Merken: wittert das große Geld]\n[Probe: Kontakte, Täuschung]',
    ]);
  }

  K.ai = {
    get settings() { return load(); },
    save(s) { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(load(), s))); } catch (e) { /* ohne Speicher */ } },
    DEFAULT_MODEL,
    /**
     * Chat-Anfrage. messages = [{ role: 'system' | 'user' | 'assistant', content }]. Liefert den Antworttext.
     * Ohne „live“ oder ohne Token wird simuliert – es geht dann keine Anfrage raus.
     */
    /** Mit Supabase liegt der Token auf dem Server (Edge Function „ki“, Secret HF_API_TOKEN), nicht im Browser. */
    get viaServer() { return !!(K.cloud && K.cloud.on && K.cloud.ready); },
    async chat(messages, opt = {}) {
      const s = load();
      // Mit Supabase nie direkt aus dem Browser senden: im Testmodus (getrennt) wird nur simuliert
      const cloudOff = K.cloud && K.cloud.on && !this.viaServer;
      if (!s.live || cloudOff || (!s.token && !this.viaServer)) {
        await new Promise(r => setTimeout(r, 700));
        return simulate(messages);
      }
      if (this.viaServer) {
        const { data, error } = await K.cloud.client.functions.invoke('ki', {
          body: { messages, max_tokens: opt.maxTokens || 220, model: s.model || DEFAULT_MODEL, temperature: opt.temperature || 0.8 },
        });
        if (error) {
          let msg = error.message;
          try { const b = await error.context.json(); if (b && b.error) msg = b.error; } catch (e) { /* ohne Text */ }
          throw new Error(msg);
        }
        if (!data || typeof data.text !== 'string') throw new Error((data && data.error) || 'Unerwartete Antwort der KI.');
        return data.text;
      }
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + s.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: s.model || DEFAULT_MODEL, messages, max_tokens: opt.maxTokens || 220, temperature: opt.temperature || 0.8 }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`KI antwortet mit Fehler ${res.status}: ${text.slice(0, 200)}`);
      const json = JSON.parse(text);
      const c = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
      if (typeof c !== 'string') throw new Error('Unerwartete Antwort der KI.');
      // Manche Modelle schicken Denkschritte in <think>…</think> mit – die gehören nicht in den Text
      return c.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    },
  };
})(window.KHW);
