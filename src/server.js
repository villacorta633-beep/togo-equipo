require('dotenv').config();
const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Base de datos SQLite ──────────────────────────────────────────────────────
const db = new Database(process.env.DB_PATH || './data.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    author TEXT,
    pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_name TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// ── Web Push ──────────────────────────────────────────────────────────────────
webpush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'admin@togo.bo'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── Helpers ───────────────────────────────────────────────────────────────────
function sendPushToAll(payload) {
  const subs = db.prepare('SELECT * FROM subscriptions').all();
  subs.forEach(async (row) => {
    const sub = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth }
    };
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare('DELETE FROM subscriptions WHERE endpoint = ?').run(row.endpoint);
      }
    }
  });
}

// ── Rutas: VAPID public key ───────────────────────────────────────────────────
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

// ── Rutas: Suscripciones ──────────────────────────────────────────────────────
app.post('/api/subscribe', (req, res) => {
  const { subscription, userName } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Suscripcion invalida' });

  db.prepare(`
    INSERT INTO subscriptions (endpoint, p256dh, auth, user_name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_name=excluded.user_name
  `).run(
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    userName || 'Anonimo'
  );

  res.json({ ok: true });
});

app.delete('/api/subscribe', (req, res) => {
  const { endpoint } = req.body;
  db.prepare('DELETE FROM subscriptions WHERE endpoint = ?').run(endpoint);
  res.json({ ok: true });
});

// ── Rutas: Eventos ────────────────────────────────────────────────────────────
app.get('/api/events', (req, res) => {
  const events = db.prepare('SELECT * FROM events ORDER BY start_date ASC').all();
  res.json(events);
});

app.post('/api/events', (req, res) => {
  const { type, title, start_date, end_date, author } = req.body;
  if (!type || !title || !start_date) return res.status(400).json({ error: 'Faltan datos' });

  const result = db.prepare(`
    INSERT INTO events (type, title, start_date, end_date)
    VALUES (?, ?, ?, ?)
  `).run(type, title, start_date, end_date || start_date);

  const TYPE_LABELS = { vac: 'Vacaciones', sol: 'Solicitud', otro: 'Otro' };
  sendPushToAll({
    title: 'Nuevo evento en el calendario',
    body: `${TYPE_LABELS[type] || type}: ${title} (${start_date}${end_date && end_date !== start_date ? ' → ' + end_date : ''})`,
    icon: '/icon.png',
    tag: 'evento-' + result.lastInsertRowid,
    data: { tab: 'calendario' }
  });

  res.json({ id: result.lastInsertRowid, ok: true });
});

app.delete('/api/events/:id', (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Rutas: Notas ──────────────────────────────────────────────────────────────
app.get('/api/notes', (req, res) => {
  const notes = db.prepare('SELECT * FROM notes ORDER BY pinned DESC, created_at DESC').all();
  res.json(notes);
});

app.post('/api/notes', (req, res) => {
  const { text, author, pinned } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto requerido' });

  const result = db.prepare(`
    INSERT INTO notes (text, author, pinned)
    VALUES (?, ?, ?)
  `).run(text, author || 'Anonimo', pinned ? 1 : 0);

  sendPushToAll({
    title: `Nueva nota de ${author || 'Anonimo'}`,
    body: text.length > 80 ? text.substring(0, 80) + '...' : text,
    icon: '/icon.png',
    tag: 'nota-' + result.lastInsertRowid,
    data: { tab: 'notas' }
  });

  res.json({ id: result.lastInsertRowid, ok: true });
});

app.delete('/api/notes/:id', (req, res) => {
  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Iniciar servidor ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Servidor TOGO corriendo en http://localhost:${PORT}`);
});
