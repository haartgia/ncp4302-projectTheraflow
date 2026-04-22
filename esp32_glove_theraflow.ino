#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "Katabi mo";
const char* WIFI_PASSWORD = "ivanpogi123";
const char* THERAFLOW_URL = "http://172.20.10.5/ncp4302-projectTheraflow/api/iot/sync_session.php";
const char* THERAFLOW_TOKEN = "";

const int FLEX_COUNT = 5;
const int flexPins[FLEX_COUNT] = {36, 39, 34, 35, 32};
const int gripPin = 33;
const char* fingerNames[FLEX_COUNT] = {"Thumb", "Index", "Middle", "Ring", "Pinky"};

const int suctionPump = 19;
const int inflatePump = 23;
const int valvePin = 27;
const int VALVE_SETTLE_MS = 120;
const bool INVERT_VALVE_LOGIC = true;
const int CALIBRATE_SUCTION_SECONDS = 5;
const int CALIBRATE_PUMP_SECONDS = 5;
const int CALIBRATE_DEFLATE_SECONDS = 5;
const int CALIBRATION_SAMPLES = 50;
const int LIVE_READ_SAMPLES = 10;
const int PER_FINGER_SETTLE_MS = 3000;
const unsigned long PRINT_INTERVAL_MS = 200;
const unsigned long SYNC_INTERVAL_MS = 400;
const int FLEX_RAW_JUMP_THRESHOLD = 220;
const float FORCE_DEADZONE_PERCENT = 3.0f;
const float FORCE_MAX_NEWTON = 420.0f;
const float FORCE_CURVE_GAMMA = 1.35f;

float smoothedAngles[FLEX_COUNT] = {0, 0, 0, 0, 0};
float smoothedGrip = 0;
float smoothedGripPercent = 0;
float smoothedGripForceN = 0;
float smoothingFactor = 0.25;

int straightValues[FLEX_COUNT] = {0, 0, 0, 0, 0};
int bendValues[FLEX_COUNT] = {0, 0, 0, 0, 0};
int lastFlexRaw[FLEX_COUNT] = {0, 0, 0, 0, 0};
bool hasLastFlexRaw[FLEX_COUNT] = {false, false, false, false, false};
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

void resetSessionMetrics() {
  repetitions = 0;
  peakForce = 0.0;
  maxFlexion = 0.0;
}

void resetLiveRawState() {
  for (int i = 0; i < FLEX_COUNT; i++) {
    hasLastFlexRaw[i] = false;
    lastFlexRaw[i] = 0;
  }
}

void configureHttpClient(HTTPClient& http, const String& url) {
  http.setConnectTimeout(5000);
  http.setTimeout(7000);
  http.begin(url);
}

void logHttpFailure(const char* label, int statusCode, const String& url) {
  if (statusCode > 0) {
    return;
  }

  Serial.print(label);
  Serial.print(" failed with status ");
  Serial.print(statusCode);
  Serial.print(" (");
  Serial.print(HTTPClient::errorToString(statusCode));
  Serial.println(")");
  Serial.print("URL: ");
  Serial.println(url);
}

void probeTheraflowServer() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  HTTPClient http;
  String url = String(THERAFLOW_URL);
  configureHttpClient(http, url);
  int statusCode = http.GET();
  if (statusCode > 0) {
    Serial.print("Theraflow server reachable, probe status: ");
    Serial.println(statusCode);
  } else {
    logHttpFailure("Theraflow server probe", statusCode, url);
  }
  http.end();
}

void setActuatorsOff() {
  digitalWrite(inflatePump, HIGH);
  digitalWrite(suctionPump, HIGH);
  // Keep valve in the default closed route when idle.
  digitalWrite(valvePin, INVERT_VALVE_LOGIC ? HIGH : LOW);
}

void setValvePathOpen(bool openPath) {
  // Default wiring expects HIGH=open, LOW=closed. Inverted wiring flips that.
  int valveLevel = openPath ? HIGH : LOW;
  if (INVERT_VALVE_LOGIC) {
    valveLevel = openPath ? LOW : HIGH;
  }
  digitalWrite(valvePin, valveLevel);
}

void setInflateMode() {
  // Pump mode (closed hands): close valve path before enabling pump.
  setValvePathOpen(false);
  delay(VALVE_SETTLE_MS);
  digitalWrite(suctionPump, HIGH);
  digitalWrite(inflatePump, LOW);
}

void setSuctionMode() {
  // Suction mode (open hands): open valve path before enabling suction pump.
  digitalWrite(suctionPump, HIGH);
  digitalWrite(inflatePump, HIGH);
  setValvePathOpen(true);
  delay(VALVE_SETTLE_MS);
  digitalWrite(suctionPump, LOW);
}

void setDeflateMode() {
  // Deflate mode: passive release path, no pump drive.
  digitalWrite(inflatePump, HIGH);
  digitalWrite(suctionPump, HIGH);
  setValvePathOpen(false);
}

void runPumpSecondHighIntensity() {
  // Reassert full-pressure path and ensure valve is closed before pumping.
  setValvePathOpen(false);
  delay(VALVE_SETTLE_MS);
  digitalWrite(suctionPump, HIGH);
  digitalWrite(inflatePump, LOW);
  delay(1000);
}

int readAverageFlex(int pin, int samples) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delay(2);
  }
  return sum / samples;
}

void captureAllFingersCalibration(int values[], const char* actionLabel) {
  Serial.print(actionLabel);
  Serial.println(" all fingers...");
  delay(PER_FINGER_SETTLE_MS);

  long sums[FLEX_COUNT] = {0, 0, 0, 0, 0};
  for (int sample = 0; sample < CALIBRATION_SAMPLES; sample++) {
    for (int i = 0; i < FLEX_COUNT; i++) {
      sums[i] += analogRead(flexPins[i]);
    }
    delay(2);
  }

  for (int i = 0; i < FLEX_COUNT; i++) {
    values[i] = (int)(sums[i] / CALIBRATION_SAMPLES);
    Serial.print(fingerNames[i]);
    Serial.print(" Value: ");
    Serial.println(values[i]);
  }
}

float mapFlexToAngle(int flexValue, int straightValue, int bendValue) {
  float angle = 0.0f;
  if (bendValue != straightValue) {
    angle = ((float)(flexValue - straightValue) / (float)(bendValue - straightValue)) * 90.0f;
    angle = constrain(angle, 0.0f, 90.0f);
  }
  return angle;
}

float mapGripPercentToForce(float gripPercent) {
  // Convert calibrated grip percentage to a realistic force profile (0..~420 N).
  float clampedPercent = constrain(gripPercent, 0.0f, 100.0f);
  float normalized = (clampedPercent - FORCE_DEADZONE_PERCENT) / (100.0f - FORCE_DEADZONE_PERCENT);
  normalized = constrain(normalized, 0.0f, 1.0f);
  float curved = pow(normalized, FORCE_CURVE_GAMMA);
  return curved * FORCE_MAX_NEWTON;
}

void updateLiveSensorState() {
  for (int i = 0; i < FLEX_COUNT; i++) {
    int flexValue = readAverageFlex(flexPins[i], LIVE_READ_SAMPLES);
    if (hasLastFlexRaw[i] && abs(flexValue - lastFlexRaw[i]) > FLEX_RAW_JUMP_THRESHOLD) {
      // Ignore single-sample spikes that can incorrectly map to near-closed angles.
      flexValue = lastFlexRaw[i];
    } else {
      lastFlexRaw[i] = flexValue;
      hasLastFlexRaw[i] = true;
    }

    float angle = mapFlexToAngle(flexValue, straightValues[i], bendValues[i]);
    smoothedAngles[i] = smoothedAngles[i] + (angle - smoothedAngles[i]) * smoothingFactor;
    maxFlexion = max(maxFlexion, smoothedAngles[i]);
  }

  int gripValue = readAverageFlex(gripPin, LIVE_READ_SAMPLES);
  float gripPercent = 0;

  if (gripMax != gripMin) {
    gripPercent = ((float)(gripValue - gripMin) / (gripMax - gripMin)) * 100.0;
    gripPercent = constrain(gripPercent, 0, 100);
  }

  // Primary force signal now uses the real sensor reading (raw ADC units).
  smoothedGrip = smoothedGrip + (((float)gripValue) - smoothedGrip) * smoothingFactor;
  smoothedGripPercent = smoothedGripPercent + (gripPercent - smoothedGripPercent) * smoothingFactor;

  float estimatedForceN = mapGripPercentToForce(smoothedGripPercent);
  smoothedGripForceN = smoothedGripForceN + (estimatedForceN - smoothedGripForceN) * smoothingFactor;
  peakForce = max(peakForce, smoothedGripForceN);
}

void printFingerCalibrationData(const char* label, const int values[]) {
  Serial.print("=== ");
  Serial.print(label);
  Serial.println(" ===");
  for (int i = 0; i < FLEX_COUNT; i++) {
    Serial.print(fingerNames[i]);
    Serial.print(": ");
    Serial.println(values[i]);
  }
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
  Serial.println("=== FLEX SENSOR 5-FINGER CALIBRATION ===");

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
  configureHttpClient(http, commandUrl);
  http.addHeader("Content-Type", "application/json");
  int statusCode = http.POST(body);
  logHttpFailure("Calibration progress update", statusCode, commandUrl);
  http.end();
}

void printFingerAnglesFromResponse(const String& response) {
  StaticJsonDocument<768> doc;
  DeserializationError error = deserializeJson(doc, response);
  if (error) {
    return;
  }

  JsonVariant anglesVariant = doc["finger_angles"];
  if (anglesVariant.isNull()) {
    return;
  }

  if (anglesVariant.is<JsonObject>()) {
    JsonObject angles = anglesVariant.as<JsonObject>();
    Serial.print("Server finger angles: ");
    bool first = true;
    for (JsonPair kv : angles) {
      if (!first) {
        Serial.print(" | ");
      }
      first = false;
      Serial.print(kv.key().c_str());
      Serial.print("=");
      Serial.print(kv.value().as<float>(), 2);
      Serial.print(" deg");
    }
    Serial.println();
    return;
  }

  if (anglesVariant.is<JsonArray>()) {
    JsonArray angles = anglesVariant.as<JsonArray>();
    Serial.print("Server finger angles: ");
    for (int i = 0; i < FLEX_COUNT && i < (int)angles.size(); i++) {
      if (i > 0) {
        Serial.print(" | ");
      }
      Serial.print(fingerNames[i]);
      Serial.print("=");
      Serial.print(angles[i].as<float>(), 2);
      Serial.print(" deg");
    }
    Serial.println();
  }
}

void syncReading(float gripForceRaw) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  StaticJsonDocument<512> doc;
  doc["patient_id"] = patientId;
  doc["source"] = "esp32_glove";
  doc["status"] = "streaming";
  doc["grip_strength"] = gripForceRaw;
  doc["grip_percent"] = smoothedGripPercent;
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
  String syncUrl = String(THERAFLOW_URL);
  configureHttpClient(http, syncUrl);
  http.addHeader("Content-Type", "application/json");
  if (strlen(THERAFLOW_TOKEN) > 0) {
    http.addHeader("X-IOT-Token", THERAFLOW_TOKEN);
  }

  int statusCode = http.POST(body);
  logHttpFailure("Sensor sync", statusCode, syncUrl);
  String response = http.getString();
  http.end();

  Serial.print("Sync status: ");
  Serial.println(statusCode);
  if (statusCode == 401) {
    Serial.println("Unauthorized. Set THERAFLOW_TOKEN to match server THERAFLOW_IOT_TOKEN.");
  }
  Serial.println(response);
  printFingerAnglesFromResponse(response);
}

void syncHeartbeat(const char* status, const char* note) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  StaticJsonDocument<512> doc;
  doc["patient_id"] = patientId;
  doc["source"] = "esp32_glove";
  doc["status"] = status;
  doc["grip_strength"] = smoothedGripForceN;
  doc["grip_percent"] = smoothedGripPercent;
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
  String syncUrl = String(THERAFLOW_URL);
  configureHttpClient(http, syncUrl);
  http.addHeader("Content-Type", "application/json");
  if (strlen(THERAFLOW_TOKEN) > 0) {
    http.addHeader("X-IOT-Token", THERAFLOW_TOKEN);
  }

  int statusCode = http.POST(body);
  logHttpFailure("Heartbeat sync", statusCode, syncUrl);
  String response = http.getString();
  http.end();

  Serial.print("Heartbeat status: ");
  Serial.println(statusCode);
  if (statusCode == 401) {
    Serial.println("Unauthorized. Set THERAFLOW_TOKEN to match server THERAFLOW_IOT_TOKEN.");
  }
  Serial.println(response);
  printFingerAnglesFromResponse(response);
}

bool requestCalibrationCommand() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  String commandUrl = String(THERAFLOW_URL);
  commandUrl.replace("sync_session.php", "calibration_command.php");
  commandUrl += "?patient_id=" + String(patientId) + "&claim=1";

  HTTPClient http;
  configureHttpClient(http, commandUrl);
  int statusCode = http.GET();
  logHttpFailure("Calibration command poll", statusCode, commandUrl);

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
      resetSessionMetrics();
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

  StaticJsonDocument<1024> doc;
  doc["action"] = "complete";
  doc["patient_id"] = patientId;
  doc["command_id"] = commandId;
  doc["status"] = "completed";
  doc["command"] = "calibrate";

  JsonObject calibration = doc.createNestedObject("calibration");
  JsonArray straight = calibration.createNestedArray("straight_values");
  JsonArray bend = calibration.createNestedArray("bend_values");
  JsonArray names = calibration.createNestedArray("finger_names");
  for (int i = 0; i < FLEX_COUNT; i++) {
    straight.add(straightValues[i]);
    bend.add(bendValues[i]);
    names.add(fingerNames[i]);
  }
  calibration["grip_min"] = gripMin;
  calibration["grip_max"] = gripMax;
  calibration["captured_at"] = millis();

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  configureHttpClient(http, commandUrl);
  http.addHeader("Content-Type", "application/json");
  int statusCode = http.POST(body);
  logHttpFailure("Calibration complete ack", statusCode, commandUrl);
  String response = http.getString();
  http.end();

  Serial.print("Calibration ack status: ");
  Serial.println(statusCode);
  Serial.println(response);
}

void performCalibrationFromWeb() {
  calibrationInProgress = true;
  bool openCaptured = false;
  bool closeCaptured = false;
  Serial.println("Calibration requested from web. Starting calibration now...");

  Serial.println("SUCTION (OPEN HANDS)");
  setSuctionMode();
  for (int sec = CALIBRATE_SUCTION_SECONDS; sec >= 0; sec--) {
    sendCalibrationProgress(activeCalibrationCommandId, "suction", sec);
    if (sec == 1 && !openCaptured) {
      Serial.println("=== OPEN-HAND ALL-FINGER CALIBRATION (LAST SECOND) ===");
      captureAllFingersCalibration(straightValues, "Keep straight");
      gripMin = readAverageFlex(gripPin, CALIBRATION_SAMPLES);
      printFingerCalibrationData("OPEN-HAND FLEX DATA", straightValues);
      Serial.print("Grip OPEN data: ");
      Serial.println(gripMin);
      openCaptured = true;
    }
    if (sec > 0) {
      delay(1000);
    }
  }

  Serial.println("PUMP (CLOSE HANDS)");
  setInflateMode();
  for (int sec = CALIBRATE_PUMP_SECONDS; sec >= 0; sec--) {
    sendCalibrationProgress(activeCalibrationCommandId, "pump", sec);
    if (sec == 1 && !closeCaptured) {
      Serial.println("=== CLOSED-HAND ALL-FINGER CALIBRATION (LAST SECOND) ===");
      captureAllFingersCalibration(bendValues, "Fully bend");
      gripMax = readAverageFlex(gripPin, CALIBRATION_SAMPLES);
      printFingerCalibrationData("CLOSED-HAND FLEX DATA", bendValues);
      Serial.print("Grip CLOSED data: ");
      Serial.println(gripMax);
      closeCaptured = true;
    }
    if (sec > 0) {
      runPumpSecondHighIntensity();
    }
  }

  Serial.println("=== FINGER CALIBRATION RANGE ===");
  for (int i = 0; i < FLEX_COUNT; i++) {
    int span = abs(bendValues[i] - straightValues[i]);

    Serial.print(fingerNames[i]);
    Serial.print(": open=");
    Serial.print(straightValues[i]);
    Serial.print(", closed=");
    Serial.print(bendValues[i]);
    Serial.print(", span=");
    Serial.println(span);
    Serial.println();
  }

  Serial.println("DEFLATE");
  setDeflateMode();
  for (int sec = CALIBRATE_DEFLATE_SECONDS; sec >= 0; sec--) {
    sendCalibrationProgress(activeCalibrationCommandId, "deflate", sec);
    if (sec > 0) {
      delay(1000);
    }
  }

  setActuatorsOff();

  Serial.println("=== Calibration Complete ===");
  Serial.println("-----------------------------------");
  calibrationComplete = true;
  calibrationInProgress = false;
  resetLiveRawState();
  resetSessionMetrics();
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
  configureHttpClient(http, commandUrl);
  http.addHeader("Content-Type", "application/json");
  int statusCode = http.POST(body);
  logHttpFailure("Session command ack", statusCode, commandUrl);
  String response = http.getString();
  http.end();

  Serial.print("Session ack status: ");
  Serial.println(statusCode);
  Serial.println(response);
}

void setup() {
  Serial.begin(115200);
  delay(2000);

  pinMode(inflatePump, OUTPUT);
  pinMode(suctionPump, OUTPUT);
  pinMode(valvePin, OUTPUT);
  setActuatorsOff();

  connectWiFi();
  Serial.print("Theraflow sync URL: ");
  Serial.println(THERAFLOW_URL);
  probeTheraflowServer();
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

  updateLiveSensorState();

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

  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > PRINT_INTERVAL_MS) {
    for (int f = 0; f < FLEX_COUNT; f++) {
      Serial.print(fingerNames[f]);
      Serial.print(": ");
      Serial.print(smoothedAngles[f], 1);
      Serial.print("\xC2\xB0  ");
    }

    Serial.print("Grip: ");
    Serial.print(smoothedGripForceN, 1);
    Serial.print(" N (raw ");
    Serial.print(smoothedGrip, 1);
    Serial.print(", percent ");
    Serial.print(smoothedGripPercent, 1);
    Serial.println("%)");
    lastPrint = millis();
  }

  if (millis() - lastSyncAt >= SYNC_INTERVAL_MS) {
    syncReading(smoothedGripForceN);
    lastSyncAt = millis();
  }
}
