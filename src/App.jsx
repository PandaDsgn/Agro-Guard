import React, { useState, useEffect } from 'react';
import './App.css';

// --- SUB-COMPONENTS: GAUGE & DIAGNOSTIC ---
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

const DiagnosticPanel = ({ status, recommendation, color }) => {
  return (
    <div className="card diagnostic-card" style={{ borderLeft: `4px solid ${color || '#64748b'}` }}>
      <div className="diagnostic-header">
        <div>
          <h3 className="card-title">ML PREDICTIVE DIAGNOSTIC</h3>
          <div className="diagnostic-status" style={{color: color}}>{status || "INITIALIZING..."}</div>
        </div>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{width: '100%', background: color}}></div>
      </div>
      <div className="ai-console">
        <div className="console-label">ML_ENGINE_LOG //</div>
        <div className="console-text">{recommendation || "Waiting for Python Backend..."}</div>
      </div>
    </div>
  );
};

function App() {
  // State to hold data coming from Python Flask
  const [data, setData] = useState({
    temp: 0,
    humidity: 0,
    inventory: 0,
    vpd: 0,
    status: "Offline",
    days_remaining: 0,
    recommendation: "Connect Backend",
    color: "#64748b",
    is_anomaly: false
  });

  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("Never");
  const [selectedFruit, setSelectedFruit] = useState("Tomato");

  // EFFECT: Poll the Python Backend every 2 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        // We add a query param for the selected fruit so Python knows which one to predict for
        const response = await fetch(`http://localhost:5000/data?fruit=${selectedFruit}`);
        const result = await response.json();

        if (result.error) {
          setIsConnected(false);
        } else {
          setData(result);
          setIsConnected(true);
          setLastUpdated(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error("Backend unreachable. Ensure app.py is running.");
        setIsConnected(false);
      }
    };

    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [selectedFruit]);

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"></div>
          <h1>AGRO-GUARD <span className="lite">ML</span></h1>
        </div>
        
        <nav style={{marginTop: '40px'}}>
          <div className="console-label" style={{padding: '0 15px'}}>SELECT STORAGE CROP</div>
          <select 
            value={selectedFruit} 
            onChange={(e) => setSelectedFruit(e.target.value)}
            className="btn-connect"
            style={{ background: '#1e293b', width: '90%', margin: '10px 15px', border: '1px solid var(--accent)' }}
          >
            <option value="Banana">Banana</option>
            <option value="Orange">Orange</option>
            <option value="Pineapple">Pineapple</option>
            <option value="Tomato">Tomato</option>
          </select>
        </nav>

        <div className="sidebar-footer">
          <div className={isConnected ? "badge-online" : "timestamp"}>
            {isConnected ? "● SYSTEM ONLINE" : "○ SYSTEM OFFLINE"}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {data.is_anomaly && (
          <div className="anomaly-banner">⚠️ CRITICAL ANOMALY: SENSOR INTERFERENCE DETECTED</div>
        )}

        <header className="top-bar">
          <div className="status-indicator">
            <span className="dot" style={{ backgroundColor: data.color }}></span>
            ML Prediction: <strong>{data.status}</strong>
          </div>
          <div className="timestamp">Last Update: {lastUpdated}</div>
        </header>

        <div className="dashboard-grid">
          {/* LEFT: INVENTORY */}
          <section className="card silo-section">
            <h3 className="card-title">INVENTORY (HC-SR04)</h3>
            <div className="silo-graphic">
              <div className="liquid" style={{ height: `${data.inventory}%`, background: data.color }}></div>
              <div className="silo-marks">
                <span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span>
              </div>
            </div>
            <div className="metric-overlay">
              <div className="big-number">{data.inventory}<small>%</small></div>
              <div className="forecast-box">
                <span className="label">FRESHNESS FORECAST</span>
                <span className="value" style={{color: data.color}}>{data.days_remaining} Days</span>
              </div>
            </div>
          </section>

          {/* RIGHT: SENSORS & ML */}
          <section className="metrics-column">
            <div className="gauges-row">
              <Gauge label="THERMAL (DHT11)" value={data.temp} unit="°C" max={50} color="#f59e0b" />
              <Gauge label="HUMIDITY" value={data.humidity} unit="%" max={100} color="#0ea5e9" />
            </div>
            
            <DiagnosticPanel 
              status={data.status} 
              recommendation={data.recommendation} 
              color={data.color} 
            />
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;