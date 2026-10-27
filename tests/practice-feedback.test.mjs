import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPractice} from '../dist/practice-feedback.mjs';

const aux={kind:'연선',area:1.5,color:'노란색'};
function fixture(){
 const terminals=['A','B','C','D'].map(id=>({id,deviceId:id,name:id,crimp:'1.5-3Y',insulationTube:false,maxConnections:2}));
 return {terminals,terminalMap:Object.fromEntries(terminals.map(t=>[t.id,t])),nets:[{id:'ABC',members:['A','B','C'],policy:aux,status:'confirmed'},{id:'D',members:['D'],policy:aux,status:'confirmed'}],pending:[]};
}
function wire(from,to,id='W001'){return {id,from,to,...aux,ends:{from:{crimp:'1.5-3Y',tube:false,bareMm:0,tight:true},to:{crimp:'1.5-3Y',tube:false,bareMm:0,tight:true}},route:{inDuct:true,tieSpacingMm:100,tieTrimmed:true}};}

test('practice feedback accepts a correct partial connection without exposing missing work',()=>{const r=assessPractice(fixture(),[wire('A','B')],'W001');assert.equal(r.ok,true);assert.equal(r.errors.length,0);assert.equal(r.latestErrors.length,0);});
test('practice feedback immediately reports a wrong terminal connection',()=>{const r=assessPractice(fixture(),[wire('A','D')],'W001');assert.equal(r.ok,false);assert.ok(r.latestErrors.some(e=>e.type==='잘못된 연결'));assert.ok(r.errors.every(e=>e.type!=='필수 연결 누락'));});
test('practice feedback immediately reports material mistakes on the new wire',()=>{const w=wire('A','B');w.color='검은색';const r=assessPractice(fixture(),[w],'W001');assert.equal(r.ok,false);assert.ok(r.latestErrors.some(e=>e.type==='전선 색상'));});
test('practice feedback keeps actionable errors from earlier wires visible',()=>{const bad=wire('A','D','W001'),good=wire('A','B','W002');const r=assessPractice(fixture(),[bad,good],'W002');assert.ok(r.errors.some(e=>(e.wireIds??[]).includes('W001')));});

test('practice feedback rejects a confirmed-to-pending cross connection',()=>{const p=fixture();p.nets[1].status='pending';const r=assessPractice(p,[wire('A','D')],'W001');assert.equal(r.status,'error');assert.equal(r.ok,false);assert.ok(r.latestErrors.some(e=>e.type==='잘못된 연결'));});
test('practice feedback labels an in-pending connection as review, not correct',()=>{const p=fixture();p.nets=[{id:'AB',members:['A','B'],policy:aux,status:'confirmed'},{id:'CD',members:['C','D'],policy:aux,status:'pending'}];const r=assessPractice(p,[wire('C','D')],'W001');assert.equal(r.status,'review');assert.equal(r.ok,false);assert.equal(r.latestErrors.length,0);assert.equal(r.latestReviews.length,1);});

function mccbFixture(){
 const defs=[
  ['TB1.L1','TB1','L1'],['TB1.N','TB1','N'],
  ['MCCB.1차 L','MCCB','1차 L'],['MCCB.1차 N','MCCB','1차 N'],
  ['MCCB.2차 L','MCCB','2차 L'],['MCCB.2차 N','MCCB','2차 N'],
  ['SMPS.L1','SMPS','L1'],['SMPS.N','SMPS','N'],
 ];
 const terminals=defs.map(([id,deviceId,name])=>({id,deviceId,name,crimp:null,insulationTube:false,maxConnections:2}));
 return {terminals,terminalMap:Object.fromEntries(terminals.map(t=>[t.id,t])),nets:[
  {id:'상전원 1',members:['TB1.L1','MCCB.1차 L'],policy:{},status:'confirmed'},
  {id:'주회로 N',members:['TB1.N','MCCB.1차 N'],policy:{},status:'confirmed'},
  {id:'보조회로 L',members:['MCCB.2차 L','SMPS.L1'],policy:{},status:'confirmed'},
  {id:'보조회로 N',members:['MCCB.2차 N','SMPS.N'],policy:{},status:'confirmed'},
 ],pending:[]};
}
function plainWire(from,to,id){return {id,from,to,ends:{from:{},to:{}},route:{inDuct:true}};}

test('practice feedback marks a correct wire as affected when it shares a terminal with an earlier wrong wire',()=>{
 const p=mccbFixture(),connections=[plainWire('TB1.L1','MCCB.1차 N','W001'),plainWire('TB1.N','MCCB.1차 N','W002')];
 const r=assessPractice(p,connections,'W002');
 assert.equal(r.status,'affected');
 assert.equal(r.latestErrors.length,0);
 assert.equal(r.latestImpacts.length,1);
 assert.ok(r.errors.some(e=>e.type==='연결망 오류 영향'&&e.wireIds.includes('W002')));
});

test('practice feedback propagates an upstream MCCB pole fault to the correct downstream wire',()=>{
 const p=mccbFixture(),connections=[plainWire('TB1.L1','MCCB.1차 N','W001'),plainWire('TB1.N','MCCB.1차 N','W002'),plainWire('MCCB.2차 N','SMPS.N','W003')];
 const r=assessPractice(p,connections,'W003');
 assert.equal(r.status,'affected');
 assert.equal(r.latestErrors.length,0);
 assert.equal(r.latestImpacts.length,1);
 assert.ok(r.impact.affectedWireIds.has('W003'));
});

test('practice feedback returns to normal after the source wrong wire is removed',()=>{
 const p=mccbFixture(),connections=[plainWire('TB1.N','MCCB.1차 N','W002'),plainWire('MCCB.2차 N','SMPS.N','W003')];
 const r=assessPractice(p,connections,'W003');
 assert.equal(r.status,'ok');
 assert.equal(r.latestImpacts.length,0);
});

test('practice fault propagation stays on the affected MCCB pole',()=>{
 const p=mccbFixture(),connections=[plainWire('TB1.L1','MCCB.1차 N','W001'),plainWire('MCCB.2차 L','SMPS.L1','W004')];
 const r=assessPractice(p,connections,'W004');
 assert.equal(r.status,'ok');
 assert.equal(r.latestImpacts.length,0);
});
