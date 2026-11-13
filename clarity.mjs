// Fetches the Microsoft Clarity numbers of the Bijlex website.
//
//   node clarity.mjs        the last day
//   node clarity.mjs 3      the last 3 days (Clarity allows 1, 2 or 3)
//
// Read-only, through Clarity's Data Export API. Clarity allows only 10 calls
// per project per day, and this script makes one call each time it runs.
//
// The token comes from the environment variable BIJLEX_CLARITY_TOKEN. Locally
// it is read from .env in this folder (never committed, see .env.example); on
// GitHub it comes from a secret. Make a token in Clarity: Instellingen,
// Gegevensexport.
try { process.loadEnvFile(new URL('.env', import.meta.url)); } catch { /* no .env: use the real environment */ }

const DAGEN = Math.min(3, Math.max(1, parseInt(process.argv[2], 10) || 1));

function stop(tekst, code = 1) { console.error(tekst); process.exit(code); }

const token = (process.env.BIJLEX_CLARITY_TOKEN || '').trim();
if (!token) stop('BIJLEX_CLARITY_TOKEN ontbreekt. Zet het in .env in deze map (zie .env.example). Een token maak je in Clarity onder Instellingen, Gegevensexport.');

let r;
try {
  r = await fetch(`https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=${DAGEN}`, {
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(30000)
  });
} catch (e) {
  stop(`Clarity is nu niet bereikbaar (${e.name === 'TimeoutError' ? 'geen antwoord binnen 30 seconden' : e.message}). Probeer het later opnieuw.`, 2);
}
const tekst = await r.text();
if (r.status === 401 || r.status === 403) stop('Clarity weigert het token. Het is waarschijnlijk verwijderd of vervangen; maak een nieuw token in Instellingen, Gegevensexport.');
if (r.status === 429) stop('Clarity zegt: te vaak opgevraagd. Er mag maar 10 keer per dag; probeer het morgen opnieuw.', 2);
if (!r.ok) stop(`Clarity gaf een fout (${r.status}): ${tekst.slice(0, 300)}`, 2);

let data;
try { data = JSON.parse(tekst); } catch { stop('Clarity gaf een onleesbaar antwoord.', 2); }

// Clarity returns a list of metrics: [{ metricName, information: [ {...} ] }].
const lijst = Array.isArray(data) ? data : [];
const eerste = (naam) => lijst.find((m) => m.metricName === naam)?.information?.[0] || {};
const getal = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const tijd = (s) => {
  s = getal(s);
  if (s === null) return '-';
  return s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`;
};

console.log(`Bijlex-website, Microsoft Clarity, laatste ${DAGEN === 1 ? 'dag' : DAGEN + ' dagen'}`);
console.log('Alleen bezoekers die statistieken hebben geaccepteerd tellen mee.\n');

const verkeer = eerste('Traffic');
const bezoeken = getal(verkeer.totalSessionCount) || 0;
console.log(`Bezoeken:            ${bezoeken}`);
console.log(`Unieke bezoekers:    ${getal(verkeer.distinctUserCount) || 0}`);
console.log(`Bezoeken door bots:  ${getal(verkeer.totalBotSessionCount) || 0}`);

if (!bezoeken) {
  console.log('\nEr zijn in deze periode geen bezoeken gemeten.');
  console.log('Dat klopt zolang er nog geen bezoeker met toestemming op de site is geweest.');
  process.exit(0);
}

const pps = getal(verkeer.pagesPerSessionPercentage);
if (pps !== null) console.log(`Pagina's per bezoek: ${pps}`);
const betrokken = eerste('EngagementTime');
console.log(`Tijd op de site:     ${tijd(betrokken.totalTime)} (waarvan actief ${tijd(betrokken.activeTime)}), gemiddeld per bezoek`);
const scroll = getal(eerste('ScrollDepth').averageScrollDepth);
console.log(`Scrolldiepte:        ${scroll === null ? '-' : Math.round(scroll) + '% van de pagina'}, gemiddeld`);

// Signs that something on the site frustrates visitors.
const ERGERNIS = [
  ['RageClickCount', 'Rage clicks (boos herhaald klikken)'],
  ['DeadClickCount', 'Dead clicks (klikken waar niets gebeurt)'],
  ['QuickbackClick', 'Snel terug (klikken en meteen terug)'],
  ['ExcessiveScroll', 'Overmatig scrollen'],
  ['ErrorClickCount', 'Klikken die een fout geven'],
  ['ScriptErrorCount', 'Scriptfouten']
];
console.log('\nErgernissen (deel van de bezoeken waarin het gebeurde)');
for (const [naam, uitleg] of ERGERNIS) {
  const m = eerste(naam);
  const pct = getal(m.sessionsWithMetricPercentage) || 0;
  console.log(`  ${uitleg.padEnd(42)} ${String(pct).padStart(5)}%   (${getal(m.subTotal) || 0} keer)`);
}

// Anything else Clarity sends (for example lists per page or device).
const bekend = new Set(['Traffic', 'EngagementTime', 'ScrollDepth', ...ERGERNIS.map(([n]) => n)]);
for (const m of lijst.filter((x) => !bekend.has(x.metricName) && x.information?.length)) {
  console.log(`\n${m.metricName}`);
  for (const rij of m.information.slice(0, 10)) console.log('  ' + Object.entries(rij).map(([k, v]) => `${k}: ${v}`).join(', '));
}
