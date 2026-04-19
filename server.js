import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import csv from 'csv-parser';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// ── In-Memory Dataset Processing ───────────────────────────────────────────
let processedDataset = null;

async function loadAndProcessDataset() {
  const events = [];
  const clusters = [];
  
  // 1. Load Event Metadata
  const metadataPath = path.join(__dirname, 'data', 'venue_dataset', 'event_metadata.csv');
  await new Promise((resolve) => {
    fs.createReadStream(metadataPath)
      .pipe(csv())
      .on('data', (data) => events.push(data))
      .on('end', resolve);
  });
  
  // Sort events chronologically by Timestamp
  events.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
  
  // 2. Load Seat Clusters
  const clustersPath = path.join(__dirname, 'data', 'venue_dataset', 'seat_clusters.csv');
  await new Promise((resolve) => {
    fs.createReadStream(clustersPath)
      .pipe(csv())
      .on('data', (data) => clusters.push(data))
      .on('end', resolve);
  });

  // Map 50 clusters to exactly 5 zones: (C01-C10 -> alpha, C11-C20 -> beta, etc.)
  const clusterToZoneMap = (seatId) => {
    const num = parseInt(seatId.replace('C', ''), 10);
    if (num <= 10) return 'alpha';
    if (num <= 20) return 'beta';
    if (num <= 30) return 'gamma';
    if (num <= 40) return 'delta';
    return 'omega';
  };

  const PROFILES = { alpha: [], beta: [], gamma: [], delta: [], omega: [] };
  const DATES = [];
  const METADATA = [];

  // For each event chronologically, aggregate the zones
  events.forEach(event => {
    DATES.push(event.Timestamp);
    METADATA.push(event);

    const eventClusters = clusters.filter(c => c.Event_ID === event.Event_ID);
    
    // Aggregators for this event
    const zonePop = { alpha: 0, beta: 0, gamma: 0, delta: 0, omega: 0 };
    const zoneCap = { alpha: 0, beta: 0, gamma: 0, delta: 0, omega: 0 };

    eventClusters.forEach(c => {
      const z = clusterToZoneMap(c.Seat_ID);
      zonePop[z] += parseInt(c.People_Count) || 0;
      zoneCap[z] += parseInt(c.Zone_Capacity) || 1000;
    });

    // Calculate percentage density per zone
    Object.keys(PROFILES).forEach(z => {
      let density = (zoneCap[z] > 0) ? (zonePop[z] / zoneCap[z]) * 100 : 50;
      // Normalise based on expected attendance to fit SVES model logic (so it's not all ~10%).
      // We will apply a scaler since the base dataset people counts are raw gate readings vs holistic event density.
      // Scaling by a factor to make the simulation look visually active based on real dataset event total bounds
      let scaledDensity = Math.min(99, density * 5); 
      PROFILES[z].push(Math.round(scaledDensity));
    });
  });

  processedDataset = {
    CROWD_DENSITY_PROFILES: PROFILES,
    EVENT_DATES: DATES,
    EVENTS_COUNT: events.length,
    METADATA: METADATA
  };
  
  console.log('[Dataset Processed] Events loaded:', events.length);
}

// Ensure the dataset is loaded before fulfilling requests
loadAndProcessDataset().catch(console.error);

// ── API Endpoints ──────────────────────────────────────────────────────────

app.get('/api/dataset', (req, res) => {
  if (!processedDataset) return res.status(503).json({ error: 'Dataset processing' });
  res.json(processedDataset);
});

// Proxy endpoint for Gemini API
app.post('/api/gemini', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  const model = req.body.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const geminiBody = { ...req.body };
  delete geminiBody.model; 

  try {
    const fetchResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });
    
    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      return res.status(fetchResponse.status).send(errorText);
    }

    const data = await fetchResponse.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to communicate with Google Gemini API.' });
  }
});

// Serve frontend static assets from the current directory
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SVES Server running on http://localhost:${PORT}`);
});
