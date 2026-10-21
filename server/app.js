const express = require('express');
const { parseAllowedOrigins, isOriginAllowed } = require('./src/config/cors');
const authRouter = require('./src/routes/auth');
const tournamentsRouter = require('./src/routes/tournaments');
const bracketsRouter = require('./src/routes/brackets');
const teamsRouter = require('./src/routes/teams');
const publicRouter = require('./src/routes/public');
const playersRouter = require('./src/routes/players');

const app = express();

app.use(express.json());

const allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOW_ORIGIN);

app.use((req, res, next) => {
  const { origin } = req.headers;

  res.header('Vary', 'Origin');
  if (isOriginAllowed(origin, allowedOrigins)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (allowedOrigins.allowAny) {
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/players', playersRouter);
app.use('/api/v1/teams', teamsRouter);
app.use('/api/v1/tournaments', tournamentsRouter);
app.use('/api/v1/tournaments', bracketsRouter);
app.use('/api/v1/public', publicRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

module.exports = app;
