/**
 * SVES — IoT Simulation Engine
 * Drives real-time pod movement on the stadium canvas.
 * Uses SVES_DATASET (venue-dataset.js) for realistic crowd density profiles.
 */

class PodSimulation {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.W = 900;
    this.H = 540;
    this.canvas.width = this.W;
    this.canvas.height = this.H;

    this.zones = SVES_CONFIG.ZONES;
    this.pods = [];
    this.densities = {};
    this.time = 0;
    this.animId = null;
    this.running = false;
    this._datasetIndex = SVES_DATASET.getCurrentIndex();

    // Pre-compute paths between zones
    this.paths = this._buildPaths();
    this._initPods();
    this._loadDatasetDensities(); // Seed initial densities from real data
  }

  _buildPaths() {
    const paths = {};
    const zs = this.zones;
    zs.forEach(a => {
      paths[a.id] = {};
      zs.forEach(b => {
        if (a.id === b.id) return;
        // Bezier control point — slightly off-center for a curved path feel
        const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 60;
        const my = (a.y + b.y) / 2 + (Math.random() - 0.5) * 60;
        paths[a.id][b.id] = { cp: { x: mx, y: my } };
      });
    });
    return paths;
  }

  _initPods() {
    const cfg = SVES_CONFIG.PODS;
    for (let i = 0; i < cfg.count; i++) {
      const zone = this.zones[Math.floor(Math.random() * this.zones.length)];
      const destZone = this._randomOtherZone(zone.id);
      // Real-data: slightly more pods charging pre-event, fewer at peak
      const statusRoll = Math.random();
      const status = statusRoll < 0.08 ? 'charging' : statusRoll < 0.12 ? 'maintenance' : 'active';

      this.pods.push({
        id: `POD-${String(i + 1).padStart(3, '0')}`,
        x: zone.x + (Math.random() - 0.5) * 50,
        y: zone.y + (Math.random() - 0.5) * 50,
        t: Math.random(),            // Progress along current path (0–1)
        srcZone: zone.id,
        dstZone: status === 'active' ? destZone.id : zone.id,
        battery: 45 + Math.random() * 50, // 45–95% — based on fleet performance data
        passengers: Math.floor(Math.random() * (SVES_CONFIG.PODS.maxPassengers + 1)),
        speed: SVES_CONFIG.SIMULATION.podBaseSpeed * (0.7 + Math.random() * 0.6),
        color: zone.color,
        status,
        trail: [],
        dockedTimer: status !== 'active' ? Infinity : 0,
        selected: false,
        tripCount: Math.floor(Math.random() * 8), // trips already completed this session
      });
    }
  }

  _randomOtherZone(excludeId) {
    // Weight zone selection by real-data density (busier zones attract more pods)
    const others = this.zones.filter(z => z.id !== excludeId);
    const weights = others.map(z => Math.max(0.1, (this.densities[z.id] || 0.4)));
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * totalWeight;
    for (let i = 0; i < others.length; i++) {
      r -= weights[i];
      if (r <= 0) return others[i];
    }
    return others[others.length - 1];
  }

  // Seed initial densities from real event dataset
  _loadDatasetDensities() {
    this.zones.forEach(z => {
      const raw = SVES_DATASET.getDensityAt(z.id, this._datasetIndex);
      this.densities[z.id] = raw / 100; // normalise to 0–1
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this._update();
      this._render();
      this.animId = requestAnimationFrame(loop);
    };
    loop();

    // ── Real-data density progression ──────────────────────────────────────
    // Every 3s, advance by ~0.5 real data points (2.5 min of event time per 3s of sim)
    // This gives a realistic event progression feel
    this._densityInterval = setInterval(() => {
      // Slowly advance the dataset index through the available historical events
      const eventCount = SVES_DATASET.EVENTS_COUNT || 10;
      this._datasetIndex = (this._datasetIndex + 0.03) % eventCount;
      const idx = Math.floor(this._datasetIndex);

      this.zones.forEach(z => {
        const realTarget = SVES_DATASET.getDensityAt(z.id, idx) / 100;
        // Smooth transition: blend 15% toward the real target per tick
        const current = this.densities[z.id] || 0.3;
        this.densities[z.id] = current + (realTarget - current) * 0.15;
      });

      if (typeof window.onDensityUpdate === 'function') {
        window.onDensityUpdate(this.densities);
      }
    }, SVES_CONFIG.SIMULATION.densityUpdateRate);
  }

  stop() {
    this.running = false;
    clearInterval(this._densityInterval);
    if (this.animId) cancelAnimationFrame(this.animId);
  }

  _update() {
    this.time++;
    const congestionFactor = this._avgDensity(); // 0–1

    this.pods.forEach(pod => {
      if (pod.status !== 'active') return;

      // Congestion slows pods (based on FLEET_PERFORMANCE.peakEfficiencyKmh)
      const speedMod = 1 - congestionFactor * 0.3;
      pod.t += pod.speed * speedMod;

      if (pod.t >= 1) {
        // Arrived at destination
        pod.t = 0;
        pod.srcZone = pod.dstZone;
        const src = this.zones.find(z => z.id === pod.srcZone);
        pod.x = src.x + (Math.random() - 0.5) * 20;
        pod.y = src.y + (Math.random() - 0.5) * 20;
        pod.color = src.color;
        pod.passengers = Math.floor(Math.random() * (SVES_CONFIG.PODS.maxPassengers + 1));
        // Real data: battery drain per trip from FLEET_PERFORMANCE
        const drain = SVES_DATASET.FLEET_PERFORMANCE.batteryDegradationPerTrip * (0.8 + Math.random() * 0.4);
        pod.battery = Math.max(8, pod.battery - drain);
        pod.trail = [];
        pod.tripCount = (pod.tripCount || 0) + 1;

        // Low battery → charging instead of redock
        if (pod.battery < 20) {
          pod.status = 'charging';
          pod.dockedTimer = Math.ceil((80 - pod.battery) / SVES_DATASET.FLEET_PERFORMANCE.chargingRatePerMinute) * 20; // frames
        } else {
          pod.dockedTimer = 60 + Math.floor(Math.random() * 80);
          pod.status = 'docked';
        }
      }

      if (pod.status === 'docked') {
        pod.dockedTimer--;
        if (pod.dockedTimer <= 0) {
          pod.dstZone = this._randomOtherZone(pod.srcZone).id;
          pod.status = 'active';
        }
        return;
      }

      // Bezier interpolation
      const src = this.zones.find(z => z.id === pod.srcZone);
      const dst = this.zones.find(z => z.id === pod.dstZone);
      if (!src || !dst) return;
      const cp = this.paths[pod.srcZone]?.[pod.dstZone]?.cp || { x: (src.x + dst.x) / 2, y: (src.y + dst.y) / 2 };

      const t = pod.t;
      const mt = 1 - t;
      pod.x = mt * mt * src.x + 2 * mt * t * cp.x + t * t * dst.x;
      pod.y = mt * mt * src.y + 2 * mt * t * cp.y + t * t * dst.y;

      // Trail
      pod.trail.push({ x: pod.x, y: pod.y });
      if (pod.trail.length > SVES_CONFIG.SIMULATION.trailLength) pod.trail.shift();
    });

    // Auto-recover charging pods
    this.pods.forEach(pod => {
      if (pod.status === 'charging') {
        pod.battery = Math.min(95, pod.battery + SVES_DATASET.FLEET_PERFORMANCE.chargingRatePerMinute / (60000 / SVES_CONFIG.SIMULATION.densityUpdateRate));
        if (pod.battery >= 75) {
          pod.status = 'docked';
          pod.dockedTimer = 40 + Math.floor(Math.random() * 40);
        }
      }
    });
  }

  _avgDensity() {
    const vals = Object.values(this.densities);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0.5;
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    this._drawStadiumBase(ctx);
    this._drawHeatmap(ctx);
    this._drawZones(ctx);
    this._drawPaths(ctx);
    this._drawPods(ctx);
    this._drawHUD(ctx);
  }

  _drawStadiumBase(ctx) {
    const cx = this.W / 2, cy = this.H / 2;
    const rx = this.W * 0.44, ry = this.H * 0.44;

    // Outer glow
    const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    radGrad.addColorStop(0, 'rgba(13, 27, 46, 0.9)');
    radGrad.addColorStop(0.6, 'rgba(8, 18, 35, 0.95)');
    radGrad.addColorStop(1, 'rgba(2, 8, 16, 0.98)');

    ctx.save();
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 20, ry + 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stadium boundary
    ctx.shadowColor = '#00F5FF';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(0,245,255,0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Structural Rings (Distinct Concourse Levels)
    const rings = [0.85, 0.65, 0.5];
    rings.forEach(scaler => {
      ctx.strokeStyle = 'rgba(0,245,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * scaler, ry * scaler, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Transit Lanes (Dashed Pod Vectors)
    const lanes = [0.75, 0.58];
    lanes.forEach((scaler, i) => {
      ctx.save();
      ctx.strokeStyle = i === 0 ? 'rgba(139,92,246,0.3)' : 'rgba(236,72,153,0.3)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * scaler, ry * scaler, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // Hex Grid / Radial Sectors
    ctx.strokeStyle = 'rgba(0,245,255,0.05)';
    ctx.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
      ctx.stroke();
      ctx.restore();
    }

    // Playing field (Inner structural boundary)
    ctx.fillStyle = 'rgba(16,185,129,0.05)';
    ctx.strokeStyle = 'rgba(16,185,129,0.4)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(16,185,129,0.5)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.35, ry * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center focal point
    ctx.fillStyle = 'rgba(16,185,129,0.6)';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawHeatmap(ctx) {
    this.zones.forEach(zone => {
      const density = this.densities[zone.id] || 0.3;
      // Safety-zone colour based on real thresholds
      const safetyZone = SVES_DATASET.getSafetyZone(density * 100);
      const radius = 90 + density * 60;
      const grad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, radius);
      const alpha = density * 0.30;
      grad.addColorStop(0, this._hexToRgba(safetyZone.color, alpha));
      grad.addColorStop(0.5, this._hexToRgba(safetyZone.color, alpha * 0.5));
      grad.addColorStop(1, this._hexToRgba(safetyZone.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  _drawZones(ctx) {
    this.zones.forEach(zone => {
      const density = this.densities[zone.id] || 0.3;
      const safetyZone = SVES_DATASET.getSafetyZone(density * 100);
      const displayColor = density > 0.85 ? safetyZone.color : zone.color;

      // Zone circle
      ctx.save();
      ctx.shadowColor = zone.glow;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = displayColor;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5 + density * 0.4;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, 38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.restore();

      // Zone label badge
      ctx.save();
      ctx.fillStyle = 'rgba(2,8,16,0.75)';
      ctx.strokeStyle = displayColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(zone.x - 22, zone.y - 14, 44, 28, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = displayColor;
      ctx.font = 'bold 11px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zone.label, zone.x, zone.y);
      ctx.restore();

      // Zone name above
      ctx.save();
      ctx.fillStyle = displayColor;
      ctx.globalAlpha = 0.9;
      ctx.font = '10px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(zone.name.toUpperCase(), zone.x, zone.y - 44);
      ctx.restore();

      // HUD Data Board below zone
      const hudW = 64, hudH = 32;
      const hx = zone.x - hudW / 2, hy = zone.y + 44;
      
      // HUD Background
      ctx.save();
      ctx.fillStyle = 'rgba(6,12,24,0.85)';
      ctx.strokeStyle = displayColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(hx, hy, hudW, hudH, 4);
      ctx.fill();
      ctx.stroke();

      // Density % and raw count
      const pct = Math.round(density * 100);
      const capacity = Math.round(density * 16000); // approx max zone capacity
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px "Space Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${pct}%`, hx + 6, hy + 6);

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '8px "Outfit", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${capacity.toLocaleString()}`, hx + hudW - 6, hy + 7);

      // Embedded Health Bar
      const barW = hudW - 12, barH = 4;
      const bx = hx + 6, by = hy + 20;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.roundRect(bx, by, barW, barH, 2);
      ctx.fill();
      
      ctx.fillStyle = displayColor;
      ctx.shadowColor = displayColor;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect(bx, by, barW * density, barH, 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.restore();
    });
  }

  _drawPaths(ctx) {
    // Persistent Glowing Transit Tracks between interconnected zones
    const drawnPairs = new Set();
    this.pods.forEach(pod => {
      if (pod.srcZone === pod.dstZone) return;
      
      const key = [pod.srcZone, pod.dstZone].sort().join('-');
      if (drawnPairs.has(key)) return;
      drawnPairs.add(key);

      const src = this.zones.find(z => z.id === pod.srcZone);
      const dst = this.zones.find(z => z.id === pod.dstZone);
      if (!src || !dst) return;
      
      // Calculate dynamic control point for curved path
      const cp = this.paths[pod.srcZone]?.[pod.dstZone]?.cp || { x: (src.x + dst.x) / 2, y: (src.y + dst.y) / 2 };

      ctx.save();
      
      // Outer track glow
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.05)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.quadraticCurveTo(cp.x, cp.y, dst.x, dst.y);
      ctx.stroke();

      // Inner neon pulse line
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.quadraticCurveTo(cp.x, cp.y, dst.x, dst.y);
      ctx.stroke();
      
      ctx.restore();
    });
  }
  _drawPods(ctx) {
    this.pods.forEach(pod => {
      if (pod.status === 'charging' || pod.status === 'maintenance') return;

      // Draw tapered hyper-speed trail
      if (pod.trail.length > 2) {
        ctx.save();
        for (let i = 1; i < pod.trail.length; i++) {
          const alpha = (i / pod.trail.length) * 0.6;
          ctx.strokeStyle = this._hexToRgba(pod.color, alpha);
          ctx.lineWidth = 2.5 * (i / pod.trail.length);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(pod.trail[i - 1].x, pod.trail[i - 1].y);
          ctx.lineTo(pod.trail[i].x, pod.trail[i].y);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      // Calculate velocity angle for directional pointing
      let angle = 0;
      if (pod.trail.length > 1 && pod.status === 'active') {
        const last = pod.trail[pod.trail.length - 2];
        angle = Math.atan2(pod.y - last.y, pod.x - last.x);
      }

      ctx.translate(pod.x, pod.y);
      ctx.rotate(angle);

      // Pod Capsule Body (Rotated towards destination)
      ctx.shadowColor = pod.color;
      ctx.shadowBlur = pod.status === 'docked' ? 8 : 18;
      
      // Capsule Gradient
      const grad = ctx.createLinearGradient(-6, 0, 6, 0);
      grad.addColorStop(0, this._hexToRgba(pod.color, 0.4));
      grad.addColorStop(0.5, pod.color);
      grad.addColorStop(1, '#ffffff');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      if (pod.status === 'docked') {
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
      } else {
        // Draw directional chevron/capsule
        ctx.moveTo(8, 0); // nose
        ctx.lineTo(-6, 4); // bottom rear
        ctx.lineTo(-4, 0); // engine indent
        ctx.lineTo(-6, -4); // top rear
        ctx.closePath();
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Passenger capacity dot
      if (pod.passengers > 0 && pod.status === 'active') {
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    });
  }

  _drawHUD(ctx) {
    // Timestamp
    ctx.save();
    ctx.fillStyle = 'rgba(0,245,255,0.6)';
    ctx.font = '10px "Space Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`LIVE • ${new Date().toLocaleTimeString()}`, this.W - 12, 12);
    ctx.restore();

    // Active pod count
    const activePods = this.pods.filter(p => p.status === 'active').length;
    ctx.save();
    ctx.fillStyle = 'rgba(16,185,129,0.7)';
    ctx.font = '10px "Space Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`⬡ ${activePods} PODS ACTIVE`, this.W - 12, 26);
    ctx.restore();

    // Dataset index progress bar
    const prog = this._datasetIndex / 47;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.roundRect(12, 12, 120, 4, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,245,255,0.35)';
    ctx.beginPath();
    ctx.roundRect(12, 12, 120 * prog, 4, 2);
    ctx.fill();
    ctx.restore();
  }

  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /** Returns current pod state for external consumers (fleet list, etc.) */
  getPodStates() { return this.pods; }
  getDensities() { return this.densities; }
  getDatasetIndex() { return Math.floor(this._datasetIndex); }
}
