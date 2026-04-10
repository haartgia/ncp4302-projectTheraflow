<?php
session_start();

header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/patient_data.php';

ensureSessionsTable($pdo);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$patient = getCurrentPatient($pdo);
$patientId = (int) ($patient['id'] ?? 0);
if ($patientId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid patient context']);
    exit;
}

$handshakeWindowSeconds = 45;

$stmt = $pdo->prepare(
    'SELECT recorded_at
     FROM sessions
     WHERE patient_id = ? AND source = ?
     ORDER BY recorded_at DESC, id DESC
     LIMIT 1'
);
$stmt->execute([$patientId, 'rehab_glove']);
$lastRecordedAt = (string) ($stmt->fetchColumn() ?: '');

$ageSeconds = null;
$handshake = false;

if ($lastRecordedAt !== '') {
    $lastTs = strtotime($lastRecordedAt);
    if ($lastTs !== false) {
        $ageSeconds = max(0, time() - $lastTs);
        $handshake = $ageSeconds <= $handshakeWindowSeconds;
    }
}

echo json_encode([
    'ok' => true,
    'patient_id' => $patientId,
    'handshake' => $handshake,
    'status' => $handshake ? 'connected' : 'offline',
    'last_seen_at' => $lastRecordedAt !== '' ? $lastRecordedAt : null,
    'age_seconds' => $ageSeconds,
    'handshake_window_seconds' => $handshakeWindowSeconds
]);
