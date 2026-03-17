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

$doctorName = '';
$doctorStmt = $pdo->prepare('SELECT full_name FROM doctors WHERE user_id = ? OR id = ? LIMIT 1');
$doctorStmt->execute([$doctorUserId, $doctorUserId]);
$doctorName = (string) ($doctorStmt->fetchColumn() ?: '');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $clinicalStmt = $pdo->prepare(
        'SELECT diagnosis, treatment_goal, reviewed_at
         FROM patient_clinical_data
         WHERE patient_id = ?
         ORDER BY reviewed_at DESC, id DESC
         LIMIT 1'
    );
    $clinicalStmt->execute([$patientId]);
    $clinical = $clinicalStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $strokeType = trim((string) ($patient['stroke_type'] ?? ''));
    $affectedHand = trim((string) ($patient['affected_hand'] ?? ''));
    $fallbackDiagnosis = $strokeType !== ''
        ? ($affectedHand !== '' ? $strokeType . ' (' . $affectedHand . ' hand)' : $strokeType)
        : 'Pending clinical intake';

    echo json_encode([
        'ok' => true,
        'clinical' => [
            'diagnosis' => (string) ($clinical['diagnosis'] ?? $fallbackDiagnosis),
            'treatment_goal' => (string) ($clinical['treatment_goal'] ?? 'Initial evaluation pending.'),
            'reviewed_at' => (string) ($clinical['reviewed_at'] ?? 'Not yet reviewed'),
            'assigned_doctor' => $doctorName !== '' ? $doctorName : 'Assigned Doctor'
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

$insert = $pdo->prepare(
    'INSERT INTO patient_clinical_data (patient_id, doctor_id, diagnosis, treatment_goal, reviewed_at)
     VALUES (?, ?, ?, ?, NOW())'
);
$insert->execute([$patientId, $doctorUserId, $diagnosis, $treatmentGoal]);

$savedAt = $pdo->query('SELECT NOW() AS ts')->fetch();

echo json_encode([
    'ok' => true,
    'reviewed_at' => $savedAt['ts'] ?? date('Y-m-d H:i:s')
]);
