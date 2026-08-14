const jwt = require('jsonwebtoken');

// Every protected route runs this first. It only checks "is this a
// valid, unexpired token for a real user" — it does NOT check
// ownership of any specific resource. Ownership (e.g. "can this user
// edit this event") is enforced separately, per-route, because it
// depends on which resource is being touched, not just who's logged in.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
