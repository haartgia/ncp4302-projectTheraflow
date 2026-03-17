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
<title>Theraflow Message Center</title>
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body class="tele-message-page patient-portal-page">
<div class="container">
    <aside class="sidebar is-collapsed" id="sidebar">
        <div class="sidebar-top"></div>
        <div class="logo"><div class="logo-icon" aria-hidden="true"><i class="fa-solid fa-hand-holding-heart"></i></div><div class="logo-wordmark">Theraflow</div></div>
        <div class="active-indicator" aria-hidden="true"></div>
        <ul class="menu">
            <li data-page="index.html"><i class="fa-solid fa-house"></i><span class="nav-label">Home</span></li>
            <li data-page="exercise_hub.php"><i class="fa-solid fa-dumbbell"></i><span class="nav-label">Exercises</span></li>
            <li data-page="recovery.php"><i class="fa-solid fa-chart-line"></i><span class="nav-label">Recovery Progress</span></li>
            <li class="active" aria-current="page" data-page="tele_message.php"><i class="fa-regular fa-message"></i><span class="nav-label">Messages</span></li>
            <li data-page="patient_settings.php"><i class="fa-solid fa-user-circle"></i><span class="nav-label patient-account-label">Account &amp; Settings</span></li>
        </ul>
        <div class="sidebar-footer">
            <button class="logout-btn" id="logoutBtn" aria-label="Log out"><i class="fa-solid fa-right-from-bracket"></i><span class="nav-label">Logout</span></button>
        </div>
    </aside>
    <main class="content">
        <section class="patient-shell" id="patientMessagesRoot" aria-labelledby="patientMessagesTitle">
            <div class="patient-header-row patient-header-row-split">
                <div>
                    <h1 id="patientMessagesTitle">Message Center</h1>
                    <p class="subheader" id="patientMessagesSubtitle">Directly message your doctor and review latest notes.</p>
                </div>
                <button type="button" class="doctor-info-btn" id="patientDoctorInfoBtn">
                    <i class="fa-solid fa-user-doctor" aria-hidden="true"></i>
                    About the doctor
                </button>
            </div>
            <article class="widget widget-green pinned-note-card">
                <h2 class="widget-title"><i class="fa-solid fa-thumbtack" aria-hidden="true"></i> Pinned Doctor Note</h2>
                <p class="widget-label" id="patientDoctorNote">No manual updates from your doctor yet.</p>
            </article>
            <article class="widget widget-blue">
                <div class="messages-chat-header"><h2 id="patientActiveDoctorName">Messages with Dr. Care Team</h2><p id="patientActiveMeta">Conversation synced.</p></div>
                <div class="messages-thread" id="patientThread"></div>
                <div class="messages-compose-row">
                    <div class="messages-compose-input-wrap">
                        <button type="button" class="compose-attach-btn" id="patientAttachBtn" aria-label="Attach file (coming soon)" title="Attachments coming soon">
                            <i class="fa-solid fa-paperclip" aria-hidden="true"></i>
                        </button>
                        <input type="text" id="patientComposeInput" placeholder="Type a message..." autocomplete="off">
                    </div>
                    <button type="button" class="sign-in-btn" id="patientSendBtn">Send</button>
                </div>
            </article>
        </section>
    </main>
</div>
<div class="doctor-info-modal" id="patientDoctorInfoModal" hidden>
    <div class="doctor-info-backdrop" id="patientDoctorInfoBackdrop"></div>
    <div class="doctor-info-card" role="dialog" aria-modal="true" aria-labelledby="patientDoctorInfoTitle">
        <button type="button" class="doctor-info-close" id="patientDoctorInfoClose" aria-label="Close doctor information">
            <i class="fa-solid fa-xmark"></i>
        </button>
        <h2 id="patientDoctorInfoTitle">About the doctor</h2>
        <div class="doctor-info-header">
            <div class="doctor-info-avatar" id="doctorInfoAvatar" aria-hidden="true">
                <i class="fa-solid fa-user-doctor"></i>
            </div>
            <div class="doctor-info-grid">
                <div>
                    <p class="doctor-info-label">Name</p>
                    <p class="doctor-info-value" id="doctorInfoName">Loading...</p>
                </div>
                <div>
                    <p class="doctor-info-label">Title</p>
                    <p class="doctor-info-value" id="doctorInfoTitle">--</p>
                </div>
                <div>
                    <p class="doctor-info-label">Specialty</p>
                    <p class="doctor-info-value" id="doctorInfoSpecialty">--</p>
                </div>
                <div>
                    <p class="doctor-info-label">Hospital</p>
                    <p class="doctor-info-value" id="doctorInfoHospital">--</p>
                </div>
                <div>
                    <p class="doctor-info-label">Email</p>
                    <p class="doctor-info-value" id="doctorInfoEmail">--</p>
                </div>
                <div>
                    <p class="doctor-info-label">Contact</p>
                    <p class="doctor-info-value" id="doctorInfoContact">--</p>
                </div>
            </div>
        </div>
        <div class="doctor-info-bio">
            <p class="doctor-info-label">Bio</p>
            <p class="doctor-info-value" id="doctorInfoBio">--</p>
        </div>
    </div>
</div>
<script src="script.js"></script>
</body>
</html>