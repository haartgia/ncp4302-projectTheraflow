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
<title>Theraflow Recovery Progress</title>
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body class="recovery-page patient-portal-page">
<div class="container">
    <aside class="sidebar is-collapsed" id="sidebar">
        <div class="sidebar-top"></div>
        <div class="logo"><img src="assets/logo_white.png" alt="Theraflow" class="logo-image"></div>
        <div class="active-indicator" aria-hidden="true"></div>
        <ul class="menu">
            <li data-page="index.html"><i class="fa-solid fa-house"></i><span class="nav-label">Home</span></li>
            <li data-page="exercise_hub.php"><i class="fa-solid fa-dumbbell"></i><span class="nav-label">Exercises</span></li>
            <li class="active" aria-current="page" data-page="recovery.php"><i class="fa-solid fa-chart-line"></i><span class="nav-label">Recovery Progress</span></li>
            <li data-page="patient_settings.php"><i class="fa-solid fa-user-circle"></i><span class="nav-label patient-account-label">Account &amp; Settings</span></li>
        </ul>
        <div class="sidebar-footer">
            <button class="logout-btn" id="logoutBtn" aria-label="Log out"><i class="fa-solid fa-right-from-bracket"></i><span class="nav-label">Logout</span></button>
        </div>
    </aside>
    <main class="content">
        <section class="patient-shell" id="recoveryRoot" aria-labelledby="recoveryTitle">
            <div class="patient-header-row">
                <div><h1 id="recoveryTitle">Recovery Progress</h1><p class="subheader">Track your milestones, review recent sessions, and monitor recovery trends over time.</p></div>
            </div>

            <div class="recovery-progress-grid">
                <section class="recovery-progress-history" aria-label="Session history and milestones">
                    <article class="widget widget-blue recovery-history-card">
                        <div class="recovery-history-section recovery-total-card">
                            <h2 class="widget-title">Total Sessions</h2>
                            <div class="recovery-total-value" id="recoveryTotalSessions">0</div>
                        </div>

                        <div class="recovery-history-section recovery-recent-card">
                            <div class="recovery-section-head">
                                <h2 class="widget-title">Recent Sessions</h2>
                                <button type="button" class="metric-graph-btn recovery-view-all-btn" id="recoveryViewAllBtn">View All Sessions</button>
                            </div>
                            <ul class="recovery-session-list" id="recoveryRecentList"></ul>
                        </div>

                        <div class="recovery-history-section recovery-best-card">
                            <h2 class="widget-title">Best Sessions</h2>
                            <ul class="recovery-best-session-list" id="recoveryBestSessionsList"></ul>
                        </div>
                    </article>
                </section>

                <section class="recovery-progress-analytics" aria-label="Trend analytics">
                    <article class="widget widget-green graph-card recovery-trend-card">
                        <div class="recovery-trend-head">
                            <div class="recovery-trend-title-block">
                                <h2 class="widget-title">Grip Strength Trend</h2>
                                <p class="recovery-trend-highlight" id="recoveryForceBestOutside">Best: -- N</p>
                                <p class="recovery-trend-note">Shows your grip strength trend from completed sessions.</p>
                            </div>
                            <div class="recovery-trend-controls">
                                <div class="recovery-trend-controls-top">
                                    <div class="recovery-segmented" id="recoveryForceViewToggle" role="tablist" aria-label="Grip Strength chart time scale">
                                        <span class="recovery-segment-highlight" aria-hidden="true"></span>
                                        <button type="button" class="recovery-segment-btn is-active" data-view="recent" role="tab" aria-selected="true">Recent</button>
                                        <button type="button" class="recovery-segment-btn" data-view="daily" role="tab" aria-selected="false">Daily</button>
                                        <button type="button" class="recovery-segment-btn" data-view="monthly" role="tab" aria-selected="false">Monthly</button>
                                    </div>
                                    <label class="recovery-values-toggle" for="recoveryForceShowValues">
                                        <input type="checkbox" id="recoveryForceShowValues">
                                        <span>Show Values</span>
                                    </label>
                                </div>
                                <div class="recovery-week-nav" id="recoveryForceNav" hidden>
                                    <button type="button" class="recovery-week-nav-btn" id="recoveryForcePrev" aria-label="Grip Strength previous range"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
                                    <span class="recovery-week-range" id="recoveryForceRangeLabel">This Week</span>
                                    <button type="button" class="recovery-week-nav-btn" id="recoveryForceNext" aria-label="Grip Strength next range"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
                                </div>
                            </div>
                        </div>
                        <div class="chart-wrap recovery-chart-wrap" id="recoveryForceChartWrap">
                            <canvas id="recoveryForceChart"></canvas>
                            <div class="recovery-chart-empty" id="recoveryForceChartEmpty" hidden>No sessions recorded for this period.</div>
                        </div>
                    </article>

                    <article class="widget widget-blue graph-card recovery-trend-card">
                        <div class="recovery-trend-head">
                            <div class="recovery-trend-title-block">
                                <h2 class="widget-title">Finger Movement Trend</h2>
                                <p class="recovery-trend-highlight" id="recoveryRomBestOutside">Best: --°</p>
                                <p class="recovery-trend-note">Shows your finger movement trend across recent sessions.</p>
                            </div>
                            <div class="recovery-trend-controls">
                                <div class="recovery-trend-controls-top">
                                    <div class="recovery-segmented" id="recoveryRomViewToggle" role="tablist" aria-label="Finger Movement chart time scale">
                                        <span class="recovery-segment-highlight" aria-hidden="true"></span>
                                        <button type="button" class="recovery-segment-btn is-active" data-view="recent" role="tab" aria-selected="true">Recent</button>
                                        <button type="button" class="recovery-segment-btn" data-view="daily" role="tab" aria-selected="false">Daily</button>
                                        <button type="button" class="recovery-segment-btn" data-view="monthly" role="tab" aria-selected="false">Monthly</button>
                                    </div>
                                    <label class="recovery-values-toggle" for="recoveryRomShowValues">
                                        <input type="checkbox" id="recoveryRomShowValues">
                                        <span>Show Values</span>
                                    </label>
                                </div>
                                <div class="recovery-week-nav" id="recoveryRomNav" hidden>
                                    <button type="button" class="recovery-week-nav-btn" id="recoveryRomPrev" aria-label="Finger Movement previous range"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
                                    <span class="recovery-week-range" id="recoveryRomRangeLabel">This Week</span>
                                    <button type="button" class="recovery-week-nav-btn" id="recoveryRomNext" aria-label="Finger Movement next range"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
                                </div>
                            </div>
                        </div>
                        <div class="chart-wrap recovery-chart-wrap" id="recoveryRomChartWrap">
                            <canvas id="recoveryRomChart"></canvas>
                            <div class="recovery-chart-empty" id="recoveryRomChartEmpty" hidden>No sessions recorded for this period.</div>
                        </div>
                    </article>
                </section>
            </div>

            <div class="metric-graph-modal" id="recoverySessionsModal" hidden>
                <div class="metric-graph-modal-backdrop" id="recoverySessionsBackdrop"></div>
                <div class="metric-graph-modal-panel recovery-sessions-panel" role="dialog" aria-modal="true" aria-labelledby="recoverySessionsModalTitle">
                    <div class="metric-graph-modal-head">
                        <h2 id="recoverySessionsModalTitle">All Sessions</h2>
                        <button type="button" class="metric-graph-modal-close" id="recoverySessionsClose" aria-label="Close all sessions modal">
                            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                        </button>
                    </div>
                    <div class="metric-graph-modal-body recovery-sessions-body">
                        <ul class="recovery-session-list recovery-session-list-modal" id="recoveryAllSessionsList"></ul>
                    </div>
                </div>
            </div>
        </section>
    </main>
</div>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="script.js"></script>
</body>
</html>