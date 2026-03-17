<?php
session_start();
if (!isset($_SESSION['role']) || strtolower((string) $_SESSION['role']) !== 'patient') {
    header('Location: login.html');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Theraflow Recovery Analytics</title>
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body class="recovery-page patient-portal-page">
<div class="container">
    <aside class="sidebar is-collapsed" id="sidebar">
        <div class="sidebar-top"></div>
        <div class="logo"><div class="logo-icon" aria-hidden="true"><i class="fa-solid fa-hand-holding-heart"></i></div><div class="logo-wordmark">Theraflow</div></div>
        <div class="active-indicator" aria-hidden="true"></div>
        <ul class="menu">
            <li data-page="index.html"><i class="fa-solid fa-house"></i><span class="nav-label">Home</span></li>
            <li data-page="exercise_hub.php"><i class="fa-solid fa-dumbbell"></i><span class="nav-label">Exercises</span></li>
            <li class="active" aria-current="page" data-page="recovery.php"><i class="fa-solid fa-chart-line"></i><span class="nav-label">Recovery Progress</span></li>
            <li data-page="tele_message.php"><i class="fa-regular fa-message"></i><span class="nav-label">Messages</span></li>
            <li data-page="patient_settings.php"><i class="fa-solid fa-user-circle"></i><span class="nav-label patient-account-label">Account &amp; Settings</span></li>
        </ul>
        <div class="sidebar-footer">
            <button class="logout-btn" id="logoutBtn" aria-label="Log out"><i class="fa-solid fa-right-from-bracket"></i><span class="nav-label">Logout</span></button>
        </div>
    </aside>
    <main class="content">
        <section class="patient-shell" id="recoveryRoot" aria-labelledby="recoveryTitle">
            <div class="patient-header-row">
                <div><h1 id="recoveryTitle">Recovery Analytics</h1><p class="subheader">Track force trends, range of motion, and session outcomes.</p></div>
            </div>
            <div class="recovery-quick-stats" aria-label="Weekly quick stats">
                <article class="recovery-stat-chip">
                    <div class="recovery-stat-label">Best Force</div>
                    <div class="recovery-stat-value" id="recoveryBestForce">0.0 N</div>
                </article>
                <article class="recovery-stat-chip">
                    <div class="recovery-stat-label">Max Flexion</div>
                    <div class="recovery-stat-value" id="recoveryMaxFlexion">0.0°</div>
                </article>
                <article class="recovery-stat-chip">
                    <div class="recovery-stat-label">Total Sessions</div>
                    <div class="recovery-stat-value" id="recoveryTotalSessions">0</div>
                </article>
            </div>
            <div class="recovery-chart-grid">
                <article class="widget widget-green graph-card"><h2 class="widget-title">Force Trend (Week over Week)</h2><div class="chart-wrap"><canvas id="recoveryForceChart"></canvas></div></article>
                <article class="widget widget-blue graph-card"><h2 class="widget-title">Flexion Goal Tracker</h2><div class="chart-wrap"><canvas id="recoveryRomChart"></canvas></div></article>
            </div>
            <article class="widget widget-blue">
                <h2 class="widget-title">Session Logs</h2>
                <div class="doctor-table-wrap">
                    <table class="doctor-table">
                        <thead><tr><th>Date</th><th>Force (N)</th><th>Flexion (°)</th><th>Repetitions</th><th>Status</th></tr></thead>
                        <tbody id="recoveryLogsBody"></tbody>
                    </table>
                </div>
            </article>
        </section>
    </main>
</div>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="script.js"></script>
</body>
</html>