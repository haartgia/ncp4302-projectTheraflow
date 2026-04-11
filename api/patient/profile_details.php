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

function calculateAgeFromDob(?string $dobYmd): ?int
{
    if (!$dobYmd) {
        return null;
    }

    $dob = DateTime::createFromFormat('Y-m-d', $dobYmd);
    if (!$dob || $dob->format('Y-m-d') !== $dobYmd) {
        return null;
    }

    $today = new DateTime('today');
    if ($dob > $today) {
        return null;
    }

    return (int) $dob->diff($today)->y;
}

function formatDobDisplay(?string $dobYmd): string
{
    if (!$dobYmd) {
        return '';
    }

    $dob = DateTime::createFromFormat('Y-m-d', $dobYmd);
    if (!$dob || $dob->format('Y-m-d') !== $dobYmd) {
        return '';
    }

    return $dob->format('m/d/Y');
}

$patient = getCurrentPatient($pdo);
$patientId = (int) ($patient['id'] ?? 0);
if ($patientId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid patient context']);
    exit;
}

$usersTable = resolveTableName($pdo, ['users', 'theraflow_db.users', 'theraflowusers_db.users']);
$usersColumns = $usersTable ? getTableColumns($pdo, $usersTable) : [];
$usersIdColumn = in_array('id', $usersColumns, true) ? 'id' : (in_array('user_id', $usersColumns, true) ? 'user_id' : null);
$usersUsernameColumn = in_array('username', $usersColumns, true) ? 'username' : null;

$patientColumns = patientTableColumns($pdo);
$hasPatientUserId = in_array('user_id', $patientColumns, true);

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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$profileSql =
    'SELECT p.*, c.diagnosis, c.treatment_goal, c.reviewed_at AS clinical_reviewed_at, c.doctor_id AS clinical_doctor_id'
    . ($usersTable && $usersIdColumn && $usersUsernameColumn ? ', u.' . $usersUsernameColumn . ' AS user_username' : '')
    . ' FROM patients p
       LEFT JOIN patient_clinical_data c
         ON c.id = (
            SELECT c2.id
            FROM patient_clinical_data c2
            WHERE c2.patient_id = p.id
            ORDER BY c2.reviewed_at DESC, c2.id DESC
            LIMIT 1
         )'
    . ($usersTable && $usersIdColumn && $usersUsernameColumn && $hasPatientUserId
        ? ' LEFT JOIN ' . $usersTable . ' u ON u.' . $usersIdColumn . ' = p.user_id'
        : '')
    . ' WHERE p.id = ? LIMIT 1';

$profileStmt = $pdo->prepare($profileSql);
$profileStmt->execute([$patientId]);
$profile = $profileStmt->fetch(PDO::FETCH_ASSOC) ?: $patient;

$doctorId = (int) ($profile['clinical_doctor_id'] ?? $profile['doctor_id'] ?? 0);
$doctorName = '';
if ($doctorId > 0) {
    $doctorsTable = resolveTableName($pdo, ['doctors', 'theraflow_db.doctors', 'theraflowusers_db.doctors']);
    if ($doctorsTable) {
        $doctorsColumns = getTableColumns($pdo, $doctorsTable);
        $doctorNameColumn = in_array('full_name', $doctorsColumns, true)
            ? 'full_name'
            : (in_array('display_name', $doctorsColumns, true)
                ? 'display_name'
                : (in_array('name', $doctorsColumns, true) ? 'name' : null));

        if ($doctorNameColumn !== null) {
            $doctorSql = 'SELECT ' . $doctorNameColumn . ' FROM ' . $doctorsTable . ' WHERE id = ?';
            $doctorParams = [$doctorId];

            if (in_array('user_id', $doctorsColumns, true)) {
                $doctorSql .= ' OR user_id = ?';
                $doctorParams[] = $doctorId;
            }

            $doctorSql .= ' LIMIT 1';
            $doctorStmt = $pdo->prepare($doctorSql);
            $doctorStmt->execute($doctorParams);
            $doctorName = (string) ($doctorStmt->fetchColumn() ?: '');
        }
    }

    // Fallback: patient.doctor_id is the creating doctor's users.id in this project.
    // If doctors table lookup misses due to schema/id mismatch, resolve from users.
    if ($doctorName === '' && $usersTable && $usersIdColumn) {
        $userNameExpr = null;
        if (in_array('first_name', $usersColumns, true) && in_array('last_name', $usersColumns, true)) {
            $userNameExpr = "TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))";
        } elseif (in_array('username', $usersColumns, true)) {
            $userNameExpr = 'username';
        } elseif (in_array('email', $usersColumns, true)) {
            $userNameExpr = 'email';
        }

        if ($userNameExpr !== null) {
            try {
                $userDoctorStmt = $pdo->prepare('SELECT ' . $userNameExpr . ' AS doctor_name FROM ' . $usersTable . ' WHERE ' . $usersIdColumn . ' = ? LIMIT 1');
                $userDoctorStmt->execute([$doctorId]);
                $doctorName = trim((string) ($userDoctorStmt->fetchColumn() ?: ''));
            } catch (Throwable $e) {
                // Ignore and keep default Not assigned fallback.
            }
        }
    }
}

$reviewedAt = (string) ($profile['clinical_reviewed_at'] ?? '');
$diagnosis = (string) ($profile['diagnosis'] ?? '');
$treatmentGoal = (string) ($profile['treatment_goal'] ?? '');
$plan = getPatientPlan($pdo, $patientId);
$fallbackDiagnosis = '';
if ($diagnosis === '') {
    $strokeType = trim((string) ($profile['stroke_type'] ?? ''));
    $affectedHand = trim((string) ($profile['affected_hand'] ?? ''));
    if ($strokeType !== '') {
        $fallbackDiagnosis = $affectedHand !== ''
            ? $strokeType . ' (' . $affectedHand . ' hand)'
            : $strokeType;
    }
}

if ($reviewedAt === '') {
    $reviewedAt = 'Not yet reviewed';
}
if ($diagnosis === '') {
    $diagnosis = $fallbackDiagnosis !== '' ? $fallbackDiagnosis : 'Pending clinical intake';
}
if ($treatmentGoal === '' || strtolower($treatmentGoal) === 'pending provider update') {
    $planName = trim((string) ($plan['template_name'] ?? ''));
    $duration = (int) ($plan['duration_min'] ?? 0);
    $reps = (int) ($plan['target_repetitions'] ?? 0);
    if ($planName !== '' && ($duration > 0 || $reps > 0)) {
        $parts = [$planName];
        if ($duration > 0) {
            $parts[] = $duration . ' min';
        }
        if ($reps > 0) {
            $parts[] = $reps . ' reps';
        }
        $treatmentGoal = implode(' · ', $parts);
    } else {
        $treatmentGoal = 'Pending provider update';
    }
}
if ($doctorName === '') {
    $doctorName = 'Not assigned';
}

$doctorNameNormalized = strtolower(trim($doctorName));
if ($doctorNameNormalized === 'haha' || $doctorNameNormalized === 'na' || $doctorNameNormalized === 'n/a') {
    $doctorName = 'Not assigned';
}

$firstName = trim((string) ($profile['first_name'] ?? ''));
$lastName = trim((string) ($profile['last_name'] ?? ''));
$fullName = trim($firstName . ' ' . $lastName);
if ($fullName === '') {
    $fullName = trim((string) ($profile['name'] ?? ''));
}

$dob = trim((string) ($profile['date_of_birth'] ?? ''));
$ageFromDob = calculateAgeFromDob($dob !== '' ? $dob : null);
$storedAge = isset($profile['age']) ? (int) $profile['age'] : null;
$resolvedAge = $ageFromDob !== null ? $ageFromDob : ($storedAge !== null && $storedAge > 0 ? $storedAge : null);

$gender = trim((string) ($profile['gender'] ?? ''));
$strokeType = trim((string) ($profile['stroke_type'] ?? ''));
$affectedHand = trim((string) ($profile['affected_hand'] ?? ''));
$phone = trim((string) ($profile['contact'] ?? ''));
$backupContact = trim((string) ($profile['backup_email'] ?? ''));
$username = trim((string) ($profile['username'] ?? ($profile['user_username'] ?? '')));

$fullNameOut = $fullName !== '' ? $fullName : 'Not Provided';
$dobDisplayOut = formatDobDisplay($dob !== '' ? $dob : null);
$ageOut = $resolvedAge !== null ? $resolvedAge : 'Not Provided';
$genderOut = $gender !== '' ? $gender : 'Not Provided';
$strokeOut = $strokeType !== '' ? $strokeType : 'Pending Update';
$handOut = $affectedHand !== '' ? $affectedHand : 'Pending Update';
$phoneOut = $phone !== '' ? $phone : '';
$backupOut = $backupContact !== '' ? $backupContact : '';
$usernameOut = $username !== '' ? $username : '';

echo json_encode([
    'ok' => true,
    'profile' => [
        'full_name' => $fullNameOut,
        'date_of_birth' => $dob,
        'date_of_birth_display' => $dobDisplayOut !== '' ? $dobDisplayOut : 'Not Provided',
        'age' => $ageOut,
        'gender' => $genderOut,
        'stroke_type' => $strokeOut,
        'affected_hand' => $handOut,
        'phone' => $phoneOut,
        'backup_contact' => $backupOut,
        'username' => $usernameOut,
        'diagnosis' => $diagnosis,
        'treatment_goal' => $treatmentGoal,
        'reviewed_at' => $reviewedAt,
        'assigned_doctor' => $doctorName
    ],
    'patient' => [
        'age' => $resolvedAge
    ],
    'clinical' => [
        'diagnosis' => $diagnosis,
        'treatment_goal' => $treatmentGoal,
        'reviewed_at' => $reviewedAt,
        'assigned_doctor' => $doctorName,
        'stroke_type' => $strokeOut,
        'affected_hand' => $handOut,
        'gender' => $genderOut
    ]
]);
