import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeProgress,progressFilter} from '../dist/progress-status.mjs';

const aux={kind:'연선',area:1.5,color:'노란색'};
function fixture(){
 const terminals=['A','B','C','D','E','F','G'].map(id=>({id,deviceId:id,name:id,crimp:'1.5-3Y',maxConnections:2}));
 return {
  terminals,
  terminalMap:Object.fromEntries(terminals.map(t=>[t.id,t])),
  nets:[
   {id:'ABC',members:['A','B','C'],policy:aux,status:'confirmed'},
   {id:'DE',members:['D','E'],policy:aux,status:'confirmed'},
   {id:'접지 확인 필요',members:['F','G'],policy:{kind:'단선',area:2.5,color:'녹색-노란색'},status:'pending'},
  ],
  pending:[],
 };
}
function wire(from,to,id=from+to){return {id,from,to,...aux,ends:{from:{crimp:'1.5-3Y',bareMm:0,tight:true},to:{crimp:'1.5-3Y',bareMm:0,tight:true}},route:{assessment:'미검사'},via:[]};}

function item(summary,id){return summary.items.find(net=>net.id===id);}

test('progress treats A-B-C and A-C-B as the same completed NET',()=>{
 const a=analyzeProgress(fixture(),[wire('A','B','W1'),wire('B','C','W2')]);
 const b=analyzeProgress(fixture(),[wire('A','C','W1'),wire('C','B','W2')]);
 assert.equal(item(a,'ABC').state,'complete');
 assert.equal(item(b,'ABC').state,'complete');
});

test('partial NET is progress and untouched NET is not-started',()=>{
 const summary=analyzeProgress(fixture(),[wire('A','B','W1')]);
 assert.equal(item(summary,'ABC').state,'progress');
 assert.equal(item(summary,'DE').state,'not-started');
});

test('cross-NET wire marks related confirmed NETs as error',()=>{
 const summary=analyzeProgress(fixture(),[wire('A','D','W1')]);
 assert.equal(item(summary,'ABC').state,'error');
 assert.equal(item(summary,'DE').state,'error');
});

test('pending NET is excluded from confirmed completion denominator',()=>{
 const summary=analyzeProgress(fixture(),[]);
 assert.equal(summary.counts.total,2);
 assert.equal(summary.counts.pending,1);
 assert.equal(summary.ratio,0);
});

test('progress filters expose incomplete and issue states',()=>{
 assert.equal(progressFilter({status:'confirmed',state:'complete',warningCount:0,reviewCount:0},'incomplete'),false);
 assert.equal(progressFilter({status:'confirmed',state:'progress',warningCount:0,reviewCount:0},'incomplete'),true);
 assert.equal(progressFilter({status:'pending',state:'pending',warningCount:0,reviewCount:0},'issues'),true);
 assert.equal(progressFilter({status:'confirmed',state:'complete',warningCount:1,reviewCount:0},'issues'),true);
});

function mccbProgressFixture(){
 const defs=[
  ['TB1.L1','TB1','L1'],['TB1.N','TB1','N'],
  ['MCCB.1차 L','MCCB','1차 L'],['MCCB.1차 N','MCCB','1차 N'],
  ['MCCB.2차 N','MCCB','2차 N'],['SMPS.N','SMPS','N'],
 ];
 const terminals=defs.map(([id,deviceId,name])=>({id,deviceId,name,crimp:null,insulationTube:false,maxConnections:2}));
 return {
  terminals,
  terminalMap:Object.fromEntries(terminals.map(t=>[t.id,t])),
  nets:[
   {id:'상전원 1',members:['TB1.L1','MCCB.1차 L'],policy:{},status:'confirmed'},
   {id:'주회로 N',members:['TB1.N','MCCB.1차 N'],policy:{},status:'confirmed'},
   {id:'보조회로 N',members:['MCCB.2차 N','SMPS.N'],policy:{},status:'confirmed'},
  ],
  pending:[],
 };
}
function pWire(from,to,id){return {id,from,to,ends:{from:{},to:{}},route:{inDuct:true}};}

test('progress marks a downstream MCCB NET as error when an upstream wrong wire contaminates the same pole',()=>{
 const p=mccbProgressFixture();
 const summary=analyzeProgress(p,[
  pWire('TB1.L1','MCCB.1차 N','W001'),
  pWire('TB1.N','MCCB.1차 N','W002'),
  pWire('MCCB.2차 N','SMPS.N','W003'),
 ]);
 const downstream=summary.items.find(n=>n.id==='보조회로 N');
 assert.equal(downstream.state,'error');
 assert.equal(downstream.networkImpact,true);
});
