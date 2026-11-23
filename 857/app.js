(() => {
  'use strict';

  const SUBJECT = window.APP_SUBJECT || '344';
  const DATA = Array.isArray(window.APP_DATA) ? window.APP_DATA : [];
  const STORE_KEY = `bigq-${SUBJECT}-v2`;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function addDays(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  function shuffle(a) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  }

  const defaultState = () => ({
    progress: {},
    drafts: {},
    days: {},
    hidden: [],
    settings: { daily: 3, order: 'random', dark: false }
  });
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      const p = JSON.parse(raw);
      const base = defaultState();
      return {
        ...base, ...p,
        progress: p.progress || {},
        drafts: p.drafts || {},
        days: p.days || {},
        hidden: Array.isArray(p.hidden) ? p.hidden : [],
        settings: { ...base.settings, ...(p.settings || {}) }
      };
    } catch (e) { return defaultState(); }
  }
  let state = load();
  let queue = [];
  let index = 0;
  let sessionMode = '今日训练';
  let filter = 'all';
  let currentModal = null;

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('保存失败，浏览器存储可能已满'); }
  }
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 1800);
  }
  function progressOf(id) { return state.progress[id] || null; }
  function isHidden(id) { return state.hidden.includes(id); }
  function activeData() {
    const hidden = new Set(state.hidden);
    return DATA.filter(x => !hidden.has(x.id));
  }
  function hiddenCount() { return state.hidden.length; }
  function isMastered(id) { return !!progressOf(id)?.mastered; }
  function isPracticed(id) { return !!progressOf(id); }
  function learnedCount() { return activeData().filter(x => isPracticed(x.id)).length; }
  function masteredCount() { return activeData().filter(x => isMastered(x.id)).length; }
  function dueList() {
    const t = todayKey();
    return activeData().filter(x => {
      const p = progressOf(x.id);
      return p && p.due && p.due <= t;
    });
  }
  function newList() { return activeData().filter(x => !isPracticed(x.id)); }
  function todayDone() { return state.days[todayKey()] || 0; }
  function streak() {
    let n = 0;
    const d = new Date();
    if (!state.days[todayKey()]) d.setDate(d.getDate() - 1);
    while (true) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (state.days[k] > 0) { n++; d.setDate(d.getDate() - 1); } else break;
    }
    return n;
  }
  function levelOf(id) { return progressOf(id)?.level; }
  function levelText(l) { return ['没思路', '有框架', '能展开', '能写完'][l] || '未练'; }

  function applyTheme() {
    document.body.classList.toggle('dark', !!state.settings.dark);
    $('#themeBtn').textContent = state.settings.dark ? '☀' : '☾';
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', state.settings.dark ? '#10161c' : (SUBJECT === '344' ? '#1f4e79' : '#1f6b4f'));
  }

  function showScreen(name) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${name}`));
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.goto === name));
    $('#backBtn').classList.toggle('hidden', name !== 'train');
    if (name !== 'train') stopTimer();
    if (name === 'home') renderHome();
    if (name === 'library') renderLibrary();
    if (name === 'stats') renderStats();
    if (name === 'settings') renderSettings();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function renderHome() {
    const due = dueList().length;
    const availableNew = newList().length;
    const daily = state.settings.daily;
    const newSlots = Math.min(availableNew, Math.max(0, daily - due));
    const done = todayDone();
    const target = Math.max(daily, done);
    $('#todayRing').style.setProperty('--p', `${target ? Math.min(100, done / target * 100) : 0}%`);
    $('#todayDone').textContent = done;
    $('#todayTarget').textContent = daily;
    $('#dueCount').textContent = due;
    $('#newCount').textContent = newSlots;
    $('#masteredCount').textContent = masteredCount();
    $('#statDone').textContent = learnedCount();
    $('#statStreak').textContent = streak();
    $('#statMastered').textContent = masteredCount();
    $('#streakPill').textContent = `🔥 ${streak()} 天`;
    const d = new Date();
    $('#todayLabel').textContent = `${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]} · 简答/论述`;
    $('#totalLabel').textContent = `${learnedCount()} / ${activeData().length}`;
    renderTopics($('#topicList'));
  }

  function topicGroups() {
    const map = new Map();
    activeData().forEach(x => {
      if (!map.has(x.topic)) map.set(x.topic, { total: 0, learned: 0, mastered: 0 });
      const g = map.get(x.topic);
      g.total++;
      if (isPracticed(x.id)) g.learned++;
      if (isMastered(x.id)) g.mastered++;
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }
  function renderTopics(el) {
    if (!el) return;
    el.innerHTML = topicGroups().map(([topic, g]) => {
      const pct = g.total ? Math.round(g.learned / g.total * 100) : 0;
      return `<div class="topic-item"><div class="topic-line"><span>${escapeHtml(topic)}</span><span>${g.learned}/${g.total}</span></div><div class="mini-track"><div class="mini-fill" style="width:${pct}%"></div></div></div>`;
    }).join('');
  }

  function todayQueue() {
    const due = dueList();
    const fresh = newList();
    let list = [];
    if (state.settings.order === 'sequence') {
      list = [...due, ...fresh].sort((a, b) => a.id - b.id);
    } else {
      list = [...shuffle(due), ...shuffle(fresh)];
    }
    return list.slice(0, state.settings.daily);
  }

  function startSession(mode) {
    sessionMode = mode === 'S' ? '简答专项' : mode === 'L' ? '论述专项' : mode === 'single' ? '单题训练' : '今日训练';
    if (mode === 'S' || mode === 'L') {
      const type = mode === 'S' ? '简答' : '论述';
      queue = shuffle(activeData().filter(x => x.type === type && !isMastered(x.id))).slice(0, 10);
    } else if (mode !== 'single') {
      queue = todayQueue();
    }
    index = 0;
    showScreen('train');
    if (!queue.length) {
      $('#trainArea').classList.add('hidden');
      $('#trainEmpty').classList.remove('hidden');
      $('#trainProgressText').textContent = '0 / 0';
      $('#trainProgressBar').style.width = '0%';
      $('#emptyText').textContent = '这一组没有题了。可以回首页，或去题库挑一道。';
      return;
    }
    $('#trainArea').classList.remove('hidden');
    $('#trainEmpty').classList.add('hidden');
    renderTrain();
  }

  function currentItem() { return queue[index] || null; }

  function renderTrain() {
    if (!queue.length || index >= queue.length) { finishSession(); return; }
    const item = currentItem();
    const p = progressOf(item.id);
    $('#trainProgressText').textContent = `${index + 1} / ${queue.length}`;
    $('#trainProgressBar').style.width = `${Math.round(index / queue.length * 100)}%`;
    $('#trainMode').textContent = sessionMode;
    $('#trainType').textContent = item.type;
    $('#trainSource').textContent = item.source;
    $('#trainScore').textContent = `${item.score} 分`;
    $('#trainTitle').textContent = item.title;
    $('#outline').value = state.drafts[item.id] || '';
    $('#skeleton').classList.add('hidden');
    $('#ratings').classList.add('hidden');
    $('#fullWrap').classList.add('hidden');
    $('#fullBtn').classList.add('hidden');
    $('#fullBtn').textContent = '看答题版';
    $('#revealBtn').classList.remove('hidden');
    $('#revealBtn').textContent = p ? '再看一次骨架' : '显示骨架';
    $('#timerTarget').textContent = item.type === '简答' ? '建议 10 分钟' : '建议 20 分钟';
    resetTimer(item.type === '简答' ? 600 : 1200);
  }

  function skeletonHtml(item) {
    const points = item.points.map((p, i) => `<li>${escapeHtml(p)}</li>`).join('');
    return `<div class="sk-block"><div class="sk-label">破题</div><div class="sk-text">${escapeHtml(item.breakq)}</div></div>
      <div class="sk-block"><div class="sk-label">骨架</div><ol class="sk-points">${points}</ol></div>
      <div class="sk-block"><div class="sk-label">关键词</div><div class="sk-text">${escapeHtml(item.keys)}</div></div>
      <div class="sk-block"><div class="sk-label">案例/机制</div><div class="sk-text">${escapeHtml(item.case)}</div></div>
      <div class="sk-block sk-pit"><div class="sk-label">易漏点</div><div class="sk-text">${escapeHtml(item.pit)}</div></div>`;
  }

  function reveal() {
    const item = currentItem();
    if (!item) return;
    $('#sBreak').textContent = item.breakq;
    $('#sPoints').innerHTML = item.points.map(p => `<li>${escapeHtml(p)}</li>`).join('');
    $('#sKeys').textContent = item.keys;
    $('#sCase').textContent = item.case;
    $('#sPit').textContent = item.pit;
    $('#skeleton').classList.remove('hidden');
    $('#ratings').classList.remove('hidden');
    $('#revealBtn').classList.add('hidden');
    $('#fullBtn').classList.toggle('hidden', !item.full || !item.full.length);
  }

  function toggleFull() {
    const item = currentItem();
    if (!item || !item.full || !item.full.length) return;
    const wrap = $('#fullWrap');
    if (!wrap.classList.contains('hidden')) {
      wrap.classList.add('hidden');
      $('#fullBtn').textContent = '看答题版';
      return;
    }
    $('#fullBody').innerHTML = item.full.map(s => `<p class="full-point"><b>${escapeHtml(s.h)}：</b>${escapeHtml(s.t)}</p>`).join('');
    wrap.classList.remove('hidden');
    $('#fullBtn').textContent = '收起答题版';
  }

  function rate(level) {
    const item = currentItem();
    if (!item) return;
    const p = progressOf(item.id) || { reps: 0, level: 0 };
    p.level = Number(level);
    p.reps = (p.reps || 0) + 1;
    p.last = todayKey();
    p.due = addDays([1, 2, 4, 7][p.level]);
    if (p.level === 3 && p.reps >= 2) p.mastered = true;
    state.progress[item.id] = p;
    state.days[todayKey()] = (state.days[todayKey()] || 0) + 1;
    save();
    index++;
    if (index >= queue.length) finishSession();
    else renderTrain();
  }

  function finishSession() {
    $('#trainArea').classList.add('hidden');
    $('#trainEmpty').classList.remove('hidden');
    $('#trainProgressBar').style.width = '100%';
    $('#trainProgressText').textContent = `${queue.length} / ${queue.length}`;
    $('#emptyText').textContent = '这一组练完了。回首页可以开始下一组，或去题库挑一道。';
    stopTimer();
  }

  // timer
  let timerSec = 0, timerId = null, timerRunning = false, timerTarget = 600, timerWarned = false;
  function fmt(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function renderTimer() { $('#timer').textContent = fmt(timerSec); }
  function stopTimer() {
    timerRunning = false;
    clearInterval(timerId);
    timerId = null;
    const b = $('#timerBtn');
    if (b) b.textContent = timerSec ? '继续计时' : '开始计时';
  }
  function resetTimer(target) {
    stopTimer(); timerSec = 0; timerTarget = target || 600; timerWarned = false; renderTimer();
  }
  function toggleTimer() {
    if (timerRunning) { stopTimer(); return; }
    timerRunning = true;
    $('#timerBtn').textContent = '暂停';
    timerId = setInterval(() => {
      timerSec++;
      renderTimer();
      if (!timerWarned && timerSec >= timerTarget) {
        timerWarned = true;
        toast('建议时间到了，先收尾写结论');
      }
    }, 1000);
  }

  function renderLibrary() {
    const q = ($('#searchInput').value || '').trim().toLowerCase();
    let list = activeData().slice().sort((a, b) => a.id - b.id);
    if (filter === '简答' || filter === '论述') list = list.filter(x => x.type === filter);
    if (filter === 'new') list = list.filter(x => !isPracticed(x.id));
    if (filter === 'mastered') list = list.filter(x => isMastered(x.id));
    if (q) list = list.filter(x => (x.title + x.breakq + x.keys + x.case + x.pit).toLowerCase().includes(q));
    $('#libraryCount').textContent = `${list.length} 题`;
    if (!list.length) {
      $('#questionList').innerHTML = '<div class="empty-list">没有匹配的题目。</div>';
      return;
    }
    $('#questionList').innerHTML = list.map(x => {
      const l = levelOf(x.id);
      const dots = [0,1,2,3].map(i => `<span class="level-dot ${l != null && i <= l ? 'on' : ''}"></span>`).join('');
      return `<button class="q-item" data-id="${x.id}"><span class="q-left"><span class="q-name">${escapeHtml(x.title)}</span><span class="q-sub"><span class="type-tag">${x.type} ${x.score}分</span><span>${escapeHtml(x.topic)}</span><span>${escapeHtml(x.source)}</span></span><span class="level-dots">${dots}</span></span><span style="color:var(--muted)">›</span></button>`;
    }).join('');
  }

  function openModal(item) {
    currentModal = item;
    $('#mType').textContent = `${item.type} ${item.score}分`;
    $('#mTitle').textContent = item.title;
    $('#mBody').innerHTML = skeletonHtml(item);
    $('#mFull').classList.add('hidden');
    $('#mFullBtn').classList.toggle('hidden', !item.full || !item.full.length);
    $('#mFullBtn').textContent = '看答题版';
    $('#modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    $('#modal').classList.add('hidden');
    document.body.style.overflow = '';
    currentModal = null;
  }

  function toggleModalFull() {
    if (!currentModal || !currentModal.full || !currentModal.full.length) return;
    const box = $('#mFull');
    if (!box.classList.contains('hidden')) {
      box.classList.add('hidden');
      $('#mFullBtn').textContent = '看答题版';
      return;
    }
    box.innerHTML = currentModal.full.map(s => `<p class="full-point"><b>${escapeHtml(s.h)}：</b>${escapeHtml(s.t)}</p>`).join('');
    box.classList.remove('hidden');
    $('#mFullBtn').textContent = '收起答题版';
  }

  function deleteQuestion(id) {
    const item = DATA.find(x => x.id === id);
    if (!item) return;
    if (!confirm(`确定把「${item.title}」移出题库吗？\n删除后可在设置里恢复。`)) return;
    if (!state.hidden.includes(id)) state.hidden.push(id);
    save();
    closeModal();
    if (queue.some(x => x.id === id)) {
      const wasCurrent = currentItem()?.id === id;
      queue = queue.filter(x => x.id !== id);
      if (!queue.length) finishSession();
      else if (wasCurrent) {
        if (index >= queue.length) finishSession();
        else renderTrain();
      } else {
        renderTrain();
      }
    } else {
      renderHome();
      renderLibrary();
      renderStats();
      renderSettings();
    }
    toast('已移出题库，可在设置恢复');
  }

  function restoreHidden() {
    if (!state.hidden.length) return toast('没有已删除的题目');
    if (!confirm(`恢复全部 ${state.hidden.length} 道已删除题目？`)) return;
    state.hidden = [];
    save();
    renderHome();
    renderLibrary();
    renderStats();
    renderSettings();
    toast('已全部恢复');
  }

  function barRow(label, value, total) {
    const pct = total ? Math.round(value / total * 100) : 0;
    return `<div class="bar-row"><span>${label}</span><span class="bar"><i style="width:${pct}%"></i></span><b>${value}/${total}</b></div>`;
  }
  function renderStats() {
    const learned = learnedCount(), mastered = masteredCount();
    const days = Object.values(state.days).filter(v => v > 0).length;
    $('#statDone2').textContent = learned;
    $('#statMastered2').textContent = mastered;
    $('#statDays2').textContent = days;
    const sTotal = activeData().filter(x => x.type === '简答').length;
    const lTotal = activeData().filter(x => x.type === '论述').length;
    const sDone = activeData().filter(x => x.type === '简答' && isPracticed(x.id)).length;
    const lDone = activeData().filter(x => x.type === '论述' && isPracticed(x.id)).length;
    $('#typeBars').innerHTML = barRow('简答', sDone, sTotal) + barRow('论述', lDone, lTotal);
    const counts = [0,1,2,3].map(l => activeData().filter(x => levelOf(x.id) === l).length);
    $('#levelBars').innerHTML = counts.map((v,i) => barRow(levelText(i), v, activeData().length)).join('');
    renderWeek();
    $('#topicStats').innerHTML = topicGroups().map(([t,g]) => barRow(t, g.learned, g.total)).join('');
  }
  function renderWeek() {
    const days = [];
    const d = new Date();
    for (let i = 6; i >= 0; i--) {
      const x = new Date(d); x.setDate(x.getDate() - i);
      const key = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
      days.push({ key, label: ['日','一','二','三','四','五','六'][x.getDay()], count: state.days[key] || 0 });
    }
    const max = Math.max(1, ...days.map(x => x.count));
    $('#weekTotal').textContent = `${days.reduce((s,x) => s + x.count, 0)} 次`;
    $('#weekChart').innerHTML = days.map(x => {
      const h = Math.max(4, Math.round(x.count / max * 92));
      return `<div class="week-col"><div class="week-num">${x.count || ''}</div><div class="week-bar" style="height:${h}px"></div><div class="week-day">${x.label}</div></div>`;
    }).join('');
  }

  function renderSettings() {
    $('#dailySelect').value = String(state.settings.daily);
    $('#orderSelect').value = state.settings.order;
    $('#darkToggle').checked = !!state.settings.dark;
    $('#hiddenCount').textContent = `${hiddenCount()} 题`;
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${SUBJECT}大题进度-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已导出');
  }
  function importData(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const obj = JSON.parse(r.result);
        state = {
          ...defaultState(), ...obj,
          progress: obj.progress || {},
          drafts: obj.drafts || {},
          days: obj.days || {},
          hidden: Array.isArray(obj.hidden) ? obj.hidden : [],
          settings: { ...defaultState().settings, ...(obj.settings || {}) }
        };
        save(); applyTheme(); renderHome(); renderSettings();
        toast('导入成功');
      } catch (e) { toast('导入失败：文件格式不对'); }
    };
    r.readAsText(file);
  }
  function resetAll() {
    if (!confirm('确定清空全部训练进度吗？建议先导出备份。')) return;
    state = defaultState(); queue = []; index = 0;
    save(); applyTheme(); renderHome(); renderSettings(); toast('已清空');
  }

  function bind() {
    $$('.tab').forEach(t => t.addEventListener('click', () => {
      const n = t.dataset.goto;
      if (n === 'train') startSession('due');
      else showScreen(n);
    }));
    $$('[data-goto]').forEach(el => el.addEventListener('click', () => {
      const n = el.dataset.goto;
      if (n === 'train') startSession('due');
      else showScreen(n);
    }));
    $('#backBtn').addEventListener('click', () => showScreen('home'));
    $('#startBtn').addEventListener('click', () => startSession('due'));
    $('#quickS').addEventListener('click', () => startSession('S'));
    $('#quickL').addEventListener('click', () => startSession('L'));
    $('#revealBtn').addEventListener('click', reveal);
    $('#fullBtn').addEventListener('click', toggleFull);
    $$('.rate').forEach(b => b.addEventListener('click', () => rate(b.dataset.level)));
    $('#prevBtn').addEventListener('click', () => {
      if (index > 0) { index--; renderTrain(); } else toast('已经是第一题');
    });
    $('#skipBtn').addEventListener('click', () => {
      if (!queue.length) return;
      index++;
      if (index >= queue.length) finishSession(); else renderTrain();
    });
    $('#outline').addEventListener('input', (e) => {
      const item = currentItem();
      if (item) { state.drafts[item.id] = e.target.value; save(); }
    });
    $('#timerBtn').addEventListener('click', toggleTimer);
    $('#searchInput').addEventListener('input', renderLibrary);
    $('#filterChips').addEventListener('click', (e) => {
      const c = e.target.closest('.filter-chip');
      if (!c) return;
      filter = c.dataset.filter;
      $$('.filter-chip', $('#filterChips')).forEach(x => x.classList.toggle('active', x === c));
      renderLibrary();
    });
    $('#questionList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      const item = activeData().find(x => x.id === Number(b.dataset.id));
      if (item) openModal(item);
    });
    $('#modal').addEventListener('click', (e) => {
      if (e.target.closest('[data-close="modal"]')) closeModal();
    });
    $('#mStart').addEventListener('click', () => {
      if (!currentModal) return;
      const item = currentModal;
      closeModal();
      queue = [item]; index = 0;
      sessionMode = '单题训练';
      showScreen('train');
      $('#trainArea').classList.remove('hidden');
      $('#trainEmpty').classList.add('hidden');
      renderTrain();
    });
    $('#deleteBtn').addEventListener('click', () => {
      const item = currentItem();
      if (item) deleteQuestion(item.id);
    });
    $('#mDelete').addEventListener('click', () => {
      if (currentModal) deleteQuestion(currentModal.id);
    });
    $('#mFullBtn').addEventListener('click', toggleModalFull);
    $('#restoreBtn').addEventListener('click', restoreHidden);
    $('#dailySelect').addEventListener('change', (e) => { state.settings.daily = Number(e.target.value); save(); renderHome(); });
    $('#orderSelect').addEventListener('change', (e) => { state.settings.order = e.target.value; save(); });
    $('#darkToggle').addEventListener('change', (e) => { state.settings.dark = e.target.checked; save(); applyTheme(); });
    $('#themeBtn').addEventListener('click', () => { state.settings.dark = !state.settings.dark; save(); applyTheme(); });
    $('#exportBtn').addEventListener('click', exportData);
    $('#importFile').addEventListener('change', (e) => {
      const f = e.target.files?.[0]; if (f) importData(f); e.target.value = '';
    });
    $('#resetBtn').addEventListener('click', resetAll);
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, select')) return;
      if ($('#screen-train').classList.contains('active')) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if ($('#skeleton').classList.contains('hidden')) reveal(); }
        if (e.key === '1') rate(0);
        if (e.key === '2') rate(1);
        if (e.key === '3') rate(2);
        if (e.key === '4') rate(3);
      }
    });
  }

  function init() {
    bind(); applyTheme(); renderHome();
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    }
    const p = new URLSearchParams(location.search);
    if (p.get('screen')) showScreen(p.get('screen'));
    if (p.get('train') === '1') startSession('due');
    if (p.get('type') === 'S' || p.get('type') === 'L') startSession(p.get('type'));
    if (p.get('reveal') === '1') setTimeout(reveal, 30);
    if (p.get('full') === '1') setTimeout(toggleFull, 80);
    if (p.get('q')) {
      const item = activeData().find(x => x.title === p.get('q'));
      if (item) openModal(item);
    }
  }
  init();
})();
