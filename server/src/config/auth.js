const dotenv = require('dotenv');

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test', override: true });
} else {
  dotenv.config();
}

const REQUIRED_ENV_VARS = ['TD_JWT_SECRET'];

function validateAuthConfiguration() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing JWT configuration. Set ${missing.join(', ')} environment variable${
        missing.length > 1 ? 's' : ''
      } to sign auth tokens.`
    );
  }
}

module.exports = {
  validateAuthConfiguration,
  jwtSecret: () => process.env.TD_JWT_SECRET,
  jwtExpires: () => process.env.TD_JWT_EXPIRES || '12h',
};
