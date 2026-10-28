import test from 'node:test';
import assert from 'node:assert/strict';
import {createHardwareProblem} from '../dist/hardware.mjs';
import {grade} from '../dist/engine.mjs';
import {assessPractice} from '../dist/practice-feedback.mjs';
import {analyzeProgress} from '../dist/progress-status.mjs';

function endpoint(terminal,{tube=true}={}){
 return {
  crimp:terminal.crimp??null,
  tube,
  orientation:'정상',
  doubleMount:'등을 맞댐',
  bareMm:0,
  insulationClamped:false,
  tight:true,
 };
}

function wire(problem,from,to,{id='W001',noTubeAt=null}={}){
 return {
  id,from,to,kind:'연선',area:1.5,color:'노란색',
  ends:{
   from:endpoint(problem.terminalMap[from],{tube:from!==noTubeAt}),
   to:endpoint(problem.terminalMap[to],{tube:to!==noTubeAt}),
  },
  route:{inDuct:true,touchesDevice:false,tieSpacingMm:100,tieTrimmed:true},
  via:[],
 };
}

function tubeErrors(result,terminalId){
 return result.errors.filter(error=>error.type==='절연튜브'&&error.terminalIds?.includes(terminalId));
}

function assertTubeWarning(problem,connections,terminalId){
 const result=grade(problem,connections);
 assert.equal(tubeErrors(result,terminalId).length,1,`${terminalId}: grade`);
 const practice=assessPractice(problem,connections,connections.at(-1).id);
 assert.ok(practice.latestErrors.some(error=>error.type==='절연튜브'&&error.terminalIds?.includes(terminalId)),`${terminalId}: practice`);
 assert.equal(practice.status,'error',`${terminalId}: practice status`);
 const progress=analyzeProgress(problem,connections);
 assert.ok(progress.items.some(item=>item.warningIds?.some(id=>id.startsWith('tube:'))),`${terminalId}: progress warning`);
 assert.ok(progress.counts.warnings>=1,`${terminalId}: warning count`);
}

test('all problem profiles require insulation tube on every connectable PLC terminal',()=>{
 for(let i=1;i<=26;i++){
  const problemId=`p${String(i).padStart(2,'0')}`;
  const problem=createHardwareProblem(problemId);
  assert.equal(problem.profile.tubeScope,'all',problemId);
  for(const terminal of problem.devices.find(device=>device.id==='PLC').terminalObjects.filter(t=>t.connectable)){
   assert.equal(terminal.insulationTubeRequired,true,`${problemId}: ${terminal.id}`);
  }
 }
});

test('p20 SMPS L/N to PLC power L/N without PLC-side tube is reported everywhere',()=>{
 const problem=createHardwareProblem('p20');
 for(const [from,to,plcTerminal] of [
  ['SMPS.L1','PLC.전원 L/+','PLC.전원 L/+'],
  ['SMPS.N','PLC.전원 N/-','PLC.전원 N/-'],
 ]){
  assertTubeWarning(problem,[wire(problem,from,to,{noTubeAt:plcTerminal})],plcTerminal);
 }
});

test('p20 PLC I/O, communication and protective-earth terminals also require tube',()=>{
 const problem=createHardwareProblem('p20');
 for(const terminalId of ['PLC.입력 0','PLC.출력 0','PLC.COM0','PLC.485+','PLC.485-','PLC.SG','PLC.E']){
  assert.equal(problem.terminalMap[terminalId].insulationTubeRequired,true,terminalId);
 }
});
