<?php
header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/iot_data.php';

function requestPayload(): array
{
    $raw = json_decode(file_get_contents('php://input'), true);
    if (is_array($raw)) {
        return $raw;
    }

    return $_POST ?: [];
}

ensureCalibrationCommandTable($pdo);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    $payload = requestPayload();
    $action = strtolower(trim((string) ($payload['action'] ?? 'request')));
    $patientId = (int) ($payload['patient_id'] ?? $payload['patientId'] ?? 0);
    $command = strtolower(trim((string) ($payload['command'] ?? 'calibrate')));
    $commandId = (int) ($payload['command_id'] ?? $payload['commandId'] ?? 0);

    if ($action === 'update') {
        if ($patientId <= 0 || $commandId <= 0) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'patient_id and command_id are required']);
            exit;
        }

        $progressPayload = $payload['payload'] ?? [
            'phase' => (string) ($payload['phase'] ?? ''),
            'seconds_remaining' => (int) ($payload['seconds_remaining'] ?? 0)
        ];

        $updateStmt = $pdo->prepare(
            'UPDATE iot_glove_commands
             SET status = "in_progress",
                 payload = ?,
                 dispatched_at = COALESCE(dispatched_at, NOW())
             WHERE id = ? AND patient_id = ?'
        );
        $updateStmt->execute([
            json_encode($progressPayload, JSON_UNESCAPED_SLASHES),
            $commandId,
            $patientId
        ]);

        echo json_encode([
            'ok' => true,
            'command_id' => $commandId,
            'patient_id' => $patientId,
            'status' => 'in_progress',
            'payload' => $progressPayload
        ]);
        exit;
    }

    if ($action === 'complete' || ($commandId > 0 && strtolower(trim((string) ($payload['status'] ?? ''))) === 'completed')) {
        if ($patientId <= 0 || $commandId <= 0) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'patient_id and command_id are required']);
            exit;
        }

        $completionPayload = $payload;
        if (!isset($completionPayload['calibration']) || !is_array($completionPayload['calibration'])) {
            $completionPayload['calibration'] = calibrationProfileFromPayload($payload);
        }

        $completeStmt = $pdo->prepare(
            'UPDATE iot_glove_commands
             SET status = "completed", payload = ?, completed_at = NOW()
             WHERE id = ? AND patient_id = ?'
        );
        $completeStmt->execute([
            json_encode($completionPayload, JSON_UNESCAPED_SLASHES),
            $commandId,
            $patientId
        ]);

        echo json_encode([
            'ok' => true,
            'command_id' => $commandId,
            'patient_id' => $patientId,
            'status' => 'completed',
            'payload' => $completionPayload
        ]);
        exit;
    }

    if ($patientId <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'patient_id is required']);
        exit;
    }

    if (!in_array($command, ['calibrate', 'start_session', 'stop_session', 'ping'], true)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Unsupported command']);
        exit;
    }

    $patientStmt = $pdo->prepare('SELECT id FROM patients WHERE id = ? LIMIT 1');
    $patientStmt->execute([$patientId]);
    if (!$patientStmt->fetch()) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Patient not found']);
        exit;
    }

    $insert = $pdo->prepare(
        'INSERT INTO iot_glove_commands (patient_id, command, status, payload, requested_at)
         VALUES (?, ?, "pending", ?, NOW())'
    );
    $insert->execute([
        $patientId,
        $command,
        json_encode([
            'source' => 'web'
        ], JSON_UNESCAPED_SLASHES)
    ]);

    echo json_encode([
        'ok' => true,
        'command_id' => (int) $pdo->lastInsertId(),
        'patient_id' => $patientId,
        'command' => $command,
        'status' => 'pending'
    ]);
    exit;
}

if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$patientId = (int) ($_GET['patient_id'] ?? 0);
$claim = (string) ($_GET['claim'] ?? '') === '1';
$commandRow = null;

if ($claim) {
    if ($patientId > 0) {
        $claimStmt = $pdo->prepare(
            'SELECT id, patient_id, command, status, payload, requested_at, dispatched_at, completed_at
             FROM iot_glove_commands
             WHERE patient_id = ? AND status = "pending"
             ORDER BY requested_at ASC, id ASC
             LIMIT 1'
        );
        $claimStmt->execute([$patientId]);
    } else {
        $claimStmt = $pdo->prepare(
            'SELECT id, patient_id, command, status, payload, requested_at, dispatched_at, completed_at
             FROM iot_glove_commands
             WHERE status = "pending"
             ORDER BY requested_at ASC, id ASC
             LIMIT 1'
        );
        $claimStmt->execute();
    }

    $commandRow = $claimStmt->fetch(PDO::FETCH_ASSOC) ?: null;

    if ($commandRow) {
        $dispatchStmt = $pdo->prepare(
            'UPDATE iot_glove_commands
             SET status = "dispatched", dispatched_at = NOW()
             WHERE id = ? AND status = "pending"'
        );
        $dispatchStmt->execute([(int) $commandRow['id']]);
        $commandRow['status'] = 'dispatched';
        $commandRow['dispatched_at'] = date('Y-m-d H:i:s');
    }
}

if (!$commandRow) {
    if ($patientId > 0) {
        $commandStmt = $pdo->prepare(
            'SELECT id, patient_id, command, status, payload, requested_at, dispatched_at, completed_at
             FROM iot_glove_commands
             WHERE patient_id = ?
             ORDER BY requested_at DESC, id DESC
             LIMIT 1'
        );
        $commandStmt->execute([$patientId]);
    } else {
        $commandStmt = $pdo->prepare(
            'SELECT id, patient_id, command, status, payload, requested_at, dispatched_at, completed_at
             FROM iot_glove_commands
             ORDER BY requested_at DESC, id DESC
             LIMIT 1'
        );
        $commandStmt->execute();
    }
    $commandRow = $commandStmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

echo json_encode([
    'ok' => true,
    'command' => $commandRow ? [
        'id' => (int) $commandRow['id'],
        'patient_id' => (int) $commandRow['patient_id'],
        'command' => (string) $commandRow['command'],
        'status' => (string) $commandRow['status'],
        'payload' => json_decode((string) ($commandRow['payload'] ?? '{}'), true),
        'requested_at' => $commandRow['requested_at'] ?? null,
        'dispatched_at' => $commandRow['dispatched_at'] ?? null,
        'completed_at' => $commandRow['completed_at'] ?? null
    ] : null
]);