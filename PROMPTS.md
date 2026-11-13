# Prompts to paste

Copy one of the blocks below into a new chat with Claude Code.
The paths are written out in full, so they work from any folder in `C:\Bijlex`.

The test prints its results in Dutch: GOED means passed, FOUT means failed.

## 1. What works and what fails?

```
Read C:\Bijlex\bijlex-website-v2\docs\analyse-en-cookies.md. Then run
npm run test:analyse in C:\Bijlex\bijlex-website-v2 and tell me in plain
Dutch what works and what fails. The test prints GOED (passed) or FOUT
(failed) for each check. If anything says FOUT, find the cause and explain
what is going on. Do not change anything without asking me first.
```

## 2. Fix what fails

```
Read C:\Bijlex\bijlex-website-v2\docs\analyse-en-cookies.md and run
npm run test:analyse in C:\Bijlex\bijlex-website-v2. Fix everything that
reports FOUT (failed), run the test again until everything is GOED (passed),
and tell me in Dutch what you changed. The rule is: without the visitor's
consent, nothing from Google or Microsoft may load and no cookie may be set.
```

## 3. Fill in the IDs

Fill in the two placeholders first.

```
Read C:\Bijlex\bijlex-website-v2\docs\analyse-en-cookies.md. My Clarity
project ID is [PASTE HERE] and my Google Analytics ID is
[PASTE HERE, or write "keep the current one"]. Put them in
C:\Bijlex\bijlex-website-v2\.env.production, run npm run test:analyse in
that folder, and update the "Nog te doen" list in the document. Reply in
Dutch.
```

## 4. The site is live

Fill in the address first.

```
Read C:\Bijlex\bijlex-website-v2\docs\analyse-en-cookies.md. The site is now
live at [ADDRESS]. Walk me through the section "Na de livegang met de hand
controleren" step by step, and tell me at each step what I should see. Reply
in Dutch.
```

## 5. How many visitors?

Change 7 to another number of days if you want a longer period.

```
Run node cijfers.mjs 7 in C:\Bijlex\bijlex-website-analytics. It fetches the
visitor numbers of the Bijlex website from Google Analytics, read-only. Tell
me in plain Dutch what the numbers say: how many visitors, which pages are
viewed most, and where visitors come from. If the output says NIET COMPLEET,
Google did not answer in time: tell me which part is missing and try once
more after a minute. Do not open, print, copy or commit the .env file in
that folder; it holds the keys. Reply in Dutch.
```

## 6. What does Clarity see?

Change 3 to 1 or 2 for a shorter period; Clarity allows at most 3 days.

```
Run node clarity.mjs 3 in C:\Bijlex\bijlex-website-analytics. It fetches the
Microsoft Clarity numbers of the Bijlex website, read-only. Tell me in plain
Dutch what they say: how many visits, how long people stay, how far they
scroll, and whether there are signs of frustration such as rage clicks or
dead clicks. Run it only once: Clarity allows 10 calls per day. Do not open,
print, copy or commit the .env file in that folder; it holds the token.
Reply in Dutch.
```
