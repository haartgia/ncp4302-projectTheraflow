<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/patient_data.php';

$patient = getCurrentPatient($pdo);
$patientId = (int) ($patient['id'] ?? 0);
if ($patientId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid patient context']);
    exit;
}

ensureSensorDataTable($pdo);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $plan = getPatientPlan($pdo, $patientId);

    $latestStmt = $pdo->prepare(
        'SELECT grip_strength, flexion_angle, repetitions, note, recorded_at
         FROM sensor_data
         WHERE patient_id = ?
         ORDER BY recorded_at DESC
         LIMIT 1'
    );
    $latestStmt->execute([$patientId]);
    $latest = $latestStmt->fetch();

    echo json_encode([
        'ok' => true,
        'patient' => [
            'id' => $patientId,
            'name' => (string) ($patient['name'] ?? 'Patient')
        ],
        'plan' => $plan,
        'lastReading' => $latest ?: null
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

$noteParts = [
    'Exercise Hub Session',
    'MaxExtension=' . number_format($maxExtension, 1, '.', ''),
    'Status=' . ($status !== '' ? $status : 'Needs Work')
];
$note = implode(' | ', $noteParts);

$insert = $pdo->prepare(
    'INSERT INTO sensor_data (patient_id, grip_strength, flexion_angle, repetitions, note, recorded_at)
     VALUES (?, ?, ?, ?, ?, NOW())'
);
$insert->execute([$patientId, $peakForce, $maxFlexion, $repetitions, $note]);

$savedAt = $pdo->query('SELECT NOW() AS ts')->fetch();

echo json_encode([
    'ok' => true,
    'savedAt' => $savedAt['ts'] ?? date('Y-m-d H:i:s')
]);
