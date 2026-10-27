import {ANNOTATION_VERSION} from './annotations.mjs';

const DB_NAME='pcq-3d-annotations';
const STORE_NAME='pages';
const FALLBACK_PREFIX='pcq-3d-annotations-v1:';
const clone=value=>value==null?value:structuredClone(value);

export class AnnotationStore{
 constructor({indexedDB=globalThis.indexedDB,localStorage=globalThis.localStorage}={}){this.indexedDB=indexedDB;this.localStorage=localStorage;this.dbPromise=null;}
 key(problemId,page){return `${problemId}:${Number(page)}`;}
 fallbackKey(problemId,page){return FALLBACK_PREFIX+this.key(problemId,page);}
 async db(){
  if(!this.indexedDB)return null;if(this.dbPromise)return this.dbPromise;
  this.dbPromise=new Promise((resolve,reject)=>{const request=this.indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE_NAME))request.result.createObjectStore(STORE_NAME,{keyPath:'key'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  return this.dbPromise;
 }
 async transact(mode,action){const db=await this.db();if(!db)return null;return new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,mode),request=action(tx.objectStore(STORE_NAME));request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(request.error);tx.onerror=()=>reject(tx.error);});}
 readFallback(problemId,page){try{return JSON.parse(this.localStorage?.getItem(this.fallbackKey(problemId,page)))??null;}catch{return null;}}
 writeFallback(problemId,page,value){try{this.localStorage?.setItem(this.fallbackKey(problemId,page),JSON.stringify(value));return true;}catch{return false;}}
 removeFallback(problemId,page){try{this.localStorage?.removeItem(this.fallbackKey(problemId,page));}catch{}}
 async load(problemId,page){
  const key=this.key(problemId,page);let record=null;
  if(this.indexedDB)try{record=await this.transact('readonly',s=>s.get(key));}catch{}
  record??=this.readFallback(problemId,page);
  if(!record||record.version!==ANNOTATION_VERSION||record.problemId!==problemId||Number(record.page)!==Number(page))return {strokes:[]};
  return {strokes:Array.isArray(record.strokes)?clone(record.strokes):[]};
 }
 async save(problemId,page,strokes){
  const record={key:this.key(problemId,page),version:ANNOTATION_VERSION,problemId,page:Number(page),updatedAt:Date.now(),strokes:clone(strokes)};
  if(!this.indexedDB){this.writeFallback(problemId,page,record);return;}
  try{await this.transact('readwrite',s=>s.put(record));this.removeFallback(problemId,page);}catch{this.writeFallback(problemId,page,record);}
 }
 async delete(problemId,page){
  const key=this.key(problemId,page);if(this.indexedDB)try{await this.transact('readwrite',s=>s.delete(key));}catch{}this.removeFallback(problemId,page);
 }
}
