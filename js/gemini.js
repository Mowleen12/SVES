/**
 * SVES — Gemini API Integration
 * AI-driven routing, crowd predictions, and insights.
 * Mock responses use SVES_DATASET real venue data for accuracy.
 * Falls back to structured real-data responses when no API key is set.
 */

const GeminiService = (() => {

  // ── Real-data seeded mock responses ──────────────────────
  const MOCK_ROUTE_INSIGHTS = [
    "Real-time trajectory analysis: routing via Omega Concourse reduces travel time by 34% — current alpha→omega→beta path shows 91% efficiency index.",
    "Micro-congestion detected at Beta Stand ingress (76% density). Activating Pod-Fleet-B auxiliary corridor; estimated resolution in 4.2 minutes.",
    "Predictive surge alert: Alpha Stand demand rising +23% over next 18 minutes based on historical IPL final pattern match (96.5% confidence).",
    "Gamma Stand at 92% density — exceeding UEFA safety threshold (85%). Emergency egress route via Delta corridor activated with 3 reserve pods.",
    "Fleet rebalance complete: Omega Concourse throughput increased by 18% via 4-pod redeployment from Delta Stand (33% utilisation zone).",
    "Historical match: today's ingress pattern (+3.2%/hr) aligns with MCG 2023 grand final profile — peak expected at T+45min from event start.",
  ];

  // ── Real-data seeded analytics insights ──────────────────
  const MOCK_ANALYTICS_INSIGHTS = [
    `Crowd ingress pace tracking ${(SVES_DATASET.CROWD_DENSITY_PROFILES.gamma[SVES_DATASET.getCurrentIndex()] || 89).toFixed(0)}% of Gamma Stand capacity — 7% above FIFA ingress safety guideline. Recommend activating 2 reserve pods.`,
    `Fleet battery efficiency at ${SVES_DATASET.FLEET_PERFORMANCE.batteryDegradationPerTrip}% per trip — within spec. Charging throughput: ${SVES_DATASET.FLEET_PERFORMANCE.chargingRatePerMinute}%/min per unit.`,
    `AI prediction accuracy: ${SVES_DATASET.AI_BASELINES.shortTermAccuracy.accuracy}% (30-min), ${SVES_DATASET.AI_BASELINES.mediumTermAccuracy.accuracy}% (60-min). False alarm rate: ${SVES_DATASET.AI_BASELINES.falseAlarmRate}% — below 5% industry benchmark.`,
    `Delta Stand underutilised at ${(SVES_DATASET.CROWD_DENSITY_PROFILES.delta[SVES_DATASET.getCurrentIndex()] || 33).toFixed(0)}% — 4 pods redeployed to Omega Concourse. Expected wait time reduction: 1.8 min.`,
    `Egress model loaded: ${SVES_CONFIG.VENUE.capacity.toLocaleString()} attendee egress estimated in 22 minutes at current pod throughput rate.`,
    `EM levitation field stable at ${SVES_DATASET.FLEET_PERFORMANCE.electromagnFieldStrengthHz}Hz across all ${SVES_CONFIG.PODS.count} pod units. Safety buffer maintained at ${SVES_DATASET.FLEET_PERFORMANCE.safetyBufferMs}ms minimum gap.`,
  ];

  // ── Real-data booking suggestions ────────────────────────
  function _bookingSuggestion(from, to, time, fromDensity, toDensity, avgDensity) {
    const travelTime = SVES_DATASET.estimateTravelTime(from, to, avgDensity);
    const effScore = Math.max(55, Math.round(100 - avgDensity * 0.25));
    return `Optimal route: ${from} → Omega Concourse → ${to}. Est. travel: ${travelTime} min at current ${Math.round(avgDensity)}% avg density. Efficiency score: ${effScore}/100. ${fromDensity > 80 ? `⚠ High congestion at origin (${Math.round(fromDensity)}%) — depart within 8 min for best window.` : 'Departure conditions nominal.'}`;
  }

  async function _callGemini(prompt, context = '') {
    const url = SVES_CONFIG.GEMINI_ENDPOINT; // Now points to our proxy
    
    const body = {
      model: SVES_CONFIG.GEMINI_MODEL,
      contents: [{
        parts: [{
          text: `You are the AI brain of SVES (Smart Venue Experience System), a futuristic antigravity pod transport platform for NovaSphere Arena (capacity: 80,000).
Dataset context: ${context}
Task: ${prompt}
Respond in 1-3 concise, technical, actionable sentences with specific metrics.`
        }]
      }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
    };

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch (err) {
      console.warn('[GeminiService] API call failed, using real-data mock:', err.message);
      return null;
    }
  }

  function _pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  return {
    /**
     * Route insight — uses real density data for context
     */
    async getRouteInsight(fromZone, toZone, timeSlot) {
      const idx = SVES_DATASET.getCurrentIndex();
      const fromId = SVES_CONFIG.ZONES.find(z => z.name === fromZone)?.id;
      const toId   = SVES_CONFIG.ZONES.find(z => z.name === toZone)?.id;
      const fromDensity = fromId ? SVES_DATASET.getDensityAt(fromId, idx) : 60;
      const toDensity   = toId   ? SVES_DATASET.getDensityAt(toId, idx)   : 55;
      const avgDensity  = (fromDensity + toDensity) / 2;

      const context = `Current densities — ${fromZone}: ${Math.round(fromDensity)}%, ${toZone}: ${Math.round(toDensity)}%, Omega Concourse: ${Math.round(SVES_DATASET.getDensityAt('omega', idx))}%.`;
      const prompt  = `Generate optimal antigravity pod routing from ${fromZone} to ${toZone} for time slot ${timeSlot}.`;
      const real = await _callGemini(prompt, context);
      return real || _bookingSuggestion(fromZone, toZone, timeSlot, fromDensity, toDensity, avgDensity);
    },

    /**
     * Crowd predictions — derived from real dataset future indices
     */
    async getCrowdPredictions(currentIdx, futureIdx) {
      const cidx = currentIdx ?? SVES_DATASET.getCurrentIndex();
      const fidx = futureIdx  ?? Math.min(47, cidx + 12);
      await new Promise(r => setTimeout(r, 400));

      return SVES_CONFIG.ZONES.map(z => {
        const current   = Math.round(SVES_DATASET.getDensityAt(z.id, cidx));
        const predicted = Math.round(SVES_DATASET.getDensityAt(z.id, fidx));
        const diff = predicted - current;
        const trend = diff > 3 ? 'rising' : diff < -3 ? 'falling' : 'stable';
        const wait  = SVES_DATASET.getWaitTime(z.id, current).toFixed(1);
        return { zone: z.name, current, predicted, trend, wait };
      });
    },

    /**
     * Single analytics insight
     */
    async getAnalyticsInsight() {
      const idx = SVES_DATASET.getCurrentIndex();
      const context = SVES_CONFIG.ZONES.map(z =>
        `${z.name}: ${Math.round(SVES_DATASET.getDensityAt(z.id, idx))}%`
      ).join(', ');
      const real = await _callGemini('Provide a key operational insight about current venue crowd flow.', context);
      return real || _pickRandom(MOCK_ANALYTICS_INSIGHTS);
    },

    /**
     * Multiple analytics insights (for panel)
     */
    async getAnalyticsInsights(count = 4) {
      const pool = [...MOCK_ANALYTICS_INSIGHTS];
      const insights = [];
      for (let i = 0; i < count && pool.length; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        insights.push(pool.splice(idx, 1)[0]);
      }
      return insights;
    },

    /**
     * Real-time route alert (uses current dataset state)
     */
    async getRouteAlert() {
      const idx = SVES_DATASET.getCurrentIndex();
      const busiestZone = SVES_CONFIG.ZONES.reduce((max, z) => {
        const d = SVES_DATASET.getDensityAt(z.id, idx);
        return d > (SVES_DATASET.getDensityAt(max.id, idx)) ? z : max;
      }, SVES_CONFIG.ZONES[0]);
      const density = Math.round(SVES_DATASET.getDensityAt(busiestZone.id, idx));
      const safetyZone = SVES_DATASET.getSafetyZone(density);
      const contextualAlert = `${busiestZone.name} at ${density}% capacity (${safetyZone.label}) — ${density > 85 ? 'emergency rerouting active' : 'standard routing maintained'}.`;

      const real = await _callGemini('Generate a brief real-time routing update for the ops dashboard.', contextualAlert);
      return real || _pickRandom(MOCK_ROUTE_INSIGHTS);
    },

    MOCK_ROUTE_INSIGHTS,
    MOCK_ANALYTICS_INSIGHTS,
  };
})();
