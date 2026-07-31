(()=>{
'use strict';

const STORAGE_KEY='copiloto-presentes-v47';

function capturePresent(){
  const names=[...document.querySelectorAll('.person-chip.selected')]
    .map(button=>button.dataset.person)
    .filter(Boolean);
  if(names.length)sessionStorage.setItem(STORAGE_KEY,JSON.stringify(names));
}

function presentSet(){
  try{return new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'[]'))}
  catch{return new Set()}
}

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

function optimizeCoverageCard(){
  const card=document.querySelector('#round .focus-card');
  const confirm=card?.querySelector('[data-confirm-coverage]');
  if(!card||!confirm)return;

  const signature=taskSignature(card);
  if(card.dataset.coverageV47===signature)return;

  const sheet=card.querySelector('.option-sheet');
  if(!sheet){
    if(card.dataset.coverageProbeV47)return;
    card.dataset.coverageProbeV47='1';
    const toggle=card.querySelector('[data-toggle-options]');
    if(toggle)setTimeout(()=>toggle.click(),0);
    return;
  }

  const allowed=presentSet();
  const options=[];
  const primarySlot=confirm.dataset.confirmCoverage;
  const primaryName=confirm.dataset.coverName;
  const primaryReason=card.querySelector('.single-reason')?.textContent.trim()||'';

  if(primarySlot&&primaryName&&(!allowed.size||allowed.has(primaryName))){
    options.push({slot:primarySlot,name:primaryName,reason:primaryReason,button:null});
  }

  card.querySelectorAll('[data-pick-coverage]').forEach(button=>{
    const name=button.dataset.coverName;
    const slot=button.dataset.pickCoverage;
    if(button.classList.contains('blocked')||!name||!slot)return;
    if(allowed.size&&!allowed.has(name)){
      button.remove();
      return;
    }
    options.push({
      slot,
      name,
      reason:button.querySelector('span')?.textContent.trim()||'',
      button
    });
  });

  const best=options.sort((a,b)=>toMinutes(a.slot)-toMinutes(b.slot)||a.name.localeCompare(b.name,'pt-BR'))[0];
  if(best){
    const pair=card.querySelectorAll('.plan-pair > div');
    const dinnerText=pair[0]?.querySelector('b');
    const coverText=pair[1]?.querySelector('b');
    if(dinnerText)dinnerText.textContent=`${best.slot} → ${toTime(toMinutes(best.slot)+60)}`;
    if(coverText)coverText.textContent=best.name;
    const reason=card.querySelector('.single-reason');
    if(reason)reason.textContent=best.reason||'Primeira janela válida sem conflito.';
    confirm.dataset.confirmCoverage=best.slot;
    confirm.dataset.coverName=best.name;
  }

  sheet.style.display='none';
  const toggle=card.querySelector('[data-toggle-options]');
  if(toggle)toggle.textContent='Ver outras opções';
  card.dataset.coverageV47=signature;
}

document.addEventListener('click',event=>{
  if(event.target.closest('#parse,#next'))capturePresent();

  const toggle=event.target.closest('#round [data-toggle-options]');
  if(!toggle)return;
  const card=toggle.closest('.focus-card');
  const sheet=card?.querySelector('.option-sheet');
  if(!card||!sheet||!card.dataset.coverageV47)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const open=sheet.style.display==='none';
  sheet.style.display=open?'':'none';
  toggle.textContent=open?'Ocultar opções':'Ver outras opções';
},true);

const observer=new MutationObserver(()=>requestAnimationFrame(optimizeCoverageCard));
const round=document.querySelector('#round');
if(round)observer.observe(round,{childList:true,subtree:true});

capturePresent();
optimizeCoverageCard();
})();
