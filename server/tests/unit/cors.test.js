const { parseAllowedOrigins, isOriginAllowed } = require('../../src/config/cors');

describe('CORS allowlist', () => {
  const allowed = parseAllowedOrigins('https://matchpoint.example.com, https://matchpoint-*.vercel.app/', 'production');

  test.each([
    ['https://matchpoint.example.com', true],
    ['https://MATCHPOINT.example.com', true],
    ['https://matchpoint-git-feat-x-calvin.vercel.app', true],
    ['https://matchpoint-.vercel.app', false],
    ['https://matchpoint-a.b.vercel.app', false],
    ['https://evil.com', false],
    ['https://matchpoint.example.com.evil.com', false],
    [undefined, false],
  ])('%s → %s', (origin, expected) => {
    expect(isOriginAllowed(origin, allowed)).toBe(expected);
  });

  test('development default allows the local frontend', () => {
    const dev = parseAllowedOrigins('', 'development');
    expect(isOriginAllowed('http://localhost:3000', dev)).toBe(true);
    expect(isOriginAllowed('http://localhost:4000', dev)).toBe(false);
  });

  test('production with nothing set allows nothing', () => {
    const none = parseAllowedOrigins(undefined, 'production');
    expect(none.allowAny).toBe(false);
    expect(isOriginAllowed('http://localhost:3000', none)).toBe(false);
  });

  test('"*" allows any origin', () => {
    expect(parseAllowedOrigins('*', 'production').allowAny).toBe(true);
  });
});
