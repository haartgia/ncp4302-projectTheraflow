<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/doctor_data.php';

$doctorId = requireDoctorSessionOrExit();

function tableColumns(PDO $pdo, string $tableName): array
{
    $columns = [];
    try {
        $stmt = $pdo->query('DESCRIBE ' . $tableName);
        foreach ($stmt->fetchAll() as $row) {
            if (isset($row['Field'])) {
                $columns[] = strtolower((string) $row['Field']);
            }
        }
    } catch (Throwable $e) {
        return [];
    }
    return $columns;
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
            // Try next.
        }
    }
    return null;
}

$patientId = 0;
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $patientId = (int) ($_GET['patientId'] ?? 0);
} else {
    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        $payload = $_POST;
    }
    $patientId = (int) ($payload['patientId'] ?? 0);
}

if ($patientId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid patient id']);
    exit;
}

$patientColumns = tableColumns($pdo, 'patients');
if (!in_array('first_name', $patientColumns, true)) {
    $pdo->exec('ALTER TABLE patients ADD COLUMN first_name VARCHAR(120) NULL AFTER name');
}
if (!in_array('last_name', $patientColumns, true)) {
    $pdo->exec('ALTER TABLE patients ADD COLUMN last_name VARCHAR(120) NULL AFTER first_name');
}
if (!in_array('date_of_birth', $patientColumns, true)) {
    $pdo->exec('ALTER TABLE patients ADD COLUMN date_of_birth DATE NULL AFTER age');
}
if (!in_array('backup_email', $patientColumns, true)) {
    $pdo->exec('ALTER TABLE patients ADD COLUMN backup_email VARCHAR(255) NULL AFTER contact');
}

$patientStmt = $pdo->prepare('SELECT * FROM patients WHERE id = ? AND doctor_id = ? LIMIT 1');
$patientStmt->execute([$patientId, $doctorId]);
$patient = $patientStmt->fetch(PDO::FETCH_ASSOC);
if (!$patient) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Access denied']);
    exit;
}

$usersTable = resolveTableName($pdo, ['users', 'theraflow_db.users', 'theraflowusers_db.users']);
$usersColumns = $usersTable ? tableColumns($pdo, $usersTable) : [];
$userIdColumn = in_array('id', $usersColumns, true) ? 'id' : (in_array('user_id', $usersColumns, true) ? 'user_id' : null);
$userPasswordColumn = in_array('password', $usersColumns, true) ? 'password' : (in_array('password_hash', $usersColumns, true) ? 'password_hash' : null);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $firstName = trim((string) ($patient['first_name'] ?? ''));
    $lastName = trim((string) ($patient['last_name'] ?? ''));
    if ($firstName === '' && $lastName === '') {
        $name = trim((string) ($patient['name'] ?? ''));
        if ($name !== '') {
            $parts = preg_split('/\s+/', $name);
            if (is_array($parts) && count($parts) > 0) {
                $firstName = (string) ($parts[0] ?? '');
                $lastName = (string) (count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : '');
            }
        }
    }

    echo json_encode([
        'ok' => true,
        'patient' => [
            'id' => (int) ($patient['id'] ?? 0),
            'firstName' => $firstName,
            'lastName' => $lastName,
            'dob' => (string) ($patient['date_of_birth'] ?? ''),
            'age' => (int) ($patient['age'] ?? 0),
            'gender' => (string) ($patient['gender'] ?? ''),
            'email' => (string) ($patient['contact'] ?? ''),
            'backupContact' => (string) ($patient['backup_email'] ?? ''),
            'username' => (string) ($patient['username'] ?? ''),
            'strokeType' => (string) ($patient['stroke_type'] ?? ''),
            'affectedHand' => (string) ($patient['affected_hand'] ?? '')
        ]
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

$firstName = trim((string) ($payload['firstName'] ?? ''));
$lastName = trim((string) ($payload['lastName'] ?? ''));
$dob = trim((string) ($payload['dob'] ?? ''));
$age = (int) ($payload['age'] ?? 0);
$gender = trim((string) ($payload['gender'] ?? ''));
$email = strtolower(trim((string) ($payload['email'] ?? '')));
$backupContact = trim((string) ($payload['backupContact'] ?? ''));
$strokeType = trim((string) ($payload['strokeType'] ?? ''));
$affectedHand = trim((string) ($payload['affectedHand'] ?? ''));
$newPassword = (string) ($payload['password'] ?? '');

if ($firstName === '' || $lastName === '' || $dob === '' || $gender === '' || $email === '' || $strokeType === '' || $affectedHand === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Please complete all required fields.']);
    exit;
}

if ($age < 0 || $age > 130) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Age must be between 0 and 130.']);
    exit;
}

if (!in_array($gender, ['Male', 'Female', 'Other'], true)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Invalid gender.']);
    exit;
}

if (!in_array($affectedHand, ['Left', 'Right'], true)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Affected hand must be Left or Right.']);
    exit;
}

$dateObj = DateTime::createFromFormat('Y-m-d', $dob);
if (!$dateObj || $dateObj->format('Y-m-d') !== $dob) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'DOB must be a valid date.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Email address must be valid.']);
    exit;
}

if ($backupContact !== '') {
    $backupCompact = str_replace(' ', '', $backupContact);
    $backupIsEmail = filter_var($backupContact, FILTER_VALIDATE_EMAIL) !== false;
    $backupIsPhone = preg_match('/^\+?\d{7,15}$/', $backupCompact) === 1;
    if (!$backupIsEmail && !$backupIsPhone) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'Backup contact must be a valid phone number or email.']);
        exit;
    }
}

if ($newPassword !== '') {
    if (strlen($newPassword) < 6 || !preg_match('/[A-Z]/', $newPassword) || !preg_match('/\d/', $newPassword) || !preg_match('/[^A-Za-z0-9]/', $newPassword)) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'Password must be at least 6 characters with uppercase, number, and special character.']);
        exit;
    }
}

$fullName = trim($firstName . ' ' . $lastName);

$updatePatient = $pdo->prepare(
    'UPDATE patients
     SET name = ?, first_name = ?, last_name = ?, date_of_birth = ?, age = ?, gender = ?, contact = ?, backup_email = ?, stroke_type = ?, affected_hand = ?
     WHERE id = ? AND doctor_id = ?
     LIMIT 1'
);
$updatePatient->execute([
    $fullName,
    $firstName,
    $lastName,
    $dob,
    $age,
    $gender,
    $email,
    $backupContact !== '' ? $backupContact : null,
    $strokeType,
    $affectedHand,
    $patientId,
    $doctorId
]);

if ($newPassword !== '' && $usersTable && $userIdColumn && $userPasswordColumn) {
    $linkedUserId = (int) ($patient['user_id'] ?? 0);
    if ($linkedUserId > 0) {
        $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $updateUser = $pdo->prepare('UPDATE ' . $usersTable . ' SET ' . $userPasswordColumn . ' = ? WHERE ' . $userIdColumn . ' = ? LIMIT 1');
        $updateUser->execute([$passwordHash, $linkedUserId]);
    }
}

if ($newPassword !== '') {
    $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $updatePatientPassword = $pdo->prepare('UPDATE patients SET password_hash = ? WHERE id = ? AND doctor_id = ? LIMIT 1');
    $updatePatientPassword->execute([$passwordHash, $patientId, $doctorId]);
}

echo json_encode(['ok' => true]);
