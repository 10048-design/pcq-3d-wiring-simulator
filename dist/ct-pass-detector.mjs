const length=v=>Math.hypot(v.x,v.y);
const normal=v=>{const n=length(v);return n?{x:v.x/n,y:v.y/n}:{x:0,y:0};};
const dot=(a,b)=>a.x*b.x+a.y*b.y;
function segmentDistance(point,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
 if(!l2)return Math.hypot(point.x-a.x,point.y-a.y);
 const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/l2));
 return Math.hypot(point.x-(a.x+t*dx),point.y-(a.y+t*dy));
}
function oppositeEnough(center,a,b,threshold){
 const av=normal({x:a.x-center.x,y:a.y-center.y}),bv=normal({x:b.x-center.x,y:b.y-center.y});
 return dot(av,bv)<=threshold;
}

export class CTPassDetector{
 constructor({coreRatio=.52,oppositeDot=-.2}={}){this.coreRatio=coreRatio;this.oppositeDot=oppositeDot;this.reset();}
 reset(){this.previous=null;this.states=new Map();}
 update(point,targets=[]){
  const passed=[],inside=[];
  const activeIds=new Set(targets.map(t=>t.id));
  for(const id of [...this.states.keys()])if(!activeIds.has(id))this.states.delete(id);
  for(const target of targets){
   const center={x:target.x,y:target.y},radius=Math.max(1,target.radius),core=radius*this.coreRatio;
   const distance=Math.hypot(point.x-center.x,point.y-center.y),nowInside=distance<=radius;
   const state=this.states.get(target.id)??{inside:false,entry:null,touchedCore:false,passed:false};
   if(state.passed){if(nowInside)inside.push(target.id);this.states.set(target.id,state);continue;}
   let didPass=false;
   if(this.previous&&!state.inside&&!nowInside&&segmentDistance(center,this.previous,point)<=core&&oppositeEnough(center,this.previous,point,this.oppositeDot))didPass=true;
   if(nowInside){
    inside.push(target.id);
    if(!state.inside)state.entry={x:point.x-center.x,y:point.y-center.y};
    state.inside=true;
    if(distance<=core)state.touchedCore=true;
   }else if(state.inside){
    const exit={x:point.x-center.x,y:point.y-center.y};
    if(state.entry&&state.touchedCore&&dot(normal(state.entry),normal(exit))<=this.oppositeDot)didPass=true;
    state.inside=false;state.entry=null;state.touchedCore=false;
   }
   if(didPass){state.passed=true;passed.push(target.id);}
   this.states.set(target.id,state);
  }
  this.previous={x:point.x,y:point.y};
  return {passed,inside};
 }
}

export function eligibleRoutePortIds(problem,sourceId){
 if(!sourceId)return new Set();
 const netIds=new Set((problem.nets??[]).filter(n=>n.members?.includes(sourceId)).map(n=>n.id));
 return new Set((problem.requiredPassages??[]).filter(r=>netIds.has(r.netId)).map(r=>r.portId));
}
