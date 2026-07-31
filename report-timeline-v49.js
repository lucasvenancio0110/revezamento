(()=>{
'use strict';

const normalizeName=value=>String(value||'')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .toUpperCase()
  .trim();

const toMinutes=time=>{
  const [hour,minute]=String(time||'00:00').split(':').map(Number);
  return hour*60+minute;
};

function coverageMapFromReport(report){
  const map=new Map();
  const lines=report.split(/\n/);
  let inside=false;

  for(const line of lines){
    if(line.trim()==='*REVEZAMENTOS*'){
      inside=true;
      continue;
    }
    if(inside&&/^\*[^*]+\*$/.test(line.trim()))break;
    if(!inside)continue;

    const match=line.trim().match(/^🔄\s+(.+?)\s+cobre\s+(.+?)\s+—\s+(.+?)\s+—\s+(\d{1,2}:\d{2})\s+às\s+(\d{1,2}:\d{2})$/i);
    if(!match)continue;

    const [,coverer,target,machine,start,end]=match;
    const key=normalizeName(coverer);
    if(!map.has(key))map.set(key,[]);
    map.get(key).push({target,machine,start,end});
  }

  return map;
}

function transformPersonBlock(block,coverageMap){
  const lines=block.split('\n').filter((line,index,array)=>line.trim()||index===0||index===array.length-1);
  const header=lines[0]?.trim();
  const headerMatch=header?.match(/^\*([^*]+)\*$/);
  if(!headerMatch)return block;

  const title=headerMatch[1];
  if(['REVEZAMENTOS','PRÓXIMOS SETUPS','2º TURNO — PLANO OPERACIONAL'].includes(title))return block;

  const nameKey=normalizeName(title);
  const fixed=[];
  const events=[];
  let ownCover=null;
  let dinnerPending=false;

  for(const rawLine of lines.slice(1)){
    const line=rawLine.trim();
    if(!line)continue;

    if(line.startsWith('Agora:')){
      fixed.push(line);
      continue;
    }

    const dinner=line.match(/^Jantar:\s*(\d{1,2}:\d{2})\s+às\s+(\d{1,2}:\d{2})$/i);
    if(dinner){
      events.push({
        time:toMinutes(dinner[1]),
        priority:20,
        lines:[`${dinner[1]} às ${dinner[2]} — Jantar`],
        type:'dinner'
      });
      continue;
    }

    if(/^Jantar:\s*a definir$/i.test(line)){
      dinnerPending=true;
      continue;
    }

    const cover=line.match(/^🔄\s*Cobertura:\s*(.+)$/i);
    if(cover){
      ownCover=cover[1].trim();
      continue;
    }

    const future=line.match(/^Depois:\s*assume Setup\s+(.+?)\s+às\s+(\d{1,2}:\d{2})$/i);
    if(future){
      events.push({
        time:toMinutes(future[2]),
        priority:10,
        lines:[`${future[2]} — Assume Setup ${future[1]}`],
        type:'setup'
      });
      continue;
    }

    if(/^Depois:\s*cobre\s+/i.test(line))continue;
    fixed.push(line);
  }

  if(ownCover){
    const dinnerEvent=events.find(event=>event.type==='dinner');
    if(dinnerEvent)dinnerEvent.lines.push(`🔄 ${ownCover} cobre durante o jantar`);
    else fixed.push(`🔄 Cobertura: ${ownCover}`);
  }

  for(const assignment of coverageMap.get(nameKey)||[]){
    events.push({
      time:toMinutes(assignment.start),
      priority:30,
      lines:[`${assignment.start} às ${assignment.end} — Cobre ${assignment.target} (${assignment.machine})`],
      type:'covering'
    });
  }

  events.sort((a,b)=>a.time-b.time||a.priority-b.priority);

  const output=[header,...fixed];
  for(const event of events)output.push(...event.lines);
  if(dinnerPending)output.push('Jantar: a definir');

  return output.join('\n');
}

function transformReport(report){
  const normalized=String(report||'').replace(/\r\n?/g,'\n').trim();
  if(!normalized)return normalized;

  const coverageMap=coverageMapFromReport(normalized);
  return normalized
    .split(/\n{2,}/)
    .map(block=>transformPersonBlock(block,coverageMap))
    .join('\n\n');
}

function applyTimeline(){
  const textarea=document.querySelector('#groupReport');
  if(!textarea||textarea.dataset.timelineV49==='1')return;

  textarea.value=transformReport(textarea.value);
  textarea.dataset.timelineV49='1';
}

const final=document.querySelector('#final');
if(final){
  new MutationObserver(()=>requestAnimationFrame(applyTimeline))
    .observe(final,{childList:true,subtree:true});
}

applyTimeline();
})();
