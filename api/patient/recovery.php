<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/patient_data.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$patient = getCurrentPatient($pdo);
$patientId = (int) ($patient['id'] ?? 0);
if ($patientId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid patient context']);
    exit;
}

ensureSensorDataTable($pdo);

$plan = getPatientPlan($pdo, $patientId);
$targetRepetitions = max(1, (int) ($plan['target_repetitions'] ?? 120));
$romGoal = 180;

$stmt = $pdo->prepare(
    'SELECT id, grip_strength, flexion_angle, repetitions, note, recorded_at AS timestamp
     FROM sensor_data
     WHERE patient_id = ?
     ORDER BY timestamp DESC'
);
$stmt->execute([$patientId]);
$rows = $stmt->fetchAll();

$sevenDaysAgo = strtotime('-7 days');
$bestForce = 0.0;
$maxFlexion = 0.0;
$totalSessions = 0;

foreach ($rows as $row) {
    $time = strtotime((string) ($row['timestamp'] ?? 'now'));
    if ($time < $sevenDaysAgo) {
        continue;
    }

    $totalSessions += 1;
    $bestForce = max($bestForce, (float) ($row['grip_strength'] ?? 0));
    $maxFlexion = max($maxFlexion, (float) ($row['flexion_angle'] ?? 0));
}

$weeklyMap = [];
foreach (array_reverse($rows) as $row) {
    $time = strtotime((string) ($row['timestamp'] ?? 'now'));
    $weekLabel = date('Y', $time) . '-W' . date('W', $time);

    if (!isset($weeklyMap[$weekLabel])) {
        $weeklyMap[$weekLabel] = [
            'forceTotal' => 0.0,
            'romTotal' => 0.0,
            'count' => 0
        ];
    }

    $weeklyMap[$weekLabel]['forceTotal'] += (float) ($row['grip_strength'] ?? 0);
    $weeklyMap[$weekLabel]['romTotal'] += (float) ($row['flexion_angle'] ?? 0);
    $weeklyMap[$weekLabel]['count'] += 1;
}

$weekLabels = [];
$forceTrend = [];
$romTrend = [];
foreach ($weeklyMap as $week => $acc) {
    $count = max(1, (int) $acc['count']);
    $weekLabels[] = $week;
    $forceTrend[] = round($acc['forceTotal'] / $count, 2);
    $romTrend[] = round($acc['romTotal'] / $count, 2);
}

if (!$weekLabels) {
    $weekLabels = ['No Data'];
    $forceTrend = [0];
    $romTrend = [0];
}

$logs = [];
foreach (array_slice($rows, 0, 20) as $row) {
    $grip = (float) ($row['grip_strength'] ?? 0);
    $flexion = (float) ($row['flexion_angle'] ?? 0);
    $reps = (int) ($row['repetitions'] ?? 0);

    $metReps = $reps >= $targetRepetitions;
    $metRom = $flexion >= ($romGoal * 0.85);
    $status = ($metReps && $metRom) ? 'Success' : 'Needs Work';

    $logs[] = [
        'timestamp' => (string) ($row['timestamp'] ?? ''),
        'grip_strength' => $grip,
        'flexion_angle' => $flexion,
        'repetitions' => $reps,
        'status' => $status,
        'note' => (string) ($row['note'] ?? '')
    ];
}

echo json_encode([
    'ok' => true,
    'plan' => $plan,
    'targets' => [
        'targetRepetitions' => $targetRepetitions,
        'romGoal' => $romGoal
    ],
    'trend' => [
        'labels' => $weekLabels,
        'force' => $forceTrend,
        'rom' => $romTrend
    ],
    'quickStats' => [
        'bestForce' => round($bestForce, 1),
        'maxFlexion' => round($maxFlexion, 1),
        'totalSessions' => $totalSessions
    ],
    'logs' => $logs
]);
