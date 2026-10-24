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
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000
});
// Un fallo de la base no debe tumbar el servidor: se registra y cada ruta responde 503
pool.on('error', err => console.error('[DB] error en conexión inactiva:', err.code || err.message));
process.on('unhandledRejection', err => console.error('[ERROR] promesa sin capturar:', err && (err.code || err.message)));

// Envuelve rutas async para que sus errores lleguen al manejador de errores de Express
const seguro = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const detalleError = err => [err.code, err.message].filter(Boolean).join(' ').slice(0, 200);

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
    INSERT INTO config (key, value) VALUES ('flota_actual', '{}') ON CONFLICT (key) DO NOTHING;
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
  let rows;
  try { ({ rows } = await pool.query('SELECT * FROM sessions WHERE token=$1', [token])); }
  catch (e) { return next(e); }
  if (!rows.length) return res.status(401).json({ error: 'Sesión inválida' });
  req.user = rows[0];
  next();
}
async function requireAdmin(req, res, next) {
  await requireAuth(req, res, err => {
    if (err) return next(err);
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    next();
  });
}

// Sincronizador de la PC: sube el Excel con la clave SYNC_KEY (variable de Render), sin usuario.
// Solo sirve para cargar gastos y flota; para lo demás hace falta iniciar sesión.
function requireAdminOSync(req, res, next) {
  const clave = process.env.SYNC_KEY || '';
  const enviada = String(req.headers['x-sync-key'] || '');
  if (clave.length >= 32 && enviada.length === clave.length &&
      crypto.timingSafeEqual(Buffer.from(enviada), Buffer.from(clave))) {
    req.user = { username: 'sincronizador', role: 'admin' };
    return next();
  }
  if (enviada) return res.status(401).json({ error: 'Clave de sincronización incorrecta' });
  return requireAdmin(req, res, next);
}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); // la carga de gastos manda ~3.000 filas
// Enlace anterior a la página de gastos: ahora es la portada
app.get('/gastos.html', (req, res) => res.redirect(301, '/'));
app.use(express.static(path.join(__dirname, '../public')));

// ── AUTH ROUTES ───────────────────────────────────────────────────────────────
app.post('/api/login', seguro(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
  const hash = hashPassword(password);
  const { rows } = await pool.query('SELECT * FROM users WHERE username=$1 AND password_hash=$2', [username, hash]);
  if (!rows.length) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  const token = generateToken();
  await pool.query('INSERT INTO sessions (token, user_id, username, role) VALUES ($1,$2,$3,$4)',
    [token, rows[0].id, rows[0].username, rows[0].role]);
  res.json({ ok: true, token, username: rows[0].username, role: rows[0].role });
}));

app.post('/api/logout', seguro(async (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) await pool.query('DELETE FROM sessions WHERE token=$1', [token]);
  res.json({ ok: true });
}));

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

// ── USER MANAGEMENT (solo admin) ──────────────────────────────────────────────
app.get('/api/users', requireAdmin, seguro(async (req, res) => {
  const { rows } = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY id');
  res.json(rows);
}));

app.post('/api/users', requireAdmin, seguro(async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  const hash = hashPassword(password);
  try {
    await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1,$2,$3)',
      [username, hash, role || 'user']);
    res.json({ ok: true });
  } catch (e) {
    if (e.code !== '23505') throw e;   // 23505 = usuario repetido
    res.status(400).json({ error: 'El usuario ya existe' });
  }
}));

app.delete('/api/users/:id', requireAdmin, seguro(async (req, res) => {
  const { rows } = await pool.query('SELECT username FROM users WHERE id=$1', [req.params.id]);
  if (rows[0]?.username === 'admin') return res.status(400).json({ error: 'No puedes eliminar al admin' });
  await pool.query('DELETE FROM sessions WHERE user_id=$1', [req.params.id]);
  await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

app.put('/api/users/:id/password', requireAdmin, seguro(async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Contraseña requerida' });
  const hash = hashPassword(password);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
  res.json({ ok: true });
}));

// ══ GASTOS FLOTA API ══
// Los datos vienen del Excel DASHBOARD GASTOS TOGO (hoja Detalle). La página los
// lee y limpia en el navegador; aquí cada carga reemplaza la tabla completa.
app.get('/api/gastos', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, fecha, anio, mes, proxi, placa, tipo, descripcion, ot, doc, monto::float8 AS monto
       FROM gastos ORDER BY fecha, id`
    );
    const cfg = await pool.query("SELECT key, value FROM config WHERE key IN ('gastos_meta','flota_actual')");
    const val = k => JSON.parse(cfg.rows.find(c => c.key === k)?.value || '{}');
    res.json({ rows, meta: val('gastos_meta'), flota: val('flota_actual') });
  } catch(e) {
    next(e);
  }
});

app.post('/api/gastos/import', requireAdminOSync, async (req, res, next) => {
  const { rows, archivo } = req.body;
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'No hay filas para cargar' });
  const malas = [];
  rows.forEach((r, i) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha || '') || !Number.isFinite(r.monto)) malas.push(i + 1);
  });
  if (malas.length) return res.status(400).json({ error: `Filas con fecha o monto inválido: ${malas.slice(0, 10).join(', ')}` });

  const col = k => rows.map(r => r[k]);
  let client;
  try { client = await pool.connect(); } catch (e) { return next(e); }
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
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Flota actual: placas que están trabajando, leídas del Excel VEHICULOS PROXI en el navegador.
// Cada carga reemplaza la lista completa.
app.post('/api/flota', requireAdminOSync, seguro(async (req, res) => {
  const { placas, archivo } = req.body;
  const ok = Array.isArray(placas) && placas.length && placas.length <= 500 &&
    placas.every(p => p && typeof p.placa === 'string' && /^[A-Z0-9]{3,12}$/.test(p.placa));
  if (!ok) return res.status(400).json({ error: 'La lista de placas no es válida' });
  const flota = {
    placas: placas.map(p => ({ placa: p.placa, proxi: String(p.proxi || '').slice(0, 30), tipo: String(p.tipo || '').slice(0, 30),
                               marca: String(p.marca || '').slice(0, 30), modelo: String(p.modelo || '').slice(0, 30) })),
    archivo: String(archivo || '').slice(0, 200), por: req.user.username, fecha: new Date().toISOString()
  };
  await pool.query(`INSERT INTO config (key, value) VALUES ('flota_actual', $1)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(flota)]);
  res.json({ ok: true, placas: flota.placas.length });
}));

// Health check: también prueba la base para ver la causa sin entrar a los logs de Render
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await asegurarDB();
    res.json({ status: 'ok', db: 'ok' });
  } catch (e) {
    // 200 aunque falle la base: si Render usa /health como chequeo, no debe reiniciar el servicio por esto
    res.json({ status: 'ok', db: 'error', detalle: detalleError(e), database_url: !!process.env.DATABASE_URL });
  }
});

// Errores de la base: responder 503 con un mensaje claro en vez de caerse
app.use((err, req, res, next) => {
  console.error('[API]', req.method, req.path, detalleError(err));
  res.status(503).json({ error: 'La base de datos no responde. Intenta en unos minutos.' });
});

// Self-ping every 10 min to prevent Render free-tier sleep
const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'https://togo-equipo.onrender.com';
setInterval(() => {
  const http = require('https');
  http.get(SELF_URL + '/health', (r) => {}).on('error', () => {});
}, 10 * 60 * 1000);

// Si la base no estaba lista al arrancar, se vuelve a intentar crear las tablas más tarde
let dbLista = false;
async function asegurarDB() {
  if (dbLista) return;
  await initDB();
  dbLista = true;
  console.log('DB lista ✅');
}

app.listen(PORT, () => {
  console.log(`Servidor TOGO en http://localhost:${PORT}`);
  asegurarDB().catch(err => console.error('Error DB:', detalleError(err)));
});
