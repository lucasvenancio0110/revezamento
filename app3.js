function pendingMealStatus(){
  return Array.from(state.present).find(name => state.ate[name] === undefined) || null;
}

function mealStatusCard(name){
  const base=personBase(name);
  return `<article class="card guide"><div class="guidehead"><div class="stepnum">🍽️</div><div><h3>${name} já jantou?</h3><p>${base.reason}. Essa resposta muda quem pode assumir os setups mais cedo.</p></div></div><div class="choice" style="margin-top:14px"><button type="button" data-ate="${name}" data-value="1">Já jantou</button><button type="button" data-ate="${name}" data-value="0">Ainda não</button></div></article>`;
}

function collectionOrder(){
  const current=state.activities.filter(a=>a.type!=='future');
  const countByOwner={}; current.forEach(a=>countByOwner[a.owner]=(countByOwner[a.owner]||0)+1);
  return [...current].sort((a,b)=>{
    const au=a.need===null?0:(a.need===false&&!a.finish?1:2);
    const bu=b.need===null?0:(b.need===false&&!b.finish?1:2);
    if(au!==bu)return au-bu;
    if(a.type!==b.type)return a.type==='adjust'?-1:1;
    return (countByOwner[b.owner]||0)-(countByOwner[a.owner]||0);
  });
}

function collectionCard(a){
  return `<article class="card activity guide">
    <div class="main"><div class="toprow"><div><div class="machine">${a.type==='setup'?'🔴':'🟡'} ${a.machine}</div><div class="owner">${a.owner}</div></div><span class="badge">${a.type==='setup'?'SETUP':'AJUSTE'}</span></div>
    ${a.need===null?`<div class="choice"><button type="button" data-need="${a.id}" data-value="0">Vai terminar</button><button type="button" data-need="${a.id}" data-value="1">Precisa revezar</button></div>`:
    `<div class="detail"><div class="field"><label>Que horas termina?</label><input class="input" type="time" data-finish="${a.id}" value="${a.finish||'19:00'}"></div><div class="field"><label>Preferência de janta</label><input class="input" type="time" min="18:00" max="20:30" step="1800" data-pref="${a.id}" value="${a.preferred}"></div><button type="button" class="btn primary" style="width:100%;margin-top:12px" data-confirm-finish="${a.id}">Confirmar e avançar</button></div>`}
    </div></article>`;
}

function planEvents(plan){
  const rows=[];
  Object.entries(state.ate).forEach(([name,ate])=>{if(ate===true)rows.push({s:1079,text:`${name} → já havia jantado`});});
  Object.entries(plan.meals||{}).forEach(([name,slot])=>rows.push({s:toMin(slot),text:`${name} → jantar até ${toTime(toMin(slot)+60)}`}));
  const tasks=taskList();
  tasks.forEach(t=>{const who=plan.assignments[t.id];if(who)rows.push({s:t.start,text:`${who} → ${t.label}`});});
  return rows.sort((a,b)=>a.s-b.s);
}
