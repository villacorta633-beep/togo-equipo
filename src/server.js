require('dotenv').config();
const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS events (
      id BIGINT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL,
      created_month TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notes (
      id BIGINT PRIMARY KEY, text TEXT NOT NULL, author TEXT DEFAULT 'Anonimo',
      pinned BOOLEAN DEFAULT false, priority TEXT DEFAULT 'normal',
      created_at TEXT NOT NULL, created_ts BIGINT NOT NULL, created_month TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id BIGINT PRIMARY KEY, title TEXT NOT NULL, text TEXT DEFAULT '',
      author TEXT DEFAULT 'Anonimo', due_date TEXT NOT NULL,
      due_ts BIGINT NOT NULL, created_at TEXT NOT NULL, notified BOOLEAN DEFAULT false
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
      user_name TEXT DEFAULT 'Anonimo', created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    );
    INSERT INTO config (key, value) VALUES ('last_reset', '') ON CONFLICT (key) DO NOTHING;

    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGINT PRIMARY KEY,
      author TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agenda_items (
      id BIGINT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      date TEXT NOT NULL,
      time TEXT,
      type TEXT DEFAULT 'reunion',
      author TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checklist_registros (
      id BIGINT PRIMARY KEY,
      driver TEXT NOT NULL,
      fecha TEXT NOT NULL,
      evaluador TEXT DEFAULT '',
      turno TEXT DEFAULT '',
      total NUMERIC(4,2),
      uni NUMERIC(4,2),
      img NUMERIC(4,2),
      equ NUMERIC(4,2),
      veh NUMERIC(4,2),
      detalles JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE checklist_registros ADD COLUMN IF NOT EXISTS evaluador TEXT DEFAULT '';
    ALTER TABLE checklist_registros ADD COLUMN IF NOT EXISTS turno TEXT DEFAULT '';
    ALTER TABLE checklist_registros ADD COLUMN IF NOT EXISTS hora TEXT DEFAULT '';
  `);

  // Crear admin por defecto si no existe
  const { rows } = await pool.query("SELECT id FROM users WHERE username='admin'");
  if (!rows.length) {
    const hash = crypto.createHash('sha256').update('togo2026').digest('hex');
    await pool.query("INSERT INTO users (username, password_hash, role) VALUES ('admin', $1, 'admin')", [hash]);
    console.log('[DB] Usuario admin creado â password: togo2026');
  }
  console.log('[DB] Tablas listas');
}

// ââ Auth helpers ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function hashPassword(pass) {
  return crypto.createHash('sha256').update(pass).digest('hex');
}
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}
async function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  const { rows } = await pool.query('SELECT * FROM sessions WHERE token=$1', [token]);
  if (!rows.length) return res.status(401).json({ error: 'SesiÃ³n invÃ¡lida' });
  req.user = rows[0];
  next();
}
async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    next();
  });
}

// ââ Web Push ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
    try { await webpush.sendNotification(sub, JSON.stringify(payload)); }
    catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404)
        await pool.query('DELETE FROM subscriptions WHERE endpoint=$1', [row.endpoint]);
    }
  });
}

async function checkMonthlyReset() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const { rows } = await pool.query("SELECT value FROM config WHERE key='last_reset'");
  const lastReset = rows[0]?.value || '';
  if (lastReset !== currentMonth) {
    await pool.query('DELETE FROM events');
    await pool.query('DELETE FROM notes');
    await pool.query("UPDATE config SET value=$1 WHERE key='last_reset'", [currentMonth]);
    sendPushToAll({ title:'ð Reset mensual TOGO', body:`Nuevo mes ${currentMonth}.`, tag:'reset', data:{tab:'calendario'} });
  }
}

async function checkReminders() {
  const now = Date.now();
  const { rows } = await pool.query('SELECT * FROM reminders WHERE notified=false AND due_ts<=$1', [now]);
  for (const r of rows) {
    await sendPushToAll({ title:`â° Recordatorio vencido: ${r.title}`, body: r.text||'El plazo llegÃ³.', tag:'reminder-'+r.id, data:{tab:'recordatorios'} });
    await pool.query('UPDATE reminders SET notified=true WHERE id=$1', [r.id]);
  }
}
setInterval(checkReminders, 60000);

// ââ AUTH ROUTES âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
  const hash = hashPassword(password);
  const { rows } = await pool.query('SELECT * FROM users WHERE username=$1 AND password_hash=$2', [username, hash]);
  if (!rows.length) return res.status(401).json({ error: 'Usuario o contraseÃ±a incorrectos' });
  const token = generateToken();
  await pool.query('INSERT INTO sessions (token, user_id, username, role) VALUES ($1,$2,$3,$4)',
    [token, rows[0].id, rows[0].username, rows[0].role]);
  res.json({ ok: true, token, username: rows[0].username, role: rows[0].role });
});

app.post('/api/logout', async (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) await pool.query('DELETE FROM sessions WHERE token=$1', [token]);
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

// ââ USER MANAGEMENT (solo admin) ââââââââââââââââââââââââââââââââââââââââââââââ
app.get('/api/users', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY id');
  res.json(rows);
});

app.post('/api/users', requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseÃ±a requeridos' });
  const hash = hashPassword(password);
  try {
    await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1,$2,$3)',
      [username, hash, role || 'user']);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'El usuario ya existe' });
  }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT username FROM users WHERE id=$1', [req.params.id]);
  if (rows[0]?.username === 'admin') return res.status(400).json({ error: 'No puedes eliminar al admin' });
  await pool.query('DELETE FROM sessions WHERE user_id=$1', [req.params.id]);
  await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

app.put('/api/users/:id/password', requireAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'ContraseÃ±a requerida' });
  const hash = hashPassword(password);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
  res.json({ ok: true });
});

// ââ VAPID âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
app.get('/api/vapid-public-key', (req, res) => res.json({ key: process.env.VAPID_PUBLIC_KEY }));

// ââ Suscripciones âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
app.post('/api/subscribe', requireAuth, async (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalida' });
  await pool.query(`INSERT INTO subscriptions (endpoint,p256dh,auth,user_name) VALUES($1,$2,$3,$4)
    ON CONFLICT(endpoint) DO UPDATE SET user_name=$4`,
    [subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, req.user.username]);
  res.json({ ok: true });
});
app.delete('/api/subscribe', async (req, res) => {
  await pool.query('DELETE FROM subscriptions WHERE endpoint=$1', [req.body.endpoint]);
  res.json({ ok: true });
});

// ââ Eventos âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
app.get('/api/events', requireAuth, async (req, res) => {
  await checkMonthlyReset();
  const { rows } = await pool.query('SELECT * FROM events ORDER BY start_date ASC');
  res.json(rows);
});
app.post('/api/events', requireAuth, async (req, res) => {
  await checkMonthlyReset();
  const { type, title, start_date, end_date } = req.body;
  if (!type||!title||!start_date) return res.status(400).json({ error: 'Faltan datos' });
  const id = Date.now();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  await pool.query('INSERT INTO events (id,type,title,start_date,end_date,created_month) VALUES($1,$2,$3,$4,$5,$6)',
    [id, type, title, start_date, end_date||start_date, month]);
  const LABELS = { vac:'Vacaciones', sol:'Solicitud', otro:'Otro' };
  sendPushToAll({ title:'ð Nuevo evento', body:`${LABELS[type]||type}: ${title} (${start_date})`, tag:'evento-'+id, data:{tab:'calendario'} });
  res.json({ id, ok: true });
});
app.delete('/api/events/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM events WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ââ Notas âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
app.get('/api/notes', requireAuth, async (req, res) => {
  await checkMonthlyReset();
  const { rows } = await pool.query('SELECT * FROM notes ORDER BY pinned DESC, created_ts DESC');
  res.json(rows);
});
app.post('/api/notes', requireAuth, async (req, res) => {
  await checkMonthlyReset();
  const { text, pinned, priority } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto requerido' });
  const id = Date.now();
  const now = new Date();
  const created_at = now.toISOString().slice(0,16).replace('T',' ');
  const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const author = req.user.username;
  await pool.query('INSERT INTO notes (id,text,author,pinned,priority,created_at,created_ts,created_month) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, text, author, !!pinned, priority||'normal', created_at, id, month]);
  const PL = { normal:'Normal', importante:'Importante', urgente:'ð¨ URGENTE' };
  sendPushToAll({ title:`ð Nueva nota ${PL[priority]||''} de ${author}`, body:text.slice(0,80), tag:'nota-'+id, data:{tab:'notas'} });
  res.json({ id, ok: true });
});
app.delete('/api/notes/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM notes WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ââ Recordatorios âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
app.get('/api/reminders', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM reminders ORDER BY due_ts ASC');
  res.json(rows);
});
app.post('/api/reminders', requireAuth, async (req, res) => {
  const { title, text, due_date } = req.body;
  if (!title||!due_date) return res.status(400).json({ error: 'Faltan datos' });
  const id = Date.now();
  const now = new Date();
  const created_at = now.toISOString().slice(0,16).replace('T',' ');
  const due_ts = new Date(due_date + 'T23:59:59').getTime();
  const author = req.user.username;
  await pool.query('INSERT INTO reminders (id,title,text,author,due_date,due_ts,created_at,notified) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, title, text||'', author, due_date, due_ts, created_at, due_ts<=Date.now()]);
  sendPushToAll({ title:`ð Recordatorio: ${title}`, body:`Vence el ${due_date}`, tag:'reminder-new-'+id, data:{tab:'recordatorios'} });
  res.json({ id, ok: true });
});
app.delete('/api/reminders/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM reminders WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ââ Info & Test âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
app.get('/api/info', requireAuth, async (req, res) => {
  await checkMonthlyReset();
  const { rows } = await pool.query("SELECT value FROM config WHERE key='last_reset'");
  res.json({ last_reset: rows[0]?.value || '' });
});
app.post('/api/test-push', requireAuth, async (req, res) => {
  await sendPushToAll({ title:'ð Prueba TOGO', body:`Test de ${req.user.username}`, tag:'test-push', data:{tab:'notas'} });
  const { rows } = await pool.query('SELECT COUNT(*) FROM subscriptions');
  res.json({ ok: true, sent_to: parseInt(rows[0].count) });
});

// ââ Chat ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
app.get('/api/chat', requireAuth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before;
  let q = 'SELECT * FROM chat_messages';
  let params = [];
  if (before) { q += ' WHERE id < $1'; params.push(before); }
  q += ' ORDER BY id DESC LIMIT $' + (params.length + 1);
  params.push(limit);
  const { rows } = await pool.query(q, params);
  res.json(rows.reverse());
});

app.post('/api/chat', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Texto requerido' });
  const id = Date.now();
  const now = new Date();
  const created_at = now.toISOString();
  await pool.query(
    'INSERT INTO chat_messages (id, author, text, created_at) VALUES ($1,$2,$3,$4)',
    [id, req.user.username, text.trim(), created_at]
  );
  // Push a todos
  sendPushToAll({
    title: `ð¬ ${req.user.username}`,
    body: text.trim().slice(0, 80),
    tag: 'chat-' + id,
    data: { tab: 'chat' }
  });
  res.json({ id, ok: true });
});

app.delete('/api/chat/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM chat_messages WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ââ Agenda ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
app.get('/api/agenda', requireAuth, async (req, res) => {
  const date = req.query.date; // YYYY-MM-DD
  let q = 'SELECT * FROM agenda_items';
  let params = [];
  if (date) { q += ' WHERE date=$1'; params.push(date); }
  q += ' ORDER BY date ASC, time ASC';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

app.post('/api/agenda', requireAuth, async (req, res) => {
  const { title, description, date, time, type } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'TÃ­tulo y fecha requeridos' });
  const id = Date.now();
  const now = new Date();
  const created_at = now.toISOString().slice(0,16).replace('T',' ');
  await pool.query(
    'INSERT INTO agenda_items (id, title, description, date, time, type, author, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, title, description||'', date, time||null, type||'reunion', req.user.username, created_at]
  );
  sendPushToAll({
    title: `ð Nueva agenda: ${title}`,
    body: `${date}${time ? ' Â· ' + time : ''} â ${req.user.username}`,
    tag: 'agenda-' + id,
    data: { tab: 'agenda' }
  });
  res.json({ id, ok: true });
});

app.delete('/api/agenda/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM agenda_items WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});


// ── Presencia en tiempo real (SSE) ───────────────────────────────────────────
const presenceClients = new Map();

function broadcastPresence() {
  const users = Array.from(presenceClients.values()).map(c => ({ user: c.user, since: c.since }));
  const data = 'data: ' + JSON.stringify(users) + '\n\n';
  for (const [id, client] of presenceClients) {
    try { client.res.write(data); } catch(e) { presenceClients.delete(id); }
  }
}

app.get('/presence/stream', (req, res) => {
  const user = req.query.user || 'Anónimo';
  const id = Date.now() + '-' + Math.random().toString(36).slice(2);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  presenceClients.set(id, { res, user, since: Date.now() });
  broadcastPresence();
  const hb = setInterval(() => {
    try { res.write(': hb\n\n'); } catch(e) { clearInterval(hb); presenceClients.delete(id); broadcastPresence(); }
  }, 25000);
  req.on('close', () => {
    clearInterval(hb);
    presenceClients.delete(id);
    broadcastPresence();
  });
});


// ══ CHECKLIST API ══
app.get('/api/checklist', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM checklist_registros ORDER BY fecha DESC, created_at DESC LIMIT 500'
    );
    res.json(rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/checklist', async (req, res) => {
  try {
    const { id, driver, fecha, evaluador, turno, hora, total, uni, img, equ, veh, detalles } = req.body;
    await pool.query(
      `INSERT INTO checklist_registros (id, driver, fecha, evaluador, turno, hora, total, uni, img, equ, veh, detalles)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         driver=EXCLUDED.driver, fecha=EXCLUDED.fecha, evaluador=EXCLUDED.evaluador,
         turno=EXCLUDED.turno, hora=EXCLUDED.hora, total=EXCLUDED.total,
         uni=EXCLUDED.uni, img=EXCLUDED.img, equ=EXCLUDED.equ, veh=EXCLUDED.veh,
         detalles=EXCLUDED.detalles`,
      [id, driver, fecha, evaluador||'', turno||'', hora||'', total, uni||null, img||null, equ||null, veh||null, JSON.stringify(detalles||{})]
    );
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/checklist/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM checklist_registros WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, async () => {
  await initDB();
  await checkMonthlyReset();
  checkReminders();
  console.log(`Servidor TOGO en http://localhost:${PORT}`);
});
