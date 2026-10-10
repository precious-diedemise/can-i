import {simulate,dueBeforeIncome} from './engine.mjs';
export function simulateItems(s,items,release=0){
  const alloc={};let spending=0,protectedAdded=0,received=0,covered=0;
  for(const item of items){
    if(!Number.isSafeInteger(item.amount)||item.amount<0)throw new Error('Every item needs a nonnegative amount.');
    if(item.type==='debt'){if(!s.debts.some(d=>d.id===item.debtId))throw new Error('Choose a debt for each debt payment.');alloc[item.debtId]=(alloc[item.debtId]||0)+item.amount;}
    else if(item.type==='purchase'||item.type==='bill'){spending+=item.amount;if(item.inEssentials)covered+=item.amount;}
    else if(item.type==='protect')protectedAdded+=item.amount;
    else if(item.type==='income')received+=item.amount;
    else throw new Error('Choose a supported item type.');
  }
  if(covered>s.essentials)throw new Error('Expenses marked as already included exceed your remaining essentials. Update essentials or uncheck those items.');
  const r=simulate(s,alloc,release);
  r.cash+=received-spending-protectedAdded;r.savings+=protectedAdded;r.essentials-=covered;
  r.total+=spending+protectedAdded;r.received=received;r.covered=covered;r.spending=spending;r.protectedAdded=protectedAdded;r.allocations=alloc;
  r.room=r.cash-r.essentials-r.due;
  r.warnings=r.warnings.filter(w=>!w.startsWith('cash:')&&!w.startsWith('shortfall:'));
  if(r.cash<0)r.warnings.push('cash:'+(-r.cash));if(r.room<0)r.warnings.push('shortfall:'+(-r.room));
  return r;
}
export function recordItems(s,items,release=0){const r=simulateItems(s,items,release);if(r.cash<0)throw new Error('This plan exceeds available funds.');return {...s,cash:r.cash,savings:r.savings,essentials:r.essentials,debts:s.debts.map(d=>({...d,balance:d.balance-(r.allocations[d.id]||0),minimum:Math.max(0,d.minimum-(r.allocations[d.id]||0))}))};}
export function itemOptions(s,items,budget,release=0,priority=''){
  if(!Number.isSafeInteger(budget)||budget<=0)throw new Error('Enter an amount to compare.');
  simulate(s,{},release);
  const active=items.filter(x=>x.amount>0);if(active.some(x=>x.type==='income'))throw new Error('Income is available in What if, not payment allocation.');
  const ids=new Set(),debtIds=new Set();
  for(const x of active){if(ids.has(x.id))throw new Error('Each item needs a unique identifier.');ids.add(x.id);if(!Number.isSafeInteger(x.amount))throw new Error('Enter valid item amounts.');if(x.type==='debt'){const d=s.debts.find(d=>d.id===x.debtId);if(!d)throw new Error('Choose a debt.');if(debtIds.has(x.debtId))throw new Error('Include each debt once in What should I pay. You can combine duplicate payments in What if.');debtIds.add(x.debtId);if(x.amount>d.balance)throw new Error('A debt payment limit exceeds its balance.');}}
  if(active.filter(x=>x.inEssentials&&(x.type==='purchase'||x.type==='bill')).reduce((t,x)=>t+x.amount,0)>s.essentials)throw new Error('Items marked as included in essentials exceed the entered essentials amount.');
  const limit=Math.min(budget,s.cash+release,active.reduce((t,x)=>t+x.amount,0));if(!limit)return [];
  const debt=x=>s.debts.find(d=>d.id===x.debtId),apr=x=>x.type==='debt'?(debt(x)?.apr??-1):-1;
  const urgent=active.filter(x=>x.type==='debt'&&dueBeforeIncome(s,debt(x))).sort((a,b)=>debt(a).due.localeCompare(debt(b).due));
  const interest=active.slice().sort((a,b)=>apr(b)-apr(a));
  const result=[],seen=new Set();
  const add=(title,description,order,seed={})=>{const amounts={...seed};let left=limit-Object.values(amounts).reduce((t,a)=>t+a,0);for(const x of order){const a=Math.min(left,x.amount-(amounts[x.id]||0));if(a>0)amounts[x.id]=(amounts[x.id]||0)+a;left-=a;}const key=JSON.stringify(active.map(x=>amounts[x.id]||0));if(seen.has(key))return;seen.add(key);const plan=active.map(x=>({...x,amount:amounts[x.id]||0})).filter(x=>x.amount>0);result.push({title,description,items:plan,result:simulateItems(s,plan,release)});};
  if(urgent.length){let left=limit,seed={};for(const x of urgent){const a=Math.min(left,x.amount,debt(x).minimum);if(a)seed[x.id]=a;left-=a;}add('Start with upcoming payments','Put money toward entered payments due before income, then allocate the remainder to other included items.',interest,seed);}
  // Ensure added bills, purchases, and savings participate in the comparison.
  const extras=active.filter(x=>x.type!=='debt');
  if(extras.length){const order=[...extras,...interest.filter(x=>x.type==='debt')];const base=Math.floor(limit/active.length),seed={};let left=limit;for(const x of active){const a=Math.min(x.amount,base,left);if(a)seed[x.id]=a;left-=a;}add('Spread it across your items','Share the amount across the included items, respecting each item’s limit.',order,seed);}
  const preferred=active.find(x=>x.id===priority);
  if(preferred)add(`Prioritize ${preferred.name}`,'Put money toward your selected priority first, then use any remainder for other included items.',[preferred,...interest.filter(x=>x.id!==preferred.id)]);
  if(interest.length)add(`Focus on ${interest[0].name}`,'Put money here first, then allocate any remainder to other included items.',interest);
  for(const x of [...extras,...active]){if(result.length>=3)break;add(`Focus on ${x.name}`,'Put money toward this item first. Other commitments remain listed separately.',[x,...interest.filter(y=>y.id!==x.id)]);}
  if(result.length<3&&active.length>1){for(let i=0;i<active.length&&result.length<3;i++)for(let j=i+1;j<active.length&&result.length<3;j++){const a=active[i],b=active[j];add(`Split between ${a.name} and ${b.name}`,'Split the amount between these two items, with any remainder allocated to other items.',interest,{[a.id]:Math.min(a.amount,Math.floor(limit/2)),[b.id]:Math.min(b.amount,Math.ceil(limit/2))});}}
  return result.slice(0,3);
}
