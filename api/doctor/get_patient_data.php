    <?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/doctor_data.php';

$doctorId = requireDoctorSessionOrExit();
ensureSensorDataTable($pdo);
ensureSessionsTable($pdo);

$patients = getDoctorPatients($pdo, $doctorId);
$patientIds = array_map(static fn($p) => (int) ($p['id'] ?? 0), $patients);
$patientIds = array_values(array_filter($patientIds, static fn($id) => $id > 0));
$patientIdLookup = array_flip($patientIds);

$totalPatients = count($patients);
$requestedPatientId = 0;
if (isset($_GET['patient_id']) && $_GET['patient_id'] !== 'all') {
    $requestedPatientId = (int) $_GET['patient_id'];
}

if ($requestedPatientId > 0 && !isset($patientIdLookup[$requestedPatientId])) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Patient is not assigned to this doctor']);
    exit;
}

$scopePatientIds = $requestedPatientId > 0 ? [$requestedPatientId] : $patientIds;
$weeklyLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
$weeklyGrip = [0, 0, 0, 0, 0, 0, 0];
$weeklyRange = [0, 0, 0, 0, 0, 0, 0];

$sessionsToday = 0;
$avgGrip = 0.0;
$avgRange = 0.0;
$recentActivity = [];

if (!empty($scopePatientIds)) {
    $placeholders = implode(',', array_fill(0, count($scopePatientIds), '?'));

    $sessionsTodayStmt = $pdo->prepare(
        'SELECT COUNT(*) AS c
         FROM sessions
         WHERE patient_id IN (' . $placeholders . ') AND DATE(recorded_at) = CURDATE()'
    );
    $sessionsTodayStmt->execute($scopePatientIds);
    $sessionsToday = (int) (($sessionsTodayStmt->fetch()['c'] ?? 0));

    $avgGripStmt = $pdo->prepare(
        'SELECT AVG(grip_strength) AS avg_grip
         FROM sensor_data
         WHERE patient_id IN (' . $placeholders . ') AND grip_strength IS NOT NULL'
    );
    $avgGripStmt->execute($scopePatientIds);
    $avgGrip = (float) (($avgGripStmt->fetch()['avg_grip'] ?? 0));

    $avgRangeStmt = $pdo->prepare(
        'SELECT AVG(flexion_angle) AS avg_range
         FROM sensor_data
         WHERE patient_id IN (' . $placeholders . ') AND flexion_angle IS NOT NULL'
    );
    $avgRangeStmt->execute($scopePatientIds);
    $avgRange = (float) (($avgRangeStmt->fetch()['avg_range'] ?? 0));

    $recentActivityStmt = $pdo->prepare(
        'SELECT p.name AS patient_name, sd.note, sd.recorded_at
         FROM sensor_data sd
         INNER JOIN patients p ON p.id = sd.patient_id
         WHERE sd.patient_id IN (' . $placeholders . ')
         ORDER BY sd.recorded_at DESC
         LIMIT 8'
    );
    $recentActivityStmt->execute($scopePatientIds);
    $recentActivity = $recentActivityStmt->fetchAll();

    $weeklyStmt = $pdo->prepare(
        'SELECT WEEKDAY(recorded_at) AS wd, AVG(grip_strength) AS avg_grip, AVG(flexion_angle) AS avg_range
         FROM sensor_data
         WHERE patient_id IN (' . $placeholders . ') AND recorded_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         GROUP BY WEEKDAY(recorded_at)
         ORDER BY WEEKDAY(recorded_at)'
    );
    $weeklyStmt->execute($scopePatientIds);

    foreach ($weeklyStmt->fetchAll() as $row) {
        $idx = (int) ($row['wd'] ?? -1);
        if ($idx >= 0 && $idx <= 6) {
            $weeklyGrip[$idx] = round((float) ($row['avg_grip'] ?? 0), 2);
            $weeklyRange[$idx] = round((float) ($row['avg_range'] ?? 0), 2);
        }
    }
}

echo json_encode([
    'ok' => true,
    'selectedPatientId' => $requestedPatientId > 0 ? $requestedPatientId : null,
    'summary' => [
        'totalPatients' => $totalPatients,
        'sessionsToday' => $sessionsToday,
        'avgGripStrength' => round($avgGrip, 2),
        'avgRangeOfMotion' => round($avgRange, 2)
    ],
    'patients' => array_map(static function ($patient) {
        return [
            'id' => (int) ($patient['id'] ?? 0),
            'name' => (string) ($patient['name'] ?? ''),
            'status' => (string) ($patient['status'] ?? 'Stable'),
            'last_session' => $patient['last_session'] ?? null
        ];
    }, $patients),
    'quickOverview' => array_slice(array_map(static function ($patient) {
        return [
            'id' => (int) ($patient['id'] ?? 0),
            'name' => (string) ($patient['name'] ?? ''),
            'status' => (string) ($patient['status'] ?? 'Stable'),
            'last_session' => $patient['last_session'] ?? null
        ];
    }, $patients), 0, 8),
    'recentActivity' => $recentActivity,
    'weeklyChart' => [
        'labels' => $weeklyLabels,
        'avgGrip' => $weeklyGrip,
        'avgRange' => $weeklyRange
    ]
]);
