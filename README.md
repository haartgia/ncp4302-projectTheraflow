# TheraFlow Project Setup

This repository contains the frontend pages and PHP API for the TheraFlow project.

## Important Note For Anyone Who Pulls This Repo

After pulling, you must set up the MySQL databases before login/registration and dashboard APIs will work.

1. Open phpMyAdmin (or MySQL CLI).
2. Create required databases (depending on your dump/schema):
   - theraflowusers_db
   - theraflow_db
   - Charset: utf8mb4
3. Import the project SQL schema/dump (many setups include tables across both theraflowusers_db and theraflow_db).
    - Quick setup: import `database/setup.sql` from this repo.
    - Organized split setup (separate databases):
       - `database/user_db/schema.sql`
       - `database/theraflow_db/schema.sql`
    - MySQL CLI examples:
       - `mysql -u root -p < database/setup.sql`
       - `mysql -u root -p < database/user_db/schema.sql`
       - `mysql -u root -p < database/theraflow_db/schema.sql`
   - If you do not have the SQL file yet, request the latest dump from the project owner before running.
4. Confirm your local DB credentials in api/db.php defaults, or override via environment variables:
   - TF_DB_HOST (default: 127.0.0.1)
   - TF_DB_PORT (default: 3306)
   - TF_DB_NAME (default: theraflow_db)
   - TF_DB_USER (default: root)
   - TF_DB_PASS (default: empty)
   - TF_DB_CHARSET (default: utf8mb4)
   - TF_DB_SOCKET (optional)
   - Database: theraflow_db (and ensure referenced tables in theraflowusers_db are also present if your branch uses them)

## Quick Local Run (XAMPP)

1. Start Apache and MySQL in XAMPP.
2. Place the project in htdocs.
3. Open in browser:
   - http://localhost/ncp4302-projectTheraflow/index.html

## Folder Notes

- `api/` -> PHP API endpoints grouped by role/domain (`doctor`, `patient`, `patients`, `iot`, `lib`)
- `database/` -> DB scripts, now split by database and also kept as combined bootstrap
- Root HTML/PHP files -> page entry points used by the current routing

## Pre-Push Checklist

- API endpoints load without PHP fatal errors.
- Login and registration work against your local theraflowusers_db + theraflow_db setup.
- No hardcoded personal credentials were added.
- You included/updated setup notes when schema changes were made.
