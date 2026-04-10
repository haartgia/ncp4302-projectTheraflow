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
                    <p class="subheader">Complete each step before your session: Connect &rarr; Calibrate &rarr; Select Exercise &rarr; Session.</p>
                </div>
            </div>

            <div class="exercise-stepper-viewport" id="exerciseStepperViewport">
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

            <!-- STEP 3: Select Exercise (Therapy Mode) -->
            <article class="widget widget-green wizard-panel" id="stepDiagnose" hidden>
                <h2 class="widget-title">Step 3 &mdash; Select Exercise (Therapy Mode)</h2>
                <p class="widget-label">Choose one exercise type, then configure its options before starting your therapy session.</p>

                <div class="exercise-choice-grid" id="exerciseChoiceGrid" role="radiogroup" aria-label="Exercise type">
                    <button type="button" class="exercise-choice-card" data-exercise-type="open_close_hand">Open&ndash;Close Hand</button>
                    <button type="button" class="exercise-choice-card" data-exercise-type="full_grip_hold">Full Grip (Hold)</button>
                    <button type="button" class="exercise-choice-card" data-exercise-type="full_extension_hold">Full Extension (Hold)</button>
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

                <button type="button" class="sign-in-btn" id="hubExerciseStartBtn"><i class="fa-solid fa-check"></i> Confirm Exercise</button>
                <p class="notes-save-feedback" id="hubDiagStatus" aria-live="polite"></p>
            </article>

            <!-- STEP 4: Session -->
            <article class="widget widget-green wizard-panel" id="stepSession" hidden>
                <h2 class="widget-title">Step 4 &mdash; Session</h2>
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
                        <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
                        <span class="sr-only">Back</span>
                    </button>
                    <button type="button" class="doctor-btn exercise-stepper-nav-btn" id="hubStepRetryBtn" aria-label="Retry calibration" hidden>
                        <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
                        <span class="sr-only">Retry</span>
                    </button>
                </div>
                <nav class="wizard-steps-nav wizard-steps-nav-dots" aria-label="Exercise setup steps">
                    <button type="button" class="wizard-step-dot is-active" id="navDot1" data-step="1" aria-label="Connect" title="Connect"></button>
                    <button type="button" class="wizard-step-dot" id="navDot2" data-step="2" aria-label="Calibrate" title="Calibrate"></button>
                    <button type="button" class="wizard-step-dot" id="navDot3" data-step="3" aria-label="Select" title="Select"></button>
                    <button type="button" class="wizard-step-dot" id="navDot4" data-step="4" aria-label="Session" title="Session"></button>
                </nav>
                <button type="button" class="sign-in-btn exercise-stepper-nav-btn" id="hubStepNextBtn" aria-label="Go to next step">Next</button>
            </div>
        </section>
    </main>
</div>
<script src="script.js"></script>
</body>
</html>