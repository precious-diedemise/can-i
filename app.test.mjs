// Application-flow smoke tests with a minimal DOM adapter (not a browser layout test).
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from './engine.mjs';
import * as multi from './multi.mjs';
import * as goals from './goals.mjs';
const source=fs.readFileSync(new URL('./app.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
function boot(saved,hash=''){
 const elements={}, handlers={};
 const el=id=>elements[id]??={innerHTML:'',textContent:'',style:{},value:'',checked:false,classList:{toggle(){}},addEventListener(){},reportValidity(){return true},scrollIntoView(){},insertAdjacentHTML(where,html){this.innerHTML=html+this.innerHTML;}};
 const storage={};if(saved)storage['can-i-v2']=JSON.stringify(saved);
 const context={...engine,...multi,...goals,Intl,Date,Number,String,Math,JSON,Array,Object,Map,Set,structuredClone,crypto:{randomUUID:()=>String(Math.random())},document:{getElementById:el,querySelectorAll:()=>[],addEventListener:(name,fn)=>(handlers[name]??=[]).push(fn)},location:{hash},localStorage:{getItem:k=>storage[k],setItem:(k,v)=>storage[k]=v},window:{confirm:()=>true,addEventListener(){},scrollTo(){}},setTimeout:()=>0,clearTimeout(){}};
 vm.createContext(context);vm.runInContext(source,context);
 return {el,context,storage,run:s=>vm.runInContext(s,context),event:(name,e)=>handlers[name].forEach(fn=>fn(e))};
}
test('new visitors get blank inputs and can open Survey before setup',()=>{
 const a=boot();for(const id of ['cash','savings','essentials','income'])assert.match(a.el('content').innerHTML,new RegExp('id="'+id+'"[^>]*value=""'));
 a.context.location.hash='#survey';a.run('render()');assert.match(a.el('content').innerHTML,/iframe.*embedded=true/);assert.doesNotMatch(a.el('content').innerHTML,/id="money-form"/);
 a.context.location.hash='#compare';a.run('render()');assert.match(a.el('content').innerHTML,/id="money-form"/);
});
test('personal data survives and combined modes include goal progress',()=>{
 const s={...engine.demo(),demo:false,setupComplete:true};s.goal=goals.createGoal(s,{type:'savings',target:10000,deadline:'2099-01-01'},engine.today());
 const a=boot({state:s,history:[]},'#compare');assert.match(a.el('content').innerHTML,/Help me decide/);assert.match(a.el('content').innerHTML,/Test my plan/);assert.equal(a.run('state.cash'),s.cash);assert.match(a.el('content').innerHTML,/Save an additional/);
 a.run("options=[{title:'Savings',items:[{id:'s',type:'protect',name:'Savings',amount:6000}],result:simulateItems(state,[{type:'protect',amount:6000}])}];review(0)");assert.match(a.el('plan-review').innerHTML,/Edit in Test my plan/);assert.match(a.el('plan-review').innerHTML,/moves you closer by.*60.00/);
 a.run('transferredPlan=structuredClone(pending)');a.context.location.hash='#whatif';a.run('render()');assert.equal(a.run('whatItems[0].amount'),6000);assert.equal(a.run('transferredPlan'),null);assert.equal(a.run('state.savings'),s.savings);
});
test('goal form persists an optional goal without altering balances',()=>{
 const s={...engine.demo(),demo:false,setupComplete:true};const a=boot({state:s,history:[]},'#goal');for(const [id,v] of Object.entries({'goal-type':'savings','goal-target':'100','goal-deadline':'2099-01-01','goal-debt':''}))a.el(id).value=v;
 a.event('submit',{target:{id:'goal-form'},preventDefault(){}});const saved=JSON.parse(a.storage['can-i-v2']);assert.equal(saved.state.goal.target,10000);assert.equal(saved.state.cash,s.cash);assert.equal(saved.state.savings,s.savings);
 const restored=boot(saved,'#home');assert.match(restored.el('content').innerHTML,/Save an additional/);
});
