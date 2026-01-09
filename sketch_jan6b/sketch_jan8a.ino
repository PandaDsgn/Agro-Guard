#include <SimpleDHT.h>

// --- COMPONENT CONFIGURATION ---
const int pinDHT11 = 2; 
SimpleDHT11 dht11(pinDHT11);

// HC-SR04 (Sonar)
#define TRIG_PIN 9
#define ECHO_PIN 10

// LDR (Light Sensor)
#define LDR_PIN A0

// LEDs
#define LED_BLUE   3  // Power (Always ON)
#define LED_GREEN  4  // Safe (Stagnant)
#define LED_YELLOW 5  // Medium Risk (Slow Blink)
#define LED_RED    6  // Critical Risk (Rapid Blink)

// --- SETTINGS ---
// Calibrated Depth (Distance from sensor to bottom of empty box)
const int MAX_HEIGHT = 10; 
// The Dead Zone (Sensor cannot read closer than 4cm)
const int BLIND_SPOT = 4;
// Light Threshold (Adjust if security triggers too easily)
const int SECURITY_LIMIT = 400; 

void setup() {
  Serial.begin(9600);
  
  // Input Pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  // Output Pins (LEDs)
  pinMode(LED_BLUE, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);

  // Turn on POWER LED immediately (Stays on forever)
  digitalWrite(LED_BLUE, HIGH); 
  
  // Flash all LEDs once to show they work
  digitalWrite(LED_GREEN, HIGH); delay(200); digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, HIGH); delay(200); digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, HIGH); delay(200); digitalWrite(LED_RED, LOW);
  
  Serial.println("Agro-Safe System Initialized...");
}

void loop() {
  // Stability Delay (Wait for sensors)
  delay(1500); 

  // --- 1. SENSOR READINGS ---
  byte temperature = 0;
  byte humidity = 0;
  int err = SimpleDHTErrSuccess;
  
  // Read Temperature & Humidity
  if ((err = dht11.read(&temperature, &humidity, NULL)) != SimpleDHTErrSuccess) {
    return; // Skip loop if sensor fails
  }
  
  float t = (float)temperature;
  float h = (float)humidity;
  int lightLevel = analogRead(LDR_PIN);

  // --- 2. INVENTORY LOGIC (PERCENTAGE) ---
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); 
  int distance = duration * 0.034 / 2;

  // FIX: Blind Spot Handling
  if (distance > 0 && distance < BLIND_SPOT) {
    distance = 0; // Assume full if within 4cm
  }

  // Calculate Fill Height
  int heightFilled = MAX_HEIGHT - distance; 
  if (heightFilled < 0) heightFilled = 0;
  if (heightFilled > MAX_HEIGHT) heightFilled = MAX_HEIGHT;

  // Convert to Percentage (0 to 100)
  int inventoryPercent = map(heightFilled, 0, MAX_HEIGHT, 0, 100);

  // --- 3. ADVANCED MATH ---
  float svp = 0.6108 * exp((17.27 * t) / (t + 237.3));
  float vpd = svp * (1 - (h / 100.0));
  float dewPoint = t - ((100 - h) / 5);

  // --- 4. DECISION ENGINE & LEDs ---
  String statusMsg = "SAFE";
  
  // Reset Risk LEDs first
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);

  // CASE A: CRITICAL RISK (Red Rapid Blink)
  // Triggers if: Light is detected OR Frost is imminent
  if (lightLevel < SECURITY_LIMIT || t <= dewPoint + 2) { 
    if (lightLevel < SECURITY_LIMIT) statusMsg = "SECURITY_BREACH";
    else statusMsg = "FROST_RISK";
    
    // Rapid Blink (Run 5 times fast)
    for(int i=0; i<5; i++){
      digitalWrite(LED_RED, HIGH); delay(100);
      digitalWrite(LED_RED, LOW); delay(100);
    }
  }
  
  // CASE B: MEDIUM RISK (Yellow Slow Blink)
  // Triggers if: VPD is low (Mold Risk)
  else if (vpd < 0.4) {
    statusMsg = "MOLD_RISK";
    
    // Slow Blink (Run 2 times slow)
    for(int i=0; i<2; i++){
      digitalWrite(LED_YELLOW, HIGH); delay(400);
      digitalWrite(LED_YELLOW, LOW); delay(400);
    }
  } 
  
  // CASE C: SAFE (Green Solid)
  else {
    statusMsg = "SAFE";
    digitalWrite(LED_GREEN, HIGH);
  }

  // --- 5. REPORTING (JSON) ---
  Serial.print("{\"temp\":"); Serial.print(t);
  Serial.print(",\"humidity\":"); Serial.print(h);
  Serial.print(",\"inventory\":"); Serial.print(inventoryPercent);
  Serial.print(",\"vpd\":"); Serial.print(vpd);
  Serial.print(",\"dew\":"); Serial.print(dewPoint);
  Serial.print(",\"ldr\":"); Serial.print(lightLevel);
  Serial.print(",\"status\":\""); Serial.print(statusMsg); Serial.print("\"");
  Serial.println("}"); 
}