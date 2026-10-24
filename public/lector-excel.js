// Lectura del Excel de gastos (hoja Detalle) y de la lista de vehículos (flota actual).
// La usan la página (navegador) y el sincronizador de la PC (Node), así los dos leen igual.
// Solo lee los datos: el Excel original nunca se modifica.
(function (root) {
  const PROXIS = ['ISUTO','ESCUADRON'];

  const HEADERS = {
    fecha: ['FECHA', 'FECHADELGASTO'], proxi: ['PROXI', 'PROXY'], placa: ['PLACA'],
    tipo: ['TIPO', 'TIPOGASTO', 'TIPODEGASTO'], descripcion: ['DESCRIPCION'], ot: ['OT', 'OTOS'],
    doc: ['DOC', 'FACTRECIBO', 'FACTURA', 'RECIBO'], monto: ['MONTO', 'MONTOGASTADO']
  };
  const normH = h => String(h ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const first = text.slice(0, text.indexOf('\n') + 1 || text.length);
    const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const out = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); out.push(row); }
    return out;
  }

  const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  function parseFecha(v) {
    if (v instanceof Date && !isNaN(v)) return ymd(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number' && v > 20000 && v < 80000) {   // número de serie de Excel
      const d = new Date(Math.round((v - 25569) * 864e5));
      return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    const s = String(v ?? '').trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return ymd(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (m) return ymd(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
    return null;
  }
  // Montos de texto: si hay coma, la coma es decimal y el punto es de miles
  // ("1.234,50"); si no hay coma, el punto es decimal ("32.95").
  function parseMonto(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
    let s = String(v ?? '').replace(/bs\.?/i, '').replace(/\s/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  const valido = (f) => { if (!f) return false; const [y, m, d] = f.split('-').map(Number); return y > 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31; };

  function limpiar(table) {
    let hi = -1, idx = {};
    for (let i = 0; i < Math.min(15, table.length); i++) {
      const hs = table[i].map(normH);
      const found = {};
      for (const [k, alias] of Object.entries(HEADERS)) { const j = hs.findIndex(h => alias.includes(h)); if (j >= 0) found[k] = j; }
      if (found.fecha != null && found.monto != null) { hi = i; idx = found; break; }
    }
    if (hi < 0) throw new Error('No encontré las columnas de fecha y monto. ¿Es la hoja Detalle del Excel de gastos?');
    const faltan = Object.keys(HEADERS).filter(k => idx[k] == null);
    const rows = [], malas = [];
    table.slice(hi + 1).forEach((raw, i) => {
      const get = k => idx[k] == null ? '' : raw[idx[k]];
      const fRaw = get('fecha'), mRaw = get('monto');
      if (String(fRaw ?? '').trim() === '' && String(mRaw ?? '').trim() === '') return;   // fila vacía
      const fecha = parseFecha(fRaw), monto = parseMonto(mRaw);
      if (!valido(fecha) || monto == null) { malas.push({ fila: hi + i + 2, fecha: fRaw, monto: mRaw }); return; }
      const pl = String(get('placa') ?? '').toUpperCase().replace(/[\s-]/g, '');
      const placa = !pl || pl === 'SINPLACA' ? 'SIN PLACA' : pl;
      const p = String(get('proxi') ?? '').trim().toUpperCase();
      const tipo = String(get('tipo') ?? '').trim().toUpperCase() || 'SIN CLASIFICAR';
      const txt = k => String(get(k) ?? '').trim();
      rows.push({ fecha, monto, placa, proxi: PROXIS.includes(p) ? p : 'SIN PROXY', tipo,
                  descripcion: txt('descripcion'), ot: txt('ot'), doc: txt('doc') });
    });
    return { rows, malas, faltan };
  }

  // Lista de vehículos (Excel VEHICULOS PROXI): puede tener varios bloques lado a lado,
  // uno por proxy, cada uno con su columna PLACA. El proxy sale de la columna PROXI
  // o, si no hay, del título que está encima del bloque.
  const normPlaca = p => String(p ?? '').toUpperCase().replace(/[\s-]/g, '');
  const normProxi = p => { const s = normH(p); return s.startsWith('ISUTO') ? 'ISUTO' : s.startsWith('ESCUADR') ? 'ESCUADRON' : String(p ?? '').trim().toUpperCase(); };
  function leerFlota(tablas) {
    const vistas = new Map();
    for (const t of tablas) {
      for (let hi = 0; hi < Math.min(10, t.length); hi++) {
        const hs = t[hi].map(normH);
        const cols = hs.map((h, c) => h === 'PLACA' ? c : -1).filter(c => c >= 0);
        cols.forEach((c, k) => {
          const fin = k + 1 < cols.length ? cols[k + 1] : hs.length;
          const col = alias => { for (let j = c + 1; j < fin; j++) if (alias.includes(hs[j])) return j; return -1; };
          const cP = col(['PROXI', 'PROXY']), cT = col(['TIPO', 'VEHICULO']), cMa = col(['MARCA']), cMo = col(['MODELO']);
          const titulo = hi > 0 ? t[hi - 1][c] : '';
          for (let r = hi + 1; r < t.length; r++) {
            const placa = normPlaca(t[r][c]);
            if (!placa) break;
            if (!/^[A-Z0-9]{5,10}$/.test(placa) || vistas.has(placa)) continue;
            const v = j => j >= 0 ? String(t[r][j] ?? '').trim() : '';
            vistas.set(placa, { placa, proxi: normProxi(v(cP) || titulo), tipo: v(cT).toUpperCase(), marca: v(cMa), modelo: v(cMo) });
          }
        });
      }
    }
    return [...vistas.values()];
  }

  const lector = { PROXIS, HEADERS, normH, parseCSV, parseFecha, parseMonto, limpiar, normPlaca, normProxi, leerFlota };
  if (typeof module !== 'undefined' && module.exports) module.exports = lector;
  else Object.assign(root, lector);
})(typeof window !== 'undefined' ? window : globalThis);
