import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { predictEmptyTime, detectAnomaly } from './ailogic';

// --- ICONS (Professional SVGs) ---
const IconWarning = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
);
const IconCheck = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
const IconDroplet = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-5-9-5-9S9 13 9 15a7 7 0 0 0 3 7z"/></svg>
);
const IconSnow = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20"/><path d="M12 2v20"/><path d="m20 2-5 5"/><path d="m4 2 5 5"/><path d="m20 22-5-5"/><path d="m4 22 5-5"/></svg>
);
const IconSun = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>
);

// --- COMPONENT: PROFESSIONAL GAUGE ---
const Gauge = ({ label, value, unit, max = 100, color = "#0ea5e9" }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const rotation = (percentage * 3.6);
  return (
    <div className="card gauge-card">
      <h3 className="card-title">{label}</h3>
      <div className="gauge-wrapper">
        <div className="gauge-circle" style={{ background: `conic-gradient(${color} ${rotation}deg, #1e293b 0deg)` }}>
          <div className="gauge-inner">
            <span className="gauge-value" style={{color: color}}>{value}</span>
            <span className="gauge-unit">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: DIAGNOSTIC PANEL (Replaces HealthCard) ---
const DiagnosticPanel = ({ vpd, temp, dew }) => {
  let status = "ANALYZING SYSTEM...";
  let color = "#64748b"; // Slate 500
  let Icon = IconCheck;
  let percentage = 50; 
  let recommendation = "Buffering environmental data streams...";

  // LOGIC ENGINE
  if (vpd < 0.4) {
    status = "CRITICAL: MOLD HAZARD";
    color = "#ef4444"; // Red
    Icon = IconDroplet;
    percentage = 15;
    recommendation = "High saturation detected. Immediate ventilation required to prevent biological spoilage.";
  } else if (vpd >= 0.4 && vpd < 0.8) {
    status = "WARNING: HIGH HUMIDITY";
    color = "#f59e0b"; // Amber
    Icon = IconWarning;
    percentage = 40;
    recommendation = "Moisture levels exceeding nominal range. Inspect for condensation.";
  } else if (vpd >= 0.8 && vpd <= 1.5) {
    status = "SYSTEM OPTIMAL";
    color = "#10b981"; // Emerald
    Icon = IconCheck;
    percentage = 95;
    recommendation = "Environmental parameters within nominal operating limits.";
  } else {
    status = "WARNING: ARID";
    color = "#3b82f6"; // Blue
    Icon = IconSun;
    percentage = 60;
    recommendation = "Vapor deficit high. Crop shrinkage risk. Seal containment.";
  }

  if (temp <= dew + 2) {
    recommendation = "CRITICAL FAILURE RISK: Frostpoint approached. Thermal intervention required.";
    status = "FROST WARNING";
    color = "#06b6d4"; // Cyan
    Icon = IconSnow;
  }

  return (
    <div className="card diagnostic-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="diagnostic-header">
        <div>
          <h3 className="card-title">CROP VIABILITY MONITOR</h3>
          <div className="diagnostic-status" style={{color: color}}>{status}</div>
        </div>
        <Icon color={color} />
      </div>
      
      <div className="progress-track">
        <div className="progress-fill" style={{width: `${percentage}%`, background: color}}></div>
      </div>
      
      <div className="ai-console">
        <div className="console-label">AI_DIAGNOSTIC_LOG //</div>
        <div className="console-text">{recommendation}</div>
      </div>
    </div>
  );
};

function App() {
  const [data, setData] = useState({ temp: 0, humidity: 0, inventory: 0, vpd: 0, dew: 0 });
  const [isConnected, setIsConnected] = useState(false);
  const [prediction, setPrediction] = useState("AWAITING DATA...");
  const [history, setHistory] = useState([]);
  const [isAnomaly, setIsAnomaly] = useState(false);
  const portRef = useRef(null);

  const connectSerial = async () => {
    try {
      portRef.current = await navigator.serial.requestPort();
      await portRef.current.open({ baudRate: 9600 });
      setIsConnected(true);
      const textDecoder = new TextDecoderStream();
      portRef.current.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop(); 
          for (const line of lines) {
            try {
              const clean = line.trim();
              if (clean.startsWith('{') && clean.endsWith('}')) {
                const packet = JSON.parse(clean);
                // Clamp inventory between 0 and 100 for display
                packet.inventory = Math.max(0, Math.min(packet.inventory, 100)); 
                setData(packet);
                
                const now = Date.now() / 1000;
                setHistory(prev => {
                  const newHist = [...prev, { x: now, y: packet.inventory, temp: packet.temp }].slice(-50);
                  setPrediction(predictEmptyTime(newHist));
                  setIsAnomaly(detectAnomaly(packet.temp, newHist.map(h => ({ val: h.temp }))));
                  return newHist;
                });
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) { console.error(e); setIsConnected(false); }
  };

  return (
    <div className="app-shell">
      {isAnomaly && <div className="anomaly-banner">⚠️ ALERT: ANOMALY DETECTED</div>}
      
      <nav className="navbar">
        <div className="brand">
          <div className="brand-icon"></div>
          <h1>AGRO-GUARD <span className="lite">AI</span></h1>
        </div>
        <div className="connection-status">
          {isConnected ? 
            <span className="badge-online">SYSTEM ONLINE</span> : 
            <button onClick={connectSerial} className="btn-connect">CONNECT INTERFACE</button>
          }
        </div>
      </nav>

      <main className="dashboard-grid">
        {/* LEFT COLUMN: SILO */}
        <section className="card silo-section">
          <h3 className="card-title">INVENTORY LEVEL</h3>
          <div className="silo-graphic">
             {/* The liquid height is based on inventory data */}
            <div className="liquid" style={{ height: `${data.inventory}%` }}></div>
            <div className="silo-marks">
              <span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span>
            </div>
          </div>
          <div className="metric-overlay">
            <div className="big-number">{data.inventory}<small>%</small></div>
            <div className="forecast-box">
              <span className="label">DEPLETION FORECAST</span>
              <span className="value">{prediction}</span>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: METRICS */}
        <section className="metrics-column">
          <div className="gauges-row">
            <Gauge label="THERMAL" value={data.temp} unit="°C" max={50} color="#f59e0b" />
            <Gauge label="HUMIDITY" value={data.humidity} unit="%" max={100} color="#0ea5e9" />
          </div>
          
          <DiagnosticPanel vpd={data.vpd} temp={data.temp} dew={data.dew} />
        </section>
      </main>
    </div>
  );
}

export default App;