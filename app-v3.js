(()=>{
'use strict';
const BASE=['Lucas V.','Lucas R.','Marlon','Ewerson','Everson','Clayton','Wendel','Gabriel','Adriano','Luciano','Juliano','Nattan','Marcio','Christoffer','Patrício','Mateus','Alan','Shaiane','Willians'];
const state={step:0,roster:[...BASE],present:new Set(),activities:[],meals:{},assignments:{}};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),1600)}
function renderRoster(){const roster=$('#roster');if(!roster)return;roster.innerHTML=state.roster.map(n=>`<button type="button" class="chip ${state.present.has(n)?'sel':''}" data-person="${n}">${n}</button>`).join('');$$('[data-person]').forEach(b=>b.onclick=()=>{const n=b.dataset.person;state.present.has(n)?state.present.delete(n):state.present.add(n);renderRoster()});const c=$('#count');if(c)c.textContent=`${state.present.size} selecionados`}
function update(){ $$('.step').forEach((x,i)=>x.classList.toggle('active',i===state.step)); $$('.progress span').forEach((x,i)=>x.classList.toggle('on',i<=state.step)); const back=$('#back'),next=$('#next'); if(back)back.style.visibility=state.step===0?'hidden':'visible'; if(next)next.textContent=state.step===3?'Revisar ronda':'Continuar'; window.scrollTo(0,0)}
function init(){
 const add=$('#addName'),input=$('#newName'),back=$('#back'),next=$('#next');
 if(!add||!input||!back||!next){console.error('Elementos principais não encontrados');return}
 add.onclick=()=>{const name=input.value.trim();if(!name){toast('Digite o nome');return}let existing=state.roster.find(x=>norm(x)===norm(name));if(!existing){state.roster.push(name);existing=name}state.present.add(existing);input.value='';renderRoster();toast('Preparador adicionado')};
 input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add.click()}};
 back.onclick=()=>{if(state.step>0){state.step--;update()}};
 next.onclick=()=>{if(state.step===0&&state.present.size<2){toast('Selecione ao menos 2 preparadores');return}if(state.step<3){state.step++;update()}else{state.step=2;update()}};
 const ex=$('#example');if(ex)ex.onclick=()=>{$('#report').value='*SETUP:*\n🔴 TNL 029 - EWERSON\n🔴 TNL 073 - CLAYTON';toast('Exemplo carregado')};
 const parse=$('#parse');if(parse)parse.onclick=()=>{state.step=2;update();toast('Situação carregada')};
 renderRoster();update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();