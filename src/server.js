require('dotenv').config();
const express = require('express');
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
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gastos (
      id INTEGER PRIMARY KEY,
      fecha TEXT NOT NULL,
      anio INTEGER NOT NULL,
      mes INTEGER NOT NULL,
      proxi TEXT NOT NULL,
      placa TEXT NOT NULL,
      tipo TEXT NOT NULL,
      descripcion TEXT DEFAULT '',
      ot TEXT DEFAULT '',
      doc TEXT DEFAULT '',
      monto NUMERIC(14,2) NOT NULL
    );
    INSERT INTO config (key, value) VALUES ('gastos_meta', '{}') ON CONFLICT (key) DO NOTHING;
  `);

  // Crear admin por defecto si no existe
  const { rows } = await pool.query("SELECT id FROM users WHERE username='admin'");
  if (!rows.length) {
    const hash = crypto.createHash('sha256').update('togo2026').digest('hex');
    await pool.query("INSERT INTO users (username, password_hash, role) VALUES ('admin', $1, 'admin')", [hash]);
    console.log('[DB] Usuario admin creado — password: togo2026');
  }
  console.log('[DB] Tablas listas');
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
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
  if (!rows.length) return res.status(401).json({ error: 'Sesión inválida' });
  req.user = rows[0];
  next();
}
async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    next();
  });
}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); // la carga de gastos manda ~3.000 filas
// Enlace anterior a la página de gastos: ahora es la portada
app.get('/gastos.html', (req, res) => res.redirect(301, '/'));
app.use(express.static(path.join(__dirname, '../public')));

// ── AUTH ROUTES ───────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
  const hash = hashPassword(password);
  const { rows } = await pool.query('SELECT * FROM users WHERE username=$1 AND password_hash=$2', [username, hash]);
  if (!rows.length) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
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

// ── USER MANAGEMENT (solo admin) ──────────────────────────────────────────────
app.get('/api/users', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY id');
  res.json(rows);
});

app.post('/api/users', requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
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
  if (!password) return res.status(400).json({ error: 'Contraseña requerida' });
  const hash = hashPassword(password);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
  res.json({ ok: true });
});

// ══ GASTOS FLOTA API ══
// Los datos vienen del Excel DASHBOARD GASTOS TOGO (hoja Detalle). La página los
// lee y limpia en el navegador; aquí cada carga reemplaza la tabla completa.
app.get('/api/gastos', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, fecha, anio, mes, proxi, placa, tipo, descripcion, ot, doc, monto::float8 AS monto
       FROM gastos ORDER BY fecha, id`
    );
    const meta = await pool.query("SELECT value FROM config WHERE key='gastos_meta'");
    res.json({ rows, meta: JSON.parse(meta.rows[0]?.value || '{}') });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/gastos/import', requireAdmin, async (req, res) => {
  const { rows, archivo } = req.body;
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'No hay filas para cargar' });
  const malas = [];
  rows.forEach((r, i) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha || '') || !Number.isFinite(r.monto)) malas.push(i + 1);
  });
  if (malas.length) return res.status(400).json({ error: `Filas con fecha o monto inválido: ${malas.slice(0, 10).join(', ')}` });

  const col = k => rows.map(r => r[k]);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM gastos');
    await client.query(
      `INSERT INTO gastos (id, fecha, anio, mes, proxi, placa, tipo, descripcion, ot, doc, monto)
       SELECT * FROM unnest($1::int[], $2::text[], $3::int[], $4::int[], $5::text[], $6::text[],
                            $7::text[], $8::text[], $9::text[], $10::text[], $11::numeric[])`,
      [rows.map((_, i) => i + 1), col('fecha'),
       rows.map(r => +r.fecha.slice(0, 4)), rows.map(r => +r.fecha.slice(5, 7)),
       col('proxi'), col('placa'), col('tipo'),
       rows.map(r => r.descripcion || ''), rows.map(r => r.ot || ''), rows.map(r => r.doc || ''),
       col('monto')]
    );
    const meta = { archivo: archivo || '', filas: rows.length, por: req.user.username, fecha: new Date().toISOString() };
    await client.query("UPDATE config SET value=$1 WHERE key='gastos_meta'", [JSON.stringify(meta)]);
    await client.query('COMMIT');
    res.json({ ok: true, ...meta });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Self-ping every 10 min to prevent Render free-tier sleep
const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'https://togo-equipo.onrender.com';
setInterval(() => {
  const http = require('https');
  http.get(SELF_URL + '/health', (r) => {}).on('error', () => {});
}, 10 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Servidor TOGO en http://localhost:${PORT}`);
  initDB()
    .then(() => console.log('DB lista ✅'))
    .catch(err => console.error('Error DB:', err));
});
