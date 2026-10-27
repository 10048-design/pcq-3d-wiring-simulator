import test from 'node:test';
import assert from 'node:assert/strict';
import {grade} from '../dist/engine.mjs';
import {createHardwareProblem} from '../dist/hardware.mjs';

function end(t){
 return {crimp:t.crimp??'없음',tube:!!t.insulationTube,bareMm:0,tight:true,orientation:'정상',doubleMount:'등을 맞댐'};
}
function wire(p,from,to,id='W001'){
 const net=p.nets.find(n=>n.status==='confirmed'&&n.members.includes(from)&&n.members.includes(to));
 const policy=net?.policy??{kind:'연선',area:1.5,color:'노란색'};
 return {id,from,to,kind:policy.kind??'연선',area:policy.area??1.5,color:policy.color??'노란색',ends:{from:end(p.terminalMap[from]),to:end(p.terminalMap[to])},route:{assessment:'미검사'},via:[]};
}

const wrongPairs=[
 ['TB1.L1','TB1.L2'],
 ['TB1.N','SMPS.N'],
 ['SMPS.+V','SMPS.-V'],
 ['PLC.입력 0','PLC.출력 0'],
];
const rightPairs=[
 ['TB1.N','MCCB.1차 N'],
 ['MCCB.2차 N','SMPS.N'],
 ['SMPS.+V','PLC.입력 COM'],
];

test('all 26 profiles keep confirmed, pending and cross-NET grading boundaries strict',()=>{
 for(let i=1;i<=26;i++){
  const id='p'+String(i).padStart(2,'0'),p=createHardwareProblem(id);
  for(const [from,to] of wrongPairs){
   const r=grade(p,[wire(p,from,to)]);
   assert.ok(r.errors.some(e=>e.type==='잘못된 연결'),`${id}: ${from} ↔ ${to} must be wrong`);
  }
  for(const [from,to] of rightPairs){
   const r=grade(p,[wire(p,from,to)]);
   assert.ok(!r.errors.some(e=>e.type==='잘못된 연결'),`${id}: ${from} ↔ ${to} must stay electrically valid`);
  }
  for(const pending of p.nets.filter(n=>n.status==='pending')){
   for(const terminal of pending.members){
    const r=grade(p,[wire(p,'TB1.N',terminal)]);
    assert.ok(r.errors.some(e=>e.type==='잘못된 연결'),`${id}: confirmed N must not bridge into ${terminal}`);
   }
   if(pending.members.length>=2){
    const r=grade(p,[wire(p,pending.members[0],pending.members[1])]);
    assert.ok(!r.errors.some(e=>e.type==='잘못된 연결'),`${id}: same pending NET should remain review-only`);
    assert.equal(r.reviews.length,1,`${id}: pending connection should be flagged for review`);
   }
  }
 }
});
