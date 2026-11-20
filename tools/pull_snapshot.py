"""Lädt den aktuellen Stand der Tabelle über die Web-App und legt ihn lokal ab.

  data/snapshot.json  – Rohdaten (für Analyse und Tests)
  data/snapshot.js    – dieselben Daten als Skript, damit die App sie auch ohne Netz laden kann

Aufruf (aus dem Ordner "KHW Manager"):  python tools/pull_snapshot.py
"""
import json
import pathlib
import re
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
cfg = (ROOT / "app" / "config.js").read_text(encoding="utf-8")
api_url = re.search(r'apiUrl:\s*"([^"]+)"', cfg).group(1)
token = re.search(r'token:\s*"([^"]+)"', cfg).group(1)

url = api_url + "?" + urllib.parse.urlencode({"token": token})
with urllib.request.urlopen(url, timeout=300) as resp:
    text = resp.read().decode("utf-8")

data = json.loads(text)
if not data.get("ok"):
    raise SystemExit("API-Fehler: " + str(data.get("error")))

out = ROOT / "data"
out.mkdir(exist_ok=True)
(out / "snapshot.json").write_text(text, encoding="utf-8")
(out / "snapshot.js").write_text("window.KHW_SNAPSHOT = " + text + ";\n", encoding="utf-8")
print("Snapshot gespeichert:", data["generatedAt"], "- Show", data["currentShow"], "-", len(text), "Zeichen")
