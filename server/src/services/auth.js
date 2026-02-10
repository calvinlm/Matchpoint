const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validateAuthConfiguration, tdEmail, tdPasswordHash, jwtSecret } = require('../config/auth');

validateAuthConfiguration();

async function verifyCredentials(email, password) {
  if (email !== tdEmail()) {
    return false;
  }

  const hash = tdPasswordHash();
  if (!hash) {
    return false;
  }

  return bcrypt.compare(password, hash);
}

function issueToken(payload) {
  return jwt.sign(payload, jwtSecret(), { expiresIn: '12h' });
}

module.exports = {
  verifyCredentials,
  issueToken,
};
