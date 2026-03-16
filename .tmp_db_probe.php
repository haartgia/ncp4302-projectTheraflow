<?php
require __DIR__ . '/api/db.php';
echo json_encode(['ok' => true, 'db' => 'connected']);
