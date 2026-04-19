/**
 * SVES — Smart Venue Experience System
 * Central Configuration File
 * 
 * To enable real Gemini API responses, set your API key below.
 * Without a key, the system uses realistic simulated responses.
 */

const SVES_CONFIG = {
  // ── Gemini AI ─────────────────────────────────────────────────────────────
  // The Gemini endpoint is now securely proxied via the Node.js backend.
  // The API key must be configured as a generic environment variable (GEMINI_API_KEY) in Cloud Run.
  GEMINI_MODEL: 'gemini-2.0-flash',
  GEMINI_ENDPOINT: '/api/gemini',

  // ── Venue Details ─────────────────────────────────────────────────────────
  VENUE: {
    name: 'NovaSphere Arena',
    city: 'Neo Mumbai',
    capacity: 80000,
    activePods: 24,
    totalPods: 30,
  },

  // ── Zones (canvas coordinates for 900x540 canvas) ─────────────────────────
  ZONES: [
    {
      id: 'alpha',
      name: 'Alpha Stand',
      label: 'A',
      color: '#00F5FF',
      glow: 'rgba(0,245,255,0.5)',
      x: 450,
      y: 75,
      capacity: 18000,
      description: 'North upper tier — premium viewing',
    },
    {
      id: 'beta',
      name: 'Beta Stand',
      label: 'B',
      color: '#8B5CF6',
      glow: 'rgba(139,92,246,0.5)',
      x: 770,
      y: 270,
      capacity: 14000,
      description: 'East stand — east wing access',
    },
    {
      id: 'gamma',
      name: 'Gamma Stand',
      label: 'G',
      color: '#EC4899',
      glow: 'rgba(236,72,153,0.5)',
      x: 450,
      y: 465,
      capacity: 18000,
      description: 'South lower tier — family zone',
    },
    {
      id: 'delta',
      name: 'Delta Stand',
      label: 'D',
      color: '#F59E0B',
      glow: 'rgba(245,158,11,0.5)',
      x: 130,
      y: 270,
      capacity: 14000,
      description: 'West stand — corporate boxes',
    },
    {
      id: 'omega',
      name: 'Omega Concourse',
      label: 'Ω',
      color: '#10B981',
      glow: 'rgba(16,185,129,0.5)',
      x: 450,
      y: 270,
      capacity: 16000,
      description: 'Central hub — food, transport, services',
    },
  ],

  // ── Pod Fleet Configuration ────────────────────────────────────────────────
  PODS: {
    count: 24,
    maxPassengers: 8,
    cruiseSpeed: 45,       // km/h
    maxSpeed: 70,          // km/h
    batteryLife: 360,      // minutes
    chargingTime: 45,      // minutes
    hoverHeight: 2.5,      // meters above ground
    levitationFreq: 60,    // Hz
  },

  // ── Simulation Parameters ─────────────────────────────────────────────────
  SIMULATION: {
    tickRate: 50,        // ms per frame
    podBaseSpeed: 0.006, // canvas units per tick
    trailLength: 25,     // trail segments per pod
    densityUpdateRate: 3000, // ms between density updates
    alertRate: 8000,     // ms between alerts
  },

  // ── Service Endpoints (Cloud Run) ─────────────────────────────────────────
  SERVICES: {
    podManager:     'https://pod-manager-xxxxx-uc.a.run.app',
    queueOptimizer: 'https://queue-optimizer-xxxxx-uc.a.run.app',
    aiRouting:      'https://ai-routing-xxxxx-uc.a.run.app',
    notification:   'https://notification-xxxxx-uc.a.run.app',
    analytics:      'https://analytics-xxxxx-uc.a.run.app',
  },
};

// Freeze config to prevent accidental mutations
Object.freeze(SVES_CONFIG);
