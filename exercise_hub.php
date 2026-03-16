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
<title>Theraflow — Exercises</title>
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body class="exercise-hub-page patient-portal-page">
<div class="container">
    <aside class="sidebar is-collapsed" id="sidebar">
        <div class="sidebar-top">
        </div>
        <div class="logo">
            <div class="logo-icon" aria-hidden="true"><i class="fa-solid fa-hand-holding-heart"></i></div>
            <div class="logo-wordmark">Theraflow</div>
        </div>
        <div class="active-indicator" aria-hidden="true"></div>
        <ul class="menu">
            <li data-page="index.html"><i class="fa-solid fa-house"></i><span class="nav-label">Home</span></li>
            <li class="active" aria-current="page" data-page="exercise_hub.php"><i class="fa-solid fa-dumbbell"></i><span class="nav-label">Exercises</span></li>
            <li data-page="recovery.php"><i class="fa-solid fa-chart-line"></i><span class="nav-label">Recovery Progress</span></li>
            <li data-page="tele_message.php"><i class="fa-regular fa-message"></i><span class="nav-label">Messages</span></li>
            <li data-page="patient_settings.php"><i class="fa-solid fa-gear"></i><span class="nav-label">Settings</span></li>
        </ul>
        <div class="sidebar-footer">
            <button class="logout-btn" id="logoutBtn" aria-label="Log out"><i class="fa-solid fa-right-from-bracket"></i><span class="nav-label">Logout</span></button>
        </div>
    </aside>

    <main class="content">
        <section class="patient-shell" id="exerciseHubRoot" aria-labelledby="exerciseHubTitle">
            <div class="patient-header-row">
                <div>
                    <h1 id="exerciseHubTitle">Exercises</h1>
                    <p class="subheader">Complete each step before your daily session: Pair &rarr; Calibrate &rarr; Test &rarr; Exercise.</p>
                </div>
            </div>

            <!-- Step Progress Indicator -->
            <nav class="wizard-steps-nav" aria-label="Exercise setup steps">
                <div class="wizard-step-dot is-active" id="navDot1"><span class="step-number">1</span><span class="step-label">Pair</span></div>
                <div class="wizard-step-bar" id="wizBar1"></div>
                <div class="wizard-step-dot" id="navDot2"><span class="step-number">2</span><span class="step-label">Calibrate</span></div>
                <div class="wizard-step-bar" id="wizBar2"></div>
                <div class="wizard-step-dot" id="navDot3"><span class="step-number">3</span><span class="step-label">Diagnostics</span></div>
                <div class="wizard-step-bar" id="wizBar3"></div>
                <div class="wizard-step-dot" id="navDot4"><span class="step-number">4</span><span class="step-label">Session</span></div>
            </nav>

            <!-- STEP 1: Pair -->
            <article class="widget widget-blue wizard-panel" id="stepPair">
                <h2 class="widget-title">Step 1 &mdash; Pair Your Glove</h2>
                <p class="widget-label">Connect your Theraflow glove via Bluetooth. If Bluetooth is unavailable, simulation mode will activate automatically.</p>
                <button type="button" class="sign-in-btn" id="hubPairButton">
                    <i class="fa-brands fa-bluetooth-b"></i> Search for Glove
                </button>
                <div class="searching-animation" id="searchingAnimation" hidden>
                    <div class="search-pulse"></div>
                    <span class="search-label">Searching for Glove&hellip;</span>
                </div>
                <p class="notes-save-feedback" id="hubPairStatus">Not connected.</p>
            </article>

            <!-- STEP 2: Auto-Calibration (unlocked after pairing) -->
            <article class="widget widget-blue wizard-panel" id="stepCalibrate" hidden>
                <h2 class="widget-title">Step 2 &mdash; Auto-Calibration</h2>
                <p class="widget-label" id="calibrationPrompt">Rest your hand flat and relaxed on a hard surface. The system will read the 0&deg; baseline for all 5 finger sensors.</p>
                <button type="button" class="sign-in-btn" id="hubCalibrateBtn">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Begin Calibration
                </button>
                <div class="calibration-finger-grid" id="calibrationFingerGrid"></div>
                <p class="notes-save-feedback" id="hubCalibrationStatus">Waiting for calibration start.</p>
            </article>

            <!-- STEP 3: Diagnostic Test (unlocked after calibration) -->
            <article class="widget widget-green wizard-panel" id="stepDiagnose" hidden>
                <h2 class="widget-title">Step 3 &mdash; Diagnostic Test</h2>
                <div class="diag-prompt-card" id="diagPromptCard">
                    <div class="diag-prompt-icon" id="diagPromptIcon"><i class="fa-solid fa-hand"></i></div>
                    <p class="diag-prompt-text" id="diagPromptText">Follow the prompts below to record your maximum physical limits.</p>
                    <button type="button" class="sign-in-btn" id="hubDiagActionBtn">Start Test</button>
                </div>
                <div class="hub-metrics-grid" style="margin-top:18px">
                    <div class="sensor-metric-tile"><div class="doctor-stat-label">Max Extension</div><div class="doctor-stat-value" id="hubMaxExtension">&mdash;</div></div>
                    <div class="sensor-metric-tile"><div class="doctor-stat-label">Max Flexion</div><div class="doctor-stat-value" id="hubMaxFlexion">&mdash;</div></div>
                    <div class="sensor-metric-tile"><div class="doctor-stat-label">Peak Force</div><div class="doctor-stat-value" id="hubPeakForce">&mdash;</div></div>
                    <div class="sensor-metric-tile"><div class="doctor-stat-label">Rep Target</div><div class="doctor-stat-value" id="hubRepetitions">&mdash;</div></div>
                </div>
                <p class="notes-save-feedback" id="hubDiagStatus" aria-live="polite"></p>
            </article>

            <!-- STEP 4: Guided Session (unlocked after diagnostics) -->
            <article class="widget widget-green wizard-panel" id="stepSession" hidden>
                <h2 class="widget-title">Step 4 &mdash; Guided Session</h2>
                <p class="widget-label">All sensors calibrated and tested. Press <strong>Start Guided Exercise</strong> &mdash; live metrics will stream to your Home dashboard.</p>
                <div class="hub-metrics-grid" style="margin-bottom:18px">
                    <div class="sensor-metric-tile"><div class="doctor-stat-label">Target Reps</div><div class="doctor-stat-value" id="hubTargetReps">120</div></div>
                    <div class="sensor-metric-tile"><div class="doctor-stat-label">Reps Done</div><div class="doctor-stat-value" id="hubSessionReps">0</div></div>
                    <div class="sensor-metric-tile"><div class="doctor-stat-label">Avg Force</div><div class="doctor-stat-value" id="hubSessionForce">0.0 N</div></div>
                    <div class="sensor-metric-tile"><div class="doctor-stat-label">Duration</div><div class="doctor-stat-value" id="hubSessionTime">0:00</div></div>
                </div>
                <div class="wizard-actions">
                    <button type="button" class="sign-in-btn" id="hubStartSessionBtn"><i class="fa-solid fa-play"></i> Start Guided Exercise</button>
                    <button type="button" class="doctor-btn" id="hubEndSessionBtn" disabled>End &amp; Save Session</button>
                </div>
                <p class="notes-save-feedback" id="hubSessionStatus" aria-live="polite"></p>
            </article>
        </section>
    </main>
</div>
<script src="script.js"></script>
</body>
</html>