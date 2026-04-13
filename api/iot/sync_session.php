<?php
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/doctor_data.php';

ensureSensorDataTable($pdo);
ensureSessionsTable($pdo);

function payloadArray(): array
{
    $raw = json_decode(file_get_contents('php://input'), true);
    if (is_array($raw)) {
        return $raw;
    }
    return $_POST ?: [];
}

function averageFromMixed($value): ?float
{
    if (is_array($value)) {
        $nums = [];
        foreach ($value as $item) {
            if (is_numeric($item)) {
                $nums[] = (float) $item;
            }
        }
        if (count($nums) === 0) {
            return null;
        }
        return array_sum($nums) / count($nums);
    }

    if (is_numeric($value)) {
        return (float) $value;
    }

    return null;
}

function firstNonEmptyValue(array $payload, array $keys)
{
    foreach ($keys as $key) {
        if (!array_key_exists($key, $payload)) {
            continue;
        }

        $value = $payload[$key];
        if ($value !== null && $value !== '' && $value !== []) {
            return $value;
        }
    }

    return null;
}

function angleSummary(array $payload): ?float
{
    $candidate = firstNonEmptyValue($payload, [
        'flexion_readings',
        'flexionReadings',
        'finger_angles',
        'fingerAngles',
        'smoothedAngles',
        'angles'
    ]);

    return averageFromMixed($candidate);
}

$expectedToken = trim((string) getenv('THERAFLOW_IOT_TOKEN'));
$providedToken = (string) ($_SERVER['HTTP_X_IOT_TOKEN'] ?? '');
if ($providedToken === '') {
    $providedToken = (string) ($_GET['token'] ?? '');
}

if ($expectedToken !== '' && !hash_equals($expectedToken, $providedToken)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized hardware token']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'ok' => true,
        'endpoint' => 'sync_session',
        'status' => 'ready',
        'usage' => 'Send POST with application/json and patient_id to ingest sensor data'
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$payload = payloadArray();
$patientId = (int) ($payload['patient_id'] ?? $payload['patientId'] ?? 0);
if ($patientId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'patient_id is required']);
    exit;
}

$patientExistsStmt = $pdo->prepare('SELECT id FROM patients WHERE id = ? LIMIT 1');
$patientExistsStmt->execute([$patientId]);
if (!$patientExistsStmt->fetch()) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Patient not found']);
    exit;
}

$gripStrength = averageFromMixed(firstNonEmptyValue($payload, [
    'grip_readings',
    'gripReadings',
    'grip_values',
    'gripValues'
]));
if ($gripStrength === null) {
    $gripStrength = averageFromMixed(firstNonEmptyValue($payload, [
        'grip_strength',
        'gripStrength',
        'grip_percent',
        'gripPercent',
        'grip',
        'peakForce'
    ])) ?? 0.0;
}

$flexionAngle = angleSummary($payload);
if ($flexionAngle === null) {
    $flexionAngle = averageFromMixed(firstNonEmptyValue($payload, [
        'flexion_angle',
        'flexionAngle',
        'maxFlexion'
    ])) ?? 0.0;
}

$repetitions = (int) ($payload['repetitions'] ?? 0);
$status = trim((string) ($payload['status'] ?? 'Synced'));
$source = trim((string) (firstNonEmptyValue($payload, ['source']) ?? 'rehab_glove'));
if ($source === '') {
    $source = 'rehab_glove';
}

$note = trim((string) ($payload['note'] ?? 'Rehabilitation glove session'));
if ($note === '') {
    $note = 'Rehabilitation glove session';
}

$insertSession = $pdo->prepare(
    'INSERT INTO sessions (patient_id, grip_strength, flexion_angle, repetitions, source, status, note, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())'
);
$insertSession->execute([$patientId, $gripStrength, $flexionAngle, $repetitions, $source, $status, $note]);

echo json_encode([
    'ok' => true,
    'patient_id' => $patientId,
    'grip_strength' => round($gripStrength, 2),
    'flexion_angle' => round($flexionAngle, 2),
    'repetitions' => $repetitions,
    'savedAt' => date('Y-m-d H:i:s')
]);
