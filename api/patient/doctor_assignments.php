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

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS doctor_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        duration_min INT NOT NULL DEFAULT 15,
        target_repetitions INT NOT NULL DEFAULT 120,
        exercise_type VARCHAR(120) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_doctor_assignments_patient_id (patient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT duration_min, target_repetitions, exercise_type
     FROM doctor_assignments
     WHERE patient_id = ?
     LIMIT 1'
);
$stmt->execute([$patientId]);
$assignment = $stmt->fetch(PDO::FETCH_ASSOC);
$source = "doctor";

if (!$assignment) {
    $plan = getPatientPlan($pdo, $patientId);
    $assignment = [
        'duration_min' => (int) ($plan['duration_min'] ?? 15),
        'target_repetitions' => (int) ($plan['target_repetitions'] ?? 120),
        'exercise_type' => (string) ($plan['template_name'] ?? 'Active Grip')
    ];
    $source = "default";
}

$assignment['duration_min'] = (int) ($assignment['duration_min'] ?? 15);
$assignment['target_repetitions'] = (int) ($assignment['target_repetitions'] ?? 120);
$assignment['exercise_type'] = (string) ($assignment['exercise_type'] ?? 'Active Grip');

echo json_encode([
    'ok' => true,
    'plan' => $assignment,
    'source' => $source
]);
