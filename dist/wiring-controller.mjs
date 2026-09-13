import {UnionFind} from './engine.mjs';

export const STAGES={WIRE:'전선 선택',START_TUBE:'시작측 절연튜브',START_CRIMP:'시작측 압착단자',START_TERMINAL:'시작 단자',ROUTE:'배선 경로',END_TUBE:'끝측 절연튜브',END_CRIMP:'끝측 압착단자'};
export const defaultEnd=()=>({crimp:null,tube:null,orientation:'정상',doubleMount:'등을 맞댐',bareMm:0,insulationClamped:false,tight:true});
export const defaultMaterial=()=>({kind:'연선',area:1.5,color:'노란색',end:{...defaultEnd(),crimp:'1.5-3Y',tube:false}});
const clone=value=>structuredClone(value);

export class WiringController {
 constructor(problem,attempt){this.problem=problem;this.attempt=attempt;this.material=defaultMaterial();this.draft=null;this.stage=STAGES.WIRE;this.history=[];this.legacy=false;}
 snapshot(){return {stage:this.stage,draft:clone(this.draft),material:clone(this.material),legacy:this.legacy};}
 remember(){this.history.push(this.snapshot());}
 restore(s){this.stage=s.stage;this.draft=s.draft;this.material=s.material;this.legacy=s.legacy;if(this.draft?.source)this.draft.source=this.problem.terminalMap[this.draft.source.id];if(this.draft?.destination)this.draft.destination=this.problem.terminalMap[this.draft.destination.id];}
 requireRunning(){if(this.attempt.state!=='running')throw Error('시작 버튼을 눌러주세요.');}
 chooseWire({kind,area,color}){this.requireRunning();this.remember();this.legacy=false;this.material={kind,area,color,end:{...defaultEnd()}};this.draft={source:null,destination:null,material:{kind,area,color},ends:{from:defaultEnd(),to:defaultEnd()},via:[]};this.stage=STAGES.START_TUBE;return {type:'wire'};}
 chooseTube(use){this.requireRunning();if(![STAGES.START_TUBE,STAGES.END_TUBE].includes(this.stage))throw Error('지금은 절연튜브를 선택할 단계가 아닙니다.');this.remember();const side=this.stage===STAGES.START_TUBE?'from':'to';this.draft.ends[side].tube=Boolean(use);this.stage=side==='from'?STAGES.START_CRIMP:STAGES.END_CRIMP;return {type:'tube',side,use:Boolean(use)};}
 chooseCrimp(crimp){this.requireRunning();if(![STAGES.START_CRIMP,STAGES.END_CRIMP].includes(this.stage))throw Error('먼저 전선과 절연튜브 사용 여부를 선택해주세요.');this.remember();const side=this.stage===STAGES.START_CRIMP?'from':'to';this.draft.ends[side].crimp=crimp;if(side==='from'){this.stage=STAGES.START_TERMINAL;return {type:'crimp',side};}const id=this.complete();return {type:'connection',side,id};}
 select(terminal){
  this.requireRunning();if(this.problem.terminalMap[terminal.id]!==terminal||!terminal.connectable)throw Error('연결 가능한 등록 단자를 선택해주세요.');
  if(this.legacy)return this.legacySelect(terminal);
  if(this.stage===STAGES.START_TERMINAL){this.remember();this.draft.source=terminal;this.stage=STAGES.ROUTE;return {type:'source',terminal};}
  if(this.stage===STAGES.ROUTE){if(terminal===this.draft.source)throw Error('다른 목적 단자를 선택해주세요.');this.remember();this.draft.destination=terminal;this.stage=STAGES.END_TUBE;return {type:'destination',terminal};}
  if(this.stage===STAGES.WIRE)throw Error('먼저 사용할 전선을 선택해주세요.');
  throw Error(this.stage===STAGES.START_TUBE||this.stage===STAGES.END_TUBE?'절연튜브 사용 여부를 먼저 선택해주세요.':this.stage===STAGES.START_CRIMP||this.stage===STAGES.END_CRIMP?'압착단자를 먼저 선택해주세요.':'현재 작업 단계를 완료해주세요.');
 }
 complete(){const d=this.draft;if(!d?.source||!d?.destination)throw Error('시작 단자와 목적 단자가 필요합니다.');const id=this.attempt.add({from:d.source.id,to:d.destination.id,kind:d.material.kind,area:d.material.area,color:d.material.color,wireType:d.material.kind,wireGauge:d.material.area,wireColor:d.material.color,startTerminal:d.source.id,endTerminal:d.destination.id,startCrimpTerminal:d.ends.from.crimp,endCrimpTerminal:d.ends.to.crimp,startInsulationTube:d.ends.from.tube,endInsulationTube:d.ends.to.tube,startCrimpOrientation:d.ends.from.orientation,endCrimpOrientation:d.ends.to.orientation,ends:clone(d.ends),via:clone(d.via),waypoints:clone(d.via.filter(v=>v?.point).map(v=>v.point)),path:clone(d.via),route:{assessment:'미검사'}});this.draft=null;this.stage=STAGES.WIRE;this.history=[];return id;}
 waypoint(point){this.requireRunning();if(this.stage!==STAGES.ROUTE||!this.draft?.source)throw Error('먼저 시작 단자를 체결해주세요.');if(!Array.isArray(point)||point.length<3)return;this.remember();this.draft.via.push({point:point.map(v=>Math.round(v*10)/10)});}
 through(port){this.requireRunning();if(this.stage!==STAGES.ROUTE||!this.draft?.source)throw Error('먼저 시작 단자를 체결해주세요.');if(!this.problem.routePorts.includes(port))throw Error('알 수 없는 CT입니다.');if(!this.draft.via.some(v=>v===port.id)){this.remember();this.draft.via.push(port.id);}}
 cancel(){this.draft=null;this.stage=STAGES.WIRE;this.history=[];this.legacy=false;}
 undo(){this.requireRunning();if(this.history.length){this.restore(this.history.pop());return {type:'draft'};}if(this.attempt.history.length){this.attempt.undo();return {type:'connection'};}return {type:'none'};}
 prepare(){this.requireRunning();this.legacy=true;this.stage='피복 제거';}
 crimp(){if(this.stage!=='피복 제거')throw Error('먼저 피복을 제거하세요.');this.stage='압착 완료';}
 legacySelect(terminal){if(!this.draft){if(this.stage!=='압착 완료')throw Error('피복 제거 → 압착 장착 후 시작 단자를 선택하세요.');this.draft={source:terminal,material:clone(this.material),via:[]};return {type:'source',terminal};}if(terminal===this.draft.source)throw Error('다른 도착 단자를 선택하세요.');const d=this.draft,id=this.attempt.add({from:d.source.id,to:terminal.id,kind:d.material.kind,area:d.material.area,color:d.material.color,ends:{from:d.material.end,to:clone(this.material.end)},via:clone(d.via),route:{assessment:'미검사'}});this.draft=null;this.stage='압착 완료';return {type:'connection',id};}
}

export function connectionNets(problem,connections){
 const uf=new UnionFind(problem.terminals.map(t=>t.id));for(const pair of problem.internalLinks??[])uf.join(...pair);
 for(const w of connections)if(problem.terminalMap[w.from]?.connectable&&problem.terminalMap[w.to]?.connectable)uf.join(w.from,w.to);
 const groups=new Map();for(const t of problem.terminals){const root=uf.find(t.id);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(t.id);}
 return [...groups.values()].filter(g=>g.some(id=>connections.some(w=>w.from===id||w.to===id))).map(members=>({id:'USER:'+members[0],members}));
}
