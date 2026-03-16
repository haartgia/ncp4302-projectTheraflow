<?php
session_start();

if (!isset($_SESSION['role']) || strtolower((string) $_SESSION['role']) !== 'patient') {
    header('Location: login.html');
    exit;
}

header('Location: exercise_hub.php');
exit;
