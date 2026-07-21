(()=>{
'use strict';

let cachedFutureBox=null;

function isStateChoice(root){
  return !!root.querySelector('.state-options');
}

function isSetupForm(root){
  const title=root.querySelector('.decision-card-new header small');
  return !!title && title.textContent.trim()==='SETUP' && !!root.querySelector('#machineNow');
}

function arrangeFutureSetupOption(){
  const round=document.querySelector('#round');
  if(!round)return;

  const currentBox=round.querySelector('.future-start-box');

  // Na tela inicial, guarda a opção e remove da lista principal.
  if(isStateChoice(round) && currentBox){
    cachedFutureBox=currentBox;
    currentBox.remove();
    return;
  }

  // A opção só aparece depois que o usuário escolher "Em setup".
  if(isSetupForm(round) && cachedFutureBox && !round.querySelector('.future-start-box')){
    const form=round.querySelector('.form-block');
    const firstLabel=form?.querySelector('label');
    if(!form)return;

    const strong=cachedFutureBox.querySelector('strong');
    const description=cachedFutureBox.querySelector(':scope > span');
    if(strong)strong.textContent='O setup é um dos próximos setups?';
    if(description)description.textContent='Selecione a máquina da fila ou informe outra máquina abaixo.';

    if(firstLabel)form.insertBefore(cachedFutureBox,firstLabel);
    else form.prepend(cachedFutureBox);
  }
}

const observer=new MutationObserver(arrangeFutureSetupOption);
observer.observe(document.body,{childList:true,subtree:true});
arrangeFutureSetupOption();
})();