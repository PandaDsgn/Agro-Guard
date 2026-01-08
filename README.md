# 🌱 Agro-Guard AI: Smart Grain Storage System

**Agro-Guard AI** is an intelligent IoT dashboard designed to prevent post-harvest losses in grain storage. Unlike traditional monitoring systems, Agro-Guard uses **Predictive AI** and **Real-time Anomaly Detection** to forecast storage conditions and recommend preservation actions.

## 🚀 Key Features

### 1. 🧠 Predictive Inventory AI (Linear Regression)
* **What it does:** Tracks consumption rates in real-time.
* **The AI:** Uses a Linear Regression algorithm to calculate the slope of depletion ($y = mx + c$).
* **Result:** accurately predicts the exact time until the silo is empty (e.g., *"Empty in 4 hours 12 mins"*), allowing for proactive restocking.

### 2. 🛡️ Anomaly Detection Engine (Z-Score Analysis)
* **What it does:** Monitors environmental sensors for statistical outliers.
* **The AI:** Maintains a rolling window of historical data and calculates Standard Deviation ($\sigma$) and Z-Scores.
* **Result:** Triggers an immediate "Security Breach" or "Fire Risk" alert if values deviate significantly from the learned norm (Z-Score > 3), catching issues that static threshold rules miss.

### 3. 👨‍⚕️ Prescriptive Crop Doctor
* **What it does:** Analyzes Vapor Pressure Deficit (VPD) and Dew Point.
* **The Logic:** Combines sensor data to calculate complex agricultural metrics.
* **Result:** Doesn't just show data; it prescribes solutions (e.g., *"Risk of Mold detected. Open ventilation immediately to lower VPD below 0.4 kPa"*).

---

## 🛠️ Tech Stack

* **Frontend:** React.js (Vite), CSS3 (Glassmorphism UI)
* **Hardware Interface:** Web Serial API (No backend server required)
* **Algorithms:** JavaScript (Custom Linear Regression & Statistical Analysis modules)
* **Hardware:** Arduino Uno, Ultrasonic Sensor (HC-SR04), DHT11, LDR.

---

## ⚡ Getting Started

### Prerequisites
* Node.js installed on your machine.
* Arduino IDE (to upload the sketch).

### Installation
1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/Ipshita-Das/Agro-Guard.git](https://github.com/Ipshita-Das/Agro-Guard.git)
    cd Agro-Guard
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the Dashboard:**
    ```bash
    npm run dev
    ```

4.  **Connect Hardware:**
    * Connect your Arduino via USB.
    * Click the **"CONNECT INTERFACE"** button on the dashboard.
    * Select your COM port.

---

## 📸 Screenshots
