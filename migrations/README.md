# Database migrations

## Current baseline

- `schema.production.sql` is an immutable snapshot of the Production D1 schema captured on 2026-09-08.
- `schema.sql` is the canonical schema baseline for reviewing or bootstrapping a new, empty database. Never apply it to an existing database.
- `0001_init-auth.sql` through `0003_fix_auth_schema.sql` are historical Production migrations. They do not recreate the current schema by themselves.

## Production rule

Every future data-model change must start with one new, numbered SQL migration in this directory. The next available number is `0004`.

Before a migration reaches Production:

1. Review the affected API and shared-service dependencies.
2. Test it against a non-production D1 copy or disposable database.
3. Confirm the expected schema change.
4. Apply it to Production only through an explicit, recorded release step.
5. Update `schema.production.sql` and `schema.sql` only after the Production schema is verified.

## Important limitation

Do not run the historical migration chain against a database that was initialized from `schema.sql`: the historical migrations would try to recreate tables that already exist. A separate migration-chain reset is required before fresh environments can use automatic migration replay end-to-end. That reset must be designed and tested independently; it is intentionally out of scope for this baseline alignment change.
