export const crimpOptions=['1.5-3Y','1.5-4Y','2.5-3Y','2.5-4Y','1.5-3Blade','2.5-4Blade','없음'];
export const colors={'노란색':'#e0b600','갈색':'#8b4b24','검은색':'#202733','회색':'#85909d','녹색-노란색':'#269957'};
const devices=[],terminals=[];
function device(id,box,names,crimp,position='확인 필요: 실제 제품 단자 위치 미제공'){
 const d={id,box,position,source:{page:4},terminals:[]};devices.push(d);
 for(const name of names){const t={id:`${id}.${name}`,deviceId:id,name,crimp,insulationTube:id==='PLC',maxConnections:2,positionStatus:position,source:{page:id.startsWith('TB')?4:6},orientationRule:null,doubleCrimpRule:null};terminals.push(t);d.terminals.push(t.id);}
 return d;
}
device('TB1',[64,20,64,35],['L1','L2','L3','N'],'2.5-4Y','원본 4페이지');
device('TB2',[135,20,64,35],['E','예비2','예비3','예비4'],'2.5-4Y','원본 4페이지');
device('TB3',[11,332,41,67],['예비1','예비2','E1','E2'],'2.5-4Y','원본 4페이지');
device('TB4',[11,410,41,64],['T1','T2','T3','E'],'2.5-4Y','원본 4페이지');
device('MCCB',[99,135,74,47],['1차 L','1차 N','2차 L','2차 N'],null);
device('SMPS',[235,126,92,66],['L1','N','+V','-V','E'],'1.5-3Y');
device('OCR',[98,291,74,47],['L1','L2','L3','T1','T2','T3','96','98','95','A1','A2'],'1.5-3Y');
device('MC',[98,376,74,47],['L1','L2','L3','T1','T2','T3','43','44','31','32','A1','A2'],'1.5-3Y');
device('INVERTER',[235,270,92,171],['입력 L1','입력 L2','입력 L3','출력 T1','출력 T2','출력 T3','E','CM','P3','P4','P5','S+','S-'],null);
device('PLC',[390,324,253,102],['전원 L/+','전원 N/-','E','입력 COM','입력 0','입력 1','입력 2','입력 3','입력 4','입력 5','출력 COM','출력 0','출력 1','출력 2','출력 3','출력 4','출력 5','SG','485+','485-'],null);
for(let i=1;i<=5;i++)device(`RY${i}`,[399+(i-1)*50,125,46,70],['8','7','6','5','4','3','2','1','14','13','12','11','10','9'],'1.5-3Y','원본 6페이지 소켓 핀 배열');
for(const [id,x] of [['YL2',329],['RL2',387],['GL2',446],['RL1',503],['YL1',561],['GL1',619]])device(id,[x,21,40,33],['상단 접속부','하단 접속부'],'1.5-4Y');
for(const [id,x] of [['PB6',33],['PB7',91],['PB1',163],['PB2',221],['PB3',281],['PB4',399],['PB5',457],['SS1',515],['SS2',573],['SS3',631]])device(id,[x,527,40,32],['접점 위','접점 아래'],'1.5-4Y');
const tm=Object.fromEntries(terminals.map(t=>[t.id,t]));
for(const t of terminals){
 if(t.deviceId==='MC'&&/^[LT][123]$/.test(t.name))t.crimp='2.5-4Y';
 if(t.deviceId==='MC'&&/^A/.test(t.name))t.crimp='1.5-3Blade';
 if(t.deviceId==='OCR'&&/^[LT][123]$/.test(t.name)){t.crimp=null;t.crimpNote='표1의 OCR 1.5-3Y와 주회로 2.5㎟ 적용 관계 확인 필요';}
 if(t.deviceId==='MCCB')t.crimp=t.name.startsWith('1차')?'2.5-4Blade':'1.5-3Blade';
 if(['SMPS','PLC','INVERTER'].includes(t.deviceId)&&t.name==='E')t.crimp='2.5-3Y';
 if(t.deviceId==='INVERTER'&&/^(입력|출력)/.test(t.name))t.crimp='2.5-3Y';
 if(t.deviceId==='PLC'&&/^(입력|출력)/.test(t.name))t.crimp='1.5-3Y';
}
const nets=[];
const aux={kind:'연선',area:1.5,color:'노란색'},pe={kind:'단선',area:2.5,color:'녹색-노란색'};
function net(id,members,policy=aux,page=5,status='confirmed'){nets.push({id,members,policy,source:{page},status});}
for(let i=1;i<=3;i++){
 const color=['갈색','검은색','회색'][i-1],main={kind:'단선',area:2.5,color};
 net('상전원 '+i,[`TB1.L${i}`,`OCR.L${i}`,...(i===1?['MCCB.1차 L']:[])],main);
 net('OCR-MC '+i,[`OCR.T${i}`,`MC.L${i}`],main);
 net('MC-인버터 '+i,[`MC.T${i}`,`INVERTER.입력 L${i}`],main);
 net('인버터-전동기 단자대 '+i,[`INVERTER.출력 T${i}`,`TB4.T${i}`],{kind:'단선',area:2.5,color:null});
}
net('주회로 N',['TB1.N','MCCB.1차 N'],{kind:'단선',area:2.5,color:'갈색'});
net('보조회로 L',['MCCB.2차 L','SMPS.L1','OCR.A1','OCR.95',...Array.from({length:5},(_,i)=>`RY${i+1}.11`),'PLC.출력 COM','PLC.전원 L/+']);
net('보조회로 N',['MCCB.2차 N','SMPS.N','OCR.A2','MC.A2',...['YL2','RL1','GL1','YL1','RL2','GL2'].map(d=>`${d}.하단 접속부`),...Array.from({length:5},(_,i)=>`RY${i+1}.14`),'PLC.전원 N/-']);
net('OCR b접점 이후',['OCR.96','PB6.접점 위','MC.43','MC.31']);
net('자기유지 분기',['PB6.접점 아래','MC.44','PB7.접점 위']);
net('MC 코일',['PB7.접점 아래','MC.A1']);
net('정지 표시등',['MC.32','YL2.상단 접속부']);
for(const [i,lamp] of ['RL1','GL1','YL1','RL2','GL2'].entries())net('릴레이 표시 '+(i+1),[`RY${i+1}.7`,`${lamp}.상단 접속부`]);
net('DC +24V',['SMPS.+V','PLC.입력 COM'],aux,6);
net('DC 0V',['SMPS.-V',...Array.from({length:5},(_,i)=>`PB${i+1}.접점 위`)],aux,6);
for(let i=0;i<5;i++){
 net('PLC 입력 '+i,[`PB${i+1}.접점 아래`,`PLC.입력 ${i}`],aux,6);
 net('PLC 출력 '+i,[`PLC.출력 ${i}`,`RY${i+1}.13`],aux,6);
}
net('인버터 CM',['INVERTER.CM','SS1.접점 위','SS2.접점 위','SS3.접점 위','PLC.SG'],aux,6);
for(let i=1;i<=3;i++)net('인버터 다기능 '+i,[`SS${i}.접점 아래`,`INVERTER.P${i+2}`],aux,6);
net('통신 +',['PLC.485+','INVERTER.S+'],{kind:null,area:null,color:null},6);
net('통신 -',['PLC.485-','INVERTER.S-'],{kind:null,area:null,color:null},6);
net('인버터 보호도체',['INVERTER.E','TB3.E1'],pe);
net('PLC 보호도체',['PLC.E','TB3.E2'],pe);
// p1 §8 requires TB4, whereas p5 draws TB2 E to SMPS. Never resolve silently.
net('SMPS/전원 보호도체 확인 필요',['SMPS.E','TB2.E','TB4.E'],pe,1,'pending');
export const problem={id:'p01',name:'2025년 12월 13일 기출문제',devices,terminals,nets,terminalMap:tm,equivalentPairs:Array.from({length:5},(_,i)=>[`RY${i+1}.13`,`RY${i+1}.14`]),materialUnconfirmedTerminals:['PLC.SG','PLC.485+','PLC.485-','INVERTER.S+','INVERTER.S-'],
 pending:[
 {id:'physical',title:'제품별 실제 단자 위치',detail:'4페이지는 기구 외곽만 제공. TB와 릴레이 외 단자는 기능명 선택 방식이며 물리 위치를 재현하지 않았습니다.'},
 {id:'direction',title:'Y형 방향·2개 압착단자 체결 방향',detail:'1~6페이지에 세부 방향 기준 없음. 선택값은 저장하지만 옳고 그름은 판정하지 않습니다.'},
 {id:'earth',title:'SMPS·전원 보호도체',detail:'1페이지 8항의 TB4 지시와 5페이지 TB2 E 그림이 상충. 이 구간은 전기적 정답 확정 보류.'},
 {id:'pins',title:'번호 없는 접점·제품에 따른 단자',detail:'PB·SS·램프는 도면의 위/아래 접속부 기능명. MC·OCR은 6페이지 예시 번호이며 실물 호환 확인 필요. AC 릴레이 코일 13/14 교환은 허용합니다.'},
 {id:'material',title:'명시되지 않은 자재 규격',detail:'PLC 전원·통신, 인버터 제어의 압착 규격, 통신 전선, 인버터 출력 색상, OCR 주회로 압착규격은 확인 필요.'},
 {id:'workmanship',title:'실물 시공·인출선 점검',detail:'기구 접촉·타이·조임은 입력한 작업 상태로만 검사합니다. TB1 인출선 50~100mm·끝단 약10mm, 실물 고정 및 동작 시험은 사람이 확인해야 합니다.'}
 ]};
export function getProblem(power='AC'){
 const p=structuredClone(problem);p.terminalMap=Object.fromEntries(p.terminals.map(t=>[t.id,t]));p.power=power;
 if(power==='DC'){
  for(const n of p.nets)n.members=n.members.filter(t=>!['PLC.전원 L/+','PLC.전원 N/-'].includes(t));
  p.nets.find(n=>n.id==='DC +24V').members.push('PLC.전원 L/+');p.nets.find(n=>n.id==='DC 0V').members.push('PLC.전원 N/-');
 }
 return p;
}
