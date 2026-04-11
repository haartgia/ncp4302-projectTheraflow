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
        <div class="logo"><img src="assets/logo_white.png" alt="Theraflow" class="logo-image"></div>
        <div class="active-indicator" aria-hidden="true"></div>
        <ul class="menu">
            <li data-page="index.html"><i class="fa-solid fa-house"></i><span class="nav-label">Home</span></li>
            <li data-page="exercise_hub.php"><i class="fa-solid fa-dumbbell"></i><span class="nav-label">Exercises</span></li>
            <li data-page="recovery.php"><i class="fa-solid fa-chart-line"></i><span class="nav-label">Recovery Progress</span></li>
            <li class="active" aria-current="page" data-page="patient_settings.php"><i class="fa-solid fa-user-circle"></i><span class="nav-label patient-account-label">Account &amp; Settings</span></li>
        </ul>
        <div class="sidebar-footer">
            <button class="logout-btn" id="logoutBtn" aria-label="Log out"><i class="fa-solid fa-right-from-bracket"></i><span class="nav-label">Logout</span></button>
        </div>
    </aside>
    <main class="content">
        <section class="patient-shell" id="patientSettingsRoot" aria-labelledby="patientSettingsTitle">
            <div class="patient-header-row"><div><h1 id="patientSettingsTitle">Account Settings</h1><p class="subheader">Keep your account details current and review provider-managed clinical information.</p></div></div>
            <div class="patient-hub-grid">
                <div class="account-cards-grid">
                    <article class="widget widget-green account-info-card account-info-card--left">
                        <h2 class="widget-title">Account Information</h2>
                        <form id="patientSettingsForm" class="account-compact-grid account-grid-left" novalidate>
                            <label class="field-group account-locked-field">
                                <span>Full Name</span>
                                <input type="text" id="patientFullName" readonly>
                            </label>
                            <label class="field-group account-locked-field">
                                <span>Date of Birth</span>
                                <input type="text" id="patientDateOfBirth" readonly>
                            </label>
                            <label class="field-group account-locked-field">
                                <span>Age</span>
                                <input type="text" id="patientAge" readonly>
                            </label>
                            <label class="field-group account-locked-field">
                                <span>Gender</span>
                                <input type="text" id="patientGender" readonly>
                            </label>

                            <label class="field-group required-field has-inline-edit">
                                <span>Email Address</span>
                                <input type="text" id="patientPhone" placeholder="Not Provided" readonly>
                                <button type="button" class="inline-edit-btn" id="patientPhoneEditBtn" aria-label="Edit email address"><i class="fa-solid fa-pen"></i></button>
                            </label>
                            <label class="field-group has-inline-edit">
                                <span>Backup Contact (Optional)</span>
                                <input type="text" id="patientBackupContact" placeholder="Not Provided" readonly>
                                <button type="button" class="inline-edit-btn" id="patientBackupEditBtn" aria-label="Edit backup contact"><i class="fa-solid fa-pen"></i></button>
                            </label>
                            <label class="field-group required-field account-locked-field">
                                <span>Username</span>
                                <input type="text" id="patientUsername" placeholder="Not Provided" readonly>
                            </label>
                            <label class="field-group password-pill-group account-locked-field">
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
                                        <label class="field-group field-group-span-2"><span>Confirm New Password</span><input type="password" id="patientConfirmPassword" placeholder="Confirm New Password" minlength="6"></label>
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
                    </article>

                    <article class="widget widget-green account-info-card account-info-card--right">
                        <h2 class="widget-title">Clinical Information</h2>
                        <div class="account-compact-grid account-grid-right">
                            <label class="field-group account-locked-field">
                                <span>Stroke Type</span>
                                <input type="text" id="patientStrokeType" readonly>
                            </label>
                            <label class="field-group account-locked-field">
                                <span>Affected Hand</span>
                                <input type="text" id="patientAffectedHand" readonly>
                            </label>
                            <label class="field-group account-locked-field">
                                <span>Diagnosis</span>
                                <input type="text" id="patientDiagnosis" readonly>
                            </label>
                            <label class="field-group account-locked-field">
                                <span>Assigned Doctor</span>
                                <input type="text" id="patientAssignedDoctor" readonly>
                            </label>
                            <label class="field-group field-group-span-4 account-locked-field treatment-goal-group">
                                <span>Treatment Goal</span>
                                <div id="patientTreatmentGoal" class="treatment-goal-panel" role="textbox" aria-readonly="true"></div>
                            </label>
                        </div>
                    </article>
                </div>
                <p class="medical-note account-global-note">Note: These details are managed by your healthcare provider. Contact your doctor to update medical records.</p>
            </div>

            <div class="profile-mobile-logout-wrap">
                <button type="button" class="profile-mobile-logout-btn" data-logout-trigger="true" aria-label="Log out of your account">
                    <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
                    <span>Logout</span>
                </button>
            </div>
        </section>
    </main>
</div>
<script src="script.js"></script>
</body>
</html>
