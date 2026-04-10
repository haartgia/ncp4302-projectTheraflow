<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/patient_data.php';

$patient = getCurrentPatient($pdo);
$patientDoctorId = (int) ($patient['doctor_id'] ?? 0);
if ($patientDoctorId <= 0) {
    echo json_encode(['ok' => true, 'profile' => null]);
    exit;
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

function buildDisplayName(array $doctorRow): string
{
    $candidate = trim((string) ($doctorRow['full_name'] ?? $doctorRow['display_name'] ?? ''));
    if ($candidate !== '') {
        return $candidate;
    }

    $first = trim((string) ($doctorRow['first_name'] ?? ''));
    $last = trim((string) ($doctorRow['last_name'] ?? ''));
    $combined = trim($first . ' ' . $last);
    return $combined !== '' ? $combined : 'Doctor';
}

$doctorsTable = resolveTableName($pdo, ['doctors', 'theraflow_db.doctors', 'theraflowusers_db.doctors']);
$usersTable = resolveTableName($pdo, ['users', 'theraflow_db.users', 'theraflowusers_db.users']);

if ($doctorsTable === null) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Doctors table not found']);
    exit;
}

$doctorsColumns = getTableColumns($pdo, $doctorsTable);
$usersColumns = $usersTable ? getTableColumns($pdo, $usersTable) : [];
$avatarColumn = in_array('avatar_url', $doctorsColumns, true) ? 'avatar_url' : (in_array('avatar', $doctorsColumns, true) ? 'avatar' : null);

$doctorStmt = $pdo->prepare('SELECT * FROM ' . $doctorsTable . ' WHERE id = ? OR user_id = ? LIMIT 1');
$doctorStmt->execute([$patientDoctorId, $patientDoctorId]);
$doctorRow = $doctorStmt->fetch(PDO::FETCH_ASSOC) ?: [];

if (!$doctorRow) {
    echo json_encode(['ok' => true, 'profile' => null]);
    exit;
}

$userEmail = '';
if ($usersTable && in_array('id', $usersColumns, true)) {
    $userStmt = $pdo->prepare('SELECT email FROM ' . $usersTable . ' WHERE id = ? LIMIT 1');
    $userStmt->execute([(int) ($doctorRow['user_id'] ?? 0)]);
    $userEmail = (string) ($userStmt->fetchColumn() ?: '');
}

$usesLegacyDoctorSchema = in_array('user_id', $doctorsColumns, true) && in_array('full_name', $doctorsColumns, true);
$profile = [
    'displayName' => $usesLegacyDoctorSchema
        ? (string) ($doctorRow['full_name'] ?? buildDisplayName($doctorRow))
        : (string) ($doctorRow['display_name'] ?? buildDisplayName($doctorRow)),
    'title' => $usesLegacyDoctorSchema
        ? (string) ($doctorRow['license_number'] ?? 'Doctor')
        : (string) ($doctorRow['title'] ?? 'Doctor'),
    'specialty' => (string) ($doctorRow['specialty'] ?? ''),
    'hospital' => $usesLegacyDoctorSchema
        ? (string) ($doctorRow['affiliation'] ?? '')
        : (string) ($doctorRow['hospital'] ?? ''),
    'bio' => (string) ($doctorRow['bio'] ?? ''),
    'email' => (string) ($doctorRow['email'] ?? $userEmail),
    'contact' => (string) ($doctorRow['contact_number'] ?? ''),
    'avatarDataUrl' => $avatarColumn ? (string) ($doctorRow[$avatarColumn] ?? '') : ''
];

echo json_encode(['ok' => true, 'profile' => $profile]);
