export const PROGRESS_VERSION=1;

const DB_NAME='pcq-3d-progress';
const STORE_NAME='attempts';
const FALLBACK_PREFIX='pcq-3d-progress-v1:';
const clone=value=>value==null?value:structuredClone(value);

function compactDraft(draft){
 if(!draft)return null;
 const copy=clone(draft);
 if(copy.source)copy.source={id:copy.source.id};
 if(copy.destination)copy.destination={id:copy.destination.id};
 return copy;
}
function compactWiring(snapshot){return {...clone(snapshot),draft:compactDraft(snapshot?.draft)};}
function validConnection(problem,wire){return wire&&typeof wire.id==='string'&&problem.terminalMap[wire.from]?.connectable!==false&&problem.terminalMap[wire.to]?.connectable!==false&&wire.from!==wire.to;}
function validateWiring(problem,snapshot){
 if(!snapshot||typeof snapshot.stage!=='string')throw Error('저장된 배선 단계가 올바르지 않습니다.');
 for(const terminal of [snapshot.draft?.source,snapshot.draft?.destination])if(terminal&&!problem.terminalMap[terminal.id])throw Error('저장된 배선 단자를 찾을 수 없습니다.');
 return compactWiring(snapshot);
}

export function captureProgress(problem,attempt,wiring,{selectedWireId=null,lastWire=null,now=Date.now}={}){
 if(!['running','finished'].includes(attempt.state))return null;
 return {
  version:PROGRESS_VERSION,problemId:problem.id,savedAt:now(),
  attempt:{state:attempt.state,elapsedMs:attempt.elapsed(),serial:attempt.serial,connections:clone(attempt.connections),history:clone(attempt.history)},
  wiring:compactWiring(wiring.snapshot()),wiringHistory:wiring.history.map(compactWiring),
  selectedWireId,lastWire:clone(lastWire)
 };
}

export function restoreProgress(record,problem,attempt,wiring){
 if(!record||record.version!==PROGRESS_VERSION||record.problemId!==problem.id)throw Error('이 문제의 저장 데이터가 아닙니다.');
 const saved=record.attempt;if(!saved||!['running','finished'].includes(saved.state)||!Array.isArray(saved.connections)||!Array.isArray(saved.history))throw Error('저장된 실습 상태가 올바르지 않습니다.');
 if(!saved.connections.every(w=>validConnection(problem,w))||!saved.history.every(items=>Array.isArray(items)&&items.every(w=>validConnection(problem,w))))throw Error('저장된 전선 데이터가 올바르지 않습니다.');
 attempt.state=saved.state;attempt.elapsedMs=Math.max(0,Number(saved.elapsedMs)||0);attempt.connections=clone(saved.connections);attempt.history=clone(saved.history);attempt.result=null;
 const greatest=attempt.connections.reduce((n,w)=>Math.max(n,Number(String(w.id).match(/^W(\d+)$/)?.[1])||0),0);attempt.serial=Math.max(greatest,Number(saved.serial)||0);
 attempt.startedAt=attempt.state==='running'?attempt.now()-attempt.elapsedMs:null;
 wiring.restore(validateWiring(problem,record.wiring));
 wiring.history=(record.wiringHistory??[]).map(s=>validateWiring(problem,s));
 const selectedWireId=attempt.connections.some(w=>w.id===record.selectedWireId)?record.selectedWireId:null;
 return {selectedWireId,lastWire:clone(record.lastWire)};
}

export class ProgressStore{
 constructor({indexedDB=globalThis.indexedDB,localStorage=globalThis.localStorage}={}){this.indexedDB=indexedDB;this.localStorage=localStorage;this.dbPromise=null;}
 fallbackKey(problemId){return FALLBACK_PREFIX+problemId;}
 async db(){
  if(!this.indexedDB)return null;if(this.dbPromise)return this.dbPromise;
  this.dbPromise=new Promise((resolve,reject)=>{const request=this.indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE_NAME))request.result.createObjectStore(STORE_NAME,{keyPath:'problemId'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  return this.dbPromise;
 }
 async transact(mode,action){const db=await this.db();if(!db)return null;return new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,mode),request=action(tx.objectStore(STORE_NAME));request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(request.error);tx.onerror=()=>reject(tx.error);});}
 readFallback(problemId){try{return JSON.parse(this.localStorage?.getItem(this.fallbackKey(problemId)))??null;}catch{return null;}}
 writeFallback(problemId,value){try{this.localStorage?.setItem(this.fallbackKey(problemId),JSON.stringify(value));return true;}catch{return false;}}
 removeFallback(problemId){try{this.localStorage?.removeItem(this.fallbackKey(problemId));}catch{}}
 async load(problemId){if(!this.indexedDB)return this.readFallback(problemId);try{return await this.transact('readonly',s=>s.get(problemId))??this.readFallback(problemId);}catch{return this.readFallback(problemId);}}
 async save(record){if(!record)return;if(!this.indexedDB){this.writeFallback(record.problemId,record);return;}try{await this.transact('readwrite',s=>s.put(clone(record)));this.removeFallback(record.problemId);}catch{this.writeFallback(record.problemId,record);}}
 async delete(problemId){if(this.indexedDB)try{await this.transact('readwrite',s=>s.delete(problemId));}catch{}this.removeFallback(problemId);}
}
