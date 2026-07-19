(()=>{'use strict';
const $=s=>document.querySelector(s),norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
function selectedPeople(){return [...document.querySelectorAll('[data-person].sel')].map(b=>window.NCDE.canon(b.dataset.person));}
function parseReport(){
  const raw=$('#report')?.value||'';let sec='';const tasks=[];
  for(const row of raw.split(/\n/)){
    const line=row.trim(),u=norm(line).replace(/\*/g,'');if(!line)continue;
    if(u.includes('MAQUINAS EM SETUP')||u==='SETUP'){sec='setup';continue}
    if(u.includes('MAQUINAS EM AJUSTES')||u==='AJUSTES'){sec='adjust';continue}
    if(u.includes('PROXIMOS SETUPS')){sec='future';continue}
    if(u.includes('MANUTENCAO')||u.includes('SETUPS 1')||u.includes('SETUPS 3')||u.includes('SELECAO')||u.includes('BOM TRABALHO')){sec='';continue}
    if(!sec||line.includes('✅'))continue;
    const mm=line.match(/TNL\s*0*(\d{1,3})/i);if(!mm)continue;
    const machine=`TNL ${String(mm[1]).padStart(3,'0')}`;
    if(sec==='future'){
      const time=(line.match(/\b(\d{1,2}:\d{2})\b/)||[])[1]||'20:30';
      tasks.push({id:`future-${machine}-${time}`,type:'future',machine,start:time,assignee:null});continue;
    }
    const owner=selectedPeople().sort((a,b)=>b.length-a.length).find(p=>norm(line).includes(norm(p).replace(/\.$/,'')))||null;
    if(owner)tasks.push({id:`current-${machine}`,type:sec,machine,owner,start:'14:30',end:'18:00'});
  }
  return tasks;
}
function parseFinal(){
  const txt=$('#waText')?.value||'';const meals=[],covers=[],futureOwners=new Map();let person=null,section='';
  for(const raw of txt.split(/\n/)){
    const line=raw.trim();if(!line)continue;
    if(line==='*REVEZAMENTO*'){section='rev';continue}
    if(line==='*PRÓXIMOS SETUPS*'){section='future';person=null;continue}
    if(line==='*PENDÊNCIAS*'){section='pending';person=null;continue}
    if(section==='rev'&&/^\*[^*]+\*$/.test(line)){person=window.NCDE.canon(line.slice(1,-1));continue}
    if(section==='future'){
      const m=line.match(/^(\d{1,2}:\d{2})\s*-\s*(TNL\s*\d+)\s*-\s*(.+)$/i);
      if(m&&!/SEM RESPONSAVEL/i.test(norm(m[3])))futureOwners.set(`${m[2].replace(/\s+/g,' ')}|${m[1]}`,window.NCDE.canon(m[3]));
      continue;
    }
    if(section!=='rev'||!person)continue;
    const time=(line.match(/^(\d{1,2}:\d{2})/)||[])[1];if(!time)continue;
    if(/JANTAR/i.test(line)){meals.push({person,start:time});continue}
    const c=line.match(/REVEZAR\s+(.+?)\s+[—-]\s+(TNL\s*\d+)/i);
    if(c)covers.push({person,owner:window.NCDE.canon(c[1]),machine:c[2].replace(/\s+/g,' '),start:time});
  }
  return {meals,covers,futureOwners};
}
function buildPlan(){
  const people=selectedPeople(),tasks=parseReport(),final=parseFinal();
  tasks.filter(t=>t.type==='future').forEach(t=>{t.assignee=final.futureOwners.get(`${t.machine}|${t.start}`)||null});
  return {people,tasks,meals:final.meals,covers:final.covers};
}
function ensurePanel(){
  const final=$('#final');if(!final||$('#ncdePanel'))return null;
  const box=document.createElement('div');box.id='ncdePanel';box.className='strategy';box.style.marginBottom='14px';final.prepend(box);return box;
}
function renderValidation(){
  if(!window.NCDE)return;const panel=ensurePanel();if(!panel)return;
  const result=window.NCDE.optimize(buildPlan(),{limit:5000}),m=result.metrics;
  panel.className=`strategy ${m.valid?'':'danger'}`;
  panel.innerHTML=`<div class="kicker">NCDE ${window.NCDE.version}</div><h3>${m.valid?'PLANO VALIDADO':'PLANO NÃO VALIDADO'}</h3><p>${result.explanation}</p><div class="factory-grid"><div><span>NOTA</span><strong>${m.score}/100</strong></div><div><span>CENÁRIOS</span><strong>${result.explored}</strong></div><div><span>SETUPS</span><strong>${m.coverage}%</strong></div><div><span>JANTARES</span><strong>${m.dinners}%</strong></div></div>${m.errors.length?`<div style="margin-top:12px">${m.errors.slice(0,5).map(e=>`<div>⚠ ${e.message}</div>`).join('')}</div>`:''}`;
  const copy=$('#copyWA');if(copy){copy.disabled=!m.valid;copy.title=m.valid?'':'Resolva os conflitos antes de copiar';}
  const wa=$('#waText');if(wa)wa.dataset.ncdeValid=m.valid?'1':'0';
  window.__NCDE_LAST__=result;
}
const observer=new MutationObserver(()=>{if($('#waText'))renderValidation()});observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('input',e=>{if(e.target?.id==='waText')renderValidation()});
window.addEventListener('ncde:ready',()=>setTimeout(renderValidation,0));
})();