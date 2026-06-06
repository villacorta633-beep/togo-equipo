require('dotenv').config();
const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Base de datos JSON ────────────────────────────────────────────────────────
const adapter = new FileSync(process.env.DB_PATH || './data.json');
const db = low(adapter);
db.defaults({ events: [], notes: [], subscriptions: [], last_reset: '' }).write();

// ── Reset mensual automático ──────────────────────────────────────────────────
function checkMonthlyReset() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastReset = db.get('last_reset').value();
  if (lastReset !== currentMonth) {
    db.set('events', []).set('notes', []).set('last_reset', currentMonth).write();
    console.log(`[RESET] Data limpiada para el mes ${currentMonth}`);
    // Notificar al equipo
    sendPushToAll({
      title: '🔄 Reset mensual TOGO',
      body: `Inicio de nuevo mes (${currentMonth}). Calendario y notas reiniciados.`,
      icon: '/icon.png', tag: 'reset-mensual', data: { tab: 'calendario' }
    });
  }
}

// ── Web Push ──────────────────────────────────────────────────────────────────
webpush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'admin@togo.bo'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

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

// ── VAPID ─────────────────────────────────────────────────────────────────────
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

// ── Suscripciones ─────────────────────────────────────────────────────────────
app.post('/api/subscribe', (req, res) => {
  const { subscription, userName } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalida' });
  const existing = db.get('subscriptions').find({ endpoint: subscription.endpoint }).value();
  if (existing) {
    db.get('subscriptions').find({ endpoint: subscription.endpoint }).assign({ user_name: userName }).write();
  } else {
    db.get('subscriptions').push({ endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, user_name: userName || 'Anonimo' }).write();
  }
  res.json({ ok: true });
});

app.delete('/api/subscribe', (req, res) => {
  db.get('subscriptions').remove({ endpoint: req.body.endpoint }).write();
  res.json({ ok: true });
});

// ── Eventos ───────────────────────────────────────────────────────────────────
app.get('/api/events', (req, res) => {
  checkMonthlyReset();
  res.json(db.get('events').sortBy('start_date').value());
});

app.post('/api/events', (req, res) => {
  checkMonthlyReset();
  const { type, title, start_date, end_date } = req.body;
  if (!type || !title || !start_date) return res.status(400).json({ error: 'Faltan datos' });
  const id = Date.now();
  db.get('events').push({ id, type, title, start_date, end_date: end_date || start_date }).write();
  const TYPE_LABELS = { vac: 'Vacaciones', sol: 'Solicitud', otro: 'Otro' };
  sendPushToAll({
    title: 'Nuevo evento en el calendario',
    body: `${TYPE_LABELS[type] || type}: ${title} (${start_date})`,
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
  checkMonthlyReset();
  const notes = db.get('notes').value();
  const sorted = [...notes.filter(n => n.pinned), ...notes.filter(n => !n.pinned).reverse()];
  res.json(sorted);
});

app.post('/api/notes', (req, res) => {
  checkMonthlyReset();
  const { text, author, pinned, priority } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto requerido' });
  const id = Date.now();
  const now = new Date();
  const created_at = now.toISOString().slice(0, 16).replace('T', ' ');
  const created_ts = now.getTime();
  const prio = priority || 'normal';
  db.get('notes').push({ id, text, author: author || 'Anonimo', pinned: !!pinned, priority: prio, created_at, created_ts }).write();

  const PRIO_LABELS = { normal: 'Normal', importante: 'Importante', urgente: '🚨 URGENTE' };
  sendPushToAll({
    title: `Nueva nota ${PRIO_LABELS[prio]} de ${author || 'Anonimo'}`,
    body: text.length > 80 ? text.substring(0, 80) + '...' : text,
    icon: '/icon.png', tag: 'nota-' + id, data: { tab: 'notas' }
  });
  res.json({ id, ok: true });
});

app.delete('/api/notes/:id', (req, res) => {
  db.get('notes').remove({ id: parseInt(req.params.id) }).write();
  res.json({ ok: true });
});

// ── Info del sistema ──────────────────────────────────────────────────────────
app.get('/api/info', (req, res) => {
  checkMonthlyReset();
  res.json({ last_reset: db.get('last_reset').value() });
});

app.listen(PORT, () => {
  checkMonthlyReset();
  console.log(`Servidor TOGO corriendo en http://localhost:${PORT}`);
});
