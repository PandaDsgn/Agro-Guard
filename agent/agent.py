"""
agent.py
Runs on whichever computer has the Arduino physically plugged in.
Reads sensor JSON lines over serial and forwards each one to the cloud
backend's /ingest endpoint. No Flask server here — this script only
pushes data out.

Setup:
    pip install -r requirements-agent.txt

    Create a file named .env in this same folder:
        CLOUD_URL=https://your-app.onrender.com
        INGEST_API_KEY=same-value-as-Render-env-var

Run:
    python3 agent.py

(No need to `export` anything each session — .env is loaded automatically.
If no .env is found, it falls back to real environment variables, then
to the localhost defaults below.)
"""

import json
import os
import time

import requests
import serial
import serial.tools.list_ports
from dotenv import load_dotenv

load_dotenv()  # reads .env sitting next to this script, if present

CLOUD_URL = os.environ.get("CLOUD_URL", "http://localhost:7860")
API_KEY = os.environ.get("INGEST_API_KEY", "change-me")
RESCAN_INTERVAL_SECONDS = 5


def try_open_serial_port():
    """Scan whatever serial ports the OS reports and try to open one."""
    for p in serial.tools.list_ports.comports():
        try:
            conn = serial.Serial(p.device, 9600, timeout=1)
            print(f"🔌 Connected to Arduino on {p.device}")
            return conn
        except (serial.SerialException, OSError):
            continue
    return None


def read_line(connection):
    """Non-blocking check for one fresh line. None = nothing new this tick."""
    if connection.in_waiting <= 0:
        return None
    line = connection.readline().decode("utf-8", errors="ignore").strip()
    if not line:
        return None
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        return None  # garbled line, not fatal


def post_reading(reading):
    try:
        r = requests.post(
            f"{CLOUD_URL}/ingest",
            json=reading,
            headers={"X-API-Key": API_KEY},
            timeout=5,
        )
        if r.status_code != 200:
            print(f"⚠️ Cloud backend rejected reading: {r.status_code} {r.text}")
    except requests.RequestException as e:
        print(f"⚠️ Could not reach cloud backend: {e}")


def main():
    print(f"Agent starting. Forwarding readings to {CLOUD_URL}/ingest")
    ser = None
    last_scan = 0.0

    while True:
        if ser is None or not ser.is_open:
            now = time.time()
            if now - last_scan >= RESCAN_INTERVAL_SECONDS:
                last_scan = now
                ser = try_open_serial_port()
                if ser is None:
                    print("⚠️ No Arduino found. Retrying in a few seconds...")
            time.sleep(1)
            continue

        try:
            reading = read_line(ser)
            if reading is not None:
                post_reading(reading)
        except (serial.SerialException, OSError):
            print("🔌 Arduino disconnected.")
            try:
                ser.close()
            except Exception:
                pass
            ser = None

        time.sleep(0.2)


if __name__ == "__main__":
    main()
