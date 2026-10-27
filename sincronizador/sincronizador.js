// Sincronizador TOGO: cada vez que se guarda el Excel de gastos o el de vehículos en esta PC,
// lee los datos (con el mismo lector que usa la página) y los sube a la web.
// Solo lee el Excel, desde una copia temporal: el archivo original nunca se modifica.
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const lector = require('../public/lector-excel.js');

const DIR = __dirname;
const LOG = path.join(DIR, 'sincronizador.log');
const ESTADO = path.join(DIR, 'estado.json');
const ESPERA_GUARDADO = 8000;      // Excel escribe en varios pasos: esperar a que termine
const REVISION_CADA = 5000;        // cada cuánto se mira si el archivo cambió
const PUERTO_UNICO = 47321;        // evita que corran dos sincronizadores a la vez

function log(msg) {
  const linea = `${new Date().toLocaleString('es-BO')}  ${msg}\n`;
  try {
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 1024 * 1024) fs.renameSync(LOG, LOG + '.anterior');
    fs.appendFileSync(LOG, linea);
  } catch (e) {}
  process.stdout.write(linea);
}

function leerJSON(file, porDefecto) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return porDefecto; }
}

const config = leerJSON(path.join(DIR, 'config.json'), null);
if (!config || !config.url || !config.clave || !config.gastos) {
  log('Falta config.json (url, clave, gastos y flota). Copia config.ejemplo.json a config.json y complétalo.');
  process.exit(1);
}
const URL_WEB = config.url.replace(/\/+$/, '');
const estado = leerJSON(ESTADO, {});
const espera = ms => new Promise(r => setTimeout(r, ms));

// Copia el Excel a una carpeta temporal y lo lee desde ahí (reintenta si Excel lo tiene ocupado)
async function leerLibro(file) {
  const copia = path.join(os.tmpdir(), `togo-sync-${process.pid}-${path.basename(file)}`);
  for (let intento = 1; ; intento++) {
    try {
      fs.copyFileSync(file, copia);
      const wb = XLSX.readFile(copia);
      return wb;
    } catch (e) {
      if (intento >= 6) throw new Error(`no se pudo leer ${path.basename(file)}: ${e.code || e.message}`);
      await espera(3000);
    } finally {
      try { fs.unlinkSync(copia); } catch (e) {}
    }
  }
}
const hojaATabla = ws => XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

const TAREAS = {
  gastos: {
    archivo: config.gastos,
    ruta: '/api/gastos/import',
    async preparar(file) {
      const wb = await leerLibro(file);
      if (!wb.Sheets['Detalle']) throw new Error('el Excel de gastos no tiene la hoja Detalle');
      const { rows, malas } = lector.limpiar(hojaATabla(wb.Sheets['Detalle']));
      if (!rows.length) throw new Error('la hoja Detalle no tiene filas de gastos válidas');
      if (malas.length) log(`  aviso: ${malas.length} filas sin fecha o monto válido no se suben (filas ${malas.slice(0, 8).map(m => m.fila).join(', ')})`);
      const total = rows.reduce((s, r) => s + r.monto, 0);
      return { datos: rows, cuerpo: { rows, archivo: `${path.basename(file)} · hoja Detalle` },
               resumen: `${rows.length} filas, Bs ${total.toFixed(2)}` };
    }
  },
  flota: {
    archivo: config.flota,
    ruta: '/api/flota',
    async preparar(file) {
      const wb = await leerLibro(file);
      const placas = lector.leerFlota(wb.SheetNames.map(n => hojaATabla(wb.Sheets[n])));
      if (!placas.length) throw new Error('no encontré placas en el Excel de vehículos');
      return { datos: placas, cuerpo: { placas, archivo: path.basename(file) }, resumen: `${placas.length} placas` };
    }
  }
};

async function enviar(ruta, cuerpo) {
  for (let intento = 1; ; intento++) {
    try {
      const r = await fetch(URL_WEB + ruta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sync-key': config.clave },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(120000)
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) return data;
      // 4xx: problema de datos o de clave, reintentar no sirve
      if (r.status < 500) throw Object.assign(new Error(data.error || `error ${r.status}`), { final: true });
      throw new Error(data.error || `error ${r.status}`);
    } catch (e) {
      // la web gratis de Render puede estar despertando: reintentar unas veces
      if (e.final || intento >= 5) throw e;
      log(`  la web no respondió (${e.message}); reintento ${intento + 1} de 5 en 30 s`);
      await espera(30000);
    }
  }
}

const enCurso = {};
async function sincronizar(tipo, motivo) {
  const t = TAREAS[tipo];
  if (!t.archivo) return;
  if (enCurso[tipo]) { enCurso[tipo] = 'otra'; return; }
  enCurso[tipo] = true;
  try {
    if (!fs.existsSync(t.archivo)) throw new Error(`no existe ${t.archivo}`);
    const { datos, cuerpo, resumen } = await t.preparar(t.archivo);
    const huella = crypto.createHash('sha256').update(JSON.stringify(datos)).digest('hex');
    if (estado[tipo] === huella) { log(`${tipo}: sin cambios (${motivo})`); return; }
    log(`${tipo}: subiendo ${resumen} (${motivo})`);
    await enviar(t.ruta, cuerpo);
    estado[tipo] = huella;
    fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 2));
    log(`${tipo}: listo, la web ya tiene ${resumen}`);
  } catch (e) {
    log(`${tipo}: ERROR ${e.message}`);
  } finally {
    const repetir = enCurso[tipo] === 'otra';
    enCurso[tipo] = false;
    if (repetir) sincronizar(tipo, 'cambió mientras se subía');
  }
}

function vigilar(tipo) {
  const file = TAREAS[tipo].archivo;
  if (!file) return;
  let temporizador = null;
  fs.watchFile(file, { interval: REVISION_CADA }, (actual, anterior) => {
    if (actual.mtimeMs === anterior.mtimeMs && actual.size === anterior.size) return;
    if (!actual.mtimeMs) return;   // Excel borra y vuelve a crear el archivo al guardar
    clearTimeout(temporizador);
    temporizador = setTimeout(() => sincronizar(tipo, 'Excel guardado'), ESPERA_GUARDADO);
  });
  log(`vigilando ${tipo}: ${file}`);
}

// Una sola copia del sincronizador a la vez
net.createServer().once('error', () => {
  log('ya hay un sincronizador corriendo; este se cierra');
  process.exit(0);
}).listen(PUERTO_UNICO, '127.0.0.1', async () => {
  log(`sincronizador iniciado → ${URL_WEB}`);
  for (const tipo of Object.keys(TAREAS)) vigilar(tipo);
  for (const tipo of Object.keys(TAREAS)) await sincronizar(tipo, 'al iniciar');
});
