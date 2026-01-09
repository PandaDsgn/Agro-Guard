#include <SimpleDHT.h>

// --- CONFIGURATION ---
int pinDHT11 = 2; // Signal pin for DHT11
SimpleDHT11 dht11(pinDHT11);

#define TRIG_PIN 9
#define ECHO_PIN 10
#define LDR_PIN A0
#define ALARM_PIN 13

// Container dimensions (in cm) - Adjust for your bucket/box
const int MAX_HEIGHT = 11; 

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(ALARM_PIN, OUTPUT);
  
  Serial.println("Agro-Safe Sentinel (SimpleDHT) Initialized...");
}

void loop() {
  delay(2000); // Stability delay

  // 1. SENSOR READINGS (Specific to SimpleDHT library)
  byte temperature = 0;
  byte humidity = 0;
  int err = SimpleDHTErrSuccess;
  
  // This library reads into 'byte' variables directly
  if ((err = dht11.read(&temperature, &humidity, NULL)) != SimpleDHTErrSuccess) {
    Serial.print("Read DHT11 failed, err="); Serial.println(err);
    return;
  }
  
  // Convert to float for our math
  float t = (float)temperature;
  float h = (float)humidity;
  
  int lightLevel = analogRead(LDR_PIN);

  // 2. INVENTORY LOGIC
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH);
  int distance = duration * 0.034 / 2;
  
  int fillLevel = MAX_HEIGHT - distance; 

  // 3. ADVANCED MATH 
  // A. Calculate SVP (Saturation Vapor Pressure)
  float svp = 0.6108 * exp((17.27 * t) / (t + 237.3));
  float vpd = svp * (1 - (h / 100.0));
  
  // B. Calculate Dew Point 
  float dewPoint = t - ((100 - h) / 5);

// --- 4. REPORTING (MATCHING OLD FORMAT) ---
  // We use the exact same names as your old code so the server understands.
  
  Serial.print("{\"temp\":"); Serial.print(t);          // Was "t", changed back to "temp"
  Serial.print(",\"humidity\":"); Serial.print(h);      // Was "h", changed back to "humidity"
  Serial.print(",\"inventory\":"); Serial.print(fillLevel); // Was "lvl", changed back to "inventory"
  
  // These were the same, but good to double check
  Serial.print(",\"vpd\":"); Serial.print(vpd);
  Serial.print(",\"dew\":"); Serial.print(dewPoint);
  
  // EXTRA: I added 'ldr' at the end. 
  // If your server is strict, remove this line. If it's flexible, keep it for debugging.
  Serial.print(",\"ldr\":"); Serial.print(lightLevel); 
  
  Serial.println("}");
  
  // 5. DECISION ENGINE 
  // CHECK: Security
  if (lightLevel > 200) { 
    Serial.println("ALERT: SECURITY BREACH! (LDR Detected Light)");
    digitalWrite(ALARM_PIN, HIGH);
  }
  // CHECK: Spoilage 
  else if (vpd < 0.4) {
    Serial.println("WARNING: HIGH MOLD RISK (Too Damp)");
    digitalWrite(ALARM_PIN, HIGH);
  } 
  // CHECK: Frost/Stress 
  else if (t <= dewPoint + 2) { 
    Serial.println("CRITICAL: CONDENSATION/FROST IMMINENT");
    digitalWrite(ALARM_PIN, HIGH);
  } 
  else {
    Serial.println("Status: SAFE");
    digitalWrite(ALARM_PIN, LOW);
  }
  
  Serial.println("---------------------");
}