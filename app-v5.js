(()=>{
'use strict';
const BASE=['Lucas V.','Lucas R.','Marlon','Ewerson','Everson','Clayton','Wendel','Gabriel','Adriano','Luciano','Juliano','Nattan','Marcio','Christoffer','Patrício','Mateus','Alan','Shaiane','Willians'];
const SLOTS=['18:00','18:30','19:00','19:30','20:00','20:30'];
const state={step:0,roster:[...BASE],present:new Set(),current:[],future:[],decisions:{},roundIndex:0,plan:null};
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const toMin=t=>{const p=String(t).split(':').map(Number);return p[0]*60+p[1]};
const toTime=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const uid=()=>Math.random().toString(36).slice(2);
function toast(msg){const e=$('#toast');if(!e)return;e.textContent=msg;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1500)}
function renderRoster(){
 const box=$('#roster');
 box.innerHTML=state.roster.map(n=>`<button class="chip ${state.present.has(n)?'sel':''}" data-person="${n}">${n}</button>`).join('');
 $$('[data-person]').forEach(b=>b.onclick=()=>{const n=b.dataset.person;state.present.has(n)?state.present.delete(n):state.present.add(n);renderRoster()});
 $('#count').textContent=`${state.present.size} presentes`;
}
function ownerOf(line){const u=norm(line);return Array.from(state.present).sort((a,b)=>b.length-a.length).find(n=>u.includes(norm(n).replace('.',''))||u.includes(norm(n)))||null}
function parseReport(raw){
 let sec='';const current=[],future=[];
 raw.split(/\n/).forEach(r=>{
  const line=r.trim();if(!line)return;const u=norm(line).replace(/\*/g,'');
  if(u.includes('PROXIMOS SETUPS')){sec='future';return}
  if(u==='SETUP:'||u==='SETUP'||u.includes('MAQUINAS EM SETUP')){sec='setup';return}
  if(u.includes('MAQUINAS EM AJUSTES')||u==='AJUSTES:'||u==='AJUSTES'){sec='adjust';return}
  if(u.includes('MANUTENCAO')||u.includes('SETUPS 3')||u.includes('BOM TRABALHO')){sec='';return}
  if(!sec)return;
  const m=line.match(/TNL\s*0*(\d{1,3})/i);if(!m)return;
  const machine='TNL '+String(m[1]).padStart(3,'0');
  if(sec==='future'){
   const tm=(line.match(/\b(\d{1,2}:\d{2})\b/)||[])[1]||'20:30';
   if(!future.some(x=>x.machine===machine))future.push({id:uid(),machine,start:tm});
  }else{
   if(line.includes('✅'))return;
   const owner=ownerOf(line);
   if(owner&&!current.some(x=>x.machine===machine&&x.owner===owner))current.push({id:uid(),type:sec,machine,owner});
  }
 });
 state.current=current;state.future=future.sort((a,b)=>toMin(a.start)-toMin(b.start));state.decisions={};state.roundIndex=0;state.plan=buildPlan();
 return current.length+future.length>0;
}
function baseAvailability(name){
 const acts=state.current.filter(a=>a.owner===name&&!state.decisions[a.id]);
 return acts.length?1350:1080;
}
function evaluateCombination(activity,time,coverName){
 const s=toMin(time),e=s+60;
 let score=0,level='best',title='Excelente';const reasons=[];
 if(coverName===activity.owner){return{time,name:coverName,level:'bad',title:'Não funciona',score:-999,reasons:['A pessoa não pode cobrir a própria atividade.']}}
 if(baseAvailability(coverName)>s){return{time,name:coverName,level:'bad',title:'Não funciona',score:-900,reasons:[`${coverName} ainda está comprometido nesse horário.`]}}
 const futureConflict=state.future.find(f=>state.plan?.assign?.[f.id]===coverName&&toMin(f.start)<e);
 if(futureConflict){level='warn';title='Possível com impacto';score-=300;reasons.push(`${coverName} está ligado à ${futureConflict.machine} às ${futureConflict.start}.`)}
 const alreadyCover=Object.values(state.decisions).find(d=>d.cover===coverName&&d.time===time);
 if(alreadyCover){level='bad';title='Não funciona';score-=700;reasons.push(`${coverName} já foi usado em outro revezamento nesse horário.`)}
 const dinner=state.plan?.dinners?.[coverName];
 if(dinner&&dinner.start===time){level=level==='bad'?'bad':'warn';title=level==='bad'?'Não funciona':'Possível com impacto';score-=120;reasons.push(`O jantar de ${coverName} precisará mudar.`)}
 const futureCount=state.future.length;
 score+=futureCount*100+toMin(time)/10;
 if(level==='best')reasons.push('Mantém os próximos setups atendidos.','Não cria conflito direto de horário.','Permite reorganizar os demais jantares.');
 else if(level==='warn')reasons.push('A combinação pode funcionar, mas exige reorganização do plano.');
 return{time,name:coverName,level,title,score,reasons};
}
function buildPlan(){
 const people=Array.from(state.present);const assign={},dinners={};
 state.future.forEach(f=>{assign[f.id]=people.find(n=>baseAvailability(n)<=toMin(f.start))||null});
 people.forEach((n,i)=>{const t=SLOTS[i%SLOTS.length];dinners[n]={start:t,end:toTime(toMin(t)+60)}});
 Object.entries(state.decisions).forEach(([id,d])=>{if(d.time)dinners[state.current.find(a=>a.id===id)?.owner]={start:d.time,end:toTime(toMin(d.time)+60)}});
 return{assign,dinners};
}
function nextActivity(){while(state.roundIndex<state.current.length&&state.decisions[state.current[state.roundIndex].id])state.roundIndex++;return state.current[state.roundIndex]||null}
function planList(){return state.future.map(f=>`<div class="setup-row ${state.plan.assign[f.id]?'ok':''}"><time>${f.start}</time><div><strong>${f.machine}</strong><span>${state.plan.assign[f.id]||'Sem responsável'}</span></div><i>${state.plan.assign[f.id]?'✓':'!'}</i></div>`).join('')}
function renderInitialPlan(){return`<div class="status-banner good"><strong>Planejamento carregado</strong><span>${state.current.length} atividades e ${state.future.length} próximos setups encontrados.</span></div><div class="setup-list">${planList()}</div><button id="startRound" class="btn primary full">Iniciar ronda e comparar combinações</button>`}
function renderRoundCard(){
 const a=nextActivity();
 if(!a)return`<div class="status-banner good"><strong>Ronda concluída</strong><span>As combinações foram definidas.</span></div><button id="goFinal" class="btn primary full">Abrir plano final</button>`;
 const people=Array.from(state.present).filter(n=>n!==a.owner);const items=[];
 SLOTS.forEach(t=>people.forEach(n=>items.push(evaluateCombination(a,t,n))));
 const best=items.slice().sort((x,y)=>y.score-x.score).find(x=>x.level!=='bad');
 return`<div class="round-summary"><span>${state.roundIndex+1} de ${state.current.length}</span><b>${a.owner}</b><b>${a.machine}</b></div><div class="person-card combo-card"><header><div><small>${a.type==='setup'?'SETUP EM ANDAMENTO':'AJUSTE EM ANDAMENTO'}</small><h3>${a.owner}</h3><span>${a.machine}</span></div><em>${best?`Melhor: ${best.time} + ${best.name}`:'Sem combinação viável'}</em></header>${best?`<button class="best-combo" data-combo="${best.time}|${best.name}"><small>MELHOR COMBINAÇÃO</small><strong>${best.time} · ${best.name} cobre</strong><span>${best.reasons.join(' • ')}</span></button>`:''}<div class="person-question">Compare horário + preparador de cobertura</div><div class="matrix-wrap"><table class="combo-matrix"><thead><tr><th>Horário</th>${people.map(n=>`<th>${n}</th>`).join('')}</tr></thead><tbody>${SLOTS.map(t=>`<tr><th>${t}</th>${people.map(n=>{const x=items.find(i=>i.time===t&&i.name===n);const icon=x.level==='best'?'★':x.level==='warn'?'▲':'×';return`<td><button class="matrix-cell ${x.level}" data-combo="${t}|${n}"><b>${icon}</b><small>${x.title}</small></button></td>`}).join('')}</tr>`).join('')}</tbody></table></div><div class="matrix-legend"><span>★ Excelente</span><span>▲ Com impacto</span><span>× Não funciona</span></div></div>`;
}
function showCombination(a,x){
 const end=toTime(toMin(x.time)+60);
 $('#sheet').innerHTML=`<div class="sheet-backdrop"><div class="sheet"><div class="sheet-handle"></div><div class="sheet-kicker">ANÁLISE DA COMBINAÇÃO</div><h3>${a.owner} ${x.time} · ${x.name} cobre</h3><div class="combo-rating ${x.level}"><strong>${x.title}</strong>${x.reasons.map(r=>`<span>${r}</span>`).join('')}</div><div class="decision-people"><div><small>${a.owner}</small><strong>Jantar ${x.time}–${end}</strong><span>${a.machine}</span></div><div><small>${x.name}</small><strong>Cobertura ${x.time}–${end}</strong><span>${a.machine}</span></div></div><div class="sheet-actions"><button id="cancelSheet" class="btn secondary">Voltar</button><button id="confirmDecision" class="btn primary" ${x.level==='bad'?'disabled':''}>Usar esta combinação</button></div></div></div>`;
 $('#cancelSheet').onclick=()=>$('#sheet').innerHTML='';
 if(x.level!=='bad')$('#confirmDecision').onclick=()=>{state.decisions[a.id]={time:x.time,cover:x.name};state.plan=buildPlan();state.roundIndex++;$('#sheet').innerHTML='';renderRound()};
}
function bindRound(){const a=nextActivity();if(!a){const g=$('#goFinal');if(g)g.onclick=()=>{state.step=3;update()};return}$$('[data-combo]').forEach(b=>b.onclick=()=>{const p=b.dataset.combo.split('|');showCombination(a,evaluateCombination(a,p[0],p[1]))})}
function renderRound(){const box=$('#round');box.innerHTML=state.roundIndex===0&&Object.keys(state.decisions).length===0?renderInitialPlan():renderRoundCard();const s=$('#startRound');if(s)s.onclick=()=>{state.roundIndex=0;box.innerHTML=renderRoundCard();bindRound()};bindRound()}
function renderFinal(){
 const people=Array.from(state.present);
 $('#final').innerHTML=`<div class="final-hero good"><strong>Plano do turno</strong><span>${state.future.filter(f=>state.plan.assign[f.id]).length}/${state.future.length} próximos setups atendidos</span></div><div class="team-board">${people.map(n=>{const d=state.plan.dinners[n];const cover=Object.entries(state.decisions).find(([,v])=>v.cover===n);return`<section><header><strong>${n}</strong><span>${d?`Jantar ${d.start}`:'Jantar pendente'}</span></header>${cover?`<p>↔ Cobre ${state.current.find(a=>a.id===cover[0])?.owner} às ${cover[1].time}</p>`:''}</section>`}).join('')}</div><h3 class="final-section-title">Próximos setups</h3><div class="setup-list">${planList()}</div>`;
}
function update(){
 $$('.step').forEach((e,i)=>e.classList.toggle('active',i===state.step));
 $$('.progress span').forEach((e,i)=>e.classList.toggle('on',i<=state.step));
 $('#back').style.visibility=state.step===0?'hidden':'visible';
 $('#next').textContent=state.step===3?'Voltar ao planejamento':'Continuar';
 if(state.step===2)renderRound();if(state.step===3)renderFinal();window.scrollTo(0,0);
}
$('#addName').onclick=()=>{const input=$('#newName');const v=input.value.trim();if(!v)return;let n=state.roster.find(x=>norm(x)===norm(v));if(!n){n=v;state.roster.push(n)}state.present.add(n);input.value='';renderRoster()};
$('#example').onclick=()=>{$('#report').value='*SETUP:*\n🔴 TNL 051 - CLAYTON\n🔴 TNL 118 - WENDEL\n🔴 TNL 144 - LUCIANO\n🔴 TNL 145 - MÁRCIO\n\n*MAQUINAS EM AJUSTES:*\nTNL 050 - NATTAN\nTNL 013 - EWERSON\nTNL 044 - MARLON\n\n*PRÓXIMOS SETUPS:*\n🔴 TNL 074 - Setup 2°T (18:00)\n🔴 TNL 079 - Setup 2°T (21:00)'};
$('#parse').onclick=()=>{if(!parseReport($('#report').value)){toast('Nenhuma atividade válida');return}state.step=2;update()};
$('#back').onclick=()=>{if(state.step>0){state.step--;update()}};
$('#next').onclick=()=>{if(state.step===0&&state.present.size<2){toast('Selecione ao menos 2 preparadores');return}if(state.step===1){if(!parseReport($('#report').value)){toast('Cole um relatório válido');return}state.step=2}else if(state.step===3)state.step=2;else state.step++;update()};
renderRoster();update();
})();