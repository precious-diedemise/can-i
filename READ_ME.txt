CAN I? — FEEDBACK UPDATE V4

This update is based on the current precious-diedemise/can-i GitHub files.
It includes the earlier compact comparison cards. Install V4 directly; you do
not need to install V2 or V3 first.

UPLOAD TO YOUR EXISTING GITHUB REPOSITORY
1. Download can-i-feedback-update-V4.zip and choose Extract All on your PC.
2. Open precious-diedemise/can-i on GitHub, on the main branch.
3. Choose Add file > Upload files.
4. Upload these NINE extracted files together, into the main folder where
   index.html already lives. Replace the existing versions:
   - app.mjs
   - index.html
   - styles.css
   - engine.mjs
   - planner.mjs
   - goals.mjs
   - guided.test.mjs
   - planner.test.mjs
   - goals.test.mjs
5. Commit all nine files together. Suggested message: Apply tester feedback V4.
6. Wait for the connected Vercel deployment to show Ready, then refresh the app.

Upload the extracted files, not the ZIP or its enclosing folder. Other files
and folders already in your repository stay in place. No new folders, API keys,
paid services, package installations, or Vercel settings are needed for this update.

WHAT CHANGED
- Clearer labels: money you have now, savings, and everyday needs.
- After everyday needs shows the actual signed amount, red when negative.
  Current money remains a separate figure.
- Optional expected-income amount and date; comparisons can use current money
  or a preview after the expected income arrives. Upcoming payment dates remain
  visible. Expected income does not automatically change current money.
- Suggestions use saved payments, everyday needs, goals, debt rates where known,
  and a cash cushion. Up to three distinct options can contain several uses of
  the amount. Tiny amounts or limited information may yield fewer options.
- Bills versus purchases are explained. Bank / personal loan is a debt type.
- Provider automatic-payment labels do not create automatic deductions.
- Save for later persists a plan in Activity. Review, edit, delete, or complete
  it from Saved plans. Completion records the date and updates money once.
- Editing a goal preserves progress. Start a new goal deliberately resets it.
- Money out is red, money in green, and savings transfers use neutral styling.

EXPECTED-INCOME PLANS
When the income arrives, record it once. If it was already included in the
balance you entered, use It is already in my balance instead of adding it again.
Then review the saved plan against your latest numbers before marking it complete.

EXISTING DATA
The app keeps the same can-i-v2 browser-storage key. Your saved numbers and
Activity are retained on the same browser and domain. New users start blank;
Try sample numbers is still available. The private preview uses a separate key
and fictional data. Browser storage does not sync across devices or browsers.

CHECKS COMPLETED
77 automated tests passed; production build passed. Desktop and phone-width
browser checks covered comparison cards, expected income, signed shortfalls,
and saved plans surviving reload. Phone-width checks are not physical-device tests.

SCOPE
The app uses transparent calculation rules. Interest accrual and lender fees
are not automatically added to debt balances; keep those balances up to date.
No bank connection or money transfers are added by this update.

The ZIP is ready to upload. Creating it does not change your GitHub repository
or your live Vercel app; the commit above triggers that deployment.
