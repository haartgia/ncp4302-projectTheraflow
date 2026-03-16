# TheraFlow Project Setup

This repository contains the frontend pages and PHP API for the TheraFlow project.

## Important Note For Anyone Who Pulls This Repo

After pulling, you must set up the MySQL databases before login/registration and dashboard APIs will work.

1. Open phpMyAdmin (or MySQL CLI).
2. Create required databases (depending on your dump/schema):
   - user_db
   - theraflow_db
   - Charset: utf8mb4
3. Import the project SQL schema/dump (many setups include tables across both user_db and theraflow_db).
   - Recommended: import `database/setup.sql` from this repo.
   - MySQL CLI example:
     - `mysql -u root -p < database/setup.sql`
   - If you do not have the SQL file yet, request the latest dump from the project owner before running.
4. Confirm your local DB credentials in api/db.php:
   - Host: 127.0.0.1
   - User: root
   - Password: (empty by default on local XAMPP)
   - Database: theraflow_db (and ensure referenced tables in user_db are also present if your branch uses them)

## Quick Local Run (XAMPP)

1. Start Apache and MySQL in XAMPP.
2. Place the project in htdocs.
3. Open in browser:
   - http://localhost/ncp4302-projectTheraflow/index.html

## Pre-Push Checklist

- API endpoints load without PHP fatal errors.
- Login and registration work against your local user_db + theraflow_db setup.
- No hardcoded personal credentials were added.
- You included/updated setup notes when schema changes were made.
