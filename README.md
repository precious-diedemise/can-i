# Can I? — Your next move, made clearer.

A conversational financial planning prototype for college students. It helps people compare decisions using their confirmed money, protected savings, debts, recurring bills, priorities, and one goal.

This update extends the existing `precious-diedemise/can-i` prototype, based on main commit `c2a16f9f0a063b59fb83847a4d76ea2ee959a5f4`. It does not create a separate product or require a new Vercel project. Start with **START_HERE.md** to update the existing deployment.

## What is included

- **Talk it through:** explain a situation, ask for suggestions, challenge a suggestion, and compare alternatives. The AI can call calculation tools, propose profile updates, and prepare completed actions for review.
- **Bills & subscriptions:** store amounts, next unpaid dates, repeat schedules, and automatic-renewal labels. A confirmed payment advances the paid occurrence; a due date alone never subtracts money.
- **Priorities and goals:** store personal priorities and one additional-savings or debt-reduction goal. Comparisons show the goal impact.
- **Review before saving:** factual changes and completed actions require a visible confirmation. Activity can undo the last confirmed update. Old suggestion cards are blocked after the financial picture changes.
- **Compare choices:** the existing Help me decide and Test my plan tools remain available without AI, including multiple actions per plan.
- **Existing content:** the accepted tagline, Overview introduction, blank initial money fields, optional sample numbers, and embedded feedback form remain.

The unused expected-income amount has been removed from the form. The optional next-income date still defines the comparison window. When that date is unknown or past, the forecast explicitly uses the next 30 days. No future income is added automatically.

## How the AI works

The browser sends its confirmed profile and recent chat to `/api/chat`. The Node function calls OpenAI's Responses API. The model can use three tools:

| Tool | Purpose | Can change saved balances? |
| --- | --- | --- |
| `compare_plans` | Calculate alternatives using the shared money engine | No |
| `propose_facts` | Prepare corrections or new facts for review | No |
| `prepare_record` | Prepare already-completed actions for confirmation | No |

The calculation engine uses integer cents. It checks valid amounts, known debt/bill IDs, payment limits, and the explicit protected-savings allowance. The model explains the results. Only the browser's confirmation flow writes the user's saved state. This is a bounded tool-using assistant, with no background execution or authority to move money.

The model is instructed to use calculated results for numerical recommendations, but natural-language interpretation and explanations still require live evaluation. A passing mocked test is not evidence that the model will always follow its instructions.

## Run locally

Use a current Node.js 22 release (22.22.2 or later for the test dependency), or Node 24.15 or later. Vercel is configured for Node 22.x.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. The manual tools work without API credentials. For local AI testing, copy `.env.example` to `.env.local` and fill it on your own device. Never commit `.env.local` or an API key. Restart the server after editing it.

```sh
npm test
npm run build
```

The build copies only browser assets into `dist/`. The server entry remains `api/chat.mjs`; it is deployed as a Vercel function. A static file server, GitHub Pages, or the old Netlify configuration cannot run the AI endpoint. The legacy Netlify/Pages files are retained only for continuity; this package targets Vercel.

## Files to know

| File | Responsibility |
| --- | --- |
| `index.html`, `styles.css`, `app.mjs` | Existing app shell, forms, bills, navigation, manual comparisons |
| `conversation.mjs` | Chat UI, review cards, consent, local history |
| `planner.mjs` | Validation, recurring schedules, forecasts, fact changes |
| `engine.mjs`, `multi.mjs`, `goals.mjs` | Existing arithmetic and goal logic |
| `server/assistant.mjs` | AI instructions, tool definitions, bounded tool loop |
| `api/chat.mjs` | Server-only API key, access code, request limits, OpenAI request |
| `scripts/build.mjs`, `scripts/dev.mjs` | Deployment build and local server |
| `vercel.json` | Build command, public output directory, function settings |

## Data and limits

- Confirmed financial details, recent activity, and the last 40 chat entries live in this browser's localStorage. There is no account, database, encrypted storage feature, or cross-device sync. Clear data on shared devices.
- Each AI request sends the current profile and up to 16 recent conversation entries, including historical card summaries. Older chat may fall outside the model's context. Avoid account numbers and identifying information.
- AI use requires the in-app consent checkbox. Requests travel through the Vercel function to OpenAI. `store:false` disables Responses API response storage; it is not a promise of zero provider retention. Provider policies and account settings also apply.
- The app does not log financial request bodies. Do not enable payload logging when adding monitoring. Feedback is submitted separately to Google Forms; financial state is not attached by the app.
- The pilot access code is a shared gate, not a user account system. It is held only in browser memory. Use a long, random code and share it only with invited testers. Rotate it if exposed.
- The eight-requests-per-minute limit is held in one server process and can reset or be bypassed across instances. It is not a distributed quota or spending cap. Monitor API usage and configure provider spending controls before inviting testers; broader public access needs proper user authentication and shared rate limiting.
- Each request is capped at 100 KB, four model rounds, eight tool calls, and a 50-second deadline. Long conversations may need clearing. A new turn can involve several billable model calls.
- Bills repeat by calendar schedule, with month-end/leap-day anchors preserved. Old unpaid dates can produce a backlog; update the next unpaid date when earlier cycles were already paid. Mark a bill already in essentials only if its cost is already covered by that total.
- Goal progress is balance arithmetic. Interest, new charges, fees, and future earnings are not projected. Goal pace is not an affordability prediction.
- There are no bank connections, transfers, subscription cancellations, notifications, or scheduled reminders. The app does not independently detect payments or renewals.

## Validation status

60 automated tests pass, covering existing calculations, bill recurrence, double-count prevention, savings permissions, confirmation/undo, stale cards, DOM flows, and mocked AI/API interactions. The build and local HTTP routing also pass, including denial of access to server source and environment files.

Tests ran under Node 24.19 in the development environment. The live model, Vercel deployment, and real mobile layout have not been tested. Complete **LIVE_CHECKS.md** after deployment before inviting students.

## Official implementation references

- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [GPT-5.6 Terra model](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
- [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)
- [Vercel Node.js functions](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
