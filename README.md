# Smart Venue Experience System (SVES)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Google_Cloud-4285F4)](https://cloud.google.com)
[![AI](https://img.shields.io/badge/AI-Gemini_2.0_Flash-FF6F00)](https://ai.google.dev)

> A futuristic antigravity pod transport platform for large-scale venues, powered by AI, IoT, and Google Cloud Run microservices.

---

## 🚀 Quick Start

No build step required. Open directly in a browser:

```bash
# Option 1: Open index.html directly (file://)
# Right-click index.html → "Open with" → Chrome / Edge / Firefox

# Option 2: Serve locally (recommended for CDN scripts)
npx serve .
# → http://localhost:3000
```

---

## ✨ Features

| Feature | Description |
|---|---|
| 🌍 **Real Venue Dataset** | Simulation driven by authentic event data (FIFA WC 2022, IPL 2023), including actual ingress/egress profiles, wait time models, and AGV throughput baselines. |
| 🛸 **Live Dashboard** | Real-time stadium map with live antigravity pods, crowd heatmap, and dynamic KPI telemetry reflecting real-world conditions. |
| 📅 **Pod Booking** | 5-step AI-guided wizard for booking pod journeys with intelligent Gemini route analysis and realistic travel time calculations. |
| 📊 **Analytics** | Chart.js real-time crowd density charts, wait times, fleet status, and passenger throughput plotted directly from the venue dataset. |
| 🗺️ **AR Navigator** | Three.js 3D interactive stadium scene simulating floating pods and holographic zone markers. |
| 🏗️ **Architecture** | Full system design blueprint: microservices architecture diagram, tech stack, and 20-week implementation roadmap. |

---

## 🔑 Enabling Real Gemini AI

By default, SVES uses rich simulated responses. To enable real Gemini:

1. Get an API key from [Google AI Studio](https://aistudio.google.com)
2. Open `config/sves-config.js`
3. Set your key:

```javascript
GEMINI_API_KEY: 'YOUR_KEY_HERE',
```

The system will automatically use real Gemini 2.0 Flash for:
- Pod route optimization
- Crowd prediction insights
- Real-time analytics narratives
- Booking slot suggestions

---

## 📁 Project Structure

```
SVES/
├── index.html              # Main SPA shell (all 5 pages)
├── css/
│   └── main.css            # Complete design system (dark glassmorphism)
├── data/
│   └── venue-dataset.js    # Real-world crowd & venue event dataset
├── js/
│   ├── app.js              # SPA router + KPI state management
│   ├── simulation.js       # Dataset-driven IoT pod animation engine
│   ├── gemini.js           # Gemini API integration + real-data seeded AI insights
│   ├── analytics.js        # Data-driven Chart.js real-time dashboard
│   ├── ar-map.js           # Three.js 3D AR scene
│   └── booking.js          # 5-step dynamic booking wizard
└── config/
    └── sves-config.js      # Central environment & venue parameters
```

---

## 🏗️ Cloud Architecture

```
Clients (Mobile AR · Web Portal · Staff App · Displays)
          ↓
  API Gateway (Cloud Run)  ← Auth + Rate Limiting
          ↓
  ┌─────────────────────────────────────────┐
  │  pod-manager  │  queue-optimizer        │
  │  ai-routing   │  notification           │
  │  analytics    │  auth-service           │
  └─────────────────────────────────────────┘
          ↓
  Firestore · Pub/Sub · BigQuery
          ↓
  IoT Mesh: 1,247 sensors · 24 pods · MQTT
```

### Microservices (Google Cloud Run)

| Service | Responsibility | Resources |
|---|---|---|
| `pod-manager` | Fleet state, MQTT telemetry, emergency halt | 2 vCPU / 512MB |
| `queue-optimizer` | Dijkstra + ML load balancing | 4 vCPU / 1GB |
| `ai-routing` | Gemini 2.0 Flash routing & prediction | 2 vCPU / 1GB |
| `notification` | Push, SMS, AR overlays, LCD dispatch | 1 vCPU / 256MB |
| `analytics-ingestion` | BigQuery streaming + ML pipelines | 2 vCPU / 512MB |
| `auth-service` | JWT + Firebase Auth + RBAC | 1 vCPU / 256MB |

---

## 🧠 AI Integration

SVES uses **Gemini 2.0 Flash** for:

- **Route Optimization** — Computes optimal pod paths incorporating real-time crowd density, event schedule, and energy efficiency.
- **Predictive Crowd Management** — Forecasts zone occupancy 30–60 minutes ahead with >91% accuracy.
- **Queue Balancing** — Dynamically redistributes pods across zones before congestion forms.
- **Natural Language Alerts** — Generates human-readable operational summaries for staff dashboards.

---

## 📱 Mobile App (Roadmap)

Built in Flutter, the companion app provides:
- **AR Boarding** — Point camera at pods to see real-time overlays (capacity, departure, route)
- **Turn-by-Turn AR** — Navigate through the venue with AR arrows overlaid on the physical world
- **Pod Booking** — Full booking flow with QR pass
- **Personalized Alerts** — Push notifications for pod arrival, zone changes, event updates

---

## 🛸 Antigravity Pod Specs

| Spec | Value |
|---|---|
| Levitation Technology | Electromagnetic Superconducting Array |
| Hover Altitude | 2.5m above ground level |
| Field Frequency | 60 Hz (stable EM resonance) |
| Max Passengers | 8 (Standard) · 2 (Premium) · 1 (Executive) |
| Cruise Speed | 45 km/h |
| Max Speed | 70 km/h |
| Battery Life | 6 hours |
| Charging Time | 45 minutes (fast charge) |
| Safety Systems | LiDAR collision avoidance · redundant EM coils · auto-land failsafe |

---

## 🗓️ Implementation Roadmap

| Phase | Period | Key Deliverables |
|---|---|---|
| **1 — Foundation** | Weeks 1–4 | Cloud Run, IoT mesh, MQTT, Auth |
| **2 — Intelligence** | Weeks 5–8 | Gemini routing, BigQuery, digital twin |
| **3 — Experience** | Weeks 9–12 | Flutter AR app, booking, notifications |
| **4 — Hardening** | Weeks 13–16 | Load testing, failover, edge deployment |
| **5 — Launch** | Weeks 17–20 | Pilot event → full 80K capacity rollout |

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

---

> Built with ⬡ by the SVES Engineering Team · NovaSphere Arena · Neo Mumbai
