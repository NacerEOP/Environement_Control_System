/*
  CropCare ESP32 → XAMPP (PHP) → Dashboard

  Capteurs:
  - DHT11 (température + humidité air)
  - Capteur humidité sol résistif (analogique)
  - BH1750 (luminosité en lux, I2C)

  Envoi HTTP JSON:
  - POST http://<IP_PC>/Hackaton%20projet%20Crop%20care/api/ingest

  Notes importantes:
  - Dans le code ESP32, NE METS PAS "localhost". Mets l'IP locale de ton PC (ex: 192.168.1.20).
  - Ouvre le port 80 en local (Apache/XAMPP) et assure-toi que le PC et l’ESP32 sont sur le même Wi‑Fi.

  Libraries (Arduino IDE / PlatformIO):
  - DHT sensor library (Adafruit)
  - Adafruit Unified Sensor
  - BH1750 (ex: "BH1750" by Christopher Laws)
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <BH1750.h>
#include <DHT.h>
#include <time.h>

// ---------- Wi‑Fi ----------
const char* WIFI_SSID = "TON_WIFI";
const char* WIFI_PASS = "TON_MDP";

// Mets l'IP de ton PC sur le réseau (ipconfig → IPv4)
// Exemple: http://192.168.1.20/Hackaton%20projet%20Crop%20care/api/ingest
String API_INGEST_URL = "http://192.168.1.20/Hackaton%20projet%20Crop%20care/api/ingest";

// Optionnel: si tu veux sécuriser l'ingest, mets une variable d'env côté PHP:
// CROPCARE_INGEST_TOKEN=secret123
String INGEST_TOKEN = ""; // ex: "secret123"

// ---------- DHT11 ----------
#define DHTPIN 4          // GPIO4 (à adapter)
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ---------- Soil (résistif) ----------
// IMPORTANT: sur ESP32, ADC recommandé: GPIO34/35/36/39 (input only)
// Utilise un pont diviseur / module adapté pour éviter de dépasser 3.3V sur l'ADC.
const int SOIL_PIN = 34;  // GPIO34

// Calibration (à ajuster avec tes mesures):
// - SOIL_DRY: valeur analogRead quand le capteur est à l'air (sec)
// - SOIL_WET: valeur analogRead quand le capteur est dans l'eau / sol très humide
// Sur ESP32, analogRead est souvent 0..4095 (12-bit).
int SOIL_DRY = 3200;
int SOIL_WET = 1400;

// ---------- BH1750 ----------
BH1750 lightMeter;

// ---------- Timing ----------
unsigned long lastSendMs = 0;
const unsigned long SEND_EVERY_MS = 5000;

// NTP pour timestamp ISO (optionnel)
void setupTime() {
  configTime(0, 0, "pool.ntp.org", "time.google.com");
}

String isoNowUTC() {
  time_t now;
  time(&now);
  if (now < 100000) return ""; // NTP pas prêt
  struct tm t;
  gmtime_r(&now, &t);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &t);
  return String(buf);
}

float clampf(float v, float mn, float mx) {
  if (v < mn) return mn;
  if (v > mx) return mx;
  return v;
}

float soilPercentFromRaw(int raw) {
  // Map vers 0..100 où 0 = sec, 100 = humide (selon calibration)
  // Si les valeurs sont inversées, ça marche aussi grâce au clamp.
  float pct = 0.0f;
  if (SOIL_DRY == SOIL_WET) return 0.0f;
  pct = 100.0f * (float)(SOIL_DRY - raw) / (float)(SOIL_DRY - SOIL_WET);
  return clampf(pct, 0.0f, 100.0f);
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi...");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(350);
    Serial.print(".");
    if (millis() - start > 20000) break;
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi OK: " + WiFi.localIP().toString());
  } else {
    Serial.println("WiFi KO (timeout)");
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);

  connectWifi();
  setupTime();

  // I2C: par défaut SDA=21, SCL=22 sur beaucoup d'ESP32 devkits
  Wire.begin();
  lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);

  dht.begin();

  // ADC (optionnel) : améliore la stabilité sur certains boards
  analogReadResolution(12); // 0..4095
}

bool postReading(float temperature, float humidity, float soilPct, float lux) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(API_INGEST_URL);
  http.addHeader("Content-Type", "application/json");

  String at = isoNowUTC();
  String body = "{";
  body += "\"temperature\":" + String(temperature, 1) + ",";
  body += "\"humidity\":" + String(humidity, 0) + ",";
  body += "\"soil\":" + String(soilPct, 0) + ",";
  body += "\"light\":" + String(lux, 0) + ",";
  body += "\"device\":\"esp32\"";
  if (INGEST_TOKEN.length() > 0) body += ",\"token\":\"" + INGEST_TOKEN + "\"";
  if (at.length() > 0) body += ",\"at\":\"" + at + "\"";
  body += "}";

  int code = http.POST(body);
  String resp = http.getString();
  http.end();

  Serial.printf("POST ingest -> %d\n", code);
  if (resp.length()) Serial.println(resp);
  return code >= 200 && code < 300;
}

void loop() {
  if (millis() - lastSendMs < SEND_EVERY_MS) return;
  lastSendMs = millis();

  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  // ---- Read DHT11 ----
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature(); // °C

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT11 read failed");
    return;
  }

  // ---- Read Soil ----
  int soilRaw = analogRead(SOIL_PIN);
  float soilPct = soilPercentFromRaw(soilRaw);

  // ---- Read BH1750 ----
  float lux = lightMeter.readLightLevel();
  if (lux < 0) lux = 0;

  Serial.printf("T=%.1fC H=%.0f%% SoilRaw=%d Soil=%.0f%% Lux=%.0f\n",
                temperature, humidity, soilRaw, soilPct, lux);

  postReading(temperature, humidity, soilPct, lux);
}

