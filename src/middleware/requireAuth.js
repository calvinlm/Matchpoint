const jwt = require('jsonwebtoken');
const { validateAuthConfiguration, jwtSecret } = require('../config/auth');

validateAuthConfiguration();

function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length);
}

function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret());
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = requireAuth;
