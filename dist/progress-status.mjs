import {grade} from './engine.mjs';
import {analyzeNetworkImpact} from './network-impact.mjs';

const GROUP_ORDER=['주회로','제어회로','PLC 입력','PLC 출력 / 표시','인버터 제어','RS-485 통신','접지'];

function hasAny(text,patterns){return patterns.some(pattern=>text.includes(pattern));}

function groupName(net){
 const id=String(net.id??'');
 const members=(net.members??[]).join(' ');
 const text=`${id} ${members}`;
 if(net.status==='pending'||hasAny(text,['보호도체','.E','TB3.E','TB4.E','TB2.E','PLC.E','INVERTER.E','SMPS.E']))return '접지';
 if(hasAny(text,['통신 +','통신 -','485+','485-','S+','S-','RS-485']))return 'RS-485 통신';
 if(hasAny(text,['인버터 CM','인버터 다기능','INVERTER.P3','INVERTER.P4','INVERTER.P5','SS1.','SS2.','SS3.']))return '인버터 제어';
 if(hasAny(text,['PLC 입력','DC +24V','DC 0V']))return 'PLC 입력';
 if(hasAny(text,['PLC 출력','릴레이 표시','RY1.','RY2.','RY3.','RY4.','RY5.']))return 'PLC 출력 / 표시';
 if(hasAny(text,['상전원','OCR-MC','MC-인버터','인버터-전동기','주회로 N','MC.L1','MC.L2','MC.L3','MC.T1','MC.T2','MC.T3','INVERTER.입력','INVERTER.출력','TB1.L1','TB1.L2','TB1.L3']))return '주회로';
 return '제어회로';
}

function groupProgress(items){
 const buckets=new Map(GROUP_ORDER.map(name=>[name,[]]));
 for(const item of items){
  const name=groupName(item);
  if(!buckets.has(name))buckets.set(name,[]);
  buckets.get(name).push(item);
 }
 return [...buckets.entries()]
  .filter(([,groupItems])=>groupItems.length)
  .map(([name,groupItems])=>({name,items:groupItems}));
}

export function analyzeProgress(problem,connections=[]){
 const result=grade(problem,connections);
 const impact=analyzeNetworkImpact(problem,connections,result);
 const items=(result.netProgress??[]).map(net=>{
  const wireIds=[...(net.wireIds??[])].sort();
  const networkImpact=wireIds.some(id=>impact.affectedWireIds.has(id));
  return {
   ...net,
   state:networkImpact&&net.status==='confirmed'&&net.state!=='not-started'?'error':net.state,
   networkImpact,
   members:[...(net.members??[])],
   wireIds,
   warningCount:Number(net.warningCount??0),
   reviewCount:Number(net.reviewCount??0),
  };
 });
 const confirmed=items.filter(net=>net.status==='confirmed');
 const pending=items.filter(net=>net.status!=='confirmed');
 const counts={
  total:confirmed.length,
  completed:confirmed.filter(net=>net.state==='complete').length,
  progress:confirmed.filter(net=>net.state==='progress').length,
  error:confirmed.filter(net=>net.state==='error').length,
  notStarted:confirmed.filter(net=>net.state==='not-started').length,
  pending:pending.length,
  warnings:items.reduce((sum,net)=>sum+net.warningCount,0),
 };
 return {
  counts,
  ratio:counts.total?counts.completed/counts.total:0,
  groups:groupProgress(items),
  items,
  impact,
 };
}

export function progressFilter(net,mode='all'){
 if(mode==='all')return true;
 if(mode==='incomplete')return net.status==='confirmed'&&net.state!=='complete';
 if(mode==='issues')return net.state==='error'||net.state==='review'||net.state==='pending'||net.warningCount>0||net.reviewCount>0;
 return true;
}
