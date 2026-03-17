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
    'CREATE TABLE IF NOT EXISTS recovery_progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        avg_grip_strength DECIMAL(6,2) NULL,
        avg_flexion DECIMAL(6,2) NULL,
        avg_extension DECIMAL(6,2) NULL,
        recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_recovery_patient_id (patient_id),
        INDEX idx_recovery_recorded_at (recorded_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    $payload = $_POST;
}

$avgGrip = (float) ($payload['avgGripStrength'] ?? 0);
$avgFlex = (float) ($payload['avgFlexion'] ?? 0);
$avgExt = (float) ($payload['avgExtension'] ?? 0);

$stmt = $pdo->prepare(
    'INSERT INTO recovery_progress (patient_id, avg_grip_strength, avg_flexion, avg_extension)
     VALUES (?, ?, ?, ?)'
);
$stmt->execute([$patientId, $avgGrip, $avgFlex, $avgExt]);

$savedAt = $pdo->query('SELECT NOW() AS ts')->fetch();

echo json_encode([
    'ok' => true,
    'savedAt' => $savedAt['ts'] ?? date('Y-m-d H:i:s')
]);
