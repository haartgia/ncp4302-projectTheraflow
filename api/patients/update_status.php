<?php
session_start();

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/doctor_data.php';

$doctorId = requireDoctorSessionOrExit();

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    $payload = $_POST;
}

$patientId = (int) ($payload['patientId'] ?? 0);
$status = trim((string) ($payload['status'] ?? ''));

if (strcasecmp($status, 'Stable') === 0) {
    $status = 'Recovering';
}

$allowedStatuses = ['Recovering', 'At Risk', 'Recovered'];
if ($patientId <= 0 || !in_array($status, $allowedStatuses, true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid patient or status']);
    exit;
}

$ownsPatient = $pdo->prepare('SELECT id FROM patients WHERE id = ? AND doctor_id = ? LIMIT 1');
$ownsPatient->execute([$patientId, $doctorId]);
if (!$ownsPatient->fetch()) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'You do not have access to this patient']);
    exit;
}

$update = $pdo->prepare('UPDATE patients SET status = ? WHERE id = ? AND doctor_id = ? LIMIT 1');
$update->execute([$status, $patientId, $doctorId]);

echo json_encode(['ok' => true, 'status' => $status]);
