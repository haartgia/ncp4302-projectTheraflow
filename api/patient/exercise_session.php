<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/patient_data.php';
require_once __DIR__ . '/../lib/iot_data.php';

$patient = getCurrentPatient($pdo);
$patientId = (int) ($patient['id'] ?? 0);
if ($patientId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid patient context']);
    exit;
}

ensureSensorDataTable($pdo);
ensureSessionsTable($pdo);
ensureCalibrationCommandTable($pdo);

function parseFingerAnglesFromNote($note): ?array
{
    if (!is_string($note) || $note === '') {
        return null;
    }

    $marker = 'finger_angles=';
    $start = strpos($note, $marker);
    if ($start === false) {
        return null;
    }

    $json = trim(substr($note, $start + strlen($marker)));
    if ($json === '') {
        return null;
    }

    $decoded = json_decode($json, true);
    if (!is_array($decoded)) {
        return null;
    }

    return $decoded;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $plan = getPatientPlan($pdo, $patientId);

    $streamingStmt = $pdo->prepare(
        'SELECT id, grip_strength, flexion_angle, repetitions, source, status, note, recorded_at
         FROM sessions
         WHERE patient_id = ?
           AND source IN (?, ?)
           AND status = ?
           AND recorded_at >= DATE_SUB(NOW(), INTERVAL 20 SECOND)
         ORDER BY recorded_at DESC, id DESC
         LIMIT 1'
    );
    $streamingStmt->execute([$patientId, 'esp32_glove', 'rehab_glove', 'streaming']);
    $latest = $streamingStmt->fetch();
    if (is_array($latest)) {
        $latest['finger_angles'] = parseFingerAnglesFromNote((string) ($latest['note'] ?? ''));
    }

    $calibrationStmt = $pdo->prepare(
        'SELECT payload, completed_at, requested_at
         FROM iot_glove_commands
         WHERE patient_id = ?
           AND command = ?
           AND status = ?
         ORDER BY COALESCE(completed_at, requested_at) DESC, id DESC
         LIMIT 1'
    );
    $calibrationStmt->execute([$patientId, 'calibrate', 'completed']);
    $calibrationRow = $calibrationStmt->fetch(PDO::FETCH_ASSOC) ?: null;

    $calibrationProfile = null;
    if ($calibrationRow) {
        $decodedPayload = json_decode((string) ($calibrationRow['payload'] ?? '{}'), true);
        if (is_array($decodedPayload)) {
            $calibrationProfile = calibrationProfileFromPayload($decodedPayload);
            $calibrationProfile['completed_at'] = $calibrationRow['completed_at'] ?? $calibrationRow['requested_at'] ?? null;
        }
    }

    echo json_encode([
        'ok' => true,
        'patient' => [
            'id' => $patientId,
            'name' => (string) ($patient['name'] ?? 'Patient')
        ],
        'plan' => $plan,
        'lastReading' => $latest ?: null,
        'calibrationProfile' => $calibrationProfile
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    $payload = $_POST;
}

$peakForce = (float) ($payload['peakForce'] ?? 0);
$maxFlexion = (float) ($payload['maxFlexion'] ?? 0);
$repetitions = (int) ($payload['repetitions'] ?? 0);
$maxExtension = (float) ($payload['maxExtension'] ?? 0);
$status = trim((string) ($payload['status'] ?? 'Needs Work'));
$exerciseType = trim((string) ($payload['exerciseType'] ?? ''));
$durationSec = max(0, (int) ($payload['durationSec'] ?? 0));

$noteParts = [
    'Exercise Hub Session',
    'MaxExtension=' . number_format($maxExtension, 1, '.', ''),
    'Status=' . ($status !== '' ? $status : 'Needs Work')
];

if ($exerciseType !== '') {
    $noteParts[] = 'ExerciseType=' . $exerciseType;
}

if ($durationSec > 0) {
    $noteParts[] = 'DurationSec=' . $durationSec;
}

$note = implode(' | ', $noteParts);

$insert = $pdo->prepare(
    'INSERT INTO sensor_data (patient_id, grip_strength, flexion_angle, repetitions, note, recorded_at)
     VALUES (?, ?, ?, ?, ?, NOW())'
);
$insert->execute([$patientId, $peakForce, $maxFlexion, $repetitions, $note]);

$sessionInsert = $pdo->prepare(
    'INSERT INTO sessions (patient_id, grip_strength, flexion_angle, repetitions, source, status, note, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())'
);
$sessionInsert->execute([$patientId, $peakForce, $maxFlexion, $repetitions, 'exercise_hub', $status, $note]);

$updatePatient = $pdo->prepare('UPDATE patients SET last_session = NOW() WHERE id = ?');
$updatePatient->execute([$patientId]);

$savedAt = $pdo->query('SELECT NOW() AS ts')->fetch();

echo json_encode([
    'ok' => true,
    'savedAt' => $savedAt['ts'] ?? date('Y-m-d H:i:s')
]);
