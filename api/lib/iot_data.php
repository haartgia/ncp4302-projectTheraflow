<?php

function ensureCalibrationCommandTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS iot_glove_commands (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT NOT NULL,
            command VARCHAR(40) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT "pending",
            payload JSON NULL,
            requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            dispatched_at DATETIME NULL,
            completed_at DATETIME NULL,
            INDEX idx_iot_commands_patient_id (patient_id),
            INDEX idx_iot_commands_status (status),
            INDEX idx_iot_commands_requested_at (requested_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

function calibrationProfileFromPayload(array $payload): array
{
    $calibration = $payload['calibration'] ?? $payload;

    $straightValues = calibrationNumericListFromMixed(
        $calibration['straight_values'] ?? $calibration['straightValues'] ?? $calibration['open_values'] ?? $calibration['openValues'] ?? null
    );
    $bendValues = calibrationNumericListFromMixed(
        $calibration['bend_values'] ?? $calibration['bendValues'] ?? $calibration['closed_values'] ?? $calibration['closedValues'] ?? null
    );

    $gripMin = calibrationScalarFromMixed(
        $calibration['grip_min'] ?? $calibration['gripMin'] ?? $calibration['grip_open'] ?? $calibration['gripOpen'] ?? null
    );
    $gripMax = calibrationScalarFromMixed(
        $calibration['grip_max'] ?? $calibration['gripMax'] ?? $calibration['grip_closed'] ?? $calibration['gripClosed'] ?? null
    );

    $fingerNames = [];
    if (isset($calibration['finger_names']) && is_array($calibration['finger_names'])) {
        foreach ($calibration['finger_names'] as $name) {
            if (is_scalar($name)) {
                $fingerNames[] = trim((string) $name);
            }
        }
    }

    return [
        'straight_values' => $straightValues,
        'bend_values' => $bendValues,
        'grip_min' => $gripMin,
        'grip_max' => $gripMax,
        'finger_names' => $fingerNames,
        'captured_at' => $payload['captured_at'] ?? $payload['completed_at'] ?? null
    ];
}

function calibrationNumericListFromMixed($value): array
{
    if (!is_array($value)) {
        return [];
    }

    $numbers = [];
    foreach ($value as $item) {
        if (is_numeric($item)) {
            $numbers[] = (float) $item;
        }
    }

    return $numbers;
}

function calibrationScalarFromMixed($value): ?float
{
    if (is_numeric($value)) {
        return (float) $value;
    }

    return null;
}
