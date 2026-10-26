import test from 'node:test';
import assert from 'node:assert/strict';
import {CTPassDetector,eligibleRoutePortIds} from '../dist/ct-pass-detector.mjs';
import {createHardwareProblem} from '../dist/hardware.mjs';

const target={id:'OCR.CT1',x:100,y:100,radius:12};

test('CT detector: entering the core and leaving on the opposite side registers one passage',()=>{
 const d=new CTPassDetector();
 assert.deepEqual(d.update({x:80,y:100},[target]).passed,[]);
 assert.deepEqual(d.update({x:96,y:100},[target]).inside,['OCR.CT1']);
 d.update({x:102,y:100},[target]);
 assert.deepEqual(d.update({x:120,y:100},[target]).passed,['OCR.CT1']);
 assert.deepEqual(d.update({x:80,y:100},[target]).passed,[]);
});

test('CT detector: skimming the edge or exiting on the same side does not count',()=>{
 const edge=new CTPassDetector();edge.update({x:80,y:89},[target]);edge.update({x:100,y:89},[target]);assert.deepEqual(edge.update({x:120,y:89},[target]).passed,[]);
 const sameSide=new CTPassDetector();sameSide.update({x:80,y:100},[target]);sameSide.update({x:96,y:100},[target]);sameSide.update({x:100,y:100},[target]);assert.deepEqual(sameSide.update({x:82,y:100},[target]).passed,[]);
});

test('CT detector: a fast pointer segment crossing the core is still detected',()=>{
 const d=new CTPassDetector();d.update({x:70,y:100},[target]);assert.deepEqual(d.update({x:130,y:100},[target]).passed,['OCR.CT1']);
});

test('CT auto detection only arms the passage belonging to the selected main-power net',()=>{
 const p=createHardwareProblem('p01');
 assert.deepEqual([...eligibleRoutePortIds(p,'TB1.L1')],['OCR.CT1']);
 assert.deepEqual([...eligibleRoutePortIds(p,'MC.L2')],['OCR.CT2']);
 assert.deepEqual([...eligibleRoutePortIds(p,'PB1.접점 위')],[]);
});
