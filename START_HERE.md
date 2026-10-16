# Put the conversation version into your existing Can I? app

Your live site has not been changed. This ZIP contains the updated source code for your existing GitHub repository and Vercel project.

## 1. Update GitHub

1. Extract the ZIP on your computer.
2. Open your existing `precious-diedemise/can-i` repository. Keep a copy of the current version if you want an easy reference.
3. Use **Add file → Upload files**. Drag the extracted contents of the `can-i-conversation` folder into the repository root. Replace files with matching names. Do not upload the ZIP itself or place everything inside another folder.
4. Preserve the folders named **api**, **server**, and **scripts**. For example, the endpoint must be `api/chat.mjs`, not a root-level `chat.mjs`.
5. Commit the update to the branch connected to Vercel, normally `main`.

Include `package.json`, `package-lock.json`, `vercel.json`, all browser files, and the three folders above. Tests and these guides can be uploaded too. `.env.example` contains placeholders only. Never upload `.env.local` or a real API key.

## 2. Connect AI in Vercel

Open your existing Vercel project → **Settings → Environment Variables**. Add:

| Name | Value |
| --- | --- |
| `OPENAI_API_KEY` | Your private OpenAI API key |
| `OPENAI_MODEL` | `gpt-5.6-terra` |
| `CAN_I_ACCESS_CODE` | A long, random pilot code you choose |

Use Production, and Preview too if you will test preview deployments. The API model must be available to your OpenAI account. API use is billed; check the account's billing and usage controls before testing.

The API key belongs only in Vercel's server environment or your private local `.env.local`. Do not put it in `app.mjs`, GitHub, the app's access-code field, or this chat. Testers receive your pilot code, never the API key.

## 3. Deploy

The new `vercel.json` sets:

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Build command | `npm run build` |
| Output directory | `dist` |
| Root directory | Repository root |
| Node.js | 22.x |

If the Vercel dashboard still overrides the old output directory `.` or an empty build command, update those overrides to match. Do not upload `dist` manually; Vercel creates it during the build.

After saving the environment variables, redeploy the latest commit. Wait for **Ready**, then open the production link. Environment changes require a new deployment.

## 4. Test one conversation

Open **Talk it through**, enter your pilot code, and review the AI privacy checkbox. Start with fictional details:

> I have $600 available, $300 in protected savings, and $120 of essentials still to cover. Help me plan.

Review and confirm any proposed changes. Then add a bill and a goal, and ask for a comparison. Verify that suggestions do not change balances until you explicitly record completed actions.

Finish the short checks in **LIVE_CHECKS.md** on your phone before sharing with the first testers.

## If something fails

- **AI setup is not complete:** verify all three variable names and values, their environment selection, and redeploy.
- **Wrong pilot code:** enter the value of `CAN_I_ACCESS_CODE`, not the API key.
- **AI connection failed:** check that the API key is valid and the account can access the chosen model.
- **Usage limit:** check OpenAI API billing and usage. A brief burst limit may also ask you to wait a minute.
- **Old design still appears:** check that Vercel's Ready deployment is for the new commit and that you opened its current production link.
- **Build fails:** check `package.json`, the lockfile, the three folders, and the build/output settings above.

Do not add secrets to screenshots when asking for help. The manual comparison tools still work if AI is unavailable.
