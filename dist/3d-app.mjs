import {createHardwareProblem} from './hardware.mjs';
import {Attempt,formatTime} from './engine.mjs';
import {WiringController,connectionNets,STAGES} from './wiring-controller.mjs';
import {Workbench3D} from './workbench-3d.mjs';
import {ViewerState,pageGeometry} from './viewer-state.mjs';
import {SplitState} from './split-state.mjs';
import {groupErrorsForMarkers} from './error-markers.mjs';

const $=id=>document.getElementById(id);
const catalog=await fetch('./catalog.json').then(r=>r.ok?r.json():Promise.reject(Error('문제 목록을 불러오지 못했습니다.')));
const requestedId=new URLSearchParams(location.search).get('problem')??'p01',problemItem=catalog.find(x=>x.id===requestedId)??catalog[0],problemId=problemItem.id;
const p=createHardwareProblem(problemId),attempt=new Attempt(),wiring=new WiringController(p,attempt);
const readStored=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const saveStored=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const viewerStorageKey=`pcq-3d-view-v2:${problemId}`,viewerState=new ViewerState(readStored(viewerStorageKey,{})),splitState=new SplitState(readStored('pcq-3d-split-v1',60));
let lastWire=readStored('pcq-3d-wire-v2',{kind:'연선',area:1.5,color:'노란색'});
let board,selectedWireId=null,viewerResizeTimer=null,statusTimer=null;
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const act=fn=>{try{return fn();}catch(e){notify(e.message);return null;}};
function notify(text){const box=$('status');box.textContent=text;box.classList.add('show');clearTimeout(statusTimer);statusTimer=setTimeout(()=>box.classList.remove('show'),2600);}

document.title=`${problemItem.name} · PCQ 3D 배선 실습`;$('problem-title').textContent=problemItem.name.replace(' 기출문제','')+' · 3D 배선 실습';
const problemSelect=$('problem-select');for(const item of [...catalog].sort((a,b)=>a.name.localeCompare(b.name,'ko'))){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;option.selected=item.id===problemId;problemSelect.append(option);}
problemSelect.onchange=()=>{if(attempt.state==='running'&&!confirm('진행 중인 작업을 끝내고 다른 문제로 이동할까요?')){problemSelect.value=problemId;return;}location.href=`3d.html?problem=${encodeURIComponent(problemSelect.value)}`;};

try{
 board=new Workbench3D($('viewport'),p,{
  terminal:t=>act(()=>pickTerminal(t)),
  device:d=>board?.focus(d.id),
  wire:w=>selectWire(w.id),
  port:port=>act(()=>{wiring.through(port);notify(port.label+' 경로를 통과합니다.');refreshDraft();}),
  routePoint:point=>act(()=>{wiring.waypoint(point);notify('경로 지점을 추가했습니다.');refreshDraft();}),
  error:e=>showError(e),
  hover:item=>{$('hover').textContent=item?(item.displayNumber?item.deviceId+' · '+item.displayNumber:item.label??''):'';}
 });
}catch(e){notify('3D 초기화 실패: '+e.message);$('start').disabled=true;}

const instruction={
 [STAGES.WIRE]:'선을 선택해주세요',
 [STAGES.START_TUBE]:'절연튜브 사용 유무를 선택해주세요',
 [STAGES.START_CRIMP]:'압착단자를 선택해주세요',
 [STAGES.START_TERMINAL]:'시작 지점을 클릭해주세요',
 [STAGES.ROUTE]:'경로를 따라 이동해주세요',
 [STAGES.END_TUBE]:'끝측 절연튜브 사용 유무를 선택해주세요',
 [STAGES.END_CRIMP]:'끝측 압착단자를 선택해주세요'
};
const wireOptions=[
 {label:'갈색 단선',kind:'단선',area:2.5,color:'갈색',css:'brown'},
 {label:'검은색 단선',kind:'단선',area:2.5,color:'검은색',css:'black'},
 {label:'회색 단선',kind:'단선',area:2.5,color:'회색',css:'gray'},
 {label:'녹색 단선',kind:'단선',area:2.5,color:'녹색-노란색',css:'green'},
 {label:'노란 연선',kind:'연선',area:1.5,color:'노란색',css:'yellow flexible'}
];
const crimps=['1.5-3Y','1.5-4Y','2.5-3Y','2.5-4Y','1.5-3Blade','2.5-4Blade'];
function materialButton(label,kind,value,visual){
 const b=document.createElement('button');b.type='button';b.dataset.kind=kind;b.dataset.value=value;b.setAttribute('aria-label',label);b.title=label;b.innerHTML=visual;b.onclick=()=>handleMaterial(b);return b;
}
function buildShelf(){
 const host=$('material-shelf');host.replaceChildren();
 const wires=document.createElement('div');wires.className='shelf-group wire-rack';wires.dataset.group='wire';
 for(const w of wireOptions)wires.append(materialButton(w.label,'wire',w.color,`<span class="wire-piece ${w.css}"><i></i></span>`));
 const tubes=document.createElement('div');tubes.className='shelf-group tube-rack';tubes.dataset.group='tube';
 tubes.append(materialButton('절연튜브 사용','tube','yes','<span class="tube-piece"></span><small>사용</small>'),materialButton('절연튜브 사용 안 함','tube','no','<span class="skip-piece">×</span>'));
 const lugs=document.createElement('div');lugs.className='shelf-group lug-rack';lugs.dataset.group='crimp';
 for(const c of crimps){const visual=c.includes('Blade')?'<span class="blade-piece"><i></i></span>':'<span class="lug-piece"><i></i><i></i></span>';lugs.append(materialButton(c,'crimp',c,`${visual}<small>${c}</small>`));}
 host.append(wires,tubes,lugs);
}
function animatePick(button){button.classList.remove('picked');void button.offsetWidth;button.classList.add('picked');setTimeout(()=>button.classList.remove('picked'),520);}
function handleMaterial(button){
 if(attempt.state!=='running'){notify('먼저 시작 버튼을 눌러주세요.');return;}
 const kind=button.dataset.kind,value=button.dataset.value;let event=null;
 if(kind==='wire'){const option=wireOptions.find(w=>w.color===value);event=act(()=>wiring.chooseWire(option));if(event){lastWire=option;saveStored('pcq-3d-wire-v2',option);}}
 else if(kind==='tube')event=act(()=>wiring.chooseTube(value==='yes'));
 else event=act(()=>wiring.chooseCrimp(value));
 if(!event)return;animatePick(button);
 if(event.type==='connection'){selectedWireId=event.id;notify(event.id+' 체결이 완료되었습니다.');refreshConnections();}
 refreshDraft();
}
function pickTerminal(t){
 const event=wiring.select(t);board?.highlight([t.id]);
 if(event.type==='source')notify(t.id+' 시작측을 체결했습니다.');
 if(event.type==='destination')notify(t.id+' 끝부분 피복을 자동으로 제거했습니다.');
 refreshDraft();
}
function selectWire(id){const w=attempt.connections.find(x=>x.id===id);if(!w)return;selectedWireId=id;board?.focusItems([w.from,w.to],[id]);notify(id+' 전선을 선택했습니다.');refreshControls();}
function refreshDraft(){
 const end=wiring.stage.startsWith('끝측')?wiring.draft?.ends?.to:wiring.draft?.ends?.from;
 board?.setDraft(wiring.draft,end??wiring.material.end);
 board?.showPreparation(wiring.stage,wiring.material,wiring.draft);
 $('instruction').textContent=attempt.state==='ready'?'시작 버튼을 눌러주세요':attempt.state==='finished'?'채점하기를 눌러주세요':attempt.state==='graded'?'빨간 느낌표를 눌러 오류를 확인하세요':instruction[wiring.stage]??'선을 선택해주세요';
 document.querySelectorAll('#material-shelf button').forEach(b=>{
  const active=(b.dataset.kind==='wire'&&b.dataset.value===(wiring.draft?.material?.color??lastWire.color))||(b.dataset.kind==='tube'&&wiring.draft&&String((wiring.stage.startsWith('끝측')?wiring.draft.ends.to.tube:wiring.draft.ends.from.tube)===true)===(b.dataset.value==='yes'))||(b.dataset.kind==='crimp'&&b.dataset.value===end?.crimp);
  b.classList.toggle('active',active);
 });
 refreshControls();
}
function refreshControls(){
 const run=attempt.state==='running',done=['finished','graded'].includes(attempt.state);
 $('start').disabled=attempt.state!=='ready'||!board;$('finish').disabled=!run;$('grade').disabled=!done;$('undo').disabled=!run||(!wiring.history.length&&!attempt.history.length);$('delete').disabled=!run||!selectedWireId;$('cancel').disabled=!run||!wiring.draft;$('clock-label').textContent=done?'최종 작업시간':'경과시간';
 for(const b of document.querySelectorAll('#material-shelf button')){const allowed=b.dataset.kind==='wire'?wiring.stage===STAGES.WIRE:b.dataset.kind==='tube'?[STAGES.START_TUBE,STAGES.END_TUBE].includes(wiring.stage):[STAGES.START_CRIMP,STAGES.END_CRIMP].includes(wiring.stage);b.disabled=!run||!allowed;}
}
function refreshConnections(){board?.setConnections(attempt.connections);if(selectedWireId&&!attempt.connections.some(w=>w.id===selectedWireId))selectedWireId=null;refreshControls();}
function showError(e){
 e.viewed=true;board?.markErrorViewed(e.id);const pop=$('error-popover');pop.hidden=false;const items=(e.errors??[e]).map(x=>`<li>${escapeHtml(x.simpleMessage??x.wrong)}</li>`).join('');pop.innerHTML=`<button aria-label="닫기">×</button><strong>${escapeHtml(e.title??e.type)} · ${e.count??1}개</strong><ol>${items}</ol>`;pop.querySelector('button').onclick=()=>pop.hidden=true;board?.focusItems(e.terminalIds,e.wireIds);
}
function renderResults(r){
 const groups=groupErrorsForMarkers(p,r.errors,attempt.connections);$('results').hidden=false;$('result-summary').textContent=`작업시간 ${formatTime(attempt.elapsed())} · 오류 ${r.count}개 · ${groups.length}곳`;const host=$('errors');host.replaceChildren();
 for(const group of groups){const b=document.createElement('button');b.textContent=group.title+' '+group.count+'개';b.onclick=()=>showError(group);host.append(b);}
 board?.setErrorMarkers(groups);
}

$('start').onclick=()=>{if(attempt.start()){wiring.cancel();notify('작업을 시작합니다.');refreshDraft();}};
$('finish').onclick=()=>$('confirm').showModal();$('keepworking').onclick=()=>$('confirm').close();
$('confirmfinish').onclick=()=>{if(!attempt.finish())return;wiring.cancel();$('confirm').close();saveStored(`pcq-3d-last-completed-v1:${problemId}`,{problemId:p.id,elapsedMs:attempt.elapsedMs,completedAt:new Date().toISOString(),connections:attempt.connections});refreshDraft();refreshConnections();notify('작업판이 잠겼습니다.');};
$('grade').onclick=()=>act(()=>{const r=attempt.score(p);renderResults(r);refreshDraft();notify('오류 위치에 느낌표를 표시했습니다.');});
$('retry').onclick=()=>{if((attempt.connections.length||attempt.state==='running')&&!confirm('현재 작업을 지우고 같은 문제를 다시 풀까요?'))return;attempt.reset();wiring.cancel();selectedWireId=null;$('results').hidden=true;$('errors').replaceChildren();$('error-popover').hidden=true;$('clock').textContent='00:00:00';board?.setErrorMarkers([]);board?.highlight();board?.home();refreshConnections();refreshDraft();};
$('undo').onclick=()=>act(()=>{const e=wiring.undo();if(e?.type==='connection')selectedWireId=null;refreshConnections();refreshDraft();notify('마지막 작업을 되돌렸습니다.');});
$('delete').onclick=()=>act(()=>{if(!selectedWireId)throw Error('삭제할 배선을 먼저 선택해주세요.');const id=selectedWireId;attempt.remove(id);selectedWireId=null;board?.highlight();refreshConnections();notify(id+' 전선을 삭제했습니다.');});
$('cancel').onclick=()=>{wiring.cancel();board?.setDraft(null);refreshDraft();notify('현재 전선 작업을 취소했습니다.');};
$('home').onclick=()=>board?.home();

// PDF viewer
const page=$('page'),stage=$('page-stage'),documentPane=$('document');
function saveViewer(){saveStored(viewerStorageKey,viewerState.snapshot());}
function viewerCenter(){return {x:(documentPane.scrollLeft+documentPane.clientWidth/2)/Math.max(documentPane.scrollWidth,1),y:(documentPane.scrollTop+documentPane.clientHeight/2)/Math.max(documentPane.scrollHeight,1)};}
function renderViewer({preserveCenter=true}={}){if(!page.naturalWidth)return;const center=viewerCenter(),g=pageGeometry(page.naturalWidth,page.naturalHeight,viewerState);stage.style.width=g.stageWidth+'px';stage.style.height=g.stageHeight+'px';page.style.width=g.imageWidth+'px';page.style.height=g.imageHeight+'px';page.style.left='50%';page.style.top='50%';page.style.transform=`translate(-50%,-50%) rotate(${g.rotation}deg)`;$('zoom-label').textContent=Math.round(viewerState.scale*100)+'%';if(preserveCenter)requestAnimationFrame(()=>{documentPane.scrollLeft=center.x*documentPane.scrollWidth-documentPane.clientWidth/2;documentPane.scrollTop=center.y*documentPane.scrollHeight-documentPane.clientHeight/2;});saveViewer();}
function fitViewer(){if(!page.naturalWidth)return;viewerState.fit(documentPane.clientWidth,documentPane.clientHeight,page.naturalWidth,page.naturalHeight);renderViewer({preserveCenter:false});requestAnimationFrame(()=>{documentPane.scrollLeft=(documentPane.scrollWidth-documentPane.clientWidth)/2;documentPane.scrollTop=(documentPane.scrollHeight-documentPane.clientHeight)/2;});}
function rotateViewer(degrees){viewerState.rotate(degrees);viewerState.fitMode?fitViewer():renderViewer();}
page.onload=()=>{viewerState.fitMode?fitViewer():renderViewer({preserveCenter:false});};if(page.complete)page.onload();
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{viewerState.setPage(b.dataset.page);document.querySelectorAll('[data-page]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-selected',String(active));});page.src=`assets/${problemId}/${viewerState.page}.webp`;page.alt=`${problemItem.name} 원본 ${viewerState.page}페이지`;$('original').href=page.src;saveViewer();});
$('zoomin').onclick=()=>{viewerState.zoom(1.25);renderViewer();};$('zoomout').onclick=()=>{viewerState.zoom(.8);renderViewer();};$('fit').onclick=fitViewer;$('rotate-cw').onclick=()=>rotateViewer(90);$('rotate-ccw').onclick=()=>rotateViewer(-90);$('rotate-180').onclick=()=>rotateViewer(180);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewer').requestFullscreen();}catch{notify('전체화면을 사용할 수 없습니다.');}};document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'종료':'전체화면';setTimeout(()=>viewerState.fitMode&&fitViewer(),50);});
const initialTab=document.querySelector(`[data-page="${viewerState.page}"]`)??document.querySelector('[data-page="5"]');initialTab.click();

// Resizable split
const layout=$('split-layout'),splitter=$('splitter'),isStacked=()=>matchMedia('(max-width:840px)').matches;
function applySplit(){document.documentElement.style.setProperty('--split',splitState.value+'%');splitter.setAttribute('aria-valuenow',String(Math.round(splitState.value)));splitter.setAttribute('aria-orientation',isStacked()?'horizontal':'vertical');saveStored('pcq-3d-split-v1',splitState.value);clearTimeout(viewerResizeTimer);viewerResizeTimer=setTimeout(()=>viewerState.fitMode&&fitViewer(),80);}
function moveSplit(e){const r=layout.getBoundingClientRect();splitState.fromPointer(isStacked()?e.clientY-r.top:e.clientX-r.left,isStacked()?r.height:r.width);applySplit();}
splitter.onpointerdown=e=>{splitter.setPointerCapture(e.pointerId);splitter.classList.add('dragging');moveSplit(e);};splitter.onpointermove=e=>{if(splitter.hasPointerCapture(e.pointerId))moveSplit(e);};splitter.onpointerup=e=>{if(splitter.hasPointerCapture(e.pointerId))splitter.releasePointerCapture(e.pointerId);splitter.classList.remove('dragging');};splitter.onkeydown=e=>{const previous=isStacked()?'ArrowUp':'ArrowLeft',next=isStacked()?'ArrowDown':'ArrowRight';if(e.key===previous||e.key===next){e.preventDefault();splitState.nudge(e.key===previous?-2:2);applySplit();}};window.addEventListener('resize',applySplit);applySplit();

document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('confirm').open&&!document.fullscreenElement)$('cancel').click();if(attempt.state!=='running')return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!$('undo').disabled){e.preventDefault();$('undo').click();}if(e.key==='Delete'&&!$('delete').disabled){e.preventDefault();$('delete').click();}});
setInterval(()=>{$('clock').textContent=formatTime(attempt.elapsed());},100);
buildShelf();refreshConnections();refreshDraft();
