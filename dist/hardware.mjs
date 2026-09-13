import {getProblem} from './problem.mjs';
import {getProblemProfile} from './problem-profiles.mjs';

export const sources={
 plc:{url:'https://sol.ls-electric.com/uploads/document/17001974529710/XBC-DR20SU_T24_Manual_V2.1_202307_EN.pdf',pages:[132,148,330],title:'XBC-DR20SU V2.1 (2023), 7-12 / 7-28 / A2-2'},
 empr:{url:'https://www.ls-electric.com/upload/customer/download/2601/EMPR%20Series_E_09-1909.pdf',pages:[54,58],title:'EMPR Series (2019), 53 / 57'},
 mc:{url:'https://www.ls-electric.com/upload/customer/download/280b6197-f4bb-4f86-a60d-917b7b8bf890/Metasol_MC_E_170915.pdf',pages:[139,177],title:'Metasol MC (2017), 139 / 177'},
 inverter:{url:'https://sol.ls-electric.com/uploads/document/16408444811950/G100_User%20Manual_EN_V1.1_210823.pdf',pages:[38,40,41,48,317],title:'G100 V1.1 (2021), 25 / 27 / 28 / 35 / 304'},
 exam:{url:'assets/p01/4.webp',pages:[1,2,3,4,5,6],title:'2025.12.13 PCQ 공개문제 1–6쪽'},
};
// World units are millimetres. +X right, +Y up, +Z away from the board.
// A drawing-derived display coordinate is never represented as a measured coordinate.
function replaceRelayPins(p,top='11',bottom='7',lampOrder=['RL1','GL1','YL1','RL2','GL2']){
 const supply=p.nets.find(n=>n.id==='보조회로 L');
 supply.members=supply.members.map(id=>/^RY[1-5]\.11$/.test(id)?id.replace(/11$/,top):id);
 for(let i=1;i<=5;i++){const net=p.nets.find(n=>n.id==='릴레이 표시 '+i);net.members=[`RY${i}.${bottom}`,`${lampOrder[i-1]}.상단 접속부`];}
}
function applyCircuitProfile(p,profile){
 const supply=p.nets.find(n=>n.id==='보조회로 L'),control=p.nets.find(n=>n.id==='OCR b접점 이후'),hold=p.nets.find(n=>n.id==='자기유지 분기'),coil=p.nets.find(n=>n.id==='MC 코일');
 if(profile.circuit==='trip-on-mc-11'){
  control.members=['OCR.96','PB6.접점 위','MC.43'];supply.members.push('MC.31');
 }else if(profile.circuit==='trip-off-10')replaceRelayPins(p,'10','6');
 else if(profile.circuit==='trip-lamp-11'||profile.circuit==='trip-lamp-swapped-10'){
  control.id='OCR a접점 표시';control.members=['OCR.98','YL2.상단 접속부'];p.nets=p.nets.filter(n=>n.id!=='정지 표시등');
  if(profile.circuit==='trip-lamp-11')supply.members.push('PB6.접점 위','MC.43');
  else{
   supply.members.push('PB7.접점 위','MC.43');hold.members=['PB7.접점 아래','MC.44','PB6.접점 위'];coil.members=['PB6.접점 아래','MC.A1'];
    replaceRelayPins(p,'10','6');
  }
 }
}
function applyLayoutProfile(p,profile){
 if(profile.layout!=='swapped-buttons')return;
 const boxes=Object.fromEntries(['PB4','PB5','PB6','PB7'].map(id=>[id,[...p.devices.find(d=>d.id===id).box]]));
 for(const [target,source] of [['PB4','PB6'],['PB5','PB7'],['PB6','PB4'],['PB7','PB5']])p.devices.find(d=>d.id===target).box=boxes[source];
}
export function createHardwareProblem(problemId='p01'){
 const profile=getProblemProfile(problemId),p=getProblem('AC');p.id=profile.id;p.name=profile.name;p.profile=profile;p.hardwareVersion='core-3d-2';p.internalLinks=[];p.routePorts=[];p.requiredPassages=[];
 applyCircuitProfile(p,profile);applyLayoutProfile(p,profile);
 const remove=id=>{p.terminals=p.terminals.filter(t=>t.id!==id);for(const d of p.devices)d.terminals=d.terminals.filter(x=>x!==id);};
 const add=(d,name,props={})=>{const t={id:d.id+'.'+name,deviceId:d.id,name,crimp:null,insulationTube:d.id==='PLC',maxConnections:2,...props};p.terminals.push(t);d.terminals.push(t.id);return t;};
 const find=id=>p.terminals.find(t=>t.id===id);
 for(const d of p.devices){
  const [x,y,w,h]=d.box;d.centerMm=[(x+w/2)*700/698-350,300-(y+h/2)*600/599,0];d.rotationZ=0;
  d.model=d.id;d.dimensionsMm=null;d.displaySizeMm=[w,h,25];d.geometryStatus='PDF 배치 외곽 기반 경량 외형';d.sourceKey='exam';
  if(d.id==='PLC'){d.model='LS XBC-DR20SU';d.dimensionsMm=[135,90,64];d.sourceKey='plc';}
  if(d.id==='MC'){d.model='LS MC-9b AC';d.dimensionsMm=[45,73.5,87.4];d.sourceKey='mc';}
  if(d.id==='OCR'){d.model='LS GMP22-3T';d.dimensionsMm=[53,38,87.5];d.sourceKey='empr';}
  if(d.id==='INVERTER'){d.model='LS G100C';d.referenceVariant='0004G100C 0.4kW';d.displaySizeMm=[70,128,130];d.sourceKey='inverter';d.geometryStatus='공식 0.4kW 참고 프레임';}
  if(d.id==='MCCB')d.model='2P 차단기 · 20A';
  if(d.id.startsWith('TB')){d.model='4P 단자대';if(['TB3','TB4'].includes(d.id)){d.displaySizeMm=[h,w,18];d.rotationZ=-Math.PI/2;}else d.displaySizeMm=[w,h,18];}
  if(d.dimensionsMm){d.displaySizeMm=[...d.dimensionsMm];d.geometryStatus='공식 외형 치수 · 체결 중심 좌표는 도면 비례 추출';}
 }
 // A tunnel CT is not a pair of electrical screw terminals.
 for(let i=1;i<=3;i++){
  remove('OCR.L'+i);remove('OCR.T'+i);
  const n=p.nets.find(n=>n.id==='상전원 '+i);n.members=n.members.filter(t=>!t.startsWith('OCR.'));n.members.push('MC.L'+i);
  p.nets=p.nets.filter(n=>n.id!=='OCR-MC '+i);
  p.requiredPassages.push({portId:'OCR.CT'+i,netId:n.id,destination:'MC.L'+i,source:'GMP22-3T 관통형 CT + 시험지 주회로'});
 }
 const ocr=p.devices.find(d=>d.id==='OCR');add(ocr,'97',{crimp:'1.5-3Y'});
 // Official MC-9b contact arrangement (177): 43/44 NO and 31/32 NC.
 const plc=p.devices.find(d=>d.id==='PLC');remove('PLC.출력 COM');
 for(let i=0;i<4;i++)add(plc,'COM'+i,{crimp:'1.5-3Y'});
 const supply=p.nets.find(n=>n.id==='보조회로 L');supply.members=supply.members.filter(t=>t!=='PLC.출력 COM');supply.members.push(...[0,1,2,3].map(i=>'PLC.COM'+i));
 for(let i=6;i<12;i++)add(plc,'입력 '+i,{crimp:'1.5-3Y'});
 for(let i=6;i<8;i++)add(plc,'출력 '+i,{crimp:'1.5-3Y'});
 for(const n of ['RX','TX','24V','24G'])add(plc,n);
 const upper=['RX','485+','TX','485-','SG',...Array.from({length:12},(_,i)=>'입력 '+i),...Array.from({length:6},(_,i)=>'상부 NC'+(i+18)),'입력 COM'];
 const lower=['전원 L/+','E','전원 N/-','COM0','출력 0','COM1','출력 1','COM2','출력 2','출력 3','하부 NC11','COM3','출력 4','출력 5','출력 6','출력 7',...Array.from({length:6},(_,i)=>'하부 NC'+(i+17)),'24V','24G'];
 for(const n of [...upper,...lower].filter(n=>n.includes('NC')))add(plc,n,{connectable:false});
 for(const [row,names] of [[1,upper],[-1,lower]])names.forEach((name,i)=>{
  const t=find('PLC.'+name);t.physicalNumber=(row===1?'IN':'OUT')+' TB'+(i+1);t.displayNumber=name.startsWith('입력 ' )&&name!=='입력 COM'?'P'+Number(name.slice(3)).toString(16).toUpperCase().padStart(2,'0'):name.startsWith('출력 ')?'P4'+name.slice(3):name;
  const rowOffset=row===1?(i%2?3.5:-3.5):(i%2?-3.5:3.5);
  t.localPositionMm=[-38+Math.floor(i/2)*8,row*37+rowOffset,57];t.numberStatus='official';t.function=name;t.sourceKey='plc';
 });
 // The exam board exposes one fastening screw per pole: the lower row on
 // horizontal TB1/TB2, and the right row on vertical TB3/TB4.
 for(const d of p.devices.filter(d=>d.id.startsWith('TB'))){
  const original=[...d.terminals];original.forEach((id,i)=>{
   const a=find(id),[w,h]=d.displaySizeMm,isVertical=['TB3','TB4'].includes(d.id);
   a.localPositionMm=[(i-1.5)*w/4,isVertical?h*.24:-h*.24,19];a.displayNumber=a.name;a.poleId=id;
  });
 }
 // The SMPS photo shows all usable screws in one strip along the front edge.
 const smps=p.devices.find(d=>d.id==='SMPS');
 [['L1',-32],['N',-16],['E',0],['-V',16],['+V',32]].forEach(([n,x])=>{const t=find('SMPS.'+n);t.localPositionMm=[x,-27,27];});
 // MC-9b exposes a second A1/A2 fastening pair at the lower edge.
 const mc=p.devices.find(d=>d.id==='MC');
 for(const n of ['A1','A2']){
  const alias=add(mc,n+' 하단',{crimp:find('MC.'+n).crimp});alias.displayNumber=n;alias.poleId='MC.'+n;
  p.internalLinks.push(['MC.'+n,alias.id]);const net=p.nets.find(net=>net.members.includes('MC.'+n));if(net)net.members.push(alias.id);
 }
 const inv=p.devices.find(d=>d.id==='INVERTER');
 // Additional control labels verified for the 2021 G100C revision; shell remains
 // a conditional 0.4kW reference frame, not an assertion about the photo's rating.
 for(const name of ['24','P1','P2','A1','B1 제어','C1','EG','Q1','VR','V1','I2','AO','CM 아날로그','B1 주회로','B2 주회로'])add(inv,name);
 p.internalLinks.push(['INVERTER.CM','INVERTER.CM 아날로그']);p.nets.find(n=>n.id==='인버터 CM').members.push('INVERTER.CM 아날로그');
 const invRows=[['24','P1','P2','P3','P4','P5','CM'],['A1','B1 제어','C1','EG','Q1','VR','V1','I2','AO','CM 아날로그','S+','S-']];
 invRows.forEach((names,row)=>names.forEach((n,i)=>{const t=find('INVERTER.'+n);t.localPositionMm=[row===0?-18+i*5.6:-29+i*5.2,row===0?-13:-28,116];t.sourceKey='inverter';t.numberStatus='official';}));
 ['입력 L1','입력 L2','입력 L3','B1 주회로','B2 주회로'].forEach((n,i)=>{const t=find('INVERTER.'+n);t.localPositionMm=[-26+i*11,-43,106];t.displayNumber=['R/L1','S/L2','T/L3','B1','B2'][i];t.maxConnections=1;});
 ['출력 T1','출력 T2','출력 T3'].forEach((n,i)=>{const t=find('INVERTER.'+n);t.localPositionMm=[7+i*11,-54,106];t.displayNumber=['U','V','W'][i];t.maxConnections=1;});
 find('INVERTER.E').localPositionMm=[-17,-58,103];
 for(const d of p.devices){
  const [w,h,z]=d.displaySizeMm;
  const items=d.terminals.map(find);
  if(d.id==='OCR') ['A1','A2','95','96','97','98'].forEach((n,i)=>{const t=find('OCR.'+n);t.localPositionMm=[-22+i*8.8,-12,87.5];t.numberStatus='official';});
  if(d.id==='MC'){
   for(let i=1;i<=3;i++){find('MC.L'+i).localPositionMm=[-16.4+(i-1)*10.9,23,65];find('MC.T'+i).localPositionMm=[-16.4+(i-1)*10.9,-23,65];}
   for(const [n,x,y] of [['43',16,23],['44',16,-23],['31',16,14],['32',16,-14],['A1',-5.8,32],['A2',5.8,32]]){const t=find('MC.'+n);t.localPositionMm=[x,y,65];t.displayNumber=n;t.numberStatus='official';}
   for(const [n,x] of [['A1 하단',-5.8],['A2 하단',5.8]]){const t=find('MC.'+n);t.localPositionMm=[x,-32,65];t.displayNumber=n.split(' ')[0];t.numberStatus='official';}
  }
  if(/^RY/.test(d.id))items.forEach((t,i)=>{t.localPositionMm=i<8?[(i%4-1.5)*9,28-Math.floor(i/4)*9,12]:i<10?[(i===8?-1:1)*13.5,-20,12]:[(i-10-1.5)*9,-29,12];t.numberStatus='exam-page6';});
  items.forEach((t,i)=>{
   if(!t.localPositionMm){const columns=Math.ceil(items.length/2);t.localPositionMm=[columns===1?0:(i%columns-(columns-1)/2)*w/(columns+1),i<columns?h*.32:-h*.32,z+1];}
   t.terminalId=t.id;t.displayNumber??=t.name;t.physicalNumber??=null;t.function??=t.name;t.connectable??=true;
   if(d.id==='PLC'&&profile.tubeScope==='io')t.insulationTube=/^(입력|출력|COM[0-3])/.test(t.name);
   t.actualPositionMm=null;t.positionConfidence='drawing-derived-unmeasured';t.numberStatus??=d.sourceKey==='exam'?'PDF 기능명 · 실물 각인 확인 필요':'기능 확정 · 실물 위치 확인 필요';
   const [lx,ly,lz]=t.localPositionMm,c=Math.cos(d.rotationZ),s=Math.sin(d.rotationZ);t.positionMm=[d.centerMm[0]+lx*c-ly*s,d.centerMm[1]+lx*s+ly*c,lz];
   t.normal=[0,0,1];t.wireEntryDirection=[0,-1,0];
   if(['TB3','TB4'].includes(d.id))t.wireEntryDirection=[1,0,0];
   else if((d.id==='PLC'&&ly>0)||(d.id==='MCCB'&&ly>0)||(/^RY/.test(d.id)&&ly>0)||(/^(PB|SS|[RYG]L)/.test(d.id)&&ly>0))t.wireEntryDirection=[0,1,0];
   t.sourceKey??=d.sourceKey;t.requiredCrimp=t.crimp;t.insulationTubeRequired=t.insulationTube;
   if(d.id==='MC')t.function=/^L/.test(t.name)?'주접점 전원측':/^T/.test(t.name)?'주접점 부하측':/^A/.test(t.name)?'전자석 코일 전원':['43','44'].includes(t.name)?'보조 a접점 (NO)':'보조 b접점 (NC)';
   if(d.id==='OCR')t.function=/^A/.test(t.name)?'동작전원 AC220V':['95','96'].includes(t.name)?'보호 출력 95–96':'보호 출력 97–98 · 카탈로그 NO/NC 표기 상충 확인 필요';
   if(d.id==='INVERTER')t.function=t.name.startsWith('입력')?'3상 AC 전원 입력':t.name.startsWith('출력')?'전동기 출력':t.name==='E'?'보호 접지':t.name.startsWith('P')?'다기능 디지털 입력':t.name.startsWith('CM')?'입력·통신·아날로그 공통':t.name==='S+'||t.name==='S-'?'RS-485 차동 통신':t.name;
   t.allowedWires=p.nets.filter(n=>n.status==='confirmed'&&n.members.includes(t.id)).map(n=>({...n.policy}));
   t.orientationRule='정상';t.doubleCrimpRule='등을 맞댐';t.orientationYOnly=true;t.orientationSource='사용자 요청의 연습 기준 · PDF 명시 기준 아님';
   t.multiMountRule={maximum:t.maxConnections,yPair:'등을 맞댐',source:t.orientationSource};
  });
  d.terminalObjects=items;
 }
 // Tunnel centres: 3 x Ø10, staggered arrangement from the official side view.
 for(let i=1;i<=3;i++){const local=[(i-2)*11,0,i===2?73:61];p.routePorts.push({id:'OCR.CT'+i,deviceId:'OCR',label:'CT '+i,diameterMm:10,connectable:false,positionMm:local.map((v,j)=>v+ocr.centerMm[j]),axis:[0,1,0],lengthMm:38,positionConfidence:'drawing-derived-unmeasured',sourceKey:'empr'});}
 p.terminalMap=Object.fromEntries(p.terminals.map(t=>[t.id,t]));
 p.assetRoot=profile.assetRoot;p.answerStatus=profile.answerStatus;p.answerProfilesComplete=true;
 p.pending=[...p.pending.filter(x=>!['physical','direction','pins','material'].includes(x.id)),
  {id:'material3d',title:'미명시 자재 및 매뉴얼 상충',detail:'PLC 전원·통신과 인버터 제어의 압착 규격, 통신 전선, 인버터 출력 색상은 미확정. PLC 권장 전선 굵기와 시험지 1.5㎟가 다름. 시험 채점은 시험지 우선. GMP 97–98 접점 동작 표기는 카탈로그 내부 상충.'},
  {id:'physical3d',title:'3D 체결 좌표 확인 필요',detail:'공식 외형 치수와 배열을 사용하되 단자 중심 좌표는 도면 비례 추출입니다. 실측 좌표는 미확정입니다.'},
  {id:'mount',title:'방향 판정 출처',detail:'정상/뒤집힘 및 등을 맞댐은 이번 사용자 요청의 연습 규칙입니다. 시험지의 확정 감점 기준으로 주장하지 않습니다.'}];
 return p;
}
