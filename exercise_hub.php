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
        <div class="logo"><img src="assets/logo_white.png" alt="Theraflow" class="logo-image"></div>
        <div class="active-indicator" aria-hidden="true"></div>
        <ul class="menu">
            <li data-page="index.html"><i class="fa-solid fa-house"></i><span class="nav-label">Home</span></li>
            <li class="active" aria-current="page" data-page="exercise_hub.php"><i class="fa-solid fa-dumbbell"></i><span class="nav-label">Exercises</span></li>
            <li data-page="recovery.php"><i class="fa-solid fa-chart-line"></i><span class="nav-label">Recovery Progress</span></li>
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
                    <p class="subheader">Complete each step before your session: Status &rarr; Calibrate &rarr; Testing &rarr; Select Exercise &rarr; Session.</p>
                </div>
            </div>

            <div class="exercise-stepper-viewport" id="exerciseStepperViewport">
            <!-- STEP 1: Connection Status -->
            <article class="widget widget-blue wizard-panel" id="stepPair">
                <h2 class="widget-title hub-step-heading" id="hubStep1Heading">
                    <span class="hub-step-number">Step 1</span>
                    <span class="hub-step-label">Glove Connection Status</span>
                </h2>
                <p class="widget-label">Theraflow checks glove connectivity automatically. Use refresh if you restart the ESP32 or switch Wi-Fi.</p>
                <button type="button" class="sign-in-btn" id="hubPairButton">
                    <i class="fa-solid fa-rotate-right"></i> Refresh Glove Status
                </button>
                <div class="searching-animation" id="searchingAnimation">
                    <div class="search-pulse"></div>
                    <span class="search-label" id="searchingLabel">Searching for Glove...</span>
                </div>
            </article>

            <!-- STEP 2: Calibration (unlocked after pairing) -->
            <article class="widget widget-blue wizard-panel" id="stepCalibrate" hidden>
                <h2 class="widget-title hub-step-heading" id="hubStep2Heading">
                    <span class="hub-step-number">Step 2</span>
                    <span class="hub-step-label">Mandatory Calibration</span>
                </h2>
                <p class="widget-label" id="calibrationPrompt">Rest your hand flat and relaxed. The system will capture the 0&deg; baseline for all 5 fingers.</p>
                <button type="button" class="sign-in-btn" id="hubCalibrateBtn">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Begin Calibration
                </button>
                <div class="calibration-progress-wrap" id="hubCalibrationProgressWrap" aria-hidden="true">
                    <div class="calibration-progress-track">
                        <div class="calibration-progress-fill" id="hubCalibrationProgressFill"></div>
                    </div>
                    <div class="calibration-progress-label" id="hubCalibrationProgressLabel">0%</div>
                </div>
                <p class="notes-save-feedback" id="hubCalibrationStatus">Waiting for calibration start.</p>
            </article>

            <!-- STEP 3: Testing Stage -->
            <article class="widget widget-green wizard-panel" id="stepTest" hidden>
                <h2 class="widget-title hub-step-heading" id="hubStep3Heading">
                    <span class="hub-step-number">Step 3</span>
                    <span class="hub-step-label">Testing Stage</span>
                </h2>
                <p class="widget-label" id="hubTestIntro">Test your glove stream before exercise selection. Press <strong>Start Test</strong> and move your hand naturally.</p>

                <div class="session-pane" id="hubTestPane">
                    <div class="session-meta-bar">
                        <div class="session-meta-item">Stage: <strong>Testing</strong></div>
                        <div class="session-meta-item">Source: <strong>Live Glove Data</strong></div>
                    </div>

                    <div class="session-main-grid test-layout-horizontal">
                        <div class="session-main-focus test-horizontal-panel" id="hubTestFingerTile">
                            <div class="test-horizontal-row">
                                <div class="test-timer-panel" id="hubTestTimerTile">
                                    <div class="test-inline-label">Timer</div>
                                    <div class="test-inline-value" id="hubTestTime">30</div>
                                </div>

                                <div class="test-finger-gauge-row" id="hubTestFingerGauges" aria-live="polite">
                                    <div class="test-gauge-cell" data-finger="thumb">
                                        <span class="test-gauge-value">40.0&deg;</span>
                                        <div class="test-gauge-track"><div class="test-gauge-fill" style="height:44.4%"></div></div>
                                        <span class="test-gauge-name">Thumb</span>
                                    </div>
                                    <div class="test-gauge-cell" data-finger="index">
                                        <span class="test-gauge-value">80.0&deg;</span>
                                        <div class="test-gauge-track"><div class="test-gauge-fill" style="height:88.9%"></div></div>
                                        <span class="test-gauge-name">Index</span>
                                    </div>
                                    <div class="test-gauge-cell" data-finger="middle">
                                        <span class="test-gauge-value">20.0&deg;</span>
                                        <div class="test-gauge-track"><div class="test-gauge-fill" style="height:22.2%"></div></div>
                                        <span class="test-gauge-name">Middle</span>
                                    </div>
                                    <div class="test-gauge-cell" data-finger="ring">
                                        <span class="test-gauge-value">35.0&deg;</span>
                                        <div class="test-gauge-track"><div class="test-gauge-fill" style="height:38.9%"></div></div>
                                        <span class="test-gauge-name">Ring</span>
                                    </div>
                                    <div class="test-gauge-cell" data-finger="pinky">
                                        <span class="test-gauge-value">45.0&deg;</span>
                                        <div class="test-gauge-track"><div class="test-gauge-fill" style="height:50%"></div></div>
                                        <span class="test-gauge-name">Pinky</span>
                                    </div>
                                </div>

                                <div class="test-force-panel">
                                    <div class="test-analog-dial" id="hubTestForceDial" style="--dial-angle:-120deg;" aria-hidden="true">
                                        <div class="test-analog-arc"></div>
                                        <div class="test-analog-needle"></div>
                                        <div class="test-analog-center"></div>
                                        <div class="test-analog-value" id="hubTestForce">25.9 N</div>
                                    </div>
                                    <div class="test-force-label">Force</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="session-action-group">
                        <button type="button" class="sign-in-btn session-start-btn" id="hubStartTestBtn"><i class="fa-solid fa-play"></i> Start Test</button>
                        <button type="button" class="doctor-btn session-end-btn" id="hubStopTestBtn" disabled>Stop Test</button>
                    </div>
                </div>

                <p class="notes-save-feedback" id="hubTestStatus" aria-live="polite">Ready to test glove data.</p>
            </article>

            <!-- STEP 4: Select Exercise (Therapy Mode) -->
            <article class="widget widget-green wizard-panel" id="stepDiagnose" hidden>
                <h2 class="widget-title hub-step-heading" id="hubStep4Heading">
                    <span class="hub-step-number">Step 4</span>
                    <span class="hub-step-label">Select Exercise (Therapy Mode)</span>
                </h2>
                <p class="widget-label">Choose one exercise type, then configure its options before starting your therapy session.</p>

                <div class="exercise-choice-grid" id="exerciseChoiceGrid" role="radiogroup" aria-label="Exercise type">
                    <button type="button" class="exercise-choice-card" data-exercise-type="open_close_hand">Open&ndash;Close Hand</button>
                    <button type="button" class="exercise-choice-card" data-exercise-type="full_grip_hold">Full Grip (Hold)</button>
                    <button type="button" class="exercise-choice-card" data-exercise-type="full_extension_hold"><i class="fa-regular fa-hand" aria-hidden="true"></i> Full Extension (Hold)</button>
                </div>

                <div class="exercise-options-wrap" id="exerciseOptionsWrap">
                    <div class="exercise-options-group" id="exerciseSpeedWrap" hidden>
                        <div class="exercise-options-title">Speed Options</div>
                        <div class="exercise-option-chips" id="exerciseSpeedGroup" role="radiogroup" aria-label="Speed options">
                            <button type="button" class="exercise-option-chip is-selected" data-speed="slow">Slow</button>
                            <button type="button" class="exercise-option-chip" data-speed="normal">Normal</button>
                            <button type="button" class="exercise-option-chip" data-speed="fast">Fast</button>
                        </div>
                    </div>

                    <div class="exercise-options-group" id="exerciseHoldWrap" hidden>
                        <div class="exercise-options-title">Hold Duration</div>
                        <div class="exercise-option-chips" id="exerciseHoldGroup" role="radiogroup" aria-label="Hold duration options">
                            <button type="button" class="exercise-option-chip" data-hold-seconds="3">3 sec</button>
                            <button type="button" class="exercise-option-chip is-selected" data-hold-seconds="5">5 sec</button>
                            <button type="button" class="exercise-option-chip" data-hold-seconds="10">10 sec</button>
                        </div>
                    </div>

                    <div class="exercise-plan-meta">
                        <div><span>Doctor Repetitions</span><strong id="hubTherapyReps">&mdash;</strong></div>
                        <div><span>Plan Duration</span><strong id="hubTherapyDuration">&mdash;</strong></div>
                    </div>
                </div>

                <p class="notes-save-feedback" id="hubDiagStatus" aria-live="polite"></p>
            </article>

            <!-- STEP 5: Session -->
            <article class="widget widget-green wizard-panel" id="stepSession" hidden>
                <h2 class="widget-title hub-step-heading" id="hubStep5Heading">
                    <span class="hub-step-number">Step 5</span>
                    <span class="hub-step-label">Session</span>
                </h2>
                <p class="widget-label" id="hubSessionIntro">Your exercise is selected. Press <strong>Start Session</strong> to begin.</p>

                <div class="session-pane" id="therapySessionPane">
                    <div class="session-meta-bar">
                        <div class="session-meta-item">Exercise: <strong id="hubSessionExercise">&mdash;</strong></div>
                        <div class="session-meta-item">Target: <strong id="hubTargetReps">120</strong> Reps</div>
                    </div>

                    <div class="session-main-grid">
                        <div class="session-main-focus" id="hubSessionRepTile">
                            <div class="session-tile-label">Current Repetition Count</div>
                            <div class="rep-progress-ring" aria-hidden="true">
                                <svg viewBox="0 0 120 120" class="rep-progress-svg">
                                    <circle class="rep-ring-track" cx="60" cy="60" r="46"></circle>
                                    <circle class="rep-ring-progress" id="hubRepsRingProgress" cx="60" cy="60" r="46"></circle>
                                </svg>
                                <div class="session-main-reps" id="hubSessionReps">0</div>
                            </div>
                        </div>

                        <div class="session-side-stack">
                            <div class="session-side-tile" id="hubSessionTimerTile">
                                <div class="session-tile-label">Timer</div>
                                <div class="session-tile-value" id="hubSessionTime">0:00</div>
                            </div>
                            <div class="session-side-tile">
                                <div class="session-tile-label">Avg Force</div>
                                <div class="session-tile-value" id="hubSessionForce">0.0 N</div>
                            </div>
                            <div class="session-side-tile">
                                <div class="session-tile-label">Finger Movement</div>
                                <div class="session-tile-value" id="hubSessionMovement">0.0&deg;</div>
                            </div>
                        </div>
                    </div>

                    <div class="session-action-group">
                        <button type="button" class="sign-in-btn session-start-btn" id="hubStartSessionBtn"><i class="fa-solid fa-play"></i> Start Session</button>
                        <button type="button" class="doctor-btn session-end-btn" id="hubEndSessionBtn" disabled>End &amp; Save Session</button>
                    </div>
                </div>

                <p class="notes-save-feedback" id="hubSessionStatus" aria-live="polite"></p>
            </article>
            </div>

            <div class="exercise-stepper-footer">
                <div class="exercise-stepper-left-actions">
                    <button type="button" class="doctor-btn exercise-stepper-nav-btn" id="hubStepBackBtn" aria-label="Go to previous step">
                        Back
                    </button>
                    <button type="button" class="doctor-btn exercise-stepper-nav-btn" id="hubStepRetryBtn" aria-label="Retry calibration" hidden>
                        <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
                        Retry
                    </button>
                </div>
                <button type="button" class="sign-in-btn exercise-stepper-nav-btn" id="hubStepNextBtn" aria-label="Go to next step">Next</button>
            </div>
        </section>
    </main>
</div>

<div class="patients-modal" id="hubSessionSummaryModal" hidden aria-hidden="true">
    <div class="patients-modal-backdrop" aria-hidden="true"></div>
    <div class="patients-modal-card widget widget-green hub-session-summary-card" role="dialog" aria-modal="true" aria-labelledby="hubSessionSummaryTitle">
        <button type="button" class="patients-modal-close hub-session-summary-close" id="hubSessionSummaryClose" aria-label="Close summary">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
        <h2 id="hubSessionSummaryTitle">Therapy Session Summary</h2>
        <p class="patients-modal-step-label" id="hubSessionSummaryResult">Session complete.</p>

        <div class="hub-session-summary-grid" aria-live="polite">
            <div class="hub-session-summary-item">
                <span>Exercise</span>
                <strong id="hubSummaryExercise">-</strong>
            </div>
            <div class="hub-session-summary-item">
                <span>Total Repetitions</span>
                <strong id="hubSummaryReps">0</strong>
            </div>
            <div class="hub-session-summary-item">
                <span>Target Repetitions</span>
                <strong id="hubSummaryTarget">0</strong>
            </div>
            <div class="hub-session-summary-item">
                <span>Average Force</span>
                <strong id="hubSummaryForce">0.0 N</strong>
            </div>
            <div class="hub-session-summary-item">
                <span>Max Flexion</span>
                <strong id="hubSummaryFlexion">0.0°</strong>
            </div>
            <div class="hub-session-summary-item">
                <span>Duration</span>
                <strong id="hubSummaryDuration">0:00</strong>
            </div>
        </div>

        <div class="hub-session-summary-actions">
            <button type="button" class="sign-in-btn" id="hubSummaryDoneBtn">Done</button>
        </div>
    </div>
</div>

<script src="script.js"></script>
</body>
</html>