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
`G-5Y85D7X7GF`). The key file is not in this repository and must never be: it
is read from `<home>/.bijlex/analytics-sleutel.json`, or from the path in
`BIJLEX_GA_KEY`.

If the output ends with NIET COMPLEET, Google did not answer in time; run it
again a few minutes later. Only visitors who accepted statistics are counted,
and Google processes visits with a delay of one to two days.

## The prompts

`PROMPTS.md` has five prompts to paste into a new Claude Code chat: check the
status, fix what fails, fill in the IDs, walk through the manual check once
the site is live, and read the visitor numbers.
