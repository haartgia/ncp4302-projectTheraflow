<?php
$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST = [
    'identifier' => 'invalid_user',
    'password' => 'invalid_pass'
];
include __DIR__ . '/api/login.php';
