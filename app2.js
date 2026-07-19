function taskList(){
  const tasks=[];
  state.activities.filter(a=>a.type!=='future' && a.need===true).forEach(a=>tasks.push({
    id:`cover:${a.id}`,kind:'cover',start:toMin(a.preferred),end:toMin(a.preferred)+60,
    machine:a.machine,owner:a.owner,label:`Cobre ${a.owner} na ${a.machine}`
  }));
  state.activities.filter(a=>a.type==='future').forEach(a=>tasks.push({
    id:`future:${a.id}`,kind:'future',start:toMin(a.start),end:SHIFT_END,
    machine:a.machine,owner:null,label:`Inicia ${a.machine}`
  }));
  return tasks.sort((a,b)=>a.start-b.start || (a.kind==='future'?-1:1));
}

function cloneCalendars(cal){
  const out={}; Object.keys(cal).forEach(k=>out[k]=cal[k].map(x=>({...x}))); return out;
}
function hasConflict(events,s,e){return events.some(x=>overlaps(x.s,x.e,s,e));}

function mealOptions(name,events,deadline=null,preferred=null){
  const base=personBase(name);
  if(base.blocked) return [];
  const opts=[];
  for(const slot of MEAL_SLOTS){
    const s=toMin(slot),e=s+60;
    if(s<base.freeAt) continue;
    if(deadline!==null && e>deadline) continue;
    if(hasConflict(events,s,e)) continue;
    let penalty=0;
    if(preferred) penalty=Math.abs(s-toMin(preferred))/30;
    opts.push({slot,s,e,penalty});
  }
  return opts.sort((a,b)=>a.penalty-b.penalty || a.s-b.s);
}

function assignMeals(plan){
  const calendars=cloneCalendars(plan.calendars);
  const meals={}; let mealPenalty=0, missing=0;
  const people=Array.from(state.present).sort((a,b)=>{
    const ad=calendars[a]?.length||0, bd=calendars[b]?.length||0;
    return bd-ad || personBase(b).freeAt-personBase(a).freeAt;
  });
  for(const name of people){
    const ownedCover=state.activities.find(a=>a.type!=='future'&&a.owner===name&&a.need===true);
    const preferred=ownedCover?.preferred || state.meals[name] || '20:30';
    let opts;
    if(ownedCover){
      const s=toMin(ownedCover.preferred),e=s+60;
      const base=personBase(name);
      opts=(!hasConflict(calendars[name],s,e) && (base.blocked || s>=base.freeAt))?[{slot:ownedCover.preferred,s,e,penalty:0}]:[];
    }else{
      opts=mealOptions(name,calendars[name],null,preferred);
    }
    if(!opts.length){missing++;continue;}
    const pick=opts[0]; meals[name]=pick.slot; mealPenalty+=pick.penalty;
    calendars[name].push({s:pick.s,e:pick.e,type:'meal',label:'Jantar'});
  }
  return {...plan,calendars,meals,missingMeals:missing,mealPenalty};
}

function optimizePlan(){
  const people=Array.from(state.present);
  const tasks=taskList();
  const baseCalendars={}; people.forEach(n=>baseCalendars[n]=[]);
  let beam=[{assignments:{},calendars:baseCalendars,assigned:0,missed:0,sequence:0}];
  const BEAM=350;
  for(const task of tasks){
    const next=[];
    for(const plan of beam){
      const candidates=[];
      for(const name of people){
        if(task.kind==='cover' && name===task.owner) continue;
        const base=personBase(name);
        if(base.blocked || base.freeAt>task.start) continue;
        const ev=plan.calendars[name];
        if(hasConflict(ev,task.start,task.end)) continue;
        if(task.kind==='future'){
          const fixedMeal=state.meals[name];
          const canEat=fixedMeal
            ? (toMin(fixedMeal)>=base.freeAt && toMin(fixedMeal)+60<=task.start && !hasConflict(ev,toMin(fixedMeal),toMin(fixedMeal)+60))
            : mealOptions(name,ev,task.start,null).length>0;
          if(!canEat) continue;
        }
        candidates.push(name);
      }
      for(const name of candidates){
        const calendars=cloneCalendars(plan.calendars);
        const before=calendars[name].length;
        calendars[name].push({s:task.start,e:task.end,type:task.kind,label:task.label,machine:task.machine});
        next.push({assignments:{...plan.assignments,[task.id]:name},calendars,assigned:plan.assigned+1,missed:plan.missed,sequence:plan.sequence+(before?1:0)});
      }
      next.push({...plan,assignments:{...plan.assignments,[task.id]:null},missed:plan.missed+1});
    }
    next.sort((a,b)=>(b.assigned*100-b.missed*150+b.sequence*4)-(a.assigned*100-a.missed*150+a.sequence*4));
    const diverse=[];
    const byMiss=new Map();
    for(const item of next){
      const n=byMiss.get(item.missed)||0;
      if(n<90){diverse.push(item);byMiss.set(item.missed,n+1);}
      if(diverse.length>=BEAM)break;
    }
    beam=diverse;
  }
  const evaluated=beam.map(assignMeals).map(p=>{
    const covers=tasks.filter(t=>t.kind==='cover'&&p.assignments[t.id]).length;
    const futures=tasks.filter(t=>t.kind==='future'&&p.assignments[t.id]).length;
    const score=p.assigned*100 + covers*25 + futures*35 + p.sequence*5 - p.missed*180 - p.missingMeals*600 - p.mealPenalty;
    return {...p,score,covers,futures,totalTasks:tasks.length};
  }).sort((a,b)=>a.missingMeals-b.missingMeals || a.missed-b.missed || b.score-a.score);
  return evaluated[0]||assignMeals({assignments:{},calendars:baseCalendars,assigned:0,missed:tasks.length,sequence:0});
}
