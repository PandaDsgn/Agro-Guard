import serial
import json
import joblib
import pandas as pd
import random # For simulation data
from flask import Flask, jsonify, request
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

# --- 1. LOAD ML MODEL ---
# Since you are running from the /src folder, we look for files locally
try:
    # Get the directory where app.py is located
    base_path = os.path.dirname(__file__)
    model_path = os.path.join(base_path, 'agro_guard_model.pkl')
    mapping_path = os.path.join(base_path, 'fruit_mapping.pkl')

    model = joblib.load(model_path)
    fruit_mapping = joblib.load(mapping_path)
    inv_fruit_mapping = {v: k for k, v in fruit_mapping.items()}
    print("✅ ML Model Loaded Successfully")
except Exception as e:
    print(f"❌ Error: ML Model files not found: {e}")
    print("Make sure .pkl files are inside the 'src' folder.")

# --- 2. AUTOMATIC SERIAL DETECTION ---
def find_serial_port():
    ports = ['COM3', 'COM4', 'COM5', 'COM6', '/dev/ttyUSB0', '/dev/ttyACM0']
    for port in ports:
        try:
            connection = serial.Serial(port, 9600, timeout=1)
            return connection
        except:
            continue
    return None

ser = find_serial_port()
if ser:
    print(f"🔌 Connected to Arduino on {ser.port}")
else:
    print("⚠️ No Arduino found. Operating in Simulation Mode.")

# --- 3. ANALYTICS LOGIC ---
def get_recommendation(temp, vpd, status):
    if vpd < 0.4:
        return "CRITICAL: High Mold Risk. Increase ventilation immediately."
    if temp < 2:
        return "WARNING: Frost Risk. Activate internal heaters."
    if status == "Bad":
        return "STRESS DETECTED: Parameters outside dataset safety range."
    return "Optimal conditions maintained based on historical dataset."

@app.route('/data', methods=['GET'])
def get_sensor_data():
    # Get fruit from React dropdown (default to Tomato)
    selected_fruit = request.args.get('fruit', 'Tomato')
    
    # 4. DATA ACQUISITION
    sensor_data = {}
    
    if ser and ser.in_waiting > 0:
        try:
            line = ser.readline().decode('utf-8').strip()
            sensor_data = json.loads(line)
        except:
            pass
    
    # Fallback to Simulation if no hardware is connected
    if not sensor_data:
        sensor_data = {
            "temp": random.uniform(22, 28),
            "humidity": random.uniform(80, 95),
            "inventory": 65, # Static for testing
            "light": random.randint(10, 50),
            "vpd": random.uniform(0.15, 0.4)
        }

    # 5. ML PREDICTION
    fruit_code = inv_fruit_mapping.get(selected_fruit, 0)
    features = pd.DataFrame([[
        sensor_data['temp'], 
        sensor_data['humidity'], 
        sensor_data['vpd'], 
        fruit_code
    ]], columns=['Temp', 'Humid (%)', 'VPD', 'Fruit_Code'])
    
    try:
        prediction = model.predict(features)[0]
        status = "Good" if prediction == 1 else "Bad"
    except:
        status = "Unknown (Model Error)"

    # 6. CALCULATE TIME-TO-ROT
    # Logic: 10% inventory = 1 day. If 'Bad', life drops by 60%
    base_days = round(sensor_data['inventory'] / 10, 1)
    days_remaining = base_days if status == "Good" else round(base_days * 0.4, 1)
    
    # 7. ANOMALY DETECTION (LDR Security)
    is_anomaly = True if sensor_data.get('light', 0) > 500 else False

    # 8. RESPONSE
    return jsonify({
        "temp": round(sensor_data['temp'], 1),
        "humidity": round(sensor_data['humidity'], 1),
        "inventory": sensor_data['inventory'],
        "vpd": round(sensor_data['vpd'], 2),
        "status": status,
        "days_remaining": days_remaining,
        "recommendation": get_recommendation(sensor_data['temp'], sensor_data['vpd'], status),
        "color": "#10b981" if status == "Good" else "#f59e0b",
        "is_anomaly": is_anomaly
    })

if __name__ == '__main__':
    # Using 0.0.0.0 allows other devices on the same WiFi to see the API
    app.run(host='0.0.0.0', port=5000, debug=True)