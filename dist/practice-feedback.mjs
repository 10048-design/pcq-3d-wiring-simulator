import {grade} from './engine.mjs';

const hiddenDuringPractice=new Set(['필수 연결 누락']);

export function assessPractice(problem,connections,latestWireId=null){
 const result=grade(problem,connections);
 const errors=result.errors.filter(error=>!hiddenDuringPractice.has(error.type));
 const reviews=result.reviews??[];
 const latestErrors=latestWireId?errors.filter(error=>(error.wireIds??[]).includes(latestWireId)):[];
 const latestReviews=latestWireId?reviews.filter(review=>(review.wireIds??[]).includes(latestWireId)):[];
 return {
  errors,reviews,latestErrors,latestReviews,
  status:latestWireId?(latestErrors.length?'error':latestReviews.length?'review':'ok'):(errors.length?'error':reviews.length?'review':'ok'),
  ok:latestWireId?latestErrors.length===0&&latestReviews.length===0:errors.length===0&&reviews.length===0
 };
}
