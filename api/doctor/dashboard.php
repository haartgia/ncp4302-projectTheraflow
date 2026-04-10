<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/doctor_data.php';

$doctorId = requireDoctorSessionOrExit();
ensureSensorDataTable($pdo);

$patients = getDoctorPatients($pdo, $doctorId);
$patientIds = array_map(static fn($p) => (int) ($p['id'] ?? 0), $patients);
$patientIds = array_values(array_filter($patientIds, static fn($id) => $id > 0));

$totalPatients = count($patients);

$activeToday = 0;
$today = new DateTime('today');
foreach ($patients as $patient) {
    $last = $patient['last_session'] ?? null;
    if (!$last) {
        continue;
    }
    try {
        $lastDate = new DateTime((string) $last);
        if ($lastDate >= $today) {
            $activeToday += 1;
        }
    } catch (Throwable $e) {
        // Ignore malformed dates.
    }
}

$sessionsToday = 0;
$avgGrip = 0.0;
$avgRange = 0.0;
$recentActivity = [];
$weeklyLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
$weeklyGrip = [0, 0, 0, 0, 0, 0, 0];
$weeklyRange = [0, 0, 0, 0, 0, 0, 0];

if (!empty($patientIds)) {
    $placeholders = implode(',', array_fill(0, count($patientIds), '?'));

    $todaySessionsStmt = $pdo->prepare(
        'SELECT COUNT(*) AS c FROM sensor_data WHERE patient_id IN (' . $placeholders . ') AND DATE(recorded_at) = CURDATE()'
    );
    $todaySessionsStmt->execute($patientIds);
    $sessionsToday = (int) (($todaySessionsStmt->fetch()['c'] ?? 0));

    $avgGripStmt = $pdo->prepare(
        'SELECT AVG(grip_strength) AS avg_grip FROM sensor_data WHERE patient_id IN (' . $placeholders . ') AND grip_strength IS NOT NULL'
    );
    $avgGripStmt->execute($patientIds);
    $avgGrip = (float) (($avgGripStmt->fetch()['avg_grip'] ?? 0));

    $avgRangeStmt = $pdo->prepare(
        'SELECT AVG(flexion_angle) AS avg_range FROM sensor_data WHERE patient_id IN (' . $placeholders . ') AND flexion_angle IS NOT NULL'
    );
    $avgRangeStmt->execute($patientIds);
    $avgRange = (float) (($avgRangeStmt->fetch()['avg_range'] ?? 0));

    $activityStmt = $pdo->prepare(
        'SELECT p.name AS patient_name, sd.note, sd.recorded_at
         FROM sensor_data sd
         INNER JOIN patients p ON p.id = sd.patient_id
         WHERE sd.patient_id IN (' . $placeholders . ')
         ORDER BY sd.recorded_at DESC
         LIMIT 8'
    );
    $activityStmt->execute($patientIds);
    $recentActivity = $activityStmt->fetchAll();

    $weeklyStmt = $pdo->prepare(
        'SELECT WEEKDAY(recorded_at) AS wd, AVG(grip_strength) AS avg_grip, AVG(flexion_angle) AS avg_range
         FROM sensor_data
         WHERE patient_id IN (' . $placeholders . ') AND recorded_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         GROUP BY WEEKDAY(recorded_at)
         ORDER BY WEEKDAY(recorded_at)'
    );
    $weeklyStmt->execute($patientIds);
    foreach ($weeklyStmt->fetchAll() as $row) {
        $idx = (int) ($row['wd'] ?? -1);
        if ($idx >= 0 && $idx <= 6) {
            $weeklyGrip[$idx] = round((float) ($row['avg_grip'] ?? 0), 2);
            $weeklyRange[$idx] = round((float) ($row['avg_range'] ?? 0), 2);
        }
    }
}

$alerts = [];
if ($totalPatients === 0) {
    $alerts[] = 'No patients added yet.';
} elseif ($sessionsToday === 0) {
    $alerts[] = 'No sensor sessions recorded today.';
}

echo json_encode([
    'ok' => true,
    'summary' => [
        'totalPatients' => $totalPatients,
        'activePatientsToday' => $activeToday,
        'sessionsToday' => $sessionsToday,
        'avgGripStrength' => round($avgGrip, 2),
        'avgRangeOfMotion' => round($avgRange, 2)
    ],
    'alerts' => $alerts,
    'recentActivity' => $recentActivity,
    'quickOverview' => array_slice(array_map(static function ($p) {
        return [
            'id' => (int) $p['id'],
            'name' => (string) ($p['name'] ?? ''),
            'status' => (string) ($p['status'] ?? 'Stable'),
            'last_session' => $p['last_session']
        ];
    }, $patients), 0, 8),
    'weeklyChart' => [
        'labels' => $weeklyLabels,
        'avgGrip' => $weeklyGrip,
        'avgRange' => $weeklyRange
    ]
]);
