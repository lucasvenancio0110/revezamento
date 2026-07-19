function renderPlanning(){
  const plan=optimizePlan(); state.bestPlan=plan;
  const events=planEvents(plan);
  const conflicts=[];
  if(plan.missingMeals)conflicts.push(`${plan.missingMeals} preparador(es) sem janela de janta.`);
  if(plan.missed)conflicts.push(`${plan.missed} tarefa(s) sem responsável.`);
  const first=events[0];
  $('#priorities').innerHTML=`<div class="card guide"><div class="guidehead"><div class="stepnum">✓</div><div><h3>${conflicts.length?'Melhor plano possível':'Plano completo encontrado'}</h3><p>${conflicts.length?conflicts.join(' '):'O motor calculou jantas, coberturas e próximos setups em conjunto.'}</p></div></div><div class="metric"><div><strong>${plan.covers||0}</strong><span class="small">revezamentos</span></div><div><strong>${plan.futures||0}</strong><span class="small">setups futuros</span></div><div><strong>${Object.keys(plan.meals||{}).length}</strong><span class="small">jantas</span></div></div></div>`;
  $('#activities').innerHTML=`<div class="card"><div class="ey">PRÓXIMA MELHOR AÇÃO</div><h2 style="font-size:23px">${first?first.text:'Revise os conflitos abaixo'}</h2><p class="small">Esta ação faz parte do melhor encaixe encontrado para o turno inteiro.</p><button id="applyPlan" class="btn primary" style="width:100%;margin-top:12px">Aplicar plano completo</button><details class="alt"><summary>Ver plano completo</summary>${events.map(e=>`<div class="plan-line"><time>${toTime(e.s)}</time><span>${e.text}</span></div>`).join('')||'<div class="empty">Nenhum evento planejado.</div>'}</details></div>`;
  $('#future').innerHTML='';
  $('#applyPlan').onclick=()=>{applyBestPlan(plan);renderRound();};
}

function applyBestPlan(plan){
  state.meals={...plan.meals}; state.covers={};
  state.activities.forEach(a=>{if(a.type==='future')a.owner=null;});
  for(const [id,name] of Object.entries(plan.assignments||{})){
    if(!name)continue;
    const [kind,raw]=id.split(':');
    if(kind==='cover'){
      const a=state.activities.find(x=>x.id===raw); if(a)state.covers[a.id]={who:name,time:a.preferred};
    }else{
      const f=state.activities.find(x=>x.id===raw); if(f)f.owner=name;
    }
  }
  state.planApplied=true;
}

function renderRound(){
  const mealPending=pendingMealStatus();
  if(mealPending){
    const answered=Object.keys(state.ate).filter(n=>state.present.has(n)).length;
    $('#freeMeals').parentElement.style.display='none';
    $('#priorities').innerHTML=`<div class="card guide"><div class="guidehead"><div class="stepnum">${answered+1}</div><div><h3>Primeiro, situação da janta</h3><p>Isso permite ao motor usar corretamente quem pode pegar os setups mais urgentes.</p></div></div><div class="progress-text">${answered} de ${state.present.size} preparadores confirmados.</div></div>`;
    $('#activities').innerHTML=mealStatusCard(mealPending); $('#future').innerHTML=''; bindRound(); return;
  }
  const ordered=collectionOrder();
  const pending=ordered.find(a=>a.need===null || (a.need===false&&!a.finish));
  const total=state.activities.filter(a=>a.type!=='future').length;
  const done=state.activities.filter(a=>a.type!=='future' && a.need!==null && (a.need===true||a.finish)).length;
  $('#freeMeals').parentElement.style.display='none';
  if(pending){
    $('#priorities').innerHTML=`<div class="card guide"><div class="guidehead"><div class="stepnum">${done+1}</div><div><h3>Próxima pergunta da ronda</h3><p>${pending.need===null?`Confirme a situação da ${pending.machine} com ${pending.owner}.`:`Registre quando ${pending.owner} ficará livre.`}</p></div></div><div class="progress-text">${done} de ${total} máquinas coletadas. O plano ainda é provisório e será recalculado.</div></div>`;
    $('#activities').innerHTML=collectionCard(pending); $('#future').innerHTML=''; bindRound();
  }else if(!state.planApplied){
    renderPlanning();
  }else{
    const events=planEvents(state.bestPlan||optimizePlan());
    $('#priorities').innerHTML=`<div class="card done"><h3>✅ Plano aplicado</h3><div class="small">Toque em Continuar para ver o resumo.</div></div>`;
    $('#activities').innerHTML=`<div class="card">${events.map(e=>`<div class="plan-line"><time>${toTime(e.s)}</time><span>${e.text}</span></div>`).join('')}</div>`;$('#future').innerHTML='';
  }
}

function bindRound(){
  $$('[data-ate]').forEach(btn=>btn.onclick=()=>{state.ate[btn.dataset.ate]=btn.dataset.value==='1';state.planApplied=false;renderRound();});
  $$('[data-need]').forEach(btn=>btn.onclick=()=>{
    const a=state.activities.find(x=>x.id===btn.dataset.need);a.need=btn.dataset.value==='1';
    if(a.need){a.finish=null;} state.planApplied=false;renderRound();
  });
  $$('[data-finish]').forEach(input=>input.onchange=()=>{const a=state.activities.find(x=>x.id===input.dataset.finish);a.finish=input.value;state.planApplied=false;});
  $$('[data-pref]').forEach(input=>input.onchange=()=>{const a=state.activities.find(x=>x.id===input.dataset.pref);a.preferred=input.value;state.planApplied=false;});
  $$('[data-confirm-finish]').forEach(btn=>btn.onclick=()=>{
    const a=state.activities.find(x=>x.id===btn.dataset.confirmFinish);
    const fi=document.querySelector(`[data-finish="${a.id}"]`),pr=document.querySelector(`[data-pref="${a.id}"]`);
    a.finish=fi.value;a.preferred=pr.value;renderRound();
  });
}
