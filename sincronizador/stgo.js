// Trae los gastos que los drivers cargan en STGO (base de solo lectura) y agrega al Detalle del
// Excel los que todavía no están. Escribe con el propio Excel (agregar-filas.ps1), así se
// conservan fórmulas, slicers y tablas dinámicas. Al guardarse el Excel, el sincronizador lo
// sube a la web como siempre.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const DIR = __dirname;
const ESTADO = path.join(DIR, 'stgo-estado.json');
const RESPALDOS = path.join(DIR, 'respaldos');
const CADA = 60 * 60 * 1000;   // STGO copia sus datos cada hora

// Tipo de STGO -> Tipo gasto del Detalle
const TIPOS = {
  GASOLINA: 'GASOLINA', GAS: 'GNV', ACEITE: 'PREVENTIVO', MANT_PREV: 'PREVENTIVO',
  MANT_CORR: 'CORRECTIVO', REPUESTOS: 'REPUESTOS', PARCHADO: 'OTROS GASTOS', OTROS: 'OTROS GASTOS'
};



const coma = n => String(n).replace('.', ',');
const leerJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };

// Convierte un gasto STGO en una fila del Detalle
function aFila(g) {
  const [placa, clase = ''] = String(g.vehiculo || '').split('·').map(s => s.trim());
  const veh = `${clase.toUpperCase()} ${placa}`.trim();
  const partes = [];
  if (g.tipo === 'GASOLINA') partes.push(`CARGA DE GASOLINA${g.litros ? ` ${coma(g.litros)} LT` : ''}`);
  else if (g.tipo === 'GAS') partes.push('CARGA DE GNV');
  else {
    const extra = [g.tipo_otro, g.detalle].filter(Boolean).join(', ');
    partes.push(`${g.tipo_nombre || g.tipo}${extra ? ': ' + extra : ''}`);
  }
  if (g.proveedor) partes.push(g.proveedor);
  partes.push(veh);
  if (g.driver_nombre) partes.push(`DRIVER ${g.driver_nombre}`);
  return {
    stgo: g.id,
    fecha: g.f,
    placa,
    tipo: TIPOS[g.tipo] || 'SIN CLASIFICAR',
    desc: (partes.join(' - ') + ' (STGO)').toUpperCase().replace(/\s+/g, ' '),
    doc: g.nro_factura ? String(g.nro_factura).trim() : null,
    km: g.km != null ? Number(g.km) : null,
    prox: null,
    monto: Number(g.monto)
  };
}

// ¿Ya está en el Detalle? La regla es la misma que usa la web para avisar repetidos
// (lector-excel.js): mismo monto y mismo N° de factura, o misma placa / SIN PLACA con fecha cercana.
// Los drivers a veces cargan días después o con otra placa que la proforma.
const { buscarIgual: buscarEnDetalle } = require('../public/lector-excel.js');

function excelAbierto(file) {
  const dir = path.dirname(file), base = path.basename(file);
  if (fs.existsSync(path.join(dir, '~$' + base)) || fs.existsSync(path.join(dir, '~$' + base.slice(2)))) return true;
  try { fs.closeSync(fs.openSync(file, 'r+')); return false; } catch (e) { return e.code === 'EBUSY' || e.code === 'EPERM'; }
}

function respaldar(file, log) {
  fs.mkdirSync(RESPALDOS, { recursive: true });
  const sello = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  fs.copyFileSync(file, path.join(RESPALDOS, `antes-stgo-${sello}.xlsx`));
  const viejos = fs.readdirSync(RESPALDOS).filter(f => f.startsWith('antes-stgo-')).sort().slice(0, -10);
  for (const f of viejos) try { fs.unlinkSync(path.join(RESPALDOS, f)); } catch (e) {}
  log(`  stgo: respaldo guardado en ${RESPALDOS}`);
}

function agregarConExcel(file, filas) {
  const json = path.join(os.tmpdir(), `togo-stgo-${process.pid}.json`);
  fs.writeFileSync(json, JSON.stringify(filas));
  return new Promise((ok, mal) => {
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(DIR, 'agregar-filas.ps1'),
      '-Archivo', file, '-FilasJson', json], { timeout: 5 * 60 * 1000, windowsHide: true }, (err, stdout, stderr) => {
      try { fs.unlinkSync(json); } catch (e) {}
      const salida = String(stdout || '').trim();
      if (err || /^ERROR/m.test(salida)) return mal(new Error((salida.match(/ERROR.*/s) || [stderr || err.message])[0].trim()));
      ok(salida);
    });
  });
}

async function leerSTGO(url) {
  const { Client } = require('pg');
  // El pooler de Supabase presenta una cadena de certificados propia
  const c = new Client({ connectionString: url.replace(/\?.*$/, ''), ssl: { rejectUnauthorized: false },
                         statement_timeout: 25000, connectionTimeoutMillis: 20000 });
  await c.connect();
  try {
    const { rows } = await c.query(`
      select id, to_char(fecha, 'YYYY-MM-DD') f, tipo, tipo_nombre, tipo_otro, detalle, monto, litros, km,
             proveedor, nro_factura, vehiculo, driver_nombre, estado
        from public.stgo_gastos
       where estado in ('registrado', 'aprobado') and monto > 0
       order by fecha, creado_at`);
    return rows;
  } finally { await c.end().catch(() => {}); }
}

// Una pasada: baja STGO, compara con el Detalle y agrega lo nuevo.
// probar=true no toca el Excel: solo dice qué haría.
async function pasada({ config, log, leerDetalle, probar = false, archivo = config.gastos }) {
  const estado = leerJSON(ESTADO, { ids: {} });
  const gastos = await leerSTGO(config.stgo);
  const nuevos = gastos.filter(g => !estado.ids[g.id]);
  if (!nuevos.length) { log(`stgo: sin gastos nuevos (${gastos.length} en STGO)`); return { agregadas: [] }; }

  const detalle = await leerDetalle(archivo);
  const agregar = [], yaEstaban = [];
  for (const g of nuevos) {
    const fila = aFila(g);
    if (!fila.placa || !(fila.monto > 0)) { log(`  stgo: se salta ${g.id}, sin placa o monto`); continue; }
    const d = buscarEnDetalle(fila, detalle);
    if (d) {
      yaEstaban.push(g.id);
      if (d.placa !== fila.placa) log(`  stgo: ${fila.fecha} Bs ${fila.monto} doc ${fila.doc || '-'} ya está en el Detalle con placa ${d.placa}; en STGO dice ${fila.placa}`);
    } else agregar.push(fila);
  }
  log(`stgo: ${nuevos.length} gastos nuevos en STGO: ${yaEstaban.length} ya estaban en el Detalle, ${agregar.length} por agregar`);
  if (probar) return { agregadas: agregar, yaEstaban };

  if (agregar.length) {
    if (excelAbierto(archivo)) { log('stgo: el Excel está abierto; se agrega en la próxima pasada (cada hora)'); return { agregadas: [] }; }
    respaldar(archivo, log);
    const salida = await agregarConExcel(archivo, agregar);
    log(`stgo: agregadas ${agregar.length} filas al Detalle, Bs ${agregar.reduce((s, f) => s + f.monto, 0).toFixed(2)}`);
    for (const l of salida.split(/\r?\n/).filter(Boolean)) log('  ' + l);
  }
  const hoy = new Date().toISOString().slice(0, 10);
  for (const id of yaEstaban) estado.ids[id] = `ya estaba ${hoy}`;
  for (const f of agregar) estado.ids[f.stgo] = `agregado ${hoy}`;
  fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 1));
  return { agregadas: agregar, yaEstaban };
}

function iniciar(opciones) {
  const { config, log } = opciones;
  if (!config.stgo) { log('stgo: sin conexión configurada (falta "stgo" en config.json); no se traen gastos de STGO'); return; }
  let corriendo = false;
  const correr = async () => {
    if (corriendo) return;
    corriendo = true;
    try { await pasada(opciones); } catch (e) { log(`stgo: ERROR ${e.message}`); } finally { corriendo = false; }
  };
  log('stgo: se revisan los gastos de STGO cada hora');
  setTimeout(correr, 60 * 1000);
  setInterval(correr, CADA);
}

module.exports = { iniciar, pasada, aFila, buscarEnDetalle };
