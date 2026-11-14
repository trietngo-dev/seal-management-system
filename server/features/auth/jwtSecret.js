// Single source of truth for the JWT signing secret.
// The fallback exists only for local development; production must set JWT_SECRET,
// otherwise anyone who reads this repository can forge login tokens.
const DEV_FALLBACK_SECRET = 'seal_hackathon_secret_key_2026';

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[AUTH] JWT_SECRET must be set when NODE_ENV=production.');
  }
  console.warn('[AUTH] JWT_SECRET is not set. Using the insecure development fallback secret.');
}

module.exports = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;
