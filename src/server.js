require('dotenv').config();
const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Base de datos JSON (lowdb) ─────────────────────────────────────────────────
const adapter = new FileSync(process.env.DB_PATH || './data.json');
const db = low(adapter);
db.defaults({ events: [], notes: [], subscriptions: [] }).write();

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
  const subs = db.get('subscriptions').value();
  subs.forEach(async (row) => {
    const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.get('subscriptions').remove({ endpoint: row.endpoint }).write();
      }
    }
  });
}

// ── VAPID public key ──────────────────────────────────────────────────────────
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

// ── Suscripciones ─────────────────────────────────────────────────────────────
app.post('/api/subscribe', (req, res) => {
  const { subscription, userName } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Suscripcion invalida' });
  const existing = db.get('subscriptions').find({ endpoint: subscription.endpoint }).value();
  if (existing) {
    db.get('subscriptions').find({ endpoint: subscription.endpoint }).assign({ user_name: userName }).write();
  } else {
    db.get('subscriptions').push({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_name: userName || 'Anonimo'
    }).write();
  }
  res.json({ ok: true });
});

app.delete('/api/subscribe', (req, res) => {
  db.get('subscriptions').remove({ endpoint: req.body.endpoint }).write();
  res.json({ ok: true });
});

// ── Eventos ───────────────────────────────────────────────────────────────────
app.get('/api/events', (req, res) => {
  res.json(db.get('events').sortBy('start_date').value());
});

app.post('/api/events', (req, res) => {
  const { type, title, start_date, end_date } = req.body;
  if (!type || !title || !start_date) return res.status(400).json({ error: 'Faltan datos' });
  const id = Date.now();
  db.get('events').push({ id, type, title, start_date, end_date: end_date || start_date }).write();
  const TYPE_LABELS = { vac: 'Vacaciones', sol: 'Solicitud', otro: 'Otro' };
  sendPushToAll({
    title: 'Nuevo evento en el calendario',
    body: `${TYPE_LABELS[type] || type}: ${title} (${start_date}${end_date && end_date !== start_date ? ' → ' + end_date : ''})`,
    icon: '/icon.png', tag: 'evento-' + id, data: { tab: 'calendario' }
  });
  res.json({ id, ok: true });
});

app.delete('/api/events/:id', (req, res) => {
  db.get('events').remove({ id: parseInt(req.params.id) }).write();
  res.json({ ok: true });
});

// ── Notas ─────────────────────────────────────────────────────────────────────
app.get('/api/notes', (req, res) => {
  const notes = db.get('notes').value();
  const sorted = [...notes.filter(n=>n.pinned), ...notes.filter(n=>!n.pinned).reverse()];
  res.json(sorted);
});

app.post('/api/notes', (req, res) => {
  const { text, author, pinned } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto requerido' });
  const id = Date.now();
  const now = new Date();
  const created_at = now.toISOString().slice(0,16).replace('T',' ');
  db.get('notes').push({ id, text, author: author || 'Anonimo', pinned: !!pinned, created_at }).write();
  sendPushToAll({
    title: `Nueva nota de ${author || 'Anonimo'}`,
    body: text.length > 80 ? text.substring(0, 80) + '...' : text,
    icon: '/icon.png', tag: 'nota-' + id, data: { tab: 'notas' }
  });
  res.json({ id, ok: true });
});

app.delete('/api/notes/:id', (req, res) => {
  db.get('notes').remove({ id: parseInt(req.params.id) }).write();
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Servidor TOGO corriendo en http://localhost:${PORT}`));
