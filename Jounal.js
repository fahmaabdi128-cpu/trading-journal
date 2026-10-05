const STORAGE_KEY = 'trading_journal_v1';
let trades = [];
let expanded = new Set();
let charts = {};
let currentTab = 'overview';

function saveTrades() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  const ind = document.getElementById('save-indicator');
  ind.textContent = 'All trades saved ✓';
  setTimeout(() => { ind.textContent = ''; }, 2000);
}

function loadTrades() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { trades = JSON.parse(raw); } catch(e) { trades = []; }
  } else {
    trades = [];
  }
}

function fmt(n) { return (n >= 0 ? '+' : '') + parseFloat(n).toFixed(2); }
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function calcStats(arr) {
  arr = arr || trades;
  const total = arr.length;
  const wins = arr.filter(t => t.result === 'win').length;
  const wr = total ? (wins / total * 100) : 0;
  const netR = arr.reduce((s, t) => s + t.r, 0);
  const winRs = arr.filter(t => t.r > 0).map(t => t.r);
  const avgWin = winRs.length ? winRs.reduce((a, b) => a + b, 0) / winRs.length : 0;
  const totalWon = winRs.reduce((a, b) => a + b, 0);
  const totalLost = Math.abs(arr.filter(t => t.r < 0).reduce((s, t) => s + t.r, 0));
  const pf = totalLost ? (totalWon / totalLost) : (totalWon > 0 ? Infinity : 0);
  const exp = total ? netR / total : 0;
  return { total, wins, wr, netR, avgWin, pf, exp };
}

function showTab(t, el) {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + t).classList.add('active');
  if (el) el.classList.add('active');
  currentTab = t;
  renderTab(t);
}

function renderTab(t) {
  if (t === 'overview') renderOverview();
  else if (t === 'byday') renderByDay();
  else if (t === 'breakdown') renderBreakdown();
  else if (t === 'patterns') renderPatterns();
  else if (t === 'daily') renderDaily();
  else if (t === 'timeline') renderTimeline();
  else if (t === 'heatmap') renderHeatmap();
  else if (t === 'mantra') renderMantra();
  else if (t === 'tradelog') renderTradeLog();
}

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function renderOverview() {
  const s = calcStats();
  const pfStr = s.pf === Infinity ? '∞' : s.pf.toFixed(2);
  document.getElementById('stats-overview').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total trades</div><div class="stat-value">${s.total}</div></div>
    <div class="stat-card"><div class="stat-label">Win rate</div><div class="stat-value ${s.wr >= 50 ? 'pos' : 'neg'}">${s.total ? s.wr.toFixed(1) + '%' : '—'}</div></div>
    <div class="stat-card"><div class="stat-label">Net R</div><div class="stat-value ${s.netR >= 0 ? 'pos' : 'neg'}">${s.total ? fmt(s.netR) + 'R' : '—'}</div></div>
    <div class="stat-card"><div class="stat-label">Avg win</div><div class="stat-value pos">${s.avgWin > 0 ? '+' + s.avgWin.toFixed(2) + 'R' : '—'}</div></div>
    <div class="stat-card"><div class="stat-label">Profit factor</div><div class="stat-value ${s.pf >= 1 ? 'pos' : 'neg'}">${s.total ? pfStr : '—'}</div></div>
    <div class="stat-card"><div class="stat-label">Expectancy</div><div class="stat-value ${s.exp >= 0 ? 'pos' : 'neg'}">${s.total ? fmt(s.exp) + 'R' : '—'}</div></div>
  `;
  destroyChart('eq');
  if (!trades.length) return;
  let cum = 0;
  const labels = ['Start'], data = [0];
  trades.forEach(t => { cum = parseFloat((cum + t.r).toFixed(4)); labels.push('#' + t.id); data.push(cum); });
  const last = data[data.length - 1];
  const pos = '#1D9E75', neg = '#e05a3a';
  charts['eq'] = new Chart(document.getElementById('eqChart'), {
    type: 'line',
    data: { labels, datasets: [{ data, borderColor: last >= 0 ? pos : neg, backgroundColor: last >= 0 ? 'rgba(29,158,117,0.07)' : 'rgba(224,90,58,0.07)', borderWidth: 2, pointRadius: 3, pointBackgroundColor: data.map(v => v >= 0 ? pos : neg), fill: true, tension: 0.3 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmt(c.parsed.y) + 'R' } } }, scales: { x: { ticks: { color: '#555', font: { size: 10 } }, grid: { color: '#1e1e1e' } }, y: { ticks: { color: '#555', font: { size: 10 }, callback: v => fmt(v) + 'R' }, grid: { color: '#1e1e1e' } } } }
  });
}

function renderByDay() {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dayData = days.map(d => { const arr = trades.filter(t => t.day === d); return { day: d, ...calcStats(arr) }; });
  document.getElementById('day-cards').innerHTML = dayData.map(d => {
    const cls = d.total === 0 ? 'gray' : d.wr >= 60 ? 'green' : d.wr >= 50 ? 'amber' : 'red';
    return `<div class="day-card">
      <span class="day-name">${d.day}</span>
      <div class="day-stats">
        <span class="day-stat">${d.total} trades</span>
        <span class="day-wr ${cls}">${d.total ? d.wr.toFixed(0) + '%' : '—'}</span>
        <span class="trade-r ${d.netR >= 0 ? 'pos' : 'neg'}" style="font-size:13px;">${d.total ? fmt(d.netR) + 'R' : '—'}</span>
        <div class="dot ${cls}"></div>
      </div>
    </div>`;
  }).join('');
  destroyChart('day');
  const netRs = dayData.map(d => d.netR);
  charts['day'] = new Chart(document.getElementById('dayChart'), {
    type: 'bar',
    data: { labels: days.map(d => d.slice(0, 3)), datasets: [{ data: netRs, backgroundColor: netRs.map(v => v >= 0 ? 'rgba(29,158,117,0.7)' : 'rgba(224,90,58,0.7)'), borderColor: netRs.map(v => v >= 0 ? '#1D9E75' : '#e05a3a'), borderWidth: 1, borderRadius: 5 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmt(c.parsed.y) + 'R' } } }, scales: { x: { ticks: { color: '#555', font: { size: 11 } }, grid: { display: false } }, y: { ticks: { color: '#555', font: { size: 10 }, callback: v => fmt(v) + 'R' }, grid: { color: '#1e1e1e' } } } }
  });
}

function renderBreakdown() {
  const strats = [...new Set(trades.map(t => t.strategy).filter(Boolean))];
  document.getElementById('strat-cards').innerHTML = strats.length ? strats.map(s => {
    const arr = trades.filter(t => t.strategy === s);
    const st = calcStats(arr);
    return `<div class="strat-card">
      <div><div class="strat-name">${s}</div><div class="strat-sub">${arr.length} trades</div></div>
      <div style="display:flex;gap:12px;align-items:center;">
        <span class="${st.wr >= 50 ? 'pos' : 'neg'}" style="font-weight:600;font-size:13px;">${st.wr.toFixed(0)}% WR</span>
        <span class="trade-r ${st.netR >= 0 ? 'pos' : 'neg'}" style="font-size:13px;">${fmt(st.netR)}R</span>
      </div>
    </div>`;
  }).join('') : '<p class="empty-msg">Add trades with a strategy to see this.</p>';

  const entryCards = document.getElementById('entry-cards');
  entryCards.innerHTML = ['Conservative', 'Aggressive'].map(e => {
    const arr = trades.filter(t => t.entry === e);
    const st = calcStats(arr);
    return `<div class="strat-card">
      <div><div class="strat-name">${e}</div><div class="strat-sub">${arr.length} trades</div></div>
      <div style="display:flex;gap:12px;align-items:center;">
        <span class="${st.wr >= 50 ? 'pos' : 'neg'}" style="font-weight:600;font-size:13px;">${arr.length ? st.wr.toFixed(0) + '% WR' : '—'}</span>
        <span class="trade-r ${st.netR >= 0 ? 'pos' : 'neg'}" style="font-size:13px;">${arr.length ? fmt(st.netR) + 'R' : '—'}</span>
      </div>
    </div>`;
  }).join('');

  const second = trades.filter(t => t.attempt === '2nd');
  const secWR = second.length ? (second.filter(t => t.result === 'win').length / second.length * 100) : 0;
  document.getElementById('attempt-card').innerHTML = `<div class="strat-card">
    <div><div class="strat-name">2nd attempt</div><div class="strat-sub">${second.length} trades</div></div>
    <span class="${secWR >= 50 ? 'pos' : 'neg'}" style="font-weight:600;font-size:20px;">${second.length ? secWR.toFixed(0) + '%' : '—'}</span>
  </div>`;
}

function renderPatterns() {
  const s = calcStats();
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dayStats = days.map(d => { const arr = trades.filter(t => t.day === d); return { day: d, ...calcStats(arr) }; });
  const bestDay = dayStats.filter(d => d.total > 0).sort((a, b) => b.wr - a.wr)[0];
  const worstDay = dayStats.filter(d => d.total > 0).sort((a, b) => a.wr - b.wr)[0];
  const strats = [...new Set(trades.map(t => t.strategy).filter(Boolean))];
  const stratStats = strats.map(st => { const arr = trades.filter(t => t.strategy === st); return { st, wr: arr.filter(t => t.result === 'win').length / arr.length * 100, n: arr.length, netR: arr.reduce((s, t) => s + t.r, 0) }; });
  const bestStrat = stratStats.sort((a, b) => b.wr - a.wr)[0];
  const second = trades.filter(t => t.attempt === '2nd');
  const secWR = second.length ? (second.filter(t => t.result === 'win').length / second.length * 100) : null;
  const consArr = trades.filter(t => t.entry === 'Conservative');
  const aggArr = trades.filter(t => t.entry === 'Aggressive');
  const consWR = consArr.length ? calcStats(consArr).wr : null;
  const aggWR = aggArr.length ? calcStats(aggArr).wr : null;
  const items = [];
  if (bestStrat) items.push(`🏆 Your best strategy is <strong>${bestStrat.st}</strong> with ${bestStrat.wr.toFixed(0)}% win rate across ${bestStrat.n} trades.`);
  if (bestDay && bestDay.total > 0) items.push(`📅 Your strongest day is <strong>${bestDay.day}</strong> at ${bestDay.wr.toFixed(0)}% win rate.`);
  if (worstDay && worstDay.total > 0 && worstDay.wr < 50) items.push(`⚠️ <strong>${worstDay.day}</strong> is your weakest day at ${worstDay.wr.toFixed(0)}%. Consider sizing down.`);
  if (secWR !== null) items.push(`🔁 Your 2nd attempt win rate is <strong>${secWR.toFixed(0)}%</strong> over ${second.length} re-entries.`);
  if (consWR !== null && aggWR !== null) items.push(`🎯 Conservative entries win <strong>${consWR.toFixed(0)}%</strong> vs aggressive at <strong>${aggWR.toFixed(0)}%</strong>.`);
  if (s.exp > 0) items.push(`📈 Expectancy is <strong>${fmt(s.exp)}R</strong> per trade — you have a provable edge.`);
  if (s.pf !== Infinity && s.pf > 0 && s.total > 0) items.push(`💰 Profit factor <strong>${s.pf.toFixed(2)}</strong> — you earn ${s.pf.toFixed(2)}R for every 1R risked.`);
  document.getElementById('patterns-list').innerHTML = items.length ?
    items.map(i => `<div class="pattern-card">${i}</div>`).join('') :
    '<p class="empty-msg">Log more trades to surface patterns.</p>';
}

function renderDaily() {
  const sel = document.getElementById('daily-day-select').value;
  const arr = trades.filter(t => t.day === sel);
  const s = calcStats(arr);
  const riskCls = s.total === 0 ? 'risk-medium' : s.wr >= 60 ? 'risk-low' : s.wr >= 50 ? 'risk-medium' : 'risk-high';
  const riskLabel = s.total === 0 ? 'No data yet' : s.wr >= 60 ? 'Low risk day' : s.wr >= 50 ? 'Medium risk day' : 'High risk day';
  const strats = [...new Set(arr.map(t => t.strategy).filter(Boolean))];
  const bestStrat = strats.map(st => { const a = arr.filter(t => t.strategy === st); return { st, wr: a.filter(t => t.result === 'win').length / a.length * 100 }; }).sort((a, b) => b.wr - a.wr)[0];
  document.getElementById('daily-content').innerHTML = `
    <div class="daily-block">
      <span class="risk-badge ${riskCls}">${riskLabel}</span>
      <div class="stats-grid" style="margin-top:8px;">
        <div class="stat-card"><div class="stat-label">Trades on ${sel}</div><div class="stat-value">${s.total}</div></div>
        <div class="stat-card"><div class="stat-label">Win rate</div><div class="stat-value ${s.wr >= 50 ? 'pos' : 'neg'}">${s.total ? s.wr.toFixed(1) + '%' : '—'}</div></div>
        <div class="stat-card"><div class="stat-label">Net R</div><div class="stat-value ${s.netR >= 0 ? 'pos' : 'neg'}">${s.total ? fmt(s.netR) + 'R' : '—'}</div></div>
        <div class="stat-card"><div class="stat-label">Best setup</div><div class="stat-value" style="font-size:14px;">${bestStrat ? bestStrat.st : '—'}</div></div>
      </div>
    </div>`;
}

function renderTimeline() {
  const newsOn = document.getElementById('news-toggle').checked;
  document.getElementById('news-label').textContent = newsOn ? 'On' : 'Off';
  const filtered = newsOn ? trades.filter(t => t.newsWeek) : trades;
  const months = {};
  filtered.forEach(t => { const k = t.date ? t.date.slice(0, 7) : 'Unknown'; if (!months[k]) months[k] = []; months[k].push(t); });
  const mKeys = Object.keys(months).sort();
  document.getElementById('monthly-cards').innerHTML = mKeys.length ? mKeys.map(k => {
    const arr = months[k]; const s = calcStats(arr);
    const label = new Date(k + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    return `<div class="timeline-card">
      <div><div class="tl-label">${label}</div><div class="tl-sub">${s.total} trades · ${s.wr.toFixed(0)}% WR</div></div>
      <span class="trade-r ${s.netR >= 0 ? 'pos' : 'neg'}">${fmt(s.netR)}R</span>
    </div>`;
  }).join('') : '<p class="empty-msg">No data for this filter.</p>';
  const weeks = {};
  filtered.forEach(t => {
    if (!t.date) return;
    const d = new Date(t.date + 'T00:00:00');
    const day = d.getDay(); const diff = d.getDate() - (day || 7) + 1;
    const mon = new Date(d); mon.setDate(diff);
    const k = mon.toISOString().split('T')[0];
    if (!weeks[k]) weeks[k] = []; weeks[k].push(t);
  });
  const wKeys = Object.keys(weeks).sort().slice(-10);
  const wLabels = wKeys.map(k => { const d = new Date(k + 'T00:00:00'); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); });
  const wNetR = wKeys.map(k => parseFloat(weeks[k].reduce((s, t) => s + t.r, 0).toFixed(2)));
  destroyChart('week');
  if (wKeys.length) {
    charts['week'] = new Chart(document.getElementById('weekChart'), {
      type: 'bar',
      data: { labels: wLabels, datasets: [{ data: wNetR, backgroundColor: wNetR.map(v => v >= 0 ? 'rgba(29,158,117,0.7)' : 'rgba(224,90,58,0.7)'), borderColor: wNetR.map(v => v >= 0 ? '#1D9E75' : '#e05a3a'), borderWidth: 1, borderRadius: 5 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmt(c.parsed.y) + 'R' } } }, scales: { x: { ticks: { color: '#555', font: { size: 10 }, maxRotation: 45 }, grid: { display: false } }, y: { ticks: { color: '#555', font: { size: 10 }, callback: v => fmt(v) + 'R' }, grid: { color: '#1e1e1e' } } } }
    });
  }
}

function renderHeatmap() {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const strats = [...new Set(trades.map(t => t.strategy).filter(Boolean))];
  if (!strats.length) { document.getElementById('heatmap-wrap').innerHTML = '<p class="empty-msg">Add trades with strategy names to see the heatmap.</p>'; return; }
  const colW = Math.floor((window.innerWidth - 28 - 55) / strats.length);
  let html = `<div style="display:grid;grid-template-columns:55px ${strats.map(() => '1fr').join(' ')};gap:4px;margin-bottom:12px;">`;
  html += `<div></div>`;
  strats.forEach(s => { html += `<div style="font-size:10px;color:#555;font-weight:600;text-align:center;padding:4px 2px;">${s}</div>`; });
  days.forEach(d => {
    html += `<div style="font-size:11px;color:#666;display:flex;align-items:center;">${d.slice(0,3)}</div>`;
    strats.forEach(s => {
      const arr = trades.filter(t => t.day === d && t.strategy === s);
      if (!arr.length) { html += `<div class="heat-cell" style="background:#1a1a1a;color:#333;">—</div>`; return; }
      const wr = arr.filter(t => t.result === 'win').length / arr.length;
      const alpha = 0.1 + wr * 0.85;
      html += `<div class="heat-cell" style="background:rgba(29,158,117,${alpha.toFixed(2)});color:${wr > 0.5 ? '#0d3d26' : '#1D9E75'};">${(wr * 100).toFixed(0)}%</div>`;
    });
  });
  html += '</div>';
  html += `<div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#555;margin-top:4px;">
    <div style="display:flex;gap:3px;">${[0.1,0.3,0.55,0.7,0.95].map(a => `<div style="width:18px;height:18px;border-radius:3px;background:rgba(29,158,117,${a});"></div>`).join('')}</div>
    <span>Low → High win rate</span>
  </div>`;
  document.getElementById('heatmap-wrap').innerHTML = html;
}

function renderMantra() {
  const s = calcStats();
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dayStats = days.map(d => { const arr = trades.filter(t => t.day === d); return { day: d, ...calcStats(arr) }; });
  const bestDay = dayStats.filter(d => d.total > 0).sort((a, b) => b.wr - a.wr)[0];
  const worstDay = dayStats.filter(d => d.total > 0).sort((a, b) => a.wr - b.wr)[0];
  const second = trades.filter(t => t.attempt === '2nd');
  const secWR = second.length ? (second.filter(t => t.result === 'win').length / second.length * 100) : 50;
  const strats = [...new Set(trades.map(t => t.strategy).filter(Boolean))];
  const bestStrat = strats.map(s => { const a = trades.filter(t => t.strategy === s); return { s, wr: a.filter(t => t.result === 'win').length / a.length * 100 }; }).sort((a, b) => b.wr - a.wr)[0];
  const consWR = trades.filter(t => t.entry === 'Conservative').length ? calcStats(trades.filter(t => t.entry === 'Conservative')).wr : null;
  const items = [
    bestStrat ? `Stick to your best setup. ${bestStrat.s} has your highest win rate — let your edge do the work.` : `Wait for high-probability setups only. Quality over quantity every session.`,
    `Your 2nd attempt wins ${secWR.toFixed(0)}% of the time. Be patient after a loss — the re-entry can still work.`,
    bestDay ? `${bestDay.day} is your best day historically at ${bestDay.wr.toFixed(0)}%. Show up sharp and trust your process.` : `Log consistently. Your best day will become clear within 20–30 trades.`,
    worstDay && worstDay.wr < 50 ? `${worstDay.day} is your toughest day at ${worstDay.wr.toFixed(0)}%. Consider reducing size or sitting out.` : `Every day has an edge if you follow your rules. Discipline is the edge.`,
    consWR !== null ? `Conservative entries win ${consWR.toFixed(0)}% of the time. Wait for the clean setup — it pays more.` : `Wait for the A+ setup. If it doesn't tick every box, pass and protect your capital.`,
  ];
  document.getElementById('mantra-list').innerHTML = items.map((item, i) => `
    <div class="mantra-item"><span class="mantra-num">${i + 1}</span><span>${item}</span></div>
  `).join('');
}

function renderTradeLog() {
  const list = document.getElementById('trade-list');
  if (!trades.length) { list.innerHTML = '<p class="empty-msg">No trades yet. Add your first trade below.</p>'; return; }
  list.innerHTML = [...trades].reverse().map(t => {
    const isExp = expanded.has(t.id);
    return `<div class="trade-card" onclick="toggleExpand(${t.id})">
      <div class="trade-row">
        <div class="trade-meta">
          <span class="trade-num">#${t.id}</span>
          <span class="trade-date">${fmtDate(t.date)}</span>
          <span class="badge ${t.dir}">${t.dir}</span>
          <span class="badge ${t.result}">${t.result}</span>
          ${t.strategy ? `<span class="badge strat">${t.strategy}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="trade-r ${t.r >= 0 ? 'pos' : 'neg'}">${fmt(t.r)}R</span>
          <button class="delete-btn" onclick="event.stopPropagation();deleteTrade(${t.id})">✕</button>
        </div>
      </div>
      ${isExp ? `<div class="trade-note">
        <div class="trade-extra">${t.day || ''} · ${t.entry || ''} · ${t.attempt || ''} attempt${t.newsWeek ? ' · 📰 News week' : ''}</div>
        <div style="margin-top:5px;">${t.note || 'No note added.'}</div>
      </div>` : ''}
    </div>`;
  }).join('');
}

function toggleExpand(id) {
  if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
  if (currentTab === 'tradelog') renderTradeLog();
}

function deleteTrade(id) {
  if (!confirm('Delete trade #' + id + '?')) return;
  trades = trades.filter(t => t.id !== id);
  saveTrades();
  renderTab(currentTab);
}

function showToast() {
  const t = document.getElementById('toast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

function addTrade() {
  const date = document.getElementById('in-date').value;
  const day = document.getElementById('in-day').value;
  const dir = document.getElementById('in-dir').value;
  const result = document.getElementById('in-res').value;
  const rVal = parseFloat(document.getElementById('in-r').value);
  const strategy = document.getElementById('in-strat').value.trim();
  const entry = document.getElementById('in-entry').value;
  const attempt = document.getElementById('in-attempt').value;
  const note = document.getElementById('in-note').value.trim();
  const newsWeek = false;
  if (!date || isNaN(rVal)) { alert('Please fill in the date and R outcome.'); return; }
  const id = trades.length ? Math.max(...trades.map(t => t.id)) + 1 : 1;
  trades.push({ id, date, day, dir, result, r: rVal, strategy, entry, attempt, note, newsWeek });
  saveTrades();
  showToast();
  document.getElementById('in-r').value = '';
  document.getElementById('in-note').value = '';
  document.getElementById('in-strat').value = '';
  renderTab(currentTab);
}

const today = new Date().toISOString().split('T')[0];
document.getElementById('in-date').value = today;
const todayDay = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
const dayEl = document.getElementById('in-day');
const workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const matchingIndex = workingDays.indexOf(todayDay);
if (matchingIndex >= 0) {
  dayEl.selectedIndex = matchingIndex;
} else {
  dayEl.selectedIndex = 0;
}

loadTrades();
renderOverview();
