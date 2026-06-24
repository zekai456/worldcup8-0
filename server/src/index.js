// Server entry. Loads env, connects DB (best-effort), mounts API + static frontend.
import './env.js';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { router } from './routes.js';
import { initDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api', router);
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Serve built frontend if present (production single-process deploy).
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});

initDb().catch((err) => {
  console.warn('[db] unavailable, running without cache:', err.message);
});
