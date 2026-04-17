-- Creates storage table for doctor Files/Documents uploads (PDF only).
-- Safe to run multiple times on MySQL 8.0+.

USE theraflow_db;

CREATE TABLE IF NOT EXISTS doctor_documents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    doctor_user_id INT UNSIGNED NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(64) NOT NULL,
    file_ext VARCHAR(8) NOT NULL,
    file_size_bytes BIGINT UNSIGNED NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_doctor_documents_stored_name (stored_name),
    KEY idx_doctor_documents_doctor_user_id (doctor_user_id),
    CONSTRAINT chk_doctor_documents_pdf_mime CHECK (LOWER(mime_type) = 'application/pdf'),
    CONSTRAINT chk_doctor_documents_pdf_ext CHECK (LOWER(file_ext) = 'pdf')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
