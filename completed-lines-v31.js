(()=>{
'use strict';

const COMPLETED_MARKS=/[✅✔☑]/u;

function removeCompletedReportLines(){
  const report=document.querySelector('#report');
  if(!report)return;
  report.value=report.value
    .split(/\r?\n/)
    .filter(line=>!(COMPLETED_MARKS.test(line)&&/TNL\s*0*\d{1,3}/i.test(line)))
    .join('\n');
}

document.addEventListener('click',event=>{
  const parseButton=event.target.closest('#parse');
  if(parseButton)removeCompletedReportLines();
},true);

const replacements=new Map([
  ['Situação não confirmada','Sem informação'],
  ['Ainda não visitado','Sem informação · confirmar na ronda'],
  ['Não apareceu no relatório','Sem informação no relatório']
]);

function replaceLabels(root=document.body){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    let value=node.nodeValue;
    for(const [from,to] of replacements)value=value.replaceAll(from,to);
    if(value!==node.nodeValue)node.nodeValue=value;
  }
}

replaceLabels();
new MutationObserver(records=>{
  for(const record of records){
    for(const node of record.addedNodes){
      if(node.nodeType===Node.TEXT_NODE){
        let value=node.nodeValue;
        for(const [from,to] of replacements)value=value.replaceAll(from,to);
        if(value!==node.nodeValue)node.nodeValue=value;
      }else if(node.nodeType===Node.ELEMENT_NODE){
        replaceLabels(node);
      }
    }
  }
}).observe(document.body,{childList:true,subtree:true});
})();
