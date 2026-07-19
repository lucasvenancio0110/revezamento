(()=>{'use strict';
const SLOTS=['18:00','18:30','19:00','19:30','20:00','20:30'];
const $=s=>document.querySelector(s);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function text(el){return (el?.textContent||'').replace(/\s+/g,' ').trim()}
function parseCurrentRecommendation(){
  const rec=$('#rec');
  if(!rec)return null;
  const strategy=rec.querySelector('.strategy');
  if(!strategy)return null;
  const danger=strategy.classList.contains('danger');
  const title=text(strategy.querySelector('h3'));
  const chain=[...strategy.querySelectorAll('.chain > div')].map(text).filter(Boolean);
  const btn=strategy.querySelector('[data-confirm-cover]');
  const who=btn?.dataset.confirmCover||((title.match(/^(.+?)\s+cobre\s+/i)||[])[1]||null);
  const preserved=Number(((chain.find(x=>/próximo\(s\) setup/i.test(x))||'').match(/(\d+)/)||[])[1]||0);
  const marginText=chain.find(x=>/libera às/i.test(x))||'';
  return {possible:!danger&&!!who,title,who,chain,preserved,marginText,reason:danger?text(strategy.querySelector('p')):''};
}
function quality(item,index){
  if(!item.possible)return {label:'IMPOSSÍVEL',score:0,tone:'danger'};
  const score=Math.max(1,100-index*9+item.preserved*3);
  if(index===0)return {label:'MELHOR OPÇÃO',score:Math.min(100,score),tone:'best'};
  if(index===1)return {label:'BOA ALTERNATIVA',score:Math.min(96,score),tone:'good'};
  if(index===2)return {label:'POSSÍVEL',score:Math.min(88,score),tone:'ok'};
  return {label:'MENOR APROVEITAMENTO',score:Math.min(79,score),tone:'warn'};
}
async function evaluateSlots(input){
  const original=input.value;
  const rows=[];
  for(const slot of SLOTS){
    input.value=slot;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    await sleep(0);
    const info=parseCurrentRecommendation()||{possible:false,reason:'Sem recomendação para este horário.'};
    rows.push({...info,slot});
  }
  input.value=original;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  await sleep(0);
  const possible=rows.filter(x=>x.possible).sort((a,b)=>b.preserved-a.preserved||SLOTS.indexOf(a.slot)-SLOTS.indexOf(b.slot));
  const impossible=rows.filter(x=>!x.possible);
  return [...possible,...impossible].map((x,i)=>({...x,quality:quality(x,i)}));
}
function benefits(item){
  if(!item.possible)return [item.reason||'Nenhum preparador disponível sem conflito.'];
  const out=[];
  out.push(`${item.who} assume o revezamento.`);
  if(item.marginText)out.push(item.marginText.replace(/^./,c=>c.toUpperCase())+'.');
  out.push(`${item.preserved} próximo(s) setup(s) preservado(s).`);
  out.push(item.preserved>=3?'Mantém boa reserva operacional.':item.preserved>=1?'Mantém parte da flexibilidade do turno.':'Consome mais capacidade para os próximos setups.');
  return out;
}
function renderRanking(rows,input){
  const decision=$('#decision');if(!decision)return;
  decision.innerHTML=`<div class="slot-ranking"><div class="kicker">MELHOR HORÁRIO PARA JANTAR</div><h3>Ranking de aproveitamento</h3><p>O sistema comparou todas as janelas e ordenou pelo impacto no restante do turno.</p><div class="slot-list">${rows.map((r,i)=>`<article class="slot-card ${r.quality.tone}"><div class="slot-top"><div><span>${i+1}º • ${r.quality.label}</span><strong>${r.slot}</strong></div><b>${r.quality.score}/100</b></div><h4>${r.possible?`${r.who} cobre`:'Sem encaixe seguro'}</h4><ul>${benefits(r).map(x=>`<li>${x}</li>`).join('')}</ul>${r.possible?`<button class="btn ${i===0?'primary':'secondary'} full" data-pick-slot="${r.slot}" data-pick-who="${r.who}">Escolher este plano</button>`:'<button class="btn secondary full" disabled>Horário indisponível</button>'}</article>`).join('')}</div><details class="manual-slot"><summary>Escolher outro horário manualmente</summary><div class="field"><label>Horário</label><input id="manualCoverTime" class="input" type="time" value="${input.value}"></div><button id="applyManualSlot" class="btn secondary full">Analisar horário manual</button></details></div>`;
  document.querySelectorAll('[data-pick-slot]').forEach(btn=>btn.onclick=async()=>{
    input.value=btn.dataset.pickSlot;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    await sleep(0);
    const target=[...document.querySelectorAll('#rec [data-confirm-cover]')].find(x=>x.dataset.confirmCover===btn.dataset.pickWho)||$('#rec [data-confirm-cover]');
    if(target)target.click();
  });
  const manual=$('#applyManualSlot');if(manual)manual.onclick=async()=>{
    input.value=$('#manualCoverTime').value;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    await sleep(0);
    const info=parseCurrentRecommendation();
    if(!info?.possible){alert(info?.reason||'Não existe encaixe seguro nesse horário.');return}
    const target=[...document.querySelectorAll('#rec [data-confirm-cover]')].find(x=>x.dataset.confirmCover===info.who)||$('#rec [data-confirm-cover]');
    if(target)target.click();
  };
}
async function enhance(){
  const input=$('#coverTime');
  if(!input||input.dataset.ranked==='1')return;
  input.dataset.ranked='1';
  const field=input.closest('.field');if(field)field.style.display='none';
  const rec=$('#rec');if(rec)rec.style.display='none';
  const rows=await evaluateSlots(input);
  renderRanking(rows,input);
}
new MutationObserver(()=>enhance()).observe(document.body,{childList:true,subtree:true});
enhance();
})();