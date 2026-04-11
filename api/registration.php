<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/db.php';

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

$usersTable = resolveTableName($pdo, ['users', 'theraflowusers_db.users', 'theraflow_db.users']);
$doctorsTable = resolveTableName($pdo, ['doctors', 'theraflow_db.doctors', 'theraflowusers_db.doctors']);

if ($usersTable === null || $doctorsTable === null) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Required users/doctors tables were not found. Please verify your DB schema.'
    ]);
    exit;
}

$usersColumns = getTableColumns($pdo, $usersTable);
$doctorsColumns = getTableColumns($pdo, $doctorsTable);
$usersIdColumn = in_array('user_id', $usersColumns, true) ? 'user_id' : (in_array('id', $usersColumns, true) ? 'id' : null);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $check = trim((string) ($_GET['check'] ?? ''));
    $value = trim((string) ($_GET['value'] ?? ''));

    if ($check === '' || $value === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Missing check parameters']);
        exit;
    }

    if ($check === 'email') {
        $exists = false;
        if ($usersIdColumn && in_array('email', $usersColumns, true)) {
            $dupEmail = $pdo->prepare('SELECT ' . $usersIdColumn . ' FROM ' . $usersTable . ' WHERE email = ? LIMIT 1');
            $dupEmail->execute([$value]);
            $exists = (bool) $dupEmail->fetch();
        }

        if (!$exists && in_array('email', $doctorsColumns, true)) {
            $dupDoctorEmail = $pdo->prepare('SELECT id FROM ' . $doctorsTable . ' WHERE email = ? LIMIT 1');
            $dupDoctorEmail->execute([$value]);
            $exists = (bool) $dupDoctorEmail->fetch();
        }

        echo json_encode(['ok' => true, 'check' => 'email', 'available' => !$exists]);
        exit;
    }

    if ($check === 'contactNumber') {
        $normalizedContact = preg_replace('/\D+/', '', $value) ?? '';
        $exists = false;

        if ($usersIdColumn && in_array('mobile', $usersColumns, true)) {
            $dupMobile = $pdo->prepare('SELECT ' . $usersIdColumn . ' FROM ' . $usersTable . ' WHERE mobile = ? LIMIT 1');
            $dupMobile->execute([$normalizedContact]);
            $exists = (bool) $dupMobile->fetch();
        }

        if (!$exists && in_array('contact_number', $doctorsColumns, true)) {
            $dupDoctorContact = $pdo->prepare('SELECT id FROM ' . $doctorsTable . ' WHERE contact_number = ? LIMIT 1');
            $dupDoctorContact->execute([$normalizedContact]);
            $exists = (bool) $dupDoctorContact->fetch();
        }

        echo json_encode(['ok' => true, 'check' => 'contactNumber', 'available' => !$exists]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Unsupported check type']);
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

$required = ['fullName', 'email', 'contactNumber', 'specialty', 'licenseNumber', 'yearsOfExperience', 'affiliation', 'username', 'password'];
foreach ($required as $field) {
    if (!isset($data[$field]) || trim((string) $data[$field]) === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Missing required field: ' . $field]);
        exit;
    }
}

$fullName = trim((string) $data['fullName']);
$email = trim((string) $data['email']);
$contactNumber = trim((string) $data['contactNumber']);
$specialty = trim((string) $data['specialty']);
$specialtyOther = trim((string) ($data['specialtyOther'] ?? ''));
$licenseNumber = trim((string) $data['licenseNumber']);
$yearsOfExperience = (int) $data['yearsOfExperience'];
$affiliation = trim((string) $data['affiliation']);
$username = trim((string) ($data['username'] ?? ''));
$passwordPlain = (string) $data['password'];
$bio = trim((string) ($data['bio'] ?? ''));

if (strlen($passwordPlain) < 6 || !preg_match('/[A-Z]/', $passwordPlain) || !preg_match('/\d/', $passwordPlain) || !preg_match('/[^A-Za-z0-9]/', $passwordPlain)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Password must be at least 6 characters and include 1 uppercase letter, 1 number, and 1 special character.']);
    exit;
}

$contactDigits = preg_replace('/\D+/', '', $contactNumber) ?? '';
if (!preg_match('/^09\d{9}$/', $contactDigits)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Contact number must be an 11-digit mobile number starting with 09.']);
    exit;
}

$contactNumber = $contactDigits;

if ($specialty === 'other' && $specialtyOther !== '') {
    $specialty = $specialtyOther;
}

$passwordHash = password_hash($passwordPlain, PASSWORD_DEFAULT);

function splitFullName(string $fullName): array
{
    $parts = preg_split('/\s+/', trim($fullName)) ?: [];
    $firstName = $parts[0] ?? 'Doctor';
    $lastName = count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : 'User';
    return [$firstName, $lastName];
}

function ensureUsersUsernameColumn(PDO $pdo, string $usersTable, array $usersColumns): array
{
    if (in_array('username', $usersColumns, true)) {
        return $usersColumns;
    }

    try {
        $pdo->exec('ALTER TABLE ' . $usersTable . ' ADD COLUMN username VARCHAR(100) NULL AFTER mobile');
    } catch (Throwable $e) {
        // Ignore if column already exists in environments that race schema updates.
    }

    try {
        $pdo->exec('ALTER TABLE ' . $usersTable . ' ADD UNIQUE INDEX uq_users_username (username)');
    } catch (Throwable $e) {
        // Ignore when index already exists.
    }

    return getTableColumns($pdo, $usersTable);
}

$usersPasswordColumn = in_array('password', $usersColumns, true) ? 'password' : (in_array('password_hash', $usersColumns, true) ? 'password_hash' : null);

if ($usersIdColumn === null || $usersPasswordColumn === null || !in_array('email', $usersColumns, true)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Users table schema is incompatible with registration.']);
    exit;
}

$usersColumns = ensureUsersUsernameColumn($pdo, $usersTable, $usersColumns);
if (!in_array('username', $usersColumns, true)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Users table must include a username column for doctor registration.']);
    exit;
}

$usesLegacyDoctorSchema = in_array('user_id', $doctorsColumns, true) && in_array('full_name', $doctorsColumns, true);
$usesStandaloneDoctorSchema = in_array('display_name', $doctorsColumns, true) && in_array('password_hash', $doctorsColumns, true);

if (!$usesLegacyDoctorSchema && !$usesStandaloneDoctorSchema) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Doctors table schema is incompatible with registration.']);
    exit;
}

try {
    $pdo->beginTransaction();

    if ($username === '') {
        throw new RuntimeException('Username is required');
    }

    $dupUser = $pdo->prepare('SELECT ' . $usersIdColumn . ' FROM ' . $usersTable . ' WHERE username = ? LIMIT 1');
    $dupUser->execute([$username]);
    if ($dupUser->fetch()) {
        throw new RuntimeException('Username already exists');
    }

    $dupEmail = $pdo->prepare('SELECT ' . $usersIdColumn . ' FROM ' . $usersTable . ' WHERE email = ? LIMIT 1');
    $dupEmail->execute([$email]);
    if ($dupEmail->fetch()) {
        throw new RuntimeException('Email already exists');
    }

    if (in_array('email', $doctorsColumns, true)) {
        $dupDoctorEmail = $pdo->prepare('SELECT id FROM ' . $doctorsTable . ' WHERE email = ? LIMIT 1');
        $dupDoctorEmail->execute([$email]);
        if ($dupDoctorEmail->fetch()) {
            throw new RuntimeException('Doctor profile email already exists');
        }
    }

    if (in_array('mobile', $usersColumns, true)) {
        $dupMobile = $pdo->prepare('SELECT ' . $usersIdColumn . ' FROM ' . $usersTable . ' WHERE mobile = ? LIMIT 1');
        $dupMobile->execute([$contactNumber]);
        if ($dupMobile->fetch()) {
            throw new RuntimeException('Contact number already exists');
        }
    }

    if (in_array('contact_number', $doctorsColumns, true)) {
        $dupDoctorContact = $pdo->prepare('SELECT id FROM ' . $doctorsTable . ' WHERE contact_number = ? LIMIT 1');
        $dupDoctorContact->execute([$contactNumber]);
        if ($dupDoctorContact->fetch()) {
            throw new RuntimeException('Contact number already exists');
        }
    }

    // Keep hashing consistent with login.php by using PASSWORD_DEFAULT.
    [$firstName, $lastName] = splitFullName($fullName);

    if (in_array('first_name', $usersColumns, true) && in_array('last_name', $usersColumns, true)) {
        $insertUser = $pdo->prepare(
            'INSERT INTO ' . $usersTable . ' (first_name, last_name, mobile, username, email, ' . $usersPasswordColumn . ', role) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $insertUser->execute([$firstName, $lastName, $contactNumber, $username, $email, $passwordHash, 'doctor']);
    } else {
        $insertUser = $pdo->prepare('INSERT INTO ' . $usersTable . ' (username, email, ' . $usersPasswordColumn . ', role) VALUES (?, ?, ?, ?)');
        $insertUser->execute([$username, $email, $passwordHash, 'doctor']);
    }

    $userId = (int) $pdo->lastInsertId();

    if ($usesLegacyDoctorSchema) {
        $insertDoctor = $pdo->prepare(
            'INSERT INTO ' . $doctorsTable . ' (user_id, full_name, email, contact_number, specialty, license_number, years_experience, affiliation, bio)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $insertDoctor->execute([
            $userId,
            $fullName,
            $email,
            $contactNumber,
            $specialty,
            $licenseNumber,
            $yearsOfExperience,
            $affiliation,
            $bio
        ]);
    } else {
        $insertDoctor = $pdo->prepare(
            'INSERT INTO ' . $doctorsTable . ' (display_name, title, specialty, hospital, bio, email, password_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $insertDoctor->execute([
            $fullName,
            $licenseNumber,
            $specialty,
            $affiliation,
            $bio,
            $email,
            $passwordHash
        ]);
    }

    $pdo->commit();

    echo json_encode(['ok' => true, 'user_id' => $userId]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    $message = $e instanceof RuntimeException ? $e->getMessage() : 'Registration failed due to a server/database mismatch.';
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $message]);
}
