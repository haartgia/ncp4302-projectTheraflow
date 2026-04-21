-- TheraFlow: theraflow_db schema

CREATE DATABASE IF NOT EXISTS theraflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE theraflow_db;

CREATE TABLE IF NOT EXISTS doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(191) NOT NULL,
    contact_number VARCHAR(20) NULL,
    specialty VARCHAR(120) NULL,
    license_number VARCHAR(80) NULL,
    years_experience INT NULL,
    affiliation VARCHAR(180) NULL,
    bio TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_doctors_user_id (user_id),
    UNIQUE KEY uq_doctors_email (email),
    INDEX idx_doctors_specialty (specialty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    doctor_id INT NULL,
    name VARCHAR(150) NOT NULL,
    first_name VARCHAR(120) NULL,
    last_name VARCHAR(120) NULL,
    age INT NULL,
    date_of_birth DATE NULL,
    gender VARCHAR(20) NULL,
    stroke_type VARCHAR(100) NULL,
    affected_hand VARCHAR(20) NULL,
    contact VARCHAR(120) NULL,
    backup_email VARCHAR(255) NULL,
    username VARCHAR(80) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'Stable',
    last_session DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_patients_username (username),
    INDEX idx_patients_user_id (user_id),
    INDEX idx_patients_doctor_id (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    sender ENUM('doctor', 'patient') NOT NULL,
    body TEXT NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_messages_patient_id (patient_id),
    INDEX idx_messages_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS therapy_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    template_name VARCHAR(80) NULL,
    duration_min INT NOT NULL DEFAULT 0,
    target_repetitions INT NOT NULL DEFAULT 0,
    sessions_per_day INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_therapy_plans_patient_id (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    grip_strength DECIMAL(6,2) NULL,
    flexion_angle DECIMAL(6,2) NULL,
    repetitions INT NULL,
    note VARCHAR(255) NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sensor_patient_id (patient_id),
    INDEX idx_sensor_recorded_at (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    grip_strength DECIMAL(6,2) NULL,
    flexion_angle DECIMAL(6,2) NULL,
    repetitions INT NULL,
    source VARCHAR(40) NOT NULL DEFAULT 'manual',
    status VARCHAR(80) NULL,
    note VARCHAR(255) NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sessions_patient_id (patient_id),
    INDEX idx_sessions_recorded_at (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS diagnostic_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    stage_name VARCHAR(120) NULL,
    max_extension DECIMAL(6,2) DEFAULT 0,
    max_flexion DECIMAL(6,2) DEFAULT 0,
    peak_force DECIMAL(6,2) DEFAULT 0,
    logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_diag_patient_id (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS doctor_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    duration_min INT NOT NULL DEFAULT 15,
    target_repetitions INT NOT NULL DEFAULT 120,
    exercise_type VARCHAR(120) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_doctor_assignments_patient_id (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recovery_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    avg_grip_strength DECIMAL(6,2) NULL,
    avg_flexion DECIMAL(6,2) NULL,
    avg_extension DECIMAL(6,2) NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_recovery_patient_id (patient_id),
    INDEX idx_recovery_recorded_at (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS patient_clinical_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NULL,
    diagnosis VARCHAR(255) NULL,
    treatment_goal VARCHAR(255) NULL,
    reviewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_clinical_patient_id (patient_id),
    INDEX idx_clinical_reviewed_at (reviewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional compatibility table used by some branches
CREATE TABLE IF NOT EXISTS therapy_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    template_name VARCHAR(80) NULL,
    duration_min INT NOT NULL DEFAULT 0,
    target_repetitions INT NOT NULL DEFAULT 0,
    sessions_per_day INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_therapy_assignments_patient_id (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
