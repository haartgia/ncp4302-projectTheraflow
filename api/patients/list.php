<?php
session_start();

header('Content-Type: application/json');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/doctor_data.php';

$doctorId = requireDoctorSessionOrExit();
echo json_encode(getDoctorPatients($pdo, $doctorId));
