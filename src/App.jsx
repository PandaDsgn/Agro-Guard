import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// --- SUB-COMPONENT: Circular Gauge ---
const Gauge = ({ label, value, unit, max = 100, color = "#3b82f6" }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const rotation = (percentage * 3.6); // 360 degrees
  
  return (
    <div className="card gauge-card">
      <h3>{label}</h3>
      <div className="gauge-wrapper">
        <div 
          className="gauge-circle" 
          style={{ 
            background: `conic-gradient(${color} ${rotation}deg, #1f2937 0deg)` 
          }}
        >
          <div className="gauge-inner">
            <span className="gauge-value">{value}</span>
            <span className="gauge-unit">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
function App() {
  const [data, setData] = useState({ temp: 0, humidity: 0, inventory: 0, vpd: 0, dew: 0 });
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("Waiting...");
  const portRef = useRef(null);

  // Connection Logic
  const connectSerial = async () => {
    try {
      portRef.current = await navigator.serial.requestPort();
      await portRef.current.open({ baudRate: 9600 });
      setIsConnected(true);
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = portRef.current.readable.pipeTo(textDecoder.writable);
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
              const cleanLine = line.trim();
              if (cleanLine.startsWith('{') && cleanLine.endsWith('}')) {
                setData(JSON.parse(cleanLine));
                setLastUpdated(new Date().toLocaleTimeString());
              }
            } catch (err) { /* Ignore noise */ }
          }
        }
      }
    } catch (error) {
      console.error("Connection failed:", error);
      setIsConnected(false);
    }
  };

  // Status Logic
  const getSystemStatus = () => {
    if (!isConnected) return { text: "OFFLINE", color: "#6b7280" }; // Gray
    if (data.vpd < 0.4) return { text: "RISK: MOLD", color: "#ef4444" }; // Red
    if (data.temp <= data.dew + 2) return { text: "RISK: FROST", color: "#f59e0b" }; // Amber
    return { text: "OPTIMAL", color: "#10b981" }; // Green
  };

  const status = getSystemStatus();

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="logo-area">
          <div className="logo-icon">📡</div>
          <h1>IIC Launchpad</h1>
        </div>
        <nav>
          <button className="nav-btn active">Dashboard</button>
          <button className="nav-btn">Analytics</button>
          <button className="nav-btn">Settings</button>
        </nav>
        <div className="sidebar-footer">
          <p>Firmware v1.0</p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {/* TOP BAR */}
        <header className="top-bar">
          <div className="status-indicator">
            <span className="dot" style={{ backgroundColor: status.color }}></span>
            System Status: <strong>{status.text}</strong>
          </div>
          <div className="actions">
            <span className="timestamp">Last Update: {lastUpdated}</span>
            {!isConnected && (
              <button onClick={connectSerial} className="btn-primary">
                ⚡ Connect Device
              </button>
            )}
          </div>
        </header>

        {/* DASHBOARD GRID */}
        <div className="dashboard-grid">
          
          {/* LEFT: INVENTORY SILO */}
          <div className="card silo-card">
            <div className="card-header">
              <h2>Grain Level</h2>
              <span className="badge">{data.inventory} cm</span>
            </div>
            <div className="silo-container">
              <div className="silo-body">
                <div 
                  className="liquid" 
                  style={{ height: `${Math.min(data.inventory, 100)}%` }}
                ></div>
                <div className="measurement-lines">
                  <span>100%</span>
                  <span>75%</span>
                  <span>50%</span>
                  <span>25%</span>
                  <span>0%</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: SENSOR METRICS */}
          <div className="metrics-grid">
            <Gauge label="Temperature" value={data.temp} unit="°C" max={50} color="#f59e0b" />
            <Gauge label="Humidity" value={data.humidity} unit="%" max={100} color="#3b82f6" />
            
            {/* KPI CARDS */}
            <div className="card kpi-card">
              <h3>VPD (Vapor Pressure Deficit)</h3>
              <div className="kpi-value">
                {data.vpd} <span className="unit">kPa</span>
              </div>
              <p className="kpi-sub">Target: 0.8 - 1.2 kPa</p>
            </div>

            <div className="card kpi-card">
              <h3>Dew Point</h3>
              <div className="kpi-value">
                {data.dew} <span className="unit">°C</span>
              </div>
              <p className="kpi-sub">Condensation Threshold</p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;