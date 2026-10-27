import {UnionFind} from './engine.mjs';

function validWire(problem,w){
 const ts=problem.terminalMap??{};
 return Boolean(w&&ts[w.from]&&ts[w.to]&&w.from!==w.to&&ts[w.from].connectable!==false&&ts[w.to].connectable!==false);
}

function mccbContinuityLinks(problem){
 const links=[];
 const byDevice=new Map();
 for(const t of problem.terminals??[]){
  if(!byDevice.has(t.deviceId))byDevice.set(t.deviceId,[]);
  byDevice.get(t.deviceId).push(t);
 }
 for(const [deviceId,terminals] of byDevice){
  if(deviceId!=='MCCB'&&!/^MCCB\b/.test(deviceId))continue;
  const byName=new Map(terminals.map(t=>[t.name,t.id]));
  for(const [a,b] of [['1차 L','2차 L'],['1차 N','2차 N']]){
   if(byName.has(a)&&byName.has(b))links.push([byName.get(a),byName.get(b)]);
  }
 }
 return links;
}

export function practiceContinuityLinks(problem){
 const links=[...(problem.internalLinks??[]),...(problem.practiceContinuityLinks??[]),...mccbContinuityLinks(problem)];
 const seen=new Set(),out=[];
 for(const [a,b] of links){
  if(!problem.terminalMap?.[a]||!problem.terminalMap?.[b]||a===b)continue;
  const key=[a,b].sort().join('\u0000');
  if(seen.has(key))continue;
  seen.add(key);out.push([a,b]);
 }
 return out;
}

export function analyzeNetworkImpact(problem,connections,gradeResult){
 const uf=new UnionFind((problem.terminals??[]).map(t=>t.id));
 for(const [a,b] of practiceContinuityLinks(problem))uf.join(a,b);
 for(const w of connections??[])if(validWire(problem,w))uf.join(w.from,w.to);

 const directErrors=(gradeResult?.errors??[]).filter(e=>e.type==='잘못된 연결'&&(e.wireIds??[]).length);
 const directWireIds=new Set(directErrors.flatMap(e=>e.wireIds??[]));
 const contaminatedRoots=new Set();
 for(const w of connections??[]){
  if(!directWireIds.has(w.id)||!validWire(problem,w))continue;
  contaminatedRoots.add(uf.find(w.from));
 }

 const affectedWireIds=new Set(),affectedTerminalIds=new Set();
 for(const w of connections??[]){
  if(!validWire(problem,w))continue;
  const root=uf.find(w.from);
  if(!contaminatedRoots.has(root))continue;
  affectedWireIds.add(w.id);affectedTerminalIds.add(w.from);affectedTerminalIds.add(w.to);
 }
 for(const t of problem.terminals??[]){
  if(contaminatedRoots.has(uf.find(t.id)))affectedTerminalIds.add(t.id);
 }
 const propagatedWireIds=new Set([...affectedWireIds].filter(id=>!directWireIds.has(id)));
 return {directErrors,directWireIds,affectedWireIds,propagatedWireIds,affectedTerminalIds,contaminatedRoots};
}
