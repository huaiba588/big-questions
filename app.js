(() => {
  const DATA = window.UNIFIED_DATA;
  const KEY = 'unified-344857-v1';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const TERM_DAILY = 20;
  const GROUP = 7;
  const QUOTAS = {344:{简答:7,论述:3,综合:2}, 857:{简答:7,论述:3,综合:2}};
  const SUBJECT_NAMES = {344:'344 风景园林基础', 857:'857 园林生态学'};
  const todayKey = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const addDays = n => { const d=new Date(); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const escapeHtml = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const defaultState = () => ({progress:{},plans:{},custom:{},favorites:[],settings:{dark:false}});
  function load() {
    try {
      const raw=localStorage.getItem(KEY); if(!raw) return defaultState();
      const p=JSON.parse(raw), b=defaultState();
      return {...b,...p,progress:p.progress||{},plans:p.plans||{},custom:p.custom||{},favorites:p.favorites||[],settings:{...b.settings,...(p.settings||{})}};
    } catch(e){ return defaultState(); }
  }
  let state=load();
  let subject='857', module='term';
  let currentCat='all', currentFilter='all';
  let currentItem=null, currentKind='new';
  let modalId=null;
  let answerLongTimer=null, answerLongFired=false, editId=null;
  let toastTimer=null;

  const save=()=>{ try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){toast('保存失败，存储空间可能已满');} };
  const subjectData = s => DATA[s];
  const items = (s,m) => m==='term' ? DATA[s].terms : DATA[s].bigs;
  const byId = (s,m,id) => items(s,m).find(x=>x.id===id);
  const keyOf = (s,m) => `${s}:${m}`;
  const planOf = (s,m) => state.plans[keyOf(s,m)];
  const progressOf = id => state.progress[id];
  const isDue = p => p && p.due && p.due <= todayKey();
  const isFail = r => r==='陌生'||r==='模糊';
  const categoryRank = x => x.category==='重点'?0:1;
  const idNum = x => Number(x.id.split('-').pop()) || 0;

  function toast(msg){ const el=$('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),1900); }
  function showScreen(name){
    $$('.screen').forEach(s=>s.classList.toggle('active',s.id===`screen-${name}`));
    $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.goto===name));
    $('#backBtn').classList.toggle('hidden',name==='home');
    if(name!=='study') $('#summary').classList.add('hidden');
    window.scrollTo({top:0,behavior:'instant'});
  }
  function applyTheme(){ document.body.classList.toggle('dark',!!state.settings.dark); $('#themeBtn').textContent=state.settings.dark?'☀':'☾'; $('#themeState').textContent=state.settings.dark?'开':'关'; }

  function renderHome(){
    subject='857'; module='term';
    $('#brandText').textContent='344/857';
    showScreen('home');
  }

  function openSubject(s){
    subject=s; module='term';
    $('#brandText').textContent=s;
    $('#subjKicker').textContent=`${s} · 四川农业大学 086200`;
    $('#subjTitle').textContent=SUBJECT_NAMES[s];
    const t=DATA[s].terms, b=DATA[s].bigs;
    $('#termMeta').textContent=`${t.length} 个 · 每天 20 个 · 7 个一组`;
    const q=QUOTAS[s];
    $('#bigMeta').textContent=`简答 ${q.简答} · 论述 ${q.论述}${q.综合?` · 综合 ${q.综合}`:''} · 共 ${b.length} 题`;
    $('#backBtn').classList.remove('hidden');
    showScreen('subject');
  }

  function openModule(m){
    module=m;
    $('#brandText').textContent=`${subject} · ${m==='term'?'名解':'大题'}`;
    renderDash();
    showScreen('dash');
  }

  function planProgress(plan){
    if(!plan) return {done:0,total:0,newLeft:0,due:0};
    const done=plan.passed.length+plan.reviewIndex;
    return {done,total:plan.newIds.length+plan.reviewIds.length,newLeft:Math.max(0,plan.newIds.length-plan.passed.length),due:plan.reviewIds.length-plan.reviewIndex};
  }
  function dueTotal(s,m){
    return items(s,m).filter(x=>isDue(progressOf(x.id))).length;
  }
  function renderDash(){
    const plan=planOf(subject,module);
    const pp=planProgress(plan);
    const due=dueTotal(subject,module);
    const learned=items(subject,module).filter(x=>progressOf(x.id)).length;
    const mastered=items(subject,module).filter(x=>progressOf(x.id)?.status==='mastered').length;
    $('#dashKicker').textContent=`${subject} · ${module==='term'?'名词解释':'大题'}`;
    $('#dashTitle').textContent=module==='term'?'今日名解':'今日大题';
    $('#dashDone').textContent=pp.done;
    $('#dashTotal').textContent=pp.total;
    $('#dashRing').style.setProperty('--p', `${pp.total?Math.round(pp.done/pp.total*100):0}%`);
    $('#dashDue').textContent=due;
    $('#dashNew').textContent=pp.newLeft;
    $('#dashPassed').textContent=plan?plan.passed.length:0;
    $('#dashTotalCount').textContent=items(subject,module).length;
    $('#dashMastered').textContent=mastered;
    $('#dashDueCard').textContent=due;
    $('#dashSummary').textContent=`已学 ${learned} / ${items(subject,module).length}`;
    if(module==='term') $('#dashNote').textContent='每天 20 个新词；7 个一组；先清复习，再学新词';
    else {
      const q=QUOTAS[subject];
      $('#dashNote').textContent=`先清复习，再学新题：简答 ${q.简答} · 论述 ${q.论述}${q.综合?` · 综合 ${q.综合}`:''}`;
    }
    if(plan?.summary) $('#startBtn').textContent='继续本组总结 →';
    else if(pp.total && pp.done<pp.total) $('#startBtn').textContent='继续今日学习 →';
    else $('#startBtn').textContent='开始今日学习 →';
  }

  function makeTermPlan(s){
    const pool=DATA[s].terms;
    const review=pool.filter(x=>isDue(progressOf(x.id))).sort((a,b)=>(progressOf(a.id)?.due||'').localeCompare(progressOf(b.id)?.due||'')||idNum(a)-idNum(b));
    const fresh=pool.filter(x=>!progressOf(x.id)).sort((a,b)=>categoryRank(a)-categoryRank(b)||idNum(a)-idNum(b)).slice(0,TERM_DAILY);
    return {subject:s,module:'term',date:todayKey(),reviewIds:review.map(x=>x.id),reviewIndex:0,newIds:fresh.map(x=>x.id),newIndex:0,groupStart:0,passed:[],retry:[],retryActive:false,summary:null};
  }
  function makeBigPlan(s){
    const pool=DATA[s].bigs;
    const review=pool.filter(x=>isDue(progressOf(x.id))).sort((a,b)=>(progressOf(a.id)?.due||'').localeCompare(progressOf(b.id)?.due||'')||idNum(a)-idNum(b));
    const q=QUOTAS[s];
    const fresh=pool.filter(x=>!progressOf(x.id));
    const picked=[];
    Object.entries(q).forEach(([type,n])=>{
      if(!n) return;
      const typePool=fresh.filter(x=>x.type===type && !picked.includes(x.id));
      const key=typePool.filter(x=>x.category==='重点').sort((a,b)=>idNum(a)-idNum(b));
      const know=typePool.filter(x=>x.category==='了解').sort((a,b)=>idNum(a)-idNum(b));
      picked.push(...key.slice(0,n).map(x=>x.id));
      if(picked.filter(id=>byId(s,'big',id)?.type===type).length<n){
        const need=n-picked.filter(id=>byId(s,'big',id)?.type===type).length;
        picked.push(...know.slice(0,need).map(x=>x.id));
      }
    });
    return {subject:s,module:'big',date:todayKey(),reviewIds:review.map(x=>x.id),reviewIndex:0,newIds:picked,newIndex:0,passed:[],retry:[],retryActive:false,summary:null};
  }
  function ensurePlan(){
    const existing=planOf(subject,module);
    if(existing && existing.date===todayKey()) return existing;
    const p=module==='term'?makeTermPlan(subject):makeBigPlan(subject);
    state.plans[keyOf(subject,module)]=p; save(); return p;
  }

  function getCurrent(){
    const plan=planOf(subject,module);
    if(!plan || plan.summary) return null;
    if(plan.reviewIndex<plan.reviewIds.length) return {item:byId(subject,module,plan.reviewIds[plan.reviewIndex]),kind:'review'};
    if(module==='term'){
      if(plan.retryActive && plan.retry.length) return {item:byId(subject,module,plan.retry[0]),kind:'retry'};
      if(plan.newIndex<plan.newIds.length) return {item:byId(subject,module,plan.newIds[plan.newIndex]),kind:'new'};
      if(plan.retry.length) return {item:byId(subject,module,plan.retry[0]),kind:'retry'};
    } else {
      if(plan.newIndex<plan.newIds.length) return {item:byId(subject,module,plan.newIds[plan.newIndex]),kind:'new'};
      if(plan.retry.length) return {item:byId(subject,module,plan.retry[0]),kind:'retry'};
    }
    return null;
  }

  function answerHtml(item){
    const custom=state.custom[item.id];
    if(custom) return `<div>${escapeHtml(custom)}</div>`;
    if(module==='term') return `<div>${escapeHtml(item.answer)}</div>`;
    return (item.full||[]).map(s=>`<div class="ans-point"><b>${escapeHtml(s.h)}：</b>${escapeHtml(s.t)}</div>`).join('') + (item.pit?`<div class="ans-pit">易漏：${escapeHtml(item.pit)}</div>`:'');
  }
  function plainAnswer(item){
    if(state.custom[item.id]) return state.custom[item.id];
    if(module==='term') return item.answer;
    return (item.full||[]).map(s=>`${s.h}：${s.t}`).join('\n') + (item.pit?`\n易漏：${item.pit}`:'');
  }

  function startStudy(){
    const plan=ensurePlan();
    showScreen('study');
    if(plan.summary){ renderSummary(); return; }
    if(!getCurrent()){ finish(); return; }
    renderStudy();
  }

  function renderStudy(){
    const plan=planOf(subject,module);
    if(plan?.summary){ renderSummary(); return; }
    const cur=getCurrent();
    if(!cur){ finish(); return; }
    currentItem=cur.item; currentKind=cur.kind;
    const pp=planProgress(plan);
    $('#studyProgressText').textContent=`${pp.done} / ${pp.total}`;
    $('#studyProgressBar').style.width=`${pp.total?Math.round(pp.done/pp.total*100):0}%`;
    $('#studyMode').textContent=currentKind==='review'?'复习':currentKind==='retry'?'补练 · 必须通过':(module==='term'?'新词':'新题');
    $('#studyChapter').textContent=module==='term'?(currentItem.chapter||'名解'):`${currentItem.type} · ${currentItem.score}分`;
    $('#studyTerm').textContent=module==='term'?currentItem.term:`${currentItem.title}`;
    $('#studyTerm').classList.toggle('term-fail', !!(progressOf(currentItem.id)&&isFail(progressOf(currentItem.id).lastRating)));
    $('#studyAnswer').innerHTML=answerHtml(currentItem);
    $('#answerBox').classList.add('hidden');
    $('#rating').classList.add('hidden');
    $('#revealBtn').classList.remove('hidden');
    $('#draft').classList.remove('hidden');
    $('#draft').value='';
    $('#starBtn').textContent=state.favorites.includes(currentItem.id)?'★':'☆';
  }

  function reveal(){ if(!getCurrent()) return; $('#answerBox').classList.remove('hidden'); $('#rating').classList.remove('hidden'); $('#revealBtn').classList.add('hidden'); $('#draft').classList.add('hidden'); }
  function hide(){ $('#answerBox').classList.add('hidden'); $('#rating').classList.add('hidden'); $('#revealBtn').classList.remove('hidden'); $('#draft').classList.remove('hidden'); }

  function rate(r){
    const plan=planOf(subject,module); const cur=getCurrent(); if(!plan||!cur) return;
    const item=cur.item, pass=!isFail(r);
    const p=progressOf(item.id)||{reps:0,lapses:0};
    p.reps++; p.lastRating=r; p.last=todayKey();
    if(!pass){ p.interval=1; p.due=addDays(1); p.status='learning'; p.lapses=(p.lapses||0)+1; }
    else if(r==='记得'){ p.interval=2; p.due=addDays(2); p.status='review'; }
    else { p.interval=4; p.due=addDays(4); p.status='mastered'; }
    state.progress[item.id]=p;

    if(cur.kind==='review'){
      plan.reviewIndex++;
      if(!pass){ plan.retry.push(item.id); plan.retryActive=true; }
    } else if(cur.kind==='retry'){
      const at=plan.retry.indexOf(item.id);
      if(at>=0) plan.retry.splice(at,1);
      if(pass){ if(plan.newIds.includes(item.id)&&!plan.passed.includes(item.id)) plan.passed.push(item.id); }
      else plan.retry.push(item.id);
      if(!plan.retry.length) plan.retryActive=false;
    } else {
      if(pass){ if(!plan.passed.includes(item.id)) plan.passed.push(item.id); }
      else plan.retry.push(item.id);
      plan.newIndex++;
      if(module==='term' && (plan.newIndex-plan.groupStart>=GROUP || plan.newIndex===plan.newIds.length)){
        const ids=plan.newIds.slice(plan.groupStart,Math.min(plan.groupStart+GROUP,plan.newIds.length));
        plan.summary={ids}; plan.groupStart=plan.newIndex;
      }
    }
    save();
    if(plan.summary) renderSummary(); else renderStudy();
  }

  function renderSummary(){
    const plan=planOf(subject,module); if(!plan?.summary){ renderStudy(); return; }
    showScreen('study'); $('#studyArea').classList.add('hidden'); $('#studyEmpty').classList.add('hidden');
    $('#summary').classList.remove('hidden');
    $('#summaryList').innerHTML=plan.summary.ids.map(id=>{
      const t=byId(subject,'term',id), p=progressOf(id), fail=p&&isFail(p.lastRating);
      return `<div class="summary-item"><div class="summary-term ${fail?'term-fail':''}">${escapeHtml(t.term)}${fail?'<span class="fail-tag">需重练</span>':''}</div><button class="summary-answer covered" data-summary-id="${id}">${escapeHtml(t.answer)}</button></div>`;
    }).join('');
    $('#summaryCount').textContent=`${plan.summary.ids.length} 个`;
    $('#summaryContinue').textContent=plan.retry.length?'继续补练':'继续下一组';
  }

  function finish(){
    const plan=planOf(subject,module);
    $('#summary').classList.add('hidden'); $('#studyArea').classList.add('hidden'); $('#studyEmpty').classList.remove('hidden');
    $('#studyProgressBar').style.width='100%';
    const pp=planProgress(plan);
    $('#studyProgressText').textContent=`${pp.done} / ${pp.total}`;
    $('#emptyText').textContent = pp.newLeft||pp.due ? `还有 ${pp.newLeft} 个新内容、${pp.due} 个复习，回首页继续。` : '今天的内容完成了。';
  }

  function renderLibrary(){
    const list=items(subject,module).filter(x=>currentCat==='all'||x.category===currentCat);
    const q=($('#searchInput').value||'').trim().toLowerCase();
    const filtered=q?list.filter(x=>((x.term||x.title||'')+(x.answer||'')+(x.full?JSON.stringify(x.full):'')).toLowerCase().includes(q)):list;
    $('#libKicker').textContent=`${subject} · ${module==='term'?'名词解释':'大题'}`;
    $('#libTitle').textContent=module==='term'?'名词解释题库':'大题题库';
    $('#libraryCount').textContent=`${filtered.length} 条`;
    $('#libraryList').innerHTML=filtered.map(x=>{
      const p=progressOf(x.id), dot=p?.status==='mastered'?'mastered':p?'learning':'';
      return `<button class="term-item" data-lib-id="${x.id}"><span class="status-dot ${dot}"></span><span class="term-left"><span class="term-name">${escapeHtml(x.term||x.title)}</span><span class="term-sub">${escapeHtml(x.category)}${x.type?` · ${x.type} ${x.score}分`:''}</span></span><span style="color:var(--muted)">›</span></button>`;
    }).join('') || '<div class="empty-list">没有匹配内容。</div>';
  }

  function openModal(id){
    const item=byId(subject,module,id); if(!item) return;
    $('#modalChapter').textContent=item.category;
    $('#modalTerm').textContent=item.term||item.title;
    $('#modalAnswer').innerHTML=answerHtml(item);
    modalId=id;
    $('#modalStar').textContent=state.favorites.includes(id)?'★ 已收藏':'☆ 收藏';
    $('#modal').classList.remove('hidden'); document.body.style.overflow='hidden';
  }
  function closeModal(){ $('#modal').classList.add('hidden'); document.body.style.overflow=''; modalId=null; }

  function beginEdit(el,id){ editId=id; el.contentEditable='true'; el.classList.add('editing'); el.focus(); toast('直接修改，点空白处保存'); }
  function endEdit(el){ if(el.contentEditable!=='true') return; const text=el.textContent.trim(); if(editId&&text){ state.custom[editId]=text; save(); toast('答案已更新'); } el.contentEditable='false'; el.classList.remove('editing'); editId=null; }
  function bindGestures(){
    const box=$('#answerBox'), ans=$('#studyAnswer');
    ans.addEventListener('pointerdown',()=>{ answerLongFired=false; clearTimeout(answerLongTimer); answerLongTimer=setTimeout(()=>{ if(currentItem){ answerLongFired=true; beginEdit(ans,currentItem.id); } },650); });
    ['pointerup','pointerleave','pointercancel'].forEach(e=>ans.addEventListener(e,()=>clearTimeout(answerLongTimer)));
    ans.addEventListener('blur',()=>endEdit(ans));
    box.addEventListener('click',e=>{ if(answerLongFired){answerLongFired=false;return;} if(e.target.closest('#studyAnswer')&&ans.contentEditable==='true')return; if(!box.classList.contains('hidden')) hide(); });
    const list=$('#summaryList');
    list.addEventListener('click',e=>{ if(answerLongFired){answerLongFired=false;return;} const a=e.target.closest('.summary-answer'); if(a&&a.contentEditable!=='true') a.classList.toggle('covered'); });
    list.addEventListener('pointerdown',e=>{ const a=e.target.closest('.summary-answer'); if(!a)return; answerLongFired=false; clearTimeout(answerLongTimer); answerLongTimer=setTimeout(()=>{ answerLongFired=true; beginEdit(a,a.dataset.summaryId); },650); });
    ['pointerup','pointerleave','pointercancel'].forEach(e=>list.addEventListener(e,()=>clearTimeout(answerLongTimer)));
    list.addEventListener('focusout',e=>{ const a=e.target.closest('.summary-answer'); if(a) endEdit(a); });
  }

  function bind(){
    $$('[data-subject]').forEach(b=>b.addEventListener('click',()=>openSubject(b.dataset.subject)));
    $$('[data-module]').forEach(b=>b.addEventListener('click',()=>openModule(b.dataset.module)));
    $('#backBtn').addEventListener('click',()=>{ if($('#screen-study').classList.contains('active')){ showScreen('dash'); renderDash(); } else if($('#screen-dash').classList.contains('active')){ openSubject(subject); } else showScreen('home'); });
    $('#startBtn').addEventListener('click',startStudy);
    $('#emptyHomeBtn').addEventListener('click',()=>{ showScreen('home'); });
    $('#dashLibBtn').addEventListener('click',()=>{ renderLibrary(); showScreen('library'); });
    $('#revealBtn').addEventListener('click',reveal);
    $$('.rate').forEach(b=>b.addEventListener('click',()=>rate(b.dataset.rate)));
    $('#summaryContinue').addEventListener('click',()=>{ const p=planOf(subject,module); if(p){ p.summary=null; p.retryActive=p.retry.length>0; save(); } renderStudy(); });
    $('#starBtn').addEventListener('click',()=>{ if(!currentItem)return; const i=state.favorites.indexOf(currentItem.id); if(i>=0)state.favorites.splice(i,1); else state.favorites.push(currentItem.id); save(); renderStudy(); });
    $('#themeBtn').addEventListener('click',()=>{ state.settings.dark=!state.settings.dark; save(); applyTheme(); });
    $('#themeRow').addEventListener('click',()=>{ state.settings.dark=!state.settings.dark; save(); applyTheme(); });
    $('#resetProgress').addEventListener('click',()=>{ if(confirm('清空全部学习进度？不可恢复')){ state.progress={}; state.plans={}; save(); toast('进度已清空'); renderDash(); } });
    $('#resetEdits').addEventListener('click',()=>{ state.custom={}; save(); toast('答案已恢复'); });
    $$('.tab').forEach(t=>t.addEventListener('click',()=>{
      const n=t.dataset.goto;
      if(n==='home') showScreen('home');
      else if(n==='library'){ if(!subject) subject='857'; renderLibrary(); showScreen('library'); }
      else { applyTheme(); showScreen('settings'); }
    }));
    $('#searchInput').addEventListener('input',renderLibrary);
    $('#catChips').addEventListener('click',e=>{ const c=e.target.closest('.chip'); if(!c)return; currentCat=c.dataset.cat; $$('.chip',$('#catChips')).forEach(x=>x.classList.toggle('active',x===c)); renderLibrary(); });
    $('#libraryList').addEventListener('click',e=>{ const b=e.target.closest('[data-lib-id]'); if(b) openModal(b.dataset.libId); });
    $('#modal').addEventListener('click',e=>{ if(e.target.closest('[data-close="modal"]')) closeModal(); });
    $('#modalStar').addEventListener('click',()=>{ if(!modalId)return; const i=state.favorites.indexOf(modalId); if(i>=0)state.favorites.splice(i,1); else state.favorites.push(modalId); save(); $('#modalStar').textContent=state.favorites.includes(modalId)?'★ 已收藏':'☆ 收藏'; });
    bindGestures();
  }

  applyTheme(); renderHome(); bind();
})();
