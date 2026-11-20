// Verbindung zu Supabase (Projekt „KHW“). Beide Werte findest du in Supabase unter
// Project Settings → API Keys (bzw. „Connect“ oben im Dashboard):
//   url  Project URL, z. B. "https://abcdefghijklmnop.supabase.co"
//   key  Publishable key (beginnt mit "sb_publishable_…"); gibt es den nicht, den „anon public“-Key
// Beide Werte sind für den Browser gedacht und dürfen hier stehen – geschützt wird über die Anmeldung.
// NIEMALS den „secret“- oder „service_role“-Key hier eintragen.
// Leer gelassen läuft die App wie bisher nur im Browser (ohne Abgleich zwischen Geräten).
window.KHW_SUPABASE = {
  url: 'https://nxhxvxubhvrkxnzvbmcn.supabase.co',
  key: 'sb_publishable_gLIdh3n6vvcgySXW-mjtuw_tX5BcGVG',
};
