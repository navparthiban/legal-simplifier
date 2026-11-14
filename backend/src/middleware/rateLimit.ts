import { rateLimit } from 'express-rate-limit';

/** A positive number from an env var, or the fallback when unset / invalid. */
function envNumber(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// One contract costs 3 AI requests (pre-quiz, summary, quiz), so 30 per 15 min
// is about 10 contracts per visitor. The counter lives in memory: it resets
// when the server restarts or sleeps.
const limit = envNumber('RATE_LIMIT_MAX', 30);
const windowMin = envNumber('RATE_LIMIT_WINDOW_MIN', 15);

/** Per-IP limit for the AI routes under /api. /health is not limited. */
export const apiLimiter = rateLimit({
  windowMs: windowMin * 60 * 1000,
  limit,
  standardHeaders: true, // RateLimit-* headers
  legacyHeaders: false, // no X-RateLimit-* headers
  handler: (req, res, _next, options) => {
    console.log(`[rate-limit] blocked ${req.ip} on ${req.originalUrl}`);
    res.status(options.statusCode).json({ error: 'Too many requests. Please try again later.' });
  },
});
