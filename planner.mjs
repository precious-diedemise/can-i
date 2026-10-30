import {validate, today} from './engine.mjs';
import {simulateItems as simulateBase, recordItems as recordBase, itemOptions as optionsBase} from './multi.mjs';
import {createGoal, goalProgress} from './goals.mjs';

export const MAX_AMOUNT=1000000000;
export const frequencies=['once','weekly','fortnightly','monthly','yearly'];
export const amount=n=>{if(!Number.isSafeInteger(n)||n<0||n>MAX_AMOUNT)throw new Error('Enter a valid amount between $0 and $10,000,000.');return n;};
export function validDate(s,optional=false){if(optional&&s==='')return s;if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw new Error('Enter a valid calendar date.');return s;}
export const text=(s,max=100)=>{if(typeof s!=='string'||s.length>max)throw new Error('Text is missing or too long.');return s.trim();};
const identifier=s=>{s=text(s,100);if(!/^[a-zA-Z0-9_-]+$/.test(s)||['__proto__','constructor','prototype'].includes(s))throw new Error('Invalid identifier.');return s;};
export function cleanBill(b){const nextDue=validDate(b.nextDue);if(!frequencies.includes(b.frequency))throw new Error('Choose a bill frequency.');const cost=amount(b.amount),paid=amount(b.paid??0);if(cost<=0||paid>cost)throw new Error('Bill amount must be positive and at least the amount already paid.');const name=text(b.name,60);if(!name)throw new Error('Give the bill a name.');const anchorDay=b.anchorDay??Number(nextDue.slice(8)),anchorMonth=b.anchorMonth??Number(nextDue.slice(5,7));if(!Number.isInteger(anchorDay)||anchorDay<1||anchorDay>31||!Number.isInteger(anchorMonth)||anchorMonth<1||anchorMonth>12)throw new Error('Invalid renewal schedule.');return {id:identifier(b.id),name,amount:cost,nextDue,frequency:b.frequency,autoRenew:!!b.autoRenew,inEssentials:!!b.inEssentials,paid,active:b.active!==false,anchorDay,anchorMonth};}
export function cleanState(s){
 if(!s||typeof s!=='object')throw new Error('Your financial details are missing.');
 if(!Array.isArray(s.debts)||s.debts.length>30)throw new Error('Use up to 30 debts.');
 const debts=s.debts.map(d=>({id:identifier(d.id),name:text(d.name,60),type:text(d.type||'Other',60),balance:amount(d.balance),minimum:amount(d.minimum),apr:d.apr===null?null:Number(d.apr),due:validDate(d.due||'',true)}));
 if(!Array.isArray(s.bills??[])||(s.bills??[]).length>40)throw new Error('Use up to 40 recurring bills.');
 const bills=(s.bills||[]).map(cleanBill);if(new Set(bills.map(b=>b.id)).size!==bills.length)throw new Error('Each bill needs a unique ID.');
 const out=validate({version:2,cash:amount(s.cash),savings:amount(s.savings),essentials:amount(s.essentials),income:amount(s.income??0),asof:validDate(s.asof||today()),payday:validDate(s.payday||'',true),debts,bills,priority:text(s.priority||'',100),preferences:text(s.preferences||'',1200),demo:!!s.demo,setupComplete:!!s.setupComplete,knownFields:Array.isArray(s.knownFields)?s.knownFields.filter(k=>['cash','savings','essentials'].includes(k)):[]});
 if(s.goal){const g=s.goal;if(!['savings','debt'].includes(g.type)||amount(g.target)<=0)throw new Error('Invalid goal.');out.goal={type:g.type,target:g.target,baseline:amount(g.baseline),debtId:g.debtId?identifier(g.debtId):'',deadline:validDate(g.deadline)};}
 return out;
}
function addDays(d,n){const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);}
export function nextBillDate(b,from=b.nextDue){if(b.frequency==='once')return null;if(['weekly','fortnightly'].includes(b.frequency))return addDays(from,b.frequency==='weekly'?7:14);let y=Number(from.slice(0,4)),m=Number(from.slice(5,7));if(b.frequency==='yearly'){y++;m=b.anchorMonth??m;}else if(++m===13){m=1;y++;}const day=Math.min(b.anchorDay??Number(from.slice(8)),new Date(Date.UTC(y,m,0)).getUTCDate());return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
export function horizon(s){const start=s.asof||today();return s.payday&&s.payday>=start?s.payday:addDays(start,30);}
export function billSchedule(s){const end=horizon(s),rows=[];for(const raw of s.bills||[]){const b=cleanBill(raw);if(!b.active)continue;let due=b.nextDue,first=true,count=0;while(due&&due<=end){if(++count>400)throw new Error('A bill has too many past renewals. Update its next unpaid date.');rows.push({billId:b.id,name:b.name,due,amount:b.amount-(first?b.paid:0),inEssentials:b.inEssentials,autoRenew:b.autoRenew});first=false;due=nextBillDate(b,due);}}return {end,assumed:!s.payday||s.payday<(s.asof||today()),rows};}
function normalizeItems(s,items){if(!Array.isArray(items)||items.length>80)throw new Error('Use up to 80 actions.');const paidBills={};const list=items.map((x,i)=>{amount(x.amount);if(!['debt','purchase','bill','protect','income','recurring'].includes(x.type))throw new Error('Unknown action type.');let item={id:x.id?identifier(x.id):'item-'+i,type:x.type,name:text(x.name||x.type,60),amount:x.amount,debtId:x.debtId||'',inEssentials:!!x.inEssentials};if(item.type==='debt'){const d=s.debts.find(d=>d.id===x.debtId);if(!d)throw new Error('Choose an existing debt.');item.name=d.name;}
 if(x.type==='recurring'){const b=(s.bills||[]).find(b=>b.id===x.billId&&b.active!==false);if(!b)throw new Error('Choose an active bill.');paidBills[b.id]=(paidBills[b.id]||0)+x.amount;if(paidBills[b.id]>b.amount-(b.paid||0))throw new Error('Pay at most the remaining amount for this bill’s next occurrence.');item={...item,type:'bill',name:b.name,billId:b.id,inEssentials:b.inEssentials};}return item;});return {list,paidBills};}
export function simulateItems(s,items,release=0){amount(release);const {list,paidBills}=normalizeItems(s,items),r=simulateBase(s,list,release),schedule=billSchedule(s);let debtDue=0;const end=schedule.end;for(const d of s.debts)if(d.minimum&&(!d.due||d.due<=end))debtDue+=Math.max(0,d.minimum-(r.allocations[d.id]||0));let billDue=0,includedBills=0;const used=new Set();for(const row of schedule.rows){const paid=used.has(row.billId)?0:(paidBills[row.billId]||0);used.add(row.billId);const left=Math.max(0,row.amount-paid);if(row.inEssentials)includedBills+=left;else billDue+=left;}
 r.debtDue=debtDue;r.billDue=billDue;r.includedBills=includedBills;r.due=debtDue+billDue;r.room=r.cash-r.essentials-r.due;r.horizon=end;r.assumedHorizon=schedule.assumed;r.paidBills=paidBills;
 r.warnings=r.warnings.filter(w=>!w.startsWith('shortfall:'));if(r.room<0)r.warnings.push('shortfall:'+(-r.room));return r;}
export function recordItems(s,items,release=0){const r=simulateItems(s,items,release),{list}=normalizeItems(s,items);const next=recordBase(s,list,release);next.bills=(s.bills||[]).map(b=>{const paid=(b.paid||0)+(r.paidBills[b.id]||0);if(paid===b.amount){const due=nextBillDate(b);return {...b,paid:0,nextDue:due||b.nextDue,active:!!due};}return {...b,paid};});return next;}
export function itemOptions(s,items,budget,release=0,priority=''){const {list}=normalizeItems(s,items);const converted=list.map(x=>({...x,type:x.billId?'bill':x.type}));const plans=optionsBase(s,converted,budget,release,priority);return plans.map(p=>{const expanded=p.items.map(x=>x.billId?{...x,type:'recurring'}:x);return {...p,items:expanded,result:simulateItems(s,expanded,release)};});}

// Build choices from saved facts. The budget includes any money kept available;
// only the actual actions change the simulated balances. Savings are never released.
export function suggestSplits(input,budget){
 const s=cleanState(input);amount(budget);
 if(budget<=0)throw new Error('Enter an amount greater than zero.');
 if(budget>s.cash)throw new Error('This is more than your saved spendable money. Enter a smaller amount or update My money.');
 const end=horizon(s),debts=s.debts.filter(d=>d.balance>0);
 const debtItem=d=>({id:'split-debt-'+d.id,type:'debt',name:d.name,debtId:d.id,amount:d.balance,inEssentials:false});
 const byInterest=(a,b)=>(b.apr??-1)-(a.apr??-1)||a.balance-b.balance||a.id.localeCompare(b.id);
 const goal=goalProgress(s),hasGoal=!!goal&&!goal.unavailable&&goal.remaining>0;
 const debtOrder=debts.slice().sort((a,b)=>{
  if(hasGoal&&s.goal.type==='debt'&&s.goal.debtId){
   const preferred=Number(b.id===s.goal.debtId)-Number(a.id===s.goal.debtId);if(preferred)return preferred;
  }
  return byInterest(a,b);
 }).map(debtItem);
 const savings={id:'split-savings',type:'protect',name:'Savings',amount:budget,inEssentials:false};
 const upcoming=[
  ...debts.filter(d=>d.minimum>0&&(!d.due||d.due<=end)).map(d=>({...debtItem(d),amount:Math.min(d.minimum,d.balance),due:d.due||'9999-12-31'})),
  ...s.bills.filter(b=>b.active&&b.nextDue<=end&&b.amount>b.paid).map(b=>({id:'split-bill-'+b.id,type:'recurring',name:b.name,billId:b.id,amount:b.amount-b.paid,inEssentials:b.inEssentials,due:b.nextDue}))
 ].sort((a,b)=>a.due.localeCompare(b.due)||a.id.localeCompare(b.id));
 const plans=[],seen=new Set();
 const add=(title,description,groups)=>{
  let remaining=budget,covered=0;const allocations=new Map();
  for(const group of groups){
   let allowance=Math.min(group.amount,remaining);
   for(const candidate of group.items){
    if(!allowance)break;
    const old=allocations.get(candidate.id)?.amount||0;
    const used=Math.min(allowance,Math.max(0,candidate.amount-old),candidate.inEssentials?Math.max(0,s.essentials-covered):Infinity);
    if(!used)continue;
    const {due,...item}=candidate;
    allocations.set(item.id,{...item,amount:old+used});
    if(item.inEssentials)covered+=used;
    allowance-=used;remaining-=used;
   }
  }
  const items=[...allocations.values()];
  const key=JSON.stringify(items.map(x=>[x.id,x.amount]).sort((a,b)=>a[0].localeCompare(b[0])));
  if(seen.has(key))return;seen.add(key);
  plans.push({title,description,items,budget,kept:remaining,release:0,result:simulateItems(s,items)});
 };
 if(upcoming.length)add('Upcoming payments first','Put this amount toward saved bills and debt payments due soon, starting with the earliest dates. Anything left stays spendable.',[{items:upcoming,amount:budget}]);
 const saveFirst=hasGoal?s.goal.type==='savings':!debts.length;
 const focus=saveFirst?[savings]:debtOrder;
 const debtReason=hasGoal&&s.goal.type==='debt'&&s.goal.debtId
  ? 'Start with the debt linked to your goal, then other debts.'
  : debts.some(d=>d.apr!==null)?'Start with the highest APR you entered. Unknown APRs come after known rates.':'No APRs were entered, so start with the smallest balance.';
 add(saveFirst?(hasGoal?'Move toward your savings goal':'Build your savings'):(hasGoal?'Move toward your debt goal':'Reduce your debt'),
  saveFirst?'Move this amount into savings. Your bills and debts still need to be covered.':debtReason+' Other commitments remain visible below.',[{items:focus,amount:budget}]);
 if(debts.length){
  add('Save some and reduce debt','Divide this amount between savings and debt. Bills still need to be covered.',[
   {items:saveFirst?[savings]:debtOrder,amount:Math.ceil(budget/2)},
   {items:saveFirst?debtOrder:[savings],amount:Math.floor(budget/2)}]);
 }else if(upcoming.length){
  add('Pay some and save some','Put half toward upcoming payments and half into savings. Any unused amount stays spendable.',[
   {items:upcoming,amount:Math.ceil(budget/2)},{items:[savings],amount:Math.floor(budget/2)}]);
 }
 add('Build your savings','Move this amount into savings. Your bills and debts still need to be covered.',[{items:[savings],amount:budget}]);
 add('Save some, keep some','Move half into savings and keep the rest available for everyday spending.',[{items:[savings],amount:Math.floor(budget/2)}]);
 add('Keep it available','Keep this amount in your spendable money for now. No balances change.',[]);
 return plans.slice(0,3);
}
export function financialContext(s){const r=simulateItems(s,[]);return {currency:'USD',amountUnit:'integer cents',asof:s.asof,setupComplete:s.setupComplete,knownFields:s.knownFields,cash:s.cash,protectedSavings:s.savings,variableEssentials:s.essentials,payday:s.payday,preferences:s.preferences,debts:s.debts,bills:s.bills||[],goal:s.goal||null,goalProgress:goalProgress(s),forecast:{through:r.horizon,assumed30Days:r.assumedHorizon,remainingDebtPayments:r.debtDue,additionalBills:r.billDue,billsAlreadyInEssentials:r.includedBills,afterAllEnteredCommitments:r.room},warnings:r.warnings};}
export function evaluatePlan(s,p){const items=p.items,release=p.release??0;const result=simulateItems(s,items,release);const normalized=normalizeItems(s,items).list.map(x=>x.billId?{...x,type:'recurring'}:x);return {title:text(p.title||'Your plan',80),items:normalized,release,result,goal:goalProgress(s,result),beforeGoal:goalProgress(s),note:'Preview only. Future income and future interest are not projected.'};}
// Fact changes are proposals until the user explicitly accepts the visible before/after card.
export function applyFacts(s,changes){const next=structuredClone(s);const allowed=['cash','savings','essentials','payday','preferences','debts','bills','goal'];for(const k of Object.keys(changes))if(!allowed.includes(k))throw new Error('Unsupported change.');
 for(const k of ['cash','savings','essentials'])if(changes[k]!==null&&changes[k]!==undefined){next[k]=amount(changes[k]);next.knownFields=[...new Set([...(next.knownFields||[]),k])];}
 if(changes.payday!==null&&changes.payday!==undefined)next.payday=validDate(changes.payday,true);
 if(changes.preferences!==null&&changes.preferences!==undefined)next.preferences=text(changes.preferences,1200);
 for(const key of ['debts','bills']){if(changes[key]!==undefined&&!Array.isArray(changes[key]))throw new Error('Invalid updates.');for(const item of changes[key]||[]){const index=(next[key]||[]).findIndex(x=>x.id===item.id);next[key]??=[];if(index<0)next[key].push(item);else {const old=next[key][index];next[key][index]=key==='bills'&&old.nextDue===item.nextDue?{...item,anchorDay:old.anchorDay,anchorMonth:old.anchorMonth}:item;}}}
 if(changes.goal)next.goal=createGoal(next,changes.goal,next.asof);
 if(['cash','savings','essentials'].every(k=>next.knownFields?.includes(k)))next.setupComplete=true;
 return cleanState(next);
}

