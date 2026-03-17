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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$planStmt = $pdo->prepare(
    'SELECT template_name, duration_min, target_repetitions, sessions_per_day
     FROM therapy_plans
     WHERE patient_id = ?
     LIMIT 1'
);
$planStmt->execute([$patientId]);
$planRow = $planStmt->fetch(PDO::FETCH_ASSOC);

if ($planRow) {
    $plan = $planRow;
    $source = 'doctor';
} else {
    $plan = getPatientPlan($pdo, $patientId);
    $source = 'default';
}

$plan = [
    'template_name' => (string) ($plan['template_name'] ?? 'Therapy'),
    'duration_min' => (int) ($plan['duration_min'] ?? 0),
    'target_repetitions' => (int) ($plan['target_repetitions'] ?? 0),
    'sessions_per_day' => (int) ($plan['sessions_per_day'] ?? 1)
];

echo json_encode([
    'ok' => true,
    'plan' => $plan,
    'source' => $source
]);
