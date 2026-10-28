import test from 'node:test';
import assert from 'node:assert/strict';
import {createHardwareProblem} from '../dist/hardware.mjs';

test('SMPS physical terminal order is N, L, E, -V, +V from left to right',()=>{
 const p=createHardwareProblem('p01');
 const expected=[['N',-32],['L1',-16],['E',0],['-V',16],['+V',32]];
 for(const [name,x] of expected){
  const terminal=p.terminalMap[`SMPS.${name}`];
  assert.ok(terminal,`SMPS.${name}`);
  assert.equal(terminal.localPositionMm[0],x,`SMPS.${name}`);
 }
 const ys=expected.map(([name])=>p.terminalMap[`SMPS.${name}`].localPositionMm[1]);
 assert.equal(new Set(ys).size,1);
});
