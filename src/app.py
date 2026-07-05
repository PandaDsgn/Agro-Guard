import json
import os
import time

import joblib
import pandas as pd
import serial
import serial.tools.list_ports
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- 1. LOAD ML MODEL ---
base_path = os.path.dirname(__file__)
model = None
fruit_mapping = {}
inv_fruit_mapping = {}

try:
    model_path = os.path.join(base_path, "agro_guard_model.pkl")
    mapping_path = os.path.join(base_path, "fruit_mapping.pkl")

    model = joblib.load(model_path)
    fruit_mapping = joblib.load(mapping_path)
    inv_fruit_mapping = {v: k for k, v in fruit_mapping.items()}
    print("✅ ML Model Loaded Successfully")
except Exception as e:
    print(f"❌ Error: ML Model files not found: {e}")
    print("Make sure .pkl files are inside the 'src' folder.")
    model = None


# --- 2. SERIAL CONNECTION MANAGEMENT ---
RESCAN_INTERVAL_SECONDS = 5  # avoid hammering every serial port on every 2s poll

ser = None
_last_scan_time = 0.0
_last_hardware_reading = None  # cache of the most recent REAL reading


def try_open_serial_port():
    """
    Scan whatever serial ports the OS actually reports (works the same on
    Windows COMx, Linux /dev/ttyUSB*/ttyACM*, and macOS /dev/cu.usbmodem*
    instead of guessing OS-specific names) and try to open one.
    """
    candidates = [p.device for p in serial.tools.list_ports.comports()]
    for port in candidates:
        try:
            connection = serial.Serial(port, 9600, timeout=1)
            print(f"🔌 Connected to Arduino on {port}")
            return connection
        except (serial.SerialException, OSError):
            continue
    return None


def get_serial_connection():
    """
    Returns a live serial connection if one exists or can be (re)established.
    Throttled so a missing Arduino doesn't cost us a port-scan on every request.
    """
    global ser, _last_scan_time

    if ser is not None:
        if ser.is_open:
            return ser
        ser = None  # it died since we last checked; fall through and retry

    now = time.time()
    if now - _last_scan_time < RESCAN_INTERVAL_SECONDS:
        return None  # too soon to rescan, just report "no hardware" for now

    _last_scan_time = now
    ser = try_open_serial_port()
    if ser is None:
        print("⚠️ No Arduino found. No sensor data will be reported.")
    return ser


def read_from_hardware(connection):
    """
    Non-blocking check for a fresh line from the Arduino.
    Returns:
      dict -> a new reading was parsed
      None -> connected fine, just nothing new this tick (NOT a disconnect)
    Raises serial.SerialException/OSError on a genuine disconnect, which the
    caller catches and treats as a lost connection.
    """
    if connection.in_waiting <= 0:
        return None
    line = connection.readline().decode("utf-8", errors="ignore").strip()
    if not line:
        return None
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        return None  # garbled line — not fatal, try again next poll


# --- 3. ANALYTICS LOGIC ---
def get_recommendation(temp, vpd, status):
    if vpd < 0.4:
        return "CRITICAL: High Mold Risk. Increase ventilation immediately."
    if temp < 2:
        return "WARNING: Frost Risk. Activate internal heaters."
    if status == "Bad":
        return "STRESS DETECTED: Parameters outside dataset safety range."
    return "Optimal conditions maintained based on historical dataset."


# Response shape used any time we have no real reading to report.
# No random numbers, no fake status — just an honest "nothing yet".
NO_DATA_RESPONSE = {
    "temp": None,
    "humidity": None,
    "inventory": None,
    "vpd": None,
    "status": "No Sensor Data",
    "days_remaining": None,
    "recommendation": "No Arduino detected. Connect the sensor hardware to begin monitoring.",
    "color": "#6c766f",
    "is_anomaly": False,
    "hardware_connected": False,
    "mode": "no_hardware",
}


@app.route("/data", methods=["GET"])
def get_sensor_data():
    global ser, _last_hardware_reading
    selected_fruit = request.args.get("fruit", "Tomato")

    try:
        # --- 4. DATA ACQUISITION ---
        connection = get_serial_connection()
        sensor_data = None

        if connection is not None:
            try:
                parsed = read_from_hardware(connection)
                if parsed is not None:
                    _last_hardware_reading = parsed
                sensor_data = (
                    _last_hardware_reading  # may still be None on the very first tick
                )
            except (serial.SerialException, OSError):
                # Real disconnect (unplugged, port vanished, etc.)
                try:
                    connection.close()
                except Exception:
                    pass
                ser = None
                _last_hardware_reading = None
                sensor_data = None

        if sensor_data is None:
            # No hardware, or connected but hasn't sent a first reading yet.
            # Report that plainly instead of making numbers up.
            return jsonify(dict(NO_DATA_RESPONSE))

        # --- From here on we have a REAL hardware reading ---

        # --- 5. ML PREDICTION ---
        fruit_code = inv_fruit_mapping.get(selected_fruit, 0)
        status = "Unknown (Model Error)"
        if model is not None:
            try:
                features = pd.DataFrame(
                    [
                        [
                            sensor_data["temp"],
                            sensor_data["humidity"],
                            sensor_data["vpd"],
                            fruit_code,
                        ]
                    ],
                    columns=["Temp", "Humid (%)", "VPD", "Fruit_Code"],
                )
                prediction = model.predict(features)[0]
                status = "Good" if prediction == 1 else "Bad"
            except Exception as e:
                print(f"Model prediction error: {e}")
                status = "Unknown (Model Error)"

        # --- 6. CALCULATE TIME-TO-ROT ---
        # Logic: 10% inventory = 1 day. If 'Bad', life drops by 60%
        base_days = round(sensor_data["inventory"] / 10, 1)
        days_remaining = base_days if status == "Good" else round(base_days * 0.4, 1)

        # --- 7. ANOMALY DETECTION (LDR Security) ---
        is_anomaly = sensor_data.get("light", 0) > 500

        # --- 8. RESPONSE ---
        return jsonify(
            {
                "temp": round(sensor_data["temp"], 1),
                "humidity": round(sensor_data["humidity"], 1),
                "inventory": sensor_data["inventory"],
                "vpd": round(sensor_data["vpd"], 2),
                "status": status,
                "days_remaining": days_remaining,
                "recommendation": get_recommendation(
                    sensor_data["temp"], sensor_data["vpd"], status
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7860)
