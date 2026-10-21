// Parses CORS_ALLOW_ORIGIN into a matcher.
//
// CORS_ALLOW_ORIGIN is a comma-separated list. Each entry is either:
//   - "*"                                   any origin (no credentials)
//   - an exact origin                       https://matchpoint.example.com
//   - an origin with one "*" in the host    https://matchpoint-*.vercel.app
//     ("*" matches letters, digits and hyphens only, so it can't span dots)
//
// Unset in development, it allows the local frontend dev servers.

const DEV_DEFAULT = 'http://localhost:3000,http://localhost:3100';

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseAllowedOrigins(value, nodeEnv = process.env.NODE_ENV) {
  const raw = value && value.trim() ? value : nodeEnv === 'development' ? DEV_DEFAULT : '';
  const entries = raw
    .split(',')
    .map((entry) => entry.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const allowAny = entries.includes('*');
  const exact = new Set();
  const patterns = [];

  entries
    .filter((entry) => entry !== '*')
    .forEach((entry) => {
      if (entry.includes('*')) {
        const regex = `^${entry.split('*').map(escapeRegex).join('[a-z0-9-]+')}$`;
        patterns.push(new RegExp(regex, 'i'));
      } else {
        exact.add(entry.toLowerCase());
      }
    });

  return { allowAny, exact, patterns };
}

function isOriginAllowed(origin, allowed) {
  if (!origin) {
    return false;
  }
  const normalized = origin.toLowerCase();
  return allowed.exact.has(normalized) || allowed.patterns.some((pattern) => pattern.test(origin));
}

module.exports = {
  parseAllowedOrigins,
  isOriginAllowed,
};
