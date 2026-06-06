require('dotenv').config();
const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ── PostgreSQL ────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id BIGINT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      created_month TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notes (
      id BIGINT PRIMARY KEY,
      text TEXT NOT NULL,
      author TEXT DEFAULT 'Anonimo',
      pinned BOOLEAN DEFAULT false,
      priority TEXT DEFAULT 'normal',
      created_at TEXT NOT NULL,
      created_ts BIGINT NOT NULL,
      created_month TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id BIGINT PRIMARY KEY,
      title TEXT NOT NULL,
      text TEXT DEFAULT '',
      author TEXT DEFAULT 'Anonimo',
      due_date TEXT NOT NULL,
      due_ts BIGINT NOT NULL,
      created_at TEXT NOT NULL,
      notified BOOLEAN DEFAULT false
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      endpoint TEXT PRIMARY KEY,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_name TEXT DEFAULT 'Anonimo',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT INTO config (key, value) VALUES ('last_reset', '')
    ON CONFLICT (key) DO NOTHING;
  `);
  console.log('[DB] Tablas listas');
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

async function sendPushToAll(payload) {
  const { rows } = await pool.query('SELECT * FROM subscriptions');
  rows.forEach(async (row) => {
    const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await pool.query('DELETE FROM subscriptions WHERE endpoint=$1', [row.endpoint]);
      }
    }
  });
}

// ── Reset mensual ─────────────────────────────────────────────────────────────
async function checkMonthlyReset() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const { rows } = await pool.query("SELECT value FROM config WHERE key='last_reset'");
  const lastReset = rows[0]?.value || '';
  if (lastReset !== currentMonth) {
    await pool.query('DELETE FROM events');
    await pool.query('DELETE FROM notes');
    await pool.query("UPDATE config SET value=$1 WHERE key='last_reset'", [currentMonth]);
    console.log(`[RESET] Mes ${currentMonth}`);
    sendPushToAll({ title:'🔄 Reset mensual TOGO', body:`Nuevo mes. Calendario y notas reiniciados.`, tag:'reset', data:{tab:'calendario'} });
  }
}

// ── Check recordatorios vencidos ──────────────────────────────────────────────
async function checkReminders() {
  const now = Date.now();
  const { rows } = await pool.query('SELECT * FROM reminders WHERE notified=false AND due_ts<=$1', [now]);
  for (const r of rows) {
    await sendPushToAll({ title:`⏰ Recordatorio vencido: ${r.title}`, body: r.text||'El plazo ha llegado.', tag:'reminder-'+r.id, data:{tab:'recordatorios'} });
    await pool.query('UPDATE reminders SET notified=true WHERE id=$1', [r.id]);
  }
}
setInterval(checkReminders, 60000);

// ── VAPID ─────────────────────────────────────────────────────────────────────
app.get('/api/vapid-public-key', (req, res) => res.json({ key: process.env.VAPID_PUBLIC_KEY }));

// ── Suscripciones ─────────────────────────────────────────────────────────────
app.post('/api/subscribe', async (req, res) => {
  const { subscription, userName } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalida' });
  await pool.query(`INSERT INTO subscriptions (endpoint,p256dh,auth,user_name) VALUES($1,$2,$3,$4)
    ON CONFLICT(endpoint) DO UPDATE SET user_name=$4`,
    [subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, userName||'Anonimo']);
  res.json({ ok: true });
});
app.delete('/api/subscribe', async (req, res) => {
  await pool.query('DELETE FROM subscriptions WHERE endpoint=$1', [req.body.endpoint]);
  res.json({ ok: true });
});

// ── Eventos ───────────────────────────────────────────────────────────────────
app.get('/api/events', async (req, res) => {
  await checkMonthlyReset();
  const { rows } = await pool.query('SELECT * FROM events ORDER BY start_date ASC');
  res.json(rows);
});
app.post('/api/events', async (req, res) => {
  await checkMonthlyReset();
  const { type, title, start_date, end_date } = req.body;
  if (!type||!title||!start_date) return res.status(400).json({ error: 'Faltan datos' });
  const id = Date.now();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  await pool.query('INSERT INTO events (id,type,title,start_date,end_date,created_month) VALUES($1,$2,$3,$4,$5,$6)',
    [id, type, title, start_date, end_date||start_date, month]);
  const LABELS = { vac:'Vacaciones', sol:'Solicitud', otro:'Otro' };
  sendPushToAll({ title:'Nuevo evento en el calendario', body:`${LABELS[type]||type}: ${title} (${start_date})`, tag:'evento-'+id, data:{tab:'calendario'} });
  res.json({ id, ok: true });
});
app.delete('/api/events/:id', async (req, res) => {
  await pool.query('DELETE FROM events WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ── Notas ─────────────────────────────────────────────────────────────────────
app.get('/api/notes', async (req, res) => {
  await checkMonthlyReset();
  const { rows } = await pool.query('SELECT * FROM notes ORDER BY pinned DESC, created_ts DESC');
  res.json(rows);
});
app.post('/api/notes', async (req, res) => {
  await checkMonthlyReset();
  const { text, author, pinned, priority } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto requerido' });
  const id = Date.now();
  const now = new Date();
  const created_at = now.toISOString().slice(0,16).replace('T',' ');
  const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  await pool.query('INSERT INTO notes (id,text,author,pinned,priority,created_at,created_ts,created_month) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, text, author||'Anonimo', !!pinned, priority||'normal', created_at, id, month]);
  const PL = { normal:'Normal', importante:'Importante', urgente:'🚨 URGENTE' };
  sendPushToAll({ title:`Nueva nota ${PL[priority]||''} de ${author||'Anonimo'}`, body:text.slice(0,80), tag:'nota-'+id, data:{tab:'notas'} });
  res.json({ id, ok: true });
});
app.delete('/api/notes/:id', async (req, res) => {
  await pool.query('DELETE FROM notes WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ── Recordatorios ─────────────────────────────────────────────────────────────
app.get('/api/reminders', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM reminders ORDER BY due_ts ASC');
  res.json(rows);
});
app.post('/api/reminders', async (req, res) => {
  const { title, text, author, due_date } = req.body;
  if (!title||!due_date) return res.status(400).json({ error: 'Faltan datos' });
  const id = Date.now();
  const now = new Date();
  const created_at = now.toISOString().slice(0,16).replace('T',' ');
  const due_ts = new Date(due_date + 'T23:59:59').getTime();
  await pool.query('INSERT INTO reminders (id,title,text,author,due_date,due_ts,created_at,notified) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, title, text||'', author||'Anonimo', due_date, due_ts, created_at, due_ts<=Date.now()]);
  sendPushToAll({ title:`📌 Nuevo recordatorio: ${title}`, body:`Vence el ${due_date}`, tag:'reminder-new-'+id, data:{tab:'recordatorios'} });
  res.json({ id, ok: true });
});
app.delete('/api/reminders/:id', async (req, res) => {
  await pool.query('DELETE FROM reminders WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ── Info ──────────────────────────────────────────────────────────────────────
app.get('/api/info', async (req, res) => {
  await checkMonthlyReset();
  const { rows } = await pool.query("SELECT value FROM config WHERE key='last_reset'");
  res.json({ last_reset: rows[0]?.value || '' });
});

// ── Test push ─────────────────────────────────────────────────────────────────
app.post('/api/test-push', async (req, res) => {
  const { message } = req.body;
  await sendPushToAll({ title:'🔔 Prueba TOGO', body: message||'Notificación de prueba.', tag:'test-push', data:{tab:'notas'} });
  const { rows } = await pool.query('SELECT COUNT(*) FROM subscriptions');
  res.json({ ok: true, sent_to: parseInt(rows[0].count) });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  await initDB();
  await checkMonthlyReset();
  checkReminders();
  console.log(`Servidor TOGO en http://localhost:${PORT}`);
});
