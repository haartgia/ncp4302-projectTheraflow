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
    'CREATE TABLE IF NOT EXISTS patient_clinical_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        doctor_id INT NULL,
        diagnosis VARCHAR(255) NULL,
        treatment_goal VARCHAR(255) NULL,
        reviewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_clinical_patient_id (patient_id),
        INDEX idx_clinical_reviewed_at (reviewed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$clinicalStmt = $pdo->prepare(
    'SELECT diagnosis, treatment_goal, reviewed_at, doctor_id
     FROM patient_clinical_data
     WHERE patient_id = ?
     ORDER BY reviewed_at DESC, id DESC
     LIMIT 1'
);
$clinicalStmt->execute([$patientId]);
$clinical = $clinicalStmt->fetch(PDO::FETCH_ASSOC) ?: [];

$doctorId = (int) ($clinical['doctor_id'] ?? $patient['doctor_id'] ?? 0);
$doctorName = '';
if ($doctorId > 0) {
    $doctorStmt = $pdo->prepare('SELECT full_name FROM doctors WHERE id = ? OR user_id = ? LIMIT 1');
    $doctorStmt->execute([$doctorId, $doctorId]);
    $doctorName = (string) ($doctorStmt->fetchColumn() ?: '');
}

$reviewedAt = (string) ($clinical['reviewed_at'] ?? '');
$diagnosis = (string) ($clinical['diagnosis'] ?? '');
$treatmentGoal = (string) ($clinical['treatment_goal'] ?? '');
$plan = getPatientPlan($pdo, $patientId);
$fallbackDiagnosis = '';
if ($diagnosis === '') {
    $strokeType = trim((string) ($patient['stroke_type'] ?? ''));
    $affectedHand = trim((string) ($patient['affected_hand'] ?? ''));
    if ($strokeType !== '') {
        $fallbackDiagnosis = $affectedHand !== ''
            ? $strokeType . ' (' . $affectedHand . ' hand)'
            : $strokeType;
    }
}

if ($reviewedAt === '') {
    $reviewedAt = 'Not yet reviewed';
}
if ($diagnosis === '') {
    $diagnosis = $fallbackDiagnosis !== '' ? $fallbackDiagnosis : 'Pending clinical intake';
}
if ($treatmentGoal === '' || strtolower($treatmentGoal) === 'pending provider update') {
    $planName = trim((string) ($plan['template_name'] ?? ''));
    $duration = (int) ($plan['duration_min'] ?? 0);
    $reps = (int) ($plan['target_repetitions'] ?? 0);
    if ($planName !== '' && ($duration > 0 || $reps > 0)) {
        $parts = [$planName];
        if ($duration > 0) {
            $parts[] = $duration . ' min';
        }
        if ($reps > 0) {
            $parts[] = $reps . ' reps';
        }
        $treatmentGoal = implode(' · ', $parts);
    } else {
        $treatmentGoal = 'Pending provider update';
    }
}
if ($doctorName === '') {
    $doctorName = 'Not assigned';
}

echo json_encode([
    'ok' => true,
    'patient' => [
        'age' => isset($patient['age']) ? (int) $patient['age'] : null
    ],
    'clinical' => [
        'diagnosis' => $diagnosis,
        'treatment_goal' => $treatmentGoal,
        'reviewed_at' => $reviewedAt,
        'assigned_doctor' => $doctorName
    ]
]);
