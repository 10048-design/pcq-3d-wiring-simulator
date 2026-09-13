const rows=[
 ['p01','2025.12.13.(토) 기출문제','trip-off-11','standard','all'],
 ['p02','2025.12.16.(화) 기출문제','trip-on-mc-11','standard','all'],
 ['p03','2025.12.19.(금) 기출문제','trip-off-10','standard','all'],
 ['p04','2025.12.27.(토) 기출문제','trip-lamp-11','standard','all'],
 ['p05','2025.4.25.(금) 기출문제','trip-off-11','standard','io'],
 ['p06','2025.4.26.(토) 기출문제','trip-lamp-swapped-10','standard','io'],
 ['p07','2025.04.27.(일) 기출문제','trip-off-11','standard','io'],
 ['p08','2025.5.25.(일) 기출문제','trip-on-mc-11','swapped-buttons','all'],
 ['p09','2025.06.18.(수) 기출문제','trip-lamp-11','standard','all'],
 ['p10','2025.07.12.(토) 기출문제','trip-lamp-11','standard','all'],
 ['p11','2026.04.26.(일) 기출문제','trip-on-mc-11','standard','all'],
 ['p12','2026.4.18.(토) 기출문제','trip-on-mc-11','swapped-buttons','all'],
 ['p13','2026.4.19.(일) 기출문제','trip-off-11','standard','io'],
 ['p14','2026.04.25.(토) 기출문제','trip-lamp-11','standard','all'],
 ['p15','2026.5.23.(토) 기출문제','trip-lamp-swapped-10','standard','all'],
 ['p16','2026.5.31.(일) 기출문제','trip-lamp-11','standard','all'],
 ['p17','2026.6.21.(일) 기출문제','trip-lamp-swapped-10','standard','all'],
 ['p18','2026.7.11.(토) 기출문제','trip-off-11','standard','io'],
 ['p19','2026.7.12.(일) 기출문제','trip-off-11','standard','io'],
 ['p20','2026.8.23.(일) 기출문제','trip-on-mc-11','standard','io'],
 ['p21','2025.10.18.(토) 기출문제','trip-off-10','standard','all'],
 ['p22','2025.10.19.(일) 기출문제','trip-on-mc-11','standard','all'],
 ['p23','2025.11.15.(토) 기출문제','trip-lamp-swapped-10','standard','all'],
 ['p24','2025.11.20.(목) 기출문제','trip-lamp-11','standard','all'],
 ['p25','2025.07.13.(일) 기출문제','trip-on-mc-11','standard','all'],
 ['p26','2025.08.31.(일) 기출문제','trip-on-mc-11','standard','all']
];

export const problemProfiles=Object.fromEntries(rows.map(([id,name,circuit,layout,tubeScope])=>[id,{id,name,circuit,layout,tubeScope,assetRoot:`assets/${id}`,answerStatus:'page5-6-diagram-derived'}]));

export function getProblemProfile(id='p01'){
 const profile=problemProfiles[id];
 if(!profile)throw Error(`지원하지 않는 문제입니다: ${id}`);
 return profile;
}

export const circuitProfileMembers={
 'trip-off-11':['p01','p05','p07','p13','p18','p19'],
 'trip-on-mc-11':['p02','p08','p11','p12','p20','p22','p25','p26'],
 'trip-off-10':['p03','p21'],
 'trip-lamp-11':['p04','p09','p10','p14','p16','p24'],
 'trip-lamp-swapped-10':['p06','p15','p17','p23']
};
