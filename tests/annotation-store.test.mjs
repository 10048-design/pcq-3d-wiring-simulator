import test from 'node:test';
import assert from 'node:assert/strict';
import {AnnotationStore} from '../dist/annotation-store.mjs';

class MemoryStorage{
 constructor(){this.map=new Map();}
 getItem(k){return this.map.has(k)?this.map.get(k):null;}
 setItem(k,v){this.map.set(k,String(v));}
 removeItem(k){this.map.delete(k);}
}

test('annotation fallback storage keeps control and additional diagrams independent',async()=>{
 const localStorage=new MemoryStorage(),store=new AnnotationStore({indexedDB:null,localStorage});
 const a={id:'a',tool:'marker',color:'#000',width:4,opacity:1,points:[{x:1,y:2}]};
 const b={id:'b',tool:'highlighter',color:'#ff0',width:20,opacity:.2,points:[{x:3,y:4}]};
 await store.save('p01',5,[a]);await store.save('p01',6,[b]);
 assert.deepEqual((await store.load('p01',5)).strokes,[a]);
 assert.deepEqual((await store.load('p01',6)).strokes,[b]);
 await store.delete('p01',5);assert.deepEqual((await store.load('p01',5)).strokes,[]);assert.deepEqual((await store.load('p01',6)).strokes,[b]);
});
