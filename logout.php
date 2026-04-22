<?php
session_start();

$logoutRole = strtolower((string) ($_SESSION['role'] ?? ''));
$logoutPatientId = (int) ($_SESSION['patient_id'] ?? 0);

if ($logoutRole === 'patient' && $logoutPatientId > 0) {
    try {
        require_once __DIR__ . '/api/db.php';
        require_once __DIR__ . '/api/lib/iot_data.php';

        ensureCalibrationCommandTable($pdo);

        $insertStop = $pdo->prepare(
            'INSERT INTO iot_glove_commands (patient_id, command, status, payload, requested_at)
             VALUES (?, "stop_session", "pending", ?, NOW())'
        );
        $insertStop->execute([
            $logoutPatientId,
            json_encode(['source' => 'logout'], JSON_UNESCAPED_SLASHES)
        ]);
    } catch (Throwable $e) {
        // Logout should still complete even if command enqueue fails.
    }
}

$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

session_destroy();

header('Location: login.html');
exit;
