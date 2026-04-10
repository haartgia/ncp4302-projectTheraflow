<?php
session_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (!isset($_SESSION['role']) || strtolower((string) $_SESSION['role']) !== 'doctor' || !isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

require_once __DIR__ . '/../db.php';

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

function buildDisplayName(array $userRow): string
{
    $first = trim((string) ($userRow['first_name'] ?? ''));
    $last = trim((string) ($userRow['last_name'] ?? ''));
    $combined = trim($first . ' ' . $last);
    if ($combined !== '') {
        return $combined;
    }

    return trim((string) ($userRow['username'] ?? $userRow['email'] ?? 'Doctor'));
}

$usersTable = resolveTableName($pdo, ['users', 'theraflowusers_db.users', 'theraflow_db.users']);
$doctorsTable = resolveTableName($pdo, ['doctors', 'theraflow_db.doctors', 'theraflowusers_db.doctors']);

if ($usersTable === null || $doctorsTable === null) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Profile tables were not found']);
    exit;
}

$usersColumns = getTableColumns($pdo, $usersTable);
$doctorsColumns = getTableColumns($pdo, $doctorsTable);

$userIdColumn = in_array('user_id', $usersColumns, true) ? 'user_id' : (in_array('id', $usersColumns, true) ? 'id' : null);
$userPasswordColumn = in_array('password', $usersColumns, true) ? 'password' : (in_array('password_hash', $usersColumns, true) ? 'password_hash' : null);
$avatarColumn = in_array('avatar_url', $doctorsColumns, true) ? 'avatar_url' : (in_array('avatar', $doctorsColumns, true) ? 'avatar' : null);

if ($userIdColumn === null || $userPasswordColumn === null) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Users schema is incompatible']);
    exit;
}

$userId = (int) $_SESSION['user_id'];
$userStmt = $pdo->prepare('SELECT * FROM ' . $usersTable . ' WHERE ' . $userIdColumn . ' = ? LIMIT 1');
$userStmt->execute([$userId]);
$userRow = $userStmt->fetch();

if (!$userRow) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'User account not found']);
    exit;
}

$userEmail = trim((string) ($userRow['email'] ?? ''));

$doctorRow = false;
$usesLegacyDoctorSchema = in_array('user_id', $doctorsColumns, true) && in_array('full_name', $doctorsColumns, true);
$usesStandaloneDoctorSchema = in_array('display_name', $doctorsColumns, true) && in_array('password_hash', $doctorsColumns, true);

if ($usesLegacyDoctorSchema) {
    $doctorStmt = $pdo->prepare('SELECT * FROM ' . $doctorsTable . ' WHERE user_id = ? LIMIT 1');
    $doctorStmt->execute([$userId]);
    $doctorRow = $doctorStmt->fetch();
}

if (!$doctorRow && in_array('email', $doctorsColumns, true) && $userEmail !== '') {
    $doctorStmt = $pdo->prepare('SELECT * FROM ' . $doctorsTable . ' WHERE email = ? LIMIT 1');
    $doctorStmt->execute([$userEmail]);
    $doctorRow = $doctorStmt->fetch();
}

if (!$doctorRow) {
    $doctorRow = [];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $profile = [
        'displayName' => $usesLegacyDoctorSchema
            ? (string) ($doctorRow['full_name'] ?? buildDisplayName($userRow))
            : (string) ($doctorRow['display_name'] ?? buildDisplayName($userRow)),
        'title' => $usesLegacyDoctorSchema
            ? (string) ($doctorRow['license_number'] ?? 'Doctor')
            : (string) ($doctorRow['title'] ?? 'Doctor'),
        'specialty' => (string) ($doctorRow['specialty'] ?? ''),
        'hospital' => $usesLegacyDoctorSchema
            ? (string) ($doctorRow['affiliation'] ?? '')
            : (string) ($doctorRow['hospital'] ?? ''),
        'bio' => (string) ($doctorRow['bio'] ?? ''),
        'email' => $userEmail,
        'avatarDataUrl' => $avatarColumn ? (string) ($doctorRow[$avatarColumn] ?? '') : ''
    ];

    echo json_encode(['ok' => true, 'profile' => $profile]);
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
}

$displayName = trim((string) ($data['displayName'] ?? ''));
$title = trim((string) ($data['title'] ?? ''));
$specialty = trim((string) ($data['specialty'] ?? ''));
$hospital = trim((string) ($data['hospital'] ?? ''));
$bio = trim((string) ($data['bio'] ?? ''));
$email = trim((string) ($data['email'] ?? ''));
$avatarDataUrl = trim((string) ($data['avatarDataUrl'] ?? ''));
$currentPassword = (string) ($data['currentPassword'] ?? '');
$newPassword = (string) ($data['newPassword'] ?? '');

if ($displayName === '' || $title === '' || $specialty === '' || $hospital === '' || $email === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Please complete all required profile fields']);
    exit;
}

if ($avatarColumn === null && $avatarDataUrl !== '') {
    try {
        $pdo->exec('ALTER TABLE ' . $doctorsTable . ' ADD COLUMN avatar_url TEXT NULL');
        $avatarColumn = 'avatar_url';
    } catch (Throwable $e) {
        $avatarColumn = null;
    }
}

$changingPassword = $newPassword !== '' || $currentPassword !== '';
if ($changingPassword) {
    if ($newPassword === '' || $currentPassword === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Current and new password are both required to change password']);
        exit;
    }

    if (strlen($newPassword) < 6) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'New password must be at least 6 characters']);
        exit;
    }

    $storedHash = (string) ($userRow[$userPasswordColumn] ?? '');
    if (!password_verify($currentPassword, $storedHash)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Current password is incorrect']);
        exit;
    }
}

try {
    $pdo->beginTransaction();

    $emailDup = $pdo->prepare(
        'SELECT ' . $userIdColumn . ' FROM ' . $usersTable . ' WHERE email = ? AND ' . $userIdColumn . ' <> ? LIMIT 1'
    );
    $emailDup->execute([$email, $userId]);
    if ($emailDup->fetch()) {
        throw new RuntimeException('Email is already used by another account');
    }

    $updateUser = $pdo->prepare('UPDATE ' . $usersTable . ' SET email = ? WHERE ' . $userIdColumn . ' = ?');
    $updateUser->execute([$email, $userId]);

    if ($changingPassword) {
        $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $updatePass = $pdo->prepare('UPDATE ' . $usersTable . ' SET ' . $userPasswordColumn . ' = ? WHERE ' . $userIdColumn . ' = ?');
        $updatePass->execute([$newHash, $userId]);

        if ($usesStandaloneDoctorSchema && !empty($doctorRow['id'])) {
            $updateDoctorPass = $pdo->prepare('UPDATE ' . $doctorsTable . ' SET password_hash = ? WHERE id = ?');
            $updateDoctorPass->execute([$newHash, (int) $doctorRow['id']]);
        }
    }

    if ($usesLegacyDoctorSchema) {
        if (!empty($doctorRow['user_id'])) {
            $legacyColumns = [
                'full_name = ?',
                'email = ?',
                'specialty = ?',
                'license_number = ?',
                'affiliation = ?',
                'bio = ?'
            ];
            $legacyValues = [$displayName, $email, $specialty, $title, $hospital, $bio];
            if ($avatarColumn) {
                $legacyColumns[] = $avatarColumn . ' = ?';
                $legacyValues[] = $avatarDataUrl;
            }
            $legacyValues[] = $userId;
            $updateDoctor = $pdo->prepare(
                'UPDATE ' . $doctorsTable . ' SET ' . implode(', ', $legacyColumns) . ' WHERE user_id = ?'
            );
            $updateDoctor->execute($legacyValues);
        }
    } elseif ($usesStandaloneDoctorSchema && !empty($doctorRow['id'])) {
        $standaloneColumns = [
            'display_name = ?',
            'title = ?',
            'specialty = ?',
            'hospital = ?',
            'bio = ?',
            'email = ?'
        ];
        $standaloneValues = [$displayName, $title, $specialty, $hospital, $bio, $email];
        if ($avatarColumn) {
            $standaloneColumns[] = $avatarColumn . ' = ?';
            $standaloneValues[] = $avatarDataUrl;
        }
        $standaloneValues[] = (int) $doctorRow['id'];
        $updateDoctor = $pdo->prepare(
            'UPDATE ' . $doctorsTable . ' SET ' . implode(', ', $standaloneColumns) . ' WHERE id = ?'
        );
        $updateDoctor->execute($standaloneValues);
    }

    $pdo->commit();

    echo json_encode([
        'ok' => true,
        'profile' => [
            'displayName' => $displayName,
            'title' => $title,
            'specialty' => $specialty,
            'hospital' => $hospital,
            'bio' => $bio,
            'email' => $email,
            'avatarDataUrl' => $avatarDataUrl
        ]
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    $message = $e instanceof RuntimeException ? $e->getMessage() : 'Unable to save settings right now';
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $message]);
}
