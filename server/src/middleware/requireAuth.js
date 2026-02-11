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

function normalizeClaims(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const { sub, email, role } = payload;
  if (typeof sub !== 'string' || typeof email !== 'string' || typeof role !== 'string') {
    return null;
  }

  return { sub, email, role };
}

function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret());
    const user = normalizeClaims(payload);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = requireAuth;
