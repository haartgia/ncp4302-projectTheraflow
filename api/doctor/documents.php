<?php
session_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (!isset($_SESSION['role']) || strtolower((string) $_SESSION['role']) !== 'doctor' || !isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

require_once __DIR__ . '/../db.php';

function ensureDocumentsTable(PDO $pdo): string
{
    $tableName = 'doctor_documents';

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ' . $tableName . ' (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            doctor_user_id INT UNSIGNED NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            stored_name VARCHAR(255) NOT NULL,
            storage_path VARCHAR(500) NOT NULL,
            mime_type VARCHAR(64) NOT NULL,
            file_ext VARCHAR(8) NOT NULL,
            file_size_bytes BIGINT UNSIGNED NOT NULL,
            uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_doctor_documents_stored_name (stored_name),
            KEY idx_doctor_documents_doctor_user_id (doctor_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );

    return $tableName;
}

function basenameSafe(string $name): string
{
    $name = preg_replace('/[^A-Za-z0-9._-]+/', '_', $name) ?? 'document.pdf';
    $name = trim($name, '._-');
    if ($name === '') {
        $name = 'document';
    }

    return $name;
}

$doctorUserId = (int) $_SESSION['user_id'];
$tableName = ensureDocumentsTable($pdo);

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        parse_str((string) $raw, $parsed);
        $data = is_array($parsed) ? $parsed : [];
    }

    $documentId = (int) ($data['documentId'] ?? $data['id'] ?? 0);
    if ($documentId <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'documentId is required']);
        exit;
    }

    $findStmt = $pdo->prepare(
        'SELECT id, storage_path
         FROM ' . $tableName . '
         WHERE id = ? AND doctor_user_id = ?
         LIMIT 1'
    );
    $findStmt->execute([$documentId, $doctorUserId]);
    $documentRow = $findStmt->fetch(PDO::FETCH_ASSOC);
    if (!$documentRow) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Document not found']);
        exit;
    }

    $deleteStmt = $pdo->prepare('DELETE FROM ' . $tableName . ' WHERE id = ? AND doctor_user_id = ? LIMIT 1');
    $deleteStmt->execute([$documentId, $doctorUserId]);

    $relativePath = trim((string) ($documentRow['storage_path'] ?? ''));
    if ($relativePath !== '') {
        $projectRoot = dirname(__DIR__, 2);
        $relativePath = str_replace('\\', '/', $relativePath);
        $filePath = $projectRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);

        if (is_file($filePath)) {
            @unlink($filePath);
        }
    }

    echo json_encode(['ok' => true, 'deletedId' => $documentId]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare(
        'SELECT id, original_name, storage_path, mime_type, file_size_bytes, uploaded_at
         FROM ' . $tableName . '
         WHERE doctor_user_id = ?
         ORDER BY uploaded_at DESC, id DESC'
    );
    $stmt->execute([$doctorUserId]);

    $documents = array_map(static function (array $row): array {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'name' => (string) ($row['original_name'] ?? ''),
            'url' => (string) ($row['storage_path'] ?? ''),
            'mimeType' => (string) ($row['mime_type'] ?? ''),
            'sizeBytes' => (int) ($row['file_size_bytes'] ?? 0),
            'uploadedAt' => (string) ($row['uploaded_at'] ?? '')
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));

    echo json_encode(['ok' => true, 'documents' => $documents]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

if (!isset($_FILES['document'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'No file uploaded']);
    exit;
}

$file = $_FILES['document'];
if (!is_array($file) || (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Upload failed']);
    exit;
}

$originalName = (string) ($file['name'] ?? 'document.pdf');
$tmpPath = (string) ($file['tmp_name'] ?? '');
$sizeBytes = (int) ($file['size'] ?? 0);
if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid upload payload']);
    exit;
}

if ($sizeBytes <= 0 || $sizeBytes > 15 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'File must be between 1 byte and 15MB']);
    exit;
}

$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$detectedMime = $finfo ? (string) finfo_file($finfo, $tmpPath) : '';
if ($finfo) {
    finfo_close($finfo);
}

if ($ext !== 'pdf' || !in_array($detectedMime, ['application/pdf', 'application/x-pdf'], true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Only PDF files are allowed']);
    exit;
}

$safeOriginal = basenameSafe($originalName);
if (strtolower(pathinfo($safeOriginal, PATHINFO_EXTENSION)) !== 'pdf') {
    $safeOriginal .= '.pdf';
}

$baseName = pathinfo($safeOriginal, PATHINFO_FILENAME);
$storedName = $baseName . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.pdf';

$storageDirFs = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'doctor_documents';
if (!is_dir($storageDirFs) && !mkdir($storageDirFs, 0775, true) && !is_dir($storageDirFs)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Unable to initialize upload directory']);
    exit;
}

$destFsPath = $storageDirFs . DIRECTORY_SEPARATOR . $storedName;
if (!move_uploaded_file($tmpPath, $destFsPath)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Unable to store uploaded file']);
    exit;
}

$storagePath = 'assets/uploads/doctor_documents/' . $storedName;

$insert = $pdo->prepare(
    'INSERT INTO ' . $tableName . ' (doctor_user_id, original_name, stored_name, storage_path, mime_type, file_ext, file_size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?)'
);
$insert->execute([
    $doctorUserId,
    $safeOriginal,
    $storedName,
    $storagePath,
    'application/pdf',
    'pdf',
    $sizeBytes
]);

$documentId = (int) $pdo->lastInsertId();

echo json_encode([
    'ok' => true,
    'document' => [
        'id' => $documentId,
        'name' => $safeOriginal,
        'url' => $storagePath,
        'mimeType' => 'application/pdf',
        'sizeBytes' => $sizeBytes,
        'uploadedAt' => date('Y-m-d H:i:s')
    ]
]);
