# Can I? — prototype v1.0

## What this version does

Enter cash, essentials, protected savings, income and debts. Compare up to three distinct ways to allocate the same budget across multiple items. Simulate multiple What if actions together. Savings use requires an explicit choice. Upcoming debt payments are shown separately; primary scenario balances reflect selected actions and essentials. The optional full commitment forecast shows what happens if all outstanding payments are also made.

Previews do not change balances. Recording actions is explicit and supports undo. An expense marked as already included in essentials reduces the remaining essentials amount so it is not counted twice.

## Prototype scope

This app runs in the browser, with deterministic calculations and explanations. It does not yet call an AI model, connect banks, execute payments or provide user accounts. Starting values are fictional demo data. Currency is USD.

Data and activity are saved in that browser's localStorage, not a shared database. A new device, browser or hosting domain starts with its own data. Browser storage is not encrypted. The “Private prototype” text in the UI is a label, not an access control; visitor access is configured with your host.

Google Fonts supplies DM Sans and Manrope; system fonts are used if unavailable.

## Export verification

App source and tests were copied from commit `e64a0f2a51bbbf4646a99723284b36ccd9b6d834` without modifying their contents. Hosting configurations and this guide were added for the export. Calculation tests pass; an external deployment and browser acceptance check remain to be performed on your hosting account.

