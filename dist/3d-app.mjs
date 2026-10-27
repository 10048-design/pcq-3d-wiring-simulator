import {createHardwareProblem} from './hardware.mjs';
import {Attempt,formatTime} from './engine.mjs';
import {WiringController,connectionNets,STAGES} from './wiring-controller.mjs';
import {Workbench3D} from './workbench-3d.mjs';
import {ViewerState,pageGeometry} from './viewer-state.mjs';
import {SplitState} from './split-state.mjs';
import {groupErrorsForMarkers} from './error-markers.mjs';
import {ProgressStore,captureProgress,restoreProgress} from './progress-storage.mjs';
import {assessPractice} from './practice-feedback.mjs';
import {analyzeProgress,progressFilter as matchesProgressFilter} from './progress-status.mjs';

const $=id=>document.getElementById(id);
const catalog=await fetch('./catalog.json').then(r=>r.ok?r.json():Promise.reject(Error('문제 목록을 불러오지 못했습니다.')));
const requestedId=new URLSearchParams(location.search).get('problem')??'p01',problemItem=catalog.find(x=>x.id===requestedId)??catalog[0],problemId=problemItem.id;
const p=createHardwareProblem(problemId),attempt=new Attempt(),wiring=new WiringController(p,attempt);
const progressStore=new ProgressStore(),savedProgress=await progressStore.load(problemId);
const readStored=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const saveStored=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const viewerStorageKey=`pcq-3d-view-v2:${problemId}`,viewerState=new ViewerState(readStored(viewerStorageKey,{})),splitState=new SplitState(readStored('pcq-3d-split-v1',60));
let lastWire=readStored('pcq-3d-wire-v2',{kind:'연선',area:1.5,color:'노란색'});
let sessionMode=readStored('pcq-3d-session-mode-v1','exam');
if(!['exam','practice'].includes(sessionMode))sessionMode='exam';
let board,selectedWireId=null,viewerResizeTimer=null,statusTimer=null,progressFilterMode='all';
let progressSaveTimer=null,progressSaveChain=Promise.resolve();
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const act=fn=>{try{return fn();}catch(e){notify(e.message);return null;}};
function notify(text){const box=$('status');box.textContent=text;box.classList.add('show');clearTimeout(statusTimer);statusTimer=setTimeout(()=>box.classList.remove('show'),2600);}
function progressSnapshot(){return captureProgress(p,attempt,wiring,{selectedWireId,lastWire});}
function saveProgressNow(){clearTimeout(progressSaveTimer);progressSaveTimer=null;const snapshot=progressSnapshot();if(snapshot)progressSaveChain=progressSaveChain.then(()=>progressStore.save(snapshot));return progressSaveChain;}
function scheduleProgressSave(){if(!['running','finished'].includes(attempt.state))return;clearTimeout(progressSaveTimer);progressSaveTimer=setTimeout(saveProgressNow,80);}
function clearProgress(){clearTimeout(progressSaveTimer);progressSaveTimer=null;progressSaveChain=progressSaveChain.then(()=>progressStore.delete(problemId));return progressSaveChain;}

document.title=`${problemItem.name} · PCQ 3D 배선 실습`;$('problem-title').textContent=problemItem.name.replace(' 기출문제','')+' · 3D 배선 실습';
const problemSelect=$('problem-select');for(const item of [...catalog].sort((a,b)=>a.name.localeCompare(b.name,'ko'))){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;option.selected=item.id===problemId;problemSelect.append(option);}
problemSelect.onchange=()=>{if(attempt.state==='running'&&!confirm('진행 중인 작업을 끝내고 다른 문제로 이동할까요?')){problemSelect.value=problemId;return;}location.href=`3d.html?problem=${encodeURIComponent(problemSelect.value)}`;};
const modeSelect=$('mode-select');modeSelect.value=sessionMode;modeSelect.onchange=()=>{if(attempt.state!=='ready'){modeSelect.value=sessionMode;return;}sessionMode=modeSelect.value;saveStored('pcq-3d-session-mode-v1',sessionMode);refreshModeUi();notify(sessionMode==='practice'?'연습 모드: 연결할 때마다 즉시 확인합니다.':'시험 모드: 완료 후 채점합니다.');};
function closeProgressPanel(){const panel=$('progress-panel'),toggle=$('progress-toggle');panel.classList.remove('open');panel.setAttribute('aria-hidden','true');toggle.setAttribute('aria-expanded','false');}
function refreshModeUi(){const practice=sessionMode==='practice';document.body.dataset.mode=sessionMode;$('instruction').classList.toggle('practice',practice&&attempt.state==='running');$('progress-toggle').hidden=!practice;if(!practice)closeProgressPanel();else refreshProgressPanel();}

try{
 board=new Workbench3D($('viewport'),p,{
  terminal:t=>act(()=>pickTerminal(t)),
  device:d=>board?.focus(d.id),
  wire:w=>selectWire(w.id),
  blank:()=>deselectWire(),
  port:port=>act(()=>{if(wiring.through(port)){notify('✓ '+port.label+' 경로를 통과합니다.');refreshDraft();}}),
  autoPort:port=>act(()=>{if(wiring.through(port)){notify('✓ '+port.label+' 자동 통과를 감지했습니다.');refreshDraft();}}),
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
 if(event.type==='connection'){selectedWireId=event.id;if(sessionMode==='exam')notify(event.id+' 체결이 완료되었습니다.');refreshConnections(event.id);}
 refreshDraft();
}
function pickTerminal(t){
 const event=wiring.select(t);board?.highlight([t.id]);
 if(event.type==='source')notify(t.id+' 시작측을 체결했습니다.');
 if(event.type==='destination')notify(t.id+' 끝부분 피복을 자동으로 제거했습니다.');
 refreshDraft();
}
function deselectWire({notifyUser=false}={}){if(!selectedWireId)return false;selectedWireId=null;board?.highlight();refreshControls();scheduleProgressSave();if(notifyUser)notify('배선 선택을 해제했습니다.');return true;}
function selectWire(id){const w=attempt.connections.find(x=>x.id===id);if(!w)return;if(selectedWireId===id){deselectWire({notifyUser:true});return;}selectedWireId=id;board?.focusItems([w.from,w.to],[id]);notify(id+' 전선을 선택했습니다.');refreshControls();scheduleProgressSave();}
function refreshDraft(){
 const end=wiring.stage.startsWith('끝측')?wiring.draft?.ends?.to:wiring.draft?.ends?.from;
 board?.setDraft(wiring.draft,end??wiring.material.end);
 board?.showPreparation(wiring.stage,wiring.material,wiring.draft);
 const runningText=instruction[wiring.stage]??'선을 선택해주세요';$('instruction').textContent=attempt.state==='ready'?(sessionMode==='practice'?'연습 모드 · 시작 버튼을 눌러주세요':'시험 모드 · 시작 버튼을 눌러주세요'):attempt.state==='finished'?'채점하기를 눌러주세요':attempt.state==='graded'?'빨간 느낌표를 눌러 오류를 확인하세요':sessionMode==='practice'?`연습 모드 · ${runningText}`:runningText;refreshModeUi();
 document.querySelectorAll('#material-shelf button').forEach(b=>{
  const active=(b.dataset.kind==='wire'&&b.dataset.value===(wiring.draft?.material?.color??lastWire.color))||(b.dataset.kind==='tube'&&wiring.draft&&String((wiring.stage.startsWith('끝측')?wiring.draft.ends.to.tube:wiring.draft.ends.from.tube)===true)===(b.dataset.value==='yes'))||(b.dataset.kind==='crimp'&&b.dataset.value===end?.crimp);
  b.classList.toggle('active',active);
 });
 refreshControls();
 scheduleProgressSave();
}
function refreshControls(){
 const run=attempt.state==='running',done=['finished','graded'].includes(attempt.state);
 $('start').disabled=attempt.state!=='ready'||!board;$('finish').disabled=!run;$('grade').disabled=!done;$('undo').disabled=!run||(!wiring.history.length&&!attempt.history.length);$('redo').disabled=!run||(!wiring.future.length&&!attempt.future.length);$('delete').disabled=!run||!selectedWireId;$('cancel').disabled=!run||!wiring.draft;modeSelect.disabled=attempt.state!=='ready';$('clock-label').textContent=done?'최종 작업시간':'경과시간';
 for(const b of document.querySelectorAll('#material-shelf button')){const allowed=b.dataset.kind==='wire'?wiring.stage===STAGES.WIRE:b.dataset.kind==='tube'?[STAGES.START_TUBE,STAGES.END_TUBE].includes(wiring.stage):[STAGES.START_CRIMP,STAGES.END_CRIMP].includes(wiring.stage);b.disabled=!run||!allowed;}
}
const progressStateUi={
 complete:{icon:'✓',label:'완료'},progress:{icon:'◐',label:'진행 중'},'not-started':{icon:'○',label:'미시작'},error:{icon:'!',label:'오류'},review:{icon:'?',label:'확인 필요'},pending:{icon:'?',label:'확인 필요'}
};
function compactMembers(members){const shown=members.slice(0,3).join(' · ');return members.length>3?`${shown} 외 ${members.length-3}개`:shown;}
function refreshProgressPanel(){
 const toggle=$('progress-toggle');if(sessionMode!=='practice'){toggle.hidden=true;return;}toggle.hidden=false;
 const summary=analyzeProgress(p,attempt.connections),{counts}=summary;toggle.querySelector('#progress-toggle-count').textContent=`${counts.completed}/${counts.total}`;
 $('progress-score').textContent=`${counts.completed} / ${counts.total}`;$('progress-bar').style.width=`${Math.round(summary.ratio*100)}%`;
 $('progress-stats').innerHTML=`<span>완료 <b>${counts.completed}</b></span><span>진행 중 <b>${counts.progress}</b></span><span>오류 <b>${counts.error}</b></span><span>미시작 <b>${counts.notStarted}</b></span>${counts.pending?`<span>확인 필요 <b>${counts.pending}</b></span>`:''}${counts.warnings?`<span>시공 경고 <b>${counts.warnings}</b></span>`:''}`;
 const host=$('progress-groups');host.replaceChildren();let visible=0;
 for(const group of summary.groups){
  const items=group.items.filter(n=>matchesProgressFilter(n,progressFilterMode));if(!items.length)continue;visible+=items.length;
  const details=document.createElement('details');details.className='progress-group';details.open=true;
  const head=document.createElement('summary');const confirmed=items.filter(n=>n.status==='confirmed'),done=confirmed.filter(n=>n.state==='complete').length;head.innerHTML=`${escapeHtml(group.name)} <span>${done}/${confirmed.length}${items.some(n=>n.status==='pending')?' · 확인 필요':''}</span>`;details.append(head);
  for(const net of items){const ui=progressStateUi[net.state]??progressStateUi['not-started'],button=document.createElement('button');button.type='button';button.className=`progress-net ${net.state}${net.warningCount?' has-warning':''}`;button.title='클릭하면 관련 단자와 배선을 3D 작업판에서 표시합니다.';
   const extra=net.warningCount?` · 시공 경고 ${net.warningCount}`:net.reviewCount?` · 확인 ${net.reviewCount}`:'';
   button.innerHTML=`<span class="state" aria-hidden="true">${ui.icon}</span><span class="net-copy"><strong>${escapeHtml(net.id)}</strong><small>${escapeHtml(compactMembers(net.members))}</small></span><span class="net-meta">${escapeHtml(ui.label+extra)}</span>`;
   button.onclick=()=>{board?.focusItems(net.members,net.wireIds);if(net.state==='error')notify(`${net.id}: 오류가 있는 NET입니다.`);else if(net.state==='complete')notify(`${net.id}: 연결 완료`);else notify(`${net.id}: ${ui.label}`);};details.append(button);
  }
  host.append(details);
 }
 if(!visible){const empty=document.createElement('div');empty.className='progress-empty';empty.textContent=progressFilterMode==='all'?'표시할 NET이 없습니다.':'현재 필터에 해당하는 NET이 없습니다.';host.append(empty);}
}
function openProgressPanel(){if(sessionMode!=='practice')return;refreshProgressPanel();const panel=$('progress-panel');panel.setAttribute('aria-hidden','false');requestAnimationFrame(()=>panel.classList.add('open'));$('progress-toggle').setAttribute('aria-expanded','true');}
function refreshPracticeFeedback(latestWireId=null){
 if(sessionMode!=='practice'||attempt.state!=='running'){if(attempt.state==='running')board?.setErrorMarkers([]);return;}
 const assessment=assessPractice(p,attempt.connections,latestWireId),groups=groupErrorsForMarkers(p,assessment.errors,attempt.connections);
 board?.setErrorMarkers(groups);
 if(latestWireId){
  if(assessment.latestErrors.length)notify(`${latestWireId} 연결에 오류가 있습니다. 느낌표를 확인하세요.`);
  else if(assessment.latestImpacts.length)notify(`${latestWireId} 연결 자체는 맞지만 현재 연결망에 기존 오결선이 있습니다. 느낌표를 확인하세요.`);
  else if(assessment.latestReviews.length)notify(`${latestWireId} 연결은 확인 필요 항목입니다. 최종 채점의 확인 필요 목록을 참고하세요.`);
  else notify(`${latestWireId} 연결이 올바릅니다.`);
 }
}
function refreshConnections(latestWireId=null){board?.setConnections(attempt.connections);if(selectedWireId&&!attempt.connections.some(w=>w.id===selectedWireId))selectedWireId=null;refreshPracticeFeedback(latestWireId);refreshProgressPanel();refreshControls();scheduleProgressSave();}
function showError(e){
 e.viewed=true;board?.markErrorViewed(e.id);const pop=$('error-popover');pop.hidden=false;const items=(e.errors??[e]).map(x=>`<li>${escapeHtml(x.simpleMessage??x.wrong)}</li>`).join('');pop.innerHTML=`<button aria-label="닫기">×</button><strong>${escapeHtml(e.title??e.type)} · ${e.count??1}개</strong><ol>${items}</ol>`;pop.querySelector('button').onclick=()=>pop.hidden=true;board?.focusItems(e.terminalIds,e.wireIds);
}
function renderResults(r){
 const groups=groupErrorsForMarkers(p,r.errors,attempt.connections);$('results').hidden=false;$('result-summary').textContent=`작업시간 ${formatTime(attempt.elapsed())} · 오류 ${r.count}개 · ${groups.length}곳`;const host=$('errors');host.replaceChildren();
 for(const group of groups){const b=document.createElement('button');b.textContent=group.title+' '+group.count+'개';b.onclick=()=>showError(group);host.append(b);}
 board?.setErrorMarkers(groups);
}

$('start').onclick=()=>{if(attempt.start()){wiring.cancel();notify(sessionMode==='practice'?'연습 모드를 시작합니다. 연결마다 바로 확인합니다.':'시험 모드를 시작합니다.');refreshConnections();refreshDraft();}};
$('finish').onclick=()=>$('confirm').showModal();$('keepworking').onclick=()=>$('confirm').close();
$('confirmfinish').onclick=()=>{if(!attempt.finish())return;wiring.cancel();$('confirm').close();saveStored(`pcq-3d-last-completed-v1:${problemId}`,{problemId:p.id,elapsedMs:attempt.elapsedMs,completedAt:new Date().toISOString(),connections:attempt.connections});refreshDraft();refreshConnections();saveProgressNow();notify('작업판이 잠겼습니다.');};
$('grade').onclick=()=>act(()=>{const r=attempt.score(p);clearProgress();renderResults(r);refreshDraft();notify('오류 위치에 느낌표를 표시했습니다.');});
$('retry').onclick=()=>{if((attempt.connections.length||attempt.state==='running')&&!confirm('현재 작업을 지우고 같은 문제를 다시 풀까요?'))return;clearProgress();attempt.reset();wiring.cancel();selectedWireId=null;$('results').hidden=true;$('errors').replaceChildren();$('error-popover').hidden=true;$('clock').textContent='00:00:00';board?.setErrorMarkers([]);board?.highlight();board?.home();refreshConnections();refreshDraft();};
$('undo').onclick=()=>act(()=>{const e=wiring.undo();if(e?.type==='none')return;if(e.type==='connection')deselectWire();refreshConnections();refreshDraft();notify('마지막 작업을 되돌렸습니다.');});
$('redo').onclick=()=>act(()=>{const e=wiring.redo();if(e?.type==='none')return;if(e.type==='connection')deselectWire();refreshConnections();refreshDraft();notify('되돌린 작업을 다시 실행했습니다.');});
$('delete').onclick=()=>act(()=>{if(!selectedWireId)throw Error('삭제할 배선을 먼저 선택해주세요.');const id=selectedWireId;attempt.remove(id);selectedWireId=null;board?.highlight();refreshConnections();notify(id+' 전선을 삭제했습니다.');});
$('cancel').onclick=()=>{wiring.cancel();board?.setDraft(null);refreshDraft();notify('현재 전선 작업을 취소했습니다.');};
$('home').onclick=()=>board?.home();
$('progress-toggle').onclick=()=>$('progress-panel').classList.contains('open')?closeProgressPanel():openProgressPanel();
$('progress-close').onclick=closeProgressPanel;
document.querySelectorAll('[data-progress-filter]').forEach(button=>button.onclick=()=>{progressFilterMode=button.dataset.progressFilter;document.querySelectorAll('[data-progress-filter]').forEach(x=>x.classList.toggle('active',x===button));refreshProgressPanel();});

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

document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!$('confirm').open&&!document.fullscreenElement){if($('progress-panel').classList.contains('open')){e.preventDefault();closeProgressPanel();}else if(wiring.draft&&!$('cancel').disabled){e.preventDefault();$('cancel').click();}else if(selectedWireId){e.preventDefault();deselectWire({notifyUser:true});}}
 if(attempt.state!=='running')return;
 const command=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
 if(command&&((key==='y')||(key==='z'&&e.shiftKey))&&!$('redo').disabled){e.preventDefault();$('redo').click();return;}
 if(command&&key==='z'&&!e.shiftKey&&!$('undo').disabled){e.preventDefault();$('undo').click();return;}
 if(e.key==='Delete'&&!$('delete').disabled){e.preventDefault();$('delete').click();}
});
setInterval(()=>{$('clock').textContent=formatTime(attempt.elapsed());},100);
setInterval(()=>{if(attempt.state==='running')saveProgressNow();},5000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveProgressNow();});
window.addEventListener('pagehide',()=>saveProgressNow());
refreshModeUi();buildShelf();refreshConnections();refreshDraft();

const resumeDialog=$('resume-dialog');resumeDialog.oncancel=e=>e.preventDefault();
$('resume-saved').onclick=()=>{try{const restored=restoreProgress(savedProgress,p,attempt,wiring);selectedWireId=restored.selectedWireId;if(restored.lastWire)lastWire=restored.lastWire;resumeDialog.close();$('clock').textContent=formatTime(attempt.elapsed());refreshConnections();refreshDraft();notify('저장된 실습을 이어서 시작합니다.');}catch(e){clearProgress();resumeDialog.close();notify('저장된 진행상황을 불러올 수 없어 처음부터 시작합니다.');}};
$('restart-saved').onclick=async()=>{await clearProgress();attempt.reset();wiring.cancel();selectedWireId=null;resumeDialog.close();$('clock').textContent='00:00:00';refreshConnections();refreshDraft();notify('새 실습을 시작할 준비가 되었습니다.');};
if(savedProgress)resumeDialog.showModal();
