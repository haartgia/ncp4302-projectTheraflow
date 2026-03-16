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
<title>Theraflow Patient Settings</title>
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body class="patient-settings-page patient-portal-page">
<div class="container">
    <aside class="sidebar is-collapsed" id="sidebar">
        <div class="sidebar-top"></div>
        <div class="logo"><div class="logo-icon" aria-hidden="true"><i class="fa-solid fa-hand-holding-heart"></i></div><div class="logo-wordmark">Theraflow</div></div>
        <div class="active-indicator" aria-hidden="true"></div>
        <ul class="menu">
            <li data-page="index.html"><i class="fa-solid fa-house"></i><span class="nav-label">Home</span></li>
            <li data-page="exercise_hub.php"><i class="fa-solid fa-dumbbell"></i><span class="nav-label">Exercises</span></li>
            <li data-page="recovery.php"><i class="fa-solid fa-chart-line"></i><span class="nav-label">Recovery Progress</span></li>
            <li data-page="tele_message.php"><i class="fa-regular fa-message"></i><span class="nav-label">Messages</span></li>
            <li class="active" aria-current="page" data-page="patient_settings.php"><i class="fa-solid fa-gear"></i><span class="nav-label">Settings</span></li>
        </ul>
        <div class="sidebar-footer">
            <button class="logout-btn" id="logoutBtn" aria-label="Log out"><i class="fa-solid fa-right-from-bracket"></i><span class="nav-label">Logout</span></button>
        </div>
    </aside>
    <main class="content">
        <section class="patient-shell" id="patientSettingsRoot" aria-labelledby="patientSettingsTitle">
            <div class="patient-header-row"><div><h1 id="patientSettingsTitle">Glove & Account Settings</h1><p class="subheader">Review glove diagnostics and update your recovery profile.</p></div></div>
            <div class="patient-hub-grid">
                <article class="widget widget-blue">
                    <h2 class="widget-title">Hardware Diagnostics</h2>
                    <div class="hub-metrics-grid">
                        <div class="sensor-metric-tile"><div class="doctor-stat-label">Battery</div><div class="doctor-stat-value" id="diagBattery">--%</div></div>
                        <div class="sensor-metric-tile"><div class="doctor-stat-label">Signal</div><div class="doctor-stat-value" id="diagSignal">-- dBm</div></div>
                        <div class="sensor-metric-tile"><div class="doctor-stat-label">Connection</div><div class="doctor-stat-value" id="diagConnection">Offline</div></div>
                    </div>
                    <button type="button" class="doctor-btn" id="diagRefreshBtn">Run Troubleshoot</button>
                    <p class="widget-label">Guide: 1) Re-seat glove battery, 2) Hold power 5s, 3) Re-pair if signal remains weak.</p>
                </article>

                <article class="widget widget-green">
                    <h2 class="widget-title">User Profile</h2>
                    <form id="patientSettingsForm" class="field-grid" novalidate>
                        <label class="field-group required-field"><span>Name</span><input type="text" id="patientSettingsName" required></label>
                        <label class="field-group"><span>Stroke Recovery Date</span><input type="date" id="patientRecoveryDate"></label>
                        <label class="field-group"><span>Email</span><input type="email" id="patientSettingsEmail" disabled></label>
                        <label class="field-group"><span>Current Password</span><input type="password" id="patientCurrentPassword" placeholder="Current Password"></label>
                        <label class="field-group"><span>New Password</span><input type="password" id="patientNewPassword" placeholder="New Password"></label>
                        <label class="field-group"><span>Confirm Password</span><input type="password" id="patientConfirmPassword" placeholder="Confirm Password"></label>
                        <button type="submit" class="sign-in-btn">Save Changes</button>
                    </form>
                    <p class="notes-save-feedback" id="patientSettingsFeedback" aria-live="polite"></p>
                </article>
            </div>
        </section>
    </main>
</div>
<script src="script.js"></script>
</body>
</html>