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

function ensurePatientSettingsColumns(PDO $pdo): void
{
    $columns = patientTableColumns($pdo);
    if (!in_array('backup_email', $columns, true)) {
        $pdo->exec('ALTER TABLE patients ADD COLUMN backup_email VARCHAR(255) NULL AFTER contact');
    }
}

function isValidEmail(string $value): bool
{
    return filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
}

function isValidBackupContact(string $value): bool
{
    if ($value === '') {
        return true;
    }

    $compact = str_replace(' ', '', $value);
    if (preg_match('/^\+?\d{7,15}$/', $compact) === 1) {
        return true;
    }

    return filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
}

function isValidUsername(string $value): bool
{
    return preg_match('/^[A-Za-z0-9_.-]{3,50}$/', $value) === 1;
}

$patient = getCurrentPatient($pdo);
$patientId = (int) ($patient['id'] ?? 0);
$userId = (int) ($_SESSION['user_id'] ?? 0);

if ($patientId <= 0 || $userId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid patient context']);
    exit;
}

ensurePatientSettingsColumns($pdo);
$patientColumns = patientTableColumns($pdo);

$usersTable = resolveTableName($pdo, ['theraflowusers_db.users', 'users', 'theraflow_db.users']);
$usersColumns = $usersTable ? getTableColumns($pdo, $usersTable) : [];
$passwordColumn = in_array('password', $usersColumns, true) ? 'password' : (in_array('password_hash', $usersColumns, true) ? 'password_hash' : null);
$emailColumn = in_array('email', $usersColumns, true) ? 'email' : null;
$usernameColumn = in_array('username', $usersColumns, true) ? 'username' : null;
$idColumn = in_array('user_id', $usersColumns, true) ? 'user_id' : (in_array('id', $usersColumns, true) ? 'id' : null);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $username = trim((string) ($patient['username'] ?? ''));
    if ($usersTable && $usernameColumn && $idColumn && $username === '') {
        $usernameStmt = $pdo->prepare('SELECT ' . $usernameColumn . ' FROM ' . $usersTable . ' WHERE ' . $idColumn . ' = ? LIMIT 1');
        $usernameStmt->execute([$userId]);
        $username = trim((string) ($usernameStmt->fetchColumn() ?: ''));
    }

    echo json_encode([
        'ok' => true,
        'profile' => [
            'phone' => trim((string) ($patient['contact'] ?? '')),
            'backup_contact' => in_array('backup_email', $patientColumns, true) ? trim((string) ($patient['backup_email'] ?? '')) : '',
            'username' => $username
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

$phone = trim((string) ($payload['phone'] ?? $payload['contact'] ?? ($patient['contact'] ?? '')));
$backupContact = trim((string) ($payload['backupContact'] ?? $payload['backup_contact'] ?? ($patient['backup_email'] ?? '')));
$username = trim((string) ($payload['username'] ?? ($patient['username'] ?? '')));
$currentPassword = (string) ($payload['currentPassword'] ?? '');
$newPassword = (string) ($payload['newPassword'] ?? '');

if ($phone === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Email address is required']);
    exit;
}

if (!isValidEmail($phone)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Email address must be valid']);
    exit;
}

if ($backupContact !== '' && strlen($backupContact) > 255) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Backup contact must be 255 characters or fewer']);
    exit;
}

if (!isValidBackupContact($backupContact)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Backup contact must be a valid phone number or email address']);
    exit;
}

if ($username === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Username is required']);
    exit;
}

if (!isValidUsername($username)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Username must be 3 to 50 chars using letters, numbers, ., _, or -']);
    exit;
}

$existingUsernameStmt = $pdo->prepare('SELECT id FROM patients WHERE username = ? AND id <> ? LIMIT 1');
$existingUsernameStmt->execute([$username, $patientId]);
if ($existingUsernameStmt->fetch()) {
    http_response_code(409);
    echo json_encode(['ok' => false, 'error' => 'Username already taken']);
    exit;
}

if ($usersTable && $emailColumn && $idColumn) {
    $existingEmailStmt = $pdo->prepare('SELECT ' . $idColumn . ' FROM ' . $usersTable . ' WHERE ' . $emailColumn . ' = ? AND ' . $idColumn . ' <> ? LIMIT 1');
    $existingEmailStmt->execute([strtolower($phone), $userId]);
    if ($existingEmailStmt->fetch()) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'error' => 'Email already exists']);
        exit;
    }
}

if ($newPassword !== '') {
    if (strlen($newPassword) < 6 || !preg_match('/[A-Z]/', $newPassword) || !preg_match('/\d/', $newPassword) || !preg_match('/[^A-Za-z0-9]/', $newPassword)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'New password must be at least 6 characters and include 1 uppercase letter, 1 number, and 1 special character']);
        exit;
    }

    if ($currentPassword === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Current password is required to set a new password']);
        exit;
    }

    if (!$usersTable || !$passwordColumn || !$idColumn) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Account password store is not available']);
        exit;
    }
}

$syncStatus = 'Saved changes.';

try {
    $pdo->beginTransaction();

    if (in_array('backup_email', $patientColumns, true)) {
        $updatePatient = $pdo->prepare('UPDATE patients SET contact = ?, backup_email = ?, username = ? WHERE id = ?');
        $updatePatient->execute([$phone, $backupContact !== '' ? $backupContact : null, $username, $patientId]);
    } else {
        $updatePatient = $pdo->prepare('UPDATE patients SET contact = ?, username = ? WHERE id = ?');
        $updatePatient->execute([$phone, $username, $patientId]);
    }

    if ($usersTable && $idColumn) {
        $userUpdateParts = [];
        $userUpdateValues = [];

        if ($emailColumn) {
            $userUpdateParts[] = $emailColumn . ' = ?';
            $userUpdateValues[] = strtolower($phone);
        }

        if ($usernameColumn) {
            $userUpdateParts[] = $usernameColumn . ' = ?';
            $userUpdateValues[] = $username;
        }

        if ($userUpdateParts) {
            $userUpdateValues[] = $userId;
            $updateUser = $pdo->prepare('UPDATE ' . $usersTable . ' SET ' . implode(', ', $userUpdateParts) . ' WHERE ' . $idColumn . ' = ?');
            $updateUser->execute($userUpdateValues);
        }
    } else {
        $syncStatus = 'Sync pending: account store unavailable.';
    }

    if ($newPassword !== '') {

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
            throw new RuntimeException('Current password is incorrect');
        }

        $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $updatePassword = $pdo->prepare('UPDATE ' . $usersTable . ' SET ' . $passwordColumn . ' = ? WHERE ' . $idColumn . ' = ?');
        $updatePassword->execute([$newHash, $userId]);

        try {
            if (in_array('password_hash', $patientColumns, true)) {
                $updatePatientHash = $pdo->prepare('UPDATE patients SET password_hash = ? WHERE id = ?');
                $updatePatientHash->execute([$newHash, $patientId]);
            }
        } catch (Throwable $e) {
            // Keep users table as source of truth if patient table update fails.
        }
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
            'phone' => $phone,
            'backup_contact' => $backupContact,
            'username' => $username
        ]);
        $syncInsert = $pdo->prepare('INSERT INTO patient_sync_events (patient_id, user_id, event_type, payload) VALUES (?, ?, ?, ?)');
        $syncInsert->execute([$patientId, $userId, 'profile_sync', $syncPayload]);
    } catch (Throwable $e) {
        $syncStatus = 'Sync pending: event log unavailable.';
    }

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    $message = $e->getMessage();
    if (stripos($message, 'Current password is incorrect') !== false) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Current password is incorrect']);
        exit;
    }

    if (stripos($message, 'duplicate') !== false || stripos($message, 'uq_patients_username') !== false || stripos($message, 'uq_users_username') !== false) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'error' => 'Username already taken']);
        exit;
    }

    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Unable to save settings']);
    exit;
}

echo json_encode([
    'ok' => true,
    'profile' => [
        'phone' => $phone,
        'backup_contact' => $backupContact,
        'username' => $username
    ],
    'syncStatus' => $syncStatus
]);
