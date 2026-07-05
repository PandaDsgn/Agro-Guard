"""
server.py
Cloud-deployed backend for Agro-Guard (Render, etc.).

This process never talks to a serial port. It just:
  1. Accepts sensor readings POSTed by agent.py (running on whatever
     computer has the Arduino plugged in) at /ingest.
  2. Serves the latest reading + ML prediction to the frontend at /data.

If no reading has arrived recently, /data reports "No Sensor Data" instead
of guessing — same honesty rule as the original local app.py.
"""

import os
import threading
import time

import joblib
import pandas as pd
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()  # only matters for local testing; Render sets real env vars

app = Flask(__name__)
CORS(app)

# --- 1. LOAD ML MODEL ---
base_path = os.path.dirname(__file__)
model = None
fruit_mapping = {}
inv_fruit_mapping = {}

try:
    model = joblib.load(os.path.join(base_path, "agro_guard_model.pkl"))
    fruit_mapping = joblib.load(os.path.join(base_path, "fruit_mapping.pkl"))
    inv_fruit_mapping = {v: k for k, v in fruit_mapping.items()}
    print("✅ ML Model Loaded Successfully")
except Exception as e:
    print(f"❌ Error loading ML model files: {e}")
    model = None

# --- 2. SHARED SECRET ---
# Set INGEST_API_KEY as an env var on Render, and use the SAME value in
# agent.py's INGEST_API_KEY. Stops randoms from posting fake readings to
# your public /ingest endpoint.
INGEST_API_KEY = os.environ.get("INGEST_API_KEY", "change-me")

# --- 3. LATEST-READING CACHE ---
# Single in-memory reading is enough here: only one agent posts at a time.
# IMPORTANT: deploy with a single worker (see requirements/start command
# notes) so this cache is shared correctly — multiple gunicorn workers
# would each keep their own copy and /data could flicker to "no signal".
STALE_AFTER_SECONDS = 8  # agent posts every ~2s; this covers a couple of misses

_lock = threading.Lock()
_latest_reading = None
_latest_reading_at = 0.0


@app.route("/ingest", methods=["POST"])
def ingest():
    """Called by agent.py, running next to the actual Arduino."""
    global _latest_reading, _latest_reading_at

    if request.headers.get("X-API-Key") != INGEST_API_KEY:
        return jsonify({"error": "unauthorized"}), 401

    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"error": "bad payload"}), 400

    with _lock:
        _latest_reading = payload
        _latest_reading_at = time.time()

    return jsonify({"ok": True})


# --- 4. ANALYTICS LOGIC (unchanged from the original app.py) ---
def get_recommendation(temp, vpd, status):
    if vpd < 0.4:
        return "CRITICAL: High Mold Risk. Increase ventilation immediately."
    if temp < 2:
        return "WARNING: Frost Risk. Activate internal heaters."
    if status == "Bad":
        return "STRESS DETECTED: Parameters outside dataset safety range."
    return "Optimal conditions maintained based on historical dataset."


NO_DATA_RESPONSE = {
    "temp": None,
    "humidity": None,
    "inventory": None,
    "vpd": None,
    "status": "No Sensor Data",
    "days_remaining": None,
    "recommendation": "No agent reporting in. Run agent.py next to your Arduino.",
    "color": "#6c766f",
    "is_anomaly": False,
    "hardware_connected": False,
    "mode": "no_hardware",
}


@app.route("/data", methods=["GET"])
def get_sensor_data():
    selected_fruit = request.args.get("fruit", "Tomato")

    with _lock:
        reading = _latest_reading
        age = (time.time() - _latest_reading_at) if reading else None

    if reading is None or age > STALE_AFTER_SECONDS:
        return jsonify(dict(NO_DATA_RESPONSE))

    try:
        fruit_code = inv_fruit_mapping.get(selected_fruit, 0)
        status = "Unknown (Model Error)"

        if model is not None:
            features = pd.DataFrame(
                [[reading["temp"], reading["humidity"], reading["vpd"], fruit_code]],
                columns=["Temp", "Humid (%)", "VPD", "Fruit_Code"],
            )
            prediction = model.predict(features)[0]
            status = "Good" if prediction == 1 else "Bad"

        base_days = round(reading["inventory"] / 10, 1)
        days_remaining = base_days if status == "Good" else round(base_days * 0.4, 1)
        is_anomaly = reading.get("light", 0) > 500

        return jsonify(
            {
                "temp": round(reading["temp"], 1),
                "humidity": round(reading["humidity"], 1),
                "inventory": reading["inventory"],
                "vpd": round(reading["vpd"], 2),
                "status": status,
                "days_remaining": days_remaining,
                "recommendation": get_recommendation(
                    reading["temp"], reading["vpd"], status
                ),
                "color": "#10b981" if status == "Good" else "#f59e0b",
                "is_anomaly": is_anomaly,
                "hardware_connected": True,
                "mode": "hardware",
            }
        )
    except Exception as e:
        print(f"❌ /data error: {e}")
        return jsonify(
            {"error": str(e), "hardware_connected": False, "mode": "offline"}
        ), 500


@app.route("/", methods=["GET"])
def health():
    # Render (and you) can hit this to confirm the service is alive.
    return jsonify({"status": "ok", "model_loaded": model is not None})


if __name__ == "__main__":
    # Render sets PORT for you; 7860 is just the local fallback.
    port = int(os.environ.get("PORT", 7860))
    app.run(host="0.0.0.0", port=port)
