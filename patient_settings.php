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
            <li class="active" aria-current="page" data-page="patient_settings.php"><i class="fa-solid fa-user-circle"></i><span class="nav-label patient-account-label">Account &amp; Settings</span></li>
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
                        <div class="sensor-metric-tile" id="diagBatteryTile"><div class="doctor-stat-label">Battery</div><div class="doctor-stat-value" id="diagBattery">--%</div></div>
                        <div class="sensor-metric-tile" id="diagSignalTile"><div class="doctor-stat-label">Wi-Fi Strength (RSSI)</div><div class="doctor-stat-value" id="diagSignal">-- dBm</div></div>
                        <div class="sensor-metric-tile" id="diagSsidTile"><div class="doctor-stat-label">SSID</div><div class="doctor-stat-value" id="diagSsid">--</div></div>
                        <div class="sensor-metric-tile" id="diagConnectionTile"><div class="doctor-stat-label">Connection</div><div class="doctor-stat-value" id="diagConnection">Offline</div></div>
                    </div>
                    <button type="button" class="doctor-btn" id="diagRefreshBtn">Run Troubleshoot</button>
                    <p class="widget-label">Guide: 1) Ensure glove is within range of the 2.4GHz router, 2) Power cycle device, 3) Use "Reconfigure Wi-Fi" if the network credentials have changed.</p>
                </article>

                <article class="widget widget-green account-info-card">
                    <h2 class="widget-title">Account Information</h2>
                    <div class="account-info-grid">
                        <div class="account-info-column account-info-column--profile">
                            <form id="patientSettingsForm" class="field-grid" novalidate>
                                <label class="field-group required-field field-group-span-2 has-inline-edit">
                                    <span>Name</span>
                                    <input type="text" id="patientSettingsName" required readonly>
                                    <button type="button" class="inline-edit-btn" id="patientNameEditBtn" aria-label="Edit name"><i class="fa-solid fa-pen"></i></button>
                                </label>
                                <label class="field-group field-group-span-2 has-inline-edit">
                                    <span>Contact</span>
                                    <input type="text" id="patientSettingsEmail" placeholder="Enter email or phone number" readonly>
                                    <button type="button" class="inline-edit-btn" id="patientContactEditBtn" aria-label="Edit contact"><i class="fa-solid fa-pen"></i></button>
                                </label>
                                <label class="field-group field-group-span-2">
                                    <span>Age</span>
                                    <input type="text" id="patientAge" readonly>
                                </label>
                                <label class="field-group field-group-span-2 password-pill-group">
                                    <span>Password</span>
                                    <div class="password-pill">
                                        <input type="password" value="••••••••" readonly>
                                        <button type="button" class="password-pill-btn" id="patientPasswordModalBtn" aria-label="Change password">
                                            <i class="fa-solid fa-pen"></i>
                                        </button>
                                    </div>
                                </label>
                                <div class="patient-password-modal" id="patientPasswordModal" hidden>
                                    <div class="patient-password-backdrop" id="patientPasswordBackdrop"></div>
                                    <div class="patient-password-card" role="dialog" aria-modal="true" aria-labelledby="patientPasswordModalTitle">
                                        <button type="button" class="patient-password-close" id="patientPasswordClose" aria-label="Close password modal">
                                            <i class="fa-solid fa-xmark"></i>
                                        </button>
                                        <h3 id="patientPasswordModalTitle">Change Password</h3>
                                        <div class="field-grid field-grid-two settings-password-fields" id="patientPasswordFields">
                                            <label class="field-group"><span>Current Password</span><input type="password" id="patientCurrentPassword" placeholder="Current Password"></label>
                                            <label class="field-group"><span>New Password</span><input type="password" id="patientNewPassword" placeholder="New Password" minlength="6"></label>
                                            <label class="field-group field-group-span-2"><span>Confirm Password</span><input type="password" id="patientConfirmPassword" placeholder="Confirm Password" minlength="6"></label>
                                        </div>
                                        <div class="patient-password-actions">
                                            <button type="button" class="doctor-btn" id="patientPasswordCancel">Cancel</button>
                                            <button type="submit" class="sign-in-btn sync-btn" id="patientPasswordSaveBtn" disabled>Save Changes<span class="btn-spinner" aria-hidden="true"></span></button>
                                        </div>
                                    </div>
                                </div>
                            </form>
                            <p class="notes-save-feedback" id="patientSettingsFeedback" aria-live="polite"></p>
                            <p class="notes-save-feedback" id="patientSettingsSyncStatus" aria-live="polite"></p>
                        </div>
                        <div class="account-info-column account-info-column--medical">
                            <div class="field-grid">
                                <label class="field-group field-group-span-2">
                                    <span>Diagnosis</span>
                                    <input type="text" id="patientDiagnosis" readonly>
                                </label>
                                <label class="field-group field-group-span-2">
                                    <span>Assigned Doctor</span>
                                    <input type="text" id="patientAssignedDoctor" readonly>
                                </label>
                                <label class="field-group field-group-span-2">
                                    <span>Treatment Goal</span>
                                    <input type="text" id="patientTreatmentGoal" readonly>
                                </label>
                            </div>
                        </div>
                    </div>
                    <p class="medical-note">Note: These details are managed by your healthcare provider. Contact your doctor to update medical records.</p>
                </article>
            </div>
        </section>
    </main>
</div>
<script src="script.js"></script>
</body>
</html>