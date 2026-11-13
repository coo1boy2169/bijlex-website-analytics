# bijlex-website-analytics

Checks that the cookie banner of the Bijlex website controls Google Analytics
and Microsoft Clarity correctly. The website itself lives in
`CEOBijlex/bijlex-website-v2`; this repository only holds the pipeline and the
prompts.

The rule being checked: without the visitor's consent, nothing from Google or
Microsoft loads and no cookie is set.

## The pipeline

`.github/workflows/test-analyse.yml` fetches the website, builds it and runs
`npm run test:analyse`. It runs by hand from the Actions tab ("Test cookies
and analytics", "Run workflow"). The daily run at 06:00 UTC is switched off in
the workflow file until the secret below exists.

- Green check: every check printed GOED (passed).
- Red cross: at least one check printed FOUT (failed). Open the run to see
  which one, then paste prompt 2 from `PROMPTS.md` into Claude Code.

Setup, once: the website repository is private, so add a secret named
`WEBSITE_REPO_TOKEN` (Settings, Secrets and variables, Actions) holding a
fine-grained personal access token with read access to "Contents" of
`CEOBijlex/bijlex-website-v2`.

## The visitor numbers

`node cijfers.mjs` prints the visitor numbers of the last 7 days from Google
Analytics (`node cijfers.mjs 28` for 28 days): visitors now, totals, per day,
most viewed pages and where visits come from. It only reads.

It logs in as the service account
`bijlex-609@bijlex-514612.iam.gserviceaccount.com`, which has the Viewer role
on the property "Bijlex Website v2" (ID `564211126`, measurement ID
`G-5Y85D7X7GF`). The key comes from the environment variable
`BIJLEX_GA_KEY_JSON` (see "Secrets" below).

If the output ends with NIET COMPLEET, Google did not answer in time; run it
again a few minutes later. Only visitors who accepted statistics are counted,
and Google processes visits with a delay of one to two days.

## The Clarity numbers

`node clarity.mjs` prints the Microsoft Clarity numbers of the last day
(`node clarity.mjs 3` for the last 3 days; Clarity allows no more): visits,
time on the site, scroll depth and signs of frustration such as rage clicks
and dead clicks. It only reads, through Clarity's Data Export API.

Clarity allows 10 calls per project per day; each run is one call. The token
comes from the environment variable `BIJLEX_CLARITY_TOKEN` (see "Secrets"
below).

## Secrets

Both scripts read their secrets from environment variables:

| Variable | What |
|---|---|
| `BIJLEX_GA_KEY_JSON` | The whole JSON key file of the Google service account, on one line |
| `BIJLEX_CLARITY_TOKEN` | The Clarity Data Export API token |

Locally they are in `.env` in this folder, which the scripts load
themselves. Copy `.env.example` to `.env` and fill in the values between the
single quotes. On GitHub Actions, add the same names as repository secrets
(Settings, Secrets and variables, Actions) and pass them as `env:` to the step.

## Keeping keys out of GitHub

This repository is public. `.env` must never be committed. Three layers keep
it and any other key out:

1. `.gitignore` skips `.env` and other key-like files (`*.json`, `*.txt`,
   `*token*`, ...). Only `.env.example`, which holds no secrets, is tracked.
2. Git hooks in `.githooks/` run `tools/controleer-geheimen.mjs` before every
   commit and every push. They block key-like file names (also when added
   with `git add -f`) and content that looks like a private key, a Google
   service account file, a Google API key, a GitHub token or a JWT such as
   the Clarity token.
3. GitHub's own secret scanning and push protection (Settings, Advanced
   Security), which catches Google service account keys on GitHub's side.

The hooks are not on automatically after a fresh clone. Switch them on once:

```
git config core.hooksPath .githooks
```

## The prompts

`PROMPTS.md` has six prompts to paste into a new Claude Code chat: check the
status, fix what fails, fill in the IDs, walk through the manual check once
the site is live, read the visitor numbers, and read the Clarity numbers.
