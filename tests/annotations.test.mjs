import test from 'node:test';
import assert from 'node:assert/strict';
import {createStrokeId,createAnnotationDocument,createStroke,appendPoint,addAnnotationStroke,removeAnnotationStroke,undoAnnotation,redoAnnotation,cloneAnnotationSettings,strokePath} from '../dist/annotations.mjs';

test('fallback stroke IDs remain unique well beyond 1000 strokes',()=>{
 const ids=new Set();const cryptoObj={};
 for(let i=0;i<5000;i++)ids.add(createStrokeId({cryptoObj,now:()=>123456789,random:()=>.25}));
 assert.equal(ids.size,5000);
});

test('stroke keeps the style snapshot used when it was created',()=>{
 const settings=cloneAnnotationSettings();settings.highlighter.width=18;settings.highlighter.opacity=.2;
 const stroke=createStroke('highlighter',settings,{x:10,y:20},{id:'s1'});
 settings.highlighter.width=40;settings.highlighter.opacity=.7;settings.highlighter.color='#000000';
 assert.equal(stroke.width,18);assert.equal(stroke.opacity,.2);assert.equal(stroke.color,'#ffe45c');
});

test('annotation undo and redo work for add and remove operations',()=>{
 const doc=createAnnotationDocument(),settings=cloneAnnotationSettings();
 const stroke=createStroke('marker',settings,{x:1,y:1},{id:'s1'});appendPoint(stroke,{x:3,y:3});addAnnotationStroke(doc,stroke);
 assert.equal(doc.strokes.length,1);assert.equal(undoAnnotation(doc),true);assert.equal(doc.strokes.length,0);assert.equal(redoAnnotation(doc),true);assert.equal(doc.strokes.length,1);
 removeAnnotationStroke(doc,'s1');assert.equal(doc.strokes.length,0);undoAnnotation(doc);assert.equal(doc.strokes.length,1);
});

test('strokePath produces a drawable path for dots and multi-point strokes',()=>{
 assert.match(strokePath([{x:1,y:2}]),/^M /);assert.match(strokePath([{x:1,y:2},{x:3,y:4},{x:5,y:6}]),/ Q /);
});
