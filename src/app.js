const express = require('express');
const authRouter = require('./routes/auth');
const tournamentsRouter = require('./routes/tournaments');
const bracketsRouter = require('./routes/brackets');
const teamsRouter = require('./routes/teams');
const playersRouter = require('./routes/players');
const publicRouter = require('./routes/public');

const app = express();

app.use(express.json());

const corsAllowedOrigin =
  process.env.CORS_ALLOW_ORIGIN || (process.env.NODE_ENV === 'development' ? 'http://localhost:3100' : '');

app.use((req, res, next) => {
  if (corsAllowedOrigin === '*') {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (corsAllowedOrigin && req.headers.origin === corsAllowedOrigin) {
    res.header('Access-Control-Allow-Origin', corsAllowedOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
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
