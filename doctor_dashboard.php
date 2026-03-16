<?php
session_start();

if (!isset($_SESSION['role']) || strtolower((string) $_SESSION['role']) !== 'doctor') {
    header('Location: login.html');
    exit;
}

header('Location: doctor_dashboard.html');
exit;
