<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/doctor_data.php';

$doctorId = requireDoctorSessionOrExit();
$patients = getDoctorPatients($pdo, $doctorId);
ensureDefaultTherapyPlanRows($pdo, $patients);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = [];
    $stmt = $pdo->prepare(
        'SELECT p.id AS patient_id, p.name AS patient_name, tp.template_name, tp.duration_min, tp.target_repetitions, tp.sessions_per_day
         FROM patients p
         LEFT JOIN therapy_plans tp ON tp.patient_id = p.id
         WHERE p.doctor_id = ?
         ORDER BY p.name ASC'
    );
    $stmt->execute([$doctorId]);
    $rows = $stmt->fetchAll();

    echo json_encode(['ok' => true, 'assignments' => $rows]);
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

$patientId = (int) ($payload['patientId'] ?? 0);
$templateName = trim((string) ($payload['templateName'] ?? 'Custom'));
$duration = (int) ($payload['durationMin'] ?? 0);
$repetitions = (int) ($payload['targetRepetitions'] ?? 0);
$sessions = (int) ($payload['sessionsPerDay'] ?? 0);

if ($patientId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid patient']);
    exit;
}

$ownsPatient = $pdo->prepare('SELECT id FROM patients WHERE id = ? AND doctor_id = ? LIMIT 1');
$ownsPatient->execute([$patientId, $doctorId]);
if (!$ownsPatient->fetch()) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'You do not have access to this patient']);
    exit;
}

$upsert = $pdo->prepare(
    'INSERT INTO therapy_plans (patient_id, template_name, duration_min, target_repetitions, sessions_per_day)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       template_name = VALUES(template_name),
       duration_min = VALUES(duration_min),
       target_repetitions = VALUES(target_repetitions),
       sessions_per_day = VALUES(sessions_per_day)'
);
$upsert->execute([$patientId, $templateName, $duration, $repetitions, $sessions]);

echo json_encode(['ok' => true]);
