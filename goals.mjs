// Amounts are integer cents. A goal measures net change from its starting balance.
export function createGoal(state, {type, target, deadline, debtId = ''}, asof) {
  if (!['savings', 'debt'].includes(type)) throw new Error('Choose a savings or debt goal.');
  if (!Number.isSafeInteger(target) || target <= 0) throw new Error('Enter a goal amount greater than zero.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || !Number.isFinite(Date.parse(deadline)) || new Date(deadline).toISOString().slice(0,10) !== deadline || deadline <= asof) throw new Error('Choose a future target date.');
  const debt = state.debts.find(d => d.id === debtId);
  if (type === 'debt' && (!debt || target > debt.balance)) throw new Error('Choose a debt and an amount no larger than its current balance.');
  return {type, target, deadline, debtId: type === 'debt' ? debtId : '', baseline: type === 'savings' ? state.savings : debt.balance};
}

export function goalProgress(state, result = null, asof = state.asof) {
  const g = state.goal;
  if (!g) return null;
  const debt = (result?.balances || state.debts).find(d => d.id === g.debtId);
  if (g.type === 'debt' && !debt) return {unavailable: true};
  const balance = g.type === 'savings' ? (result?.savings ?? state.savings) : debt.balance;
  const net = g.type === 'savings' ? balance - g.baseline : g.baseline - balance;
  const remaining = Math.max(0, g.target - net);
  const days = Math.ceil((Date.parse(g.deadline + 'T00:00:00Z') - Date.parse(asof + 'T00:00:00Z')) / 86400000);
  return {net, remaining, percent: Math.max(0, Math.min(100, net / g.target * 100)), days, weekly: days > 0 ? Math.ceil(remaining * 7 / days) : null};
}
