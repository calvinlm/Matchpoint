# Server auth setup

- Users are stored in the database (`User` table) and authenticated via email/password lookups using Prisma. Create users with hashed passwords in the DB instead of environment variables.
- Environment variables:
  - `TD_JWT_SECRET` (required): signing key for access tokens.
  - `TD_JWT_EXPIRES` (optional): JWT expiry (default `12h`, accepts any jsonwebtoken `expiresIn` value).
- On startup the server validates the presence of `TD_JWT_SECRET`. Missing or invalid JWT config will stop the server with a clear error.
