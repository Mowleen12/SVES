/**
 * SVES — Booking System
 * 6-step wizard state machine for pod journey booking.
 */

const BookingSystem = (() => {

  const state = {
    step: 1,
    origin: null,
    destination: null,
    timeSlot: null,
    podClass: null,
    bookingId: null,
    aiSuggestion: '',
  };

  const slotTimes = [
    '13:00','13:15','13:30','13:45',
    '14:00','14:15','14:30','14:45',
    '15:00','15:15','15:30','15:45',
    '16:00','16:15','16:30','16:45',
  ];

  const unavailableSlots = ['13:15','14:00','14:45','15:30'];
  const aiRecommendedSlots = ['13:30','14:15','15:45'];

  const podClasses = [
    {
      id: 'standard',
      icon: '<i data-lucide="tram-front" style="width:22px;height:22px;color:var(--cyan)"></i>',
      name: 'Standard Glide',
      details: '4 passengers \u00b7 Shared \u00b7 Open deck',
      badge: 'Included',
      badgeClass: 'badge-included',
    },
    {
      id: 'premium',
      icon: '<i data-lucide="rocket" style="width:22px;height:22px;color:var(--purple)"></i>',
      name: 'Premium Hover',
      details: '2 passengers \u00b7 Semi-private \u00b7 Climate-controlled',
      badge: 'EVENT+',
      badgeClass: 'badge-plus',
    },
    {
      id: 'executive',
      icon: '<i data-lucide="gem" style="width:22px;height:22px;color:var(--gold)"></i>',
      name: 'Executive Apex',
      details: '1 passenger \u00b7 Private capsule \u00b7 Sky lounge access',
      badge: 'ELITE',
      badgeClass: 'badge-elite',
    },
  ];


  // ── Render helpers ───────────────────────────────────────
  function _zoneSelectHtml(excludeId = null) {
    return SVES_CONFIG.ZONES.map(zone => {
      const disabled = excludeId && zone.id === excludeId ? 'style="display:none"' : '';
      const omegaClass = zone.id === 'omega' ? ' omega' : '';
      return `<div class="zone-select-card${omegaClass}" data-zone="${zone.id}" ${disabled}
                   style="--zone-color:${zone.color}"
                   onclick="BookingSystem.selectZone('${zone.id}')">
        <div class="zone-badge" style="background:${zone.color}22;color:${zone.color}">${zone.label}</div>
        <div class="zone-card-name">${zone.name}</div>
        <div class="zone-card-desc">${zone.description}</div>
        <div class="zone-card-cap" style="color:${zone.color}">Cap: ${(zone.capacity/1000).toFixed(0)}K</div>
      </div>`;
    }).join('');
  }

  function _timeSlotsHtml() {
    return slotTimes.map(t => {
      let cls = 'time-slot';
      if (unavailableSlots.includes(t)) cls += ' unavailable';
      if (aiRecommendedSlots.includes(t)) cls += ' ai-recommended';
      return `<div class="${cls}" data-time="${t}" onclick="BookingSystem.selectTime('${t}')">${t}</div>`;
    }).join('');
  }

  function _podClassHtml() {
    return podClasses.map(p =>
      `<div class="pod-class-card" data-pod="${p.id}" onclick="BookingSystem.selectPodClass('${p.id}')">
        <span class="pod-class-icon">${p.icon}</span>
        <div class="pod-class-info">
          <div class="pod-class-name">${p.name}</div>
          <div class="pod-class-details">${p.details}</div>
        </div>
        <span class="pod-class-badge">${p.badge}</span>
      </div>`
    ).join('');
  }

  function _qrSvg() {
    // Procedural QR-like pattern
    const cells = [];
    const size = 15;
    const seed = state.bookingId || 'SVES';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Corner markers
        if ((r < 3 && c < 3) || (r < 3 && c > 11) || (r > 11 && c < 3)) {
          cells.push(`<rect x="${c*7}" y="${r*7}" width="6" height="6" fill="#00F5FF"/>`);
        } else {
          const bit = ((seed.charCodeAt((r * c) % seed.length) + r + c) % 3 === 0);
          if (bit) cells.push(`<rect x="${c*7}" y="${r*7}" width="6" height="6" fill="#00F5FF" opacity="0.7"/>`);
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 105 105" class="qr-code">${cells.join('')}</svg>`;
  }

  // ── Step render ──────────────────────────────────────────
  function _renderStep(n) {
    const body = document.getElementById('wizard-body');
    const prevBtn = document.getElementById('wizard-prev');
    const nextBtn = document.getElementById('wizard-next');
    if (!body) return;

    // Update step indicators
    document.querySelectorAll('.wizard-step').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === n);
      el.classList.toggle('complete', i + 1 < n);
    });

    prevBtn.style.display = n > 1 && n < 6 ? 'inline-flex' : 'none';
    nextBtn.style.display = n < 5 ? 'inline-flex' : 'none';
    nextBtn.disabled = !_canProceed(n);

    const stepContent = {
      1: `<div class="wizard-step-title">Choose Origin Zone</div>
          <div class="wizard-step-sub">Where are you currently located in the venue?</div>
          <div class="zone-select-grid">${_zoneSelectHtml()}</div>`,

      2: `<div class="wizard-step-title">Choose Destination Zone</div>
          <div class="wizard-step-sub">Where would you like the pod to take you?</div>
          <div class="zone-select-grid">${_zoneSelectHtml(state.origin)}</div>`,

      3: `<div class="wizard-step-title">Select Departure Time</div>
          <div class="wizard-step-sub">AI-recommended slots marked ✦ — lower congestion predicted.</div>
          <div class="time-slot-grid">${_timeSlotsHtml()}</div>`,

      4: `<div class="wizard-step-title">Choose Pod Class</div>
          <div class="wizard-step-sub">Select your preferred travel experience.</div>
          <div class="pod-class-grid">${_podClassHtml()}</div>`,

      5: `<div class="wizard-step-title">AI Route Analysis</div>
          <div class="wizard-step-sub">Gemini is optimising your journey...</div>
          <div id="ai-route-panel">
            <div class="spinner" style="margin:30px auto;display:block;width:32px;height:32px"></div>
          </div>`,
    };

    body.innerHTML = stepContent[n] || '';

    // Restore selections
    if (n === 1 && state.origin)       document.querySelector(`[data-zone="${state.origin}"]`)?.classList.add('selected');
    if (n === 2 && state.destination)  document.querySelector(`[data-zone="${state.destination}"]`)?.classList.add('selected');
    if (n === 3 && state.timeSlot)     document.querySelector(`[data-time="${state.timeSlot}"]`)?.classList.add('selected');
    if (n === 4 && state.podClass)     document.querySelector(`[data-pod="${state.podClass}"]`)?.classList.add('selected');

    // Re-init Lucide icons injected via innerHTML
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // AI step
    if (n === 5) _loadAIAnalysis();
  }

  function _calcTravelTime() {
    const idx = SVES_DATASET.getCurrentIndex();
    const fromId = state.origin || 'alpha';
    const toId   = state.destination || 'beta';
    const fromD  = SVES_DATASET.getDensityAt(fromId, idx);
    const toD    = SVES_DATASET.getDensityAt(toId, idx);
    return SVES_DATASET.estimateTravelTime(fromId, toId, (fromD + toD) / 2);
  }

  async function _loadAIAnalysis() {
    const panel = document.getElementById('ai-route-panel');
    if (!panel) return;
    const srcZone = SVES_CONFIG.ZONES.find(z => z.id === state.origin);
    const dstZone = SVES_CONFIG.ZONES.find(z => z.id === state.destination);
    const suggestion = await GeminiService.getRouteInsight(srcZone?.name, dstZone?.name, state.timeSlot);
    state.aiSuggestion = suggestion;
    _updateSummary();

    panel.innerHTML = `
      <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:18px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <i data-lucide="cpu" style="width:18px;height:18px;color:#10B981;flex-shrink:0"></i>
          <span style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#10B981">Gemini Route Analysis</span>
        </div>
        <p style="font-size:0.85rem;color:#7DA8CC;line-height:1.6">${suggestion}</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="background:var(--bg-surface-2);border:1px solid var(--border-subtle);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:1.4rem;font-weight:800;color:#00F5FF;font-family:var(--font-mono)">${_calcTravelTime()}<span style="font-size:.8rem"> min</span></div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">EST. TRAVEL TIME</div>
        </div>
        <div style="background:var(--bg-surface-2);border:1px solid var(--border-subtle);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:1.4rem;font-weight:800;color:#10B981;font-family:var(--font-mono)">${Math.max(60, Math.round(100 - SVES_DATASET.getDensityAt(state.origin||'alpha', SVES_DATASET.getCurrentIndex()) * 0.35))}<span style="font-size:.8rem">/100</span></div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">EFFICIENCY SCORE</div>
        </div>
      </div>
      <div style="margin-top:16px;padding:14px;background:var(--bg-surface-2);border-radius:10px;border:1px solid var(--border-subtle)">
        <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em">OPTIMISED ROUTE PATH</div>
        <div style="display:flex;align-items:center;gap:8px;font-size:.85rem;font-weight:600">
          <span style="color:${srcZone?.color||'#00F5FF'}">${srcZone?.name||'—'}</span>
          <span style="color:var(--text-muted)">→</span>
          <span style="color:#10B981">Omega Concourse</span>
          <span style="color:var(--text-muted)">→</span>
          <span style="color:${dstZone?.color||'#8B5CF6'}">${dstZone?.name||'—'}</span>
        </div>
      </div>
      <div style="margin-top:20px;display:flex;justify-content:center">
        <button class="btn btn-primary" onclick="BookingSystem.confirm()">
          ✦ Confirm Booking
        </button>
      </div>`;

    // Re-initialise any newly injected lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function _canProceed(n) {
    if (n === 1) return !!state.origin;
    if (n === 2) return !!state.destination;
    if (n === 3) return !!state.timeSlot;
    if (n === 4) return !!state.podClass;
    return true;
  }

  function _updateSummary() {
    const srcZone = SVES_CONFIG.ZONES.find(z => z.id === state.origin);
    const dstZone = SVES_CONFIG.ZONES.find(z => z.id === state.destination);
    const podCls  = podClasses.find(p => p.id === state.podClass);

    _setText('sum-origin', srcZone?.name || '—');
    _setText('sum-dest', dstZone?.name || '—');
    _setText('sum-time', state.timeSlot || '—');
    _setText('sum-class', podCls?.name || '—');
    _setText('sum-est', `${_calcTravelTime()} min`);

    const aiBox = document.getElementById('sum-ai-text');
    if (aiBox && state.aiSuggestion) aiBox.textContent = state.aiSuggestion;
  }

  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── Public API ───────────────────────────────────────────
  return {
    init() {
      _renderStep(1);
      _updateSummary();
    },

    selectZone(zoneId) {
      if (state.step === 1) {
        state.origin = zoneId;
      } else if (state.step === 2) {
        if (zoneId === state.origin) return;
        state.destination = zoneId;
      }
      document.querySelectorAll('.zone-select-card').forEach(c => c.classList.remove('selected'));
      document.querySelector(`[data-zone="${zoneId}"]`)?.classList.add('selected');
      document.getElementById('wizard-next').disabled = !_canProceed(state.step);
      _updateSummary();
    },

    selectTime(time) {
      if (unavailableSlots.includes(time)) return;
      state.timeSlot = time;
      document.querySelectorAll('.time-slot').forEach(c => c.classList.remove('selected'));
      document.querySelector(`[data-time="${time}"]`)?.classList.add('selected');
      document.getElementById('wizard-next').disabled = false;
      _updateSummary();
    },

    selectPodClass(podId) {
      state.podClass = podId;
      document.querySelectorAll('.pod-class-card').forEach(c => c.classList.remove('selected'));
      document.querySelector(`[data-pod="${podId}"]`)?.classList.add('selected');
      document.getElementById('wizard-next').disabled = false;
      _updateSummary();
    },

    next() {
      if (state.step >= 5) return;
      state.step++;
      _renderStep(state.step);
    },

    prev() {
      if (state.step <= 1) return;
      state.step--;
      _renderStep(state.step);
    },

    confirm() {
      state.bookingId = 'SVES-' + Date.now().toString(36).toUpperCase();
      const body = document.getElementById('wizard-body');
      const srcZone = SVES_CONFIG.ZONES.find(z => z.id === state.origin);
      const dstZone = SVES_CONFIG.ZONES.find(z => z.id === state.destination);
      const podCls  = podClasses.find(p => p.id === state.podClass);

      document.querySelectorAll('.wizard-step').forEach(el => el.classList.add('complete'));
      document.getElementById('wizard-prev').style.display = 'none';
      document.getElementById('wizard-next').style.display = 'none';

      body.innerHTML = `
        <div class="booking-confirmation">
          <div class="confirm-icon"><i data-lucide="circle-check" style="width:48px;height:48px;color:var(--green)"></i></div>
          <div class="confirm-title">Booking Confirmed!</div>
          <p style="color:var(--text-muted);font-size:.85rem">Your antigravity pod is reserved</p>
          <div class="booking-id">${state.bookingId}</div>
          ${_qrSvg()}
          <div style="background:var(--bg-surface-2);border-radius:12px;padding:16px;text-align:left;margin-bottom:20px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.84rem">
              <span style="color:var(--text-muted)">From</span><span style="color:${srcZone?.color}">${srcZone?.name}</span>
              <span style="color:var(--text-muted)">To</span><span style="color:${dstZone?.color}">${dstZone?.name}</span>
              <span style="color:var(--text-muted)">Departure</span><span style="color:var(--text-primary)">${state.timeSlot}</span>
              <span style="color:var(--text-muted)">Pod Class</span><span style="color:var(--cyan)">${podCls?.name}</span>
              <span style="color:var(--text-muted)">Est. Travel</span><span style="color:var(--green)">4.2 min</span>
            </div>
          </div>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="BookingSystem.newBooking()">New Booking</button>
            <button class="btn btn-primary btn-sm"><i data-lucide="smartphone" style="width:14px;height:14px"></i> Add to App</button>
          </div>
        </div>`;

      // Re-init lucide icons in confirmation view
      if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    newBooking() {
      Object.assign(state, { step:1, origin:null, destination:null, timeSlot:null, podClass:null, bookingId:null, aiSuggestion:'' });
      _renderStep(1);
      _updateSummary();
    },
  };
})();
