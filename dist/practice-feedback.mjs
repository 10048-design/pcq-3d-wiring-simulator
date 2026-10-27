import {grade} from './engine.mjs';
import {analyzeNetworkImpact} from './network-impact.mjs';

const hiddenDuringPractice=new Set(['필수 연결 누락']);

function impactError(problem,wire,sourceIds=[]){
 const terminalIds=[wire.from,wire.to];
 const deviceIds=[...new Set(terminalIds.map(id=>problem.terminalMap?.[id]?.deviceId).filter(Boolean))];
 return {
  id:`network-impact:${wire.id}`,
  errorId:`network-impact:${wire.id}`,
  type:'연결망 오류 영향',errorType:'연결망 오류 영향',
  deviceIds,relatedDevice:deviceIds,
  terminalIds,relatedTerminal:terminalIds,
  wireIds:[wire.id],relatedConnection:[wire.id],
  wrong:'이 전선 자체의 단자 관계는 맞지만 현재 연결망에 기존 오결선이 포함되어 있습니다.',
  correct:'먼저 같은 연결망의 잘못된 전선을 제거하거나 올바른 단자로 다시 연결하세요.',
  title:'연결망 오류 영향',reason:'기존 오결선이 같은 전기적 연결망에 영향을 주고 있습니다.',
  expected:'오결선이 없는 연결망',actual:'기존 오결선 영향',correctionGuide:'먼저 원인 오결선을 수정하세요.',
  relatedPathSegment:null,markerPosition:null,sourceWireIds:[...sourceIds].sort()
 };
}

export function assessPractice(problem,connections,latestWireId=null){
 const result=grade(problem,connections);
 const baseErrors=result.errors.filter(error=>!hiddenDuringPractice.has(error.type));
 const reviews=result.reviews??[];
 const impact=analyzeNetworkImpact(problem,connections,result);
 const directSourceIds=[...impact.directWireIds];
 const propagatedErrors=[];
 for(const wire of connections){
  if(!impact.propagatedWireIds.has(wire.id))continue;
  propagatedErrors.push(impactError(problem,wire,directSourceIds));
 }
 const errors=[...baseErrors,...propagatedErrors];
 const latestErrors=latestWireId?baseErrors.filter(error=>(error.wireIds??[]).includes(latestWireId)):[];
 const latestImpacts=latestWireId?propagatedErrors.filter(error=>(error.wireIds??[]).includes(latestWireId)):[];
 const latestReviews=latestWireId?reviews.filter(review=>(review.wireIds??[]).includes(latestWireId)):[];
 const status=latestWireId?(latestErrors.length?'error':latestImpacts.length?'affected':latestReviews.length?'review':'ok'):(baseErrors.length?'error':propagatedErrors.length?'affected':reviews.length?'review':'ok');
 return {
  errors,reviews,baseErrors,propagatedErrors,impact,latestErrors,latestImpacts,latestReviews,status,
  ok:latestWireId?latestErrors.length===0&&latestImpacts.length===0&&latestReviews.length===0:baseErrors.length===0&&propagatedErrors.length===0&&reviews.length===0
 };
}
