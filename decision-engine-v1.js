(()=>{'use strict';
const END=24*60,MEAL=60;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const ALIASES={
  'LUCAS':'Lucas V.','LUCAS V':'Lucas V.','LUCAS VENANCIO':'Lucas V.',
  'LUCAS R':'Lucas R.','MARCIO':'Marcio','EWERSON':'Ewerson','EVERSON':'Everson',
  'PATRICIO':'Patrício','CHRISTOFFER':'Christoffer'
};
const canon=name=>ALIASES[norm(name)]||String(name||'').trim().replace(/^\*|\*$/g,'').replace(/\b\w/g,c=>c.toUpperCase());
const toMin=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null};
const toTime=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const overlap=(a,b,c,d)=>Math.max(a,c)<Math.min(b,d);
const machine=m=>{const x=String(m||'').match(/(?:TNL\s*)?0*(\d{1,3})/i);return x?`TNL ${String(x[1]).padStart(3,'0')}`:String(m||'').trim()};
function interval(ev){
  const s=toMin(ev.start||ev.time),type=ev.type||ev.kind;if(s==null)return null;
  let e=toMin(ev.end);if(e==null)e=['future','setup-future'].includes(type)?END:s+(Number(ev.duration)||MEAL);
  return {s,e};
}
function normalizePlan(input={}){
  const people=[...(input.people||[])].map(p=>typeof p==='string'?{name:canon(p)}:{...p,name:canon(p.name)});
  const tasks=[...(input.tasks||input.events||[])].map((t,i)=>({...t,id:t.id||`task-${i}`,machine:machine(t.machine),owner:t.owner?canon(t.owner):null,assignee:t.assignee?canon(t.assignee):null}));
  const meals=[...(input.meals||[])].map((m,i)=>({...m,id:m.id||`meal-${i}`,type:'meal',person:canon(m.person||m.owner),start:m.start||m.time,duration:MEAL}));
  const covers=[...(input.covers||[])].map((c,i)=>({...c,id:c.id||`cover-${i}`,type:'cover',person:canon(c.person||c.who),owner:canon(c.owner),machine:machine(c.machine),start:c.start||c.time,duration:Number(c.duration)||MEAL}));
  return {people,tasks,meals,covers,shiftEnd:input.shiftEnd||'24:00'};
}
function collectAssignments(plan){
  const by=new Map(),add=(person,ev)=>{if(!person)return;const p=canon(person);if(!by.has(p))by.set(p,[]);by.get(p).push(ev)};
  plan.meals.forEach(m=>add(m.person,m));plan.covers.forEach(c=>add(c.person,c));plan.tasks.forEach(t=>add(t.assignee||t.owner,t));return by;
}
function label(e){if(e.type==='meal')return `jantar ${e.start||e.time}`;if(e.type==='cover')return `revezamento ${e.machine} ${e.start||e.time}`;return `${e.machine||e.type||'atividade'} ${e.start||e.time||''}`.trim()}
function validate(input){
  const plan=normalizePlan(input),errors=[],warnings=[];
  const future=plan.tasks.filter(t=>['future','setup-future'].includes(t.type));
  for(const t of future)if(!t.assignee)errors.push({code:'FUTURE_UNASSIGNED',message:`${t.machine} ${t.start||t.time||''} está sem responsável.`,taskId:t.id});
  const by=collectAssignments(plan);
  for(const [person,events] of by){
    const valid=events.map(e=>({e,i:interval(e)})).filter(x=>x.i).sort((a,b)=>a.i.s-b.i.s);
    for(let i=0;i<valid.length;i++)for(let j=i+1;j<valid.length;j++)if(overlap(valid[i].i.s,valid[i].i.e,valid[j].i.s,valid[j].i.e))errors.push({code:'PERSON_OVERLAP',person,message:`${person} tem conflito entre ${label(valid[i].e)} e ${label(valid[j].e)}.`,events:[valid[i].e.id,valid[j].e.id]});
  }
  const mealBy=new Map();for(const m of plan.meals){const p=canon(m.person);mealBy.set(p,(mealBy.get(p)||0)+1)}
  for(const p of plan.people.map(x=>x.name)){const n=mealBy.get(p)||0;if(n===0)warnings.push({code:'MEAL_MISSING',person:p,message:`${p} ainda não tem jantar definido.`});if(n>1)errors.push({code:'MEAL_DUPLICATE',person:p,message:`${p} possui mais de um jantar.`});}
  for(const c of plan.covers)if(c.person===c.owner)errors.push({code:'SELF_COVER',message:`${c.person} não pode revezar a si mesmo.`,coverId:c.id});
  return {valid:errors.length===0,errors,warnings,plan};
}
function score(input){
  const r=validate(input),p=r.plan;let value=100;
  value-=r.errors.filter(e=>e.code==='FUTURE_UNASSIGNED').length*45;
  value-=r.errors.filter(e=>e.code==='PERSON_OVERLAP').length*35;
  value-=r.errors.filter(e=>!['FUTURE_UNASSIGNED','PERSON_OVERLAP'].includes(e.code)).length*20;
  value-=r.warnings.filter(e=>e.code==='MEAL_MISSING').length*7;
  const assigned=p.tasks.filter(t=>['future','setup-future'].includes(t.type)&&t.assignee).length,total=p.tasks.filter(t=>['future','setup-future'].includes(t.type)).length;
  const coverage=total?Math.round(assigned/total*100):100,dinners=p.people.length?Math.round((p.people.length-r.warnings.filter(w=>w.code==='MEAL_MISSING').length)/p.people.length*100):100;
  return {score:Math.max(0,Math.min(100,value)),coverage,dinners,valid:r.valid,errors:r.errors,warnings:r.warnings};
}
function candidates(plan,task){
  const start=toMin(task.start||task.time);if(start==null)return[];const end=['future','setup-future'].includes(task.type)?END:start+(task.duration||MEAL),by=collectAssignments(plan);
  return plan.people.map(p=>p.name).filter(person=>!(by.get(person)||[]).some(e=>{if(e.id===task.id)return false;const i=interval(e);return i&&overlap(i.s,i.e,start,end)}));
}
function optimize(input,{limit=5000}={}){
  const base=normalizePlan(input),future=base.tasks.filter(t=>['future','setup-future'].includes(t.type)).sort((a,b)=>toMin(a.start||a.time)-toMin(b.start||b.time));let explored=0,best=null;
  const clone=o=>typeof structuredClone==='function'?structuredClone(o):JSON.parse(JSON.stringify(o));
  const walk=(index,plan)=>{if(explored++>=limit)return;if(index>=future.length){const s=score(plan);if(!best||s.score>best.metrics.score)best={plan:clone(plan),metrics:s};return}const current=plan.tasks.find(t=>t.id===future[index].id);if(current.assignee){walk(index+1,plan);return}const opts=candidates(plan,current);if(!opts.length){walk(index+1,plan);return}for(const name of opts){current.assignee=name;walk(index+1,plan);current.assignee=null;}};
  walk(0,base);if(!best)best={plan:base,metrics:score(base)};return {...best,explored,explanation:explain(best.metrics)};
}
function explain(m){if(m.valid)return `Plano validado: ${m.coverage}% dos próximos setups cobertos e ${m.dinners}% dos jantares definidos.`;const open=m.errors.filter(e=>e.code==='FUTURE_UNASSIGNED').map(e=>e.message);if(open.length)return `Plano não validado. ${open.join(' ')}`;return `Plano não validado: ${m.errors[0]?.message||'há conflitos operacionais.'}`}
window.NCDE={version:'1.1.0',canon,toMin,toTime,normalizePlan,validate,score,optimize,candidates};
window.dispatchEvent(new CustomEvent('ncde:ready',{detail:{version:'1.1.0'}}));
})();