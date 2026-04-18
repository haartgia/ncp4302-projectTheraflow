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

function roundMetricSeries(array $values): array
{
    return array_map(static function ($value): float {
        return round((float) $value, 2);
    }, $values);
}

function buildRecentSeries(array $rowsDescending, string $metricKey): array
{
    $slice = array_slice($rowsDescending, 0, 7);
    $slice = array_reverse($slice);

    if (!$slice) {
        return [
            'labels' => ['S1'],
            'series' => [0.0]
        ];
    }

    $labels = [];
    $series = [];
    foreach ($slice as $index => $row) {
        $labels[] = 'S' . ($index + 1);
        $series[] = (float) ($row[$metricKey] ?? 0);
    }

    return [
        'labels' => $labels,
        'series' => roundMetricSeries($series)
    ];
}

function buildDailySeries(array $rowsDescending, string $metricKey): array
{
    $labels = [];
    $series = [];
    $keys = [];
    $sums = [];
    $counts = [];

    for ($i = 6; $i >= 0; $i -= 1) {
        $date = new DateTimeImmutable('-' . $i . ' days');
        $key = $date->format('Y-m-d');
        $keys[] = $key;
        $labels[] = $date->format('M j');
        $sums[$key] = 0.0;
        $counts[$key] = 0;
    }

    foreach ($rowsDescending as $row) {
        $recordedAt = trim((string) ($row['recorded_at'] ?? ''));
        if ($recordedAt === '') {
            continue;
        }

        $rowKey = date('Y-m-d', strtotime($recordedAt));
        if (!array_key_exists($rowKey, $sums)) {
            continue;
        }

        $sums[$rowKey] += (float) ($row[$metricKey] ?? 0);
        $counts[$rowKey] += 1;
    }

    foreach ($keys as $key) {
        if (($counts[$key] ?? 0) > 0) {
            $series[] = $sums[$key] / $counts[$key];
        } else {
            $series[] = 0.0;
        }
    }

    return [
        'labels' => $labels,
        'series' => roundMetricSeries($series)
    ];
}

function buildMonthlySeries(array $rowsDescending, string $metricKey): array
{
    $labels = [];
    $series = [];
    $keys = [];
    $sums = [];
    $counts = [];

    for ($i = 5; $i >= 0; $i -= 1) {
        $month = new DateTimeImmutable('first day of -' . $i . ' month');
        $key = $month->format('Y-m');
        $keys[] = $key;
        $labels[] = $month->format('M Y');
        $sums[$key] = 0.0;
        $counts[$key] = 0;
    }

    foreach ($rowsDescending as $row) {
        $recordedAt = trim((string) ($row['recorded_at'] ?? ''));
        if ($recordedAt === '') {
            continue;
        }

        $rowKey = date('Y-m', strtotime($recordedAt));
        if (!array_key_exists($rowKey, $sums)) {
            continue;
        }

        $sums[$rowKey] += (float) ($row[$metricKey] ?? 0);
        $counts[$rowKey] += 1;
    }

    foreach ($keys as $key) {
        if (($counts[$key] ?? 0) > 0) {
            $series[] = $sums[$key] / $counts[$key];
        } else {
            $series[] = 0.0;
        }
    }

    return [
        'labels' => $labels,
        'series' => roundMetricSeries($series)
    ];
}

$trendRowsStmt = $pdo->prepare(
    'SELECT grip_strength, flexion_angle, recorded_at
    FROM ' . $sensorTable . '
    WHERE patient_id = ? AND note LIKE ?
    ORDER BY recorded_at DESC'
);
$trendRowsStmt->execute([$patientId, 'Exercise Hub Session%']);
$trendRows = $trendRowsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

$recentGripSeries = buildRecentSeries($trendRows, 'grip_strength');
$recentFlexionSeries = buildRecentSeries($trendRows, 'flexion_angle');
$dailyGripSeries = buildDailySeries($trendRows, 'grip_strength');
$dailyFlexionSeries = buildDailySeries($trendRows, 'flexion_angle');
$monthlyGripSeries = buildMonthlySeries($trendRows, 'grip_strength');
$monthlyFlexionSeries = buildMonthlySeries($trendRows, 'flexion_angle');

$bestGrip = 0.0;
$bestFlexion = 0.0;
foreach ($trendRows as $row) {
    $bestGrip = max($bestGrip, (float) ($row['grip_strength'] ?? 0));
    $bestFlexion = max($bestFlexion, (float) ($row['flexion_angle'] ?? 0));
}

$planStmt = $pdo->prepare(
    'SELECT template_name, duration_min, target_repetitions, sessions_per_day, exercise_bundle_json
     FROM therapy_plans
     WHERE patient_id = ?
     LIMIT 1'
);
$planStmt->execute([$patientId]);
$plan = $planStmt->fetch(PDO::FETCH_ASSOC) ?: [
    'template_name' => 'Default',
    'duration_min' => 0,
    'target_repetitions' => 0,
    'sessions_per_day' => 0,
    'exercise_bundle_json' => null
];

$exerciseBundle = null;
try {
    if (isset($plan['exercise_bundle_json']) && is_string($plan['exercise_bundle_json']) && trim($plan['exercise_bundle_json']) !== '') {
        $decoded = json_decode($plan['exercise_bundle_json'], true);
        if (is_array($decoded)) {
            $exerciseBundle = $decoded;
        }
    }
} catch (Throwable $e) {
    $exerciseBundle = null;
}

$sessionsPerDay = (int) ($plan['sessions_per_day'] ?? 0);
$planExercises = [];
if (is_array($exerciseBundle)) {
    foreach (['open_close', 'full_extension', 'full_close'] as $type) {
        $raw = $exerciseBundle[$type] ?? null;
        $reps = 0;
        $perExerciseSessions = $sessionsPerDay;
        if (is_array($raw)) {
            $reps = max(0, (int) ($raw['reps'] ?? 0));
            $perExerciseSessions = max(0, (int) ($raw['sessions'] ?? $sessionsPerDay));
        } else {
            $reps = max(0, (int) $raw);
        }
        if ($reps > 0) {
            $planExercises[] = [
                'type' => $type,
                'reps' => $reps,
                'sessions' => $perExerciseSessions
            ];
        }
    }
}

echo json_encode([
    'ok' => true,
    'summary' => [
        'avgGripStrength' => round((float) ($summary['avg_grip'] ?? 0), 2),
        'avgFlexionAngle' => round((float) ($summary['avg_flexion'] ?? 0), 2),
        'repetitionsToday' => (int) ($summary['repetitions_today'] ?? 0)
    ],
    'best' => [
        'grip' => round($bestGrip, 2),
        'flexion' => round($bestFlexion, 2)
    ],
    'weeklyChart' => [
        'labels' => $dailyGripSeries['labels'],
        'grip' => $dailyGripSeries['series'],
        'flexion' => $dailyFlexionSeries['series']
    ],
    'progressCharts' => [
        'recent' => [
            'labels' => $recentGripSeries['labels'],
            'grip' => $recentGripSeries['series'],
            'flexion' => $recentFlexionSeries['series']
        ],
        'daily' => [
            'labels' => $dailyGripSeries['labels'],
            'grip' => $dailyGripSeries['series'],
            'flexion' => $dailyFlexionSeries['series']
        ],
        'monthly' => [
            'labels' => $monthlyGripSeries['labels'],
            'grip' => $monthlyGripSeries['series'],
            'flexion' => $monthlyFlexionSeries['series']
        ]
    ],
    'plan' => [
        'template_name' => (string) ($plan['template_name'] ?? 'Default'),
        'duration_min' => (int) ($plan['duration_min'] ?? 0),
        'target_repetitions' => (int) ($plan['target_repetitions'] ?? 0),
        'sessions_per_day' => $sessionsPerDay,
        'exercises' => $planExercises
    ],
    'latest' => $latest
]);
