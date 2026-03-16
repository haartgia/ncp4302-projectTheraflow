<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/doctor_data.php';

$doctorId = requireDoctorSessionOrExit();
ensureSensorDataTable($pdo);

$patients = getDoctorPatients($pdo, $doctorId);
if (empty($patients)) {
    echo json_encode(['ok' => true, 'patients' => [], 'datasets' => [], 'leaderboard' => [], 'heatmap' => []]);
    exit;
}

$datasets = [];
$leaderboard = [];
$dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
$heatmap = array_fill_keys($dayLabels, 0);

$seriesStmt = $pdo->prepare(
    'SELECT DATE(recorded_at) AS day, AVG(grip_strength) AS avg_grip, AVG(flexion_angle) AS avg_flexion, COUNT(*) AS sessions
     FROM sensor_data
     WHERE patient_id = ? AND recorded_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
     GROUP BY DATE(recorded_at)
     ORDER BY DATE(recorded_at)'
);

foreach ($patients as $patient) {
    $patientId = (int) ($patient['id'] ?? 0);
    $patientName = (string) ($patient['name'] ?? 'Patient');

    $seriesStmt->execute([$patientId]);
    $rows = $seriesStmt->fetchAll();

    if (empty($rows)) {
        $datasets[] = [
            'patientId' => $patientId,
            'name' => $patientName,
            'hasData' => false,
            'grip' => array_fill(0, 7, 0),
            'flexion' => array_fill(0, 7, 0)
        ];
        continue;
    }

    $grip = array_fill(0, 7, 0);
    $flexion = array_fill(0, 7, 0);

    foreach ($rows as $row) {
        $ts = strtotime((string) ($row['day'] ?? ''));
        if ($ts === false) {
            continue;
        }

        $wd = (int) date('N', $ts) - 1;
        if ($wd < 0 || $wd > 6) {
            continue;
        }

        $grip[$wd] = round((float) ($row['avg_grip'] ?? 0), 2);
        $flexion[$wd] = round((float) ($row['avg_flexion'] ?? 0), 2);
        $heatmap[$dayLabels[$wd]] += (int) ($row['sessions'] ?? 0);
    }

    $firstGrip = 0;
    $lastGrip = 0;
    foreach ($grip as $value) {
        if ($value > 0 && $firstGrip === 0.0) {
            $firstGrip = $value;
        }
        if ($value > 0) {
            $lastGrip = $value;
        }
    }

    $score = $firstGrip > 0 ? (($lastGrip - $firstGrip) / $firstGrip) * 100 : 0;
    $leaderboard[] = ['name' => $patientName, 'score' => round($score, 2)];

    $datasets[] = [
        'patientId' => $patientId,
        'name' => $patientName,
        'hasData' => true,
        'grip' => $grip,
        'flexion' => $flexion
    ];
}

usort($leaderboard, static fn($a, $b) => ($b['score'] <=> $a['score']));

echo json_encode([
    'ok' => true,
    'patients' => array_map(static fn($p) => ['id' => (int) $p['id'], 'name' => (string) $p['name']], $patients),
    'datasets' => $datasets,
    'leaderboard' => $leaderboard,
    'heatmap' => $heatmap,
    'labels' => $dayLabels
]);
