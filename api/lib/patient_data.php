<?php

function requirePatientSessionOrExit(): int
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    $role = strtolower(trim((string) ($_SESSION['role'] ?? '')));
    $userId = (int) ($_SESSION['user_id'] ?? 0);
    $patientId = (int) ($_SESSION['patient_id'] ?? 0);

    if ($role !== 'patient' || ($userId <= 0 && $patientId <= 0)) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
        exit;
    }

    return $userId;
}

function patientTableColumns(PDO $pdo): array
{
    $columns = [];
    $stmt = $pdo->query('DESCRIBE patients');
    foreach ($stmt->fetchAll() as $row) {
        if (isset($row['Field'])) {
            $columns[] = strtolower((string) $row['Field']);
        }
    }
    return $columns;
}

function ensureSensorDataTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS sensor_data (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT NOT NULL,
            grip_strength DECIMAL(6,2) NULL,
            flexion_angle DECIMAL(6,2) NULL,
            repetitions INT NULL,
            note VARCHAR(255) NULL,
            recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_sensor_patient_id (patient_id),
            INDEX idx_sensor_recorded_at (recorded_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

function ensureSessionsTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT NOT NULL,
            grip_strength DECIMAL(6,2) NULL,
            flexion_angle DECIMAL(6,2) NULL,
            repetitions INT NULL,
            source VARCHAR(40) NOT NULL DEFAULT "manual",
            status VARCHAR(80) NULL,
            note VARCHAR(255) NULL,
            recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_sessions_patient_id (patient_id),
            INDEX idx_sessions_recorded_at (recorded_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

function getCurrentPatient(PDO $pdo): array
{
    $userId = requirePatientSessionOrExit();
    $patientSessionId = (int) ($_SESSION['patient_id'] ?? 0);
    $username = trim((string) ($_SESSION['username'] ?? ''));

    $columns = patientTableColumns($pdo);
    $hasUserId = in_array('user_id', $columns, true);
    $hasUsername = in_array('username', $columns, true);

    $patient = null;

    if ($patientSessionId > 0) {
        $stmt = $pdo->prepare('SELECT * FROM patients WHERE id = ? LIMIT 1');
        $stmt->execute([$patientSessionId]);
        $patient = $stmt->fetch();
    }

    if (!$patient && $hasUserId && $userId > 0) {
        $stmt = $pdo->prepare('SELECT * FROM patients WHERE user_id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $patient = $stmt->fetch();
    }

    if (!$patient && $hasUsername && $username !== '') {
        $stmt = $pdo->prepare('SELECT * FROM patients WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $patient = $stmt->fetch();
    }

    if (!$patient) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Patient profile not found for this session']);
        exit;
    }

    return $patient;
}

function getPatientPlan(PDO $pdo, int $patientId): array
{
    $defaultPlan = [
        'template_name' => 'Default',
        'duration_min' => 20,
        'target_repetitions' => 120,
        'sessions_per_day' => 2
    ];

    try {
        $stmt = $pdo->prepare(
            'SELECT template_name, duration_min, target_repetitions, sessions_per_day
             FROM therapy_plans
             WHERE patient_id = ?
             LIMIT 1'
        );
        $stmt->execute([$patientId]);
        $row = $stmt->fetch();
        if (!$row) {
            return $defaultPlan;
        }

        return [
            'template_name' => (string) ($row['template_name'] ?? 'Default'),
            'duration_min' => (int) ($row['duration_min'] ?? 20),
            'target_repetitions' => (int) ($row['target_repetitions'] ?? 120),
            'sessions_per_day' => (int) ($row['sessions_per_day'] ?? 2)
        ];
    } catch (Throwable $e) {
        return $defaultPlan;
    }
}
