(()=>{
'use strict';

const PRESENT_KEY='copiloto-presentes-v48';
const ASSIGNMENTS_KEY='copiloto-coberturas-v48';

function readJson(key,fallback){
  try{return JSON.parse(sessionStorage.getItem(key)||JSON.stringify(fallback))}
  catch{return fallback}
}

function writeJson(key,value){
  sessionStorage.setItem(key,JSON.stringify(value));
}

function capturePresent(){
  const names=[...document.querySelectorAll('.person-chip.selected')]
    .map(button=>button.dataset.person)
    .filter(Boolean);
  if(names.length)writeJson(PRESENT_KEY,names);
}

function presentSet(){return new Set(readJson(PRESENT_KEY,[]))}
function assignments(){return readJson(ASSIGNMENTS_KEY,{})}

function resetAssignments(){writeJson(ASSIGNMENTS_KEY,{})}

function toMinutes(time){
  const [h,m]=String(time||'00:00').split(':').map(Number);
  return h*60+m;
}

function toTime(minutes){
  return`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
}

function taskSignature(card){
  const machine=card.querySelector('.machine-hero h3')?.textContent.trim()||'';
  const owner=card.querySelector('.machine-hero p')?.textContent.trim()||'';
  return`${machine}|${owner}`;
}

function workloadFor(name,currentSignature){
  const map=assignments();
  return Object.entries(map)
    .filter(([signature,assignment])=>signature!==currentSignature&&assignment?.cover===name)
    .length;
}

function storeAssignment(card,slot,cover){
  if(!card||!slot||!cover)return;
  const signature=taskSignature(card);
  if(!signature)return;
  const map=assignments();
  map[signature]={slot,cover};
  writeJson(ASSIGNMENTS_KEY,map);
}

function collectPlans(card,confirm){
  const allowed=presentSet();
  const currentSignature=taskSignature(card);
  const plans=[];

  const push=(slot,name,reason,button=null)=>{
    if(!slot||!name)return;
    if(allowed.size&&!allowed.has(name)){
      button?.remove();
      return;
    }
    plans.push({
      slot,
      name,
      reason,
      button,
      workload:workloadFor(name,currentSignature)
    });
  };

  push(
    confirm.dataset.confirmCoverage,
    confirm.dataset.coverName,
    card.querySelector('.single-reason')?.textContent.trim()||''
  );

  card.querySelectorAll('[data-pick-coverage]').forEach(button=>{
    if(button.classList.contains('blocked'))return;
    push(
      button.dataset.pickCoverage,
      button.dataset.coverName,
      button.querySelector('span')?.textContent.trim()||'',
      button
    );
  });

  const unique=[];
  const seen=new Set();
  for(const plan of plans){
    const key=`${plan.slot}|${plan.name}`;
    if(seen.has(key))continue;
    seen.add(key);
    unique.push(plan);
  }
  return unique;
}

function rankingReason(plan){
  if(plan.workload===0)return`Distribuição equilibrada: ${plan.name} ainda não recebeu cobertura.`;
  if(plan.workload===1)return`${plan.name} já recebeu 1 cobertura; esta é a melhor alternativa restante.`;
  return`${plan.name} já recebeu ${plan.workload} coberturas; usado novamente por falta de opção melhor.`;
}

function renderBest(card,confirm,best){
  const pair=card.querySelectorAll('.plan-pair > div');
  const dinnerText=pair[0]?.querySelector('b');
  const coverText=pair[1]?.querySelector('b');
  if(dinnerText)dinnerText.textContent=`${best.slot} → ${toTime(toMinutes(best.slot)+60)}`;
  if(coverText)coverText.textContent=best.name;

  const reason=card.querySelector('.single-reason');
  if(reason)reason.textContent=`${rankingReason(best)} ${best.reason}`.trim();

  confirm.dataset.confirmCoverage=best.slot;
  confirm.dataset.coverName=best.name;
}

function reorderOptions(card,plans,best){
  const sheet=card.querySelector('.option-sheet');
  if(!sheet)return;

  const ordered=plans
    .filter(plan=>!(plan.slot===best.slot&&plan.name===best.name))
    .sort((a,b)=>a.workload-b.workload||toMinutes(a.slot)-toMinutes(b.slot)||a.name.localeCompare(b.name,'pt-BR'));

  for(const plan of ordered){
    if(!plan.button)continue;
    const title=plan.button.querySelector('b');
    const detail=plan.button.querySelector('span');
    if(title)title.textContent=`${plan.slot} · ${plan.name}`;
    if(detail)detail.textContent=`${plan.workload===0?'Sem cobertura atribuída':`${plan.workload} cobertura(s) atribuída(s)`}. ${plan.reason}`;
    sheet.appendChild(plan.button);
  }
}

function optimizeCoverageCard(){
  const card=document.querySelector('#round .focus-card');
  const confirm=card?.querySelector('[data-confirm-coverage]');
  if(!card||!confirm)return;

  const signature=taskSignature(card);
  if(card.dataset.balanceV48===signature)return;

  const sheet=card.querySelector('.option-sheet');
  if(!sheet){
    if(card.dataset.balanceProbeV48)return;
    card.dataset.balanceProbeV48='1';
    card.querySelector('[data-toggle-options]')?.click();
    return;
  }

  const plans=collectPlans(card,confirm);
  if(!plans.length)return;

  const best=[...plans].sort((a,b)=>
    a.workload-b.workload||
    toMinutes(a.slot)-toMinutes(b.slot)||
    a.name.localeCompare(b.name,'pt-BR')
  )[0];

  renderBest(card,confirm,best);
  reorderOptions(card,plans,best);

  sheet.style.display='none';
  const toggle=card.querySelector('[data-toggle-options]');
  if(toggle)toggle.textContent='Ver outras opções';
  card.dataset.balanceV48=signature;
}

document.addEventListener('click',event=>{
  const startNew=event.target.closest('#parse')||(
    event.target.closest('#next')&&document.querySelector('.step.active #report')
  );
  if(startNew){
    capturePresent();
    resetAssignments();
  }

  const confirm=event.target.closest('#round [data-confirm-coverage]');
  if(confirm&&!confirm.disabled){
    storeAssignment(confirm.closest('.focus-card'),confirm.dataset.confirmCoverage,confirm.dataset.coverName);
    return;
  }

  const option=event.target.closest('#round [data-pick-coverage]');
  if(option&&!option.classList.contains('blocked')){
    storeAssignment(option.closest('.focus-card'),option.dataset.pickCoverage,option.dataset.coverName);
    return;
  }

  const toggle=event.target.closest('#round [data-toggle-options]');
  if(!toggle)return;
  const card=toggle.closest('.focus-card');
  const sheet=card?.querySelector('.option-sheet');
  if(!card||!sheet||!card.dataset.balanceV48)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const open=sheet.style.display==='none';
  sheet.style.display=open?'':'none';
  toggle.textContent=open?'Ocultar opções':'Ver outras opções';
},true);

const round=document.querySelector('#round');
if(round){
  new MutationObserver(()=>requestAnimationFrame(optimizeCoverageCard))
    .observe(round,{childList:true,subtree:true});
}

capturePresent();
optimizeCoverageCard();
})();
