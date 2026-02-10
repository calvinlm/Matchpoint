const express = require('express');
const { verifyCredentials, issueToken } = require('../services/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const valid = await verifyCredentials(email, password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = issueToken({ email });
    return res.json({ token });
  } catch (error) {
    console.error('Login error', error);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

module.exports = router;
