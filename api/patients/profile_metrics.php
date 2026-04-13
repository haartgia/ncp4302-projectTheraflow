<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/doctor_data.php';

$doctorId = requireDoctorSessionOrExit();
ensureSensorDataTable($pdo);
ensureTherapyPlansTable($pdo);

$patientId = (int) ($_GET['patientId'] ?? 0);
if ($patientId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid patient id']);
    exit;
}

$patientStmt = $pdo->prepare('SELECT id, doctor_id FROM patients WHERE id = ? LIMIT 1');
$patientStmt->execute([$patientId]);
$patient = $patientStmt->fetch(PDO::FETCH_ASSOC);
if (!$patient || (int) ($patient['doctor_id'] ?? 0) !== $doctorId) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Access denied']);
    exit;
}

$sensorTable = 'sensor_data';
try {
    $tableCheck = $pdo->prepare(
        'SELECT COUNT(*) AS c
         FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ?'
    );
    $tableCheck->execute(['sensor_logs']);
    $hasSensorLogs = (int) ($tableCheck->fetch(PDO::FETCH_ASSOC)['c'] ?? 0) > 0;
    if ($hasSensorLogs) {
        $sensorTable = 'sensor_logs';
    }
} catch (Throwable $e) {
    $sensorTable = 'sensor_data';
}

$summaryStmt = $pdo->prepare(
    'SELECT
        AVG(grip_strength) AS avg_grip,
        AVG(flexion_angle) AS avg_flexion,
        SUM(CASE WHEN DATE(recorded_at) = CURDATE() THEN COALESCE(repetitions, 0) ELSE 0 END) AS repetitions_today
     FROM ' . $sensorTable . '
    WHERE patient_id = ? AND note LIKE ?'
);
$summaryStmt->execute([$patientId, 'Exercise Hub Session%']);
$summary = $summaryStmt->fetch(PDO::FETCH_ASSOC) ?: [];

$latestStmt = $pdo->prepare(
    'SELECT grip_strength, flexion_angle, repetitions, recorded_at
    FROM ' . $sensorTable . '
    WHERE patient_id = ? AND note LIKE ?
     ORDER BY recorded_at DESC
     LIMIT 1'
);
$latestStmt->execute([$patientId, 'Exercise Hub Session%']);
$latest = $latestStmt->fetch(PDO::FETCH_ASSOC) ?: null;

$weekGrip = [0, 0, 0, 0, 0, 0, 0];
$weekFlexion = [0, 0, 0, 0, 0, 0, 0];
$weeklyStmt = $pdo->prepare(
    'SELECT WEEKDAY(recorded_at) AS wd, AVG(grip_strength) AS avg_grip, AVG(flexion_angle) AS avg_flexion
    FROM ' . $sensorTable . '
    WHERE patient_id = ? AND note LIKE ? AND recorded_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
     GROUP BY WEEKDAY(recorded_at)
     ORDER BY WEEKDAY(recorded_at)'
);
$weeklyStmt->execute([$patientId, 'Exercise Hub Session%']);
foreach ($weeklyStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $idx = (int) ($row['wd'] ?? -1);
    if ($idx >= 0 && $idx <= 6) {
        $weekGrip[$idx] = round((float) ($row['avg_grip'] ?? 0), 2);
        $weekFlexion[$idx] = round((float) ($row['avg_flexion'] ?? 0), 2);
    }
}

$planStmt = $pdo->prepare(
    'SELECT duration_min, target_repetitions, sessions_per_day
     FROM therapy_plans
     WHERE patient_id = ?
     LIMIT 1'
);
$planStmt->execute([$patientId]);
$plan = $planStmt->fetch(PDO::FETCH_ASSOC) ?: [
    'duration_min' => 20,
    'target_repetitions' => 120,
    'sessions_per_day' => 2
];

echo json_encode([
    'ok' => true,
    'summary' => [
        'avgGripStrength' => round((float) ($summary['avg_grip'] ?? 0), 2),
        'avgFlexionAngle' => round((float) ($summary['avg_flexion'] ?? 0), 2),
        'repetitionsToday' => (int) ($summary['repetitions_today'] ?? 0)
    ],
    'weeklyChart' => [
        'labels' => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        'grip' => $weekGrip,
        'flexion' => $weekFlexion
    ],
    'plan' => [
        'duration_min' => (int) ($plan['duration_min'] ?? 20),
        'target_repetitions' => (int) ($plan['target_repetitions'] ?? 120),
        'sessions_per_day' => (int) ($plan['sessions_per_day'] ?? 2)
    ],
    'latest' => $latest
]);
