const wireTypes=new Set(['잘못된 연결','전선 종류','전선 굵기','전선 색상','배선 경로','기구 접촉','케이블타이','CT 관통']);

export function friendlyTerminal(problem,id){
 const t=problem.terminalMap[id];if(!t)return String(id??'단자');
 return `${t.deviceId} ${t.displayNumber||t.physicalNumber||t.name||''}`.trim();
}

export function simpleErrorMessage(problem,error,connections=[]){
 const terminal=friendlyTerminal(problem,error.terminalIds?.[0]),wire=connections.find(w=>error.wireIds?.includes(w.id));
 const from=wire?friendlyTerminal(problem,wire.from):null,to=wire?friendlyTerminal(problem,wire.to):null;
 switch(error.type){
  case '필수 연결 누락':{const suggested=String(error.correct??'').match(/^(.+?) ↔ (.+?) 또는/),names=suggested?[friendlyTerminal(problem,suggested[1]),friendlyTerminal(problem,suggested[2])]:[...new Set((error.terminalIds??[]).map(id=>friendlyTerminal(problem,id)))];return names.length>1?`${names[0]} → ${names[1]} 연결 X`:`${terminal} 연결 X`;}
  case '잘못된 연결':return from&&to?`${from} → ${to} 연결 X`:'잘못된 단자 연결 X';
  case '전선 색상':return `${from&&to?`${from} → ${to} `:''}선 색상 X (${error.wrong.split(': ').at(-1)} / ${error.correct.split(': ').at(-1)})`;
  case '전선 굵기':return `${from&&to?`${from} → ${to} `:''}전선 굵기 X (${error.wrong.split(': ').at(-1)} / ${error.correct.split(': ').at(-1)})`;
  case '전선 종류':return `${from&&to?`${from} → ${to} `:''}전선 종류 X (${error.wrong.split(': ').at(-1)} / ${error.correct.split(': ').at(-1)})`;
  case '압착단자 규격':return `${terminal} 압착단자 X (${error.wrong.split(': ').at(-1)} / ${error.correct.split(': ').at(-1)})`;
  case '절연튜브':return `${terminal} 절연튜브 X`;
  case '압착단자 방향':return `${terminal} 압착 방향 X`;
  case '2개 압착단자 체결':return `${terminal} 2개 체결 방향 X`;
  case '단자 체결 수':return `${terminal} 전선 수 X`;
  case '단자 조임':return `${terminal} 피복·조임 X`;
  case '배선 경로':return `${from&&to?`${from} → ${to} `:''}배선 경로 X`;
  case 'CT 관통':return `${terminal} CT 통과 X`;
  default:return String(error.wrong??'배선 상태 X').replace(/NET/gi,'연결');
 }
}

export function groupErrorsForMarkers(problem,errors,connections=[]){
 const groups=new Map();
 for(const error of errors){
  const wireId=error.wireIds?.[0],deviceId=error.deviceIds?.[0];
  const key=wireTypes.has(error.type)&&wireId?`wire:${wireId}`:deviceId?`device:${deviceId}`:wireId?`wire:${wireId}`:`error:${error.id}`;
  if(!groups.has(key))groups.set(key,{id:'marker:'+key,markerKey:key,anchorDeviceId:key.startsWith('device:')?deviceId:null,anchorWireId:key.startsWith('wire:')?wireId:null,errors:[],deviceIds:[],terminalIds:[],wireIds:[],viewed:false});
  const group=groups.get(key);group.errors.push({...error,simpleMessage:simpleErrorMessage(problem,error,connections)});group.deviceIds=[...new Set([...group.deviceIds,...(error.deviceIds??[])])];group.terminalIds=[...new Set([...group.terminalIds,...(error.terminalIds??[])])];group.wireIds=[...new Set([...group.wireIds,...(error.wireIds??[])])];
 }
 for(const group of groups.values()){group.count=group.errors.length;group.title=group.anchorDeviceId?`${group.anchorDeviceId} 오류`:group.anchorWireId?`${group.anchorWireId} 전선 오류`:'배선 오류';}
 return [...groups.values()];
}
