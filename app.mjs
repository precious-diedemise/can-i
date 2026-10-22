import {createGoal,goalProgress} from './goals.mjs';
import {cents,dollars,today,demo,validate,snapshot,simulate,paymentOptions,record,dueBeforeIncome} from './engine.mjs';
import {simulateItems,itemOptions,recordItems,cleanState,cleanBill,billSchedule,frequencies} from './planner.mjs';

const $=id=>document.getElementById(id), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(dollars(n));
const date=x=>x?new Date(x+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'Not set';
const value=n=>dollars(n).toFixed(2);
const KEY='can-i-v2';let state=demo(),history=[],undo=null,options=[],pending=null,storageProblem=false;
try{const raw=localStorage.getItem(KEY);if(raw){const saved=JSON.parse(raw);if(saved.state.version!==2)throw new Error();state=validate(saved.state);history=Array.isArray(saved.history)?saved.history:[];undo=saved.undo??null;state.asof=today();}}catch{storageProblem=true;}
const toast=msg=>{ $('toast').textContent=msg;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',4000);};
function save(){try{localStorage.setItem(KEY,JSON.stringify({state,history,undo}));return true;}catch{toast('Browser saving is unavailable. Keep this tab open to retain your changes.');return false;}}
function field(id,label,val='',type='number',hint='',attrs=''){return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(val)}" ${type==='number'?'min="0" step="0.01"':''} ${attrs}>${hint?`<small>${hint}</small>`:''}</div>`;}
function select(id,label,choices,selected){return `<div class="field"><label for="${id}">${label}</label><select id="${id}">${choices.map(([v,t])=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`;}
function heading(title,sub,action=''){return `<div class="heading"><div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`;}
function stat(label,n){return `<div class="stat-row"><span>${label}</span><b class="${n<0?'negative':''}">${money(n)}</b></div>`;}
function warnings(r){const map={ 'essentials-gap':'Current cash does not cover your entered essentials. Review your numbers and payment options.', 'income-date-unknown':'Next income date is missing. The additional forecast uses the next 30 days; no payments are automatically deducted.', 'dates-missing':'Some debt due dates are missing. Check them before choosing a plan.', 'apr-missing':'Some APRs are unknown; interest comparisons may be incomplete.', 'same-day':'A payment is due on payday. Verify that income arrives before the payment cutoff.', 'income-overdue':'The expected income date has passed. Update it; that money is still excluded from current cash.' };return r.warnings.map(w=>{if(w.startsWith('cash:'))return `This exceeds available funds by ${money(+w.split(':')[1])}.`;if(w.startsWith('shortfall:'))return `${money(+w.split(':')[1])} short of covering reserved essentials and remaining payments before income.`;return map[w];}).filter(Boolean);}
function warningHTML(r){const w=warnings({...r,warnings:r.warnings.filter(x=>!x.startsWith('shortfall:'))});if(r.cash-r.essentials<0)w.unshift(`${money(r.essentials-r.cash)} short of covering your entered essentials after this choice.`);return w.length?`<div class="warn">${w.map(esc).join('<br>')}</div>`:'';}
function commitmentForecast(r){return `<details class="note below"><summary>If I also cover upcoming commitments…</summary><p>Through ${date(r.horizon||state.payday)}${r.assumedHorizon?' · next 30 days because income timing is unknown or past':''}. Payments on the income date are included because deposit timing is unknown.</p>${stat('Debt payments still due',r.debtDue??r.due)}${stat('Bills outside essentials',r.billDue||0)}<p>${money(r.cash)} cash − ${money(r.essentials)} essentials − ${money(r.due)} additional commitments = <b>${money(r.room)}</b>.</p><p>${r.room<0?`You would need ${money(-r.room)} more to cover these commitments.`:`You would have ${money(r.room)} left.`} These are projections. No payments have been made automatically. Bills marked as already in essentials are counted there once.</p></details>`;}

function allocationHTML(a){return Object.entries(a).filter(([,n])=>n>0).map(([id,n])=>`${money(n)} → ${esc(state.debts.find(d=>d.id===id)?.name)}`).join('<br>')||'Keep the payment money available.';}
function protectedControl(prefix){return `<div class="protected-control"><label class="check"><input id="${prefix}-use" type="checkbox">Would you consider using protected savings?</label><div id="${prefix}-releasebox" class="hidden">${field(prefix+'-release','Amount to include in this comparison','0','number',`Up to ${money(state.savings)}. Included only if you choose an amount.`)}</div><p class="disclosure">Protected savings stay excluded by default.</p></div>`;}
function release(prefix){return $(prefix+'-use')?.checked?cents($(prefix+'-release').value):0;}
function banner(){ $('notice').innerHTML=state.demo?'<div class="banner"><span>✳ Fictional example data · explore freely</span><a href="#money">Use my own numbers →</a></div>':'<div class="banner personal"><span>Saved in this browser · no account sync</span><a href="#money">Edit my numbers →</a></div>'; }
function render(){const page=location.hash.slice(1)||'home';document.querySelectorAll('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===page);if(a.dataset.nav===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});banner(); const views={home:homeView,pay:payView,whatif:whatifView,money:moneyView,history:historyView};$('content').innerHTML=(views[page]||homeView)();if(page==='whatif')renderItems('w');if(page==='pay')renderItems('p');if(page==='money')renderDebtFields();if(page==='home')warningHome();}
function homeView(){const s={...simulateItems(state,[]),afterEssentials:state.cash-state.essentials};return heading('Make room for better decisions.','See where you stand. Then explore your next move.','<a href="#money" class="secondary" style="text-decoration:none">Edit my money</a>')+`<div class="grid overview"><section class="card hero"><div class="label">${s.afterEssentials<0?'Essentials gap to cover':'Cash after essentials'}</div><div class="amount">${money(s.afterEssentials)}</div><span class="pill">${date(state.payday)} · next expected income</span><p>Current cash minus your entered essentials. Debt payments have not been deducted here. Compare your payment options to see what would remain.</p></section><section class="card"><div class="label">The bigger picture</div>${stat('Spendable money',s.cash)}${stat('Protected savings',s.savings)}${stat('Essentials reserved',s.essentials)}${stat('Debt payments in planning window',s.debtDue)}${stat('Bills outside essentials',s.billDue)}</section></div><div id="home-warnings" class="below"></div><div class="section-label"><h2>What are we figuring out?</h2><span class="label">EXPLORE YOUR OPTIONS</span></div><div class="grid action-grid"><button class="card action-card" data-action="navigate" data-page="pay"><div class="action-icon">↗</div><h3>Help me decide</h3><p>Compare a few ways to use your money, with the trade-offs laid out.</p><span class="arrow">→</span></button><button class="card action-card" data-action="navigate" data-page="whatif"><div class="action-icon">⇄</div><h3>Test my plan</h3><p>Pay $60 toward a debt? Buy something? See what changes first.</p><span class="arrow">→</span></button></div><div class="section-label"><h2>A quick look at your obligations</h2><a href="#money" class="text-btn">View & edit →</a></div><section class="card">${state.debts.length?state.debts.map(d=>`<div class="stat-row"><span>${esc(d.name)}<br><small class="muted">${d.minimum?`${money(d.minimum)} due · ${date(d.due)}`:'No payment amount entered'} · ${d.apr===null?'APR unknown':d.apr+'% APR'}</small></span><b>${money(d.balance)}</b></div>`).join(''):'<p class="muted">No debts added. You can still explore purchases and savings.</p>'}</section>`;}
function warningHome(){const r=simulateItems(state,[]);$('home-warnings').innerHTML=warningHTML(r)+commitmentForecast(r);}

let payItems=[],whatItems=[],transferredPlan=null;
function newItem(type='purchase'){return {id:crypto.randomUUID(),type,name:'',amount:0,debtId:state.debts.find(d=>d.balance>0)?.id||'',inEssentials:false};}
function itemsFor(prefix){return prefix==='p'?payItems:whatItems;}
function syncItems(prefix){const list=itemsFor(prefix);for(let i=0;i<list.length;i++){const x=list[i];x.type=$(prefix+'-type-'+i).value;x.billId=$(prefix+'-bill-'+i)?.value||x.billId||(state.bills||[]).find(b=>b.active)?.id||'';x.amount=cents($(prefix+'-amount-'+i).value);x.debtId=$(prefix+'-target-'+i)?.value||x.debtId||state.debts.find(d=>d.balance>0)?.id||'';x.name=x.type==='recurring'?((state.bills||[]).find(b=>b.id===x.billId)?.name||'Bill'):x.type==='debt'?(state.debts.find(d=>d.id===x.debtId)?.name||'Debt'):($(prefix+'-name-'+i)?.value.trim()||({purchase:'Purchase',bill:'Bill',protect:'Savings',income:'Extra income'})[x.type]);x.inEssentials=['purchase','bill'].includes(x.type)&&!!$(prefix+'-covered-'+i)?.checked;}}
function renderItems(prefix){pending=null;if($('pay-results'))$('pay-results').innerHTML='';if($('plan-review'))$('plan-review').innerHTML='';if($('whatif-results'))$('whatif-results').innerHTML='';const list=itemsFor(prefix),isPay=prefix==='p';$(prefix+'-items').innerHTML=list.map((x,i)=>`<div class="item-entry"><div class="result-heading"><h3>Item ${i+1}</h3><button type="button" class="text-btn" data-action="remove-item" data-prefix="${prefix}" data-index="${i}">Remove</button></div><div class="form-grid">${select(prefix+'-type-'+i,'Type',[['debt','Debt payment'],['bill','One-time bill / expense'],['recurring','Saved recurring bill'],['purchase','Purchase'],['protect','Add to savings'],...(!isPay?[['income','Extra income']]:[])],x.type)}${x.type==='recurring'?select(prefix+'-bill-'+i,'Which bill?',(state.bills||[]).filter(b=>b.active).map(b=>[b.id,b.name]),x.billId):x.type==='debt'?select(prefix+'-target-'+i,'Which debt?',state.debts.filter(d=>d.balance>0).map(d=>[d.id,d.name]),x.debtId):field(prefix+'-name-'+i,'Name',x.name,'text','For example: groceries, rent, birthday gift','maxlength="60"')}${field(prefix+'-amount-'+i,isPay?'Up to this amount':'Amount',value(x.amount),'number',isPay?'The most you want allocated to this item in each option.':'This amount will be included in your combined plan.','required')}</div>${['bill','purchase'].includes(x.type)?`<label class="check below"><input id="${prefix}-covered-${i}" type="checkbox" ${x.inEssentials?'checked':''}>Already included in my essentials</label><p class="disclosure">If checked, paying this expense reduces the remaining essentials by the same amount so it is not counted twice.</p>`:''}</div>`).join('')||'<p class="muted">Add at least one item to start a comparison.</p>';if(isPay){const goalItem=list.find(x=>state.goal?.type==='savings'?x.type==='protect':state.goal?.type==='debt'&&x.debtId===state.goal.debtId);const previous=$('priority')?.value??goalItem?.id??state.priority;const fieldHTML=select('priority','Which item matters most to you?',[["",'No particular preference'],...list.map(x=>[x.id,x.name||({debt:'Debt',purchase:'Purchase',bill:'Bill',protect:'Savings'})[x.type]])],previous);$('priority-field').innerHTML=fieldHTML;}}
function payView(){options=[];pending=null;payItems=[...state.debts.filter(d=>d.balance>0).map(d=>({id:d.id,type:'debt',name:d.name,amount:d.balance,debtId:d.id,inEssentials:false})),...(state.bills||[]).filter(b=>b.active).map(b=>({id:'bill-'+b.id,type:'recurring',billId:b.id,name:b.name,amount:b.amount-(b.paid||0),inEssentials:b.inEssentials}))];return heading('Help me decide','Include debts, bills, purchases, and savings. Compare ways to split one amount.')+`<form id="pay-form" class="card"><div class="compare-controls">${field('budget','Total amount to compare',state.demo?'60':'','number','Every option uses the same total amount.','required')}<div id="priority-field"></div></div><div id="p-items" class="below"></div><button type="button" class="secondary" data-action="add-item" data-prefix="p">+ Add another item</button>${protectedControl('p')}<div class="buttons below"><button class="primary" type="submit">Compare ways to use this money ↗</button><button class="secondary" type="button" data-action="pay-exact">Compare my exact amounts</button></div><div id="pay-error" class="error" role="alert"></div></form><div id="pay-results"></div><div id="plan-review" class="below"></div>`;}
function itemsHTML(items){return items.filter(x=>x.amount>0).map(x=>`${money(x.amount)} → ${esc(x.name||x.type)}${x.type==='income'?' (income received in this scenario)':''}`).join('<br>')||'No changes';}
function itemResultsTable(plans){const rows=[...(state.goal&&!goalProgress(state).unavailable?[['Remaining to reach goal',r=>goalProgress(state,r).remaining]]:[]),['Spendable money',r=>r.cash],['Essentials still to cover',r=>r.essentials],['Cash after essentials',r=>r.cash-r.essentials],['Protected savings',r=>r.savings],['Additional commitments still to cover',r=>r.due],...state.debts.map(d=>[esc(d.name)+' balance',r=>r.balances.find(x=>x.id===d.id).balance])];return `<div style="overflow:auto"><table class="scenario-table"><thead><tr><th scope="col">What changes</th>${plans.map(p=>`<th scope="col">${esc(p.title)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label,fn])=>`<tr><td>${label}</td>${plans.map(p=>`<td class="${fn(p.result)<0?'negative':''}">${money(fn(p.result))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function itemTrade(plan){const r=plan.result,unpaid=state.debts.filter(d=>dueBeforeIncome(state,d)&&d.minimum>(r.allocations[d.id]||0));return unpaid.length?unpaid.map(d=>`${money(d.minimum-(r.allocations[d.id]||0))} still due to ${esc(d.name)} by ${date(d.due)}`).join('; ')+'.':r.protectedAdded?'Adding to savings keeps money yours, but leaves less available cash available.':r.spending?'The purchases and bills use cash; only debt payments reduce your debt balances.':'No entered dated minimum remains due before income in this plan.';}
function comparePayments(){try{syncItems('p');state.priority=$('priority').value;const budget=cents($('budget').value);options=itemOptions(state,payItems,budget,release('p'),state.priority);save();pending=null;$('pay-error').textContent='';$('plan-review').innerHTML='';if(!options.length){$('pay-results').innerHTML='<div class="note below">No amount is available to allocate. Add items with positive limits and check your available cash.</div>';return;}
const actual=options[0].result.total;$('pay-results').innerHTML=`<div class="section-label"><h2>${options.length} ways to use ${money(actual)}</h2><span class="label">PREVIEW ONLY</span></div><div class="note">Each option allocates the same ${money(actual)} across the items you included. ${actual<budget?'The requested budget was reduced to available cash or total item limits.':''} ${options.length<3?'Only '+options.length+' distinct plan'+(options.length===1?' is':'s are')+' possible for these amounts.':''}</div><div class="options">${options.map((o,i)=>`<section class="card option-card"><span class="pill">OPTION ${i+1}</span><h3>${esc(o.title)}</h3><p class="summary">${esc(o.description)}</p><div class="plan-money">${money(o.result.total)}</div><div class="allocation">${itemsHTML(o.items)}</div>${stat('Spendable money after',o.result.cash)}${stat('Cash after essentials',o.result.cash-o.result.essentials)}${stat('Protected savings',o.result.savings)}${goalSummary(o.result)}<p class="trade"><b>Trade-off:</b> ${itemTrade(o)}</p>${warningHTML(o.result)}${commitmentForecast(o.result)}<button class="primary" data-action="review" data-index="${i}">Review this plan →</button></section>`).join('')}</div><section class="card below"><h2>Compare the full picture</h2>${itemResultsTable(options.map((p,i)=>({...p,title:'Option '+(i+1)})))}<p class="disclosure">Only items allocated in each plan change these previews. Unpaid bills remain separate. Expenses marked as already included reduce remaining essentials when paid.</p></section>`;}catch(e){$('pay-error').textContent=e.message;}}
function exactPay(){try{syncItems('p');const items=payItems.filter(x=>x.amount>0),r=simulateItems(state,items,release('p'));if(r.total>cents($('budget').value))throw new Error('Your exact item amounts exceed the total budget. Lower the item amounts or increase the budget.');options=[{title:'My exact amounts',items,result:r}];$('pay-error').textContent='';review(0);}catch(e){$('pay-error').textContent=e.message;}}
function review(index){const o=options[index];if(!o)return;pending={items:o.items,release:o.result.release,label:o.title};const r=simulateItems(state,o.items,pending.release);$('plan-review').innerHTML=`<section class="card"><div class="result-heading"><h2>After this combined plan</h2><span class="pill">SIMULATION ONLY</span></div><p>${itemsHTML(o.items)}</p>${stat('Spendable money',r.cash)}${stat('Cash after essentials',r.cash-r.essentials)}${stat('Protected savings',r.savings)}${stat('Additional commitments still to cover',r.due)}${goalSummary(r)}${warningHTML(r)}${commitmentForecast(r)}<p class="muted">Reviewing this plan does not change your numbers. Record it only after completing the actions yourself.</p><div class="buttons"><button class="secondary" data-action="edit-plan">Edit in Test my plan</button><button class="secondary" data-action="save-plan">Save as a plan</button>${r.cash>=0&&r.total>0?'<button class="primary" data-action="record-dialog">I completed these actions</button>':''}</div></section>`;$('plan-review').scrollIntoView({behavior:'smooth',block:'start'});}
function whatifView(){pending=null;const first=newItem(state.debts.some(d=>d.balance>0)?'debt':'purchase');first.amount=state.demo?6000:0;whatItems=transferredPlan?.items || [first];return heading('Test my plan','Combine several actions and see their overall effect.')+`<form id="whatif-form" class="card"><div id="w-items"></div><button class="secondary" type="button" data-action="add-item" data-prefix="w">+ Add another item</button>${protectedControl('w')}<button class="primary below" type="submit">Show the combined effect ⇄</button><div id="whatif-error" class="error" role="alert"></div></form><div id="whatif-results" class="below"></div>`;}
function runScenario(){try{syncItems('w');const items=whatItems.filter(x=>x.amount>0);if(!items.length)throw new Error('Add at least one item with an amount greater than zero.');const released=release('w'),full=simulateItems(state,items,released),halfItems=items.map(x=>({...x,amount:Math.round(x.amount/2)}));const plans=[{title:'No changes',items:[],result:simulateItems(state,[])},{title:'Half of each amount',items:halfItems,result:simulateItems(state,halfItems,released)},{title:'Your full plan',items,result:full}];pending={items,release:released,label:'What if: combined plan'};$('whatif-error').textContent='';$('whatif-results').innerHTML=`<section class="card"><div class="result-heading"><h2>Your combined plan</h2><span class="pill">SIMULATION ONLY</span></div><p>${itemsHTML(items)}</p>${itemResultsTable(plans)}${goalSummary(full)}<div class="note below"><b>Overall effect:</b> ${money(full.total)} leaves available cash for payments, expenses, and savings transfers${full.received?'; '+money(full.received)+' of hypothetical extra income is added':''}. ${money(full.cash)} cash remains, with ${money(full.essentials)} in essentials still to cover.</div>${warningHTML(full)}${commitmentForecast(full)}<p class="disclosure">Nothing has changed in your actual balances. “Half” uses half of each entered action.${released?' Both changed scenarios include your selected '+money(released)+' from protected savings; the baseline uses none.':''} Extra income is hypothetical unless you explicitly record receiving it.</p><div class="buttons below"><button class="secondary" data-action="save-plan">Save this combined plan</button>${full.cash>=0?'<button class="primary" data-action="record-dialog">I completed these actions</button>':''}</div></section>`;}catch(e){$('whatif-error').textContent=e.message;$('whatif-results').innerHTML='';pending=null;}}
let draftDebts=[];
function moneyView(){draftDebts=structuredClone(state.debts);return heading('Your money, in one place.','Update the facts. The comparisons will follow.')+`<form id="money-form"><section class="card form-card"><h2>Money available today</h2><div class="form-grid">${field('cash','Money available now',value(state.cash),'number','Include money in your checking account, spending apps, and physical cash. Exclude protected savings and available credit.','required')}${field('savings','Protected savings',value(state.savings),'number','Kept out of payment options unless you choose to include some.','required')}</div></section><section class="card form-card"><h2>Before your next income</h2><div class="form-grid">${field('essentials','Everyday essentials still to cover',value(state.essentials),'number','Estimate groceries, transport and other everyday needs until your next income (or the next 30 days). Exclude bills entered separately in Bills & subscriptions and debts below.','required')}${field('payday','When do you next expect to receive money?',state.payday,'date','Optional. Helps highlight payments due before then. If unknown, comparisons look at the next 30 days.')}</div></section><section class="card form-card"><div class="result-heading"><h2>Debts & payment commitments</h2><button type="button" class="secondary" data-action="add-debt">+ Add debt</button></div><p class="disclosure">“Payment due” means the remaining minimum or agreed installment for the current cycle. Use the actual due date; an unknown date is not treated as proof that nothing is due.</p><div id="debt-fields"></div></section><section class="card form-card"><h2>What matters to you?</h2><div class="field"><label for="preferences">Your priorities (optional)</label><textarea id="preferences" maxlength="1200" rows="3" placeholder="For example: paying my friend first matters to me; keep a cushion for groceries.">${esc(state.preferences||'')}</textarea><small>Used to guide AI suggestions. Protected savings still require explicit permission.</small></div></section><div id="money-error" class="error" role="alert"></div><div class="buttons below"><button class="primary" type="submit">Save my numbers →</button><button class="secondary" type="button" data-action="clear">Start with empty numbers</button><button class="text-btn" type="button" data-action="demo">Reload fictional example</button></div><p class="disclosure">Data is stored in this browser on this device. Clear it when using a shared device. Editing numbers clears the previous undo snapshot.</p></form>`;}
const debtTypes=['Credit card','School / tuition','Medical','Someone I know','Auto loan','Other'];
function renderDebtFields(){ $('debt-fields').innerHTML=draftDebts.length?draftDebts.map((d,i)=>`<div class="debt-entry"><div class="debt-grid">${field('dn-'+i,'Name',d.name,'text','','required maxlength="60"')}${select('dt-'+i,'Type',debtTypes.map(x=>[x,x]),d.type)}${field('db-'+i,'Balance',value(d.balance),'number','','required')}${field('da-'+i,'APR (%)',d.apr===null?'':d.apr,'number','Blank = unknown','max="1000"')}${field('dm-'+i,'Payment due',value(d.minimum),'number','','required')}${field('dd-'+i,'Due date',d.due,'date')}</div><div class="buttons"><button type="button" class="text-btn" data-action="remove-debt" data-index="${i}">Remove debt</button></div></div>`).join(''):'<p class="muted">No debts added. That’s fine — you can still explore purchases and savings.</p>';}
function syncDraft(){draftDebts=draftDebts.map((d,i)=>({...d,name:$('dn-'+i).value.trim(),type:$('dt-'+i).value,balance:cents($('db-'+i).value),apr:$('da-'+i).value===''?null:Number($('da-'+i).value),minimum:cents($('dm-'+i).value),due:$('dd-'+i).value}));}
function saveMoney(){try{syncDraft();const next={...state,demo:false,cash:cents($('cash').value),savings:cents($('savings').value),essentials:cents($('essentials').value),income:state.income||0,payday:$('payday').value,asof:today(),preferences:$('preferences').value.trim(),debts:draftDebts};cleanState(next);state=next;undo=null;pending=null;save();location.hash='home';toast('Your numbers are saved.');}catch(e){$('money-error').textContent=e.message;}}
function historyView(){return heading('Your decisions, kept separate.','Saved plans are previews. Recorded payments change your numbers.')+`<section class="card"><div class="buttons">${undo?'<button class="secondary" data-action="undo">Undo last confirmed update</button>':''}</div>${history.length?history.slice().reverse().map(h=>`<div class="history-entry"><span class="pill">${h.kind==='payment'?'RECORDED ACTIONS':h.kind==='undo'?'UNDONE':h.kind==='facts'?'CONFIRMED UPDATE':'SAVED PLAN'}</span><p><b>${esc(h.label)}</b> · ${money(h.total)}</p><p class="muted">${esc(h.description)}</p><small class="muted">${new Date(h.at).toLocaleString()}</small></div>`).join(''):'<div class="empty"><div class="welcome-spark">✳</div><h2>Nothing recorded yet.</h2><p class="muted">Explore a comparison, then save a plan or record a payment you’ve made.</p><a href="#whatif" class="text-btn">Try a what-if →</a></div>'}</section>`;}
function addItemHistory(kind,plan,r){history.push({id:crypto.randomUUID(),kind,label:plan.label,total:r.total,description:plan.items.map(x=>money(x.amount)+' → '+x.name).join('; '),at:new Date().toISOString()});history=history.slice(-100);}
function addHistory(kind,label,total,a){history.push({id:crypto.randomUUID(),kind,label,total,description:Object.entries(a||{}).filter(([,n])=>n>0).map(([id,n])=>`${money(n)} toward ${state.debts.find(d=>d.id===id)?.name||'debt'}`).join('; ')||'Cash stays available',at:new Date().toISOString()});history=history.slice(-100);}
document.addEventListener('submit',e=>{const id=e.target.id;if(['pay-form','whatif-form','money-form'].includes(id)){e.preventDefault();({ 'pay-form':comparePayments,'whatif-form':runScenario,'money-form':saveMoney})[id]();}});
document.addEventListener('change',e=>{if(/^[pw]-type-/.test(e.target.id)){const prefix=e.target.id[0],index=Number(e.target.id.split('-').at(-1));syncItems(prefix);itemsFor(prefix)[index].name='';itemsFor(prefix)[index].inEssentials=false;renderItems(prefix);}if(/^[pw]-(target|bill)-/.test(e.target.id)){const prefix=e.target.id[0];syncItems(prefix);renderItems(prefix);}for(const prefix of ['p','w'])if(e.target.id===prefix+'-use')$(prefix+'-releasebox').classList.toggle('hidden',!e.target.checked);});
document.addEventListener('input',e=>{if(e.target.closest('#pay-form')||e.target.closest('#whatif-form')){pending=null;if($('pay-results'))$('pay-results').innerHTML='';if($('plan-review'))$('plan-review').innerHTML='';if($('whatif-results'))$('whatif-results').innerHTML='';}});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const action=btn.dataset.action;
if(action==='edit-plan'&&pending){transferredPlan=structuredClone(pending);location.hash='whatif';}
if(action==='navigate')location.hash=btn.dataset.page;
if(action==='review')review(Number(btn.dataset.index));
if(action==='pay-exact')exactPay();
if(action==='add-item'){const prefix=btn.dataset.prefix;syncItems(prefix);if(itemsFor(prefix).length>=20){toast('Use up to 20 items in a plan.');return;}itemsFor(prefix).push(newItem());renderItems(prefix);}
if(action==='remove-item'){const prefix=btn.dataset.prefix;syncItems(prefix);itemsFor(prefix).splice(Number(btn.dataset.index),1);renderItems(prefix);}
if(action==='add-debt'){syncDraft();if(draftDebts.length>=30){toast('This prototype supports up to 30 debts.');return;}draftDebts.push({id:crypto.randomUUID(),name:'',type:'Credit card',balance:0,apr:null,minimum:0,due:''});renderDebtFields();}
if(action==='remove-debt'){syncDraft();draftDebts.splice(Number(btn.dataset.index),1);renderDebtFields();}
if(action==='save-plan'&&pending){const r=simulateItems(state,pending.items,pending.release);addItemHistory('plan',pending,r);save();toast('Plan saved. Your balances have not changed.');}
if(action==='record-dialog'&&pending){const r=simulateItems(state,pending.items,pending.release);$('confirm-text').textContent=`Record these completed actions: ${pending.items.filter(x=>x.amount>0).map(x=>money(x.amount)+' → '+x.name).join('; ')}${pending.release?'; include '+money(pending.release)+' from protected savings':''}?`;$('confirm').showModal();}
if(action==='undo'&&undo){state=undo.state;conversation.eventNote('I undid the last confirmed action. Use the current financial snapshot.');const entry=history.find(h=>h.id===undo.entryId);if(entry)entry.kind='undo';undo=null;pending=null;save();render();toast('Last recorded actions undone.');}
if(action==='clear'){if(!window.confirm('Clear saved numbers and activity from this browser?'))return;state={version:2,demo:false,cash:0,savings:0,essentials:0,income:0,payday:'',asof:today(),priority:'',debts:[]};history=[];undo=null;pending=null;save();location.hash='money';render();toast('Start with your own numbers.');}
if(action==='demo'){if(!window.confirm('Replace current numbers and activity with the fictional example?'))return;state=demo();history=[];undo=null;pending=null;save();location.hash='home';render();toast('Fictional example loaded.');}
});
$('confirm').addEventListener('close',()=>{if($('confirm').returnValue!=='record'||!pending)return;try{const before=structuredClone(state);const r=simulateItems(state,pending.items,pending.release);const updated=recordItems(state,pending.items,pending.release);addItemHistory('payment',pending,r);undo={state:before,entryId:history.at(-1).id};state=updated;pending=null;save();location.hash='home';render();toast('Actions recorded. You can undo them in Activity.');}catch(e){toast(e.message);}});
window.addEventListener('hashchange',()=>{pending=null;render();window.scrollTo({top:0,behavior:'smooth'});});if(storageProblem)toast('Could not restore saved data. Enter your numbers or try the sample.');
// Blank starting figures and optional sample mode.
function blankStartState() {
  return {
    version: 2, demo: false, setupComplete: false,
    cash: 0, savings: 0, essentials: 0, income: 0,
    payday: '', asof: today(), priority: '', debts: [], bills: [], preferences: '', knownFields: []
  };
}

if (state.demo && state.setupComplete !== true) {
  state = blankStartState();
  history = [];
  undo = null;
} else if (state.setupComplete === undefined) {
  state.setupComplete = true;
}

const originalMoneyView = moneyView;
moneyView = function () {
  let html = originalMoneyView();
  if (!state.setupComplete) {
    for (const id of ['cash', 'savings', 'essentials']) {
      const pattern = new RegExp('(id="' + id + '"[^>]*value=")[^"]*(")');
      html = html.replace(pattern, '$1$2');
    }
    html = html.replace(
      'Update the facts. The comparisons will follow.',
      'Enter your numbers to begin. Enter 0 where you have none.'
    );
  }
  return html.replace('Reload fictional example', 'Try sample numbers');
};

const originalSaveMoney = saveMoney;
saveMoney = function () {
  if (!$('money-form').reportValidity()) return;
  for (const id of ['cash', 'savings', 'essentials']) {
    if (!$(id).value.trim()) {
      $('money-error').textContent =
        'Enter each money amount, including 0 where you have none.';
      return;
    }
  }
  const previous = state;
  originalSaveMoney();
  if (state !== previous) {
    state.setupComplete = true;
    state.knownFields = ['cash','savings','essentials'];
    save();
    render();
  }
};

const originalBanner = banner;
banner = function () {
  if (state.setupComplete) {
    originalBanner();
    return;
  }
  $('notice').innerHTML =
    '<div class="banner"><span>Start with your own numbers, or explore an example.</span>' +
    '<button class="text-btn" data-action="demo">Try sample numbers →</button></div>';
};

render = function () {
  const hash = location.hash.slice(1);
  const requested = !hash || hash === 'chat' ? 'pay' : hash;
  const page=['survey','chat','bills'].includes(requested)?requested:state.setupComplete?(requested==='compare'?'pay':requested):'money';
  const navPage=['pay','whatif'].includes(page)?'compare':page==='goal'?'money':page;
  document.querySelectorAll('[data-nav]').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === navPage);
    if (a.dataset.nav === navPage) a.setAttribute('aria-current', 'page');
       else a.removeAttribute('aria-current');
  });

  const introduction = document.getElementById('app-introduction');

  if (introduction) {
    introduction.hidden = !(
      page === 'home' ||
      (page === 'money' && !state.setupComplete)
    );
  }

  banner();
  const views = {
    home: homeView, pay: payView, whatif: whatifView,
    money: moneyView, history: historyView, survey: surveyView, goal: goalView, chat:()=>conversation.view(), bills:billsView
  };
  $('content').innerHTML = (['pay','whatif'].includes(page)?compareTabs(page):'') + (views[page] || homeView)();
  if(page==='home')$('content').insertAdjacentHTML('afterbegin',goalCard());
  if(page==='money'&&state.setupComplete)$('content').insertAdjacentHTML('afterbegin',goalCard());
  if (page === 'money') renderDebtFields();
  if (page === 'pay') renderItems('p');
  if (page === 'whatif') {renderItems('w');if(transferredPlan){$('w-use').checked=transferredPlan.release>0;$('w-release').value=value(transferredPlan.release);$('w-releasebox').classList.toggle('hidden',!transferredPlan.release);transferredPlan=null;}}
  if (page === 'home') warningHome();
  if (page === 'chat') conversation.mount();
};

document.addEventListener('click', function (event) {
  const button = event.target.closest('[data-action]');
  const action = button?.dataset.action;
  if (action !== 'demo' && action !== 'clear') return;
  event.preventDefault();
  event.stopImmediatePropagation();

  if (state.setupComplete && !window.confirm(
    action === 'demo'
      ? 'Replace your current numbers and activity with sample numbers?'
      : 'Clear your saved numbers and activity?'
  )) return;

  state = action === 'demo'
    ? { ...demo(), setupComplete: true }
    : blankStartState();
  conversation.reset();
  setupStep=0;localStorage.removeItem('can-i-setup-step');
  history = [];
  undo = null;
  pending = null;
  transferredPlan = null;
  options = [];
  save();
  location.hash = action === 'demo' ? 'home' : 'money';
  render();
}, true);


const SURVEY_URL='https://docs.google.com/forms/d/e/1FAIpQLSe2ZFteMkbCwX7_qDOCIOOIXC7pLbXEyfjGhdiOYiJ4vvqRxw/viewform';
function surveyView(){return heading('Help shape Can I?','Tell us what helped and what felt confusing.')+`<section class="card"><p>This feedback form is hosted by Google Forms. Your app balances are not sent to it. Please do not enter account details or personal financial information.</p><p><a class="text-btn" href="${SURVEY_URL}" target="_blank" rel="noopener noreferrer">Open survey in a new tab ↗</a> if it does not load below.</p><iframe class="survey-frame" title="Can I? feedback survey" src="${SURVEY_URL}?embedded=true" loading="lazy" referrerpolicy="no-referrer">Open the survey using the link above.</iframe></section>`;}
function compareTabs(page){return `<p><a class="text-btn" href="#pay">Need a starting point? Compare your options →</a></p><section class="compare-intro"><h2>Compare choices</h2><p>Choose how you want to explore. Neither mode moves money.</p><nav class="mode-tabs" aria-label="Comparison mode"><a href="#pay" ${page==='pay'?'aria-current="page"':''}>Help me decide <small>What should I pay?</small></a><a href="#whatif" ${page==='whatif'?'aria-current="page"':''}>Test my plan <small>What if?</small></a></nav>${goalSummary()}</section>`;}
function goalName(){const g=state.goal;return !g?'':g.type==='savings'?`Save an additional ${money(g.target)}`:`Pay ${money(g.target)} toward ${state.debts.find(d=>d.id===g.debtId)?.name||'a removed debt'}`;}
function goalSummary(result=null){const g=state.goal,p=goalProgress(state,result,today());if(!g)return '';if(p.unavailable)return '<div class="note below">Your goal’s debt was removed. <a href="#goal">Choose a new goal</a>.</div>';const current=goalProgress(state,null,today()),change=p.net-current.net;return `<div class="note below"><b>${esc(goalName())}</b> by ${date(g.deadline)}<p>${money(p.remaining)} ${result?'would remain':'remaining'} to reach your goal.${result?` This choice ${change<0?'moves you back by':change>0?'moves you closer by':'changes progress by'} ${money(Math.abs(change))}.`:''}</p><progress aria-label="Goal progress" max="100" value="${p.percent}"></progress><p class="disclosure">${p.remaining===0?'Target reached.':p.weekly!==null?`${money(p.weekly)} per week needed over the remaining ${p.days} days. This is a target pace, not a prediction of what you can afford.`:'The target date has arrived or passed. Update your goal when ready.'}</p></div>`;}
function goalCard(){return `<section class="card goal-card"><div class="result-heading"><h2>My goal <small class="muted">Optional</small></h2><a class="text-btn" href="#goal">${state.goal?'Edit goal':'Set a goal'} →</a></div>${state.goal?goalSummary():'<p>Save for something or pay down a debt. See how each choice affects your progress.</p>'}</section>`;}
function goalView(){const g=state.goal;return heading('One goal to work toward.','Optional. You can compare choices without setting a goal.')+`<form id="goal-form" class="card">${g?goalSummary():''}<p>Saving tracks the net increase in your total protected savings from when you set the goal. Debt progress tracks the reduction in the selected debt balance. Editing your balances also updates progress.</p><div class="form-grid">${select('goal-type','I want to',[['savings','Save more money'],['debt','Pay down a debt']],g?.type||'savings')}${field('goal-target','Additional amount to save or pay down',g?value(g.target):'','number','USD. Existing savings do not count toward this additional amount.','required')}${field('goal-deadline','Target date',g?.deadline||'','date','','required min="'+today()+'"')}<div id="goal-debt-field" ${g?.type==='debt'?'':'hidden'}>${select('goal-debt','Debt to pay down',state.debts.filter(d=>d.balance>0).map(d=>[d.id,d.name]),g?.debtId||'')}</div></div><p class="disclosure">Saving a new or edited goal starts tracking from today’s balances. This does not set aside or move money. In Help me decide, include a savings item or the relevant debt to compare progress.</p><div id="goal-error" class="error" role="alert"></div><div class="buttons below"><button class="primary">${g?'Replace goal and restart progress':'Save goal'}</button>${g?'<button type="button" class="secondary" data-action="remove-goal">Remove goal</button>':''}<a class="text-btn" href="#home">Back to overview</a></div></form>`;}
document.addEventListener('change',e=>{if(e.target.id==='goal-type'&&$('goal-debt-field'))$('goal-debt-field').hidden=e.target.value!=='debt';});
document.addEventListener('submit',e=>{if(e.target.id!=='goal-form')return;e.preventDefault();try{state.goal=createGoal(state,{type:$('goal-type').value,target:cents($('goal-target').value),deadline:$('goal-deadline').value,debtId:''},today());undo=null;pending=null;save();if(!setupActive)location.hash='home';else render();toast('Goal saved. Your balances have not changed.');}catch(error){$('goal-error').textContent=error.message;}});
document.addEventListener('click',e=>{if(e.target.closest('[data-action="remove-goal"]')){delete state.goal;undo=null;pending=null;save();render();toast('Goal removed. Your balances have not changed.');}});


state.bills??=[];
state.preferences??='';
state.knownFields??=state.setupComplete?['cash','savings','essentials']:[];
const conversation={eventNote(){},reset(){}};
let editingBillId=null;
function billsView(){const b=(state.bills||[]).find(x=>x.id===editingBillId);let forecast;try{forecast=billSchedule(state);}catch(e){forecast={rows:[],end:'',assumed:true,error:e.message};}return heading('Bills & subscriptions','Keep track of what renews, how much, and when.')+`<section class="card form-card"><p>Adding a bill does not deduct money. It helps comparisons show what is coming up. If it is already included in your essentials estimate, tick the box below to count it once.</p>${forecast.error?`<div class="warn">${esc(forecast.error)}</div>`:''}${stat('Scheduled bills through '+date(forecast.end),forecast.rows.reduce((t,x)=>t+x.amount,0))}<p class="disclosure">${forecast.assumed?'Using a 30-day window. Set your optional next income date in My money to change it.':''} Past dates are kept until you record or update them; check for payments you may already have made.</p></section><form id="bill-form" class="card"><h2>${b?'Edit bill':'Add a bill'}</h2><div class="form-grid">${field('bill-name','Name',b?.name||'','text','For example: rent, phone, Spotify','required maxlength="60"')}${field('bill-amount','Amount',b?value(b.amount):'','number','','required')}${field('bill-date','Next unpaid due / renewal date',b?.nextDue||'','date','','required')}${select('bill-frequency','Frequency',frequencies.map(x=>[x,({once:'One time',weekly:'Weekly',fortnightly:'Every two weeks',monthly:'Monthly',yearly:'Yearly'})[x]]),b?.frequency||'monthly')}</div><label class="check below"><input id="bill-auto" type="checkbox" ${b?.autoRenew?'checked':''}>Renews or is paid automatically</label><label class="check below"><input id="bill-included" type="checkbox" ${b?.inEssentials?'checked':''}>Already included in my essentials estimate for this planning window</label><div id="bill-error" class="error" role="alert"></div><div class="buttons below"><button class="primary">${b?'Save changes':'Add bill'}</button>${b?'<button type="button" class="text-btn" data-action="cancel-bill">Cancel edit</button>':''}</div></form><div class="stack below">${(state.bills||[]).map(x=>`<section class="card"><div class="result-heading"><h3>${esc(x.name)}</h3><span class="pill">${x.active?'ACTIVE':'INACTIVE'}</span></div>${stat(x.frequency+' amount',x.amount)}<p>Next unpaid: ${date(x.nextDue)} · ${x.autoRenew?'Automatic renewal':'Manual payment'}${x.paid?'<br>'+money(x.paid)+' already recorded for this occurrence':''}</p><p class="disclosure">${x.inEssentials?'Included in your essentials estimate.':'Listed separately from your essentials.'}</p><div class="buttons"><button class="secondary" data-action="edit-bill" data-id="${esc(x.id)}">Edit</button><button class="text-btn" data-action="toggle-bill" data-id="${esc(x.id)}">${x.active?'Stop including':'Include again'}</button>${x.active&&state.setupComplete?`<button class="text-btn" data-action="record-bill" data-id="${esc(x.id)}">Record payment</button>`:''}</div><p class="disclosure">Stopping inclusion here does not cancel the subscription with its provider.</p></section>`).join('')}</div>`;}
document.addEventListener('submit',e=>{if(e.target.id!=='bill-form')return;e.preventDefault();try{const old=state.bills.find(x=>x.id===editingBillId),nextDue=$('bill-date').value;const bill=cleanBill({id:old?.id||crypto.randomUUID(),name:$('bill-name').value.trim(),amount:cents($('bill-amount').value),nextDue,frequency:$('bill-frequency').value,autoRenew:$('bill-auto').checked,inEssentials:$('bill-included').checked,paid:old?.nextDue===nextDue?old.paid:0,active:old?.active??true,anchorDay:old?.nextDue===nextDue?old.anchorDay:undefined,anchorMonth:old?.nextDue===nextDue?old.anchorMonth:undefined});const next={...state,bills:old?state.bills.map(x=>x.id===old.id?bill:x):[...state.bills,bill]};cleanState(next);state=next;undo=null;pending=null;editingBillId=null;save();render();toast('Bill saved. Your balance has not changed.');}catch(error){$('bill-error').textContent=error.message;}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const x=state.bills.find(x=>x.id===b.dataset.id);if(b.dataset.action==='edit-bill'){editingBillId=x?.id;render();}if(b.dataset.action==='cancel-bill'){editingBillId=null;render();}if(b.dataset.action==='toggle-bill'&&x){x.active=!x.active;undo=null;pending=null;save();render();}if(b.dataset.action==='record-bill'&&x){pending={label:'Paid '+x.name,items:[{type:'recurring',billId:x.id,name:x.name,amount:x.amount-x.paid}],release:0};$('confirm-text').textContent='Record '+money(x.amount-x.paid)+' paid to '+x.name+'? Only record this if it is not already reflected in your balance. The next renewal will advance one cycle.';$('confirm').showModal();}});


// Guided, local-only experience. No AI endpoint is called.
let setupStep=Number(localStorage.getItem('can-i-setup-step')||0);
if(!Number.isInteger(setupStep)||setupStep<0||setupStep>5)setupStep=0;
let setupActive=!state.setupComplete;
const steps=['Your money','Essentials','Bills','Debts','Goal','Review'];
function stepButtons(){return `<div class="buttons below"><button class="secondary" data-action="setup-back" ${setupStep===0?'disabled':''}>Back</button><button class="primary" data-action="setup-next">${setupStep===5?'Finish & compare choices':setupStep===4&&!state.goal?'Skip goal & review':'Save & next →'}</button></div><p class="disclosure">Saved in this browser. You can change these details later.</p>`;}
function basicMoney(){return heading('Your money','Two separate amounts. Count each dollar only once.')+`<form id="guided-money" class="card"><div class="form-grid">${field('cash','Spendable money',state.knownFields.includes('cash')?value(state.cash):'','number','Bank balances and cash, excluding protected savings. Bills and essentials still come from this.','required')}${field('savings','Protected savings',state.knownFields.includes('savings')?value(state.savings):'','number','Money you want to leave untouched. Enter 0 if you have none.','required')}</div><div id="guided-error" class="error" role="alert"></div>${setupActive?'':'<button class="primary below">Save & continue →</button>'}</form>`;}
function essentialsView(){return heading('What needs to last?','Set aside room for everyday needs before comparing choices.')+`<form id="guided-essentials" class="card">${field('essentials','Essentials still to cover',state.knownFields.includes('essentials')?value(state.essentials):'','number','Estimate food, transport, and other everyday needs. Exclude debts and bills you will enter separately. Enter 0 if none.','required')}${field('payday','Next income date (optional)',state.payday,'date','Only sets the planning window; future income is never added to your balance. Leave blank to use 30 days.')}<div id="guided-error" class="error" role="alert"></div>${setupActive?'':'<button class="primary below">Save & continue to bills →</button>'}</form>`;}
function debtsView(){draftDebts=structuredClone(state.debts);return heading('Debts','Add only what you owe. Unknown APRs and due dates can be left blank.')+`<form id="guided-debts" class="card"><div id="debt-fields"></div><button type="button" class="secondary" data-action="add-debt">+ Add debt</button><p class="disclosure">Payment due is the remaining minimum or agreed installment, not the full balance. Missing due dates are treated cautiously in comparisons.</p><div id="guided-error" class="error" role="alert"></div>${setupActive?'':'<button class="primary below">Save debts</button>'}</form>`;}
const oldBillsView=billsView;
billsView=function(){return `<nav class="mode-tabs" aria-label="Bills and debts"><a href="#bills" aria-current="page">Bills & subscriptions</a><a href="#debts">Debts</a></nav>`+oldBillsView();};
function reviewSetup(){return heading('Ready to explore?','Review your numbers. Nothing has been paid or transferred.')+`<section class="card">${stat('Spendable money',state.cash)}${stat('Protected savings',state.savings)}${stat('Essentials still to cover',state.essentials)}<p>${state.bills.length} bills · ${state.debts.length} debts</p><p>${state.goal?esc(goalName()):'No goal selected. You can add one later.'}</p><p>Use Back to make changes, or finish to compare choices.</p></section>`;}
function playView(){return heading('Can I Play?','One semester. A starting balance. Your decisions.')+`<section class="card"><span class="pill">COMING SOON</span><h2>Make your money last through the semester.</h2><p>Start with fictional money, navigate realistic student-life choices, and handle unexpected expenses. See how your choices affect your money throughout the semester.</p><p>Practice, explore the consequences, and try a different path. No real money involved.</p><a class="secondary" href="#survey">Tell us what you’d like to play →</a></section>`;}
function saveGuided(){const form=$('guided-money')||$('guided-essentials')||$('guided-debts');if(!form)return true;if(!form.reportValidity())return false;try{const next=structuredClone(state);if(form.id==='guided-money'){next.cash=cents($('cash').value);next.savings=cents($('savings').value);next.knownFields=[...new Set([...next.knownFields,'cash','savings'])];}if(form.id==='guided-essentials'){next.essentials=cents($('essentials').value);next.payday=$('payday').value;next.knownFields=[...new Set([...next.knownFields,'essentials'])];}if(form.id==='guided-debts'){syncDraft();next.debts=structuredClone(draftDebts);}cleanState(next);state=next;state.demo=false;undo=null;pending=null;save();return true;}catch(e){$('guided-error').textContent=e.message;return false;}}
function setupView(){const v=[basicMoney,essentialsView,()=>oldBillsView(),debtsView,goalView,reviewSetup];return `<section class="setup-progress" aria-label="Setup progress"><p>Step ${setupStep+1} of 6 · ${steps[setupStep]}</p><progress max="6" value="${setupStep+1}"></progress></section>`+v[setupStep]()+stepButtons();}
compareTabs=function(page){return `<section class="compare-intro"><h2>Compare choices</h2><p>Explore a suggestion or test your own plan. Neither mode moves money.</p><nav class="mode-tabs" aria-label="Comparison mode"><a href="#pay" ${page==='pay'?'aria-current="page"':''}>Help me decide</a><a href="#whatif" ${page==='whatif'?'aria-current="page"':''}>Test my plan</a></nav>${goalSummary()}</section>`;};
render=function(){let page=location.hash.slice(1)||'home';if(page==='chat'||page==='compare')page='pay';if(!state.setupComplete&&!['survey','play'].includes(page)){page='setup';setupActive=true;}else if(page!=='setup')setupActive=false;
const navPage=['pay','whatif'].includes(page)?'compare':['debts','bills'].includes(page)?'bills':['setup','essentials','goal'].includes(page)?'money':page;
document.querySelectorAll('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===navPage);if(a.dataset.nav===navPage)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
$('app-introduction').hidden=!(page==='home'||page==='setup'&&setupStep===0);banner();
const views={home:homeView,money:basicMoney,essentials:essentialsView,bills:billsView,debts:debtsView,goal:goalView,setup:setupView,pay:payView,whatif:whatifView,history:historyView,survey:surveyView,play:playView};
$('content').innerHTML=(['pay','whatif'].includes(page)?compareTabs(page):'')+(views[page]||homeView)();
if(page==='money')$('content').insertAdjacentHTML('beforeend','<p><a href="#essentials">Edit essentials & planning window →</a></p>'+goalCard());
if(page==='home'){$('content').insertAdjacentHTML('afterbegin',goalCard());warningHome();}
if(page==='debts')$('content').insertAdjacentHTML('afterbegin','<nav class="mode-tabs"><a href="#bills">Bills & subscriptions</a><a href="#debts" aria-current="page">Debts</a></nav>');
if($('debt-fields'))renderDebtFields();if(page==='pay')renderItems('p');if(page==='whatif'){renderItems('w');if(transferredPlan){$('w-use').checked=transferredPlan.release>0;$('w-release').value=value(transferredPlan.release);$('w-releasebox').classList.toggle('hidden',!transferredPlan.release);transferredPlan=null;}}
};
// Recommend only among feasible plans and explain the rule, without guessing missing facts.
const originalComparePayments=comparePayments;
comparePayments=function(){originalComparePayments();if(!options.length||$('pay-error').textContent)return;const feasible=options.filter(p=>p.result.room>=0&&p.result.cash>=p.result.essentials);let message;
if(!feasible.length){message='None of these plans leaves enough to cover all entered essentials and commitments in the planning window. Consider reducing the amount, postponing a purchase, or editing your entries before choosing.';}else{const priority=$('priority').value;const score=p=>priority?(p.items.find(x=>x.id===priority)?.amount||0):state.goal?-goalProgress(state,p.result).remaining:-(p.result.debtDue+p.result.billDue);const best=feasible.reduce((a,b)=>score(b)>score(a)?b:a);message=`A starting point: ${best.title}. Among these options, it ${priority?'puts the most toward your selected priority':state.goal?'makes the most progress toward your entered goal':'leaves the least in entered debt and bill payments still due'}, while leaving enough for entered essentials and commitments. Equally ranked options may suit you too.`;}
if(state.debts.some(d=>!d.due||d.apr===null))message+=' Some debt dates or interest rates are missing; check them before acting.';
$('pay-results').insertAdjacentHTML('afterbegin',`<section class="card below" aria-live="polite"><h2>Your next step</h2><p>${esc(message)}</p><small>Based on your entries and fixed comparison rules. Future interest, fees, and unentered expenses are not projected.</small></section>`);};
const basePayView=payView;payView=function(){const html=basePayView();if(state.goal?.type==='savings')payItems.push({id:'goal-savings',type:'protect',name:'Savings goal',amount:goalProgress(state).remaining,inEssentials:false});return html;};
document.addEventListener('submit',e=>{if(e.target.id.startsWith('guided-')){e.preventDefault();if(saveGuided()){toast('Saved. Your money has not moved.');if(!setupActive){location.hash=e.target.id==='guided-money'?'essentials':e.target.id==='guided-essentials'?'bills':'home';render();}}}});
document.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(!['setup-back','setup-next'].includes(action))return;if(!saveGuided())return;
if(action==='setup-next'&&setupStep===2&&$('bill-name').value.trim()){toast('Use Add bill to save this bill before continuing.');return;}
if(action==='setup-next'&&setupStep===4&&$('goal-target').value.trim()&&!state.goal){toast('Save your goal first, or clear its amount to skip.');return;}
if(action==='setup-next'&&setupStep===5){state.setupComplete=true;setupActive=false;setupStep=0;save();localStorage.removeItem('can-i-setup-step');location.hash='compare';render();return;}
setupStep=Math.max(0,Math.min(5,setupStep+(action==='setup-next'?1:-1)));localStorage.setItem('can-i-setup-step',setupStep);render();window.scrollTo({top:0});});
render();

// One comparison screen: paste at the END of app.mjs.
let comparisonAction = 'own';
let comparisonDraft = null;
const previousRender = render;
const previousWhatifView = whatifView;

compareTabs = () => '';
whatifView = function () {
  previousWhatifView();
  comparisonAction = 'own';
  
  return heading('Compare choices', 'Try your own plan or ask for a suggested split. You stay in control.') + `
    <form id="whatif-form" class="card">
      <fieldset style="border:0;padding:0;margin:0 0 20px"><legend>How would you like to start?</legend>
        <div class="buttons below" role="group" aria-label="Choose how to compare">
          <button type="button" id="mode-suggest" class="secondary" data-choice-mode="suggest" aria-pressed="false">Suggest a split</button>
          <button type="button" id="mode-own" class="primary" data-choice-mode="own" aria-pressed="true">My own plan</button>
        </div>
      </fieldset>
      <p id="comparison-instruction"></p>
      <div id="split-budget-wrap" hidden>${field('split-budget', 'How much do you want to divide?', '', 'number', 'Use money you have now.')}</div>
      <div id="w-items" class="below"></div>
      <button class="secondary" type="button" data-action="add-item" data-prefix="w">+ Add another item</button>

      <div id="split-priority"></div>
      ${protectedControl('w')}
      <div class="buttons below">
        <button class="primary" type="submit" id="see-comparison">See comparison</button>
      </div>
      <div id="whatif-error" class="error" role="alert"></div>
    </form><div id="whatif-results" class="below"></div>`;
};

const previousRenderItems = renderItems;
renderItems = function (prefix) {
  previousRenderItems(prefix);
  if (prefix !== 'w' || !$('split-priority')) return;
  const selected = $('split-priority-choice')?.value || '';
  $('split-priority').innerHTML = select('split-priority-choice', 'What matters most? (optional)',
    [['', 'No preference'], ...whatItems.filter(x => x.type !== 'income').map(x => [x.id, x.name || x.type])], selected);
  updateComparisonLabels();
};

render = function () {
  const requested = location.hash.slice(1);
  if (state.setupComplete && ['compare', 'pay', 'chat'].includes(requested)) {
    window.history.replaceState(null, '', '#whatif');
  }
  previousRender();
  if ($('whatif-form')) {
    document.querySelectorAll('[data-nav="compare"]').forEach(a => a.setAttribute('aria-current', 'page'));
  }
};

document.addEventListener('submit', event => {
  if (event.target.id === 'whatif-form') comparisonAction = $('mode-suggest')?.getAttribute('aria-pressed') === 'true' ? 'suggest' : 'own';
}, true);

runScenario = function () {
  try {
    syncItems('w');
    comparisonDraft = structuredClone(whatItems);
    const items = whatItems.filter(x => x.amount > 0);
    if (!items.length) throw new Error('Add at least one item and an amount.');
    const released = release('w');
    const hasIncome = items.some(x => x.type === 'income');
    const own = {title: 'Your plan', items, result: simulateItems(state, items, released)};
    const baseline = {title: 'Keep things as they are', items: [], release: 0, result: simulateItems(state, [])};
    const priority = $('split-priority-choice').value;
    let plans;
    if (comparisonAction === 'suggest') {
      if (hasIncome) throw new Error('Extra income is a what-if amount. Choose My own plan to test it, or remove it before asking to split money you have now.');
      const budget = cents($('split-budget').value);
      if (budget <= 0) throw new Error('Enter how much you would like to split.');
      plans = itemOptions(state, items, budget, released, priority);
      if (!plans.length) throw new Error('No money can be split across these items. Check your amounts.');
    } else {
      plans = [own];
      if (!hasIncome && own.result.total > 0 && own.result.cash >= 0) {
        const limits = items.map(x => ({...x, amount:
          x.type === 'debt' ? Math.min(own.result.total, state.debts.find(d => d.id === x.debtId).balance) :
          x.type === 'recurring' ? Math.min(own.result.total, state.bills.find(b => b.id === x.billId).amount - (state.bills.find(b => b.id === x.billId).paid || 0)) :
          x.type === 'protect' ? own.result.total : x.amount}));
        const alternatives = itemOptions(state, limits, own.result.total, released, priority);
        const same = p => items.every(x => (p.items.find(y => y.id === x.id)?.amount || 0) === x.amount);
        plans.push(...alternatives.filter(p => !same(p)));
      }
    }
    options = plans;
    pending = null;
    $('whatif-error').textContent = '';
    const compared = [baseline, ...plans];
    $('whatif-results').innerHTML = `<section class="card"><h2>Here’s what would change</h2>
      <p>Just a preview. Nothing has been paid or moved.${hasIncome ? ' Extra income is included only as a possibility, not money you already have.' : ''}</p>
      ${itemResultsTable(compared)}
      <p>${comparisonAction === 'suggest' ? `Each suggested split uses ${money(plans[0].result.total)}. Any amount that cannot be allocated stays available.` : 'Your amounts are used exactly as entered. Alternatives may put more toward a debt or savings, but never increase a purchase above the amount you entered.'}</p>
      </section>` + plans.map((p, i) => `<section class="card below"><h3>${esc(p.title)}</h3>
        <p>${itemsHTML(p.items)}</p>${stat('Spendable money after', p.result.cash)}
        ${goalSummary(p.result)}${warningHTML(p.result)}${commitmentForecast(p.result)}
        <p>${p.result.room < 0 ? `This leaves a ${money(-p.result.room)} gap for entered essentials and payments. Consider changing the plan.` : 'This leaves enough for the essentials and payments you entered in the planning window.'}</p>
        <button type="button" class="secondary" data-action="unified-review" data-index="${i}">Review this plan</button></section>`).join('') + '<div id="plan-review" class="below"></div>';
  } catch (error) {
    pending = null; options = [];
    $('whatif-error').textContent = error.message;
    $('whatif-results').innerHTML = '';
  }
};

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action="unified-review"]');
  if (!button) return;
  const plan = options[Number(button.dataset.index)];
  if (!plan) return;
  pending = {label: plan.title, items: structuredClone(plan.items), release: release('w')};
  $('plan-review').innerHTML = `<section class="card"><h2>${esc(plan.title)}</h2><p>${itemsHTML(plan.items)}</p>
    <p>Save this as a plan, or record it only after you have actually done it.</p>
    <button type="button" class="secondary" data-action="save-plan">Save plan</button>
    ${plan.result.cash >= 0 ? '<button type="button" class="primary" data-action="record-dialog">I completed these actions</button>' : ''}</section>`;
  $('plan-review').scrollIntoView({behavior: 'smooth', block: 'start'});
});
document.addEventListener('click', event => {
  if (['clear','demo'].includes(event.target.closest('[data-action]')?.dataset.action)) comparisonDraft = null;
}, true);
// Editing invalidates old results before they can be recorded.
document.addEventListener('input', event => {
  if (!event.target.closest('#whatif-form')) return;
  options = []; pending = null;
  if ($('plan-review')) $('plan-review').innerHTML = '';
});
document.addEventListener('change', event => {
  if (!event.target.closest('#whatif-form')) return;
  options = []; pending = null;
  $('whatif-results').innerHTML = '';
});
render();

const previousHomeView = homeView;
homeView = function () {
  return previousHomeView().replace(/<div class="grid action-grid">[\s\S]*?<div class="section-label">/, `<div class="grid action-grid"><button class="card action-card" data-action="navigate" data-page="compare"><div class="action-icon">⇄</div><h3>Compare choices</h3><p>Try your own plan or ask for a suggested split. See what each choice would leave you with.</p><span class="arrow">→</span></button></div><div class="section-label">`);
};
render();

function updateComparisonLabels() {
  if (!$('whatif-form') || !$('mode-own')) return;
  const suggest = comparisonAction === 'suggest';
  for (const mode of ['own', 'suggest']) {
    const button = $('mode-' + mode), active = mode === comparisonAction;
    button.className = active ? 'primary' : 'secondary';
    button.setAttribute('aria-pressed', String(active));
  }
  $('comparison-instruction').textContent = suggest
    ? 'Choose what to split your money between. Add a maximum amount for each item below.'
    : 'What would you like to do with your money? Add each payment, purchase, or savings amount below.';
  $('split-budget-wrap').hidden = !suggest;
  $('split-budget').disabled = !suggest;
  $('split-budget').required = suggest;
  for (let i = 0; i < whatItems.length; i++) {
    const input = $('w-amount-' + i);
    if (!input) continue;
    const label = document.querySelector('label[for="w-amount-' + i + '"]');
    label.textContent = suggest ? 'Maximum for this item' : 'Your amount';
    const hint = input.parentElement.querySelector('small');
    hint.textContent = suggest ? 'The most you want to put toward this item.'
      : whatItems[i].type === 'income' ? 'Extra money you want to include in this what-if.'
      : 'How much you want to pay, spend, or save.';
  }
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-choice-mode]');
  if (!button || !$('whatif-form')) return;
  syncItems('w');
  comparisonAction = button.dataset.choiceMode;
  pending = null; options = [];
  $('whatif-results').innerHTML = '';
  $('whatif-error').textContent = '';
  updateComparisonLabels();
});
updateComparisonLabels();

// Simple goals and clear routes after editing.
goalName = function () {
 const g=state.goal;
 if(!g)return '';
 if(g.type==='savings')return `Save an additional ${money(g.target)}`;
 return g.debtId ? `Pay ${money(g.target)} toward ${state.debts.find(d=>d.id===g.debtId)?.name||'a removed debt'}` : `Reduce total debt by ${money(g.target)}`;
};
goalView = function () {
 const g=state.goal;
 return heading('What are you working toward?','Choose an amount and a date. You can change your goal later.')+`<form id="goal-form" class="card">
 ${g?goalSummary():''}
 ${g?.debtId?'<p class="note">Your existing goal still tracks one debt. Saving below replaces it with a total-debt goal and starts progress from today.</p>':''}
 <div class="form-grid">
 ${select('goal-type','I want to',[['savings','Save more'],['debt','Reduce debt']],g?.type||'savings')}
 ${field('goal-target','By how much?',g?value(g.target):'','number','The extra amount you want to save, or the amount you want to reduce your total debt by.','required')}
 ${field('goal-deadline','By when?',g?.deadline||'','date','','required min="'+today()+'"')}
 </div>
 <p>Save more tracks the change in your protected savings. Reduce debt tracks the change in all your debt balances added together.</p>
 <p class="disclosure">Progress starts from today’s balances. Updating your balances also updates progress. Adding debt can lower progress; removing a debt lowers the total, so remove it only when it no longer belongs in your list.</p>
 <div id="goal-error" class="error" role="alert"></div>
 <div class="buttons below"><button class="primary">${g?'Replace goal & start from today':'Save goal'}</button>
 ${g?'<button type="button" class="secondary" data-action="remove-goal">Remove goal</button>':''}
 ${setupActive?'':'<a class="text-btn" href="#home">Back to overview</a>'}</div></form>`;
};
const billsWithNavigation=billsView;
billsView=function(){return billsWithNavigation()+`<div class="buttons below"><a class="secondary" href="#essentials">← Back to essentials</a><a class="primary" href="#debts">Continue to debts →</a></div>`;};
const essentialsWithBack=essentialsView;
essentialsView=function(){return essentialsWithBack()+(setupActive?'':'<p><a class="text-btn" href="#money">← Back to my money</a></p>');};
const bannerWithSample=banner;
banner=function(){bannerWithSample();if(state.setupComplete&&!state.demo)$('notice').insertAdjacentHTML('beforeend','<p><button type="button" class="text-btn" data-action="demo">Try sample numbers →</button><small class="muted"> Uses made-up numbers instead of your saved entries. You’ll be asked before replacing them.</small></p>');};
render();
