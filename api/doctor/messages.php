<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/doctor_data.php';

$doctorId = requireDoctorSessionOrExit();
$patients = getDoctorPatients($pdo, $doctorId);
$patientMap = [];
foreach ($patients as $patient) {
    $patientMap[(int) $patient['id']] = (string) ($patient['name'] ?? 'Patient');
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $conversations = [];

    $msgStmt = $pdo->prepare(
        'SELECT id, patient_id, sender, body, is_read, created_at
         FROM messages
         WHERE patient_id = ?
         ORDER BY created_at ASC'
    );

    foreach ($patientMap as $patientId => $patientName) {
        $msgStmt->execute([$patientId]);
        $messages = $msgStmt->fetchAll();
        $unread = 0;
        $mapped = [];

        foreach ($messages as $row) {
            $from = (string) ($row['sender'] ?? 'doctor');
            if ($from === 'patient' && (int) ($row['is_read'] ?? 0) === 0) {
                $unread += 1;
            }
            $mapped[] = [
                'id' => (int) ($row['id'] ?? 0),
                'from' => $from,
                'text' => (string) ($row['body'] ?? ''),
                'created_at' => $row['created_at']
            ];
        }

        $conversations[] = [
            'id' => 'patient-' . $patientId,
            'patientId' => $patientId,
            'name' => $patientName,
            'unread' => $unread,
            'messages' => $mapped
        ];
    }

    echo json_encode(['ok' => true, 'conversations' => $conversations]);
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
$body = trim((string) ($payload['body'] ?? ''));
if ($patientId <= 0 || $body === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid message payload']);
    exit;
}

if (!array_key_exists($patientId, $patientMap)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'You do not have access to this patient']);
    exit;
}

$insert = $pdo->prepare('INSERT INTO messages (patient_id, sender, body, is_read) VALUES (?, ?, ?, 1)');
$insert->execute([$patientId, 'doctor', $body]);

echo json_encode(['ok' => true]);
