(()=>{
'use strict';

const STORE_KEY='op-manual-setups-v39';
const manualOwners=JSON.parse(sessionStorage.getItem(STORE_KEY)||'{}');
let sheetOpen=false;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const timeMin=t=>{const m=String(t||'').match(/(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):9999};
const endTime=t=>{const n=timeMin(t)+60;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`};
const degreeFrom=s=>String(s||'').includes('🔴')?'🔴':String(s||'').includes('🟢')?'🟢':String(s||'').includes('🔵')?'🔵':'';
const machineFrom=s=>{const m=String(s||'').match(/TNL\s*\d{1,3}/i);return m?`TNL ${String(m[0].match(/\d+/)[0]).padStart(3,'0')}`:''};

function saveManual(){sessionStorage.setItem(STORE_KEY,JSON.stringify(manualOwners))}
function toast(msg){const t=$('#toast');if(!t)return; t.textContent=msg;t.classList.add('show');clearTimeout(window.__op39toast);window.__op39toast=setTimeout(()=>t.classList.remove('show'),1900)}

function getPeople(){
  const map=new Map();
  $$('.team-board section').forEach(sec=>{
    const name=$('header strong',sec)?.textContent.trim();
    if(!name)return;
    const status=$('header span',sec)?.textContent.trim()||'';
    const detail=$('p',sec)?.textContent.trim()||'';
    map.set(name,{name,status,detail});
  });
  if(!map.size){
    $$('.prep-card').forEach(card=>{
      const name=$('strong',card)?.textContent.trim();
      if(!name)return;
      map.set(name,{name,status:$('small',card)?.textContent.trim()||'',detail:$('em',card)?.textContent.trim()||''});
    });
  }
  return [...map.values()];
}

function getFutureRows(){
  const rows=[];
  $$('.setup-list .setup-row').forEach(row=>{
    const machine=machineFrom(row.textContent);
    if(!machine)return;
    const time=$('time',row)?.textContent.trim()||'';
    const info=$('div span',row)?.textContent.trim()||'';
    const degree=degreeFrom(row.textContent);
    const originalOwner=/sem responsável/i.test(info)?'':info.replace(/\s+já iniciou$/i,'').trim();
    rows.push({machine,time,degree,originalOwner,started:/EM ANDAMENTO/i.test(time)});
  });
  if(!rows.length){
    $$('.future-chip').forEach(row=>{
      const machine=machineFrom(row.textContent);if(!machine)return;
      const time=$('time',row)?.textContent.trim()||'';
      const info=$('small',row)?.textContent.trim()||'';
      rows.push({machine,time,degree:degreeFrom(row.textContent),originalOwner:/sem responsável/i.test(info)?'':info.replace(/\s+já iniciou$/i,'').trim(),started:/EM ANDAMENTO/i.test(time)});
    });
  }
  return rows;
}

function personDinner(p){const m=`${p.status} ${p.detail}`.match(/jantar\s+(\d{1,2}:\d{2})/i);return m?m[1]:''}
function personFinish(p){return /termina/i.test(p.detail)}
function activityType(p){if(/setup/i.test(p.status))return 'setup';if(/ajuste/i.test(p.status))return 'adjust';if(/livre/i.test(p.status))return 'free';if(/indisponível/i.test(p.status))return 'unavailable';return 'unknown'}
function coverTargetData(p){
  const m=p.detail.match(/^(.+?)\s+cobre\s+(\d{1,2}:\d{2})/i);
  return m?{coverer:m[1].trim(),time:m[2]}:null;
}
function assignmentsWithOverrides(){return getFutureRows().map(f=>({...f,owner:manualOwners[f.machine]??f.originalOwner}))}

function coverageFor(name,people){
  return people.flatMap(target=>{
    const d=coverTargetData(target);
    return d&&norm(d.coverer)===norm(name)?[{target:target.name,machine:machineFrom(target.status),time:d.time}]:[];
  });
}

function evaluateSetupCandidate(name,setup,people,allSetups){
  const p=people.find(x=>x.name===name);
  const result={name,kind:'blocked',title:'Não disponível',reasons:[],score:0};
  if(!p){result.reasons.push('Sem informações confirmadas.');return result}
  const type=activityType(p),start=timeMin(setup.time),dinner=personDinner(p);
  if(type==='unavailable'){result.reasons.push('Está marcado como indisponível.');return result}
  if(type==='unknown'){result.kind='conditional';result.title='Precisa confirmar';result.score=40;result.reasons.push('A situação ainda não foi confirmada na ronda.');return result}
  const covers=coverageFor(name,people);
  const coverConflict=covers.find(c=>{const s=timeMin(c.time);return start>=s&&start<s+90});
  if(coverConflict){result.kind='impact';result.title='Conflita com revezamento';result.score=35;result.reasons.push(`Estará cobrindo ${coverConflict.target} na ${coverConflict.machine||'máquina'} de ${coverConflict.time} às ${endTime(coverConflict.time)}.`);return result}
  const other=allSetups.find(f=>f.machine!==setup.machine&&norm(f.owner)===norm(name));
  if(other){result.kind='impact';result.title='Já está reservado para outro setup';result.score=45;result.reasons.push(`${other.degree} ${other.machine} às ${other.time}.`);result.reasons.push('Trocar aqui deixa o outro setup sem o responsável atual.');return result}
  if(dinner){const d=timeMin(dinner);if(start>=d&&start<d+60){result.kind='reschedule';result.title='Pode alterando o próprio jantar';result.score=65;result.reasons.push(`O jantar atual é ${dinner} às ${endTime(dinner)}.`);result.reasons.push('É necessário mudar o jantar antes de assumir este setup.');return result}}
  if(type==='setup'&&!personFinish(p)){result.reasons.push(`Já está em ${degreeFrom(p.status)} ${machineFrom(p.status)} e retorna após o jantar.`);return result}
  if(type==='adjust'&&!personFinish(p)){result.reasons.push(`Está em ajuste na ${machineFrom(p.status)} e não foi marcado que termina.`);return result}
  if(type==='setup'||type==='adjust'){
    result.kind='conditional';result.title='Pode se terminar antes';result.score=75;
    result.reasons.push(`${type==='setup'?'Setup':'Ajuste'} ${machineFrom(p.status)} — TERMINA.`);
    result.reasons.push(`Confirmar se estará livre antes das ${setup.time}.`);
    return result;
  }
  result.kind='recommended';result.title='Recomendado';result.score=100;
  result.reasons.push(`Está livre para assumir às ${setup.time}.`);
  if(dinner)result.reasons.push(`Jantar definido: ${dinner} às ${endTime(dinner)}.`);
  return result;
}

function setupOptions(setup){
  const people=getPeople(),all=assignmentsWithOverrides();
  return people.map(p=>evaluateSetupCandidate(p.name,setup,people,all)).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'pt-BR'));
}

function applyOwner(machine,name){
  const previous=assignmentsWithOverrides().find(x=>x.machine===machine)?.owner||'';
  manualOwners[machine]=name;saveManual();
  sheetOpen=false;renderEnhancements();
  toast(previous&&previous!==name?`${machine}: ${previous} → ${name}`:`${name} definido na ${machine}`);
}

function openSetupSheet(machine){
  const setup=assignmentsWithOverrides().find(x=>x.machine===machine);if(!setup||setup.started)return;
  const options=setupOptions(setup),current=setup.owner;
  const sheet=$('#sheet');if(!sheet)return;
  sheetOpen=true;
  sheet.innerHTML=`<div class="op39-backdrop" data-close-setup></div><section class="op39-sheet"><header><div><small>ALTERAR RESPONSÁVEL</small><h3>${setup.degree} ${setup.machine} — ${setup.time}</h3><span>Atual: ${esc(current||'Sem responsável')}</span></div><button data-close-setup>×</button></header><div class="op39-best"><strong>💡 Melhor possibilidade</strong><span>${options[0]?`${esc(options[0].name)} — ${esc(options[0].title)}`:'Nenhuma opção encontrada'}</span></div><div class="op39-options">${options.map((o,i)=>`<button class="op39-option ${o.kind} ${norm(o.name)===norm(current)?'selected':''}" data-setup-owner="${esc(o.name)}" data-machine="${setup.machine}"><div><strong>${i===0?'🥇 ':''}${esc(o.name)}</strong><span>${esc(o.title)}</span></div>${o.reasons.map(r=>`<small>${esc(r)}</small>`).join('')}<em>${norm(o.name)===norm(current)?'Responsável atual':'Escolher este preparador'}</em></button>`).join('')}</div><footer>A escolha manual é permitida, mas o impacto fica visível antes da confirmação.</footer></section>`;
  $$('[data-close-setup]',sheet).forEach(b=>b.onclick=()=>{sheetOpen=false;sheet.innerHTML=''});
  $$('[data-setup-owner]',sheet).forEach(b=>b.onclick=()=>applyOwner(b.dataset.machine,b.dataset.setupOwner));
}

function renderEditableSetups(){
  const container=$('.setup-list');if(!container)return;
  const setups=assignmentsWithOverrides();
  container.innerHTML=setups.map(f=>`<div class="setup-row op39-setup-row ${f.owner?'ok':''}"><time>${esc(f.time)}</time><div><strong>${f.degree} ${f.machine}</strong><span>${esc(f.started?`${f.owner} já iniciou`:f.owner||'Sem responsável')}</span></div>${f.started?'<i>✓</i>':`<button class="op39-edit" data-edit-setup="${f.machine}">Alterar</button>`}</div>`).join('')||'<div class="empty-mini">Nenhum próximo setup.</div>';
  $$('[data-edit-setup]',container).forEach(b=>b.onclick=()=>openSetupSheet(b.dataset.editSetup));
}

function reportPersonBlock(p,people,setups){
  const lines=[`*${p.name.toUpperCase()}*`];
  const type=activityType(p),machine=machineFrom(p.status),degree=degreeFrom(p.status);
  if(type==='setup')lines.push(`Agora: Setup ${degree?degree+' ':''}${machine}${personFinish(p)?' — TERMINA':''}`.trim());
  else if(type==='adjust')lines.push(`Agora: Ajuste ${machine}${personFinish(p)?' — TERMINA':''}`.trim());
  else if(type==='free')lines.push('Agora: Livre');
  else if(type==='unavailable')lines.push('Agora: Indisponível');
  else lines.push('Agora: Sem informação confirmada');
  const dinner=personDinner(p);if(dinner)lines.push(`Jantar: ${dinner} às ${endTime(dinner)}`);
  const targetCover=coverTargetData(p);
  if(targetCover){
    lines.push(`🔄 Cobertura: ${targetCover.coverer}`);
    if((type==='setup'||type==='adjust')&&!personFinish(p))lines.push(`↩ Depois do jantar: retorna para ${type==='setup'?'Setup':'Ajuste'} ${degree?degree+' ':''}${machine}`.trim());
  }
  coverageFor(p.name,people).forEach(c=>lines.push(`🔄 Depois: cobre ${c.target} — ${c.machine} — ${c.time} às ${endTime(c.time)}`));
  setups.filter(s=>norm(s.owner)===norm(p.name)&&!s.started).sort((a,b)=>timeMin(a.time)-timeMin(b.time)).forEach(s=>lines.push(`Depois: assume Setup ${s.degree?`${s.degree} `:''}${s.machine} às ${s.time}`));
  return lines.join('\n');
}

function buildReport(){
  const people=getPeople(),setups=assignmentsWithOverrides();
  const coverLines=[];
  people.forEach(target=>{const c=coverTargetData(target);if(c)coverLines.push(`🔄 ${c.coverer} cobre ${target.name} — ${machineFrom(target.status)} — ${c.time} às ${endTime(c.time)}`)});
  const parts=['*2º TURNO — PLANO OPERACIONAL*'];
  if(coverLines.length)parts.push(`*REVEZAMENTOS*\n${coverLines.join('\n')}`);
  people.forEach(p=>parts.push(reportPersonBlock(p,people,setups)));
  if(setups.length)parts.push(`*PRÓXIMOS SETUPS*\n${setups.map(s=>`${s.degree?`${s.degree} `:''}${s.machine} — ${s.started?'EM ANDAMENTO':s.time} — ${s.owner||'Sem responsável'}`).join('\n')}`);
  return parts.join('\n\n');
}

async function copyReport(){
  const text=buildReport();
  try{await navigator.clipboard.writeText(text)}catch(_){const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
  toast('Relatório copiado. Agora é só colar no WhatsApp.');
}

function openWhatsApp(){window.open(`https://wa.me/?text=${encodeURIComponent(buildReport())}`,'_blank','noopener')}

function renderReportBox(){
  const final=$('#final');if(!final||$('#op39-report'))return;
  const box=document.createElement('section');box.id='op39-report';box.className='op39-report';
  box.innerHTML=`<header><div><small>RELATÓRIO PARA O GRUPO</small><h3>Plano operacional pronto para copiar</h3></div></header><pre id="op39-report-text"></pre><div class="op39-actions"><button id="op39-copy" class="btn primary">Copiar relatório</button><button id="op39-whatsapp" class="btn secondary">Abrir WhatsApp</button></div>`;
  final.appendChild(box);$('#op39-report-text').textContent=buildReport();$('#op39-copy').onclick=copyReport;$('#op39-whatsapp').onclick=openWhatsApp;
}

function decorateRoundFuture(){
  $$('.future-chip').forEach(chip=>{
    if(chip.dataset.op39)return;chip.dataset.op39='1';
    const machine=machineFrom(chip.textContent),setup=assignmentsWithOverrides().find(x=>x.machine===machine);if(!setup)return;
    const small=$('small',chip);if(small&&manualOwners[machine]!==undefined)small.textContent=manualOwners[machine]||'Sem responsável';
    if(!setup.started){chip.classList.add('op39-clickable');chip.title='Toque para analisar e alterar o responsável';chip.onclick=()=>openSetupSheet(machine)}
  });
}

function renderEnhancements(){
  if($('#final')&&$('.step.active #final')){renderEditableSetups();const old=$('#op39-report');if(old)old.remove();renderReportBox()}
  decorateRoundFuture();
}

const observer=new MutationObserver(()=>{if(!sheetOpen)requestAnimationFrame(renderEnhancements)});
observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('load',renderEnhancements);
})();