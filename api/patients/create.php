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

if (!isset($_SESSION['role']) || strtolower((string) $_SESSION['role']) !== 'doctor' || !isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Only logged-in doctors can add patients']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    $body = $_POST;
}

$required = ['name', 'age', 'gender', 'strokeType', 'affectedHand', 'contact', 'username', 'password'];
foreach ($required as $field) {
    if (!isset($body[$field]) || trim((string) $body[$field]) === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => "Missing required field: $field"]);
        exit;
    }
}

$doctorId = (int) $_SESSION['user_id'];
$name = trim((string) $body['name']);
$age = (int) $body['age'];
$gender = trim((string) $body['gender']);
$strokeType = trim((string) $body['strokeType']);
$affectedHand = trim((string) $body['affectedHand']);
$contact = trim((string) $body['contact']);
$username = trim((string) $body['username']);
$passwordPlain = (string) $body['password'];
$passwordHash = password_hash($passwordPlain, PASSWORD_DEFAULT);

if ($age < 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Age must be a valid number']);
    exit;
}

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/doctor_data.php';

function ensurePatientsColumns(PDO $pdo): void
{
    $columns = [];
    $describe = $pdo->query('DESCRIBE patients');
    foreach ($describe->fetchAll() as $row) {
        if (isset($row['Field'])) {
            $columns[] = strtolower((string) $row['Field']);
        }
    }

    if (!in_array('user_id', $columns, true)) {
        $pdo->exec('ALTER TABLE patients ADD COLUMN user_id INT NULL AFTER id');
    }

    if (!in_array('doctor_id', $columns, true)) {
        $pdo->exec('ALTER TABLE patients ADD COLUMN doctor_id INT NULL AFTER user_id');
    }

    $idxRows = $pdo->query('SHOW INDEX FROM patients')->fetchAll();
    $existingIdx = [];
    foreach ($idxRows as $idxRow) {
        $existingIdx[] = strtolower((string) ($idxRow['Key_name'] ?? ''));
    }

    if (!in_array('idx_patients_user_id', $existingIdx, true)) {
        $pdo->exec('CREATE INDEX idx_patients_user_id ON patients (user_id)');
    }

    if (!in_array('idx_patients_doctor_id', $existingIdx, true)) {
        $pdo->exec('CREATE INDEX idx_patients_doctor_id ON patients (doctor_id)');
    }
}

function ensureClinicalDataTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS patient_clinical_data (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT NOT NULL,
            doctor_id INT NULL,
            diagnosis VARCHAR(255) NULL,
            treatment_goal VARCHAR(255) NULL,
            reviewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_clinical_patient_id (patient_id),
            INDEX idx_clinical_reviewed_at (reviewed_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

function splitName(string $fullName): array
{
    $parts = preg_split('/\s+/', trim($fullName)) ?: [];
    $first = $parts[0] ?? 'Patient';
    $last = count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : 'User';
    return [$first, $last];
}

function resolveUsersTable(PDO $pdo): ?string
{
    $candidates = ['users', 'user_db.users', 'theraflow_db.users'];
    foreach ($candidates as $tableName) {
        try {
            $probe = $pdo->query('SELECT 1 FROM ' . $tableName . ' LIMIT 1');
            if ($probe !== false) {
                return $tableName;
            }
        } catch (Throwable $e) {
            // try next
        }
    }

    return null;
}

function describeColumns(PDO $pdo, string $tableName): array
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

try {
    ensurePatientsColumns($pdo);
    ensureTherapyPlansTable($pdo);
    ensureClinicalDataTable($pdo);

    // Username uniqueness is enforced in patients table where username is unique.
    $existingUsername = $pdo->prepare('SELECT id FROM patients WHERE username = ? LIMIT 1');
    $existingUsername->execute([$username]);
    if ($existingUsername->fetch()) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'error' => 'Username already taken']);
        exit;
    }

    // user_db.users has no username column; we keep username in patients and use a synthetic email for account auth.
    $syntheticEmail = strtolower($username) . '@patient.local';
    $usersTable = resolveUsersTable($pdo);
    $usersColumns = $usersTable ? describeColumns($pdo, $usersTable) : [];

    if ($usersTable && in_array('email', $usersColumns, true)) {
        $emailCheck = $pdo->prepare('SELECT id FROM ' . $usersTable . ' WHERE email = ? LIMIT 1');
        $emailCheck->execute([$syntheticEmail]);
        if ($emailCheck->fetch()) {
            http_response_code(409);
            echo json_encode(['ok' => false, 'error' => 'Username already taken']);
            exit;
        }
    }

    [$firstName, $lastName] = splitName($name);

    $pdo->beginTransaction();

    // Step A: create user account (role=patient) if users table exists.
    $newUserId = 0;
    if ($usersTable && in_array('email', $usersColumns, true)) {
        $passwordColumn = in_array('password', $usersColumns, true) ? 'password' : (in_array('password_hash', $usersColumns, true) ? 'password_hash' : null);
        if ($passwordColumn !== null) {
            $insertColumns = ['email', $passwordColumn];
            $insertValues = [$syntheticEmail, $passwordHash];

            if (in_array('first_name', $usersColumns, true)) {
                $insertColumns[] = 'first_name';
                $insertValues[] = $firstName;
            }
            if (in_array('last_name', $usersColumns, true)) {
                $insertColumns[] = 'last_name';
                $insertValues[] = $lastName;
            }
            if (in_array('mobile', $usersColumns, true)) {
                $insertColumns[] = 'mobile';
                $insertValues[] = $contact;
            }
            if (in_array('role', $usersColumns, true)) {
                $insertColumns[] = 'role';
                $insertValues[] = 'patient';
            }

            $placeholders = implode(', ', array_fill(0, count($insertColumns), '?'));
            $createUser = $pdo->prepare(
                'INSERT INTO ' . $usersTable . ' (' . implode(', ', $insertColumns) . ') VALUES (' . $placeholders . ')'
            );
            $createUser->execute($insertValues);
            $newUserId = (int) $pdo->lastInsertId();
        }
    }

    // Step B: create patient clinical profile linked to user and doctor.
    $createPatient = $pdo->prepare(
        'INSERT INTO patients (user_id, doctor_id, name, age, gender, stroke_type, affected_hand, contact, username, password_hash, status, last_session)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $createPatient->execute([
        $newUserId ?: null,
        $doctorId,
        $name,
        $age,
        $gender,
        $strokeType,
        $affectedHand,
        $contact,
        $username,
        $passwordHash,
        'Stable',
        null
    ]);

    $newPatientId = (int) $pdo->lastInsertId();

    // Step C: initialize clinical summary from intake details.
    $diagnosisLabel = $strokeType !== ''
        ? ($affectedHand !== '' ? $strokeType . ' (' . $affectedHand . ' hand)' : $strokeType)
        : 'Pending clinical intake';
    $clinicalInsert = $pdo->prepare(
        'INSERT INTO patient_clinical_data (patient_id, doctor_id, diagnosis, treatment_goal, reviewed_at)
         VALUES (?, ?, ?, ?, NOW())'
    );
    $clinicalInsert->execute([
        $newPatientId,
        $doctorId,
        $diagnosisLabel,
        'Initial evaluation pending.'
    ]);

    // Step D: initialize blank therapy plan row.
    $therapyPlanInsert = $pdo->prepare(
        'INSERT INTO therapy_plans (patient_id, template_name, duration_min, target_repetitions, sessions_per_day)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
             template_name = VALUES(template_name),
             duration_min = VALUES(duration_min),
             target_repetitions = VALUES(target_repetitions),
             sessions_per_day = VALUES(sessions_per_day)'
    );
    $therapyPlanInsert->execute([$newPatientId, 'Default', 0, 0, 0]);

    $planTable = null;
    try {
        $pdo->query('SELECT 1 FROM therapy_plans LIMIT 1');
        $planTable = 'therapy_plans';
    } catch (Throwable $e) {
        $pdo->query('SELECT 1 FROM therapy_assignments LIMIT 1');
        $planTable = 'therapy_assignments';
    }

    if ($planTable === 'therapy_plans') {
        // Already initialized above.
    } else {
        $pdo->prepare(
            'INSERT INTO therapy_assignments (patient_id, template_name, duration_min, target_repetitions, sessions_per_day)
             VALUES (?, ?, ?, ?, ?)'
        )->execute([$newPatientId, null, 0, 0, 0]);
    }

    $welcome = $pdo->prepare('INSERT INTO messages (patient_id, sender, body, is_read) VALUES (?, ?, ?, 0)');
    $welcome->execute([$newPatientId, 'doctor', 'Welcome to Theraflow!']);

    $pdo->commit();

    echo json_encode([
        'ok' => true,
        'id' => $newPatientId,
        'user_id' => $newUserId,
        'username' => $username
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    $payload = [
        'ok' => false,
        'error' => 'Database connection error'
    ];
    if (getenv('THERAFLOW_DEBUG') === '1') {
        $payload['detail'] = $e->getMessage();
    }
    echo json_encode($payload);
}
