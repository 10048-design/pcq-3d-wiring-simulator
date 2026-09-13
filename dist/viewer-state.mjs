const normalizeRotation=value=>((value%360)+360)%360;
export class ViewerState{
 constructor(saved={}){this.page=Number(saved.page)||5;this.rotation=normalizeRotation(Number(saved.rotation)||0);this.scale=Number(saved.scale)||1;this.fitMode=saved.fitMode!==false;}
 rotate(degrees){this.rotation=normalizeRotation(this.rotation+degrees);return this.rotation;}
 zoom(factor){this.scale=Math.max(.1,Math.min(6,this.scale*factor));this.fitMode=false;return this.scale;}
 fit(viewportWidth,viewportHeight,imageWidth,imageHeight,padding=32){const swapped=this.rotation%180!==0,w=swapped?imageHeight:imageWidth,h=swapped?imageWidth:imageHeight;if(!w||!h||!viewportWidth||!viewportHeight)return this.scale;this.scale=Math.max(.1,Math.min(6,Math.min((viewportWidth-padding)/w,(viewportHeight-padding)/h)));this.fitMode=true;return this.scale;}
 setPage(page){this.page=Number(page);return this.page;}
 snapshot(){return {page:this.page,rotation:this.rotation,scale:this.scale,fitMode:this.fitMode};}
}
export function pageGeometry(imageWidth,imageHeight,state){const rotated=state.rotation%180!==0;return {stageWidth:(rotated?imageHeight:imageWidth)*state.scale,stageHeight:(rotated?imageWidth:imageHeight)*state.scale,imageWidth:imageWidth*state.scale,imageHeight:imageHeight*state.scale,rotation:state.rotation};}
