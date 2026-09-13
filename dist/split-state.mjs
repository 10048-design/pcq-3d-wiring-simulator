export class SplitState{
 constructor(value=60){this.value=this.clamp(value);}
 clamp(value){return Math.max(30,Math.min(75,Number(value)||60));}
 set(value){this.value=this.clamp(value);return this.value;}
 fromPointer(position,total){return this.set(position/total*100);}
 nudge(delta){return this.set(this.value+delta);}
}
