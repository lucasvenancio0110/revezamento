function renderFinal(){
  const plan=state.bestPlan||optimizePlan();
  const events=planEvents(plan); const issues=[];
  if(plan.missingMeals)issues.push(`${plan.missingMeals} pessoa(s) sem janta.`);
  if(plan.missed)issues.push(`${plan.missed} tarefa(s) não atendida(s).`);
  $('#final').innerHTML=`<div class="card ${issues.length?'':'done'}"><h3>${issues.length?'⚠️ Melhor plano possível':'✅ Plano sem conflitos'}</h3>${issues.map(x=>`<div class="small">• ${x}</div>`).join('')}<div style="margin-top:12px">${events.map(e=>`<div class="plan-line"><time>${toTime(e.s)}</time><span>${e.text}</span></div>`).join('')}</div></div>`;
}

function update(){
  $$('.step').forEach((el,i) => el.classList.toggle('active',i===state.step));
  $$('.progress span').forEach((el,i) => el.classList.toggle('on',i<=state.step));
  $('#back').style.visibility = state.step===0 ? 'hidden' : 'visible';
  $('#next').textContent = state.step===3 ? 'Revisar ronda' : 'Continuar';
  if(state.step===2) renderRound();
  if(state.step===3) renderFinal();
  window.scrollTo({top:0,behavior:'smooth'});
}

$('#addName').onclick = () => {
  const input = $('#newName');
  const typed = input.value.trim();
  if(!typed){toast('Digite o nome');return;}
  let name = state.roster.find(x => norm(x)===norm(typed));
  if(!name){name=typed;state.roster.push(name);}
  state.present.add(name);
  input.value='';
  renderRoster();
};
$('#newName').onkeydown = e => { if(e.key==='Enter'){e.preventDefault();$('#addName').click();} };
$('#example').onclick = () => {
  $('#report').value = '*MAQUINAS EM SETUP*\\n🔴 TNL 053 - NATTAN\\n🔴 TNL 076 - CLAYTON\\n\\n*MAQUINAS EM AJUSTES*\\nTNL 033 - EWERSON\\nTNL 042 - EVERSON✅\\n\\n*PRÓXIMOS SETUPS*\\n🔴 TNL 097 - Setup 2°T (18:55)';
};
$('#parse').onclick = () => {
  const raw = $('#report').value.trim();
  if(!raw){toast('Cole o relatório');return;}
  const parsed = parseReportText(raw);
  state.activities = parsed.activities;
  state.completedPeople = parsed.completedPeople;
  state.meals = {};
  state.covers = {}; state.bestPlan=null; state.planApplied=false;
  state.step = 2;
  update();
};
$('#back').onclick = () => { if(state.step>0){state.step--;update();} };
$('#next').onclick = () => {
  if(state.step===0 && state.present.size<2){toast('Selecione ao menos 2 preparadores');return;}
  if(state.step===1){
    const raw = $('#report').value.trim();
    if(!raw){toast('Cole o relatório');return;}
    const parsed = parseReportText(raw);
    state.activities = parsed.activities;
    state.completedPeople = parsed.completedPeople;
    state.meals = {};
    state.covers = {}; state.bestPlan=null; state.planApplied=false;
    state.step = 2;
    update();
    return;
  }
  state.step = state.step===3 ? 2 : state.step+1;
  update();
};

window.__plannerTest = {parseReportText,state,optimizePlan,planEvents,personBase,taskList,assignMeals};
window.__engine={state,parseReportText,optimizePlan,taskList,personBase,assignMeals,planEvents,renderRound};
renderRoster();
update();
