import {cents,dollars,today,demo,validate,snapshot,simulate,paymentOptions,record,dueBeforeIncome} from './engine.mjs';
import {simulateItems,itemOptions,recordItems} from './multi.mjs';
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
function warnings(r){const map={ 'essentials-gap':'Current cash does not cover your entered essentials. Review your numbers and payment options.', 'income-date-unknown':'Next income date is missing. All dated payments are reserved conservatively.', 'dates-missing':'Some debt due dates are missing. Check them before choosing a plan.', 'apr-missing':'Some APRs are unknown; interest comparisons may be incomplete.', 'same-day':'A payment is due on payday. Verify that income arrives before the payment cutoff.', 'income-overdue':'The expected income date has passed. Update it; that money is still excluded from current cash.' };return r.warnings.map(w=>{if(w.startsWith('cash:'))return `This exceeds available funds by ${money(+w.split(':')[1])}.`;if(w.startsWith('shortfall:'))return `${money(+w.split(':')[1])} short of covering reserved essentials and remaining payments before income.`;return map[w];}).filter(Boolean);}
function warningHTML(r){const w=warnings({...r,warnings:r.warnings.filter(x=>!x.startsWith('shortfall:'))});if(r.cash-r.essentials<0)w.unshift(`${money(r.essentials-r.cash)} short of covering your entered essentials after this choice.`);return w.length?`<div class="warn">${w.map(esc).join('<br>')}</div>`:'';}
function commitmentForecast(r){if(!r.due)return '';return `<details class="note below"><summary>If I also pay everything due before income…</summary><p>This is an additional forecast, not a payment already made or selected.</p><p>${money(r.cash)} cash − ${money(r.essentials)} essentials − ${money(r.due)} outstanding payments = <b>${money(r.room)}</b>.</p><p>${r.room<0?`You would need ${money(-r.room)} more to cover all of those commitments. That extra payment is not deducted from the cash balance above.`:`You would have ${money(r.room)} left after covering all those commitments.`}</p></details>`;}
function allocationHTML(a){return Object.entries(a).filter(([,n])=>n>0).map(([id,n])=>`${money(n)} → ${esc(state.debts.find(d=>d.id===id)?.name)}`).join('<br>')||'Keep the payment money available.';}
function protectedControl(prefix){return `<div class="protected-control"><label class="check"><input id="${prefix}-use" type="checkbox">Would you consider using protected savings?</label><div id="${prefix}-releasebox" class="hidden">${field(prefix+'-release','Amount to include in this comparison','0','number',`Up to ${money(state.savings)}. Included only if you choose an amount.`)}</div><p class="disclosure">Protected savings stay excluded by default.</p></div>`;}
function release(prefix){return $(prefix+'-use')?.checked?cents($(prefix+'-release').value):0;}
function banner(){ $('notice').innerHTML=state.demo?'<div class="banner"><span>✳ Fictional example data · explore freely</span><a href="#money">Use my own numbers →</a></div>':'<div class="banner personal"><span>Saved in this browser · no account sync</span><a href="#money">Edit my numbers →</a></div>'; }
function render(){const page=location.hash.slice(1)||'home';document.querySelectorAll('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===page);if(a.dataset.nav===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});banner(); const views={home:homeView,pay:payView,whatif:whatifView,money:moneyView,history:historyView};$('content').innerHTML=(views[page]||homeView)();if(page==='whatif')renderItems('w');if(page==='pay')renderItems('p');if(page==='money')renderDebtFields();if(page==='home')warningHome();}
function homeView(){const s=snapshot(state);return heading('Make room for better decisions.','See where you stand. Then explore your next move.','<a href="#money" class="secondary" style="text-decoration:none">Edit my money</a>')+`<div class="grid overview"><section class="card hero"><div class="label">${s.afterEssentials<0?'Essentials gap to cover':'Cash after essentials'}</div><div class="amount">${money(s.afterEssentials)}</div><span class="pill">${date(state.payday)} · next expected income</span><p>Current cash minus your entered essentials. Debt payments have not been deducted here. Compare your payment options to see what would remain.</p></section><section class="card"><div class="label">The bigger picture</div>${stat('Available now',s.cash)}${stat('Protected savings',s.savings)}${stat('Essentials reserved',s.essentials)}${stat('Debt payments due before income',s.due)}${stat('Expected income · not received',state.income)}</section></div><div id="home-warnings" class="below"></div><div class="section-label"><h2>What are we figuring out?</h2><span class="label">EXPLORE YOUR OPTIONS</span></div><div class="grid action-grid"><button class="card action-card" data-action="navigate" data-page="pay"><div class="action-icon">↗</div><h3>What should I pay?</h3><p>Compare a few ways to use your money, with the trade-offs laid out.</p><span class="arrow">→</span></button><button class="card action-card" data-action="navigate" data-page="whatif"><div class="action-icon">⇄</div><h3>What if…?</h3><p>Pay $60 toward a debt? Buy something? See what changes first.</p><span class="arrow">→</span></button></div><div class="section-label"><h2>A quick look at your obligations</h2><a href="#money" class="text-btn">View & edit →</a></div><section class="card">${state.debts.length?state.debts.map(d=>`<div class="stat-row"><span>${esc(d.name)}<br><small class="muted">${d.minimum?`${money(d.minimum)} due · ${date(d.due)}`:'No payment amount entered'} · ${d.apr===null?'APR unknown':d.apr+'% APR'}</small></span><b>${money(d.balance)}</b></div>`).join(''):'<p class="muted">No debts added. You can still explore purchases and savings.</p>'}</section>`;}
function warningHome(){const s=snapshot(state),r=simulate(state);r.warnings=r.warnings.filter(w=>!w.startsWith('shortfall:'));if(s.afterEssentials<0)r.warnings.push('essentials-gap');const w=warningHTML(r);$('home-warnings').innerHTML=(s.due?`<div class="note">${money(s.due)} in debt payments is due before your next income. This amount is listed separately, not deducted from the headline. <a href="#pay">Compare what to pay →</a></div>`:'')+(w?`<div class="below">${w}</div>`:'');}
let payItems=[],whatItems=[];
function newItem(type='purchase'){return {id:crypto.randomUUID(),type,name:'',amount:0,debtId:state.debts.find(d=>d.balance>0)?.id||'',inEssentials:false};}
function itemsFor(prefix){return prefix==='p'?payItems:whatItems;}
function syncItems(prefix){const list=itemsFor(prefix);for(let i=0;i<list.length;i++){const x=list[i];x.type=$(prefix+'-type-'+i).value;x.amount=cents($(prefix+'-amount-'+i).value);x.debtId=$(prefix+'-target-'+i)?.value||x.debtId||state.debts.find(d=>d.balance>0)?.id||'';x.name=x.type==='debt'?(state.debts.find(d=>d.id===x.debtId)?.name||'Debt'):($(prefix+'-name-'+i)?.value.trim()||({purchase:'Purchase',bill:'Bill',protect:'Savings',income:'Extra income'})[x.type]);x.inEssentials=['purchase','bill'].includes(x.type)&&!!$(prefix+'-covered-'+i)?.checked;}}
function renderItems(prefix){pending=null;if($('pay-results'))$('pay-results').innerHTML='';if($('plan-review'))$('plan-review').innerHTML='';if($('whatif-results'))$('whatif-results').innerHTML='';const list=itemsFor(prefix),isPay=prefix==='p';$(prefix+'-items').innerHTML=list.map((x,i)=>`<div class="item-entry"><div class="result-heading"><h3>Item ${i+1}</h3><button type="button" class="text-btn" data-action="remove-item" data-prefix="${prefix}" data-index="${i}">Remove</button></div><div class="form-grid">${select(prefix+'-type-'+i,'Type',[['debt','Debt payment'],['bill','Bill / essential expense'],['purchase','Purchase'],['protect','Add to savings'],...(!isPay?[['income','Extra income']]:[])],x.type)}${x.type==='debt'?select(prefix+'-target-'+i,'Which debt?',state.debts.filter(d=>d.balance>0).map(d=>[d.id,d.name]),x.debtId):field(prefix+'-name-'+i,'Name',x.name,'text','For example: groceries, rent, birthday gift','maxlength="60"')}${field(prefix+'-amount-'+i,isPay?'Up to this amount':'Amount',value(x.amount),'number',isPay?'The most you want allocated to this item in each option.':'This amount will be included in your combined plan.','required')}</div>${['bill','purchase'].includes(x.type)?`<label class="check below"><input id="${prefix}-covered-${i}" type="checkbox" ${x.inEssentials?'checked':''}>Already included in my essentials</label><p class="disclosure">If checked, paying this expense reduces the remaining essentials by the same amount so it is not counted twice.</p>`:''}</div>`).join('')||'<p class="muted">Add at least one item to start a comparison.</p>';if(isPay){const previous=$('priority')?.value||state.priority;const fieldHTML=select('priority','Which item matters most to you?',[["",'No particular preference'],...list.map(x=>[x.id,x.name||({debt:'Debt',purchase:'Purchase',bill:'Bill',protect:'Savings'})[x.type]])],previous);$('priority-field').innerHTML=fieldHTML;}}
function payView(){options=[];pending=null;payItems=state.debts.filter(d=>d.balance>0).map(d=>({id:d.id,type:'debt',name:d.name,amount:d.balance,debtId:d.id,inEssentials:false}));return heading('What should I pay?','Include debts, bills, purchases, and savings. Compare ways to split one amount.')+`<form id="pay-form" class="card"><div class="compare-controls">${field('budget','Total amount to compare','60','number','Every option uses the same total amount.','required')}<div id="priority-field"></div></div><div id="p-items" class="below"></div><button type="button" class="secondary" data-action="add-item" data-prefix="p">+ Add another item</button>${protectedControl('p')}<div class="buttons below"><button class="primary" type="submit">Compare ways to use this money ↗</button><button class="secondary" type="button" data-action="pay-exact">Compare my exact amounts</button></div><div id="pay-error" class="error" role="alert"></div></form><div id="pay-results"></div><div id="plan-review" class="below"></div>`;}
function itemsHTML(items){return items.filter(x=>x.amount>0).map(x=>`${money(x.amount)} → ${esc(x.name||x.type)}${x.type==='income'?' (income received in this scenario)':''}`).join('<br>')||'No changes';}
function itemResultsTable(plans){const rows=[['Available cash',r=>r.cash],['Essentials still to cover',r=>r.essentials],['Cash after essentials',r=>r.cash-r.essentials],['Protected savings',r=>r.savings],['Payments still due before income',r=>r.due],...state.debts.map(d=>[esc(d.name)+' balance',r=>r.balances.find(x=>x.id===d.id).balance])];return `<div style="overflow:auto"><table class="scenario-table"><thead><tr><th scope="col">What changes</th>${plans.map(p=>`<th scope="col">${esc(p.title)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label,fn])=>`<tr><td>${label}</td>${plans.map(p=>`<td class="${fn(p.result)<0?'negative':''}">${money(fn(p.result))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function itemTrade(plan){const r=plan.result,unpaid=state.debts.filter(d=>dueBeforeIncome(state,d)&&d.minimum>(r.allocations[d.id]||0));return unpaid.length?unpaid.map(d=>`${money(d.minimum-(r.allocations[d.id]||0))} still due to ${esc(d.name)} by ${date(d.due)}`).join('; ')+'.':r.protectedAdded?'Adding to savings keeps money yours, but leaves less everyday cash available.':r.spending?'The purchases and bills use cash; only debt payments reduce your debt balances.':'No entered dated minimum remains due before income in this plan.';}
function comparePayments(){try{syncItems('p');state.priority=$('priority').value;const budget=cents($('budget').value);options=itemOptions(state,payItems,budget,release('p'),state.priority);save();pending=null;$('pay-error').textContent='';$('plan-review').innerHTML='';if(!options.length){$('pay-results').innerHTML='<div class="note below">No amount is available to allocate. Add items with positive limits and check your available cash.</div>';return;}
const actual=options[0].result.total;$('pay-results').innerHTML=`<div class="section-label"><h2>${options.length} ways to use ${money(actual)}</h2><span class="label">PREVIEW ONLY</span></div><div class="note">Each option allocates the same ${money(actual)} across the items you included. ${actual<budget?'The requested budget was reduced to available cash or total item limits.':''} ${options.length<3?'Only '+options.length+' distinct plan'+(options.length===1?' is':'s are')+' possible for these amounts.':''}</div><div class="options">${options.map((o,i)=>`<section class="card option-card"><span class="pill">OPTION ${i+1}</span><h3>${esc(o.title)}</h3><p class="summary">${esc(o.description)}</p><div class="plan-money">${money(o.result.total)}</div><div class="allocation">${itemsHTML(o.items)}</div>${stat('Available cash after',o.result.cash)}${stat('Cash after essentials',o.result.cash-o.result.essentials)}${stat('Protected savings',o.result.savings)}<p class="trade"><b>Trade-off:</b> ${itemTrade(o)}</p>${warningHTML(o.result)}${commitmentForecast(o.result)}<button class="primary" data-action="review" data-index="${i}">Review this plan →</button></section>`).join('')}</div><section class="card below"><h2>Compare the full picture</h2>${itemResultsTable(options.map((p,i)=>({...p,title:'Option '+(i+1)})))}<p class="disclosure">Only items allocated in each plan change these previews. Unpaid bills remain separate. Expenses marked as already included reduce remaining essentials when paid.</p></section>`;}catch(e){$('pay-error').textContent=e.message;}}
function exactPay(){try{syncItems('p');const items=payItems.filter(x=>x.amount>0),r=simulateItems(state,items,release('p'));if(r.total>cents($('budget').value))throw new Error('Your exact item amounts exceed the total budget. Lower the item amounts or increase the budget.');options=[{title:'My exact amounts',items,result:r}];$('pay-error').textContent='';review(0);}catch(e){$('pay-error').textContent=e.message;}}
function review(index){const o=options[index];if(!o)return;pending={items:o.items,release:o.result.release,label:o.title};const r=simulateItems(state,o.items,pending.release);$('plan-review').innerHTML=`<section class="card"><div class="result-heading"><h2>After this combined plan</h2><span class="pill">SIMULATION ONLY</span></div><p>${itemsHTML(o.items)}</p>${stat('Available cash',r.cash)}${stat('Cash after essentials',r.cash-r.essentials)}${stat('Protected savings',r.savings)}${stat('Payments still due before income',r.due)}${warningHTML(r)}${commitmentForecast(r)}<p class="muted">Reviewing this plan does not change your numbers. Record it only after completing the actions yourself.</p><div class="buttons"><button class="secondary" data-action="save-plan">Save as a plan</button>${r.cash>=0&&r.total>0?'<button class="primary" data-action="record-dialog">I completed these actions</button>':''}</div></section>`;$('plan-review').scrollIntoView({behavior:'smooth',block:'start'});}
function whatifView(){pending=null;const first=newItem(state.debts.some(d=>d.balance>0)?'debt':'purchase');first.amount=6000;whatItems=[first];return heading('What if…?','Combine several actions and see their overall effect.')+`<form id="whatif-form" class="card"><div id="w-items"></div><button class="secondary" type="button" data-action="add-item" data-prefix="w">+ Add another item</button>${protectedControl('w')}<button class="primary below" type="submit">Show the combined effect ⇄</button><div id="whatif-error" class="error" role="alert"></div></form><div id="whatif-results" class="below"></div>`;}
function runScenario(){try{syncItems('w');const items=whatItems.filter(x=>x.amount>0);if(!items.length)throw new Error('Add at least one item with an amount greater than zero.');const released=release('w'),full=simulateItems(state,items,released),halfItems=items.map(x=>({...x,amount:Math.round(x.amount/2)}));const plans=[{title:'No changes',items:[],result:simulateItems(state,[])},{title:'Half of each amount',items:halfItems,result:simulateItems(state,halfItems,released)},{title:'Your full plan',items,result:full}];pending={items,release:released,label:'What if: combined plan'};$('whatif-error').textContent='';$('whatif-results').innerHTML=`<section class="card"><div class="result-heading"><h2>Your combined plan</h2><span class="pill">SIMULATION ONLY</span></div><p>${itemsHTML(items)}</p>${itemResultsTable(plans)}<div class="note below"><b>Overall effect:</b> ${money(full.total)} leaves everyday cash for payments, expenses, and savings transfers${full.received?'; '+money(full.received)+' of hypothetical extra income is added':''}. ${money(full.cash)} cash remains, with ${money(full.essentials)} in essentials still to cover.</div>${warningHTML(full)}${commitmentForecast(full)}<p class="disclosure">Nothing has changed in your actual balances. “Half” uses half of each entered action.${released?' Both changed scenarios include your selected '+money(released)+' from protected savings; the baseline uses none.':''} Extra income is hypothetical unless you explicitly record receiving it.</p><div class="buttons below"><button class="secondary" data-action="save-plan">Save this combined plan</button>${full.cash>=0?'<button class="primary" data-action="record-dialog">I completed these actions</button>':''}</div></section>`;}catch(e){$('whatif-error').textContent=e.message;$('whatif-results').innerHTML='';pending=null;}}
let draftDebts=[];
function moneyView(){draftDebts=structuredClone(state.debts);return heading('Your money, in one place.','Update the facts. The comparisons will follow.')+`<form id="money-form"><section class="card form-card"><h2>Money available today</h2><div class="form-grid">${field('cash','Money available now',value(state.cash),'number','Include money in your checking account, spending apps, and physical cash. Exclude protected savings and available credit.','required')}${field('savings','Protected savings',value(state.savings),'number','Kept out of payment options unless you choose to include some.','required')}</div></section><section class="card form-card"><h2>Before your next income</h2><div class="form-grid">${field('essentials','Essential expenses still to cover',value(state.essentials),'number','Groceries, rent, transport, bills. Exclude debt payments entered below.','required')}${field('income','Expected income amount',value(state.income),'number','Future income is shown separately; it is not added to today’s cash.','required')}${field('payday','Expected income date',state.payday,'date','Leave blank if unknown.')}</div></section><section class="card form-card"><div class="result-heading"><h2>Debts & payment commitments</h2><button type="button" class="secondary" data-action="add-debt">+ Add debt</button></div><p class="disclosure">“Payment due” means the remaining minimum or agreed installment for the current cycle. Use the actual due date; an unknown date is not treated as proof that nothing is due.</p><div id="debt-fields"></div></section><div id="money-error" class="error" role="alert"></div><div class="buttons below"><button class="primary" type="submit">Save my numbers →</button><button class="secondary" type="button" data-action="clear">Start with empty numbers</button><button class="text-btn" type="button" data-action="demo">Reload fictional example</button></div><p class="disclosure">Data is stored in this browser on this device. Clear it when using a shared device. Editing numbers clears the previous undo snapshot.</p></form>`;}
const debtTypes=['Credit card','School / tuition','Medical','Someone I know','Auto loan','Other'];
function renderDebtFields(){ $('debt-fields').innerHTML=draftDebts.length?draftDebts.map((d,i)=>`<div class="debt-entry"><div class="debt-grid">${field('dn-'+i,'Name',d.name,'text','','required maxlength="60"')}${select('dt-'+i,'Type',debtTypes.map(x=>[x,x]),d.type)}${field('db-'+i,'Balance',value(d.balance),'number','','required')}${field('da-'+i,'APR (%)',d.apr===null?'':d.apr,'number','Blank = unknown','max="1000"')}${field('dm-'+i,'Payment due',value(d.minimum),'number','','required')}${field('dd-'+i,'Due date',d.due,'date')}</div><div class="buttons"><button type="button" class="text-btn" data-action="remove-debt" data-index="${i}">Remove debt</button></div></div>`).join(''):'<p class="muted">No debts added. That’s fine — you can still explore purchases and savings.</p>';}
function syncDraft(){draftDebts=draftDebts.map((d,i)=>({...d,name:$('dn-'+i).value.trim(),type:$('dt-'+i).value,balance:cents($('db-'+i).value),apr:$('da-'+i).value===''?null:Number($('da-'+i).value),minimum:cents($('dm-'+i).value),due:$('dd-'+i).value}));}
function saveMoney(){try{syncDraft();const next={...state,demo:false,cash:cents($('cash').value),savings:cents($('savings').value),essentials:cents($('essentials').value),income:cents($('income').value),payday:$('payday').value,asof:today(),debts:draftDebts};validate(next);state=next;undo=null;pending=null;save();location.hash='home';toast('Your numbers are saved.');}catch(e){$('money-error').textContent=e.message;}}
function historyView(){return heading('Your decisions, kept separate.','Saved plans are previews. Recorded payments change your numbers.')+`<section class="card"><div class="buttons">${undo?'<button class="secondary" data-action="undo">Undo last recorded actions</button>':''}</div>${history.length?history.slice().reverse().map(h=>`<div class="history-entry"><span class="pill">${h.kind==='payment'?'RECORDED ACTIONS':h.kind==='undo'?'UNDONE':'SAVED PLAN'}</span><p><b>${esc(h.label)}</b> · ${money(h.total)}</p><p class="muted">${esc(h.description)}</p><small class="muted">${new Date(h.at).toLocaleString()}</small></div>`).join(''):'<div class="empty"><div class="welcome-spark">✳</div><h2>Nothing recorded yet.</h2><p class="muted">Explore a comparison, then save a plan or record a payment you’ve made.</p><a href="#whatif" class="text-btn">Try a what-if →</a></div>'}</section>`;}
function addItemHistory(kind,plan,r){history.push({id:crypto.randomUUID(),kind,label:plan.label,total:r.total,description:plan.items.map(x=>money(x.amount)+' → '+x.name).join('; '),at:new Date().toISOString()});history=history.slice(-100);}
function addHistory(kind,label,total,a){history.push({id:crypto.randomUUID(),kind,label,total,description:Object.entries(a||{}).filter(([,n])=>n>0).map(([id,n])=>`${money(n)} toward ${state.debts.find(d=>d.id===id)?.name||'debt'}`).join('; ')||'Cash stays available',at:new Date().toISOString()});history=history.slice(-100);}
document.addEventListener('submit',e=>{const id=e.target.id;if(['pay-form','whatif-form','money-form'].includes(id)){e.preventDefault();({ 'pay-form':comparePayments,'whatif-form':runScenario,'money-form':saveMoney})[id]();}});
document.addEventListener('change',e=>{if(/^[pw]-type-/.test(e.target.id)){const prefix=e.target.id[0],index=Number(e.target.id.split('-').at(-1));syncItems(prefix);itemsFor(prefix)[index].name='';itemsFor(prefix)[index].inEssentials=false;renderItems(prefix);}if(/^[pw]-target-/.test(e.target.id)){const prefix=e.target.id[0];syncItems(prefix);renderItems(prefix);}for(const prefix of ['p','w'])if(e.target.id===prefix+'-use')$(prefix+'-releasebox').classList.toggle('hidden',!e.target.checked);});
document.addEventListener('input',e=>{if(e.target.closest('#pay-form')||e.target.closest('#whatif-form')){pending=null;if($('pay-results'))$('pay-results').innerHTML='';if($('plan-review'))$('plan-review').innerHTML='';if($('whatif-results'))$('whatif-results').innerHTML='';}});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const action=btn.dataset.action;
if(action==='navigate')location.hash=btn.dataset.page;
if(action==='review')review(Number(btn.dataset.index));
if(action==='pay-exact')exactPay();
if(action==='add-item'){const prefix=btn.dataset.prefix;syncItems(prefix);if(itemsFor(prefix).length>=20){toast('Use up to 20 items in a plan.');return;}itemsFor(prefix).push(newItem());renderItems(prefix);}
if(action==='remove-item'){const prefix=btn.dataset.prefix;syncItems(prefix);itemsFor(prefix).splice(Number(btn.dataset.index),1);renderItems(prefix);}
if(action==='add-debt'){syncDraft();if(draftDebts.length>=30){toast('This prototype supports up to 30 debts.');return;}draftDebts.push({id:crypto.randomUUID(),name:'',type:'Credit card',balance:0,apr:null,minimum:0,due:''});renderDebtFields();}
if(action==='remove-debt'){syncDraft();draftDebts.splice(Number(btn.dataset.index),1);renderDebtFields();}
if(action==='save-plan'&&pending){const r=simulateItems(state,pending.items,pending.release);addItemHistory('plan',pending,r);save();toast('Plan saved. Your balances have not changed.');}
if(action==='record-dialog'&&pending){const r=simulateItems(state,pending.items,pending.release);$('confirm-text').textContent=`Record these completed actions: ${pending.items.filter(x=>x.amount>0).map(x=>money(x.amount)+' → '+x.name).join('; ')}${pending.release?'; include '+money(pending.release)+' from protected savings':''}?`;$('confirm').showModal();}
if(action==='undo'&&undo){state=undo.state;const entry=history.find(h=>h.id===undo.entryId);if(entry)entry.kind='undo';undo=null;pending=null;save();render();toast('Last recorded actions undone.');}
if(action==='clear'){if(!window.confirm('Clear saved numbers and activity from this browser?'))return;state={version:2,demo:false,cash:0,savings:0,essentials:0,income:0,payday:'',asof:today(),priority:'',debts:[]};history=[];undo=null;pending=null;save();location.hash='money';render();toast('Start with your own numbers.');}
if(action==='demo'){if(!window.confirm('Replace current numbers and activity with the fictional example?'))return;state=demo();history=[];undo=null;pending=null;save();location.hash='home';render();toast('Fictional example loaded.');}
});
$('confirm').addEventListener('close',()=>{if($('confirm').returnValue!=='record'||!pending)return;try{const before=structuredClone(state);const r=simulateItems(state,pending.items,pending.release);const updated=recordItems(state,pending.items,pending.release);addItemHistory('payment',pending,r);undo={state:before,entryId:history.at(-1).id};state=updated;pending=null;save();location.hash='home';render();toast('Actions recorded. You can undo them in Activity.');}catch(e){toast(e.message);}});
window.addEventListener('hashchange',()=>{pending=null;render();window.scrollTo({top:0,behavior:'smooth'});});render();if(storageProblem)toast('Could not restore saved data. Showing the fictional example.');
// Blank starting figures and optional sample mode.
function blankStartState() {
  return {
    version: 2, demo: false, setupComplete: false,
    cash: 0, savings: 0, essentials: 0, income: 0,
    payday: '', asof: today(), priority: '', debts: []
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
    for (const id of ['cash', 'savings', 'essentials', 'income']) {
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
  for (const id of ['cash', 'savings', 'essentials', 'income']) {
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
  const page = state.setupComplete
    ? (location.hash.slice(1) || 'home')
    : 'money';
  document.querySelectorAll('[data-nav]').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === page);
    if (a.dataset.nav === page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  banner();
  const views = {
    home: homeView, pay: payView, whatif: whatifView,
    money: moneyView, history: historyView
  };
  $('content').innerHTML = (views[page] || homeView)();
  if (page === 'money') renderDebtFields();
  if (page === 'pay') renderItems('p');
  if (page === 'whatif') renderItems('w');
  if (page === 'home') warningHome();
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
  history = [];
  undo = null;
  pending = null;
  options = [];
  save();
  location.hash = action === 'demo' ? 'home' : 'money';
  render();
}, true);

render();
