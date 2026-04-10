<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/patient_data.php';

function resolveTableName(PDO $pdo, array $candidates): ?string
{
    foreach ($candidates as $tableName) {
        try {
            $probe = $pdo->query('SELECT 1 FROM ' . $tableName . ' LIMIT 1');
            if ($probe !== false) {
                return $tableName;
            }
        } catch (Throwable $e) {
            // Try next candidate.
        }
    }

    return null;
}

function getTableColumns(PDO $pdo, string $tableName): array
{
    $columns = [];
    $stmt = $pdo->query('DESCRIBE ' . $tableName);
    foreach ($stmt->fetchAll() as $row) {
        if (isset($row['Field'])) {
            $columns[] = strtolower((string) $row['Field']);
        }
    }
    return $columns;
}

function verifyPasswordCompat(string $input, string $storedHashOrPlain): array
{
    if ($storedHashOrPlain !== '' && password_verify($input, $storedHashOrPlain)) {
        return ['ok' => true, 'rehash' => password_needs_rehash($storedHashOrPlain, PASSWORD_DEFAULT)];
    }

    if ($storedHashOrPlain !== '' && hash_equals($storedHashOrPlain, $input)) {
        return ['ok' => true, 'rehash' => true];
    }

    return ['ok' => false, 'rehash' => false];
}

$patient = getCurrentPatient($pdo);
$patientId = (int) ($patient['id'] ?? 0);
$userId = (int) ($_SESSION['user_id'] ?? 0);

if ($patientId <= 0 || $userId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid patient context']);
    exit;
}

$usersTable = resolveTableName($pdo, ['theraflowusers_db.users', 'users', 'theraflow_db.users']);
$usersColumns = $usersTable ? getTableColumns($pdo, $usersTable) : [];
$passwordColumn = in_array('password', $usersColumns, true) ? 'password' : (in_array('password_hash', $usersColumns, true) ? 'password_hash' : null);
$emailColumn = in_array('email', $usersColumns, true) ? 'email' : null;
$idColumn = in_array('user_id', $usersColumns, true) ? 'user_id' : (in_array('id', $usersColumns, true) ? 'id' : null);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $email = '';
    if ($usersTable && $emailColumn && $idColumn) {
        $emailStmt = $pdo->prepare('SELECT ' . $emailColumn . ' FROM ' . $usersTable . ' WHERE ' . $idColumn . ' = ? LIMIT 1');
        $emailStmt->execute([$userId]);
        $email = (string) ($emailStmt->fetchColumn() ?: '');
    }

    echo json_encode([
        'ok' => true,
        'profile' => [
            'name' => (string) ($patient['name'] ?? ''),
            'email' => $email,
            'username' => (string) ($patient['username'] ?? '')
        ]
    ]);
    exit;
}

if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PATCH', 'PUT'], true)) {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    $payload = $_POST;
}

$name = trim((string) ($payload['name'] ?? ($patient['name'] ?? '')));
$contact = trim((string) ($payload['email'] ?? $payload['contact'] ?? ($patient['contact'] ?? '')));
$currentPassword = (string) ($payload['currentPassword'] ?? '');
$newPassword = (string) ($payload['newPassword'] ?? '');

if ($name === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Name is required']);
    exit;
}

$updatePatient = $pdo->prepare('UPDATE patients SET name = ?, contact = ? WHERE id = ?');
$updatePatient->execute([$name, $contact !== '' ? $contact : null, $patientId]);

$syncStatus = 'Saved changes.';

if ($usersTable && $emailColumn && $idColumn) {
    $updateUser = $pdo->prepare('UPDATE ' . $usersTable . ' SET ' . $emailColumn . ' = ?, first_name = ? WHERE ' . $idColumn . ' = ?');
    $updateUser->execute([
        $contact !== '' ? $contact : (string) ($email ?? ''),
        $name,
        $userId
    ]);
} else {
    $syncStatus = 'Sync pending: account store unavailable.';
}

try {
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS patient_sync_events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT NOT NULL,
            user_id INT NOT NULL,
            event_type VARCHAR(40) NOT NULL,
            payload JSON NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $syncPayload = json_encode([
        'name' => $name,
        'email' => $contact !== '' ? $contact : (string) ($email ?? '')
    ]);
    $syncInsert = $pdo->prepare('INSERT INTO patient_sync_events (patient_id, user_id, event_type, payload) VALUES (?, ?, ?, ?)');
    $syncInsert->execute([$patientId, $userId, 'profile_sync', $syncPayload]);
} catch (Throwable $e) {
    $syncStatus = 'Sync pending: event log unavailable.';
}

if ($newPassword !== '') {
    if (strlen($newPassword) < 6) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'New password must be at least 6 characters']);
        exit;
    }

    if (!$usersTable || !$passwordColumn || !$idColumn) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Account password store is not available']);
        exit;
    }

    $currentStmt = $pdo->prepare('SELECT ' . $passwordColumn . ' FROM ' . $usersTable . ' WHERE ' . $idColumn . ' = ? LIMIT 1');
    $currentStmt->execute([$userId]);
    $storedHash = (string) ($currentStmt->fetchColumn() ?: '');

    $credential = verifyPasswordCompat($currentPassword, $storedHash);
    if (!$credential['ok']) {
        try {
            $patientPasswordHash = (string) ($patient['password_hash'] ?? '');
            $credential = verifyPasswordCompat($currentPassword, $patientPasswordHash);
            if ($credential['ok'] && $storedHash === '') {
                $storedHash = $patientPasswordHash;
            }
        } catch (Throwable $e) {
            $credential = ['ok' => false, 'rehash' => false];
        }
    }

    if (!$credential['ok']) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Current password is incorrect']);
        exit;
    }

    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $updatePassword = $pdo->prepare('UPDATE ' . $usersTable . ' SET ' . $passwordColumn . ' = ? WHERE ' . $idColumn . ' = ?');
    $updatePassword->execute([$newHash, $userId]);

    try {
        $patientPassColumns = patientTableColumns($pdo);
        if (in_array('password_hash', $patientPassColumns, true)) {
            $updatePatientHash = $pdo->prepare('UPDATE patients SET password_hash = ? WHERE id = ?');
            $updatePatientHash->execute([$newHash, $patientId]);
        }
    } catch (Throwable $e) {
        // Keep users table as source of truth if patient table update fails.
    }
}

echo json_encode([
    'ok' => true,
    'profile' => [
        'name' => $name,
        'email' => $contact !== '' ? $contact : (string) ($email ?? '')
    ],
    'syncStatus' => $syncStatus
]);
