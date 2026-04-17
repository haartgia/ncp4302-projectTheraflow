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

function pickDoctorValue(array $doctorRow, array $keys): string
{
    foreach ($keys as $key) {
        if (array_key_exists($key, $doctorRow) && trim((string) $doctorRow[$key]) !== '') {
            return trim((string) $doctorRow[$key]);
        }
    }

    return '';
}

function ensureProfessionalNotesTable(PDO $pdo): ?string
{
    $tableName = 'doctor_professional_notes';

    try {
        $probe = $pdo->query('SELECT 1 FROM ' . $tableName . ' LIMIT 1');
        if ($probe !== false) {
            return $tableName;
        }
    } catch (Throwable $e) {
        // Attempt to create the table if it does not exist yet.
    }

    try {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS ' . $tableName . ' (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                note_text TEXT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_doctor_professional_notes_user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        return $tableName;
    } catch (Throwable $e) {
        return null;
    }
}

function getProfessionalNote(PDO $pdo, ?string $notesTable, int $userId): string
{
    if ($notesTable === null) {
        return '';
    }

    try {
        $stmt = $pdo->prepare('SELECT note_text FROM ' . $notesTable . ' WHERE user_id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if (is_array($row) && isset($row['note_text'])) {
            return trim((string) $row['note_text']);
        }
    } catch (Throwable $e) {
        // Fallback to existing profile bio.
    }

    return '';
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
$contactColumn = null;
foreach (['contact_number', 'contact_no', 'phone_number', 'phone', 'mobile'] as $candidate) {
    if (in_array($candidate, $doctorsColumns, true)) {
        $contactColumn = $candidate;
        break;
    }
}

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
$notesTable = ensureProfessionalNotesTable($pdo);

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
    $storedProfessionalNote = getProfessionalNote($pdo, $notesTable, $userId);

    $profile = [
        'displayName' => $usesLegacyDoctorSchema
            ? (string) ($doctorRow['full_name'] ?? buildDisplayName($userRow))
            : (string) ($doctorRow['display_name'] ?? buildDisplayName($userRow)),
        'username' => trim((string) ($userRow['username'] ?? '')),
        'title' => $usesLegacyDoctorSchema
            ? (string) ($doctorRow['license_number'] ?? 'Doctor')
            : (string) ($doctorRow['title'] ?? 'Doctor'),
        'specialty' => (string) ($doctorRow['specialty'] ?? ''),
        'hospital' => $usesLegacyDoctorSchema
            ? (string) ($doctorRow['affiliation'] ?? '')
            : (string) ($doctorRow['hospital'] ?? ''),
        'contactNumber' => pickDoctorValue($doctorRow, ['contact_number', 'contact_no', 'phone_number', 'phone', 'mobile']),
        'yearsOfExperience' => pickDoctorValue($doctorRow, ['years_of_experience', 'experience_years', 'years_experience', 'years']),
        'bio' => $storedProfessionalNote !== '' ? $storedProfessionalNote : (string) ($doctorRow['bio'] ?? ''),
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
$contactNumber = trim((string) ($data['contactNumber'] ?? ''));
$avatarDataUrl = trim((string) ($data['avatarDataUrl'] ?? ''));
$currentPassword = (string) ($data['currentPassword'] ?? '');
$newPassword = (string) ($data['newPassword'] ?? '');
$noteOnly = filter_var($data['noteOnly'] ?? false, FILTER_VALIDATE_BOOLEAN);

if (!$noteOnly && ($displayName === '' || $title === '' || $specialty === '' || $hospital === '' || $email === '')) {
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

    if (strlen($newPassword) < 6 || !preg_match('/[A-Z]/', $newPassword) || !preg_match('/\d/', $newPassword) || !preg_match('/[^A-Za-z0-9]/', $newPassword)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'New password must be at least 6 characters and include 1 uppercase letter, 1 number, and 1 special character']);
        exit;
    }

    $storedPassword = (string) ($userRow[$userPasswordColumn] ?? '');
    $passwordMatches = false;

    if ($storedPassword !== '') {
        $passwordMatches = password_verify($currentPassword, $storedPassword);
        if (!$passwordMatches && hash_equals($storedPassword, $currentPassword)) {
            // Backward compatibility for legacy plain-text entries.
            $passwordMatches = true;
        }
    }

    if (!$passwordMatches) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Current password is incorrect']);
        exit;
    }
}

try {
    $pdo->beginTransaction();

    if (!$noteOnly) {
        $emailDup = $pdo->prepare(
            'SELECT ' . $userIdColumn . ' FROM ' . $usersTable . ' WHERE email = ? AND ' . $userIdColumn . ' <> ? LIMIT 1'
        );
        $emailDup->execute([$email, $userId]);
        if ($emailDup->fetch()) {
            throw new RuntimeException('Email is already used by another account');
        }

        $updateUser = $pdo->prepare('UPDATE ' . $usersTable . ' SET email = ? WHERE ' . $userIdColumn . ' = ?');
        $updateUser->execute([$email, $userId]);
    }

    if ($changingPassword) {
        $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $updatePass = $pdo->prepare('UPDATE ' . $usersTable . ' SET ' . $userPasswordColumn . ' = ? WHERE ' . $userIdColumn . ' = ?');
        $updatePass->execute([$newHash, $userId]);

        if ($usesStandaloneDoctorSchema && !empty($doctorRow['id'])) {
            $updateDoctorPass = $pdo->prepare('UPDATE ' . $doctorsTable . ' SET password_hash = ? WHERE id = ?');
            $updateDoctorPass->execute([$newHash, (int) $doctorRow['id']]);
        }
    }

    if (!$noteOnly && $usesLegacyDoctorSchema) {
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
            if ($contactColumn !== null) {
                $legacyColumns[] = $contactColumn . ' = ?';
                $legacyValues[] = $contactNumber;
            }
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
    } elseif (!$noteOnly && $usesStandaloneDoctorSchema && !empty($doctorRow['id'])) {
        $standaloneColumns = [
            'display_name = ?',
            'title = ?',
            'specialty = ?',
            'hospital = ?',
            'bio = ?',
            'email = ?'
        ];
        $standaloneValues = [$displayName, $title, $specialty, $hospital, $bio, $email];
        if ($contactColumn !== null) {
            $standaloneColumns[] = $contactColumn . ' = ?';
            $standaloneValues[] = $contactNumber;
        }
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

    if ($notesTable !== null) {
        $saveNote = $pdo->prepare(
            'INSERT INTO ' . $notesTable . ' (user_id, note_text) VALUES (?, ?) '
            . 'ON DUPLICATE KEY UPDATE note_text = VALUES(note_text), updated_at = CURRENT_TIMESTAMP'
        );
        $saveNote->execute([$userId, $bio]);
    }

    $pdo->commit();

    $effectiveDisplayName = $noteOnly
        ? ($usesLegacyDoctorSchema
            ? (string) ($doctorRow['full_name'] ?? buildDisplayName($userRow))
            : (string) ($doctorRow['display_name'] ?? buildDisplayName($userRow)))
        : $displayName;
    $effectiveTitle = $noteOnly
        ? ($usesLegacyDoctorSchema ? (string) ($doctorRow['license_number'] ?? 'Doctor') : (string) ($doctorRow['title'] ?? 'Doctor'))
        : $title;
    $effectiveSpecialty = $noteOnly ? (string) ($doctorRow['specialty'] ?? '') : $specialty;
    $effectiveHospital = $noteOnly
        ? ($usesLegacyDoctorSchema ? (string) ($doctorRow['affiliation'] ?? '') : (string) ($doctorRow['hospital'] ?? ''))
        : $hospital;
    $effectiveEmail = $noteOnly ? $userEmail : $email;
    $effectiveContact = $noteOnly ? pickDoctorValue((array) $doctorRow, ['contact_number', 'contact_no', 'phone_number', 'phone', 'mobile']) : $contactNumber;

    echo json_encode([
        'ok' => true,
        'profile' => [
            'displayName' => $effectiveDisplayName,
            'username' => trim((string) ($userRow['username'] ?? '')),
            'title' => $effectiveTitle,
            'specialty' => $effectiveSpecialty,
            'hospital' => $effectiveHospital,
            'contactNumber' => $effectiveContact,
            'yearsOfExperience' => pickDoctorValue((array) $doctorRow, ['years_of_experience', 'experience_years', 'years_experience', 'years']),
            'bio' => $bio,
            'email' => $effectiveEmail,
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
