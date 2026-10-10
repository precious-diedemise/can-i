// All financial arithmetic uses integer cents. No model-generated amounts.
export const cents = value => Math.round(Number(value) * 100);
export const dollars = value => value / 100;
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export function dateAfter(days) { const d = new Date(); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function demo() { return { version:2, demo:true, cash:32000, savings:40000, essentials:11000, income:52000, payday:dateAfter(7), asof:today(), priority:'friend', debts:[{id:'card',name:'Credit card',type:'Credit card',balance:90000,apr:24,minimum:3500,due:dateAfter(3)},{id:'tuition',name:'Tuition installment',type:'School / tuition',balance:25000,apr:0,minimum:10000,due:dateAfter(5)},{id:'friend',name:'Friend',type:'Someone I know',balance:20000,apr:0,minimum:0,due:''}] }; }
export function validate(s) {
  for(const key of ['cash','savings','essentials','income']) if(!Number.isSafeInteger(s[key]) || s[key]<0) throw new Error('Enter nonnegative money amounts with at most two decimal places.');
  if(!Array.isArray(s.debts) || s.debts.length>30) throw new Error('Add no more than 30 debts.');
  const ids=new Set();
  for(const d of s.debts){ if(!d.id || ids.has(d.id)) throw new Error('Each debt needs a unique identifier.'); ids.add(d.id); if(!d.name.trim()) throw new Error('Give each debt a name.'); for(const k of ['balance','minimum']) if(!Number.isSafeInteger(d[k]) || d[k]<0) throw new Error('Debt amounts must be nonnegative.'); if(d.minimum>d.balance) throw new Error(`${d.name}: payment due cannot exceed the remaining balance.`); if(d.apr!==null && (!Number.isFinite(d.apr)||d.apr<0||d.apr>1000)) throw new Error('Enter a valid APR, or leave it blank if unknown.'); }
  return s;
}
export function dueBeforeIncome(s,d) { return d.minimum>0 && !!d.due && (!s.payday || d.due<s.payday); }
export function dueReserve(s,allocations={}) { return s.debts.reduce((t,d)=>t+(dueBeforeIncome(s,d)?Math.max(0,d.minimum-(allocations[d.id]||0)):0),0); }
export function snapshot(s) { const due=dueReserve(s); return {cash:s.cash,savings:s.savings,essentials:s.essentials,due,afterEssentials:s.cash-s.essentials,room:s.cash-s.essentials-due}; }
export function simulate(s,allocations={},release=0) {
  if(!Number.isSafeInteger(release)||release<0||release>s.savings) throw new Error('The protected amount must be between zero and your savings balance.');
  let total=0;
  for(const [id,amount] of Object.entries(allocations)){const d=s.debts.find(x=>x.id===id);if(!d||!Number.isSafeInteger(amount)||amount<0||amount>d.balance) throw new Error('Payment must be within the selected debt balance.');total+=amount;}
  const cash=s.cash+release-total;
  const due=dueReserve(s,allocations);
  const room=cash-s.essentials-due;
  const warnings=[];
  if(cash<0) warnings.push(`cash:${-cash}`);
  if(room<0) warnings.push(`shortfall:${-room}`);
  if(!s.payday) warnings.push('income-date-unknown');
  if(s.debts.some(d=>d.balance>0&&!d.due)) warnings.push('dates-missing');
  if(s.debts.some(d=>d.balance>0&&d.apr===null)) warnings.push('apr-missing');
  if(s.debts.some(d=>d.minimum>0&&d.due===s.payday)) warnings.push('same-day');
  if(s.payday&&s.payday<s.asof) warnings.push('income-overdue');
  const interestProxy=s.debts.reduce((t,d)=>t+(d.apr===null?0:(allocations[d.id]||0)*d.apr/100/12),0);
  return {total,cash,savings:s.savings-release,release,essentials:s.essentials,due,room,interestProxy,warnings,balances:s.debts.map(d=>({...d,balance:d.balance-(allocations[d.id]||0)}))};
}
export function paymentOptions(s,budget,release=0) {
  if(!Number.isSafeInteger(budget)||budget<=0) throw new Error('Enter a payment budget greater than zero.');
  simulate(s,{},release);
  const active=s.debts.filter(d=>d.balance>0);
  const limit=Math.min(budget,Math.max(0,s.cash+release-s.essentials),active.reduce((t,d)=>t+d.balance,0));
  if(!limit)return [];
  const urgent=active.filter(d=>dueBeforeIncome(s,d)).sort((a,b)=>a.due.localeCompare(b.due));
  const interest=active.slice().sort((a,b)=>(b.apr??-1)-(a.apr??-1));
  const preferred=active.find(d=>d.id===s.priority);
  const options=[],seen=new Set();
  const add=(kind,title,description,order,seed={})=>{
    const alloc={...seed};let left=limit-Object.values(alloc).reduce((t,a)=>t+a,0);
    for(const d of order){const a=Math.min(left,d.balance-(alloc[d.id]||0));if(a>0)alloc[d.id]=(alloc[d.id]||0)+a;left-=a;}
    const key=JSON.stringify(active.map(d=>alloc[d.id]||0));
    if(seen.has(key))return;seen.add(key);
    options.push({kind,title,description,allocations:alloc,result:simulate(s,alloc,release)});
  };
  if(urgent.length){let left=limit,seed={};for(const d of urgent){const a=Math.min(left,d.minimum);if(a)seed[d.id]=a;left-=a;}
    add('deadlines','Start with upcoming payments','Allocate to known payments due before income, in due-date order; put any remainder toward the highest known APR.',interest,seed);}
  if(interest.length&&interest[0].apr>0)add('interest',`Focus on ${interest[0].name}`,`Direct the amount to the highest known APR first. Other payments stay visible even when they are due sooner.`,interest);
  if(preferred)add('priority',`Prioritize ${preferred.name}`,`Direct the amount to your chosen priority first, then use any remainder toward other debt.`,[preferred,...interest.filter(d=>d.id!==preferred.id)]);
  for(const d of active){if(options.length>=3)break;add('single',`Focus on ${d.name}`,`Direct the amount here first. If the balance is smaller, allocate the remainder to other debts.`,[d,...interest.filter(x=>x.id!==d.id)]);}
  if(options.length<3&&active.length>=2){for(let i=0;i<active.length&&options.length<3;i++)for(let j=i+1;j<active.length&&options.length<3;j++){
    const a=active[i],b=active[j],first=Math.min(a.balance,Math.floor(limit/2)),second=Math.min(b.balance,limit-first);
    add('split',`Split between ${a.name} and ${b.name}`,'Divide the amount between these debts, with any remaining amount allocated to other balances.',interest,{[a.id]:first,[b.id]:second});}}
  return options.slice(0,3);
}
export function record(s,allocations,release=0) {
  const r=simulate(s,allocations,release);if(r.cash<0)throw new Error('You cannot record more than your available cash and selected savings.');
  if(r.total<=0)throw new Error('There is no payment to record.');
  return {...s,cash:r.cash,savings:r.savings,debts:s.debts.map(d=>({...d,balance:d.balance-(allocations[d.id]||0),minimum:Math.max(0,d.minimum-(allocations[d.id]||0))}))};
}
