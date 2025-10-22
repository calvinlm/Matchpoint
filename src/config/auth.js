const dotenv = require('dotenv');

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test', override: true });
} else {
  dotenv.config();
}

const REQUIRED_ENV_VARS = ['TD_EMAIL', 'TD_PASSWORD_HASH', 'TD_JWT_SECRET'];

function validateAuthConfiguration() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing auth configuration. Set ${missing.join(', ')} environment variable${
        missing.length > 1 ? 's' : ''
      }.`
    );
  }
}

module.exports = {
  validateAuthConfiguration,
  tdEmail: () => process.env.TD_EMAIL,
  tdPasswordHash: () => process.env.TD_PASSWORD_HASH,
  jwtSecret: () => process.env.TD_JWT_SECRET,
};
