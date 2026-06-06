require('dotenv').config();
const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
const PORT = process.env.PORT || 3000;

const adapter = new FileSync(process.env.DB_PATH || './data.json');
const db = low(adapter);
db.defaults({ events: [], notes: [], reminders: [], subscriptions: [], last_reset: '' }).write();

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

// ── Reset mensual ─────────────────────────────────────────────────────────────
function checkMonthlyReset() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const lastReset = db.get('last_reset').value();
  if (lastReset !== currentMonth) {
    db.set('events',[]).set('notes',[]).set('last_reset', currentMonth).write();
    // Los recordatorios NO se resetean (son independientes del mes)
    console.log(`[RESET] Mes ${currentMonth}`);
    sendPushToAll({ title:'🔄 Reset mensual TOGO', body:`Nuevo mes ${currentMonth}. Calendario y notas reiniciados.`, tag:'reset', data:{tab:'calendario'} });
  }
}

// ── Check recordatorios vencidos (corre cada minuto) ─────────────────────────
function checkReminders() {
  const now = Date.now();
  const reminders = db.get('reminders').value();
  reminders.forEach(r => {
    if (!r.notified && r.due_ts && now >= r.due_ts) {
      sendPushToAll({
        title: `⏰ Recordatorio vencido: ${r.title}`,
        body: r.text || 'El plazo de este recordatorio ha llegado.',
        icon: '/icon.png',
        tag: 'reminder-' + r.id,
        data: { tab: 'recordatorios' }
      });
      db.get('reminders').find({ id: r.id }).assign({ notified: true }).write();
      console.log(`[REMINDER] Notificado: ${r.title}`);
    }
  });
}

setInterval(checkReminders, 60 * 1000); // cada minuto

// ── VAPID ─────────────────────────────────────────────────────────────────────
app.get('/api/vapid-public-key', (req, res) => res.json({ key: process.env.VAPID_PUBLIC_KEY }));

// ── Suscripciones ─────────────────────────────────────────────────────────────
app.post('/api/subscribe', (req, res) => {
  const { subscription, userName } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalida' });
  const ex = db.get('subscriptions').find({ endpoint: subscription.endpoint }).value();
  if (ex) { db.get('subscriptions').find({ endpoint: subscription.endpoint }).assign({ user_name: userName }).write(); }
  else { db.get('subscriptions').push({ endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, user_name: userName||'Anonimo' }).write(); }
  res.json({ ok: true });
});
app.delete('/api/subscribe', (req, res) => {
  db.get('subscriptions').remove({ endpoint: req.body.endpoint }).write();
  res.json({ ok: true });
});

// ── Eventos ───────────────────────────────────────────────────────────────────
app.get('/api/events', (req, res) => { checkMonthlyReset(); res.json(db.get('events').sortBy('start_date').value()); });
app.post('/api/events', (req, res) => {
  checkMonthlyReset();
  const { type, title, start_date, end_date } = req.body;
  if (!type||!title||!start_date) return res.status(400).json({ error: 'Faltan datos' });
  const id = Date.now();
  db.get('events').push({ id, type, title, start_date, end_date: end_date||start_date }).write();
  sendPushToAll({ title:'Nuevo evento en el calendario', body:`${title} (${start_date})`, tag:'evento-'+id, data:{tab:'calendario'} });
  res.json({ id, ok: true });
});
app.delete('/api/events/:id', (req, res) => { db.get('events').remove({ id: parseInt(req.params.id) }).write(); res.json({ ok: true }); });

// ── Notas ─────────────────────────────────────────────────────────────────────
app.get('/api/notes', (req, res) => {
  checkMonthlyReset();
  const notes = db.get('notes').value();
  res.json([...notes.filter(n=>n.pinned), ...notes.filter(n=>!n.pinned).reverse()]);
});
app.post('/api/notes', (req, res) => {
  checkMonthlyReset();
  const { text, author, pinned, priority } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto requerido' });
  const id = Date.now();
  const now = new Date();
  const created_at = now.toISOString().slice(0,16).replace('T',' ');
  db.get('notes').push({ id, text, author:author||'Anonimo', pinned:!!pinned, priority:priority||'normal', created_at, created_ts:now.getTime() }).write();
  const PRIO = { normal:'Normal', importante:'Importante', urgente:'🚨 URGENTE' };
  sendPushToAll({ title:`Nueva nota ${PRIO[priority]||''} de ${author||'Anonimo'}`, body:text.slice(0,80), tag:'nota-'+id, data:{tab:'notas'} });
  res.json({ id, ok: true });
});
app.delete('/api/notes/:id', (req, res) => { db.get('notes').remove({ id: parseInt(req.params.id) }).write(); res.json({ ok: true }); });

// ── Recordatorios ─────────────────────────────────────────────────────────────
app.get('/api/reminders', (req, res) => {
  res.json(db.get('reminders').sortBy('due_ts').value());
});
app.post('/api/reminders', (req, res) => {
  const { title, text, author, due_date } = req.body;
  if (!title||!due_date) return res.status(400).json({ error: 'Faltan datos' });
  const id = Date.now();
  const now = new Date();
  const created_at = now.toISOString().slice(0,16).replace('T',' ');
  // due_ts: fin del día de la fecha límite
  const dueDate = new Date(due_date + 'T23:59:59');
  const due_ts = dueDate.getTime();
  db.get('reminders').push({ id, title, text:text||'', author:author||'Anonimo', due_date, due_ts, created_at, notified: due_ts <= Date.now() }).write();
  // Notificar al equipo que se creó
  sendPushToAll({ title:`📌 Nuevo recordatorio: ${title}`, body:`Vence el ${due_date}${text?' — '+text.slice(0,60):''}`, tag:'reminder-new-'+id, data:{tab:'recordatorios'} });
  res.json({ id, ok: true });
});
app.delete('/api/reminders/:id', (req, res) => { db.get('reminders').remove({ id: parseInt(req.params.id) }).write(); res.json({ ok: true }); });

// ── Info ──────────────────────────────────────────────────────────────────────
app.get('/api/info', (req, res) => { checkMonthlyReset(); res.json({ last_reset: db.get('last_reset').value() }); });

// ── Test push (para pruebas) ──────────────────────────────────────────────────
app.post('/api/test-push', (req, res) => {
  const { message } = req.body;
  sendPushToAll({ title:'🔔 Prueba TOGO', body: message || 'Notificación de prueba — sistema funcionando.', tag:'test-push', data:{tab:'notas'} });
  res.json({ ok: true, sent_to: db.get('subscriptions').value().length });
});

app.listen(PORT, () => {
  checkMonthlyReset();
  checkReminders();
  console.log(`Servidor TOGO corriendo en http://localhost:${PORT}`);
});
