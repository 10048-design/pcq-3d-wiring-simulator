export type Vec3 = [number, number, number];
export interface HardwareTerminal {
 id: string; terminalId: string; deviceId: string; name: string;
 displayNumber: string; physicalNumber: string | null; function: string;
 localPositionMm: Vec3; positionMm: Vec3; actualPositionMm: Vec3 | null;
 normal: Vec3; connectable: boolean; numberStatus: string;
 positionConfidence: 'drawing-derived-unmeasured' | 'measured'; sourceKey: string;
 allowedWires: Array<{kind?:string|null;area?:number|null;color?:string|null}>;
 crimp: string | null; requiredCrimp: string | null;
 insulationTube: boolean; insulationTubeRequired: boolean;
 maxConnections: number; orientationRule: string; doubleCrimpRule: string;
 orientationYOnly: boolean; orientationSource: string;
 multiMountRule: {maximum:number;yPair:string;source:string};
}
export interface ConnectionEnd {
 crimp:string;tube:boolean;orientation:'정상'|'뒤집힘';
 doubleMount:'등을 맞댐'|'같은 방향 겹침';bareMm:number;
 insulationClamped:boolean;tight:boolean;
}
export interface HardwareConnection {
 id:string;from:string;to:string;kind:'연선'|'단선';area:number;color:string;
 ends:{from:ConnectionEnd;to:ConnectionEnd};via:string[];
 route:{assessment:'미검사'};
}
export interface RoutePort {
 id:string;deviceId:string;label:string;diameterMm:number;
 connectable:false;positionMm:Vec3;axis:Vec3;lengthMm:number;
 positionConfidence:string;sourceKey:string;
}
