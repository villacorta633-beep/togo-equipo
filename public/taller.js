// ══ TALLER ══════════════════════════════════════════════════════════════════
// Lee los gastos de mantenimiento de cada vehículo como lo haría un mecánico:
// a qué sistema fue cada gasto, qué piezas se repiten antes de tiempo, si los
// cambios de aceite van al día, y de ahí arma el informe y los consejos.
// Todo se recalcula cada vez que se cargan los gastos: al subir datos nuevos,
// los consejos cambian solos. Lo usan el tablero, el informe y la vista 3D.
(function (global) {
'use strict';

const norm = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const MANT = ['PREVENTIVO', 'CORRECTIVO', 'REPUESTOS'];

// ── Piezas: cada gasto va a las piezas que nombra su descripción ─────────────
// Si nombra varias, el monto se reparte en partes iguales entre ellas.
const PARTES = [
  { id: 'carroceria', nombre: 'Carrocería', incluye: 'puertas, parrilla, parador, asiento, tanque, soldaduras',
    re: /PUERTA|PARRILLA|PARILLA|CHAPA(?! DE ENCENDIDO)|SOLDADUR|SOLDAR|LATERAL|PARADOR|\bPATA\b|CARROCER|PINTURA|PARACHOQUE|GUARDABARRO|GUARDAFANGO|ASIENTO|VIDRIO|PARABRISA|PLUMILLA|TANQUE|CAJON|MALETERO/ },
  { id: 'mandos', nombre: 'Mandos y cables', incluye: 'chicotillos, acelerador, palancas, puños, espejos',
    re: /CHICOTILLO|ACELERADOR|ACELERACI|PALANCA|PUNO|\bCABLES?\b|MANILLAR|MANUBRIO|ESPEJO|PEDAL|VOLANTE(?! (DE )?INERCIA)/ },
  { id: 'electrico', nombre: 'Sistema eléctrico', incluye: 'focos, faroles, batería, bobina, arranque, aire acondicionado',
    re: /FOCO|\bFOTOS?\b|FAROL|BATERIA|BOBINA|ALTERNADOR|ARRANQUE|BENDIX|\bSTOP\b|SENSOR|ELECTRIC|REGULADOR(?! DE BALANCIN)|HALOGENO|\bLUC|\bLUZ\b|CORRIENTE|(?<!BUJIAS? DE? ?)ENCENDIDO|FUSIBLE|BOCINA|DESTILADA|AIRE ACONDICIONADO|INTERMITENTE|DIRECCIONAL|GUINADOR|TABLERO|VELOCIMETRO|\bCDI\b|\bRELAY\b/ },
  { id: 'motor', nombre: 'Motor y aceite', incluye: 'aceite, arandela y tapón, filtros, carburador, bujías, culata, distribución',
    re: /(?<!BOBINAS? DE )MOTOR|ACEITE|ACIETE|ARANDELA(?!S? PARA SOPORTE)|TAPON|FILTRO|CULATA|BALANCIN|(?<!TRANSMISION O )DISTRIBUCI|CORREA|VALVULA|CIGUENAL|CARBURA|BUJIA|INYECTOR|EMPAQUETADURA|CARTER|(?<!C.)O-?RING|ANILLO|EMBOLO|PISTON|RECTIFICAD(?!O DE (TAMBOR|DISCO|CORRIENTE))|CADENILLA|INERCIA|PICOS(?! DE LLANTA)|REFRIGERANTE|COMBUSTIBLE|RADIADOR|ESCAPE|SILENCIADOR/ },
  { id: 'transmision', nombre: 'Transmisión', incluye: 'kit de transmisión, cadena, piñón, corona, embrague, caja',
    re: /TRANSMISI|TRANSIMICI|TRASMISI|EMBRAGUE|EMRAGUE|\bCADENA\b|PINON|CORONA|\bCAJA\b|SELECTOR|NEUTRO|TE?N?SADOR DE CADENA|CARDAN|DIFERENCIAL|PALIER|SEMIEJE|CRUCETA|ARRASTRE|ROSETA/ },
  { id: 'suspension', nombre: 'Suspensión y dirección', incluye: 'telescopios, amortiguadores, bujes, dirección, muelles',
    re: /TELESCOPIO|TEELESCOPIO|AMORTIGUA|\bBUJES?\b(?! DE ROSETA)|SUSPENSI|HIDR(AU|UA)LIC|DIRECCION\b|ROTULA|TERMINAL|MUELLE|BALLESTA|ESPIRAL|ESTABILIZ|HORQUILLA|BASCULANTE/ },
  { id: 'frenos', nombre: 'Frenos', incluye: 'pastillas, balatas, discos, zapatas',
    re: /FRENO|BALATA|BALTA|PASTILLA|POASTILLA|\bDISCOS?\b(?! DE EMB?RAGUE)|ZAPATA|TAMBOR/ },
  { id: 'ruedas', nombre: 'Llantas y ruedas', incluye: 'llantas, cámaras, parchados, rodamientos, rotación',
    re: /LLANTA|CAMARA|PARCHAD|RUEDA|RODAMIENTOS?(?! (DE )?(CORREA|DIRECCION))|\bAROS?\b|\bRINES?\b|ROTACION|ALINEA|BALANCEO|NEUMATICO|RINALDI|MAC?S?ERO/ },
];
PARTES.forEach((p, i) => p.orden = i);
const GENERAL = { id: 'general', nombre: 'Servicio general', incluye: 'mantenimientos y mano de obra que no nombran una pieza' };
const PARTE = Object.fromEntries([...PARTES, GENERAL].map(p => [p.id, p]));

// Errores de escritura encontrados en el Excel: se corrigen antes de clasificar
// y se avisa en cada gasto qué palabra hay que arreglar en el Excel.
const CORRECCIONES = [
  [/\bACIETE\b/, 'ACEITE'], [/\bARA?NA?DELA(S?)\b/, 'ARANDELA$1'], [/\bASI?PI?RADO\b/, 'ASPIRADO'],
  [/\bBALTA(S?)\b/, 'BALATA$1'], [/\bBARRILLA\b/, 'VARILLA'], [/\bBLOK\b/, 'BLOCK'],
  [/\bCARBURADR\b/, 'CARBURADOR'], [/\bCARYY\b/, 'CARRY'], [/\bCOMR[PR]A\b/, 'COMPRA'],
  [/\bDESMONTAGE\b/, 'DESMONTAJE'], [/MONTAGUE\b/, 'MONTAJE'], [/\bEMB?REAGU[ER]\b|\bEMRAGUE\b/, 'EMBRAGUE'],
  [/\bFOTO\b/, 'FOCO'], [/\bHIDRUALIC/, 'HIDRAULIC'], [/\bLIUMPIEZA\b/, 'LIMPIEZA'],
  [/\bMANTENIEMIENTO\b/, 'MANTENIMIENTO'], [/MANTENIMIENTO PREVENTIVA\b/, 'MANTENIMIENTO PREVENTIVO'],
  [/\bPACHADO\b/, 'PARCHADO'], [/\bPARRILA(S?)\b|\bPARILLA(S?)\b/, 'PARRILLA$1$2'], [/\bPOASTILLA(S?)\b/, 'PASTILLA$1'],
  [/\bREEEMPLAZO\b/, 'REEMPLAZO'], [/\bREVICION\b/, 'REVISION'], [/\bSUSPENCION\b/, 'SUSPENSION'],
  [/\bTEELESCOPIO(S?)\b/, 'TELESCOPIO$1'], [/\bTRABAJAO?\b|\bTRABJAO\b/, 'TRABAJO'],
  [/\bTRANSIMICION\b|\bTRANSMICION\b|\bTRASN?MISION\b/, 'TRANSMISION'], [/\bVALANCINES\b/, 'BALANCINES'],
  [/\bM OTO\b/, 'MOTO'], [/\bACENTADO\b/, 'ASENTADO'], [/\bTESADOR\b/, 'TENSADOR'], [/\bCORRECCION ER\b/, 'CORRECCION DE'],
];
function corregir(desc) {
  let d = norm(desc); const errores = [];
  CORRECCIONES.forEach(([re, ok]) => {
    d = d.replace(new RegExp(re.source, 'g'), (m, ...g) => {
      const bien = ok.replace(/\$(\d)/g, (_, i) => g[i - 1] || '');
      if (m !== bien && !errores.some(e => e[0] === m)) errores.push([m, bien]);
      return bien;
    });
  });
  return { d, errores };
}
function clasificar(d) {
  const ids = PARTES.filter(p => p.re.test(d)).map(p => p.id);
  return ids.length ? ids : ['general'];
}

// ── Vehículos ────────────────────────────────────────────────────────────────
// La flota de TOGO: furgones Suzuki APV (en los Excel a veces figuran como "Carry"),
// una RAM 700 modificada a furgón (5264PUB) y motos Honda CB160.
const PLACAS_RAM = new Set(['5264PUB']);
const ETIQUETA = { moto: 'Honda CB160 Hornet', apv: 'Suzuki APV', ram: 'RAM 700 · furgón modificado' };
// f: la fila de la flota actual de esa placa (tipo, marca, modelo), si la hay
function tipoVehiculo(placa, descs, f) {
  if (PLACAS_RAM.has(placa)) return 'furgon';
  const t = f ? norm(`${f.tipo} ${f.marca} ${f.modelo}`) : '';
  if (/MOTO|CB ?1|HONDA|YAMAHA|BAJAJ/.test(t)) return 'moto';
  if (/CARRY|APV|FURG|CAMION|VAN\b|RAM\b|SUZUKI|CAMIONETA|AUTO/.test(t)) return 'furgon';
  let m = 0, c = 0;
  descs.forEach(d => { d = norm(d); if (/\bMOTOS?\b|MOTOCICLETA|CB ?160/.test(d)) m++; if (/CARRY|FURGON|\bAPV\b|\bRAM\b|CAMION/.test(d)) c++; });
  return m > c ? 'moto' : 'furgon';
}
function modeloVehiculo(placa, tipo, descs, f) {
  if (tipo === 'moto') return 'moto';
  const t = norm(`${f ? f.marca + ' ' + f.modelo : ''} ${descs.join(' ')}`);
  return PLACAS_RAM.has(placa) || /\bRAM\b|RAPID/.test(t) ? 'ram' : 'apv';
}

// ── Lo que un mecánico espera de cada pieza ──────────────────────────────────
// vida: meses que suele durar en una moto / un furgón de reparto.
// causa: qué suele haber detrás cuando se cambia antes de tiempo.
const CAUSAS = {
  desgaste:      { nombre: 'Desgaste por uso', color: '#5b8def', orden: 5 },
  maluso:        { nombre: 'Posible mal uso', color: '#e5484d', orden: 1 },
  mantenimiento: { nombre: 'Falta de mantenimiento', color: '#f5a623', orden: 2 },
  reparacion:    { nombre: 'Reparación que no duró', color: '#b07cf0', orden: 3 },
  condiciones:   { nombre: 'Condiciones de ruta', color: '#3fb68b', orden: 4 },
  externo:       { nombre: 'Daño externo', color: '#d55181', orden: 0 },
  datos:         { nombre: 'Dato a revisar', color: '#8a8a8a', orden: 6 },
};
const COMPONENTES = [
  { id: 'embrague', nombre: 'Embrague', vida: { moto: 12, furgon: 30 }, causa: 'maluso',
    re: /EMBRAGUE|COLLARIN|PRENSA DE EMBRAGUE/,
    porque: 'Un embrague que dura poco suele venir de manejar con el embrague a medio pisar, arrancar con mucha carga o forzarlo en subidas.',
    consejo: 'Hablar con el conductor sobre el uso del embrague (no apoyar el pie, no arrancar en segunda, no sobrecargar).' },
  { id: 'kit', nombre: 'Kit de transmisión (cadena, piñón y corona)', vida: { moto: 8 }, causa: 'mantenimiento', solo: 'moto',
    re: /KIT DE TRANSMISION|KIT TRANSMISION|TRANSMISION COMPLETA|TRANSMISION REFORZADA|\bCADENA\b(?! ?DE DISTRIB)|\bPINON\b|\bCORONA\b/,
    excluye: /(CORTAD|CORTE|TENSAD|TASAD|LUBRIC|AJUSTE|ENGRAS)[^,;]{0,15}CADENA/,
    porque: 'La cadena se gasta antes cuando no se tensa ni se lubrica a tiempo; los arranques bruscos también la estiran.',
    consejo: 'Tensar y lubricar la cadena en cada cambio de aceite y evitar arrancones.' },
  // Delantero (pastillas de disco) y trasero (balatas o zapatas de tambor) se gastan por separado
  { id: 'frenos', nombre: 'Pastillas de freno', vida: { moto: 4, furgon: 10 }, causa: 'maluso',
    re: /PASTILLA/,
    porque: 'Frenos que se acaban rápido suelen indicar frenadas fuertes y tardías o ir con sobrecarga.',
    consejo: 'Recordar al conductor frenar con anticipación y no sobrecargar el vehículo.' },
  { id: 'balatas', nombre: 'Balatas o zapatas de freno', vida: { moto: 5, furgon: 14 }, causa: 'maluso',
    re: /BALATA|ZAPATA/,
    porque: 'Frenos que se acaban rápido suelen indicar frenadas fuertes y tardías o ir con sobrecarga.',
    consejo: 'Recordar al conductor frenar con anticipación y no sobrecargar el vehículo.' },
  { id: 'caja', nombre: 'Caja y chicotillo de cambios', vida: { moto: 18, furgon: 24 }, causa: 'maluso',
    re: /CHICOTILLO (DE )?(LA )?(CAJA|SELECTOR|CAMBIO)|SELECTOR DE (CAJA|CAMBIO)|CAJA MECANICA|CAJA DE CAMBIO|PALANCA DE CAMBIO/,
    porque: 'Cuando la caja o su chicotillo fallan seguido, lo común es que se estén forzando los cambios (meter cambio sin pisar bien el embrague).',
    consejo: 'Revisar con el conductor la forma de hacer los cambios y pedir al taller que revise el varillaje.' },
  { id: 'suspension', nombre: 'Suspensión y dirección', vida: { moto: 12, furgon: 18 }, causa: 'maluso',
    re: /TELESCOPIO|AMORTIGUA|MUELLE|BALLESTA|\bBUJES?\b(?! DE ROSETA)|ROTULA|TERMINAL(ES)? DE DIRECCION|HORQUILLA/,
    porque: 'La suspensión se rompe antes con sobrecarga o al pasar rompemuelles y baches a velocidad.',
    consejo: 'No exceder la carga del vehículo y bajar la velocidad en baches y rompemuelles.' },
  { id: 'llantas', nombre: 'Llantas nuevas', vida: { moto: 8, furgon: 18 }, causa: 'condiciones',
    re: /(COMPRA|CAMBIO|PROVISION)[^,;]{0,30}LLANTAS?(?! (PINCHADA|DELANTERA PINCHADA))|LLANTAS? (NUEVA|RINALDI|MAXIRUBBER|TRIANGLE|\d{3})|^LLANTA/,
    excluye: /PARCHAD|VULCANIZ|ROTACION|MANO DE OBRA|ARMADO/,
    porque: 'Las llantas se gastan antes con presión baja, frenadas fuertes, sobrecarga o calles en mal estado.',
    consejo: 'Controlar la presión de las llantas cada semana y revisar la alineación.' },
  { id: 'bateria', nombre: 'Batería', vida: { moto: 18, furgon: 24 }, causa: 'reparacion',
    re: /BATERIA(?! (CARGADA|RECARGA))/, excluye: /AGUA DESTILADA|CARGA DE BATERIA/,
    porque: 'Si la batería se cambia seguido, casi siempre el problema está en el sistema de carga (regulador o alternador) o en dejar luces encendidas.',
    consejo: 'Pedir al taller que mida el sistema de carga antes de comprar otra batería.' },
  { id: 'arranque', nombre: 'Arranque', vida: { moto: 18, furgon: 24 }, causa: 'reparacion',
    re: /BENDIX|MOTOR DE ARRANQUE|AUTOMATICO DE ARRANQUE|CARBONES/,
    porque: 'Un arranque que falla seguido puede ser una reparación mal hecha o un repuesto de baja calidad.',
    consejo: 'Pedir garantía al taller y preferir repuestos de mejor calidad.' },
  { id: 'carburador', nombre: 'Carburador', vida: { moto: 12, furgon: 18 }, causa: 'mantenimiento',
    re: /CARBURA/,
    porque: 'El carburador se ensucia antes cuando no se cambian los filtros a tiempo o el combustible viene sucio.',
    consejo: 'Cambiar el filtro de aire y de combustible en cada mantenimiento.' },
  { id: 'motor', nombre: 'Reparación mayor de motor', vida: { moto: 18, furgon: 48 }, causa: 'desgaste',
    re: /RECTIFIC(?!ADO DE (TAMBOR|DISCO))|\bBLOCK\b|CULATA|PISTON|ANILLAS?\b|BIELA|REPARACION (DE|DEL) MOTOR|DESMONTAJE DE MOTOR|MANT\.? (CORRECTIVO )?MOTOR|MOTOR FUNDIDO|AJUSTE DE MOTOR|OVERHAUL|BAJAD[OA] DE MOTOR|MOTOR CORRECTIVO|CORRECCION DE MOTOR/,
    porque: 'Una reparación de motor repetida apunta a que la causa de fondo no se resolvió (recalentamiento, falta de aceite o refrigerante).',
    consejo: 'Revisar niveles de aceite y refrigerante cada semana.' },
];
const RE_ACEITE = /CAMBIO DE ACEITE|ACEITE (DE )?MOTOR|ACEITE \d+W|MANTENIMIENTO PREVENTIVO/;
const COMBUSTIBLE = ['GASOLINA', 'GNV'];
const esAceite = r => !COMBUSTIBLE.includes(r.tipo) && (r.tipo === 'PREVENTIVO' || RE_ACEITE.test(r.d));
const RE_PINCHAZO = /PARCHAD|VULCANIZ|PINCHAD/;
const RE_EXTERNO = /CHOQUE|GOLPE|ACCIDENT|\bCAIDA\b|SE CAYO|ENDEREZ|ABOLLAD|ROBAD|\bROBO\b/;
const RE_AGUA = /AGUA AL MOTOR|ENTRAR AGUA|ENTRO AGUA|INUNDA|LLUVIA/;
// Cada cuántos días se espera un cambio de aceite si la placa no tiene historial suficiente
const ACEITE_DIAS = { moto: 35, furgon: 100 };

// ── Fechas ───────────────────────────────────────────────────────────────────
const dia = f => Math.round(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10)) / 864e5);
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = d => { const x = new Date(d * 864e5); return `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}/${x.getUTCFullYear()}`; };
const mesAnio = d => { const x = new Date(d * 864e5); return `${MES[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
const meses = dias => dias / 30.44;
const fmt0 = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 });
const bs = v => 'Bs ' + fmt0.format(v);
const plural = (n, uno, varios) => `${fmt0.format(n)} ${n === 1 ? uno : varios}`;
const mediana = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Gastos del mismo arreglo (mano de obra + repuestos, o varias facturas) caen en días cercanos:
// se juntan en un solo "evento" si están a menos de `junta` días del primero.
function eventos(filas, junta = 21) {
  const ev = [];
  filas.forEach(r => {
    const u = ev[ev.length - 1];
    if (u && r.dia - u.dia <= junta) { u.filas.push(r); u.monto += r.monto; }
    else ev.push({ dia: r.dia, monto: r.monto, filas: [r] });
  });
  return ev;
}

// ── Preparar: gastos del servidor → vehículos con sus gastos ya clasificados ─
// rows: filas de /api/gastos; flota: lista de placas de la flota actual (puede venir vacía)
function preparar(rows, flota = []) {
  const F = new Map((flota || []).map(p => [p.placa, p]));
  const todas = rows.filter(r => r.placa && r.placa !== 'SIN PLACA').map(r => {
    const { d, errores } = corregir(r.descripcion);
    return { ...r, d, errores, dia: dia(r.fecha), mant: MANT.includes(r.tipo), partes: MANT.includes(r.tipo) ? clasificar(d) : [] };
  }).sort((a, b) => a.dia - b.dia || a.id - b.id);
  const ref = todas.reduce((m, r) => Math.max(m, r.dia), 0);   // último día con datos
  const por = new Map();
  todas.forEach(r => { if (!por.has(r.placa)) por.set(r.placa, []); por.get(r.placa).push(r); });
  const veh = new Map();
  por.forEach((rs, placa) => {
    const descs = rs.filter(r => r.mant).map(r => r.descripcion);
    const f = F.get(placa);
    const tipo = tipoVehiculo(placa, descs, f);
    const modelo = modeloVehiculo(placa, tipo, descs, f);
    const proxi = f?.proxi || rs[rs.length - 1].proxi || '';
    veh.set(placa, { placa, tipo, modelo, etiqueta: ETIQUETA[modelo], proxi, enFlota: F.has(placa), filas: rs,
      mant: rs.filter(r => r.mant), primero: rs[0].dia, ultimo: rs[rs.length - 1].dia });
  });

  // ¿Los cambios de aceite de ese mes están registrados? Si en un mes casi ningún vehículo
  // del mismo tipo tiene cambio de aceite, lo más probable es que falten datos, no que nadie
  // lo haya hecho: en esos meses no se acusa a nadie de descuido.
  const cob = { moto: {}, furgon: {} };
  todas.forEach(r => {
    const t = veh.get(r.placa).tipo, k = r.fecha.slice(0, 7);
    const c = cob[t][k] ??= { activos: new Set(), aceite: new Set() };
    c.activos.add(r.placa);
    if (esAceite(r)) c.aceite.add(r.placa);
  });
  const completo = (tipo, d) => {
    const x = new Date(d * 864e5), k = `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
    const c = cob[tipo][k];
    // un cambio cada ACEITE_DIAS: en un mes normal lo registra al menos la mitad de lo esperado
    return !!c && c.activos.size >= 2 && c.aceite.size / c.activos.size >= 0.5 * Math.min(1, 30.44 / ACEITE_DIAS[tipo]);
  };
  // Parte de los días entre a y b que caen en meses con registros completos
  const parteCompleta = (tipo, a, b) => {
    if (b <= a) return 1;
    let ok = 0, n = 0;
    for (let d = a; d < b; d += 5) { n++; if (completo(tipo, d)) ok++; }
    return ok / n;
  };
  return { veh, ref, enFlota: F.size ? new Set(F.keys()) : null, completo, parteCompleta };
}

// Gasto de mantenimiento por mes de cada vehículo del mismo tipo, para comparar
function referencia(ctx, tipo, desde, hasta) {
  const tasas = [];
  ctx.veh.forEach(v => {
    if (v.tipo !== tipo) return;
    const a = Math.max(desde, v.primero), b = Math.min(hasta, v.ultimo);
    const m = meses(b - a);
    if (m < 3) return;   // poco tiempo: no sirve para comparar
    const t = v.mant.reduce((s, r) => s + (r.dia >= a && r.dia <= b ? r.monto : 0), 0);
    tasas.push(t / m);
  });
  return { mediana: mediana(tasas), n: tasas.length };
}

// ── Cambios de aceite: cada cuánto se hacen y si ya toca ────────────────────
function aceite(v, ref) {
  const ev = eventos(v.filas.filter(r => r.dia <= ref && esAceite(r)), 7);
  const gaps = ev.slice(1).map((e, i) => e.dia - ev[i].dia).filter(g => g >= 7);
  const propio = mediana(gaps.slice(-8));
  const cada = Math.round(gaps.length >= 3 ? Math.min(Math.max(propio, 20), 200) : ACEITE_DIAS[v.tipo]);
  const ult = ev[ev.length - 1];
  const dias = ult ? ref - ult.dia : null;
  return { eventos: ev, cada, ultimo: ult ? ult.dia : null, dias, vencido: ult ? dias > cada * 1.25 : false,
           atraso: ult ? dias / cada : 0, desdeHistorial: gaps.length >= 3 };
}

// ── Informe de una placa ─────────────────────────────────────────────────────
// opciones: desde/hasta en días (por defecto todo el historial)
function informe(ctx, placa, { desde = -Infinity, hasta = Infinity } = {}) {
  const v = ctx.veh.get(placa);
  if (!v) return null;
  const enRango = r => r.dia >= desde && r.dia <= hasta;
  const filas = v.filas.filter(enRango);
  const mant = filas.filter(r => r.mant);
  const ini = Math.max(desde, v.primero), fin = Math.min(hasta, v.ultimo, ctx.ref);
  const m = Math.max(meses(fin - ini), 1);
  const total = mant.reduce((s, r) => s + r.monto, 0);
  const combustible = filas.filter(r => r.tipo === 'GASOLINA' || r.tipo === 'GNV').reduce((s, r) => s + r.monto, 0);
  const otros = filas.filter(r => !r.mant && r.tipo !== 'GASOLINA' && r.tipo !== 'GNV').reduce((s, r) => s + r.monto, 0);
  const comp = referencia(ctx, v.tipo, ini, fin);
  const porMes = total / m;
  const ratio = comp.mediana ? porMes / comp.mediana : 0;

  // Gasto por sistema (el monto se reparte entre las piezas que nombra)
  const sis = {};
  mant.forEach(r => r.partes.forEach(p => { const s = sis[p] ??= { id: p, nombre: PARTE[p].nombre, monto: 0, n: 0 }; s.monto += r.monto / r.partes.length; s.n++; }));
  const sistemas = Object.values(sis).sort((a, b) => b.monto - a.monto).map(s => ({ ...s, pct: total ? s.monto / total : 0 }));
  const principales = [...mant].sort((a, b) => b.monto - a.monto).slice(0, 10);

  const hallazgos = [];
  // causaDesde: cuándo empezó lo que causó el hallazgo (sirve para saber si viene de antes de un período)
  const add = h => hallazgos.push({ evidencias: [], monto: 0, ...h,
    causaDesde: h.causaDesde ?? (h.evidencias && h.evidencias.length ? Math.min(...h.evidencias.map(r => r.dia)) : h.ultimo) });

  // 1) Piezas que se cambian antes de lo que suelen durar
  const normales = [];
  COMPONENTES.forEach(c => {
    if (c.solo && c.solo !== v.tipo) return;
    const vida = c.vida[v.tipo]; if (!vida) return;
    // Se mira todo el historial para medir el intervalo, pero solo cuentan los cambios dentro del período
    const fs = v.mant.filter(r => c.re.test(r.d) && !(c.excluye && c.excluye.test(r.d)));
    const ev = eventos(fs);
    if (c.id === 'motor') return;   // el motor se analiza aparte, con los cambios de aceite
    const rapidos = [], buenos = [];
    ev.forEach((e, i) => {
      if (!i || !enRango(e)) return;
      const int = meses(e.dia - ev[i - 1].dia);
      // Las llantas se compran de a pares (delanteras y traseras por separado): solo cuenta si es muy seguido
      (int < vida * (c.id === 'llantas' ? 0.5 : 0.75) ? rapidos : buenos).push({ e, prev: ev[i - 1], int });
    });
    if (rapidos.length) {
      const peor = rapidos.reduce((a, b) => a.int < b.int ? a : b);
      const muyRapido = c.id === 'llantas' ? [] : rapidos.filter(x => x.int < 3 && vida >= 8);
      const causa = muyRapido.length >= Math.ceil(rapidos.length / 2) ? 'reparacion' : c.causa;
      const lista = rapidos.map(x => `${mesAnio(x.prev.dia)} → ${mesAnio(x.e.dia)} (${x.int < 1 ? 'menos de 1 mes' : plural(Math.round(x.int), 'mes', 'meses')})`).join('; ');
      const monto = rapidos.reduce((s, x) => s + x.e.monto, 0);
      // Es grave si se repite o fue muy rápido, y además costó dinero de verdad
      const caro = monto >= (v.tipo === 'moto' ? 300 : 1000);
      add({
        causa, componente: c.id, nivel: (rapidos.length >= 2 || peor.int < vida / 3) && caro ? 'alto' : caro || rapidos.length >= 2 ? 'medio' : 'bajo',
        titulo: `${c.nombre}: ${plural(rapidos.length, 'cambio', 'cambios')} antes de tiempo`,
        detalle: `Suele durar unos ${vida} meses en ${v.tipo === 'moto' ? 'una moto' : 'un furgón'} de reparto, pero se volvió a cambiar a los ${lista}. ` +
          (causa === 'reparacion' ? 'Volver al taller por lo mismo en menos de 3 meses indica que el arreglo no quedó bien o el repuesto fue de mala calidad.' : c.porque),
        consejo: causa === 'reparacion' ? 'Pedir garantía al taller por los arreglos que no duraron y exigir repuestos de calidad.' : c.consejo,
        evidencias: rapidos.flatMap(x => x.e.filas), monto, ultimo: Math.max(...rapidos.map(x => x.e.dia)),
        // la pieza que duró poco se había puesto en el cambio anterior
        causaDesde: Math.min(...rapidos.map(x => x.prev.dia)),
      });
    } else if (buenos.length) {
      normales.push(`${c.nombre.split(' (')[0].toLowerCase()} cada ~${fmt0.format(mediana(buenos.map(x => x.int)))} meses`);
    }
  });

  // 2) Reparaciones mayores de motor: ¿iban al día los cambios de aceite?
  const ac = aceite(v, Math.min(hasta, ctx.ref));
  const cMotor = COMPONENTES.find(c => c.id === 'motor');
  const umbral = v.tipo === 'moto' ? 800 : 2000;
  const evMotor = eventos(v.mant.filter(r => cMotor.re.test(r.d)), 30);
  evMotor.filter(e => enRango(e) && e.monto >= umbral).forEach((e, i, arr) => {
    const txt = e.filas.map(r => r.d).join(' ');
    const base = { componente: 'motor', evidencias: e.filas, monto: e.monto, ultimo: e.dia };
    const cuando = `${mesAnio(e.dia)}, ${bs(e.monto)}`;
    if (RE_AGUA.test(txt)) {
      add({ ...base, causa: 'maluso', nivel: 'alto', titulo: `Motor dañado por agua (${cuando})`,
        detalle: 'La descripción dice que entró agua al motor. Pasa al cruzar calles inundadas o lavar el motor a presión: es un daño evitable.',
        consejo: 'Indicar a los conductores no cruzar calles inundadas; si es inevitable, ir despacio y no apagar el motor dentro del agua.' });
      return;
    }
    if (v.primero > e.dia - 180) {
      add({ ...base, causa: 'desgaste', nivel: 'medio', titulo: `Reparación mayor de motor (${cuando})`,
        detalle: 'No hay suficiente historial antes de esta reparación para saber si los cambios de aceite iban al día.',
        consejo: 'Registrar siempre el kilometraje en cada cambio de aceite para poder seguirlo.' });
      return;
    }
    // Mayor espacio sin cambio de aceite en los 6 meses anteriores (incluye hasta el día de la reparación)
    const prev = ac.eventos.filter(a => a.dia < e.dia - 3 && a.dia >= e.dia - 180).map(a => a.dia);
    const puntos = [Math.max(e.dia - 180, v.primero), ...prev, e.dia];
    let hueco = 0, hA = 0, hB = 0;
    for (let k = 1; k < puntos.length; k++) if (puntos[k] - puntos[k - 1] > hueco) { hueco = puntos[k] - puntos[k - 1]; hA = puntos[k - 1]; hB = puntos[k]; }
    const esperado = ACEITE_DIAS[v.tipo];
    const repetida = i > 0 && meses(e.dia - arr[i - 1].dia) < cMotor.vida[v.tipo];
    const confiable = ctx.parteCompleta(v.tipo, hA, hB) >= 0.6;
    if (hueco > esperado * 2 && !confiable) {
      add({ ...base, causa: 'desgaste', nivel: 'medio', titulo: `Reparación mayor de motor (${cuando})`,
        detalle: `Antes de esta reparación hay ${fmt0.format(hueco)} días sin cambio de aceite registrado, pero en esos meses tampoco aparecen los cambios de aceite de casi toda la flota: ` +
          'lo más probable es que falten registros, así que no se puede saber si fue descuido o desgaste.',
        consejo: 'Registrar todos los cambios de aceite en el Excel para que el análisis pueda separar descuido de desgaste.' });
    } else if (hueco > esperado * 2) {
      add({ ...base, causaDesde: hA, causa: 'mantenimiento', nivel: 'alto', titulo: `Reparación mayor de motor tras ${fmt0.format(hueco)} días sin cambio de aceite registrado (${cuando})`,
        detalle: `En los 6 meses anteriores a esta reparación pasaron ${fmt0.format(hueco)} días sin cambio de aceite cargado en el Excel (del ${fechaCorta(hA)} al ${fechaCorta(hB)}), cuando lo normal es cada ${esperado}; en esos meses el resto de la flota sí tiene sus cambios cargados. ` +
          'Si de verdad no se cambió, el motor trabajó con aceite vencido y este gasto probablemente se pudo evitar. Si se cambió y no se cargó, el comprobante lo demuestra.',
        consejo: `Buscar si hubo un cambio de aceite entre el ${fechaCorta(hA)} y el ${fechaCorta(hB)} que no se cargó; si no lo hubo, cumplir el cambio cada ${esperado} días aproximadamente (o según el kilometraje).` });
    } else if (repetida) {
      add({ ...base, causaDesde: arr[i - 1].dia, causa: 'reparacion', nivel: 'alto', titulo: `El motor se volvió a reparar al poco tiempo (${cuando})`,
        detalle: `Ya había tenido una reparación de motor en ${mesAnio(arr[i - 1].dia)}. ${cMotor.porque}`,
        consejo: 'Pedir al taller un diagnóstico de la causa (recalentamiento, consumo de aceite) y garantía de la reparación anterior.' });
    } else {
      add({ ...base, causa: 'desgaste', nivel: 'medio', titulo: `Reparación mayor de motor (${cuando})`,
        detalle: 'Los cambios de aceite estaban al día antes de esta reparación, así que apunta a desgaste por kilometraje y años de uso, no a descuido.',
        consejo: v.tipo === 'moto' ? 'Si la moto ya tuvo más de una reparación de motor, evaluar si conviene reemplazarla.' : 'Seguir con los cambios de aceite al día; con más reparaciones así, evaluar la renovación del vehículo.' });
    }
  });

  // 3) Pinchazos frecuentes
  const pin = eventos(filas.filter(r => RE_PINCHAZO.test(r.d)), 2);
  const porAnio = pin.length / Math.max(m / 12, 0.5);
  if (pin.length >= 4 && porAnio >= 4) {
    add({ causa: 'condiciones', nivel: porAnio >= 8 ? 'alto' : 'medio', titulo: `Pinchazos frecuentes: ${plural(pin.length, 'parchado', 'parchados')} (${fmt0.format(porAnio)} por año)`,
      detalle: 'Muchos pinchazos suelen venir de llantas muy gastadas, presión baja o rutas con clavos y vidrios. Cada parchado es poco dinero, pero también es tiempo sin repartir.',
      consejo: 'Revisar el desgaste de las llantas y la presión; si están lisas, cambiarlas sale más barato que seguir parchando.',
      evidencias: pin.flatMap(e => e.filas), monto: pin.reduce((s, e) => s + e.monto, 0), ultimo: pin[pin.length - 1].dia });
  }

  // 4) Daños externos: choques, caídas, robos
  mant.filter(r => RE_EXTERNO.test(r.d)).forEach(r => add({ causa: 'externo', nivel: r.monto >= 300 ? 'alto' : r.monto >= 100 ? 'medio' : 'bajo',
    titulo: `Daño externo (${mesAnio(r.dia)}, ${bs(r.monto)})`,
    detalle: `"${r.descripcion.trim().slice(0, 140)}". Golpes, caídas y robos no son desgaste: conviene registrar qué pasó y quién iba manejando.`,
    consejo: 'Dejar por escrito cada incidente (fecha, conductor, qué pasó) para ver si se repite con la misma persona.',
    evidencias: [r], monto: r.monto, ultimo: r.dia }));

  // 5) Poco mantenimiento preventivo
  // Solo cuentan los meses en que la flota sí tiene sus preventivos registrados
  const okDia = r => ctx.completo(v.tipo, r.dia);
  const prev = eventos(mant.filter(r => r.tipo === 'PREVENTIVO' && okDia(r)), 7).length;
  const esperados = m * ctx.parteCompleta(v.tipo, ini, fin) * 30.44 / ACEITE_DIAS[v.tipo];
  if (m >= 6 && esperados >= 3 && prev < esperados * 0.5) {
    const corr = mant.filter(r => r.tipo !== 'PREVENTIVO').reduce((s, r) => s + r.monto, 0);
    add({ causa: 'mantenimiento', nivel: prev < esperados * 0.3 ? 'alto' : 'medio',
      titulo: `Pocos mantenimientos preventivos: ${prev} de ~${fmt0.format(esperados)} esperados`,
      detalle: `En los meses con registros completos hubo ${plural(prev, 'preventivo', 'preventivos')}; lo normal sería uno cada ${ACEITE_DIAS[v.tipo]} días. ` +
        `Sin preventivos, las fallas aparecen como correctivos, que cuestan más (aquí ${bs(corr)} en correctivos y repuestos).`,
      consejo: 'Programar los preventivos con fecha fija para este vehículo.', monto: 0, ultimo: fin });
  }

  // 6) Gasto en aumento (año contra año anterior)
  if (fin - ini >= 700) {
    const sum = (a, b) => mant.reduce((s, r) => s + (r.dia > a && r.dia <= b ? r.monto : 0), 0);
    const ult = sum(fin - 365, fin), ant = sum(fin - 730, fin - 365);
    if (ant > 0 && ult > ant * 1.5 && ult - ant >= (v.tipo === 'moto' ? 800 : 2000))
      add({ causa: 'desgaste', nivel: 'medio', titulo: `El gasto va en aumento: ${bs(ant)} → ${bs(ult)} en el último año`,
        detalle: 'Cuando un vehículo empieza a pedir más reparaciones año tras año, es la señal típica del desgaste acumulado.',
        consejo: 'Comparar lo que cuesta mantenerlo con lo que costaría renovarlo.', monto: 0, ultimo: fin });
  }

  // 7) Filas que parecen cargadas dos veces en el Excel: mismo día, tipo, descripción y monto,
  //    y la misma factura (o una de las dos sin número). No se suman a ninguna causa.
  const vistos = new Map();
  filas.filter(r => !COMBUSTIBLE.includes(r.tipo)).forEach(r => {
    const k = [r.fecha, r.tipo, norm(r.descripcion).trim(), r.monto].join('|');
    const otra = (vistos.get(k) || []).find(o => !o.doc || !r.doc || o.doc === r.doc);
    if (otra) add({ causa: 'datos', nivel: 'medio', titulo: `Posible gasto cargado dos veces (${fechaCorta(r.dia)}, ${bs(r.monto)})`,
      detalle: `Hay dos filas iguales en el Excel: mismo día, tipo, descripción y monto${otra.doc && r.doc ? `, y la misma factura (${r.doc})` : ''}. Si es el mismo gasto, el total está inflado en ${bs(r.monto)}.`,
      consejo: 'Revisar en la hoja Detalle si son dos gastos distintos o uno repetido.', evidencias: [otra, r], monto: 0, ultimo: r.dia, sinCosto: true });
    vistos.set(k, [...(vistos.get(k) || []), r]);
  });

  if (normales.length)
    add({ causa: 'desgaste', nivel: 'bajo', titulo: 'Cambios normales por desgaste',
      detalle: `Estas piezas se cambiaron dentro de lo esperado: ${normales.join(', ')}. Es el desgaste propio del trabajo de reparto.`,
      consejo: '', monto: 0 });

  const NIVEL = { alto: 0, medio: 1, bajo: 2 };
  hallazgos.sort((a, b) => NIVEL[a.nivel] - NIVEL[b.nivel] || CAUSAS[a.causa].orden - CAUSAS[b.causa].orden || b.monto - a.monto);

  // ¿De dónde viene el gasto? Cada gasto cuenta una sola vez, en la causa más grave que lo nombra;
  // lo que no está en ningún hallazgo es desgaste normal y servicio.
  const asignado = new Map();
  [...hallazgos].sort((a, b) => CAUSAS[a.causa].orden - CAUSAS[b.causa].orden)
    .forEach(h => { if (!h.sinCosto) h.evidencias.forEach(r => { if (r.mant && enRango(r) && !asignado.has(r)) asignado.set(r, h.causa); }); });
  const causas = Object.fromEntries(Object.keys(CAUSAS).map(k => [k, 0]));
  mant.forEach(r => causas[asignado.get(r) || 'desgaste'] += r.monto);

  const veredicto = conclusion(v, { total, causas, hallazgos, ratio, comp, porMes, principales, sistemas });
  const recomendaciones = [...new Set(hallazgos.filter(h => h.consejo && h.nivel !== 'bajo').map(h => h.consejo))];
  if (ac.vencido && hasta >= ctx.ref)
    recomendaciones.unshift(`Confirmar el cambio de aceite: el último cargado en el Excel es del ${fechaCorta(ac.ultimo)} (hace ${ac.dias} días) y se suele hacer cada ${ac.cada}. Si se hizo, cargarlo; si no, hacerlo.`);
  if (!recomendaciones.length) recomendaciones.push('Seguir con los mantenimientos preventivos como hasta ahora.');

  const km = [...v.filas].reverse().find(r => +r.km > 0);
  const kmProx = [...v.filas].reverse().find(r => +r.prox > 0);
  return {
    placa, tipo: v.tipo, modelo: v.modelo, etiqueta: v.etiqueta, proxi: v.proxi, enFlota: v.enFlota,
    desde: ini, hasta: fin, meses: m, n: mant.length, total, porMes, ratio, comp, combustible, otros,
    sistemas, principales, hallazgos, causas, veredicto, recomendaciones, aceite: ac,
    km: km ? { valor: +km.km, dia: km.dia } : null, kmProx: kmProx ? { valor: +kmProx.prox, dia: kmProx.dia } : null,
  };
}

// Conclusión en palabras: por qué gastó lo que gastó y qué pesa más
function conclusion(v, { total, causas, hallazgos, ratio, comp, porMes, principales, sistemas }) {
  const parte = k => total ? causas[k] / total : 0;
  const evitable = parte('maluso') + parte('externo');
  let causa = 'desgaste', titulo = 'Desgaste normal por uso';
  const malusoAlto = hallazgos.filter(h => h.causa === 'maluso' && h.nivel === 'alto').length;
  if (evitable >= 0.2 || evitable >= 0.1 && malusoAlto >= 2) { causa = 'maluso'; titulo = 'Hay indicios de mal uso'; }
  else if (parte('mantenimiento') >= 0.2) { causa = 'mantenimiento'; titulo = 'El gasto viene sobre todo de falta de mantenimiento'; }
  else if (parte('reparacion') >= 0.2) { causa = 'reparacion'; titulo = 'Hay reparaciones que no duraron'; }
  else if (parte('condiciones') >= 0.2) { causa = 'condiciones'; titulo = 'El gasto viene sobre todo de las condiciones de ruta'; }
  else {
    // Ninguna causa sola pesa tanto, pero juntas sí: parte del gasto se pudo evitar
    const evitables = ['maluso', 'externo', 'mantenimiento', 'reparacion'];
    const suma = evitables.reduce((s, k) => s + parte(k), 0);
    if (suma >= 0.3) { causa = evitables.reduce((a, b) => parte(a) >= parte(b) ? a : b); if (causa === 'externo') causa = 'maluso'; titulo = 'Parte del gasto se pudo evitar'; }
  }

  const frases = [];
  if (!total) return { causa, titulo: 'Sin gastos de mantenimiento en el período', texto: 'No hay gastos de mantenimiento registrados para este período.' };
  if (comp.n >= 3 && ratio) {
    const quien = v.tipo === 'moto' ? 'una moto típica' : 'un furgón típico';
    frases.push(ratio >= 1.3 ? `Gasta ${ratio.toFixed(1).replace('.', ',')} veces lo que ${quien} de la flota (${bs(porMes)} por mes contra ${bs(comp.mediana)}).`
      : ratio <= 0.75 ? `Gasta menos que ${quien} de la flota (${bs(porMes)} por mes contra ${bs(comp.mediana)}).`
      : `Gasta parecido a ${quien} de la flota (${bs(porMes)} por mes contra ${bs(comp.mediana)}).`);
  }
  const top = principales[0];
  if (top && top.monto >= total * 0.3)
    frases.push(`Un solo gasto explica el ${Math.round(top.monto / total * 100)}% del total: ${top.descripcion.trim() ? top.descripcion.trim().slice(0, 90).toLowerCase() : 'un ' + top.tipo.toLowerCase() + ' sin descripción'} (${mesAnio(top.dia)}, ${bs(top.monto)}).`);
  else if (sistemas[0])
    frases.push(`Lo que más gasta es ${sistemas[0].nombre.toLowerCase()} (${Math.round(sistemas[0].pct * 100)}%)${sistemas[1] ? ` y ${sistemas[1].nombre.toLowerCase()} (${Math.round(sistemas[1].pct * 100)}%)` : ''}.`);
  const pctTxt = k => `${Math.round(parte(k) * 100)}%`;
  if (titulo === 'Parte del gasto se pudo evitar') {
    const det = ['maluso', 'mantenimiento', 'reparacion', 'externo'].filter(k => parte(k) >= 0.05).map(k => `${CAUSAS[k].nombre.toLowerCase()} (${pctTxt(k)})`);
    frases.push(`La mayor parte es desgaste normal (${pctTxt('desgaste')}), pero un ${Math.round((1 - parte('desgaste') - parte('condiciones')) * 100)}% se pudo evitar: ${det.join(', ')}.`);
  } else if (causa === 'maluso') frases.push(`Alrededor del ${Math.round(evitable * 100)}% del gasto tiene señales de mal uso o daños evitables: conviene revisarlo con el conductor.`);
  else if (causa === 'mantenimiento') frases.push(`Alrededor del ${pctTxt('mantenimiento')} del gasto se relaciona con mantenimientos que no se hicieron a tiempo.`);
  else if (causa === 'reparacion') frases.push(`Alrededor del ${pctTxt('reparacion')} del gasto son arreglos que se repitieron al poco tiempo: hay que pedir garantía al taller.`);
  else if (causa === 'condiciones') frases.push(`Alrededor del ${pctTxt('condiciones')} del gasto viene de llantas y pinchazos: tiene más que ver con la ruta que con el conductor.`);
  else frases.push(`No se ven señales fuertes de mal uso: la mayor parte (${pctTxt('desgaste')}) es desgaste propio del trabajo y servicio normal.`);
  // Aunque no sea lo que más pesa, avisar de lo puntual que sí conviene revisar
  if (causa !== 'maluso') {
    const puntuales = hallazgos.filter(h => h.causa !== 'desgaste' && h.causa !== 'datos' && h.causa !== causa && h.nivel !== 'bajo');
    const temas = [...new Set(puntuales.map(h => h.titulo.split(':')[0].split(' (')[0].split(' tras ')[0].toLowerCase()))];
    if (temas.length && titulo !== 'Parte del gasto se pudo evitar') frases.push(`Aun así, hay ${plural(temas.length, 'punto', 'puntos')} a revisar: ${temas.slice(0, 4).join('; ')}.`);
  }
  return { causa, titulo, texto: frases.join(' ') };
}

// ── Consejos del taller para toda la flota ───────────────────────────────────
// placas: Set de placas a mirar (null = todas las que tuvieron gastos en los últimos 90 días)
function consejos(ctx, { placas = null, dias = 365 } = {}) {
  const lista = [];
  const desde = ctx.ref - dias;
  ctx.veh.forEach(v => {
    if (placas ? !placas.has(v.placa) : (ctx.enFlota ? !ctx.enFlota.has(v.placa) : v.ultimo < ctx.ref - 90)) return;
    const inf = informe(ctx, v.placa);
    const ac = inf.aceite;
    if (ac.vencido)
      lista.push({ placa: v.placa, nivel: ac.atraso >= 1.6 ? 'alto' : 'medio', causa: 'mantenimiento', clase: 'aceite', monto: 0, ultimo: ctx.ref,
        titulo: 'Cambio de aceite sin registro reciente',
        detalle: `El último cambio cargado es del ${fechaCorta(ac.ultimo)}, hace ${ac.dias} días; ${ac.desdeHistorial ? 'este vehículo lo hace' : 'lo normal es'} cada ${ac.cada} días. Si ya se hizo, falta cargarlo en el Excel; si no, ya toca.` +
          (ctx.parteCompleta(v.tipo, ac.ultimo, ctx.ref) < 0.6 ? ' Puede que ya se haya hecho y falte registrarlo: en estos meses faltan cambios de aceite de casi toda la flota.' : '') });
    inf.hallazgos.filter(h => h.nivel !== 'bajo' && h.causa !== 'desgaste' && (h.ultimo || 0) >= desde)
      .forEach(h => lista.push({ placa: v.placa, nivel: h.nivel, causa: h.causa, clase: h.componente || h.causa, monto: h.monto, ultimo: h.ultimo, titulo: h.titulo, detalle: h.consejo || h.detalle }));
    // Gasto alto en el último año comparado con vehículos iguales
    const anio = informe(ctx, v.placa, { desde });
    if (anio.comp.n >= 3 && anio.ratio >= 1.5 && anio.total >= (v.tipo === 'moto' ? 1500 : 4000))
      lista.push({ placa: v.placa, nivel: anio.ratio >= 2 ? 'alto' : 'medio', causa: anio.veredicto.causa, clase: 'gasto', monto: anio.total, ultimo: ctx.ref,
        titulo: `Gastó ${anio.ratio.toFixed(1).replace('.', ',')} veces lo normal en el último año`,
        detalle: `${bs(anio.total)} en mantenimiento en los últimos 12 meses. ${anio.veredicto.titulo}` +
          (anio.principales[0] && anio.principales[0].monto >= anio.total * 0.3 ? `; lo que más pesó: ${(anio.principales[0].descripcion.trim() || anio.principales[0].tipo).slice(0, 70).toLowerCase()} (${bs(anio.principales[0].monto)}).`
            : anio.sistemas[0] ? `; lo que más pesó: ${anio.sistemas[0].nombre.toLowerCase()} (${Math.round(anio.sistemas[0].pct * 100)}%).` : '.') });
  });
  const NIVEL = { alto: 0, medio: 1, bajo: 2 };
  return lista.sort((a, b) => NIVEL[a.nivel] - NIVEL[b.nivel] || (a.clase === 'aceite') - (b.clase === 'aceite') || b.monto - a.monto);
}

const api = { norm, MANT, PARTES, GENERAL, PARTE, CORRECCIONES, corregir, clasificar, PLACAS_RAM, ETIQUETA,
  tipoVehiculo, modeloVehiculo, CAUSAS, COMPONENTES, preparar, informe, consejos, aceite, eventos, esAceite, dia, fechaCorta, mesAnio };
global.Taller = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
