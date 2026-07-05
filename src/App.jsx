import React, { useState, useEffect } from "react";
import "./App.css";

/* ------------------------------------------------------------------ */
/*  ICONS — minimal single-stroke glyphs, no icon library dependency  */
/* ------------------------------------------------------------------ */

const IconSilo = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 9.5C6 6.5 8.7 4 12 4s6 2.5 6 5.5V19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9.5Z" />
    <path d="M6 13.5h12" />
    <path d="M6 9.5h12" />
  </svg>
);

// mode: "hardware" | "no_hardware" | "offline"
const IconSignal = ({ mode }) => {
  const opacity = mode === "hardware" ? 1 : mode === "no_hardware" ? 0.6 : 0.3;
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" opacity={opacity}>
      <rect x="3" y="14" width="4" height="7" rx="1" />
      <rect
        x="10"
        y="9"
        width="4"
        height="12"
        rx="1"
        opacity={mode === "offline" ? 0.4 : 1}
      />
      <rect
        x="17"
        y="4"
        width="4"
        height="17"
        rx="1"
        opacity={mode === "hardware" ? 1 : 0.35}
      />
    </svg>
  );
};

const IconAlert = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 9.5v4.5" />
    <circle cx="12" cy="16.7" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

const IconBanana = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5.5 16.5c3.8 2.4 10.2 1.4 13-5" />
    <path d="M18 11.2c.9-.9 2-.9 2.4.1" />
  </svg>
);

const IconOrange = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="13.2" r="6.8" />
    <path d="M12 6.4V4" />
    <path d="M12 4c1.1-.4 2-.2 2.6.5" />
  </svg>
);

const IconPineapple = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <ellipse cx="12" cy="14.5" rx="5.6" ry="6.8" />
    <path d="M8.2 9.6l7.6 9.8M15.8 9.6l-7.6 9.8" />
    <path d="M12 7.2 9.4 2.4M12 7.2l2.6-4.8M12 7.2V2" />
  </svg>
);

const IconTomato = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="14" r="6.8" />
    <path d="M12 7.2 10.1 3.4M12 7.2l1.9-3.8M12 7.2 8.7 4.8M12 7.2l3.3-2.4" />
  </svg>
);

const CROPS = [
  { id: "Banana", label: "Banana", Icon: IconBanana },
  { id: "Orange", label: "Orange", Icon: IconOrange },
  { id: "Pineapple", label: "Pineapple", Icon: IconPineapple },
  { id: "Tomato", label: "Tomato", Icon: IconTomato },
];

/* ------------------------------------------------------------------ */
/*  API BASE                                                            */
/*  Points at the always-on cloud backend (Render) by default, since    */
/*  that's what's actually reachable once this frontend is deployed.    */
/*  Override with VITE_API_BASE in a .env file if you ever point it     */
/*  somewhere else (e.g. back to localhost while developing).           */
/* ------------------------------------------------------------------ */
const API_BASE =
  import.meta.env.VITE_API_BASE || "https://agro-guard-backend.onrender.com";

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

const formatNum = (v) => {
  if (!isNum(v)) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

const polarToCartesian = (cx, cy, r, angleDeg) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const describeArc = (cx, cy, r, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

const GAUGE_START = -125;
const GAUGE_END = 125;
const GAUGE_SWEEP = GAUGE_END - GAUGE_START;

/* ------------------------------------------------------------------ */
/*  SUB-COMPONENTS                                                     */
/* ------------------------------------------------------------------ */

const ArcGauge = ({ label, sublabel, value, unit, max = 100, color }) => {
  const hasValue = isNum(value);
  // The needle/arc still needs *some* number to position itself — rest it
  // at 0 when there's no reading — but the printed readout must say "—",
  // not "0", or it looks like a real zero measurement.
  const numeric = hasValue ? value : 0;
  const pct = Math.max(0, Math.min(numeric / max, 1));
  const valueAngle = GAUGE_START + pct * GAUGE_SWEEP;
  const displayColor = hasValue ? color : "#9aa39c";
  const cx = 60,
    cy = 62,
    r = 44;

  const ticks = Array.from({ length: 11 }, (_, i) => i);

  return (
    <div className="card gauge-card">
      <div className="panel-head">
        <span className="eyebrow">{label}</span>
        <span className="panel-tag">{sublabel}</span>
      </div>
      <svg viewBox="0 0 120 132" className="gauge-svg">
        <path
          d={describeArc(cx, cy, r, GAUGE_START, GAUGE_END)}
          className="gauge-track"
        />
        {ticks.map((i) => {
          const angle = GAUGE_START + (i / 10) * GAUGE_SWEEP;
          const major = i % 5 === 0;
          const outer = polarToCartesian(cx, cy, r + 9, angle);
          const inner = polarToCartesian(cx, cy, major ? r + 1 : r + 4, angle);
          return (
            <line
              key={i}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              className="gauge-tick"
            />
          );
        })}
        {hasValue && (
          <path
            d={describeArc(cx, cy, r, GAUGE_START, valueAngle)}
            className="gauge-value-arc"
            stroke={color}
          />
        )}
        <text
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          className="gauge-readout"
          fill={displayColor}
        >
          {formatNum(value)}
        </text>
        <text
          x={cx}
          y={cy + 24}
          textAnchor="middle"
          className="gauge-unit-text"
        >
          {hasValue ? unit : "no signal"}
        </text>
      </svg>
    </div>
  );
};

const SiloSchematic = ({ value, color }) => {
  const hasValue = isNum(value);
  const pct = hasValue ? Math.max(0, Math.min(value, 100)) : 0;
  const w = 168,
    h = 232,
    x0 = 14,
    y0 = 14;
  const marks = [0, 25, 50, 75, 100];
  const fillH = (pct / 100) * h;

  return (
    <svg viewBox={`0 0 ${w + 60} ${h + 28}`} className="silo-svg">
      <rect
        x={x0}
        y={y0}
        width={w}
        height={h}
        rx="5"
        className="silo-outline"
      />
      {marks.map((m) => {
        const y = y0 + h - (m / 100) * h;
        return (
          <g key={m}>
            <line x1={x0} y1={y} x2={x0 + w} y2={y} className="silo-grid" />
            <text x={x0 + w + 10} y={y + 3} className="silo-tick-label">
              {m}
            </text>
          </g>
        );
      })}
      {hasValue && (
        <>
          <rect
            x={x0}
            y={y0 + h - fillH}
            width={w}
            height={fillH}
            fill={color}
            opacity="0.14"
            className="silo-fill"
          />
          <line
            x1={x0}
            y1={y0 + h - fillH}
            x2={x0 + w}
            y2={y0 + h - fillH}
            stroke={color}
            strokeWidth="2"
            className="silo-level-line"
          />
          <line
            x1={x0 + w}
            y1={y0 + h - fillH}
            x2={x0 + w + 6}
            y2={y0 + h - fillH}
            className="silo-leader"
          />
        </>
      )}
      {!hasValue && (
        <text
          x={x0 + w / 2}
          y={y0 + h / 2}
          textAnchor="middle"
          className="silo-tick-label"
          style={{ fontSize: "13px", opacity: 0.7 }}
        >
          NO SIGNAL
        </text>
      )}
    </svg>
  );
};

const DiagnosticPanel = ({ status, recommendation, color, fruit }) => (
  <div className="card diagnostic-card" style={{ "--accent": color }}>
    <div className="panel-head">
      <span className="eyebrow">Predictive diagnostic · ML</span>
      <span className="panel-tag">{fruit}</span>
    </div>
    <div className="diagnostic-status" style={{ color }}>
      {status || "Initializing"}
    </div>
    <p className="diagnostic-text">
      {recommendation || "No data yet. Confirm the backend service is running."}
    </p>
  </div>
);

/* ------------------------------------------------------------------ */
/*  APP                                                                 */
/* ------------------------------------------------------------------ */

function App() {
  const [data, setData] = useState({
    temp: null,
    humidity: null,
    inventory: null,
    vpd: null,
    status: "Initializing",
    days_remaining: null,
    recommendation: "Awaiting connection to sensor backend.",
    color: "#6c766f",
    is_anomaly: false,
  });

  // "hardware"    -> real Arduino data, gauges show real numbers
  // "no_hardware" -> backend is up, no Arduino found, gauges show "—"
  // "offline"     -> backend itself is unreachable
  const [connectionMode, setConnectionMode] = useState("offline");
  const [lastUpdated, setLastUpdated] = useState("—");
  const [selectedFruit, setSelectedFruit] = useState("Tomato");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE}/data?fruit=${selectedFruit}`);
        const result = await response.json();

        if (result.error) {
          setConnectionMode("offline");
        } else {
          setData(result);
          setConnectionMode(
            result.hardware_connected ? "hardware" : "no_hardware",
          );
          setLastUpdated(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error("Backend unreachable. Ensure app.py is running.");
        setConnectionMode("offline");
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [selectedFruit]);

  const connectionCopy = {
    hardware: { label: "Link established", sub: "Polling every 2s" },
    no_hardware: { label: "No sensor signal", sub: "Arduino not detected" },
    offline: { label: "Link lost", sub: "Backend unreachable" },
  }[connectionMode];

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="rail-brand">
          <span className="rail-brand-icon">
            <IconSilo />
          </span>
          <div className="rail-brand-text">
            <span className="rail-title">
              AGRO-GUARD <span className="rail-title-lite">ML</span>
            </span>
            <span className="rail-subtitle">Cold-chain instrumentation</span>
          </div>
        </div>

        <div className="rail-section">
          <div className="eyebrow rail-eyebrow">Monitored crop</div>
          <div
            className="crop-select"
            role="listbox"
            aria-label="Select monitored crop"
          >
            {CROPS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={selectedFruit === id}
                className={`crop-option${selectedFruit === id ? " is-active" : ""}`}
                onClick={() => setSelectedFruit(id)}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rail-footer">
          <div className="connection-status">
            <span className={`connection-icon is-${connectionMode}`}>
              <IconSignal mode={connectionMode} />
            </span>
            <div>
              <div className={`connection-label is-${connectionMode}`}>
                {connectionCopy.label}
              </div>
              <div className="connection-sub">{connectionCopy.sub}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        {connectionMode === "no_hardware" && (
          <div
            className="alert-row alert-row--no-hardware"
            style={{
              background: "rgba(154, 163, 156, 0.14)",
              color: "#5c655e",
              border: "1px solid rgba(154, 163, 156, 0.4)",
            }}
          >
            <IconAlert />
            <span>
              No Arduino detected — gauges are blank until a sensor connects
            </span>
          </div>
        )}

        {connectionMode === "offline" && (
          <div
            className="alert-row alert-row--offline"
            style={{
              background: "rgba(180, 60, 60, 0.1)",
              color: "#b43c3c",
              border: "1px solid rgba(180, 60, 60, 0.3)",
            }}
          >
            <IconAlert />
            <span>Backend unreachable — check that app.py is running</span>
          </div>
        )}

        {data.is_anomaly && (
          <div className="alert-row">
            <IconAlert />
            <span>
              Sensor interference detected — readings may be unreliable
            </span>
          </div>
        )}

        <header className="top-bar">
          <div>
            <div className="eyebrow">Storage status</div>
            <div className="top-status">
              <span className="status-dot" style={{ background: data.color }} />
              <strong className="top-status-text">{data.status}</strong>
            </div>
          </div>
          <div className="top-bar-meta">
            <span className="eyebrow">Last sync</span>
            <span className="mono">{lastUpdated}</span>
          </div>
        </header>

        <div className="grid">
          <section className="card silo-panel">
            <div className="panel-head">
              <span className="eyebrow">Inventory level</span>
              <span className="panel-tag">HC-SR04 · ultrasonic</span>
            </div>

            <SiloSchematic value={data.inventory} color={data.color} />

            <div className="silo-readout">
              <div className="readout-block">
                <span className="big-num">
                  {formatNum(data.inventory)}
                  <small>%</small>
                </span>
                <span className="readout-label">Fill level</span>
              </div>
              <div className="readout-divider" />
              <div className="readout-block">
                <span className="big-num" style={{ color: data.color }}>
                  {formatNum(data.days_remaining)}
                  <small> d</small>
                </span>
                <span className="readout-label">Freshness forecast</span>
              </div>
            </div>
          </section>

          <section className="metrics-col">
            <div className="gauge-row">
              <ArcGauge
                label="Thermal"
                sublabel="DHT11 · Ch.01"
                value={data.temp}
                unit="°C"
                max={50}
                color="#e0994a"
              />
              <ArcGauge
                label="Humidity"
                sublabel="DHT11 · Ch.02"
                value={data.humidity}
                unit="%"
                max={100}
                color="#4fb0ac"
              />
            </div>

            <DiagnosticPanel
              status={data.status}
              recommendation={data.recommendation}
              color={data.color}
              fruit={selectedFruit}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
