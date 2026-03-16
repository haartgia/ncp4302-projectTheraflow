<?php
require __DIR__ . '/api/db.php';
$users = $pdo->query('SELECT COUNT(*) AS c FROM users')->fetch();
echo "users=" . ($users['c'] ?? 0) . PHP_EOL;
$roles = $pdo->query('SELECT role, COUNT(*) AS c FROM users GROUP BY role')->fetchAll(PDO::FETCH_ASSOC);
foreach ($roles as $row) {
    echo 'role=' . ($row['role'] ?? '') . ' count=' . ($row['c'] ?? 0) . PHP_EOL;
}
?>
