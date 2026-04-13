#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "WIFI_NA_MABILIS";
const char* WIFI_PASSWORD = "ivanpogi";
const char* THERAFLOW_URL = "http://192.168.254.119/ncp4302-projectTheraflow/api/iot/sync_session.php";
const char* THERAFLOW_TOKEN = ""; // Optional: match THERAFLOW_IOT_TOKEN on the server

const int FLEX_COUNT = 4; // Temporary: thumb sensor is not connected
const int flexPins[FLEX_COUNT] = {39, 34, 35, 32};
const int gripPin = 33;
const char* fingerNames[FLEX_COUNT] = {"Index", "Middle", "Ring", "Pinky"};

float smoothedAngles[FLEX_COUNT] = {0, 0, 0, 0};
float smoothedGrip = 0;
float smoothingFactor = 0.1;

int straightValues[FLEX_COUNT] = {0, 0, 0, 0};
int bendValues[FLEX_COUNT] = {0, 0, 0, 0};
int gripMin = 0;
int gripMax = 0;

int patientId = 1;
int repetitions = 0;
float peakForce = 0.0;
float maxFlexion = 0.0;
unsigned long lastSyncAt = 0;
unsigned long lastCommandPollAt = 0;
unsigned long lastHeartbeatAt = 0;
bool calibrationComplete = false;
bool calibrationInProgress = false;
bool sessionActive = false;
int activeCalibrationCommandId = 0;
int activeSessionCommandId = 0;

int readAverageFlex(int pin, int samples) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delay(2);
  }
  return sum / samples;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Wi-Fi connected. IP: ");
  Serial.println(WiFi.localIP());
}

void ensureWiFiConnected() {
  static unsigned long lastReconnectAttempt = 0;
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  if (millis() - lastReconnectAttempt < 5000) {
    return;
  }

  lastReconnectAttempt = millis();
  Serial.println("Wi-Fi disconnected. Reconnecting...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void calibrateSensors() {
  Serial.println("=== FLEX SENSOR 4-FINGER CALIBRATION ===");

  Serial.println("Phase 1: Fully extend hand for 5 seconds...");
  for (int sec = 5; sec >= 1; sec--) {
    Serial.print("Full extension hold: ");
    Serial.print(sec);
    Serial.println("s");
    delay(1000);
  }

  for (int i = 0; i < FLEX_COUNT; i++) {
    straightValues[i] = readAverageFlex(flexPins[i], 50);
    Serial.print(fingerNames[i]); Serial.print(" Straight Value: ");
    Serial.println(straightValues[i]);
  }

  gripMin = readAverageFlex(gripPin, 50);
  Serial.print("Grip Min Value: "); Serial.println(gripMin);

  Serial.println("Phase 2: Fully close hand for 5 seconds...");
  for (int sec = 5; sec >= 1; sec--) {
    Serial.print("Full close hold: ");
    Serial.print(sec);
    Serial.println("s");
    delay(1000);
  }

  for (int i = 0; i < FLEX_COUNT; i++) {
    bendValues[i] = readAverageFlex(flexPins[i], 50);
    Serial.print(fingerNames[i]); Serial.print(" Bend Value: ");
    Serial.println(bendValues[i]);
  }

  gripMax = readAverageFlex(gripPin, 50);
  Serial.print("Grip Max Value: "); Serial.println(gripMax);

  Serial.println("=== Calibration Complete ===");
  Serial.println("-----------------------------------");
}

void sendCalibrationProgress(int commandId, const char* phase, int secondsRemaining) {
  if (WiFi.status() != WL_CONNECTED || commandId <= 0) {
    return;
  }

  String commandUrl = String(THERAFLOW_URL);
  commandUrl.replace("sync_session.php", "calibration_command.php");

  StaticJsonDocument<256> doc;
  doc["action"] = "update";
  doc["patient_id"] = patientId;
  doc["command_id"] = commandId;
  doc["payload"]["phase"] = phase;
  doc["payload"]["seconds_remaining"] = secondsRemaining;

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(commandUrl);
  http.addHeader("Content-Type", "application/json");
  http.POST(body);
  http.end();
}

void syncReading(float gripPercent) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  StaticJsonDocument<512> doc;
  doc["patient_id"] = patientId;
  doc["source"] = "esp32_glove";
  doc["status"] = "streaming";
  doc["grip_strength"] = gripPercent;
  doc["grip_percent"] = gripPercent;
  doc["repetitions"] = repetitions;
  doc["peakForce"] = peakForce;
  doc["maxFlexion"] = maxFlexion;
  doc["note"] = "ESP32 glove live reading";

  JsonArray angles = doc.createNestedArray("finger_angles");
  for (int i = 0; i < FLEX_COUNT; i++) {
    angles.add(smoothedAngles[i]);
  }

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(THERAFLOW_URL);
  http.addHeader("Content-Type", "application/json");
  if (strlen(THERAFLOW_TOKEN) > 0) {
    http.addHeader("X-IOT-Token", THERAFLOW_TOKEN);
  }

  int statusCode = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.print("Sync status: ");
  Serial.println(statusCode);
  if (statusCode == 401) {
    Serial.println("Unauthorized. Set THERAFLOW_TOKEN to match server THERAFLOW_IOT_TOKEN.");
  }
  Serial.println(response);
}

void syncHeartbeat(const char* status, const char* note) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  StaticJsonDocument<512> doc;
  doc["patient_id"] = patientId;
  doc["source"] = "esp32_glove";
  doc["status"] = status;
  doc["grip_strength"] = smoothedGrip;
  doc["grip_percent"] = smoothedGrip;
  doc["repetitions"] = repetitions;
  doc["peakForce"] = peakForce;
  doc["maxFlexion"] = maxFlexion;
  doc["note"] = note;

  JsonArray angles = doc.createNestedArray("finger_angles");
  for (int i = 0; i < FLEX_COUNT; i++) {
    angles.add(smoothedAngles[i]);
  }

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(THERAFLOW_URL);
  http.addHeader("Content-Type", "application/json");
  if (strlen(THERAFLOW_TOKEN) > 0) {
    http.addHeader("X-IOT-Token", THERAFLOW_TOKEN);
  }

  int statusCode = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.print("Heartbeat status: ");
  Serial.println(statusCode);
  if (statusCode == 401) {
    Serial.println("Unauthorized. Set THERAFLOW_TOKEN to match server THERAFLOW_IOT_TOKEN.");
  }
  Serial.println(response);
}

bool requestCalibrationCommand() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  String commandUrl = String(THERAFLOW_URL);
  commandUrl.replace("sync_session.php", "calibration_command.php");
  commandUrl += "?patient_id=" + String(patientId) + "&claim=1";

  HTTPClient http;
  http.begin(commandUrl);
  int statusCode = http.GET();

  if (statusCode <= 0) {
    http.end();
    return false;
  }

  String response = http.getString();
  http.end();

  StaticJsonDocument<384> doc;
  DeserializationError error = deserializeJson(doc, response);
  if (error) {
    return false;
  }

  JsonObject command = doc["command"];
  if (command.isNull()) {
    return false;
  }

  String commandName = command["command"] | "";
  String commandStatus = command["status"] | "";
  if (commandName == "calibrate" && commandStatus == "dispatched") {
    activeCalibrationCommandId = command["id"] | 0;
    return true;
  }

  if ((commandName == "start_session" || commandName == "stop_session") && commandStatus == "dispatched") {
    activeSessionCommandId = command["id"] | 0;
    if (commandName == "start_session") {
      sessionActive = true;
      Serial.println("Web requested session start.");
    } else {
      sessionActive = false;
      Serial.println("Web requested session stop.");
    }

    return true;
  }

  return false;
}

void acknowledgeCalibrationComplete(int commandId) {
  if (WiFi.status() != WL_CONNECTED || commandId <= 0) {
    return;
  }

  String commandUrl = String(THERAFLOW_URL);
  commandUrl.replace("sync_session.php", "calibration_command.php");

  StaticJsonDocument<256> doc;
  doc["action"] = "complete";
  doc["patient_id"] = patientId;
  doc["command_id"] = commandId;
  doc["status"] = "completed";
  doc["command"] = "calibrate";

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(commandUrl);
  http.addHeader("Content-Type", "application/json");
  int statusCode = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.print("Calibration ack status: ");
  Serial.println(statusCode);
  Serial.println(response);
}

void performCalibrationFromWeb() {
  calibrationInProgress = true;
  Serial.println("Calibration requested from web. Starting calibration now...");

  for (int sec = 5; sec >= 1; sec--) {
    sendCalibrationProgress(activeCalibrationCommandId, "full_extension_hold", sec);
    delay(1000);
  }

  for (int i = 0; i < FLEX_COUNT; i++) {
    straightValues[i] = readAverageFlex(flexPins[i], 50);
  }
  gripMin = readAverageFlex(gripPin, 50);

  for (int sec = 5; sec >= 1; sec--) {
    sendCalibrationProgress(activeCalibrationCommandId, "full_close_hold", sec);
    delay(1000);
  }

  for (int i = 0; i < FLEX_COUNT; i++) {
    bendValues[i] = readAverageFlex(flexPins[i], 50);
  }
  gripMax = readAverageFlex(gripPin, 50);

  Serial.println("=== Calibration Complete ===");
  Serial.println("-----------------------------------");
  calibrationComplete = true;
  calibrationInProgress = false;
  acknowledgeCalibrationComplete(activeCalibrationCommandId);
  activeCalibrationCommandId = 0;
}

void acknowledgeSessionCommandComplete(int commandId) {
  if (WiFi.status() != WL_CONNECTED || commandId <= 0) {
    return;
  }

  String commandUrl = String(THERAFLOW_URL);
  commandUrl.replace("sync_session.php", "calibration_command.php");

  StaticJsonDocument<256> doc;
  doc["action"] = "complete";
  doc["patient_id"] = patientId;
  doc["command_id"] = commandId;
  doc["status"] = "completed";
  doc["command"] = sessionActive ? "start_session" : "stop_session";

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(commandUrl);
  http.addHeader("Content-Type", "application/json");
  int statusCode = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.print("Session ack status: ");
  Serial.println(statusCode);
  Serial.println(response);
}

void setup() {
  Serial.begin(115200);
  delay(2000);
  connectWiFi();
  Serial.println("Waiting for calibration request from the web...");
  Serial.print("Polling commands for patient_id=");
  Serial.println(patientId);
}

void loop() {
  ensureWiFiConnected();

  if (!calibrationInProgress && millis() - lastCommandPollAt >= 1000) {
    if (requestCalibrationCommand()) {
      if (activeCalibrationCommandId > 0) {
        performCalibrationFromWeb();
      } else if (activeSessionCommandId > 0) {
        acknowledgeSessionCommandComplete(activeSessionCommandId);
        activeSessionCommandId = 0;
      }
    }
    lastCommandPollAt = millis();
  }

  if (!calibrationComplete) {
    if (millis() - lastHeartbeatAt >= 3000) {
      syncHeartbeat("awaiting_calibration", "ESP32 online, waiting for calibration command");
      lastHeartbeatAt = millis();
    }

    static unsigned long lastPreCalibPrint = 0;
    if (millis() - lastPreCalibPrint > 5000) {
      Serial.print("Awaiting web calibration command for patient_id=");
      Serial.println(patientId);
      lastPreCalibPrint = millis();
    }
    return;
  }

  if (!sessionActive) {
    if (millis() - lastHeartbeatAt >= 3000) {
      syncHeartbeat("ready", "ESP32 calibrated and ready for session start");
      lastHeartbeatAt = millis();
    }

    static unsigned long lastIdlePrint = 0;
    if (millis() - lastIdlePrint > 3000) {
      Serial.println("Calibration complete. Waiting for web session start...");
      lastIdlePrint = millis();
    }
    return;
  }

  for (int i = 0; i < FLEX_COUNT; i++) {
    int flexValue = readAverageFlex(flexPins[i], 10);
    float angle = 0;

    if (bendValues[i] != straightValues[i]) {
      angle = ((float)(flexValue - straightValues[i]) / (bendValues[i] - straightValues[i])) * 90.0;
      angle = constrain(angle, 0, 90);
    }

    smoothedAngles[i] = smoothedAngles[i] + (angle - smoothedAngles[i]) * smoothingFactor;
    maxFlexion = max(maxFlexion, smoothedAngles[i]);
  }

  int gripValue = readAverageFlex(gripPin, 10);
  float gripPercent = 0;

  if (gripMax != gripMin) {
    gripPercent = ((float)(gripValue - gripMin) / (gripMax - gripMin)) * 100.0;
    gripPercent = constrain(gripPercent, 0, 100);
  }

  smoothedGrip = smoothedGrip + (gripPercent - smoothedGrip) * smoothingFactor;
  peakForce = max(peakForce, smoothedGrip);

  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 200) {
    for (int f = 0; f < FLEX_COUNT; f++) {
      Serial.print(fingerNames[f]);
      Serial.print(": ");
      Serial.print(smoothedAngles[f], 1);
      Serial.print("\xC2\xB0  ");
    }

    Serial.print("Grip: ");
    Serial.print(smoothedGrip, 1);
    Serial.println("%");
    lastPrint = millis();
  }

  if (millis() - lastSyncAt >= 1500) {
    syncReading(smoothedGrip);
    lastSyncAt = millis();
  }
}
