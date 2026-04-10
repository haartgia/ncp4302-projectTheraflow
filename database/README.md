# Database Organization

This folder is now split by database for easier maintenance:

- `database/user_db/schema.sql` -> auth users schema (creates `theraflowusers_db`)
- `database/theraflow_db/schema.sql` -> application tables (patients, sessions, therapy, etc.)
- `database/setup.sql` -> combined bootstrap script for one-shot imports

## Import Options

1. Combined import (recommended for quick setup):
   - `mysql -u root -p < database/setup.sql`

2. Split import (separate databases):
   - `mysql -u root -p < database/user_db/schema.sql`
   - `mysql -u root -p < database/theraflow_db/schema.sql`

If using phpMyAdmin, import the files in the same order as above.
