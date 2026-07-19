'use strict';

const BASE = ['Lucas','Marlon','Marcio','Clayton','Juliano','Luciano','Nattan','Alan','Wendel','Ewerson','Christoffer'];
const MEAL_SLOTS = ['18:00','18:30','19:00','19:30','20:00','20:30'];
const SHIFT_END = 24*60;
const state = {step:0, roster:[...BASE], present:new Set(), activities:[], completedPeople:new Set(), meals:{}, covers:{}, bestPlan:null, planApplied:false};

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const toMin = t => { const [h,m] = String(t || '00:00').split(':').map(Number); return h*60+m; };
const toTime = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const overlaps = (a,b,c,d) => Math.max(a,c) < Math.min(b,d);
const uid = () => Math.random().toString(36).slice(2);

function toast(text){
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => el.classList.remove('show'), 1600);
}

function personAliases(name){
  const n = norm(name);
  if(n === 'LUCAS V.') return ['LUCAS V','LUCAS'];
  if(n === 'LUCAS R.') return ['LUCAS R'];
  if(n === 'MARCIO') return ['MARCIO','MÁRCIO'];
  return [n.replace(/\.$/,'')];
}

function findOwner(line){
  const cleaned = norm(line).replace(/\bOP\b/g,' ').replace(/\s+/g,' ');
  const people = Array.from(state.present).sort((a,b) => b.length-a.length);
  for(const person of people){
    for(const alias of personAliases(person)){
      const pattern = new RegExp(`(^|[^A-Z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^A-Z0-9]|$)`);
      if(pattern.test(cleaned)) return person;
    }
  }
  return null;
}

function classifyHeader(line){
  const u = norm(line).replace(/\*/g,'').replace(/:$/,'').trim();
  if(u === 'SETUP' || u.includes('MAQUINAS EM SETUP')) return 'setup';
  if(u === 'AJUSTES' || u.includes('MAQUINAS EM AJUSTES')) return 'adjust';
  if(u.includes('PROXIMOS SETUPS')) return 'future';
  if(
    u.includes('MANUTENCAO') ||
    u.includes('SETUPS 1') ||
    u.includes('SETUPS 3') ||
    u.includes('ORDENS PARA SELECAO') ||
    u.includes('SELECAO') ||
    u.includes('BOM TRABALHO') ||
    u.includes('SITUACAO DO SETOR') ||
    /^\d+° TURNO$/.test(u)
  ) return 'ignore';
  return null;
}

function parseReportText(raw){
  let section = 'ignore';
  const activeByMachine = new Map();
  const futures = [];
  const completedPeople = new Set();

  for(const original of raw.split(/\n/)){
    const line = original.trim();
    if(!line) continue;

    const header = classifyHeader(line);
    if(header){ section = header; continue; }
    if(!['setup','adjust','future'].includes(section)) continue;

    const machineMatch = line.match(/TNL\s*0*(\d{1,3})/i);
    if(!machineMatch) continue;
    const machine = `TNL ${String(machineMatch[1]).padStart(3,'0')}`;
    const time = (line.match(/\b(\d{1,2}:\d{2})\b/) || [])[1] || null;

    if(section === 'future'){
      const existing = futures.findIndex(x => x.machine === machine);
      const item = {id:uid(), type:'future', machine, start:time || '20:30', owner:null};
      if(existing >= 0) futures[existing] = item; else futures.push(item);
      continue;
    }

    const owner = findOwner(line);
    if(!owner){
      activeByMachine.delete(machine);
      continue;
    }

    if(line.includes('✅')){
      completedPeople.add(owner);
      activeByMachine.delete(machine);
      continue;
    }

    activeByMachine.set(machine, {
      id:uid(), type:section, machine, owner,
      need:null, preferred:'20:30', finish:null
    });
  }

  const active = Array.from(activeByMachine.values());
  const activeOwners = new Set(active.map(x => x.owner));
  for(const owner of Array.from(completedPeople)){
    if(activeOwners.has(owner)) completedPeople.delete(owner);
  }

  return {activities:[...active,...futures], completedPeople};
}

function renderRoster(){
  $('#roster').innerHTML = state.roster.map(n =>
    `<button type="button" class="chip ${state.present.has(n)?'sel':''}" data-person="${n}">${n}</button>`
  ).join('');
  $$('[data-person]').forEach(btn => btn.onclick = () => {
    const name = btn.dataset.person;
    state.present.has(name) ? state.present.delete(name) : state.present.add(name);
    renderRoster();
  });
  $('#count').textContent = `(${state.present.size} selecionados)`;
}

function currentActivities(name){
  return state.activities.filter(a => a.type !== 'future' && a.owner === name);
}

function personBase(name){
  const acts = currentActivities(name);
  if(!acts.length) return {freeAt:1080, blocked:false, reason:'Livre'};
  let freeAt = 1080;
  for(const a of acts){
    if(a.need === false && a.finish){
      freeAt = Math.max(freeAt,toMin(a.finish));
    }else{
      return {freeAt:SHIFT_END, blocked:true, reason:`Em ${acts.map(x=>x.machine).join(', ')}`};
    }
  }
  return {freeAt, blocked:false, reason:`Livre às ${toTime(freeAt)}`};
}
