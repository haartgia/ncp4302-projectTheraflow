<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/patient_data.php';

$patient   = getCurrentPatient($pdo);
$patientId = (int) ($patient['id'] ?? 0);
if ($patientId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid patient context']);
    exit;
}

// Ensure the diagnostic_logs table exists
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS diagnostic_logs (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        patient_id    INT          NOT NULL,
        max_extension DECIMAL(6,2) DEFAULT 0,
        max_flexion   DECIMAL(6,2) DEFAULT 0,
        peak_force    DECIMAL(6,2) DEFAULT 0,
        logged_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_dl_pid (patient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = json_decode(file_get_contents('php://input'), true);
    if (!is_array($raw)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid request body']);
        exit;
    }

    $maxExt    = (float) ($raw['maxExtension'] ?? 0);
    $maxFlex   = (float) ($raw['maxFlexion']   ?? 0);
    $peakForce = (float) ($raw['peakForce']    ?? 0);

    $stmt = $pdo->prepare(
        'INSERT INTO diagnostic_logs (patient_id, max_extension, max_flexion, peak_force)
         VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$patientId, $maxExt, $maxFlex, $peakForce]);

    $plan = getPatientPlan($pdo, $patientId);

    echo json_encode([
        'ok'               => true,
        'id'               => (int) $pdo->lastInsertId(),
        'targetRepetitions' => (int) ($plan['target_repetitions'] ?? 120)
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT id, max_extension, max_flexion, peak_force, logged_at
     FROM diagnostic_logs
     WHERE patient_id = ?
     ORDER BY logged_at DESC
     LIMIT 20'
);
$stmt->execute([$patientId]);

echo json_encode(['ok' => true, 'logs' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
