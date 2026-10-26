import {grade} from './engine.mjs';

const hiddenDuringPractice=new Set(['필수 연결 누락']);

export function assessPractice(problem,connections,latestWireId=null){
 const result=grade(problem,connections);
 const errors=result.errors.filter(error=>!hiddenDuringPractice.has(error.type));
 const latestErrors=latestWireId?errors.filter(error=>(error.wireIds??[]).includes(latestWireId)):[];
 return {errors,latestErrors,ok:latestWireId?latestErrors.length===0:errors.length===0};
}
