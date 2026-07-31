(()=>{
'use strict';

const BASE=['Alan','Christoffer','Clayton','Everson','Ewerson','Juliano','Lucas V.','Luciano','Marcio','Marlon','Nattan','Sebastião','Wendel'];
const SLOTS=['18:00','18:30','19:00','19:30','20:00','20:30'];
const FINISH=['18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30'];
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const toMin=t=>{const [h,m]=String(t||'00:00').split(':').map(Number);return h*60+m};
const toTime=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const overlaps=(a1,a2,b1,b2)=>a1<b2&&a2>b1;
const machineFmt=v=>{const m=String(v||'').match(/\d{1,3}/);return m?`TNL ${String(m[0]).padStart(3,'0')}`:''};
const degreeEmoji=d=>d==='red'?'🔴':d==='green'?'🟢':d==='blue'?'🔵':'';

const state={
  step:0,
  roster:[...BASE],
  present:new Set(),
  people:{},
  future:[],
  phase:'future',
  view:'main',
  selected:null,
  showWhy:false,
  showOptions:false,
  report:''
};

function toast(message){
  const el=$('#toast');
  if(!el)return;
  el.textContent=message;
  el.classList.add('show');
  clearTimeout(window.__toast);
  window.__toast=setTimeout(()=>el.classList.remove('show'),1800);
}

function renderRoster(){
  $('#roster').innerHTML=state.roster.map(name=>`<button class="person-chip ${state.present.has(name)?'selected':''}" data-person="${name}">${name}</button>`).join('');
  $('#count').textContent=`${state.present.size} presentes`;
  $$('[data-person]').forEach(button=>button.onclick=()=>{
    const name=button.dataset.person;
    state.present.has(name)?state.present.delete(name):state.present.add(name);
    renderRoster();
  });
}

function ownerOf(line){
  const upper=norm(line);
  return Array.from(state.present).sort((a,b)=>b.length-a.length).find(name=>upper.includes(norm(name)))||null;
}

function setupDegree(line){
  if(line.includes('🔴'))return'red';
  if(line.includes('🟢'))return'green';
  if(line.includes('🔵'))return'blue';
  return null;
}

function parseReport(raw){
  state.report=raw;
  state.people={};
  let order=0;
  for(const name of state.present){
    state.people[name]={
      name,
      status:'free',
      source:'not_reported',
      machine:null,
      degree:null,
      order:999,
      confirmed:true,
      outcome:null,
      finish:null,
      dinner:null,
      cover:null,
      coverTime:null
    };
  }
  state.future=[];
  let section='';
  for(const original of raw.split(/\n/)){
    const line=original.trim();
    if(!line)continue;
    const upper=norm(line).replace(/\*/g,'');
    if(upper.includes('PROXIMOS SETUPS')){section='future';continue}
    if(upper==='SETUP:'||upper==='SETUP'||upper.includes('MAQUINAS EM SETUP')){section='setup';continue}
    if(upper.includes('MAQUINAS EM AJUSTES')||upper==='AJUSTES:'||upper==='AJUSTES'){section='adjust';continue}
    if(upper.includes('MANUTENCAO')||upper.includes('SETUPS 3')||upper.includes('BOM TRABALHO')){section='';continue}
    const machine=machineFmt(line);
    if(!machine||!section)continue;
    if(section==='future'){
      const time=(line.match(/\b(\d{1,2}:\d{2})\b/)||[])[1]||'20:30';
      state.future.push({machine,time,degree:setupDegree(line),owner:null});
      continue;
    }
    if(line.includes('✅'))continue;
    const owner=ownerOf(line);
    if(!owner)continue;
    state.people[owner]={
      ...state.people[owner],
      status:section,
      source:'report',
      machine,
      degree:section==='setup'?setupDegree(line):null,
      order:order++,
      confirmed:false
    };
  }
  state.future.sort((a,b)=>toMin(a.time)-toMin(b.time));
  state.phase='future';
  state.view='main';
  state.selected=null;
  state.showWhy=false;
  state.showOptions=false;
  return state.present.size>0;
}

const person=name=>state.people[name];
const futureFor=name=>state.future.filter(item=>item.owner===name);

function futureCandidate(name,item,reserved){
  const p=person(name);
  let score=0;
  let short='';
  const details=[];
  if(reserved.has(name))return{name,score:-999,short:'Já está reservado em outro próximo setup.',details:['Um preparador não pode iniciar dois próximos setups ao mesmo tempo.']};
  if(!p)return{name,score:-999,short:'Sem informação.',details:[]};
  if(p.status==='free'){
    score=120;
    short='Não aparece em setup ou ajuste no relatório.';
    details.push('É a opção mais livre conhecida neste momento.');
  }else if(p.status==='adjust'){
    score=72;
    short=`Está em ajuste na ${p.machine}.`;
    details.push(`Só assume às ${item.time} se o ajuste terminar antes.`);
    if(toMin(item.time)<=19*60)score-=18;
  }else{
    score=48;
    short=`Está em setup na ${p.machine}.`;
    details.push(`Só assume às ${item.time} se o setup atual terminar antes.`);
    if(toMin(item.time)<=19*60)score-=22;
  }
  details.push('O sistema não avalia experiência por modelo de máquina; a decisão final continua sendo sua.');
  return{name,score,short,details};
}

function suggestedFuturePlan(){
  const plan=new Map();
  const reserved=new Set(state.future.filter(f=>f.owner).map(f=>f.owner));
  state.future.forEach((item,index)=>{if(item.owner)plan.set(index,{name:item.owner,manual:true,score:999,short:'Definido por você.',details:[]})});
  state.future.forEach((item,index)=>{
    if(item.owner)return;
    const ranked=Array.from(state.present).map(name=>futureCandidate(name,item,reserved)).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'pt-BR'));
    const best=ranked.find(option=>option.score>-999);
    if(best){plan.set(index,best);reserved.add(best.name)}
  });
  return plan;
}

function currentFutureIndex(){return state.future.findIndex(item=>!item.owner)}

function futureAlternativeOptions(item,index){
  const used=new Set(state.future.map((future,i)=>i===index?null:future.owner).filter(Boolean));
  return Array.from(state.present).map(name=>futureCandidate(name,item,used)).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'pt-BR'));
}

function applyFutureDinnerSuggestions(){
  for(const item of state.future){
    const p=person(item.owner);
    if(!p||p.status!=='free'||p.dinner)continue;
    const valid=SLOTS.filter(slot=>toMin(slot)+60<=toMin(item.time));
    if(valid.length){
      p.dinner=valid[valid.length-1];
      p.dinnerAuto=true;
    }
  }
}

function activityLabel(p){
  if(p.status==='adjust')return`Ajuste · ${p.machine}`;
  if(p.status==='setup')return`${degreeEmoji(p.degree)} Setup · ${p.machine}`;
  return'Livre no relatório';
}

function phaseCounts(){
  const adjust=Object.values(state.people).filter(p=>p.status==='adjust');
  const currentSetups=Object.values(state.people).filter(p=>p.status==='setup');
  const futureNeeds=state.future.filter(f=>{const p=person(f.owner);return p&&!p.dinner&&!currentSetups.some(s=>s.name===p.name)});
  return{
    futureDone:state.future.filter(f=>f.owner).length,
    futureTotal:state.future.length,
    adjustDone:adjust.filter(p=>p.confirmed).length,
    adjustTotal:adjust.length,
    setupDone:currentSetups.filter(p=>p.confirmed).length+futureNeeds.filter(f=>person(f.owner)?.futureDinnerDone).length,
    setupTotal:currentSetups.length+futureNeeds.length
  };
}

function phaseBar(){
  const c=phaseCounts();
  const cls=phase=>state.phase===phase?'active':(['future','adjust','setup'].indexOf(state.phase)>['future','adjust','setup'].indexOf(phase)?'done':'');
  return`<div class="phase-bar">
    <div class="phase-pill ${cls('future')}"><b>1</b><span>Setups</span><small>${c.futureDone}/${c.futureTotal}</small></div>
    <div class="phase-pill ${cls('adjust')}"><b>2</b><span>Ajustes</span><small>${c.adjustDone}/${c.adjustTotal}</small></div>
    <div class="phase-pill ${cls('setup')}"><b>3</b><span>Revezar</span><small>${c.setupDone}/${c.setupTotal}</small></div>
  </div>`;
}

function compactFutureSummary(){
  if(!state.future.length)return'';
  return`<div class="mini-plan">${state.future.map(f=>`<div class="mini-plan-item ${f.owner?'ok':''}"><time>${f.time}</time><strong>${degreeEmoji(f.degree)} ${f.machine}</strong><span>${f.owner||'Pendente'}</span></div>`).join('')}</div>`;
}

function renderFuturePhase(){
  const index=currentFutureIndex();
  const assigned=state.future.filter(f=>f.owner).length;
  if(index<0){
    applyFutureDinnerSuggestions();
    const auto=state.future.filter(f=>person(f.owner)?.dinnerAuto);
    const waiting=state.future.filter(f=>!person(f.owner)?.dinner);
    return`${phaseBar()}<section class="focus-card success-card">
      <div class="eyebrow">PASSO 1 CONCLUÍDO</div>
      <h3>Próximos setups definidos</h3>
      ${compactFutureSummary()}
      ${auto.length?`<div class="smart-note"><b>Jantares já encaixados</b><span>${auto.map(f=>`${f.owner} ${person(f.owner).dinner}–${toTime(toMin(person(f.owner).dinner)+60)}`).join(' · ')}</span></div>`:''}
      ${waiting.length?`<div class="smart-note warning"><b>Precisarão de cobertura</b><span>${waiting.map(f=>`${f.owner} na ${f.machine}`).join(' · ')}</span></div>`:''}
      <button id="goAdjust" class="primary-action">Ir para ajustes</button>
      <button id="editFuture" class="text-action">Revisar escolhas</button>
    </section>`;
  }
  const item=state.future[index];
  const plan=suggestedFuturePlan();
  const best=plan.get(index);
  const alternatives=futureAlternativeOptions(item,index).filter(option=>option.name!==best?.name&&option.score>-999);
  return`${phaseBar()}<section class="focus-card">
    <div class="focus-progress"><span>PRÓXIMO SETUP ${assigned+1} DE ${state.future.length}</span><span>${assigned}/${state.future.length} definidos</span></div>
    <div class="machine-hero"><div><time>${item.time}</time><h3>${degreeEmoji(item.degree)} ${item.machine}</h3></div></div>
    <div class="recommend-box">
      <div class="recommend-label">RECOMENDAÇÃO</div>
      <strong>${best?.name||'Sem recomendação'}</strong>
      <p>${best?.short||'Escolha manualmente.'}</p>
      <button class="why-toggle" data-toggle-why>${state.showWhy?'Ocultar motivo':'Por quê?'}</button>
      ${state.showWhy?`<div class="why-content">${(best?.details||[]).map(text=>`<span>• ${text}</span>`).join('')}</div>`:''}
    </div>
    <button class="primary-action" data-confirm-future="${best?.name||''}" ${best?'':'disabled'}>Confirmar ${best?.name||''}</button>
    <button class="secondary-action" data-toggle-options>Escolher outra pessoa</button>
    ${state.showOptions?`<div class="option-sheet">${alternatives.map(option=>`<button data-pick-future="${option.name}"><b>${option.name}</b><span>${option.short}</span></button>`).join('')}</div>`:''}
    ${assigned?compactFutureSummary():''}
  </section>`;
}

function adjustmentPeople(){return Object.values(state.people).filter(p=>p.status==='adjust').sort((a,b)=>a.order-b.order)}
function currentAdjustment(){return adjustmentPeople().find(p=>!p.confirmed)||null}

function dinnerCommitments(name){
  const list=[];
  const p=person(name);
  if(p?.dinner)list.push({start:toMin(p.dinner),end:toMin(p.dinner)+60,label:`jantar ${p.dinner}`});
  for(const f of futureFor(name))list.push({start:toMin(f.time),end:9999,label:`${f.machine} às ${f.time}`});
  for(const target of Object.values(state.people))if(target.cover===name&&target.coverTime)list.push({start:toMin(target.coverTime),end:toMin(target.coverTime)+60,label:`cobrir ${target.name}`});
  return list;
}

function dinnerOptions(p){
  const finish=p.finish?toMin(p.finish):18*60;
  const futures=futureFor(p.name);
  const pendingSetups=setupTasks().filter(task=>!task.done&&task.name!==p.name).length;
  return SLOTS.map(slot=>{
    const start=toMin(slot),end=start+60;
    let score=100;
    const reasons=[];
    const warnings=[];
    if(start<finish){score-=500;warnings.push(`A atividade só termina às ${p.finish}.`)}
    for(const f of futures){
      if(overlaps(start,end,toMin(f.time),9999)){score-=500;warnings.push(`Conflita com ${f.machine} às ${f.time}.`)}
      else if(end<=toMin(f.time)){score+=40+start/100;reasons.push(`Termina antes da ${f.machine} às ${f.time}.`)}
    }
    if(!futures.length){score-=start/20;reasons.push(`Fica livre às ${toTime(end)} para ajudar nos revezamentos.`)}
    if(pendingSetups)score+=Math.max(0,30-(start-18*60)/10);
    if(!warnings.length&&!reasons.length)reasons.push('Não cria conflito conhecido.');
    return{slot,score,reasons,warnings};
  }).sort((a,b)=>b.score-a.score||toMin(a.slot)-toMin(b.slot));
}

function finishDinnerCard(p,backLabel){
  const options=dinnerOptions(p);
  const best=options[0];
  return`${phaseBar()}<section class="focus-card">
    <button class="back-link" data-back-decision>← ${backLabel}</button>
    <div class="eyebrow">${p.status==='adjust'?'AJUSTE':'SETUP'} · ${p.name}</div>
    <h3>${activityLabel(p)}</h3>
    ${state.view==='finishTime'?`
      <div class="question">Que horas termina?</div>
      <div class="time-grid">${FINISH.map(time=>`<button data-finish-time="${time}" class="${p.finish===time?'selected':''}">${time}</button>`).join('')}</div>
    `:`
      <div class="recommend-box dinner-box">
        <div class="recommend-label">MELHOR JANTAR</div>
        <strong>${best.slot} → ${toTime(toMin(best.slot)+60)}</strong>
        <p>${best.reasons[0]||best.warnings[0]}</p>
        <button class="why-toggle" data-toggle-why>${state.showWhy?'Ocultar impacto':'Ver impacto'}</button>
        ${state.showWhy?`<div class="why-content">${best.reasons.concat(best.warnings).map(text=>`<span>• ${text}</span>`).join('')}</div>`:''}
      </div>
      <button class="primary-action" data-confirm-dinner="${best.slot}">Confirmar horário</button>
      <button class="secondary-action" data-toggle-options>Outros horários</button>
      ${state.showOptions?`<div class="option-sheet">${options.slice(1).map(option=>`<button data-pick-dinner="${option.slot}" class="${option.score<0?'blocked':''}"><b>${option.slot} → ${toTime(toMin(option.slot)+60)}</b><span>${option.reasons[0]||option.warnings[0]}</span></button>`).join('')}</div>`:''}
    `}
  </section>`;
}

function renderAdjustPhase(){
  const current=currentAdjustment();
  if(!current){
    return`${phaseBar()}<section class="focus-card success-card">
      <div class="eyebrow">AJUSTES CONCLUÍDOS</div>
      <h3>Agora o sistema já sabe quem fica livre</h3>
      <div class="simple-list">${adjustmentPeople().map(p=>`<div><b>${p.name}</b><span>${p.dinner?`Jantar ${p.dinner}–${toTime(toMin(p.dinner)+60)}`:'Não ficará livre para cobertura'}</span></div>`).join('')||'<span>Nenhum ajuste no relatório.</span>'}</div>
      <button id="goSetup" class="primary-action">Organizar setups</button>
    </section>`;
  }
  state.selected=current.name;
  if(state.view==='finishTime'||state.view==='dinner')return finishDinnerCard(current,'Voltar');
  return`${phaseBar()}<section class="focus-card">
    <div class="focus-progress"><span>AJUSTE</span><span>${adjustmentPeople().filter(p=>p.confirmed).length+1} de ${adjustmentPeople().length}</span></div>
    <div class="person-hero"><div class="avatar">${current.name[0]}</div><div><h3>${current.name}</h3><p>${current.machine}</p></div></div>
    <div class="question">Esse ajuste vai terminar?</div>
    <div class="choice-grid">
      <button data-adjust-outcome="finish"><b>Sim</b><span>Informar horário e jantar</span></button>
      <button data-adjust-outcome="blocked"><b>Não</b><span>Não usar para cobertura</span></button>
    </div>
  </section>`;
}

function setupTasks(){
  const current=Object.values(state.people).filter(p=>p.status==='setup').sort((a,b)=>a.order-b.order).map(p=>({id:`current:${p.name}`,type:'current',name:p.name,machine:p.machine,degree:p.degree,start:null,done:p.confirmed}));
  const currentNames=new Set(current.map(task=>task.name));
  const future=state.future.filter(f=>{
    const p=person(f.owner);
    return p&&!p.dinner&&!currentNames.has(p.name);
  }).map(f=>({id:`future:${f.machine}`,type:'future',name:f.owner,machine:f.machine,degree:f.degree,start:f.time,done:Boolean(person(f.owner)?.futureDinnerDone)}));
  return current.concat(future);
}

function currentSetupTask(){return setupTasks().find(task=>!task.done)||null}

function candidateAvailability(name,target,slot){
  const p=person(name),start=toMin(slot),end=start+60;
  if(!p||name===target.name)return{ok:false,score:-999,reason:name===target.name?'É o próprio preparador.':'Sem dados.'};
  const conflicts=dinnerCommitments(name).filter(item=>overlaps(start,end,item.start,item.end));
  if(conflicts.length)return{ok:false,score:-100,reason:`Conflito com ${conflicts[0].label}.`};
  if(p.status==='free')return{ok:true,score:110,reason:'Livre no relatório e sem conflito nesta janela.'};
  if((p.status==='adjust'||p.status==='setup')&&p.confirmed&&p.outcome==='finish'&&p.finish&&toMin(p.finish)<=start){
    return{ok:true,score:p.status==='adjust'?125:115,reason:`Termina ${p.machine} às ${p.finish} e estará livre.`};
  }
  if((p.status==='adjust'||p.status==='setup')&&!p.confirmed)return{ok:false,score:-30,reason:'Ainda não foi confirmado na ronda.'};
  return{ok:false,score:-60,reason:'Não estará livre durante toda a janela.'};
}

function coveragePlans(target){
  const minStart=target.type==='future'?toMin(target.start):18*60;
  const plans=[];
  for(const slot of SLOTS){
    if(toMin(slot)<minStart)continue;
    const candidates=Array.from(state.present).map(name=>({name,...candidateAvailability(name,target,slot)})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'pt-BR'));
    const best=candidates.find(c=>c.ok)||candidates[0];
    plans.push({slot,candidate:best,candidates,score:(best?.score||-999)-(toMin(slot)-minStart)/10});
  }
  return plans.sort((a,b)=>b.score-a.score||toMin(a.slot)-toMin(b.slot));
}

function coverageCard(task){
  const plans=coveragePlans(task);
  const best=plans[0];
  return`${phaseBar()}<section class="focus-card">
    <button class="back-link" data-back-decision>← Voltar</button>
    <div class="eyebrow">MELHOR PLANO</div>
    <div class="machine-hero compact"><div><time>${task.start||'EM ANDAMENTO'}</time><h3>${degreeEmoji(task.degree)} ${task.machine}</h3><p>${task.name}</p></div></div>
    <div class="plan-pair">
      <div><small>JANTAR</small><b>${best?.slot||'—'} → ${best?toTime(toMin(best.slot)+60):'—'}</b></div>
      <div><small>COBERTURA</small><b>${best?.candidate?.ok?best.candidate.name:'Não confirmada'}</b></div>
    </div>
    <p class="single-reason">${best?.candidate?.reason||'Não há cobertura disponível.'}</p>
    <button class="primary-action" data-confirm-coverage="${best?.slot||''}" data-cover-name="${best?.candidate?.ok?best.candidate.name:''}" ${best?.candidate?.ok?'':'disabled'}>Confirmar plano</button>
    <button class="secondary-action" data-toggle-options>Ver outras opções</button>
    ${state.showOptions?`<div class="option-sheet">${plans.slice(1).map(plan=>`<button data-pick-coverage="${plan.slot}" data-cover-name="${plan.candidate?.ok?plan.candidate.name:''}" class="${plan.candidate?.ok?'':'blocked'}"><b>${plan.slot} · ${plan.candidate?.ok?plan.candidate.name:'Sem cobertura'}</b><span>${plan.candidate?.reason||''}</span></button>`).join('')}</div>`:''}
  </section>`;
}

function renderSetupPhase(){
  const task=currentSetupTask();
  if(!task){
    return`${phaseBar()}<section class="focus-card success-card">
      <div class="eyebrow">PLANEJAMENTO CONCLUÍDO</div>
      <h3>Turno organizado</h3>
      <p class="lead">Revise o resumo e envie para o grupo.</p>
      <button id="goFinal" class="primary-action">Abrir plano final</button>
    </section>`;
  }
  state.selected=task.name;
  if(state.view==='finishTime'||state.view==='dinner')return finishDinnerCard(person(task.name),'Voltar');
  if(state.view==='coverage')return coverageCard(task);
  if(task.type==='future'){
    return`${phaseBar()}<section class="focus-card">
      <div class="focus-progress"><span>JANTAR APÓS PRÓXIMO SETUP</span><span>${task.start}</span></div>
      <div class="person-hero"><div class="avatar">${task.name[0]}</div><div><h3>${task.name}</h3><p>${degreeEmoji(task.degree)} ${task.machine}</p></div></div>
      <div class="smart-note"><b>Precisa de revezamento</b><span>Não existe uma hora completa de jantar antes do início deste setup.</span></div>
      <button data-open-coverage class="primary-action">Ver melhor plano</button>
    </section>`;
  }
  const p=person(task.name);
  return`${phaseBar()}<section class="focus-card">
    <div class="focus-progress"><span>SETUP EM ANDAMENTO</span><span>${setupTasks().filter(t=>t.done).length+1} de ${setupTasks().length}</span></div>
    <div class="person-hero"><div class="avatar">${p.name[0]}</div><div><h3>${p.name}</h3><p>${degreeEmoji(p.degree)} ${p.machine}</p></div></div>
    <div class="question">O que vai acontecer?</div>
    <div class="choice-grid">
      <button data-setup-outcome="finish"><b>Vai terminar</b><span>Informar horário e jantar</span></button>
      <button data-setup-outcome="cover"><b>Precisa revezar</b><span>Ver horário + cobertura</span></button>
    </div>
  </section>`;
}

function renderRound(){
  const container=$('#round');
  if(state.phase==='future')container.innerHTML=renderFuturePhase();
  else if(state.phase==='adjust')container.innerHTML=renderAdjustPhase();
  else container.innerHTML=renderSetupPhase();
  bindRound();
}

function saveDinner(p,slot){
  p.dinner=slot;
  p.confirmed=true;
  p.cover=null;
  p.coverTime=null;
  state.view='main';
  state.showWhy=false;
  state.showOptions=false;
  toast(`${p.name}: jantar ${slot}`);
  renderRound();
}

function saveCoverage(task,slot,cover){
  const p=person(task.name);
  p.outcome='cover';
  p.dinner=slot;
  p.coverTime=slot;
  p.cover=cover;
  p.confirmed=true;
  if(task.type==='future')p.futureDinnerDone=true;
  state.view='main';
  state.showOptions=false;
  toast(`${cover} cobre ${p.name}`);
  renderRound();
}

function bindRound(){
  $('[data-toggle-why]')?.addEventListener('click',()=>{state.showWhy=!state.showWhy;renderRound()});
  $('[data-toggle-options]')?.addEventListener('click',()=>{state.showOptions=!state.showOptions;renderRound()});

  $('[data-confirm-future]')?.addEventListener('click',event=>{
    const name=event.currentTarget.dataset.confirmFuture;
    const index=currentFutureIndex();
    if(index<0||!name)return;
    state.future[index].owner=name;
    state.showWhy=false;
    state.showOptions=false;
    toast(`${name} definido para ${state.future[index].machine}`);
    renderRound();
  });
  $$('[data-pick-future]').forEach(button=>button.onclick=()=>{
    const index=currentFutureIndex();
    if(index<0)return;
    state.future[index].owner=button.dataset.pickFuture;
    state.showOptions=false;
    renderRound();
  });
  $('#goAdjust')?.addEventListener('click',()=>{state.phase='adjust';state.view='main';renderRound()});
  $('#editFuture')?.addEventListener('click',()=>{
    state.future.forEach(f=>f.owner=null);
    Object.values(state.people).forEach(p=>{if(p.dinnerAuto){p.dinner=null;p.dinnerAuto=false}});
    renderRound();
  });

  $$('[data-adjust-outcome]').forEach(button=>button.onclick=()=>{
    const p=person(state.selected);
    if(button.dataset.adjustOutcome==='finish'){
      p.outcome='finish';
      p.finish=p.finish||'18:00';
      state.view='finishTime';
    }else{
      p.outcome='blocked';
      p.confirmed=true;
      p.finish=null;
      p.dinner=null;
      state.view='main';
    }
    renderRound();
  });
  $$('[data-setup-outcome]').forEach(button=>button.onclick=()=>{
    const p=person(state.selected);
    if(button.dataset.setupOutcome==='finish'){
      p.outcome='finish';
      p.finish=p.finish||'18:00';
      state.view='finishTime';
    }else{
      p.outcome='cover';
      state.view='coverage';
    }
    renderRound();
  });
  $('[data-open-coverage]')?.addEventListener('click',()=>{state.view='coverage';renderRound()});
  $$('[data-finish-time]').forEach(button=>button.onclick=()=>{
    const p=person(state.selected);
    p.finish=button.dataset.finishTime;
    state.view='dinner';
    state.showWhy=false;
    state.showOptions=false;
    renderRound();
  });
  $('[data-confirm-dinner]')?.addEventListener('click',event=>saveDinner(person(state.selected),event.currentTarget.dataset.confirmDinner));
  $$('[data-pick-dinner]').forEach(button=>button.onclick=()=>{
    if(button.classList.contains('blocked'))return;
    saveDinner(person(state.selected),button.dataset.pickDinner);
  });
  $('[data-confirm-coverage]')?.addEventListener('click',event=>{
    const task=currentSetupTask();
    const slot=event.currentTarget.dataset.confirmCoverage;
    const cover=event.currentTarget.dataset.coverName;
    if(task&&slot&&cover)saveCoverage(task,slot,cover);
  });
  $$('[data-pick-coverage]').forEach(button=>button.onclick=()=>{
    if(button.classList.contains('blocked'))return;
    const task=currentSetupTask();
    const slot=button.dataset.pickCoverage;
    const cover=button.dataset.coverName;
    if(task&&slot&&cover)saveCoverage(task,slot,cover);
  });
  $('[data-back-decision]')?.addEventListener('click',()=>{state.view='main';state.showWhy=false;state.showOptions=false;renderRound()});
  $('#goSetup')?.addEventListener('click',()=>{state.phase='setup';state.view='main';renderRound()});
  $('#goFinal')?.addEventListener('click',()=>{state.step=3;update()});
}

function nowText(p){
  if(p.status==='setup')return`Agora: Setup ${degreeEmoji(p.degree)} ${p.machine}${p.outcome==='finish'?' — TERMINA':''}`;
  if(p.status==='adjust')return`Agora: Ajuste ${p.machine}${p.outcome==='finish'?' — TERMINA':''}`;
  return'Agora: Livre';
}

function operationalReport(){
  const lines=['*2º TURNO — PLANO OPERACIONAL*',''];
  const covers=Object.values(state.people).filter(p=>p.cover&&p.coverTime);
  if(covers.length){
    lines.push('*REVEZAMENTOS*');
    covers.forEach(p=>lines.push(`🔄 ${p.cover} cobre ${p.name} — ${p.machine||futureFor(p.name)[0]?.machine||''} — ${p.coverTime} às ${toTime(toMin(p.coverTime)+60)}`));
    lines.push('');
  }
  for(const name of state.present){
    const p=person(name);
    const future=futureFor(name);
    if(!p)continue;
    lines.push(`*${name.toUpperCase()}*`,nowText(p));
    if(p.dinner)lines.push(`Jantar: ${p.dinner} às ${toTime(toMin(p.dinner)+60)}`);
    else lines.push('Jantar: a definir');
    if(p.cover)lines.push(`🔄 Cobertura: ${p.cover}`);
    const covering=Object.values(state.people).find(target=>target.cover===name&&target.coverTime);
    if(covering)lines.push(`Depois: cobre ${covering.name} — ${covering.coverTime} às ${toTime(toMin(covering.coverTime)+60)}`);
    future.forEach(f=>lines.push(`Depois: assume Setup ${degreeEmoji(f.degree)} ${f.machine} às ${f.time}`));
    lines.push('');
  }
  if(state.future.length){
    lines.push('*PRÓXIMOS SETUPS*');
    state.future.forEach(f=>lines.push(`${degreeEmoji(f.degree)} ${f.machine} — ${f.time} — ${f.owner||'Sem responsável'}`));
  }
  return lines.join('\n').trim();
}

function renderFinal(){
  const report=operationalReport();
  const missing=Object.values(state.people).filter(p=>!p.dinner).length;
  $('#final').innerHTML=`<section class="final-card">
    <div class="final-status ${missing?'warning':''}"><b>${missing?'Plano montado com pendências':'Plano pronto'}</b><span>${missing?`${missing} jantar(es) ainda a definir`:'Todos os jantares definidos'}</span></div>
    <textarea id="groupReport" rows="22">${report}</textarea>
    <div class="final-actions"><button id="copyReport" class="primary-action">Copiar relatório</button><button id="openWhatsapp" class="secondary-action">Abrir WhatsApp</button></div>
  </section>`;
  $('#copyReport').onclick=async()=>{await navigator.clipboard.writeText($('#groupReport').value);toast('Relatório copiado')};
  $('#openWhatsapp').onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent($('#groupReport').value)}`,'_blank');
}

function update(){
  $$('.step').forEach((section,index)=>section.classList.toggle('active',index===state.step));
  $$('.progress span').forEach((span,index)=>span.classList.toggle('on',index<=state.step));
  $('#back').style.visibility=state.step===0?'hidden':'visible';
  $('#next').style.display=state.step===2?'none':'block';
  $('#next').textContent=state.step===3?'Voltar ao planejamento':'Continuar';
  document.body.classList.toggle('planning',state.step===2);
  if(state.step===2)renderRound();
  if(state.step===3)renderFinal();
  window.scrollTo({top:0,behavior:'smooth'});
}

$('#addName').onclick=()=>{
  const value=$('#newName').value.trim();
  if(!value)return;
  let name=state.roster.find(item=>norm(item)===norm(value));
  if(!name){name=value;state.roster.push(name);state.roster.sort((a,b)=>a.localeCompare(b,'pt-BR'))}
  state.present.add(name);
  $('#newName').value='';
  renderRoster();
};

$('#example').onclick=()=>{
  $('#report').value=`*2° TURNO*\n\n*SETUP:*\n🔴 TNL 029 - EWERSON\n🔴 TNL 073 - CLAYTON\n🔴 TNL 077 - WENDEL\n🔴 TNL 112 - LUCIANO\n🔴 TNL 139 - JULIANO\n\n*PRÓXIMOS SETUPS:*\n🔴 TNL 027 - Setup 2°T (18:00)\n🔴 TNL 135 - Setup 2°T (18:30)\n🔴 TNL 130 - Setup 2°T (19:00)\n🔴 TNL 005 - Setup 2°T (20:30)\n\n*MÁQUINAS EM AJUSTES:*\nTNL 061 - EVERSON`;
};

$('#parse').onclick=()=>{
  if(!state.present.size){toast('Selecione os presentes');return}
  parseReport($('#report').value);
  state.step=2;
  update();
};

$('#back').onclick=()=>{
  if(state.step===2&&state.view!=='main'){state.view='main';state.showWhy=false;state.showOptions=false;renderRound();return}
  if(state.step>0){state.step--;update()}
};

$('#next').onclick=()=>{
  if(state.step===0&&state.present.size<1){toast('Selecione os presentes');return}
  if(state.step===1){
    if(!parseReport($('#report').value)){toast('Selecione os presentes');return}
    state.step=2;
  }else if(state.step===3){
    state.step=2;
  }else state.step++;
  update();
};

renderRoster();
update();
})();
