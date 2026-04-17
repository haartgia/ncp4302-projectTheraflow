<?php
session_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!isset($_SESSION['role']) || strtolower((string) $_SESSION['role']) !== 'doctor' || !isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

require_once __DIR__ . '/../db.php';

function resolveUsersTable(PDO $pdo): ?string
{
    foreach (['users', 'theraflowusers_db.users', 'theraflow_db.users'] as $tableName) {
        try {
            $probe = $pdo->query('SELECT 1 FROM ' . $tableName . ' LIMIT 1');
            if ($probe !== false) {
                return $tableName;
            }
        } catch (Throwable $e) {
            // Try next table candidate.
        }
    }

    return null;
}

function getTableColumns(PDO $pdo, string $tableName): array
{
    $columns = [];
    $stmt = $pdo->query('DESCRIBE ' . $tableName);
    foreach ($stmt->fetchAll() as $row) {
        if (isset($row['Field'])) {
            $columns[] = strtolower((string) $row['Field']);
        }
    }

    return $columns;
}

$usersTable = resolveUsersTable($pdo);
if ($usersTable === null) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Users table not found']);
    exit;
}

$usersColumns = getTableColumns($pdo, $usersTable);
$userIdColumn = in_array('user_id', $usersColumns, true) ? 'user_id' : (in_array('id', $usersColumns, true) ? 'id' : null);
$userPasswordColumn = in_array('password', $usersColumns, true) ? 'password' : (in_array('password_hash', $usersColumns, true) ? 'password_hash' : null);

if ($userIdColumn === null || $userPasswordColumn === null) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Users schema is incompatible']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    $data = $_POST;
}

$currentPassword = (string) ($data['currentPassword'] ?? '');
if (trim($currentPassword) === '') {
    echo json_encode(['ok' => true, 'valid' => false]);
    exit;
}

$userId = (int) $_SESSION['user_id'];
$stmt = $pdo->prepare('SELECT ' . $userPasswordColumn . ' FROM ' . $usersTable . ' WHERE ' . $userIdColumn . ' = ? LIMIT 1');
$stmt->execute([$userId]);
$userRow = $stmt->fetch();

if (!$userRow) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'User account not found']);
    exit;
}

$storedPassword = (string) ($userRow[$userPasswordColumn] ?? '');
$valid = false;
if ($storedPassword !== '') {
    $valid = password_verify($currentPassword, $storedPassword);
    if (!$valid && hash_equals($storedPassword, $currentPassword)) {
        // Backward compatibility for legacy plain-text stored passwords.
        $valid = true;
    }
}

echo json_encode(['ok' => true, 'valid' => $valid]);
