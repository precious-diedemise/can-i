// DOM integration checks; no live AI calls and no browser layout assertions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import * as engine from './engine.mjs';
import * as planner from './planner.mjs';
import * as goals from './goals.mjs';
const app=fs.readFileSync(new URL('./app.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const chat=fs.readFileSync(new URL('./conversation.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function createConversation','function createConversation');
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
async function setup(saved){const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window;Object.assign(w,engine,planner,goals,{structuredClone,AbortController,fetch:async()=>({ok:true,json:async()=>({configured:true})})});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 if(saved)w.localStorage.setItem('can-i-v2',JSON.stringify({state:saved,history:[]}));const ctx=dom.getInternalVMContext();w.createConversation=vm.runInContext('(()=>{'+chat+';return createConversation;})()',ctx);vm.runInContext(app,ctx);await tick();return {w,close:()=>dom.window.close(),run:s=>vm.runInContext(s,ctx),q:id=>w.document.getElementById(id),route:async h=>{w.location.hash=h;await tick();},fill:(id,value)=>{const e=w.document.getElementById(id);assert.ok(e,id+' exists');e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));},submit:async id=>{w.document.getElementById(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();}};}
const saved=()=>({...engine.demo(),demo:false,setupComplete:true,bills:[],preferences:'Protect my cushion',knownFields:['cash','savings','essentials']});

test('guided setup, saved steps, debts and bills, recommendations and no AI',async t=>{const a=await setup();t.after(a.close);assert.ok(a.q('guided-money'));assert.equal(a.q('cash').value,'');assert.equal(a.q('debt-fields'),null);a.fill('cash','200');a.fill('savings','50');a.w.document.querySelector('[data-action="setup-next"]').click();assert.ok(a.q('guided-essentials'));a.fill('essentials','80');a.w.document.querySelector('[data-action="setup-back"]').click();assert.equal(a.q('cash').value,'200.00');a.w.document.querySelector('[data-action="setup-next"]').click();assert.equal(a.q('essentials').value,'80.00');a.w.document.querySelector('[data-action="setup-next"]').click();a.fill('bill-name','Phone');a.fill('bill-amount','10');a.fill('bill-date',engine.dateAfter(3));await a.submit('bill-form');a.w.document.querySelector('[data-action="setup-next"]').click();assert.ok(a.q('guided-debts'));a.w.document.querySelector('[data-action="add-debt"]').click();a.fill('dn-0','Card');a.fill('db-0','100');a.fill('dm-0','40');a.fill('dd-0',engine.dateAfter(1));a.w.document.querySelector('[data-action="setup-next"]').click();a.w.document.querySelector('[data-action="setup-next"]').click();assert.match(a.q('content').textContent,/Ready to explore/);a.w.document.querySelector('[data-action="setup-next"]').click();await tick();assert.ok(a.q('whatif-form'));assert.equal(a.run('state.cash'),20000);a.fill('split-budget','50');await a.submit('whatif-form');assert.match(a.q('whatif-results').textContent,/Here’s what would change/);assert.equal(a.run('state.cash'),20000);await a.route('#money');assert.equal(a.q('debt-fields'),null);await a.route('#debts');assert.ok(a.q('dn-0'));await a.route('#play');assert.match(a.q('content').textContent,/COMING SOON/);await a.route('#chat');assert.equal(a.q('chat-form'),null);assert.ok(a.q('whatif-form'));});
test('returning users preserve balances and overview; infeasible plans are not recommended',async t=>{const a=await setup(saved());t.after(a.close);assert.match(a.q('content').textContent,/Make room/);a.run('state.cash=10000;state.essentials=9500');await a.route('#compare');a.q('mode-own').click();a.fill('w-amount-0','60');await a.submit('whatif-form');assert.match(a.q('whatif-results').textContent,/gap for entered essentials/);assert.equal(a.run('state.cash'),10000);});

test('one screen compares user plan with different same-total alternatives',async t=>{const a=await setup(saved());t.after(a.close);await a.route('#compare');assert.ok(a.q('whatif-form'));assert.equal(a.q('pay-form'),null);a.q('mode-own').click();a.run("whatItems=[{id:'one',type:'debt',debtId:state.debts[0].id,name:state.debts[0].name,amount:6000},{id:'two',type:'protect',name:'Savings',amount:4000}];renderItems('w')");await a.submit('whatif-form');assert.match(a.q('whatif-results').textContent,/Your plan/);assert.ok(a.run('options.length')>1);assert.equal(a.run('state.cash'),saved().cash);assert.equal(a.run('options.every(p=>p.result.total===10000)'),true);a.w.document.querySelector('[data-action="unified-review"]').click();assert.ok(a.q('plan-review'));a.fill('w-amount-0','20');assert.equal(a.run('pending'),null);assert.equal(a.q('whatif-results').innerHTML,'');});
test('suggestions ignore hypothetical income and use only saved spendable money',async t=>{
 const a=await setup(saved());t.after(a.close);await a.route('#compare');a.fill('split-budget','50');await a.submit('whatif-form');
 assert.equal(a.run('options[0].result.total'),5000);
 a.q('mode-own').click();a.run("whatItems=[{id:'income',type:'income',name:'Extra shift',amount:5000}];renderItems('w')");await a.submit('whatif-form');
 assert.match(a.q('whatif-results').textContent,/possibility/);assert.equal(a.run('options[0].result.cash'),saved().cash+5000);
 a.q('mode-suggest').click();await a.submit('whatif-form');assert.equal(a.q('whatif-error').textContent,'');
 assert.equal(a.run('options.every(p=>p.result.received===0 && p.result.release===0)'),true);
 a.fill('split-budget',String((saved().cash+100)/100));await a.submit('whatif-form');assert.match(a.q('whatif-error').textContent,/more than your saved spendable/);
 assert.equal(a.run('state.cash'),saved().cash);
});
test('recording remains explicit and undo restores balance',async t=>{const a=await setup(saved());t.after(a.close);await a.route('#compare');a.q('mode-own').click();a.fill('w-amount-0','10');await a.submit('whatif-form');a.w.document.querySelector('[data-action="unified-review"]').click();a.w.document.querySelector('[data-action="record-dialog"]').click();assert.equal(a.run('state.cash'),saved().cash);a.q('confirm').returnValue='record';a.q('confirm').dispatchEvent(new a.w.Event('close'));await tick();assert.equal(a.run('state.cash'),saved().cash-1000);await a.route('#history');a.w.document.querySelector('[data-action="undo"]').click();assert.equal(a.run('state.cash'),saved().cash);});

test('one amount is the default; manual entries are optional and survive switching',async t=>{
 const a=await setup(saved());t.after(a.close);await a.route('#compare');
 assert.equal(a.q('mode-suggest').getAttribute('aria-pressed'),'true');assert.equal(a.q('split-budget-wrap').hidden,false);
 assert.equal(a.q('own-plan-fields').hidden,true);assert.equal(a.q('own-plan-fields').disabled,true);
 assert.equal(a.q('split-budget').disabled,false);assert.equal(a.w.document.querySelectorAll('#whatif-form button[type="submit"]').length,1);
 a.fill('split-budget','40');await a.submit('whatif-form');assert.equal(a.run('options[0].result.total'),4000);
 assert.equal(a.q('whatif-form').checkValidity(),true);
 a.q('mode-own').click();assert.equal(a.q('own-plan-fields').hidden,false);assert.equal(a.q('own-plan-fields').disabled,false);
 a.fill('w-amount-0','100');a.q('w-use').checked=true;a.fill('w-release','20');
 a.q('mode-suggest').click();assert.equal(a.q('w-amount-0').value,'100');assert.equal(a.q('whatif-results').innerHTML,'');
 await a.submit('whatif-form');assert.equal(a.run('options.every(p=>p.result.release===0)'),true);
 a.w.document.querySelector('[data-action="unified-review"]').click();assert.equal(a.run('pending.release'),0);
 a.q('mode-own').click();assert.equal(a.q('whatif-results').innerHTML,'');assert.equal(a.q('w-amount-0').value,'100');
 await a.submit('whatif-form');assert.equal(a.run('options[0].result.total'),10000);assert.equal(a.run('options[0].result.release'),2000);
 assert.equal(a.run('state.cash'),saved().cash);
});

test('essentials continues to bills, sample numbers remain accessible, total-debt goal has no picker',async t=>{
 const a=await setup(saved());t.after(a.close);await a.route('#essentials');a.fill('essentials','90');await a.submit('guided-essentials');
 assert.equal(a.w.location.hash,'#bills');assert.equal(a.run('state.essentials'),9000);
 assert.ok(a.w.document.querySelector('a[href="#debts"]'));
 assert.ok(a.w.document.querySelector('[data-action="demo"]'));
 await a.route('#goal');assert.equal(a.q('goal-debt'),null);a.fill('goal-type','debt');a.fill('goal-target','100');a.fill('goal-deadline','2099-01-01');await a.submit('goal-form');
 assert.equal(a.run('state.goal.debtId'),'');assert.equal(a.run('state.goal.baseline'),a.run('state.debts.reduce((n,d)=>n+d.balance,0)'));
 const before=a.run('state.cash');a.w.confirm=()=>false;a.w.document.querySelector('[data-action="demo"]').click();assert.equal(a.run('state.cash'),before);
 a.w.confirm=()=>true;a.w.document.querySelector('[data-action="demo"]').click();assert.equal(a.run('state.demo'),true);assert.equal(a.run('state.bills.length'),0);assert.equal(a.run('state.knownFields.length'),3);
});

test('completed comparisons keep their actual date and record once; saved plans never enter cash flow',async t=>{
 const a=await setup(saved());t.after(a.close);await a.route('#compare');a.q('mode-own').click();a.fill('w-amount-0','10');await a.submit('whatif-form');
 a.w.document.querySelector('[data-action="unified-review"]').click();a.w.document.querySelector('[data-action="save-plan"]').click();
 assert.equal(a.run('monthFlow(today().slice(0,7)).moneyOut'),0);
 a.w.document.querySelector('[data-action="record-dialog"]').click();a.fill('activity-date','2020-02-29');
 a.q('confirm').returnValue='record';a.q('confirm').dispatchEvent(new a.w.Event('close'));await tick();
 assert.equal(a.run('history.at(-1).occurredOn'),'2020-02-29');assert.equal(a.run("monthFlow('2020-02').moneyOut"),1000);
 assert.equal(a.run('state.cash'),saved().cash-1000);a.q('confirm').dispatchEvent(new a.w.Event('close'));
 assert.equal(a.run('state.cash'),saved().cash-1000);assert.equal(a.run('history.length'),2);
 const f=a.w.document.querySelector('.activity-date-edit');f.querySelector('input').value='2020-03-01';f.dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(a.run("monthFlow('2020-02').moneyOut"),0);assert.equal(a.run("monthFlow('2020-03').moneyOut"),1000);assert.equal(a.run('state.cash'),saved().cash-1000);
 a.w.document.querySelector('[data-action="undo"]').click();assert.equal(a.run("monthFlow('2020-03').moneyOut"),0);assert.equal(a.run('state.cash'),saved().cash);
});

test('manual income, essentials spending and savings transfers use existing balances without counting transfers as spending',async t=>{
 const a=await setup(saved());t.after(a.close);
 async function add(type,amount,name='Test'){
  await a.route('#history');a.q('activity-type').value=type;a.q('activity-type').dispatchEvent(new a.w.Event('change',{bubbles:true}));
  a.fill('activity-amount',amount);if(a.q('activity-name'))a.fill('activity-name',name);if(a.q('activity-covered'))a.q('activity-covered').checked=true;
  await a.submit('activity-form');assert.equal(a.q('activity-error').textContent,'');const before=a.run('state.cash');
  a.q('confirm').returnValue='record';a.q('confirm').dispatchEvent(new a.w.Event('close'));await tick();return before;
 }
 await add('income','100','Paycheck');assert.equal(a.run('state.cash'),saved().cash+10000);
 await add('purchase','10','Lunch');assert.equal(a.run('state.cash'),saved().cash+9000);assert.equal(a.run('state.essentials'),saved().essentials-1000);
 await add('protect','20');assert.equal(a.run('state.savings'),saved().savings+2000);
 await add('release','5');assert.equal(a.run('state.savings'),saved().savings+1500);
 assert.equal(a.run('state.cash'),saved().cash+7500);
 assert.equal(a.run('monthFlow(today().slice(0,7)).moneyIn'),10000);assert.equal(a.run('monthFlow(today().slice(0,7)).moneyOut'),1000);
 assert.equal(a.run('monthFlow(today().slice(0,7)).toSavings'),2000);assert.equal(a.run('monthFlow(today().slice(0,7)).fromSavings'),500);
 assert.equal(a.run("JSON.parse(localStorage.getItem('can-i-v2')).history.length"),4);
});

test('manual debt and saved bill payments update targets once; excessive payments and future dates are rejected',async t=>{
 const s=saved();s.bills=[planner.cleanBill({id:'phone',name:'Phone',amount:1000,nextDue:'2020-01-31',frequency:'monthly'})];s.bills[0].nextDue=engine.today();s.bills[0].anchorDay=Number(engine.today().slice(8));
 const a=await setup(s);t.after(a.close);await a.route('#history');
 a.q('activity-type').value='recurring';a.q('activity-type').dispatchEvent(new a.w.Event('change',{bubbles:true}));a.fill('activity-amount','10');await a.submit('activity-form');
 a.fill('activity-date','2099-01-01');a.q('confirm').returnValue='record';a.q('confirm').dispatchEvent(new a.w.Event('close'));await tick();assert.equal(a.run('state.cash'),s.cash);
 a.fill('activity-date',engine.today());a.q('confirm').dispatchEvent(new a.w.Event('close'));await tick();assert.equal(a.run('state.cash'),s.cash-1000);assert.equal(a.run('state.bills[0].nextDue'),planner.nextBillDate(s.bills[0]));
 a.q('activity-type').value='debt';a.q('activity-type').dispatchEvent(new a.w.Event('change',{bubbles:true}));a.fill('activity-amount','10');await a.submit('activity-form');
 a.q('confirm').returnValue='record';a.q('confirm').dispatchEvent(new a.w.Event('close'));await tick();assert.equal(a.run('state.debts[0].balance'),s.debts[0].balance-1000);
 a.q('activity-type').value='purchase';a.q('activity-type').dispatchEvent(new a.w.Event('change',{bubbles:true}));a.fill('activity-amount','999999');a.fill('activity-name','Too much');await a.submit('activity-form');assert.ok(a.q('activity-error').textContent);assert.equal(a.run('pending'),null);
});

test('overview preserves cash after essentials and navigation; old history is preserved without guessed dates or flows',async t=>{
 const a=await setup(saved());t.after(a.close);
 assert.equal(a.w.document.querySelectorAll('.dashboard-metric').length,4);assert.match(a.w.document.querySelector('.dashboard-main').textContent,/\$210.00/);
 assert.equal(a.w.document.querySelectorAll('aside [data-nav]').length,7);
 assert.equal(a.run('state.cash'),saved().cash);
 a.run("history=[{id:'old',kind:'payment',label:'Earlier payment',total:1000,description:'Imported',at:new Date().toISOString()}];save()");await a.route('#history');
 assert.match(a.q('content').textContent,/actual payment date was not saved/);assert.equal(a.run('monthFlow(today().slice(0,7)).older'),1);assert.equal(a.run('monthFlow(today().slice(0,7)).moneyOut'),0);
 assert.equal(a.run("JSON.parse(localStorage.getItem('can-i-v2')).history[0].id"),'old');
});

test('a suggested option can be adjusted in My own plan without retyping its items',async t=>{
 const a=await setup(saved());t.after(a.close);await a.route('#compare');a.fill('split-budget','60');await a.submit('whatif-form');
 const expected=a.run('JSON.stringify(options[0].items)');
 a.w.document.querySelector('[data-action="adjust-split"]').click();
 assert.equal(a.run('comparisonAction'),'own');assert.equal(a.run('JSON.stringify(whatItems)'),expected);
 assert.equal(a.q('own-plan-fields').hidden,false);assert.equal(a.q('whatif-results').innerHTML,'');
 assert.equal(a.q('see-comparison').textContent,'Compare my plan');
 a.fill('w-amount-0','1');await a.submit('whatif-form');assert.equal(a.run('options[0].items[0].amount'),100);
 assert.equal(a.run('state.cash'),saved().cash);
});
test('automatic split stays a preview until completion; saved bills record and advance once',async t=>{
 const s=saved();s.bills=[planner.cleanBill({id:'phone',name:'Phone',amount:1000,nextDue:engine.today(),frequency:'monthly'})];
 const a=await setup(s);t.after(a.close);await a.route('#compare');a.fill('split-budget','60');await a.submit('whatif-form');
 assert.equal(a.q('whatif-error').textContent,'');assert.equal(a.run('options.length'),3);
 assert.equal(a.run("options[0].items.some(x=>x.billId==='phone')"),true);
 const total=a.run('options[0].result.total');assert.equal(a.run('state.cash'),s.cash);
 a.w.document.querySelector('[data-action="unified-review"]').click();a.w.document.querySelector('[data-action="save-plan"]').click();
 assert.equal(a.run('state.cash'),s.cash);assert.equal(a.run('history.at(-1).kind'),'plan');
 a.w.document.querySelector('[data-action="record-dialog"]').click();a.q('confirm').returnValue='record';a.q('confirm').dispatchEvent(new a.w.Event('close'));await tick();
 assert.equal(a.run('state.cash'),s.cash-total);assert.equal(a.run('state.bills[0].nextDue'),planner.nextBillDate(s.bills[0]));
 assert.equal(a.run('history.at(-1).occurredOn'),engine.today());
 a.q('confirm').dispatchEvent(new a.w.Event('close'));assert.equal(a.run('state.cash'),s.cash-total);
 a.w.document.querySelector('[data-action="undo"]').click();assert.equal(a.run('state.cash'),s.cash);assert.equal(a.run('state.bills[0].nextDue'),s.bills[0].nextDue);
});
test('keeping money available is not recordable as a completed transaction',async t=>{
 const a=await setup({...saved(),debts:[],bills:[]});t.after(a.close);await a.route('#compare');a.fill('split-budget','50');await a.submit('whatif-form');
 const index=a.run('options.findIndex(p=>p.items.length===0)');assert.ok(index>=0);
 a.w.document.querySelector('[data-action="unified-review"][data-index="'+index+'"]').click();
 assert.equal(a.w.document.querySelector('#plan-review [data-action="record-dialog"]'),null);
 assert.match(a.q('plan-review').textContent,/no actions to record/);assert.equal(a.run('state.cash'),saved().cash);
});

