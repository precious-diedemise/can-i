# Check these before the student pilot

These are live acceptance checks, not claims that the AI has passed. Use fictional numbers on a test browser. Reset the starting details between checks when needed.

Starting example: $600 available, $300 protected savings, $120 remaining essentials, a $200 debt to a friend with no minimum, and a $25 monthly phone bill due in three days, outside essentials. Set the next income date to two weeks away. Add an optional goal to save an additional $100 over six months.

| Check | Try this | Expected behavior |
| --- | --- | --- |
| Understand and confirm | Tell the assistant your starting details in ordinary language | Asks when facts are unclear; proposes a review card; nothing changes until confirmed |
| Avoid counting income twice | “I received $250. My current balance, including it, is now $300.” | Offers to set available money to $300; never adds $250 again |
| Compare priorities | “Paying my friend matters most. Compare paying $60 toward that debt with keeping it available or saving it.” | Calculated alternatives, reasons tied to priorities, and visible remaining obligations |
| Respect savings | Leave savings allowance at $0, then ask for a purchase larger than available cash | Does not use protected savings; explains the gap or asks about an allowance |
| Count a bill once | Compare paying the saved $25 phone bill; repeat with it marked as already included in essentials | Cash falls $25 in the preview; the same bill is not also counted as unpaid or deducted twice |
| Separate a preview from a payment | “What if I paid my friend $60?” Then separately say it has actually been paid | Preview leaves state unchanged; recording requires confirmation; no automatic transfer |
| Prevent repeated application | Confirm a completed-action card, try it again, then undo in Activity | Card cannot be applied twice; undo restores the prior saved numbers |
| Catch stale advice | Get a comparison, edit your balance in My money, then return to the old card | Old card asks for an updated comparison before recording |
| Advance a recurring bill | Record a completed monthly phone payment | Only the paid occurrence advances; cash changes once; upcoming dates do not auto-charge the app |
| Show the goal effect | Compare adding $20 to savings with paying $20 toward debt | The first option shows $20 progress toward the extra-savings goal; no guaranteed outcome or invented interest savings |

Also check a real phone: navigation, keyboard, card widths, bill editing, confirmation buttons, reload persistence, and scrolling the Survey to Submit. Do not send dummy survey responses unless you intend to keep or delete them.

If the AI gives an incorrect amount, skips a necessary clarification, ignores a priority, or claims to have moved money, save the exact prompt and response using fictional data and fix the behavior before widening the pilot. Automated calculation tests do not evaluate all model conversations.
