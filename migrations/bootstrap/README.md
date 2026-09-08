# Bootstrap migration chain

This directory is a separate, runnable migration chain for creating a new, empty D1 database that matches the verified Takdaro Production schema.

## Current chain

1. Run `0001_production_baseline.sql` on a new, empty database.
2. Verify that the database has 31 application tables and 60 indexes.
3. Do not run the historical top-level `migrations/0001_*.sql` through `0003_*.sql` after this bootstrap; they belong only to the legacy Production history.

## Why this is separate

The existing Production D1 database has already recorded its historical migrations. Replaying or rewriting those files would risk an existing database. This nested directory is not selected by the default Wrangler migration pattern (`migrations/*.sql`), so it cannot be applied to Production accidentally.

## Future changes

For every future data-model feature:

- Add the next top-level migration (starting with `0004_...`) for the existing Production database.
- Add the corresponding next bootstrap migration here (starting with `0002_...`) so a new database reaches the same final schema.
- Test both paths against disposable D1 databases before a Production release.

## Safety

Never execute a bootstrap migration against `takdaro-users-prod`. The bootstrap track is only for newly created test, preview, or replacement databases.
