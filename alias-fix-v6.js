(()=>{
'use strict';
const canonicalName=value=>{
  const raw=String(value||'').trim();
  const key=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ');
  if(key==='LUCAS'||key==='LUCAS V'||key==='LUCAS V.') return 'Lucas V.';
  return raw;
};

const add=document.getElementById('addName');
const input=document.getElementById('newName');
if(add&&input){
  const original=add.onclick;
  add.onclick=event=>{
    input.value=canonicalName(input.value);
    return original?.call(add,event);
  };
}

// Corrige também qualquer texto digitado como "Lucas" antes de sair do campo.
if(input){
  input.addEventListener('blur',()=>{
    if(input.value.trim()) input.value=canonicalName(input.value);
  });
}

// Evita que um nome visual "Lucas" permaneça como opção separada em versões antigas em cache.
const removeDuplicateLucas=()=>{
  document.querySelectorAll('[data-person]').forEach(button=>{
    const key=String(button.dataset.person||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
    if(key==='LUCAS') button.remove();
  });
};
removeDuplicateLucas();
const roster=document.getElementById('roster');
if(roster) new MutationObserver(removeDuplicateLucas).observe(roster,{childList:true,subtree:true});
})();