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
    WHERE patient_id = ? AND note LIKE ?
     ORDER BY timestamp DESC'
);
$stmt->execute([$patientId, 'Exercise Hub Session%']);
$rows = $stmt->fetchAll();

function resolveClientTimezone(string $timezoneId): DateTimeZone
{
    $timezoneId = trim($timezoneId);
    if ($timezoneId !== '') {
        try {
            return new DateTimeZone($timezoneId);
        } catch (Throwable $e) {
            // Fallback to server timezone if client timezone is invalid.
        }
    }

    return new DateTimeZone(date_default_timezone_get());
}

function toClientDayKey(string $timestamp, DateTimeZone $serverTimezone, DateTimeZone $clientTimezone): ?string
{
    $timestamp = trim($timestamp);
    if ($timestamp === '') {
        return null;
    }

    try {
        $date = new DateTimeImmutable($timestamp, $serverTimezone);
    } catch (Throwable $e) {
        return null;
    }

    return $date->setTimezone($clientTimezone)->format('Y-m-d');
}

$bestForce = 0.0;
$maxFlexion = 0.0;
$totalSessions = count($rows);
$bestSession = null;

function buildTrendBuckets(array $rowsAscending, string $mode): array
{
    $bucketMap = [];

    foreach ($rowsAscending as $row) {
        $time = strtotime((string) ($row['timestamp'] ?? 'now'));
        if ($time <= 0) {
            continue;
        }

        $key = '';
        $label = '';
        if ($mode === 'daily') {
            $key = date('Y-m-d', $time);
            $label = date('M d', $time);
        } elseif ($mode === 'weekly') {
            $year = date('o', $time);
            $week = date('W', $time);
            $key = sprintf('%04d-W%02d', (int) $year, (int) $week);
            $label = 'W' . $week . ' ' . $year;
        } else {
            $year = date('Y', $time);
            $key = $year;
            $label = $year;
        }

        if (!isset($bucketMap[$key])) {
            $bucketMap[$key] = [
                'label' => $label,
                'forceTotal' => 0.0,
                'romTotal' => 0.0,
                'count' => 0
            ];
        }

        $bucketMap[$key]['forceTotal'] += (float) ($row['grip_strength'] ?? 0);
        $bucketMap[$key]['romTotal'] += (float) ($row['flexion_angle'] ?? 0);
        $bucketMap[$key]['count'] += 1;
    }

    if (!$bucketMap) {
        return [
            'labels' => ['No Data'],
            'force' => [0],
            'rom' => [0]
        ];
    }

    ksort($bucketMap);

    $labels = [];
    $force = [];
    $rom = [];
    foreach ($bucketMap as $bucket) {
        $count = max(1, (int) ($bucket['count'] ?? 0));
        $labels[] = (string) ($bucket['label'] ?? '');
        $force[] = round(((float) ($bucket['forceTotal'] ?? 0)) / $count, 2);
        $rom[] = round(((float) ($bucket['romTotal'] ?? 0)) / $count, 2);
    }

    return [
        'labels' => $labels,
        'force' => $force,
        'rom' => $rom
    ];
}

function parseRecoveryNoteMeta(string $note): array
{
    $meta = [
        'max_extension' => null,
        'exercise_type' => '',
        'duration_sec' => null
    ];

    if ($note === '') {
        return $meta;
    }

    $parts = preg_split('/\|/', $note) ?: [];
    foreach ($parts as $part) {
        $segment = trim((string) $part);
        if ($segment === '') {
            continue;
        }

        if (preg_match('/^MaxExtension\s*=\s*([\d.]+)/i', $segment, $match)) {
            $meta['max_extension'] = (float) $match[1];
            continue;
        }

        if (preg_match('/^ExerciseType\s*=\s*(.+)$/i', $segment, $match)) {
            $meta['exercise_type'] = trim((string) $match[1]);
            continue;
        }

        if (preg_match('/^DurationSec\s*=\s*(\d+)/i', $segment, $match)) {
            $meta['duration_sec'] = (int) $match[1];
            continue;
        }
    }

    return $meta;
}

$rowsAscending = array_reverse($rows);
$logs = [];

foreach ($rows as $row) {
    $grip = (float) ($row['grip_strength'] ?? 0);
    $flexion = (float) ($row['flexion_angle'] ?? 0);
    $reps = (int) ($row['repetitions'] ?? 0);

    $bestForce = max($bestForce, $grip);
    $maxFlexion = max($maxFlexion, $flexion);

    $metReps = $reps >= $targetRepetitions;
    $metRom = $flexion >= ($romGoal * 0.85);
    $status = 'Needs Work';
    if ($metReps && $metRom) {
        $status = 'Great Job';
    } elseif ($metReps || $metRom) {
        $status = 'Improving';
    }

    $note = (string) ($row['note'] ?? '');
    $noteMeta = parseRecoveryNoteMeta($note);

    $currentLog = [
        'timestamp' => (string) ($row['timestamp'] ?? ''),
        'grip_strength' => $grip,
        'flexion_angle' => $flexion,
        'finger_movement' => $flexion,
        'max_extension' => $noteMeta['max_extension'],
        'exercise_type' => (string) ($noteMeta['exercise_type'] ?? ''),
        'duration_sec' => $noteMeta['duration_sec'],
        'repetitions' => $reps,
        'status' => $status,
        'note' => $note
    ];

    $logs[] = $currentLog;

    if ($bestSession === null) {
        $bestSession = $currentLog;
    } else {
        $bestReps = (int) ($bestSession['repetitions'] ?? 0);
        $bestGrip = (float) ($bestSession['grip_strength'] ?? 0);
        $bestRom = (float) ($bestSession['flexion_angle'] ?? 0);

        if ($reps > $bestReps || ($reps === $bestReps && $grip > $bestGrip) || ($reps === $bestReps && $grip === $bestGrip && $flexion > $bestRom)) {
            $bestSession = $currentLog;
        }
    }
}

$recentLogs = array_slice($logs, 0, 5);

$trendDaily = buildTrendBuckets($rowsAscending, 'daily');
$trendWeekly = buildTrendBuckets($rowsAscending, 'weekly');
$trendYearly = buildTrendBuckets($rowsAscending, 'yearly');

$clientTimezone = resolveClientTimezone((string) ($_GET['tz'] ?? ''));
$serverTimezone = new DateTimeZone(date_default_timezone_get());

$completedDates = [];
foreach ($rows as $row) {
    $reps = (int) ($row['repetitions'] ?? 0);
    if ($reps <= 0) {
        continue;
    }

    $dayKey = toClientDayKey((string) ($row['timestamp'] ?? ''), $serverTimezone, $clientTimezone);
    if ($dayKey === null) {
        continue;
    }

    $completedDates[$dayKey] = true;
}

$today = new DateTimeImmutable('today', $clientTimezone);
$consecutiveDays = 0;
$startDay = isset($completedDates[$today->format('Y-m-d')])
    ? $today
    : $today->sub(new DateInterval('P1D'));

for ($offset = 0; $offset < 366; $offset += 1) {
    $dayKey = $startDay->sub(new DateInterval('P' . $offset . 'D'))->format('Y-m-d');
    if (!isset($completedDates[$dayKey])) {
        break;
    }
    $consecutiveDays += 1;
}

$monday = $today->modify('monday this week');
$weekCompletedMondayFirst = [];
for ($idx = 0; $idx < 7; $idx += 1) {
    $dayKey = $monday->add(new DateInterval('P' . $idx . 'D'))->format('Y-m-d');
    $weekCompletedMondayFirst[] = isset($completedDates[$dayKey]);
}

echo json_encode([
    'ok' => true,
    'plan' => $plan,
    'targets' => [
        'targetRepetitions' => $targetRepetitions,
        'romGoal' => $romGoal,
        'forceGoal' => 50
    ],
    'trends' => [
        'daily' => $trendDaily,
        'weekly' => $trendWeekly,
        'yearly' => $trendYearly
    ],
    'quickStats' => [
        'bestForce' => round($bestForce, 1),
        'maxFlexion' => round($maxFlexion, 1),
        'totalSessions' => $totalSessions
    ],
    'streak' => [
        'consecutiveDays' => $consecutiveDays,
        'weekCompletedMondayFirst' => $weekCompletedMondayFirst
    ],
    'recentLogs' => $recentLogs,
    'logs' => $logs,
    'bestSession' => $bestSession
]);
