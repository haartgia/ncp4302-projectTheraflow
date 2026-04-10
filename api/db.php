
<?php

if (!function_exists('tf_env')) {
    function tf_env(string $key, string $default = ''): string
    {
        $value = getenv($key);
        if ($value === false || $value === null || $value === '') {
            return $default;
        }

        return (string) $value;
    }
}

$host = tf_env('TF_DB_HOST', '127.0.0.1');
$port = (int) tf_env('TF_DB_PORT', '3306');
$db = tf_env('TF_DB_NAME', 'theraflow_db');
$user = tf_env('TF_DB_USER', 'root');
$pass = tf_env('TF_DB_PASS', '');
$charset = tf_env('TF_DB_CHARSET', 'utf8mb4');
$socket = tf_env('TF_DB_SOCKET', '');

$dsn = "mysql:host={$host};dbname={$db};charset={$charset}";
if ($port > 0) {
    $dsn .= ";port={$port}";
}
if ($socket !== '') {
    $dsn .= ";unix_socket={$socket}";
}

$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_TIMEOUT => 5,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'DB connection failed',
        'detail' => $e->getMessage(),
        'config' => [
            'host' => $host,
            'port' => $port,
            'database' => $db,
            'user' => $user,
            'charset' => $charset,
            'socket' => $socket !== '' ? $socket : null,
        ],
    ]);
    exit;
}
