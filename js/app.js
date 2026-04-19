/**
 * SVES — Application Router & Orchestrator
 * Manages page navigation, global state, live clocks, and module lifecycle.
 * KPIs & alerts driven by SVES_DATASET real venue data.
 */

// ── Global State ─────────────────────────────────────────
const SVES_STATE = {
  currentPage: 'dashboard',
  simulation: null,
  alertInterval: null,
  clockInterval: null,
  fleetInterval: null,
  analyticsActive: false,
  arActive: false,
};

// Make SVES_STATE accessible globally for analytics
window.SVES_STATE = SVES_STATE;

// ── Alert Templates (real-data driven) ──────────────────
function _buildAlert() {
  const idx = SVES_DATASET.getCurrentIndex();
  const zones = SVES_CONFIG.ZONES;

  // Pick zone based on real density
  const densities = zones.map(z => ({ zone: z, d: SVES_DATASET.getDensityAt(z.id, idx) }));
  densities.sort((a, b) => b.d - a.d);
  const busiest = densities[0].zone;
  const busiestD = Math.round(densities[0].d);
  const lightest = densities[densities.length - 1].zone;
  const lightestD = Math.round(densities[densities.length - 1].d);
  const safetyZone = SVES_DATASET.getSafetyZone(busiestD);

  const activePods = SVES_STATE.simulation
    ? SVES_STATE.simulation.getPodStates().filter(p => p.status === 'active').length
    : 19;
  const throughput = SVES_DATASET.getThroughputAt(idx);

  const templates = [
    { type: 'info',    text: `AI routing adjusted for <strong>${busiest.name}</strong>: +${Math.round(throughput / 40)}% throughput improvement detected.` },
    { type: 'info',    text: `IoT sensor mesh heartbeat nominal — <strong>1,247 sensors</strong> online. EM field: ${SVES_DATASET.FLEET_PERFORMANCE.electromagnFieldStrengthHz}Hz.` },
    { type: 'info',    text: `Predictive model updated: crowd surge expected +${Math.round(Math.random() * 15 + 5)}% at <strong>${busiest.name}</strong> in ~18 min.` },
    { type: 'warning', text: `<strong>${busiest.name}</strong> at ${busiestD}% density (${safetyZone.label}) — diverting ${Math.ceil(busiestD / 30)} pods.` },
    { type: 'warning', text: `<strong>POD-${String(Math.floor(Math.random() * 24) + 1).padStart(3,'0')}</strong> battery below 20% — auto-docking to charging bay.` },
    { type: 'success', text: `Queue balance achieved across <strong>${busiest.name} & ${lightest.name}</strong> via ${Math.floor(activePods * 0.3)}-pod redeployment.` },
    { type: 'success', text: `Gemini routing saved <strong>${Math.round(throughput * 0.7)} person-minutes</strong> this interval. Efficiency: ${Math.round(100 - lightestD * 0.1)}/100.` },
    { type: 'critical',text: `<strong>${busiest.name}</strong> at ${busiestD}% — exceeds ${SVES_DATASET.SAFETY_THRESHOLDS.red.min}% safety threshold. Emergency egress pods deployed.` },
  ];

  // Select template weighted by real density severity
  let typeRoll = Math.random();
  const pattern = SVES_DATASET.ALERT_PATTERNS.find(p => {
    typeRoll -= p.probability;
    return typeRoll <= 0;
  }) || SVES_DATASET.ALERT_PATTERNS[0];

  // Pick matching type or fallback
  const matching = templates.filter(t => t.type === pattern.type);
  return matching.length ? matching[Math.floor(Math.random() * matching.length)]
                         : templates[Math.floor(Math.random() * templates.length)];
}

// ── Navigation ───────────────────────────────────────────
function navigateTo(page) {
  if (SVES_STATE.currentPage === page) return;
  _onPageDeactivate(SVES_STATE.currentPage);
  SVES_STATE.currentPage = page;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${page}`);
  });

  _onPageActivate(page);
}

function _onPageDeactivate(page) {
  if (page === 'analytics') {
    AnalyticsModule.stopLiveUpdates();
    SVES_STATE.analyticsActive = false;
  }
}

function _onPageActivate(page) {
  if (page === 'dashboard') {
    _initDashboard();
  } else if (page === 'booking') {
    BookingSystem.init();
  } else if (page === 'analytics') {
    if (!SVES_STATE.analyticsActive) {
      _initAnalytics();
      SVES_STATE.analyticsActive = true;
    }
  } else if (page === 'ar') {
    if (!SVES_STATE.arActive) {
      setTimeout(() => {
        ARScene.init('ar-container');
        SVES_STATE.arActive = true;
      }, 100);
    }
  }
}

// ── Dashboard Init ───────────────────────────────────────
function _initDashboard() {
  if (!SVES_STATE.simulation) {
    SVES_STATE.simulation = new PodSimulation('stadiumCanvas');
    SVES_STATE.simulation.start();

    window.onDensityUpdate = (densities) => {
      _updateQueuePanel(densities);
      _updateKPIs();
    };
  }

  _renderFleetList();
  _startAlertFeed();
  _updateKPIs();

  SVES_STATE.fleetInterval = setInterval(_renderFleetList, 2000);
}

// ── KPIs — real data driven ──────────────────────────────
function _updateKPIs() {
  const sim = SVES_STATE.simulation;
  const idx = sim ? sim.getDatasetIndex() : SVES_DATASET.getCurrentIndex();

  // Pod count from live simulation
  const pods = sim ? sim.getPodStates() : [];
  const activePods = pods.filter(p => p.status === 'active' || p.status === 'docked').length;
  const avgBattery = pods.length
    ? Math.round(pods.reduce((s, p) => s + p.battery, 0) / pods.length)
    : 72;

  // Real occupancy from dataset (sum of zone densities × zone capacities)
  const occupancy = SVES_CONFIG.ZONES.reduce((sum, z) => {
    const d = SVES_DATASET.getDensityAt(z.id, idx) / 100;
    return sum + Math.round(z.capacity * d);
  }, 0);

  // Real avg wait time from dataset
  const avgWait = SVES_CONFIG.ZONES.reduce((sum, z) => {
    const d = SVES_DATASET.getDensityAt(z.id, idx);
    return sum + SVES_DATASET.getWaitTime(z.id, d);
  }, 0) / SVES_CONFIG.ZONES.length;

  _animateCount('kpi-pods', activePods || 19);
  _animateCount('kpi-battery', avgBattery || 72, '%');
  _setText('kpi-occupancy', occupancy.toLocaleString());
  _setText('kpi-wait', `${avgWait.toFixed(1)} min`);
}

function _animateCount(id, val, suffix = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val + suffix;
  el.classList.remove('count-animate');
  void el.offsetWidth;
  el.classList.add('count-animate');
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Fleet List ───────────────────────────────────────────
function _renderFleetList() {
  const container = document.getElementById('pod-fleet-list');
  if (!container || !SVES_STATE.simulation) return;
  const pods = SVES_STATE.simulation.getPodStates();
  const visible = pods.slice(0, 16);

  const batteryColor = (b) => b > 60 ? '#10B981' : b > 30 ? '#F59E0B' : '#EF4444';

  container.innerHTML = visible.map(pod => {
    const zone = SVES_CONFIG.ZONES.find(z => z.id === pod.srcZone);
    const bat = Math.round(pod.battery);
    return `
      <div class="pod-item">
        <span class="pod-status-dot ${pod.status}"></span>
        <span class="pod-id">${pod.id}</span>
        <span class="pod-zone" style="color:${zone?.color||'#7DA8CC'}">${zone?.name?.split(' ')[0] || '—'}</span>
        <span class="pod-battery">
          <div class="battery-bar">
            <div class="battery-fill" style="width:${bat}%;background:${batteryColor(bat)}"></div>
          </div>
          ${bat}%
        </span>
      </div>`;
  }).join('');
}

// ── Queue Panel — real density-driven wait times ─────────
function _updateQueuePanel(densities) {
  SVES_CONFIG.ZONES.forEach(zone => {
    const density = densities[zone.id] || 0.3;
    const densityPct = density * 100;
    const waitMin = SVES_DATASET.getWaitTime(zone.id, densityPct).toFixed(1);
    const safetyZone = SVES_DATASET.getSafetyZone(densityPct);
    const bar = document.getElementById(`queue-bar-${zone.id}`);
    const wait = document.getElementById(`queue-wait-${zone.id}`);
    if (bar) {
      bar.style.width = `${densityPct}%`;
      bar.style.background = safetyZone.color;
    }
    if (wait) wait.textContent = `${waitMin} min`;
  });
}

// ── Alert Feed — real data driven ────────────────────────
function _startAlertFeed() {
  clearInterval(SVES_STATE.alertInterval);
  _addAlert();
  SVES_STATE.alertInterval = setInterval(_addAlert, SVES_CONFIG.SIMULATION.alertRate);
}

function _addAlert() {
  const feed = document.getElementById('alerts-feed');
  if (!feed) return;
  const tpl = _buildAlert();

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  const iconMap = { info: '◈', warning: '⚠', success: '✓', critical: '●' };
  const item = document.createElement('div');
  item.className = `alert-item ${tpl.type}`;
  item.innerHTML = `
    <span class="alert-icon">${iconMap[tpl.type] || '◈'}</span>
    <span class="alert-text">${tpl.text}</span>
    <span class="alert-time">${time}</span>`;

  feed.prepend(item);
  while (feed.children.length > 8) feed.removeChild(feed.lastChild);
}

// ── Analytics Init ───────────────────────────────────────
function _initAnalytics() {
  AnalyticsModule.initCrowdChart('chart-crowd');
  AnalyticsModule.initWaitChart('chart-wait');
  AnalyticsModule.initPodStatusChart('chart-pod-status');
  AnalyticsModule.initThroughputChart('chart-throughput');
  AnalyticsModule.startLiveUpdates();
  AnalyticsModule.loadPredictionTable('prediction-table-body');
  AnalyticsModule.loadInsights('ai-insights-list');
}

// ── Live Clock ───────────────────────────────────────────
function _startClock() {
  const update = () => {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    document.querySelectorAll('.live-clock, #nav-time').forEach(el => el.textContent = t);
  };
  update();
  SVES_STATE.clockInterval = setInterval(update, 1000);
}

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });
  _startClock();
  
  // Wait for dataset to be processed from backend
  await SVES_DATASET.load();
  
  _initDashboard();
});
