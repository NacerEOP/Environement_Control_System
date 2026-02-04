/*
  CropCare ESP32 — Serveur sur l’ESP32 (pas de PHP / XAMPP)

  L’ESP32 lit les capteurs et sert lui‑même l’API (GET /api/latest, GET /api/history).
  Le dashboard (HTML/JS) peut être servi depuis l’ESP32 (LittleFS) ou depuis un PC ;
  dans les deux cas, apiBaseUrl = http://IP_ESP32 (ex. http://192.168.1.100).

  Capteurs:
  - DHT11 (GPIO4) : température + humidité air
  - Capteur humidité sol résistif (GPIO34)
  - BH1750 (I2C SDA=21, SCL=20) : luminosité (lux)

  Libraries: DHT (Adafruit), BH1750, ESPAsyncWebServer, AsyncTCP, Preferences, LittleFS.
*/

#include <WiFi.h>
#include <Wire.h>
#include <BH1750.h>
#include <DHT.h>
#include <time.h>
#include <Preferences.h>
#include <LittleFS.h>
#include <ESPAsyncWebServer.h>

AsyncWebServer server(80);

// Dernières valeurs (et buffer pour /api/latest + /api/history)
float g_temp = 0, g_hum = 0, g_soil = 0, g_lux = 0;
bool BH_OK = false;

// Historique en RAM (format attendu par le dashboard)
#define HISTORY_MAX 50
struct Reading {
  float temperature;
  float humidity;
  float soil;
  float light;
  char at[28]; // ISO date
};
Reading historyBuf[HISTORY_MAX];
int historyCount = 0;
int historyIndex = 0; // prochaine écriture (circular)

// ------------------- Pins -------------------
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 20
#define DHTPIN 4
#define DHTTYPE DHT11
#define SOIL_PIN 34

// ------------------- Wi‑Fi (flash) -------------------
#define MAX_SSID_LEN 33
#define MAX_PASS_LEN 65
Preferences prefs;
char WIFI_SSID[MAX_SSID_LEN];
char WIFI_PASS[MAX_PASS_LEN];

// Remplace par l’IP de ton PC sur le réseau (ipconfig → IPv4)

// ------------------- Capteurs -------------------
DHT dht(DHTPIN, DHTTYPE);
BH1750 lightMeter;
int SOIL_DRY = 3200;
int SOIL_WET = 1400;

// ------------------- Timing -------------------
unsigned long lastSendMs = 0;
const unsigned long SEND_EVERY_MS = 5000;

// ------------------- NTP -------------------
void setupTime() {
  configTime(0, 0, "pool.ntp.org", "time.google.com");
}

String isoNowUTC() {
  time_t now;
  time(&now);
  if (now < 100000) return "";
  struct tm t;
  gmtime_r(&now, &t);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &t);
  return String(buf);
}

// ------------------- Helpers -------------------
float clampf(float v, float mn, float mx) {
  if (v < mn) return mn;
  if (v > mx) return mx;
  return v;
}

float soilPercentFromRaw(int raw) {
  if (SOIL_DRY == SOIL_WET) return 0.0f;
  float pct = 100.0f * (float)(SOIL_DRY - raw) / (float)(SOIL_DRY - SOIL_WET);
  return clampf(pct, 0.0f, 100.0f);
}

// ------------------- Lecture ligne Série -------------------
void readLineOrEmpty(char *buffer, size_t maxLen, uint32_t timeoutMs = 60000) {
  size_t i = 0;
  uint32_t start = millis();
  while (true) {
    while (!Serial.available()) {
      delay(10);
      if (timeoutMs > 0 && (millis() - start) > timeoutMs) {
        buffer[0] = '\0';
        return;
      }
    }
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (c == '\r' && Serial.available() && Serial.peek() == '\n') Serial.read();
      break;
    }
    if (i < maxLen - 1) buffer[i++] = c;
  }
  buffer[i] = '\0';
}

void trimRight(char *s) {
  int len = (int)strlen(s);
  while (len > 0) {
    char c = s[len - 1];
    if (c == ' ' || c == '\t' || c == '\r' || c == '\n') s[--len] = '\0';
    else break;
  }
}

// ------------------- Flash (NVS) -------------------
void loadCredsFromFlash() {
  prefs.begin("wifi", true);
  String s = prefs.getString("ssid", "");
  String p = prefs.getString("pass", "");
  prefs.end();
  strncpy(WIFI_SSID, s.c_str(), MAX_SSID_LEN);
  WIFI_SSID[MAX_SSID_LEN - 1] = '\0';
  strncpy(WIFI_PASS, p.c_str(), MAX_PASS_LEN);
  WIFI_PASS[MAX_PASS_LEN - 1] = '\0';
}

void saveCredsToFlash() {
  prefs.begin("wifi", false);
  prefs.putString("ssid", WIFI_SSID);
  prefs.putString("pass", WIFI_PASS);
  prefs.end();
}

void promptAndMaybeUpdateCreds() {
  char inputSSID[MAX_SSID_LEN];
  char inputPASS[MAX_PASS_LEN];
  Serial.println();
  Serial.println("----- WiFi credentials -----");
  Serial.print("Saved SSID: ");
  Serial.println(strlen(WIFI_SSID) ? WIFI_SSID : "(none)");
  Serial.println("Enter WIFI SSID (press Enter to keep saved):");
  readLineOrEmpty(inputSSID, MAX_SSID_LEN, 0);
  trimRight(inputSSID);
  Serial.println("Enter WIFI PASSWORD (press Enter to keep saved):");
  readLineOrEmpty(inputPASS, MAX_PASS_LEN, 0);
  trimRight(inputPASS);
  bool changed = false;
  if (strlen(inputSSID) > 0) {
    strncpy(WIFI_SSID, inputSSID, MAX_SSID_LEN);
    WIFI_SSID[MAX_SSID_LEN - 1] = '\0';
    changed = true;
  }
  if (strlen(inputPASS) > 0) {
    strncpy(WIFI_PASS, inputPASS, MAX_PASS_LEN);
    WIFI_PASS[MAX_PASS_LEN - 1] = '\0';
    changed = true;
  }
  if (changed) {
    saveCredsToFlash();
    Serial.println("Saved to flash.");
  } else {
    Serial.println("Keeping saved credentials.");
  }
}

// ------------------- Connexion Wi‑Fi (bloquante) -------------------
bool connectWifiBlocking(uint32_t timeoutMs = 30000) {
  if (strlen(WIFI_SSID) == 0) {
    Serial.println("No SSID stored. Not connecting.");
    return false;
  }
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);
  delay(300);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < timeoutMs) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection failed (timeout).");
    return false;
  }
  Serial.println("Connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  if (LittleFS.begin(true)) {
    server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");
  } else {
    Serial.println("LittleFS mount failed");
  }

  // CORS pour que le dashboard (même depuis un autre origine) puisse appeler l'API
  auto addCors = [](AsyncWebServerRequest *req) {
    req->addHeader("Access-Control-Allow-Origin", "*");
    req->addHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    req->addHeader("Access-Control-Allow-Headers", "Content-Type");
  };

  // GET /api/latest et /api/latest/ — dernière lecture (même format que le PHP)
  auto handleLatest = [](AsyncWebServerRequest *request) {
    addCors(request);
    String at = isoNowUTC();
    if (at.length() == 0) at = "\"\"";
    else at = "\"" + at + "\"";
    String json = "{\"temperature\":" + String(g_temp, 1) +
                  ",\"humidity\":" + String(g_hum, 0) +
                  ",\"soil\":" + String(g_soil, 0) +
                  ",\"light\":" + String(g_lux, 0) +
                  ",\"at\":" + at + "}";
    request->send(200, "application/json", json);
  };
  server.on("/api/latest", HTTP_GET, handleLatest);
  server.on("/api/latest/", HTTP_GET, handleLatest);

  // GET /api/history ou /api/history/?range=1h|24h|7d — tableau de points (max 36, plus récent en premier)
  auto handleHistory = [](AsyncWebServerRequest *request) {
    addCors(request);
    int n = (historyCount < 36) ? historyCount : 36;
    String out = "[";
    for (int i = 0; i < n; i++) {
      int j = (historyIndex - 1 - i + HISTORY_MAX * 2) % HISTORY_MAX;
      Reading *r = &historyBuf[j];
      if (i > 0) out += ",";
      out += "{\"temperature\":" + String(r->temperature, 1) +
             ",\"humidity\":" + String(r->humidity, 0) +
             ",\"soil\":" + String(r->soil, 0) +
             ",\"light\":" + String(r->light, 0) +
             ",\"at\":\"" + String(r->at) + "\"}";
    }
    out += "]";
    request->send(200, "application/json", out);
  };
  server.on("/api/history", HTTP_GET, handleHistory);
  server.on("/api/history/", HTTP_GET, handleHistory);

  server.on("/api/sensors", HTTP_GET, [](AsyncWebServerRequest *request) {
    addCors(request);
    String json = "{\"temperature\":" + String(g_temp, 1) + ",\"humidity\":" + String(g_hum, 0) +
                  ",\"soil\":" + String(g_soil, 0) + ",\"light\":" + String(g_lux, 0) + "}";
    request->send(200, "application/json", json);
  });

  server.begin();
  return true;
}

void pushReading(float temperature, float humidity, float soilPct, float lux) {
  Reading *r = &historyBuf[historyIndex];
  r->temperature = temperature;
  r->humidity = humidity;
  r->soil = soilPct;
  r->light = lux;
  String at = isoNowUTC();
  if (at.length() > 0) strncpy(r->at, at.c_str(), sizeof(r->at) - 1);
  r->at[sizeof(r->at) - 1] = '\0';
  historyIndex = (historyIndex + 1) % HISTORY_MAX;
  if (historyCount < HISTORY_MAX) historyCount++;
}

// Plus de POST vers un PC : les données sont servies directement par l'ESP32 (GET /api/latest, /api/history).

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("CropCare ESP32 - Booting...");

  loadCredsFromFlash();
  promptAndMaybeUpdateCreds();
  bool ok = connectWifiBlocking(30000);

  BH_OK = false;
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  BH_OK = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  if (!BH_OK) Serial.println("BH1750 init failed.");
  dht.begin();
  analogReadResolution(12);

  if (ok) setupTime();
}

void loop() {
  if (millis() - lastSendMs < SEND_EVERY_MS) return;
  lastSendMs = millis();

  static unsigned long lastRetry = 0;
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastRetry > 10000) {
      lastRetry = millis();
      connectWifiBlocking(30000);
      if (WiFi.status() == WL_CONNECTED) setupTime();
    }
    return;
  }

  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT11 read failed");
    return;
  }

  int soilRaw = analogRead(SOIL_PIN);
  float soilPct = soilPercentFromRaw(soilRaw);

  float lux = 0;
  if (BH_OK) lux = lightMeter.readLightLevel();
  if (lux < 0) lux = 0;

  g_temp = temperature;
  g_hum = humidity;
  g_soil = soilPct;
  g_lux = lux;

  Serial.printf("T=%.1fC H=%.0f%% SoilRaw=%d Soil=%.0f%% Lux=%.0f\n",
                temperature, humidity, soilRaw, soilPct, lux);

  pushReading(temperature, humidity, soilPct, lux);
}
