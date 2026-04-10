<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';

if (!isset($_SESSION['role']) || strtolower((string) $_SESSION['role']) !== 'doctor' || !isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

$doctorUserId = (int) $_SESSION['user_id'];

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS patient_metadata (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        diagnosis VARCHAR(255) NULL,
        treatment_goal VARCHAR(255) NULL,
        doctor_notes TEXT NULL,
        updated_by_doctor_id INT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_patient_metadata_patient_id (patient_id),
        INDEX idx_patient_metadata_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);

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

$patientId = 0;
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $patientId = (int) ($_GET['patientId'] ?? 0);
} else {
    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        $payload = $_POST;
    }
    $patientId = (int) ($payload['patientId'] ?? 0);
}

if ($patientId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid patient id']);
    exit;
}

$patientStmt = $pdo->prepare('SELECT id, doctor_id, stroke_type, affected_hand FROM patients WHERE id = ? LIMIT 1');
$patientStmt->execute([$patientId]);
$patient = $patientStmt->fetch(PDO::FETCH_ASSOC);
if (!$patient || (int) ($patient['doctor_id'] ?? 0) !== $doctorUserId) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Access denied']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $metadataStmt = $pdo->prepare(
        'SELECT diagnosis, treatment_goal, doctor_notes, updated_at
         FROM patient_metadata
         WHERE patient_id = ?
         LIMIT 1'
    );
    $metadataStmt->execute([$patientId]);
    $metadata = $metadataStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    if (!$metadata) {
        $clinicalFallbackStmt = $pdo->prepare(
            'SELECT diagnosis, treatment_goal, reviewed_at
             FROM patient_clinical_data
             WHERE patient_id = ?
             ORDER BY reviewed_at DESC, id DESC
             LIMIT 1'
        );
        $clinicalFallbackStmt->execute([$patientId]);
        $legacy = $clinicalFallbackStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        if ($legacy) {
            $metadata = [
                'diagnosis' => (string) ($legacy['diagnosis'] ?? ''),
                'treatment_goal' => (string) ($legacy['treatment_goal'] ?? ''),
                'doctor_notes' => '',
                'updated_at' => (string) ($legacy['reviewed_at'] ?? '')
            ];
        }
    }

    $strokeType = trim((string) ($patient['stroke_type'] ?? ''));
    $affectedHand = trim((string) ($patient['affected_hand'] ?? ''));
    $fallbackDiagnosis = $strokeType !== ''
        ? ($affectedHand !== '' ? $strokeType . ' (' . $affectedHand . ' hand)' : $strokeType)
        : 'Pending clinical intake';

    echo json_encode([
        'ok' => true,
        'clinical' => [
            'diagnosis' => (string) ($metadata['diagnosis'] ?? $fallbackDiagnosis),
            'treatment_goal' => (string) ($metadata['treatment_goal'] ?? 'Initial evaluation pending.'),
            'doctor_notes' => (string) ($metadata['doctor_notes'] ?? ''),
            'updated_at' => (string) ($metadata['updated_at'] ?? 'Not yet reviewed')
        ]
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

$diagnosis = trim((string) ($payload['diagnosis'] ?? ''));
$treatmentGoal = trim((string) ($payload['treatmentGoal'] ?? ''));
$doctorNotes = trim((string) ($payload['doctorNotes'] ?? ''));

$diagnosisLimit = 50;
$treatmentGoalLimit = 50;
$doctorNotesLimit = 200;

$diagnosisLength = function_exists('mb_strlen') ? mb_strlen($diagnosis, 'UTF-8') : strlen($diagnosis);
$treatmentGoalLength = function_exists('mb_strlen') ? mb_strlen($treatmentGoal, 'UTF-8') : strlen($treatmentGoal);
$doctorNotesLength = function_exists('mb_strlen') ? mb_strlen($doctorNotes, 'UTF-8') : strlen($doctorNotes);

if ($diagnosisLength > $diagnosisLimit) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Diagnosis must be 50 characters or fewer.']);
    exit;
}

if ($treatmentGoalLength > $treatmentGoalLimit) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Treatment goal must be 50 characters or fewer.']);
    exit;
}

if ($doctorNotesLength > $doctorNotesLimit) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Doctor notes must be 200 characters or fewer.']);
    exit;
}

$upsert = $pdo->prepare(
    'INSERT INTO patient_metadata (patient_id, diagnosis, treatment_goal, doctor_notes, updated_by_doctor_id, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
        diagnosis = VALUES(diagnosis),
        treatment_goal = VALUES(treatment_goal),
        doctor_notes = VALUES(doctor_notes),
        updated_by_doctor_id = VALUES(updated_by_doctor_id),
        updated_at = NOW()'
);
$upsert->execute([$patientId, $diagnosis, $treatmentGoal, $doctorNotes, $doctorUserId]);

$savedAt = $pdo->query('SELECT NOW() AS ts')->fetch();

echo json_encode([
    'ok' => true,
    'updated_at' => $savedAt['ts'] ?? date('Y-m-d H:i:s')
]);
