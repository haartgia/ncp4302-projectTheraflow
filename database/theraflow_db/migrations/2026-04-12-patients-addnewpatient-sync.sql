-- Sync existing theraflow_db.patients table with Add New Patient fields.
-- Safe to run multiple times on MySQL 8.0+.

USE theraflow_db;

ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(120) NULL AFTER name,
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(120) NULL AFTER first_name,
    ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL AFTER age,
    ADD COLUMN IF NOT EXISTS backup_email VARCHAR(255) NULL AFTER contact,
    DROP COLUMN IF EXISTS recovery_start_date;
