(()=>{
'use strict';

const FACTORY_ORDER=[
  'Lucas V.',
  'Everson',
  'Clayton',
  'Ewerson',
  'Marlon',
  'Luciano',
  'Juliano',
  'Marcio',
  'Alan',
  'Christoffer',
  'Nattan'
];

const REMOVED_DEFAULTS=new Set([
  'Lucas R.',
  'Wendel',
  'Gabriel',
  'Adriano',
  'Patrício',
  'Mateus',
  'Shaiane',
  'Willians'
]);

let applying=false;

function applyFactoryRoster(){
  if(applying)return;
  const roster=document.querySelector('#roster');
  if(!roster)return;

  applying=true;

  const buttons=Array.from(roster.querySelectorAll('[data-person]'));
  for(const button of buttons){
    if(REMOVED_DEFAULTS.has(button.dataset.person))button.remove();
  }

  const remaining=Array.from(roster.querySelectorAll('[data-person]'));
  const byName=new Map(remaining.map(button=>[button.dataset.person,button]));

  for(const name of FACTORY_ORDER){
    const button=byName.get(name);
    if(button)roster.appendChild(button);
  }

  for(const button of remaining){
    if(!FACTORY_ORDER.includes(button.dataset.person))roster.appendChild(button);
  }

  const card=roster.closest('.card');
  const addRow=card?.querySelector('.row');
  if(addRow)addRow.style.display='flex';

  applying=false;
}

applyFactoryRoster();
new MutationObserver(()=>requestAnimationFrame(applyFactoryRoster))
  .observe(document.body,{childList:true,subtree:true});
})();