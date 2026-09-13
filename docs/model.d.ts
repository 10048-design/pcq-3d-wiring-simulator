export type Evidence={problemId:string;page:1|2|3|4|5|6;section?:string;status:'confirmed'|'pending';note?:string};
export interface Problem{id:string;name:string;sourceFile:string;sourcePages:readonly [1,2,3,4,5,6];devices:Device[];terminals:Terminal[];nets:Net[];rules:Rule[];power:'AC'|'DC';pending:Evidence[];equivalentPairs?:[string,string][]}
export interface Device{id:string;box:[number,number,number,number];terminals:string[];position:string;source:Evidence}
export interface Terminal{id:string;deviceId:string;name:string;crimp:CrimpTerminal['id']|null;insulationTube:boolean;maxConnections:number;orientationRule:string|null;doubleCrimpRule:string|null;positionStatus:string;source:Evidence}
export interface Wire{kind:'단선'|'연선';area:1.5|2.5;color:'갈색'|'검은색'|'회색'|'노란색'|'녹색-노란색'}
export interface CrimpTerminal{id:string;area:1.5|2.5;holeMm:3|4;shape:'Y'|'Blade';source:Evidence}
export interface InsulationTube{applied:boolean;source?:Evidence}
export interface Connection extends Wire{id:string;from:string;to:string;ends:{from:ConnectionEnd;to:ConnectionEnd};route:{inDuct:boolean;touchesDevice:boolean;tieSpacingMm:number;tieTrimmed:boolean}}
export interface ConnectionEnd{crimp:string;tube:boolean;orientation:string;doubleMount:string;bareMm:number;insulationClamped:boolean;tight:boolean}
export interface Net{id:string;members:string[];policy:Partial<{kind:Wire['kind']|null;area:Wire['area']|null;color:Wire['color']|null}>;status:'confirmed'|'pending';source:Evidence}
export interface Rule{id:string;scope:string;check:string;parameters:Record<string,unknown>;source:Evidence;enforcement:'automatic'|'self-reported'|'manual'|'pending'}
export interface Error{id:string;type:string;deviceIds:string[];terminalIds:string[];wireIds:string[];wrong:string;correct:string}
export interface Attempt{problemId:string;state:'ready'|'running'|'finished'|'graded';elapsedMs:number;connections:Connection[];result:{errors:Error[];count:number;completeAssessment:boolean}|null}
