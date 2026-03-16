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

function resolveDoctorTeamName(PDO $pdo, array $patient): string
{
    $defaultName = 'Dr. Care Team';
    $doctorId = 0;

    foreach (['doctor_id', 'assigned_doctor_id'] as $key) {
        if (isset($patient[$key]) && (int) $patient[$key] > 0) {
            $doctorId = (int) $patient[$key];
            break;
        }
    }

    if ($doctorId <= 0) {
        return $defaultName;
    }

    try {
        $doctorCols = [];
        $describe = $pdo->query('DESCRIBE doctors');
        foreach ($describe->fetchAll() as $row) {
            if (isset($row['Field'])) {
                $doctorCols[] = strtolower((string) $row['Field']);
            }
        }

        $idCol = in_array('id', $doctorCols, true)
            ? 'id'
            : (in_array('doctor_id', $doctorCols, true) ? 'doctor_id' : null);

        if ($idCol === null) {
            return $defaultName;
        }

        $nameCol = null;
        foreach (['full_name', 'display_name', 'name'] as $candidate) {
            if (in_array($candidate, $doctorCols, true)) {
                $nameCol = $candidate;
                break;
            }
        }

        if ($nameCol === null) {
            return $defaultName;
        }

        $stmt = $pdo->prepare('SELECT ' . $nameCol . ' AS doctor_name FROM doctors WHERE ' . $idCol . ' = ? LIMIT 1');
        $stmt->execute([$doctorId]);
        $row = $stmt->fetch();
        $rawName = trim((string) ($row['doctor_name'] ?? ''));
        if ($rawName === '') {
            return $defaultName;
        }

        if (!preg_match('/^dr\.?\s+/i', $rawName)) {
            $rawName = 'Dr. ' . $rawName;
        }

        return $rawName;
    } catch (Throwable $e) {
        return $defaultName;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare(
        'SELECT id, sender, body, is_read, created_at
         FROM messages
         WHERE patient_id = ?
         ORDER BY created_at ASC'
    );
    $stmt->execute([$patientId]);
    $rows = $stmt->fetchAll();

    $messages = [];
    $latestDoctorNote = null;
    $unreadDoctor = 0;

    foreach ($rows as $row) {
        $sender = (string) ($row['sender'] ?? 'doctor');
        $body = (string) ($row['body'] ?? '');
        $isRead = (int) ($row['is_read'] ?? 0);

        if ($sender === 'doctor' && $isRead === 0) {
            $unreadDoctor += 1;
        }

        if ($sender === 'doctor' && trim($body) !== '') {
            $latestDoctorNote = [
                'text' => $body,
                'created_at' => (string) ($row['created_at'] ?? '')
            ];
        }

        $messages[] = [
            'id' => (int) ($row['id'] ?? 0),
            'from' => $sender,
            'text' => $body,
            'created_at' => (string) ($row['created_at'] ?? '')
        ];
    }

    if ($unreadDoctor > 0) {
        $markRead = $pdo->prepare('UPDATE messages SET is_read = 1 WHERE patient_id = ? AND sender = ? AND is_read = 0');
        $markRead->execute([$patientId, 'doctor']);
    }

    echo json_encode([
        'ok' => true,
        'conversation' => [
            'name' => resolveDoctorTeamName($pdo, $patient),
            'messages' => $messages
        ],
        'latestDoctorNote' => $latestDoctorNote
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

$body = trim((string) ($payload['body'] ?? ''));
if ($body === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Message body is required']);
    exit;
}

$insert = $pdo->prepare('INSERT INTO messages (patient_id, sender, body, is_read) VALUES (?, ?, ?, 0)');
$insert->execute([$patientId, 'patient', $body]);

echo json_encode(['ok' => true]);
