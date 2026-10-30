import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanState,cleanBill,nextBillDate,billSchedule,simulateItems,recordItems,applyFacts,itemOptions,suggestSplits} from './planner.mjs';
export const fixture=()=>cleanState({version:2,setupComplete:true,cash:60000,savings:30000,essentials:12000,income:0,payday:'2026-10-30',asof:'2026-10-16',debts:[{id:'card',name:'Card',type:'Credit card',balance:80000,minimum:4000,apr:27.99,due:'2026-10-23'},{id:'friend',name:'Friend',type:'Other',balance:20000,minimum:0,apr:0,due:''}],bills:[{id:'phone',name:'Phone',amount:2000,nextDue:'2026-10-25',frequency:'monthly',autoRenew:true,inEssentials:false}],preferences:'Pay my friend first',knownFields:['cash','savings','essentials']});
test('forecast lists bills without deducting them from cash',()=>{const s=fixture(),before=structuredClone(s),r=simulateItems(s,[]);assert.equal(r.cash,60000);assert.equal(r.billDue,2000);assert.equal(r.room,42000);assert.deepEqual(s,before);});
test('paid bill is removed once from forecast and recording advances one cycle',()=>{const s=fixture(),items=[{type:'recurring',billId:'phone',amount:2000}];const r=simulateItems(s,items);assert.equal(r.cash,58000);assert.equal(r.billDue,0);const after=recordItems(s,items);assert.equal(after.bills[0].nextDue,'2026-11-25');assert.equal(after.cash,58000);assert.equal(s.cash,60000);});
test('bill already in essentials is not double counted, even after partial payment',()=>{const s=fixture();s.bills[0].inEssentials=true;const r=simulateItems(s,[{type:'recurring',billId:'phone',amount:1000}]);assert.equal(r.essentials,11000);assert.equal(r.billDue,0);assert.equal(r.cash,59000);const after=recordItems(s,[{type:'recurring',billId:'phone',amount:1000}]);assert.equal(after.bills[0].paid,1000);assert.equal(simulateItems(after,[]).includedBills,1000);});
test('recurring month end and leap day maintain original anchors',()=>{const b=cleanBill({id:'rent',name:'Rent',amount:100,nextDue:'2027-01-31',frequency:'monthly'});assert.equal(nextBillDate(b),'2027-02-28');assert.equal(nextBillDate(b,'2027-02-28'),'2027-03-31');const leap=cleanBill({...b,frequency:'yearly',nextDue:'2028-02-29',anchorDay:29,anchorMonth:2});assert.equal(nextBillDate(leap),'2029-02-28');assert.equal(nextBillDate(leap,'2031-02-28'),'2032-02-29');});
test('unknown payday uses explicit 30 days, payday obligations included',()=>{const s=fixture();s.payday='';const r=simulateItems(s,[]);assert.equal(r.horizon,'2026-11-15');assert.equal(r.assumedHorizon,true);s.payday='2026-10-25';assert.equal(simulateItems(s,[]).billDue,2000);});
test('weekly occurrences and inactive bills are tracked',()=>{const s=fixture();s.bills[0].frequency='weekly';s.bills[0].nextDue='2026-10-16';assert.equal(billSchedule(s).rows.length,3);s.bills[0].active=false;assert.equal(billSchedule(s).rows.length,0);});
test('balance correction does not double count a paycheck; unrelated facts persist',()=>{const s=fixture();const n=applyFacts(s,{cash:60000});assert.equal(n.cash,60000);assert.deepEqual(n.debts,s.debts);assert.equal(n.preferences,s.preferences);assert.equal(s.cash,60000);});
test('incomplete profile only completes after all starting figures confirmed',()=>{let s=cleanState({...fixture(),setupComplete:false,knownFields:[]});s=applyFacts(s,{cash:10000});assert.equal(s.setupComplete,false);s=applyFacts(s,{savings:0,essentials:0});assert.equal(s.setupComplete,true);});
test('invalid dates, excess spending, duplicate IDs and bill overpayment are rejected',()=>{assert.throws(()=>cleanState({...fixture(),payday:'2026-02-30'}));assert.throws(()=>cleanState({...fixture(),cash:Infinity}));const s=fixture();assert.throws(()=>simulateItems(s,[{type:'recurring',billId:'phone',amount:2001}]));assert.throws(()=>recordItems(s,[{type:'purchase',amount:100000}]));assert.throws(()=>cleanState({...s,bills:[s.bills[0],s.bills[0]]}));assert.throws(()=>cleanState({...s,debts:[{...s.debts[0],id:'__proto__'}]}));});
test('manual allocation carries recurring IDs into forecasts and preserves equal totals',()=>{const s=fixture(),items=[{id:'c',type:'debt',name:'Card',debtId:'card',amount:80000},{id:'b',type:'recurring',name:'Phone',billId:'phone',amount:2000}];const plans=itemOptions(s,items,6000);assert.ok(plans.every(p=>p.result.total===6000));assert.ok(plans.some(p=>p.items.some(x=>x.type==='recurring')));});

test('one budget creates distinct choices from saved bills and debts without changing money',()=>{
 const s=fixture(),before=structuredClone(s),plans=suggestSplits(s,10000);
 assert.equal(plans.length,3);assert.deepEqual(s,before);
 assert.deepEqual(plans[0].items.map(x=>[x.type,x.amount]),[['debt',4000],['recurring',2000]]);
 assert.equal(plans[0].kept,4000);
 for(const p of plans){
  assert.equal(p.result.total+p.kept,10000);assert.equal(p.result.cash,s.cash-p.result.total);
  assert.equal(p.result.release,0);assert.ok(p.result.savings>=s.savings);
  assert.ok(p.items.every(x=>!['income','purchase'].includes(x.type)));
 }
});
test('goal and known APRs influence suggestions; savings goals do not withdraw existing savings',()=>{
 const s=fixture();s.goal={type:'savings',target:50000,baseline:s.savings,deadline:'2027-01-01',debtId:''};
 const p=suggestSplits(s,10000).find(p=>p.title==='Move toward your savings goal');
 assert.equal(p.result.savings,s.savings+10000);assert.equal(p.result.release,0);
 s.goal={type:'debt',target:50000,baseline:100000,deadline:'2027-01-01',debtId:''};
 const d=suggestSplits(s,10000).find(p=>p.title==='Move toward your debt goal');
 assert.equal(d.items[0].debtId,'card');assert.equal(d.items[0].amount,10000);
 s.debts[0].apr=null;
 const unknown=suggestSplits(s,10000).find(p=>p.title==='Move toward your debt goal');
 assert.equal(unknown.items[0].debtId,'friend');assert.match(unknown.description,/Unknown APRs/);
});
test('future and paid bills are excluded; partial bills in essentials are counted once',()=>{
 const s=fixture();s.bills[0].inEssentials=true;s.bills[0].paid=500;
 s.bills.push(cleanBill({...s.bills[0],id:'later',name:'Later',nextDue:'2026-12-01'}));
 const p=suggestSplits(s,10000)[0],bill=p.items.find(x=>x.billId==='phone');
 assert.equal(bill.amount,1500);assert.ok(!p.items.some(x=>x.billId==='later'));
 assert.equal(p.result.essentials,s.essentials-1500);assert.equal(p.result.billDue,0);
 const after=recordItems(s,p.items);assert.equal(after.bills[0].nextDue,'2026-11-25');assert.equal(after.cash,s.cash-p.result.total);
 s.essentials=1000;assert.doesNotThrow(()=>suggestSplits(s,10000));
 assert.ok(suggestSplits(s,10000).every(p=>p.result.essentials>=0));
});
test('empty debts and bills still offer saving and keeping money without invented expenses',()=>{
 const s={...fixture(),debts:[],bills:[],essentials:0},plans=suggestSplits(s,10000);
 assert.equal(plans.length,3);assert.deepEqual(plans.map(p=>p.result.total),[10000,5000,0]);
 assert.deepEqual(plans.map(p=>p.kept),[0,5000,10000]);
 assert.ok(plans.every(p=>p.items.every(x=>x.type==='protect')));
 assert.equal(suggestSplits(s,1).length,2);
});
test('suggestions reject unavailable funds rather than quietly reducing the requested budget',()=>{
 const s=fixture();s.income=10000000;s.savings=500000;
 for(const amount of [0,-1,0.5,NaN,Infinity,s.cash+1])assert.throws(()=>suggestSplits(s,amount));
 const plans=suggestSplits(s,s.cash);assert.ok(plans.every(p=>p.result.cash>=0));
});
test('full supported bill list can be suggested and recorded without dropping commitments',()=>{
 const s={...fixture(),debts:[],essentials:0,bills:Array.from({length:40},(_,i)=>cleanBill({id:'bill-'+i,name:'Bill '+i,amount:100,nextDue:'2026-10-20',frequency:'once'}))};
 const plan=suggestSplits(s,10000)[0];assert.equal(plan.items.length,40);assert.equal(plan.kept,6000);
 const after=recordItems(s,plan.items);assert.equal(after.cash,s.cash-4000);assert.ok(after.bills.every(b=>!b.active));
});
test('varied budgets preserve funds, unique choices and debt limits including cleared debts',()=>{
 for(const budget of [1,2,3,99,101,4000,6000,10000,60000]){
  const s=fixture();s.debts[1].balance=103;s.debts[0].minimum=0;
  const plans=suggestSplits(s,budget);
  assert.equal(new Set(plans.map(p=>JSON.stringify(p.items.map(x=>[x.id,x.amount]).sort()))).size,plans.length);
  for(const p of plans){
   assert.equal(p.result.total+p.kept,budget);assert.ok(p.result.cash>=0);
   assert.ok(p.items.every(x=>Number.isSafeInteger(x.amount)&&x.amount>0));
   assert.ok(p.result.balances.every(d=>d.balance>=0));
   assert.equal(p.result.cash+p.result.savings+p.result.spending+Object.values(p.result.allocations).reduce((a,b)=>a+b,0),s.cash+s.savings);
  }
 }
});

