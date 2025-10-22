## CI Pipeline — GitHub Actions

This repository includes an automated pipeline defined in `.github/workflows/ci.yml`. The workflow runs on every push or pull request targeting `main`/`master` and executes the following stages:

1. **Environment Setup**
   - Uses `ubuntu-latest` with a PostgreSQL 16 service (`postgresql://postgres:postgres@localhost:5432/matchpoint_test`).
   - Seeds auth-related environment variables so the integration tests can log in (`TD_EMAIL`, `TD_PASSWORD_HASH`, `TD_JWT_SECRET`, `TD_AUTH_PASSWORD`).
   - Installs Node.js 22 and restores the npm cache.

2. **Build & Validation Steps**
   - `npm ci` installs dependencies.
   - `npx prisma generate` regenerates the Prisma client to match the schema.
   - `npx prisma migrate deploy` applies migrations against the CI database.
   - `npx prisma validate` double-checks the schema configuration.
   - `npm test` runs the Jest + Supertest integration suite, which exercises the authenticated tournament endpoints and asserts audit logging.

### Local Parity Checklist

Before pushing changes, mirror the workflow locally:
- Ensure Postgres is running and `DATABASE_URL`, `TD_EMAIL`, `TD_PASSWORD_HASH`, `TD_JWT_SECRET`, and `TD_AUTH_PASSWORD` are defined (or stored in `.env.test`).
- Recreate the pipeline steps manually:
  ```bash
  npm ci
  npx prisma generate
  npx prisma migrate deploy
  npx prisma validate
  npm test
  ```

### Future Enhancements
- Add linting (`npm run lint`) and type-checking (`npm run typecheck`) once scripts exist.
- Report Prisma migrate output and test logs as workflow artifacts for easier debugging.
- Introduce coverage reporting to surface trends over time.
