<?php
session_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    $data = $_POST;
    if (!is_array($data) || !$data) {
        $parsed = [];
        parse_str((string) $raw, $parsed);
        if (is_array($parsed) && $parsed) {
            $data = $parsed;
        }
    }
}

$identifier = trim((string) ($data['user'] ?? $data['identifier'] ?? $data['username'] ?? $data['email'] ?? ''));
$passwordInput = (string) ($data['password'] ?? '');

if ($identifier === '' || $passwordInput === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'User (username/email) and password are required']);
    exit;
}

require_once __DIR__ . '/db.php';

function verifyPasswordCompat(string $input, string $storedHashOrPlain): array
{
    if ($storedHashOrPlain !== '' && password_verify($input, $storedHashOrPlain)) {
        return ['ok' => true, 'rehash' => password_needs_rehash($storedHashOrPlain, PASSWORD_DEFAULT)];
    }

    // Legacy compatibility: some historical rows may contain plain text passwords.
    if ($storedHashOrPlain !== '' && hash_equals($storedHashOrPlain, $input)) {
        return ['ok' => true, 'rehash' => true];
    }

    return ['ok' => false, 'rehash' => false];
}

function resolveTableName(PDO $pdo, array $candidates): ?string
{
    foreach ($candidates as $tableName) {
        try {
            $probe = $pdo->query('SELECT 1 FROM ' . $tableName . ' LIMIT 1');
            if ($probe !== false) {
                return $tableName;
            }
        } catch (Throwable $e) {
            // Try next candidate table.
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

function hasPatientRows(PDO $pdo, string $tableName, int $patientId): bool
{
    if ($patientId <= 0) {
        return false;
    }

    try {
        $stmt = $pdo->prepare('SELECT 1 FROM ' . $tableName . ' WHERE patient_id = ? LIMIT 1');
        $stmt->execute([$patientId]);
        return (bool) $stmt->fetchColumn();
    } catch (Throwable $e) {
        return false;
    }
}

function patientHasTherapyData(PDO $pdo, int $patientId): bool
{
    if ($patientId <= 0) {
        return false;
    }

    // If any session/progress record exists, treat as returning patient.
    foreach (['sessions', 'sensor_data', 'recovery_progress'] as $tableName) {
        if (hasPatientRows($pdo, $tableName, $patientId)) {
            return true;
        }
    }

    try {
        $stmt = $pdo->prepare('SELECT 1 FROM patients WHERE id = ? AND last_session IS NOT NULL LIMIT 1');
        $stmt->execute([$patientId]);
        if ($stmt->fetchColumn()) {
            return true;
        }
    } catch (Throwable $e) {
        // Ignore optional column checks.
    }

    return false;
}

$usersTable = resolveTableName($pdo, ['users', 'theraflowusers_db.users', 'theraflow_db.users']);
if ($usersTable === null) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Users table was not found. Please check database configuration.']);
    exit;
}

$columns = getTableColumns($pdo, $usersTable);
$idColumn = in_array('user_id', $columns, true) ? 'user_id' : (in_array('id', $columns, true) ? 'id' : null);
$usernameColumn = in_array('username', $columns, true) ? 'username' : null;
$emailColumn = in_array('email', $columns, true) ? 'email' : null;
$passwordColumn = in_array('password', $columns, true) ? 'password' : (in_array('password_hash', $columns, true) ? 'password_hash' : null);
$roleColumn = in_array('role', $columns, true) ? 'role' : null;

if ($idColumn === null || $passwordColumn === null || ($usernameColumn === null && $emailColumn === null)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Users table schema is missing required auth columns.']);
    exit;
}

$user = false;
$credentialVerified = false;
$needsRehash = false;
$sessionPatientId = 0;

if ($usernameColumn !== null) {
    // Primary lookup: do not restrict by role in SQL.
    $stmt = $pdo->prepare('SELECT * FROM ' . $usersTable . ' WHERE ' . $usernameColumn . ' = ? LIMIT 1');
    $stmt->execute([$identifier]);
    $user = $stmt->fetch();
}

if (!$user && $emailColumn !== null) {
    $stmt = $pdo->prepare('SELECT * FROM ' . $usersTable . ' WHERE ' . $emailColumn . ' = ? LIMIT 1');
    $stmt->execute([$identifier]);
    $user = $stmt->fetch();
}

// Fallback path: allow patient username login from theraflow_db.patients.username.
if (!$user) {
    try {
        $patientColumns = getTableColumns($pdo, 'patients');
        $patientWhere = [];
        $patientParams = [];

        if (in_array('username', $patientColumns, true)) {
            $patientWhere[] = 'username = ?';
            $patientParams[] = $identifier;
        }

        // Support login by doctor-set patient email (stored in contact) and legacy backup_email.
        if (in_array('contact', $patientColumns, true)) {
            $patientWhere[] = 'contact = ?';
            $patientParams[] = $identifier;
        }

        if (in_array('backup_email', $patientColumns, true)) {
            $patientWhere[] = 'backup_email = ?';
            $patientParams[] = $identifier;
        }

        if (!$patientWhere) {
            $patientWhere[] = 'username = ?';
            $patientParams[] = $identifier;
        }

        $patientSql = 'SELECT id, user_id, username, password_hash FROM patients WHERE ' . implode(' OR ', $patientWhere) . ' LIMIT 1';
        $patientStmt = $pdo->prepare($patientSql);
        $patientStmt->execute($patientParams);
        $patient = $patientStmt->fetch();

        if ($patient) {
            $patientCred = verifyPasswordCompat($passwordInput, (string) ($patient['password_hash'] ?? ''));
            if (!$patientCred['ok']) {
                $patient = false;
            }
        }

        if ($patient) {
            $credentialVerified = true;
            $sessionPatientId = (int) ($patient['id'] ?? 0);
            $linkedUserId = (int) ($patient['user_id'] ?? 0);
            if ($linkedUserId > 0) {
                $userById = $pdo->prepare('SELECT * FROM ' . $usersTable . ' WHERE ' . $idColumn . ' = ? LIMIT 1');
                $userById->execute([$linkedUserId]);
                $user = $userById->fetch();
            }

            if (!$user) {
                // Minimal synthetic user context for patient role if linked users row is unavailable.
                $user = [
                    $idColumn => $linkedUserId,
                    'role' => 'patient',
                    'username' => (string) ($patient['username'] ?? ''),
                    $passwordColumn => (string) ($patient['password_hash'] ?? '')
                ];
            }
        }
    } catch (Throwable $e) {
        // Ignore fallback errors and continue with invalid-credentials response.
    }
}

if (!$user) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Invalid user or password']);
    exit;
}

$hashedPassword = (string) ($user[$passwordColumn] ?? '');
if (!$credentialVerified) {
    $cred = verifyPasswordCompat($passwordInput, $hashedPassword);
    if (!$cred['ok']) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Invalid user or password']);
        exit;
    }
    $needsRehash = $cred['rehash'];
}

$userId = (int) ($user[$idColumn] ?? 0);
if ($userId <= 0 && $sessionPatientId <= 0) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Unable to establish a valid user session.']);
    exit;
}

if ($needsRehash || password_needs_rehash($hashedPassword, PASSWORD_DEFAULT)) {
    $rehash = password_hash($passwordInput, PASSWORD_DEFAULT);
    $update = $pdo->prepare('UPDATE ' . $usersTable . ' SET ' . $passwordColumn . ' = ? WHERE ' . $idColumn . ' = ?');
    $update->execute([$rehash, $userId]);
}

$role = strtolower(trim((string) ($roleColumn !== null ? ($user[$roleColumn] ?? '') : '')));
if ($role !== 'doctor' && $role !== 'patient') {
    try {
        $patientRoleStmt = $pdo->prepare('SELECT id FROM patients WHERE user_id = ? LIMIT 1');
        $patientRoleStmt->execute([$userId]);
        if ($patientRoleStmt->fetch()) {
            $role = 'patient';
        }
    } catch (Throwable $e) {
        // Ignore fallback errors.
    }

    if ($role !== 'patient') {
        try {
            $doctorRoleStmt = $pdo->prepare('SELECT id FROM doctors WHERE user_id = ? LIMIT 1');
            $doctorRoleStmt->execute([$userId]);
            if ($doctorRoleStmt->fetch()) {
                $role = 'doctor';
            }
        } catch (Throwable $e) {
            // Ignore fallback errors.
        }
    }
}

$_SESSION['user_id'] = $userId;
$_SESSION['username'] = (string) ($usernameColumn !== null ? ($user[$usernameColumn] ?? '') : ($emailColumn !== null ? ($user[$emailColumn] ?? '') : ''));
$_SESSION['role'] = $role;

if ($role === 'patient') {
    // Keep patient context explicit for accounts not linked to users.id.
    if ($sessionPatientId <= 0) {
        try {
            $patientIdStmt = $pdo->prepare('SELECT id FROM patients WHERE user_id = ? LIMIT 1');
            $patientIdStmt->execute([$userId]);
            $sessionPatientId = (int) ($patientIdStmt->fetchColumn() ?: 0);
        } catch (Throwable $e) {
            // Ignore and proceed without patient_id if unavailable.
        }
    }

    if ($sessionPatientId > 0) {
        $_SESSION['patient_id'] = $sessionPatientId;
    }
}

if ($role === 'doctor') {
    $_SESSION['doctor_id'] = $userId;
}

$redirect = 'index.html';
if ($role === 'doctor') {
    $redirect = 'doctor_dashboard.php';
} elseif ($role === 'patient') {
    $patientIdForRedirect = $sessionPatientId;
    if ($patientIdForRedirect <= 0 && $userId > 0) {
        try {
            $patientRedirectStmt = $pdo->prepare('SELECT id FROM patients WHERE user_id = ? LIMIT 1');
            $patientRedirectStmt->execute([$userId]);
            $patientIdForRedirect = (int) ($patientRedirectStmt->fetchColumn() ?: 0);
        } catch (Throwable $e) {
            // Keep default redirect if patient lookup fails.
        }
    }

    // First login goes to exercise page. Returning patients go to dashboard.
    $redirect = patientHasTherapyData($pdo, $patientIdForRedirect) ? 'index.html' : 'exercise_hub.php';
}

echo json_encode([
    'ok' => true,
    'role' => $role,
    'redirect' => $redirect
]);
