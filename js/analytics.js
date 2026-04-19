/**
 * SVES — Analytics Module
 * Chart.js-powered analytics using SVES_DATASET real venue data.
 */

const AnalyticsModule = (() => {

  let crowdChart, waitChart, podStatusChart, throughputChart;
  let updateInterval = null;
  let _dsIndex = 0; // current index into SVES_DATASET profiles

  const ZONE_COLORS = SVES_CONFIG.ZONES.map(z => z.color);

  Chart.defaults.color = '#7DA8CC';
  Chart.defaults.font.family = "'Outfit', sans-serif";

  // ── Shared chart config ──────────────────────────────────
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { boxWidth: 10, padding: 16, color: '#7DA8CC', font: { size: 11 } } },
      tooltip: {
        backgroundColor: 'rgba(10,22,40,0.9)',
        borderColor: 'rgba(0,245,255,0.25)',
        borderWidth: 1,
        titleColor: '#E8F4FF',
        bodyColor: '#7DA8CC',
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
        ticks: { color: '#3D6080', font: { size: 10 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
        ticks: { color: '#3D6080', font: { size: 10 } },
        beginAtZero: true,
      },
    },
    animation: { duration: 600, easing: 'easeInOutQuart' },
  };

  // ── Time labels ──────────────────────────────────────────
  function _timeLabels(count = 10, startIdx = 0) {
    if (SVES_DATASET.EVENT_DATES && SVES_DATASET.EVENT_DATES.length > 0) {
      return SVES_DATASET.EVENT_DATES.slice(startIdx, startIdx + count).map(ts => {
        const d = new Date(ts);
        return `${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      });
    }
    return Array.from({ length: count }, (_, i) => `Event ${startIdx + i}`);
  }

  // ── Read real crowd data from dataset ────────────────────
  function _getRealCrowdSlice(startIdx, length = 10) {
    return SVES_CONFIG.ZONES.map(zone => {
      const profile = SVES_DATASET.CROWD_DENSITY_PROFILES[zone.id] || [];
      return Array.from({ length }, (_, i) => {
        const idx = Math.min(startIdx + i, profile.length - 1);
        const base = profile[idx] ?? 50;
        const noise = (Math.random() - 0.5) * 5; // ±2.5% realistic noise
        return Math.max(2, Math.min(99, Math.round(base + noise)));
      });
    });
  }

  function _getRealWaitTimes(idx) {
    return SVES_CONFIG.ZONES.map(z => {
      const density = SVES_DATASET.getDensityAt(z.id, idx);
      return parseFloat(SVES_DATASET.getWaitTime(z.id, density).toFixed(1));
    });
  }

  function _getRealThroughputSlice(startIdx, length = 10) {
    return Array.from({ length }, (_, i) => {
      return SVES_DATASET.getThroughputAt(Math.min(startIdx + i, Math.max(1, SVES_DATASET.EVENTS_COUNT - 1)));
    });
  }

  // ── Crowd Density Line Chart (real data) ─────────────────
  function initCrowdChart(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    _dsIndex = Math.max(0, SVES_DATASET.getCurrentIndex());
    const eventCount = SVES_DATASET.EVENTS_COUNT || 10;
    const startIdx = Math.max(0, _dsIndex - eventCount + 1);
    const labels = _timeLabels(eventCount, startIdx);
    const realData = _getRealCrowdSlice(startIdx, eventCount);

    const datasets = SVES_CONFIG.ZONES.map((zone, i) => ({
      label: zone.name,
      data: realData[i],
      borderColor: zone.color,
      backgroundColor: zone.color + '14',
      borderWidth: 2,
      pointRadius: 2.5,
      pointHoverRadius: 5,
      tension: 0.4,
      fill: false,
    }));

    crowdChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          legend: { ...baseOptions.plugins.legend, position: 'top' },
          title: { display: false },
        },
        scales: {
          ...baseOptions.scales,
          y: { ...baseOptions.scales.y, max: 100, ticks: { ...baseOptions.scales.y.ticks, callback: v => v + '%' } },
        },
      },
    });
  }

  // ── Wait Time Bar Chart (real data) ─────────────────────
  function initWaitChart(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const idx = SVES_DATASET.getCurrentIndex();
    const waitTimes = _getRealWaitTimes(idx);

    waitChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: SVES_CONFIG.ZONES.map(z => z.name.split(' ')[0]),
        datasets: [{
          label: 'Avg Wait Time (min)',
          data: waitTimes,
          backgroundColor: ZONE_COLORS.map(c => c + '33'),
          borderColor: ZONE_COLORS,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        ...baseOptions,
        plugins: { ...baseOptions.plugins, legend: { display: false } },
        scales: {
          ...baseOptions.scales,
          y: { ...baseOptions.scales.y, ticks: { ...baseOptions.scales.y.ticks, callback: v => v + ' min' } },
        },
      },
    });
  }

  // ── Pod Status Doughnut (driven by sim state) ────────────
  function initPodStatusChart(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Initial real-ish values: more active at event time
    podStatusChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Active', 'Docked', 'Charging', 'Maintenance'],
        datasets: [{
          data: [17, 4, 2, 1],
          backgroundColor: [
            'rgba(16,185,129,0.8)',
            'rgba(139,92,246,0.8)',
            'rgba(245,158,11,0.8)',
            'rgba(239,68,68,0.8)',
          ],
          borderColor: 'rgba(3,12,26,0.8)',
          borderWidth: 3,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, padding: 12, font: { size: 11 }, color: '#7DA8CC' } },
          tooltip: baseOptions.plugins.tooltip,
        },
        animation: { animateRotate: true, duration: 800 },
      },
    });
  }

  // ── Throughput Chart (real data) ─────────────────────────
  function initThroughputChart(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const eventCount = SVES_DATASET.EVENTS_COUNT || 10;
    const startIdx = Math.max(0, SVES_DATASET.getCurrentIndex() - eventCount + 1);
    const data = _getRealThroughputSlice(startIdx, eventCount);

    throughputChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: _timeLabels(eventCount, startIdx),
        datasets: [{
          label: 'Passengers / 5 min',
          data,
          borderColor: '#8B5CF6',
          backgroundColor: 'rgba(139,92,246,0.08)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.5,
          fill: true,
        }],
      },
      options: {
        ...baseOptions,
        plugins: { ...baseOptions.plugins, legend: { display: false } },
      },
    });
  }

  // ── Live Data Updates (real data driven) ─────────────────
  function startLiveUpdates() {
    updateInterval = setInterval(() => {
      if (!crowdChart) return;
      const eventCount = SVES_DATASET.EVENTS_COUNT || 10;
      _dsIndex = (_dsIndex + 1) % eventCount;
      SVES_DATASET._timelineIdx = _dsIndex;

      let label = `Event ${_dsIndex}`;
      if (SVES_DATASET.EVENT_DATES && SVES_DATASET.EVENT_DATES.length > 0) {
        const d = new Date(SVES_DATASET.EVENT_DATES[_dsIndex]);
        label = `${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }

      // Crowd chart — push new point
      crowdChart.data.labels.push(label);
      crowdChart.data.labels.shift();
      crowdChart.data.datasets.forEach((ds, i) => {
        const zone = SVES_CONFIG.ZONES[i];
        const realVal = SVES_DATASET.getDensityAt(zone.id, _dsIndex);
        ds.data.push(Math.round(realVal));
        ds.data.shift();
      });
      crowdChart.update('none');

      // Wait chart — recompute from real data
      if (waitChart) {
        waitChart.data.datasets[0].data = _getRealWaitTimes(_dsIndex);
        waitChart.update('none');
      }

      // Pod status — sync with simulation if available
      if (podStatusChart && window.SVES_STATE?.simulation) {
        const pods = window.SVES_STATE.simulation.getPodStates();
        const counts = ['active', 'docked', 'charging', 'maintenance'].map(s =>
          pods.filter(p => p.status === s).length);
        podStatusChart.data.datasets[0].data = counts;
        podStatusChart.update('none');
      }

      // Throughput — next real data point
      if (throughputChart) {
        const val = SVES_DATASET.getThroughputAt(_dsIndex);
        throughputChart.data.labels.push(label);
        throughputChart.data.labels.shift();
        throughputChart.data.datasets[0].data.push(val);
        throughputChart.data.datasets[0].data.shift();
        throughputChart.update('none');
      }
    }, 5000);
  }

  function stopLiveUpdates() { clearInterval(updateInterval); }

  // ── Real Prediction Table ────────────────────────────────
  async function loadPredictionTable(tableBodyId) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;

    // Use real dataset for current+predicted values
    const idx = SVES_DATASET.getCurrentIndex();
    const nextIdx = Math.min(47, idx + 12); // predict 60 min ahead (12 × 5-min)

    const predictions = await GeminiService.getCrowdPredictions(idx, nextIdx);
    const congestionLevel = v => v < 40 ? 'low' : v < 65 ? 'medium' : v < 85 ? 'high' : 'peak';
    const congestionLabel = v => v < 40 ? 'Low' : v < 65 ? 'Medium' : v < 85 ? 'High' : 'Peak';
    const trendIcon = t => t === 'rising' ? '↑' : t === 'falling' ? '↓' : '→';

    tbody.innerHTML = predictions.map((p, i) =>
      `<tr>
        <td style="color:${ZONE_COLORS[i]};font-weight:600">${p.zone}</td>
        <td style="font-family:var(--font-mono)">${p.current}%</td>
        <td style="font-family:var(--font-mono);color:${p.trend==='rising'?'#EF4444':p.trend==='falling'?'#10B981':'#F59E0B'}">
          ${trendIcon(p.trend)} ${p.predicted}%
        </td>
        <td style="font-family:var(--font-mono)">${p.wait} min</td>
        <td><span class="congestion-badge ${congestionLevel(p.predicted)}">${congestionLabel(p.predicted)}</span></td>
      </tr>`
    ).join('');
  }

  // ── Load AI Insights ─────────────────────────────────────
  async function loadInsights(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
    await new Promise(r => setTimeout(r, 900));
    const insights = await GeminiService.getAnalyticsInsights(4);
    container.innerHTML = insights.map(text =>
      `<div class="insight-item">
        <span class="insight-bullet">▸</span>
        <span>${text}</span>
      </div>`
    ).join('');
  }

  return { initCrowdChart, initWaitChart, initPodStatusChart, initThroughputChart, startLiveUpdates, stopLiveUpdates, loadPredictionTable, loadInsights };
})();
