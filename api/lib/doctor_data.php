<?php

function requireDoctorSessionOrExit(): int
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    $role = strtolower(trim((string) ($_SESSION['role'] ?? '')));
    $userId = (int) ($_SESSION['user_id'] ?? 0);
    if ($role !== 'doctor' || $userId <= 0) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
        exit;
    }

    return $userId;
}

function getDoctorPatients(PDO $pdo, int $doctorId): array
{
    $stmt = $pdo->prepare(
        'SELECT id, user_id, doctor_id, name, age, gender, stroke_type, affected_hand, contact, username, status, last_session, created_at
         FROM patients
         WHERE doctor_id = ?
         ORDER BY id DESC'
    );
    $stmt->execute([$doctorId]);
    return $stmt->fetchAll();
}

function ensureTherapyPlansTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS therapy_plans (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT NOT NULL,
            template_name VARCHAR(80) NULL,
            duration_min INT NOT NULL DEFAULT 0,
            target_repetitions INT NOT NULL DEFAULT 0,
            sessions_per_day INT NOT NULL DEFAULT 0,
            exercise_bundle_json TEXT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_therapy_plan_patient (patient_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );

    try {
        $pdo->exec('ALTER TABLE therapy_plans ADD COLUMN exercise_bundle_json TEXT NULL AFTER sessions_per_day');
    } catch (Throwable $e) {
        // Column already exists.
    }
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

function ensureDefaultTherapyPlanRows(PDO $pdo, array $patients): void
{
    ensureTherapyPlansTable($pdo);

    $select = $pdo->prepare('SELECT id FROM therapy_plans WHERE patient_id = ? LIMIT 1');
    $insert = $pdo->prepare(
        'INSERT INTO therapy_plans (patient_id, template_name, duration_min, target_repetitions, sessions_per_day)
         VALUES (?, ?, ?, ?, ?)'
    );

    foreach ($patients as $patient) {
        $patientId = (int) ($patient['id'] ?? 0);
        if ($patientId <= 0) {
            continue;
        }

        $select->execute([$patientId]);
        if (!$select->fetch()) {
            $insert->execute([$patientId, 'Default', 0, 0, 0]);
        }
    }
}
