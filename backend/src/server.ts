import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { api } from './routes/api.js';

const app = express();

// CORS_ORIGIN restricts requests to one origin (e.g. your Netlify site URL)
// in production. Unset (the local-dev default) allows any origin.
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));
// Image contracts arrive as base64 data URLs in the request body.
app.use(express.json({ limit: '15mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', api);

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`ClearSign backend listening on http://localhost:${port}`);
});
