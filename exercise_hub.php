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
            <li data-page="patient_settings.php"><i class="fa-solid fa-user-circle"></i><span class="nav-label patient-account-label">Account &amp; Settings</span></li>
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
                    <p class="subheader">Complete each step before your session: Connect &rarr; Calibrate &rarr; Choose Mode &rarr; Session.</p>
                </div>
            </div>

            <!-- Step Progress Indicator -->
            <nav class="wizard-steps-nav" aria-label="Exercise setup steps">
                <div class="wizard-step-dot is-active" id="navDot1"><span class="step-number">1</span><span class="step-label">Connect</span></div>
                <div class="wizard-step-bar" id="wizBar1"></div>
                <div class="wizard-step-dot" id="navDot2"><span class="step-number">2</span><span class="step-label">Calibrate</span></div>
                <div class="wizard-step-bar" id="wizBar2"></div>
                <div class="wizard-step-dot" id="navDot3"><span class="step-number">3</span><span class="step-label">Choose Mode</span></div>
                <div class="wizard-step-bar" id="wizBar3"></div>
                <div class="wizard-step-dot" id="navDot4"><span class="step-number">4</span><span class="step-label">Session</span></div>
            </nav>

            <!-- STEP 1: Connect -->
            <article class="widget widget-blue wizard-panel" id="stepPair">
                <h2 class="widget-title">Step 1 &mdash; Connect Your Glove (Wi-Fi)</h2>
                <p class="widget-label">Connect to your Theraflow glove over Wi-Fi. Make sure your glove and device share the same 2.4GHz network.</p>
                <button type="button" class="sign-in-btn" id="hubPairButton">
                    <i class="fa-solid fa-wifi"></i> Connect to Glove (Wi-Fi)
                </button>
                <div class="searching-animation" id="searchingAnimation" hidden>
                    <div class="search-pulse"></div>
                    <span class="search-label">Searching for Glove&hellip;</span>
                </div>
                <p class="notes-save-feedback" id="hubPairStatus">Not connected.</p>
            </article>

            <!-- STEP 2: Calibration (unlocked after pairing) -->
            <article class="widget widget-blue wizard-panel" id="stepCalibrate" hidden>
                <h2 class="widget-title">Step 2 &mdash; Mandatory Calibration</h2>
                <p class="widget-label" id="calibrationPrompt">Rest your hand flat and relaxed. The system will capture the 0&deg; baseline for all 5 fingers.</p>
                <button type="button" class="sign-in-btn" id="hubCalibrateBtn">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Begin Calibration
                </button>
                <div class="calibration-finger-grid" id="calibrationFingerGrid"></div>
                <p class="notes-save-feedback" id="hubCalibrationStatus">Waiting for calibration start.</p>
            </article>

            <!-- STEP 3: Mode Selection (unlocked after calibration) -->
            <article class="widget widget-green wizard-panel" id="stepDiagnose" hidden>
                <h2 class="widget-title">Step 3 &mdash; Choose Your Mode</h2>
                <div class="exercise-mode-grid">
                    <div class="exercise-mode-card" id="therapyModeCard">
                        <div class="exercise-mode-head">
                            <div>
                                <h3>Therapy Mode</h3>
                                <p>Doctor-prescribed movements and targets.</p>
                            </div>
                            <span class="mode-badge">Doctor Plan</span>
                        </div>
                        <div class="mode-metrics">
                            <div><span>Duration</span><strong id="hubTherapyDuration">&mdash;</strong></div>
                            <div><span>Reps</span><strong id="hubTherapyReps">&mdash;</strong></div>
                            <div><span>Exercise</span><strong id="hubTherapyType">&mdash;</strong></div>
                        </div>
                        <button type="button" class="sign-in-btn" id="hubTherapyStartBtn"><i class="fa-solid fa-play"></i> Start Session</button>
                    </div>
                    <div class="exercise-mode-card" id="testModeCard">
                        <div class="exercise-mode-head">
                            <div>
                                <h3>Test Mode</h3>
                                <p>3-trial assessment for strength &amp; range.</p>
                            </div>
                            <span class="mode-badge is-outline">Assessment</span>
                        </div>
                        <ul class="mode-checklist">
                            <li>Grip Strength (3 trials)</li>
                            <li>Flexion / Extension (3 trials)</li>
                        </ul>
                        <button type="button" class="doctor-btn" id="hubTestStartBtn"><i class="fa-solid fa-clipboard-check"></i> Start Assessment</button>
                    </div>
                </div>
                <p class="notes-save-feedback" id="hubDiagStatus" aria-live="polite"></p>
            </article>

            <!-- STEP 4: Session (unlocked after mode selection) -->
            <article class="widget widget-green wizard-panel" id="stepSession" hidden>
                <h2 class="widget-title">Step 4 &mdash; Session</h2>
                <p class="widget-label" id="hubSessionIntro">Your mode is selected. Press <strong>Start Session</strong> to begin.</p>

                <div class="session-pane" id="therapySessionPane">
                    <div class="hub-metrics-grid" style="margin-bottom:18px">
                        <div class="sensor-metric-tile"><div class="doctor-stat-label">Target Reps</div><div class="doctor-stat-value" id="hubTargetReps">120</div></div>
                        <div class="sensor-metric-tile"><div class="doctor-stat-label">Reps Done</div><div class="doctor-stat-value" id="hubSessionReps">0</div></div>
                        <div class="sensor-metric-tile"><div class="doctor-stat-label">Avg Force</div><div class="doctor-stat-value" id="hubSessionForce">0.0 N</div></div>
                        <div class="sensor-metric-tile"><div class="doctor-stat-label">Duration</div><div class="doctor-stat-value" id="hubSessionTime">0:00</div></div>
                    </div>
                    <div class="wizard-actions">
                        <button type="button" class="sign-in-btn" id="hubStartSessionBtn"><i class="fa-solid fa-play"></i> Start Session</button>
                        <button type="button" class="doctor-btn" id="hubEndSessionBtn" disabled>End &amp; Save Session</button>
                    </div>
                </div>

                <div class="session-pane is-hidden" id="testSessionPane">
                    <div class="diag-prompt-card">
                        <div class="diag-prompt-icon"><i class="fa-solid fa-clipboard-list"></i></div>
                        <p class="diag-prompt-text" id="hubTestPrompt">Complete 3 trials for each movement to log your assessment.</p>
                        <button type="button" class="sign-in-btn" id="hubTestActionBtn">Begin Trial 1</button>
                    </div>
                    <div class="hub-metrics-grid" style="margin-top:18px">
                        <div class="sensor-metric-tile"><div class="doctor-stat-label">Avg Grip Strength</div><div class="doctor-stat-value" id="hubTestGripAvg">&mdash;</div></div>
                        <div class="sensor-metric-tile"><div class="doctor-stat-label">Avg Flexion</div><div class="doctor-stat-value" id="hubTestFlexAvg">&mdash;</div></div>
                        <div class="sensor-metric-tile"><div class="doctor-stat-label">Avg Extension</div><div class="doctor-stat-value" id="hubTestExtAvg">&mdash;</div></div>
                        <div class="sensor-metric-tile"><div class="doctor-stat-label">Trials</div><div class="doctor-stat-value" id="hubTestTrialCount">0/3</div></div>
                    </div>
                </div>

                <p class="notes-save-feedback" id="hubSessionStatus" aria-live="polite"></p>
            </article>
        </section>
    </main>
</div>
<script src="script.js"></script>
</body>
</html>