const clone=value=>value==null?value:structuredClone(value);
let fallbackCounter=0;

export const ANNOTATION_VERSION=1;
export const ANNOTATABLE_PAGES=new Set([5,6]);
export const ANNOTATION_COLORS={
 highlighter:['#ffe45c','#a8e063','#74d7ff','#ff8bb8','#ffb04a'],
 marker:['#1f2937','#d64545','#2563eb','#15803d','#7c3aed'],
};
export const DEFAULT_ANNOTATION_SETTINGS={
 tool:'highlighter',
 highlighter:{color:'#ffe45c',width:24,opacity:.24},
 marker:{color:'#1f2937',width:7,opacity:1},
};

export function createStrokeId({cryptoObj=globalThis.crypto,now=Date.now,random=Math.random}={}){
 if(typeof cryptoObj?.randomUUID==='function')return `stroke-${cryptoObj.randomUUID()}`;
 fallbackCounter=(fallbackCounter+1)%Number.MAX_SAFE_INTEGER;
 const time=Math.max(0,Number(now())||0).toString(36);
 let rand='';
 if(typeof cryptoObj?.getRandomValues==='function'){
  const values=new Uint32Array(2);cryptoObj.getRandomValues(values);rand=Array.from(values,n=>n.toString(36)).join('-');
 }else rand=Math.floor((Number(random())||0)*0xffffffff).toString(36);
 return `stroke-${time}-${fallbackCounter.toString(36)}-${rand}`;
}

function validPoint(p){return p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y));}
export function normalizeStroke(stroke){
 if(!stroke||!Array.isArray(stroke.points))return null;
 const tool=stroke.tool==='marker'?'marker':'highlighter';
 const points=stroke.points.filter(validPoint).map(p=>({x:Number(p.x),y:Number(p.y)}));
 if(!points.length)return null;
 return {
  id:typeof stroke.id==='string'&&stroke.id?stroke.id:createStrokeId(),tool,
  color:typeof stroke.color==='string'&&stroke.color?stroke.color:(tool==='marker'?'#1f2937':'#ffe45c'),
  width:Math.max(1,Math.min(80,Number(stroke.width)||1)),
  opacity:Math.max(.02,Math.min(1,Number(stroke.opacity)||1)),
  points,
 };
}
export function createAnnotationDocument(strokes=[]){return {strokes:strokes.map(normalizeStroke).filter(Boolean),history:[],future:[]};}
export function createStroke(tool,settings,point,{id=createStrokeId()}={}){
 const style=settings?.[tool]??DEFAULT_ANNOTATION_SETTINGS[tool]??DEFAULT_ANNOTATION_SETTINGS.highlighter;
 return normalizeStroke({id,tool,color:style.color,width:style.width,opacity:style.opacity,points:[point]});
}
export function appendPoint(stroke,point,{minDistance=1,maxPoints=20000}={}){
 if(!stroke||!validPoint(point)||stroke.points.length>=maxPoints)return false;
 const last=stroke.points.at(-1),dx=Number(point.x)-last.x,dy=Number(point.y)-last.y;
 if(Math.hypot(dx,dy)<minDistance)return false;
 stroke.points.push({x:Number(point.x),y:Number(point.y)});return true;
}
export function strokePath(points){
 if(!points?.length)return '';
 const fmt=n=>Number(n.toFixed(2));
 if(points.length===1)return `M ${fmt(points[0].x)} ${fmt(points[0].y)} l .01 0`;
 if(points.length===2)return `M ${fmt(points[0].x)} ${fmt(points[0].y)} L ${fmt(points[1].x)} ${fmt(points[1].y)}`;
 let d=`M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
 for(let i=1;i<points.length-1;i++){
  const p=points[i],next=points[i+1],mx=fmt((p.x+next.x)/2),my=fmt((p.y+next.y)/2);
  d+=` Q ${fmt(p.x)} ${fmt(p.y)} ${mx} ${my}`;
 }
 const last=points.at(-1);return d+` L ${fmt(last.x)} ${fmt(last.y)}`;
}
function trimHistory(doc,limit=2000){if(doc.history.length>limit)doc.history.splice(0,doc.history.length-limit);}
export function addAnnotationStroke(doc,stroke){
 const normalized=normalizeStroke(stroke);if(!normalized)return false;
 doc.strokes.push(normalized);doc.history.push({type:'add',stroke:clone(normalized)});trimHistory(doc);doc.future=[];return true;
}
export function removeAnnotationStroke(doc,id){
 const index=doc.strokes.findIndex(s=>s.id===id);if(index<0)return false;
 const [stroke]=doc.strokes.splice(index,1);doc.history.push({type:'remove',stroke:clone(stroke),index});trimHistory(doc);doc.future=[];return true;
}
export function clearAnnotationStrokes(doc){
 if(!doc.strokes.length)return false;
 doc.history.push({type:'clear',strokes:clone(doc.strokes)});trimHistory(doc);doc.strokes=[];doc.future=[];return true;
}
function applyInverse(doc,action){
 if(action.type==='add'){const i=doc.strokes.findIndex(s=>s.id===action.stroke.id);if(i>=0)doc.strokes.splice(i,1);}
 else if(action.type==='remove')doc.strokes.splice(Math.min(action.index,doc.strokes.length),0,clone(action.stroke));
 else if(action.type==='clear')doc.strokes=clone(action.strokes);
}
function applyForward(doc,action){
 if(action.type==='add')doc.strokes.push(clone(action.stroke));
 else if(action.type==='remove'){const i=doc.strokes.findIndex(s=>s.id===action.stroke.id);if(i>=0)doc.strokes.splice(i,1);}
 else if(action.type==='clear')doc.strokes=[];
}
export function undoAnnotation(doc){const action=doc.history.pop();if(!action)return false;applyInverse(doc,action);doc.future.push(action);return true;}
export function redoAnnotation(doc){const action=doc.future.pop();if(!action)return false;applyForward(doc,action);doc.history.push(action);return true;}
export function cloneAnnotationSettings(settings=DEFAULT_ANNOTATION_SETTINGS){
 const next=clone(DEFAULT_ANNOTATION_SETTINGS);
 if(['highlighter','marker','eraser'].includes(settings?.tool))next.tool=settings.tool;
 for(const tool of ['highlighter','marker']){
  const src=settings?.[tool];if(!src)continue;
  if(typeof src.color==='string')next[tool].color=src.color;
  if(Number.isFinite(Number(src.width)))next[tool].width=Math.max(1,Math.min(80,Number(src.width)));
  if(Number.isFinite(Number(src.opacity)))next[tool].opacity=Math.max(.02,Math.min(1,Number(src.opacity)));
 }
 return next;
}
