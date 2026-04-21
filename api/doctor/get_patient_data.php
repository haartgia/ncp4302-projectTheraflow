    <?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/doctor_data.php';

function ensureDiagnosticLogsTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS diagnostic_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT NOT NULL,
            stage_name VARCHAR(120) NULL,
            max_extension DECIMAL(6,2) DEFAULT 0,
            max_flexion DECIMAL(6,2) DEFAULT 0,
            peak_force DECIMAL(6,2) DEFAULT 0,
            logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_diag_patient_id (patient_id),
            INDEX idx_diag_logged_at (logged_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );

    try {
        $pdo->exec('ALTER TABLE diagnostic_logs ADD COLUMN stage_name VARCHAR(120) NULL AFTER patient_id');
    } catch (Throwable $e) {
        // Column already exists.
    }
}

function parseActivityNote(string $note): array
{
    $parsed = [];
    $parts = array_filter(array_map('trim', explode('|', $note)), static fn($part) => $part !== '');
    foreach ($parts as $part) {
        $eqPos = strpos($part, '=');
        if ($eqPos === false) {
            continue;
        }
        $key = strtolower(trim(substr($part, 0, $eqPos)));
        $value = trim(substr($part, $eqPos + 1));
        if ($key !== '' && $value !== '') {
            $parsed[$key] = $value;
        }
    }

    return $parsed;
}

function formatExerciseTypeLabel(string $rawType): string
{
    $normalized = strtolower(trim($rawType));
    $normalized = str_replace(['-', ' '], '_', $normalized);

    $map = [
        'full_grip_hold' => 'Full Close',
        'full_close' => 'Full Close',
        'full_extension_hold' => 'Full Extension',
        'full_extension' => 'Full Extension',
        'open_close_hand' => 'Full Open-Close',
        'full_open_close' => 'Full Open-Close',
    ];

    if (isset($map[$normalized])) {
        return $map[$normalized];
    }

    if ($normalized === '') {
        return 'Full Open-Close';
    }

    $segments = array_filter(explode('_', $normalized), static fn($segment) => $segment !== '');
    $segments = array_map(static fn($segment) => ucfirst($segment), $segments);
    return implode(' ', $segments);
}

function formatDurationLabel(int $durationSec): string
{
    if ($durationSec <= 0) {
        return '--:-- min';
    }

    $mins = intdiv($durationSec, 60);
    $secs = $durationSec % 60;
    return sprintf('%02d:%02d min', $mins, $secs);
}

$doctorId = requireDoctorSessionOrExit();
ensureSensorDataTable($pdo);
ensureSessionsTable($pdo);
ensureDiagnosticLogsTable($pdo);

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

$dailyLabels = [];
$dailyGrip = [];
$dailyRange = [];
$dailyKeys = [];

for ($i = 6; $i >= 0; $i--) {
    $date = new DateTimeImmutable('-' . $i . ' day');
    $key = $date->format('Y-m-d');
    $dailyKeys[$key] = 6 - $i;
    $dailyLabels[] = $date->format('M j');
    $dailyGrip[] = 0;
    $dailyRange[] = 0;
}

$weeklyLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
$weeklyGrip = [0, 0, 0, 0, 0, 0, 0];
$weeklyRange = [0, 0, 0, 0, 0, 0, 0];

$monthlyLabels = [];
$monthlyGrip = [];
$monthlyRange = [];
$monthlyKeys = [];

for ($i = 6; $i >= 0; $i--) {
    $month = new DateTimeImmutable('first day of -' . $i . ' month');
    $key = $month->format('Y-m');
    $monthlyKeys[$key] = 6 - $i;
    $monthlyLabels[] = $month->format('M Y');
    $monthlyGrip[] = 0;
    $monthlyRange[] = 0;
}

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

    $recentActivityEvents = [];

    $exerciseActivityStmt = $pdo->prepare(
        'SELECT p.name AS patient_name, sd.repetitions, sd.note, sd.recorded_at
         FROM sensor_data sd
         INNER JOIN patients p ON p.id = sd.patient_id
         WHERE sd.patient_id IN (' . $placeholders . ')
           AND (sd.note LIKE ? OR sd.note LIKE ?)
         ORDER BY sd.recorded_at DESC
         LIMIT 20'
    );
    $exerciseParams = array_merge($scopePatientIds, ['%Exercise Hub Session%', '%ExerciseType=%']);
    $exerciseActivityStmt->execute($exerciseParams);
    foreach ($exerciseActivityStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $parsedNote = parseActivityNote((string) ($row['note'] ?? ''));
        $exerciseType = formatExerciseTypeLabel((string) ($parsedNote['exercisetype'] ?? $parsedNote['exercise_type'] ?? ''));
        $durationSec = (int) ($parsedNote['durationsec'] ?? 0);
        $reps = max(0, (int) ($row['repetitions'] ?? 0));

        $recentActivityEvents[] = [
            'patient_name' => (string) ($row['patient_name'] ?? ''),
            'event_type' => 'exercise',
            'activity_label' => 'Exercise: ' . $exerciseType,
            'metrics_primary' => $reps . ' reps',
            'metrics_secondary' => formatDurationLabel($durationSec),
            'recorded_at' => (string) ($row['recorded_at'] ?? ''),
            'badge_label' => 'Exercise',
            'badge_variant' => 'exercise'
        ];
    }

    $assessmentActivityStmt = $pdo->prepare(
        'SELECT p.name AS patient_name, dl.stage_name, dl.max_flexion, dl.peak_force, dl.logged_at
         FROM diagnostic_logs dl
         INNER JOIN patients p ON p.id = dl.patient_id
         WHERE dl.patient_id IN (' . $placeholders . ')
         ORDER BY dl.logged_at DESC
         LIMIT 20'
    );
    $assessmentActivityStmt->execute($scopePatientIds);
    foreach ($assessmentActivityStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $stageName = trim((string) ($row['stage_name'] ?? ''));
        if ($stageName === '') {
            $stageName = 'Initial Baseline';
        }

        $bestFlexion = number_format((float) ($row['max_flexion'] ?? 0), 1, '.', '');
        $peakForce = number_format((float) ($row['peak_force'] ?? 0), 1, '.', '');

        $recentActivityEvents[] = [
            'patient_name' => (string) ($row['patient_name'] ?? ''),
            'event_type' => 'assessment',
            'activity_label' => 'Assessment: ' . $stageName,
            'metrics_primary' => 'Best Flexion: ' . $bestFlexion . '°',
            'metrics_secondary' => 'Peak Force: ' . $peakForce . ' N',
            'recorded_at' => (string) ($row['logged_at'] ?? ''),
            'badge_label' => 'Assessment',
            'badge_variant' => 'assessment'
        ];
    }

    usort($recentActivityEvents, static function (array $a, array $b): int {
        $timeA = strtotime((string) ($a['recorded_at'] ?? '')) ?: 0;
        $timeB = strtotime((string) ($b['recorded_at'] ?? '')) ?: 0;
        return $timeB <=> $timeA;
    });

    $recentActivity = array_slice($recentActivityEvents, 0, 8);

    $weeklyStmt = $pdo->prepare(
        'SELECT WEEKDAY(recorded_at) AS wd, AVG(grip_strength) AS avg_grip, AVG(flexion_angle) AS avg_range
         FROM sensor_data
            WHERE patient_id IN (' . $placeholders . ') AND YEARWEEK(recorded_at, 1) = YEARWEEK(CURDATE(), 1)
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

    $dailyStmt = $pdo->prepare(
        'SELECT DATE(recorded_at) AS d, AVG(grip_strength) AS avg_grip, AVG(flexion_angle) AS avg_range
         FROM sensor_data
         WHERE patient_id IN (' . $placeholders . ') AND recorded_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         GROUP BY DATE(recorded_at)
         ORDER BY DATE(recorded_at)'
    );
    $dailyStmt->execute($scopePatientIds);

    foreach ($dailyStmt->fetchAll() as $row) {
        $key = (string) ($row['d'] ?? '');
        if ($key !== '' && array_key_exists($key, $dailyKeys)) {
            $idx = (int) $dailyKeys[$key];
            $dailyGrip[$idx] = round((float) ($row['avg_grip'] ?? 0), 2);
            $dailyRange[$idx] = round((float) ($row['avg_range'] ?? 0), 2);
        }
    }

    $monthlyStmt = $pdo->prepare(
        'SELECT DATE_FORMAT(recorded_at, "%Y-%m") AS ym, AVG(grip_strength) AS avg_grip, AVG(flexion_angle) AS avg_range
         FROM sensor_data
         WHERE patient_id IN (' . $placeholders . ') AND recorded_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 6 MONTH), "%Y-%m-01")
         GROUP BY DATE_FORMAT(recorded_at, "%Y-%m")
         ORDER BY ym'
    );
    $monthlyStmt->execute($scopePatientIds);

    foreach ($monthlyStmt->fetchAll() as $row) {
        $key = (string) ($row['ym'] ?? '');
        if ($key !== '' && array_key_exists($key, $monthlyKeys)) {
            $idx = (int) $monthlyKeys[$key];
            $monthlyGrip[$idx] = round((float) ($row['avg_grip'] ?? 0), 2);
            $monthlyRange[$idx] = round((float) ($row['avg_range'] ?? 0), 2);
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
    'dailyChart' => [
        'labels' => $dailyLabels,
        'avgGrip' => $dailyGrip,
        'avgRange' => $dailyRange
    ],
    'weeklyChart' => [
        'labels' => $weeklyLabels,
        'avgGrip' => $weeklyGrip,
        'avgRange' => $weeklyRange
    ],
    'monthlyChart' => [
        'labels' => $monthlyLabels,
        'avgGrip' => $monthlyGrip,
        'avgRange' => $monthlyRange
    ]
]);
