// Fetches the visitor numbers of the Bijlex website from Google Analytics.
//
//   node cijfers.mjs        the last 7 days
//   node cijfers.mjs 28     the last 28 days
//
// Read-only: it logs in as a service account that has the Viewer role on the
// property and asks the Google Analytics Data API for a few reports.
//
// The key file is NOT in this repository and must never be. By default it is
// read from <home>/.bijlex/analytics-sleutel.json; set BIJLEX_GA_KEY to use
// another path. The property ID is not a secret.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const PROPERTY = process.env.BIJLEX_GA_PROPERTY || '564211126'; // "Bijlex Website v2"
const KEY_FILE = process.env.BIJLEX_GA_KEY || path.join(os.homedir(), '.bijlex', 'analytics-sleutel.json');
const DAGEN = Math.max(1, parseInt(process.argv[2], 10) || 7);
const API = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}`;

function stop(tekst) { console.error(tekst); process.exit(1); }

async function login() {
  let key;
  try { key = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8')); } catch {
    stop(`Sleutelbestand niet gevonden of onleesbaar: ${KEY_FILE}\nZet BIJLEX_GA_KEY op het pad naar het JSON-bestand van het service-account.`);
  }
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const nu = Math.floor(Date.now() / 1000);
  const claim = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: key.token_uri, iat: nu, exp: nu + 600
  });
  const jwt = claim + '.' + crypto.createSign('RSA-SHA256').update(claim).sign(key.private_key).toString('base64url');
  const antwoord = await (await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  })).json();
  if (!antwoord.access_token) {
    stop(`Inloggen bij Google is mislukt: ${antwoord.error_description || antwoord.error}\nDe sleutel is waarschijnlijk verwijderd of vervangen in de Google Cloud Console.`);
  }
  return antwoord.access_token;
}

const token = await login();

// Google's report servers sometimes answer 502 or do not answer at all (seen
// repeatedly on 13 November 2026, the day the property was made). Each request gets
// 20 seconds and two tries. Requests go one at a time: a request that hangs
// keeps counting against Google's limit of 10 at once.
class NietBereikbaar extends Error {}

async function vraag(soort, body) {
  let r, tekst, reden;
  for (let poging = 1; poging <= 2; poging++) {
    if (poging > 1) await new Promise((klaar) => setTimeout(klaar, 3000));
    try {
      r = await fetch(`${API}:${soort}`, {
        method: 'POST',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000)
      });
      tekst = await r.text();
      if (r.status < 500 && r.status !== 429) break;
      reden = r.status === 429 ? 'te veel verzoeken tegelijk' : `serverfout ${r.status}`;
    } catch (e) {
      r = null;
      reden = e.name === 'TimeoutError' ? 'geen antwoord binnen 20 seconden' : e.message;
    }
  }
  if (!r || r.status >= 500 || r.status === 429) throw new NietBereikbaar(reden);
  let j;
  try { j = JSON.parse(tekst); } catch { throw new NietBereikbaar(`onleesbaar antwoord (${r.status})`); }
  if (!r.ok) stop(`Google Analytics gaf een fout (${r.status} ${j.error?.status}): ${j.error?.message}`);
  return (j.rows || []).map((rij) => [
    ...(rij.dimensionValues || []).map((d) => d.value),
    ...(rij.metricValues || []).map((m) => Number(m.value))
  ]);
}

const periode = [{ startDate: `${DAGEN - 1}daysAgo`, endDate: 'today' }];
const rapport = (dimensies, metingen, extra = {}) => vraag('runReport', {
  dateRanges: periode,
  dimensions: dimensies.map((name) => ({ name })),
  metrics: metingen.map((name) => ({ name })),
  ...extra
});
const aflopend = (meting) => ({ orderBys: [{ metric: { metricName: meting }, desc: true }], limit: 10 });

const tabel = (rijen) => {
  const breed = Math.max(...rijen.map((r) => String(r[0]).length));
  for (const r of rijen) console.log('  ' + String(r[0]).padEnd(breed + 2) + r.slice(1).map((v) => String(v).padStart(8)).join(''));
};

console.log(`Bijlex-website, Google Analytics property ${PROPERTY}`);
console.log('Alleen bezoekers die statistieken hebben geaccepteerd tellen mee.\n');

let mislukt = false;
try {
  const nu = await vraag('runRealtimeReport', { metrics: [{ name: 'activeUsers' }] });
  console.log(`Nu op de site (laatste 30 minuten): ${nu[0]?.[0] ?? 0}\n`);

  console.log(`Laatste ${DAGEN} dagen`);
  const [bezoekers = 0, sessies = 0, weergaven = 0] = (await rapport([], ['activeUsers', 'sessions', 'screenPageViews']))[0] || [];
  console.log(`  bezoekers:        ${bezoekers}`);
  console.log(`  bezoeken:         ${sessies}`);
  console.log(`  paginaweergaven:  ${weergaven}`);

  const perDag = await rapport(['date'], ['activeUsers', 'screenPageViews'], { orderBys: [{ dimension: { dimensionName: 'date' } }] });
  if (!perDag.length) {
    console.log('\nEr staan voor deze periode nog geen bezoeken in de rapporten.');
    console.log('Google verwerkt bezoeken met een vertraging van een tot twee dagen; "nu op de site" loopt wel direct mee.');
  } else {
    console.log('\nPer dag (bezoekers, paginaweergaven)');
    tabel(perDag.map(([d, b, w]) => [`${d.slice(6)}-${d.slice(4, 6)}-${d.slice(0, 4)}`, b, w]));
    console.log('\nMeest bekeken pagina\'s');
    tabel(await rapport(['pagePath'], ['screenPageViews'], aflopend('screenPageViews')));
    console.log('\nWaar bezoeken vandaan komen');
    tabel(await rapport(['sessionDefaultChannelGroup'], ['sessions'], aflopend('sessions')));
  }
} catch (e) {
  if (!(e instanceof NietBereikbaar)) throw e;
  mislukt = true;
  console.log(`\nNIET COMPLEET: Google Analytics gaf geen antwoord op de rest (${e.message}).`);
  console.log('Wat hierboven staat klopt; wat ontbreekt is niet opgehaald. Dat ligt aan Google, niet aan de sleutel of de site.');
  console.log('Probeer het over een paar minuten opnieuw.');
}
process.exit(mislukt ? 2 : 0);
