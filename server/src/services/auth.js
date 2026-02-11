const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validateAuthConfiguration, jwtSecret, jwtExpires } = require('../config/auth');
const prisma = require('../lib/prisma');

validateAuthConfiguration();

async function verifyCredentials(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return null;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

function issueToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, jwtSecret(), { expiresIn: jwtExpires() });
}

module.exports = {
  verifyCredentials,
  issueToken,
};
