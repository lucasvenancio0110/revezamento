(()=>{
'use strict';

const ALLOWED=new Set([
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
]);

function applyFactoryRoster(){
  const roster=document.querySelector('#roster');
  if(!roster)return;

  roster.querySelectorAll('[data-person]').forEach(button=>{
    if(!ALLOWED.has(button.dataset.person))button.remove();
  });

  const card=roster.closest('.card');
  const addRow=card?.querySelector('.row');
  if(addRow)addRow.remove();
}

applyFactoryRoster();
new MutationObserver(applyFactoryRoster).observe(document.body,{childList:true,subtree:true});
})();
