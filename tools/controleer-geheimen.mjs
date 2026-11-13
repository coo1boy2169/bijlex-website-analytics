// Stops keys and tokens from being committed or pushed.
//
// Run by the git hooks in .githooks/ (switch them on once per clone with
// `git config core.hooksPath .githooks`):
//   pre-commit  node tools/controleer-geheimen.mjs --staged   checks what is staged
//   pre-push    node tools/controleer-geheimen.mjs --push     checks every commit being pushed
//
// It blocks two things:
//   1. files whose name looks like a key or token file (.json, .pem, .env, ...),
//      even when they were added with `git add -f` past .gitignore;
//   2. content that looks like a secret: private keys, Google service account
//      files, Google API keys, GitHub tokens and JWTs such as the Clarity token.
//
// The real keys belong in .env (never committed) or in GitHub secrets.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const VERBODEN_NAMEN = [
  [/\.json$/i, 'JSON-bestand (zo zien sleutelbestanden van Google eruit)'],
  [/\.(pem|key|p12|pfx|crt)$/i, 'sleutel- of certificaatbestand'],
  [/(^|\/)\.env/i, 'omgevingsbestand (.env)'],
  [/token|secret|sleutel|credential/i, 'naam wijst op een token of sleutel']
];
// The template holds no secrets; its content is still checked below.
const TOEGESTANE_NAMEN = [/(^|\/)package(-lock)?\.json$/i, /(^|\/)\.env\.example$/];

const PATRONEN = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'privésleutel'],
  [/"private_key"\s*:\s*"/, 'privésleutel uit een service-accountbestand'],
  [/"type"\s*:\s*"service_account"/, 'Google service-accountbestand'],
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API-sleutel'],
  [/gh[pousr]_[A-Za-z0-9]{36}/, 'GitHub-token'],
  [/github_pat_[A-Za-z0-9_]{22,}/, 'GitHub-token'],
  [/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'JWT-token (bijvoorbeeld het Clarity-token)']
];

const fouten = [];

function controleerNaam(bestand) {
  if (TOEGESTANE_NAMEN.some((p) => p.test(bestand))) return;
  for (const [p, reden] of VERBODEN_NAMEN) if (p.test(bestand)) { fouten.push(`${bestand}: ${reden}`); return; }
}

function controleerInhoud(waar, tekst, metRegelnummer = true) {
  tekst.split(/\r?\n/).forEach((regel, i) => {
    for (const [p, reden] of PATRONEN) if (p.test(regel)) fouten.push(`${waar}${metRegelnummer ? ` regel ${i + 1}` : ''}: ${reden}`);
  });
}

if (process.argv.includes('--staged')) {
  const bestanden = git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z').split('\0').filter(Boolean);
  for (const b of bestanden) {
    controleerNaam(b);
    let inhoud;
    try { inhoud = git('show', ':' + b); } catch { continue; }
    if (!inhoud.includes('\0')) controleerInhoud(b, inhoud); // skip binary files
  }
} else if (process.argv.includes('--push')) {
  // git gives one line per ref: <local ref> <local sha> <remote ref> <remote sha>
  const NUL = /^0+$/;
  for (const regel of fs.readFileSync(0, 'utf8').split(/\r?\n/).filter(Boolean)) {
    const [, lokaal, , extern] = regel.split(' ');
    if (NUL.test(lokaal)) continue; // deleting a branch
    const bereik = NUL.test(extern) ? [lokaal, '--not', '--remotes'] : [`${extern}..${lokaal}`];
    for (const b of git('log', '--format=', '--name-only', '--diff-filter=ACMR', ...bereik).split(/\r?\n/).filter(Boolean)) controleerNaam(b);
    // Only the added lines of each commit.
    const toegevoegd = git('log', '-p', '--format=', '--no-color', ...bereik).split(/\r?\n/)
      .filter((r) => r.startsWith('+') && !r.startsWith('+++')).map((r) => r.slice(1)).join('\n');
    controleerInhoud('commits die je pusht', toegevoegd, false);
  }
} else {
  console.error('Gebruik: node tools/controleer-geheimen.mjs --staged | --push');
  process.exit(2);
}

if (fouten.length) {
  const uniek = [...new Set(fouten)];
  console.error('\nGESTOPT: dit lijkt op een sleutel of token en mag niet naar GitHub.\n');
  for (const f of uniek) console.error('  - ' + f);
  console.error('\nSleutels en tokens horen in .env (wordt nooit gecommit) of in de secrets op GitHub.');
  if (process.argv.includes('--push')) {
    console.error('Er is niets gepusht. Het geheim zit al in een commit: haal het eruit (bijvoorbeeld met');
    console.error('git reset --soft origin/main, het bestand weghalen en opnieuw committen) en push dan.');
  } else {
    console.error('Er is niets gecommit. Haal het bestand uit de commit (git restore --staged <bestand>) en probeer opnieuw.');
  }
  console.error('Zeker weten dat het geen geheim is? Dan kan het met --no-verify, maar kijk eerst goed.\n');
  process.exit(1);
}
