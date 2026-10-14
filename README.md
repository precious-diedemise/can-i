# Can I?

A browser-only financial decision prototype. Compare ways to use money, test a combined plan, and see its effect on one optional savings or debt goal. Uses rules and arithmetic; no live AI, bank connection, or payment execution.

## Run locally

Serve this directory with a static server, for example:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Do not open index.html directly as a file, because ES modules require a web server.

## Tests

With Node.js 20 or newer:

```sh
node --test *.test.mjs
```

The application-flow tests use a minimal DOM adapter. They do not replace mobile browser checks.

## Deploy with Vercel

All application files are at the repository root. Use Framework Preset Other, no build command, and output directory `.`. The included vercel.json sets this. Merge the reviewed branch into the branch connected to Vercel (normally main) to trigger deployment. Check the deployment status before sharing the production link.

## Features

- New users start with blank financial fields; sample numbers remain optional.
- Compare choices contains Help me decide (What should I pay?) and Test my plan (What if?). Both support multiple items.
- Review an allocation and choose Edit in Test my plan to carry its amounts and explicitly selected savings release across.
- Set one optional goal from Overview or My money. A savings goal measures additional net protected savings since setup. A debt goal measures reduction in one selected debt balance.
- Goal progress appears in comparisons. Matching debt/savings items are the default priority when included; users can change the priority. Cash gaps and unpaid commitments remain visible.
- Replacing a goal restarts its baseline. Editing balances changes goal progress. Removing a debt requires updating a goal that references it. Goal edits clear the last-action undo so an old snapshot cannot overwrite the new goal.
- Weekly goal pace is arithmetic based on the target date, not an affordability prediction or a forecast of future interest.
- Previewing or saving plans does not change balances. Only explicitly recording completed actions updates balances; Activity supports undo.
- Survey tab embeds the owner's Google Form and provides a new-tab fallback. It is available before entering financial data. The app does not attach balances or goal data to the form.

## Data

Financial entries, goals, and activity are saved in this browser's localStorage under can-i-v2. There is no account sync. Feedback is submitted to Google Forms separately. Clear local data on shared devices.

## Before the pilot

Use Vercel's preview to check:

1. Fresh browser: blank startup and Survey accessible before setup.
2. Survey on iPhone/Android: scroll to Submit; check the fallback link. Do not submit dummy feedback unless you intend to keep/delete it in Google Forms.
3. Sample data: set a savings goal, include an Add to savings item, compare, and review goal impact.
4. Edit a suggested plan in Test my plan. Confirm money stays unchanged until actions are recorded, then test Activity undo.
5. Reload and verify saved numbers and goal remain.

The survey currently uses the original feature names. They remain as subtitles in the app. Optional form edits: use “Help me decide (What should I pay?)” and “Test my plan (What if?)”, and add “I have not tried enough yet” to the most-useful-feature question.
