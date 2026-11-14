import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { api } from './routes/api.js';
import { apiLimiter } from './middleware/rateLimit.js';

const app = express();

// TRUST_PROXY = number of proxy hops in front of the app (1 on Render), so
// req.ip is the visitor's real IP and the rate limit is per visitor. Unset
// locally (no proxy).
const trustProxy = Number(process.env.TRUST_PROXY);
if (process.env.TRUST_PROXY && Number.isInteger(trustProxy) && trustProxy >= 0) {
  app.set('trust proxy', trustProxy);
}

// CORS_ORIGIN restricts requests to one origin (e.g. your Netlify site URL)
// in production. Unset (the local-dev default) allows any origin.
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));
// Image contracts arrive as base64 data URLs in the request body.
app.use(express.json({ limit: '15mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
// Rate limit the AI routes only; /health stays unlimited (Render's health
// check and the frontend's page-load wake-up ping use it).
app.use('/api', apiLimiter, api);

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`ClearSign backend listening on http://localhost:${port}`);
});
