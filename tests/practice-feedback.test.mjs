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
